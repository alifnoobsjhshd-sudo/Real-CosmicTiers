import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

const connectionString = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("NEON_DATABASE_URL (or DATABASE_URL) environment variable is required");
}

const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });
