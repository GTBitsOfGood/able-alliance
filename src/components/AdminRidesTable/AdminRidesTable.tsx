"use client";

/**
 * Derived from the design-system BogTable (bog.json `table` v1.0.0) and kept
 * separate so `bog-cli` can keep updating that component untouched.
 *
 * Differences from BogTable, all required by the admin rides design:
 *   - the search field takes a caller-supplied placeholder
 *   - resizable columns, typed sort values, and individual filters
 *   - contextual row actions without a dedicated Action column
 *   - no selection checkboxes
 *   - body cells use the weaker row divider the design asks for
 */

import Image from "next/image";
import { ContextMenu, DropdownMenu } from "radix-ui";
import { Table, Theme } from "@radix-ui/themes";
import React, { ReactNode } from "react";
import "@/components/BogTable/bogtable-radix.css";
import styles from "./styles.module.css";
import { useResponsive } from "@/utils/design-system/hooks/useResponsive";
import { getNumericalSizeFromBreakpoint } from "@/utils/design-system/breakpoints/breakpoints";
import BogTextInput from "@/components/BogTextInput/BogTextInput";
import BogIcon from "@/components/BogIcon/BogIcon";

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
  /** Enable visibility, resizing, and autofit controls for the rides page. */
  columnControls?: boolean;
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
  columnControls = false,
  size = "responsive",
  emptyMessage,
  className,
}) => {
  const breakpoint = useResponsive();
  const tableRef = React.useRef<HTMLDivElement>(null);
  const [columnWidths, setColumnWidths] = React.useState<number[] | null>(null);
  const drag = React.useRef<{
    index: number;
    x: number;
    widths: number[];
  } | null>(null);
  const minimumWidth = 40;
  const [hiddenColumns, setHiddenColumns] = React.useState<number[]>([]);
  const visibleIndices = columnHeaders.flatMap((_, index) =>
    columnControls && hiddenColumns.includes(index) ? [] : [index],
  );

  const readWidths = () => {
    const headers = tableRef.current?.querySelectorAll<HTMLElement>("thead th");
    const widths = columnHeaders.map(
      (_, index) => columnWidths?.[index] ?? minimumWidth,
    );
    headers?.forEach((header) => {
      widths[Number(header.dataset.columnIndex)] =
        header.getBoundingClientRect().width;
    });
    return widths;
  };

  const resizeColumn = (
    index: number,
    width: number,
    widths = readWidths(),
  ) => {
    setColumnWidths(
      widths.map((current, i) =>
        i === index ? Math.max(minimumWidth, Math.round(width)) : current,
      ),
    );
  };

  // Measure rendered content, including chips and nested time labels, at its
  // natural width. The hidden copy leaves the live table and its focus intact.
  const autofit = (index?: number) => {
    const table = tableRef.current?.querySelector("table");
    if (!table) return;
    const copy = table.cloneNode(true) as HTMLTableElement;
    copy.setAttribute("aria-hidden", "true");
    copy.inert = true;
    Object.assign(copy.style, {
      position: "fixed",
      visibility: "hidden",
      pointerEvents: "none",
      tableLayout: "auto",
      width: "max-content",
      minWidth: "0",
      top: "0",
      left: "0",
    });
    copy.querySelectorAll("th").forEach((cell) => {
      cell.style.width = "auto";
    });
    copy
      .querySelectorAll<HTMLElement>("[data-column-content]")
      .forEach((content) => {
        Object.assign(content.style, {
          width: "max-content",
          maxWidth: "none",
          whiteSpace: "nowrap",
        });
      });
    const widths = readWidths();
    table.parentElement?.appendChild(copy);
    try {
      copy.querySelectorAll<HTMLElement>("thead th").forEach((cell) => {
        const columnIndex = Number(cell.dataset.columnIndex);
        if (index === undefined || index === columnIndex) {
          widths[columnIndex] = Math.max(
            minimumWidth,
            Math.ceil(cell.getBoundingClientRect().width),
          );
        }
      });
      setColumnWidths(widths);
    } finally {
      copy.remove();
    }
  };
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

        {(columnControls || filters) && (
          <div className={styles.filters}>
            {columnControls && (
              <>
                <div className={styles.columnTools}>
                  <DropdownMenu.Root modal={false}>
                    <DropdownMenu.Trigger asChild>
                      <button type="button" className={styles.autofitButton}>
                        Columns <BogIcon name="chevron-down" size={20} />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className={styles.menu}
                        align="start"
                        sideOffset={8}
                        collisionPadding={16}
                      >
                        <DropdownMenu.Label className={styles.columnsLabel}>
                          Visible columns
                        </DropdownMenu.Label>
                        {columnHeaders.map((header, index) => {
                          const visible = visibleIndices.includes(index);
                          return (
                            <DropdownMenu.CheckboxItem
                              key={header.content}
                              className={`${styles.menuItem} ${styles.columnOption}`}
                              checked={visible}
                              disabled={visible && visibleIndices.length === 1}
                              onSelect={(event) => event.preventDefault()}
                              onCheckedChange={(checked) => {
                                setColumnWidths(readWidths());
                                setHiddenColumns((current) =>
                                  checked
                                    ? current.filter(
                                        (column) => column !== index,
                                      )
                                    : [...current, index],
                                );
                                if (!checked)
                                  setSorts((current) =>
                                    current.filter(
                                      (sort) => sort.index !== index,
                                    ),
                                  );
                              }}
                            >
                              <span className={styles.columnCheckbox}>
                                <DropdownMenu.ItemIndicator>
                                  <BogIcon name="check" size={14} />
                                </DropdownMenu.ItemIndicator>
                              </span>
                              {header.content}
                            </DropdownMenu.CheckboxItem>
                          );
                        })}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                  <button
                    type="button"
                    className={styles.autofitButton}
                    onClick={() => autofit()}
                  >
                    Autofit
                  </button>
                </div>
                {filters && (
                  <div
                    className={styles.toolbarDivider}
                    role="separator"
                    aria-orientation="vertical"
                  />
                )}
              </>
            )}
            {filters}
          </div>
        )}
        <div className={styles.container}>
          <Table.Root
            ref={tableRef}
            size={radixSize}
            layout="fixed"
            style={
              columnControls && columnWidths
                ? {
                    width: visibleIndices.reduce(
                      (sum, index) => sum + columnWidths[index],
                      0,
                    ),
                    minWidth: 0,
                  }
                : undefined
            }
            className={`${styles.root} ${columnControls ? styles.adjustable : ""} ${className || ""}`}
          >
            <Table.Header>
              <Table.Row>
                {columnHeaders.map((header, i) => {
                  if (!visibleIndices.includes(i)) return null;
                  const direction = sorts.find(
                    (sort) => sort.index === i,
                  )?.direction;
                  return (
                    <Table.ColumnHeaderCell
                      key={header.content}
                      data-column-index={i}
                      className={styles.columnHeaderCell}
                      aria-sort={
                        direction === "asc"
                          ? "ascending"
                          : direction === "desc"
                            ? "descending"
                            : "none"
                      }
                      style={{
                        width:
                          (columnControls ? columnWidths?.[i] : undefined) ??
                          header.width,
                      }}
                    >
                      <button
                        type="button"
                        className={styles.sortHeader}
                        data-column-content
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
                      {columnControls && (
                        <div
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Resize ${header.content} column`}
                          aria-valuemin={minimumWidth}
                          aria-valuenow={columnWidths?.[i]}
                          tabIndex={0}
                          className={styles.resizeHandle}
                          title="Drag to resize; double-click to autofit. Arrow keys resize; Enter autofits."
                          onDoubleClick={() => autofit(i)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              autofit(i);
                            } else if (
                              event.key === "ArrowLeft" ||
                              event.key === "ArrowRight"
                            ) {
                              event.preventDefault();
                              const widths = readWidths();
                              resizeColumn(
                                i,
                                widths[i] +
                                  (event.key === "ArrowRight" ? 1 : -1) *
                                    (event.shiftKey ? 40 : 10),
                                widths,
                              );
                            }
                          }}
                          onPointerDown={(event) => {
                            if (event.button !== 0) return;
                            event.preventDefault();
                            event.currentTarget.focus();
                            event.currentTarget.setPointerCapture(
                              event.pointerId,
                            );
                            drag.current = {
                              index: i,
                              x: event.clientX,
                              widths: readWidths(),
                            };
                          }}
                          onPointerMove={(event) => {
                            const current = drag.current;
                            if (!current) return;
                            resizeColumn(
                              current.index,
                              current.widths[current.index] +
                                event.clientX -
                                current.x,
                              current.widths,
                            );
                          }}
                          onPointerUp={(event) => {
                            drag.current = null;
                            if (
                              event.currentTarget.hasPointerCapture(
                                event.pointerId,
                              )
                            ) {
                              event.currentTarget.releasePointerCapture(
                                event.pointerId,
                              );
                            }
                          }}
                          onLostPointerCapture={() => {
                            drag.current = null;
                          }}
                          onPointerCancel={() => {
                            drag.current = null;
                          }}
                        />
                      )}
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
                    className={`${styles.row} ${row.styleProps?.className ?? ""}`}
                    data-route-id={row.key}
                  >
                    {row.cells.map((cell, cIdx) =>
                      visibleIndices.includes(cIdx) ? (
                        <Table.Cell
                          key={`${row.key}-cell-${cIdx}`}
                          {...cell.styleProps}
                          className={styles.cell}
                        >
                          <div
                            data-column-content
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
                          {cIdx === visibleIndices[visibleIndices.length - 1] &&
                            row.actions && (
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
                      ) : null,
                    )}
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
