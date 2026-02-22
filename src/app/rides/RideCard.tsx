"use client";

import React from "react";
import BogChip from "@/components/BogChip/BogChip";
import BogIcon from "@/components/BogIcon/BogIcon";
import styles from "./styles.module.css";

export type RideCardRoute = {
  _id: string;
  pickupLocation: string;
  dropoffLocation: string;
  driver?: string;
  scheduledPickupTime: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getStatus(route: RideCardRoute): string {
  return route.driver ? "Scheduled" : "Requested";
}

export function RideCard({
  route,
  locationIdToName,
}: {
  route: RideCardRoute;
  locationIdToName: Record<string, string>;
}) {
  return (
    <div className={styles.rideCard}>
      <div className={styles.rideCardHeader}>
        <span className={styles.rideCardTimeValue}>
          {formatTime(route.scheduledPickupTime)}
        </span>
      </div>
      <div className={styles.rideCardRoute}>
        <div className={styles.rideCardRouteIconColumn} aria-hidden>
          <span className={styles.rideCardRouteIcon} />
          <div className={styles.rideCardRouteLine} />
          <BogIcon
            name="map-pin"
            size={14}
            className={styles.rideCardRouteIconDropoff}
          />
        </div>
        <div className={styles.rideCardRouteStops}>
          <div className={styles.rideCardStop}>
            <span className={styles.rideCardRouteLabel}>Pickup</span>
            <span className={styles.rideCardRouteName}>
              {locationIdToName[route.pickupLocation] ?? route.pickupLocation}
            </span>
          </div>
          <div className={styles.rideCardStop}>
            <span className={styles.rideCardRouteLabel}>Dropoff</span>
            <span className={styles.rideCardRouteName}>
              {locationIdToName[route.dropoffLocation] ?? route.dropoffLocation}
            </span>
          </div>
        </div>
      </div>
      <div className={styles.rideCardFooter}>
        <BogChip color="gray" size="2">
          {getStatus(route)}
        </BogChip>
      </div>
    </div>
  );
}
