"use client";

import { routeStatusLabels } from "@/utils/route-status";
import React from "react";
import { useWindowSize } from "react-use";
import Link from "next/link";
import BogButton from "@/components/BogButton/BogButton";
import BogIcon from "@/components/BogIcon/BogIcon";
import styles from "./styles.module.css";

import type { RouteResponse as RideCardRoute } from "@/utils/types/api";

const CANCELLABLE_STATUSES = new Set(["Requested", "Scheduled"]);

type RideCardProps = {
  route: RideCardRoute;
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

export function getStudentStatusChipStyle(
  status: RideCardRoute["status"],
): React.CSSProperties {
  switch (status) {
    case "Scheduled":
      return { background: "#ffd17f", color: "#22070b" };
    case "Requested":
      return { background: "#432c30", color: "#ffffff" };
    case "EnRoute":
    case "Pickedup":
      return { background: "#ffd17f", color: "#22070b" };
    case "Completed":
      return { background: "#70cd87", color: "#22070b" };
    case "CancelledByStudent":
    case "CancelledByAdmin":
    case "Missing":
      return { background: "#f4a0a0", color: "#22070b" };
    default:
      return { background: "#e0e0e0", color: "#22070b" };
  }
}

function getDriverStatusChipColor(
  status: RideCardRoute["status"],
): "green" | "red" | "amber" | "blue" | "gray" {
  switch (status) {
    case "Completed":
      return "green";
    case "CancelledByStudent":
    case "CancelledByAdmin":
    case "Missing":
      return "red";
    case "EnRoute":
    case "Pickedup":
      return "green";
    case "Requested":
      return "amber";
    case "Scheduled":
      return "gray";
    default:
      return "gray";
  }
}

export function RideCard({
  route,
  isDriverCard = false,
  href,
  onCancel,
  cancelling = false,
  onStart,
  startBusy = false,
}: RideCardProps) {
  const { width: windowWidth } = useWindowSize();
  const isMobileLayout = windowWidth <= 768;

  const pickupName = route.pickup.name;
  const dropoffName = route.dropoff.name;

  if (isDriverCard) {
    const studentName =
      `${route.student.firstName} ${route.student.lastName}`.trim();

    const dropoffTimeDisplay = route.estimatedDropoffTime
      ? formatTime(route.estimatedDropoffTime)
      : "N/A";

    const canStart = route.status === "Scheduled";
    const CHAT_DISABLED_STATUSES = new Set([
      "Pickedup",
      "Completed",
      "Missing",
      "CancelledByStudent",
      "CancelledByAdmin",
    ]);
    const canChat =
      isToday(route.scheduledPickupTime) &&
      !CHAT_DISABLED_STATUSES.has(route.status);

    return (
      <div
        className={`${styles.rideCard} ${styles.rideCardDriverNew}`}
        data-testid="ride-card"
      >
        <div className={styles.rideCardDriverBody}>
          <div className={styles.rideCardDriverInfo}>
            {studentName && (
              <p className={styles.rideCardStudentName}>{studentName}</p>
            )}
            <div className={styles.rideCardPickupDropoffNew}>
              <div className={styles.rideCardStopBlockNew}>
                <span className={styles.rideCardStopLabelNew}>Pickup</span>
                <span className={styles.rideCardStopTime}>
                  {formatTime(route.scheduledPickupTime)}
                </span>
                <span className={styles.rideCardStopLocationNew}>
                  {pickupName}
                </span>
              </div>
              <div className={styles.rideCardHorizontalDivider} aria-hidden />
              <div
                className={`${styles.rideCardStopBlockNew} ${styles.rideCardStopBlockRight}`}
              >
                <span className={styles.rideCardStopLabelNew}>Dropoff</span>
                <span className={styles.rideCardStopTime}>
                  {dropoffTimeDisplay}
                </span>
                <span className={styles.rideCardStopLocationNew}>
                  {dropoffName}
                </span>
              </div>
            </div>
          </div>
          <div className={styles.rideCardBottomRow}>
            <div className={styles.rideCardDriverChipsRow}>
              <span
                className={`${styles.rideCardDriverChip} ${styles[`rideCardDriverChip--${getDriverStatusChipColor(route.status)}`]}`}
              >
                {routeStatusLabels[route.status]}
              </span>
              {route.vehicle && route.vehicle.vehicleId && (
                <span
                  className={`${styles.rideCardDriverChip} ${styles["rideCardDriverChip--vehicle"]}`}
                >
                  Assigned vehicle ID {route.vehicle.vehicleId}
                </span>
              )}
            </div>
            {href ? (
              <Link href={href} className={styles.rideCardDetailsLink}>
                View details
                <BogIcon name="chevron-right" size={20} />
              </Link>
            ) : null}
          </div>
        </div>

        <div className={styles.rideCardDriverDivider} aria-hidden />

        <div className={styles.rideCardDriverButtons}>
          <BogButton
            variant="secondary"
            size="medium"
            onClick={onStart}
            disabled={!canStart || startBusy}
            className={styles.rideCardDriverButton}
          >
            {startBusy ? "Starting…" : "Start ride"}
          </BogButton>
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
          <BogButton
            variant="secondary"
            size="medium"
            style={{
              color: "var(--color-status-red-text)",
              border: "1px solid var(--color-status-red-text)",
              width: "100%",
            }}
            className={styles.rideCardDelayButton}
          >
            Delay ride
          </BogButton>
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
      route.status === "EnRoute" ||
      route.status === "Pickedup");

  const chipStyle = getStudentStatusChipStyle(route.status);
  const canCancel = CANCELLABLE_STATUSES.has(route.status);

  return (
    <div
      className={`${styles.rideCard} ${styles.rideCardStudent}`}
      data-testid="ride-card"
    >
      {/* Left section */}
      <div className={styles.rideCardStudentBody}>
        {isMobileLayout ? (
          <div className={styles.rideCardPickupDropoffStack}>
            <div className={styles.rideCardStopLabelsRow}>
              <span className={styles.rideCardStopLabelNew}>Pickup</span>
              <span className={styles.rideCardStopLabelNew}>Dropoff</span>
            </div>
            <div className={styles.rideCardStopTimesRow}>
              <span className={styles.rideCardStopTime}>
                {formatTime(route.scheduledPickupTime)}
              </span>
              <div className={styles.rideCardHorizontalDivider} aria-hidden />
              <span className={styles.rideCardStopTime}>
                {dropoffTimeDisplay}
              </span>
            </div>
            <div className={styles.rideCardStopLocationsRow}>
              <span className={styles.rideCardStopLocationNew}>
                {pickupName}
              </span>
              <span className={styles.rideCardStopLocationNew}>
                {dropoffName}
              </span>
            </div>
          </div>
        ) : (
          <div className={styles.rideCardPickupDropoffNew}>
            <div className={styles.rideCardStopBlockNew}>
              <span className={styles.rideCardStopLabelNew}>Pickup</span>
              <span className={styles.rideCardStopTime}>
                {formatTime(route.scheduledPickupTime)}
              </span>
              <span className={styles.rideCardStopLocationNew}>
                {pickupName}
              </span>
            </div>
            <div className={styles.rideCardHorizontalDivider} aria-hidden />
            <div
              className={`${styles.rideCardStopBlockNew} ${styles.rideCardStopBlockRight}`}
            >
              <span className={styles.rideCardStopLabelNew}>Dropoff</span>
              <span className={styles.rideCardStopTime}>
                {dropoffTimeDisplay}
              </span>
              <span className={styles.rideCardStopLocationNew}>
                {dropoffName}
              </span>
            </div>
          </div>
        )}

        <div className={styles.rideCardStatusRow}>
          <span className={styles.rideCardStatusChip} style={chipStyle}>
            {routeStatusLabels[route.status]}
          </span>
          {href ? (
            <Link href={href} className={styles.rideDetailsLink}>
              <span className={styles.rideDetailsLinkDesktopText}>
                View details
              </span>
              <span className={styles.rideDetailsLinkMobileText}>
                View details
              </span>
              <BogIcon
                name="chevron-right"
                size={20}
                className={styles.rideDetailsLinkIcon}
              />
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
        <div className={styles.rideCardStudentSecondaryActions}>
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
                onCancel(route.id);
              }}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling…" : "Cancel ride"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
