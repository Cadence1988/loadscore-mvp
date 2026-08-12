import test from "node:test";
import assert from "node:assert/strict";
import { calculateLoadScore } from "../src/logic/calculateLoadScore.js";
import { evaluateAlertMatch } from "../src/logic/evaluateAlertMatch.js";

const profile = {
  minimumLoadScore: 70,
  targetAllInRpm: 2.25,
  targetProfit: 500,
  maximumDeadhead: 100,
  minimumReloadScore: 50,
};

function evaluatedLoad(overrides = {}) {
  const load = {
    origin: "Dallas, TX",
    destination: "Atlanta, GA",
    loadRate: 2600,
    loadedMiles: 780,
    deadheadMiles: 35,
    mpg: 6.5,
    fuelPrice: 4,
    fixedCostPerMile: 0.65,
    reloadScore: 88,
    reloadScoreSource: "curated",
    ...overrides,
  };
  return { ...load, result: calculateLoadScore(load) };
}

test("strong load matches default alert profile", () => {
  assert.equal(evaluateAlertMatch(evaluatedLoad(), profile).status, "match");
});

test("weak load does not match", () => {
  assert.equal(evaluateAlertMatch(evaluatedLoad({ loadRate: 900, deadheadMiles: 200 }), profile).status, "no_match");
});

test("unknown market warning keeps neutral reload score", () => {
  const load = evaluatedLoad({ reloadScore: 50, reloadScoreSource: "default" });
  const match = evaluateAlertMatch(load, profile);
  assert.equal(load.result.reloadScore, 50);
  assert.match(match.warnings.join(" "), /neutral default/i);
});

test("preferred and avoided destinations are honored", () => {
  assert.equal(
    evaluateAlertMatch(evaluatedLoad(), { ...profile, preferredDestinations: "Atlanta, GA" }).status,
    "match",
  );
  assert.equal(
    evaluateAlertMatch(evaluatedLoad(), { ...profile, avoidedDestinations: "Atlanta, GA" }).status,
    "no_match",
  );
});

test("missing data remains distinct", () => {
  assert.equal(evaluateAlertMatch(evaluatedLoad({ origin: "" }), profile).status, "missing_data");
});
