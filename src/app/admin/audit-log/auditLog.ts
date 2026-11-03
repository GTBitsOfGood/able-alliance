import { adminStatusLabel } from "../RideStatusChip";

type Change = { before: unknown; after: unknown };
export type AuditEntry = {
  id: string;
  createdAt: string;
  entityType: string;
  entityId: string;
  action: "Create" | "Update" | "Delete";
  changes: Record<string, Change>;
  actor: {
    id: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
    username: string;
  } | null;
};

export type AuditResponse = {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  entityTypes: string[];
};

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
