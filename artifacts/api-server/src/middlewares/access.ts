import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable, uniqueVisitorsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";

const VISITOR_COOKIE = "nano_visitor";
export const ANONYMOUS_LIMIT = 2;
export const SIGNED_IN_LIMIT = 3;
const PAID_STATUSES = new Set(["active", "trialing"]);

function cookieSecret(): string {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("CLERK_SECRET_KEY is required to sign visitor identities.");
  return secret;
}

function signature(value: string): string {
  return createHmac("sha256", cookieSecret()).update(value).digest("base64url");
}

function readCookie(req: Request): string | null {
  const header = req.headers.cookie ?? "";
  const raw = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${VISITOR_COOKIE}=`))
    ?.slice(VISITOR_COOKIE.length + 1);
  if (!raw) return null;
  const [id, sent] = decodeURIComponent(raw).split(".");
  if (!id || !sent) return null;
  const expected = signature(id);
  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

export const visitorIdentity: RequestHandler = async (req, res, next) => {
  try {
    let visitorId = readCookie(req);
    if (!visitorId) {
      visitorId = randomUUID();
      await db.insert(uniqueVisitorsTable).values({ visitorId }).onConflictDoNothing();
      res.cookie(VISITOR_COOKIE, `${visitorId}.${signature(visitorId)}`, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 365 * 24 * 60 * 60 * 1000,
        path: "/",
      });
    }
    (req as Request & { visitorId: string }).visitorId = visitorId;
    res.locals.visitorId = visitorId;
    next();
  } catch (error) {
    next(error);
  }
};

function claimString(req: Request, keys: string[]): string | null {
  const claims = getAuth(req).sessionClaims as Record<string, unknown> | null;
  for (const key of keys) {
    const value = claims?.[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

export async function localUser(req: Request) {
  const auth = getAuth(req);
  const clerkId =
    (auth.sessionClaims?.userId as string | undefined) ?? auth.userId ?? null;
  if (!clerkId) return null;
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId));
  if (existing) return existing;

  const email = claimString(req, ["email", "email_address", "primary_email_address"]);
  if (email) {
    const [byEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (byEmail) {
      const [linked] = await db
        .update(usersTable)
        .set({
          clerkId,
        })
        .where(eq(usersTable.id, byEmail.id))
        .returning();
      return linked!;
    }
  }
  const displayName = claimString(req, ["name", "full_name"]);
  const [created] = await db
    .insert(usersTable)
    .values({
      clerkId,
      username: email ?? clerkId,
      email,
      displayName,
      aiActions: 0,
    })
    .returning();
  return created!;
}

export async function subscriptionAccess(req: Request) {
  const user = await localUser(req);
  if (!user?.stripeCustomerId) return { user, paid: false, status: null as string | null };
  const stripe = await getUncachableStripeClient();
  const subscriptions = await stripe.subscriptions.list({
    customer: user.stripeCustomerId,
    status: "all",
    limit: 20,
  });
  const subscription = subscriptions.data.find((item) => PAID_STATUSES.has(item.status));
  if (subscription && user.stripeSubscriptionId !== subscription.id) {
    await db
      .update(usersTable)
      .set({ stripeSubscriptionId: subscription.id })
      .where(eq(usersTable.id, user.id));
  }
  return {
    user,
    paid: Boolean(subscription),
    status: subscription?.status ?? subscriptions.data[0]?.status ?? null,
  };
}

export const reserveAiAction: RequestHandler = async (req, res, next) => {
  try {
    const access = await subscriptionAccess(req);
    if (access.paid) {
      next();
      return;
    }
    const visitorId = res.locals.visitorId as string;
    let reserved: "visitor" | "user" | null = null;
    if (access.user) {
      const userResult = await db.execute(sql`
        update users set ai_actions = ai_actions + 1
        where id = ${access.user.id}
           and ai_actions < ${SIGNED_IN_LIMIT}
        returning id
      `);
      if (userResult.rows.length) reserved = "user";
    } else {
      const visitorResult = await db.execute(sql`
        update unique_visitors set ai_actions = ai_actions + 1
        where visitor_id = ${visitorId} and ai_actions < ${ANONYMOUS_LIMIT}
        returning id
      `);
      if (visitorResult.rows.length) reserved = "visitor";
    }
    if (!reserved) {
      res.status(402).json({
        error: access.user
          ? "Your free AI actions are used. Subscribe for unlimited app use."
          : "Your two free AI actions are used. Sign in with Google for three more.",
        code: access.user ? "subscription_required" : "sign_in_required",
      });
      return;
    }
    res.on("finish", () => {
      if (res.statusCode < 400) return;
      const refund =
        reserved === "user"
          ? db.execute(sql`update users set ai_actions = greatest(0, ai_actions - 1) where id = ${access.user!.id}`)
          : db.execute(sql`update unique_visitors set ai_actions = greatest(0, ai_actions - 1) where visitor_id = ${visitorId}`);
      void refund.catch((error) => req.log.error({ error }, "Failed to refund AI action"));
    });
    next();
  } catch (error) {
    next(error);
  }
};