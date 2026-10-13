const RESPONSES = new Set(["yes", "mostly", "no"]);
const REASONS = new Set([
  "immediate_economics",
  "reload_outlook",
  "deadhead",
  "costs",
  "overall_recommendation",
  "other",
  "none",
]);

function scoreFeedbackBand(scoreResult, { foreSight = false } = {}) {
  if (scoreResult?.status === "limited_data") return foreSight ? "limited_data" : "unavailable";
  if (!Number.isFinite(scoreResult?.score)) return "unavailable";
  if (scoreResult.score >= 80) return "high";
  if (scoreResult.score >= 40) return "medium";
  return "low";
}

export function buildDualScoreFeedbackProperties(response, reasonCategory, dualScore) {
  if (!RESPONSES.has(response)) return null;
  const reason = REASONS.has(reasonCategory) ? reasonCategory : "none";
  return {
    surface: "web",
    response,
    reason_category: response === "yes" ? "none" : reason,
    nearsight_band: scoreFeedbackBand(dualScore?.nearSight),
    foresight_band: scoreFeedbackBand(dualScore?.foreSight, { foreSight: true }),
  };
}

export const DUAL_SCORE_FEEDBACK_REASONS = Object.freeze([
  { key: "immediate_economics", label: "Immediate economics feel off" },
  { key: "reload_outlook", label: "Reload outlook feels off" },
  { key: "deadhead", label: "Deadhead impact feels off" },
  { key: "costs", label: "Costs feel off" },
  { key: "overall_recommendation", label: "Overall recommendation feels off" },
  { key: "other", label: "Other" },
]);
