import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ACCOUNT_DATABASE_TABLES, loadAccountDatabase } from "../src/account/accountDatabase.js";

const root = fileURLToPath(new URL("../", import.meta.url));

function databaseClient(results = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push({ table, columns: "" });
      return {
        select(columns) {
          calls.at(-1).columns = columns;
          return {
            async maybeSingle() {
              return results[table] || { data: null, error: new Error("missing") };
            },
          };
        },
      };
    },
  };
}

test("account database reads only secured account foundation tables and safe columns", async () => {
  const client = databaseClient({
    user_profiles: {
      data: { user_id: "not-rendered", display_name: "Ryan", created_at: "2026-08-30T00:00:00Z" },
      error: null,
    },
    subscriptions: {
      data: { plan: "free", status: "inactive", created_at: "2026-08-30T00:00:00Z" },
      error: null,
    },
  });
  const result = await loadAccountDatabase(client);
  assert.deepEqual(ACCOUNT_DATABASE_TABLES, ["user_profiles", "subscriptions"]);
  assert.equal(result.state, "connected");
  assert.equal(result.accountTier, "Free");
  assert.equal(result.billingEnabled, false);
  assert.equal(result.billingMode, "test");
  assert.deepEqual(client.calls.map(({ table }) => table), ACCOUNT_DATABASE_TABLES);
  assert.equal(JSON.stringify(client.calls).match(/load|freight|truck|route|broker|alert|comparison|csv/gi), null);
  assert.equal(JSON.stringify(result).includes("not-rendered"), false);
  assert.equal(client.calls[1].columns.includes("stripe_"), false);
});

test("missing or failed account database reads remain non-fatal and never claim Pro", async () => {
  assert.deepEqual(await loadAccountDatabase(null), { state: "unavailable" });
  const failed = databaseClient({
    user_profiles: { data: null, error: new Error("network") },
    subscriptions: { data: { plan: "driver_pro", status: "active" }, error: null },
  });
  assert.deepEqual(await loadAccountDatabase(failed), { state: "unavailable" });

  const unexpectedPaidState = databaseClient({
    user_profiles: { data: { display_name: null, created_at: null }, error: null },
    subscriptions: { data: { plan: "driver_pro", status: "active" }, error: null },
  });
  const result = await loadAccountDatabase(unexpectedPaidState);
  assert.equal(result.accountTier, "Driver Pro (test record)");
  assert.equal(result.subscriptionStatus, "active");
  assert.equal(result.billingEnabled, false);
});

test("migration defines minimal tables, explicit grants, RLS, trigger bootstrap, and no browser billing writes", async () => {
  const migration = await readFile(
    `${root}supabase/migrations/20260830000000_secure_account_database.sql`,
    "utf8",
  );
  assert.match(migration, /create table public\.user_profiles/i);
  assert.match(migration, /create table public\.subscriptions/i);
  assert.match(migration, /alter table public\.user_profiles enable row level security/i);
  assert.match(migration, /alter table public\.subscriptions enable row level security/i);
  assert.match(migration, /to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(migration, /grant update \(display_name\)/i);
  assert.match(migration, /revoke all on table public\.subscriptions from public, anon, authenticated/i);
  assert.doesNotMatch(migration, /grant\s+(insert|update|delete)[^;]*subscriptions[^;]*authenticated/i);
  assert.doesNotMatch(migration, /using\s*\(\s*true\s*\)/i);
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.match(migration, /on conflict \(user_id\) do nothing/i);
  assert.match(migration, /select users\.id\s+from auth\.users/i);
  assert.doesNotMatch(
    migration,
    /create table public\.(saved_load|truck_profile|broker|route|freight|comparison|alert_history)/i,
  );
});

test("pgTAP suite covers required allow, deny, idempotency, cascade, and RLS assertions", async () => {
  const policyTests = await readFile(`${root}supabase/tests/database_rls.test.sql`, "utf8");
  assert.match(policyTests, /select plan\(25\)/i);
  for (const phrase of [
    "RLS is enabled on public.user_profiles",
    "anon has no profile select grant",
    "user A can select only their own profile",
    "user A cannot select user B profile",
    "user A can update their own allowed display_name",
    "user A cannot update user B profile",
    "authenticated browser cannot create subscriptions",
    "authenticated browser cannot update plan or status",
    "authenticated browser cannot delete subscriptions",
    "repeated profile bootstrap cannot create a duplicate",
    "bootstrap never self-grants paid state",
    "auth-user deletion cascades to profile",
  ]) assert.match(policyTests, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
});

test("account UI reports safe test billing state without implying access or cloud freight sync", async () => {
  const accountPage = await readFile(`${root}src/pages/AccountPage.jsx`, "utf8");
  assert.match(accountPage, /Account database/);
  assert.match(accountPage, /Current account tier/);
  assert.match(accountPage, /No live charges/i);
  assert.match(accountPage, /No local freight data was uploaded/);
  assert.doesNotMatch(accountPage, /trackEvent\([^\n]*(database|tier|user_id|email)/i);
});
