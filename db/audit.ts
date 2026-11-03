import { db } from "@db";
import { AuditAction, type Prisma } from "./generated/client";

export type AuditActionName = "Create" | "Update" | "Delete";
export type AuditSnapshot = Record<string, unknown>;

type AuditClient = Pick<Prisma.TransactionClient, "auditEntry">;

export const AUDIT_ENTITY_TYPES = [
  "User",
  "Vehicle",
  "Location",
  "Accommodation",
  "Route",
  "RideSeries",
  "Message",
] as const;

type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export function isAuditEntityType(value: string): value is AuditEntityType {
  return (AUDIT_ENTITY_TYPES as readonly string[]).includes(value);
}

export function isAuditAction(value: string): value is AuditAction {
  return Object.values(AuditAction).includes(value as AuditAction);
}

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

export async function getAuditEntries(input: {
  page: number;
  pageSize: number;
  entityType?: AuditEntityType | AuditEntityType[];
  entityId?: string;
  action?: AuditAction | AuditAction[];
}) {
  const where: Prisma.AuditEntryWhereInput = {
    ...(input.entityId ? { entityId: input.entityId.toLowerCase() } : {}),
    ...(input.entityType
      ? {
          entityType: Array.isArray(input.entityType)
            ? { in: input.entityType }
            : input.entityType,
        }
      : {}),
    ...(input.action
      ? {
          action: Array.isArray(input.action)
            ? { in: input.action }
            : input.action,
        }
      : {}),
  };

  const [entries, total] = await db.$transaction([
    db.auditEntry.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            username: true,
          },
        },
      },
    }),
    db.auditEntry.count({ where }),
  ]);

  return {
    entries,
    total,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.ceil(total / input.pageSize),
    entityTypes: AUDIT_ENTITY_TYPES,
  };
}
