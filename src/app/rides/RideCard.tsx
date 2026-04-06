"use client";

import React from "react";
import Link from "next/link";
import BogChip from "@/components/BogChip/BogChip";
import BogButton from "@/components/BogButton/BogButton";
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
  student?: { firstName: string; lastName: string };
  vehicle?: { licensePlate: string };
};

const CANCELLABLE_STATUSES = new Set(["Requested", "Scheduled"]);

type RideCardProps = {
  route: RideCardRoute;
  locationIdToName: Record<string, string>;
  actions?: React.ReactNode;
  isDriverCard?: boolean;
  href?: string;
  onCancel?: (routeId: string) => void;
  cancelling?: boolean;
  onStart?: () => void;
  startBusy?: boolean;
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

function getDriverStatusChipColor(
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
    case "En-route":
    case "Pickedup":
      return "green";
    case "Requested":
    case "Scheduled":
      return "amber";
    default:
      return "gray";
  }
}

export function RideCard({
  route,
  locationIdToName,
  actions,
  isDriverCard = false,
  href,
  onCancel,
  cancelling = false,
  onStart,
  startBusy = false,
}: RideCardProps) {
  const pickupName =
    locationIdToName[route.pickupLocation] ?? route.pickupLocation;
  const dropoffName =
    locationIdToName[route.dropoffLocation] ?? route.dropoffLocation;

  let cardContent: React.ReactNode;

  if (isDriverCard) {
    const studentName = route.student
      ? `${route.student.firstName} ${route.student.lastName}`.trim()
      : null;

    const dropoffTimeDisplay = (() => {
      const d = new Date(route.scheduledPickupTime);
      d.setMinutes(d.getMinutes() + 15);
      return formatTime(d.toISOString());
    })();

    const canStart = route.status === "Scheduled";

    cardContent = (
      <div className={`${styles.rideCard} ${styles.rideCardDriverNew}`}>
        <div className={styles.rideCardDriverBody}>
          {studentName && (
            <p className={styles.rideCardStudentName}>{studentName}</p>
          )}
          <div className={styles.rideCardPickupDropoff}>
            <div className={styles.rideCardStopBlock}>
              <span className={styles.rideCardStopLabel}>Pickup</span>
              <span className={styles.rideCardStopTime}>
                {formatTime(route.scheduledPickupTime)}
              </span>
              <span className={styles.rideCardStopLocation}>{pickupName}</span>
            </div>
            <div className={styles.rideCardDivider} aria-hidden />
            <div
              className={`${styles.rideCardStopBlock} ${styles.rideCardStopBlockRight}`}
            >
              <span className={styles.rideCardStopLabel}>Dropoff</span>
              <span className={styles.rideCardStopTime}>
                {dropoffTimeDisplay}
              </span>
              <span className={styles.rideCardStopLocation}>{dropoffName}</span>
            </div>
          </div>
          <div className={styles.rideCardDriverChipsRow}>
            <span
              className={`${styles.rideCardDriverChip} ${styles[`rideCardDriverChip--${getDriverStatusChipColor(route.status)}`]}`}
            >
              {route.status}
            </span>
            {route.vehicle?.licensePlate && (
              <span
                className={`${styles.rideCardDriverChip} ${styles["rideCardDriverChip--vehicle"]}`}
              >
                Assigned vehicle ID {route.vehicle.licensePlate}
              </span>
            )}
          </div>
        </div>

        <div className={styles.rideCardDriverDivider} aria-hidden />

        <div className={styles.rideCardDriverButtons}>
          <BogButton
            variant="primary"
            size="medium"
            onClick={onStart}
            disabled={!canStart || startBusy}
            className={styles.rideCardDriverButton}
          >
            {startBusy ? "Starting…" : "Start ride"}
          </BogButton>
          <BogButton
            variant="secondary"
            size="medium"
            className={styles.rideCardDriverButton}
          >
            Ride details
          </BogButton>
          <BogButton
            variant="secondary"
            size="medium"
            className={styles.rideCardDriverButton}
          >
            Chat with student
          </BogButton>
        </div>
      </div>
    );
  } else {
    // Student card layout
    const dropoffTimeDisplay = (() => {
      const d = new Date(route.scheduledPickupTime);
      d.setMinutes(d.getMinutes() + 15);
      return formatTime(d.toISOString());
    })();

    cardContent = (
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
            <span className={styles.rideCardStopTime}>
              {dropoffTimeDisplay}
            </span>
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCancel(route._id);
                }}
                disabled={cancelling}
                aria-label="Cancel ride"
              >
                {cancelling ? "Cancelling…" : "Cancel ride"}
              </button>
            )}
            <BogButton
              variant="secondary"
              size="medium"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }} //TODO route/modals
              className={styles.rideCardEditButton}
            >
              Edit ride
            </BogButton>
          </div>
        </div>
      </div>
    );
  }

  if (href) {
    return <Link href={href}>{cardContent}</Link>;
  }

  return cardContent;
}
