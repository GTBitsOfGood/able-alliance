"use client";

import React, { useState, useEffect, useMemo } from "react";
import styles from "./profileRides.module.css";
import { estWeekRange, formatEstTime, formatEstDate } from "@/utils/dateEst";

type RouteUser = {
  _id: string;
  firstName: string;
  lastName: string;
};

type RouteVehicle = {
  vehicleId?: string;
  name?: string;
  licensePlate?: string;
};

type Route = {
  _id: string;
  pickupLocation: string;
  dropoffLocation: string;
  student: RouteUser;
  driver?: RouteUser;
  vehicle?: RouteVehicle;
  scheduledPickupTime: string;
  estimatedDropoffTime?: string;
  status: string;
};

type LocationMap = Record<string, string>;

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

function statusChipStyle(status: string): React.CSSProperties {
  switch (status) {
    case "Scheduled":
      return { background: "#ffd17f", color: "#22070b" };
    case "En-route":
    case "Pickedup":
      return { background: "#ffd17f", color: "#22070b" };
    case "Completed":
      return { background: "#bbf7d0", color: "#14532d" };
    case "Requested":
      return { background: "#a7d0ed", color: "#22070b" };
    case "Cancelled by Student":
    case "Cancelled by Admin":
    case "Missing":
      return { background: "#f4a0a0", color: "#22070b" };
    default:
      return { background: "#efeded", color: "#22070b" };
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
  const [locations, setLocations] = useState<LocationMap>({});
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
    Promise.all([
      fetch(`/api/routes?${param}`).then((r) => r.json()),
      fetch("/api/locations").then((r) => r.json()),
    ])
      .then(([routesData, locData]) => {
        setRoutes(Array.isArray(routesData) ? routesData : []);
        const map: LocationMap = {};
        if (Array.isArray(locData)) {
          for (const l of locData) map[l._id] = l.name;
        }
        setLocations(map);
      })
      .catch(() => setError("Failed to load rides."))
      .finally(() => setLoading(false));
  }, [userId, userType]);

  const filtered = useMemo(() => {
    if (filter === "all") return routes;
    const offset = filter === "this-week" ? 0 : 1;
    const [s, e] = getWeekRange(offset);
    return routes.filter((r) => inRange(r.scheduledPickupTime, s, e));
  }, [routes, filter]);

  const locName = (id: string) => locations[id] ?? id;

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
                  const pickup = `${fmtTime(route.scheduledPickupTime)} @ ${locName(route.pickupLocation)}`;
                  const dropoff = route.estimatedDropoffTime
                    ? `${fmtTime(route.estimatedDropoffTime)} @ ${locName(route.dropoffLocation)}`
                    : `— @ ${locName(route.dropoffLocation)}`;
                  return (
                    <tr key={route._id} className={styles.row}>
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
                          {route.status}
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
