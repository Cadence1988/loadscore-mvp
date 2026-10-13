export const MILEAGE_SOURCES = Object.freeze({
  MANUAL: "MANUAL",
  PARSED: "PARSED",
  ESTIMATED_ROUTE: "ESTIMATED_ROUTE",
  NONE: "NONE",
});

export const ROUTING_STATES = Object.freeze({
  IDLE: "IDLE",
  WAITING_FOR_LOCATIONS: "WAITING_FOR_LOCATIONS",
  LOADING: "LOADING",
  READY: "READY",
  ERROR: "ERROR",
  UNAVAILABLE: "UNAVAILABLE",
});

function positiveMiles(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolveLoadedMiles({ manualMiles, parsedMiles, estimatedMiles } = {}) {
  const candidates = [
    [MILEAGE_SOURCES.MANUAL, positiveMiles(manualMiles), false],
    [MILEAGE_SOURCES.PARSED, positiveMiles(parsedMiles), false],
    [MILEAGE_SOURCES.ESTIMATED_ROUTE, positiveMiles(estimatedMiles), true],
  ];
  const selected = candidates.find(([, value]) => value !== null);
  return selected
    ? { value: selected[1], source: selected[0], estimated: selected[2] }
    : { value: null, source: MILEAGE_SOURCES.NONE, estimated: false };
}

export function mileageLabel(source) {
  return {
    [MILEAGE_SOURCES.MANUAL]: "Driver-entered",
    [MILEAGE_SOURCES.PARSED]: "Parsed from load offer",
    [MILEAGE_SOURCES.ESTIMATED_ROUTE]: "Estimated route miles",
    [MILEAGE_SOURCES.NONE]: "Mileage needed",
  }[source] || "Mileage needed";
}

export function routePairKey(origin, destination, profile = "google-routes-drive-v1") {
  if (!origin?.id || !destination?.id) return "";
  return `${origin.id}|${destination.id}|${profile}`;
}

export function mileageForSavedLoad(load = {}) {
  if (load.mileageSource === MILEAGE_SOURCES.MANUAL) {
    return resolveLoadedMiles({ manualMiles: load.manualLoadedMiles ?? load.loadedMiles, parsedMiles: load.parsedLoadedMiles, estimatedMiles: load.estimatedRouteMiles });
  }
  if (load.mileageSource === MILEAGE_SOURCES.PARSED) {
    return resolveLoadedMiles({ parsedMiles: load.parsedLoadedMiles ?? load.loadedMiles, estimatedMiles: load.estimatedRouteMiles });
  }
  if (load.mileageSource === MILEAGE_SOURCES.ESTIMATED_ROUTE) {
    return resolveLoadedMiles({ estimatedMiles: load.estimatedRouteMiles ?? load.loadedMiles });
  }
  // Backward compatibility: legacy records only had loadedMiles and represented a user-controlled value.
  return resolveLoadedMiles({ manualMiles: load.loadedMiles });
}

export function withResolvedMileage(load = {}) {
  const resolved = mileageForSavedLoad(load);
  return { ...load, loadedMiles: resolved.value ?? "", mileageSource: resolved.source, mileageEstimated: resolved.estimated };
}
