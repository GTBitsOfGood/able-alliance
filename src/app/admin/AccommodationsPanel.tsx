"use client";

import React, { useEffect, useState } from "react";

type Accommodation = { _id: string; label: string };

export default function AccommodationsPanel({
  onSaved,
}: {
  onSaved?: () => void;
}) {
  const [items, setItems] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Accommodation[]>([]);
  const [pendingNew, setPendingNew] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/accommodations")
      .then((r) => r.json())
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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

  async function saveChanges() {
    setSaving(true);
    setError(null);
    try {
      const draftIds = new Set(draft.map((d) => d._id));
      const toDelete = items.filter((i) => !draftIds.has(i._id));

      // Also add current newLabel if non-empty
      const allNew = newLabel.trim()
        ? [...pendingNew, newLabel.trim()]
        : [...pendingNew];

      await Promise.all(
        toDelete.map((i) =>
          fetch(`/api/accommodations/${i._id}`, { method: "DELETE" }).then(
            (r) => {
              if (!r.ok) throw new Error(`Failed to delete "${i.label}"`);
            },
          ),
        ),
      );

      const created: Accommodation[] = [];
      for (const label of allNew) {
        const res = await fetch("/api/accommodations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed to create "${label}"`);
        }
        created.push(await res.json());
      }

      setItems([...draft.filter((d) => draftIds.has(d._id)), ...created]);
      setEditing(false);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function removeFromDraft(id: string) {
    setDraft((prev) => prev.filter((d) => d._id !== id));
  }

  function removeFromPending(idx: number) {
    setPendingNew((prev) => prev.filter((_, i) => i !== idx));
  }

  if (loading) {
    return (
      <p style={{ color: "var(--color-grey-text-weak)", fontSize: "1.5rem" }}>
        Loading…
      </p>
    );
  }

  return (
    <div>
      <h2 style={subheadingStyle}>Accommodations</h2>

      {editing ? (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}
        >
          {/* Existing items */}
          {draft.map((item) => (
            <div key={item._id} style={rowStyle}>
              <div style={itemBoxStyle}>{item.label}</div>
              <button
                onClick={() => removeFromDraft(item._id)}
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

          <div style={{ display: "flex", gap: "0.8rem", marginTop: "0.4rem" }}>
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
          style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}
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
            <div key={item._id} style={itemBoxStyle}>
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
