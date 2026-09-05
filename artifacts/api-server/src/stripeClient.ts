import Stripe from "stripe";

function liveStripeSecret(): string {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey?.startsWith("sk_live_")) {
    throw new Error("A live STRIPE_SECRET_KEY is required.");
  }
  return secretKey;
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  return new Stripe(liveStripeSecret());
}