import test from "node:test";
import assert from "node:assert/strict";
import { createPostHogPayload, sendApprovedEvent, setCentralAnalyticsConsent, validatedProviderConfig } from "../src/analytics/productionAdapter.js";
import { sanitizeEventProperties, supportedEvents } from "../src/analytics/analytics.js";

function memoryStorage() { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; }
const config = { enabled: true, provider: "posthog", projectToken: "phc_public_test", host: "https://us.i.posthog.com", environment: "production" };
const event = { event: "load_calculated", anonymous_id: "random-install-id", occurred_at: "2026-08-12T00:00:00.000Z", properties: { surface: "web", score_band: "strong", origin: "Dallas", destination: "Atlanta", rate: 2500, broker: "private", rawText: "private", csvContents: "private", import_count: 9999 } };

test("known central events pass while unknown names are blocked", async () => {
  assert.equal(supportedEvents.has("load_calculated"), true);
  const storage = memoryStorage(); setCentralAnalyticsConsent(true, storage);
  assert.deepEqual(await sendApprovedEvent({ ...event, event: "invented_event" }, { storage, config, fetchImpl: () => { throw new Error("must not send"); } }), { sent: false, reason: "event_not_allowlisted" });
});

test("PostHog payload double-sanitizes forbidden freight fields and caps counts", () => {
  const payload = createPostHogPayload(event, config);
  assert.equal(payload.api_key, "phc_public_test");
  assert.equal(payload.distinct_id, "random-install-id");
  assert.deepEqual(payload.properties, { surface: "web", score_band: "strong", import_count: 250, $process_person_profile: false });
  assert.deepEqual(sanitizeEventProperties(event.properties), { surface: "web", score_band: "strong", import_count: 250 });
});

test("opt-out and development mode suppress central network requests", async () => {
  let requests = 0; const fetchImpl = async () => { requests += 1; return { ok: true }; };
  const off = memoryStorage();
  assert.equal((await sendApprovedEvent(event, { storage: off, config, fetchImpl })).reason, "consent_not_granted");
  setCentralAnalyticsConsent(true, off);
  assert.equal((await sendApprovedEvent(event, { storage: off, config: { ...config, environment: "development" }, fetchImpl })).reason, "non_production_suppressed");
  assert.equal(requests, 0);
});

test("consented production sends only custom event payload and provider failure is harmless", async () => {
  const storage = memoryStorage(); setCentralAnalyticsConsent(true, storage); let captured;
  const sent = await sendApprovedEvent(event, { storage, config, fetchImpl: async (url, options) => { captured = { url, options }; return { ok: true }; } });
  assert.deepEqual(sent, { sent: true, reason: "sent" });
  assert.equal(captured.url, "https://us.i.posthog.com/i/v0/e/");
  assert.equal(JSON.parse(captured.options.body).properties.origin, undefined);
  assert.deepEqual(await sendApprovedEvent(event, { storage, config, fetchImpl: async () => { throw new Error("blocked"); } }), { sent: false, reason: "network_failure" });
});

test("provider configuration requires explicit enablement, PostHog, token, and HTTPS host", () => {
  assert.equal(validatedProviderConfig(config).configured, true);
  assert.equal(validatedProviderConfig({ ...config, enabled: false }).configured, false);
  assert.equal(validatedProviderConfig({ ...config, host: "javascript:bad" }).configured, false);
});
