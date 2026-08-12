import { evaluateAlertMatch } from "./evaluateAlertMatch.js";

export const MODE_ORDER = ["preferred", "flexible", "recovery"];
export const MODE_DEFINITIONS = {
  preferred: { name: "Preferred", description: "Strong fit with your normal targets." },
  flexible: { name: "Flexible", description: "Relax some requirements to keep moving." },
  recovery: { name: "Recovery", description: "Consider weaker repositioning opportunities without hiding poor economics." },
};

export const MODE_STARTER_DEFAULTS = {
  preferred: { minimumLoadScore: 70, targetAllInRpm: 2.25, targetProfit: 500, maximumDeadhead: 100, minimumReloadScore: 50 },
  flexible: { minimumLoadScore: 60, targetAllInRpm: 2.0, targetProfit: 300, maximumDeadhead: 150, minimumReloadScore: 45 },
  recovery: { minimumLoadScore: 45, targetAllInRpm: 1.75, targetProfit: 100, maximumDeadhead: 200, minimumReloadScore: 50 },
};

export function migrateOperatingModes(legacy = {}, stored = {}) {
  const globalDestinations = {
    preferredDestinations: legacy.preferredDestinations ?? stored.globalDestinations?.preferredDestinations ?? "",
    avoidedDestinations: legacy.avoidedDestinations ?? stored.globalDestinations?.avoidedDestinations ?? "",
  };
  const preferredLegacy = Object.fromEntries(Object.entries(legacy).filter(([key]) => !key.includes("Destinations")));
  return {
    activeMode: MODE_ORDER.includes(stored.activeMode) ? stored.activeMode : "preferred",
    globalDestinations,
    modes: Object.fromEntries(MODE_ORDER.map((id) => [id, {
      ...MODE_STARTER_DEFAULTS[id],
      ...(id === "preferred" ? preferredLegacy : {}),
      ...(stored.modes?.[id] || {}),
    }])),
  };
}

export function profileForMode(configuration, modeId) {
  return { ...(configuration.modes?.[modeId] || MODE_STARTER_DEFAULTS[modeId]), ...configuration.globalDestinations };
}

export function evaluateOperatingModes(load, configuration) {
  return Object.fromEntries(MODE_ORDER.map((modeId) => {
    const evaluation = evaluateAlertMatch(load, profileForMode(configuration, modeId));
    return [modeId, { ...evaluation, mode: modeId, modeName: MODE_DEFINITIONS[modeId].name }];
  }));
}

export function activeModeEvaluation(load, configuration) {
  const evaluations = evaluateOperatingModes(load, configuration);
  const activeMode = MODE_ORDER.includes(configuration.activeMode) ? configuration.activeMode : "preferred";
  const active = evaluations[activeMode];
  const preferred = evaluations.preferred;
  return {
    ...active,
    evaluations,
    label: `${MODE_DEFINITIONS[activeMode].name} ${active.status === "match" ? "Match" : active.status === "near_match" ? "Almost Match" : active.status === "missing_data" ? "Missing Data" : "No Match"}`,
    preferredComparison: activeMode !== "preferred" && active.matches && !preferred.matches
      ? `This load meets your ${MODE_DEFINITIONS[activeMode].name} rules but not your Preferred rules.`
      : "",
  };
}
