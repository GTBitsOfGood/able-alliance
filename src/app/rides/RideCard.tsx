"use client";

import React from "react";
import BogChip from "@/components/BogChip/BogChip";
import BogButton from "@/components/BogButton/BogButton";
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
  const pickupTime = formatTime(route.scheduledPickupTime);
  const pickupName =
    locationIdToName[route.pickupLocation] ?? route.pickupLocation;
  const dropoffName =
    locationIdToName[route.dropoffLocation] ?? route.dropoffLocation;
  // API only has scheduledPickupTime; show estimated dropoff (+15 min) for display
  const dropoffTimeDisplay = (() => {
    const d = new Date(route.scheduledPickupTime);
    d.setMinutes(d.getMinutes() + 15);
    return formatTime(d.toISOString());
  })();

  return (
    <div className={styles.rideCard}>
      <div className={styles.rideCardPickupDropoff}>
        <div className={styles.rideCardStopBlock}>
          <span className={styles.rideCardStopLabel}>Pickup</span>
          <span className={styles.rideCardStopTime}>{pickupTime}</span>
          <span className={styles.rideCardStopLocation}>{pickupName}</span>
        </div>
        <div className={styles.rideCardDivider} aria-hidden />
        <div className={styles.rideCardStopBlock}>
          <span className={styles.rideCardStopLabel}>Dropoff</span>
          <span className={styles.rideCardStopTime}>{dropoffTimeDisplay}</span>
          <span className={styles.rideCardStopLocation}>{dropoffName}</span>
        </div>
      </div>
      <div className={styles.rideCardFooterRow}>
        <BogChip color={getStatusChipColor(route.status)} size="2">
          {route.status}
        </BogChip>
        <div className={styles.rideCardActions}>
          <button
            type="button"
            className={styles.rideCardCancelLink}
            onClick={() => {}} //TODO route/modals
            aria-label="Cancel ride"
          >
            Cancel ride
          </button>
          <BogButton
            variant="secondary"
            size="medium"
            onClick={() => {}} //TODO route/modals
            className={styles.rideCardEditButton}
          >
            Edit ride
          </BogButton>
        </div>
      </div>
    </div>
  );
}
