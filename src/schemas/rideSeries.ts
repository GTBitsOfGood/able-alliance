import { z } from "zod";

import { idSchema } from "@/schemas/id";

/**
 * Only weekly recurrence exists for now. Kept as an enum so adding
 * biweekly/monthly later is a schema change rather than a shape change.
 */
export const recurrenceFrequencyEnum = z.enum(["weekly"]);
export type RecurrenceFrequency = z.infer<typeof recurrenceFrequencyEnum>;

/** Opt-in block the ride form sends alongside a normal create-ride payload. */
export const recurrenceRequestSchema = z
  .object({
    frequency: recurrenceFrequencyEnum.default("weekly"),
    /**
     * Eastern weekdays to repeat on, 0 = Sunday … 6 = Saturday. Must include the
     * first ride's weekday; defaults to only that day when omitted.
     */
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).optional(),
    /** Last Eastern calendar date (YYYY-MM-DD) to schedule on; omit to repeat indefinitely. */
    endsOn: z.iso
      .date({ error: "End date must be a valid calendar date (YYYY-MM-DD)" })
      .optional(),
  })
  .strict();

export type RecurrenceRequest = z.infer<typeof recurrenceRequestSchema>;

export const rideSeriesSchema = z
  .object({
    student: idSchema,
    pickupLocation: idSchema,
    dropoffLocation: idSchema,
    frequency: recurrenceFrequencyEnum,
    /** Eastern weekdays rides are scheduled on, 0 = Sunday … 6 = Saturday. */
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
    /** Pickup instant of the very first ride; every occurrence is derived from it. */
    firstPickupTime: z.coerce.date(),
    /** End of the last Eastern day a ride may be scheduled on; null repeats indefinitely. */
    endsAt: z.coerce.date().nullable(),
    /**
     * Pickup window stored as offsets from the pickup instant rather than absolute
     * times, so the window keeps the same shape on every occurrence (and across
     * a DST boundary) instead of drifting by an hour.
     */
    pickupWindowStartOffsetMs: z.number().int(),
    pickupWindowEndOffsetMs: z.number().int(),
    /**
     * Latest occurrence already processed. Moves forward only, which is what makes
     * the job idempotent and stops a cancelled ride from being recreated.
     */
    materializedThrough: z.coerce.date(),
    active: z.boolean().default(true),
  })
  .strict();

export type RideSeriesInput = z.infer<typeof rideSeriesSchema>;
