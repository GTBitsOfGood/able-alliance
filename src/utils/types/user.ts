import { z } from "zod";

export const baseUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Email is required"),
  type: z.enum(["Student", "Driver", "Admin", "SuperAdmin"]),
});

export const studentSchema = baseUserSchema.extend({
  type: z.literal("Student"),
  studentInfo: z.object({
    notes: z.string().optional(),
    accessibilityNeeds: z.enum(["Wheelchair", "LowMobility"]).optional(),
    GTID: z.string().min(9, "GTID must be 9 digits"),
  }),
});

export type BaseUserInput = z.infer<typeof baseUserSchema>;
export type StudentInput = z.infer<typeof studentSchema>;
