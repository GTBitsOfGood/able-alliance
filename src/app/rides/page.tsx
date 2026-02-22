"use client";

import React, { useState, useEffect, useCallback } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import BogButton from "@/components/BogButton/BogButton";
import BogModal from "@/components/BogModal/BogModal";
import tabStyles from "@/components/BogTabs/styles.module.css";
import { RideCard } from "./RideCard";
import { RequestRideForm } from "./RequestRideForm";
import styles from "./styles.module.css";

type Location = {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
};
type Route = {
  _id: string;
  pickupLocation: string;
  dropoffLocation: string;
  student: string;
  driver?: string;
  vehicle?: string;
  scheduledPickupTime: string;
  isActive: boolean;
};

function formatDateHeader(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  if (isToday) {
    return `Today, ${d.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
  }
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getDateKey(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

export default function RidesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  const fetchRides = useCallback(async () => {
    try {
      const [routesRes, locationsRes] = await Promise.all([
        fetch("/api/routes"),
        fetch("/api/locations"),
      ]);
      if (!routesRes.ok) throw new Error("Failed to fetch routes");
      if (!locationsRes.ok) throw new Error("Failed to fetch locations");
      const routesData = await routesRes.json();
      const locationsData = await locationsRes.json();
      setRoutes(routesData);
      setLocations(locationsData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  const locationIdToName: Record<string, string> = locations.reduce(
    (acc, loc) => {
      acc[loc._id] = loc.name;
      return acc;
    },
    {} as Record<string, string>,
  );

  const routesByDate = React.useMemo(() => {
    const map: Record<string, Route[]> = {};
    for (const route of routes) {
      const key = getDateKey(route.scheduledPickupTime);
      if (!map[key]) map[key] = [];
      map[key].push(route);
    }
    for (const arr of Object.values(map)) {
      arr.sort(
        (a, b) =>
          new Date(a.scheduledPickupTime).getTime() -
          new Date(b.scheduledPickupTime).getTime(),
      );
    }
    return map;
  }, [routes]);

  const dateKeys = Object.keys(routesByDate).sort();

  const rideListContent = (
    <div className={styles.rideList}>
      {routes.length === 0 && !loading && (
        <p className={styles.rideListEmpty}>No rides yet.</p>
      )}
      {dateKeys.map((dateKey) => (
        <div key={dateKey} className={styles.dateGroup}>
          <h2 className={styles.dateHeader}>
            {formatDateHeader(routesByDate[dateKey][0].scheduledPickupTime)}
          </h2>
          {routesByDate[dateKey].map((route) => (
            <RideCard
              key={route._id}
              route={route}
              locationIdToName={locationIdToName}
            />
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div className={styles.ridesPage}>
      <aside className={styles.sidebar}>
        <p className={styles.sidebarLabel}>sidebar</p>
        <nav className={styles.sidebarNav}>
          <a href="/rides" className={styles.sidebarLink}>
            Your Rides
          </a>
        </nav>
      </aside>
      <main className={styles.main}>
        <div className={styles.mainHeader}>
          <h1 className={styles.pageTitle}>Your Rides</h1>
        </div>

        {error && (
          <p className={styles.errorMessage} role="status">
            {error}
          </p>
        )}

        <Tabs.Root defaultValue="this-week" className={styles.tabsLayout}>
          <div className={styles.tabsRow}>
            <Tabs.List
              className={`${tabStyles["bog-tabs-list"]} ${tabStyles["bog-tabs-mobile"]}`}
            >
              <Tabs.Trigger
                value="this-week"
                className={`${tabStyles["bog-tabs-trigger"]} ${tabStyles["bog-tabs-label-wrapper"]}`}
              >
                <div className={tabStyles["bog-tabs-label"]}>This week</div>
              </Tabs.Trigger>
              <Tabs.Trigger
                value="next-week"
                className={`${tabStyles["bog-tabs-trigger"]} ${tabStyles["bog-tabs-label-wrapper"]}`}
              >
                <div className={tabStyles["bog-tabs-label"]}>Next week</div>
              </Tabs.Trigger>
            </Tabs.List>
            <BogModal
              openState={{
                open: requestModalOpen,
                setOpen: setRequestModalOpen,
              }}
              trigger={
                <BogButton
                  variant="primary"
                  size="medium"
                  className={styles.requestRideButton}
                  iconProps={{
                    position: "left",
                    iconProps: { name: "plus", size: 18 },
                  }}
                >
                  Request new ride
                </BogButton>
              }
              title={<h3>Request a ride</h3>}
            >
              <RequestRideForm
                locations={locations}
                onSuccess={() => {
                  setRequestModalOpen(false);
                  fetchRides();
                }}
                onError={setError}
              />
            </BogModal>
          </div>
          <Tabs.Content value="this-week" className={styles.tabContentPanel}>
            {loading ? (
              <p className={styles.rideListLoading}>Loading…</p>
            ) : (
              rideListContent
            )}
          </Tabs.Content>
          <Tabs.Content value="next-week" className={styles.tabContentPanel}>
            {loading ? (
              <p className={styles.rideListLoading}>Loading…</p>
            ) : (
              rideListContent
            )}
          </Tabs.Content>
        </Tabs.Root>
      </main>
    </div>
  );
}
