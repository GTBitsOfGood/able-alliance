import { z } from "zod";

export const locationSchema = z.object({
  name: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
});

export type LocationInput = z.infer<typeof locationSchema>;

export const userSchema = z.object({
  name: z.string().min(1),
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

export const routeSchema = z.object({
  pickupLocation: objectIdString,
  dropoffLocation: objectIdString,
  student: objectIdString,
  driver: objectIdString.optional(),
  vehicle: objectIdString.optional(),
  scheduledPickupTime: z.coerce.date(),
  isActive: z.boolean().default(false),
});

export type RouteInput = z.infer<typeof routeSchema>;
