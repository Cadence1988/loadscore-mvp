import { useEffect, useState } from "react";
import { getLocalAnalyticsEvents } from "../analytics/analytics";
import { centralAnalyticsStatus } from "../analytics/productionAdapter";

export default function AnalyticsDebugPanel() {
  const [events, setEvents] = useState(() => getLocalAnalyticsEvents());
  const [status, setStatus] = useState(() => centralAnalyticsStatus());
  useEffect(() => {
    function refresh() { setEvents(getLocalAnalyticsEvents()); setStatus(centralAnalyticsStatus()); }
    window.addEventListener("loadscore:analytics", refresh);
    return () => window.removeEventListener("loadscore:analytics", refresh);
  }, []);
  if (!import.meta.env.DEV) return null;
  return <details className="analytics-debug"><summary>Development analytics inspector</summary><pre>{JSON.stringify({ provider: status.provider, configured: status.configured, consent: status.consentGranted, environment: status.environment, lastDelivery: status.lastDelivery, recentEvents: events }, null, 2)}</pre></details>;
}
