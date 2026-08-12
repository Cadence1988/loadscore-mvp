import { validateLoadTiming } from "./loadLifecycle.js";

export const IMPORT_ROW_LIMIT = 250;
export const STANDARD_FIELDS = ["origin", "destination", "loadRate", "loadedMiles", "deadheadMiles", "pickupDate", "pickupTime", "deliveryDate", "deliveryTime", "equipment", "weight", "stops", "brokerReference", "loadIdentifier", "expirationDate", "expirationTime"];
export const COLUMN_ALIASES = {
  origin: ["origin", "pickup", "pickup_city", "pu_city", "from"],
  destination: ["destination", "delivery", "delivery_city", "del_city", "to"],
  loadRate: ["rate", "offered_rate", "offer", "pay", "price"],
  loadedMiles: ["loaded_miles", "miles", "distance", "loadedmi"],
  deadheadMiles: ["deadhead", "deadhead_miles", "dh", "empty_miles"],
  pickupDate: ["pickup_date", "pu_date"], pickupTime: ["pickup_time", "pu_time"],
  deliveryDate: ["delivery_date", "del_date"], deliveryTime: ["delivery_time", "del_time"],
  equipment: ["equipment", "equipment_type", "truck_type"], weight: ["weight", "weight_lbs", "lbs"],
  stops: ["stops", "stop_count"], brokerReference: ["broker", "broker_name", "broker_reference"],
  loadIdentifier: ["reference", "reference_id", "load_id", "id"],
  expirationDate: ["expiration", "expiration_date", "expires"], expirationTime: ["expiration_time", "expires_time"],
};

function cleanNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedHeader(value) { return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }

export function suggestColumnMapping(headers) {
  return Object.fromEntries(headers.map((header) => {
    const normalized = normalizedHeader(header);
    const match = Object.entries(COLUMN_ALIASES).find(([, aliases]) => aliases.includes(normalized));
    return [header, match?.[0] || ""];
  }));
}

export function parseCsvDocument(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const input = String(text || "").replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"' && quoted && input[index + 1] === '"') { field += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(field.trim()); field = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field.trim()); field = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else field += character;
  }
  if (field || row.length) { row.push(field.trim()); if (row.some((value) => value !== "")) rows.push(row); }
  if (quoted) return { headers: [], rows: [], error: "CSV contains an unclosed quoted field." };
  if (rows.length < 2) return { headers: rows[0] || [], rows: [], error: "CSV needs a header row and at least one data row." };
  const headers = rows[0];
  return { headers, rows: rows.slice(1, IMPORT_ROW_LIMIT + 1), totalRows: rows.length - 1, truncated: rows.length - 1 > IMPORT_ROW_LIMIT, error: "" };
}

function confidenceFor(value, required = false) {
  if (value === "" || value === null || value === undefined) return { status: "missing", label: "Missing" };
  return { status: required ? "high" : "review", label: required ? "High" : "Review" };
}

export function normalizeLoad(raw = {}, source = "manual") {
  const normalized = {
    origin: String(raw.origin || "").trim(), destination: String(raw.destination || "").trim(),
    loadRate: cleanNumber(raw.loadRate), loadedMiles: cleanNumber(raw.loadedMiles), deadheadMiles: cleanNumber(raw.deadheadMiles),
    pickupDate: String(raw.pickupDate || "").trim(), pickupTime: String(raw.pickupTime || "").trim(),
    deliveryDate: String(raw.deliveryDate || "").trim(), deliveryTime: String(raw.deliveryTime || "").trim(),
    equipment: String(raw.equipment || "").trim(), weight: cleanNumber(raw.weight), stops: cleanNumber(raw.stops),
    brokerReference: String(raw.brokerReference || "").trim(), loadIdentifier: String(raw.loadIdentifier || "").trim(),
    expirationDate: String(raw.expirationDate || "").trim(), expirationTime: String(raw.expirationTime || "").trim(),
    source, status: raw.status || "available",
  };
  const confidence = Object.fromEntries(STANDARD_FIELDS.map((field) => [field, confidenceFor(normalized[field], ["origin", "destination", "loadRate", "loadedMiles"].includes(field))]));
  const errors = [];
  if (!normalized.origin) errors.push("Origin is required.");
  if (!normalized.destination) errors.push("Destination is required.");
  if (!(normalized.loadRate > 0)) errors.push("Offered rate must be greater than zero.");
  if (!(normalized.loadedMiles > 0)) errors.push("Loaded miles must be greater than zero.");
  const timing = validateLoadTiming(normalized);
  errors.push(...timing.errors);
  const warnings = [...timing.warnings];
  if (normalized.deadheadMiles === null) warnings.push("Deadhead is unknown; it is not confirmed as zero.");
  return { load: normalized, confidence, errors, warnings, status: errors.length ? "missing_required" : warnings.length ? "review" : "ready" };
}

export function normalizeCsvRows(document, mapping) {
  return document.rows.map((values, index) => {
    const raw = {};
    document.headers.forEach((header, column) => { if (mapping[header]) raw[mapping[header]] = values[column] ?? ""; });
    return { ...normalizeLoad(raw, "csv"), rowNumber: index + 2 };
  });
}

function matchValue(text, pattern) { return text.match(pattern)?.[1]?.trim() || ""; }
function parseDate(value) {
  const match = String(value || "").match(/(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return "";
  return match[1] ? `${match[1]}-${match[2]}-${match[3]}` : `${match[6]}-${match[4].padStart(2, "0")}-${match[5].padStart(2, "0")}`;
}

export function parsePastedLoadBlock(text) {
  const route = text.match(/([A-Za-z][A-Za-z .'-]+,?\s+[A-Z]{2})\s*(?:to|→|->|—|–)\s*([A-Za-z][A-Za-z .'-]+,?\s+[A-Z]{2})/i);
  const pickupText = matchValue(text, /pickup(?:\s+date)?\s*[:=-]?\s*([^\n|;]+)/i);
  const deliveryText = matchValue(text, /delivery(?:\s+date)?\s*[:=-]?\s*([^\n|;]+)/i);
  const expirationText = matchValue(text, /(?:expires?|expiration)\s*[:=-]?\s*([^\n|;]+)/i);
  const parsed = normalizeLoad({
    origin: route?.[1] || matchValue(text, /origin\s*[:=-]\s*([^\n|;]+)/i),
    destination: route?.[2] || matchValue(text, /destination\s*[:=-]\s*([^\n|;]+)/i),
    loadRate: matchValue(text, /(?:rate|offer|pay)\s*[:=-]?\s*\$?([\d,]+(?:\.\d{1,2})?)/i) || matchValue(text, /\$\s*([\d,]+(?:\.\d{1,2})?)/),
    loadedMiles: matchValue(text, /(?:loaded\s*)?(?:miles|mi)\s*[:=-]?\s*([\d,]+)/i) || matchValue(text, /([\d,]+)\s*(?:loaded\s*)?(?:miles|mi)\b/i),
    deadheadMiles: matchValue(text, /(?:deadhead|dh)\s*[:=-]?\s*([\d,]+)/i),
    pickupDate: parseDate(pickupText), pickupTime: matchValue(pickupText, /(\d{1,2}:\d{2})/),
    deliveryDate: parseDate(deliveryText), deliveryTime: matchValue(deliveryText, /(\d{1,2}:\d{2})/),
    expirationDate: parseDate(expirationText), expirationTime: matchValue(expirationText, /(\d{1,2}:\d{2})/),
    equipment: matchValue(text, /\b(dry van|van|reefer|flatbed|step deck|power only|box truck)\b/i),
    weight: matchValue(text, /(?:weight|wt)\s*[:=-]?\s*([\d,]+)/i), stops: matchValue(text, /stops?\s*[:=-]?\s*(\d+)/i),
    brokerReference: matchValue(text, /broker\s*[:=-]\s*([^\n|;]+)/i),
    loadIdentifier: matchValue(text, /(?:load|reference|ref)\s*(?:id|#)?\s*[:=-]\s*([\w-]+)/i),
  }, "pasted_text");
  for (const field of STANDARD_FIELDS) {
    if (parsed.load[field] !== "" && parsed.load[field] !== null) parsed.confidence[field] = { status: "high", label: "High" };
  }
  return parsed;
}

export function parsePastedLoads(text) {
  const input = String(text || "").trim();
  if (!input) return [];
  let blocks = input.split(/\n\s*\n+/).filter(Boolean);
  if (blocks.length === 1) {
    const routeLines = input.split(/\n+/).filter((line) => /[A-Za-z .'-]+,?\s+[A-Z]{2}\s*(?:to|→|->|—|–)\s*[A-Za-z .'-]+,?\s+[A-Z]{2}/i.test(line));
    if (routeLines.length > 1) blocks = routeLines;
  }
  return blocks.slice(0, IMPORT_ROW_LIMIT).map((block, index) => ({ ...parsePastedLoadBlock(block), rowNumber: index + 1, rawBoundaryReview: blocks.length === 1 && input.split(/\n+/).length > 1 }));
}

export function loadFingerprint(load) {
  if (load.loadIdentifier) return `id:${String(load.loadIdentifier).toLowerCase()}`;
  return [load.origin, load.destination, load.loadRate, load.loadedMiles, load.pickupDate].map((value) => String(value ?? "").trim().toLowerCase()).join("|");
}

export function flagDuplicates(rows) {
  const seen = new Set();
  return rows.map((row) => {
    const key = loadFingerprint(row.load);
    if (seen.has(key)) return { ...row, duplicate: true, status: "duplicate" };
    seen.add(key);
    return { ...row, duplicate: false };
  });
}
