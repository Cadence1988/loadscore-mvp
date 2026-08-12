import { scoreBand, trackEvent } from "../analytics/analytics";

const FEEDBACK_KEY = "loadscore-structured-feedback";
const MAX_LOCAL_FEEDBACK = 50;

function loadFeedback() {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveRecommendationFeedback({
  sentiment,
  reasonCode = "",
  usefulFeature = "",
  score,
  trigger = "result",
}) {
  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    sentiment,
    reasonCode,
    usefulFeature,
    scoreBand: scoreBand(score),
    trigger,
  };
  localStorage.setItem(
    FEEDBACK_KEY,
    JSON.stringify([...loadFeedback(), entry].slice(-MAX_LOCAL_FEEDBACK)),
  );
  trackEvent(
    sentiment === "positive"
      ? "recommendation_feedback_positive"
      : "recommendation_feedback_negative",
    {
      score_band: entry.scoreBand,
      reason_code: reasonCode || "not_selected",
      useful_feature: usefulFeature || "not_selected",
      trigger,
    },
  );
  return entry;
}

export function savePeriodicProductFeedback(comment) {
  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    type: "periodic_product_feedback",
    comment: String(comment || "").trim().slice(0, 1000),
  };
  localStorage.setItem(
    FEEDBACK_KEY,
    JSON.stringify([...loadFeedback(), entry].slice(-MAX_LOCAL_FEEDBACK)),
  );
  trackEvent("periodic_product_feedback_submitted", { trigger: "calculation_count" });
  return entry;
}
