import { sendApprovedEvent } from "./productionAdapter.js";

const ANALYTICS_ID_KEY = "loadscore-analytics-id";
const ANALYTICS_USAGE_KEY = "loadscore-analytics-usage";
const ANALYTICS_EVENTS_KEY = "loadscore-analytics-events";
const CALCULATION_COUNT_KEY = "loadscore-calculation-count";
const PERIODIC_PROMPT_KEY = "loadscore-periodic-feedback-prompt";
const MAX_LOCAL_EVENTS = 200;

export const ANALYTICS_PROVIDER = "local-foundation";

export const supportedEvents = new Set([
  "app_opened",
  "extension_opened",
  "load_calculated",
  "load_saved",
  "comparison_viewed",
  "comparison_load_removed",
  "comparison_cleared",
  "profile_saved",
  "profile_applied",
  "minimum_rate_viewed",
  "broker_message_copied",
  "highlight_parser_used",
  "highlight_parser_success",
  "highlight_parser_partial",
  "highlight_parser_failed",
  "alert_match",
  "alert_near_match",
  "alert_no_match",
  "alert_missing_data",
  "recommendation_feedback_positive",
  "recommendation_feedback_negative",
  "periodic_product_feedback_submitted",
  "loadscore_result_copied",
  "loadscore_result_shared",
  "notifications_enabled",
  "notifications_disabled",
  "notification_created",
  "notification_opened",
  "notification_dismissed",
  "notification_suppressed_duplicate",
  "notification_suppressed_quiet_hours",
  "load_expired",
  "load_status_changed",
  "load_timing_added",
  "equipment_selected",
]);

const allowedPropertyKeys = new Set([
  "surface",
  "usage_type",
  "repeat_day",
  "score_band",
  "reload_market_known",
  "reload_score_source",
  "deadhead_entered",
  "alert_status",
  "saved_load_count",
  "profile_count",
  "parser_result",
  "reason_code",
  "useful_feature",
  "share_method",
  "trigger",
  "minimum_rate_band",
  "target_met",
  "status",
  "equipment",
  "notification_reason",
  "suppression_reason",
]);

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseStored(storage, key, fallback) {
  try {
    const value = storage?.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function localDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function anonymousId(storage) {
  let id = storage?.getItem(ANALYTICS_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    storage?.setItem(ANALYTICS_ID_KEY, id);
  }
  return id;
}

export function sanitizeEventProperties(properties = {}) {
  return Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => {
      if (!allowedPropertyKeys.has(key)) return false;
      return ["string", "number", "boolean"].includes(typeof value);
    }),
  );
}

export function scoreBand(score) {
  const value = Number(score) || 0;
  if (value >= 80) return "strong";
  if (value >= 60) return "good";
  if (value >= 40) return "caution";
  return "avoid";
}

export function moneyBand(value) {
  const amount = Number(value) || 0;
  if (amount >= 3000) return "3000_plus";
  if (amount >= 2000) return "2000_2999";
  if (amount >= 1000) return "1000_1999";
  return "under_1000";
}

export function getUsageContext() {
  const storage = safeStorage();
  const today = localDay();
  const previous = parseStored(storage, ANALYTICS_USAGE_KEY, null);
  const firstSeenDay = previous?.firstSeenDay || today;
  const repeatDay = Boolean(previous?.lastSeenDay && previous.lastSeenDay !== today);
  const usageType = !previous
    ? "first_use"
    : repeatDay
      ? "repeat_day"
      : "return_use";

  storage?.setItem(
    ANALYTICS_USAGE_KEY,
    JSON.stringify({ firstSeenDay, lastSeenDay: today }),
  );

  return { usage_type: usageType, repeat_day: repeatDay };
}

export function trackEvent(eventName, properties = {}) {
  if (!supportedEvents.has(eventName)) return false;
  const storage = safeStorage();
  if (!storage) return false;
  const events = parseStored(storage, ANALYTICS_EVENTS_KEY, []);
  const event = {
    event: eventName,
    occurred_at: new Date().toISOString(),
    anonymous_id: anonymousId(storage),
    properties: sanitizeEventProperties(properties),
  };
  storage.setItem(
    ANALYTICS_EVENTS_KEY,
    JSON.stringify([...events, event].slice(-MAX_LOCAL_EVENTS)),
  );
  window.dispatchEvent(new CustomEvent("loadscore:analytics", { detail: event }));
  void sendApprovedEvent(event);
  return true;
}

export function initializeAnalytics(surface = "web") {
  const usage = getUsageContext();
  trackEvent(surface === "extension" ? "extension_opened" : "app_opened", {
    surface,
    ...usage,
  });
  return usage;
}

export function incrementCalculationCount() {
  const storage = safeStorage();
  const next = Number(storage?.getItem(CALCULATION_COUNT_KEY) || 0) + 1;
  storage?.setItem(CALCULATION_COUNT_KEY, String(next));
  return next;
}

export function getCalculationCount() {
  return Number(safeStorage()?.getItem(CALCULATION_COUNT_KEY) || 0);
}

export function shouldShowPeriodicFeedback(calculationCount) {
  if (calculationCount < 5) return false;
  const lastShown = Number(safeStorage()?.getItem(PERIODIC_PROMPT_KEY) || 0);
  return lastShown === 0 || calculationCount - lastShown >= 10;
}

export function markPeriodicFeedbackShown(calculationCount) {
  safeStorage()?.setItem(PERIODIC_PROMPT_KEY, String(calculationCount));
}

export function getLocalAnalyticsStatus() {
  const storage = safeStorage();
  return {
    provider: ANALYTICS_PROVIDER,
    eventCount: parseStored(storage, ANALYTICS_EVENTS_KEY, []).length,
    calculationCount: getCalculationCount(),
  };
}
