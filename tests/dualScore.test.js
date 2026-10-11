import test from "node:test";
import assert from "node:assert/strict";
import { supportedEvents, sanitizeEventProperties } from "../src/analytics/analytics.js";
import { calculateDualScore, calculateForeSightScore, calculateNearSightScore } from "../src/logic/calculateDualScore.js";
import { calculateLoadScore } from "../src/logic/calculateLoadScore.js";
import { calculateMinimumRate } from "../src/logic/calculateMinimumRate.js";
import { evaluateAlertMatch } from "../src/logic/evaluateAlertMatch.js";

const strongEconomics = {
  origin: "Dallas, TX",
  destination: "Atlanta, GA",
  loadRate: 2600,
  loadedMiles: 780,
  deadheadMiles: 35,
  deadheadConfirmed: true,
  mpg: 6.5,
  fuelPrice: 4,
  fixedCostPerMile: 0.65,
};

test("strong existing economics produce strong NearSight", () => {
  const nearSight = calculateNearSightScore(strongEconomics);
  assert.equal(nearSight.status, "complete");
  assert.equal(nearSight.score, 100);
  assert.equal(nearSight.band, "high");
  assert.match(nearSight.explanation.positives.map((item) => item.title).join(" "), /Strong all-in RPM/);
});

test("weak existing economics produce weaker NearSight", () => {
  const nearSight = calculateNearSightScore({
    ...strongEconomics,
    loadRate: 900,
    deadheadMiles: 220,
  });
  assert.equal(nearSight.status, "complete");
  assert.ok(nearSight.score < 40);
  assert.match(nearSight.explanation.warnings.map((item) => item.title).join(" "), /Low all-in RPM/);
});

test("NearSight excludes destination Reload Score", () => {
  const atlanta = calculateNearSightScore({ ...strongEconomics, destination: "Atlanta, GA", curatedReloadScore: 88 });
  const miami = calculateNearSightScore({ ...strongEconomics, destination: "Miami, FL", curatedReloadScore: 35 });
  assert.equal(atlanta.score, miami.score);
  assert.deepEqual(atlanta.explanation, miami.explanation);
});

test("changing only destination does not alter NearSight", () => {
  const first = calculateDualScore({ ...strongEconomics, destination: "Atlanta, GA", curatedReloadScore: 88 });
  const second = calculateDualScore({ ...strongEconomics, destination: "Denver, CO", curatedReloadScore: 40 });
  assert.equal(first.nearSight.score, second.nearSight.score);
  assert.notEqual(first.foreSight.score, second.foreSight.score);
});

test("known market produces ForeSight from curated Reload Score", () => {
  const foreSight = calculateForeSightScore({ destination: "Laredo, TX", curatedReloadScore: 74 });
  assert.equal(foreSight.status, "complete");
  assert.equal(foreSight.score, 74);
  assert.match(foreSight.source, /Not live market data/i);
});

test("unknown market produces limited_data instead of an invented score", () => {
  const foreSight = calculateForeSightScore({ destination: "Unscored, ZZ", curatedReloadScore: null });
  assert.equal(foreSight.status, "limited_data");
  assert.equal(foreSight.score, null);
  assert.match(foreSight.summary, /No curated/i);
});

test("ForeSight avoids real-time freight claims", () => {
  const foreSight = calculateForeSightScore({ destination: "Atlanta, GA", curatedReloadScore: 88 });
  const text = JSON.stringify(foreSight);
  assert.doesNotMatch(text, /real-time|guarantee|will find/i);
  assert.match(text, /curated/i);
});

test("main LoadScore remains numerically unchanged for existing fixture", () => {
  const result = calculateLoadScore({ ...strongEconomics, reloadScore: 88 });
  assert.equal(result.score, 100);
  assert.equal(result.label, "Strong Load");
});

test("operating modes still evaluate against the existing main LoadScore", () => {
  const result = calculateLoadScore({ ...strongEconomics, reloadScore: 88 });
  const match = evaluateAlertMatch(
    { ...strongEconomics, result, reloadScoreSource: "curated" },
    { minimumLoadScore: 70, targetAllInRpm: 2.25, targetProfit: 500, maximumDeadhead: 100, minimumReloadScore: 50 },
  );
  assert.equal(match.status, "match");
});

test("minimum-rate logic remains independent from dual scoring", () => {
  const before = calculateMinimumRate({
    ...strongEconomics,
    targetAllInRpm: 2.25,
    targetProfit: 500,
  });
  calculateDualScore({ ...strongEconomics, curatedReloadScore: 88 });
  const after = calculateMinimumRate({
    ...strongEconomics,
    targetAllInRpm: 2.25,
    targetProfit: 500,
  });
  assert.deepEqual(after, before);
});

test("incomplete fields produce incomplete or preliminary states", () => {
  assert.equal(calculateNearSightScore({ loadRate: "", loadedMiles: "" }).status, "incomplete");
  const preliminary = calculateNearSightScore({ ...strongEconomics, deadheadMiles: "", deadheadConfirmed: false });
  assert.equal(preliminary.status, "preliminary");
});

test("destination added causes ForeSight to move from waiting to visible score", () => {
  const waiting = calculateForeSightScore({ destination: "", curatedReloadScore: null });
  const visible = calculateForeSightScore({ destination: "Atlanta, GA", curatedReloadScore: 88 });
  assert.equal(waiting.status, "incomplete");
  assert.equal(visible.status, "complete");
  assert.equal(visible.score, 88);
});

test("dual-score analytics events are supported without freight-field leakage", () => {
  assert.equal(supportedEvents.has("dual_score_viewed"), true);
  assert.equal(supportedEvents.has("nearsight_foresight_tradeoff_viewed"), true);
  assert.deepEqual(
    sanitizeEventProperties({
      surface: "web",
      nearsight_band: "high",
      foresight_band: "limited",
      tradeoff_type: "limited_data",
      origin: "Dallas, TX",
      destination: "Atlanta, GA",
      loadRate: 2600,
      loadedMiles: 780,
      brokerReference: "private",
    }),
    {
      surface: "web",
      nearsight_band: "high",
      foresight_band: "limited",
      tradeoff_type: "limited_data",
    },
  );
});

