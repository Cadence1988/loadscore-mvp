import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { marketScores, getCuratedMarketScore } from "../src/data/marketScores.js";
import { calculateLoadScore } from "../src/logic/calculateLoadScore.js";
import { calculateForeSightScore, calculateNearSightScore } from "../src/logic/calculateDualScore.js";
import { SAFE_PROPERTY_KEYS } from "../src/analytics/eventSchema.js";
import { WEB_BUILD_VERSION, EXTENSION_BUILD_VERSION } from "../src/config/version.js";
import { APPROVAL_STATE, DEFAULT_SEASONAL_CAP, STRUCTURAL_CANDIDATES, calculateForeSightShadow, freshnessStatus, seasonalAdjustment, structuralScore } from "../scripts/data/foresight-shadow-core.mjs";

const free4 = JSON.parse(await readFile(new URL("../data/market-intelligence/free4-markets.json", import.meta.url), "utf8"));
const free5 = JSON.parse(await readFile(new URL("../data/market-intelligence/free5-seasonal-profiles.json", import.meta.url), "utf8"));
const artifactText = await readFile(new URL("../data/market-intelligence/free6-foresight-shadow.json", import.meta.url), "utf8");
const artifact = JSON.parse(artifactText);
const market = (name) => free4.markets.find((item) => item.displayName === name);
const seasonal = (name) => free5.markets.find((item) => item.marketName === name);

test("structural candidates are bounded, weighted, and distinct", () => {
  const indicators = { outboundFreightPercentile: 100, totalTruckFreightPercentile: 50, outboundBalancePercentile: 25, commodityDiversityPercentile: 0 };
  assert.equal(structuralScore(indicators, STRUCTURAL_CANDIDATES.outbound_led), 60);
  assert.equal(structuralScore({ ...indicators, outboundFreightPercentile: 999 }), 100);
  assert.equal(structuralScore(null), null);
  assert.notEqual(structuralScore(indicators, STRUCTURAL_CANDIDATES.outbound_led), structuralScore(indicators, STRUCTURAL_CANDIDATES.resilient_mix));
});

test("seasonality is capped and equipment gated", () => {
  const synthetic = { sourceMapping: { confidence: "HIGH" }, seasonalEvidence: [{ evidenceId: "x", commodityGroup: "test", equipmentContext: { observedContext: "REEFER" }, movement: { structuralYears: [2019, 2025], averageAnnualShipmentTons: 100, quarterlyAverageShares: [{ quarter: 4, averageRatio: 99, classification: "peak" }] }, historicalConsistency: { level: "HIGH" }, confidence: { level: "HIGH" }, founderReview: { status: "strong_seasonal_evidence" } }] };
  assert.equal(seasonalAdjustment(synthetic, { equipment: "REEFER", date: "2026-10-12" }).adjustment, DEFAULT_SEASONAL_CAP);
  for (const equipment of ["DRY_VAN", "FLATBED", "UNKNOWN"]) assert.equal(seasonalAdjustment(synthetic, { equipment, date: "2026-10-12" }).adjustment, 0);
});

test("geography, history, and evidence LOW gates withhold seasonal adjustment", () => {
  const base = structuredClone(seasonal("Fresno, CA"));
  for (const mutate of [
    (value) => { value.sourceMapping.confidence = "LOW"; },
    (value) => { value.seasonalEvidence.forEach((item) => { item.historicalConsistency.level = "LOW"; }); },
    (value) => { value.seasonalEvidence.forEach((item) => { item.confidence.level = "LOW"; }); },
  ]) {
    const copy = structuredClone(base);
    mutate(copy);
    const result = seasonalAdjustment(copy, { equipment: "REEFER", date: "2026-10-12" });
    assert.equal(result.adjustment, 0);
    assert.equal(result.status, "WITHHELD");
  }
});

test("freshness states and current-year exclusion are explicit", () => {
  assert.equal(freshnessStatus(2025, "2026-10-12"), "CURRENT_ENOUGH");
  assert.equal(freshnessStatus(2022, "2026-10-12"), "AGING");
  assert.equal(freshnessStatus(2010, "2026-10-12"), "STALE_FOR_DYNAMIC_USE");
  assert.equal(freshnessStatus(null, "2026-10-12"), "NOT_APPLICABLE");
  const result = calculateForeSightShadow({ market: market("Fresno, CA"), seasonalMarket: seasonal("Fresno, CA"), equipment: "REEFER", date: "2026-10-12" });
  assert.equal(result.freshness.currentYearDataUsed, false);
});

test("shadow contract is deterministic, bounded, explained, and approval gated", () => {
  const input = { market: market("Atlanta, GA"), seasonalMarket: seasonal("Atlanta, GA"), equipment: "REEFER", date: "2026-10-12" };
  const first = calculateForeSightShadow(input);
  assert.deepEqual(first, calculateForeSightShadow(input));
  assert.equal(first.approvalState, APPROVAL_STATE);
  assert.ok(first.shadowScore >= 0 && first.shadowScore <= 100);
  assert.ok(first.reasons.length >= 2);
  const missing = calculateForeSightShadow();
  assert.equal(missing.shadowScore, null);
  assert.match(missing.reasons[0], /no score was invented/i);
});

test("artifact backtests all markets and sensitivity is reproducible", () => {
  assert.equal(artifact.metadata.approvalState, "NOT_APPROVED_FOR_PRODUCTION");
  assert.equal(artifact.metadata.productionRuntimeDependency, false);
  assert.equal(artifact.metadata.analyticsAllowed, false);
  assert.equal(artifact.backtest.curated.length, 44);
  assert.equal(artifact.backtest.priorityUnscored.length, 25);
  assert.equal(artifact.backtest.priorityUnscored.find((item) => item.market === "Eagle Pass, TX").shadowScore, null);
  assert.equal(artifact.summary.closeAgreement + artifact.summary.moderateDisagreement + artifact.summary.materialDisagreement, 44);
  assert.deepEqual(artifact.sensitivity.unstableMarkets, artifact.sensitivity.markets.filter((item) => item.unstable).map((item) => item.market));
  assert.equal(createHash("sha256").update(artifactText).digest("hex"), "27a489ac3732da43357682058d699c7b79dcc2eb5685f4381152ca87c79d884e");
});

test("production scoring, UI delivery, analytics, versions, and extension remain unchanged", async () => {
  assert.equal(Object.keys(marketScores).length, 44);
  assert.equal(createHash("sha256").update(JSON.stringify(marketScores)).digest("hex"), "e06bfd8b59b0631cf8aeb7a861faa3b5ed92eeceb671e9dfb8da547b2359cf6a");
  assert.equal(getCuratedMarketScore("Atlanta, GA"), 88);
  const input = { origin: "Dallas, TX", destination: "Atlanta, GA", loadRate: 2600, loadedMiles: 780, deadheadMiles: 35, deadheadConfirmed: true, mpg: 6.5, fuelPrice: 4, fixedCostPerMile: 0.65 };
  assert.equal(calculateLoadScore({ ...input, reloadScore: 88 }).score, 100);
  assert.equal(calculateNearSightScore(input).score, 100);
  assert.equal(calculateForeSightScore({ destination: "Atlanta, GA", curatedReloadScore: 88 }).score, 88);
  assert.equal(WEB_BUILD_VERSION, "2026.10.12-beta.11");
  assert.equal(EXTENSION_BUILD_VERSION, "0.6.2");
  for (const forbidden of ["shadow_score", "destination", "seasonal_adjustment", "market_confidence", "commodity"]) assert.equal(SAFE_PROPERTY_KEYS.has(forbidden), false);
  const sourceFiles = await readdir(new URL("../src/", import.meta.url), { recursive: true });
  const sourceText = (await Promise.all(sourceFiles.filter((file) => /\.(js|jsx)$/.test(file)).map((file) => readFile(new URL(`../src/${file.replaceAll("\\", "/")}`, import.meta.url), "utf8")))).join("\n");
  assert.equal(/free6-foresight-shadow|calculateForeSightShadow/.test(sourceText), false);
  const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.version, "0.6.2");
  const publicFiles = await readdir(new URL("../public/", import.meta.url), { recursive: true });
  const extensionFiles = await readdir(new URL("../extension/", import.meta.url), { recursive: true });
  assert.equal(publicFiles.some((file) => /free6|foresight-shadow/i.test(file)), false);
  assert.equal(extensionFiles.some((file) => /free6|foresight-shadow/i.test(file)), false);
});
