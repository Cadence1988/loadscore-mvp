import test from "node:test";
import assert from "node:assert/strict";
import { assessEvaluationTrust, calculationInputWithTrust, hasKnownDeadhead } from "../src/logic/evaluationTrust.js";
import { normalizeLoad } from "../src/logic/loadNormalizer.js";
import { evaluateOperatingModes, migrateOperatingModes } from "../src/logic/operatingModes.js";
import { readOnboardingState, saveOnboardingState, shouldShowOnboarding } from "../src/logic/onboarding.js";

const base = { origin: "Dallas, TX", destination: "Atlanta, GA", loadRate: 2000, loadedMiles: 800 };

test("unknown, confirmed zero, and positive deadhead are distinct", () => {
  assert.equal(hasKnownDeadhead({ ...base, deadheadMiles: null }), false);
  assert.equal(hasKnownDeadhead({ ...base, deadheadMiles: 0 }), true);
  assert.equal(hasKnownDeadhead({ ...base, deadheadMiles: 35 }), true);
  assert.equal(assessEvaluationTrust({ ...base, deadheadMiles: null }).status, "provisional");
  assert.equal(assessEvaluationTrust({ ...base, deadheadMiles: 0 }).status, "complete");
});

test("calculation fallback stays explicitly provisional", () => {
  const evaluation = calculationInputWithTrust({ ...base, deadheadMiles: null });
  assert.equal(evaluation.input.deadheadMiles, 0);
  assert.equal(evaluation.trust.canRank, false);
  assert.match(evaluation.trust.message, /not eligible.*Top 7/i);
});

test("imported and parser loads without deadhead cannot mode-match or rank", () => {
  for (const source of ["csv", "pasted_text", "highlighted_text"]) {
    const normalized = normalizeLoad(base, source);
    assert.equal(normalized.load.deadheadConfirmed, false);
    assert.equal(assessEvaluationTrust(normalized.load).canRank, false);
    const modes = evaluateOperatingModes({ ...normalized.load, result: { score: 100, allInRpm: 4, estimatedProfit: 2000, reloadScore: 90 } }, migrateOperatingModes());
    assert.equal(modes.preferred.matches, false);
  }
});

test("onboarding completion and skip persist without touching other settings", () => {
  const values = new Map([["loadscore-targets", "preserve-me"]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(shouldShowOnboarding(storage), true);
  saveOnboardingState(storage, "completed");
  assert.equal(readOnboardingState(storage).status, "completed");
  assert.equal(shouldShowOnboarding(storage), false);
  assert.equal(values.get("loadscore-targets"), "preserve-me");
  saveOnboardingState(storage, "skipped");
  assert.equal(readOnboardingState(storage).status, "skipped");
});
