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

export const routeSchema = z.object({
  pickupLocation: locationSchema,
  dropoffLocation: locationSchema,
  student: userSchema,
  driver: userSchema,
  vehicle: vehicleSchema,
  scheduledPickupTime: z.date(),
  isActive: z.boolean(),
});

export type RouteInput = z.infer<typeof routeSchema>;
