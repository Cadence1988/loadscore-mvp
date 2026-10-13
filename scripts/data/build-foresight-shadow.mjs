import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APPROVAL_STATE, DEFAULT_SEASONAL_CAP, FORESIGHT_SHADOW_VERSION, SELECTED_CANDIDATE, STRUCTURAL_CANDIDATES, calculateForeSightShadow, structuralScore } from "./foresight-shadow-core.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const evaluationDate = "2026-10-12";
const reviewNames = ["Allentown, PA", "Cincinnati, OH", "Columbus, OH", "Indianapolis, IN", "Kansas City, MO", "Oklahoma City, OK", "St. Louis, MO"];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const byName = (items) => new Map(items.map((item) => [item.displayName || item.marketName, item]));
const rank = (values) => new Map([...values].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).map((item, index) => [item.name, index + 1]));

function disagreementBand(delta) {
  const value = Math.abs(delta);
  return value <= 5 ? "CLOSE_AGREEMENT" : value <= 10 ? "MODERATE_DISAGREEMENT" : "MATERIAL_DISAGREEMENT";
}

function stability(free4, seasonalByName) {
  const candidateScores = Object.fromEntries(Object.entries(STRUCTURAL_CANDIDATES).map(([candidate, weights]) => [candidate, free4.markets.map((market) => ({ name: market.displayName, score: structuralScore(market.indicators, weights) }))]));
  const ranks = Object.fromEntries(Object.entries(candidateScores).map(([candidate, scores]) => [candidate, rank(scores)]));
  const markets = free4.markets.map((market) => {
    const candidateValues = Object.fromEntries(Object.keys(STRUCTURAL_CANDIDATES).map((candidate) => [candidate, candidateScores[candidate].find((item) => item.name === market.displayName).score]));
    const rankValues = Object.fromEntries(Object.keys(STRUCTURAL_CANDIDATES).map((candidate) => [candidate, ranks[candidate].get(market.displayName)]));
    const scoreRange = Math.max(...Object.values(candidateValues)) - Math.min(...Object.values(candidateValues));
    const rankRange = Math.max(...Object.values(rankValues)) - Math.min(...Object.values(rankValues));
    const scenarios = [];
    for (const seasonalCap of [6, 8, 10]) for (const mediumFactor of [0.35, 0.5, 0.65]) scenarios.push(calculateForeSightShadow({ market, seasonalMarket: seasonalByName.get(market.displayName), equipment: "REEFER", date: evaluationDate, seasonalCap, mediumFactor }).shadowScore);
    const scenarioRange = Math.max(...scenarios) - Math.min(...scenarios);
    return { market: market.displayName, candidateScores: candidateValues, candidateRanks: rankValues, scoreRange: Number(scoreRange.toFixed(1)), rankRange, seasonalSensitivityRange: scenarioRange, unstable: rankRange > 10 || scoreRange > 8 || scenarioRange > 5 };
  });
  return { dimensionsTested: ["outbound weight", "balance weight", "diversity weight", "seasonal cap (6/8/10)", "MEDIUM-confidence reduction (0.35/0.5/0.65)"], markets, unstableMarkets: markets.filter((item) => item.unstable).map((item) => item.market) };
}

function tableRow(item, priority = false) {
  const score = item.shadowScore ?? "—";
  const current = item.currentCuratedScore ?? "—";
  const delta = item.deltaFromCurated ?? "—";
  const status = priority ? item.candidateForCuration : item.reviewStatus;
  return `| ${item.market} | ${current} | ${item.structuralScore ?? "—"} | ${item.seasonalAdjustment > 0 ? "+" : ""}${item.seasonalAdjustment} | ${score} | ${delta} | ${item.confidence} | ${item.freshness.structural}/${item.freshness.seasonal} | ${item.equipment} | ${status} | ${item.reasons.join(" ")} |`;
}

function report(artifact) {
  const curated = artifact.backtest.curated;
  const priority = artifact.backtest.priorityUnscored;
  const sorted = [...curated].filter((item) => Number.isFinite(item.deltaFromCurated)).sort((a, b) => b.deltaFromCurated - a.deltaFromCurated);
  const withheld = [...curated, ...priority].filter((item) => item.seasonalStatus === "WITHHELD");
  const lines = [
    "# FREE-6 ForeSight 2.0 Shadow Backtest",
    "",
    `> ${APPROVAL_STATE}. Founder-only offline research; production ForeSight remains authoritative and unchanged. Evaluation date: ${artifact.metadata.evaluationDate}.`,
    "",
    "## Selected model",
    "",
    `Selected structural candidate: **${SELECTED_CANDIDATE}** — outbound 40%, total freight 30%, outbound balance 20%, commodity diversity 10%. Seasonal deviation is capped at ±${DEFAULT_SEASONAL_CAP} points and is eligible only for confidence-gated REEFER evidence. The selection reflects freight logic and rank stability, not forced agreement with curated scores.`,
    "",
    "## Curated markets (44)",
    "",
    "| Market | Current | Structural | Seasonal | Shadow | Delta | Confidence | Freshness structural/seasonal | Equipment | Review | Explanation |",
    "|---|---:|---:|---:|---:|---:|---|---|---|---|---|",
    ...curated.map((item) => tableRow(item)),
    "",
    "## Priority unscored markets",
    "",
    "No production score is created. Eagle Pass is intentionally unresolved because FREE-4 contains no official mapped record for it.",
    "",
    "| Market | Current | Structural | Seasonal | Shadow | Delta | Confidence | Freshness structural/seasonal | Equipment | Curation candidate | Explanation |",
    "|---|---:|---:|---:|---:|---:|---|---|---|---|---|",
    ...priority.map((item) => tableRow(item, true)),
    "",
    "## Disagreement summary",
    "",
    `- Close agreement (≤5): ${artifact.summary.closeAgreement}`,
    `- Moderate disagreement (6–10): ${artifact.summary.moderateDisagreement}`,
    `- Material disagreement (>10): ${artifact.summary.materialDisagreement}`,
    `- Highest positive deltas: ${sorted.slice(0, 5).map((item) => `${item.market} (${item.deltaFromCurated > 0 ? "+" : ""}${item.deltaFromCurated})`).join(", ")}`,
    `- Highest negative deltas: ${sorted.slice(-5).reverse().map((item) => `${item.market} (${item.deltaFromCurated})`).join(", ")}`,
    "",
    "## Seven prior review markets",
    "",
    ...artifact.reviewMarkets.map((item) => `- **${item.market}:** current ${item.currentCuratedScore}, shadow ${item.shadowScore}, delta ${item.deltaFromCurated}; ${item.reviewStatus}. ${item.reasons.at(-1)}`),
    "",
    "## Sensitivity and confidence queues",
    "",
    `- Unstable under tested structural/seasonal variants: ${artifact.sensitivity.unstableMarkets.length ? artifact.sensitivity.unstableMarkets.join(", ") : "None"}.`,
    `- Low-confidence results: ${[...curated, ...priority].filter((item) => item.confidence === "LOW").map((item) => item.market).join(", ") || "None"}.`,
    `- Markets with seasonal adjustment withheld: ${withheld.map((item) => item.market).join(", ") || "None"}.`,
    "",
    "## Founder approval gate",
    "",
    "Production activation requires founder review, final model selection, acceptable confidence coverage, calibration approval, a controlled rollout and fallback plan, and website/extension parity. The present model should gather more evidence before rollout because FAF is annual/regional, seasonality covers only 14 mapped markets, and sensitivity/disagreement queues remain material.",
    "",
    "## Boundaries",
    "",
    "- Offline artifact only; not imported by `src`, `public`, or `extension`.",
    "- Production market scores, ForeSight, NearSight, LoadScore, Decision Lens, recommendations, saved-load ranking, analytics, mileage, and extension behavior are unchanged.",
    "- Partial 2026 USDA data is excluded. No live-market precision is claimed.",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const free4Text = await readFile(join(root, "data", "market-intelligence", "free4-markets.json"), "utf8");
  const free5Text = await readFile(join(root, "data", "market-intelligence", "free5-seasonal-profiles.json"), "utf8");
  const free4 = JSON.parse(free4Text);
  const free5 = JSON.parse(free5Text);
  const seasonalByName = byName(free5.markets);
  const evaluate = (market) => ({ market: market.displayName, equipment: "REEFER", ...calculateForeSightShadow({ market, seasonalMarket: seasonalByName.get(market.displayName), equipment: "REEFER", date: evaluationDate }), disagreementBand: market.currentCuratedReloadScore === null ? null : disagreementBand(calculateForeSightShadow({ market, seasonalMarket: seasonalByName.get(market.displayName), equipment: "REEFER", date: evaluationDate }).deltaFromCurated) });
  const curated = free4.markets.filter((market) => market.roles.curated).map(evaluate);
  const priority = free4.markets.filter((market) => market.roles.priority && !market.roles.curated).map((market) => {
    const item = evaluate(market);
    return { ...item, candidateForCuration: item.confidence === "HIGH" && !["WITHHELD"].includes(item.seasonalStatus) ? "FOUNDER_REVIEW_CANDIDATE" : item.confidence === "LOW" ? "INSUFFICIENT_EVIDENCE" : "MORE_EVIDENCE_REQUIRED", evidenceStrength: item.confidence };
  });
  const unresolved = calculateForeSightShadow();
  priority.push({ market: "Eagle Pass, TX", equipment: "REEFER", ...unresolved, seasonalStatus: "NOT_APPLICABLE", candidateForCuration: "INSUFFICIENT_EVIDENCE", evidenceStrength: "LOW", disagreementBand: null });
  const summary = {
    closeAgreement: curated.filter((item) => item.disagreementBand === "CLOSE_AGREEMENT").length,
    moderateDisagreement: curated.filter((item) => item.disagreementBand === "MODERATE_DISAGREEMENT").length,
    materialDisagreement: curated.filter((item) => item.disagreementBand === "MATERIAL_DISAGREEMENT").length,
  };
  const sensitivityResult = stability(free4, seasonalByName);
  const artifact = {
    metadata: { modelVersion: FORESIGHT_SHADOW_VERSION, approvalState: APPROVAL_STATE, researchOnly: true, productionRuntimeDependency: false, analyticsAllowed: false, evaluationDate, generatedAt: `${evaluationDate}T00:00:00.000Z`, inputHashes: { free4: sha256(free4Text), free5: sha256(free5Text) } },
    model: { selectedCandidate: SELECTED_CANDIDATE, structuralCandidates: STRUCTURAL_CANDIDATES, seasonalCap: DEFAULT_SEASONAL_CAP, seasonalFormula: "volume-tempered weighted mean of (quarter average ratio - 1) × cap, after equipment/freshness/confidence gates", equipmentRules: { REEFER: "eligible", DRY_VAN: "withheld", FLATBED: "withheld", UNKNOWN: "structural only" }, confidenceGates: { HIGH_HIGH_HIGH: 1, ANY_MEDIUM_NO_LOW: 0.5, ANY_LOW: 0, severeGeographyMismatch: 0 }, freshness: { structural: "FAF6 base year 2022 => AGING at evaluation", seasonal: "complete 2019-2025 => CURRENT_ENOUGH", currentYearDataUsed: false } },
    backtest: { curated, priorityUnscored: priority },
    summary,
    sensitivity: sensitivityResult,
    reviewMarkets: curated.filter((item) => reviewNames.includes(item.market)),
    productionActivationRequirements: ["founder review", "model selection", "acceptable confidence coverage", "calibration approval", "rollout plan", "fallback behavior", "extension parity plan"],
    limitations: ["FAF6 is regional annual evidence, not a live city-level market.", "FREE-5 seasonal evidence covers 14 mapped markets and only directly supports REEFER.", "A shadow disagreement is a research queue, not proof that a curated score is wrong.", "No routing, mileage, rates, private freight, scraping, or live truck availability is present."],
  };
  const json = `${JSON.stringify(artifact, null, 2)}\n`;
  const jsonPath = join(root, "data", "market-intelligence", "free6-foresight-shadow.json");
  const reportPath = join(root, "docs", "market-intelligence", "free6-foresight-shadow-backtest.md");
  await mkdir(dirname(jsonPath), { recursive: true });
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(jsonPath, json, "utf8");
  await writeFile(reportPath, report(artifact), "utf8");
  console.log(JSON.stringify({ curatedMarkets: curated.length, priorityMarkets: priority.length, ...summary, unstableMarkets: sensitivityResult.unstableMarkets.length, artifact: { path: "data/market-intelligence/free6-foresight-shadow.json", bytes: Buffer.byteLength(json), sha256: sha256(json) } }, null, 2));
}

await main();
