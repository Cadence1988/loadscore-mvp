# Stripe Test-Mode Billing (PRO-3)

Status: **code complete / test-mode production verification pending** as of August 31, 2026. No live charging or paid feature gate is enabled. Verified external drivers remain **0/50** and paying customers remain **0**; Stripe test transactions never count as customers.

## Trust boundary and flow

```text
authenticated browser
  -> POST /api/billing/create-checkout-session with Supabase access token + allowlisted plan key
  -> Vercel verifies the user with Supabase Auth getUser(token)
  -> server maps the plan to a configured Stripe test Price and creates hosted Checkout
  -> Stripe POSTs a snapshot event to /api/stripe/webhook
  -> server verifies the unchanged raw body and Stripe-Signature
  -> server fetches current Stripe subscription state when available
  -> server-only Supabase secret writes public.subscriptions
  -> /account reads only safe own-row fields through existing RLS
```

The browser cannot submit a user UUID, Customer ID, Price ID, authoritative status, or arbitrary plan. Unknown request fields are rejected. The redirect at `/checkout/success` only reports that Stripe Checkout returned; it never writes subscription state or unlocks a capability. PRO-4 remains responsible for authoritative entitlement evaluation.

## Test catalog

The only internal plan keys are `founding_driver_pro` and `driver_pro`. Server configuration maps those keys to `STRIPE_PRICE_FOUNDING_DRIVER_PRO_MONTHLY` and `STRIPE_PRICE_DRIVER_PRO_MONTHLY`. No dollar amount is hard-coded. The Founding Driver plan is an internal test option, not a public offer.

Checkout uses subscription mode, a server-resolved/reused Customer, one configured recurring Price, canonical LoadScore success/cancel URLs, and only `loadscore_user_id` plus `loadscore_plan` metadata. No freight, route, truck, broker, pasted text, CSV, auth token, or payment-method data is sent as metadata.

## Webhook authority, replay, and order

The endpoint accepts only a Stripe signature verified with `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)`. Vercel body parsing is disabled for this route. It handles these Stripe API v1 snapshot event names:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

The server retrieves the current subscription for all but the deleted snapshot. A safely allowlisted metadata plan and an exact account mapping are required; otherwise the event is recorded as ignored and no subscription changes.

`public.stripe_webhook_events` is a server-only receipt ledger keyed by Stripe event ID. It stores event ID/type/time, status, processed time, and a bounded safe error code—not full payloads. Browser grants are revoked and RLS has no browser policy. Successfully processed/ignored duplicates return 2xx without reapplying. Failed processing is marked retryable and returns 5xx so Stripe can retry.

`subscriptions.stripe_event_created_at` blocks an older event from overwriting a newer applied state; the update also uses a database-side `<=` filter to close concurrent races. The canonical Stripe subscription is fetched for current state when possible. The applied event ID is server-only and not included in browser select grants.

## Status persistence (not entitlement)

Stripe `active`, `trialing`, `past_due`, `unpaid`, `canceled`, `incomplete`, `incomplete_expired`, and `paused` values persist to the corresponding LoadScore status. Unknown values fall back conservatively to `inactive`. Plan remains one of the two server-allowlisted paid plan records. `past_due` prepares a seven-day `grace_period_ends_at`; PRO-4 decides capabilities. `current_period_end` is read from the current Stripe API's subscription-item periods (with compatibility fallback).

Nothing in PRO-3 interprets those fields as access. Canceled, unpaid, incomplete, paused, or redirect state cannot activate Pro.

## Current API assumptions

- Official `stripe` Node SDK `22.6.0`, pinned to API `2026-08-26.dahlia`.
- Current API v1 snapshot events, not API v2 thin events.
- Current Stripe subscription items carry billing-period timestamps; a legacy top-level fallback is retained.
- Supabase's current `sb_secret_...` server key is preferred over the legacy `service_role` JWT. Both authorize the trusted `service_role` database role, but only `SUPABASE_SECRET_KEY` is documented/configured here.
- Server identity is freshly verified with `supabase.auth.getUser(accessToken)` rather than trusting browser session contents.

References: [Stripe Checkout Sessions API](https://docs.stripe.com/api/checkout/sessions/create), [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [Stripe signature verification](https://docs.stripe.com/webhooks/signature), [Vercel raw request bodies](https://vercel.com/kb/guide/how-do-i-get-the-raw-body-of-a-serverless-function), [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), and [Supabase `getUser`](https://supabase.com/docs/reference/javascript/auth-getuser).

## Server-only environment variables

Add these directly in Vercel Project Settings → Environment Variables. Do not send values through chat, commit them, log them, or create `VITE_` variants.

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_FOUNDING_DRIVER_PRO_MONTHLY
STRIPE_PRICE_DRIVER_PRO_MONTHLY
SUPABASE_URL
SUPABASE_SECRET_KEY
LOADSCORE_SITE_URL=https://loadscoreapp.com
```

The code refuses a Stripe secret that does not begin with `sk_test_`. The webhook secret must begin with `whsec_`. A missing setup returns a generic test-mode-unavailable response and leaves `/account` and Free LoadScore operational.

## Founder production-test checklist

1. Create or sign into Stripe and explicitly switch to a test sandbox/test mode.
2. Create test products and monthly recurring test Prices for the internal Founding Driver Pro and Driver Pro plan keys; do not activate/publicize the founding offer.
3. Copy each `price_...` value directly into the matching Vercel variable.
4. Copy the Stripe **test** secret key directly into `STRIPE_SECRET_KEY` in Vercel.
5. Create a Stripe Workbench webhook destination at `https://loadscoreapp.com/api/stripe/webhook` for the six listed snapshot events.
6. Copy that endpoint's signing secret directly into `STRIPE_WEBHOOK_SECRET` in Vercel.
7. Copy the current Supabase project URL and server-only secret key directly into `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in Vercel.
8. Set `LOADSCORE_SITE_URL` exactly to `https://loadscoreapp.com`, apply the migration, and redeploy beta.8.
9. Sign in, start Driver Pro test checkout, and complete it with a Stripe test card—never a real card.
10. Verify Checkout returned to `/checkout/success`, Stripe delivered a valid webhook, the event ledger succeeded, and the own subscription row reflects the correct test status.
11. Cancel/update the test subscription once and confirm the newer state reaches Supabase and `/account` safely.
12. Check Vercel, Supabase, Stripe, and PostHog logs for the absence of secret values, email, UUID, Stripe IDs in analytics, and freight data.

If Stripe CLI is installed later, `stripe listen --forward-to localhost:3000/api/stripe/webhook` can supply a separate local signing secret. Dashboard and CLI webhook secrets are not interchangeable.

## Deferred to PRO-4 and later

PRO-4: versioned capability catalog, status/grace/paid-through entitlement resolver, safe entitlement endpoint, and outage/tamper/account-switch testing. Later phases cover website gating, extension account linking, founding-offer activation, live-mode/policy readiness, and a controlled paid beta. Cloud freight sync, team/fleet billing, coupons, referrals, tax automation, and live charging are not part of PRO-3.
