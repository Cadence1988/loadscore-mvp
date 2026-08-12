import { evaluateAlertMatch } from "./evaluateAlertMatch.js";
export const MODE_ORDER = ["preferred", "flexible", "recovery"];
export const MODE_DEFINITIONS = {
  preferred: { name: "Preferred", description: "Strong fit with normal targets." },
  flexible: { name: "Flexible", description: "Editable relaxed requirements." },
  recovery: { name: "Recovery", description: "Editable repositioning rules; economics remain visible." },
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
    modes: Object.fromEntries(MODE_ORDER.map((id) => [id, { ...MODE_STARTER_DEFAULTS[id], ...(id === "preferred" ? preferredLegacy : {}), ...(stored.modes?.[id] || {}) }])),
  };
}
export function profileForMode(configuration, mode) { return { ...configuration.modes[mode], ...configuration.globalDestinations }; }
export function evaluateOperatingModes(load, configuration) {
  return Object.fromEntries(MODE_ORDER.map((mode) => [mode, { ...evaluateAlertMatch(load, profileForMode(configuration, mode)), mode, modeName: MODE_DEFINITIONS[mode].name }]));
}
export function activeModeEvaluation(load, configuration) {
  const evaluations = evaluateOperatingModes(load, configuration);
  const active = evaluations[configuration.activeMode];
  return { ...active, evaluations, label: `${active.modeName} ${active.matches ? "Match" : active.status === "near_match" ? "Almost Match" : active.status === "missing_data" ? "Missing Data" : "No Match"}` };
}
