import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@db/generated/client";

const globalDatabase = globalThis as typeof globalThis & {
  ableDatabase?: PrismaClient;
};
export const db =
  globalDatabase.ableDatabase ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
if (process.env.NODE_ENV !== "production") globalDatabase.ableDatabase = db;
