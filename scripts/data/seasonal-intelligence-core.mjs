const MONTHS = Object.freeze({ jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 });

const COMMODITY_RULES = Object.freeze([
  ["potatoes", /potato/i],
  ["onions", /onion/i],
  ["apples", /apple/i],
  ["citrus", /orange|grapefruit|lemon|tangerine|clementine|mandarin|citrus/i],
  ["lettuce", /lettuce/i],
  ["tomatoes", /tomato/i],
  ["berries", /strawberr|blueberr|raspberr|blackberr|berr/i],
  ["melons", /melon|cantaloup|watermelon|honeydew/i],
  ["grapes", /grape/i],
  ["tree_fruit", /peach|nectarine|plum|cherr|pear|apricot/i],
  ["leafy_greens", /greens|spinach|kale/i],
  ["peppers", /pepper/i],
  ["broccoli_cauliflower", /broccoli|cauliflower/i],
  ["sweet_corn", /corn/i],
]);

export const EQUIPMENT_CONTEXTS = Object.freeze(["REEFER", "DRY_VAN", "FLATBED", "UNKNOWN"]);

export function normalizeCommodity(value) {
  const match = COMMODITY_RULES.find(([, pattern]) => pattern.test(String(value || "")));
  return match?.[0] || null;
}

export function parseUsdaDate(value) {
  const match = String(value || "").trim().match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})$/i);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  const day = Number(match[2]);
  if (!month || day < 1 || day > 31) return null;
  return { month, day, display: `${match[1].slice(0, 3)} ${day}` };
}

function xmlText(value) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
}

export function parseSharedStrings(xml) {
  return [...String(xml).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => xmlText([...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join("")));
}

function columnIndex(reference) {
  const letters = reference.match(/^[A-Z]+/)?.[0] || "";
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

export function parseQuarterlyWorksheet(sheetXml, sharedStringsXml) {
  const shared = parseSharedStrings(sharedStringsXml);
  const rows = [];
  for (const rowMatch of String(sheetXml).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const reference = cellMatch[1].match(/\br="([A-Z]+\d+)"/)?.[1];
      if (!reference) continue;
      const type = cellMatch[1].match(/\bt="([^"]+)"/)?.[1];
      const raw = cellMatch[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      cells[columnIndex(reference)] = type === "s" ? shared[Number(raw)] : raw;
    }
    if (cells[0] !== undefined) rows.push(cells);
  }
  const [headers, ...records] = rows;
  if (!headers || headers.slice(0, 5).join("|") !== "Year|Quarter|Origin|Commodity|Tons") throw new Error("Unexpected AMS quarterly shipment workbook schema.");
  return records.map((row, index) => {
    const record = { year: Number(row[0]), quarter: Number(row[1]), origin: String(row[2] || "").trim(), commodity: String(row[3] || "").trim(), tons: Number(row[4]) };
    if (!Number.isInteger(record.year) || ![1, 2, 3, 4].includes(record.quarter) || !record.origin || !record.commodity || !Number.isFinite(record.tons)) throw new Error(`Invalid AMS shipment row ${index + 2}.`);
    return record;
  });
}

function round(value, digits = 4) { return Number(Number(value).toFixed(digits)); }
function percentile(values, target) {
  const sorted = [...values].sort((a, b) => a - b);
  const below = sorted.filter((value) => value < target).length;
  const equal = sorted.filter((value) => value === target).length;
  return round(((below + equal / 2) / sorted.length) * 100, 1);
}

export function buildSeasonalProfiles(rows, { startYear = 2019, endYear = 2025, minimumYears = 5, minimumTons = 1000 } = {}) {
  const groups = new Map();
  for (const row of rows) {
    if (row.year < startYear || row.year > endYear || row.commodity === "ORIGIN TOTAL") continue;
    const commodityGroup = normalizeCommodity(row.commodity);
    if (!commodityGroup) continue;
    const key = `${row.origin}|${commodityGroup}`;
    if (!groups.has(key)) groups.set(key, { origin: row.origin, commodityGroup, sourceCommodities: new Set(), years: new Map() });
    const group = groups.get(key);
    group.sourceCommodities.add(row.commodity);
    if (!group.years.has(row.year)) group.years.set(row.year, [0, 0, 0, 0]);
    group.years.get(row.year)[row.quarter - 1] += row.tons;
  }
  const profiles = [];
  for (const group of groups.values()) {
    let negativeAggregateCellsFloored = 0;
    const allYears = [...group.years].map(([year, quarters]) => [year, quarters.map((value) => {
      if (value >= 0) return value;
      negativeAggregateCellsFloored += 1;
      return 0;
    })]);
    const years = allYears.filter(([, quarters]) => quarters.reduce((sum, value) => sum + value, 0) > 0).sort(([a], [b]) => a - b);
    const totalTons = years.reduce((sum, [, quarters]) => sum + quarters.reduce((subtotal, value) => subtotal + value, 0), 0);
    if (years.length < minimumYears || totalTons < minimumTons) continue;
    const yearShares = years.map(([, quarters]) => {
      const total = quarters.reduce((sum, value) => sum + value, 0);
      return quarters.map((value) => total > 0 ? value / total : 0);
    });
    const meanShares = [0, 1, 2, 3].map((quarter) => yearShares.reduce((sum, shares) => sum + shares[quarter], 0) / yearShares.length);
    const mean = 0.25;
    const standardDeviation = Math.sqrt(meanShares.reduce((sum, value) => sum + (value - mean) ** 2, 0) / 4);
    const classifications = meanShares.map((share) => standardDeviation === 0 ? "normal" : share >= mean + standardDeviation * 0.5 ? "peak" : share > mean ? "shoulder" : share <= mean - standardDeviation * 0.5 ? "off" : "normal");
    const peakShare = Math.max(...meanShares);
    const peakQuarter = meanShares.indexOf(peakShare) + 1;
    const matchingPeaks = yearShares.filter((shares) => shares.indexOf(Math.max(...shares)) + 1 === peakQuarter).length;
    const repeatRate = matchingPeaks / yearShares.length;
    const consistency = repeatRate >= 5 / 7 ? "HIGH" : repeatRate >= 3 / 7 ? "MEDIUM" : "LOW";
    profiles.push({
      profileId: `ams:${group.origin.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${group.commodityGroup}`,
      origin: group.origin,
      commodityGroup: group.commodityGroup,
      sourceCommodities: [...group.sourceCommodities].sort(),
      negativeAggregateCellsFloored,
      yearsIncluded: years.map(([year]) => year),
      missingYears: Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index).filter((year) => !group.years.has(year)),
      annualShipmentTons: round(totalTons),
      averageAnnualShipmentTons: round(totalTons / years.length),
      quarterlyAverageShares: meanShares.map((share, index) => ({ quarter: index + 1, share: round(share, 6), averageRatio: round(share / 0.25, 4), classification: classifications[index] })),
      peakQuarters: classifications.flatMap((classification, index) => classification === "peak" ? [index + 1] : []),
      shoulderQuarters: classifications.flatMap((classification, index) => classification === "shoulder" ? [index + 1] : []),
      offQuarters: classifications.flatMap((classification, index) => classification === "off" ? [index + 1] : []),
      peakIntensityRatio: round(peakShare / 0.25, 4),
      seasonalConcentration: round(meanShares.reduce((sum, share) => sum + share ** 2, 0), 6),
      historicalConsistency: { level: consistency, repeatingPeakYears: matchingPeaks, yearsObserved: years.length, repeatRate: round(repeatRate, 4) },
    });
  }
  const intensityValues = profiles.map((profile) => profile.peakIntensityRatio);
  const volumeValues = profiles.map((profile) => profile.averageAnnualShipmentTons);
  return profiles.map((profile) => ({ ...profile, indicators: { peakIntensityPercentile: percentile(intensityValues, profile.peakIntensityRatio), shipmentVolumePercentile: percentile(volumeValues, profile.averageAnnualShipmentTons) } })).sort((a, b) => a.origin.localeCompare(b.origin) || a.commodityGroup.localeCompare(b.commodityGroup));
}

const DATE_TOKEN = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{1,2}|\(NA\)/gi;

export function parseNassFieldCropContexts(text) {
  let state = null;
  const records = [];
  const groupForCrop = (crop) => /potato/i.test(crop) ? "potatoes" : /soybean/i.test(crop) ? "soybeans" : /rice/i.test(crop) ? "rice" : /wheat/i.test(crop) ? "wheat" : /corn/i.test(crop) ? "corn" : null;
  for (const line of String(text).split(/\r?\n/)) {
    const heading = line.match(/^Usual Planting and Harvesting Dates by Crop - (.+)$/);
    if (heading) { state = heading[1].trim(); continue; }
    if (!state || !line.includes(":")) continue;
    const crop = line.split(":")[0].replace(/\.+$/, "").trim();
    const commodityGroup = groupForCrop(crop);
    if (!commodityGroup) continue;
    const tokens = line.match(DATE_TOKEN) || [];
    if (tokens.length < 4) continue;
    const dated = tokens.filter((token) => token !== "(NA)");
    if (dated.length < 2) continue;
    const harvestTokens = dated.slice(-4);
    records.push({ state, commodityGroup, sourceCrop: crop, harvest: { begins: parseUsdaDate(harvestTokens[0]), mostActiveStart: harvestTokens.length === 4 ? parseUsdaDate(harvestTokens[1]) : null, mostActiveEnd: harvestTokens.length === 4 ? parseUsdaDate(harvestTokens[2]) : null, ends: parseUsdaDate(harvestTokens.at(-1)) }, vintage: 2010, sourceBasis: "Usual dates based on 20 years of historical crop progress estimates and specialist knowledge." });
  }
  return records;
}

const VEGETABLE_HEADINGS = Object.freeze([
  ["broccoli_cauliflower", /Broccoli|Cauliflower/i], ["melons", /Cantaloups|Honeydews|Watermelons/i],
  ["sweet_corn", /Corn, Sweet/i], ["lettuce", /Lettuce/i], ["onions", /Onions/i],
  ["peppers", /Peppers/i], ["leafy_greens", /Spinach/i], ["berries", /Strawberries/i], ["tomatoes", /Tomatoes/i],
]);

export function parseNassVegetableContexts(text) {
  let commodityGroup = null;
  let sourceCommodity = null;
  let season = null;
  const records = [];
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.includes(":") && trimmed.length < 90) {
      const heading = VEGETABLE_HEADINGS.find(([, pattern]) => pattern.test(trimmed) && /Fresh Market|continued/i.test(trimmed));
      if (heading) { commodityGroup = heading[0]; sourceCommodity = trimmed.replace(/\s*\(continued\)\s*/i, ""); }
    }
    const seasonMatch = trimmed.match(/^(Winter|Spring|Summer|Fall)\s*:/i);
    if (seasonMatch) { season = seasonMatch[1].toUpperCase(); continue; }
    if (!commodityGroup || !season) continue;
    const stateMatch = line.match(/^\s{2}([A-Z]{2})(?:\s+\d+)*\s*:\s*(.+)$/);
    if (!stateMatch) continue;
    const tokens = stateMatch[2].match(DATE_TOKEN) || [];
    if (tokens.length < 4) continue;
    const dates = tokens.map(parseUsdaDate).filter(Boolean);
    if (dates.length < 4) continue;
    const harvestDates = dates.slice(-4);
    records.push({ stateCode: stateMatch[1], commodityGroup, sourceCommodity, season, harvest: { begins: harvestDates[0], mostActiveStart: harvestDates.length === 4 ? harvestDates[1] : null, mostActiveEnd: harvestDates.length === 4 ? harvestDates[2] : null, ends: harvestDates.at(-1) }, vintage: 2007, sourceBasis: "Usual vegetable planting and harvesting dates compiled by NASS field offices with grower and specialist consultation." });
  }
  return records;
}

export function reviewSeasonalEvidence(profile, mappingConfidence) {
  if (!profile) return { status: "no_reliable_evidence", candidate: "no_adjustment_justified" };
  if (mappingConfidence === "LOW") return { status: "geography_mismatch", candidate: "no_adjustment_justified" };
  if (profile.yearsIncluded.length < 5) return { status: "insufficient_history", candidate: "no_adjustment_justified" };
  if (profile.historicalConsistency.level === "HIGH" && profile.peakIntensityRatio >= 1.35) return { status: "strong_seasonal_evidence", candidate: "equipment_specific_seasonal_review" };
  if (profile.historicalConsistency.level !== "LOW" && profile.peakIntensityRatio >= 1.15) return { status: "moderate_seasonal_evidence", candidate: "seasonal_review" };
  return { status: "weak_evidence", candidate: "no_adjustment_justified" };
}
