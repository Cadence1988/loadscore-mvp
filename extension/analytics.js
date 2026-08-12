/* global chrome */
import { extensionAnalyticsConfig } from "./analyticsConfig.js";
const EVENTS_KEY = "loadScoreAnalyticsEvents";
const ID_KEY = "loadScoreAnalyticsId";
const USAGE_KEY = "loadScoreAnalyticsUsage";
const MAX_EVENTS = 200;
const CONSENT_KEY = "loadScoreCentralAnalyticsConsent";

const supportedEvents = new Set([
  "extension_opened", "load_calculated", "load_saved", "comparison_viewed",
  "comparison_load_removed", "profile_saved", "minimum_rate_viewed",
  "broker_message_copied", "highlight_parser_used", "highlight_parser_success",
  "highlight_parser_partial", "highlight_parser_failed", "alert_match",
  "alert_near_match", "alert_no_match", "alert_missing_data",
  "loadscore_result_copied", "loadscore_result_shared",
  "notifications_enabled", "notifications_disabled", "notification_created",
  "notification_opened", "notification_dismissed",
  "notification_suppressed_duplicate", "notification_suppressed_quiet_hours",
  "load_expired", "load_status_changed", "load_timing_added", "equipment_selected",
  "operating_mode_selected", "operating_mode_settings_updated",
  "preferred_mode_selected", "flexible_mode_selected", "recovery_mode_selected",
  "flexible_options_viewed", "recovery_options_viewed",
  "paste_import_opened", "paste_import_completed", "csv_import_opened",
  "csv_import_completed", "csv_import_failed", "import_rows_detected",
  "import_rows_valid", "import_rows_review", "import_rows_duplicate",
  "bulk_scoring_completed", "bulk_top7_viewed",
  "onboarding_started", "onboarding_completed", "onboarding_skipped",
  "sample_load_used", "provisional_evaluation_shown", "missing_deadhead_prompted",
  "deadhead_confirmed_zero", "deadhead_added", "import_review_corrected",
  "first_successful_calculation",
  "multiple_loads_calculated", "beta_source_recorded", "problem_reported",
  "parser_feedback_submitted", "diagnostic_copied", "feedback_form_submitted",
  "willing_to_pay_indicated",
  "problem_report_started", "problem_report_prepared",
  "extension_install_cta_viewed", "extension_install_cta_clicked", "extension_page_viewed", "open_full_loadscore_clicked",
]);

const allowedKeys = new Set([
  "surface", "usage_type", "repeat_day", "score_band", "reload_market_known",
  "reload_score_source", "deadhead_entered", "alert_status", "saved_load_count",
  "parser_result", "share_method", "minimum_rate_band", "target_met",
  "status", "equipment", "notification_reason", "suppression_reason",
  "mode", "match_type",
  "import_count", "import_source",
  "tester_source", "feature_area", "error_category", "willingness",
  "build_version", "extension_version", "environment", "evaluation_status", "source_category",
  "valid_count", "provisional_count", "duplicate_count",
]);

function sanitize(properties = {}) {
  return Object.fromEntries(Object.entries(properties).filter(([key, value]) =>
    allowedKeys.has(key) && ["string", "number", "boolean"].includes(typeof value) && (typeof value !== "string" || value.length <= 80),
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
    properties: sanitize({ ...properties, extension_version: "0.6.1", environment: "production" }),
  };
  await chrome.storage.local.set({
    [ID_KEY]: id,
    [EVENTS_KEY]: [...events, event].slice(-MAX_EVENTS),
  });
  const consent = await chrome.storage.local.get(CONSENT_KEY);
  if (consent[CONSENT_KEY] === true && extensionAnalyticsConfig.enabled && extensionAnalyticsConfig.provider === "posthog" && extensionAnalyticsConfig.projectToken) {
    void fetch(`${extensionAnalyticsConfig.host.replace(/\/$/, "")}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: extensionAnalyticsConfig.projectToken,
        event: event.event,
        timestamp: event.occurred_at,
        distinct_id: event.anonymous_id,
        properties: { ...event.properties, $process_person_profile: false },
      }),
    }).catch(() => undefined);
  }
  return true;
}

export async function getCentralAnalyticsConsent() {
  const stored = await chrome.storage.local.get(CONSENT_KEY);
  return stored[CONSENT_KEY] === true;
}

export async function setCentralAnalyticsConsent(enabled) {
  await chrome.storage.local.set({ [CONSENT_KEY]: Boolean(enabled) });
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
