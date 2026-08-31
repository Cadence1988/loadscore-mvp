# Driver Pro Paid-Beta Roadmap

Status: **PRO-0 complete; PRO-1 reported production-verified; PRO-2 code complete with production migration/pgTAP/account-read verification pending.**

The engineering roadmap may progress before charging, but the current 0/50 Verified Beta Driver goal remains separate from a future Paying Founding Driver count.

| Phase | Entry criteria | Work | Exit criteria and tests | Founder action | Independent deploy? | Chrome package change? |
|---|---|---|---|---|---|---|
| PRO-0 Architecture | Paid-tier audit complete | Capability matrix, schema, flows, API/Stripe contracts, threat/privacy/test plan | Documentation reviewed; existing tests remain green | Approve architecture and unresolved decisions | Documentation only | No |
| PRO-1 Website Auth | PRO-0 approved | Magic-link auth, callback, session provider, account shell, logout; no billing | **Founder reports live login/restore/logout/local-data verification complete** | Re-check canonical custom-domain routing | Yes | No |
| PRO-2 Database/RLS | Auth identity stable | **Code ready:** `user_profiles`, locked subscription foundation, trigger/backfill, explicit grants/RLS, pgTAP and app checks | **Pending:** run pgTAP, apply production migration, verify existing-user backfill and authenticated own-row read | Apply reviewed migration only after DB tests; verify account page | Yes, no paid UI | No |
| PRO-3 Stripe test mode | Auth+RLS verified; Stripe test account/catalog approved | Test Checkout, webhook, Customer mapping/Portal, state sync | Signature/idempotency/order/price-tamper/cancel/past-due tests | Create test product/prices and webhook secret; approve candidate offer copy | Yes, test/admin only | No |
| PRO-4 Entitlements | Reliable subscription state | Versioned capability catalog, resolver, API, signed offline assertion/cache | State matrix, tampering, expiry, outage, account-switch tests | Approve grace and cache durations | Yes, shadow/read-only mode | No |
| PRO-5 Website Gating | Entitlements verified in shadow mode | `/pro`, account/billing/success UX, soft/hard/limit gates | Free core never blocked; Pro/Free/payment-delay/accessibility tests | Approve final Free/Pro copy; do not enable charging yet | Yes behind launch flag/allowlist | No |
| PRO-6 Extension Linking | Website auth/entitlements stable; canonical extension ID/domain known | `identity`+PKCE linking, tokens, refresh/revoke, popup states | State/code/token/offline/restore tests and Store permission review | Approve manifest disclosure; reload/test package | Website APIs yes; extension package separately | **Yes**: `identity` and exact API host |
| PRO-7 Founding Offer | Repeat-use/WTP evidence and controlled invite list; PRO-3–6 stable | Server offer allowlist, founding-slot allocation, monthly/annual flows | 50/51 concurrency, close switch, cancel/recovery/switch/refund tests | Decide first invite, candidate prices, cohort closure, support | Yes, invite/allowlist only | Possibly copy only; avoid unless needed |
| PRO-8 Production/Policy | LLC/payment verification ready; legal and support checklist complete | Live Stripe keys/webhook, privacy/terms/refund disclosures, monitoring/runbook, Store declarations | Live low-value checkout, entitlement, portal, cancel/refund, opt-out and incident drill | Approve legal text, Stripe activation, support/refund process, Store update | Yes after go-live approval | Likely new reviewed package |
| PRO-9 Controlled Paid Beta | Production checks pass; real invited drivers available | Invite first users, observe payment/restoration/support, reconcile metrics | First real payment; same web/extension entitlement; cancellation/recovery verified; no critical issue | Personally support first cohort and record evidence | Yes, controlled | Only for fixes/disclosures |

## Sequencing guardrails

- Do not call PRO-2 complete until pgTAP, production migration, backfill, and authenticated own-row read are recorded.
- Do not install Supabase or Stripe packages until the corresponding approved phase.
- Do not enable gates before server entitlements work in shadow mode.
- Do not add Chrome permissions before PRO-6 and a Store disclosure review.
- Do not call the paid beta validated until a real driver pays and access is restored correctly in the same website/extension.
- Continue Chrome distribution and outside-driver learning in parallel; do not redefine 0/50 Verified Beta Drivers as paying drivers.

## PRO-1 implementation boundary

PRO-1 is limited to website magic-link authentication and an account shell. The implementation is present; activation steps are in `authentication.md`:

- Supabase browser client configured only with public URL/key.
- Auth provider/session restoration.
- `/auth/callback` PKCE handling.
- `/account` signed-in identity/status shell with no plan claims.
- Sign in and sign out.
- Existing anonymous calculator and local data behavior unchanged.
- Authentication/RLS-ready tests and secret/bundle checks.
- No database billing tables, Stripe, checkout, pricing activation, entitlements, feature gates, extension code, or manifest changes.
