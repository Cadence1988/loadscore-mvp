export const VERIFIED_WEB_APP_URL = "https://loadscore-mvp.vercel.app/";
export const PRIVACY_POLICY_PATH = "/privacy.html";

export function extensionDistribution(storeUrl = "") {
  const value = String(storeUrl || "").trim();
  const official = /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)\//i.test(value);
  return {
    available: official,
    storeUrl: official ? value : "",
    label: official ? "Get the LoadScore Chrome Extension" : "Chrome extension beta — Store release coming soon",
  };
}

export const EXTENSION_DISTRIBUTION = extensionDistribution(import.meta.env?.VITE_CHROME_WEB_STORE_URL);
