---
name: External Neon database override
description: The app uses NEON_DATABASE_URL ahead of Replit's runtime-managed DATABASE_URL.
---

# External Neon database selection

The app and Drizzle schema tooling must resolve the connection as `NEON_DATABASE_URL ?? DATABASE_URL`. Never ask the user to replace the runtime-managed `DATABASE_URL`; Replit injects it and it can shadow a same-named secret.

**Why:** `DATABASE_URL` is runtime-managed and previously forced the app onto the platform database even when the owner supplied a Neon connection. A separate secret name avoids that collision and makes the selected database explicit.

**How to apply:** keep runtime code and schema tooling on the same precedence rule. After adding or changing `NEON_DATABASE_URL`, push the schema, restart the API, and verify through a safe diagnostic that reports only “Neon configured,” never connection details.

## Post-switch schema push
After switching to the external database:

- **Re-run the schema push against the NEW DB.** A push done against the platform database does not migrate Neon. The schema command must use the same `NEON_DATABASE_URL` precedence as runtime.
- **Stale log files mislead.** `/tmp/logs/*api-server*` keeps pre-fix boots; always `refresh_all_logs` and read the newest file before concluding the DB is broken.
