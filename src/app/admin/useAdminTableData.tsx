"use client";

import React, { useEffect, useState, useCallback } from "react"; // Add useCallback import
import type {
  ColumnHeaderCellContent,
  TableRow,
} from "@/components/BogTable/BogTable";
import {
  STUDENT_COLUMNS,
  DRIVER_COLUMNS,
  VEHICLE_COLUMNS,
  ADMIN_COLUMNS,
  type StudentRowRaw,
  type DriverRowRaw,
  type VehicleRowRaw,
  type AdminRowRaw,
} from "./admin-table-data";

export type AdminTableType = "Students" | "Drivers" | "Vehicles" | "Admins";

function studentRawToTableRows(rows: StudentRowRaw[]): TableRow[] {
  return rows.map((row) => ({
    cells: [
      { content: row.name },
      { content: row.email },
      { content: row.phone },
      { content: row.accessibilityNeeds || "—" },
    ],
  }));
}

function driverRawToTableRows(rows: DriverRowRaw[]): TableRow[] {
  return rows.map((row) => ({
    cells: [{ content: row.name }, { content: row.email }],
  }));
}

function adminRawToTableRows(rows: AdminRowRaw[]): TableRow[] {
  return rows.map((row) => ({
    cells: [{ content: row.name }, { content: row.email }],
  }));
}

function vehicleRawToTableRows(rows: VehicleRowRaw[]): TableRow[] {
  return rows.map((row) => ({
    cells: [
      { content: row.licensePlate },
      { content: row.makeModel },
      { content: row.accessibilityFeatures },
      { content: String(row.seatCount) },
    ],
  }));
}

/** Adapt API user list to StudentRowRaw (students only). */
function adaptUsersToStudentRows(data: unknown): StudentRowRaw[] {
  if (!Array.isArray(data)) return [];
  return data.map((u: Record<string, unknown>) => {
    const studentInfo = (u.studentInfo ?? {}) as {
      notes?: string;
      accessibilityNeeds?: string;
    };
    const accessibilityNeeds = studentInfo.accessibilityNeeds;
    return {
      name: String(u.name ?? ""),
      email: String(u.email ?? ""),
      phone: String(studentInfo.notes ?? ""),
      accessibilityNeeds: accessibilityNeeds
        ? String(accessibilityNeeds)
        : "",
    };
  });
}

/** Adapt API user list to DriverRowRaw (drivers only). */
function adaptUsersToDriverRows(data: unknown): DriverRowRaw[] {
  if (!Array.isArray(data)) return [];
  return data.map((u: Record<string, unknown>) => ({
    name: String(u.name ?? ""),
    email: String(u.email ?? ""),
  }));
}

/** Adapt API user list to AdminRowRaw (admins only). */
function adaptUsersToAdminRows(data: unknown): AdminRowRaw[] {
  if (!Array.isArray(data)) return [];
  return data.map((u: Record<string, unknown>) => ({
    name: String(u.name ?? ""),
    email: String(u.email ?? ""),
  }));
}

/** Adapt API vehicle list to VehicleRowRaw. */
function adaptVehiclesToRows(data: unknown): VehicleRowRaw[] {
  if (!Array.isArray(data)) return [];
  return data.map((v: Record<string, unknown>) => {
    const seatCount = Number((v as { seatCount?: number }).seatCount);
    return {
      licensePlate: String(v.licensePlate ?? ""),
      makeModel: String(v.description ?? v.name ?? "—"),
      accessibilityFeatures: String(
        (v as { accessibility?: string }).accessibility ?? "—",
      ),
      seatCount: Number.isFinite(seatCount) && seatCount >= 0 ? seatCount : 0,
    };
  });
}

export function useAdminTableData(tableType: AdminTableType) {
  const [columns, setColumns] =
    useState<ColumnHeaderCellContent[]>(STUDENT_COLUMNS);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowIds, setRowIds] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  /** Force a re-fetch of the current table data. */
  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;

    // Wrap state updates in async function
    const loadData = async () => {
      setLoading(true);
      setError(null);

      const extractIds = (data: unknown): string[] => {
        if (!Array.isArray(data)) return [];
        return data.map((d: Record<string, unknown>) => String(d._id ?? ""));
      };

      try {
        if (tableType === "Students") {
          const res = await fetch("/api/users?type=Student");
          if (!res.ok) throw new Error(`API ${res.status}`);
          const data = await res.json();
          if (cancelled) return;

          const raw = adaptUsersToStudentRows(data);
          setColumns(STUDENT_COLUMNS);
          setRows(studentRawToTableRows(raw));
          setRowIds(extractIds(data));
          setLoading(false);
        } else if (tableType === "Drivers") {
          const res = await fetch("/api/users?type=Driver");
          if (!res.ok) throw new Error(`API ${res.status}`);
          const data = await res.json();
          if (cancelled) return;

          const raw = adaptUsersToDriverRows(data);
          setColumns(DRIVER_COLUMNS);
          setRows(driverRawToTableRows(raw));
          setRowIds(extractIds(data));
          setLoading(false);
        } else if (tableType === "Admins") {
          const res = await fetch("/api/users?type=Admin");
          if (!res.ok) throw new Error(`API ${res.status}`);
          const data = await res.json();
          if (cancelled) return;

          const raw = adaptUsersToAdminRows(data);
          setColumns(ADMIN_COLUMNS);
          setRows(adminRawToTableRows(raw));
          setRowIds(extractIds(data));
          setLoading(false);
        } else {
          // Vehicles
          const res = await fetch("/api/vehicles");
          if (!res.ok) throw new Error(`API ${res.status}`);
          const data = await res.json();
          if (cancelled) return;

          const raw = adaptVehiclesToRows(data);
          setColumns(VEHICLE_COLUMNS);
          setRows(vehicleRawToTableRows(raw));
          setRowIds(extractIds(data));
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : `Failed to load ${tableType.toLowerCase()}.`,
        );
        setRows([]);
        setRowIds([]);
        setLoading(false);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [tableType, refreshKey]);

  const deleteRows = async (indices: Set<number>): Promise<number> => {
    const endpoint = tableType === "Vehicles" ? "/api/vehicles" : "/api/users";
    let deleted = 0;
    for (const idx of indices) {
      const id = rowIds[idx];
      if (!id) continue;
      try {
        const res = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
        if (res.ok) deleted++;
      } catch {
        // skip failed deletes
      }
    }
    if (deleted > 0) refresh();
    return deleted;
  };

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    if (tableType === "Students") {
      fetch("/api/users?type=Student")
        .then((res) =>
          res.ok ? res.json() : Promise.reject(new Error(`API ${res.status}`)),
        )
        .then((data) => {
          const raw = adaptUsersToStudentRows(data);
          setColumns(STUDENT_COLUMNS);
          setRows(studentRawToTableRows(raw));
        })
        .catch((err) => {
          setError(
            err instanceof Error ? err.message : "Failed to load students.",
          );
          setRows([]);
        })
        .finally(() => setLoading(false));
    } else if (tableType === "Drivers") {
      fetch("/api/users?type=Driver")
        .then((res) =>
          res.ok ? res.json() : Promise.reject(new Error(`API ${res.status}`)),
        )
        .then((data) => {
          const raw = adaptUsersToDriverRows(data);
          setColumns(DRIVER_COLUMNS);
          setRows(driverRawToTableRows(raw));
        })
        .catch((err) => {
          setError(
            err instanceof Error ? err.message : "Failed to load drivers.",
          );
          setRows([]);
        })
        .finally(() => setLoading(false));
    } else if (tableType === "Admins") {
      fetch("/api/users?type=Admin")
        .then((res) =>
          res.ok ? res.json() : Promise.reject(new Error(`API ${res.status}`)),
        )
        .then((data) => {
          const raw = adaptUsersToAdminRows(data);
          setColumns(ADMIN_COLUMNS);
          setRows(adminRawToTableRows(raw));
        })
        .catch((err) => {
          setError(
            err instanceof Error ? err.message : "Failed to load admins.",
          );
          setRows([]);
        })
        .finally(() => setLoading(false));
    } else {
      fetch("/api/vehicles")
        .then((res) =>
          res.ok ? res.json() : Promise.reject(new Error(`API ${res.status}`)),
        )
        .then((data) => {
          const raw = adaptVehiclesToRows(data);
          setColumns(VEHICLE_COLUMNS);
          setRows(vehicleRawToTableRows(raw));
        })
        .catch((err) => {
          setError(
            err instanceof Error ? err.message : "Failed to load vehicles.",
          );
          setRows([]);
        })
        .finally(() => setLoading(false));
    }
  }, [tableType]);

  return { columns, rows, rowIds, loading, error, deleteRows, refetch };
}
