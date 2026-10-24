import { z } from "zod";

export const idSchema = z.uuid();
export const isValidId = (id: unknown): id is string =>
  idSchema.safeParse(id).success;
