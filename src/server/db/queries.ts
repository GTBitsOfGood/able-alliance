import type { Prisma } from "@db/generated/client";
import type { UserType } from "@db/generated/browser";
import { isAdmin } from "@/utils/authUser";

export const userInclude = {
  settings: true,
  studentInfo: {
    include: {
      accessibilityNeeds: {
        orderBy: { label: "asc" },
      },
    },
  },
  shifts: {
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }, { endTime: "asc" }],
  },
} as const satisfies Prisma.UserInclude;

export const adminRouteInclude = {
  student: { include: userInclude },
  driver: { include: userInclude },
  vehicle: true,
  pickup: true,
  dropoff: true,
} as const satisfies Prisma.RouteInclude;

// Limit participant details in route responses for students and drivers.
export const studentRouteInclude = {
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      type: true,
    },
  },
  driver: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      type: true,
    },
  },
  vehicle: true,
  pickup: true,
  dropoff: true,
} as const satisfies Prisma.RouteInclude;

export const driverRouteInclude = {
  ...studentRouteInclude,
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      type: true,
      studentInfo: {
        select: {
          notes: true,
          accessibilityNeeds: { select: { label: true } },
        },
      },
    },
  },
} as const satisfies Prisma.RouteInclude;

type FullRoute = Prisma.RouteGetPayload<{ include: typeof adminRouteInclude }>;

// Student responses are minimal; driver detail responses also include rider instructions.
export function routeResponseForRole(route: FullRoute, role: UserType) {
  if (isAdmin(role)) return route;

  const participant = (user: NonNullable<FullRoute["driver"]>) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    preferredName: user.preferredName,
    type: user.type,
  });

  const response = {
    ...route,
    student: participant(route.student),
    driver: route.driver ? participant(route.driver) : null,
  };

  if (role !== "Driver") return response;

  return {
    ...response,
    student: {
      ...response.student,
      studentInfo: route.student.studentInfo
        ? {
            notes: route.student.studentInfo.notes,
            accessibilityNeeds:
              route.student.studentInfo.accessibilityNeeds.map(({ label }) => ({
                label,
              })),
          }
        : null,
    },
  };
}
