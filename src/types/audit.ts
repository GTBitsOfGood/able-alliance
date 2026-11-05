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
