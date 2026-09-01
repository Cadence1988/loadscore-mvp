import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createCheckoutHandler } from "../api/billing/create-checkout-session.js";
import { createWebhookHandler } from "../api/stripe/webhook.js";
import { readServerBillingConfig, STRIPE_API_VERSION } from "../api/_lib/billingConfig.js";
import { normalizeStripeStatus, toSubscriptionRecord } from "../api/_lib/subscriptionState.js";
import { createTestCheckout } from "../src/billing/billingClient.js";
import { isOlderStripeEvent } from "../api/_lib/subscriptionRepository.js";
import Stripe from "stripe";

const root = fileURLToPath(new URL("../", import.meta.url));
const TEST_CONFIG = {
  siteUrl: "https://loadscoreapp.com",
  prices: { founding_driver_pro: "price_founder", driver_pro: "price_pro" },
};

function response() {
  return {
    statusCode: 0, body: null, headers: {},
    status(value) { this.statusCode = value; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

function checkoutFixture({ authenticated = true, customer = "cus_existing" } = {}) {
  const calls = [];
  const repository = {
    findByUser: async (id) => ({ user_id: id, stripe_customer_id: customer }),
    attachCustomer: async (id, value) => ({ user_id: id, stripe_customer_id: value }),
  };
  const stripe = {
    customers: {
      create: async (input) => { calls.push(["customer", input]); return { id: "cus_created" }; },
      del: async () => {},
    },
    checkout: { sessions: { create: async (input) => { calls.push(["checkout", input]); return { url: "https://checkout.stripe.test/session" }; } } },
  };
  return {
    calls, repository, stripe,
    handler: createCheckoutHandler({
      config: TEST_CONFIG, stripe, repository,
      authenticate: async () => authenticated ? { id: "11111111-1111-4111-8111-111111111111" } : null,
    }),
  };
}

test("checkout rejects signed-out requests, invalid plans, and client authority fields", async () => {
  let fixture = checkoutFixture({ authenticated: false });
  let res = response();
  await fixture.handler({ method: "POST", headers: {}, body: { plan: "driver_pro" } }, res);
  assert.equal(res.statusCode, 401);

  fixture = checkoutFixture();
  res = response();
  await fixture.handler({ method: "POST", headers: { authorization: "Bearer valid" }, body: { plan: "free" } }, res);
  assert.equal(res.body.error, "invalid_plan");

  res = response();
  await fixture.handler({ method: "POST", headers: { authorization: "Bearer valid" }, body: { plan: "driver_pro", user_id: "attacker" } }, res);
  assert.equal(res.body.error, "invalid_request");
  assert.equal(fixture.calls.length, 0);
});

test("authenticated checkout maps server price, reuses customer, and uses canonical URLs", async () => {
  const fixture = checkoutFixture();
  const res = response();
  await fixture.handler({ method: "POST", headers: { authorization: "Bearer valid" }, body: { plan: "driver_pro" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(fixture.calls.some(([kind]) => kind === "customer"), false);
  const input = fixture.calls.find(([kind]) => kind === "checkout")[1];
  assert.equal(input.mode, "subscription");
  assert.equal(input.customer, "cus_existing");
  assert.equal(input.line_items[0].price, "price_pro");
  assert.equal(input.success_url, "https://loadscoreapp.com/checkout/success");
  assert.equal(input.cancel_url, "https://loadscoreapp.com/account?checkout=canceled");
  assert.deepEqual(Object.keys(input.metadata).sort(), ["loadscore_plan", "loadscore_user_id"]);
});

test("missing Stripe customer is created server-side without email or freight metadata", async () => {
  const fixture = checkoutFixture({ customer: null });
  const res = response();
  await fixture.handler({ method: "POST", headers: { authorization: "Bearer valid" }, body: { plan: "founding_driver_pro" } }, res);
  const customer = fixture.calls.find(([kind]) => kind === "customer")[1];
  assert.deepEqual(Object.keys(customer), ["metadata"]);
  assert.deepEqual(Object.keys(customer.metadata), ["loadscore_user_id"]);
});

function webhookFixture({ userId = "11111111-1111-4111-8111-111111111111", existing = new Map() } = {}) {
  const applied = [];
  const repository = {
    async claimEvent(event) {
      const status = existing.get(event.id);
      if (status === "succeeded") return "duplicate";
      existing.set(event.id, "processing");
      return status === "failed" ? "retry" : "claimed";
    },
    async findUserForStripe() { return userId; },
    async applySubscription(id, record, eventId) { applied.push({ id, record, eventId }); return "updated"; },
    async finishEvent(id, status) { existing.set(id, status); },
  };
  const subscription = {
    id: "sub_test", customer: "cus_test", status: "active", cancel_at_period_end: false,
    items: { data: [{ current_period_end: 1_800_000_000 }] },
    metadata: { loadscore_user_id: userId, loadscore_plan: "driver_pro" },
  };
  const stripe = { subscriptions: { retrieve: async () => subscription } };
  const constructEvent = (body, signature) => {
    if (signature !== "valid") throw new Error("bad signature");
    return JSON.parse(body.toString("utf8"));
  };
  return { applied, repository, stripe, constructEvent, subscription, existing };
}

function subscriptionEvent(id = "evt_one", created = 1_700_000_000, type = "customer.subscription.updated") {
  return { id, created, type, data: { object: { id: "sub_test" } } };
}

test("webhook rejects invalid signature and accepts a valid signed event", async () => {
  const fixture = webhookFixture();
  const handler = createWebhookHandler({ webhookSecret: "whsec_test", ...fixture });
  let res = response();
  await handler({ method: "POST", headers: { "stripe-signature": "invalid" }, body: Buffer.from("{}") }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(fixture.applied.length, 0);

  res = response();
  await handler({ method: "POST", headers: { "stripe-signature": "valid" }, body: Buffer.from(JSON.stringify(subscriptionEvent())) }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(fixture.applied.length, 1);
  assert.equal(fixture.applied[0].record.plan, "driver_pro");
  assert.equal(fixture.applied[0].record.status, "active");
});

test("official Stripe SDK verifies the unchanged raw webhook body", async () => {
  const fixture = webhookFixture();
  const stripeSdk = new Stripe("local_signature_test_key", { apiVersion: STRIPE_API_VERSION });
  const payload = JSON.stringify(subscriptionEvent("evt_sdk_signed", Math.floor(Date.now() / 1000)));
  const secret = "local_test_signing_secret";
  const signature = stripeSdk.webhooks.generateTestHeaderString({ payload, secret });
  const handler = createWebhookHandler({
    webhookSecret: secret,
    stripe: fixture.stripe,
    repository: fixture.repository,
    constructEvent: (body, header, endpointSecret) => stripeSdk.webhooks.constructEvent(body, header, endpointSecret),
  });
  const res = response();
  await handler({ method: "POST", headers: { "stripe-signature": signature }, body: Buffer.from(payload) }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(fixture.applied.length, 1);
});

test("duplicate webhook is idempotent and unmapped users never alter subscription state", async () => {
  const existing = new Map([["evt_done", "succeeded"]]);
  let fixture = webhookFixture({ existing });
  let handler = createWebhookHandler({ webhookSecret: "whsec_test", ...fixture });
  let res = response();
  await handler({ method: "POST", headers: { "stripe-signature": "valid" }, body: Buffer.from(JSON.stringify(subscriptionEvent("evt_done"))) }, res);
  assert.equal(fixture.applied.length, 0);

  fixture = webhookFixture({ userId: null });
  handler = createWebhookHandler({ webhookSecret: "whsec_test", ...fixture });
  res = response();
  await handler({ method: "POST", headers: { "stripe-signature": "valid" }, body: Buffer.from(JSON.stringify(subscriptionEvent("evt_unmapped"))) }, res);
  assert.equal(fixture.applied.length, 0);
  assert.equal(fixture.existing.get("evt_unmapped"), "ignored");
});

test("subscription statuses, dahlia item period, past-due grace, and deletion map conservatively", () => {
  for (const status of ["active", "trialing", "past_due", "unpaid", "canceled", "incomplete", "incomplete_expired", "paused"]) {
    assert.equal(normalizeStripeStatus(status), status);
  }
  assert.equal(normalizeStripeStatus("unknown"), "inactive");
  const pastDue = toSubscriptionRecord({
    id: "sub", customer: "cus", status: "past_due", items: { data: [{ current_period_end: 1_800_000_000 }] },
  }, "driver_pro", 1_700_000_000);
  assert.equal(pastDue.current_period_end, "2027-01-15T08:00:00.000Z");
  assert.equal(pastDue.grace_period_ends_at, "2023-11-21T22:13:20.000Z");
});

test("failed webhook processing remains retryable without duplicate side effects", async () => {
  const fixture = webhookFixture();
  fixture.repository.applySubscription = async () => { throw new Error("temporary database failure"); };
  const handler = createWebhookHandler({ webhookSecret: "whsec_test", ...fixture });
  const body = Buffer.from(JSON.stringify(subscriptionEvent("evt_retry")));
  let res = response();
  await handler({ method: "POST", headers: { "stripe-signature": "valid" }, body }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(fixture.existing.get("evt_retry"), "failed");
});

test("older events are rejected and database updates retain a concurrent order guard", async () => {
  assert.equal(isOlderStripeEvent(200, 199), true);
  assert.equal(isOlderStripeEvent(200, 200), false);
  assert.equal(isOlderStripeEvent(0, 1), false);
  const repository = await readFile(`${root}api/_lib/subscriptionRepository.js`, "utf8");
  assert.match(repository, /\.lte\("stripe_event_created_at", record\.stripe_event_created_at\)/);
});

test("subscription deletion snapshot maps canceled state without a retrieval dependency", async () => {
  const fixture = webhookFixture();
  const deleted = {
    ...subscriptionEvent("evt_deleted", 1_700_000_100, "customer.subscription.deleted"),
    data: { object: { ...fixture.subscription, status: "canceled" } },
  };
  fixture.stripe.subscriptions.retrieve = async () => { throw new Error("deleted subscription should use snapshot"); };
  const handler = createWebhookHandler({ webhookSecret: "whsec_test", ...fixture });
  const res = response();
  await handler({ method: "POST", headers: { "stripe-signature": "valid" }, body: Buffer.from(JSON.stringify(deleted)) }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(fixture.applied[0].record.status, "canceled");
});

test("billing configuration refuses live keys and keeps all secrets server-only", async () => {
  assert.throws(() => readServerBillingConfig({ STRIPE_SECRET_KEY: "sk_live_example" }), /stripe_test_key_required/);
  assert.equal(STRIPE_API_VERSION, "2026-08-26.dahlia");
  const example = await readFile(`${root}.env.example`, "utf8");
  for (const name of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SUPABASE_SECRET_KEY"]) {
    assert.match(example, new RegExp(`^${name}=`, "m"));
    assert.doesNotMatch(example, new RegExp(`VITE_${name}`));
  }
});

test("browser checkout forwards only allowlisted plan and session bearer token", async () => {
  const calls = [];
  const client = { auth: { getSession: async () => ({ data: { session: { access_token: "browser-session-token" } }, error: null }) } };
  const result = await createTestCheckout(client, "driver_pro", async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ url: "https://checkout.stripe.test/one" }) };
  });
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(calls[0].options.body), { plan: "driver_pro" });
  assert.equal(calls[0].options.body.includes("user_id"), false);
});

test("migration locks event ledger and browser subscription writes while success page has no mutation", async () => {
  const migration = await readFile(`${root}supabase/migrations/20260831000000_stripe_test_billing.sql`, "utf8");
  const success = await readFile(`${root}src/pages/CheckoutSuccessPage.jsx`, "utf8");
  assert.match(migration, /create table public\.stripe_webhook_events/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.stripe_webhook_events from public, anon, authenticated/i);
  assert.doesNotMatch(migration, /grant\s+(insert|update|delete)[^;]*authenticated/i);
  assert.doesNotMatch(success, /\.from\(|update\(|insert\(|plan\s*=/i);
  assert.match(success, /does not activate Driver Pro/i);
});

test("billing code and account UI do not add billing identity to analytics or touch freight storage", async () => {
  const files = await Promise.all([
    "src/billing/billingClient.js", "src/pages/AccountPage.jsx", "src/pages/CheckoutSuccessPage.jsx",
    "api/billing/create-checkout-session.js", "api/stripe/webhook.js",
  ].map((file) => readFile(`${root}${file}`, "utf8")));
  const text = files.join("\n");
  assert.doesNotMatch(text, /trackEvent\([\s\S]{0,150}(stripe|customer|subscription|email|user_id)/i);
  assert.doesNotMatch(text, /localStorage|chrome\.storage|saved_load|truck_profile|freight_data/i);
});
