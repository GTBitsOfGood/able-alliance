"use client";

import BogTable from "@/components/BogTable/BogTable";
import BogModal from "@/components/BogModal/BogModal";
import BogForm from "@/components/BogForm/BogForm";
import BogButton from "@/components/BogButton/BogButton";
import BogTextInput from "@/components/BogTextInput/BogTextInput";
import BogDropdown from "@/components/BogDropdown/BogDropdown";
import React, { useState } from "react";

const STUDENT_ACCESSIBILITY_OPTIONS = ["None", "Wheelchair", "LowMobility"] as const;
const VEHICLE_ACCESSIBILITY_OPTIONS = ["None", "Wheelchair"] as const;
import { useAdminTableData, type AdminTableType } from "./useAdminTableData";

const selected_gradient = "bg-gradient-to-r from-[#EDEDED] to-[#EDEDED00]";

export default function Admin() {
  const [table, setTable] = useState<AdminTableType>("Students");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { columns, rows, rowIds, loading, error, deleteRows, refetch } =
    useAdminTableData(table);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [studentAccessibilityNeeds, setStudentAccessibilityNeeds] =
    useState<string>("None");
  const [vehicleAccessibility, setVehicleAccessibility] =
    useState<string>("None");

  // Add setSelectedRows(new Set()) inside switchTable
  // after setTable(value);

  const handleDelete = async () => {
    if (selectedRows.size === 0) return;
    setDeleting(true);
    try {
      await deleteRows(selectedRows);
      setSelectedRows(new Set());
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = selectedRows.size > 0 && rowIds.length > 0;

  const switchTable = (
    event: React.MouseEvent<HTMLHeadingElement>,
    value: AdminTableType,
  ) => {
    setTable(value);
    setSelectedRows(new Set());
  };

  const handleAddStudent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    const form = e.currentTarget;
    const name = (
      form.elements.namedItem("name") as HTMLInputElement
    ).value.trim();
    const email = (
      form.elements.namedItem("email") as HTMLInputElement
    ).value.trim();
    const phone = (
      form.elements.namedItem("phone") as HTMLInputElement
    ).value.trim();
    const gtid = (
      form.elements.namedItem("gtid") as HTMLInputElement
    ).value.trim();

    if (!name || !email) {
      setSubmitError("Name and email are required.");
      return;
    }
    if (!gtid || gtid.length !== 9 || !/^\d{9}$/.test(gtid)) {
      setSubmitError("GTID must be 9 digits.");
      return;
    }

    const studentInfo: {
      GTID: string;
      notes?: string;
      accessibilityNeeds?: "Wheelchair" | "LowMobility";
    } = {
      GTID: gtid,
      ...(phone && { notes: `Phone: ${phone}` }),
      ...(studentAccessibilityNeeds &&
        studentAccessibilityNeeds !== "None" && {
          accessibilityNeeds:
            studentAccessibilityNeeds as "Wheelchair" | "LowMobility",
        }),
    };
    fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "Student", name, email, studentInfo }),
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
        setModalOpen(false);
        form.reset();
      })
      .catch((err: Error) =>
        setSubmitError(err.message ?? "Failed to create student."),
      );
  };

  const handleAddAdmin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    const form = e.currentTarget;
    const name = (
      form.elements.namedItem("name") as HTMLInputElement
    ).value.trim();
    const email = (
      form.elements.namedItem("email") as HTMLInputElement
    ).value.trim();

    if (!name || !email) {
      setSubmitError("Name and email are required.");
      return;
    }

    fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "Admin", name, email }),
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
        setModalOpen(false);
        form.reset();
      })
      .catch((err: Error) =>
        setSubmitError(err.message ?? "Failed to create admin."),
      );
  };

  const handleAddDriver = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    const form = e.currentTarget;
    const name = (
      form.elements.namedItem("name") as HTMLInputElement
    ).value.trim();
    const email = (
      form.elements.namedItem("email") as HTMLInputElement
    ).value.trim();

    if (!name || !email) {
      setSubmitError("Name and email are required.");
      return;
    }

    fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "Driver", name, email }),
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
        setModalOpen(false);
        form.reset();
      })
      .catch((err: Error) =>
        setSubmitError(err.message ?? "Failed to create driver."),
      );
  };

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
      setSubmitError("Name and license plate are required.");
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
        name,
        licensePlate,
        description: description || undefined,
        accessibility: vehicleAccessibility as "None" | "Wheelchair",
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
        setModalOpen(false);
        form.reset();
      })
      .catch((err: Error) =>
        setSubmitError(err.message ?? "Failed to create vehicle."),
      );
  };

  const addTitle = `Add ${table === "Students" ? "Student" : table === "Drivers" ? "Driver" : table === "Admins" ? "Admin" : "Vehicle"}`;
  const triggerLabel = `Add ${table === "Students" ? "Student" : table === "Drivers" ? "Driver" : table === "Admins" ? "Admin" : "Vehicle"}`;

  const formContent =
    table === "Students" ? (
      <BogForm onSubmit={handleAddStudent} submitLabel="Create student">
        <BogTextInput
          name="name"
          label="Name"
          placeholder="Full name"
          required
        />
        <BogTextInput
          name="email"
          type="email"
          label="Email"
          placeholder="email@example.com"
          required
        />
        <BogTextInput
          name="phone"
          type="tel"
          label="Phone"
          placeholder="Optional"
        />
        <BogTextInput
          name="gtid"
          label="GTID"
          placeholder="9 digits"
          required
        />
        <BogDropdown
          name="accessibilityNeeds"
          label="Accessibility needs"
          options={[...STUDENT_ACCESSIBILITY_OPTIONS]}
          placeholder="Select accessibility needs"
          value={studentAccessibilityNeeds}
          onSelectionChange={(v) =>
            setStudentAccessibilityNeeds(typeof v === "string" ? v : v[0] ?? "None")
          }
        />
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      </BogForm>
    ) : table === "Drivers" ? (
      <BogForm onSubmit={handleAddDriver} submitLabel="Create driver">
        <BogTextInput
          name="name"
          label="Name"
          placeholder="Full name"
          required
        />
        <BogTextInput
          name="email"
          type="email"
          label="Email"
          placeholder="email@example.com"
          required
        />
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      </BogForm>
    ) : table === "Admins" ? (
      <BogForm onSubmit={handleAddAdmin} submitLabel="Create admin">
        <BogTextInput
          name="name"
          label="Name"
          placeholder="Full name"
          required
        />
        <BogTextInput
          name="email"
          type="email"
          label="Email"
          placeholder="email@example.com"
          required
        />
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      </BogForm>
    ) : (
      <BogForm onSubmit={handleAddVehicle} submitLabel="Create vehicle">
        <BogTextInput
          name="name"
          label="Name"
          placeholder="Vehicle name"
          required
        />
        <BogTextInput
          name="licensePlate"
          label="License plate"
          placeholder="Required"
          required
        />
        <BogTextInput
          name="description"
          label="Make & model"
          placeholder="e.g. Honda Odyssey"
        />
        <BogDropdown
          name="accessibility"
          label="Accessibility"
          options={[...VEHICLE_ACCESSIBILITY_OPTIONS]}
          placeholder="Select accessibility"
          value={vehicleAccessibility}
          onSelectionChange={(v) =>
            setVehicleAccessibility(typeof v === "string" ? v : v[0] ?? "None")
          }
        />
        <BogTextInput
          name="seatCount"
          label="Seat count"
          placeholder="Number"
          required
        />
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      </BogForm>
    );

  return (
    <div className="flex h-screen w-screen">
      <div className="py-20 px-10 bg-gradient-to-b from-[#D9D9D9] to-[#B2B2B2] w-[12%] min-w-fit">
        <div className="mb-[10vh]">
          <p>GT Paratransit</p>
          <h3>Dashboard</h3>
        </div>
        <div>
          <h4
            className={`rounded p-5 hover:cursor-pointer ${table === "Students" ? selected_gradient : ""}`}
            onClick={(e) => switchTable(e, "Students")}
          >
            Students
          </h4>
          <h4
            className={`rounded p-5 hover:cursor-pointer ${table === "Drivers" ? selected_gradient : ""}`}
            onClick={(e) => switchTable(e, "Drivers")}
          >
            Drivers
          </h4>
          <h4
            className={`rounded p-5 hover:cursor-pointer ${table === "Vehicles" ? selected_gradient : ""}`}
            onClick={(e) => switchTable(e, "Vehicles")}
          >
            Vehicles
          </h4>
          <h4
            className={`rounded p-5 hover:cursor-pointer ${table === "Admins" ? selected_gradient : ""}`}
            onClick={(e) => switchTable(e, "Admins")}
          >
            Admins
          </h4>
        </div>
      </div>
      <div className="py-20 px-10 relative flex-1">
        <div className="flex items-center gap-4 mb-[10vh]">
          <h1>{table}</h1>
          {canDelete && (
            <BogButton
              variant="primary"
              size="medium"
              onClick={handleDelete}
              disabled={deleting}
              style={{ backgroundColor: "#C73A3A", borderColor: "#C73A3A" }}
            >
              {deleting ? "Deleting…" : `Delete ${selectedRows.size} selected`}
            </BogButton>
          )}
        </div>
        {error && (
          <p className="mb-4 text-sm text-amber-700" role="status">
            {error}
          </p>
        )}
        {loading ? (
          <p className="text-gray-600">Loading…</p>
        ) : (
          <div>
            <BogTable
              style={
                {
                  marginBottom: "5vh",
                } as React.CSSProperties
              }
              columnHeaders={columns}
              rows={rows}
              selectedRows={selectedRows}
              onSelectedRowsChange={setSelectedRows}
              selectable={true}
            />
            <BogModal
              openState={{ open: modalOpen, setOpen: setModalOpen }}
              trigger={<BogButton>{triggerLabel}</BogButton>}
              title={<h3>{addTitle}</h3>}
              onOpenChange={(open) => {
              if (!open) {
                setSubmitError(null);
                setStudentAccessibilityNeeds("None");
                setVehicleAccessibility("None");
              }
            }}
            >
              {formContent}
            </BogModal>
          </div>
        )}
      </div>
    </div>
  );
}
