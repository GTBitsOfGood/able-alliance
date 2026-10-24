import { z } from "zod";
import { UserType } from "@db/generated/enums";

export const shiftSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6), // 0=Sun, 6=Sat
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
    endTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "Start time must be before end time",
    path: ["startTime"],
  });

export const notificationSettingsSchema = z.object({
  dailySummary: z.boolean().optional(),
  driverAssigned: z.boolean().optional(),
  driverEnRoute: z.boolean().optional(),
  rideCancelled: z.boolean().optional(),
  rideAssigned: z.boolean().optional(),
  rideCompleted: z.boolean().optional(),
  rideDelayed: z.boolean().optional(),
  newMessageFromDriver: z.boolean().optional(),
});

export const baseUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  preferredName: z.string().optional(),
  // GT Account username (the CAS `cas:user` value) — the primary identity for
  // CAS login. Required: a user provisioned without one can never log in.
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "username is required")
    .regex(/^[a-z0-9]+$/i, "username must be alphanumeric"),
  email: z
    .string()
    .trim()
    .check(z.email({ error: "Enter a valid email address" })),
  type: z.enum(UserType),
  settings: notificationSettingsSchema.optional(),
});

export const studentSchema = baseUserSchema.extend({
  type: z.literal("Student"),
  studentInfo: z.object({
    notes: z.string().optional(),
    accessibilityNeeds: z.array(z.string().min(1)).optional(),
  }),
});

export type BaseUserInput = z.infer<typeof baseUserSchema>;
export type StudentInput = z.infer<typeof studentSchema>;
export type Shift = z.infer<typeof shiftSchema>;
