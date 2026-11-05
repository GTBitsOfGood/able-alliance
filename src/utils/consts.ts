import type { RouteStatus } from "@db/generated/enums";
import type { ToastType } from "@/server/notifications/emitToast";

export enum HTTP_STATUS_CODE {
  BAD_REQUEST = 400,
  OK = 200,
  CREATED = 201,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  METHOD_NOT_ALLOWED = 405,
  INTERNAL_SERVER_ERROR = 500,
}

// Pickup times and windows must fall inside these hours (America/New_York).
export const SERVICE_START_TIME = "07:30";
export const SERVICE_END_TIME = "19:45";

// Maximum cumulative delay a student can report before cancelling their ride.
export const MAX_DELAY_MINUTES = 15;

export const ROUTE_STATUS_NOTIFICATIONS = {
  ActionRequired: {
    type: "warn",
    message: "Your ride needs attention. Please contact an administrator.",
  },
  Requested: { type: "info", message: "Your ride has been requested." },
  Scheduled: { type: "success", message: "Your ride has been scheduled." },
  EnRoute: { type: "info", message: "Your driver is on the way!" },
  Arrived: {
    type: "info",
    message: (pickupName: string) =>
      `Your driver has arrived at ${pickupName}.`,
  },
  Pickedup: {
    type: "success",
    message: "You've been picked up. Your ride is in progress.",
  },
  Completed: {
    type: "success",
    message: "You've been dropped off. Thank you for riding with us!",
  },
  Missing: {
    type: "warn",
    message:
      "Your driver marked you as a no-show. Please contact an administrator if you still need a ride.",
  },
  CancelledByStudent: {
    type: "error",
    message: "Your ride has been cancelled.",
  },
  CancelledByAdmin: {
    type: "error",
    message: "Your ride has been cancelled by an administrator.",
  },
} satisfies Record<
  RouteStatus,
  { type: ToastType; message: string | ((pickupName: string) => string) }
>;
