---
name: Stripe live-mode boundary
description: Live-only checkout and webhook requirements for this course.
---

Never replace the configured live Stripe Price ID with a sandbox price. Checkout
must verify that the price is live, active, recurring, and monthly before creating
a session. Use the securely configured live Stripe key when the Replit connector
cannot access the production account, and verify webhook signatures before
processing purchase events.

**Why:** The deployed connector could not retrieve the configured live price. The
owner supplied production credentials through Replit Secrets; direct live price
retrieval, live Checkout Session creation, and signed webhook processing were then
verified successfully.

**How to apply:** Keep all credentials in Replit Secrets. Prefer the direct live
client when configured, reject non-live prices, process only signature-verified
webhooks, and never print or persist credentials in code or logs.