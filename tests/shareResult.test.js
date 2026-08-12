import test from "node:test";
import assert from "node:assert/strict";
import { buildShareText, LOADSCORE_LIVE_URL } from "../src/sharing/buildShareText.js";
import { sanitizeEventProperties } from "../src/analytics/analytics.js";
import { buildExtensionShareText } from "../extension/shareResult.js";

const result = {
  score: 87,
  label: "Strong Load",
  allInRpm: 2.58,
  estimatedProfit: 1180,
  reloadScore: 88,
  explanation: {
    positives: [{ title: "Strong all-in RPM" }, { title: "Low deadhead" }],
    warnings: [],
  },
};

test("web share summary contains useful estimates and verified URL", () => {
  const text = buildShareText({
    form: { origin: "Dallas, TX", destination: "Atlanta, GA", loadRate: 2650, deadheadMiles: 42 },
    result,
    reloadScoreSource: "curated",
    minimumRate: 2300,
  });
  assert.match(text, /LoadScore: 87 \/ Strong Load/);
  assert.match(text, /Estimated Profit: \$1,180/);
  assert.match(text, /Curated starter estimate/);
  assert.match(text, /Estimates only/);
  assert.ok(text.includes(LOADSCORE_LIVE_URL));
  assert.doesNotMatch(text, /broker@example|selected raw text|password/i);
});

test("unknown and manual reload labels remain honest", () => {
  const base = { form: {}, result, minimumRate: 2300 };
  assert.match(buildShareText({ ...base, reloadScoreSource: "default" }), /unknown market/i);
  assert.match(buildShareText({ ...base, reloadScoreSource: "manual" }), /Manual estimate/);
});

test("analytics sanitizer drops raw or unapproved fields", () => {
  assert.deepEqual(
    sanitizeEventProperties({ score_band: "strong", raw_highlighted_text: "private offer", origin: "Dallas" }),
    { score_band: "strong" },
  );
});

test("extension share summary excludes raw highlighted text", () => {
  const text = buildExtensionShareText({
    form: { origin: "Dallas, TX", destination: "Atlanta, GA", loadRate: 2650, deadheadMiles: 42 },
    result: { ...result, positives: ["strong all-in RPM"], warnings: [] },
    rate: { minimumRate: 2300 },
  });
  assert.match(text, /Score your own freight/);
  assert.doesNotMatch(text, /raw highlighted|broker contact/i);
});
