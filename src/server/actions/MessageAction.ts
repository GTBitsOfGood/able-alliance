import { db } from "@db";
import { RouteStatus, UserType } from "@db/generated/enums";
import { Prisma } from "@db/generated/client";
import type { ChatAuthor, ChatMessageResponse } from "@/types/api";

type ChatMessage = Omit<ChatMessageResponse, "time"> & {
  time: Date;
};

const chatUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  preferredName: true,
  types: true,
} as const satisfies Prisma.UserSelect;

type ChatUser = Prisma.UserGetPayload<{ select: typeof chatUserSelect }>;

function chatAuthor(
  user: ChatUser | null,
  route: { studentId: string; driverId: string | null } | null,
  senderType?: UserType,
): ChatAuthor | null {
  if (!user) return null;
  return {
    name: `${user.preferredName || user.firstName} ${user.lastName}`.trim(),
    role: senderType
      ? senderType === UserType.SuperAdmin
        ? UserType.Admin
        : senderType
      : user.id === route?.studentId
        ? UserType.Student
        : user.id === route?.driverId
          ? UserType.Driver
          : user.types.includes(UserType.Admin) ||
              user.types.includes(UserType.SuperAdmin)
            ? UserType.Admin
            : user.types.includes(UserType.Driver)
              ? UserType.Driver
              : UserType.Student,
  };
}

const statusMessages = {
  Requested: "Ride requested.",
  Scheduled: "Ride scheduled.",
  EnRoute: "Driver is on the way to pickup.",
  Arrived: "Driver has arrived at pickup.",
  Pickedup: "Student picked up. Ride is in progress.",
  Completed: "Student dropped off. Ride completed.",
  Missing: "Student marked as a no-show.",
  CancelledByStudent: "Ride cancelled by the student.",
  CancelledByAdmin: "Ride cancelled by an admin.",
  ActionRequiredByAdmin: "Ride changes are awaiting admin review.",
  ActionRequiredByStudent: "Ride changes are awaiting student review.",
} satisfies Record<RouteStatus, string>;

/** Project committed status changes into chat without exposing other audit data. */
function statusMessageFromAudit(entry: {
  id: string;
  entityId: string;
  createdAt: Date;
  changes: Prisma.JsonValue;
}): ChatMessage | null {
  const changes = entry.changes;
  if (!changes || typeof changes !== "object" || Array.isArray(changes))
    return null;
  const status = changes.status;
  if (!status || typeof status !== "object" || Array.isArray(status))
    return null;
  const next = status.after;
  if (
    typeof next !== "string" ||
    !Object.values(RouteStatus).some((value) => value === next) ||
    status.before === next
  )
    return null;
  return {
    id: `system:${entry.id}`,
    routeId: entry.entityId,
    senderId: null,
    senderType: null,
    text: statusMessages[next as RouteStatus],
    time: entry.createdAt,
  };
}

/** Build the ride timeline for the web app from messages and committed status changes. */
export async function getMessagesForRoute(
  routeId: string,
): Promise<ChatMessage[]> {
  routeId = routeId.toLowerCase();
  const [messages, entries, route] = await Promise.all([
    db.message.findMany({
      where: { routeId },
      include: { sender: { select: chatUserSelect } },
    }),
    db.auditEntry.findMany({
      where: {
        entityType: "Route",
        entityId: routeId,
        action: { in: ["Create", "Update"] },
        changes: { path: ["status"], not: Prisma.AnyNull },
      },
      select: {
        id: true,
        entityId: true,
        createdAt: true,
        changes: true,
      },
    }),
    db.route.findUnique({
      where: { id: routeId },
      select: { studentId: true, driverId: true },
    }),
  ]);
  return [
    ...messages.map(({ sender, ...message }) => ({
      ...message,
      author: chatAuthor(sender, route, message.senderType),
    })),
    ...entries.flatMap((entry) => {
      const message = statusMessageFromAudit(entry);
      return message ? [message] : [];
    }),
  ].sort(
    (a, b) => a.time.getTime() - b.time.getTime() || a.id.localeCompare(b.id),
  );
}

export const getRouteMessage = (routeId: string, messageId: string) =>
  db.message.findFirst({
    where: {
      id: messageId.toLowerCase(),
      routeId: routeId.toLowerCase(),
    },
  });

/** List previews without loading every ride's complete transcript. */
export async function getAdminChatSummaries() {
  const participantSelect = {
    id: true,
    firstName: true,
    lastName: true,
    preferredName: true,
  } as const;
  const [routes, activity] = await Promise.all([
    db.route.findMany({
      select: {
        id: true,
        status: true,
        scheduledPickupTime: true,
        estimatedDropoffTime: true,
        delayMinutes: true,
        student: { select: participantSelect },
        driver: { select: participantSelect },
        pickup: { select: { name: true } },
        dropoff: { select: { name: true } },
        messages: {
          orderBy: [{ time: "desc" }, { id: "desc" }],
          take: 1,
          select: { text: true, time: true },
        },
      },
    }),
    db.auditEntry.groupBy({
      by: ["entityId"],
      where: {
        entityType: "Route",
        action: { in: ["Create", "Update"] },
        changes: { path: ["status"], not: Prisma.AnyNull },
      },
      _max: { createdAt: true },
    }),
  ]);
  const statusTimes = new Map(
    activity.map((entry) => [entry.entityId, entry._max.createdAt]),
  );
  return routes
    .map(({ messages, ...route }) => {
      const message = messages[0];
      const statusTime = statusTimes.get(route.id);
      const messageIsLatest =
        message && (!statusTime || message.time >= statusTime);
      return {
        ...route,
        lastActivity: messageIsLatest
          ? message.time
          : (statusTime ?? route.scheduledPickupTime),
        preview: messageIsLatest ? message.text : statusMessages[route.status],
      };
    })
    .sort(
      (a, b) =>
        b.lastActivity.getTime() - a.lastActivity.getTime() ||
        a.id.localeCompare(b.id),
    );
}
