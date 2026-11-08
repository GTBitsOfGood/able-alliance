import type { ChatMessageResponse } from "@/types/api";
import { UserType } from "@db/generated/enums";

export function isOwnChatMessage(
  message: ChatMessageResponse,
  userId: string,
  activeType: UserType,
) {
  return message.senderId === userId && message.senderType === activeType;
}

/** Resolve the sender's role in this ride, independently of the viewer's role. */
export function getChatSenderType(
  message: ChatMessageResponse,
  studentId: string,
  driverId: string | null,
) {
  if (message.senderId === null) return null;
  if (message.senderType)
    return message.senderType === UserType.SuperAdmin
      ? UserType.Admin
      : message.senderType;
  if (message.author) return message.author.role;
  if (message.senderId === studentId) return UserType.Student;
  if (message.senderId === driverId) return UserType.Driver;
  return UserType.Admin;
}

/** HTTP refreshes and socket delivery can overlap; keep each entry once. */
export function mergeChatMessages(
  current: ChatMessageResponse[],
  incoming: ChatMessageResponse[],
): ChatMessageResponse[] {
  const messages = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    // Socket messages have no author details. Keep names loaded through HTTP.
    messages.set(message.id, { ...messages.get(message.id), ...message });
  }
  return [...messages.values()].sort(
    (a, b) =>
      new Date(a.time).getTime() - new Date(b.time).getTime() ||
      a.id.localeCompare(b.id),
  );
}
