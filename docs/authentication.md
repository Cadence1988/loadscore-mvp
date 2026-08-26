# Website Authentication (PRO-1)

Status: **implementation and configuration guidance complete; production activation and a real-email verification are pending founder Supabase/Vercel setup.**

PRO-1 adds optional website account identity. It does not add billing, subscriptions, entitlements, cloud freight storage, or extension authentication. The calculator and all existing local features continue to work anonymously.

## Architecture

- `@supabase/supabase-js` is loaded only by the authentication layer.
- `AuthProvider` owns session restoration, auth-state changes, magic-link requests, callback completion, and sign-out.
- The browser client uses Supabase PKCE, persistent sessions, automatic refresh, and one initialized client.
- `/account` is the small sign-in/account surface.
- `/auth/callback` accepts an SDK authorization `code` or verifies the recommended email `token_hash` flow.
- Callback return paths are limited to internal allowlisted routes (`/` and `/account`).
- Account email is operational data and is excluded from LoadScore analytics and diagnostics.
- Signing in or out never reads, uploads, replaces, or deletes LoadScore local freight/settings data.

## Frontend environment variables

Copy `.env.example` to a local ignored `.env` and set only:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Supabase now recommends its frontend-safe publishable key. The implementation temporarily accepts the legacy `VITE_SUPABASE_ANON_KEY`, but new setup should use `VITE_SUPABASE_PUBLISHABLE_KEY`. Every `VITE_` value is public in built JavaScript. Never put a database password, service-role key, `sb_secret_` key, Stripe key, or another server secret there.

With missing or invalid configuration, authentication displays an unavailable message and the rest of LoadScore continues normally.

Official guidance used:

- [React quickstart](https://supabase.com/docs/guides/auth/quickstarts/react)
- [Passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Regions](https://supabase.com/docs/guides/platform/regions)

## Founder activation guide

Complete these screens in order. Do not share the database password or any secret/service-role key.

1. In Supabase, create a project named **LoadScore**. Choose **East US (North Virginia)** unless current business needs require another US region; this is close to the current Vercel `iad1` deployment region.
2. Open the project's Connect/API-key view. Copy only the **Project URL** and **Publishable key** (`sb_publishable_...`).
3. In **Authentication -> URL Configuration**, use `https://loadscore-mvp.vercel.app` as the current production site URL.
4. Add these exact redirect URLs:
   - `https://loadscore-mvp.vercel.app/auth/callback`
   - `http://localhost:5173/auth/callback`
   - `http://127.0.0.1:5173/auth/callback`
5. Do not add `https://loadscoreapp.com/auth/callback` until that domain is attached to this Vercel project and verified. Do not change DNS as part of PRO-1. Avoid broad production wildcards.
6. In **Authentication -> Email Templates -> Magic Link**, make the action link use the configured callback:

   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in to LoadScore</a>
   ```

7. Review sender name, reply-to behavior, subject, and message copy. Supabase's default delivery may support limited development testing subject to current limits. Before broad production account use, configure and test appropriate custom SMTP on `loadscoreapp.com`; do not assume it is free. Disable email-provider link tracking because rewritten magic links can fail.
8. In Vercel, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to **Production**. Redeploy `main`. Never add a secret/service-role key to Vite variables.
9. Perform the real-email verification below using synthetic load data.

## Required activation verification

1. Open LoadScore anonymously, save a test truck profile/load, and calculate a synthetic load.
2. Request a link from `/account`, receive it, and open it in the same browser where it was requested (the PKCE verifier is browser-local).
3. Confirm `/auth/callback` completes and `/account` shows the test email.
4. Refresh and confirm the session restores.
5. Confirm the local profile, saved load, comparisons, modes, alerts, and preferences remain.
6. Sign out and confirm those local items and the anonymous calculator still work.
7. Sign in with a second test account after logout and confirm the first identity is not retained.
8. Test an expired/replayed link and an offline/network-failure case; errors must be generic and the calculator must remain usable.
9. Confirm PostHog contains no email, token, code, user metadata, or full callback URL.

## Security and deployment notes

- Callback query/hash data is removed from the visible URL immediately and is never logged or sent to analytics.
- Supabase handles PKCE and session refresh; LoadScore does not implement custom cryptography.
- Browser storage compromise can expose a browser session, so XSS prevention, dependency review, short/revocable sessions, and sign-out remain important.
- There is no explicit Content Security Policy in the current deployment. Once the real project URL is known, a future reviewed CSP should add only that exact `https://PROJECT_REF.supabase.co` origin to `connect-src`; do not add `*.supabase.co` or loosen extension permissions.
- No application database tables are created in PRO-1. Supabase's managed Auth data is the only cloud account data introduced by activation.
- Chrome extension version `0.6.1` is unchanged and has no account UI, token storage, identity permission, or Supabase host access.

## Exit boundary

The code milestone is complete, but PRO-1 is not fully production-verified until the founder creates/configures the real Supabase project, adds the two public Vercel variables, redeploys, and completes the real-email checklist. Do not begin PRO-2 database/RLS work until that evidence is recorded.
