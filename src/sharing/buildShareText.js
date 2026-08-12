export const LOADSCORE_LIVE_URL = "https://loadscore-mvp.vercel.app";

function money(value) {
  return Number(value || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function reloadLabel(source) {
  if (source === "manual") return "Manual estimate";
  if (source === "curated") return "Curated starter estimate";
  return "Neutral default estimate (unknown market)";
}

export function buildShareText({ form, result, reloadScoreSource, minimumRate, modeLabel, evaluationTrust }) {
  const positives = result.explanation?.positives || [];
  const warnings = result.explanation?.warnings || [];
  const reasons = [...positives.slice(0, 3), ...warnings.slice(0, 2)].slice(0, 4);
  const why = reasons.length
    ? reasons.map((factor) => `• ${factor.title}`).join("\n")
    : "• Review the overall economics and load details";

  return [
    `LoadScore — ${form.origin || "Unknown origin"} → ${form.destination || "Unknown destination"}`,
    "",
    `LoadScore: ${result.score} / ${result.label}`,
    ...(evaluationTrust?.status && evaluationTrust.status !== "complete" ? [`Status: ${evaluationTrust.label} — ${evaluationTrust.message}`] : []),
    ...(modeLabel ? [`Operating Mode: ${modeLabel}`] : []),
    `Offer: ${money(form.loadRate)}`,
    `All-in RPM: $${Number(result.allInRpm || 0).toFixed(2)}`,
    `Estimated Profit: ${money(result.estimatedProfit)}`,
    `Deadhead: ${form.deadheadMiles === "" || form.deadheadMiles === null || form.deadheadMiles === undefined ? "Unknown" : `${Number(form.deadheadMiles).toLocaleString()} mi`}`,
    `Reload: ${result.reloadScore}/100 — ${reloadLabel(reloadScoreSource)}`,
    "",
    "Why:",
    why,
    "",
    `Minimum acceptable rate: ${evaluationTrust?.status && evaluationTrust.status !== "complete" ? "Provisional until deadhead is known" : money(minimumRate)}`,
    "",
    "Estimates only—confirm load details and your actual costs.",
    `Score your own freight: ${LOADSCORE_LIVE_URL}`,
  ].join("\n");
}
