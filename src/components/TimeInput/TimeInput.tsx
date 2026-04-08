"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import styles from "./styles.module.css";

// All 15-minute-interval slots across 24 hours
const ALL_SLOTS: { value: string; label: string }[] = (() => {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const value = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      const period = h >= 12 ? "PM" : "AM";
      const displayH = h % 12 || 12;
      const label = `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
      slots.push({ value, label });
    }
  }
  return slots;
})();

function valueToLabel(value: string): string {
  if (!value) return "";
  const [hStr, mStr] = value.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return "";
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

function filterSlots(query: string): { value: string; label: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_SLOTS;
  const startsWith = ALL_SLOTS.filter((s) =>
    s.label.toLowerCase().startsWith(q),
  );
  const contains = ALL_SLOTS.filter(
    (s) =>
      !s.label.toLowerCase().startsWith(q) && s.label.toLowerCase().includes(q),
  );
  return [...startsWith, ...contains];
}

type TimeInputProps = {
  value: string; // HH:MM (24-hour)
  onChange: (value: string) => void;
  placeholder?: string;
  /** className applied to the outer wrapper div */
  className?: string;
  /** className applied to the text input itself */
  inputClassName?: string;
  id?: string;
};

export function TimeInput({
  value,
  onChange,
  placeholder = "hh:mm",
  className,
  inputClassName,
  id,
}: TimeInputProps) {
  const [draft, setDraft] = useState(valueToLabel(value));
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sync when external value changes
  useEffect(() => {
    setDraft(valueToLabel(value));
  }, [value]);

  const slots = filterSlots(draft);

  const commit = useCallback(
    (slot: { value: string; label: string }) => {
      onChange(slot.value);
      setDraft(slot.label);
      setOpen(false);
    },
    [onChange],
  );

  const handleFocus = () => {
    setDraft("");
    setHighlighted(0);
    setOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);
    setHighlighted(0);
    setOpen(true);
  };

  const handleBlur = () => {
    // Delay to let mousedown on an option fire first
    setTimeout(() => {
      setOpen(false);
      setDraft(valueToLabel(value));
    }, 120);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        return;
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, slots.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (slots[highlighted]) commit(slots[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setDraft(valueToLabel(value));
    }
  };

  // Scroll highlighted option into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlighted] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  return (
    <div ref={wrapperRef} className={`${styles.wrapper} ${className ?? ""}`}>
      <input
        id={id}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={draft}
        className={`${styles.input} ${inputClassName ?? ""}`}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {open && slots.length > 0 && (
        <ul ref={listRef} className={styles.dropdown} role="listbox">
          {slots.map((slot, i) => (
            <li
              key={slot.value}
              role="option"
              aria-selected={i === highlighted}
              className={`${styles.option} ${i === highlighted ? styles.optionHighlighted : ""}`}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus on input
                commit(slot);
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              {slot.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
