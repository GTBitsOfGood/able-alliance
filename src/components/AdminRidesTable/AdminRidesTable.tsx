"use client";

/**
 * Derived from the design-system BogTable (bog.json `table` v1.0.0) and kept
 * separate so `bog-cli` can keep updating that component untouched.
 *
 * Differences from BogTable, all required by the admin rides design:
 *   - the search field takes a caller-supplied placeholder
 *   - fixed-width columns, typed sort values, and individual filters
 *   - contextual row actions without a dedicated Action column
 *   - no selection checkboxes
 *   - body cells use the weaker row divider the design asks for
 */

import Image from "next/image";
import { ContextMenu, DropdownMenu } from "radix-ui";
import { Table, Theme } from "@radix-ui/themes";
import React, { ReactNode } from "react";
import "../BogTable/bogtable-radix.css";
import styles from "./styles.module.css";
import { useResponsive } from "../../utils/design-system/hooks/useResponsive";
import { getNumericalSizeFromBreakpoint } from "../../utils/design-system/breakpoints/breakpoints";
import BogTextInput from "../BogTextInput/BogTextInput";
import BogIcon from "../BogIcon/BogIcon";

export type ColumnHeader = {
  content: string;
  /** Column width, e.g. "10.9%" — taken from the design's column geometry. */
  width?: string;
};

export type RowCell = {
  /** Allow expanded details and long content to wrap within the cell. */
  wrap?: boolean;
  content: ReactNode;
  /** Raw values keep dates chronological and status components searchable. */
  value?: string | number;
  styleProps?: React.ComponentProps<typeof Table.Cell>;
};

export type TableRow = {
  /** Stable identity for the row, used as the React key. */
  key: string;
  cells: RowCell[];
  label?: string;
  actions?: { label: string; onSelect: () => void; disabled?: boolean }[];
  styleProps?: React.ComponentProps<typeof Table.Row>;
};

interface AdminRidesTableProps {
  columnHeaders: ColumnHeader[];
  rows: TableRow[];
  searchPlaceholder?: string;
  /** Rendered to the right of the search field. */
  toolbarActions?: ReactNode;
  filters?: ReactNode;
  size?: "small" | "medium" | "large" | "responsive";
  /** Shown in place of the body when no row survives the search. */
  emptyMessage?: ReactNode;
  className?: string;
}

const extractText = (node: ReactNode): string => {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (React.isValidElement(node)) {
    const { children } = (node.props as { children?: ReactNode }) ?? {};
    return extractText(children);
  }
  return "";
};

const AdminRidesTable: React.FC<AdminRidesTableProps> = ({
  columnHeaders,
  rows,
  searchPlaceholder = "Enter text to search",
  toolbarActions,
  filters,
  size = "responsive",
  emptyMessage,
  className,
}) => {
  const breakpoint = useResponsive();
  const [sorts, setSorts] = React.useState<
    { index: number; direction: "asc" | "desc" }[]
  >([]);
  const toggleSort = (index: number) =>
    setSorts((previous) => {
      const current = previous.find((sort) => sort.index === index);
      if (!current) return [...previous, { index, direction: "asc" }];
      return current.direction === "asc"
        ? previous.map((sort) =>
            sort.index === index ? { ...sort, direction: "desc" } : sort,
          )
        : previous.filter((sort) => sort.index !== index);
    });
  const [query, setQuery] = React.useState("");

  const filteredRows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      row.cells.some((cell) =>
        `${extractText(cell.content)} ${cell.value ?? ""}`
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [rows, query]);

  const sortedRows = React.useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      for (const { index, direction } of sorts) {
        const av = a.cells[index].value ?? extractText(a.cells[index].content);
        const bv = b.cells[index].value ?? extractText(b.cells[index].content);
        const compared =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv), undefined, {
                numeric: true,
                sensitivity: "base",
              });
        if (compared) return direction === "asc" ? compared : -compared;
      }
      return 0;
    });
  }, [filteredRows, sorts]);

  const handleSearchChange: React.FormEventHandler<HTMLDivElement> = (e) => {
    const el = e.target as HTMLInputElement;
    if (el && typeof el.value === "string") setQuery(el.value);
  };

  const radixSize: "1" | "2" | "3" =
    size === "responsive"
      ? getNumericalSizeFromBreakpoint(breakpoint)
      : ({ small: "1", medium: "2", large: "3" } as const)[size];

  return (
    <Theme>
      <div className={styles.ridesTable}>
        <div className={styles.topBar}>
          <div className={styles.searchWrapper} onChange={handleSearchChange}>
            <BogTextInput
              name="search"
              placeholder={searchPlaceholder}
              className={styles.searchWithIcon}
            />
            <BogIcon name="search" size={16} className={styles.searchIcon} />
          </div>
          {toolbarActions && (
            <div className={styles.tableActions}>{toolbarActions}</div>
          )}
        </div>

        {filters && <div className={styles.filters}>{filters}</div>}
        <div className={styles.container}>
          <Table.Root
            size={radixSize}
            layout="fixed"
            className={`${styles.root} ${className || ""}`}
          >
            <Table.Header>
              <Table.Row>
                {columnHeaders.map((header, i) => {
                  const direction = sorts.find(
                    (sort) => sort.index === i,
                  )?.direction;
                  return (
                    <Table.ColumnHeaderCell
                      key={header.content}
                      className={styles.columnHeaderCell}
                      aria-sort={
                        direction === "asc"
                          ? "ascending"
                          : direction === "desc"
                            ? "descending"
                            : "none"
                      }
                      style={header.width ? { width: header.width } : undefined}
                    >
                      <button
                        type="button"
                        className={styles.sortHeader}
                        aria-label={`Sort by ${header.content}${direction ? `, ${direction === "asc" ? "ascending" : "descending"}` : ""}`}
                        onClick={() => toggleSort(i)}
                      >
                        <span>{header.content}</span>
                        <span className={styles.sortIcons} aria-hidden="true">
                          <BogIcon
                            name="caret-up"
                            size={12}
                            className={
                              direction === "asc"
                                ? styles.sortActive
                                : styles.sortInactive
                            }
                          />
                          <BogIcon
                            name="caret-down"
                            size={12}
                            className={
                              direction === "desc"
                                ? styles.sortActive
                                : styles.sortInactive
                            }
                          />
                        </span>
                      </button>
                    </Table.ColumnHeaderCell>
                  );
                })}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {sortedRows.map((row) => {
                const tableRow = (
                  <Table.Row
                    key={row.key}
                    {...row.styleProps}
                    className={styles.row}
                    data-route-id={row.key}
                  >
                    {row.cells.map((cell, cIdx) => (
                      <Table.Cell
                        key={`${row.key}-cell-${cIdx}`}
                        {...cell.styleProps}
                        className={styles.cell}
                      >
                        <div
                          className={
                            cell.wrap ? styles.cellWrapped : styles.cellText
                          }
                          title={
                            cell.wrap
                              ? undefined
                              : extractText(cell.content) ||
                                String(cell.value ?? "")
                          }
                        >
                          {cell.content}
                        </div>
                        {cIdx === row.cells.length - 1 && row.actions && (
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <button
                                type="button"
                                className={styles.rowActions}
                                aria-label={`Actions for ${row.label ?? row.key}`}
                              >
                                <Image
                                  src="/ride-actions-menu.svg"
                                  alt=""
                                  width={20}
                                  height={20}
                                />
                              </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content
                                className={styles.menu}
                                align="end"
                                sideOffset={4}
                              >
                                {row.actions.map((action) => (
                                  <DropdownMenu.Item
                                    key={action.label}
                                    className={styles.menuItem}
                                    disabled={action.disabled}
                                    onSelect={action.onSelect}
                                  >
                                    {action.label}
                                  </DropdownMenu.Item>
                                ))}
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        )}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                );
                if (!row.actions?.length) return tableRow;
                return (
                  <ContextMenu.Root key={row.key}>
                    <ContextMenu.Trigger asChild>
                      {tableRow}
                    </ContextMenu.Trigger>
                    <ContextMenu.Portal>
                      <ContextMenu.Content className={styles.menu}>
                        {row.actions?.map((action) => (
                          <ContextMenu.Item
                            key={action.label}
                            className={styles.menuItem}
                            disabled={action.disabled}
                            onSelect={action.onSelect}
                          >
                            {action.label}
                          </ContextMenu.Item>
                        ))}
                      </ContextMenu.Content>
                    </ContextMenu.Portal>
                  </ContextMenu.Root>
                );
              })}
            </Table.Body>
          </Table.Root>
          {filteredRows.length === 0 && emptyMessage && (
            <p className={styles.empty}>{emptyMessage}</p>
          )}
        </div>
      </div>
    </Theme>
  );
};

export default AdminRidesTable;
