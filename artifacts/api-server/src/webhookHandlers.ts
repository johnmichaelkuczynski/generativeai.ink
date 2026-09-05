import Stripe from "stripe";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const stripe = new Stripe("sk_test_signature_verification_only");

function requiredWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  }
  return secret;
}

async function updateUserFromCheckout(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const appUserId = Number(session.metadata?.appUserId);
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  if (!Number.isFinite(appUserId) || !customerId) return;

  await db
    .update(usersTable)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId ?? null,
    })
    .where(eq(usersTable.id, appUserId));
}

async function updateUserFromSubscription(
  subscription: Stripe.Subscription,
): Promise<void> {
  const appUserId = Number(subscription.metadata?.appUserId);
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const values = {
    stripeCustomerId: customerId,
    stripeSubscriptionId:
      subscription.status === "canceled" ? null : subscription.id,
  };

  if (Number.isFinite(appUserId)) {
    await db
      .update(usersTable)
      .set(values)
      .where(eq(usersTable.id, appUserId));
    return;
  }

  await db
    .update(usersTable)
    .set(values)
    .where(eq(usersTable.stripeCustomerId, customerId));
}

export class WebhookHandlers {
  static async processWebhook(
    payload: Buffer,
    signature: string,
  ): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error("Stripe webhook payload must be an unparsed Buffer.");
    }

    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      requiredWebhookSecret(),
    );

    switch (event.type) {
      case "checkout.session.completed":
        await updateUserFromCheckout(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await updateUserFromSubscription(event.data.object);
        break;
      default:
        break;
    }
  }
}