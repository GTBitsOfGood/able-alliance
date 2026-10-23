import type { Message, User, Shift, Prisma } from "@db/generated/browser";
import type { userInclude, routeInclude } from "@/server/db/queries";

/** Dates become ISO strings when database results are sent as JSON. */
export type Serialized<T> = T extends Date
  ? string
  : T extends object
    ? { [K in keyof T]: Serialized<T[K]> }
    : T;

export type RouteResponse = Serialized<
  Prisma.RouteGetPayload<{ include: typeof routeInclude }>
>;
export type UserResponse = Prisma.UserGetPayload<{
  include: typeof userInclude;
}>;
export type ChatMessageResponse = Serialized<Message>;

export type ShiftDetailResponse = Pick<Shift, "startTime" | "endTime"> & {
  driver: UserResponse;
  date: string;
  dayName: string;
  startTimeLabel: string;
  endTimeLabel: string;
  shiftStartIso: string;
  shiftEndIso: string;
  scheduledRoutes: RouteResponse[];
  requestedRoutes: RouteResponse[];
};

export type ShiftInstanceResponse = Pick<Shift, "startTime" | "endTime"> & {
  driverId: User["id"];
  driverName: string;
  date: string;
  dateLabel: string;
  dayName: string;
  startTime24: Shift["startTime"];
  endTime24: Shift["endTime"];
};
