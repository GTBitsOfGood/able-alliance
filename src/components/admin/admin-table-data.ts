import type { ColumnHeaderCellContent } from "@/components/BogTable/BogTable";

/** Display labels for admin user types. */
export const ADMIN_TYPE_LABELS = {
  Admin: "Admin",
  SuperAdmin: "Super Admin",
} as const;

export const STUDENT_COLUMNS: ColumnHeaderCellContent[] = [
  { content: "Name", datatype: "string" },
  { content: "Email", datatype: "string" },
  { content: "Accessibility needs", datatype: "string" },
  { content: "Additional comments", datatype: "string" },
];

export const DRIVER_COLUMNS: ColumnHeaderCellContent[] = [
  { content: "Name", datatype: "string" },
  { content: "Email", datatype: "string" },
];

export const ADMIN_COLUMNS: ColumnHeaderCellContent[] = [
  { content: "Name", datatype: "string" },
  { content: "Email", datatype: "string" },
  { content: "Admin Type", datatype: "string" },
];

export const VEHICLE_COLUMNS: ColumnHeaderCellContent[] = [
  { content: "License Plate", datatype: "string" },
  { content: "Make & Model", datatype: "string" },
  { content: "Accessibility Features", datatype: "string" },
  { content: "Seat Count", datatype: "number" },
];

export const LOCATION_COLUMNS: ColumnHeaderCellContent[] = [
  { content: "Location", datatype: "string" },
  { content: "Latitude", datatype: "number" },
  { content: "Longitude", datatype: "number" },
];
