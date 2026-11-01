import type { Prisma } from "./generated/client";

export type AuditActionName = "Create" | "Update" | "Delete";
export type AuditSnapshot = Record<string, unknown>;

type AuditClient = Pick<Prisma.TransactionClient, "auditEntry">;

function normalize(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, normalize(child)]),
    );
  }
  return value;
}

function flatten(
  value: AuditSnapshot | null,
  prefix = "",
  result: Record<string, unknown> = {},
): Record<string, unknown> {
  if (!value) return result;
  for (const [key, child] of Object.entries(value)) {
    if (key === "id") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (
      child &&
      typeof child === "object" &&
      !(child instanceof Date) &&
      !Array.isArray(child)
    ) {
      flatten(child as AuditSnapshot, path, result);
    } else {
      result[path] = normalize(child);
    }
  }
  return result;
}

export function buildAuditChanges(
  before: AuditSnapshot | null,
  after: AuditSnapshot | null,
): Prisma.InputJsonObject {
  const previous = flatten(before);
  const next = flatten(after);
  const changes: Record<string, Prisma.InputJsonValue> = {};

  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    const oldValue = key in previous ? previous[key] : null;
    const newValue = key in next ? next[key] : null;
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
    changes[key] = {
      before: oldValue as Prisma.InputJsonValue,
      after: newValue as Prisma.InputJsonValue,
    };
  }

  return changes;
}

export async function recordAudit(
  client: AuditClient,
  input: {
    actorId?: string | null;
    entityType: string;
    entityId: string;
    action: AuditActionName;
    before?: AuditSnapshot | null;
    after?: AuditSnapshot | null;
  },
) {
  const changes = buildAuditChanges(input.before ?? null, input.after ?? null);
  return client.auditEntry.create({
    data: {
      actorId: input.actorId?.toLowerCase() ?? null,
      entityType: input.entityType,
      entityId: input.entityId.toLowerCase(),
      subjectUserId:
        input.entityType === "User" ? input.entityId.toLowerCase() : null,
      action: input.action,
      changes,
    },
  });
}
