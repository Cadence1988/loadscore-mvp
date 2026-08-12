// Configuration-ready only. Use a client-safe PostHog project token, never a personal/private API key.
// Add the exact configured host to manifest host_permissions only after Chrome disclosure review.
export const extensionAnalyticsConfig = {
  enabled: false,
  provider: "posthog",
  projectToken: "",
  host: "https://us.i.posthog.com",
  environment: "production",
};
