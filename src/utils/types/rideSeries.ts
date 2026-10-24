import { z } from "zod";

import { idSchema } from "../ids";

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
  })
  .strict();

export type RecurrenceRequest = z.infer<typeof recurrenceRequestSchema>;

export const rideSeriesSchema = z
  .object({
    student: idSchema,
    pickupLocation: idSchema,
    dropoffLocation: idSchema,
    frequency: recurrenceFrequencyEnum,
    /** Pickup instant of the very first ride; every occurrence is derived from it. */
    firstPickupTime: z.coerce.date(),
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

/** Result of one materialization pass, surfaced for logging and tests. */
export type MaterializeResult = {
  seriesProcessed: number;
  ridesCreated: number;
  ridesSkipped: number;
};
