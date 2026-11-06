import { STUDENT_EDIT_MIN_NOTICE_HOURS } from "./consts";
import { RouteStatus } from "@db/generated/enums";

// Prisma enum identifiers cannot contain spaces or hyphens. Keep API labels stable.
export const routeStatusLabels = {
  ActionRequiredByAdmin: "Action Required by Admin",
  ActionRequiredByStudent: "Action Required by Student",
  Requested: RouteStatus.Requested,
  Scheduled: RouteStatus.Scheduled,
  EnRoute: "En-route",
  Arrived: RouteStatus.Arrived,
  Pickedup: "Picked up",
  Completed: RouteStatus.Completed,
  Missing: RouteStatus.Missing,
  CancelledByStudent: "Cancelled by Student",
  CancelledByAdmin: "Cancelled by Admin",
} as const satisfies Record<RouteStatus, string>;

// "Delayed" is a display label, not a RouteStatus: the status keeps tracking
// where the ride is (Scheduled / EnRoute) so transitions are unaffected.
const DELAYABLE_STATUSES: ReadonlySet<RouteStatus> = new Set<RouteStatus>([
  RouteStatus.Scheduled,
  RouteStatus.EnRoute,
]);

type StatusRoute = { status: RouteStatus; delayMinutes?: number | null };

const CLOSED_CHAT_STATUSES: ReadonlySet<RouteStatus> = new Set([
  RouteStatus.Completed,
  RouteStatus.Missing,
  RouteStatus.CancelledByStudent,
  RouteStatus.CancelledByAdmin,
]);

/** Participant chat is available on every date while the ride is open. */
export function isRideChatOpen(status: RouteStatus): boolean {
  return !CLOSED_CHAT_STATUSES.has(status);
}

export const driverRideActions = {
  Scheduled: {
    endpoint: "start",
    label: "Start ride",
    busyLabel: "Starting…",
    title: "Start Ride",
    confirmLabel: "Start ride",
    confirmingLabel: "Starting…",
    variant: "primary",
  },
  EnRoute: {
    endpoint: "arrive",
    label: "Arrived at pickup",
    busyLabel: "Updating…",
    title: "Arrived at Pickup",
    confirmLabel: "Confirm Arrival",
    confirmingLabel: "Confirming…",
    variant: "primary",
  },
  Arrived: {
    endpoint: "pickup",
    label: "Student picked up",
    busyLabel: "Updating…",
    title: "Student Picked Up",
    confirmLabel: "Confirm Pickup",
    confirmingLabel: "Confirming…",
    variant: "primary",
  },
  Pickedup: {
    endpoint: "complete",
    label: "Student dropped off",
    busyLabel: "Completing…",
    title: "Student Dropped Off",
    confirmLabel: "Confirm Dropoff",
    confirmingLabel: "Completing…",
    variant: "primary",
  },
} as const;

export const driverNoShowAction = {
  endpoint: "missing",
  label: "Student no-show",
  busyLabel: "Marking…",
  title: "Student No-Show",
  confirmLabel: "Confirm No-Show",
  confirmingLabel: "Marking…",
  variant: "destructive",
} as const;

export type DriverRideAction =
  | (typeof driverRideActions)[keyof typeof driverRideActions]
  | typeof driverNoShowAction;

export function getDriverRideAction(status: RouteStatus) {
  return status in driverRideActions
    ? driverRideActions[status as keyof typeof driverRideActions]
    : undefined;
}

/** A ride shows as delayed only before pickup; afterwards the real status shows. */
export function isRouteDelayed(route: StatusRoute): boolean {
  return (route.delayMinutes ?? 0) > 0 && DELAYABLE_STATUSES.has(route.status);
}

export function routeDisplayLabel(route: StatusRoute): string {
  return isRouteDelayed(route) ? "Delayed" : routeStatusLabels[route.status];
}

export const EDITABLE_RIDE_STATUSES: ReadonlySet<RouteStatus> =
  new Set<RouteStatus>([
    RouteStatus.Requested,
    RouteStatus.Scheduled,
    RouteStatus.ActionRequiredByAdmin,
    RouteStatus.ActionRequiredByStudent,
  ]);

type EditableStudentRide = {
  status: RouteStatus;
  scheduledPickupTime: string | Date;
};

export function studentEditDisabledReason(
  route: EditableStudentRide,
  now = Date.now(),
): string | undefined {
  if (!EDITABLE_RIDE_STATUSES.has(route.status)) {
    return "This ride cannot be edited in its current status.";
  }

  if (
    new Date(route.scheduledPickupTime).getTime() - now >
    STUDENT_EDIT_MIN_NOTICE_HOURS * 60 * 60 * 1000
  ) {
    return undefined;
  }

  return `Student edits require more than ${STUDENT_EDIT_MIN_NOTICE_HOURS} hours before pickup.`;
}

export function canStudentEditRide(
  route: EditableStudentRide,
  now = Date.now(),
): boolean {
  return studentEditDisabledReason(route, now) === undefined;
}
