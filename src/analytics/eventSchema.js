export const SAFE_PROPERTY_KEYS = new Set([
  "surface", "build_version", "extension_version", "environment", "usage_type", "repeat_day",
  "evaluation_status", "source_category", "score_band", "reload_market_known", "reload_score_source",
  "deadhead_entered", "alert_status", "saved_load_count", "profile_count", "parser_result", "reason_code",
  "useful_feature", "share_method", "trigger", "minimum_rate_band", "target_met", "status", "equipment",
  "notification_reason", "suppression_reason", "mode", "match_type", "import_count", "valid_count",
  "provisional_count", "duplicate_count", "import_source", "tester_source", "feature_area", "error_category", "willingness",
]);

const COUNT_KEYS = new Set(["saved_load_count", "profile_count", "import_count", "valid_count", "provisional_count", "duplicate_count"]);

export function sanitizeAnalyticsProperties(properties = {}) {
  return Object.fromEntries(Object.entries(properties).flatMap(([key, value]) => {
    if (!SAFE_PROPERTY_KEYS.has(key) || !["string", "number", "boolean"].includes(typeof value)) return [];
    if (typeof value === "string" && value.length > 80) return [];
    if (COUNT_KEYS.has(key)) return [[key, Math.max(0, Math.min(250, Math.round(Number(value) || 0)))]];
    return [[key, value]];
  }));
}
