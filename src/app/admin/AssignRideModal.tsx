"use client";

import React, { useState } from "react";

import BogModal from "@/components/BogModal/BogModal";
import BogButton from "@/components/BogButton/BogButton";
import BogDropdown from "@/components/BogDropdown/BogDropdown";
import BogIcon from "@/components/BogIcon/BogIcon";
import { formatEstDate, formatEstTime } from "@/utils/dateEst";

import type { RouteEntry, DriverEntry, VehicleEntry } from "./useAdminRides";
import styles from "./assignRideModal.module.css";

function driverLabel(d: DriverEntry) {
  return `${d.lastName}, ${d.firstName}`;
}

function vehicleLabel(v: VehicleEntry) {
  return `${v.name} (${v.licensePlate})`;
}

/** Assigns a driver and vehicle to a requested ride. */
export default function AssignRideModal({
  route,
  drivers,
  vehicles,
  onClose,
  onAssigned,
}: {
  route: RouteEntry;
  drivers: DriverEntry[];
  vehicles: VehicleEntry[];
  onClose: () => void;
  onAssigned: (routeId: string) => void;
}) {
  const [driver, setDriver] = useState(
    route.driver ? driverLabel(route.driver) : "",
  );
  const [vehicle, setVehicle] = useState(
    route.vehicle ? vehicleLabel(route.vehicle) : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickupAt = new Date(route.scheduledPickupTime);

  const handleConfirm = async () => {
    const selectedDriver = drivers.find((d) => driverLabel(d) === driver);
    const selectedVehicle = vehicles.find((v) => vehicleLabel(v) === vehicle);
    if (!selectedDriver || !selectedVehicle) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/routes/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId: route.id,
          driverId: selectedDriver.id,
          vehicleId: selectedVehicle.id,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? res.statusText);
      }
      onAssigned(route.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assignment failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BogModal
      size="medium"
      modal
      openState={{
        open: true,
        setOpen: (value) => {
          const next = typeof value === "function" ? value(true) : value;
          if (!next && !submitting) onClose();
        },
      }}
      trigger={
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          style={{ display: "none" }}
        />
      }
      contentProps={{
        style: {
          width: "52rem",
          maxWidth: "90vw",
          padding: "4rem 2.88rem",
          borderRadius: "0.8rem",
          gap: "2rem",
        },
      }}
      closeButton={<BogIcon name="x" size={36} />}
      title={<h3 className={styles.title}>Schedule ride</h3>}
    >
      <div className={styles.body}>
        <p className={styles.summary}>
          {route.student.firstName} {route.student.lastName} ·{" "}
          {formatEstDate(pickupAt)} at {formatEstTime(pickupAt)}
          <br />
          {route.pickup?.name} → {route.dropoff?.name}
        </p>

        <BogDropdown
          name={`assign-driver-${route.id}`}
          label="Choose a driver"
          options={drivers.map(driverLabel)}
          placeholder="Select..."
          value={driver}
          onSelectionChange={(selection) =>
            setDriver(typeof selection === "string" ? selection : selection[0])
          }
        />
        <BogDropdown
          name={`assign-vehicle-${route.id}`}
          label="Choose a vehicle"
          options={vehicles.map(vehicleLabel)}
          placeholder="Select..."
          value={vehicle}
          onSelectionChange={(selection) =>
            setVehicle(typeof selection === "string" ? selection : selection[0])
          }
        />

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.footer}>
          <BogButton
            variant="secondary"
            size="large"
            disabled={submitting}
            onClick={onClose}
            style={{ fontWeight: 600 }}
          >
            Nevermind
          </BogButton>
          <BogButton
            variant="primary"
            size="large"
            disabled={submitting || !driver || !vehicle}
            onClick={() => void handleConfirm()}
            style={{ fontWeight: 600 }}
          >
            {submitting ? "Saving…" : "Save"}
          </BogButton>
        </div>
      </div>
    </BogModal>
  );
}
