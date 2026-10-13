import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { inflateRawSync } from "node:zlib";
import { marketScores } from "../../src/data/marketScores.js";

const RETRIEVAL_DATE = "2026-10-12";
const TRANSFORMATION_VERSION = "free4-v1";
const FAF_VERSION = "FAF6.0";
const BASE_YEAR = 2022;
const TRUCK_MODE = "1";
const CFS_TRUCK_MODE = "11";
const root = resolve(import.meta.dirname, "..", "..");
const cache = join(tmpdir(), "loadscore-faf6-cfs-2022");

const SOURCES = Object.freeze({
  faf: {
    url: "https://faf.ornl.gov/faf6/data/Download_Files/ZIP/FAF6.0.zip",
    file: "FAF6.0.zip",
    agency: "U.S. Department of Transportation, Bureau of Transportation Statistics",
    dataset: "Freight Analysis Framework regional database",
  },
  zones: {
    url: "https://faf.ornl.gov/faf6/data/FAF6.zip",
    file: "FAF6-zones.zip",
    agency: "U.S. Department of Transportation, Bureau of Transportation Statistics",
    dataset: "FAF6 Zones — 2022 CFS Geography",
  },
  cfs: {
    url: "https://www2.census.gov/programs-surveys/cfs/data/2022/CF2200A01.zip",
    file: "CF2200A01.zip",
    agency: "U.S. Census Bureau and Bureau of Transportation Statistics",
    dataset: "2022 Commodity Flow Survey final table CF2200A01 (GAS01)",
  },
});

const COMMODITIES = Object.freeze({
  "01":"Live animals/fish", "02":"Cereal grains", "03":"Other agricultural products", "04":"Animal feed",
  "05":"Meat/seafood", "06":"Milled grain products", "07":"Other foodstuffs", "08":"Alcoholic beverages",
  "09":"Tobacco products", "10":"Building stone", "11":"Natural sands", "12":"Gravel",
  "13":"Nonmetallic minerals", "14":"Metallic ores", "15":"Coal", "16":"Crude petroleum",
  "17":"Gasoline", "18":"Fuel oils", "19":"Natural gas and other fossil products", "20":"Basic chemicals",
  "21":"Pharmaceuticals", "22":"Fertilizers", "23":"Chemical products", "24":"Plastics/rubber",
  "25":"Logs", "26":"Wood products", "27":"Newsprint/paper", "28":"Paper articles",
  "29":"Printed products", "30":"Textiles/leather", "31":"Nonmetal mineral products", "32":"Base metals",
  "33":"Articles of base metal", "34":"Machinery", "35":"Electronics", "36":"Motorized vehicles",
  "37":"Transportation equipment", "38":"Precision instruments", "39":"Furniture", "40":"Miscellaneous manufactured products",
  "41":"Waste/scrap", "43":"Mixed freight",
});

const COMMODITY_GROUPS = Object.freeze({
  "01":"livestock_and_fish", "02":"grains", "03":"produce_and_agriculture", "04":"animal_feed", "05":"meat_and_seafood",
  "06":"packaged_food", "07":"packaged_food", "08":"beverages", "09":"other", "10":"building_materials",
  "11":"building_materials", "12":"building_materials", "13":"building_materials", "14":"metals", "15":"energy",
  "16":"energy", "17":"energy", "18":"energy", "19":"energy", "20":"chemicals", "21":"chemicals",
  "22":"chemicals", "23":"chemicals", "24":"plastics", "25":"wood_and_lumber", "26":"wood_and_lumber",
  "27":"paper", "28":"paper", "29":"mixed_manufactured_goods", "30":"mixed_manufactured_goods", "31":"building_materials",
  "32":"metals", "33":"metals", "34":"machinery", "35":"electronics", "36":"vehicles",
  "37":"transportation_equipment", "38":"machinery", "39":"mixed_manufactured_goods", "40":"mixed_manufactured_goods",
  "41":"waste_and_scrap", "43":"mixed_freight",
});

const PRIORITY_MARKETS = Object.freeze([
  "Laredo, TX", "McAllen, TX", "Pharr, TX", "El Paso, TX", "Brownsville, TX", "Nogales, AZ", "Yuma, AZ",
  "Fresno, CA", "Salinas, CA", "Stockton, CA", "Ontario, CA", "Long Beach, CA", "Los Angeles, CA",
  "Yakima, WA", "Twin Falls, ID", "Idaho Falls, ID", "Omaha, NE", "Grand Island, NE", "Sioux City, IA",
  "Chicago, IL", "Joliet, IL", "Gary, IN", "Atlanta, GA", "Savannah, GA", "Greenville, SC", "Spartanburg, SC",
  "Louisville, KY", "Bowling Green, KY", "Harrisburg, PA", "Carlisle, PA", "Newark, NJ", "Elizabeth, NJ",
]);

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function round(value, digits = 3) { return Number(Number(value).toFixed(digits)); }
function safeRatio(numerator, denominator) { return denominator > 0 ? round(numerator / denominator, 4) : numerator > 0 ? null : 0; }

async function download(url) {
  const response = await fetch(url, { headers: { "User-Agent": "LoadScore FREE-4 research build (official public data)" } });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function zipEntries(zip) {
  let eocd = -1;
  for (let offset = zip.length - 22; offset >= Math.max(0, zip.length - 65557); offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
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

function findEntry(entries, suffix) {
  const match = [...entries].find(([name]) => name.toLowerCase().endsWith(suffix.toLowerCase()));
  if (!match) throw new Error(`ZIP entry not found: ${suffix}`);
  return match[1];
}

function parseDbf(buffer) {
  const recordCount = buffer.readUInt32LE(4);
  const headerLength = buffer.readUInt16LE(8);
  const recordLength = buffer.readUInt16LE(10);
  const fields = [];
  for (let offset = 32; buffer[offset] !== 0x0d; offset += 32) {
    fields.push({ name: buffer.subarray(offset, offset + 11).toString("ascii").replace(/\0.*$/, ""), length: buffer[offset + 16] });
  }
  const records = [];
  for (let index = 0; index < recordCount; index += 1) {
    let offset = headerLength + index * recordLength + 1;
    const record = {};
    for (const field of fields) {
      record[field.name] = buffer.subarray(offset, offset + field.length).toString("latin1").trim();
      offset += field.length;
    }
    records.push(record);
  }
  return records;
}

function parseShapefile(buffer) {
  if (buffer.readInt32BE(0) !== 9994 || buffer.readInt32LE(32) !== 5) throw new Error("Expected an ESRI polygon shapefile.");
  const shapes = [];
  for (let offset = 100; offset < buffer.length;) {
    const contentBytes = buffer.readInt32BE(offset + 4) * 2;
    const start = offset + 8;
    const type = buffer.readInt32LE(start);
    if (type === 0) { shapes.push(null); offset = start + contentBytes; continue; }
    if (type !== 5) throw new Error(`Unexpected shapefile record type: ${type}`);
    const bbox = [buffer.readDoubleLE(start + 4), buffer.readDoubleLE(start + 12), buffer.readDoubleLE(start + 20), buffer.readDoubleLE(start + 28)];
    const partCount = buffer.readInt32LE(start + 36);
    const pointCount = buffer.readInt32LE(start + 40);
    const partStarts = Array.from({ length: partCount }, (_, index) => buffer.readInt32LE(start + 44 + index * 4));
    const pointsOffset = start + 44 + partCount * 4;
    const points = Array.from({ length: pointCount }, (_, index) => [buffer.readDoubleLE(pointsOffset + index * 16), buffer.readDoubleLE(pointsOffset + index * 16 + 8)]);
    const rings = partStarts.map((partStart, index) => points.slice(partStart, partStarts[index + 1] ?? points.length));
    shapes.push({ bbox, rings });
    offset = start + contentBytes;
  }
  return shapes;
}

function pointInRing(longitude, latitude, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    if (((yi > latitude) !== (yj > latitude)) && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function shapeContains(shape, longitude, latitude) {
  if (!shape || longitude < shape.bbox[0] || latitude < shape.bbox[1] || longitude > shape.bbox[2] || latitude > shape.bbox[3]) return false;
  return shape.rings.reduce((inside, ring) => pointInRing(longitude, latitude, ring) ? !inside : inside, false);
}

function parsePipe(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].replace(/^#/, "").split("|");
  return lines.slice(1).map((line) => Object.fromEntries(line.split("|").map((value, index) => [headers[index], value])));
}

function percentile(values, target) {
  const sorted = [...values].sort((a, b) => a - b);
  const lower = sorted.filter((value) => value < target).length;
  const equal = sorted.filter((value) => value === target).length;
  return round(((lower + equal / 2) / sorted.length) * 100, 1);
}

function emptyRegion(zone) {
  return {
    regionId: zone.FAF6,
    regionName: zone.FAF6_NAME.trim(),
    shortName: zone.FAF6_SHORT,
    cfsAreaId: zone.CFS22_ID,
    outboundTons: 0, inboundTons: 0, outboundValue: 0, inboundValue: 0,
    outboundByCommodity: new Map(), inboundByCommodity: new Map(),
    outboundByDestination: new Map(), inboundByOrigin: new Map(),
  };
}

function add(map, key, tons, value) {
  const current = map.get(key) || { tons: 0, value: 0 };
  current.tons += tons;
  current.value += value;
  map.set(key, current);
}

async function aggregateFaf(csvPath, zones) {
  const regions = new Map(zones.map((zone) => [zone.FAF6, emptyRegion(zone)]));
  const stream = createInterface({ input: createReadStream(csvPath), crlfDelay: Infinity });
  let headers;
  let rowCount = 0;
  let truckRowCount = 0;
  for await (const line of stream) {
    if (!headers) { headers = line.split(","); continue; }
    if (!line.trim()) continue;
    rowCount += 1;
    const values = line.split(",");
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    if (row.dms_mode !== TRUCK_MODE) continue;
    truckRowCount += 1;
    if (!COMMODITIES[row.sctg2]) throw new Error(`Unknown SCTG2 code: ${row.sctg2}`);
    if (!/^[123]$/.test(row.trade_type)) throw new Error(`Unknown trade type: ${row.trade_type}`);
    const tons = Number(row.tons_2022);
    const value = Number(row.value_2022);
    if (!Number.isFinite(tons) || !Number.isFinite(value) || tons < 0 || value < 0) throw new Error(`Invalid FAF metric at row ${rowCount + 1}`);
    const origin = regions.get(row.dms_orig);
    const destination = regions.get(row.dms_dest);
    if (!origin || !destination) throw new Error(`Unknown FAF region at row ${rowCount + 1}: ${row.dms_orig}/${row.dms_dest}`);
    origin.outboundTons += tons;
    origin.outboundValue += value;
    destination.inboundTons += tons;
    destination.inboundValue += value;
    add(origin.outboundByCommodity, row.sctg2, tons, value);
    add(destination.inboundByCommodity, row.sctg2, tons, value);
    add(origin.outboundByDestination, row.dms_dest, tons, value);
    add(destination.inboundByOrigin, row.dms_orig, tons, value);
  }
  return { regions, rowCount, truckRowCount };
}

function mapEntries(map, totalTons, regions = null) {
  return [...map.entries()]
    .map(([code, metrics]) => ({ code, label: regions ? regions.get(code)?.shortName || code : COMMODITIES[code], tons: round(metrics.tons), value: round(metrics.value), share: totalTons > 0 ? round(metrics.tons / totalTons, 6) : 0 }))
    .sort((a, b) => b.tons - a.tons || a.code.localeCompare(b.code));
}

function finalizeRegions(regions, cfsRows) {
  const raw = [...regions.values()].map((region) => {
    const combined = new Map();
    for (const [code, metrics] of region.outboundByCommodity) add(combined, code, metrics.tons, metrics.value);
    for (const [code, metrics] of region.inboundByCommodity) add(combined, code, metrics.tons, metrics.value);
    const handledTons = region.outboundTons + region.inboundTons;
    const shares = [...combined.values()].map((metrics) => handledTons > 0 ? metrics.tons / handledTons : 0);
    const diversity = 1 - shares.reduce((sum, share) => sum + share ** 2, 0);
    const cfs = cfsRows.get(region.cfsAreaId) || null;
    return {
      regionId: region.regionId,
      regionName: region.regionName,
      shortName: region.shortName,
      cfsAreaId: region.cfsAreaId,
      truckFreight: {
        outboundTons: round(region.outboundTons), inboundTons: round(region.inboundTons),
        outboundValue: round(region.outboundValue), inboundValue: round(region.inboundValue),
        totalFlowTons: round(handledTons), totalFlowValue: round(region.outboundValue + region.inboundValue),
        outboundInboundTonsRatio: safeRatio(region.outboundTons, region.inboundTons),
        outboundInboundValueRatio: safeRatio(region.outboundValue, region.inboundValue),
      },
      commodities: {
        outbound: mapEntries(region.outboundByCommodity, region.outboundTons),
        inbound: mapEntries(region.inboundByCommodity, region.inboundTons),
        diversityRaw: round(diversity, 6),
      },
      lanes: {
        topOutboundDestinations: mapEntries(region.outboundByDestination, region.outboundTons, regions).slice(0, 10),
        topInboundOrigins: mapEntries(region.inboundByOrigin, region.inboundTons, regions).slice(0, 10),
      },
      cfsValidation: cfs,
    };
  });
  const outbound = raw.map((region) => region.truckFreight.outboundTons);
  const total = raw.map((region) => region.truckFreight.totalFlowTons);
  const balance = raw.map((region) => Math.log2((region.truckFreight.outboundTons + 1) / (region.truckFreight.inboundTons + 1)));
  const diversity = raw.map((region) => region.commodities.diversityRaw);
  return raw.map((region, index) => ({
    ...region,
    indicators: {
      outboundFreightPercentile: percentile(outbound, outbound[index]),
      totalTruckFreightPercentile: percentile(total, total[index]),
      outboundBalancePercentile: percentile(balance, balance[index]),
      commodityDiversityPercentile: percentile(diversity, diversity[index]),
      normalizationPopulation: "all 134 FAF6 domestic regions with comparable FAF6.0 truck-mode records",
    },
  })).sort((a, b) => a.regionId.localeCompare(b.regionId));
}

function cfsTruckRows(text) {
  const rows = new Map();
  for (const row of parsePipe(text)) {
    if (row.YEAR !== String(BASE_YEAR) || row.DMODE !== CFS_TRUCK_MODE || !row.GEO_ID.startsWith("E330000US")) continue;
    const numeric = (value) => value === "" || value === "S" ? null : Number(value);
    rows.set(row.GEO_ID, {
      table: "CF2200A01/GAS01",
      geographyLabel: row.GEO_LABEL,
      truckModeCode: row.DMODE,
      outboundValueMillionUsd: numeric(row.VAL),
      outboundTonsThousand: numeric(row.TON),
      averageGreatCircleDistanceMiles: numeric(row.AVGMILE),
      valueCoefficientOfVariation: numeric(row.VAL_S),
      tonsCoefficientOfVariation: numeric(row.TON_S),
      note: "Supplementary shipper-survey origin context; not expected to equal FAF, which adds out-of-scope sectors and foreign-trade modeling.",
    });
  }
  return rows;
}

function placesByDisplay(dataset) {
  const indexes = Object.fromEntries(dataset.fields.map((field, index) => [field, index]));
  return new Map(dataset.records.map((row) => [row[indexes.displayName], {
    id: row[indexes.id], geoid: row[indexes.geoid], name: row[indexes.name], stateCode: row[indexes.stateCode],
    displayName: row[indexes.displayName], latitude: row[indexes.latitude], longitude: row[indexes.longitude],
  }]));
}

function reviewFlag(curatedScore, confidence, indicators) {
  if (curatedScore === null) return { status: "not_applicable", note: "Priority research market has no current curated Reload Score." };
  const composite = round((indicators.totalTruckFreightPercentile + indicators.outboundBalancePercentile + indicators.commodityDiversityPercentile) / 3, 1);
  const difference = round(curatedScore - composite, 1);
  if (confidence.level !== "HIGH") return { status: "proxy_mismatch", researchCompositePercentile: composite, difference, note: "Broader remainder-region evidence is not precise enough for directional score review." };
  if (Math.abs(difference) >= 30) return { status: "needs_review", researchCompositePercentile: composite, difference, note: "Current score and the research-only composite differ materially; investigate before any future calibration." };
  if (Math.abs(difference) <= 20) return { status: "appears_consistent", researchCompositePercentile: composite, difference, note: "Current score is directionally near the research-only composite; this is not score validation." };
  return { status: "insufficient_evidence", researchCompositePercentile: composite, difference, note: "Evidence is mixed and does not support a calibration conclusion." };
}

function marketRecords(placeMap, zones, shapes, regionMap) {
  const priority = new Set(PRIORITY_MARKETS);
  const names = [...new Set([...Object.keys(marketScores), ...PRIORITY_MARKETS])].sort((a, b) => a.localeCompare(b));
  return names.map((displayName) => {
    const place = placeMap.get(displayName);
    if (!place) throw new Error(`Research market does not resolve to canonical geography: ${displayName}`);
    const zoneIndex = shapes.findIndex((shape) => shapeContains(shape, place.longitude, place.latitude));
    if (zoneIndex < 0) {
      return { marketId: `market:${place.geoid}`, canonicalPlaceId: place.id, marketName: place.name, stateCode: place.stateCode, displayName, roles: { curated: displayName in marketScores, priority: priority.has(displayName) }, currentCuratedReloadScore: marketScores[displayName] ?? null, freightRegion: null, confidence: { level: "UNRESOLVED", reasons: ["Census representative point did not resolve inside an official FAF6 zone polygon."] }, review: { status: "insufficient_evidence", note: "Unresolved freight-region mapping." } };
    }
    const zone = zones[zoneIndex];
    const region = regionMap.get(zone.FAF6);
    const regionalProxy = !/CFS Area/i.test(zone.FAF6_NAME);
    const confidence = {
      level: regionalProxy ? "MEDIUM" : "HIGH",
      reasons: regionalProxy
        ? ["Official FAF6 polygon contains the Census place representative point.", "The target is a broad statewide or remainder-of-state region, so evidence is a regional proxy rather than city-specific."]
        : ["Official FAF6/CFS-area polygon contains the Census place representative point.", "FAF6 and CFS identifiers are linked by the official zone attributes."],
    };
    const record = {
      marketId: `market:${place.geoid}`,
      canonicalPlaceId: place.id,
      marketName: place.name,
      stateCode: place.stateCode,
      displayName,
      roles: { curated: displayName in marketScores, priority: priority.has(displayName) },
      currentCuratedReloadScore: marketScores[displayName] ?? null,
      freightRegion: { source: "FAF6 Zones — 2022 CFS Geography", regionId: zone.FAF6, regionName: zone.FAF6_NAME.trim(), cfsAreaId: zone.CFS22_ID, mappingMethod: "Official FAF6 zone polygon contains the 2026 Census place representative point; no nearest-region guessing." },
      truckFreight: region.truckFreight,
      commodities: region.commodities,
      lanes: region.lanes,
      indicators: region.indicators,
      cfsValidation: region.cfsValidation,
      equipmentContext: { dryVan: "schema_only", reefer: "schema_only", flatbed: "schema_only", other: "schema_only", weightsApplied: false },
      provenance: { source: "BTS FAF6.0 regional database with 2022 CFS GAS01 validation context", sourceVintage: "FAF6.0 / 2022 CFS final", baseYear: BASE_YEAR, retrievalDate: RETRIEVAL_DATE, transformationVersion: TRANSFORMATION_VERSION },
      confidence,
      limitations: ["FAF/CFS evidence is region-level, not city-level.", "Indicators are research percentiles, not Reload Score, ForeSight, or live freight availability."],
    };
    record.review = reviewFlag(record.currentCuratedReloadScore, confidence, record.indicators);
    return record;
  });
}

function formatNumber(value) { return value === null ? "—" : Math.round(value).toLocaleString("en-US"); }
function researchMarkdown(markets, metadata) {
  const lines = [
    "# FREE-4 Freight Market Research",
    "",
    "> Internal research artifact. FAF/CFS values are regional evidence, not city-specific live freight, Reload Scores, ForeSight scores, recommendations, or production inputs.",
    "",
    `Generated ${metadata.retrievalDate} from BTS ${metadata.fafVersion} (base year ${metadata.baseYear}) with 2022 CFS final table CF2200A01/GAS01 validation context.`,
    "",
    "## Current 44-market mapping audit",
    "",
    "| Curated market | Current score | Canonical place ID | FAF6 region | CFS area ID | Confidence |",
    "|---|---:|---|---|---|---|",
  ];
  for (const market of markets.filter((item) => item.roles.curated)) {
    lines.push(`| ${market.displayName} | ${market.currentCuratedReloadScore} | ${market.canonicalPlaceId} | ${market.freightRegion?.regionName.replaceAll("|", "/") ?? "Unresolved"} | ${market.freightRegion?.cfsAreaId ?? "—"} | ${market.confidence.level} |`);
  }
  lines.push(
    "",
    "## Market review",
    "",
    "| Market | Current score | FAF region | Outbound tons (000s) | Inbound tons (000s) | Tons ratio | Top outbound commodities | Top inbound commodities | Freight intensity pct. | Diversity pct. | Confidence | Review |",
    "|---|---:|---|---:|---:|---:|---|---|---:|---:|---|---|",
  );
  for (const market of markets) {
    if (!market.freightRegion) {
      lines.push(`| ${market.displayName} | ${market.currentCuratedReloadScore ?? "—"} | Unresolved | — | — | — | — | — | — | — | UNRESOLVED | ${market.review.status} |`);
      continue;
    }
    const outbound = market.commodities.outbound.slice(0, 3).map((item) => `${item.code} ${item.label}`).join("; ");
    const inbound = market.commodities.inbound.slice(0, 3).map((item) => `${item.code} ${item.label}`).join("; ");
    lines.push(`| ${market.displayName} | ${market.currentCuratedReloadScore ?? "—"} | ${market.freightRegion.regionName.replaceAll("|", "/")} | ${formatNumber(market.truckFreight.outboundTons)} | ${formatNumber(market.truckFreight.inboundTons)} | ${market.truckFreight.outboundInboundTonsRatio ?? "∞/undefined"} | ${outbound} | ${inbound} | ${market.indicators.totalTruckFreightPercentile} | ${market.indicators.commodityDiversityPercentile} | ${market.confidence.level} | ${market.review.status} |`);
  }
  const flagged = markets.filter((market) => market.review.status !== "appears_consistent" && market.review.status !== "not_applicable");
  lines.push("", "## Controlled review queue", "");
  for (const market of flagged) lines.push(`- **${market.displayName}: ${market.review.status.replaceAll("_", " ")}** — ${market.review.note}`);
  lines.push("", "## Interpretation", "", "- Tons are thousand tons; value is million constant 2022 dollars.", "- Total flow is outbound plus inbound directional handled freight; intraregional flows contribute to both sides.", "- Percentiles use all 134 FAF6 domestic regions, not only LoadScore research markets.", "- Commodity diversity is based on one minus the Herfindahl concentration of combined inbound/outbound truck tonnage.", "- Current Reload Scores appear only for comparison. The research composite is a review heuristic and never a replacement score.", "- CFS GAS01 is supplementary shipper-survey origin context. It is not expected to equal FAF because FAF adds sectors and foreign-trade modeling.", "- No seasonal, equipment, routing, mileage, live-load, or load-board signals are included.", "");
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
  const sourceBuffers = {};
  for (const [key, source] of Object.entries(SOURCES)) {
    const path = join(cache, source.file);
    sourceBuffers[key] = offline ? await readFile(path) : await download(source.url);
    if (!offline) await writeFile(path, sourceBuffers[key]);
  }

  const fafEntries = zipEntries(sourceBuffers.faf);
  const fafCsv = findEntry(fafEntries, ".csv");
  const fafCsvPath = join(cache, "FAF6.0.csv");
  await writeFile(fafCsvPath, fafCsv);
  const zoneEntries = zipEntries(sourceBuffers.zones);
  const zones = parseDbf(findEntry(zoneEntries, ".dbf"));
  const shapes = parseShapefile(findEntry(zoneEntries, ".shp"));
  if (zones.length !== shapes.length || zones.length !== 134) throw new Error(`Unexpected FAF zone count: ${zones.length}/${shapes.length}`);
  const cfsEntries = zipEntries(sourceBuffers.cfs);
  const cfsRows = cfsTruckRows(findEntry(cfsEntries, ".dat").toString("utf8"));
  const aggregation = await aggregateFaf(fafCsvPath, zones);
  const finalizedRegions = finalizeRegions(aggregation.regions, cfsRows);
  const regionMap = new Map(finalizedRegions.map((region) => [region.regionId, region]));
  const geography = JSON.parse(await readFile(join(root, "public", "data", "geography", "places-2026.json"), "utf8"));
  const markets = marketRecords(placesByDisplay(geography), zones, shapes, regionMap);

  const metadata = {
    researchOnly: true,
    productionScoringUsed: false,
    fafVersion: FAF_VERSION,
    baseYear: BASE_YEAR,
    cfsTable: "CF2200A01/GAS01 — Shipment Characteristics by Origin Geography by Mode",
    cfsRelease: "2022 CFS final tables, released 2025-06-26",
    retrievalDate: RETRIEVAL_DATE,
    transformationVersion: TRANSFORMATION_VERSION,
    units: { tons: "thousand tons", value: "million constant 2022 U.S. dollars" },
    sources: Object.fromEntries(Object.entries(SOURCES).map(([key, source]) => [key, { ...source, sha256: sha256(sourceBuffers[key]) }])),
    rawSchema: ["fr_orig", "dms_orig", "dms_dest", "fr_dest", "fr_inmode", "dms_mode", "fr_outmode", "sctg2", "trade_type", "tons_2022", "value_2022"],
    truckMode: { fafCode: TRUCK_MODE, fafLabel: "Truck (include customer pick-up)", cfsCode: CFS_TRUCK_MODE, cfsLabel: "Truck" },
    regionCount: finalizedRegions.length,
    regionsWithTruckData: finalizedRegions.filter((region) => region.truckFreight.totalFlowTons > 0).length,
    fafRowsParsed: aggregation.rowCount,
    fafTruckRowsParsed: aggregation.truckRowCount,
    researchMarketCount: markets.length,
    curatedMarketCount: markets.filter((market) => market.roles.curated).length,
    priorityMarketCount: markets.filter((market) => market.roles.priority).length,
    disclaimer: "Research evidence only. No production Reload Score, ForeSight score, recommendation, seasonal adjustment, or equipment weight is generated.",
  };

  const commodityTaxonomy = Object.entries(COMMODITIES).map(([code, label]) => ({ code, officialLabel: label, preparatoryLoadScoreGroup: COMMODITY_GROUPS[code], equipmentWeightsApplied: false }));
  const outputs = [];
  outputs.push(await output(join(root, "data", "market-intelligence", "faf6-region-indicators.json"), { metadata, regions: finalizedRegions }));
  outputs.push(await output(join(root, "data", "market-intelligence", "free4-markets.json"), { metadata, commodityTaxonomy, markets }));
  outputs.push(await output(join(root, "docs", "market-intelligence", "free4-market-research.md"), researchMarkdown(markets, metadata)));
  const summary = {
    ...metadata,
    curatedMapped: markets.filter((market) => market.roles.curated && market.freightRegion).length,
    curatedUnresolved: markets.filter((market) => market.roles.curated && !market.freightRegion).map((market) => market.displayName),
    priorityMapped: markets.filter((market) => market.roles.priority && market.freightRegion).length,
    priorityUnresolved: markets.filter((market) => market.roles.priority && !market.freightRegion).map((market) => market.displayName),
    confidence: Object.fromEntries(["HIGH", "MEDIUM", "LOW", "UNRESOLVED"].map((level) => [level, markets.filter((market) => market.confidence.level === level).length])),
    review: Object.fromEntries(["appears_consistent", "needs_review", "insufficient_evidence", "proxy_mismatch", "not_applicable"].map((status) => [status, markets.filter((market) => market.review.status === status).length])),
    outputs,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

await main();
