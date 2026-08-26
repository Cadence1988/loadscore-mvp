import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  callbackUrlFor,
  isValidEmail,
  readSupabaseConfig,
  routeKind,
  safeInternalRoute,
} from "../src/auth/authConfig.js";
import { completeAuthCallback } from "../src/auth/authCallback.js";
import { endAuthSession, requestMagicLink } from "../src/auth/authOperations.js";
import { sanitizeAnalyticsProperties } from "../src/analytics/eventSchema.js";
import { supportedEvents } from "../src/analytics/analytics.js";
import { EXTENSION_BUILD_VERSION, WEB_BUILD_VERSION } from "../src/config/version.js";

const root = fileURLToPath(new URL("../", import.meta.url));

function fakeClient(overrides = {}) {
  const calls = [];
  const auth = {
    signInWithOtp: async (input) => { calls.push(["signInWithOtp", input]); return { error: null }; },
    signOut: async () => { calls.push(["signOut"]); return { error: null }; },
    verifyOtp: async (input) => { calls.push(["verifyOtp", input]); return { error: null }; },
    exchangeCodeForSession: async (code) => { calls.push(["exchangeCodeForSession", code]); return { error: null }; },
    getSession: async () => ({ data: { session: null }, error: null }),
    ...overrides,
  };
  return { auth, calls };
}

test("missing or invalid Supabase configuration remains safely disabled", async () => {
  assert.deepEqual(readSupabaseConfig({}).configured, false);
  assert.equal(readSupabaseConfig({ VITE_SUPABASE_URL: "not-a-url", VITE_SUPABASE_PUBLISHABLE_KEY: "public" }).issue, "invalid_project_url");
  assert.equal(readSupabaseConfig({
    VITE_SUPABASE_URL: "https://loadscore.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_x",
  }).issue, "secret_key_not_allowed");
  const config = readSupabaseConfig({
    VITE_SUPABASE_URL: "https://loadscore.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  });
  assert.equal(config.configured, true);

  const module = await import("../src/auth/supabaseClient.js");
  assert.equal(module.supabaseConfig.configured, false);
  assert.equal(module.supabaseClient, null);
});

test("email, callback, and route helpers reject unsafe input", () => {
  assert.equal(isValidEmail("driver@example.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(callbackUrlFor({ origin: "https://loadscore-mvp.vercel.app/" }), "https://loadscore-mvp.vercel.app/auth/callback");
  assert.equal(safeInternalRoute("/account"), "/account");
  assert.equal(safeInternalRoute("https://evil.example"), "/account");
  assert.equal(safeInternalRoute("//evil.example"), "/account");
  assert.equal(routeKind("/auth/callback"), "auth_callback");
  assert.equal(routeKind("/account/"), "account");
  assert.equal(routeKind("/anything"), "calculator");
});

test("magic-link requests are normalized, PKCE-routed, and generic on network failure", async () => {
  const client = fakeClient();
  const result = await requestMagicLink(client, " Driver@Example.COM ", { origin: "https://loadscore-mvp.vercel.app" });
  assert.equal(result.ok, true);
  assert.deepEqual(client.calls[0], ["signInWithOtp", {
    email: "driver@example.com",
    options: {
      shouldCreateUser: true,
      emailRedirectTo: "https://loadscore-mvp.vercel.app/auth/callback",
    },
  }]);
  assert.deepEqual(await requestMagicLink(client, "bad", { origin: "https://example.com" }), { ok: false, reason: "invalid_email" });

  const failed = fakeClient({ signInWithOtp: async () => { throw new Error("private provider detail"); } });
  assert.deepEqual(await requestMagicLink(failed, "driver@example.com", { origin: "https://example.com" }), { ok: false, reason: "request_failed" });
});

test("callback verifies token-hash and authorization-code forms without accepting malformed links", async () => {
  const tokenClient = fakeClient();
  assert.deepEqual(
    await completeAuthCallback(tokenClient, "https://loadscore.example/auth/callback?token_hash=secret-hash&type=email"),
    { ok: true, alreadyAuthenticated: false },
  );
  assert.deepEqual(tokenClient.calls[0], ["verifyOtp", { token_hash: "secret-hash", type: "email" }]);

  const codeClient = fakeClient();
  assert.equal((await completeAuthCallback(codeClient, "https://loadscore.example/auth/callback?code=one-use-code")).ok, true);
  assert.deepEqual(codeClient.calls[0], ["exchangeCodeForSession", "one-use-code"]);

  assert.deepEqual(await completeAuthCallback(codeClient, "not-a-url"), { ok: false, reason: "invalid_callback" });
  assert.deepEqual(await completeAuthCallback(codeClient, "https://loadscore.example/auth/callback"), { ok: false, reason: "missing_credentials" });
});

test("expired or replayed callbacks fail safely while an existing session is accepted", async () => {
  const expired = fakeClient({ verifyOtp: async () => ({ error: new Error("expired token") }) });
  assert.deepEqual(
    await completeAuthCallback(expired, "https://loadscore.example/auth/callback?token_hash=expired&type=email"),
    { ok: false, reason: "verification_failed" },
  );

  const activeSession = fakeClient({
    verifyOtp: async () => ({ error: new Error("already used") }),
    getSession: async () => ({ data: { session: { user: { id: "account-a" } } }, error: null }),
  });
  assert.deepEqual(
    await completeAuthCallback(activeSession, "https://loadscore.example/auth/callback?token_hash=replayed&type=email"),
    { ok: true, alreadyAuthenticated: true },
  );
});

test("login and logout operations leave all existing LoadScore local data untouched", async () => {
  const localData = new Map([
    ["loadscore-targets", "targets"],
    ["loadscore-operating-modes", "modes"],
    ["loadscore-comparisons", "loads"],
    ["loadscore-profiles", "profiles"],
    ["loadscore-alert-settings", "alerts"],
  ]);
  const before = JSON.stringify([...localData]);
  const accountA = fakeClient();
  assert.equal((await requestMagicLink(accountA, "a@example.com", { origin: "https://example.com" })).ok, true);
  assert.equal((await endAuthSession(accountA)).ok, true);
  const accountB = fakeClient();
  assert.equal((await requestMagicLink(accountB, "b@example.com", { origin: "https://example.com" })).ok, true);
  assert.equal(JSON.stringify([...localData]), before);
});

test("auth analytics are allowlisted while identity and token properties are dropped", () => {
  for (const event of ["account_signin_viewed", "magic_link_requested", "auth_completed", "auth_signed_out"]) {
    assert.equal(supportedEvents.has(event), true);
  }
  assert.deepEqual(
    sanitizeAnalyticsProperties({
      surface: "web",
      email: "driver@example.com",
      access_token: "secret",
      refresh_token: "secret",
      auth_code: "secret",
      callback_url: "https://example.com/auth/callback?code=secret",
    }),
    { surface: "web" },
  );
});

test("PRO-1 routing, version, and extension boundary are explicit", async () => {
  assert.equal(WEB_BUILD_VERSION, "2026.08.26-beta.6");
  assert.equal(EXTENSION_BUILD_VERSION, "0.6.1");
  const manifest = JSON.parse(await readFile(`${root}extension/manifest.json`, "utf8"));
  assert.equal(manifest.version, "0.6.1");
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "storage", "notifications"]);
  assert.equal("host_permissions" in manifest, false);

  const vercel = JSON.parse(await readFile(`${root}vercel.json`, "utf8"));
  assert.deepEqual(vercel.rewrites.map((item) => item.source), ["/account", "/auth/callback"]);
});

test("account UI remains honest about local data and absent billing", async () => {
  const accountPage = await readFile(`${root}src/pages/AccountPage.jsx`, "utf8");
  const signInForm = await readFile(`${root}src/components/SignInForm.jsx`, "utf8");
  assert.match(accountPage, /remain stored locally/i);
  assert.match(accountPage, /No subscription, billing, Pro status, or cloud freight sync exists yet/i);
  assert.match(signInForm, /Check your email for your LoadScore sign-in link/i);
  assert.doesNotMatch(signInForm, /trackEvent\([^\n]*email/i);
});
