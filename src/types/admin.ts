import type { Location, Vehicle } from "@db/generated/browser";

export type AdminTableType =
  "Students" | "Drivers" | "Vehicles" | "Locations" | "Admins";

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
export type AdminRowRaw = DriverRowRaw & {
  adminType: string;
};

/** Raw row shape for Vehicles table. */
export type VehicleRowRaw = Pick<Vehicle, "licensePlate" | "seatCount"> & {
  makeModel: string;
  accessibilityFeatures: string;
};

/** Raw row shape for Locations table */
export type LocationRowRaw = Pick<Location, "name" | "latitude" | "longitude">;

export type {
  AdminRouteResponse as RouteEntry,
  UserResponse as DriverEntry,
} from "./api";
export type { Vehicle as VehicleEntry } from "@db/generated/browser";

export type LngLat = { longitude: number; latitude: number };
