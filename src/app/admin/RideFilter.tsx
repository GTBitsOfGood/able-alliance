"use client";

import { DropdownMenu } from "radix-ui";
import BogIcon from "@/components/BogIcon/BogIcon";
import styles from "./ridesTable.module.css";

export default function RideFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={styles.filterButton}
          data-active={selected.length > 0}
          aria-label={`${label} filter${selected.length ? `, ${selected.length} selected` : ""}`}
        >
          {selected.length > 0 && (
            <span className={styles.filterCount}>{selected.length}</span>
          )}
          {label}
          <BogIcon name="chevron-down" size={20} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.filterMenu}
          align="start"
          sideOffset={8}
        >
          <DropdownMenu.Label className={styles.filterLabel}>
            {label}
          </DropdownMenu.Label>
          {options.map((option) => (
            <DropdownMenu.CheckboxItem
              key={option.value}
              className={styles.filterItem}
              checked={selected.includes(option.value)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, option.value]
                    : selected.filter((value) => value !== option.value),
                )
              }
            >
              <span className={styles.filterCheckbox}>
                <DropdownMenu.ItemIndicator>
                  <BogIcon name="check" size={14} />
                </DropdownMenu.ItemIndicator>
              </span>
              {option.label}
            </DropdownMenu.CheckboxItem>
          ))}
          {options.length === 0 && (
            <div className={styles.filterLabel}>No locations available</div>
          )}
          <DropdownMenu.Separator className={styles.filterSeparator} />
          <DropdownMenu.Item
            className={styles.filterItem}
            disabled={!selected.length}
            onSelect={() => onChange([])}
          >
            Clear {label.toLowerCase()}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
