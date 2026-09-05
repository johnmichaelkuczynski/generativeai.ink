import { Router, type IRouter, type Request } from "express";
import { db, uniqueVisitorsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateBillingPortalResponse,
  CreateSubscriptionCheckoutResponse,
  GetAccessStatusResponse,
} from "@workspace/api-zod";
import {
  ANONYMOUS_LIMIT,
  SIGNED_IN_LIMIT,
  localUser,
  subscriptionAccess,
} from "../middlewares/access";
import { getUncachableStripeClient } from "../stripeClient";

const router: IRouter = Router();
function monthlyPriceId(): string {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId?.startsWith("price_")) {
    throw new Error("STRIPE_PRICE_ID is not configured.");
  }
  return priceId;
}

function appOrigin(req: Request): string {
  const host = (
    req.get("x-forwarded-host")?.split(",")[0] ??
    req.get("host") ??
    ""
  ).trim();
  const hostname = host.split(":")[0]?.toLowerCase();
  const allowedHosts = new Set(
    [
      ...(process.env.REPLIT_DOMAINS?.split(",") ?? []),
      process.env.REPLIT_DEV_DOMAIN,
      ...(process.env.NODE_ENV === "development"
        ? ["localhost", "127.0.0.1"]
        : []),
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim().split(":")[0]!.toLowerCase()),
  );
  if (!hostname || !allowedHosts.has(hostname)) {
    throw new Error("The checkout return host is not allowed.");
  }
  const protocol =
    hostname === "localhost" || hostname === "127.0.0.1" ? "http" : "https";
  return `${protocol}://${host}`;
}

router.get("/access/status", async (req, res): Promise<void> => {
  const visitorId = res.locals.visitorId as string;
  const [visitor] = await db
    .select()
    .from(uniqueVisitorsTable)
    .where(eq(uniqueVisitorsTable.visitorId, visitorId));
  const access = await subscriptionAccess(req);
  const totalUserActions = access.user?.aiActions ?? 0;
  const anonymousUsed = Math.min(ANONYMOUS_LIMIT, visitor?.aiActions ?? 0);
  const signedInUsed = access.user
    ? Math.min(SIGNED_IN_LIMIT, totalUserActions)
    : 0;
  const remaining = access.paid
    ? null
    : access.user
      ? Math.max(0, SIGNED_IN_LIMIT - signedInUsed)
      : Math.max(0, ANONYMOUS_LIMIT - anonymousUsed);
  res.json(
    GetAccessStatusResponse.parse({
      signedIn: Boolean(access.user),
      paid: access.paid,
      unlimited: access.paid,
      anonymousUsed,
      anonymousLimit: ANONYMOUS_LIMIT,
      signedInUsed,
      signedInLimit: SIGNED_IN_LIMIT,
      remaining,
      subscriptionStatus: access.status,
    }),
  );
});

router.post("/access/checkout", async (req, res): Promise<void> => {
  const access = await subscriptionAccess(req);
  const user = access.user;
  if (!user) {
    res.status(401).json({ error: "Sign in with Google before checkout." });
    return;
  }
  const stripe = await getUncachableStripeClient();
  const priceId = monthlyPriceId();
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (
      !price.livemode ||
      !price.active ||
      price.type !== "recurring" ||
      price.recurring?.interval !== "month"
    ) {
      res.status(503).json({
        error: "Live monthly billing is not available in this environment.",
      });
      return;
    }
  } catch (error) {
    req.log.warn({ error }, "Live Stripe price verification failed");
    res.status(503).json({
      error: "Live monthly billing is not available in this environment.",
    });
    return;
  }
  if (access.paid && user.stripeCustomerId) {
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appOrigin(req)}/dashboard`,
    });
    res.json(CreateSubscriptionCheckoutResponse.parse({ url: portal.url }));
    return;
  }
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      ...(user.email ? { email: user.email } : {}),
      name: user.displayName ?? undefined,
      metadata: { clerkUserId: user.clerkId!, appUserId: String(user.id) },
    });
    customerId = customer.id;
    await db
      .update(usersTable)
      .set({ stripeCustomerId: customerId })
      .where(eq(usersTable.id, user.id));
  }
  const origin = appOrigin(req);
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard?checkout=success`,
    cancel_url: `${origin}/dashboard?checkout=cancelled`,
    subscription_data: {
      metadata: { clerkUserId: user.clerkId!, appUserId: String(user.id) },
    },
    metadata: { clerkUserId: user.clerkId!, appUserId: String(user.id) },
    allow_promotion_codes: true,
    custom_text: {
      submit: {
        message:
          "Your recurring monthly subscription unlocks unlimited app use.",
      },
    },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  res.json(CreateSubscriptionCheckoutResponse.parse({ url: session.url }));
});

router.post("/access/portal", async (req, res): Promise<void> => {
  const user = await localUser(req);
  if (!user?.stripeCustomerId) {
    res.status(404).json({ error: "No billing account exists for this user." });
    return;
  }
  const stripe = await getUncachableStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appOrigin(req)}/dashboard`,
  });
  res.json(CreateBillingPortalResponse.parse({ url: session.url }));
});

export default router;