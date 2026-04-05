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

export const baseUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z
    .string()
    .email("Email is required")
    .regex(
      /^[\w-.]+@gatech\.edu$/,
      "Email must be a valid Georgia Tech email ending with @gatech.edu",
    ),
  type: z.enum(["Student", "Driver", "Admin", "SuperAdmin"]),
});

export const studentSchema = baseUserSchema.extend({
  type: z.literal("Student"),
  studentInfo: z.object({
    notes: z.string().optional(),
    accessibilityNeeds: z.enum(["Wheelchair", "LowMobility"]).optional(),
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
