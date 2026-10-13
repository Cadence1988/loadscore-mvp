import { readJsonBody, sendJson } from "../_lib/http.js";
import { GOOGLE_ROUTES_URL, allowedRequestOrigin, clientAddress, createRateLimiter, googleRoutesBody, normalizeGoogleRouteResponse, readRoutingConfig, validateDistanceRequest } from "../_lib/routing.js";

const allowRequest = createRateLimiter();
const inFlight = new Map();

function requestKey(body) {
  return [body.origin.lat, body.origin.lon, body.destination.lat, body.destination.lon].map((value) => Number(value).toFixed(5)).join("|");
}

export function createDistanceHandler({ config, fetchRoute = fetch, rateLimit = allowRequest, now = () => new Date().toISOString() }) {
  return async function distanceHandler(request, response) {
    if (request.method !== "POST") return sendJson(response, 405, { error: "method_not_allowed" });
    if (!allowedRequestOrigin(request)) return sendJson(response, 403, { error: "origin_not_allowed" });
    if (request.headers?.["x-loadscore-client"] !== "web") return sendJson(response, 403, { error: "client_not_allowed" });
    if (!rateLimit(clientAddress(request))) return sendJson(response, 429, { error: "rate_limit_exceeded" });
    try {
      const body = await readJsonBody(request);
      const validation = validateDistanceRequest(body);
      if (!validation.ok) return sendJson(response, 400, { error: validation.error });
      const key = requestKey(body);
      let operation = inFlight.get(key);
      if (!operation) {
        operation = fetchRoute(GOOGLE_ROUTES_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": config.apiKey,
            "x-goog-fieldmask": "routes.distanceMeters",
          },
          body: JSON.stringify(googleRoutesBody(body)),
          signal: AbortSignal.timeout(8_000),
        }).then(async (providerResponse) => {
          if (!providerResponse.ok) throw new Error("provider_unavailable");
          return normalizeGoogleRouteResponse(await providerResponse.json(), now());
        }).finally(() => inFlight.delete(key));
        inFlight.set(key, operation);
      }
      return sendJson(response, 200, await operation);
    } catch (error) {
      const code = ["invalid_request", "request_too_large"].includes(error?.message) ? error.message : "route_unavailable";
      return sendJson(response, code === "invalid_request" || code === "request_too_large" ? 400 : 503, { error: code });
    }
  };
}

export default async function handler(request, response) {
  let config;
  try {
    config = readRoutingConfig();
  } catch {
    return sendJson(response, 503, { error: "routing_not_configured" });
  }
  return createDistanceHandler({ config })(request, response);
}
