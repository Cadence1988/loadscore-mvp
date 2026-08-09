export function calculateLoadScore(input) {
  const loadRate = Number(input.loadRate) || 0;
  const loadedMiles = Number(input.loadedMiles) || 0;
  const deadheadMiles = Number(input.deadheadMiles) || 0;
  const mpg = Number(input.mpg) || 6.5;
  const fuelPrice = Number(input.fuelPrice) || 4;
  const fixedCostPerMile = Number(input.fixedCostPerMile) || 0.65;
  const parsedReloadScore = Number(input.reloadScore);
  const reloadScore = Number.isFinite(parsedReloadScore) ? parsedReloadScore : 50;

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
  const positives = [];
  const warnings = [];
  const neutral = [];

  function addFactor(collection, title, detail, impact) {
    collection.push({ title, detail, impact });
  }

  if (allInRpm >= 2.5) {
    score += 20;
    reasons.push("Strong all-in rate per mile.");
    addFactor(
      positives,
      "Strong all-in RPM",
      `$${allInRpm.toFixed(2)} per total mile is at or above the $2.50 target.`,
      20,
    );
  } else if (allInRpm >= 2.0) {
    score += 10;
    reasons.push("Solid all-in rate per mile.");
    addFactor(
      positives,
      "Solid all-in RPM",
      `$${allInRpm.toFixed(2)} per total mile clears the $2.00 threshold.`,
      10,
    );
  } else if (allInRpm < 1.75) {
    score -= 15;
    reasons.push("Low all-in rate per mile.");
    addFactor(
      warnings,
      "Low all-in RPM",
      `$${allInRpm.toFixed(2)} per total mile is below the $1.75 threshold.`,
      -15,
    );
  } else {
    addFactor(
      neutral,
      "Mid-range all-in RPM",
      `$${allInRpm.toFixed(2)} per total mile is between the low-rate penalty and solid-rate bonus.`,
      0,
    );
  }

  if (profitPerMile >= 1.0) {
    score += 10;
    reasons.push("Healthy estimated profit per mile.");
    addFactor(
      positives,
      "Healthy profit per mile",
      `$${profitPerMile.toFixed(2)} estimated profit per total mile earns a bonus.`,
      10,
    );
  } else {
    addFactor(
      neutral,
      "No profit-per-mile bonus",
      `$${profitPerMile.toFixed(2)} estimated profit per total mile is below the $1.00 bonus threshold.`,
      0,
    );
  }

  if (deadheadMiles <= 50) {
    score += 10;
    reasons.push("Low deadhead.");
    addFactor(
      positives,
      "Low deadhead",
      `${deadheadMiles.toFixed(0)} empty miles stays within the 50-mile target.`,
      10,
    );
  } else if (deadheadMiles > 150) {
    score -= 15;
    reasons.push("High deadhead.");
    addFactor(
      warnings,
      "High deadhead",
      `${deadheadMiles.toFixed(0)} empty miles exceeds the 150-mile warning threshold.`,
      -15,
    );
  } else {
    addFactor(
      neutral,
      "Moderate deadhead",
      `${deadheadMiles.toFixed(0)} empty miles earns no bonus or penalty.`,
      0,
    );
  }

  if (estimatedProfit < 300) {
    score -= 10;
    reasons.push("Estimated profit is low.");
    addFactor(
      warnings,
      "Low estimated profit",
      `${estimatedProfit.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })} is below the $300 threshold.`,
      -10,
    );
  }

  if (reloadScore >= 75) {
    score += 10;
    reasons.push("Strong reload market at destination.");
    addFactor(
      positives,
      "Strong destination market",
      `A ${reloadScore}/100 reload score improves the chance of finding the next load.`,
      10,
    );
  } else if (reloadScore < 40) {
    score -= 10;
    reasons.push("Weak reload market at destination.");
    addFactor(
      warnings,
      "Weak destination market",
      `A ${reloadScore}/100 reload score may mean more waiting or empty miles after delivery.`,
      -10,
    );
  } else {
    addFactor(
      neutral,
      "Average destination market",
      `The ${reloadScore}/100 reload score earns no market bonus or penalty.`,
      0,
    );
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let label = "Avoid";
  if (score >= 80) label = "Strong Load";
  else if (score >= 60) label = "Good Load";
  else if (score >= 40) label = "Caution";

  const recommendationLead = {
    "Strong Load": "The numbers support taking a closer look at this load.",
    "Good Load": "This load has a favorable overall balance, but confirm the details before booking.",
    Caution: "This load has meaningful tradeoffs; compare it or negotiate before committing.",
    Avoid: "The current numbers do not support this load unless the rate or conditions improve.",
  }[label];

  const recommendationReason = warnings.length
    ? `The main concern is ${warnings[0].title.toLowerCase()}.`
    : positives.length
      ? `Its strongest factor is ${positives[0].title.toLowerCase()}.`
      : "No factor currently creates a strong advantage.";

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
    explanation: {
      positives,
      warnings,
      neutral,
      recommendation: `${recommendationLead} ${recommendationReason}`,
    },
  };
}
