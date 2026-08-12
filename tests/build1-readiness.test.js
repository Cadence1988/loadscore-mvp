import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sanitizeEventProperties, supportedEvents } from "../src/analytics/analytics.js";
import { centralAnalyticsStatus, sendApprovedEvent } from "../src/analytics/productionAdapter.js";

test("manifest stays narrow and declares the beta icon set", async () => {
  const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url)));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "0.6.1");
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "storage", "notifications"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(manifest.background, { service_worker: "background.js", type: "module" });
  assert.deepEqual(Object.keys(manifest.icons), ["16", "32", "48", "128"]);
});

test("central analytics defaults unconfigured and cannot break the app", async () => {
  assert.equal(centralAnalyticsStatus().configured, false);
  assert.equal(centralAnalyticsStatus().consentGranted, false);
  assert.deepEqual(await sendApprovedEvent({ event: "load_calculated" }), {
    sent: false,
    reason: "consent_not_granted",
  });
});

test("central event vocabulary includes first-50 essentials", () => {
  for (const event of [
    "app_opened", "extension_opened", "load_calculated", "load_saved",
    "comparison_viewed", "profile_saved", "profile_applied", "minimum_rate_viewed",
    "broker_message_copied", "highlight_parser_used", "alert_match",
    "recommendation_feedback_positive", "recommendation_feedback_negative",
    "loadscore_result_copied", "loadscore_result_shared",
  ]) {
    assert.equal(supportedEvents.has(event), true, event);
  }
});

test("unsafe analytics properties remain excluded", () => {
  assert.deepEqual(
    sanitizeEventProperties({
      score_band: "strong",
      raw_highlighted_text: "private",
      broker_contact: "private",
      password: "private",
      origin: "private lane",
    }),
    { score_band: "strong" },
  );
});
