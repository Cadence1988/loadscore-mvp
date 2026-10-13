import { withResolvedMileage } from "./mileageSource.js";

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const DUAL_SCORE_STATES = Object.freeze({
  INCOMPLETE: "incomplete",
  PRELIMINARY: "preliminary",
  COMPLETE: "complete",
  LIMITED_DATA: "limited_data",
});

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasKnownDeadhead(input = {}) {
  if (input.deadheadConfirmed === true) return true;
  return input.deadheadMiles !== "" && input.deadheadMiles !== null && input.deadheadMiles !== undefined && Number.isFinite(Number(input.deadheadMiles));
}

function bandForScore(score) {
  if (score === null || score === undefined) return "limited";
  if (score >= 80) return "high";
  if (score >= 60) return "good";
  if (score >= 40) return "caution";
  return "weak";
}

function labelForNearSight(score, status) {
  if (status === DUAL_SCORE_STATES.INCOMPLETE) return "Waiting for load economics";
  if (score >= 80) return "Strong immediate economics";
  if (score >= 60) return "Solid immediate economics";
  if (score >= 40) return "Mixed immediate economics";
  return "Weak immediate economics";
}

function labelForForeSight(score, status) {
  if (status === DUAL_SCORE_STATES.INCOMPLETE) return "Waiting for destination";
  if (status === DUAL_SCORE_STATES.LIMITED_DATA) return "Limited market data";
  if (score >= 75) return "Strong reload positioning";
  if (score >= 60) return "Solid reload positioning";
  if (score >= 40) return "Mixed reload positioning";
  return "Weak reload positioning";
}

function addFactor(collection, title, detail, impact = 0) {
  collection.push({ title, detail, impact });
}

export function calculateNearSightScore(input = {}) {
  input = withResolvedMileage(input);
  const loadRate = number(input.loadRate);
  const loadedMiles = number(input.loadedMiles);
  const deadheadKnown = hasKnownDeadhead(input);

  if (!(loadRate > 0) || !(loadedMiles > 0)) {
    const waitingFor = !(loadRate > 0) && !(loadedMiles > 0)
      ? "Waiting for load economics"
      : !(loadRate > 0)
        ? "Waiting for rate"
        : "Waiting for mileage";
    return {
      score: null,
      status: DUAL_SCORE_STATES.INCOMPLETE,
      band: "limited",
      label: waitingFor,
      summary: "Add rate and loaded miles to start NearSight.",
      explanation: {
        positives: [],
        warnings: [],
        neutral: [{ title: "Economic inputs missing", detail: "NearSight needs at least offered rate and loaded miles before it can show an immediate-economics score.", impact: 0 }],
      },
    };
  }

  const deadheadMiles = deadheadKnown ? number(input.deadheadMiles) : 0;
  const mpg = number(input.mpg, 6.5) || 6.5;
  const fuelPrice = number(input.fuelPrice, 4);
  const fixedCostPerMile = number(input.fixedCostPerMile, 0.65);
  const totalMiles = loadedMiles + deadheadMiles;
  const allInRpm = totalMiles > 0 ? loadRate / totalMiles : 0;
  const fuelGallons = totalMiles > 0 && mpg > 0 ? totalMiles / mpg : 0;
  const fuelCost = fuelGallons * fuelPrice;
  const fixedCost = totalMiles * fixedCostPerMile;
  const estimatedProfit = loadRate - fuelCost - fixedCost;
  const profitPerMile = totalMiles > 0 ? estimatedProfit / totalMiles : 0;
  const positives = [];
  const warnings = [];
  const neutral = [];
  let impactTotal = 0;

  if (allInRpm >= 2.5) {
    impactTotal += 20;
    addFactor(positives, "Strong all-in RPM", `$${allInRpm.toFixed(2)} per total mile is at or above the existing $2.50 strong threshold.`, 20);
  } else if (allInRpm >= 2.0) {
    impactTotal += 10;
    addFactor(positives, "Solid all-in RPM", `$${allInRpm.toFixed(2)} per total mile clears the existing $2.00 threshold.`, 10);
  } else if (allInRpm < 1.75) {
    impactTotal -= 15;
    addFactor(warnings, "Low all-in RPM", `$${allInRpm.toFixed(2)} per total mile is below the existing $1.75 warning threshold.`, -15);
  } else {
    addFactor(neutral, "Mid-range all-in RPM", `$${allInRpm.toFixed(2)} per total mile is between the low-rate warning and solid-rate bonus.`, 0);
  }

  if (profitPerMile >= 1.0) {
    impactTotal += 10;
    addFactor(positives, "Healthy profit per mile", `$${profitPerMile.toFixed(2)} estimated profit per total mile earns the existing profit bonus.`, 10);
  } else {
    addFactor(neutral, "No profit-per-mile bonus", `$${profitPerMile.toFixed(2)} estimated profit per total mile is below the existing $1.00 bonus threshold.`, 0);
  }

  if (!deadheadKnown) {
    addFactor(neutral, "Deadhead still needed", "NearSight is preliminary until deadhead is entered or confirmed as 0 miles.", 0);
  } else if (deadheadMiles <= 50) {
    impactTotal += 10;
    addFactor(positives, "Low deadhead", `${deadheadMiles.toFixed(0)} empty miles stays within the existing 50-mile target.`, 10);
  } else if (deadheadMiles > 150) {
    impactTotal -= 15;
    addFactor(warnings, "High deadhead", `${deadheadMiles.toFixed(0)} empty miles exceeds the existing 150-mile warning threshold.`, -15);
  } else {
    addFactor(neutral, "Moderate deadhead", `${deadheadMiles.toFixed(0)} empty miles earns no existing bonus or penalty.`, 0);
  }

  if (estimatedProfit < 300) {
    impactTotal -= 10;
    addFactor(warnings, "Low estimated profit", `${estimatedProfit.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })} is below the existing $300 threshold.`, -10);
  }

  const score = clampScore(((impactTotal + 40) / 80) * 100);
  const status = deadheadKnown ? DUAL_SCORE_STATES.COMPLETE : DUAL_SCORE_STATES.PRELIMINARY;

  return {
    score,
    status,
    band: bandForScore(score),
    label: labelForNearSight(score, status),
    summary: status === DUAL_SCORE_STATES.PRELIMINARY
      ? `Preliminary economics. Add deadhead for a more complete view.`
      : labelForNearSight(score, status),
    source: "Existing LoadScore immediate-economics thresholds normalized from -40 to +40 impact.",
    metrics: { totalMiles, allInRpm, fuelCost, fixedCost, estimatedProfit, profitPerMile },
    explanation: { positives, warnings, neutral },
  };
}

export function calculateForeSightScore({ destination = "", curatedReloadScore = null } = {}) {
  if (!String(destination || "").trim()) {
    return {
      score: null,
      status: DUAL_SCORE_STATES.INCOMPLETE,
      band: "limited",
      label: "Waiting for destination",
      summary: "Add a destination to check existing curated reload data.",
      explanation: {
        positives: [],
        warnings: [],
        neutral: [{ title: "Destination missing", detail: "ForeSight needs a destination before checking curated market intelligence.", impact: 0 }],
      },
    };
  }

  if (curatedReloadScore === null || curatedReloadScore === undefined || curatedReloadScore === "" || !Number.isFinite(Number(curatedReloadScore))) {
    return {
      score: null,
      status: DUAL_SCORE_STATES.LIMITED_DATA,
      band: "limited",
      label: "Limited market data",
      summary: "We don’t have enough curated market data for this destination yet.",
      explanation: {
        positives: [],
        warnings: [],
        neutral: [{ title: "No curated market score", detail: "ForeSight does not invent a destination score. This market needs research before LoadScore can show a positioning score.", impact: 0 }],
      },
    };
  }

  const score = clampScore(Number(curatedReloadScore));
  const positives = [];
  const warnings = [];
  const neutral = [];

  if (score >= 75) {
    addFactor(positives, "Strong curated reload signal", `Current LoadScore market data has this destination at ${score}/100.`, 0);
  } else if (score < 40) {
    addFactor(warnings, "Weak curated reload signal", `Current LoadScore market data has this destination at ${score}/100. Consider whether immediate economics justify the positioning tradeoff.`, 0);
  } else {
    addFactor(neutral, "Moderate curated reload signal", `Current LoadScore market data has this destination at ${score}/100.`, 0);
  }

  return {
    score,
    status: DUAL_SCORE_STATES.COMPLETE,
    band: bandForScore(score),
    label: labelForForeSight(score, DUAL_SCORE_STATES.COMPLETE),
    summary: "Destination outlook available.",
    source: "Existing curated destination Reload Score. Not live market data.",
    explanation: { positives, warnings, neutral },
  };
}

export function tradeoffSummary(nearSight, foreSight) {
  const nearBand = nearSight.band;
  const foreBand = foreSight.band;

  if (nearSight.status === DUAL_SCORE_STATES.INCOMPLETE) return "Add load economics before comparing the immediate and next-position views.";
  if (foreSight.status === DUAL_SCORE_STATES.INCOMPLETE) return "NearSight can update before destination positioning is available.";
  if (foreSight.status === DUAL_SCORE_STATES.LIMITED_DATA) return "Immediate economics are visible, but destination positioning has limited curated data.";
  if (nearBand === "high" && ["weak", "caution"].includes(foreBand)) return "Pays well now. Weaker next-position outlook.";
  if (["weak", "caution"].includes(nearBand) && foreBand === "high") return "Moderate immediate economics. Stronger next-position outlook.";
  if (nearBand === "high" && foreBand === "high") return "Strong immediate economics and positioning.";
  if (nearBand === "weak" && foreBand === "weak") return "Weak immediate economics and positioning.";
  return "Review both immediate economics and next-position outlook before deciding.";
}

export function calculateDualScore(input = {}) {
  const nearSight = calculateNearSightScore(input);
  const foreSight = calculateForeSightScore({
    destination: input.destination,
    curatedReloadScore: input.curatedReloadScore,
  });

  return {
    nearSight,
    foreSight,
    tradeoff: tradeoffSummary(nearSight, foreSight),
  };
}

export function calculateStoredLoadDualScore(load = {}, curatedMarketLookup = () => null) {
  const resolvedLoad = withResolvedMileage(load);
  const destination = String(resolvedLoad.destination || "").trim();
  return calculateDualScore({
    ...resolvedLoad,
    destination,
    curatedReloadScore: destination ? curatedMarketLookup(destination) : null,
  });
}

