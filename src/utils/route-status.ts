import { RouteStatus } from "@db/generated/enums";

// Prisma enum identifiers cannot contain spaces or hyphens. Keep API labels stable.
export const routeStatusLabels = {
  Requested: "Requested",
  Scheduled: "Scheduled",
  EnRoute: "En-route",
  Pickedup: "Pickedup",
  Completed: "Completed",
  Missing: "Missing",
  CancelledByStudent: "Cancelled by Student",
  CancelledByAdmin: "Cancelled by Admin",
} as const satisfies Record<RouteStatus, string>;
