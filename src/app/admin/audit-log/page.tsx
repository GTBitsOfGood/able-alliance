"use client";

import { useEffect, useState } from "react";

type Change = { before: unknown; after: unknown };
type AuditEntry = {
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

type AuditResponse = {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  entityTypes: string[];
};

function displayValue(value: unknown) {
  if (value === null) return "null";
  if (typeof value === "string") return value || '""';
  return JSON.stringify(value);
}

function actorName(entry: AuditEntry) {
  if (!entry.actor) return "System";
  return (
    entry.actor.preferredName ||
    `${entry.actor.firstName} ${entry.actor.lastName}`
  );
}

export default function AuditLogPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (entityType) params.set("entityType", entityType);
    if (action) params.set("action", action);
    fetch(`/api/audit-entries?${params}`)
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load the audit log.");
        return response.json() as Promise<AuditResponse>;
      })
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load the audit log.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [action, entityType, page]);

  return (
    <div className="flex min-h-full flex-1 flex-col gap-6 px-[var(--layout-admin-pad-x)] py-[var(--layout-content-pad-y)]">
      <div className="flex flex-col gap-2">
        <h1 className="text-display">Audit Log</h1>
        <p className="text-paragraph-1 text-[var(--color-grey-text-weak)]">
          Permanent history of database changes made by users and background
          processes.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-2 text-paragraph-2">
          Entity
          <select
            className="min-w-72 rounded border border-[var(--color-grey-stroke-weak)] bg-white px-3 py-2"
            value={entityType}
            onChange={(event) => {
              setLoading(true);
              setError(null);
              setEntityType(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All entities</option>
            {(data?.entityTypes ?? []).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-paragraph-2">
          Action
          <select
            className="min-w-64 rounded border border-[var(--color-grey-stroke-weak)] bg-white px-3 py-2"
            value={action}
            onChange={(event) => {
              setLoading(true);
              setError(null);
              setAction(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All actions</option>
            <option value="Create">Create</option>
            <option value="Update">Update</option>
            <option value="Delete">Delete</option>
          </select>
        </label>
      </div>

      {error ? (
        <p className="text-paragraph-1 text-red-700" role="alert">
          {error}
        </p>
      ) : loading ? (
        <p className="text-paragraph-1">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-lg border border-[var(--color-grey-stroke-weak)] bg-white">
            <table className="w-full border-collapse text-left text-paragraph-2">
              <thead className="bg-[var(--color-solid-bg-sunken)]">
                <tr>
                  {["Time", "Actor", "Action", "Entity", "Changes"].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="border-b border-[var(--color-grey-stroke-weak)] px-4 py-3 font-semibold"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data?.entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-[var(--color-grey-stroke-weak)] align-top last:border-b-0"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(entry.createdAt))}
                    </td>
                    <td className="px-4 py-3">
                      <div>{actorName(entry)}</div>
                      {entry.actor && (
                        <div className="text-[var(--color-grey-text-weak)]">
                          {entry.actor.username}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{entry.action}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{entry.entityType}</div>
                      <code className="text-small text-[var(--color-grey-text-weak)]">
                        {entry.entityId}
                      </code>
                    </td>
                    <td className="min-w-lg px-4 py-3">
                      <details>
                        <summary className="cursor-pointer">
                          {Object.keys(entry.changes).length} field
                          {Object.keys(entry.changes).length === 1 ? "" : "s"}
                        </summary>
                        <div className="flex flex-col gap-2 pt-2">
                          {Object.entries(entry.changes).map(
                            ([field, change]) => (
                              <div
                                key={field}
                                className="flex flex-col gap-1 rounded bg-[var(--color-solid-bg-sunken)] p-2"
                              >
                                <div className="font-semibold">{field}</div>
                                <div className="break-all">
                                  <span className="text-[var(--color-grey-text-weak)]">
                                    Before:{" "}
                                  </span>
                                  {displayValue(change.before)}
                                </div>
                                <div className="break-all">
                                  <span className="text-[var(--color-grey-text-weak)]">
                                    After:{" "}
                                  </span>
                                  {displayValue(change.after)}
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
                {!data?.entries.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-[var(--color-grey-text-weak)]"
                    >
                      No audit entries match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-paragraph-2">
            <span>{data?.total ?? 0} total entries</span>
            <div className="flex items-center gap-3">
              <button
                className="rounded border border-[var(--color-grey-stroke-weak)] px-3 py-2 disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  setPage((current) => current - 1);
                }}
              >
                Previous
              </button>
              <span>
                Page {data?.page ?? page} of {Math.max(1, data?.pageCount ?? 1)}
              </span>
              <button
                className="rounded border border-[var(--color-grey-stroke-weak)] px-3 py-2 disabled:opacity-50"
                disabled={!data || page >= data.pageCount}
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  setPage((current) => current + 1);
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
