import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { cities } from "../src/data/cities.js";
import { getCuratedMarketScore, marketScores } from "../src/data/marketScores.js";
import {
  canonicalizePlaceValue,
  hydratePlaces,
  normalizePlaceText,
  resolvePlace,
  searchPlaces,
  US_STATE_CODES,
} from "../src/logic/geographyCore.js";
import * as extensionGeography from "../extension/geographyCore.js";
import { calculateForeSightScore, calculateNearSightScore, calculateStoredLoadDualScore } from "../src/logic/calculateDualScore.js";
import { calculateLoadScore as calculateWebLoadScore } from "../src/logic/calculateLoadScore.js";
import { calculateLoadScore as calculateExtensionLoadScore } from "../extension/loadScore.js";
import { SAFE_PROPERTY_KEYS } from "../src/analytics/eventSchema.js";

const placePath = new URL("../public/data/geography/places-2026.json", import.meta.url);
const extensionPlacePath = new URL("../extension/data/geography/places-2026.json", import.meta.url);
const zctaPath = new URL("../data/geography/zcta-2026.json", import.meta.url);
const places = JSON.parse(await readFile(placePath, "utf8"));
const zctas = JSON.parse(await readFile(zctaPath, "utf8"));

const EXPECTED_MARKETS = {
  "Allentown, PA": 68, "Dallas, TX": 85, "Atlanta, GA": 88, "Baltimore, MD": 67,
  "Birmingham, AL": 72, "Buffalo, NY": 58, "Chattanooga, TN": 78, "Chicago, IL": 82,
  "Cincinnati, OH": 73, "Cleveland, OH": 69, "Columbia, SC": 68, "Los Angeles, CA": 70,
  "Phoenix, AZ": 65, "Denver, CO": 40, "Salt Lake City, UT": 38, "Miami, FL": 35,
  "New York, NY": 45, "Houston, TX": 78, "Jacksonville, FL": 62, "Laredo, TX": 74,
  "Louisville, KY": 75, "Memphis, TN": 80, "Milwaukee, WI": 68, "Minneapolis, MN": 67,
  "Nashville, TN": 73, "New Orleans, LA": 52, "Oklahoma City, OK": 65, "Omaha, NE": 62,
  "Ontario, CA": 72, "Orlando, FL": 48, "Philadelphia, PA": 66, "Pittsburgh, PA": 60,
  "Portland, OR": 50, "Raleigh, NC": 66, "Richmond, VA": 65, "Savannah, GA": 64,
  "Seattle, WA": 52, "St. Louis, MO": 71, "Tampa, FL": 50, "Toledo, OH": 66,
  "Indianapolis, IN": 76, "Columbus, OH": 74, "Kansas City, MO": 72, "Charlotte, NC": 70,
};

test("official transformed place dataset loads with required provenance and canonical fields", () => {
  assert.equal(places.metadata.agency, "U.S. Census Bureau");
  assert.equal(places.metadata.vintage, "2026");
  assert.match(places.metadata.sourceUrl, /2026_Gaz_place_national\.zip$/);
  assert.equal(places.records.length, 32071);
  assert.deepEqual(places.fields, ["id", "geoid", "name", "stateCode", "displayName", "latitude", "longitude", "geographyType"]);
  const hydrated = hydratePlaces(places);
  const ids = new Set();
  const geoids = new Set();
  const states = new Set(US_STATE_CODES);
  for (const place of hydrated) {
    assert.match(place.id, /^place:\d{7}$/);
    assert.match(place.geoid, /^\d{7}$/);
    assert.ok(place.name && place.displayName === `${place.name}, ${place.stateCode}`);
    assert.ok(states.has(place.stateCode));
    assert.ok(Number.isFinite(place.latitude) && place.latitude >= -90 && place.latitude <= 90);
    assert.ok(Number.isFinite(place.longitude) && place.longitude >= -180 && place.longitude <= 180);
    assert.ok(["incorporated_place", "census_designated_place"].includes(place.geographyType));
    assert.equal(place.sourceVintage, "2026");
    ids.add(place.id); geoids.add(place.geoid);
  }
  assert.equal(ids.size, hydrated.length);
  assert.equal(geoids.size, hydrated.length);
  assert.equal(hydrated.some((place) => place.stateCode === "PR"), false);
});

test("all 142 legacy freight cities resolve and remain autocomplete-searchable", () => {
  assert.equal(cities.length, 142);
  for (const city of cities) {
    assert.equal(resolvePlace(places, city).status, "resolved", city);
    assert.equal(searchPlaces(places, city, cities, 10).some((place) => place.displayName === city), true, city);
  }
});

test("national search recognizes new places, disambiguates states, and avoids ambiguous guesses", () => {
  assert.equal(resolvePlace(places, "Abanda, AL").status, "resolved");
  assert.equal(resolvePlace(places, "  abanda al ").place.displayName, "Abanda, AL");
  assert.equal(resolvePlace(places, "Springfield").status, "ambiguous");
  for (const city of ["Springfield, IL", "Springfield, MO", "Springfield, MA", "Portland, OR", "Portland, ME", "Kansas City, MO", "Kansas City, KS"]) {
    assert.equal(resolvePlace(places, city).status, "resolved", city);
  }
  assert.equal(resolvePlace(places, "St Louis MO").place.displayName, "St. Louis, MO");
  assert.equal(resolvePlace(places, "Coeur dAlene ID").place.displayName, "Coeur d'Alene, ID");
  const portlands = searchPlaces(places, "Portland", cities, 10).map((place) => place.displayName);
  assert.ok(portlands.indexOf("Portland, ME") < portlands.indexOf("Portland, AR"));
  assert.ok(portlands.indexOf("Portland, OR") < portlands.indexOf("Portland, AR"));
});

test("legacy values canonicalize only when unambiguous and unresolved strings survive", () => {
  assert.equal(canonicalizePlaceValue(places, "dallas tx"), "Dallas, TX");
  assert.equal(canonicalizePlaceValue(places, "Springfield"), "Springfield");
  assert.equal(canonicalizePlaceValue(places, "Legacy Yard, ZZ"), "Legacy Yard, ZZ");
});

test("all 44 curated markets resolve and preserve every numerical score", () => {
  assert.deepEqual(marketScores, EXPECTED_MARKETS);
  assert.equal(Object.keys(marketScores).length, 44);
  for (const [displayName, score] of Object.entries(EXPECTED_MARKETS)) {
    assert.equal(resolvePlace(places, displayName).status, "resolved", displayName);
    assert.equal(getCuratedMarketScore(displayName), score, displayName);
  }
  assert.equal(getCuratedMarketScore("Dallas TX"), 85);
  assert.equal(getCuratedMarketScore("St Louis MO"), 71);
});

test("known ForeSight, unknown-place limited data, NearSight, and main score remain unchanged", () => {
  const input = { origin: "Dallas, TX", destination: "Atlanta, GA", loadRate: 2600, loadedMiles: 780, deadheadMiles: 35, deadheadConfirmed: true, mpg: 6.5, fuelPrice: 4, fixedCostPerMile: 0.65 };
  assert.equal(calculateForeSightScore({ destination: input.destination, curatedReloadScore: getCuratedMarketScore(input.destination) }).score, 88);
  assert.deepEqual(calculateForeSightScore({ destination: "Abanda, AL", curatedReloadScore: getCuratedMarketScore("Abanda, AL") }).score, null);
  assert.equal(calculateForeSightScore({ destination: "Abanda, AL", curatedReloadScore: null }).status, "limited_data");
  assert.equal(calculateNearSightScore(input).score, 100);
  assert.equal(calculateWebLoadScore({ ...input, reloadScore: 88 }).score, 100);
  const stored = calculateStoredLoadDualScore(input, getCuratedMarketScore);
  assert.equal(stored.foreSight.score, 88);
  assert.equal(stored.nearSight.score, 100);
});

test("ZCTA foundation is separate, valid, and never represented as authoritative USPS ZIP data", () => {
  assert.equal(zctas.metadata.agency, "U.S. Census Bureau");
  assert.equal(zctas.metadata.vintage, "2026");
  assert.equal(zctas.records.length, 33791);
  assert.match(zctas.metadata.dataset, /ZIP Code Tabulation Areas/);
  assert.match(zctas.metadata.disclaimer, /not authoritative USPS/i);
  assert.doesNotMatch(zctas.metadata.disclaimer, /^authoritative USPS/i);
  const ids = new Set();
  for (const [zcta5, latitude, longitude] of zctas.records) {
    assert.match(zcta5, /^\d{5}$/);
    assert.ok(Number.isFinite(latitude) && latitude >= -90 && latitude <= 90);
    assert.ok(Number.isFinite(longitude) && longitude >= -180 && longitude <= 180);
    ids.add(zcta5);
  }
  assert.equal(ids.size, zctas.records.length);
});

test("website and extension geography artifacts and runtime helpers have exact parity", async () => {
  const webBytes = await readFile(placePath);
  const extensionBytes = await readFile(extensionPlacePath);
  assert.equal(createHash("sha256").update(webBytes).digest("hex"), createHash("sha256").update(extensionBytes).digest("hex"));
  assert.equal(await readFile(new URL("../src/logic/geographyCore.js", import.meta.url), "utf8"), await readFile(new URL("../extension/geographyCore.js", import.meta.url), "utf8"));
  assert.equal(extensionGeography.resolvePlace(places, "Dallas TX").place.displayName, "Dallas, TX");
  const fixture = { loadRate: 1800, loadedMiles: 780, deadheadMiles: 35, mpg: 6.5, fuelPrice: 4, fixedCostPerMile: 0.65, reloadScore: 88 };
  const webScore = calculateWebLoadScore(fixture);
  const extensionScore = calculateExtensionLoadScore(fixture);
  for (const field of ["score", "label", "totalMiles", "allInRpm", "estimatedProfit", "reloadScore"]) assert.equal(extensionScore[field], webScore[field], field);
});

test("geography does not expand analytics or alter extension permissions", async () => {
  for (const forbidden of ["city", "state", "geoid", "latitude", "longitude", "coordinates", "zcta", "origin", "destination"]) assert.equal(SAFE_PROPERTY_KEYS.has(forbidden), false, forbidden);
  const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.version, "0.6.2");
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "storage", "notifications"]);
  assert.equal("host_permissions" in manifest, false);
});

test("normalization handles whitespace, case, punctuation, and state abbreviations", () => {
  assert.equal(normalizePlaceText("  St.  Louis,   MO "), "st louis mo");
  assert.equal(normalizePlaceText("Coeur d’Alene-ID"), "coeur dalene id");
});
