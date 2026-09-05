import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { visitorIdentity } from "./middlewares/access";
import { WebhookHandlers } from "./webhookHandlers";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res): Promise<void> => {
    const header = req.headers["stripe-signature"];
    const signature = Array.isArray(header) ? header[0] : header;
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature." });
      return;
    }
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, signature);
      res.status(200).json({ received: true });
    } catch (error) {
      req.log.error(
        { error: error instanceof Error ? error.message : error },
        "Stripe webhook processing failed",
      );
      res.status(400).json({ error: "Invalid Stripe webhook." });
    }
  },
);

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);
app.use("/api", visitorIdentity, router);

// In production, serve the built qr-course frontend from the same process.
// On Replit the deploy sidecar handles this; on Render (single web service)
// the API server serves both /api and the static SPA.
if (process.env.NODE_ENV === "production") {
  const candidates = [
    path.resolve(process.cwd(), "artifacts/qr-course/dist/public"),
    path.resolve(process.cwd(), "../qr-course/dist/public"),
    path.resolve(process.cwd(), "../../artifacts/qr-course/dist/public"),
  ];
  const staticDir = candidates.find((p) => fs.existsSync(p));

  if (staticDir) {
    const indexHtml = path.join(staticDir, "index.html");
    logger.info({ staticDir }, "Serving qr-course static bundle");
    app.use(express.static(staticDir, { index: false }));
    app.get(/^\/(?!api\/).*/, (_req, res, next) => {
      if (!fs.existsSync(indexHtml)) return next();
      res.sendFile(indexHtml);
    });
  } else {
    logger.warn(
      { tried: candidates },
      "qr-course static bundle not found; only /api will be served",
    );
  }
}

export default app;
