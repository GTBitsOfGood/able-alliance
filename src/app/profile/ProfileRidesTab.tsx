"use client";

import React, { useState, useEffect, useMemo } from "react";
import styles from "./profileRides.module.css";

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

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}

function inRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function getWeekRange(offset: 0 | 1): [Date, Date] {
  const s = startOfWeek(new Date());
  s.setDate(s.getDate() + offset * 7);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return [s, e];
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
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
  userType: "Student" | "Driver";
}) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [locations, setLocations] = useState<LocationMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const param =
      userType === "Driver" ? `driver=${userId}` : `student=${userId}`;
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

  return (
    <div className={styles.container}>
      {/* Filter tabs */}
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

      {loading && <p className={styles.stateMsg}>Loading…</p>}
      {error && <p className={styles.errorMsg}>{error}</p>}

      {!loading && !error && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.headerRow}>
                {userType === "Driver" ? (
                  <th className={styles.th}>Student</th>
                ) : (
                  <th className={styles.th}>Driver</th>
                )}
                <th className={styles.th}>Vehicle ID</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Date</th>
                <th className={styles.th}>Pickup</th>
                <th className={styles.th}>Dropoff</th>
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
                  const person =
                    userType === "Driver" ? route.student : route.driver;
                  const personName = person
                    ? `${person.firstName} ${person.lastName}`.trim()
                    : "—";
                  const vehicleId = route.vehicle?.vehicleId ?? "—";
                  const pickup = `${fmtTime(route.scheduledPickupTime)} @ ${locName(route.pickupLocation)}`;
                  const dropoff = route.estimatedDropoffTime
                    ? `${fmtTime(route.estimatedDropoffTime)} @ ${locName(route.dropoffLocation)}`
                    : `— @ ${locName(route.dropoffLocation)}`;
                  return (
                    <tr key={route._id} className={styles.row}>
                      <td className={styles.td}>{personName}</td>
                      <td className={styles.td}>{vehicleId}</td>
                      <td className={styles.td}>
                        <span
                          className={styles.statusChip}
                          style={statusChipStyle(route.status)}
                        >
                          {route.status}
                        </span>
                      </td>
                      <td className={styles.td}>
                        {fmtDate(route.scheduledPickupTime)}
                      </td>
                      <td className={styles.td}>{pickup}</td>
                      <td className={styles.td}>{dropoff}</td>
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
