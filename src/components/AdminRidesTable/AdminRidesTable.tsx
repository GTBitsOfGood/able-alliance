"use client";

/**
 * Derived from the design-system BogTable (bog.json `table` v1.0.0) and kept
 * separate so `bog-cli` can keep updating that component untouched.
 *
 * Differences from BogTable, all required by the admin rides design:
 *   - the search field takes a caller-supplied placeholder
 *   - columns carry a fixed width and have no per-column sort carets; the
 *     caller orders its own rows and offers a "Sort By" control in the toolbar
 *   - no selection checkboxes
 *   - body cells use the weaker row divider the design asks for
 */

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
  content: ReactNode;
  styleProps?: React.ComponentProps<typeof Table.Cell>;
};

export type TableRow = {
  /** Stable identity for the row, used as the React key. */
  key: string;
  cells: RowCell[];
  styleProps?: React.ComponentProps<typeof Table.Row>;
};

interface AdminRidesTableProps {
  columnHeaders: ColumnHeader[];
  rows: TableRow[];
  searchPlaceholder?: string;
  /** Rendered to the right of the search field. */
  toolbarActions?: ReactNode;
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
  size = "responsive",
  emptyMessage,
  className,
}) => {
  const breakpoint = useResponsive();
  const [query, setQuery] = React.useState("");

  const filteredRows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      row.cells.some((cell) =>
        extractText(cell.content).toLowerCase().includes(q),
      ),
    );
  }, [rows, query]);

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

        <div className={styles.container}>
          <Table.Root
            size={radixSize}
            className={`${styles.root} ${className || ""}`}
          >
            <Table.Header>
              <Table.Row>
                {columnHeaders.map((header, i) => (
                  <Table.ColumnHeaderCell
                    key={`col-${i}`}
                    className={styles.columnHeaderCell}
                    style={header.width ? { width: header.width } : undefined}
                  >
                    {header.content}
                  </Table.ColumnHeaderCell>
                ))}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filteredRows.map((row) => (
                <Table.Row
                  key={row.key}
                  {...row.styleProps}
                  className={styles.row}
                >
                  {row.cells.map((cell, cIdx) => (
                    <Table.Cell
                      key={`${row.key}-cell-${cIdx}`}
                      {...cell.styleProps}
                      className={styles.cell}
                    >
                      {cell.content}
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
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
