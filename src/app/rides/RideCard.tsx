"use client";

import React from "react";
import Link from "next/link";
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
  pickupWindowEnd?: string;
  estimatedDropoffTime?: string;
  status: string;
  student?: string | { firstName: string; lastName: string };
  vehicle?: string | { licensePlate: string };
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

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function isToday(iso: string): boolean {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { timeZone: "America/New_York" });
  return fmt(new Date(iso)) === fmt(new Date());
}

function getStudentStatusChipStyle(status: string): React.CSSProperties {
  switch (status) {
    case "Scheduled":
      return { background: "#ffd17f", color: "#22070b" };
    case "Requested":
      return { background: "#432c30", color: "#ffffff" };
    case "En-route":
    case "Pickedup":
      return { background: "#ffd17f", color: "#22070b" };
    case "Completed":
      return { background: "#70cd87", color: "#22070b" };
    case "Cancelled by Student":
    case "Cancelled by Admin":
    case "Missing":
      return { background: "#f4a0a0", color: "#22070b" };
    default:
      return { background: "#e0e0e0", color: "#22070b" };
  }
}

function getDriverStatusChipColor(
  status: string,
): "green" | "red" | "amber" | "blue" | "gray" {
  switch (status) {
    case "Completed":
      return "green";
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

  if (isDriverCard) {
    const studentName =
      route.student && typeof route.student === "object"
        ? `${route.student.firstName} ${route.student.lastName}`.trim()
        : null;

    const dropoffTimeDisplay = route.estimatedDropoffTime
      ? formatTime(route.estimatedDropoffTime)
      : "N/A";

    const canStart = route.status === "Scheduled";
    const CHAT_DISABLED_STATUSES = new Set([
      "Pickedup",
      "Completed",
      "Missing",
      "Cancelled by Student",
      "Cancelled by Admin",
    ]);
    const canChat =
      isToday(route.scheduledPickupTime) &&
      !CHAT_DISABLED_STATUSES.has(route.status);

    return (
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
            {route.vehicle &&
              typeof route.vehicle === "object" &&
              route.vehicle.licensePlate && (
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
          {href ? (
            <Link href={href} className={styles.rideCardDriverButton}>
              <BogButton
                variant="secondary"
                size="medium"
                className={styles.rideCardDriverButton}
                style={{ width: "100%" }}
              >
                Ride details
              </BogButton>
            </Link>
          ) : (
            <BogButton
              variant="secondary"
              size="medium"
              className={styles.rideCardDriverButton}
            >
              Ride details
            </BogButton>
          )}
          {canChat && href ? (
            <Link href={`${href}?chat=1`}>
              <BogButton
                variant="secondary"
                size="medium"
                className={styles.rideCardDriverButton}
                style={{ width: "100%" }}
              >
                Chat with student
              </BogButton>
            </Link>
          ) : (
            <BogButton
              variant="secondary"
              size="medium"
              disabled={!canChat}
              className={styles.rideCardDriverButton}
            >
              Chat with student
            </BogButton>
          )}
        </div>
      </div>
    );
  }

  // Student card — Figma design
  const dropoffTimeDisplay = route.estimatedDropoffTime
    ? formatTime(route.estimatedDropoffTime)
    : "N/A";

  const chatEligible =
    isToday(route.scheduledPickupTime) &&
    (route.status === "Scheduled" ||
      route.status === "En-route" ||
      route.status === "Pickedup");

  const chipStyle = getStudentStatusChipStyle(route.status);
  const canCancel = CANCELLABLE_STATUSES.has(route.status);

  return (
    <div className={`${styles.rideCard} ${styles.rideCardStudent}`}>
      {/* Left section */}
      <div className={styles.rideCardStudentBody}>
        <div className={styles.rideCardPickupDropoffNew}>
          <div className={styles.rideCardStopBlockNew}>
            <span className={styles.rideCardStopLabelNew}>Pickup</span>
            <span className={styles.rideCardStopTimeNew}>
              {formatTime(route.scheduledPickupTime)}
            </span>
            <span className={styles.rideCardStopLocationNew}>{pickupName}</span>
          </div>
          <div className={styles.rideCardHorizontalDivider} aria-hidden />
          <div
            className={`${styles.rideCardStopBlockNew} ${styles.rideCardStopBlockRight}`}
          >
            <span className={styles.rideCardStopLabelNew}>Dropoff</span>
            <span className={styles.rideCardStopTimeNew}>
              {dropoffTimeDisplay}
            </span>
            <span className={styles.rideCardStopLocationNew}>
              {dropoffName}
            </span>
          </div>
        </div>

        <div className={styles.rideCardStatusRow}>
          <span className={styles.rideCardStatusChip} style={chipStyle}>
            {route.status}
          </span>
          {href ? (
            <Link href={href} className={styles.rideDetailsLink}>
              Ride details
            </Link>
          ) : null}
        </div>
      </div>

      {/* Vertical divider */}
      <div className={styles.rideCardVerticalDivider} aria-hidden />

      {/* Right section — action buttons */}
      <div className={styles.rideCardStudentActions}>
        {chatEligible && href ? (
          <Link
            href={`${href}?chat=1`}
            className={`${styles.rideCardActionBtn} ${styles.rideCardActionBtnBrand}`}
            style={{ textDecoration: "none", textAlign: "center" }}
          >
            Chat with driver
          </Link>
        ) : (
          <button
            type="button"
            className={`${styles.rideCardActionBtn} ${styles.rideCardActionBtnBrand} ${styles.rideCardActionBtnDisabled}`}
            disabled
          >
            Chat with driver
          </button>
        )}
        <button
          type="button"
          className={`${styles.rideCardActionBtn} ${styles.rideCardActionBtnBrand}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          Edit ride
        </button>
        {canCancel && onCancel && (
          <button
            type="button"
            className={`${styles.rideCardActionBtn} ${styles.rideCardActionBtnCancel}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancel(route._id);
            }}
            disabled={cancelling}
          >
            {cancelling ? "Cancelling…" : "Cancel ride"}
          </button>
        )}
      </div>
    </div>
  );
}
