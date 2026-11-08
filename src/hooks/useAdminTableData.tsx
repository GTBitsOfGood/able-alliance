"use client";

import type { UserResponse } from "@/types/api";
import type { Vehicle, Location } from "@db/generated/browser";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useLocationUpdates } from "@/hooks/useLocationUpdates";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { hasUserType, isAdmin } from "@/utils/userTypes";
import type {
  ColumnHeaderCellContent,
  TableRow,
} from "@/components/BogTable/BogTable";
import {
  STUDENT_COLUMNS,
  DRIVER_COLUMNS,
  VEHICLE_COLUMNS,
  ADMIN_COLUMNS,
  LOCATION_COLUMNS,
  ADMIN_TYPE_LABELS,
} from "@/components/admin/admin-table-data";

import type {
  AdminTableType,
  StudentRowRaw,
  DriverRowRaw,
  VehicleRowRaw,
  AdminRowRaw,
  LocationRowRaw,
} from "@/types/admin";

function nameLink(name: string, id: string) {
  return (
    <Link
      href={`/profile/${id}`}
      style={{
        textDecoration: "none",
        color: "inherit",
        fontSize: "inherit",
        lineHeight: "inherit",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.textDecoration =
          "underline")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.textDecoration = "none")
      }
      onClick={(e) => e.stopPropagation()}
    >
      {name}
    </Link>
  );
}

function studentRawToTableRows(
  rows: StudentRowRaw[],
  ids: string[],
): TableRow[] {
  return rows.map((row, i) => ({
    cells: [
      { content: nameLink(row.name, ids[i] ?? "") },
      { content: row.email },
      { content: row.accessibilityNeeds || "—" },
      { content: row.additionalComments || "—" },
    ],
  }));
}

function driverRawToTableRows(rows: DriverRowRaw[], ids: string[]): TableRow[] {
  return rows.map((row, i) => ({
    cells: [
      { content: nameLink(row.name, ids[i] ?? "") },
      { content: row.email },
    ],
  }));
}

function adminRawToTableRows(rows: AdminRowRaw[], ids: string[]): TableRow[] {
  return rows.map((row, i) => ({
    cells: [
      { content: nameLink(row.name, ids[i] ?? "") },
      { content: row.email },
      { content: row.adminType },
    ],
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

function locationRawToTableRows(rows: LocationRowRaw[]): TableRow[] {
  return rows.map((row) => ({
    cells: [
      { content: row.name },
      { content: String(row.latitude) },
      { content: String(row.longitude) },
    ],
  }));
}

function combineFullName(firstName: unknown, lastName: unknown): string {
  if (firstName && lastName) {
    return lastName + ", " + firstName;
  }
  return "";
}

/** Adapt API user list to StudentRowRaw (students only). */
function adaptUsersToStudentRows(data: unknown): StudentRowRaw[] {
  if (!Array.isArray(data)) return [];
  return (data as UserResponse[]).map((u) => {
    const studentInfo = u.studentInfo;
    const accessibilityNeeds = studentInfo?.accessibilityNeeds;
    return {
      name: String(combineFullName(u.firstName, u.lastName) ?? ""),
      email: String(u.email ?? ""),
      accessibilityNeeds: Array.isArray(accessibilityNeeds)
        ? accessibilityNeeds
            .map(({ accommodation }) => accommodation.label)
            .join(", ")
        : (accessibilityNeeds ?? ""),
      additionalComments: String(studentInfo?.notes ?? ""),
    };
  });
}

/** Adapt API user list to DriverRowRaw (drivers only). */
function adaptUsersToDriverRows(data: unknown): DriverRowRaw[] {
  if (!Array.isArray(data)) return [];
  return (data as UserResponse[]).map((u) => ({
    name: String(combineFullName(u.firstName, u.lastName) ?? ""),
    email: String(u.email ?? ""),
  }));
}

/** Adapt API user list to AdminRowRaw (admins and super admins). */
function adaptUsersToAdminRows(data: unknown): AdminRowRaw[] {
  if (!Array.isArray(data)) return [];
  return (data as UserResponse[]).map((u) => ({
    name: String(combineFullName(u.firstName, u.lastName) ?? ""),
    email: String(u.email ?? ""),
    adminType:
      ADMIN_TYPE_LABELS[hasUserType(u, "SuperAdmin") ? "SuperAdmin" : "Admin"],
  }));
}

/** Adapt API location list to LocationRowRaw. */
function adaptLocationsToRows(data: unknown): LocationRowRaw[] {
  if (!Array.isArray(data)) return [];
  return (data as Location[]).map((l) => ({
    name: String(l.name ?? ""),
    latitude: Number(l.latitude ?? 0),
    longitude: Number(l.longitude ?? 0),
  }));
}

/** Adapt API vehicle list to VehicleRowRaw. */
function adaptVehiclesToRows(data: unknown): VehicleRowRaw[] {
  if (!Array.isArray(data)) return [];
  return (data as Vehicle[]).map((v) => {
    const seatCount = Number(v.seatCount);
    return {
      licensePlate: String(v.licensePlate ?? ""),
      makeModel: String(v.description ?? v.name ?? "—"),
      accessibilityFeatures: String(v.accessibility ?? "—"),
      seatCount: Number.isFinite(seatCount) && seatCount >= 0 ? seatCount : 0,
    };
  });
}

export function useAdminTableData(tableType: AdminTableType) {
  const { data: session, status } = useSession();
  const activeType = session?.user?.activeType;
  const [columns, setColumns] =
    useState<ColumnHeaderCellContent[]>(STUDENT_COLUMNS);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowIds, setRowIds] = useState<string[]>([]);
  // Rows that cannot be archived (super admins).
  const [protectedIds, setProtectedIds] = useState<Set<string>>(new Set());
  const [locations, setLocations] = useState<Location[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // A silent refresh keeps the current rows on screen instead of showing the
  // loading state, so real-time updates don't remount the table and map.
  const silentRefreshRef = useRef(false);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useLocationUpdates(
    () => {
      silentRefreshRef.current = true;
      refresh();
    },
    { enabled: tableType === "Locations" && isAdmin(activeType) },
  );

  useEffect(() => {
    if (status === "loading" || !isAdmin(activeType)) return;

    let cancelled = false;
    const silent = silentRefreshRef.current;
    silentRefreshRef.current = false;

    const loadData = async () => {
      if (!silent) {
        setLoading(true);
        setError(null);
        setProtectedIds(new Set());
      }

      const extractIds = (data: unknown): string[] => {
        if (!Array.isArray(data)) return [];
        return data.map((d: Record<string, unknown>) => String(d.id ?? ""));
      };

      const protectSuperAdmins = (data: UserResponse[]) => {
        setProtectedIds(
          new Set(
            data.filter((u) => hasUserType(u, "SuperAdmin")).map((u) => u.id),
          ),
        );
      };

      try {
        if (tableType === "Students") {
          const res = await fetch("/api/users?type=Student");
          if (!res.ok) throw new Error(`API ${res.status}`);
          const data = await res.json();
          if (cancelled) return;

          const ids = extractIds(data);
          const raw = adaptUsersToStudentRows(data);
          protectSuperAdmins(data);
          setColumns(STUDENT_COLUMNS);
          setRows(studentRawToTableRows(raw, ids));
          setRowIds(ids);
          setLoading(false);
        } else if (tableType === "Drivers") {
          const res = await fetch("/api/users?type=Driver");
          if (!res.ok) throw new Error(`API ${res.status}`);
          const data = await res.json();
          if (cancelled) return;

          const ids = extractIds(data);
          const raw = adaptUsersToDriverRows(data);
          protectSuperAdmins(data);
          setColumns(DRIVER_COLUMNS);
          setRows(driverRawToTableRows(raw, ids));
          setRowIds(ids);
          setLoading(false);
        } else if (tableType === "Admins") {
          const responses = await Promise.all([
            fetch("/api/users?type=SuperAdmin"),
            fetch("/api/users?type=Admin"),
          ]);
          const failed = responses.find((r) => !r.ok);
          if (failed) throw new Error(`API ${failed.status}`);
          const users: UserResponse[] = (
            await Promise.all(responses.map((r) => r.json()))
          ).flat();
          const data = [...new Map(users.map((u) => [u.id, u])).values()];
          if (cancelled) return;

          const ids = extractIds(data);
          const raw = adaptUsersToAdminRows(data);
          setColumns(ADMIN_COLUMNS);
          setRows(adminRawToTableRows(raw, ids));
          setRowIds(ids);
          protectSuperAdmins(data);
          setLoading(false);
        } else if (tableType === "Locations") {
          const res = await fetch("/api/locations");
          if (!res.ok) throw new Error(`API ${res.status}`);
          const data = await res.json();
          if (cancelled) return;

          const raw = adaptLocationsToRows(data);
          setColumns(LOCATION_COLUMNS);
          setRows(locationRawToTableRows(raw));
          setRowIds(extractIds(data));
          setLocations(Array.isArray(data) ? (data as Location[]) : []);
          setError(null);
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
        if (silent) return;
        setRows([]);
        setRowIds([]);
        setLoading(false);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [tableType, refreshKey, activeType, status]);

  const deleteRows = async (indices: Set<number>): Promise<number> => {
    if (!isAdmin(activeType)) return 0;
    const endpoint =
      tableType === "Vehicles"
        ? "/api/vehicles"
        : tableType === "Locations"
          ? "/api/locations"
          : "/api/users";
    let deleted = 0;
    for (const idx of indices) {
      const id = rowIds[idx];
      if (!id || protectedIds.has(id)) continue;
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

  return {
    columns,
    rows,
    rowIds,
    protectedIds,
    locations,
    loading,
    error,
    deleteRows,
    refetch: refresh,
  };
}
