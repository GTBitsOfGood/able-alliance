import type { Message, User, Shift, Prisma } from "@db/generated/browser";
import type {
  userInclude,
  studentRouteInclude,
  driverRouteInclude,
  adminRouteInclude,
} from "@/server/db/queries";

/** Dates become ISO strings when database results are sent as JSON. */
export type Serialized<T> = T extends Date
  ? string
  : T extends object
    ? { [K in keyof T]: Serialized<T[K]> }
    : T;

type StudentRoutePayload = Prisma.RouteGetPayload<{
  include: typeof studentRouteInclude;
}>;
type DriverRoutePayload = Prisma.RouteGetPayload<{
  include: typeof driverRouteInclude;
}>;
type AdminRoutePayload = Prisma.RouteGetPayload<{
  include: typeof adminRouteInclude;
}>;

type StudentRouteRecord = Serialized<StudentRoutePayload> & {
  student: Serialized<StudentRoutePayload["student"]> & {
    studentInfo?: Serialized<DriverRoutePayload["student"]["studentInfo"]>;
  };
};
export type StudentRouteResponse = StudentRouteRecord;
export type DriverRouteResponse = StudentRouteRecord;
export type DriverRouteDetailResponse = Serialized<DriverRoutePayload>;
export type AdminRouteResponse = Serialized<AdminRoutePayload>;
export type RouteDetailResponse =
  StudentRouteResponse | DriverRouteDetailResponse | AdminRouteResponse;
export type RouteResponse =
  | StudentRouteResponse
  | DriverRouteResponse
  | DriverRouteDetailResponse
  | AdminRouteResponse;
export type ScheduleRouteResponse = {
  route: AdminRouteResponse;
  driver: UserResponse;
};
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
  scheduledRoutes: AdminRouteResponse[];
  requestedRoutes: AdminRouteResponse[];
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
