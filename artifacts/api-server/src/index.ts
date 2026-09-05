import app from "./app";
import { logger } from "./lib/logger";
import { seedIfEmpty, seedReasoningPrimersIfMissing } from "./lib/seed";
import { seedDiagnosticsIfEmpty } from "./lib/seedDiagnostics";
import { storage } from "./storage";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await storage.ensureUniqueVisitorsTable();

seedIfEmpty()
  .then(() => seedReasoningPrimersIfMissing())
  .then(() => seedDiagnosticsIfEmpty())
  .catch((err) => {
    logger.error({ err }, "Seed failed");
  });

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
