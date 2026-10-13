export const FORESIGHT_SHADOW_VERSION = "free6-v1";
export const APPROVAL_STATE = "NOT_APPROVED_FOR_PRODUCTION";
export const EQUIPMENT_CONTEXTS = Object.freeze(["REEFER", "DRY_VAN", "FLATBED", "UNKNOWN"]);
export const STRUCTURAL_CANDIDATES = Object.freeze({
  outbound_led: Object.freeze({ outboundFreightPercentile: 0.4, totalTruckFreightPercentile: 0.3, outboundBalancePercentile: 0.2, commodityDiversityPercentile: 0.1 }),
  balanced_flow: Object.freeze({ outboundFreightPercentile: 0.3, totalTruckFreightPercentile: 0.3, outboundBalancePercentile: 0.25, commodityDiversityPercentile: 0.15 }),
  resilient_mix: Object.freeze({ outboundFreightPercentile: 0.3, totalTruckFreightPercentile: 0.25, outboundBalancePercentile: 0.2, commodityDiversityPercentile: 0.25 }),
});
export const SELECTED_CANDIDATE = "outbound_led";
export const DEFAULT_SEASONAL_CAP = 8;

const round = (value, digits = 1) => Number(Number(value).toFixed(digits));
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function quarterForDate(date) {
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.valueOf())) throw new TypeError("date must be an ISO calendar date");
  return Math.floor(value.getUTCMonth() / 3) + 1;
}

export function structuralScore(indicators, weights = STRUCTURAL_CANDIDATES[SELECTED_CANDIDATE]) {
  const entries = Object.entries(weights);
  if (!indicators || entries.some(([key]) => !Number.isFinite(indicators[key]))) return null;
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight <= 0) return null;
  return round(clamp(entries.reduce((sum, [key, weight]) => sum + indicators[key] * weight, 0) / totalWeight, 0, 100));
}

export function freshnessStatus(vintageEndYear, evaluationDate, { dynamic = false } = {}) {
  if (!Number.isInteger(vintageEndYear)) return "NOT_APPLICABLE";
  const age = new Date(`${evaluationDate}T00:00:00Z`).getUTCFullYear() - vintageEndYear;
  if (age <= (dynamic ? 1 : 2)) return "CURRENT_ENOUGH";
  if (age <= (dynamic ? 3 : 6)) return "AGING";
  return "STALE_FOR_DYNAMIC_USE";
}

function confidenceFactor(mapping, consistency, evidence) {
  const levels = [mapping, consistency, evidence];
  if (levels.includes("LOW")) return 0;
  if (levels.includes("MEDIUM")) return 0.5;
  return levels.every((level) => level === "HIGH") ? 1 : 0;
}

export function seasonalAdjustment(seasonalMarket, { equipment = "UNKNOWN", date = "2026-10-12", cap = DEFAULT_SEASONAL_CAP, mediumFactor = 0.5 } = {}) {
  if (!EQUIPMENT_CONTEXTS.includes(equipment)) throw new TypeError(`Unsupported equipment context: ${equipment}`);
  const base = { adjustment: 0, eligibleEvidence: 0, withheldEvidence: 0, status: "NOT_APPLICABLE", reasons: [] };
  if (equipment !== "REEFER") return { ...base, reasons: [`No USDA refrigerated seasonal adjustment applies to ${equipment}.`] };
  if (!seasonalMarket?.seasonalEvidence?.length) return { ...base, reasons: ["No FREE-5 seasonal evidence exists for this market."] };
  const quarter = quarterForDate(date);
  const contributions = [];
  let withheldEvidence = 0;
  for (const evidence of seasonalMarket.seasonalEvidence) {
    const quarterEvidence = evidence.movement.quarterlyAverageShares.find((item) => item.quarter === quarter);
    const factor = confidenceFactor(seasonalMarket.sourceMapping.confidence, evidence.historicalConsistency.level, evidence.confidence.level);
    const severeMismatch = seasonalMarket.sourceMapping.confidence === "LOW" || evidence.founderReview.status === "geography_mismatch";
    const fresh = freshnessStatus(Math.max(...evidence.movement.structuralYears), date) !== "STALE_FOR_DYNAMIC_USE";
    if (!quarterEvidence || factor === 0 || severeMismatch || !fresh || evidence.equipmentContext.observedContext !== "REEFER") {
      withheldEvidence += 1;
      continue;
    }
    const effectiveFactor = factor === 0.5 ? mediumFactor : factor;
    const raw = clamp((quarterEvidence.averageRatio - 1) * cap, -cap, cap);
    contributions.push({
      evidenceId: evidence.evidenceId,
      commodityGroup: evidence.commodityGroup,
      deviation: round(raw * effectiveFactor, 3),
      weight: Math.sqrt(Math.max(0, evidence.movement.averageAnnualShipmentTons)),
      confidenceFactor: effectiveFactor,
      classification: quarterEvidence.classification,
    });
  }
  if (!contributions.length) return { ...base, withheldEvidence, status: "WITHHELD", reasons: ["Seasonal adjustment withheld because applicable confidence-gated evidence is insufficient."] };
  const weightTotal = contributions.reduce((sum, item) => sum + item.weight, 0);
  const adjustment = round(clamp(contributions.reduce((sum, item) => sum + item.deviation * item.weight, 0) / weightTotal, -cap, cap));
  return {
    adjustment,
    eligibleEvidence: contributions.length,
    withheldEvidence,
    status: "APPLIED_SHADOW_ONLY",
    contributions,
    reasons: [adjustment > 0 ? "Seasonal reefer movement is above this market's structural quarterly baseline." : adjustment < 0 ? "Seasonal reefer movement is below this market's structural quarterly baseline." : "Seasonal reefer movement is near this market's structural quarterly baseline."],
  };
}

function structuralExplanation(indicators) {
  const strengths = [
    ["outboundFreightPercentile", "outbound truck-freight strength"],
    ["totalTruckFreightPercentile", "total truck-freight intensity"],
    ["outboundBalancePercentile", "outbound balance"],
    ["commodityDiversityPercentile", "commodity diversity"],
  ].sort((a, b) => indicators[b[0]] - indicators[a[0]]);
  return `${strengths[0][1][0].toUpperCase()}${strengths[0][1].slice(1)} is the strongest structural signal; ${strengths.at(-1)[1]} is the weakest.`;
}

export function reviewCategory(delta, confidence) {
  if (!Number.isFinite(delta) || confidence === "LOW") return "INSUFFICIENT_EVIDENCE";
  if (Math.abs(delta) <= 5) return "STRONGLY_SUPPORTED";
  if (Math.abs(delta) <= 10) return "GENERALLY_SUPPORTED";
  return delta > 0 ? "EVIDENCE_STRONGER_THAN_CURRENT_SCORE" : "EVIDENCE_WEAKER_THAN_CURRENT_SCORE";
}

export function calculateForeSightShadow({ market, seasonalMarket = null, equipment = "UNKNOWN", date = "2026-10-12", weights = STRUCTURAL_CANDIDATES[SELECTED_CANDIDATE], seasonalCap = DEFAULT_SEASONAL_CAP, mediumFactor = 0.5 } = {}) {
  if (!market?.indicators) return {
    status: "INSUFFICIENT_EVIDENCE",
    approvalState: APPROVAL_STATE,
    shadowScore: null,
    structuralScore: null,
    seasonalAdjustment: 0,
    confidence: "LOW",
    freshness: { structuralVintage: 2022, seasonalProfileVintage: null, currentYearDataUsed: false, structural: "AGING", seasonal: "NOT_APPLICABLE" },
    reasons: ["No mapped FREE-4 structural market evidence is available; no score was invented."],
    provenance: [],
    currentCuratedScore: null,
    deltaFromCurated: null,
    reviewStatus: "INSUFFICIENT_EVIDENCE",
  };
  const structural = structuralScore(market.indicators, weights);
  const seasonal = seasonalAdjustment(seasonalMarket, { equipment, date, cap: seasonalCap, mediumFactor });
  const score = Math.round(clamp(structural + seasonal.adjustment, 0, 100));
  const current = Number.isFinite(market.currentCuratedReloadScore) ? market.currentCuratedReloadScore : null;
  const delta = current === null ? null : score - current;
  const confidence = market.confidence?.level === "HIGH" && seasonal.status !== "WITHHELD" ? "HIGH" : market.confidence?.level || "LOW";
  const seasonalEnd = seasonalMarket?.seasonalEvidence?.length ? Math.max(...seasonalMarket.seasonalEvidence.flatMap((item) => item.movement.structuralYears)) : null;
  const reasons = [structuralExplanation(market.indicators), ...seasonal.reasons];
  if (delta !== null && Math.abs(delta) > 10) reasons.push(`Structural evidence supports a ${delta > 0 ? "stronger" : "weaker"} outlook than the current curated score; founder review is required.`);
  return {
    status: "SHADOW_ONLY",
    approvalState: APPROVAL_STATE,
    shadowScore: score,
    structuralScore: structural,
    seasonalAdjustment: seasonal.adjustment,
    seasonalStatus: seasonal.status,
    seasonalEvidence: { eligible: seasonal.eligibleEvidence, withheld: seasonal.withheldEvidence, contributions: seasonal.contributions || [] },
    confidence,
    freshness: {
      structuralVintage: 2022,
      seasonalProfileVintage: seasonalEnd ? `2019-${seasonalEnd}` : null,
      currentYearDataUsed: false,
      structural: freshnessStatus(2022, date),
      seasonal: seasonalEnd ? freshnessStatus(seasonalEnd, date) : "NOT_APPLICABLE",
    },
    reasons,
    provenance: ["FREE-4 FAF6.0 structural indicators", ...(seasonalMarket ? ["FREE-5 USDA AMS 2019-2025 seasonal profiles"] : [])],
    currentCuratedScore: current,
    deltaFromCurated: delta,
    reviewStatus: reviewCategory(delta, confidence),
  };
}
