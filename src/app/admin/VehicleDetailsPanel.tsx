"use client";

import React, { useEffect, useState } from "react";
import BogButton from "@/components/BogButton/BogButton";
import BogIcon from "@/components/BogIcon/BogIcon";
import BogTextInput from "@/components/BogTextInput/BogTextInput";
import BogDropdown from "@/components/BogDropdown/BogDropdown";
import BogTable from "@/components/BogTable/BogTable";
import type { TableRow } from "@/components/BogTable/BogTable";

const VEHICLE_ACCESSIBILITY_OPTIONS = ["None", "Wheelchair"] as const;

type Vehicle = {
  _id: string;
  name: string;
  licensePlate: string;
  description?: string;
  accessibility: "None" | "Wheelchair";
  seatCount: number;
};

type RouteEntry = {
  _id: string;
  student: { firstName: string; lastName: string };
  driver?: { firstName: string; lastName: string };
  vehicle?: { _id: string };
  pickupLocation: string;
  dropoffLocation: string;
  scheduledPickupTime: string;
  estimatedDropoffTime?: string;
  status: string;
};

type LocationEntry = { _id: string; name: string };

function getWeekBounds(weekOffset: 0 | 1): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + weekOffset * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatWeekLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `Week of ${start.toLocaleDateString("en-US", opts)} - ${end.toLocaleDateString("en-US", opts)}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

const RIDE_COLUMNS = [
  { content: "Student", datatype: "string" as const },
  { content: "Driver", datatype: "string" as const },
  { content: "Date", datatype: "string" as const },
  { content: "Pickup", datatype: "string" as const },
  { content: "Dropoff", datatype: "string" as const },
  { content: "Status", datatype: "string" as const },
];

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

  // Rides state
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [routes, setRoutes] = useState<RouteEntry[]>([]);
  const [locationMap, setLocationMap] = useState<Record<string, string>>({});
  const [loadingRides, setLoadingRides] = useState(true);

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

  useEffect(() => {
    setLoadingRides(true);
    const { start, end } = getWeekBounds(activeTab);
    Promise.all([
      fetch(
        `/api/routes?start_time=${start.toISOString()}&end_time=${end.toISOString()}`,
      ).then((r) => r.json()),
      fetch("/api/locations").then((r) => r.json()),
    ])
      .then(([routesData, locationsData]) => {
        const locMap: Record<string, string> = {};
        if (Array.isArray(locationsData)) {
          for (const loc of locationsData as LocationEntry[]) {
            locMap[String(loc._id)] = String(loc.name);
          }
        }
        setLocationMap(locMap);
        const filtered = Array.isArray(routesData)
          ? routesData.filter(
              (r: RouteEntry) =>
                r.vehicle && String(r.vehicle._id) === vehicleId,
            )
          : [];
        setRoutes(filtered);
        setLoadingRides(false);
      })
      .catch(() => setLoadingRides(false));
  }, [vehicleId, activeTab]);

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

  const rideRows: TableRow[] = routes.map((r) => {
    const pickupDate = new Date(r.scheduledPickupTime).toLocaleDateString();
    const pickupTime = formatTime(r.scheduledPickupTime);
    const dropoffTime = r.estimatedDropoffTime
      ? formatTime(r.estimatedDropoffTime)
      : "—";
    const pickupLoc = locationMap[r.pickupLocation] ?? r.pickupLocation;
    const dropoffLoc = locationMap[r.dropoffLocation] ?? r.dropoffLocation;
    return {
      cells: [
        { content: `${r.student.firstName} ${r.student.lastName}` },
        {
          content: r.driver
            ? `${r.driver.firstName} ${r.driver.lastName}`
            : "—",
        },
        { content: pickupDate },
        { content: `${pickupTime} @ ${pickupLoc}` },
        { content: `${dropoffTime} @ ${dropoffLoc}` },
        { content: r.status },
      ],
    };
  });

  const thisWeekBounds = getWeekBounds(0);
  const nextWeekBounds = getWeekBounds(1);
  const weekLabel =
    activeTab === 0
      ? formatWeekLabel(thisWeekBounds.start, thisWeekBounds.end)
      : formatWeekLabel(nextWeekBounds.start, nextWeekBounds.end);

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
        Vehicle ID {vehicle?.name}
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
      <div className="flex flex-col gap-[1.6rem]">
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-desktop-heading-3)",
            fontWeight: 700,
          }}
        >
          Assigned Rides
        </h2>

        {/* Tabs */}
        <div
          className="flex gap-0 border-b"
          style={{ borderColor: "var(--color-grey-stroke-weak)" }}
        >
          {(["This week", "Next week"] as const).map((label, i) => (
            <button
              key={label}
              onClick={() => setActiveTab(i as 0 | 1)}
              style={{
                padding: "0.8rem 1.6rem",
                fontSize: "var(--text-desktop-paragraph-2)",
                fontFamily: "var(--font-paragraph)",
                fontWeight: activeTab === i ? 700 : 400,
                color:
                  activeTab === i
                    ? "var(--color-grey-text-strong)"
                    : "var(--color-grey-off-state)",
                borderBottom:
                  activeTab === i
                    ? "2px solid var(--color-grey-text-strong)"
                    : "2px solid transparent",
                background: "none",
                cursor: "pointer",
                marginBottom: "-1px",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <h3
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-desktop-paragraph-1)",
            fontWeight: 700,
          }}
        >
          {weekLabel}
        </h3>

        {loadingRides ? (
          <p className="text-gray-600">Loading rides…</p>
        ) : rideRows.length === 0 ? (
          <p className="text-gray-600">No rides assigned for this week.</p>
        ) : (
          <BogTable
            columnHeaders={RIDE_COLUMNS}
            rows={rideRows}
            selectable={false}
          />
        )}
      </div>
    </div>
  );
}
