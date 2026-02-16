import type { ColumnHeaderCellContent } from "@/components/BogTable/BogTable";

/** Raw row shape for Students table (aligns with API). */
export type StudentRowRaw = {
  name: string;
  email: string;
  phone: string;
  accessibilityNeeds: string;
};

/** Raw row shape for Drivers table. */
export type DriverRowRaw = {
  name: string;
  email: string;
};

/** Raw row shape for Admins table. */
export type AdminRowRaw = {
  name: string;
  email: string;
};

/** Raw row shape for Vehicles table. */
export type VehicleRowRaw = {
  licensePlate: string;
  makeModel: string;
  accessibilityFeatures: string;
  seatCount: number;
};

export const STUDENT_COLUMNS: ColumnHeaderCellContent[] = [
  { content: "Name", datatype: "string" },
  { content: "Email", datatype: "string" },
  { content: "Phone", datatype: "string" },
  { content: "Accessibility needs", datatype: "string" },
];

export const DRIVER_COLUMNS: ColumnHeaderCellContent[] = [
  { content: "Name", datatype: "string" },
  { content: "Email", datatype: "string" },
];

export const ADMIN_COLUMNS: ColumnHeaderCellContent[] = [
  { content: "Name", datatype: "string" },
  { content: "Email", datatype: "string" },
];

export const VEHICLE_COLUMNS: ColumnHeaderCellContent[] = [
  { content: "License Plate", datatype: "string" },
  { content: "Make & Model", datatype: "string" },
  { content: "Accessibility Features", datatype: "string" },
  { content: "Seat Count", datatype: "number" },
];
