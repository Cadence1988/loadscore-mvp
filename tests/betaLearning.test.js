import test from "node:test";
import assert from "node:assert/strict";
import { getOrCreateAnonymousInstallationId, sanitizeEventProperties, supportedEvents } from "../src/analytics/analytics.js";
import { allowlistedTesterSource, browserCategory, buildDiagnostic, diagnosticText, MAX_BETA_REPORTS, saveLocalBetaReport, sourceFromUrl } from "../src/beta/betaSupport.js";
import { EXTENSION_BUILD_VERSION, WEB_BUILD_VERSION } from "../src/config/version.js";

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("anonymous installation ID persists locally and is random rather than fingerprint-derived", () => {
  const storage = memoryStorage();
  const first = getOrCreateAnonymousInstallationId(storage);
  const second = getOrCreateAnonymousInstallationId(storage);
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f-]{36}$/i);
  assert.notEqual(first, browserCategory("Chrome/120"));
});

test("diagnostic bundle contains safe versions and excludes freight content", () => {
  const diagnostic = buildDiagnostic({ installationId: "safe-id", mode: "flexible", feature: "import", category: "parser", parserSource: "csv", parserOutcome: "partial", parserFields: ["deadhead"], userAgent: "Mozilla Chrome/120", rawText: "PRIVATE FREIGHT", route: "PRIVATE LANE" });
  assert.equal(diagnostic.web_build, WEB_BUILD_VERSION);
  assert.equal(diagnostic.extension_build, EXTENSION_BUILD_VERSION);
  assert.equal(diagnostic.browser_category, "chrome");
  assert.doesNotMatch(diagnosticText(diagnostic), /PRIVATE/);
  assert.deepEqual(diagnostic.parser_field_status, ["deadhead"]);
});

test("tester sources are allowlisted and never guessed", () => {
  assert.equal(sourceFromUrl("https://loadscore.app/?source=facebook"), "facebook");
  assert.equal(sourceFromUrl("https://loadscore.app/?source=secret_campaign"), "");
  assert.equal(allowlistedTesterSource("driver_referral"), "driver_referral");
  assert.equal(allowlistedTesterSource("unknown"), "");
});

test("local beta reports are bounded and analytics properties remain private", () => {
  const storage = memoryStorage();
  for (let index = 0; index < MAX_BETA_REPORTS + 10; index += 1) saveLocalBetaReport(storage, { category: "parser", feature: "import", explanation: `local ${index}`, parserFields: ["origin", "private_field"] });
  const stored = JSON.parse(storage.getItem("loadscore-beta-reports"));
  assert.equal(stored.length, MAX_BETA_REPORTS);
  assert.deepEqual(stored[0].parserFields, ["origin"]);
  assert.deepEqual(sanitizeEventProperties({ tester_source: "facebook", feature_area: "import", error_category: "parser", raw_text: "private", route: "private" }), { tester_source: "facebook", feature_area: "import", error_category: "parser" });
});

test("beta learning event vocabulary is available without payment inference", () => {
  for (const event of ["first_successful_calculation", "multiple_loads_calculated", "beta_source_recorded", "problem_reported", "parser_feedback_submitted", "diagnostic_copied", "feedback_form_submitted", "willing_to_pay_indicated"]) assert.equal(supportedEvents.has(event), true, event);
  assert.equal(supportedEvents.has("paid"), false);
  assert.equal(supportedEvents.has("load_booked"), false);
});
