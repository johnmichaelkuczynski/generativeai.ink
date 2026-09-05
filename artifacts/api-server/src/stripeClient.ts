import { ReplitConnectors } from "@replit/connectors-sdk";

type StripeSubscription = { id: string; status: string };
type StripeList<T> = { data: T[] };
type StripeCustomer = { id: string };
type StripeSession = { url: string | null };
type StripePrice = {
  id: string;
  active: boolean;
  livemode: boolean;
  type: string;
  recurring: { interval: string } | null;
};

async function stripeRequest<T>(
  path: string,
  options?: { method?: string; body?: URLSearchParams },
): Promise<T> {
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy("stripe", path, {
    method: options?.method ?? "GET",
    body: options?.body,
    ...(options?.body
      ? { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      : {}),
  });
  const payload = (await response.json()) as T & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Stripe request failed (${response.status}).`);
  }
  return payload;
}

function form(values: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return params;
}

class ConnectorStripeClient {
  prices = {
    retrieve: (priceId: string) =>
      stripeRequest<StripePrice>(
        `/v1/prices/${encodeURIComponent(priceId)}`,
      ),
  };

  subscriptions = {
    list: ({
      customer,
      status,
      limit,
    }: {
      customer: string;
      status: string;
      limit: number;
    }) =>
      stripeRequest<StripeList<StripeSubscription>>(
        `/v1/subscriptions?customer=${encodeURIComponent(customer)}&status=${encodeURIComponent(status)}&limit=${limit}`,
      ),
  };

  customers = {
    create: (input: {
      email?: string;
      name?: string;
      metadata: Record<string, string>;
    }) =>
      stripeRequest<StripeCustomer>("/v1/customers", {
        method: "POST",
        body: form({
          email: input.email,
          name: input.name,
          ...Object.fromEntries(
            Object.entries(input.metadata).map(([key, value]) => [
              `metadata[${key}]`,
              value,
            ]),
          ),
        }),
      }),
  };

  checkout = {
    sessions: {
      create: (input: {
        customer: string;
        mode: string;
        line_items: Array<{ price: string; quantity: number }>;
        success_url: string;
        cancel_url: string;
        subscription_data: { metadata: Record<string, string> };
        metadata: Record<string, string>;
        allow_promotion_codes: boolean;
        custom_text: { submit: { message: string } };
      }) =>
        stripeRequest<StripeSession>("/v1/checkout/sessions", {
          method: "POST",
          body: form({
            customer: input.customer,
            mode: input.mode,
            "line_items[0][price]": input.line_items[0]?.price,
            "line_items[0][quantity]": input.line_items[0]?.quantity,
            success_url: input.success_url,
            cancel_url: input.cancel_url,
            allow_promotion_codes: input.allow_promotion_codes,
            "custom_text[submit][message]": input.custom_text.submit.message,
            ...Object.fromEntries(
              Object.entries(input.metadata).map(([key, value]) => [
                `metadata[${key}]`,
                value,
              ]),
            ),
            ...Object.fromEntries(
              Object.entries(input.subscription_data.metadata).map(
                ([key, value]) => [
                  `subscription_data[metadata][${key}]`,
                  value,
                ],
              ),
            ),
          }),
        }),
    },
  };

  billingPortal = {
    sessions: {
      create: (input: { customer: string; return_url: string }) =>
        stripeRequest<StripeSession>("/v1/billing_portal/sessions", {
          method: "POST",
          body: form(input),
        }),
    },
  };
}

export async function getUncachableStripeClient(): Promise<ConnectorStripeClient> {
  return new ConnectorStripeClient();
}