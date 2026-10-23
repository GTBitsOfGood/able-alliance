import type { Prisma } from "@db/generated/client";

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

export const routeInclude = {
  student: { include: userInclude },
  driver: { include: userInclude },
  vehicle: true,
  pickup: true,
  dropoff: true,
} as const satisfies Prisma.RouteInclude;

// Limit participant details in route responses for students and drivers.
export const routeResponseInclude = {
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

type FullRoute = Prisma.RouteGetPayload<{ include: typeof routeInclude }>;
type RouteResponse = Prisma.RouteGetPayload<{
  include: typeof routeResponseInclude;
}>;

// Student and driver responses omit private participant fields; admins can retain the full route.
export function limitRouteInfo(
  route: FullRoute,
  isAdmin = false,
): FullRoute | RouteResponse {
  if (isAdmin) return route;

  const participant = (user: NonNullable<FullRoute["driver"]>) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    preferredName: user.preferredName,
    type: user.type,
  });

  return {
    ...route,
    student: participant(route.student),
    driver: route.driver ? participant(route.driver) : null,
  };
}
