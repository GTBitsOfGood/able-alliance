import { adminStatusLabel } from "./RideStatusChip";

import type { AuditEntry } from "@/types/audit";

export function fieldLabel(field: string) {
  const label = field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._]/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function summaryValue(
  field: string,
  value: unknown,
  entityType: string,
): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    if (!value) return '""';
    if (entityType === "Route" && field === "status")
      return adminStatusLabel(value);
    return value;
  }
  return JSON.stringify(value);
}

export function actorName(entry: AuditEntry) {
  if (!entry.actor) return "System";
  return (
    entry.actor.preferredName ||
    `${entry.actor.firstName} ${entry.actor.lastName}`
  );
}

export function entryTime(entry: AuditEntry) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(entry.createdAt));
}
