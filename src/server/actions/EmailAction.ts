import { db } from "@db";
import { adminRouteInclude } from "@/server/queries";

/** Route and user records used by ride email rendering. */
export const getEmailRoute = (routeId: string) =>
  db.route.findUnique({
    where: { id: routeId.toLowerCase() },
    include: adminRouteInclude,
  });
