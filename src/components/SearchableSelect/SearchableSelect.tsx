"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import styles from "./styles.module.css";

export type SearchableSelectOption = { value: string; label: string };

function filterOptions(
  options: SearchableSelectOption[],
  query: string,
): SearchableSelectOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  const startsWith = options.filter((o) => o.label.toLowerCase().startsWith(q));
  const contains = options.filter(
    (o) =>
      !o.label.toLowerCase().startsWith(q) && o.label.toLowerCase().includes(q),
  );
  return [...startsWith, ...contains];
}

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  id?: string;
  required?: boolean;
  onFocusCapture?: (e: React.FocusEvent<HTMLInputElement>) => void;
};

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Search...",
  className,
  inputClassName,
  id,
  required,
  onFocusCapture,
}: SearchableSelectProps) {
  const valueToLabel = useCallback(
    (v: string) => options.find((o) => o.value === v)?.label ?? "",
    [options],
  );

  const [draft, setDraft] = useState(valueToLabel(value));
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setDraft(valueToLabel(value));
  }, [value, valueToLabel]);

  const filtered = filterOptions(options, draft);

  const commit = useCallback(
    (option: SearchableSelectOption) => {
      onChange(option.value);
      setDraft(option.label);
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
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlighted]) commit(filtered[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setDraft(valueToLabel(value));
    }
  };

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlighted] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  return (
    <div className={`${styles.wrapper} ${className ?? ""}`}>
      <input
        id={id}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={draft}
        required={required}
        className={`${styles.input} ${inputClassName ?? ""}`}
        onFocus={handleFocus}
        onFocusCapture={onFocusCapture}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {open && filtered.length > 0 && (
        <ul ref={listRef} className={styles.dropdown} role="listbox">
          {filtered.map((option, i) => (
            <li
              key={option.value}
              role="option"
              aria-selected={i === highlighted}
              className={`${styles.option} ${i === highlighted ? styles.optionHighlighted : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(option);
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
