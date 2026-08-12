function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function destinations(value) {
  return String(value || "")
    .split(/[;\n]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function destinationMatches(destination, preferences) {
  const normalized = String(destination || "").trim().toLowerCase();
  return preferences.some((preference) => normalized.includes(preference));
}

function rule(key, label, passed, message, near = false) {
  return { key, label, passed, message, near };
}

export function evaluateAlertMatch(load, profile = {}) {
  const result = load.result || load;
  const missingFields = [];
  if (!String(load.origin || "").trim()) missingFields.push("origin");
  if (!String(load.destination || "").trim()) missingFields.push("destination");
  if (number(load.loadRate) <= 0) missingFields.push("offered rate");
  if (number(load.loadedMiles) <= 0) missingFields.push("loaded miles");
  if (load.deadheadMiles === "" || load.deadheadMiles === null || load.deadheadMiles === undefined) missingFields.push("deadhead or explicit confirmation of 0 miles");

  if (missingFields.length > 0) {
    return {
      status: "missing_data",
      matches: false,
      passedRules: [],
      failedRules: [],
      warnings: [],
      missingFields,
      explanation: `Missing data: ${missingFields.join(", ")} ${missingFields.length === 1 ? "is" : "are"} required before this load can be evaluated.`,
    };
  }

  const minimumLoadScore = number(profile.minimumLoadScore, 70);
  const minimumAllInRpm = number(
    profile.minimumAllInRpm ?? profile.targetAllInRpm,
    2.25,
  );
  const minimumEstimatedProfit = number(
    profile.minimumEstimatedProfit ?? profile.targetProfit,
    500,
  );
  const maximumDeadhead = number(profile.maximumDeadhead, 100);
  const minimumReloadScore = number(profile.minimumReloadScore, 50);
  const score = number(result.score);
  const allInRpm = number(result.allInRpm);
  const estimatedProfit = number(result.estimatedProfit);
  const deadhead = number(load.deadheadMiles);
  const reloadScore = number(result.reloadScore, 50);
  const preferred = destinations(profile.preferredDestinations);
  const avoided = destinations(profile.avoidedDestinations);

  const rules = [
    rule(
      "minimum_score",
      "Minimum LoadScore",
      score >= minimumLoadScore,
      `LoadScore ${score} is ${score >= minimumLoadScore ? "at or above" : "below"} your minimum of ${minimumLoadScore}.`,
      score >= minimumLoadScore - 5,
    ),
    rule(
      "minimum_rpm",
      "Minimum all-in RPM",
      allInRpm >= minimumAllInRpm,
      `All-in RPM $${allInRpm.toFixed(2)} is ${allInRpm >= minimumAllInRpm ? "at or above" : "below"} your $${minimumAllInRpm.toFixed(2)} target.`,
      allInRpm >= minimumAllInRpm - 0.15,
    ),
    rule(
      "minimum_profit",
      "Minimum estimated profit",
      estimatedProfit >= minimumEstimatedProfit,
      `Estimated profit $${Math.round(estimatedProfit).toLocaleString()} is ${estimatedProfit >= minimumEstimatedProfit ? "at or above" : "below"} your $${Math.round(minimumEstimatedProfit).toLocaleString()} target.`,
      estimatedProfit >= minimumEstimatedProfit - Math.max(100, minimumEstimatedProfit * 0.15),
    ),
    rule(
      "maximum_deadhead",
      "Maximum deadhead",
      deadhead <= maximumDeadhead,
      `Deadhead ${Math.round(deadhead)} miles is ${deadhead <= maximumDeadhead ? "within" : "above"} your ${Math.round(maximumDeadhead)}-mile limit.`,
      deadhead <= maximumDeadhead + 25,
    ),
    rule(
      "minimum_reload",
      "Minimum reload score",
      reloadScore >= minimumReloadScore,
      `Reload score ${reloadScore} is ${reloadScore >= minimumReloadScore ? "at or above" : "below"} your minimum of ${minimumReloadScore}.`,
      reloadScore >= minimumReloadScore - 10,
    ),
  ];

  if (preferred.length > 0) {
    const passed = destinationMatches(load.destination, preferred);
    rules.push(
      rule(
        "preferred_destination",
        "Preferred destination",
        passed,
        passed
          ? `${load.destination} matches your preferred destinations or regions.`
          : `${load.destination} is not in your preferred destinations or regions.`,
        true,
      ),
    );
  }

  if (avoided.length > 0) {
    const passed = !destinationMatches(load.destination, avoided);
    rules.push(
      rule(
        "avoided_destination",
        "Avoided destination",
        passed,
        passed
          ? `${load.destination} is not on your avoided list.`
          : `${load.destination} matches your avoided destinations or regions.`,
        false,
      ),
    );
  }

  const passedRules = rules.filter((item) => item.passed);
  const failedRules = rules.filter((item) => !item.passed);
  const warnings = [];
  if (load.reloadScoreSource === "default") {
    warnings.push("Destination uses the neutral default reload score of 50, not a curated or live market score.");
  }

  if (failedRules.length === 0) {
    return {
      status: "match",
      matches: true,
      passedRules,
      failedRules,
      warnings,
      missingFields,
      explanation: `Matches your alert rules: score ${score}, estimated profit $${Math.round(estimatedProfit).toLocaleString()}, all-in RPM $${allInRpm.toFixed(2)}, and ${Math.round(deadhead)} deadhead miles meet your saved targets.`,
    };
  }

  const nearMatch = failedRules.length === 1 && failedRules[0].near;
  const lead = nearMatch ? "Almost matches" : "Does not match";
  return {
    status: nearMatch ? "near_match" : "no_match",
    matches: false,
    passedRules,
    failedRules,
    warnings,
    missingFields,
    explanation: `${lead}: ${failedRules.slice(0, 2).map((item) => item.message).join(" ")}`,
  };
}
