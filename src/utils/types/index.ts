import { z } from "zod";

export const locationSchema = z.object({
  name: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
});

export type LocationInput = z.infer<typeof locationSchema>;
