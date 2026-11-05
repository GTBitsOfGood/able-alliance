"use client";

import type { VehicleInput } from "@/schemas/vehicle";

import BogTable from "@/components/BogTable/BogTable";
import BogForm from "@/components/BogForm/BogForm";
import BogButton from "@/components/BogButton/BogButton";
import BogTextInput from "@/components/BogTextInput/BogTextInput";
import BogDropdown from "@/components/BogDropdown/BogDropdown";
import React, { useState } from "react";
import VehicleDetailsPanel from "./VehicleDetailsPanel";
import LocationsMap from "./LocationsMap";
import ConfirmActionModal from "@/components/ConfirmActionModal/ConfirmActionModal";

import { useAdminTableData } from "@/hooks/useAdminTableData";
import BogIcon from "@/components/BogIcon/BogIcon";
import { useRouter } from "next/navigation";

import type { AdminTableType, LngLat } from "@/types/admin";

const VEHICLE_ACCESSIBILITY_OPTIONS = ["None", "Wheelchair"] as const;

export default function AdminTableContent({
  table,
}: {
  table: AdminTableType;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    null,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    columns,
    rows,
    rowIds,
    protectedIds,
    locations,
    loading,
    error,
    deleteRows,
    refetch,
  } = useAdminTableData(table);
  const [newLocationPoint, setNewLocationPoint] = useState<LngLat | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Selection is by row index, so drop it whenever the rows are replaced
  // (e.g. a real-time update) to avoid acting on a different row.
  const [selectionRowIds, setSelectionRowIds] = useState(rowIds);
  if (selectionRowIds !== rowIds) {
    setSelectionRowIds(rowIds);
    setSelectedRows(new Set());
    if (!deleting) setShowDeleteConfirm(false);
  }
  const [vehicleAccessibility, setVehicleAccessibility] =
    useState<string>("None");

  const handleDelete = async () => {
    if (selectedRows.size === 0) return;
    setDeleting(true);
    try {
      await deleteRows(selectedRows);
      setSelectedRows(new Set());
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const canDelete = selectedRows.size > 0 && rowIds.length > 0;
  const selectionHasProtected = [...selectedRows].some((idx) =>
    protectedIds.has(rowIds[idx] ?? ""),
  );

  const deleteNoun =
    table === "Vehicles"
      ? "vehicle"
      : table === "Locations"
        ? "location"
        : "user";

  const handleAddVehicle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    const form = e.currentTarget;
    const name = (
      form.elements.namedItem("name") as HTMLInputElement
    ).value.trim();
    const licensePlate = (
      form.elements.namedItem("licensePlate") as HTMLInputElement
    ).value.trim();
    const description = (
      form.elements.namedItem("description") as HTMLInputElement
    ).value.trim();
    const seatCount = parseInt(
      (form.elements.namedItem("seatCount") as HTMLInputElement).value,
      10,
    );

    if (!name || !licensePlate) {
      setSubmitError("Vehicle number and license plate are required.");
      return;
    }
    if (!Number.isInteger(seatCount) || seatCount < 1) {
      setSubmitError("Seat count must be at least 1.");
      return;
    }

    fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId: name,
        name,
        licensePlate,
        description: description || undefined,
        accessibility: vehicleAccessibility as VehicleInput["accessibility"],
        seatCount,
      }),
    })
      .then((res) => {
        if (!res.ok)
          return res
            .json()
            .then((body) =>
              Promise.reject(
                new Error(body.error ?? body.message ?? res.statusText),
              ),
            );
        refetch();
        setShowForm(false);
        form.reset();
      })
      .catch((err: Error) =>
        setSubmitError(err.message ?? "Failed to create vehicle."),
      );
  };

  const handleAddLocation = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    const form = e.currentTarget;
    const name = (
      form.elements.namedItem("name") as HTMLInputElement
    ).value.trim();

    if (!name) {
      setSubmitError("Location name is required.");
      return;
    }
    if (!newLocationPoint) {
      setSubmitError("Click the map to place the location.");
      return;
    }
    const { latitude, longitude } = newLocationPoint;

    fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, latitude, longitude }),
    })
      .then((res) => {
        if (!res.ok)
          return res
            .json()
            .then((body) =>
              Promise.reject(
                new Error(body.error ?? body.message ?? res.statusText),
              ),
            );
        refetch();
        setShowForm(false);
        setNewLocationPoint(null);
        form.reset();
      })
      .catch((err: Error) =>
        setSubmitError(err.message ?? "Failed to create location."),
      );
  };

  const addLabel =
    table === "Locations"
      ? "Add Location"
      : table === "Vehicles"
        ? "Add Vehicle"
        : "Invite User";

  const formTitle = table === "Locations" ? "Add Location" : "Add Vehicle";

  const deleteLabel =
    table === "Locations"
      ? "Archive location"
      : table === "Vehicles"
        ? "Archive vehicle"
        : "Archive user";

  const formContent =
    table === "Locations" ? (
      <BogForm onSubmit={handleAddLocation} submitLabel="Create location">
        <BogTextInput
          name="name"
          label="Location name"
          placeholder="e.g. Campus Recreation Center"
          required
        />
        <div className="flex flex-col gap-3 w-full max-w-[80rem]">
          <span className="text-paragraph-1 text-[var(--color-grey-text-strong)]">
            Click the map to place the location. Existing locations are shown as
            dots.
          </span>
          <LocationsMap
            locations={locations}
            selected={newLocationPoint}
            onSelect={setNewLocationPoint}
          />
          <span className="text-paragraph-2 text-[var(--color-grey-text-weak)]">
            {newLocationPoint
              ? `Selected: ${newLocationPoint.latitude.toFixed(6)}, ${newLocationPoint.longitude.toFixed(6)}`
              : "No point selected"}
          </span>
        </div>
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      </BogForm>
    ) : (
      <BogForm
        onSubmit={handleAddVehicle}
        submitLabel="Add vehicle"
        style={{
          background: "#fff",
          border: "1px solid rgba(34,7,11,0.15)",
          borderRadius: "0.8rem",
          padding: "3.2rem",
          maxWidth: "80rem",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4.3rem 5.8rem",
            width: "100%",
          }}
        >
          <BogTextInput
            name="name"
            label="Vehicle Number"
            placeholder="e.g. V001"
            required
          />
          <BogTextInput
            name="licensePlate"
            label="License Plate"
            placeholder="e.g. ABC-1234"
            required
          />
          <BogTextInput
            name="description"
            label="Description"
            placeholder="e.g. Honda Odyssey"
          />
          <BogTextInput
            name="seatCount"
            label="Seat Capacity"
            placeholder="e.g. 4"
            required
          />
        </div>
        <div
          style={{
            width: "100%",
            maxWidth: "calc(50% - 2.9rem)",
            marginBottom: "1.6rem",
          }}
        >
          <BogDropdown
            name="accessibility"
            label="Accommodations"
            options={[...VEHICLE_ACCESSIBILITY_OPTIONS]}
            placeholder="Select accommodations"
            value={vehicleAccessibility}
            onSelectionChange={(v) =>
              setVehicleAccessibility(
                typeof v === "string" ? v : (v[0] ?? "None"),
              )
            }
          />
        </div>
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      </BogForm>
    );

  return (
    <div className="py-[var(--layout-content-pad-y)] px-[var(--layout-admin-pad-x)] relative flex flex-col flex-1 min-w-0 w-full">
      {selectedVehicleId ? (
        <VehicleDetailsPanel
          key={selectedVehicleId}
          vehicleId={selectedVehicleId}
          onBack={() => setSelectedVehicleId(null)}
          onDeleted={() => {
            setSelectedVehicleId(null);
            refetch();
          }}
          onSaved={refetch}
        />
      ) : showForm ? (
        <>
          <div className="flex flex-col gap-4 mb-[2.4rem]">
            <div className="flex text-paragraph-1 gap-2">
              <button
                className="flex items-center gap-2 hover:cursor-pointer"
                onClick={() => {
                  setShowForm(false);
                  setSubmitError(null);
                  setVehicleAccessibility("None");
                  setNewLocationPoint(null);
                }}
              >
                <BogIcon name="arrow-left" size={20} />
              </button>
              Back to {table.toLowerCase()}
            </div>
            <h1 className="text-display">{formTitle}</h1>
          </div>
          {formContent}
        </>
      ) : (
        <>
          <div className="mb-[2.4rem]">
            <h1 className="text-display">
              {table === "Locations" ? "Configurations" : table}
            </h1>
            {table === "Locations" && (
              <h2 className="text-heading-3 mt-[1.6rem] text-[var(--color-grey-text-strong)]">
                Pickup &amp; Dropoff Locations
              </h2>
            )}
          </div>
          <>
            {error && (
              <p className="mb-4 text-sm text-amber-700" role="status">
                {error}
              </p>
            )}
            {table === "Locations" && !loading && (
              <LocationsMap locations={locations} className="mb-[2.4rem]" />
            )}
            {loading ? (
              <p className="text-gray-600">Loading…</p>
            ) : (
              <BogTable
                style={{ marginBottom: "5vh" } as React.CSSProperties}
                columnHeaders={columns}
                rows={
                  table === "Vehicles"
                    ? rows.map((row, i) => ({
                        ...row,
                        cells: row.cells.map((cell, cIdx) =>
                          cIdx === 0
                            ? {
                                ...cell,
                                content: (
                                  <button
                                    style={{
                                      background: "none",
                                      border: "none",
                                      padding: 0,
                                      fontSize: "inherit",
                                      fontFamily: "inherit",
                                      color: "inherit",
                                      cursor: "pointer",
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const id = rowIds[i];
                                      if (id) setSelectedVehicleId(id);
                                    }}
                                  >
                                    {cell.content}
                                  </button>
                                ),
                              }
                            : cell,
                        ),
                      }))
                    : rows
                }
                selectedRows={selectedRows}
                onSelectedRowsChange={setSelectedRows}
                selectable={true}
                actions={
                  <>
                    {canDelete && (
                      <BogButton
                        variant="secondary"
                        size="medium"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={deleting || selectionHasProtected}
                        title={
                          selectionHasProtected
                            ? "Super admins cannot be archived"
                            : undefined
                        }
                        style={
                          {
                            "--color-brand-stroke-strong": "#C73A3A",
                            "--color-brand-text": "#C73A3A",
                            "--color-brand-hover": "#a02a2a",
                            borderRadius: "0.5rem",
                          } as React.CSSProperties
                        }
                      >
                        {deleting ? "Archiving…" : deleteLabel}
                      </BogButton>
                    )}
                    <BogButton
                      variant="primary"
                      size="medium"
                      onClick={() => {
                        if (["Students", "Drivers", "Admins"].includes(table))
                          router.push("/admin/directory/invite");
                        else setShowForm(true);
                      }}
                      iconProps={{
                        position: "left",
                        iconProps: { name: "plus", size: 16 },
                      }}
                      style={
                        {
                          "--color-brand-text": "#183777",
                          "--color-brand-hover": "#2a52a0",
                          borderRadius: "0.5rem",
                        } as React.CSSProperties
                      }
                    >
                      {addLabel}
                    </BogButton>
                  </>
                }
              />
            )}
          </>
        </>
      )}

      <ConfirmActionModal
        open={showDeleteConfirm}
        onOpenChange={(o) => {
          if (!o) setShowDeleteConfirm(false);
        }}
        onConfirm={handleDelete}
        title={`Archive ${deleteNoun}${selectedRows.size === 1 ? "" : "s"}?`}
        description={
          selectedRows.size === 1
            ? `Are you sure you want to archive this ${deleteNoun}? It will be hidden from all lists and dropdowns, and this cannot be undone yet.`
            : `Are you sure you want to archive these ${selectedRows.size} ${deleteNoun}s? They will be hidden from all lists and dropdowns, and this cannot be undone yet.`
        }
        confirmLabel={deleteLabel}
        confirmingLabel="Archiving…"
        confirming={deleting}
      />
    </div>
  );
}
