"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fromZonedTime } from "date-fns-tz";
import { estDateKey, estNowWallClock } from "@/utils/dateEst";
import { useRouter } from "next/navigation";
import type { Location } from "@db/generated/browser";
import { SERVICE_END_TIME, SERVICE_START_TIME } from "@/utils/consts";
import { TimeInput } from "@/components/TimeInput/TimeInput";
import styles from "./styles.module.css";
import BogSwitch from "@/components/BogSwitch/BogSwitch";
import BogButton from "@/components/BogButton/BogButton";

type RideDraft = {
  date: string;
  pickupTime: string;
  windowFrom: string;
  windowTo: string;
  pickup: string;
  dropoff: string;
  recurring: boolean;
  repeatsOn: string[];
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
  const day = date.getDay();
  if (day === 6) date.setDate(date.getDate() + 2);
  else if (day === 0) date.setDate(date.getDate() + 1);
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

function isWeekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday >= 1 && weekday <= 5;
}

export default function BatchRidePage() {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [rides, setRides] = useState<RideDraft[]>([newRide()]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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

  function updateRide(index: number, patch: Partial<RideDraft>) {
    setRides((current) =>
      current.map((ride, rideIndex) =>
        rideIndex === index ? { ...ride, ...patch } : ride,
      ),
    );
  }

  function toggleDay(index: number, day: string) {
    const ride = rides[index];
    updateRide(index, {
      repeatsOn: ride.repeatsOn.includes(day)
        ? ride.repeatsOn.filter((selectedDay) => selectedDay !== day)
        : [...ride.repeatsOn, day],
    });
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
      if (end <= start) {
        setError(`Ride #${index + 1} has an invalid pickup window.`);
        return;
      }
      if (pickup <= new Date()) {
        setError(`Ride #${index + 1} pickup time cannot be in the past.`);
        return;
      }
      if (pickup < start || pickup > end) {
        setError(
          `Ride #${index + 1} pickup time must be within its pickup window.`,
        );
        return;
      }
      if (
        [ride.pickupTime, ride.windowFrom, ride.windowTo].some(
          (time) => time < SERVICE_START_TIME || time > SERVICE_END_TIME,
        )
      ) {
        setError(`Ride #${index + 1} must be within service hours.`);
        return;
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
              ...(ride.recurring ? { recurring: { frequency: "weekly" } } : {}),
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
        <div className={styles.errorBanner} role="alert">
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
            {rides.map((ride, index) => (
              <section className={styles.card} key={index}>
                <div className={styles.cardHeader}>
                  <h2>Ride #{index + 1}</h2>
                  {rides.length > 1 && (
                    <BogButton
                      type="button"
                      className={styles.removeButton}
                      onClick={() =>
                        setRides((current) =>
                          current.filter((_, rideIndex) => rideIndex !== index),
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
                      min={SERVICE_START_TIME}
                      max={SERVICE_END_TIME}
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
                        min={SERVICE_START_TIME}
                        max={SERVICE_END_TIME}
                      />
                      <span>—</span>
                      <TimeInput
                        value={ride.windowTo}
                        onChange={(value) =>
                          updateRide(index, { windowTo: value })
                        }
                        min={SERVICE_START_TIME}
                        max={SERVICE_END_TIME}
                      />
                    </span>
                  </label>
                  <label>
                    Pickup Location
                    <select
                      value={ride.pickup}
                      onChange={(event) =>
                        updateRide(index, { pickup: event.target.value })
                      }
                    >
                      <option value="">Enter pickup location</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.name}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Dropoff Location
                    <select
                      value={ride.dropoff}
                      onChange={(event) =>
                        updateRide(index, { dropoff: event.target.value })
                      }
                    >
                      <option value="">Enter dropoff location</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.name}>
                          {location.name}
                        </option>
                      ))}
                    </select>
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
                  <div className={styles.recurrenceFields}>
                    <label>
                      Frequency
                      <select defaultValue="Weekly">
                        <option>Weekly</option>
                      </select>
                    </label>
                    <fieldset>
                      <legend>Repeats on</legend>
                      <div className={styles.dayButtons}>
                        {["M", "Tu", "W", "Th", "F"].map((day) => (
                          <BogButton
                            key={day}
                            type="button"
                            className={
                              ride.repeatsOn.includes(day)
                                ? styles.dayButtonSelected
                                : styles.dayButton
                            }
                            onClick={() => toggleDay(index, day)}
                          >
                            {day}
                          </BogButton>
                        ))}
                      </div>
                    </fieldset>
                    <label>
                      Ends
                      <input
                        type="date"
                        value={ride.ends}
                        onChange={(event) =>
                          updateRide(index, { ends: event.target.value })
                        }
                      />
                    </label>
                  </div>
                )}
              </section>
            ))}
          </div>
          <BogButton
            type="button"
            className={styles.addButton}
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
