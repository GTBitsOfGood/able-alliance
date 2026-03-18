import type { ColumnHeaderCellContent } from "@/components/BogTable/BogTable";

/** Raw row shape for Students table (aligns with API). */
export type StudentRowRaw = {
  name: string;
  email: string;
  accessibilityNeeds: string;
  additionalComments: string;
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

/** Raw row shape for Locations table */
export type LocationRowRaw = {
  name: string;
  latitude: number;
  longitude: number;
};

/** Raw row shape for Rides table (data only; dropdowns are rendered in RidesTable). */
export type RouteRowRaw = {
  routeId: string;
  student: string;
  driverId: string | null;
  vehicleId: string | null;
  pickup_loc: string;
  pickup_time: string;
  dropoff_loc: string;
  dropoff_time: string;
};

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

export const RIDE_COLUMNS: ColumnHeaderCellContent[] = [
  { content: "Student", datatype: "string" },
  { content: "Driver", datatype: "other" },
  { content: "Vehicle", datatype: "other" },
  { content: "Pickup Location", datatype: "string" },
  { content: "Pickup Time", datatype: "string" },
  { content: "Dropoff Location", datatype: "string" },
  { content: "Dropoff Time", datatype: "string" },
  { content: "Actions", datatype: "other" },
]