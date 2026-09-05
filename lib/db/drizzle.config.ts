import { defineConfig } from "drizzle-kit";
import path from "path";

const configuredConnectionString =
  process.env.NEONCLASSICAL_DATABASE_URL ??
  process.env.NEON_DATABASE_URL ??
  process.env.DATABASE_URL;

if (!configuredConnectionString) {
  throw new Error(
    "NEONCLASSICAL_DATABASE_URL, NEON_DATABASE_URL, or DATABASE_URL must be set",
  );
}

const connectionUrl = new URL(configuredConnectionString);
if (process.env.NEONCLASSICAL_DATABASE_URL) {
  connectionUrl.pathname = "/neondb";
}
const connectionString = connectionUrl.toString();

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
