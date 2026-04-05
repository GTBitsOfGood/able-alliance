"use client";

import React from "react";
import BogChip from "@/components/BogChip/BogChip";
import BogButton from "@/components/BogButton/BogButton";
import BogIcon from "@/components/BogIcon/BogIcon";
import styles from "./styles.module.css";

type RouteUser = {
  _id: string;
  firstName: string;
  lastName: string;
};

export type RideCardRoute = {
  _id: string;
  pickupLocation: string;
  dropoffLocation: string;
  driver?: string | RouteUser;
  scheduledPickupTime: string;
  status: string;
};

const CANCELLABLE_STATUSES = new Set(["Requested", "Scheduled"]);

type RideCardProps = {
  route: RideCardRoute;
  locationIdToName: Record<string, string>;
  actions?: React.ReactNode;
  isDriverCard?: boolean;
  onCancel?: (routeId: string) => void;
  cancelling?: boolean;
};

function formatDriverName(
  driver: string | RouteUser | undefined,
): string | null {
  if (!driver) return null;
  if (typeof driver === "string") return null;
  return `${driver.firstName} ${driver.lastName}`.trim() || null;
}

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

function getDriverStatusPillClass(status: string): string {
  switch (status) {
    case "Completed":
      return `${styles.driverStatusPill} ${styles.driverStatusPillComplete}`;
    case "Cancelled by Driver":
    case "Cancelled by Student":
    case "Cancelled by Admin":
    case "Missing":
      return `${styles.driverStatusPill} ${styles.driverStatusPillFailure}`;
    case "En-route":
    case "Pickedup":
      return `${styles.driverStatusPill} ${styles.driverStatusPillProgress}`;
    default:
      return `${styles.driverStatusPill} ${styles.driverStatusPillNeutral}`;
  }
}

export function RideCard({
  route,
  locationIdToName,
  actions,
  isDriverCard = false,
  onCancel,
  cancelling = false,
}: RideCardProps) {
  const pickupName =
    locationIdToName[route.pickupLocation] ?? route.pickupLocation;
  const dropoffName =
    locationIdToName[route.dropoffLocation] ?? route.dropoffLocation;

  if (isDriverCard) {
    return (
      <div className={`${styles.rideCard} ${styles.rideCardDriver}`}>
        <div className={styles.rideCardHeader}>
          <span className={styles.rideCardTimeValue}>
            {formatTime(route.scheduledPickupTime)}
          </span>
          <span className={getDriverStatusPillClass(route.status)}>
            {route.status}
          </span>
        </div>

        <div className={styles.rideCardBodyWithActions}>
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
                <span className={styles.rideCardRouteName}>{pickupName}</span>
              </div>
              <div className={styles.rideCardStop}>
                <span className={styles.rideCardRouteLabel}>Dropoff</span>
                <span className={styles.rideCardRouteName}>{dropoffName}</span>
              </div>
            </div>
          </div>

          {actions && (
            <div className={styles.rideCardActionsDock}>{actions}</div>
          )}
        </div>
      </div>
    );
  }

  // Student card layout
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
          <span className={styles.rideCardStopTime}>
            {formatTime(route.scheduledPickupTime)}
          </span>
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
        {formatDriverName(route.driver) && (
          <span className={styles.rideCardDriverName}>
            Driver: {formatDriverName(route.driver)}
          </span>
        )}
        <BogChip color={getStatusChipColor(route.status)} size="2">
          {route.status}
        </BogChip>
        <div className={styles.rideCardActions}>
          {CANCELLABLE_STATUSES.has(route.status) && onCancel && (
            <button
              type="button"
              className={styles.rideCardCancelLink}
              onClick={() => onCancel(route._id)}
              disabled={cancelling}
              aria-label="Cancel ride"
            >
              {cancelling ? "Cancelling…" : "Cancel ride"}
            </button>
          )}
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
