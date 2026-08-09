export function calculateLoadScore(input) {
  const loadRate = Number(input.loadRate) || 0;
  const loadedMiles = Number(input.loadedMiles) || 0;
  const deadheadMiles = Number(input.deadheadMiles) || 0;
  const mpg = Number(input.mpg) || 6.5;
  const fuelPrice = Number(input.fuelPrice) || 4;
  const fixedCostPerMile = Number(input.fixedCostPerMile) || 0.65;
  const reloadScore = Number.isFinite(Number(input.reloadScore))
    ? Number(input.reloadScore)
    : 50;

  const totalMiles = loadedMiles + deadheadMiles;
  const allInRpm = totalMiles > 0 ? loadRate / totalMiles : 0;
  const fuelCost = totalMiles > 0 ? (totalMiles / mpg) * fuelPrice : 0;
  const fixedCost = totalMiles * fixedCostPerMile;
  const estimatedProfit = loadRate - fuelCost - fixedCost;
  const profitPerMile = totalMiles > 0 ? estimatedProfit / totalMiles : 0;

  let score = 50;
  const positives = [];
  const warnings = [];

  if (allInRpm >= 2.5) { score += 20; positives.push("strong all-in RPM"); }
  else if (allInRpm >= 2) { score += 10; positives.push("solid all-in RPM"); }
  else if (allInRpm < 1.75) { score -= 15; warnings.push("low all-in RPM"); }

  if (profitPerMile >= 1) { score += 10; positives.push("healthy profit per mile"); }
  if (deadheadMiles <= 50) { score += 10; positives.push("low deadhead"); }
  else if (deadheadMiles > 150) { score -= 15; warnings.push("high deadhead"); }
  if (estimatedProfit < 300) { score -= 10; warnings.push("low estimated profit"); }
  if (reloadScore >= 75) { score += 10; positives.push("strong reload market"); }
  else if (reloadScore < 40) { score -= 10; warnings.push("weak reload market"); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = score >= 80 ? "Strong Load" : score >= 60 ? "Good Load" : score >= 40 ? "Caution" : "Avoid";
  const recommendation = warnings.length
    ? `${label}: the main concern is ${warnings[0]}.`
    : `${label}: the strongest factor is ${positives[0] || "the overall balance"}.`;

  return { score, label, totalMiles, allInRpm, estimatedProfit, reloadScore, recommendation };
}

export function calculateMinimumRate(input) {
  const loadedMiles = Math.max(0, Number(input.loadedMiles) || 0);
  const deadheadMiles = Math.max(0, Number(input.deadheadMiles) || 0);
  const totalMiles = loadedMiles + deadheadMiles;
  const mpg = Math.max(0.1, Number(input.mpg) || 6.5);
  const fuelPrice = Math.max(0, Number(input.fuelPrice) || 4);
  const fixedCostPerMile = Math.max(0, Number(input.fixedCostPerMile) || 0.65);
  const targetAllInRpm = Math.max(0, Number(input.targetAllInRpm) || 2.25);
  const targetProfit = Math.max(0, Number(input.targetProfit) || 500);
  const currentRate = Math.max(0, Number(input.loadRate) || 0);
  const operatingCost = totalMiles > 0
    ? (totalMiles / mpg) * fuelPrice + totalMiles * fixedCostPerMile
    : 0;
  const rateForRpm = totalMiles * targetAllInRpm;
  const rateForProfit = operatingCost + targetProfit;
  const minimumRate = Math.ceil(Math.max(rateForRpm, rateForProfit) / 25) * 25;
  const askMore = Math.max(0, minimumRate - currentRate);

  return {
    minimumRate,
    askMore,
    meetsTarget: currentRate >= minimumRate && currentRate > 0,
  };
}

export function parseHighlightedLoad(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  const route = normalized.match(
    /([A-Za-z][A-Za-z .'-]+,?\s+[A-Z]{2})\s*(?:[Tt][Oo]|→|->|—|–)\s*([A-Za-z][A-Za-z .'-]+,?\s+[A-Z]{2})/,
  );
  const rate = normalized.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  const loadedMiles = normalized.match(/([\d,]+)\s*(?:loaded\s*)?(?:mi(?:les)?|miles)\b/i);
  const deadhead = normalized.match(/(?:deadhead|dh)\s*[:=-]?\s*([\d,]+)\s*(?:mi(?:les)?)?/i);

  return {
    origin: route?.[1]?.replace(/\s+/g, " ").trim() || "",
    destination: route?.[2]?.replace(/\s+/g, " ").trim() || "",
    loadRate: rate?.[1]?.replace(/,/g, "") || "",
    loadedMiles: loadedMiles?.[1]?.replace(/,/g, "") || "",
    deadheadMiles: deadhead?.[1]?.replace(/,/g, "") || "",
  };
}
