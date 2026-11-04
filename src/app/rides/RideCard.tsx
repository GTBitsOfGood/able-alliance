"use client";

import { isRouteDelayed, routeDisplayLabel } from "@/utils/route-status";
import React from "react";
import { withDelay } from "@/utils/dateEst";
import { useWindowSize } from "react-use";
import Link from "next/link";
import BogButton from "@/components/BogButton/BogButton";
import BogIcon from "@/components/BogIcon/BogIcon";
import styles from "./styles.module.css";

import type { RouteResponse as RideCardRoute } from "@/utils/types/api";

const CANCELLABLE_STATUSES = new Set(["Requested", "Scheduled", "EnRoute"]);

type RideCardProps = {
  route: RideCardRoute;
  actions?: React.ReactNode;
  isDriverCard?: boolean;
  href?: string;
  onCancel?: (routeId: string) => void;
  cancelling?: boolean;
  onDelay?: (routeId: string) => void;
  delaying?: boolean;
  onStart?: () => void;
  startBusy?: boolean;
};

function formatTime(iso: string, delayMinutes = 0): string {
  const d = withDelay(new Date(iso), delayMinutes);
  return d.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function CardTime({
  iso,
  delayMinutes,
}: {
  iso: string | null;
  delayMinutes: number;
}) {
  return (
    <span className={styles.rideCardTimeStack}>
      <span
        className={`${styles.rideCardStopTime} ${iso && delayMinutes > 0 ? styles.rideCardTimeDelayed : ""}`}
      >
        {iso ? formatTime(iso, delayMinutes) : "N/A"}
      </span>
      {iso && delayMinutes > 0 && (
        <span className={styles.rideCardTimeOriginal}>
          <span className="sr-only">Originally </span>
          {formatTime(iso)}
        </span>
      )}
    </span>
  );
}

function isToday(iso: string): boolean {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { timeZone: "America/New_York" });
  return fmt(new Date(iso)) === fmt(new Date());
}

export function getStudentStatusChipStyle(
  status: RideCardRoute["status"],
  delayed = false,
): React.CSSProperties {
  if (delayed) {
    return {
      background: "var(--color-status-yellow)",
      color: "var(--color-grey-text-strong)",
    };
  }
  switch (status) {
    case "Scheduled":
      return {
        background: "var(--color-status-yellow)",
        color: "var(--color-grey-text-strong)",
      };
    case "Requested":
      return { background: "#432c30", color: "#ffffff" };
    case "EnRoute":
    case "Pickedup":
      return {
        background: "var(--color-status-yellow)",
        color: "var(--color-grey-text-strong)",
      };
    case "Completed":
      return { background: "#70cd87", color: "#22070b" };
    case "CancelledByStudent":
    case "CancelledByAdmin":
    case "Missing":
      return { background: "var(--color-status-pink)", color: "#22070b" };
    default:
      return { background: "#e0e0e0", color: "#22070b" };
  }
}

function getDriverStatusChipColor(
  status: RideCardRoute["status"],
  delayed = false,
): "green" | "red" | "amber" | "blue" | "gray" {
  if (delayed) {
    return "amber";
  }
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
  onDelay,
  delaying = false,
  onStart,
  startBusy = false,
}: RideCardProps) {
  const { width: windowWidth } = useWindowSize();
  const isMobileLayout = windowWidth <= 768;

  const delayMinutes = route.delayMinutes ?? 0;
  const pickupName = route.pickup.name;
  const dropoffName = route.dropoff.name;

  if (isDriverCard) {
    const studentName =
      `${route.student.preferredName || route.student.firstName} ${route.student.lastName}`.trim();

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
                <CardTime
                  iso={route.scheduledPickupTime}
                  delayMinutes={delayMinutes}
                />
                <span className={styles.rideCardStopLocationNew}>
                  {pickupName}
                </span>
              </div>
              <div className={styles.rideCardHorizontalDivider} aria-hidden />
              <div
                className={`${styles.rideCardStopBlockNew} ${styles.rideCardStopBlockRight}`}
              >
                <span className={styles.rideCardStopLabelNew}>Dropoff</span>
                <CardTime
                  iso={route.estimatedDropoffTime}
                  delayMinutes={delayMinutes}
                />
                <span className={styles.rideCardStopLocationNew}>
                  {dropoffName}
                </span>
              </div>
            </div>
          </div>
          <div className={styles.rideCardBottomRow}>
            <div className={styles.rideCardDriverChipsRow}>
              <span
                className={`${styles.rideCardDriverChip} ${styles[`rideCardDriverChip--${getDriverStatusChipColor(route.status, isRouteDelayed(route))}`]}`}
              >
                {routeDisplayLabel(route)}
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
        </div>
      </div>
    );
  }

  // Student card — Figma design

  const chatEligible =
    isToday(route.scheduledPickupTime) &&
    (route.status === "Scheduled" ||
      route.status === "EnRoute" ||
      route.status === "Pickedup");

  const chipStyle = getStudentStatusChipStyle(
    route.status,
    isRouteDelayed(route),
  );
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
              <CardTime
                iso={route.scheduledPickupTime}
                delayMinutes={delayMinutes}
              />
              <div className={styles.rideCardHorizontalDivider} aria-hidden />
              <CardTime
                iso={route.estimatedDropoffTime}
                delayMinutes={delayMinutes}
              />
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
              <CardTime
                iso={route.scheduledPickupTime}
                delayMinutes={delayMinutes}
              />
              <span className={styles.rideCardStopLocationNew}>
                {pickupName}
              </span>
            </div>
            <div className={styles.rideCardHorizontalDivider} aria-hidden />
            <div
              className={`${styles.rideCardStopBlockNew} ${styles.rideCardStopBlockRight}`}
            >
              <span className={styles.rideCardStopLabelNew}>Dropoff</span>
              <CardTime
                iso={route.estimatedDropoffTime}
                delayMinutes={delayMinutes}
              />
              <span className={styles.rideCardStopLocationNew}>
                {dropoffName}
              </span>
            </div>
          </div>
        )}

        <div className={styles.rideCardStatusRow}>
          <span className={styles.rideCardStatusChip} style={chipStyle}>
            {routeDisplayLabel(route)}
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
          {(route.status === "Scheduled" || route.status === "EnRoute") &&
            onDelay && (
              <button
                type="button"
                className={`${styles.rideCardActionBtn} ${styles.rideCardActionBtnCancel}`}
                onClick={() => onDelay(route.id)}
                disabled={delaying || cancelling}
              >
                {delaying ? "Delaying…" : "Delay ride"}
              </button>
            )}
          {canCancel && onCancel && (
            <button
              type="button"
              className={`${styles.rideCardActionBtn} ${styles.rideCardActionBtnCancel}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancel(route.id);
              }}
              disabled={cancelling || delaying}
            >
              {cancelling ? "Cancelling…" : "Cancel ride"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
