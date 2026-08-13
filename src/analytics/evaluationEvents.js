// This fingerprint is intentionally local-only. It may reflect freight inputs and must never be sent.
export function createLocalEvaluationFingerprint(form, alertStatus = "") {
  return JSON.stringify({
    origin: form.origin,
    destination: form.destination,
    loadRate: form.loadRate,
    loadedMiles: form.loadedMiles,
    deadheadMiles: form.deadheadMiles,
    manualReloadScore: form.manualReloadScore,
    mpg: form.mpg,
    fuelPrice: form.fuelPrice,
    fixedCostPerMile: form.fixedCostPerMile,
    alertStatus,
  });
}

export function createLocalEventDeduper() {
  const emitted = new Map();
  return {
    shouldEmit(eventName, fingerprint) {
      if (!eventName || !fingerprint || emitted.get(eventName) === fingerprint) return false;
      emitted.set(eventName, fingerprint);
      return true;
    },
  };
}
