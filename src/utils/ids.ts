import { idSchema } from "@/schemas/id";

export const isValidId = (id: unknown): id is string =>
  idSchema.safeParse(id).success;
