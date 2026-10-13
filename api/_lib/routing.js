export const GOOGLE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
export const ROUTING_PROVIDER = "google_routes";
export const ROUTING_PROFILE = "google-routes-drive-v1";
export const MAX_ROUTE_METERS = 20_000_000;

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validCoordinate(point) {
  if (!point || typeof point !== "object" || Array.isArray(point)) return false;
  const keys = Object.keys(point);
  if (keys.some((key) => !["lat", "lon", "placeId"].includes(key))) return false;
  const lat = number(point.lat);
  const lon = number(point.lon);
  return lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
    && (point.placeId === undefined || (typeof point.placeId === "string" && point.placeId.length <= 80));
}

export function validateDistanceRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "invalid_request" };
  if (Object.keys(body).some((key) => !["origin", "destination"].includes(key))) return { ok: false, error: "invalid_request" };
  if (!validCoordinate(body.origin) || !validCoordinate(body.destination)) return { ok: false, error: "invalid_coordinates" };
  if (Number(body.origin.lat) === Number(body.destination.lat) && Number(body.origin.lon) === Number(body.destination.lon)) return { ok: false, error: "same_location" };
  return { ok: true };
}

export function googleRoutesBody(body) {
  const waypoint = (point) => ({ location: { latLng: { latitude: Number(point.lat), longitude: Number(point.lon) } } });
  return {
    origin: waypoint(body.origin),
    destination: waypoint(body.destination),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_UNAWARE",
    computeAlternativeRoutes: false,
    units: "IMPERIAL",
  };
}

export function normalizeGoogleRouteResponse(payload, retrievedAt = new Date().toISOString()) {
  const meters = Number(payload?.routes?.[0]?.distanceMeters);
  if (!Number.isFinite(meters) || meters <= 0 || meters > MAX_ROUTE_METERS) throw new Error("malformed_provider_response");
  return {
    status: "READY",
    distanceMiles: Number((meters / 1609.344).toFixed(1)),
    provider: ROUTING_PROVIDER,
    routeType: "STANDARD_ROAD",
    estimated: true,
    retrievedAt,
    profile: ROUTING_PROFILE,
  };
}

export function readRoutingConfig(environment = process.env) {
  const apiKey = String(environment.GOOGLE_ROUTES_API_KEY || "").trim();
  if (!apiKey) throw new Error("routing_not_configured");
  return { apiKey };
}

export function clientAddress(request) {
  return String(request.headers?.["x-forwarded-for"] || request.socket?.remoteAddress || "unknown").split(",")[0].trim().slice(0, 80);
}

export function createRateLimiter({ limit = 20, windowMs = 60_000, now = () => Date.now() } = {}) {
  const buckets = new Map();
  return (key) => {
    const current = now();
    const bucket = buckets.get(key);
    if (!bucket || current - bucket.startedAt >= windowMs) {
      buckets.set(key, { count: 1, startedAt: current });
      return true;
    }
    if (bucket.count >= limit) return false;
    bucket.count += 1;
    return true;
  };
}

export function allowedRequestOrigin(request, environment = process.env) {
  const origin = String(request.headers?.origin || "").replace(/\/$/, "");
  const allowed = new Set(["https://loadscoreapp.com", "http://localhost:5173", "http://127.0.0.1:5173"]);
  const configured = String(environment.LOADSCORE_SITE_URL || "").replace(/\/$/, "");
  if (configured) allowed.add(configured);
  return !origin || allowed.has(origin);
}
