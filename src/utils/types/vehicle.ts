import { z } from "zod";

export const accessibilityEnum = z.enum(["None", "Wheelchair"]);

export const vehicleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  licensePlate: z.string().min(1, "License plate is required"),
  description: z.string().optional(),
  accessibility: accessibilityEnum,
  seatCount: z
    .number({ invalid_type_error: "Seat count must be a number" })
    .int("Seat count must be an integer")
    .min(1, "Seat count must be greater than 0"),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;
