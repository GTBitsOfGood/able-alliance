import type { ToastPayload } from "@/types/notifications";

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

// Student edits require strictly more than this many hours before pickup.
export const STUDENT_EDIT_MIN_NOTICE_HOURS = 3;

// Maximum cumulative delay a student can report before cancelling their ride.
export const MAX_DELAY_MINUTES = 15;

// Abort toast delivery after this long so a slow websocket service cannot leave requests hanging.
export const TOAST_DELIVERY_TIMEOUT_MS = 2_000;

// In-app notification payloads. Keep user-facing toast copy here.
export const RIDE_NOTIFICATIONS = {
  changesAccepted: (awaitingScheduling = false): ToastPayload => ({
    type: "success",
    message: awaitingScheduling
      ? "Changes accepted. Your ride is awaiting scheduling."
      : "Changes accepted.",
  }),

  driverRideUpdated: (details: string): ToastPayload => ({
    type: "warn",
    message: `Your ride has changed. ${details}`,
  }),

  driverRideReleased: (rideTime: string): ToastPayload => ({
    type: "warn",
    message: `The edited ride on ${rideTime} is no longer assigned to you.`,
  }),

  ActionRequiredByAdmin: (): ToastPayload => ({
    type: "warn",
    message: "Your ride changes are awaiting administrator approval.",
  }),

  ActionRequiredByStudent: (): ToastPayload => ({
    type: "warn",
    message:
      "An administrator edited your ride. Review the details and accept the changes.",
  }),

  Requested: (): ToastPayload => ({
    type: "info",
    message: "Your ride has been requested.",
  }),

  Scheduled: (): ToastPayload => ({
    type: "success",
    message: "Your ride has been scheduled.",
  }),

  EnRoute: (): ToastPayload => ({
    type: "info",
    message: "Your driver is on the way!",
  }),

  Arrived: (pickupName: string): ToastPayload => ({
    type: "info",
    message: `Your driver has arrived at ${pickupName}.`,
  }),

  Pickedup: (): ToastPayload => ({
    type: "success",
    message: "You've been picked up. Your ride is in progress.",
  }),

  Completed: (): ToastPayload => ({
    type: "success",
    message: "You've been dropped off. Thank you for riding with us!",
  }),

  Missing: (): ToastPayload => ({
    type: "warn",
    message:
      "Your driver marked you as a no-show. Please contact an administrator if you still need a ride.",
  }),

  CancelledByStudent: (): ToastPayload => ({
    type: "success",
    message: "Your ride has been cancelled.",
  }),

  CancelledByAdmin: (): ToastPayload => ({
    type: "success",
    message: "Your ride has been cancelled by an administrator.",
  }),

  seriesCancelled: (count: number, byAdmin: boolean): ToastPayload => ({
    type: "success",
    message: `Your recurring rides have been cancelled${byAdmin ? " by an administrator" : ""} (${count === 1 ? "1 ride" : `${count} rides`}).`,
  }),

  driverSeriesCancelled: (count: number): ToastPayload => ({
    type: "success",
    message: `${count === 1 ? "1 ride" : `${count} rides`} assigned to you ${count === 1 ? "has" : "have"} been cancelled.`,
  }),

  studentDelayed: (minutes: number): ToastPayload => ({
    type: "info",
    message: `Your ride has been delayed by ${minutes} minutes.`,
  }),

  driverDelayed: (minutes: number): ToastPayload => ({
    type: "info",
    message: `Your student reported a delay of ${minutes} minutes for their ride.`,
  }),

  studentDriverAssigned: (driverName: string): ToastPayload => ({
    type: "success",
    message: `Your driver ${driverName} has been assigned.`,
  }),

  studentDriverChanged: (
    rideTime: string,
    driverName: string,
  ): ToastPayload => ({
    type: "success",
    message: `Your driver for ${rideTime} is now ${driverName}.`,
  }),

  studentVehicleChanged: (rideTime: string): ToastPayload => ({
    type: "success",
    message: `The vehicle for your ${rideTime} ride has changed.`,
  }),

  driverVehicleChanged: (rideTime: string): ToastPayload => ({
    type: "info",
    message: `The vehicle for your ${rideTime} ride has changed.`,
  }),

  driverAssigned: (): ToastPayload => ({
    type: "info",
    message: "You have been assigned a new ride.",
  }),

  driverReassigned: (rideTime: string): ToastPayload => ({
    type: "warn",
    message: `Your ${rideTime} ride has been reassigned to another driver.`,
  }),

  driverMessage: (text: string): ToastPayload => ({
    type: "info",
    message: `Your driver: ${text}`,
  }),
} as const;
