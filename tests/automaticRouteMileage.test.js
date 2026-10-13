import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDistanceHandler } from "../api/routing/distance.js";
import { createRateLimiter, googleRoutesBody, normalizeGoogleRouteResponse, readRoutingConfig, validateDistanceRequest } from "../api/_lib/routing.js";
import { MILEAGE_SOURCES, ROUTING_STATES, mileageForSavedLoad, resolveLoadedMiles, routePairKey, withResolvedMileage } from "../src/logic/mileageSource.js";
import { calculateLoadScore } from "../src/logic/calculateLoadScore.js";
import { calculateForeSightScore, calculateNearSightScore } from "../src/logic/calculateDualScore.js";
import { assessEvaluationTrust } from "../src/logic/evaluationTrust.js";
import { normalizeLoad, parsePastedLoadBlock } from "../src/logic/loadNormalizer.js";
import { invalidateRouteState, readyRouteState, requestRouteDistance } from "../src/routing/routeMileageClient.js";
import { SAFE_PROPERTY_KEYS } from "../src/analytics/eventSchema.js";
import { WEB_BUILD_VERSION, EXTENSION_BUILD_VERSION } from "../src/config/version.js";

const origin = { id: "place:4819000", latitude: 32.7933, longitude: -96.7665 };
const destination = { id: "place:1304000", latitude: 33.7629, longitude: -84.4227 };
const routePayload = { routes: [{ distanceMeters: 1_303_570 }] };

function responseRecorder() {
  return { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, setHeader() { return this; }, json(body) { this.body = body; return this; } };
}

function request(body, headers = {}) {
  return { method: "POST", body, headers: { "x-loadscore-client": "web", ...headers }, socket: { remoteAddress: "127.0.0.1" } };
}

test("route API validates coordinates and rejects extra or same-location input", () => {
  assert.equal(validateDistanceRequest({ origin: { lat: 32, lon: -96 }, destination: { lat: 33, lon: -84 } }).ok, true);
  assert.equal(validateDistanceRequest({ origin: { lat: 91, lon: -96 }, destination: { lat: 33, lon: -84 } }).error, "invalid_coordinates");
  assert.equal(validateDistanceRequest({ origin: { lat: 32, lon: -96, secret: "x" }, destination: { lat: 33, lon: -84 } }).error, "invalid_coordinates");
  assert.equal(validateDistanceRequest({ origin: { lat: 32, lon: -96 }, destination: { lat: 32, lon: -96 } }).error, "same_location");
});

test("provider request and response are narrowly normalized", () => {
  const body = googleRoutesBody({ origin: { lat: 32, lon: -96 }, destination: { lat: 33, lon: -84 } });
  assert.equal(body.travelMode, "DRIVE");
  assert.equal(body.routingPreference, "TRAFFIC_UNAWARE");
  assert.equal("truck" in body, false);
  const normalized = normalizeGoogleRouteResponse(routePayload, "2026-10-12T12:00:00.000Z");
  assert.deepEqual(normalized, { status: "READY", distanceMiles: 810, provider: "google_routes", routeType: "STANDARD_ROAD", estimated: true, retrievedAt: "2026-10-12T12:00:00.000Z", profile: "google-routes-drive-v1" });
  assert.throws(() => normalizeGoogleRouteResponse({ routes: [] }), /malformed_provider_response/);
});

test("manual then parsed then estimate precedence is deterministic", () => {
  assert.equal(resolveLoadedMiles({ manualMiles: 900, parsedMiles: 850, estimatedMiles: 810 }).source, MILEAGE_SOURCES.MANUAL);
  assert.deepEqual(resolveLoadedMiles({ parsedMiles: 850, estimatedMiles: 810 }), { value: 850, source: MILEAGE_SOURCES.PARSED, estimated: false });
  assert.deepEqual(resolveLoadedMiles({ estimatedMiles: 810 }), { value: 810, source: MILEAGE_SOURCES.ESTIMATED_ROUTE, estimated: true });
  assert.deepEqual(resolveLoadedMiles({}), { value: null, source: MILEAGE_SOURCES.NONE, estimated: false });
});

test("manual overrides estimates, survives estimate changes, and clearing falls back", () => {
  assert.equal(resolveLoadedMiles({ manualMiles: 768, estimatedMiles: 742 }).value, 768);
  assert.equal(resolveLoadedMiles({ manualMiles: 768, estimatedMiles: 900 }).value, 768);
  assert.deepEqual(resolveLoadedMiles({ manualMiles: "", estimatedMiles: 900 }), { value: 900, source: "ESTIMATED_ROUTE", estimated: true });
});

test("route-key change invalidates a stale estimate", () => {
  const estimate = normalizeGoogleRouteResponse(routePayload, "2026-10-12T12:00:00.000Z");
  const ready = readyRouteState(origin, destination, estimate);
  assert.equal(ready.status, ROUTING_STATES.READY);
  assert.equal(invalidateRouteState(ready, ready.key), ready);
  const changed = invalidateRouteState(ready, routePairKey(origin, { ...destination, id: "place:0455000" }));
  assert.equal(changed.estimate, null);
  assert.equal(changed.status, ROUTING_STATES.WAITING_FOR_LOCATIONS);
});

test("client leaves mileage unresolved when routing fails and never creates a straight-line fallback", async () => {
  await assert.rejects(() => requestRouteDistance(origin, destination, { fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ error: "routing_not_configured" }) }) }), /routing_not_configured/);
  assert.equal(resolveLoadedMiles({}).value, null);
  assert.equal(resolveLoadedMiles({ manualMiles: 700 }).value, 700);
});

test("route handler sanitizes malformed provider responses and keeps the key server-side", async () => {
  let providerOptions;
  const handler = createDistanceHandler({ config: { apiKey: "test-placeholder" }, rateLimit: () => true, fetchRoute: async (_url, options) => { providerOptions = options; return { ok: true, json: async () => routePayload }; }, now: () => "2026-10-12T12:00:00.000Z" });
  const response = responseRecorder();
  await handler(request({ origin: { lat: 32, lon: -96, placeId: "a" }, destination: { lat: 33, lon: -84, placeId: "b" } }), response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.distanceMiles > 0, true);
  assert.equal(JSON.stringify(response.body).includes("test-placeholder"), false);
  assert.equal(providerOptions.headers["x-goog-api-key"], "test-placeholder");
  assert.equal(providerOptions.headers["x-goog-fieldmask"], "routes.distanceMeters");

  const malformed = createDistanceHandler({ config: { apiKey: "x" }, rateLimit: () => true, fetchRoute: async () => ({ ok: true, json: async () => ({ routes: [] }) }) });
  const failed = responseRecorder();
  await malformed(request({ origin: { lat: 32, lon: -96 }, destination: { lat: 33, lon: -84 } }), failed);
  assert.deepEqual({ status: failed.statusCode, body: failed.body }, { status: 503, body: { error: "route_unavailable" } });
});

test("server coalesces concurrent identical requests without persistent result caching", async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const handler = createDistanceHandler({ config: { apiKey: "x" }, rateLimit: () => true, fetchRoute: async () => { calls += 1; await pending; return { ok: true, json: async () => routePayload }; } });
  const body = { origin: { lat: 32, lon: -96 }, destination: { lat: 33, lon: -84 } };
  const firstResponse = responseRecorder(); const secondResponse = responseRecorder();
  const first = handler(request(body), firstResponse); const second = handler(request(body), secondResponse);
  release(); await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(firstResponse.body.distanceMiles, secondResponse.body.distanceMiles);
});

test("rate limiter bounds anonymous requests and configuration fails closed", () => {
  let time = 0;
  const limiter = createRateLimiter({ limit: 2, windowMs: 100, now: () => time });
  assert.equal(limiter("client"), true); assert.equal(limiter("client"), true); assert.equal(limiter("client"), false);
  time = 101; assert.equal(limiter("client"), true);
  assert.throws(() => readRoutingConfig({}), /routing_not_configured/);
  assert.deepEqual(readRoutingConfig({ GOOGLE_ROUTES_API_KEY: "server-only" }), { apiKey: "server-only" });
});

test("score and NearSight formulas are unchanged for the same effective miles", () => {
  const common = { loadRate: 2600, deadheadMiles: 35, deadheadConfirmed: true, mpg: 6.5, fuelPrice: 4, fixedCostPerMile: 0.65, reloadScore: 88 };
  const manual = calculateLoadScore({ ...common, loadedMiles: 780 });
  const estimated = calculateLoadScore({ ...common, loadedMiles: 780, mileageSource: "ESTIMATED_ROUTE", estimatedRouteMiles: 780 });
  assert.deepEqual(estimated, manual);
  assert.deepEqual(calculateNearSightScore({ ...common, loadedMiles: 780 }), calculateNearSightScore({ ...common, mileageSource: "ESTIMATED_ROUTE", estimatedRouteMiles: 780 }));
  const preliminary = calculateNearSightScore({ loadRate: 1800, mileageSource: "ESTIMATED_ROUTE", estimatedRouteMiles: 700, deadheadMiles: "", deadheadConfirmed: false });
  assert.equal(preliminary.status, "preliminary");
});

test("saved loads preserve provenance and legacy records remain compatible", () => {
  assert.deepEqual(mileageForSavedLoad({ loadedMiles: 500 }), { value: 500, source: "MANUAL", estimated: false });
  const saved = withResolvedMileage({ loadedMiles: 742, manualLoadedMiles: null, estimatedRouteMiles: 742, mileageSource: "ESTIMATED_ROUTE", routeProvider: "google_routes" });
  assert.equal(saved.loadedMiles, 742); assert.equal(saved.mileageSource, "ESTIMATED_ROUTE");
  assert.equal(assessEvaluationTrust({ origin: "Dallas, TX", destination: "Atlanta, GA", loadRate: 1800, deadheadMiles: 0, deadheadConfirmed: true, ...saved }).canRank, true);
});

test("explicit parsed mileage outranks estimates and user correction becomes manual", () => {
  const parsed = parsePastedLoadBlock("Dallas, TX -> Atlanta, GA | Rate: $2500 | Miles: 810 | Deadhead: 35");
  assert.equal(parsed.load.mileageSource, "PARSED");
  assert.equal(parsed.load.parsedLoadedMiles, 810);
  const estimatedAdded = normalizeLoad({ ...parsed.load, estimatedRouteMiles: 900 }, "pasted_text");
  assert.equal(estimatedAdded.load.loadedMiles, 810);
  const corrected = normalizeLoad({ ...parsed.load, manualLoadedMiles: 825, estimatedRouteMiles: 900 }, "pasted_text");
  assert.equal(corrected.load.loadedMiles, 825); assert.equal(corrected.load.mileageSource, "MANUAL");
});

test("routing remains canonical-only, debounced, privacy-safe, and extension-free", async () => {
  assert.equal(routePairKey({ id: "a" }, { id: "b" }), "a|b|google-routes-drive-v1");
  assert.equal(routePairKey(null, destination), "");
  const hook = await readFile(new URL("../src/routing/useAutomaticRouteMileage.js", import.meta.url), "utf8");
  assert.match(hook, /resolvePlace/); assert.match(hook, /setTimeout/); assert.doesNotMatch(hook, /trackEvent|localStorage/);
  for (const forbidden of ["origin", "destination", "coordinates", "route_miles", "place_id", "zcta"]) assert.equal(SAFE_PROPERTY_KEYS.has(forbidden), false);
  const extensionManifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
  assert.equal(extensionManifest.version, "0.6.2");
  assert.equal("host_permissions" in extensionManifest, false);
});

test("production versions and protected ForeSight remain explicit", () => {
  assert.equal(WEB_BUILD_VERSION, "2026.10.12-beta.12");
  assert.equal(EXTENSION_BUILD_VERSION, "0.6.2");
  assert.equal(calculateForeSightScore({ destination: "Atlanta, GA", curatedReloadScore: 88 }).score, 88);
});
