---
name: Stripe live-mode boundary
description: Why a live Price ID cannot be verified through the development Stripe connector.
---

Never replace the configured live Stripe Price ID with a sandbox price merely to
make development checkout work. Checkout must verify that the price is live,
active, recurring, and monthly before creating a session.

**Why:** Replit's development Stripe connection is sandbox-only and cannot see a
live Price ID. Production live payments require Replit Integrated Payments from
the Stripe Marketplace; development returning “No such price” for a live ID is an
environment boundary, not evidence that the live ID should be replaced.

**How to apply:** Keep the live ID configured. Fail clearly without opening
checkout when the connector cannot confirm live mode. Validate in production only
after Integrated Payments is attached to the live Stripe account.