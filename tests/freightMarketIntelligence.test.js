import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { marketScores } from "../src/data/marketScores.js";
import { calculateLoadScore } from "../src/logic/calculateLoadScore.js";
import { SAFE_PROPERTY_KEYS } from "../src/analytics/eventSchema.js";
import { WEB_BUILD_VERSION, EXTENSION_BUILD_VERSION } from "../src/config/version.js";

const regionsPath = new URL("../data/market-intelligence/faf6-region-indicators.json", import.meta.url);
const marketsPath = new URL("../data/market-intelligence/free4-markets.json", import.meta.url);
const regionsArtifact = JSON.parse(await readFile(regionsPath, "utf8"));
const marketsArtifact = JSON.parse(await readFile(marketsPath, "utf8"));

const finiteNonnegative = (value) => Number.isFinite(value) && value >= 0;

test("FREE-4 records official, reproducible, research-only provenance", () => {
  const metadata = regionsArtifact.metadata;
  assert.equal(metadata.researchOnly, true);
  assert.equal(metadata.productionScoringUsed, false);
  assert.equal(metadata.fafVersion, "FAF6.0");
  assert.equal(metadata.baseYear, 2022);
  assert.deepEqual(metadata.units, { tons: "thousand tons", value: "million constant 2022 U.S. dollars" });
  assert.match(metadata.cfsTable, /CF2200A01\/GAS01/);
  assert.equal(metadata.truckMode.fafCode, "1");
  assert.equal(metadata.truckMode.cfsCode, "11");
  for (const source of Object.values(metadata.sources)) {
    assert.match(source.url, /^https:\/\//);
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(source.agency && source.dataset);
  }
});

test("all 134 FAF regions have valid truck indicators and CFS context", () => {
  assert.equal(regionsArtifact.metadata.regionCount, 134);
  assert.equal(regionsArtifact.metadata.regionsWithTruckData, 134);
  assert.equal(regionsArtifact.regions.length, 134);
  assert.equal(new Set(regionsArtifact.regions.map((region) => region.regionId)).size, 134);
  for (const region of regionsArtifact.regions) {
    assert.match(region.regionId, /^\d{3}$/);
    for (const value of Object.values(region.truckFreight)) assert.ok(value === null || finiteNonnegative(value), `${region.regionId}: ${value}`);
    for (const direction of ["outbound", "inbound"]) {
      const commodities = region.commodities[direction];
      assert.ok(commodities.length > 0);
      assert.ok(Math.abs(commodities.reduce((sum, item) => sum + item.share, 0) - 1) < 0.001);
      for (const item of commodities) {
        assert.match(item.code, /^\d{2}$/);
        assert.ok(finiteNonnegative(item.tons) && finiteNonnegative(item.value));
        assert.ok(item.share >= 0 && item.share <= 1);
      }
    }
    assert.ok(region.commodities.diversityRaw >= 0 && region.commodities.diversityRaw <= 1);
    for (const value of Object.values(region.indicators).filter((value) => typeof value === "number")) assert.ok(value >= 0 && value <= 100);
    assert.match(region.indicators.normalizationPopulation, /all 134 FAF6 domestic regions/);
    assert.equal(region.cfsValidation.truckModeCode, "11");
    assert.match(region.cfsValidation.table, /GAS01/);
  }
});

test("all curated and priority markets map deterministically without invented scores", () => {
  const markets = marketsArtifact.markets;
  assert.equal(markets.length, 68);
  const curated = markets.filter((market) => market.roles.curated);
  const priority = markets.filter((market) => market.roles.priority);
  assert.equal(curated.length, 44);
  assert.equal(priority.length, 32);
  assert.equal(new Set(markets.map((market) => market.marketId)).size, markets.length);
  for (const market of markets) {
    assert.match(market.canonicalPlaceId, /^place:\d{7}$/);
    assert.match(market.freightRegion.regionId, /^\d{3}$/);
    assert.ok(["HIGH", "MEDIUM"].includes(market.confidence.level));
    assert.equal(market.equipmentContext.weightsApplied, false);
    assert.equal("replacementScore" in market, false);
    assert.equal("recommendedReloadScore" in market, false);
    assert.ok(["appears_consistent", "needs_review", "insufficient_evidence", "proxy_mismatch", "not_applicable"].includes(market.review.status));
  }
  for (const market of curated) assert.equal(market.currentCuratedReloadScore, marketScores[market.displayName], market.displayName);
  for (const market of markets.filter((market) => !market.roles.curated)) assert.equal(market.currentCuratedReloadScore, null, market.displayName);
});

test("research artifacts do not claim live, seasonal, equipment-weighted, or routing intelligence", async () => {
  assert.equal(marketsArtifact.commodityTaxonomy.length, 42);
  assert.equal(marketsArtifact.commodityTaxonomy.every((item) => item.equipmentWeightsApplied === false), true);
  const raw = `${await readFile(regionsPath, "utf8")} ${await readFile(marketsPath, "utf8")}`;
  for (const forbidden of ["liveLoadCount", "seasonalAdjustment", "routeScore", "equipmentWeight"]) assert.equal(raw.includes(`"${forbidden}"`), false, forbidden);
  const publicEntries = await readdir(new URL("../public/", import.meta.url), { recursive: true });
  const extensionEntries = await readdir(new URL("../extension/", import.meta.url), { recursive: true });
  assert.equal(publicEntries.some((path) => path.includes("market-intelligence") || path.includes("faf6")), false);
  assert.equal(extensionEntries.some((path) => path.includes("market-intelligence") || path.includes("faf6")), false);
});

test("production scoring, privacy, versions, and extension permissions remain unchanged", async () => {
  assert.equal(calculateLoadScore({ loadRate: 2600, loadedMiles: 780, deadheadMiles: 35, mpg: 6.5, fuelPrice: 4, fixedCostPerMile: 0.65, reloadScore: 88 }).score, 100);
  assert.equal(calculateLoadScore({ loadRate: 1000, loadedMiles: 500, deadheadMiles: 50, mpg: 6.5, fuelPrice: 4, fixedCostPerMile: 0.65, reloadScore: undefined }).reloadScore, 50);
  for (const forbidden of ["origin", "destination", "market", "faf_region", "commodity", "tons", "value", "lane"]) assert.equal(SAFE_PROPERTY_KEYS.has(forbidden), false, forbidden);
  assert.equal(WEB_BUILD_VERSION, "2026.10.12-beta.12");
  assert.equal(EXTENSION_BUILD_VERSION, "0.6.2");
  const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.version, "0.6.2");
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "storage", "notifications"]);
  assert.equal("host_permissions" in manifest, false);
});
