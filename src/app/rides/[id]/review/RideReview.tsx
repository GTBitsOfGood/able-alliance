"use client";

import { RouteStatus } from "@db/generated/enums";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BogButton from "@/components/BogButton/BogButton";
import BogIcon from "@/components/BogIcon/BogIcon";
import { useRouteUpdates } from "@/hooks/useRouteUpdates";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import { formatEstDate, formatEstTime, isEstToday } from "@/utils/dateEst";
import type { RouteResponse } from "@/types/api";
import styles from "./review.module.css";

export default function RideReview({
  routeId,
  admin,
}: {
  routeId: string;
  admin: boolean;
}) {
  const router = useRouter();

  const [route, setRoute] = useState<RouteResponse | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  const pending = useRef(false);

  const beginRequest = useLatestRequest();

  const back = admin ? "/admin/rides" : "/rides";

  const refresh = useCallback(async () => {
    const isLatest = beginRequest();
    try {
      const response = await fetch(`/api/routes/${routeId}`);

      const body = await response.json();

      if (!response.ok) throw new Error(body.error ?? "Unable to load ride");

      if (isLatest()) {
        setRoute(body);

        setError(null);
      }
    } catch (error) {
      if (isLatest())
        setError(
          error instanceof Error ? error.message : "Unable to load ride",
        );
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [routeId, beginRequest]);
  useEffect(() => {
    // This effect starts an asynchronous API request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);
  useRouteUpdates(() => {
    if (!pending.current) void refresh();
  });

  async function decide(action: "accept" | "decline") {
    if (!route || !change || pending.current) return;
    pending.current = true;

    setBusy(action);

    setError(null);
    try {
      const response = await fetch(`/api/routes/${routeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, changeId: change.id }),
      });

      const body = await response.json();

      if (!response.ok)
        throw new Error(body.error ?? "Unable to review changes");
      router.push(back);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to review changes",
      );
    } finally {
      pending.current = false;

      setBusy(null);
    }
  }

  const change = route?.proposedRideChange;

  const awaitingReview =
    !!change &&
    route?.status ===
      (admin
        ? RouteStatus.ActionRequiredByAdmin
        : RouteStatus.ActionRequiredByStudent);

  const time = (value: string | null | undefined) =>
    value ? formatEstTime(new Date(value)) : "N/A";

  const pickup = route
    ? new Date(change?.scheduledPickupTime ?? route.scheduledPickupTime)
    : null;

  return (
    <div className={`${styles.page} ${admin ? styles.admin : ""}`}>
      <Link href={back} className={styles.back}>
        <BogIcon name="arrow-left" size={20} />
        Back to rides
      </Link>
      <h1 className={styles.title}>Review Edit Request</h1>
      {loading && <p role="status">Loading…</p>}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {route && (
        <>
          {route.seriesId && (
            <p className={styles.scopeNotice}>
              This request applies only to this ride. Other rides in the
              recurring schedule will stay unchanged.
            </p>
          )}
          {change && (
            <p className={styles.legend}>
              New values are highlighted. Original values are crossed out.
            </p>
          )}
          <article className={styles.card} aria-label="Ride change details">
            <h2 className={styles.date}>
              {pickup && isEstToday(pickup) ? "Today, " : ""}
              {pickup &&
                formatEstDate(pickup, { month: "long", day: "numeric" })}
            </h2>
            <div className={styles.stops}>
              <div className={styles.stop}>
                <span className={styles.label}>Pickup</span>
                <ReviewValue
                  label="pickup time"
                  original={time(route.scheduledPickupTime)}
                  proposed={time(
                    change?.scheduledPickupTime ?? route.scheduledPickupTime,
                  )}
                  time
                />
                <ReviewValue
                  label="pickup location"
                  original={route.pickup.name}
                  proposed={change?.pickup.name ?? route.pickup.name}
                />
              </div>
              <div className={styles.divider} aria-hidden />
              <div className={`${styles.stop} ${styles.dropoff}`}>
                <span className={styles.label}>Dropoff</span>
                <ReviewValue
                  label="dropoff time"
                  original={time(route.estimatedDropoffTime)}
                  proposed={time(
                    change
                      ? change.estimatedDropoffTime
                      : route.estimatedDropoffTime,
                  )}
                  time
                />
                <ReviewValue
                  label="dropoff location"
                  original={route.dropoff.name}
                  proposed={change?.dropoff.name ?? route.dropoff.name}
                />
              </div>
            </div>
            {!!change &&
              (change.pickupWindowStart !== route.pickupWindowStart ||
                change.pickupWindowEnd !== route.pickupWindowEnd) && (
                <div className={styles.window}>
                  <span>Pickup window</span>
                  <ReviewValue
                    label="pickup window"
                    original={`${time(route.pickupWindowStart)} – ${time(route.pickupWindowEnd)}`}
                    proposed={`${time(change.pickupWindowStart)} – ${time(change.pickupWindowEnd)}`}
                  />
                </div>
              )}
          </article>
          {!awaitingReview && (
            <p role="status">This ride is no longer awaiting your review.</p>
          )}
          {awaitingReview && (
            <footer className={styles.footer}>
              <div className={styles.buttons}>
                <BogButton
                  variant="secondary"
                  size="large"
                  className={styles.decline}
                  disabled={!!busy}
                  onClick={() => void decide("decline")}
                >
                  {busy === "decline" ? "Declining…" : "Decline"}
                </BogButton>
                <BogButton
                  variant="primary"
                  size="large"
                  disabled={!!busy}
                  onClick={() => void decide("accept")}
                >
                  {busy === "accept" ? "Accepting…" : "Accept"}
                </BogButton>
              </div>
              <p className={styles.notice}>
                <BogIcon name="info" size={28} weight="fill" />
                Declining will cancel {admin ? "the student’s" : "your"} ride.
              </p>
            </footer>
          )}
        </>
      )}
    </div>
  );
}

function ReviewValue({
  label,
  original,
  proposed,
  time = false,
}: {
  label: string;
  original: string;
  proposed: string;
  time?: boolean;
}) {
  const changed = original !== proposed;

  return (
    <>
      <span
        className={`${time ? styles.time : ""} ${changed ? styles.changed : ""}`}
      >
        <span className="sr-only">
          {changed ? "Proposed" : "Current"} {label}:{" "}
        </span>
        {proposed}
      </span>
      {changed && (
        <del className={styles.original}>
          <span className="sr-only">Original {label}: </span>
          {original}
        </del>
      )}
    </>
  );
}
