"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  eachMonthOfInterval,
  format,
  isValid,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
} from "date-fns";
import { fromZonedTime } from "date-fns-tz";

import { routeStatusLabels } from "@/utils/route-status";

import { RouteStatus } from "@db/generated/enums";
import { useAdminRides } from "@/hooks/useAdminRides";
import type { DriverEntry, RouteEntry, VehicleEntry } from "@/types/admin";
import {
  EST_TIME_ZONE,
  estDateKey,
  estTimeStr,
  parseCalendarDate,
} from "@/utils/dateEst";
import {
  formatMinutes,
  formatMinuteRange,
  isPickupInServiceHours,
  isServiceDate,
  SERVICE_END_MINUTES,
  SERVICE_START_MINUTES,
  timeToMinutes,
} from "@/utils/rideTiming";

const PICKUP_INTERVAL_MINUTES = 15;
const FIRST_SERVICE_HOUR = Math.floor(SERVICE_START_MINUTES / 60);
const LAST_SERVICE_HOUR = Math.floor(SERVICE_END_MINUTES / 60);

export const pickupDemandHours = Array.from(
  { length: LAST_SERVICE_HOUR - FIRST_SERVICE_HOUR + 1 },
  (_, index) => (FIRST_SERVICE_HOUR + index) * 60,
);

export const reportingPeriods = {
  weekly: { label: "Weekly", start: startOfWeek, shift: addWeeks },
  monthly: { label: "Monthly", start: startOfMonth, shift: addMonths },
  yearly: { label: "Yearly", start: startOfYear, shift: addYears },
} as const;

export type ReportingPeriod = keyof typeof reportingPeriods;

export const dashboardSections = {
  overview: "Overview",
  students: "Students",
  drivers: "Drivers",
  vehicles: "Vehicles",
  locations: "Locations",
} as const;

export type DashboardSection = keyof typeof dashboardSections;
export type DashboardDetailSection = Exclude<DashboardSection, "overview">;

function getReportingRange(view: string | null, date: string | null) {
  const period: ReportingPeriod =
    view === "monthly" || view === "yearly" ? view : "weekly";
  const { start, shift } = reportingPeriods[period];
  const today = estDateKey(new Date());
  const parsedDate =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? parseCalendarDate(date) : null;
  const anchor =
    date &&
    parsedDate &&
    isValid(parsedDate) &&
    format(parsedDate, "yyyy-MM-dd") === date &&
    date <= today
      ? date
      : today;
  const first = start(parseCalendarDate(anchor), { weekStartsOn: 1 });
  const end = shift(first, 1);
  const last = subDays(end, period === "weekly" ? 3 : 1);
  const firstKey = format(first, "yyyy-MM-dd");
  const previousStart = shift(first, -1);
  // Avoid year zero in report links.
  const previous =
    previousStart.getFullYear() > 0
      ? format(previousStart, "yyyy-MM-dd")
      : null;
  const nextKey = format(end, "yyyy-MM-dd");
  const next = nextKey <= today ? nextKey : null;

  let label: string;
  if (period === "yearly") {
    label = format(first, "yyyy");
  } else if (period === "monthly") {
    label = format(first, "MMMM yyyy");
  } else {
    const firstFormat =
      first.getFullYear() === last.getFullYear() ? "MMM d" : "MMM d, yyyy";
    const lastFormat =
      first.getMonth() === last.getMonth() ? "d, yyyy" : "MMM d, yyyy";
    label = `${format(first, firstFormat)}–${format(last, lastFormat)}`;
  }

  return {
    period,
    anchor,
    previous,
    next,
    current: firstKey <= today && today < nextKey,
    label,
    first,
    end,
    last,
  };
}

const outcomeByStatus = {
  [RouteStatus.Completed]: "Completed",
  [RouteStatus.CancelledByStudent]: "Cancelled",
  [RouteStatus.CancelledByAdmin]: "Cancelled",
  [RouteStatus.Missing]: "No-show",
  [RouteStatus.Requested]: "Open",
  [RouteStatus.ActionRequiredByAdmin]: "Open",
  [RouteStatus.ActionRequiredByStudent]: "Open",
  [RouteStatus.Scheduled]: "Open",
  [RouteStatus.EnRoute]: "Open",
  [RouteStatus.Arrived]: "Open",
  [RouteStatus.Pickedup]: "Open",
} as const satisfies Record<RouteStatus, string>;

export const dashboardRideStatuses = [
  {
    label: "Ongoing",
    statuses: Object.values(RouteStatus).filter(
      (status) => outcomeByStatus[status] === "Open",
    ),
    color: "--chart-open",
  },
  {
    label: routeStatusLabels.CancelledByStudent,
    statuses: [RouteStatus.CancelledByStudent],
    color: "--chart-cancelled",
  },
  {
    label: routeStatusLabels.CancelledByAdmin,
    statuses: [RouteStatus.CancelledByAdmin],
    color: "--color-grey-text-weak",
  },
  {
    label: routeStatusLabels.Missing,
    statuses: [RouteStatus.Missing],
    color: "--chart-missing",
  },
  {
    label: routeStatusLabels.Completed,
    statuses: [RouteStatus.Completed],
    color: "--chart-completed",
  },
];

function getPeriodRides(
  rides: RouteEntry[],
  { first, end }: ReturnType<typeof getReportingRange>,
) {
  const from = fromZonedTime(first, EST_TIME_ZONE);
  const until = fromZonedTime(end, EST_TIME_ZONE);

  return rides.flatMap((ride) => {
    const pickupTime = new Date(ride.scheduledPickupTime);
    if (pickupTime < from || pickupTime >= until) return [];

    const day = estDateKey(pickupTime);
    return isServiceDate(day) ? [{ ride, pickupTime, day }] : [];
  });
}

type PeriodRides = ReturnType<typeof getPeriodRides>;

function summarizeRides(
  rides: PeriodRides,
  { period, first, last }: ReturnType<typeof getReportingRange>,
) {
  const monthlyBuckets = period === "yearly";
  const interval = { start: first, end: last };
  const dates = monthlyBuckets
    ? eachMonthOfInterval(interval)
    : eachDayOfInterval(interval).filter((date) =>
        isServiceDate(format(date, "yyyy-MM-dd")),
      );
  const bucketKey = monthlyBuckets ? "yyyy-MM" : "yyyy-MM-dd";
  const labelFormat =
    period === "yearly" ? "MMM" : period === "monthly" ? "d" : "EEE, MMM d";
  const volume = new Map(
    dates.map((date) => [
      format(date, bucketKey),
      {
        label: format(date, labelFormat),
        fullLabel: format(date, monthlyBuckets ? "MMMM" : "EEE, MMM d"),
        count: 0,
      },
    ]),
  );
  const outcomes = { Completed: 0, Cancelled: 0, "No-show": 0, Open: 0 };
  const studentsServed = new Set<string>();
  const pickupsByTime = new Map<number, number>(
    Array.from(
      {
        length: Math.ceil(
          (SERVICE_END_MINUTES - SERVICE_START_MINUTES) /
            PICKUP_INTERVAL_MINUTES,
        ),
      },
      (_, index) => [
        SERVICE_START_MINUTES + index * PICKUP_INTERVAL_MINUTES,
        0,
      ],
    ),
  );
  const weekdayDemand = Array.from({ length: 5 }, () =>
    Array<number>(pickupsByTime.size).fill(0),
  );
  const total = rides.length;
  let needsAttention = 0;

  for (const { ride, pickupTime, day } of rides) {
    const bucket = volume.get(monthlyBuckets ? day.slice(0, 7) : day);
    if (bucket) bucket.count += 1;

    const outcome = outcomeByStatus[ride.status];
    outcomes[outcome] += 1;

    if (ride.status === RouteStatus.Completed)
      studentsServed.add(ride.studentId);
    if (
      ride.status === RouteStatus.Requested ||
      ride.status === RouteStatus.ActionRequiredByAdmin
    ) {
      needsAttention += 1;
    }

    const minuteOfDay = timeToMinutes(estTimeStr(pickupTime));
    if (isPickupInServiceHours(minuteOfDay)) {
      const index = Math.min(
        Math.floor(
          (minuteOfDay - SERVICE_START_MINUTES) / PICKUP_INTERVAL_MINUTES,
        ),
        pickupsByTime.size - 1,
      );
      const start = SERVICE_START_MINUTES + index * PICKUP_INTERVAL_MINUTES;
      pickupsByTime.set(start, (pickupsByTime.get(start) ?? 0) + 1);
      weekdayDemand[parseCalendarDate(day).getDay() - 1][index] += 1;
    }
  }

  const pickupTimes = [...pickupsByTime.entries()]
    .sort(([a], [b]) => a - b)
    .map(([minuteOfDay, count]) => ({
      minuteOfDay,
      count,
      label: formatMinutes(Math.max(minuteOfDay, SERVICE_START_MINUTES)),
      fullLabel: formatMinuteRange(
        Math.max(minuteOfDay, SERVICE_START_MINUTES),
        Math.min(minuteOfDay + PICKUP_INTERVAL_MINUTES, SERVICE_END_MINUTES),
      ),
    }));
  const peakCount = Math.max(0, ...pickupTimes.map(({ count }) => count));
  const peakTimes = pickupTimes.filter(
    ({ count }) => count > 0 && count === peakCount,
  );
  const finished = total - outcomes.Open;

  return {
    total,
    volume: [...volume.values()],
    outcomes,
    needsAttention,
    studentsServed: studentsServed.size,
    completionRate: finished ? outcomes.Completed / finished : null,
    pickupTimes,
    weekdayDemand,
    peakTimes,
    peakCount,
  };
}

interface ActivityRow {
  id: string;
  name: string;
  detail?: string;
  total: number;
  statuses: Record<RouteStatus, number>;
  completed: number;
  open: number;
  cancelled: number;
  studentCancelled: number;
  noShows: number;
  delayed: number;
  delayMinutes: number;
  completedDays: number;
  completedParticipants: number;
}

interface LocationRow {
  id: string;
  name: string;
  total: number;
  pickups: number;
  dropoffs: number;
  latitude?: number;
  longitude?: number;
}

interface LocationPair {
  id: string;
  pickup: string;
  dropoff: string;
  count: number;
}

type ActivitySection = "students" | "drivers" | "vehicles";

type DashboardEntity = Pick<ActivityRow, "id" | "name" | "detail"> &
  Partial<Pick<LocationRow, "latitude" | "longitude">>;

export type DashboardBreakdown =
  | {
      section: ActivitySection;
      rows: ActivityRow[];
      total: number;
      unassigned: number;
    }
  | { section: "locations"; rows: LocationRow[]; pairs: LocationPair[] };

function rankRows(a: { name: string; total: number }, b: typeof a) {
  return b.total - a.total || a.name.localeCompare(b.name);
}

function userEntity(
  user: Pick<
    DriverEntry,
    "id" | "firstName" | "lastName" | "preferredName" | "username"
  >,
): DashboardEntity {
  return {
    id: user.id,
    name: `${user.preferredName || user.firstName} ${user.lastName}`,
    detail: user.username,
  };
}

function vehicleEntity({
  id,
  name,
  vehicleId,
}: Pick<VehicleEntry, "id" | "name" | "vehicleId">): DashboardEntity {
  return { id, name, detail: vehicleId };
}

function getActivityEntity(ride: RouteEntry, section: ActivitySection) {
  if (section === "vehicles")
    return ride.vehicle ? vehicleEntity(ride.vehicle) : null;

  const user = section === "students" ? ride.student : ride.driver;
  return user ? userEntity(user) : null;
}

const activityOutcomeKeys = {
  Completed: "completed",
  Open: "open",
  Cancelled: "cancelled",
  "No-show": "noShows",
} as const;

function summarizeLocations(
  rides: PeriodRides,
  directory: DashboardEntity[],
): LocationRow[] {
  const locations = new Map<string, LocationRow>();
  for (const { id, name, latitude, longitude } of directory) {
    locations.set(id, {
      id,
      name,
      latitude,
      longitude,
      total: 0,
      pickups: 0,
      dropoffs: 0,
    });
  }

  function recordStop(
    entity: DashboardEntity,
    direction: "pickups" | "dropoffs",
  ) {
    const location = locations.get(entity.id) ?? {
      ...entity,
      total: 0,
      pickups: 0,
      dropoffs: 0,
    };
    location[direction] += 1;
    location.total += 1;
    locations.set(entity.id, location);
  }

  for (const { ride } of rides) {
    recordStop(ride.pickup, "pickups");
    recordStop(ride.dropoff, "dropoffs");
  }

  return [...locations.values()].sort(rankRows);
}

function summarizeBreakdown(
  rides: PeriodRides,
  section: DashboardDetailSection,
  directory: DashboardEntity[],
): DashboardBreakdown {
  if (section === "locations") {
    const pairs = new Map<string, LocationPair>();
    for (const { ride } of rides) {
      const id = `${ride.pickup.id}:${ride.dropoff.id}`;
      const pair = pairs.get(id) ?? {
        id,
        pickup: ride.pickup.name,
        dropoff: ride.dropoff.name,
        count: 0,
      };
      pair.count += 1;
      pairs.set(id, pair);
    }
    return {
      section,
      rows: summarizeLocations(rides, directory),
      pairs: [...pairs.values()].sort(
        (a, b) =>
          b.count - a.count ||
          a.pickup.localeCompare(b.pickup) ||
          a.dropoff.localeCompare(b.dropoff),
      ),
    };
  }

  type ActivityCounts = Omit<
    ActivityRow,
    "completedDays" | "completedParticipants"
  > & {
    completedDays: Set<string>;
    completedParticipants: Set<string>;
  };
  function emptyActivity(entity: DashboardEntity): ActivityCounts {
    return {
      ...entity,
      total: 0,
      statuses: Object.fromEntries(
        Object.values(RouteStatus).map((status) => [status, 0]),
      ) as Record<RouteStatus, number>,
      completed: 0,
      open: 0,
      cancelled: 0,
      studentCancelled: 0,
      noShows: 0,
      delayed: 0,
      delayMinutes: 0,
      completedDays: new Set<string>(),
      completedParticipants: new Set<string>(),
    };
  }
  const activity = new Map(
    directory.map((entity) => [entity.id, emptyActivity(entity)]),
  );
  let unassigned = 0;
  for (const { ride, day } of rides) {
    const entity = getActivityEntity(ride, section);
    if (!entity) {
      unassigned += 1;
      continue;
    }

    const row = activity.get(entity.id) ?? emptyActivity(entity);
    row.total += 1;
    row.statuses[ride.status] += 1;
    row[activityOutcomeKeys[outcomeByStatus[ride.status]]] += 1;

    if (section === "students") {
      if (ride.status === RouteStatus.CancelledByStudent)
        row.studentCancelled += 1;
      if (ride.delayMinutes > 0) {
        row.delayed += 1;
        row.delayMinutes += ride.delayMinutes;
      }
    } else if (ride.status === RouteStatus.Completed) {
      row.completedDays.add(day);
      const participant =
        section === "drivers" ? ride.studentId : ride.driverId;
      if (participant) row.completedParticipants.add(participant);
    }
    activity.set(entity.id, row);
  }

  return {
    section,
    rows: [...activity.values()].sort(rankRows).map((row) => ({
      ...row,
      completedDays: row.completedDays.size,
      completedParticipants: row.completedParticipants.size,
    })),
    total: rides.length - unassigned,
    unassigned,
  };
}

export function useReportingRange() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const date = searchParams.get("date");
  return useMemo(() => getReportingRange(view, date), [view, date]);
}

function useDashboardRides() {
  const range = useReportingRange();
  const {
    routes,
    drivers,
    vehicles,
    loading,
    error,
    refreshError,
    refreshRoutes,
  } = useAdminRides();
  const rides = useMemo(() => getPeriodRides(routes, range), [routes, range]);
  return {
    range,
    rides,
    routes,
    drivers,
    vehicles,
    loading,
    error,
    refreshError,
    refreshRoutes,
  };
}

export function useStatistics() {
  const { range, rides, routes, loading, error, refreshError, refreshRoutes } =
    useDashboardRides();
  const stats = useMemo(() => summarizeRides(rides, range), [rides, range]);
  const previousStats = useMemo(() => {
    if (!range.previous) return null;
    const previousRange = getReportingRange(range.period, range.previous);
    return summarizeRides(getPeriodRides(routes, previousRange), previousRange);
  }, [routes, range]);
  const previousPeriodLabel =
    range.period === "weekly"
      ? "week"
      : range.period === "monthly"
        ? "month"
        : "year";
  function comparison(
    current: number,
    previous: number,
    increaseIsGood: boolean,
  ) {
    return {
      value:
        previous === 0
          ? current === 0
            ? 0
            : null
          : (current - previous) / previous,
      increaseIsGood,
      description: `${current.toLocaleString()} in the selected ${previousPeriodLabel} vs ${previous.toLocaleString()} in the previous ${previousPeriodLabel}. Compares full reporting periods, including future scheduled rides.`,
    };
  }
  const changes = previousStats
    ? {
        total: comparison(stats.total, previousStats.total, true),
      }
    : null;

  return {
    period: range.period,
    stats,
    changes,
    loading,
    error,
    refreshError,
    refreshRoutes,
  };
}

const emptyDirectory: DashboardEntity[] = [];

function useDashboardDirectory(
  section: DashboardDetailSection,
  drivers: DriverEntry[],
  vehicles: VehicleEntry[],
) {
  const url =
    section === "students"
      ? "/api/users?type=Student"
      : section === "locations"
        ? "/api/locations"
        : null;
  const [loaded, setLoaded] = useState<{
    url: string;
    entities: DashboardEntity[];
    error: string | null;
  }>();

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    async function load(endpoint: string) {
      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load the directory.");
        const records = await response.json();
        const entities =
          section === "students"
            ? (records as DriverEntry[]).map(userEntity)
            : (records as DashboardEntity[]).map(
                ({ id, name, latitude, longitude }) => ({
                  id,
                  name,
                  latitude,
                  longitude,
                }),
              );
        if (!controller.signal.aborted)
          setLoaded({ url: endpoint, entities, error: null });
      } catch {
        if (!controller.signal.aborted) {
          setLoaded({
            url: endpoint,
            entities: emptyDirectory,
            error: `Unable to load the full ${section} list. Showing entries from rides in this period.`,
          });
        }
      }
    }
    void load(url);
    return () => controller.abort();
  }, [section, url]);

  const entries = loaded?.url === url ? loaded : undefined;
  const directory = useMemo(() => {
    if (section === "drivers") return drivers.map(userEntity);
    if (section === "vehicles") return vehicles.map(vehicleEntity);
    return entries?.entities ?? emptyDirectory;
  }, [section, drivers, vehicles, entries]);
  return {
    directory,
    loadingDirectory: Boolean(url && !entries),
    directoryError: entries?.error,
  };
}

export function useDashboardBreakdown(section: DashboardDetailSection) {
  const {
    rides,
    drivers,
    vehicles,
    loading,
    error,
    refreshError,
    refreshRoutes,
  } = useDashboardRides();
  const { directory, loadingDirectory, directoryError } = useDashboardDirectory(
    section,
    drivers,
    vehicles,
  );
  const breakdown = useMemo(
    () => summarizeBreakdown(rides, section, directory),
    [rides, section, directory],
  );

  return {
    breakdown,
    loading: loading || loadingDirectory,
    error,
    refreshError:
      [refreshError, directoryError].filter(Boolean).join(" ") || null,
    refreshRoutes,
  };
}
