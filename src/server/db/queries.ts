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
