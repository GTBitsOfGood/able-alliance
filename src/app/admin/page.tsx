"use client";

import BogTable from "@/components/BogTable/BogTable";
import BogForm from "@/components/BogForm/BogForm";
import BogButton from "@/components/BogButton/BogButton";
import BogTextInput from "@/components/BogTextInput/BogTextInput";
import BogDropdown from "@/components/BogDropdown/BogDropdown";
import React, { useState, useEffect } from "react";

const STUDENT_ACCESSIBILITY_OPTIONS = [
  "None",
  "Wheelchair",
  "LowMobility",
] as const;
const VEHICLE_ACCESSIBILITY_OPTIONS = ["None", "Wheelchair"] as const;
import { useAdminTableData, type AdminTableType } from "./useAdminTableData";
import RidesTable from "./RidesTable";
import BogIcon from "@/components/BogIcon/BogIcon";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Form } from "radix-ui";

const selected_color = "bg-[var(--color-admin-bg)]";

export default function Admin() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [table, setTable] = useState<AdminTableType>("Students");
  const [showForm, setShowForm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { columns, rows, rowIds, loading, error, deleteRows, refetch } =
    useAdminTableData(table);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [studentAccessibilityNeeds, setStudentAccessibilityNeeds] =
    useState<string>("None");
  const [vehicleAccessibility, setVehicleAccessibility] =
    useState<string>("None");

  const userType = session?.user?.type;
  useEffect(() => {
    if (
      status !== "loading" &&
      userType !== "Admin" &&
      userType !== "SuperAdmin"
    ) {
      router.replace("/");
    }
  }, [status, userType, router]);

  if (
    status === "loading" ||
    (userType !== "Admin" && userType !== "SuperAdmin")
  ) {
    return null;
  }

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
    setShowForm(false);
    setSubmitError(null);
  };

  const handleAddStudent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    const form = e.currentTarget;
    const firstName = (
      form.elements.namedItem("firstName") as HTMLInputElement
    ).value.trim();
    const lastName = (
      form.elements.namedItem("lastName") as HTMLInputElement
    ).value.trim();
    const email = (
      form.elements.namedItem("email") as HTMLInputElement
    ).value.trim();
    const additionalComments = (
      form.elements.namedItem("additionalComments") as HTMLInputElement
    ).value.trim();

    if (!firstName || !lastName || !email) {
      setSubmitError("First name, last name, and email are required.");
      return;
    }

    const studentInfo: {
      notes?: string;
      accessibilityNeeds?: "Wheelchair" | "LowMobility";
    } = {
      ...(additionalComments && { notes: additionalComments }),
      ...(studentAccessibilityNeeds &&
        studentAccessibilityNeeds !== "None" && {
          accessibilityNeeds: studentAccessibilityNeeds as
            | "Wheelchair"
            | "LowMobility",
        }),
    };
    fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "Student",
        firstName,
        lastName,
        email,
        studentInfo,
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
        setSubmitError(err.message ?? "Failed to create student."),
      );
  };

  const handleAddAdmin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    const form = e.currentTarget;
    const firstName = (
      form.elements.namedItem("firstName") as HTMLInputElement
    ).value.trim();
    const lastName = (
      form.elements.namedItem("lastName") as HTMLInputElement
    ).value.trim();
    const email = (
      form.elements.namedItem("email") as HTMLInputElement
    ).value.trim();

    if (!firstName || !lastName || !email) {
      setSubmitError("First name, last name, and email are required.");
      return;
    }

    fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "Admin", firstName, lastName, email }),
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
        setSubmitError(err.message ?? "Failed to create admin."),
      );
  };

  const handleAddDriver = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    const form = e.currentTarget;
    const firstName = (
      form.elements.namedItem("firstName") as HTMLInputElement
    ).value.trim();
    const lastName = (
      form.elements.namedItem("lastName") as HTMLInputElement
    ).value.trim();
    const email = (
      form.elements.namedItem("email") as HTMLInputElement
    ).value.trim();

    if (!firstName || !lastName || !email) {
      setSubmitError("First name, last name, and email are required.");
      return;
    }

    fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "Driver", firstName, lastName, email }),
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
    const latitude = parseFloat(
      (form.elements.namedItem("latitude") as HTMLInputElement).value,
    );
    const longitude = parseFloat(
      (form.elements.namedItem("longitude") as HTMLInputElement).value,
    );

    if (!name) {
      setSubmitError("Location name is required.");
      return;
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setSubmitError("Latitude and longitude must be valid numbers.");
      return;
    }

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
        form.reset();
      })
      .catch((err: Error) =>
        setSubmitError(err.message ?? "Failed to create location."),
      );
  };

  const addLabel = `${table === "Locations" ? "Add Location" : table === "Vehicles" ? "Add Vehicle" : "Invite New Student"}`;

  const formContent =
    table === "Students" ? (
      // <BogForm
      //   onSubmit={handleAddStudent}
      //   submitLabel="Invite"
      //   className="flex flex-col flex-shrink gap-[4.3rem] border rounded-[0.8rem] text-[1.6rem] p-10 border-[var(--color-grey-off-state)]"
      // >
      //   <div className="flex flex-row gap-[5.8rem]  ">
      //     <BogTextInput
      //       name="firstName"
      //       label="First Name"
      //       placeholder="ex: George"
      //       className="flex flex-1 max-w-xl w-full"
      //       required
      //     />
      //     <BogTextInput
      //       name="lastName"
      //       label="Last Name"
      //       placeholder="ex: Burdell"
      //       className="flex flex-1 max-w-xl"
      //       required
      //     />
      //   </div>
      //   <div className="flex flex-row gap-[5.8rem]">
      //     <BogTextInput
      //       name="preferredName"
      //       label="Preferred Name"
      //       placeholder="Buzz"
      //       className="flex flex-1 max-w-xl"
      //     />
      //     <BogTextInput
      //       name="email"
      //       type="email"
      //       label="GT Email"
      //       placeholder="gburdell01@gatech.edu"
      //       className="flex flex-1 max-w-xl"
      //       required
      //     />
      //   </div>
      //   <div className="flex flex-row gap-[5.8rem]">
      //     <BogDropdown
      //       name="accessibilityNeeds"
      //       label="Accessibility needs"
      //       options={[...STUDENT_ACCESSIBILITY_OPTIONS]}
      //       placeholder="Select accessibility needs"
      //       className="flex flex-1 max-w-xl"
      //       value={studentAccessibilityNeeds}
      //       onSelectionChange={(v) =>
      //         setStudentAccessibilityNeeds(
      //           typeof v === "string" ? v : (v[0] ?? "None"),
      //         )
      //       }
      //     />
      //     <BogTextInput
      //       name="additionalComments"
      //       label="Additional Notes"
      //       placeholder="Add any additional information here."
      //       className="flex flex-1 max-w-xl"
      //     />
      //   </div>
      //   <div className="flex flex-row gap-[5.8rem]">
      //     <BogTextInput
      //       name="inviteMessage"
      //       label="Invite message"
      //       placeholder="Add custom invite message here."
      //       className="flex w-full"
      //     />
      //   </div>
      //   {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      // </BogForm>
      <div className="flex flex-row">
        <Form.Root
          onSubmit={handleAddStudent}
          className="flex flex-col gap-[4.3rem] text-[1.6rem] px-[3.2rem] py-[2.4rem] max-w-full basis-[82.5rem] shrink border rounded-[0.8rem] border-[var(--color-grey-off-state)]"
          // style={style}
        >
          <div className="flex flex-row flex-1 flex-wrap gap-[5.8rem]">
            <BogTextInput
              name="firstName"
              label="First Name"
              placeholder="George"
              className="flex-1 basis-[20rem] max-w-[35rem] gap-3"
              required
            />
            <BogTextInput
              name="lastName"
              label="Last Name"
              placeholder="Burdell"
              className="flex-1 basis-[20rem] max-w-[35rem] gap-3"
              required
            />
          </div>
          <div className="flex flex-row flex-1 flex-wrap gap-[5.8rem]">
            <BogTextInput
              name="preferredName"
              label="Preferred Name"
              placeholder="Buzz"
              className="flex-1 basis-[20rem] max-w-[35rem] gap-3"
            />
            <BogTextInput
              name="email"
              type="email"
              label="GT Email"
              placeholder="gburdell01@gatech.edu"
              className="flex-1 basis-[20rem] max-w-[35rem] gap-3"
              required
            />
          </div>
          <div className="flex flex-row flex-1 flex-wrap gap-[5.8rem]">
            <div className="flex flex-col flex-1 basis-[20rem] max-w-[35rem] gap-3">
              <BogDropdown
                name="accessibilityNeeds"
                label="Accommodations"
                options={[...STUDENT_ACCESSIBILITY_OPTIONS]}
                placeholder="Select from list"
                className=""
                value={studentAccessibilityNeeds}
                onSelectionChange={(v) =>
                  setStudentAccessibilityNeeds(
                    typeof v === "string" ? v : (v[0] ?? "None"),
                  )
                }
                required
              />
              {STUDENT_ACCESSIBILITY_OPTIONS.includes(
                studentAccessibilityNeeds as any,
              ) &&
                studentAccessibilityNeeds !== "None" && (
                  <span
                    className="bg-[#EFEDED] p-1"
                    onClick={() => setStudentAccessibilityNeeds("None")}
                  >
                    x&nbsp;&nbsp;{studentAccessibilityNeeds}
                  </span>
                )}
            </div>
            <BogTextInput
              name="additionalComments"
              label="Additional Notes"
              placeholder="Add any additional information here."
              className="flex-1 basis-[20rem] max-w-[35rem] gap-3"
            />
          </div>
          <div className="flex flex-row flex-1 flex-wrap gap-[5.8rem]">
            <BogTextInput
              name="inviteMessage"
              label="Invite message"
              placeholder="Add custom invite message here."
              className="flex w-full"
              multiline={true}
            />
          </div>
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <Form.Submit asChild>
            <BogButton
              type="submit"
              className="bg-[var(--color-checkbox-checked)] rounded-[0.4rem] w-max"
            >
              {"Invite"}
            </BogButton>
          </Form.Submit>
        </Form.Root>
      </div>
    ) : table === "Drivers" ? (
      <BogForm onSubmit={handleAddDriver} submitLabel="Create driver">
        <div className="flex gap-20">
          <BogTextInput
            name="firstName"
            label="First Name"
            placeholder="George"
            className="flex-1"
            required
          />
          <BogTextInput
            name="lastName"
            label="Last Name"
            placeholder="Burdell"
            className="flex-1"
            required
          />
        </div>
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
        <div className="flex gap-20">
          <BogTextInput
            name="firstName"
            label="First Name"
            placeholder="ex: George"
            className="flex-1"
            required
          />
          <BogTextInput
            name="lastName"
            label="Last Name"
            placeholder="ex: Burdell"
            className="flex-1"
            required
          />
        </div>
        <BogTextInput
          name="email"
          type="email"
          label="Email"
          placeholder="email@example.com"
          required
        />
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      </BogForm>
    ) : table === "Locations" ? (
      <BogForm onSubmit={handleAddLocation} submitLabel="Create location">
        <BogTextInput
          name="name"
          label="Location name"
          placeholder="e.g. Campus Recreation Center"
          required
        />
        <BogTextInput
          name="latitude"
          label="Latitude"
          placeholder="e.g. 33.7756"
          required
        />
        <BogTextInput
          name="longitude"
          label="Longitude"
          placeholder="e.g. -84.3963"
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
            setVehicleAccessibility(
              typeof v === "string" ? v : (v[0] ?? "None"),
            )
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
      <div className="relative py-20 px-10 w-[12%] min-w-fit shadow-sm flex flex-col">
        <div className="mb-[10vh]">
          <h3>GT Paratransit</h3>
        </div>
        <div>
          <h4
            className={`rounded-md p-5 hover:cursor-pointer ${table === "Students" ? selected_color : ""}`}
            onClick={(e) => switchTable(e, "Students")}
          >
            Students
          </h4>
          <h4
            className={`rounded-md p-5 hover:cursor-pointer ${table === "Drivers" ? selected_color : ""}`}
            onClick={(e) => switchTable(e, "Drivers")}
          >
            Drivers
          </h4>
          <h4
            className={`rounded-md p-5 hover:cursor-pointer ${table === "Vehicles" ? selected_color : ""}`}
            onClick={(e) => switchTable(e, "Vehicles")}
          >
            Vehicles
          </h4>
          <h4
            className={`rounded-md p-5 hover:cursor-pointer ${table === "Locations" ? selected_color : ""}`}
            onClick={(e) => switchTable(e, "Locations")}
          >
            Locations
          </h4>
          <h4
            className={`rounded-md p-5 hover:cursor-pointer ${table === "Rides" ? selected_color : ""}`}
            onClick={(e) => switchTable(e, "Rides")}
          >
            Ride List
          </h4>
          {userType === "SuperAdmin" ? (
            <h4
              className={`rounded-md p-5 hover:cursor-pointer ${table === "Admins" ? selected_color : ""}`}
              onClick={(e) => switchTable(e, "Admins")}
            >
              Admins
            </h4>
          ) : (
            ""
          )}
        </div>
        <div className="mt-auto pt-10 flex items-center gap-8 border-t-1 border-t-[var(--color-grey-stroke-weak)]">
          <div className="flex items-center justify-center rounded-full bg-[var(--color-admin-bg)] font-semibold shrink-0 w-[3.2rem] h-[3.2rem] text-[1.4rem]">
            {session?.user?.firstName?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-[1.3rem] leading-tight truncate">
              {session?.user?.firstName} {session?.user?.lastName}
            </span>
            <span className="text-[1.1rem] text-gray-500 leading-tight">
              {userType}
            </span>
          </div>
        </div>
      </div>
      <div className="py-20 px-20 relative flex flex-col flex-1 w-full">
        {showForm ? (
          <>
            <div className="flex flex-col gap-4 mb-[2.4rem]">
              <div className="flex text-paragraph-1 gap-2">
                <button
                  className="flex items-center gap-2 hover:cursor-pointer"
                  onClick={() => {
                    setShowForm(false);
                    setSubmitError(null);
                    setStudentAccessibilityNeeds("None");
                    setVehicleAccessibility("None");
                  }}
                >
                  <BogIcon name="arrow-left" size={20} />
                </button>
                Back to rides
              </div>
              <h1>{addLabel}</h1>
            </div>
            {formContent}
          </>
        ) : (
          <>
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
                  {deleting
                    ? "Deleting…"
                    : `Delete ${selectedRows.size} selected`}
                </BogButton>
              )}
            </div>
            {table === "Rides" ? (
              <RidesTable />
            ) : (
              <>
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
                      style={{ marginBottom: "5vh" } as React.CSSProperties}
                      columnHeaders={columns}
                      rows={rows}
                      selectedRows={selectedRows}
                      onSelectedRowsChange={setSelectedRows}
                      selectable={true}
                    />
                    <button
                      className="absolute bottom-[10%] right-[5%] rounded-full bg-[#D9D9D9] px-5 py-5 text-white hover:bg-[#a1a1a1] cursor-pointer"
                      onClick={() => setShowForm(true)}
                    >
                      <BogIcon name="plus" size={40} color="white" />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
