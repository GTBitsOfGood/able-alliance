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
  status: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getStatusChipColor(
  status: string,
): "green" | "red" | "amber" | "blue" | "gray" {
  switch (status) {
    case "Completed":
      return "green";
    case "Cancelled by Driver":
    case "Cancelled by Student":
    case "Cancelled by Admin":
    case "Missing":
      return "red";
    case "Requested":
    case "Scheduled":
      return "blue";
    case "En-route":
    case "Pickedup":
      return "amber";
    default:
      return "gray";
  }
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
        <BogChip color={getStatusChipColor(route.status)} size="2">
          {route.status}
        </BogChip>
      </div>
    </div>
  );
}
