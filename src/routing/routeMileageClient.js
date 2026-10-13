import { ROUTING_STATES, routePairKey } from "../logic/mileageSource.js";

export function routingPoint(place) {
  return { lat: place.latitude, lon: place.longitude, placeId: place.id };
}

export async function requestRouteDistance(origin, destination, { fetchImpl = fetch, signal } = {}) {
  const response = await fetchImpl("/api/routing/distance", {
    method: "POST",
    headers: { "content-type": "application/json", "x-loadscore-client": "web" },
    body: JSON.stringify({ origin: routingPoint(origin), destination: routingPoint(destination) }),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "route_unavailable");
    error.status = response.status;
    throw error;
  }
  if (payload.status !== ROUTING_STATES.READY || !(Number(payload.distanceMiles) > 0) || payload.estimated !== true) throw new Error("malformed_route_response");
  return payload;
}

export function readyRouteState(origin, destination, estimate) {
  return { status: ROUTING_STATES.READY, key: routePairKey(origin, destination, estimate.profile), estimate, error: "" };
}

export function invalidateRouteState(state, nextKey) {
  return state?.key && state.key === nextKey
    ? state
    : { status: ROUTING_STATES.WAITING_FOR_LOCATIONS, key: nextKey || "", estimate: null, error: "" };
}
