"use client";

import type { AuditEntry, AuditResponse } from "@/types/audit";

import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import BogModal from "@/components/BogModal/BogModal";
import BogButton from "@/components/BogButton/BogButton";
import { actorName, entryTime, fieldLabel, summaryValue } from "./auditLog";
import styles from "./auditHistoryModal.module.css";

type AuditHistoryModalProps = {
  entry: AuditEntry;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
};

export default function AuditHistoryModal({
  entry,
  onClose,
  onCloseAutoFocus,
}: AuditHistoryModalProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      entityType: entry.entityType,
      entityId: entry.entityId,
      page: String(page),
      pageSize: "50",
    });
    fetch(`/api/audit-entries?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load history");
        return response.json() as Promise<AuditResponse>;
      })
      .then((response) => {
        if (controller.signal.aborted) return;
        setEntries((previous) =>
          page === 1 ? response.entries : [...previous, ...response.entries],
        );
        setTotal(response.total);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [entry.entityId, entry.entityType, page, attempt]);

  return (
    <BogModal
      size="large"
      openState={{ open: true, setOpen: onClose }}
      trigger={<button hidden tabIndex={-1} />}
      title={<h3>Change history</h3>}
      contentProps={{
        style: { width: "72rem", maxHeight: "88dvh", overflowY: "auto" },
        onCloseAutoFocus,
      }}
    >
      <div className={styles.history} aria-busy={loading}>
        <Dialog.Description className={styles.entity}>
          {entry.entityType} · {entry.entityId}
        </Dialog.Description>
        {entries.map((item) => (
          <section key={item.id}>
            <div className={styles.meta}>
              <strong>
                {item.action} · {actorName(item)}
              </strong>
              <time dateTime={item.createdAt}>{entryTime(item)}</time>
            </div>
            {Object.keys(item.changes).length ? (
              <table className={styles.changes}>
                <caption className="sr-only">
                  {item.action} by {actorName(item)} at {entryTime(item)}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    <th scope="col">Before</th>
                    <th scope="col">After</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(item.changes).map(([field, change]) => (
                    <tr key={field}>
                      <th scope="row">{fieldLabel(field)}</th>
                      <td>
                        {summaryValue(field, change.before, item.entityType)}
                      </td>
                      <td>
                        {summaryValue(field, change.after, item.entityType)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No field changes recorded.</p>
            )}
          </section>
        ))}
        {loading && <p role="status">Loading…</p>}
        {error && (
          <div role="alert">
            <p>Unable to load history.</p>
            <BogButton
              size="small"
              variant="secondary"
              onClick={() => {
                setLoading(true);
                setError(false);
                setAttempt((value) => value + 1);
              }}
            >
              Try again
            </BogButton>
          </div>
        )}
        {!loading && !error && entries.length === 0 && (
          <p>No changes recorded.</p>
        )}
        {!loading && !error && entries.length < total && (
          <BogButton
            size="small"
            variant="secondary"
            onClick={() => {
              setLoading(true);
              setPage((value) => value + 1);
            }}
          >
            Load older changes
          </BogButton>
        )}
      </div>
    </BogModal>
  );
}
