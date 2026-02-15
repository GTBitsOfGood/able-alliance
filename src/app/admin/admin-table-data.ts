import type { ColumnHeaderCellContent } from "@/components/BogTable/BogTable";

/** Raw row shape for Students table (aligns with API / fallback). */
export type StudentRowRaw = {
  name: string;
  email: string;
  phone: string;
  ramp: boolean;
  status: string;
  active: "checked" | "unchecked" | "indeterminate";
};

/** Raw row shape for Drivers table. */
export type DriverRowRaw = {
  preferredName: string;
  email: string;
  phone: string;
  vehicle: string;
};

/** Raw row shape for Vehicles table. */
export type VehicleRowRaw = {
  licensePlate: string;
  makeModel: string;
  assignedDriver: string;
  accessibilityFeatures: string;
};

export const STUDENT_COLUMNS: ColumnHeaderCellContent[] = [
  { content: "Name", datatype: "string" },
  { content: "Email", datatype: "string" },
  { content: "Phone", datatype: "string" },
  { content: "Ramp", datatype: "other" },
  { content: "Status", datatype: "string" },
  { content: "Active", datatype: "other" },
];

export const DRIVER_COLUMNS: ColumnHeaderCellContent[] = [
  { content: "Preferred Name", datatype: "string" },
  { content: "Email", datatype: "string" },
  { content: "Phone", datatype: "string" },
  { content: "Vehicle", datatype: "string" },
];

export const VEHICLE_COLUMNS: ColumnHeaderCellContent[] = [
  { content: "License Plate", datatype: "string" },
  { content: "Make & Model", datatype: "string" },
  { content: "Assigned Driver", datatype: "string" },
  { content: "Accessibility Features", datatype: "string" },
];

/** Fallback data when API is unavailable or not fully set up. */
export const FALLBACK_STUDENT_ROWS: StudentRowRaw[] = [
  {
    name: "Chen, Johnny",
    email: "jchen3314@gatech.edu",
    phone: "262-327-3933",
    ramp: true,
    status: "Current",
    active: "indeterminate",
  },
];

export const FALLBACK_DRIVER_ROWS: DriverRowRaw[] = [
  {
    preferredName: "Johnny",
    email: "jchen3314@gatech.edu",
    phone: "262-327-3933",
    vehicle: "car",
  },
];

export const FALLBACK_VEHICLE_ROWS: VehicleRowRaw[] = [
  {
    licensePlate: "asdfalsjdf",
    makeModel: "honda odyssey",
    assignedDriver: "johnny",
    accessibilityFeatures: "ramp",
  },
];
