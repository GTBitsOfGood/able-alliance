import { z } from "zod";

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

const notificationSchema = z.object({
  dailySummary: z.boolean().default(false),
  driverAssigned: z.boolean().default(false),
  driverEnRoute: z.boolean().default(false),
  rideCancelled: z.boolean().default(false),
  rideAssigned: z.boolean().default(false),
  rideCompleted: z.boolean().default(false),
});

const userSettingsSchema = z.object({
  notifications: notificationSchema.default({}),
});

export const baseUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  preferredName: z.string().optional(),
  // GT Account username (the CAS `cas:user` value) — the primary identity for
  // CAS login. Optional here so the admin create-user flow keeps working until
  // that form collects it; see the CAS callback for the matching rules.
  gtUsername: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+$/i, "GT username must be alphanumeric")
    .optional(),
  email: z
    .string()
    .email("Email is required")
    .regex(
      /^[\w-.]+@gatech\.edu$/,
      "Email must be a valid Georgia Tech email ending with @gatech.edu",
    ),
  type: z.enum(["Student", "Driver", "Admin", "SuperAdmin"]),
  settings: userSettingsSchema.default({}),
});

export const studentSchema = baseUserSchema.extend({
  type: z.literal("Student"),
  studentInfo: z.object({
    notes: z.string().optional(),
    accessibilityNeeds: z.array(z.string().min(1)).optional(),
  }),
});

export const driverSchema = baseUserSchema.extend({
  type: z.literal("Driver"),
  shifts: z.array(shiftSchema).default([]),
});

export type BaseUserInput = z.infer<typeof baseUserSchema>;
export type StudentInput = z.infer<typeof studentSchema>;
export type DriverInput = z.infer<typeof driverSchema>;
export type Shift = z.infer<typeof shiftSchema>;
