export const STRIPE_API_VERSION = "2026-08-26.dahlia";
export const DEFAULT_SITE_URL = "https://loadscoreapp.com";

export const PLAN_ENVIRONMENT_KEYS = Object.freeze({
  founding_driver_pro: "STRIPE_PRICE_FOUNDING_DRIVER_PRO_MONTHLY",
  driver_pro: "STRIPE_PRICE_DRIVER_PRO_MONTHLY",
});

export const ALLOWED_PLANS = Object.freeze(Object.keys(PLAN_ENVIRONMENT_KEYS));

function required(environment, name) {
  const value = String(environment[name] || "").trim();
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

export function readServerBillingConfig(environment = process.env) {
  const stripeSecretKey = required(environment, "STRIPE_SECRET_KEY");
  if (!stripeSecretKey.startsWith("sk_test_")) throw new Error("stripe_test_key_required");

  const siteUrl = String(environment.LOADSCORE_SITE_URL || DEFAULT_SITE_URL).trim().replace(/\/$/, "");
  if (siteUrl !== DEFAULT_SITE_URL && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(siteUrl)) {
    throw new Error("invalid_loadscore_site_url");
  }

  return {
    stripeSecretKey,
    webhookSecret: String(environment.STRIPE_WEBHOOK_SECRET || "").trim(),
    supabaseUrl: required(environment, "SUPABASE_URL"),
    supabaseSecretKey: required(environment, "SUPABASE_SECRET_KEY"),
    siteUrl,
    prices: Object.fromEntries(
      Object.entries(PLAN_ENVIRONMENT_KEYS).map(([plan, name]) => [plan, String(environment[name] || "").trim()]),
    ),
  };
}

export function priceForPlan(config, plan) {
  if (!ALLOWED_PLANS.includes(plan)) throw new Error("invalid_plan");
  const price = config.prices[plan];
  if (!price || !price.startsWith("price_")) throw new Error("plan_not_configured");
  return price;
}
