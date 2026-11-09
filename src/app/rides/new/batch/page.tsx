"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fromZonedTime } from "date-fns-tz";
import { estDateKey, estNowWallClock } from "@/utils/dateEst";
import { useRouter } from "next/navigation";
import type { Location } from "@db/generated/browser";
import { SERVICE_END_TIME, SERVICE_START_TIME } from "@/utils/consts";
import { TimeInput } from "@/components/TimeInput/TimeInput";
import styles from "./styles.module.css";
import RecurrenceFields from "@/components/RecurrenceFields/RecurrenceFields";
import BogSwitch from "@/components/BogSwitch/BogSwitch";
import BogButton from "@/components/BogButton/BogButton";
import { SearchableSelect } from "@/components/SearchableSelect/SearchableSelect";
import {
  getEarliestPickupTime,
  getPickupWindowBounds,
  getRideTimingError,
} from "@/utils/rideTiming";
import type { RecurrenceFrequency } from "@/schemas/rideSeries";

type RideDraft = {
  date: string;
  pickupTime: string;
  windowFrom: string;
  windowTo: string;
  pickup: string;
  dropoff: string;
  recurring: boolean;
  frequency: RecurrenceFrequency;
  repeatsOn: number[];
  ends: string;
};

function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// Ride dates are New York days (see toEstUtc), so "today" follows the
// New York clock, not the browser's.
function todayKey(): string {
  return estDateKey(new Date());
}

// Today, or the following Monday if today is a weekend.
function defaultRideDate(): string {
  const date = estNowWallClock();
  while (
    date.getDay() === 0 ||
    date.getDay() === 6 ||
    !getEarliestPickupTime(date)
  ) {
    date.setDate(date.getDate() + 1);
  }
  return toDateKey(date);
}

const newRide = (): RideDraft => ({
  date: defaultRideDate(),
  pickupTime: "",
  windowFrom: "",
  windowTo: "",
  pickup: "",
  dropoff: "",
  recurring: false,
  frequency: "weekly",
  repeatsOn: [],
  ends: "",
});

function toEstUtc(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return fromZonedTime(
    new Date(year, month - 1, day, hours, minutes, 0),
    "America/New_York",
  );
}

function weekdayOf(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

function isWeekday(date: string) {
  const weekday = weekdayOf(date);
  return weekday >= 1 && weekday <= 5;
}

export default function BatchRidePage() {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [rides, setRides] = useState<RideDraft[]>([newRide()]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const locationOptions = locations
    .map(({ name }) => ({ value: name, label: name }))
    .toSorted((a, b) => a.label.localeCompare(b.label));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/locations")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load locations.");
        return (await response.json()) as Location[];
      })
      .then((data) => {
        setLocations(data);
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load locations.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
      errorRef.current?.scrollIntoView({ block: "center" });
    }
  }, [error]);

  function updateRide(index: number, patch: Partial<RideDraft>) {
    setRides((current) =>
      current.map((ride, rideIndex) => {
        if (rideIndex !== index) return ride;
        const next = { ...ride, ...patch };
        if (
          patch.date &&
          ride.repeatsOn.length === 1 &&
          ride.repeatsOn[0] === weekdayOf(ride.date)
        ) {
          next.repeatsOn = [weekdayOf(patch.date)];
        }
        if (patch.recurring && !next.repeatsOn.length)
          next.repeatsOn = [weekdayOf(next.date)];
        if (patch.date && next.pickupTime) {
          const [y, m, d] = patch.date.split("-").map(Number);
          const earliest = getEarliestPickupTime(new Date(y, m - 1, d));
          if (earliest && next.pickupTime < earliest)
            next.pickupTime = earliest;
        }
        if (next.pickupTime !== ride.pickupTime) {
          const bounds = getPickupWindowBounds(next.pickupTime);
          next.windowFrom = bounds.from;
          next.windowTo = bounds.to;
        }
        return next;
      }),
    );
  }

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    for (const [index, ride] of rides.entries()) {
      if (
        !ride.date ||
        !ride.pickup ||
        !ride.dropoff ||
        !ride.pickupTime ||
        !ride.windowFrom ||
        !ride.windowTo
      ) {
        setError(`Please complete Ride #${index + 1}.`);
        return;
      }
      if (!isWeekday(ride.date)) {
        setError(`Ride #${index + 1} must be scheduled Monday through Friday.`);
        return;
      }
      if (ride.date < todayKey()) {
        setError(`Ride #${index + 1} cannot be scheduled in the past.`);
        return;
      }
      if (ride.pickup === ride.dropoff) {
        setError(
          `Ride #${index + 1} must have different pickup and drop-off locations.`,
        );
        return;
      }
      const start = toEstUtc(ride.date, ride.windowFrom);
      const end = toEstUtc(ride.date, ride.windowTo);
      const pickup = toEstUtc(ride.date, ride.pickupTime);
      const timingError = getRideTimingError({
        scheduledPickupTime: pickup,
        pickupWindowStart: start,
        pickupWindowEnd: end,
      });
      if (timingError) {
        setError(`Ride #${index + 1}: ${timingError}`);
        return;
      }
      if (ride.recurring) {
        if (!ride.repeatsOn.includes(weekdayOf(ride.date))) {
          setError(
            `Ride #${index + 1} must repeat on the day of its first ride.`,
          );
          return;
        }
        if (ride.ends && ride.ends < ride.date) {
          setError(`Ride #${index + 1} must end on or after its first ride.`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rides: rides.map((ride) => {
            const pickup = toEstUtc(ride.date, ride.pickupTime);
            return {
              pickupLocation: locations.find(
                (location) => location.name === ride.pickup,
              )?.id,
              dropoffLocation: locations.find(
                (location) => location.name === ride.dropoff,
              )?.id,
              scheduledPickupTime: pickup.toISOString(),
              pickupWindowStart: toEstUtc(
                ride.date,
                ride.windowFrom,
              ).toISOString(),
              pickupWindowEnd: toEstUtc(ride.date, ride.windowTo).toISOString(),
              ...(ride.recurring
                ? {
                    recurring: {
                      frequency: ride.frequency,
                      daysOfWeek: ride.repeatsOn,
                      ...(ride.ends ? { endsOn: ride.ends } : {}),
                    },
                  }
                : {}),
            };
          }),
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Failed to request rides.");
      }
      router.push("/rides");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Failed to request rides.",
      );
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <main className={styles.main}>
        <p>Loading...</p>
      </main>
    );

  return (
    <div className={styles.container}>
      {error && (
        <div
          ref={errorRef}
          tabIndex={-1}
          className={styles.errorBanner}
          role="alert"
        >
          {error}
        </div>
      )}
      <main className={styles.main}>
        <Link href="/rides" className={styles.backButton}>
          ← Back to rides
        </Link>
        <h1 className={styles.pageTitle}>Request Multiple Rides</h1>
        <form onSubmit={submit}>
          <div className={styles.cards}>
            {rides.map((ride, index) => {
              const bounds = getPickupWindowBounds(ride.pickupTime);
              const [year, month, day] = ride.date.split("-").map(Number);
              const earliest = getEarliestPickupTime(
                new Date(year, month - 1, day),
              );
              return (
                <section className={styles.card} key={index}>
                  <div className={styles.cardHeader}>
                    <h2>Ride #{index + 1}</h2>
                    {rides.length > 1 && (
                      <BogButton
                        type="button"
                        className={styles.removeButton}
                        onClick={() =>
                          setRides((current) =>
                            current.filter(
                              (_, rideIndex) => rideIndex !== index,
                            ),
                          )
                        }
                      >
                        Remove
                      </BogButton>
                    )}
                  </div>
                  <div className={styles.fields}>
                    <label>
                      Ride Date
                      <input
                        type="date"
                        value={ride.date}
                        min={todayKey()}
                        onChange={(event) =>
                          updateRide(index, { date: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Pickup Time
                      <TimeInput
                        value={ride.pickupTime}
                        onChange={(value) =>
                          updateRide(index, { pickupTime: value })
                        }
                        min={earliest ?? SERVICE_END_TIME}
                        max={SERVICE_END_TIME}
                        disabled={!earliest}
                        aria-label={`Ride ${index + 1} pickup time`}
                      />
                    </label>
                    <label className={styles.windowLabel}>
                      Pickup Time Window
                      <span className={styles.window}>
                        <TimeInput
                          value={ride.windowFrom}
                          onChange={(value) =>
                            updateRide(index, { windowFrom: value })
                          }
                          min={bounds.from}
                          max={ride.pickupTime}
                          disabled={!ride.pickupTime}
                          aria-label={`Ride ${index + 1} pickup window start`}
                        />
                        <span>—</span>
                        <TimeInput
                          value={ride.windowTo}
                          onChange={(value) =>
                            updateRide(index, { windowTo: value })
                          }
                          min={ride.pickupTime}
                          max={bounds.to}
                          disabled={!ride.pickupTime}
                          aria-label={`Ride ${index + 1} pickup window end`}
                        />
                      </span>
                    </label>
                    <label>
                      Pickup Location
                      <SearchableSelect
                        value={ride.pickup}
                        onChange={(pickup) => updateRide(index, { pickup })}
                        options={locationOptions.filter(
                          (option) => option.value !== ride.dropoff,
                        )}
                        placeholder="Search pickup location"
                        aria-label={`Ride ${index + 1} pickup location`}
                      />
                    </label>
                    <label>
                      Dropoff Location
                      <SearchableSelect
                        value={ride.dropoff}
                        onChange={(dropoff) => updateRide(index, { dropoff })}
                        options={locationOptions.filter(
                          (option) => option.value !== ride.pickup,
                        )}
                        placeholder="Search dropoff location"
                        aria-label={`Ride ${index + 1} dropoff location`}
                      />
                    </label>
                    <label className={styles.toggle}>
                      <span>Recurring</span>
                      <BogSwitch
                        checked={ride.recurring}
                        onCheckedChange={(checked) =>
                          updateRide(index, { recurring: checked })
                        }
                      />
                    </label>
                  </div>
                  {ride.recurring && (
                    <RecurrenceFields
                      frequency={ride.frequency}
                      onFrequencyChange={(frequency) =>
                        updateRide(index, { frequency })
                      }
                      daysOfWeek={ride.repeatsOn}
                      endsOn={ride.ends}
                      minDate={ride.date}
                      onDaysChange={(repeatsOn) =>
                        updateRide(index, { repeatsOn })
                      }
                      onEndChange={(ends) => updateRide(index, { ends })}
                    />
                  )}
                </section>
              );
            })}
          </div>
          <BogButton
            type="button"
            className={styles.addButton}
            disabled={rides.length >= 25 || submitting}
            onClick={() => setRides((current) => [...current, newRide()])}
          >
            Add ride request
          </BogButton>
          <div className={styles.submitRow}>
            <span>
              You are requesting <b>{rides.length}</b> ride(s).
            </span>
            <BogButton
              type="submit"
              variant="primary"
              size="large"
              className={styles.submitButton}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit"}
            </BogButton>
          </div>
        </form>
      </main>
    </div>
  );
}
