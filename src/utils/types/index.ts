import { z } from "zod";
import { idSchema } from "../ids";
import { recurrenceRequestSchema } from "./rideSeries";

export const locationSchema = z.object({
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type LocationInput = z.infer<typeof locationSchema>;

/** Schema for POST /api/routes only: no status, driver, or vehicle (use schedule for those). */
export const createRouteSchema = z
  .object({
    pickupLocation: idSchema,
    dropoffLocation: idSchema,
    student: idSchema,
    scheduledPickupTime: z.coerce.date(),
    pickupWindowStart: z.coerce.date(),
    pickupWindowEnd: z.coerce.date(),
  })
  .strict();

export type CreateRouteInput = z.infer<typeof createRouteSchema>;

export const batchRideRequestSchema = z
  .object({
    rides: z
      .array(
        z
          .object({
            pickupLocation: idSchema,
            dropoffLocation: idSchema,
            scheduledPickupTime: z.coerce.date(),
            pickupWindowStart: z.coerce.date(),
            pickupWindowEnd: z.coerce.date(),
            recurring: recurrenceRequestSchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(25),
  })
  .strict();

export type BatchRideRequest = z.infer<typeof batchRideRequestSchema>;

export const editRouteSchema = createRouteSchema.omit({ student: true });

export type EditRouteInput = z.infer<typeof editRouteSchema>;

export const rideReviewSchema = z
  .object({
    action: z.enum(["accept", "decline"]),
    changeId: idSchema,
  })
  .strict();
