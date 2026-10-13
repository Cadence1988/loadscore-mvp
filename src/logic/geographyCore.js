export const US_STATE_CODES = Object.freeze([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

const STATE_CODES = new Set(US_STATE_CODES);
const hydratedCache = new WeakMap();
const searchIndexCache = new WeakMap();

export function normalizePlaceText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[.’'`]/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function parsePlaceInput(value) {
  const original = String(value || "").trim().replace(/\s+/g, " ");
  const stateMatch = original.match(/^(.*?)(?:,\s*|\s+)([A-Za-z]{2})$/);
  const stateCode = stateMatch && STATE_CODES.has(stateMatch[2].toUpperCase())
    ? stateMatch[2].toUpperCase()
    : "";
  const name = stateCode ? stateMatch[1].trim() : original;
  return { original, name, stateCode, normalizedName: normalizePlaceText(name) };
}

export function hydratePlaces(dataset) {
  if (!dataset || !Array.isArray(dataset.records)) return [];
  if (hydratedCache.has(dataset)) return hydratedCache.get(dataset);
  const source = dataset.metadata?.agency || "U.S. Census Bureau";
  const sourceVintage = String(dataset.metadata?.vintage || "");
  const places = dataset.records.map((row) => ({
    id: row[0],
    geoid: row[1],
    name: row[2],
    stateCode: row[3],
    displayName: row[4],
    latitude: row[5],
    longitude: row[6],
    geographyType: row[7],
    source,
    sourceVintage,
  }));
  hydratedCache.set(dataset, places);
  return places;
}

function searchIndex(dataset) {
  if (searchIndexCache.has(dataset)) return searchIndexCache.get(dataset);
  const index = hydratePlaces(dataset).map((place) => ({
    place,
    normalizedName: normalizePlaceText(place.name),
    normalizedDisplay: normalizePlaceText(place.displayName),
  }));
  searchIndexCache.set(dataset, index);
  return index;
}

export function searchPlaces(dataset, value, priorityDisplayNames = [], limit = 10) {
  const input = parsePlaceInput(value);
  if (!input.normalizedName) return [];
  const priority = priorityDisplayNames instanceof Set
    ? priorityDisplayNames
    : new Set(priorityDisplayNames.map((item) => normalizePlaceText(item)));

  const candidates = [];
  const normalizedOriginal = normalizePlaceText(input.original);
  for (const entry of searchIndex(dataset)) {
      const { place, normalizedName: name, normalizedDisplay: display } = entry;
      if (input.stateCode && place.stateCode !== input.stateCode) continue;
      let relevance = 99;
      if (name === input.normalizedName) relevance = 0;
      else if (name.startsWith(input.normalizedName)) relevance = 1;
      else if (display.startsWith(normalizedOriginal)) relevance = 2;
      else if (name.split(" ").some((word) => word.startsWith(input.normalizedName))) relevance = 3;
      else if (name.includes(input.normalizedName)) relevance = 4;
      if (relevance !== 99) candidates.push({ place, relevance, priority: priority.has(display) ? 1 : 0 });
  }

  return candidates
    .sort((a, b) => a.relevance - b.relevance || b.priority - a.priority || a.place.displayName.localeCompare(b.place.displayName) || a.place.geoid.localeCompare(b.place.geoid))
    .slice(0, Math.max(1, limit))
    .map((candidate) => candidate.place);
}

export function resolvePlace(dataset, value) {
  const input = parsePlaceInput(value);
  if (!input.normalizedName) return { status: "unresolved", place: null, matches: [] };
  const matches = searchIndex(dataset)
    .filter((entry) => entry.normalizedName === input.normalizedName && (!input.stateCode || entry.place.stateCode === input.stateCode))
    .map((entry) => entry.place);
  if (matches.length === 1) return { status: "resolved", place: matches[0], matches };
  if (matches.length > 1) return { status: "ambiguous", place: null, matches };
  return { status: "unresolved", place: null, matches: [] };
}

export function canonicalizePlaceValue(dataset, value) {
  const resolution = resolvePlace(dataset, value);
  return resolution.status === "resolved"
    ? resolution.place.displayName
    : String(value || "").trim().replace(/\s+/g, " ");
}
