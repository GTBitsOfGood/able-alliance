"use client";

import React, { useState } from "react";
import BogForm from "@/components/BogForm/BogForm";
import BogDropdown from "@/components/BogDropdown/BogDropdown";
import styles from "./styles.module.css";

export type RequestRideLocation = {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export function RequestRideForm({
  locations,
  onSuccess,
  onError,
}: {
  locations: RequestRideLocation[];
  onSuccess: () => void;
  onError: (msg: string | null) => void;
}) {
  const [startLocationName, setStartLocationName] = useState("");
  const [endLocationName, setEndLocationName] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const locationNames = locations.map((l) => l.name);
  const nameToId = locations.reduce(
    (acc, loc) => {
      acc[loc.name] = loc._id;
      return acc;
    },
    {} as Record<string, string>,
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onError(null);
    setSubmitError(null);
    const startId = nameToId[startLocationName];
    const endId = nameToId[endLocationName];
    if (!startId || !endId) {
      setSubmitError("Please select start and end locations.");
      return;
    }
    if (startId === endId) {
      setSubmitError("Start and end locations must be different.");
      return;
    }
    if (!dateTime) {
      setSubmitError("Please select date and time.");
      return;
    }
    setSubmitting(true);
    try {
      const usersRes = await fetch("/api/users?type=Student");
      if (!usersRes.ok) throw new Error("Failed to fetch students");
      const students = await usersRes.json();
      const studentId = students[0]?._id;
      if (!studentId) {
        setSubmitError("No students in the system. Add a student first.");
        setSubmitting(false);
        return;
      }
      const scheduledPickupTime = new Date(dateTime).toISOString();
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupLocation: startId,
          dropoffLocation: endId,
          student: studentId,
          scheduledPickupTime,
          isActive: false,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? res.statusText ?? "Request failed");
      }
      setStartLocationName("");
      setEndLocationName("");
      setDateTime("");
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setSubmitError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BogForm
      onSubmit={handleSubmit}
      submitLabel={submitting ? "Submitting…" : "Submit"}
    >
      <BogDropdown
        name="startLocation"
        label="Start location"
        options={locationNames}
        placeholder="Select start location"
        value={startLocationName}
        onSelectionChange={(v) =>
          setStartLocationName(typeof v === "string" ? v : (v[0] ?? ""))
        }
      />
      <BogDropdown
        name="endLocation"
        label="End location"
        options={locationNames}
        placeholder="Select end location"
        value={endLocationName}
        onSelectionChange={(v) =>
          setEndLocationName(typeof v === "string" ? v : (v[0] ?? ""))
        }
      />
      <div className={styles.formField}>
        <label htmlFor="ride-datetime" className={styles.formLabel}>
          Date &amp; time
        </label>
        <input
          id="ride-datetime"
          type="datetime-local"
          required
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
          className={styles.formDateTimeInput}
        />
      </div>
      {submitError && <p className={styles.formError}>{submitError}</p>}
    </BogForm>
  );
}
