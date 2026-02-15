"use client";

import React, { useEffect, useState } from "react";
import type { ColumnHeaderCellContent, TableRow } from "@/components/BogTable/BogTable";
import BogCheckbox from "@/components/BogCheckbox/BogCheckbox";
import {
  STUDENT_COLUMNS,
  DRIVER_COLUMNS,
  VEHICLE_COLUMNS,
  FALLBACK_STUDENT_ROWS,
  FALLBACK_DRIVER_ROWS,
  FALLBACK_VEHICLE_ROWS,
  type StudentRowRaw,
  type DriverRowRaw,
  type VehicleRowRaw,
} from "./admin-table-data";

export type AdminTableType = "Students" | "Drivers" | "Vehicles";

const STATUS_STYLE = "bg-[#0a7b4033] w-[50%] rounded-full text-center text-lg";
const CHECKBOX_RAMP_STYLE = {
  "--color-brand-text": "#0a7b4033",
  "--checkbox-indicator-color": "#22070BB2",
} as React.CSSProperties;
const CHECKBOX_ACTIVE_STYLE = {
  "--color-brand-text": "#C73A3A33",
  "--checkbox-indicator-color": "#22070BB2",
} as React.CSSProperties;

function studentRawToTableRows(rows: StudentRowRaw[]): TableRow[] {
  return rows.map((row) => ({
    cells: [
      { content: row.name },
      { content: row.email },
      { content: row.phone },
      {
        content: (
          <BogCheckbox
            checked={row.ramp}
            disabled
            name="ramp"
            style={CHECKBOX_RAMP_STYLE}
          />
        ),
      },
      {
        content: (
          <p className={STATUS_STYLE}>{row.status}</p>
        ),
      },
      {
        content: (
          <BogCheckbox
            checked={row.active === "checked" ? true : row.active === "indeterminate" ? "indeterminate" : false}
            disabled
            name="active"
            style={CHECKBOX_ACTIVE_STYLE}
          />
        ),
      },
    ],
  }));
}

function driverRawToTableRows(rows: DriverRowRaw[]): TableRow[] {
  return rows.map((row) => ({
    cells: [
      { content: row.preferredName },
      { content: row.email },
      { content: row.phone },
      { content: row.vehicle },
    ],
  }));
}

function vehicleRawToTableRows(rows: VehicleRowRaw[]): TableRow[] {
  return rows.map((row) => ({
    cells: [
      { content: row.licensePlate },
      { content: row.makeModel },
      { content: row.assignedDriver },
      { content: row.accessibilityFeatures },
    ],
  }));
}

/** Adapt API user list to StudentRowRaw (students only). */
function adaptUsersToStudentRows(data: unknown): StudentRowRaw[] {
  if (!Array.isArray(data)) return [];
  return data.map((u: Record<string, unknown>) => ({
    name: String(u.name ?? ""),
    email: String(u.email ?? ""),
    phone: String((u as { phone?: string }).phone ?? ""),
    ramp: Boolean((u as { ramp?: boolean }).ramp ?? false),
    status: String((u as { status?: string }).status ?? "—"),
    active: ((u as { active?: string }).active as StudentRowRaw["active"]) ?? "unchecked",
  }));
}

/** Adapt API user list to DriverRowRaw (drivers only). */
function adaptUsersToDriverRows(data: unknown): DriverRowRaw[] {
  if (!Array.isArray(data)) return [];
  return data.map((u: Record<string, unknown>) => ({
    preferredName: String((u as { preferredName?: string }).preferredName ?? u.name ?? ""),
    email: String(u.email ?? ""),
    phone: String((u as { phone?: string }).phone ?? ""),
    vehicle: String((u as { vehicle?: string }).vehicle ?? "—"),
  }));
}

/** Adapt API vehicle list to VehicleRowRaw. */
function adaptVehiclesToRows(data: unknown): VehicleRowRaw[] {
  if (!Array.isArray(data)) return [];
  return data.map((v: Record<string, unknown>) => ({
    licensePlate: String(v.licensePlate ?? ""),
    makeModel: String(v.description ?? v.name ?? "—"),
    assignedDriver: String((v as { assignedDriver?: string }).assignedDriver ?? "—"),
    accessibilityFeatures: String((v as { accessibility?: string }).accessibility ?? "—"),
  }));
}

export function useAdminTableData(tableType: AdminTableType) {
  const [columns, setColumns] = useState<ColumnHeaderCellContent[]>(STUDENT_COLUMNS);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const applyFallback = (reason: string) => {
      if (cancelled) return;
      setUsedFallback(true);
      if (tableType === "Students") {
        setColumns(STUDENT_COLUMNS);
        setRows(studentRawToTableRows(FALLBACK_STUDENT_ROWS));
      } else if (tableType === "Drivers") {
        setColumns(DRIVER_COLUMNS);
        setRows(driverRawToTableRows(FALLBACK_DRIVER_ROWS));
      } else {
        setColumns(VEHICLE_COLUMNS);
        setRows(vehicleRawToTableRows(FALLBACK_VEHICLE_ROWS));
      }
      setError(reason);
      setLoading(false);
    };

    if (tableType === "Students") {
      fetch("/api/users?type=Student")
        .then((res) => {
          if (!res.ok) throw new Error(`API ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (cancelled) return;
          const raw = adaptUsersToStudentRows(data);
          setColumns(STUDENT_COLUMNS);
          setRows(studentRawToTableRows(raw.length ? raw : FALLBACK_STUDENT_ROWS));
          setUsedFallback(raw.length === 0);
          setLoading(false);
        })
        .catch(() => applyFallback("Using fallback data (API unavailable or returned no students)."));
      return;
    }

    if (tableType === "Drivers") {
      fetch("/api/users?type=Driver")
        .then((res) => {
          if (!res.ok) throw new Error(`API ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (cancelled) return;
          const raw = adaptUsersToDriverRows(data);
          setColumns(DRIVER_COLUMNS);
          setRows(driverRawToTableRows(raw.length ? raw : FALLBACK_DRIVER_ROWS));
          setUsedFallback(raw.length === 0);
          setLoading(false);
        })
        .catch(() => applyFallback("Using fallback data (API unavailable or returned no drivers)."));
      return;
    }

    // Vehicles
    fetch("/api/vehicles")
      .then((res) => {
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const raw = adaptVehiclesToRows(data);
        setColumns(VEHICLE_COLUMNS);
        setRows(vehicleRawToTableRows(raw.length ? raw : FALLBACK_VEHICLE_ROWS));
        setUsedFallback(raw.length === 0);
        setLoading(false);
      })
      .catch(() => applyFallback("Using fallback data (API unavailable or returned no vehicles)."));

    return () => {
      cancelled = true;
    };
  }, [tableType]);

  return { columns, rows, loading, error, usedFallback };
}
