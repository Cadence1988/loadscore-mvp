import test from "node:test";
import assert from "node:assert/strict";
import { activeModeEvaluation, evaluateOperatingModes, migrateOperatingModes, profileForMode } from "../src/logic/operatingModes.js";

const load = { origin: "Dallas, TX", destination: "Atlanta, GA", loadRate: 1800, loadedMiles: 780, deadheadMiles: 35, result: { score: 65, allInRpm: 2.1, estimatedProfit: 400, reloadScore: 60 } };

test("legacy alert settings migrate into Preferred without losing destinations", () => {
  const config = migrateOperatingModes({ minimumLoadScore: 75, targetAllInRpm: 2.4, preferredDestinations: "Atlanta", avoidedDestinations: "Miami" });
  assert.equal(config.activeMode, "preferred");
  assert.equal(config.modes.preferred.minimumLoadScore, 75);
  assert.equal(profileForMode(config, "preferred").avoidedDestinations, "Miami");
});

test("a load can fail Preferred and pass Flexible and Recovery without changing its score", () => {
  const config = migrateOperatingModes();
  const originalScore = load.result.score;
  const results = evaluateOperatingModes(load, config);
  assert.equal(results.preferred.matches, false);
  assert.equal(results.flexible.matches, true);
  assert.equal(results.recovery.matches, true);
  assert.equal(load.result.score, originalScore);
});

test("active mode is explicit and never silently changes", () => {
  const config = { ...migrateOperatingModes(), activeMode: "preferred" };
  const result = activeModeEvaluation(load, config);
  assert.equal(result.mode, "preferred");
  assert.equal(config.activeMode, "preferred");
});

test("avoided destinations remain a global hard exclusion", () => {
  const config = migrateOperatingModes({ avoidedDestinations: "Atlanta" });
  const results = evaluateOperatingModes(load, config);
  assert.equal(results.preferred.matches, false);
  assert.equal(results.flexible.matches, false);
  assert.equal(results.recovery.matches, false);
});

test("missing data is preserved across every mode", () => {
  const results = evaluateOperatingModes({ origin: "Dallas" }, migrateOperatingModes());
  assert.deepEqual(Object.values(results).map((item) => item.status), ["missing_data", "missing_data", "missing_data"]);
});
