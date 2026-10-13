import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";
import {
  buildSeasonalProfiles,
  normalizeCommodity,
  parseNassFieldCropContexts,
  parseNassVegetableContexts,
  parseQuarterlyWorksheet,
  reviewSeasonalEvidence,
} from "./seasonal-intelligence-core.mjs";

const RETRIEVAL_DATE = "2026-10-12";
const TRANSFORMATION_VERSION = "free5-v1";
const STRUCTURAL_YEARS = Object.freeze({ start: 2019, end: 2025 });
const CURRENT_YEAR = 2026;
const root = resolve(import.meta.dirname, "..", "..");
const cache = join(tmpdir(), "loadscore-free5-usda");

const SOURCES = Object.freeze({
  amsQuarterly: {
    agency: "USDA Agricultural Marketing Service",
    dataset: "Agricultural Refrigerated Truck Quarterly — Quarterly Shipment Volumes by Origin and Commodity",
    url: "https://www.ams.usda.gov/sites/default/files/media/QuarterlyShipmentVolumesbyOriginandCommodity.xlsx",
    file: "QuarterlyShipmentVolumesbyOriginandCommodity.xlsx",
    sourcePage: "https://www.ams.usda.gov/services/transportation-analysis/agricultural-refrigerated-truck-quarterly-datasets",
  },
  nassFieldDates: {
    agency: "USDA National Agricultural Statistics Service",
    dataset: "Field Crops: Usual Planting and Harvesting Dates",
    vintage: "October 2010",
    url: "https://esmis.nal.usda.gov/sites/default/release-files/vm40xr56k/dv13zw65p/z603r1055/planting-10-29-2010.txt",
    file: "planting-10-29-2010.txt",
    sourcePage: "https://esmis.nal.usda.gov/publication/usual-planting-and-harvesting-dates-us-field-crops",
  },
  nassVegetableDates: {
    agency: "USDA National Agricultural Statistics Service",
    dataset: "Vegetables: Usual Planting and Harvesting Dates",
    vintage: "May 2007",
    url: "https://esmis.nal.usda.gov/sites/default/release-files/v118rd53f/4j03d2382/6108vf125/UsuPlant-05-31-2007.txt",
    file: "UsuPlant-05-31-2007.txt",
    sourcePage: "https://esmis.nal.usda.gov/publication/usual-planting-and-harvesting-dates-fresh-market-and-processing-vegetables",
  },
});

const MARKET_ORIGIN_MAP = Object.freeze([
  { market: "Fresno, CA", origin: "CALIFORNIA", confidence: "MEDIUM", method: "Statewide AMS origin assigned to a representative California agricultural market; not city-specific." },
  { market: "Salinas, CA", origin: "CALIFORNIA", confidence: "MEDIUM", method: "Statewide AMS origin assigned to a representative California agricultural market; not city-specific." },
  { market: "Stockton, CA", origin: "CALIFORNIA", confidence: "MEDIUM", method: "Statewide AMS origin assigned to a representative California agricultural market; not city-specific." },
  { market: "Yuma, AZ", origin: "ARIZONA", confidence: "MEDIUM", method: "Statewide AMS origin linked to Yuma with explicit statewide scope mismatch." },
  { market: "Nogales, AZ", origin: "MEXICO-ARIZONA", confidence: "HIGH", method: "Official AMS cross-border stream through Arizona linked to the Nogales gateway; evidence describes crossings, not local production." },
  { market: "Yakima, WA", origin: "PNW", confidence: "MEDIUM", method: "Broad Pacific Northwest AMS origin linked to a major PNW market; source remains multi-state." },
  { market: "Idaho Falls, ID", origin: "PNW", confidence: "LOW", method: "Broad multi-state Pacific Northwest origin used as a proxy; no city-level allocation." },
  { market: "Twin Falls, ID", origin: "PNW", confidence: "LOW", method: "Broad multi-state Pacific Northwest origin used as a proxy; no city-level allocation." },
  { market: "McAllen, TX", origin: "MEXICO-TEXAS", confidence: "MEDIUM", method: "Official AMS cross-border stream through Texas linked to a Rio Grande Valley gateway; not city-specific." },
  { market: "Pharr, TX", origin: "MEXICO-TEXAS", confidence: "MEDIUM", method: "Official AMS cross-border stream through Texas linked to a Rio Grande Valley gateway; not city-specific." },
  { market: "Laredo, TX", origin: "MEXICO-TEXAS", confidence: "MEDIUM", method: "Official AMS cross-border stream through Texas linked to a border gateway; not city-specific." },
  { market: "Miami, FL", origin: "FLORIDA", confidence: "MEDIUM", method: "Statewide AMS origin linked to a Florida market with explicit statewide scope mismatch." },
  { market: "Orlando, FL", origin: "FLORIDA", confidence: "MEDIUM", method: "Statewide AMS origin linked to a Florida market with explicit statewide scope mismatch." },
  { market: "Atlanta, GA", origin: "SOUTHEAST", confidence: "LOW", method: "Broad multi-state Southeast origin used as a proxy; no city-level allocation." },
]);

const STATE_NAMES = Object.freeze({ AZ: "Arizona", CA: "California", FL: "Florida", GA: "Georgia", ID: "Idaho", TX: "Texas", WA: "Washington" });
const AGRICULTURE_SCTG = new Set(["01", "02", "03", "04", "05", "06", "07", "08"]);

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function round(value, digits = 4) { return Number(Number(value).toFixed(digits)); }

async function download(url) {
  const response = await fetch(url, { headers: { "User-Agent": "LoadScore FREE-5 official USDA research build" } });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function zipEntries(zip) {
  let eocd = -1;
  for (let offset = zip.length - 22; offset >= Math.max(0, zip.length - 65557); offset -= 1) if (zip.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  if (eocd < 0) throw new Error("ZIP end-of-central-directory record not found.");
  const count = zip.readUInt16LE(eocd + 10);
  let cursor = zip.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let index = 0; index < count; index += 1) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Malformed ZIP central directory.");
    const method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const uncompressedSize = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = zip.subarray(start, start + compressedSize);
    const value = method === 8 ? inflateRawSync(compressed) : method === 0 ? compressed : null;
    if (!value || value.length !== uncompressedSize) throw new Error(`Unsupported or invalid ZIP entry: ${name}`);
    entries.set(name, value);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function workbookRows(buffer) {
  const entries = zipEntries(buffer);
  const sheet = entries.get("xl/worksheets/sheet1.xml");
  const shared = entries.get("xl/sharedStrings.xml");
  if (!sheet || !shared) throw new Error("Required AMS XLSX worksheet parts are missing.");
  return parseQuarterlyWorksheet(sheet.toString("utf8"), shared.toString("utf8"));
}

function currentYearStatuses(rows, profiles) {
  const statuses = new Map();
  for (const row of rows) {
    if (row.year !== CURRENT_YEAR || row.commodity === "ORIGIN TOTAL") continue;
    const group = normalizeCommodity(row.commodity);
    if (!group) continue;
    const key = `${row.origin}|${group}`;
    if (!statuses.has(key)) statuses.set(key, new Map());
    statuses.get(key).set(row.quarter, (statuses.get(key).get(row.quarter) || 0) + row.tons);
  }
  return new Map(profiles.map((profile) => {
    const quarters = statuses.get(`${profile.origin}|${profile.commodityGroup}`) || new Map();
    const observed = [...quarters].sort(([a], [b]) => a - b).map(([quarter, shipmentTons]) => ({ quarter, shipmentTons: round(shipmentTons) }));
    return [profile.profileId, { year: CURRENT_YEAR, observedQuarters: observed, incomplete: observed.length < 4, structuralProfileChanged: false, automaticAdjustmentAllowed: false }];
  }));
}

function equipmentContext(group) {
  return {
    observedContext: "REEFER",
    possibleAdditionalContexts: group === "onions" ? ["FLATBED", "UNKNOWN"] : group === "potatoes" ? ["DRY_VAN", "UNKNOWN"] : ["UNKNOWN"],
    weightsApplied: false,
    note: group === "onions"
      ? "The AMS workbook measures refrigerated movement; AMS separately notes some western onion movements use open flatbeds. No share or weight is inferred here."
      : "The AMS workbook measures refrigerated truck movement. Other equipment contexts are not quantified by this source.",
  };
}

function nassSupportFor(market, group, fieldContexts, vegetableContexts) {
  const stateName = STATE_NAMES[market.stateCode];
  const field = fieldContexts.filter((record) => record.state === stateName && record.commodityGroup === group);
  const vegetable = vegetableContexts.filter((record) => record.stateCode === market.stateCode && record.commodityGroup === group);
  return [...field, ...vegetable].slice(0, 8);
}

function marketArtifacts(free4, profiles, currentStatuses, fieldContexts, vegetableContexts) {
  const free4ByName = new Map(free4.markets.map((market) => [market.displayName, market]));
  const profilesByOrigin = new Map();
  for (const profile of profiles) {
    if (!profilesByOrigin.has(profile.origin)) profilesByOrigin.set(profile.origin, []);
    profilesByOrigin.get(profile.origin).push(profile);
  }
  return MARKET_ORIGIN_MAP.map((mapping) => {
    const market = free4ByName.get(mapping.market);
    if (!market) throw new Error(`FREE-4 research market missing: ${mapping.market}`);
    const agricultureCommodities = market.commodities.outbound.filter((item) => AGRICULTURE_SCTG.has(item.code));
    const agricultureShare = agricultureCommodities.reduce((sum, item) => sum + item.share, 0);
    const evidence = (profilesByOrigin.get(mapping.origin) || []).map((profile) => {
      const review = reviewSeasonalEvidence(profile, mapping.confidence);
      const support = nassSupportFor(market, profile.commodityGroup, fieldContexts, vegetableContexts);
      const evidenceConfidence = mapping.confidence === "LOW" || profile.historicalConsistency.level === "LOW" ? "LOW" : mapping.confidence === "HIGH" && profile.historicalConsistency.level === "HIGH" ? "HIGH" : "MEDIUM";
      return {
        evidenceId: `${market.marketId}:${profile.profileId}`,
        commodityGroup: profile.commodityGroup,
        sourceCommodities: profile.sourceCommodities,
        equipmentContext: equipmentContext(profile.commodityGroup),
        period: { type: "quarter", peak: profile.peakQuarters, shoulder: profile.shoulderQuarters, off: profile.offQuarters },
        movement: {
          structuralYears: profile.yearsIncluded,
          annualShipmentTons: profile.annualShipmentTons,
          averageAnnualShipmentTons: profile.averageAnnualShipmentTons,
          quarterlyAverageShares: profile.quarterlyAverageShares,
          peakIntensityRatio: profile.peakIntensityRatio,
          seasonalConcentration: profile.seasonalConcentration,
          indicators: profile.indicators,
        },
        historicalConsistency: profile.historicalConsistency,
        currentYearStatus: currentStatuses.get(profile.profileId),
        nassHarvestSupport: support,
        provenance: {
          movementSource: "amsQuarterly",
          movementSourceOrigin: mapping.origin,
          harvestContextSources: support.map((item) => item.vintage === 2010 ? "nassFieldDates" : "nassVegetableDates").filter((value, index, values) => values.indexOf(value) === index),
          retrievalDate: RETRIEVAL_DATE,
          transformationVersion: TRANSFORMATION_VERSION,
        },
        confidence: { level: evidenceConfidence, reasons: [mapping.method, `${profile.yearsIncluded.length} complete structural years included.`, `Historical peak consistency is ${profile.historicalConsistency.level}.`] },
        founderReview: { ...review, labelsOnly: true, runtimeUse: false },
      };
    });
    return {
      marketId: market.marketId,
      canonicalPlaceId: market.canonicalPlaceId,
      marketName: market.displayName,
      stateCode: market.stateCode,
      freightRegionId: market.freightRegion.regionId,
      sourceMapping: { usdaOrigin: mapping.origin, method: mapping.method, confidence: mapping.confidence, geographicScopeMismatch: mapping.confidence !== "HIGH" },
      baseFreightEvidence: {
        source: "FREE-4 FAF6.0",
        outboundTruckTons: market.truckFreight.outboundTons,
        agricultureRelatedOutboundShare: round(agricultureShare, 6),
        topAgricultureRelatedCommodities: agricultureCommodities.slice(0, 5),
        doubleCountingKey: `faf6:${market.freightRegion.regionId}:agriculture-structural-base`,
      },
      seasonalEvidence: evidence,
      limitations: ["AMS origin geography may be broader than this city.", "Refrigerated shipment movement is not truck availability, a reload probability, or a production score."],
    };
  });
}

function formatNumber(value) { return Math.round(value).toLocaleString("en-US"); }
function reportMarkdown(markets, metadata) {
  const lines = [
    "# FREE-5 Seasonal and Commodity Intelligence Research",
    "",
    "> Founder research only. These quarterly USDA indicators do not change Reload Score, ForeSight, NearSight, LoadScore, recommendations, or driver-facing claims.",
    "",
    `Structural profiles use complete calendar years ${STRUCTURAL_YEARS.start}–${STRUCTURAL_YEARS.end}. ${CURRENT_YEAR} observations are retained separately as incomplete current-year context and cannot adjust production.`,
    "",
    "## Founder review table",
    "",
    "| Market | USDA origin | Commodity | Equipment evidence | Peak quarter(s) | Avg annual tons | Peak ratio | Consistency | NASS support | FAF agriculture share | Confidence | Review |",
    "|---|---|---|---|---|---:|---:|---|---|---:|---|---|",
  ];
  for (const market of markets) {
    for (const evidence of market.seasonalEvidence) {
      lines.push(`| ${market.marketName} | ${market.sourceMapping.usdaOrigin} | ${evidence.commodityGroup.replaceAll("_", " ")} | ${evidence.equipmentContext.observedContext} | ${evidence.period.peak.map((quarter) => `Q${quarter}`).join(", ") || "None"} | ${formatNumber(evidence.movement.averageAnnualShipmentTons)} | ${evidence.movement.peakIntensityRatio}× | ${evidence.historicalConsistency.level} | ${evidence.nassHarvestSupport.length ? "Yes" : "No"} | ${(market.baseFreightEvidence.agricultureRelatedOutboundShare * 100).toFixed(1)}% | ${evidence.confidence.level} | ${evidence.founderReview.status.replaceAll("_", " ")} |`);
    }
  }
  const strong = markets.flatMap((market) => market.seasonalEvidence.filter((evidence) => evidence.founderReview.status === "strong_seasonal_evidence").map((evidence) => `${market.marketName} — ${evidence.commodityGroup.replaceAll("_", " ")} (${evidence.period.peak.map((quarter) => `Q${quarter}`).join("/")})`));
  const weak = markets.flatMap((market) => market.seasonalEvidence.filter((evidence) => ["weak_evidence", "geography_mismatch", "no_reliable_evidence"].includes(evidence.founderReview.status)).map((evidence) => `${market.marketName} — ${evidence.commodityGroup.replaceAll("_", " ")} (${evidence.founderReview.status.replaceAll("_", " ")})`));
  lines.push("", "## Strong seasonal-evidence review candidates", "", ...(strong.length ? strong.map((item) => `- ${item}`) : ["- None under the conservative FREE-5 rule."]), "", "## Weak or geography-limited evidence", "", ...(weak.length ? weak.map((item) => `- ${item}`) : ["- None."]));
  lines.push("", "## Method boundaries", "", "- The official AMS workbook is quarterly. FREE-5 preserves that resolution and does not manufacture monthly or weekly detail.", "- Peak means a quarterly mean share at least one-half standard deviation above the 25% quarterly baseline; shoulder is above 25% but below peak; off is at least one-half standard deviation below baseline.", "- Historical consistency measures how often a year's largest quarter matches the structural peak quarter: HIGH at 5/7 years, MEDIUM at 3/7, otherwise LOW.", "- NASS usual harvest dates validate timing context only. Harvest is not truck availability, and the 2007/2010 vintages require caution.", "- FAF annual agricultural volume and AMS seasonal movement overlap conceptually. `doubleCountingKey` identifies the structural base so a future model does not add both at full weight.", "- Cross-border streams describe movements through Arizona or Texas gateways, not domestic production in the named city.", "- No current-year deviation, equipment weight, seasonal score, route, mileage, or live freight claim is used in production.", "", `Source rows parsed: ${metadata.amsRowsParsed.toLocaleString("en-US")}. Retained structural origin/commodity profiles: ${metadata.originProfileCount}. Market evidence records: ${metadata.marketEvidenceCount}.`, "");
  return lines.join("\n");
}

async function output(path, value) {
  const contents = typeof value === "string" ? `${value.trim()}\n` : `${JSON.stringify(value)}\n`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
  return { path: path.slice(root.length + 1), bytes: Buffer.byteLength(contents), sha256: sha256(contents) };
}

async function main() {
  await mkdir(cache, { recursive: true });
  const offline = process.argv.includes("--offline");
  const buffers = {};
  for (const [key, source] of Object.entries(SOURCES)) {
    const path = join(cache, source.file);
    buffers[key] = offline ? await readFile(path) : await download(source.url);
    if (!offline) await writeFile(path, buffers[key]);
  }
  const rows = workbookRows(buffers.amsQuarterly);
  const profiles = buildSeasonalProfiles(rows, { ...STRUCTURAL_YEARS, minimumYears: 5, minimumTons: 1000 });
  const statuses = currentYearStatuses(rows, profiles);
  const fieldContexts = parseNassFieldCropContexts(buffers.nassFieldDates.toString("utf8"));
  const vegetableContexts = parseNassVegetableContexts(buffers.nassVegetableDates.toString("utf8"));
  const free4 = JSON.parse(await readFile(join(root, "data", "market-intelligence", "free4-markets.json"), "utf8"));
  const markets = marketArtifacts(free4, profiles, statuses, fieldContexts, vegetableContexts);
  const metadata = {
    researchOnly: true,
    productionScoringUsed: false,
    transformationVersion: TRANSFORMATION_VERSION,
    retrievalDate: RETRIEVAL_DATE,
    structuralPeriod: { ...STRUCTURAL_YEARS, resolution: "quarter", rationale: "The official AMS research workbook is quarterly; no finer time precision is inferred." },
    currentYear: { year: CURRENT_YEAR, status: "partial", automaticAdjustmentAllowed: false },
    sources: Object.fromEntries(Object.entries(SOURCES).map(([key, source]) => [key, { ...source, sha256: sha256(buffers[key]) }])),
    amsRowsParsed: rows.length,
    negativeAdjustmentRows: rows.filter((row) => row.tons < 0).length,
    negativeAdjustmentPolicy: "Official negative correction rows are retained. After origin/commodity/year/quarter aggregation, negative cells are explicitly floored to zero and counted rather than treated as negative shipment volume.",
    negativeAggregateCellsFloored: profiles.reduce((sum, profile) => sum + profile.negativeAggregateCellsFloored, 0),
    sourceYearRange: { first: Math.min(...rows.map((row) => row.year)), last: Math.max(...rows.map((row) => row.year)) },
    originProfileCount: profiles.length,
    researchedMarketCount: markets.length,
    marketEvidenceCount: markets.reduce((sum, market) => sum + market.seasonalEvidence.length, 0),
    commodityGroupsCovered: [...new Set(profiles.map((profile) => profile.commodityGroup))].sort(),
    equipmentContextsSupportedBySchema: ["REEFER", "DRY_VAN", "FLATBED", "UNKNOWN"],
    observedEquipmentContext: "REEFER",
    equipmentWeightsApplied: false,
    nassFieldContextCount: fieldContexts.length,
    nassVegetableContextCount: vegetableContexts.length,
    coverageAssessment: {
      specialtyProduce: "AMS quarterly refrigerated movement profiles generated.",
      potatoes: "AMS movement plus NASS usual harvest context where state mappings align.",
      cornSoybeansWheatRice: "NASS harvest context explored; no compatible AMS refrigerated movement profile is treated as field-crop truck seasonality.",
      livestockMeat: "No compatible official movement series was integrated; no seasonal profile fabricated.",
    },
    disclaimer: "Research evidence only; not a Reload Score, ForeSight score, recommendation, live freight signal, or production adjustment.",
  };
  const artifact = { metadata, classificationMethod: { quarterlyBaselineShare: 0.25, peak: "share >= baseline + 0.5 population standard deviations", shoulder: "share > baseline and below peak", off: "share <= baseline - 0.5 population standard deviations", historicalConsistency: { HIGH: "structural peak repeats in at least 5 of 7 years", MEDIUM: "repeats in at least 3 of 7 years", LOW: "repeats in fewer than 3 of 7 years" } }, originProfiles: profiles, nassHarvestContexts: { fieldCrops: fieldContexts, vegetables: vegetableContexts }, markets, doubleCountingWarning: "FAF structural agricultural flows, AMS shipment movement, and NASS harvest timing may describe overlapping activity. Future scoring must estimate seasonal deviation from the structural base rather than summing all signals." };
  const outputs = [];
  outputs.push(await output(join(root, "data", "market-intelligence", "free5-seasonal-profiles.json"), artifact));
  outputs.push(await output(join(root, "docs", "market-intelligence", "free5-seasonality-research.md"), reportMarkdown(markets, metadata)));
  console.log(JSON.stringify({ ...metadata, mappingConfidence: Object.groupBy(markets, (market) => market.sourceMapping.confidence), reviewCounts: Object.groupBy(markets.flatMap((market) => market.seasonalEvidence), (evidence) => evidence.founderReview.status), outputs }, (key, value) => key === "mappingConfidence" || key === "reviewCounts" ? Object.fromEntries(Object.entries(value).map(([label, items]) => [label, items.length])) : value, 2));
}

await main();
