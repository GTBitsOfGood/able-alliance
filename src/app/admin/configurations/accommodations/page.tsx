"use client";

import React, { useEffect, useState } from "react";

import type { Accommodation } from "@db/generated/browser";

async function errorMessage(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string" &&
    body.error
  ) {
    return body.error;
  }
  return fallback;
}

async function fetchAccommodations(): Promise<Accommodation[] | null> {
  try {
    const res = await fetch("/api/accommodations");
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/** Returns remaining additions to be saved, in request order */
function remainingAdditions(
  pendingNew: string[],
  newLabel: string,
  confirmedCreations: number,
) {
  const staged = [
    ...pendingNew.map((label) => ({ label, fromInput: false })),
    ...(newLabel.trim() ? [{ label: newLabel, fromInput: true }] : []),
  ].slice(confirmedCreations);
  return {
    pendingNew: staged
      .filter((entry) => !entry.fromInput)
      .map((entry) => entry.label),
    newLabel:
      staged.some((entry) => entry.fromInput) || !newLabel.trim()
        ? newLabel
        : "",
  };
}

function reconcilePartialSave(
  server: Accommodation[],
  draft: Accommodation[],
  pendingNew: string[],
  newLabel: string,
  confirmedCreations: number,
) {
  const savedById = new Map(server.map((item) => [item.id, item]));
  const kept = new Set<string>();
  const nextDraft: Accommodation[] = [];
  for (const item of draft) {
    const saved = savedById.get(item.id);
    if (!saved) continue;
    kept.add(saved.id);
    nextDraft.push({ ...saved, label: item.label.trim() });
  }

  for (const item of server) {
    if (!kept.has(item.id)) nextDraft.push(item);
  }
  return {
    items: server,
    draft: nextDraft,
    ...remainingAdditions(pendingNew, newLabel, confirmedCreations),
  };
}

export default function AccommodationsPage() {
  const [items, setItems] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Accommodation[]>([]);
  const [pendingNew, setPendingNew] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAccommodations().then((data) => {
      if (data) setItems(data);
      setLoading(false);
    });
  }, []);

  function startEdit() {
    setDraft(items.map((i) => ({ ...i })));
    setPendingNew([]);
    setNewLabel("");
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  function addPending() {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    setPendingNew((prev) => [...prev, trimmed]);
    setNewLabel("");
  }

  function updateDraftLabel(id: string, value: string) {
    setDraft((prev) =>
      prev.map((d) => (d.id === id ? { ...d, label: value } : d)),
    );
  }

  async function saveChanges() {
    const blankDraft = draft.find((d) => !d.label.trim());
    if (blankDraft) {
      setError("Accommodation labels cannot be empty");
      return;
    }

    setSaving(true);
    setError(null);
    const removedIds = new Set(
      items
        .filter((item) => !draft.some((entry) => entry.id === item.id))
        .map((item) => item.id),
    );
    const originalLabels = new Map(items.map((item) => [item.id, item.label]));
    const toRename = draft.filter((item) => {
      const label = item.label.trim();
      return label && label !== originalLabels.get(item.id);
    });
    const additions = [
      ...pendingNew.map((label) => label.trim()),
      ...(newLabel.trim() ? [newLabel.trim()] : []),
    ];
    const deletedIds = new Set<string>();
    const renamed = new Map<string, string>();
    const created: Accommodation[] = [];
    let confirmedCreations = 0;
    const failures: string[] = [];

    try {
      const deleteResults = await Promise.all(
        items
          .filter((item) => removedIds.has(item.id))
          .map(async (item): Promise<{ id: string } | { message: string }> => {
            try {
              const res = await fetch(`/api/accommodations/${item.id}`, {
                method: "DELETE",
              });
              if (res.ok || res.status === 404) return { id: item.id };
              return {
                message: await errorMessage(
                  res,
                  `Failed to delete "${item.label}"`,
                ),
              };
            } catch {
              return { message: `Failed to delete "${item.label}"` };
            }
          }),
      );
      for (const result of deleteResults) {
        if ("id" in result) deletedIds.add(result.id);
        else failures.push(result.message);
      }

      if (failures.length === 0) {
        for (const item of toRename) {
          const label = item.label.trim();
          const res = await fetch(`/api/accommodations/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label }),
          });
          if (!res.ok) {
            failures.push(
              await errorMessage(res, `Failed to rename "${item.label}"`),
            );
            break;
          }
          renamed.set(item.id, label);
        }
      }

      if (failures.length === 0) {
        for (const label of additions) {
          const res = await fetch("/api/accommodations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label }),
          });
          if (!res.ok) {
            failures.push(
              await errorMessage(res, `Failed to create "${label}"`),
            );
            break;
          }
          confirmedCreations += 1;
          const body = await res.json().catch(() => null);
          if (
            body &&
            typeof body === "object" &&
            "id" in body &&
            typeof body.id === "string" &&
            "label" in body &&
            typeof body.label === "string"
          ) {
            created.push({ id: body.id, label: body.label });
          }
        }
      }
    } catch (e) {
      failures.push(e instanceof Error ? e.message : "Failed to save");
    }

    const known = [
      ...items
        .filter((item) => !deletedIds.has(item.id))
        .map((item) => {
          const label = renamed.get(item.id);
          return label ? { ...item, label } : item;
        }),
      ...created,
    ];
    if (failures.length === 0) {
      const saved = reconcilePartialSave(
        known,
        draft,
        pendingNew,
        newLabel,
        confirmedCreations,
      );
      setItems(saved.draft);
      setDraft([]);
      setPendingNew([]);
      setNewLabel("");
      setEditing(false);
      setSaving(false);
      return;
    }

    const server = await fetchAccommodations();
    const next = reconcilePartialSave(
      server ?? known,
      draft,
      pendingNew,
      newLabel,
      confirmedCreations,
    );
    setItems(next.items);
    setDraft(next.draft);
    setPendingNew(next.pendingNew);
    setNewLabel(next.newLabel);
    setError(failures.join(" "));
    setSaving(false);
  }

  function removeFromDraft(id: string) {
    setDraft((prev) => prev.filter((d) => d.id !== id));
  }

  function removeFromPending(idx: number) {
    setPendingNew((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="py-[var(--layout-content-pad-y)] px-[var(--layout-admin-pad-x)] relative flex flex-col flex-1 min-w-0 w-full">
      <h1 className="text-display mb-[2.4rem]">Configurations</h1>
      {loading ? (
        <p style={{ color: "var(--color-grey-text-weak)", fontSize: "1.5rem" }}>
          Loading…
        </p>
      ) : (
        <div>
          <h2 style={subheadingStyle}>Accommodations</h2>

          {editing ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.2rem",
              }}
            >
              {/* Existing items — editable */}
              {draft.map((item) => (
                <div key={item.id} style={rowStyle}>
                  <input
                    style={newInputStyle}
                    value={item.label}
                    onChange={(e) => updateDraftLabel(item.id, e.target.value)}
                  />
                  <button
                    onClick={() => removeFromDraft(item.id)}
                    style={xBtnStyle}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* Pending new items */}
              {pendingNew.map((label, idx) => (
                <div key={idx} style={rowStyle}>
                  <div style={itemBoxStyle}>{label}</div>
                  <button
                    onClick={() => removeFromPending(idx)}
                    style={xBtnStyle}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* New input row */}
              <div style={rowStyle}>
                <input
                  style={newInputStyle}
                  placeholder="Add new..."
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addPending();
                  }}
                />
                <button
                  onClick={addPending}
                  style={plusBtnStyle}
                  title="Add"
                  disabled={!newLabel.trim()}
                >
                  +
                </button>
              </div>

              {error && (
                <p
                  style={{
                    color: "var(--color-status-red-text)",
                    fontSize: "1.4rem",
                  }}
                >
                  {error}
                </p>
              )}

              <div
                style={{ display: "flex", gap: "0.8rem", marginTop: "0.4rem" }}
              >
                <button
                  onClick={cancelEdit}
                  style={cancelBtnStyle}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={saveChanges}
                  style={saveBtnStyle}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.2rem",
              }}
            >
              {items.length === 0 && (
                <p
                  style={{
                    color: "var(--color-grey-text-weak)",
                    fontSize: "1.5rem",
                  }}
                >
                  No accommodations configured.
                </p>
              )}
              {items.map((item) => (
                <div key={item.id} style={itemBoxStyle}>
                  {item.label}
                </div>
              ))}
              <div style={{ marginTop: "0.4rem" }}>
                <button onClick={startEdit} style={editListBtnStyle}>
                  Edit list
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const subheadingStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "2.4rem",
  fontWeight: 700,
  color: "var(--color-grey-text-strong)",
  marginBottom: "2rem",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1rem",
};

const itemBoxStyle: React.CSSProperties = {
  width: "34rem",
  padding: "0.9rem 1.2rem",
  border: "1px solid var(--color-grey-stroke-weak)",
  borderRadius: "0.4rem",
  fontSize: "1.5rem",
  fontFamily: "var(--font-paragraph)",
  color: "var(--color-grey-text-strong)",
  background: "#fff",
};

const newInputStyle: React.CSSProperties = {
  width: "34rem",
  padding: "0.9rem 1.2rem",
  border: "1px solid var(--color-grey-stroke-weak)",
  borderRadius: "0.4rem",
  fontSize: "1.5rem",
  fontFamily: "var(--font-paragraph)",
  color: "var(--color-grey-text-strong)",
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

const xBtnStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  cursor: "pointer",
  fontSize: "1.8rem",
  lineHeight: 1,
  color: "var(--color-grey-text-strong)",
  padding: "0 0.2rem",
  flexShrink: 0,
};

const plusBtnStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  cursor: "pointer",
  fontSize: "2.2rem",
  lineHeight: 1,
  color: "var(--color-checkbox-checked)",
  padding: "0 0.2rem",
  flexShrink: 0,
  opacity: 1,
};

const editListBtnStyle: React.CSSProperties = {
  padding: "0.7rem 1.4rem",
  border: "1.5px solid var(--color-checkbox-checked)",
  borderRadius: "0.4rem",
  background: "#fff",
  color: "var(--color-checkbox-checked)",
  fontSize: "1.4rem",
  fontFamily: "var(--font-paragraph)",
  fontWeight: 600,
  cursor: "pointer",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "0.7rem 1.4rem",
  border: "1px solid var(--color-checkbox-checked)",
  borderRadius: "0.4rem",
  background: "#fff",
  color: "var(--color-checkbox-checked)",
  fontSize: "1.4rem",
  fontFamily: "var(--font-paragraph)",
  fontWeight: 600,
  cursor: "pointer",
};

const saveBtnStyle: React.CSSProperties = {
  padding: "0.7rem 1.4rem",
  border: "none",
  borderRadius: "0.4rem",
  background: "var(--color-checkbox-checked)",
  color: "#fff",
  fontSize: "1.4rem",
  fontFamily: "var(--font-paragraph)",
  fontWeight: 600,
  cursor: "pointer",
};
