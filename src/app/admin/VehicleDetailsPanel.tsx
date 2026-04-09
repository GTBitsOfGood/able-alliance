"use client";

import React, { useEffect, useState } from "react";
import BogButton from "@/components/BogButton/BogButton";
import BogIcon from "@/components/BogIcon/BogIcon";
import BogTextInput from "@/components/BogTextInput/BogTextInput";
import BogDropdown from "@/components/BogDropdown/BogDropdown";
import { ProfileRidesTab } from "@/app/profile/ProfileRidesTab";

const VEHICLE_ACCESSIBILITY_OPTIONS = ["None", "Wheelchair"] as const;

type Vehicle = {
  _id: string;
  vehicleId?: string;
  name: string;
  licensePlate: string;
  description?: string;
  accessibility: "None" | "Wheelchair";
  seatCount: number;
};

interface VehicleDetailsPanelProps {
  vehicleId: string;
  onBack: () => void;
  onDeleted: () => void;
  onSaved?: () => void;
}

export default function VehicleDetailsPanel({
  vehicleId,
  onBack,
  onDeleted,
  onSaved,
}: VehicleDetailsPanelProps) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(true);
  const [vehicleError, setVehicleError] = useState<string | null>(null);

  // Edit form state
  const [name, setName] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [description, setDescription] = useState("");
  const [seatCount, setSeatCount] = useState("");
  const [accessibility, setAccessibility] = useState<"None" | "Wheelchair">(
    "None",
  );
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoadingVehicle(true);
    setVehicleError(null);
    fetch(`/api/vehicles/${vehicleId}`)
      .then((r) => r.json())
      .then((v: Vehicle) => {
        setVehicle(v);
        setName(v.name);
        setLicensePlate(v.licensePlate);
        setDescription(v.description ?? "");
        setSeatCount(String(v.seatCount));
        setAccessibility(v.accessibility);
        setLoadingVehicle(false);
      })
      .catch(() => {
        setVehicleError("Failed to load vehicle.");
        setLoadingVehicle(false);
      });
  }, [vehicleId]);

  const handleCancel = () => {
    if (!vehicle) return;
    setName(vehicle.name);
    setLicensePlate(vehicle.licensePlate);
    setDescription(vehicle.description ?? "");
    setSeatCount(String(vehicle.seatCount));
    setAccessibility(vehicle.accessibility);
    setSaveError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const count = parseInt(seatCount, 10);
    if (!name.trim() || !licensePlate.trim()) {
      setSaveError("Name and license plate are required.");
      return;
    }
    if (!Number.isInteger(count) || count < 1) {
      setSaveError("Seat count must be at least 1.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          licensePlate: licensePlate.trim(),
          description: description.trim() || undefined,
          accessibility,
          seatCount: count,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? res.statusText);
      }
      const updated: Vehicle = await res.json();
      setVehicle(updated);
      setIsEditing(false);
      onSaved?.();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? res.statusText);
      }
      onDeleted();
    } catch {
      setDeleting(false);
    }
  };

  if (loadingVehicle) return <p className="text-gray-600">Loading…</p>;
  if (vehicleError)
    return <p className="text-sm text-amber-700">{vehicleError}</p>;

  return (
    <div className="flex flex-col gap-[2.4rem]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[1.6rem]">
          <button
            className="flex items-center gap-2 hover:cursor-pointer"
            onClick={onBack}
          >
            <BogIcon name="arrow-left" size={20} />
          </button>
          <h1>Vehicle Details</h1>
        </div>
        <BogButton
          variant="secondary"
          size="medium"
          disabled={deleting}
          onClick={handleDelete}
          style={
            {
              "--color-brand-stroke-strong": "var(--color-status-red-text)",
              "--color-brand-text": "var(--color-status-red-text)",
              "--color-brand-hover": "#a02a2a",
              borderRadius: "0.5rem",
            } as React.CSSProperties
          }
        >
          {deleting ? "Deleting…" : "Delete vehicle"}
        </BogButton>
      </div>

      {/* Vehicle ID */}
      <h2
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "var(--text-desktop-heading-3)",
          fontWeight: 700,
          color: "var(--color-grey-text-strong)",
        }}
      >
        Vehicle ID {vehicle?.vehicleId ?? vehicle?.name}
      </h2>

      {/* Vehicle Information Card */}
      <div
        className="flex flex-col gap-[2.4rem] px-[3.2rem] py-[2.4rem] border rounded-[0.8rem]"
        style={{ borderColor: "var(--color-grey-off-state)" }}
      >
        <div className="flex items-center justify-between">
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-desktop-paragraph-1)",
              fontWeight: 700,
            }}
          >
            Vehicle Information
          </span>
          {isEditing ? (
            <div className="flex gap-[1.2rem]">
              <BogButton
                variant="secondary"
                size="medium"
                onClick={handleCancel}
                disabled={saving}
                style={{ borderRadius: "0.5rem" } as React.CSSProperties}
              >
                Cancel
              </BogButton>
              <BogButton
                variant="primary"
                size="medium"
                onClick={handleSave}
                disabled={saving}
                style={
                  {
                    "--color-brand-hover": "#2a52a0",
                    borderRadius: "0.5rem",
                  } as React.CSSProperties
                }
              >
                {saving ? "Saving…" : "Save changes"}
              </BogButton>
            </div>
          ) : (
            <BogButton
              variant="secondary"
              size="medium"
              onClick={() => setIsEditing(true)}
              style={{ borderRadius: "0.5rem" } as React.CSSProperties}
            >
              Edit information
            </BogButton>
          )}
        </div>

        {isEditing ? (
          <>
            <div className="flex flex-row flex-wrap gap-[5.8rem]">
              <BogTextInput
                name="name"
                label="Vehicle Number"
                value={name}
                onChange={(e) => setName((e.target as HTMLInputElement).value)}
                className="flex-1 basis-[20rem] max-w-[35rem] gap-3"
              />
              <BogTextInput
                name="licensePlate"
                label="License Plate"
                value={licensePlate}
                onChange={(e) =>
                  setLicensePlate((e.target as HTMLInputElement).value)
                }
                className="flex-1 basis-[20rem] max-w-[35rem] gap-3"
              />
            </div>

            <div className="flex flex-row flex-wrap gap-[5.8rem]">
              <BogTextInput
                name="description"
                label="Description"
                value={description}
                onChange={(e) =>
                  setDescription((e.target as HTMLInputElement).value)
                }
                className="flex-1 basis-[20rem] max-w-[35rem] gap-3"
              />
              <BogTextInput
                name="seatCount"
                label="Seat Capacity"
                value={seatCount}
                onChange={(e) =>
                  setSeatCount((e.target as HTMLInputElement).value)
                }
                className="flex-1 basis-[20rem] max-w-[35rem] gap-3"
              />
            </div>

            <div className="flex flex-row flex-wrap gap-[5.8rem]">
              <BogDropdown
                name="accessibility"
                label="Accommodations"
                options={[...VEHICLE_ACCESSIBILITY_OPTIONS]}
                placeholder="Select accessibility"
                value={accessibility}
                onSelectionChange={(v) =>
                  setAccessibility(
                    typeof v === "string"
                      ? (v as "None" | "Wheelchair")
                      : ((v[0] ?? "None") as "None" | "Wheelchair"),
                  )
                }
                className="flex-1 basis-[20rem] max-w-[35rem]"
              />
            </div>

            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          </>
        ) : (
          <>
            <div className="flex flex-row flex-wrap gap-[5.8rem]">
              <div className="flex flex-col gap-1 flex-1 basis-[20rem] max-w-[35rem]">
                <span
                  style={{
                    fontSize: "var(--text-desktop-paragraph-2)",
                    color: "var(--color-grey-text-weak)",
                  }}
                >
                  Vehicle Number
                </span>
                <span style={{ fontSize: "var(--text-desktop-paragraph-1)" }}>
                  {vehicle?.name || "—"}
                </span>
              </div>
              <div className="flex flex-col gap-1 flex-1 basis-[20rem] max-w-[35rem]">
                <span
                  style={{
                    fontSize: "var(--text-desktop-paragraph-2)",
                    color: "var(--color-grey-text-weak)",
                  }}
                >
                  License Plate
                </span>
                <span style={{ fontSize: "var(--text-desktop-paragraph-1)" }}>
                  {vehicle?.licensePlate || "—"}
                </span>
              </div>
            </div>

            <div className="flex flex-row flex-wrap gap-[5.8rem]">
              <div className="flex flex-col gap-1 flex-1 basis-[20rem] max-w-[35rem]">
                <span
                  style={{
                    fontSize: "var(--text-desktop-paragraph-2)",
                    color: "var(--color-grey-text-weak)",
                  }}
                >
                  Description
                </span>
                <span style={{ fontSize: "var(--text-desktop-paragraph-1)" }}>
                  {vehicle?.description || "—"}
                </span>
              </div>
              <div className="flex flex-col gap-1 flex-1 basis-[20rem] max-w-[35rem]">
                <span
                  style={{
                    fontSize: "var(--text-desktop-paragraph-2)",
                    color: "var(--color-grey-text-weak)",
                  }}
                >
                  Seat Capacity
                </span>
                <span style={{ fontSize: "var(--text-desktop-paragraph-1)" }}>
                  {vehicle?.seatCount ?? "—"}
                </span>
              </div>
            </div>

            <div className="flex flex-row flex-wrap gap-[5.8rem]">
              <div className="flex flex-col gap-1 flex-1 basis-[20rem] max-w-[35rem]">
                <span
                  style={{
                    fontSize: "var(--text-desktop-paragraph-2)",
                    color: "var(--color-grey-text-weak)",
                  }}
                >
                  Accommodations
                </span>
                <span style={{ fontSize: "var(--text-desktop-paragraph-1)" }}>
                  {vehicle?.accessibility || "—"}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Assigned Rides */}
      <div className="flex flex-col gap-[0.8rem]">
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-desktop-heading-3)",
            fontWeight: 700,
          }}
        >
          Assigned Rides
        </h2>
        <ProfileRidesTab userId={vehicleId} userType="Vehicle" />
      </div>
    </div>
  );
}
