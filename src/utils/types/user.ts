import { z } from "zod";

export const baseUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  preferredName: z.string().optional(),
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
    accessibilityNeeds: z.array(z.string().min(1)).optional(),
  }),
});

export type BaseUserInput = z.infer<typeof baseUserSchema>;
export type StudentInput = z.infer<typeof studentSchema>;
