# Driver Pro Architecture

Status: **PRO-0 approved. PRO-1 website authentication is implemented but remains unconfigured/unverified against a real Supabase project. Billing, entitlements, cloud freight storage, and extension authentication are not active.**

PRO-1 implementation details, exact redirects, and the founder activation checklist are in [`authentication.md`](authentication.md). This document also describes later planned phases; planned components must not be mistaken for shipped features.

## 1. Decision and constraints

LoadScore will use one website and one Chrome extension for anonymous Free Driver, authenticated Free Driver, Founding Driver Pro, and Driver Pro. The website is the account, billing, and deeper-workspace hub. The extension remains the quick repeat-use tool and becomes account-aware only after deliberate linking.

The smallest safe target architecture is:

```text
React/Vite website
  -> Supabase Auth
  -> Vercel serverless API
  -> Stripe Checkout and Customer Portal
  -> signed, idempotent Stripe webhook
  -> Supabase Postgres subscription state with RLS
  -> authoritative entitlement API
  -> website and the same Chrome extension
```

Architectural constraints:

- Free manual calculation requires no account and no network billing dependency.
- Basic economics, deadhead, Reload Score, explanation, and basic minimum rate remain Free.
- Plans resolve to capabilities and limits; code must not spread a giant `isPro` boolean.
- Paid access is authorized by server state, never `localStorage`, `chrome.storage.local`, browser price data, or a checkout success page.
- Raw freight, routes, rates, broker text, CSV contents, and saved-load history stay local by default.
- LoadScore remains a decision/alert layer, not a replacement load board or unauthorized scraper.

The formal capability matrix is in `free-vs-pro-entitlements.md`.

## 2. Entitlement model and lifecycle

Each response resolves:

- `plan`: `free`, `founding_driver_pro`, or `driver_pro`
- `subscription_status`: normalized LoadScore status
- `capabilities`: explicit booleans
- `limits`: explicit integers or `null`
- `verified_at` and `offline_valid_until`
- schema/catalog version

Expected behavior:

| User/subscription state | Paid access |
|---|---|
| Anonymous Free | Free capabilities; no account request required |
| Authenticated Free | Free capabilities; account/billing page available |
| `active` | Pro enabled |
| `trialing` | Pro enabled if a trial is deliberately introduced; no trial is planned now |
| `cancel_at_period_end` while active | Pro remains through `current_period_end` |
| `past_due` | Pro remains for a seven-day LoadScore payment-recovery grace period, with a clear billing warning |
| `unpaid` | Pro disabled |
| `canceled` / expired | Pro disabled |
| `incomplete` / `incomplete_expired` | Pro disabled |
| `paused` | Pro disabled unless a later written policy says otherwise |
| New checkout awaiting webhook | Show “confirming payment”; do not unlock |
| Existing subscription during short webhook delay | Retain last server-verified state until its signed cache expires |

### Offline cache

A successful entitlement check may return a server-signed offline assertion. A client may honor a previously verified Pro assertion for up to 72 hours, capped at `current_period_end` plus any explicit seven-day `past_due` grace. The client verifies the signature with a bundled public key. Editing cached JSON without a valid signature does not unlock Pro. Server-backed Pro operations still require a live authorization check.

If the cache is absent, expired, invalid, or belongs to another account, the product falls back to Free without deleting local settings or freight. “Entitlement unavailable” must not be represented as “subscription cancelled.”

## 3. Supabase responsibilities and secrets

Supabase will provide:

- Magic-link email authentication for the first release.
- Google OAuth later, after the basic account and callback flow is stable.
- Postgres account/billing metadata.
- Row Level Security for user-readable account records.
- Durable Stripe mappings, subscription state, entitlement overrides, webhook idempotency, and later referral attribution.

Supabase will not automatically receive raw freight or existing local truck/load data.

Credential boundaries:

- `VITE_SUPABASE_URL` and the Supabase anon/publishable key may be visible in browser code by design; RLS must protect data.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and bypasses RLS; it must never enter a `VITE_` variable, website bundle, extension, log, or analytics event.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are server-only.
- Entitlement signing private keys are server-only; only the verification public key may ship to clients.

## 4. Minimal database schema

This is a concrete draft for later SQL migrations. Use `uuid`, `timestamptz`, constrained text/enums, and `jsonb` only where a changing external payload genuinely requires it.

### `user_profiles`

Account metadata, not existing local truck profiles.

| Column | Type/constraint |
|---|---|
| `user_id` | `uuid primary key references auth.users(id) on delete cascade` |
| `created_at` | `timestamptz not null default now()` |
| `updated_at` | `timestamptz not null default now()` |
| `analytics_opt_out` | `boolean not null default false` |

RLS: authenticated user may read/update their own non-billing row. Insert is created by signup trigger or trusted server. Email remains in Supabase Auth unless a separate operational need is approved.

### `stripe_customers`

| Column | Type/constraint |
|---|---|
| `user_id` | `uuid primary key references auth.users(id) on delete cascade` |
| `stripe_customer_id` | `text not null unique` |
| `created_at` | `timestamptz not null default now()` |
| `updated_at` | `timestamptz not null default now()` |

Index: unique Stripe customer ID. RLS: owner may read a redacted/existence view if needed; writes are service-role only. Prefer not returning the Stripe ID to clients.

### `subscriptions`

| Column | Type/constraint |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` |
| `user_id` | `uuid not null references auth.users(id) on delete cascade` |
| `stripe_customer_id` | `text not null references stripe_customers(stripe_customer_id)` |
| `stripe_subscription_id` | `text not null unique` |
| `stripe_price_id` | `text not null` |
| `plan_key` | constrained text: `founding_driver_pro`, `driver_pro` |
| `status` | constrained normalized subscription status |
| `current_period_end` | `timestamptz` |
| `cancel_at_period_end` | `boolean not null default false` |
| `past_due_at` | `timestamptz` nullable |
| `founding_cohort` | `boolean not null default false` |
| `created_at` | `timestamptz not null default now()` |
| `updated_at` | `timestamptz not null default now()` |

Indexes: `(user_id, status)`, `stripe_customer_id`, unique subscription ID. Enforce at most one current paid subscription per user using a partial unique index or transactional service rule. RLS: owner may read a safe projection; all writes service-role only.

### `entitlements`

Stores explicit grants/overrides, not the whole base plan catalog.

| Column | Type/constraint |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` |
| `user_id` | `uuid not null references auth.users(id) on delete cascade` |
| `capability_key` | `text not null` |
| `enabled` | `boolean not null` |
| `limit_value` | `integer` nullable |
| `source` | constrained text such as `subscription`, `support`, `beta` |
| `expires_at` | `timestamptz` nullable |
| `created_at` / `updated_at` | `timestamptz not null` |

Unique: `(user_id, capability_key, source)`. Index: `(user_id, expires_at)`. RLS: owner may read; writes service-role only. The versioned base plan catalog lives in server code so plan behavior is reviewable and testable.

### `webhook_events`

| Column | Type/constraint |
|---|---|
| `stripe_event_id` | `text primary key` |
| `event_type` | `text not null` |
| `object_id` | `text` nullable |
| `status` | `text not null`: `processing`, `processed`, `failed` |
| `attempt_count` | `integer not null default 1` |
| `last_error_code` | `text` nullable; no sensitive payload |
| `received_at` / `processed_at` | `timestamptz` |

RLS: no client access. Service role only. Retain only operational metadata required for idempotency/audit; do not retain full Stripe payloads indefinitely.

### `referral_attributions`

Future-compatible only; no commission logic in the Pro foundation.

| Column | Type/constraint |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` |
| `referred_user_id` | `uuid not null unique references auth.users(id)` |
| `referral_code` | `text not null` |
| `referrer_user_id` | `uuid references auth.users(id)` nullable |
| `captured_at` | `timestamptz not null default now()` |
| `subscription_id` | `uuid references subscriptions(id)` nullable |
| `attribution_status` | constrained text |

Indexes: referral code and referrer. User may read their own attribution only if product UX requires it; creation and changes are trusted-server only.

### Extension authorization storage

`extension_auth_codes` and `extension_refresh_tokens` are required in PRO-6. Authorization codes store a hash, user, PKCE challenge, state binding, allowed redirect, expiry, and consumed timestamp. Refresh tokens store only a hash, user, extension client ID, expiry, rotation/revocation timestamps, and token family. No raw token is stored.

## 5. Website authentication flows and routes

First release recommendation: magic link only. Add Google after magic-link callback, session recovery, logout, and account switching are stable.

### Flows

- Anonymous Free: open LoadScore, calculate and save locally; no account prompt is required.
- Upgrade: Pro gate -> `/pro` -> sign in/create account -> `/auth/callback` -> return to selected offer -> server-created Checkout.
- Existing Pro: sign in -> fetch `/api/me/entitlements` -> unlock capabilities.
- Logout: revoke/clear account session and cached entitlement; fall back to Free. Existing local settings/freight remain unless the driver deliberately clears them.

### Route contracts

| Route | Contract |
|---|---|
| `/pro` | Public Free/Pro comparison and shipped-value explanation; signed-in status may personalize the CTA |
| `/account` | Authentication required for account and entitlement summary; signed-out users return after login |
| `/billing` | Authentication required; requests a Customer Portal URL and redirects; never embeds Stripe secrets |
| `/checkout/success` | Authentication required; displays “confirming payment” and polls entitlements; never grants access from query data |
| `/auth/callback` | Validates PKCE/state and establishes the website session; rejects unsafe return URLs |
| `/extension/connect` | Public entry but requires website sign-in before consent; validates extension client, state, challenge, and exact redirect |

## 6. Vercel API contracts

All JSON endpoints return a request ID and stable error code. Authentication uses a validated Supabase access token. State-changing browser requests verify allowed Origin; rate limits apply by IP plus user where appropriate.

### `POST /api/checkout/session`

- Auth: required.
- Input: `{ offer_key: "founding_monthly" | "founding_annual" | "driver_pro_monthly" }`.
- Server: maps the allowlisted key to an environment Price ID, verifies availability/cohort eligibility, creates/reuses Stripe Customer, and creates subscription Checkout with internal user ID metadata.
- Output: `{ checkout_url }`.
- Never accept amount, currency, plan capabilities, or arbitrary Stripe Price ID from the browser.
- Failure: safe `offer_unavailable`, `not_authenticated`, `checkout_unavailable`, or rate-limit response; no partial entitlement.

### `POST /api/stripe/webhook`

- Auth: verified Stripe signature over the exact raw request body.
- Input: Stripe event.
- Server: transactional idempotency record, validates expected product/price/customer mapping, updates subscription state, and logs a safe outcome.
- Output: 2xx only after durable success/already-processed; retryable 5xx on transient failure; 4xx on invalid signature/payload.

### `GET /api/me/entitlements`

- Auth: optional. Anonymous or invalid/expired session receives the Free response without leaking account information.
- Output: resolved, minimal entitlement contract and signed offline assertion for authenticated users.
- Security: no Stripe IDs, email, secret, raw billing object, or freight.

### `POST /api/billing/portal`

- Auth: required.
- Input: none beyond an allowlisted return route.
- Server: finds the authenticated user’s Stripe Customer and creates a Customer Portal session.
- Output: `{ portal_url }`.
- Failure: `billing_profile_missing` or provider-unavailable response; entitlement remains unchanged.

### `POST /api/extension/authorize`

- Auth: website session required.
- Input: validated `client_id`, `redirect_uri`, `state`, `code_challenge`, and challenge method `S256` from `/extension/connect`.
- Server: confirms explicit user consent, exact allowlisted extension redirect, and creates a single-use code valid for 60 seconds.
- Output: an exact redirect containing only the short-lived authorization code and returned state.
- Security: no open redirects; rate limit per account/client/IP.

### `POST /api/extension/token`

- Auth: authorization-code+PKCE or rotating refresh token.
- Input: `grant_type`, code and verifier, or refresh token; extension client ID.
- Output: 15-minute scoped access token, rotating refresh token, expiry, and entitlement snapshot.
- Security: single-use codes, hashed refresh tokens, rotation/reuse detection, account/client binding, strict CORS.

### `POST /api/extension/revoke`

- Auth: extension access/refresh token.
- Effect: revokes that extension token family and clears server-side session linkage. The extension then clears local token and entitlement cache.

No separate `/api/auth/logout` is required for the initial Supabase browser session; the client calls Supabase sign-out. Add a server logout endpoint only if later moving to server-managed HttpOnly cookies.

## 7. Stripe catalog and founding rules

Product: **LoadScore Driver Pro**.

Catalog keys and server-only environment mappings:

- `founding_monthly` -> `STRIPE_PRICE_FOUNDING_MONTHLY`, candidate $9.99/month.
- `founding_annual` -> `STRIPE_PRICE_FOUNDING_ANNUAL`, candidate $99/year.
- `driver_pro_monthly` -> `STRIPE_PRICE_DRIVER_PRO_MONTHLY`, planning candidate near $19/month; not launched or finalized.

Prices are created later in Stripe and never duplicated as authorization values across UI components. Display copy may come from a reviewed public offer catalog; checkout still maps a server allowlist to Stripe Price IDs.

Proposed founding rules:

- Maximum 50 successfully paid founding accounts; founder may close enrollment earlier.
- Eligibility requires the server-side founding offer to be open; no hidden URL alone grants the price.
- A slot is permanently consumed when the first invoice for that founding subscription is paid. Cancelled slots do not reopen.
- Monthly and annual founding subscriptions count equally.
- Founding price continues while the same original subscription remains active or recovers from payment failure without being canceled/deleted.
- Seven-day Pro grace during `past_due`; Stripe recovery of the same subscription preserves founding status.
- Cancellation ends the founding rate at period end. A later reactivation is a new subscription at the then-current available price.
- Monthly/annual changes are support-assisted at renewal during the initial cohort and preserve founding status without cancellation.
- Refunds follow the written refund policy and do not automatically reopen a founding slot.
- Use “founding rate while your original subscription remains continuously active,” never “lifetime price.”

## 8. Stripe webhook state machine

| Stripe signal/status | Authoritative action |
|---|---|
| `checkout.session.completed` | Link validated checkout/customer/user and record pending confirmation; do not unlock solely from this event if subscription state is not verified |
| `customer.subscription.created` | Upsert expected subscription and normalized status |
| `customer.subscription.updated` | Update price, status, period end, cancel flag, and grace timestamps |
| `customer.subscription.deleted` | Mark canceled and remove paid entitlement |
| `invoice.paid` | Confirm active access, clear past-due timestamp, and allocate founding slot on first paid founding invoice |
| `invoice.payment_failed` | Mark/confirm `past_due`, begin seven-day grace, and emit operational notice |
| `active` / `trialing` | Pro enabled |
| `past_due` | Pro enabled only until calculated grace expiry |
| `unpaid`, `canceled`, `incomplete`, `incomplete_expired`, `paused` | Pro disabled |

Every event is signature-verified, inserted idempotently by Stripe event ID, processed transactionally, safe-logged, and retryable. Out-of-order events compare Stripe object version/timestamps and current provider state before applying an older transition. A scheduled reconciliation may later repair missed webhooks.

## 9. Entitlement response contract

```json
{
  "schema_version": 1,
  "catalog_version": "2026-08-pro0",
  "plan": "founding_driver_pro",
  "subscription_status": "active",
  "capabilities": {
    "manual_load_scoring": true,
    "bulk_paste": true,
    "csv_import": true,
    "top_7": true,
    "broker_message": true,
    "alert_advanced": true
  },
  "limits": {
    "saved_loads": 50,
    "profiles": 5,
    "comparison": 7
  },
  "current_period_end": "2026-09-25T00:00:00Z",
  "verified_at": "2026-08-25T12:00:00Z",
  "offline_valid_until": "2026-08-28T12:00:00Z",
  "offline_assertion": "server-signed-opaque-value"
}
```

Free/anonymous responses omit account and billing identifiers. Never expose Stripe Customer ID, Stripe Subscription ID, email, secret keys, raw provider status payloads, or internal support notes.

Caching:

- Browser memory cache for the current session and a short persisted signed snapshot.
- Revalidate on sign-in, checkout return, popup open when stale, focus after 15 minutes, manual refresh, and account change.
- Online entitlement response may use a private short `max-age`/ETag, never a shared CDN cache.
- Clear cached paid state on logout or account switch.

## 10. Website feature-gate UX

Later `FeatureGate` components receive a capability and optional limit usage. They render the underlying feature when allowed and a contextual explanation when denied.

- Soft gate: non-blocking explanation after a useful Free experience.
- Hard gate: Pro-only workflow such as CSV import; show shipped benefits and `/pro` action.
- Limit gate: show current limit and gate only the action that exceeds it, such as adding comparison load 4.

The gate must distinguish signed-out Free, signed-in Free, payment confirmation, past due, and entitlement unavailable. It must never imply cancellation merely because the network is down.

## 11. Extension account linking and UX

One extension remains the only extension.

Flow:

1. User selects **Sign in** or a Pro capability.
2. Extension generates PKCE verifier/challenge and cryptographic `state`.
3. Extension calls `chrome.identity.launchWebAuthFlow()` with the LoadScore `/extension/connect` URL.
4. Website signs in the user if needed and asks to link this LoadScore extension.
5. Backend validates exact extension redirect/client/state/challenge and returns a 60-second single-use authorization code.
6. Chrome closes the auth view on the exact `https://<extension-id>.chromiumapp.org/...` redirect.
7. Extension verifies state and exchanges code+verifier with `/api/extension/token`.
8. Backend returns a 15-minute scoped access token and rotating refresh token.
9. Extension stores tokens in `chrome.storage.local`, stores only a server-signed entitlement cache, refreshes before expiry, and detects refresh-token reuse.
10. Sign out calls the revoke endpoint, clears tokens/cache, and leaves local truck/load data unchanged.

Popup states:

- Anonymous Free: compact Sign in and Upgrade actions only where useful.
- Authenticated Free: Account, Upgrade, and Sign out.
- Pro Active: small Driver Pro badge, Account, Manage Pro, Refresh access, Sign out.
- Pro Past Due: Driver Pro grace warning and Manage billing.
- Pro Cancelled: Free state plus “Ended” explanation and resubscribe action.
- Offline Cached Pro: Pro badge with “verified offline until …”.
- Entitlement Unknown: Free-safe functionality plus Retry; do not claim cancellation.

## 12. Future Chrome manifest proposal

Do not change the manifest before PRO-6. The likely narrow addition is:

```json
{
  "permissions": ["activeTab", "scripting", "storage", "notifications", "identity"],
  "host_permissions": ["https://loadscore-mvp.vercel.app/api/*"]
}
```

Before production, replace the preview/legacy hostname with the final canonical LoadScore domain if available. Use only the exact HTTPS API origin/path pattern accepted by Chrome; never request `<all_urls>`. `identity` supports the browser-mediated auth redirect. The exact API host permission allows extension `fetch` calls; ordinary user-clicked links to `/pro` or `/account` require no broad host access.

## 13. Threat model

| Threat | Impact | Mitigation | Mandatory test |
|---|---|---|---|
| Edit `localStorage`/extension storage to claim Pro | Unauthorized client features | Server capability response; signed offline assertion | Tampered cache falls back to Free |
| Inspect extension storage | Token theft risk | Short-lived scoped access; hashed rotating refresh; revoke/reuse detection | Stolen/reused refresh token revokes family |
| Stolen web auth token | Account access | Short sessions, secure PKCE, CSP/XSS controls, logout/revocation | Expired/revoked token rejected |
| Replay extension auth code | Unauthorized link | 60-second single-use code, hash at rest, PKCE and client binding | Second exchange rejected |
| State mismatch/redirect spoof | Account-link hijack | Cryptographic state and exact allowlisted Chromium redirect | Mismatch and alternate redirect rejected |
| Stripe webhook spoofing | Fraudulent entitlement | Verify signature over raw body | Invalid/mutated signature rejected |
| Duplicate webhook | Duplicate/incorrect state | Unique event ID and transactional idempotency | Same event produces one transition |
| Out-of-order webhook | Stale subscription state | Compare timestamps/status and reconcile provider state | Older event cannot overwrite newer state |
| Checkout price tampering | Unauthorized discount | Browser sends offer key; server maps allowlisted Price ID | Arbitrary price/amount rejected |
| RLS misconfiguration | Cross-user disclosure | Deny-by-default RLS, service separation, isolation tests | User A cannot read/write User B |
| CSRF on checkout/portal | Unwanted session creation | Bearer auth plus allowed-Origin checks; SameSite if cookies added | Cross-origin request rejected |
| XSS | Session/token theft | React escaping, no unsafe HTML, CSP, dependency review | Script payload rendered inert |
| Open redirect | Phishing/token interception | Fixed route allowlist and exact extension redirect | External return URL rejected |
| Founding-price abuse/race | More than 50 discounted accounts | Transactional paid-slot allocation and server cohort switch | Concurrent 50/51 boundary test |
| Referral self-attribution | Fraudulent future commission | Immutable server attribution, self/fraud rules, collected-invoice basis | Self-referral rejected later |

## 14. Privacy and analytics architecture

New account data is limited to email in Supabase Auth, internal user ID, account timestamps, subscription/entitlement state, Stripe relationship, and optional later referral attribution. LoadScore does not store raw card data; Stripe handles cards.

Account creation does not upload local truck profiles, loads, routes, rates, broker/reference text, CSV rows, alert history, or comparison history. Future cloud features require separate, explicit opt-in and retention/deletion design.

PostHog remains separate from operational billing:

- Optional product analytics may use an opaque LoadScore user ID after a documented privacy decision.
- Never send email, Stripe IDs, billing address, raw freight, card data, or webhook payloads.
- Existing analytics opt-out remains respected.
- Billing webhooks and account security logs still operate because they are necessary service processing, not optional product analytics.
- Browser events: `pro_page_viewed`, `pro_feature_gate_viewed`, `upgrade_clicked`, `checkout_started`.
- Server-derived after verified state: `checkout_completed`, `subscription_activated`, `subscription_cancelled`, `subscription_reactivated`, `invoice_payment_failed`.
- A success-page view never creates a revenue event.

## 15. Terms and policy checklist

Required before real charging:

- [ ] Privacy Policy account/auth/subscription changes
- [ ] Terms of Service
- [ ] Subscription and auto-renew disclosure
- [ ] Cancellation policy and accessible Customer Portal
- [ ] Refund policy
- [ ] Founding Driver eligibility/continuity rules
- [ ] Support contact and response process
- [ ] Estimated-calculation and user-verification disclaimer
- [ ] No guaranteed profit, availability, or booking language
- [ ] Stripe payment-processor disclosure
- [ ] Supabase authentication/storage disclosure
- [ ] Chrome Web Store account-data and exact-host disclosure
- [ ] Data access/deletion process
- [ ] Final canonical domain and redirect review

Full legal documents are intentionally outside PRO-0.

## 16. First-50 validation and referrals

Track separately:

- **Verified Beta Drivers:** outside drivers who actually use the product under the existing verification rule. Current: 0/50.
- **Paying Founding Drivers:** successfully paid founding subscriptions. Current: 0/50 maximum proposed cohort.

Path: Driver #1 -> 5 verified drivers -> repeat-use and willingness-to-pay evidence -> first paid invitation -> first paying driver -> controlled cohort.

Paid infrastructure may be built before charging, but “paid beta validated” requires real collected payment and working entitlement restoration.

Future `?ref=CODE` compatibility may capture an allowlisted referral code at account creation and attach immutable attribution to a subscription. Later commission calculations must use collected invoices with refund/chargeback handling. Do not build commissions, payouts, or affiliate dashboards during the Pro foundation.

## 17. Local-to-account migration

Creating or signing into an account leaves existing web `localStorage` and extension `chrome.storage.local` data intact. Nothing uploads automatically. Account identity and local truck profiles are separate concepts; the database table is therefore `user_profiles`, not `profiles`.

Signing out clears only account session and paid entitlement cache. Local data remains on that browser, with a shared-device warning and a separate deliberate “clear local LoadScore data” control later if needed. A future cloud-sync feature may offer an explicit preview/selection/import flow with duplicate handling; it must not be bundled silently into account creation.

## 18. Environment variables

Frontend-visible by design:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` or current Supabase publishable-key equivalent
- `VITE_LOADSCORE_APP_URL`

Server-only Supabase/authorization:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOADSCORE_ENTITLEMENT_SIGNING_PRIVATE_KEY`
- `LOADSCORE_EXTENSION_ALLOWED_IDS`

Server-only Stripe:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_FOUNDING_MONTHLY`
- `STRIPE_PRICE_FOUNDING_ANNUAL`
- `STRIPE_PRICE_DRIVER_PRO_MONTHLY`

Public extension build configuration:

- canonical LoadScore web URL
- exact LoadScore API origin
- extension client ID
- entitlement signature verification public key

Anything prefixed `VITE_` is bundled into public browser JavaScript. Never put service-role, Stripe, webhook, signing-private, or refresh-token values there. No real values belong in Git.

## 19. Mandatory pre-charge tests

Authentication:

- Magic-link login, callback state/PKCE, logout, expired session, wrong user, account switch.
- RLS owner access and cross-user denial for every exposed table/view.

Billing:

- Allowlisted checkout creation; arbitrary price/amount rejection.
- Stripe signature failure, duplicate delivery, retry, out-of-order event, cancellation, period-end cancellation, past-due grace, unpaid disablement, recovery/reactivation, Customer Portal.
- Founding-slot concurrency and cohort-closed rejection.

Entitlements:

- Anonymous/authenticated Free denied correctly; active/trialing Pro allowed.
- Server overrides client tampering; expired/invalid offline assertion fails Free-safe.
- 72-hour offline behavior, current-period cap, logout/cache clear, account-switch isolation.

Website:

- Free economics never gated; soft/hard/limit gates; checkout confirmation delay; portal failure; accessibility and honest copy.

Extension:

- PKCE success, state mismatch, redirect mismatch, expired/replayed code, token rotation/reuse, refresh failure, revoke/logout, offline cache, Pro restoration, compact popup states.

Privacy/security:

- No raw freight/card/billing-address/Stripe IDs in analytics.
- No server secrets in built website or extension.
- CSP/XSS/open-redirect/Origin/rate-limit checks.
- Existing calculator behavior, lint, build, and complete test suite remain green.

## 20. Implementation file plan

Do not create these implementation modules until their roadmap phase:

```text
src/
  auth/
    AuthProvider.jsx
    supabaseClient.js
    useAuth.js
  entitlements/
    EntitlementProvider.jsx
    capabilityCatalog.js
    useCapability.js
    offlineAssertion.js
  billing/
    billingClient.js
  config/
    plans.js
  components/
    FeatureGate.jsx
    LimitGate.jsx
  pages/
    ProPage.jsx
    AccountPage.jsx
    CheckoutSuccessPage.jsx
    AuthCallbackPage.jsx
    ExtensionConnectPage.jsx

api/
  _lib/
    auth.js
    supabaseAdmin.js
    stripe.js
    entitlements.js
    offers.js
    security.js
  checkout/session.js
  stripe/webhook.js
  me/entitlements.js
  billing/portal.js
  extension/authorize.js
  extension/token.js
  extension/revoke.js

supabase/
  migrations/
  tests/

extension/
  accountLink.js
  authSession.js
  entitlements.js
  publicConfig.js

tests/
  auth*.test.js
  billing*.test.js
  entitlements*.test.js
  extensionAuth*.test.js
```

The current `src/config/productFeatures.js` remains unused scaffold during PRO-0. In PRO-4/5 it should be replaced deliberately by the reviewed capability catalog, not silently treated as authorization.
