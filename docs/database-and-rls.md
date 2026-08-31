# Secure Account Database and RLS (PRO-2)

Status: **code complete; production migration and real authenticated database read pending.**

PRO-2 creates only the minimum account and future subscription-state foundation. It does not add Stripe, paid access, entitlement enforcement, cloud freight storage, extension authentication, or feature gates. Existing calculator, freight, truck, saved-load, comparison, Operating Mode, alert, import, and preference data remain local-only.

## Migration

Canonical migration:

`supabase/migrations/20260830000000_secure_account_database.sql`

It creates:

- `public.user_profiles`: one minimal LoadScore account-metadata row per `auth.users` UUID. The canonical name deliberately distinguishes account metadata from the existing local truck/driver profiles.
- `public.subscriptions`: one future server-authoritative account-tier/billing-state row per user, initialized as `free` / `inactive`.
- `private.set_updated_at()`: invoker-rights timestamp trigger function in a non-exposed schema.
- `private.bootstrap_loadscore_account()`: narrowly scoped signup trigger function. This is the only `security definer` function because the Supabase Auth administration role cannot safely rely on browser grants to create account rows. It uses `search_path = ''`, schema-qualified tables, copies no auth metadata, and has EXECUTE revoked from browser roles.

The migration backfills all existing `auth.users` rows with `on conflict do nothing`, so the existing PRO-1 account receives exactly one profile and one Free/inactive foundation row without creating a second login.

## Field ownership and access

| Data | Anonymous | Authenticated browser | Trusted future server |
|---|---|---|---|
| `user_profiles.user_id` | No access | Read own only; cannot update | Read/write |
| `user_profiles.display_name` | No access | Read/update own only | Read/write |
| Profile timestamps | No access | Read own; cannot update directly | Read/write |
| Safe subscription state | No access | Read own `plan`, `status`, period/grace flags and timestamps | Read/write |
| Stripe identifiers | No access | No column grant | Read/write later |
| Subscription insert/update/delete | No access | No grant and no policy | Trusted server only |

Both public application tables explicitly enable RLS. All `anon` privileges are revoked. Authenticated grants are column-limited, and policies use `(select auth.uid()) = user_id` for both current-row and new-row ownership checks. There is no `using (true)` policy.

The browser cannot set `driver_pro`, change status, create a subscription row, or delete one. In PRO-4, server-side capability resolution will derive entitlements from the authoritative `subscriptions` record. JWT metadata and client state are not entitlement authority.

## Website integration

The authenticated `/account` page reads only these two tables and only their safe columns. When both own rows are readable it shows **Account database: Connected** and **Current account tier: Free** with a separate statement that billing is disabled.

Missing migration, denied access, or network failure produces **Setup pending** without crashing authentication or Free LoadScore. The code does not read or write freight-related tables, and no such cloud tables exist.

## Automated tests

`supabase/tests/database_rls.test.sql` contains 25 pgTAP assertions covering:

- RLS enabled on both exposed tables.
- No anonymous grants.
- Own-profile read/update and cross-user denial.
- Ownership/system-column protection.
- Own safe subscription read and cross-user denial.
- No browser subscription insert/update/delete or Stripe-ID read.
- Trigger bootstrap, Free/inactive defaults, idempotency, and auth-user cascade.

`tests/databaseFoundation.test.js` adds fast application/static security checks for the same migration invariants, safe account queries, failure behavior, no paid claim, and no freight-data query.

Run database tests locally or in a non-production Supabase branch:

```bash
supabase start
supabase db reset
supabase test db
```

Docker and the Supabase CLI are not available in the current Codex environment, so the pgTAP suite has not been executed here. It must pass in a local/staging Supabase stack before PRO-2 is marked fully complete. The 72 Node application/static tests do pass here.

## Production application

Preferred migration deployment after local/staging pgTAP passes:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
```

Never run `supabase db reset --linked` against production. Never paste a database password, connection string, service-role key, or secret key into ChatGPT.

If the founder uses the Supabase SQL Editor instead, open a new query in the verified LoadScore project, paste the exact committed migration file, review the two table names and transaction boundary, and run it once. This is a bounded alternative but does not create CLI migration-history evidence automatically; record the application date and verify schema history before later `db push` use.

After applying:

1. Confirm `user_profiles` and `subscriptions` both show RLS enabled.
2. Confirm the existing Auth user has one row in each table and is `free` / `inactive`.
3. Sign into the deployed LoadScore app with synthetic/no freight data.
4. Confirm `/account` says **Account database: Connected** and **Current account tier: Free**.
5. Refresh and sign out/in to confirm PRO-1 remains healthy.
6. Confirm no account UUID, email, DB identifier, or auth material appears in PostHog.

## Current deployment evidence

The founder reports PRO-1 magic-link/session/logout/local-data verification complete. A public check on 2026-08-30 confirms the React app and its public Supabase configuration on `https://loadscore-mvp.vercel.app`. The same check found `https://loadscoreapp.com` serving Squarespace and `/account` not serving the React account route, so canonical-domain routing must be re-verified before claiming a production read on that hostname.

PRO-2 remains **code complete / production verification pending** until the migration, pgTAP allow/deny tests, existing-user backfill, and real authenticated account read are verified.
