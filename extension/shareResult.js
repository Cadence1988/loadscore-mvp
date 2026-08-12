export const LOADSCORE_LIVE_URL = "https://loadscore-mvp.vercel.app";

function money(value) {
  return Number(value || 0).toLocaleString(undefined, {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  });
}

export function buildExtensionShareText({ form, result, rate }) {
  const factors = [...(result.positives || []), ...(result.warnings || [])].slice(0, 4);
  const why = factors.length ? factors.map((factor) => `• ${factor}`).join("\n") : `• ${result.recommendation}`;
  return [
    `LoadScore — ${form.origin || "Unknown origin"} → ${form.destination || "Unknown destination"}`,
    "",
    `LoadScore: ${result.score} / ${result.label}`,
    `Offer: ${money(form.loadRate)}`,
    `All-in RPM: $${Number(result.allInRpm || 0).toFixed(2)}`,
    `Estimated Profit: ${money(result.estimatedProfit)}`,
    `Deadhead: ${Number(form.deadheadMiles || 0).toLocaleString()} mi`,
    `Reload: ${result.reloadScore}/100 — User-entered estimate`,
    "",
    "Why:",
    why,
    "",
    `Minimum acceptable rate: ${money(rate.minimumRate)}`,
    "",
    "Estimates only—confirm load details and your actual costs.",
    `Score your own freight: ${LOADSCORE_LIVE_URL}`,
  ].join("\n");
}
