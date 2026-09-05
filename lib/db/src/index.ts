import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const configuredConnectionString =
  process.env.NEONCLASSICAL_DATABASE_URL ??
  process.env.NEON_DATABASE_URL ??
  process.env.DATABASE_URL;

if (!configuredConnectionString) {
  throw new Error(
    "NEONCLASSICAL_DATABASE_URL, NEON_DATABASE_URL, or DATABASE_URL must be set.",
  );
}

const connectionUrl = new URL(configuredConnectionString);
if (process.env.NEONCLASSICAL_DATABASE_URL) {
  connectionUrl.pathname = "/neondb";
}
const connectionString = connectionUrl.toString();

// Enable SSL for managed providers (Neon, Render, Supabase, etc.).
// Local URLs (localhost / 127.0.0.1) keep SSL off.
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
const sslDisabled = process.env.DATABASE_SSL === "false";
const useSsl = !isLocal && !sslDisabled;

export const pool = new Pool({
  connectionString,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
