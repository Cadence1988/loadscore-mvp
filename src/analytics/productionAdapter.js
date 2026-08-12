import { sanitizeAnalyticsProperties } from "./eventSchema.js";

const CONSENT_KEY = "loadscore-central-analytics-consent";
const DEBUG_STATUS_KEY = "loadscore-analytics-delivery-status";
export const CENTRAL_EVENT_NAMES = new Set([
  "app_opened", "extension_opened", "load_calculated", "first_successful_calculation", "multiple_loads_calculated",
  "load_saved", "comparison_viewed", "comparison_load_removed", "comparison_cleared", "profile_saved", "profile_applied",
  "minimum_rate_viewed", "broker_message_copied", "highlight_parser_used", "highlight_parser_success", "highlight_parser_partial", "highlight_parser_failed",
  "operating_mode_selected", "operating_mode_settings_updated", "preferred_mode_selected", "flexible_mode_selected", "recovery_mode_selected",
  "alert_match", "alert_near_match", "alert_no_match", "alert_missing_data", "recommendation_feedback_positive", "recommendation_feedback_negative",
  "problem_report_started", "problem_report_prepared", "problem_reported", "loadscore_result_copied", "loadscore_result_shared",
  "paste_import_opened", "paste_import_completed", "csv_import_opened", "csv_import_completed", "csv_import_failed", "import_rows_detected", "import_rows_valid", "import_rows_review", "import_rows_duplicate", "bulk_scoring_completed", "bulk_top7_viewed",
  "onboarding_started", "onboarding_completed", "onboarding_skipped", "sample_load_used", "provisional_evaluation_shown", "missing_deadhead_prompted", "deadhead_confirmed_zero", "deadhead_added",
  "extension_install_cta_viewed", "extension_install_cta_clicked", "extension_page_viewed", "open_full_loadscore_clicked", "feedback_form_submitted", "willing_to_pay_indicated", "beta_source_recorded", "parser_feedback_submitted",
]);

function safeStorage() { try { return localStorage; } catch { return null; } }
function environmentConfiguration() {
  const env = import.meta.env || {};
  return {
    enabled: String(env.VITE_ANALYTICS_ENABLED || "").toLowerCase() === "true",
    provider: String(env.VITE_ANALYTICS_PROVIDER || "posthog").toLowerCase(),
    projectToken: String(env.VITE_POSTHOG_PROJECT_TOKEN || "").trim(),
    host: String(env.VITE_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, ""),
    environment: String(env.VITE_ANALYTICS_ENVIRONMENT || (env.PROD ? "production" : "development")),
  };
}

export function hasCentralAnalyticsConsent(storage = safeStorage()) { return storage?.getItem(CONSENT_KEY) === "granted"; }
export function setCentralAnalyticsConsent(enabled, storage = safeStorage()) { try { storage?.setItem(CONSENT_KEY, enabled ? "granted" : "denied"); return true; } catch { return false; } }
export function validatedProviderConfig(config = environmentConfiguration()) {
  const validHost = /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(config.host || "");
  return { ...config, configured: Boolean(config.enabled && config.provider === "posthog" && config.projectToken && validHost) };
}
export function centralAnalyticsStatus(storage = safeStorage(), config = environmentConfiguration()) {
  const checked = validatedProviderConfig(config);
  const lastDelivery = (() => { try { return JSON.parse(storage?.getItem(DEBUG_STATUS_KEY) || "null"); } catch { return null; } })();
  return { provider: checked.provider, configured: checked.configured, consentGranted: hasCentralAnalyticsConsent(storage), environment: checked.environment, lastDelivery };
}
export function createPostHogPayload(event, config = environmentConfiguration()) {
  return {
    api_key: config.projectToken,
    event: event.event,
    distinct_id: event.anonymous_id,
    timestamp: event.occurred_at,
    properties: { ...sanitizeAnalyticsProperties(event.properties), $process_person_profile: false },
  };
}
function recordDelivery(storage, event, result) { try { storage?.setItem(DEBUG_STATUS_KEY, JSON.stringify({ event: event.event, ...result, checked_at: new Date().toISOString() })); } catch { /* diagnostics never block product use */ } }
export async function sendApprovedEvent(event, options = {}) {
  const storage = options.storage ?? safeStorage();
  const config = validatedProviderConfig(options.config || environmentConfiguration());
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  let result;
  if (!CENTRAL_EVENT_NAMES.has(event?.event)) result = { sent: false, reason: "event_not_allowlisted" };
  else if (!hasCentralAnalyticsConsent(storage)) result = { sent: false, reason: "consent_not_granted" };
  else if (!config.configured) result = { sent: false, reason: "provider_not_configured" };
  else if (config.environment !== "production") result = { sent: false, reason: "non_production_suppressed" };
  else {
    try {
      const response = await fetchImpl(`${config.host}/i/v0/e/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(createPostHogPayload(event, config)), keepalive: true });
      result = { sent: Boolean(response.ok), reason: response.ok ? "sent" : "provider_rejected" };
    } catch { result = { sent: false, reason: "network_failure" }; }
  }
  recordDelivery(storage, event, result);
  return result;
}
