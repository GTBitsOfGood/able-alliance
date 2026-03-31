import { z } from "zod";

export const locationSchema = z.object({
  name: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
});

export type LocationInput = z.infer<typeof locationSchema>;

export const userSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
});

export type UserInput = z.infer<typeof userSchema>;

export const vehicleSchema = z.object({
  name: z.string().min(1),
  licensePlate: z.string().min(1),
  capacity: z.number().int().nonnegative(),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

/** 24-char hex string for MongoDB ObjectId refs */
const objectIdString = z
  .string()
  .length(24)
  .regex(/^[a-f0-9]{24}$/i);

export const routeStatusEnum = z.enum([
  "Requested",
  "Scheduled",
  "En-route",
  "Pickedup",
  "Completed",
  "Missing",
  "Cancelled by Driver",
  "Cancelled by Student",
  "Cancelled by Admin",
]);

export const routeSchema = z.object({
  pickupLocation: objectIdString,
  pickupWindowStart: z.coerce.date(),
  pickupWindowEnd: z.coerce.date(),
  dropoffLocation: objectIdString,
  student: objectIdString,
  driver: objectIdString.optional(),
  vehicle: objectIdString.optional(),
  scheduledPickupTime: z.coerce.date(),
  status: routeStatusEnum.default("Requested"),
});

/** Schema for POST /api/routes only: no status, driver, or vehicle (use schedule for those). */
export const createRouteSchema = z
  .object({
    pickupLocation: objectIdString,
    dropoffLocation: objectIdString,
    student: objectIdString,
    scheduledPickupTime: z.coerce.date(),
    pickupWindowStart: z.coerce.date(),
    pickupWindowEnd: z.coerce.date(),
  })
  .strict();

export type RouteInput = z.infer<typeof routeSchema>;
export type CreateRouteInput = z.infer<typeof createRouteSchema>;
