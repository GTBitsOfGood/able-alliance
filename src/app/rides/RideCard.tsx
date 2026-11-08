"use client";

import DriverRideActions from "./DriverRideActions";

import { RouteStatus } from "@db/generated/enums";

import {
  canStudentEditRide,
  studentEditDisabledReason,
  isRouteDelayed,
  routeDisplayLabel,
  type DriverRideAction,
  isRideChatOpen,
} from "@/utils/route-status";
import React from "react";
import { withDelay } from "@/utils/dateEst";
import { useWindowSize } from "react-use";
import Link from "next/link";
import BogIcon from "@/components/BogIcon/BogIcon";
import styles from "./styles.module.css";

import type { RouteResponse as RideCardRoute } from "@/types/api";

const CANCELLABLE_STATUSES = new Set<RouteStatus>([
  RouteStatus.Requested,
  RouteStatus.ActionRequiredByAdmin,
  RouteStatus.ActionRequiredByStudent,
  RouteStatus.Scheduled,
  RouteStatus.EnRoute,
  RouteStatus.Arrived,
]);

type RideCardProps = {
  route: RideCardRoute;
  actions?: React.ReactNode;
  isDriverCard?: boolean;
  href?: string;
  onCancel?: (routeId: string) => void;
  cancelling?: boolean;
  onDelay?: (routeId: string) => void;
  delaying?: boolean;
  onDriverAction?: (action: DriverRideAction) => void;
  noShowBusy?: boolean;
  driverActionBusy?: boolean;
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
    case RouteStatus.Scheduled:
      return {
        background: "var(--color-status-yellow)",
        color: "var(--color-grey-text-strong)",
      };
    case RouteStatus.ActionRequiredByStudent:
    case RouteStatus.ActionRequiredByAdmin:
      return { background: "var(--color-status-pink)", color: "#22070b" };
    case RouteStatus.Requested:
      return { background: "#432c30", color: "#ffffff" };
    case RouteStatus.EnRoute:
    case RouteStatus.Arrived:
    case RouteStatus.Pickedup:
      return {
        background: "var(--color-status-yellow)",
        color: "var(--color-grey-text-strong)",
      };
    case RouteStatus.Completed:
      return { background: "#70cd87", color: "#22070b" };
    case RouteStatus.CancelledByStudent:
    case RouteStatus.CancelledByAdmin:
    case RouteStatus.Missing:
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
    case RouteStatus.Completed:
      return "green";
    case RouteStatus.CancelledByStudent:
    case RouteStatus.CancelledByAdmin:
    case RouteStatus.Missing:
      return "red";
    case RouteStatus.EnRoute:
    case RouteStatus.Arrived:
    case RouteStatus.Pickedup:
      return "green";
    case RouteStatus.Requested:
      return "amber";
    case RouteStatus.Scheduled:
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
  onDriverAction,
  driverActionBusy = false,
  noShowBusy = false,
}: RideCardProps) {
  const { width: windowWidth } = useWindowSize();
  const isMobileLayout = windowWidth <= 768;

  const delayMinutes = route.delayMinutes ?? 0;
  const pickupName = route.pickup.name;
  const dropoffName = route.dropoff.name;

  if (isDriverCard) {
    const studentName =
      `${route.student.preferredName || route.student.firstName} ${route.student.lastName}`.trim();

    const canChat = isRideChatOpen(route.status);

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
          {canChat && href ? (
            <Link href={`${href}?chat=1`} className={styles.rideCardDriverChat}>
              <BogIcon name="chats" size={18} />
              Chat with student
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className={styles.rideCardDriverChat}
            >
              <BogIcon name="chats" size={18} />
              Chat with student
            </button>
          )}
          <DriverRideActions
            status={route.status}
            onAction={onDriverAction}
            busy={driverActionBusy}
            missingBusy={noShowBusy}
          />
        </div>
      </div>
    );
  }

  // Student card — Figma design

  const chatEligible = isRideChatOpen(route.status);

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
              <span className={styles.rideDetailsLinkText}>View details</span>
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
            className={`${styles.rideCardActionBtn} ${styles.rideCardActionBtnChat}`}
            style={{ textDecoration: "none", textAlign: "center" }}
          >
            <BogIcon name="chats" size={18} />
            Chat with driver
          </Link>
        ) : (
          <button
            type="button"
            className={`${styles.rideCardActionBtn} ${styles.rideCardActionBtnChat}`}
            disabled
          >
            <BogIcon name="chats" size={18} />
            Chat with driver
          </button>
        )}
        <div className={styles.rideCardStudentSecondaryActions}>
          {canStudentEditRide(route) ? (
            <Link
              href={`/rides/${route.id}/edit`}
              className={`${styles.rideCardActionBtn} ${styles.rideCardActionBtnBrand}`}
            >
              Edit ride
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className={`${styles.rideCardActionBtn} ${styles.rideCardActionBtnBrand} ${styles.rideCardActionBtnDisabled}`}
              title={studentEditDisabledReason(route)}
            >
              Edit ride
            </button>
          )}
          {route.status === RouteStatus.ActionRequiredByStudent && (
            <Link
              href={`/rides/${route.id}/review`}
              className={`${styles.rideCardActionBtn} ${styles.rideCardActionBtnBrand}`}
            >
              Review changes
            </Link>
          )}
          {(route.status === RouteStatus.Scheduled ||
            route.status === RouteStatus.EnRoute) &&
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
