export function hasKnownDeadhead(load = {}) {
  if (load.deadheadConfirmed === true) return true;
  return load.deadheadMiles !== "" && load.deadheadMiles !== null && load.deadheadMiles !== undefined && Number.isFinite(Number(load.deadheadMiles));
}
export function assessEvaluationTrust(load = {}) {
  const missing = [];
  if (!String(load.origin || "").trim()) missing.push("origin");
  if (!String(load.destination || "").trim()) missing.push("destination");
  if (!(Number(load.loadRate) > 0)) missing.push("offered rate");
  if (!(Number(load.loadedMiles) > 0)) missing.push("loaded miles");
  if (!hasKnownDeadhead(load)) missing.push("deadhead");
  const provisional = missing.includes("deadhead") && missing.length === 1;
  return { status: missing.length === 0 ? "complete" : provisional ? "provisional" : "needs_review", label: missing.length === 0 ? "Complete Evaluation" : provisional ? "Provisional Evaluation" : "Needs Review", missing, canRank: missing.length === 0, canMatch: missing.length === 0, message: provisional ? "Deadhead is unknown. Add it or deliberately confirm 0 miles before relying on RPM, profit, score, or mode matching." : missing.length ? `Review required: ${missing.join(", ")}.` : "Required load economics are present." };
}
