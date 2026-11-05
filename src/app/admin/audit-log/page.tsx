"use client";

import type { AuditEntry, AuditResponse } from "@/types/audit";

import { useEffect, useRef, useState } from "react";
import AdminRidesTable, {
  type ColumnHeader,
  type TableRow,
} from "@/components/AdminRidesTable/AdminRidesTable";
import RideFilter from "@/components/admin/RideFilter";
import AuditHistoryModal from "@/components/admin/AuditHistoryModal";
import {
  actorName,
  entryTime,
  fieldLabel,
  summaryValue,
} from "@/components/admin/auditLog";
import styles from "./auditLog.module.css";

const COLUMNS: ColumnHeader[] = [
  { content: "Time", width: "18%" },
  { content: "Actor", width: "18%" },
  { content: "Action", width: "12%" },
  { content: "Entity", width: "22%" },
  { content: "Changes", width: "30%" },
];

export default function AuditLogPage() {
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const selectedRow = useRef<HTMLElement | null>(null);
  const [data, setData] = useState<AuditResponse | null>(null);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    entityTypes.forEach((type) => params.append("entityType", type));
    actions.forEach((action) => params.append("action", action));
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
  }, [actions, entityTypes, page]);

  const rows: TableRow[] = (data?.entries ?? []).map((entry) => ({
    key: entry.id,
    styleProps: {
      tabIndex: 0,
      className: styles.clickableRow,
      "aria-label": `View change history for ${entry.entityType} ${entry.entityId}`,
      "aria-haspopup": "dialog",
      onClick: (event) => {
        selectedRow.current = event.currentTarget;
        setSelectedEntry(entry);
      },
      onKeyDown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectedRow.current = event.currentTarget;
          setSelectedEntry(entry);
        }
      },
    },
    cells: [
      {
        wrap: true,
        content: entryTime(entry),
        value: new Date(entry.createdAt).getTime(),
      },
      {
        wrap: true,
        content: (
          <div>
            <div>{actorName(entry)}</div>
            {entry.actor && <div>{entry.actor.username}</div>}
          </div>
        ),
        value: actorName(entry),
      },
      { content: entry.action },
      {
        wrap: true,
        content: (
          <div>
            <div className="font-semibold">{entry.entityType}</div>
            <code className="text-small">{entry.entityId}</code>
          </div>
        ),
        value: entry.entityType,
      },
      {
        value: Object.keys(entry.changes).length,
        wrap: true,
        content: (
          <div className={styles.changes}>
            <ul className={styles.summaryList}>
              {Object.entries(entry.changes).map(([field, change]) => (
                <li key={field} className={styles.summaryItem}>
                  <span className={styles.summaryField}>
                    {fieldLabel(field)}:
                  </span>{" "}
                  <span>
                    {summaryValue(field, change.before, entry.entityType)}
                  </span>{" "}
                  <span className={styles.arrow} aria-label="changed to">
                    →
                  </span>{" "}
                  <span className={styles.summaryAfter}>
                    {summaryValue(field, change.after, entry.entityType)}
                  </span>
                </li>
              ))}
            </ul>
            {!Object.keys(entry.changes).length && (
              <p>No field changes recorded.</p>
            )}
          </div>
        ),
      },
    ],
  }));

  function changeFilters(
    setSelected: (values: string[]) => void,
    values: string[],
  ) {
    setLoading(true);
    setError(null);
    setSelected(values);
    setPage(1);
  }

  return (
    <div className="flex min-h-full min-w-0 flex-1 flex-col gap-6 px-[var(--layout-admin-pad-x)] py-[var(--layout-content-pad-y)] lg:pt-[6.4rem] lg:pl-[5.6rem] lg:pr-[2.6rem]">
      <h1 className="text-display">Audit Log</h1>
      {selectedEntry && (
        <AuditHistoryModal
          key={selectedEntry.id}
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            selectedRow.current?.focus();
          }}
        />
      )}

      <AdminRidesTable
        columnHeaders={COLUMNS}
        rows={loading || error ? [] : rows}
        searchPlaceholder="Search for an audit entry..."
        emptyMessage={
          error ||
          (loading
            ? "Loading…"
            : "No audit entries match your search or filters.")
        }
        filters={
          <>
            <RideFilter
              label="Entity"
              options={(data?.entityTypes ?? []).map((type) => ({
                value: type,
                label: type,
              }))}
              selected={entityTypes}
              onChange={(values) => changeFilters(setEntityTypes, values)}
            />
            <RideFilter
              label="Action"
              options={["Create", "Update", "Delete"].map((action) => ({
                value: action,
                label: action,
              }))}
              selected={actions}
              onChange={(values) => changeFilters(setActions, values)}
            />
          </>
        }
      />
      {error && (
        <p className="text-paragraph-1 text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-paragraph-2">
        <span>{data?.total ?? 0} total entries</span>
        <div className="flex items-center gap-3">
          <button
            className="rounded border border-[var(--color-grey-stroke-weak)] px-3 py-2 disabled:opacity-50"
            disabled={loading || page <= 1}
            onClick={() => {
              setLoading(true);
              setError(null);
              setPage((current) => current - 1);
            }}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.max(1, data?.pageCount ?? 1)}
          </span>
          <button
            className="rounded border border-[var(--color-grey-stroke-weak)] px-3 py-2 disabled:opacity-50"
            disabled={loading || !data || page >= data.pageCount}
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
  );
}
