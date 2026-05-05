export function calculateLoadScore(input) {
  const loadRate = Number(input.loadRate) || 0;
  const loadedMiles = Number(input.loadedMiles) || 0;
  const deadheadMiles = Number(input.deadheadMiles) || 0;
  const mpg = Number(input.mpg) || 6.5;
  const fuelPrice = Number(input.fuelPrice) || 4;
  const fixedCostPerMile = Number(input.fixedCostPerMile) || 0.65;
  const reloadScore = Number(input.reloadScore) || 50;

  const totalMiles = loadedMiles + deadheadMiles;
  const grossRpm = loadedMiles > 0 ? loadRate / loadedMiles : 0;
  const allInRpm = totalMiles > 0 ? loadRate / totalMiles : 0;
  const fuelGallons = totalMiles > 0 && mpg > 0 ? totalMiles / mpg : 0;
  const fuelCost = fuelGallons * fuelPrice;
  const fixedCost = totalMiles * fixedCostPerMile;
  const estimatedProfit = loadRate - fuelCost - fixedCost;
  const profitPerMile = totalMiles > 0 ? estimatedProfit / totalMiles : 0;

  let score = 50;
  const reasons = [];

  if (allInRpm >= 2.5) {
    score += 20;
    reasons.push("Strong all-in rate per mile.");
  } else if (allInRpm >= 2.0) {
    score += 10;
    reasons.push("Solid all-in rate per mile.");
  } else if (allInRpm < 1.75) {
    score -= 15;
    reasons.push("Low all-in rate per mile.");
  }

  if (profitPerMile >= 1.0) {
    score += 10;
    reasons.push("Healthy estimated profit per mile.");
  }

  if (deadheadMiles <= 50) {
    score += 10;
    reasons.push("Low deadhead.");
  } else if (deadheadMiles > 150) {
    score -= 15;
    reasons.push("High deadhead.");
  }

  if (estimatedProfit < 300) {
    score -= 10;
    reasons.push("Estimated profit is low.");
  }

  if (reloadScore >= 75) {
    score += 10;
    reasons.push("Strong reload market at destination.");
  } else if (reloadScore < 40) {
    score -= 10;
    reasons.push("Weak reload market at destination.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let label = "Avoid";
  if (score >= 80) label = "Strong Load";
  else if (score >= 60) label = "Good Load";
  else if (score >= 40) label = "Caution";

  return {
    score,
    label,
    totalMiles,
    grossRpm,
    allInRpm,
    fuelGallons,
    fuelCost,
    fixedCost,
    estimatedProfit,
    profitPerMile,
    reloadScore,
    reasons,
  };
}
