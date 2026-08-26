export const AUTH_CALLBACK_PATH = "/auth/callback";
export const ACCOUNT_PATH = "/account";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_RETURN_ROUTES = new Set(["/", ACCOUNT_PATH]);

export function readSupabaseConfig(environment = {}) {
  const url = String(environment.VITE_SUPABASE_URL || "").trim();
  const publishableKey = String(
    environment.VITE_SUPABASE_PUBLISHABLE_KEY
      || environment.VITE_SUPABASE_ANON_KEY
      || "",
  ).trim();

  if (!url || !publishableKey) {
    return {
      configured: false,
      url: "",
      publishableKey: "",
      issue: "missing_configuration",
    };
  }

  if (publishableKey.startsWith("sb_secret_")) {
    return {
      configured: false,
      url: "",
      publishableKey: "",
      issue: "secret_key_not_allowed",
    };
  }

  try {
    const parsed = new URL(url);
    const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !isLocal) throw new Error("Supabase URL must use HTTPS.");
  } catch {
    return {
      configured: false,
      url: "",
      publishableKey: "",
      issue: "invalid_project_url",
    };
  }

  return {
    configured: true,
    url,
    publishableKey,
    issue: "",
  };
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmail(value) {
  const normalized = normalizeEmail(value);
  return normalized.length <= 254 && EMAIL_PATTERN.test(normalized);
}

export function callbackUrlFor(locationLike = globalThis.location) {
  const origin = String(locationLike?.origin || "").replace(/\/$/, "");
  if (!origin) return AUTH_CALLBACK_PATH;
  return `${origin}${AUTH_CALLBACK_PATH}`;
}

export function safeInternalRoute(value, fallback = ACCOUNT_PATH) {
  try {
    const route = String(value || "").trim();
    if (!route.startsWith("/") || route.startsWith("//")) return fallback;
    const parsed = new URL(route, "https://loadscore.invalid");
    return SAFE_RETURN_ROUTES.has(parsed.pathname) ? parsed.pathname : fallback;
  } catch {
    return fallback;
  }
}

export function routeKind(pathname = "/") {
  const normalized = String(pathname || "/").replace(/\/+$/, "") || "/";
  if (normalized === AUTH_CALLBACK_PATH) return "auth_callback";
  if (normalized === ACCOUNT_PATH) return "account";
  return "calculator";
}
