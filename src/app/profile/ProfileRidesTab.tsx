"use client";

import { routeStatusLabels } from "@/utils/route-status";
import React, { useState, useEffect, useMemo } from "react";
import styles from "./profileRides.module.css";
import { estWeekRange, formatEstTime, formatEstDate } from "@/utils/dateEst";

import type { RouteResponse as Route } from "@/utils/types/api";

type Filter = "all" | "this-week" | "next-week";

function inRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function getWeekRange(offset: 0 | 1): [Date, Date] {
  return estWeekRange(offset);
}

function fmtWeekLabel(start: Date, end: Date): string {
  const s = formatEstDate(start, { month: "short", day: "numeric" });
  const e = formatEstDate(end, { month: "short", day: "numeric" });
  return `Week of ${s} - ${e}`;
}

function fmtTime(iso: string): string {
  return formatEstTime(new Date(iso));
}

function fmtDate(iso: string): string {
  return formatEstDate(new Date(iso), {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function statusChipStyle(status: Route["status"]): React.CSSProperties {
  switch (status) {
    case "Scheduled":
      return {
        background: "var(--color-status-yellow)",
        color: "var(--color-status-yellow-text)",
      };
    case "EnRoute":
    case "Pickedup":
      return {
        background: "var(--color-status-yellow)",
        color: "var(--color-status-yellow-text)",
      };
    case "Completed":
      return {
        background: "var(--color-status-green)",
        color: "var(--color-status-green-text)",
      };
    case "Requested":
      return {
        background: "var(--color-admin-bg)",
        color: "var(--color-grey-text-strong)",
      };
    case "CancelledByStudent":
    case "CancelledByAdmin":
      return {
        background: "var(--color-status-yellow)",
        color: "var(--color-status-yellow-text)",
      };
    case "Missing":
      return {
        background: "var(--color-status-pink)",
        color: "var(--color-grey-text-strong)",
      };
    default:
      return {
        background: "var(--color-status-grey)",
        color: "var(--color-grey-text-strong)",
      };
  }
}

export function ProfileRidesTab({
  userId,
  userType,
}: {
  userId: string;
  userType: "Student" | "Driver" | "Vehicle";
}) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(
    userType === "Vehicle" ? "this-week" : "all",
  );

  useEffect(() => {
    const param =
      userType === "Driver"
        ? `driver=${userId}`
        : userType === "Vehicle"
          ? `vehicle=${userId}`
          : `student=${userId}`;
    fetch(`/api/routes?${param}`)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load rides.");
        return response.json();
      })
      .then((routesData: Route[]) => setRoutes(routesData))
      .catch(() => setError("Failed to load rides."))
      .finally(() => setLoading(false));
  }, [userId, userType]);

  const filtered = useMemo(() => {
    if (filter === "all") return routes;
    const offset = filter === "this-week" ? 0 : 1;
    const [s, e] = getWeekRange(offset);
    return routes.filter((r) => inRange(r.scheduledPickupTime, s, e));
  }, [routes, filter]);

  const [thisWeekStart, thisWeekEnd] = getWeekRange(0);
  const [nextWeekStart, nextWeekEnd] = getWeekRange(1);
  const weekLabel =
    filter === "this-week"
      ? fmtWeekLabel(thisWeekStart, thisWeekEnd)
      : fmtWeekLabel(nextWeekStart, nextWeekEnd);

  return (
    <div className={styles.container}>
      {/* Filter tabs */}
      {userType === "Vehicle" ? (
        <>
          <div className={styles.tabRow}>
            <button
              type="button"
              className={`${styles.tabBtn} ${filter === "this-week" ? styles.tabBtnActive : ""}`}
              onClick={() => setFilter("this-week")}
            >
              This week
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${filter === "next-week" ? styles.tabBtnActive : ""}`}
              onClick={() => setFilter("next-week")}
            >
              Next week
            </button>
          </div>
          <span className={styles.weekLabel}>{weekLabel}</span>
        </>
      ) : (
        <div className={styles.filterRow}>
          <button
            type="button"
            className={`${styles.filterBtn} ${filter === "all" ? styles.filterBtnActive : styles.filterBtnOutline}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${filter === "this-week" ? styles.filterBtnActive : styles.filterBtnOutline}`}
            onClick={() => setFilter("this-week")}
          >
            This week
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${filter === "next-week" ? styles.filterBtnActive : styles.filterBtnOutline}`}
            onClick={() => setFilter("next-week")}
          >
            Next week
          </button>
        </div>
      )}

      {loading && <p className={styles.stateMsg}>Loading…</p>}
      {error && <p className={styles.errorMsg}>{error}</p>}

      {!loading && !error && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.headerRow}>
                {userType === "Vehicle" ? (
                  <th className={styles.th}>Student</th>
                ) : userType === "Driver" ? (
                  <th className={styles.th}>Student</th>
                ) : (
                  <th className={styles.th}>Driver</th>
                )}
                {userType === "Vehicle" ? (
                  <th className={styles.th}>Driver</th>
                ) : (
                  <th className={styles.th}>Vehicle ID</th>
                )}
                <th className={styles.th}>Date</th>
                <th className={styles.th}>Pickup</th>
                <th className={styles.th}>Dropoff</th>
                <th className={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    No rides found.
                  </td>
                </tr>
              ) : (
                filtered.map((route) => {
                  const col1 =
                    userType === "Student"
                      ? route.driver
                        ? `${route.driver.firstName} ${route.driver.lastName}`.trim()
                        : "—"
                      : `${route.student.firstName} ${route.student.lastName}`.trim();
                  const col2 =
                    userType === "Vehicle"
                      ? route.driver
                        ? `${route.driver.firstName} ${route.driver.lastName}`.trim()
                        : "—"
                      : (route.vehicle?.vehicleId ?? "—");
                  const pickup = `${fmtTime(route.scheduledPickupTime)} @ ${route.pickup.name}`;
                  const dropoff = route.estimatedDropoffTime
                    ? `${fmtTime(route.estimatedDropoffTime)} @ ${route.dropoff.name}`
                    : `— @ ${route.dropoff.name}`;
                  return (
                    <tr key={route.id} className={styles.row}>
                      <td className={styles.td}>{col1}</td>
                      <td className={styles.td}>{col2}</td>
                      <td className={styles.td}>
                        {fmtDate(route.scheduledPickupTime)}
                      </td>
                      <td className={styles.td}>{pickup}</td>
                      <td className={styles.td}>{dropoff}</td>
                      <td className={styles.td}>
                        <span
                          className={styles.statusChip}
                          style={statusChipStyle(route.status)}
                        >
                          {routeStatusLabels[route.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
