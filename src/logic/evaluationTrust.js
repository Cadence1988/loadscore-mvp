export const REQUIRED_EVALUATION_FIELDS = ["origin", "destination", "loadRate", "loadedMiles", "deadheadMiles"];

export function hasKnownDeadhead(load = {}) {
  if (load.deadheadConfirmed === true) return true;
  return load.deadheadMiles !== "" && load.deadheadMiles !== null && load.deadheadMiles !== undefined && Number.isFinite(Number(load.deadheadMiles));
}

export function assessEvaluationTrust(load = {}, { importedReview = false } = {}) {
  const missing = [];
  if (!String(load.origin || "").trim()) missing.push("origin");
  if (!String(load.destination || "").trim()) missing.push("destination");
  if (!(Number(load.loadRate) > 0)) missing.push("offered rate");
  if (!(Number(load.loadedMiles) > 0)) missing.push("loaded miles");
  if (!hasKnownDeadhead(load)) missing.push("deadhead");
  const provisional = missing.includes("deadhead") && missing.length === 1;
  return {
    status: missing.length === 0 && !importedReview ? "complete" : provisional ? "provisional" : "needs_review",
    label: missing.length === 0 && !importedReview ? "Complete Evaluation" : provisional ? "Provisional Evaluation" : "Needs Review",
    missing,
    canRank: missing.length === 0 && !importedReview,
    canMatch: missing.length === 0,
    message: provisional
      ? "Deadhead is unknown. This provisional estimate is not eligible for mode matching or Top 7 ranking because deadhead changes RPM, cost, profit, and LoadScore."
      : missing.length
        ? `Review required: ${missing.join(", ")}.`
        : importedReview
          ? "Review the imported values before treating this evaluation as complete."
          : "Required load economics are present.",
  };
}

export function calculationInputWithTrust(load = {}) {
  const trust = assessEvaluationTrust(load);
  return { input: { ...load, deadheadMiles: hasKnownDeadhead(load) ? Number(load.deadheadMiles) : 0 }, trust };
}
