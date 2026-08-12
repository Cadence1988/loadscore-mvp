/* global chrome */
const EVENTS_KEY = "loadScoreAnalyticsEvents";
const ID_KEY = "loadScoreAnalyticsId";
const USAGE_KEY = "loadScoreAnalyticsUsage";
const MAX_EVENTS = 200;

const supportedEvents = new Set([
  "extension_opened", "load_calculated", "load_saved", "comparison_viewed",
  "comparison_load_removed", "profile_saved", "minimum_rate_viewed",
  "broker_message_copied", "highlight_parser_used", "highlight_parser_success",
  "highlight_parser_partial", "highlight_parser_failed", "alert_match",
  "alert_near_match", "alert_no_match", "alert_missing_data",
  "loadscore_result_copied", "loadscore_result_shared",
]);

const allowedKeys = new Set([
  "surface", "usage_type", "repeat_day", "score_band", "reload_market_known",
  "reload_score_source", "deadhead_entered", "alert_status", "saved_load_count",
  "parser_result", "share_method", "minimum_rate_band", "target_met",
]);

function sanitize(properties = {}) {
  return Object.fromEntries(Object.entries(properties).filter(([key, value]) =>
    allowedKeys.has(key) && ["string", "number", "boolean"].includes(typeof value),
  ));
}

function day() {
  return new Date().toISOString().slice(0, 10);
}

export function scoreBand(score) {
  const value = Number(score) || 0;
  return value >= 80 ? "strong" : value >= 60 ? "good" : value >= 40 ? "caution" : "avoid";
}

export async function trackEvent(eventName, properties = {}) {
  if (!supportedEvents.has(eventName)) return false;
  const stored = await chrome.storage.local.get([EVENTS_KEY, ID_KEY]);
  const id = stored[ID_KEY] || crypto.randomUUID();
  const events = Array.isArray(stored[EVENTS_KEY]) ? stored[EVENTS_KEY] : [];
  const event = {
    event: eventName,
    occurred_at: new Date().toISOString(),
    anonymous_id: id,
    properties: sanitize(properties),
  };
  await chrome.storage.local.set({
    [ID_KEY]: id,
    [EVENTS_KEY]: [...events, event].slice(-MAX_EVENTS),
  });
  return true;
}

export async function initializeExtensionAnalytics() {
  const stored = await chrome.storage.local.get(USAGE_KEY);
  const today = day();
  const previous = stored[USAGE_KEY];
  const repeatDay = Boolean(previous?.lastSeenDay && previous.lastSeenDay !== today);
  const usageType = !previous ? "first_use" : repeatDay ? "repeat_day" : "return_use";
  await chrome.storage.local.set({
    [USAGE_KEY]: { firstSeenDay: previous?.firstSeenDay || today, lastSeenDay: today },
  });
  await trackEvent("extension_opened", {
    surface: "extension",
    usage_type: usageType,
    repeat_day: repeatDay,
  });
}
