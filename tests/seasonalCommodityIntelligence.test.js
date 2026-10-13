import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { marketScores, getCuratedMarketScore } from "../src/data/marketScores.js";
import { calculateLoadScore } from "../src/logic/calculateLoadScore.js";
import { calculateForeSightScore, calculateNearSightScore } from "../src/logic/calculateDualScore.js";
import { SAFE_PROPERTY_KEYS } from "../src/analytics/eventSchema.js";
import { WEB_BUILD_VERSION, EXTENSION_BUILD_VERSION } from "../src/config/version.js";
import {
  EQUIPMENT_CONTEXTS,
  buildSeasonalProfiles,
  normalizeCommodity,
  parseNassFieldCropContexts,
  parseNassVegetableContexts,
  parseQuarterlyWorksheet,
  parseUsdaDate,
  reviewSeasonalEvidence,
} from "../scripts/data/seasonal-intelligence-core.mjs";

const artifactPath = new URL("../data/market-intelligence/free5-seasonal-profiles.json", import.meta.url);
const artifact = JSON.parse(await readFile(artifactPath, "utf8"));

test("USDA quarterly workbook rows parse against an explicit schema", () => {
  const shared = "<sst><si><t>Year</t></si><si><t>Quarter</t></si><si><t>Origin</t></si><si><t>Commodity</t></si><si><t>Tons</t></si><si><t>ARIZONA</t></si><si><t>Lettuce, Iceberg</t></si></sst>";
  const sheet = '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c></row><row r="2"><c r="A2"><v>2025</v></c><c r="B2"><v>1</v></c><c r="C2" t="s"><v>5</v></c><c r="D2" t="s"><v>6</v></c><c r="E2"><v>125.5</v></c></row></sheetData></worksheet>';
  assert.deepEqual(parseQuarterlyWorksheet(sheet, shared), [{ year: 2025, quarter: 1, origin: "ARIZONA", commodity: "Lettuce, Iceberg", tons: 125.5 }]);
  assert.throws(() => parseQuarterlyWorksheet(sheet.replace("<v>1</v></c><c r=\"C2\"", "<v>9</v></c><c r=\"C2\""), shared), /Invalid AMS shipment row/);
});

test("priority commodity normalization is deterministic and does not force unsupported crops", () => {
  assert.equal(normalizeCommodity("Potatoes, Russet"), "potatoes");
  assert.equal(normalizeCommodity("Lettuce, Romaine"), "lettuce");
  assert.equal(normalizeCommodity("Peppers, Bell"), "peppers");
  assert.equal(normalizeCommodity("Corn, Sweet"), "sweet_corn");
  assert.equal(normalizeCommodity("Soybeans"), null);
  assert.equal(normalizeCommodity("Livestock"), null);
  assert.deepEqual(EQUIPMENT_CONTEXTS, ["REEFER", "DRY_VAN", "FLATBED", "UNKNOWN"]);
});

test("quarterly profiles aggregate safely and derive reproducible peaks and consistency", () => {
  const rows = [];
  for (let year = 2019; year <= 2025; year += 1) for (let quarter = 1; quarter <= 4; quarter += 1) rows.push({ year, quarter, origin: "ARIZONA", commodity: "Lettuce, Iceberg", tons: quarter === 1 ? 700 : 100 });
  const [profile] = buildSeasonalProfiles(rows, { startYear: 2019, endYear: 2025, minimumYears: 5, minimumTons: 0 });
  assert.deepEqual(profile.yearsIncluded, [2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  assert.deepEqual(profile.peakQuarters, [1]);
  assert.equal(profile.historicalConsistency.level, "HIGH");
  assert.equal(profile.historicalConsistency.repeatRate, 1);
  assert.ok(Math.abs(profile.quarterlyAverageShares.reduce((sum, quarter) => sum + quarter.share, 0) - 1) < 0.00001);
  assert.equal(profile.peakIntensityRatio, 2.8);
  const [corrected] = buildSeasonalProfiles([{ year: 2025, quarter: 1, origin: "X", commodity: "Potatoes", tons: -1 }, { year: 2025, quarter: 2, origin: "X", commodity: "Potatoes", tons: 2 }], { startYear: 2025, endYear: 2025, minimumYears: 1, minimumTons: 0 });
  assert.equal(corrected.negativeAggregateCellsFloored, 1);
  assert.equal(corrected.quarterlyAverageShares[0].share, 0);
});

test("NASS field and vegetable harvest contexts parse dates without equating harvest to freight", () => {
  assert.deepEqual(parseUsdaDate("Sept 10"), { month: 9, day: 10, display: "Sep 10" });
  assert.equal(parseUsdaDate("not a date"), null);
  const field = parseNassFieldCropContexts("Usual Planting and Harvesting Dates by Crop - Idaho\nPotatoes, fall .........: 319.0 Apr 6 Apr 28 - May 19 Jun 9 Aug 15 Sep 22 - Oct 13 Oct 27");
  assert.equal(field[0].commodityGroup, "potatoes");
  assert.equal(field[0].harvest.begins.month, 8);
  assert.equal(field[0].harvest.ends.month, 10);
  const vegetables = parseNassVegetableContexts("Head Lettuce for Fresh Market (continued)\nWinter    :\n  AZ      : Feb 1 Apr 15 May 1 May 15 - Jun 15 Jun 30");
  assert.equal(vegetables[0].commodityGroup, "lettuce");
  assert.equal(vegetables[0].season, "WINTER");
  assert.equal(vegetables[0].harvest.begins.month, 5);
  assert.match(vegetables[0].sourceBasis, /usual vegetable/i);
});

test("generated FREE-5 artifact preserves provenance, history, mappings, and research-only boundaries", () => {
  const metadata = artifact.metadata;
  assert.equal(metadata.researchOnly, true);
  assert.equal(metadata.productionScoringUsed, false);
  assert.deepEqual(metadata.structuralPeriod, { start: 2019, end: 2025, resolution: "quarter", rationale: "The official AMS research workbook is quarterly; no finer time precision is inferred." });
  assert.equal(metadata.currentYear.status, "partial");
  assert.equal(metadata.currentYear.automaticAdjustmentAllowed, false);
  assert.equal(metadata.amsRowsParsed, 74662);
  assert.equal(metadata.sourceYearRange.first, 2000);
  assert.equal(metadata.sourceYearRange.last, 2026);
  assert.equal(metadata.originProfileCount, 144);
  assert.equal(metadata.researchedMarketCount, 14);
  assert.equal(metadata.marketEvidenceCount, 146);
  assert.equal(metadata.commodityGroupsCovered.length, 14);
  assert.equal(metadata.equipmentWeightsApplied, false);
  for (const source of Object.values(metadata.sources)) {
    assert.match(source.url, /^https:\/\//);
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(source.agency && source.dataset);
  }
  for (const market of artifact.markets) {
    assert.match(market.marketId, /^market:/);
    assert.match(market.canonicalPlaceId, /^place:\d{7}$/);
    assert.match(market.freightRegionId, /^\d{3}$/);
    assert.ok(["HIGH", "MEDIUM", "LOW"].includes(market.sourceMapping.confidence));
    assert.ok(market.seasonalEvidence.length > 0);
    for (const evidence of market.seasonalEvidence) {
      assert.equal(evidence.equipmentContext.weightsApplied, false);
      assert.equal(evidence.equipmentContext.observedContext, "REEFER");
      assert.equal(evidence.currentYearStatus.automaticAdjustmentAllowed, false);
      assert.equal(evidence.currentYearStatus.structuralProfileChanged, false);
      assert.equal(evidence.provenance.transformationVersion, "free5-v1");
      assert.equal(evidence.founderReview.runtimeUse, false);
      assert.ok(Math.abs(evidence.movement.quarterlyAverageShares.reduce((sum, quarter) => sum + quarter.share, 0) - 1) < 0.00001);
      assert.ok(evidence.movement.annualShipmentTons >= 0);
    }
  }
});

test("confidence and unresolved review behavior are deterministic", () => {
  const profile = artifact.originProfiles[0];
  assert.deepEqual(reviewSeasonalEvidence(null, "HIGH"), { status: "no_reliable_evidence", candidate: "no_adjustment_justified" });
  assert.deepEqual(reviewSeasonalEvidence(profile, "LOW"), { status: "geography_mismatch", candidate: "no_adjustment_justified" });
  assert.deepEqual(reviewSeasonalEvidence(profile, "LOW"), reviewSeasonalEvidence(profile, "LOW"));
  assert.match(artifact.doubleCountingWarning, /overlapping activity/i);
  assert.equal(artifact.metadata.coverageAssessment.livestockMeat.includes("no seasonal profile fabricated"), true);
});

test("FREE-5 does not change production scores, analytics, versions, UI delivery, or extension", async () => {
  assert.equal(Object.keys(marketScores).length, 44);
  assert.equal(createHash("sha256").update(JSON.stringify(marketScores)).digest("hex"), "e06bfd8b59b0631cf8aeb7a861faa3b5ed92eeceb671e9dfb8da547b2359cf6a");
  assert.equal(getCuratedMarketScore("Atlanta, GA"), 88);
  const input = { origin: "Dallas, TX", destination: "Atlanta, GA", loadRate: 2600, loadedMiles: 780, deadheadMiles: 35, deadheadConfirmed: true, mpg: 6.5, fuelPrice: 4, fixedCostPerMile: 0.65 };
  assert.equal(calculateLoadScore({ ...input, reloadScore: 88 }).score, 100);
  assert.equal(calculateNearSightScore(input).score, 100);
  assert.equal(calculateForeSightScore({ destination: "Atlanta, GA", curatedReloadScore: 88 }).score, 88);
  assert.equal(WEB_BUILD_VERSION, "2026.10.12-beta.12");
  assert.equal(EXTENSION_BUILD_VERSION, "0.6.2");
  for (const forbidden of ["market", "commodity", "season", "shipment", "harvest", "origin", "destination"]) assert.equal(SAFE_PROPERTY_KEYS.has(forbidden), false, forbidden);
  const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.version, "0.6.2");
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "storage", "notifications"]);
  assert.equal("host_permissions" in manifest, false);
  const publicFiles = await readdir(new URL("../public/", import.meta.url), { recursive: true });
  const extensionFiles = await readdir(new URL("../extension/", import.meta.url), { recursive: true });
  assert.equal(publicFiles.some((file) => /free5|seasonal-profiles|usda/i.test(file)), false);
  assert.equal(extensionFiles.some((file) => /free5|seasonal-profiles|usda/i.test(file)), false);
});
