import { EXTENSION_BUILD_VERSION, WEB_BUILD_VERSION } from "../config/version.js";

export const TESTER_SOURCES = ["", "direct_founder", "facebook", "instagram", "tiktok", "youtube", "reddit", "driver_referral", "dispatcher_referral", "other"];
export const PROBLEM_CATEGORIES = ["score", "profit_rpm", "deadhead", "reload_score", "parser", "csv_import", "operating_mode", "extension", "sharing", "other"];
export const PARSER_FIELDS = ["origin", "destination", "rate", "loaded_miles", "deadhead", "pickup_delivery", "equipment", "reference"];
export const BETA_REPORTS_KEY = "loadscore-beta-reports";
export const TESTER_SOURCE_KEY = "loadscore-tester-source";
export const MAX_BETA_REPORTS = 50;

export function allowlistedTesterSource(value) { return TESTER_SOURCES.includes(value) ? value : ""; }
export function sourceFromUrl(url) {
  try { const parsed = new URL(url); return allowlistedTesterSource(parsed.searchParams.get("source") || parsed.searchParams.get("ref") || ""); }
  catch { return ""; }
}
export function browserCategory(userAgent = "") {
  const value = String(userAgent).toLowerCase();
  if (value.includes("edg/")) return "edge";
  if (value.includes("firefox/")) return "firefox";
  if (value.includes("chrome/") || value.includes("crios/")) return "chrome";
  if (value.includes("safari/") && !value.includes("chrome/")) return "safari";
  return "other";
}
export function buildDiagnostic({ installationId, mode, feature, category, parserSource = "", parserOutcome = "", parserFields = [], userAgent = "", timestamp = new Date().toISOString() }) {
  return {
    product: "LoadScore Beta",
    web_build: WEB_BUILD_VERSION,
    extension_build: EXTENSION_BUILD_VERSION,
    environment: "web",
    browser_category: browserCategory(userAgent),
    installation_id: installationId,
    operating_mode: ["preferred", "flexible", "recovery"].includes(mode) ? mode : "unknown",
    feature: String(feature || "general").slice(0, 40),
    error_category: PROBLEM_CATEGORIES.includes(category) ? category : "other",
    parser_source: ["", "highlighted_text", "pasted_text", "csv"].includes(parserSource) ? parserSource : "",
    parser_outcome: ["", "success", "partial", "failure"].includes(parserOutcome) ? parserOutcome : "",
    parser_field_status: parserFields.filter((field) => PARSER_FIELDS.includes(field)),
    timestamp,
    excludes: "raw freight text, routes, rates, broker contacts, credentials, cookies, and personal details",
  };
}
export function diagnosticText(bundle) { return Object.entries(bundle).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`).join("\n"); }
export function saveLocalBetaReport(storage, report) {
  const previous = (() => {
    try { return JSON.parse(storage?.getItem(BETA_REPORTS_KEY) || "[]"); }
    catch { return []; }
  })();
  const safe = {
    id: crypto.randomUUID(), createdAt: new Date().toISOString(),
    category: PROBLEM_CATEGORIES.includes(report.category) ? report.category : "other",
    feature: String(report.feature || "general").slice(0, 40),
    explanation: String(report.explanation || "").slice(0, 2000),
    parserSource: ["", "highlighted_text", "pasted_text", "csv"].includes(report.parserSource) ? report.parserSource : "",
    parserOutcome: ["", "success", "partial", "failure"].includes(report.parserOutcome) ? report.parserOutcome : "",
    parserFields: (report.parserFields || []).filter((field) => PARSER_FIELDS.includes(field)),
  };
  storage?.setItem(BETA_REPORTS_KEY, JSON.stringify([safe, ...previous].slice(0, MAX_BETA_REPORTS)));
  return safe;
}
