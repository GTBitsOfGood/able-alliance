/**
 * Reconciles a user's upcoming rides onto their Google Calendar.
 *
 * The sync is stateless: we never store a routeId -> eventId map. Instead every
 * event we create carries `extendedProperties.private.app = "able-alliance"` plus
 * the routeId, and we ask Google to list only events matching that tag. That
 * gives us an authoritative "what we put there" set on every run, which survives
 * the user deleting events by hand and needs no cleanup migration if the schema
 * changes.
 *
 * Reconciliation is scoped to a time window (see SYNC_WINDOW_*). Events outside
 * the window are left completely alone, so a sync can never touch a user's
 * distant history.
 */

import { calendar as googleCalendar, calendar_v3 } from "@googleapis/calendar";
import mongoose from "mongoose";
import { addDays } from "date-fns";
import RouteModel, { RouteStatus } from "@/server/db/models/RouteModel";
import LocationModel from "@/server/db/models/LocationModel";
import connectMongoDB from "@/server/db/mongodb";
import { getAuthedClientForUser, type GoogleOAuthClient } from "./oauthClient";
import { markSynced } from "@/server/db/actions/GoogleCalendarAction";
import type { CalendarSyncResult } from "@/utils/types/googleCalendar";
import type { UserType } from "@/utils/authUser";

/** Tag identifying events this app owns. Changing it orphans every existing event. */
export const APP_TAG = "able-alliance";
const TIME_ZONE = "America/New_York";

/** How far back and forward a sync reconciles. Outside this range we touch nothing. */
const SYNC_WINDOW_PAST_DAYS = 7;
const SYNC_WINDOW_FUTURE_DAYS = 180;

/** Fallback ride duration when a route has no estimatedDropoffTime yet. */
const DEFAULT_RIDE_MINUTES = 30;

/**
 * Statuses that belong on a calendar. A ride that moves to a cancelled status
 * drops out of this set, so the next sync deletes its event — that's the whole
 * "remove stale ones" mechanism, no special-casing required.
 */
const SYNCED_STATUSES: RouteStatus[] = [
  RouteStatus.Requested,
  RouteStatus.Scheduled,
  RouteStatus.EnRoute,
  RouteStatus.Pickedup,
  RouteStatus.Completed,
  RouteStatus.Missing,
];

type RideEventFields = {
  summary: string;
  location: string;
  description: string;
  startIso: string;
  endIso: string;
};

export function syncWindow(now = new Date()): { timeMin: Date; timeMax: Date } {
  return {
    timeMin: addDays(now, -SYNC_WINDOW_PAST_DAYS),
    timeMax: addDays(now, SYNC_WINDOW_FUTURE_DAYS),
  };
}

/** Fetch the rides that should appear on the calendar, with location names resolved. */
async function getRidesToSync(
  userId: string,
  userType: UserType,
  timeMin: Date,
  timeMax: Date,
) {
  await connectMongoDB();

  // Admins have no rides of their own; students ride, drivers drive.
  const ownerField = userType === "Driver" ? "driver._id" : "student._id";

  const routes = await RouteModel.find({
    [ownerField]: new mongoose.Types.ObjectId(userId),
    status: { $in: SYNCED_STATUSES },
    scheduledPickupTime: { $gte: timeMin, $lte: timeMax },
  }).lean();

  // Locations are ObjectId refs on Route; resolve them in one round trip rather
  // than a populate per route.
  const locationIds = new Set<string>();
  for (const route of routes) {
    locationIds.add(String(route.pickupLocation));
    locationIds.add(String(route.dropoffLocation));
  }

  const locations = await LocationModel.find({
    _id: { $in: [...locationIds] },
  }).lean();

  const locationNames = new Map<string, string>(
    locations.map((l) => [String(l._id), l.name]),
  );

  return routes.map((route) => ({
    route,
    pickupName: locationNames.get(String(route.pickupLocation)) ?? "Unknown",
    dropoffName: locationNames.get(String(route.dropoffLocation)) ?? "Unknown",
  }));
}

/** Render a ride into the calendar event fields we care about. */
function buildEventFields(
  ride: Awaited<ReturnType<typeof getRidesToSync>>[number],
  userType: UserType,
): RideEventFields {
  const { route, pickupName, dropoffName } = ride;

  const start = new Date(route.scheduledPickupTime);
  const end = route.estimatedDropoffTime
    ? new Date(route.estimatedDropoffTime)
    : new Date(start.getTime() + DEFAULT_RIDE_MINUTES * 60 * 1000);

  const descriptionLines = [
    `Status: ${route.status}`,
    `Pickup: ${pickupName}`,
    `Dropoff: ${dropoffName}`,
  ];

  // Show the counterparty: a driver wants to know who they're picking up, a
  // student wants to know who's driving.
  if (userType === "Driver") {
    if (route.student) {
      descriptionLines.push(
        `Student: ${route.student.firstName} ${route.student.lastName}`,
      );
    }
  } else if (route.driver) {
    descriptionLines.push(
      `Driver: ${route.driver.firstName} ${route.driver.lastName}`,
    );
  }

  if (route.vehicle) {
    descriptionLines.push(
      `Vehicle: ${route.vehicle.name} (${route.vehicle.licensePlate})`,
    );
  }

  descriptionLines.push("", "Synced from Able Alliance.");

  return {
    summary: `Ride: ${pickupName} to ${dropoffName}`,
    location: pickupName,
    description: descriptionLines.join("\n"),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function toGoogleEvent(
  fields: RideEventFields,
  routeId: string,
): calendar_v3.Schema$Event {
  return {
    summary: fields.summary,
    location: fields.location,
    description: fields.description,
    start: { dateTime: fields.startIso, timeZone: TIME_ZONE },
    end: { dateTime: fields.endIso, timeZone: TIME_ZONE },
    extendedProperties: { private: { app: APP_TAG, routeId } },
  };
}

/**
 * True when the live event already matches what we'd write, so we can skip the
 * PATCH. Times are compared as instants — Google echoes back RFC3339 with a UTC
 * offset ("...-04:00"), which is the same moment as our "...Z" but a different string.
 */
function eventMatches(
  existing: calendar_v3.Schema$Event,
  fields: RideEventFields,
): boolean {
  const sameInstant = (a: string | null | undefined, b: string) =>
    !!a && new Date(a).getTime() === new Date(b).getTime();

  return (
    existing.summary === fields.summary &&
    existing.location === fields.location &&
    existing.description === fields.description &&
    sameInstant(existing.start?.dateTime, fields.startIso) &&
    sameInstant(existing.end?.dateTime, fields.endIso)
  );
}

/**
 * True when Google says the event no longer exists (404) or was already deleted
 * (410).
 *
 * gaxios puts the HTTP status on `.status`; its `.status` is `string | number`
 * and usually carries a *system* code ("ECONNRESET"), so reading `.code` alone
 * would miss real 404s and abort the sync over an event that is already in the
 * state we wanted.
 */
function isAlreadyGone(e: unknown): boolean {
  if (!e || typeof e !== "object") {
    return false;
  }

  const err = e as {
    status?: number;
    code?: string | number;
    response?: { status?: number };
  };

  const status =
    err.status ??
    err.response?.status ??
    (typeof err.code === "number" ? err.code : Number(err.code));

  return status === 404 || status === 410;
}

/** List every app-owned event on the calendar inside the window, following pagination. */
async function listAppEvents(
  client: GoogleOAuthClient,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<calendar_v3.Schema$Event[]> {
  const api = googleCalendar({ version: "v3", auth: client });
  const events: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;

  do {
    const response = await api.events.list({
      calendarId,
      privateExtendedProperty: [`app=${APP_TAG}`],
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      showDeleted: false,
      maxResults: 2500,
      pageToken,
    });

    events.push(...(response.data.items ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return events;
}

/**
 * Diff the user's rides against their calendar and apply the difference.
 * Returns per-operation counts so the UI can say what actually happened.
 */
export async function syncRidesToCalendar(
  userId: string,
  userType: UserType,
  calendarId: string,
): Promise<CalendarSyncResult> {
  const client = await getAuthedClientForUser(userId);
  const api = googleCalendar({ version: "v3", auth: client });
  const { timeMin, timeMax } = syncWindow();

  const rides = await getRidesToSync(userId, userType, timeMin, timeMax);
  const existingEvents = await listAppEvents(
    client,
    calendarId,
    timeMin,
    timeMax,
  );

  // Index live events by the routeId we stamped on them. A routeId should map to
  // exactly one event; if a retry ever double-inserted, keep the first and let
  // the duplicates fall through to the delete pass.
  const eventsByRouteId = new Map<string, calendar_v3.Schema$Event>();
  const orphanedEvents: calendar_v3.Schema$Event[] = [];

  for (const event of existingEvents) {
    const routeId = event.extendedProperties?.private?.routeId;
    if (!routeId || eventsByRouteId.has(routeId)) {
      orphanedEvents.push(event);
      continue;
    }
    eventsByRouteId.set(routeId, event);
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const ride of rides) {
    const routeId = String(ride.route._id);
    const fields = buildEventFields(ride, userType);
    const existing = eventsByRouteId.get(routeId);

    if (!existing) {
      await api.events.insert({
        calendarId,
        requestBody: toGoogleEvent(fields, routeId),
      });
      created++;
      continue;
    }

    // Claim it so the delete pass below leaves it alone.
    eventsByRouteId.delete(routeId);

    if (eventMatches(existing, fields)) {
      unchanged++;
      continue;
    }

    await api.events.patch({
      calendarId,
      eventId: existing.id!,
      requestBody: toGoogleEvent(fields, routeId),
    });
    updated++;
  }

  // Anything still in the map is an event we own whose ride was cancelled,
  // reassigned, or moved out of the window. Plus any duplicates/untagged strays.
  const staleEvents = [...eventsByRouteId.values(), ...orphanedEvents];
  let deleted = 0;

  for (const event of staleEvents) {
    if (!event.id) {
      continue;
    }
    try {
      await api.events.delete({ calendarId, eventId: event.id });
      deleted++;
    } catch (e) {
      // 404/410 means it's already gone (user deleted it themselves between our
      // list and delete) — that's the desired end state, so don't fail the sync.
      if (!isAlreadyGone(e)) {
        throw e;
      }
    }
  }

  const syncedEventCount = created + updated + unchanged;
  const lastSyncedAt = await markSynced(userId, syncedEventCount);

  return {
    created,
    updated,
    deleted,
    unchanged,
    syncedEventCount,
    lastSyncedAt: lastSyncedAt.toISOString(),
  };
}

/**
 * Best-effort removal of every app-owned event from a calendar. Used when the
 * user switches calendars or disconnects, so we don't strand ride events they
 * can no longer manage from the app.
 */
export async function removeAllAppEvents(
  client: GoogleOAuthClient,
  calendarId: string,
): Promise<number> {
  const api = googleCalendar({ version: "v3", auth: client });
  const { timeMin, timeMax } = syncWindow();
  const events = await listAppEvents(client, calendarId, timeMin, timeMax);

  let deleted = 0;
  for (const event of events) {
    if (!event.id) {
      continue;
    }
    try {
      await api.events.delete({ calendarId, eventId: event.id });
      deleted++;
    } catch {
      // Best effort: a failure here must not block a disconnect.
    }
  }

  return deleted;
}

/** Calendars the user can write ride events to, for the picker dropdown. */
export async function listUserCalendars(client: GoogleOAuthClient) {
  const api = googleCalendar({ version: "v3", auth: client });
  const response = await api.calendarList.list({ maxResults: 250 });

  return (response.data.items ?? [])
    .filter(
      (item) => item.accessRole === "owner" || item.accessRole === "writer",
    )
    .map((item) => ({
      id: item.id!,
      summary: item.summary ?? item.id!,
      primary: item.primary === true,
      accessRole: item.accessRole ?? "reader",
    }));
}
