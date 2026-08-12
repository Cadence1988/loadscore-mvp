const CENTRAL_ANALYTICS_CONSENT_KEY = "loadscore-central-analytics-consent";

function configuration() {
  const environment = import.meta.env || {};
  return {
    endpoint: String(environment.VITE_ANALYTICS_ENDPOINT || "").trim(),
    siteId: String(environment.VITE_ANALYTICS_SITE_ID || "").trim(),
  };
}

export function hasCentralAnalyticsConsent() {
  try {
    return localStorage.getItem(CENTRAL_ANALYTICS_CONSENT_KEY) === "granted";
  } catch {
    return false;
  }
}

export function setCentralAnalyticsConsent(enabled) {
  try {
    localStorage.setItem(CENTRAL_ANALYTICS_CONSENT_KEY, enabled ? "granted" : "denied");
    return true;
  } catch {
    return false;
  }
}

export function centralAnalyticsStatus() {
  const config = configuration();
  return {
    configured: Boolean(config.endpoint && config.siteId),
    consentGranted: hasCentralAnalyticsConsent(),
  };
}

export async function sendApprovedEvent(event) {
  const config = configuration();
  if (!hasCentralAnalyticsConsent() || !config.endpoint || !config.siteId) {
    return { sent: false, reason: "not_enabled_or_configured" };
  }
  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site_id: config.siteId,
        event: event.event,
        occurred_at: event.occurred_at,
        anonymous_id: event.anonymous_id,
        properties: event.properties,
      }),
      keepalive: true,
    });
    return { sent: response.ok, reason: response.ok ? "sent" : "provider_rejected" };
  } catch {
    return { sent: false, reason: "network_failure" };
  }
}
