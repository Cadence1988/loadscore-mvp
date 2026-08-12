import { useState } from "react";
import {
  centralAnalyticsStatus,
  setCentralAnalyticsConsent,
} from "../analytics/productionAdapter";

export default function AnalyticsPreference() {
  const initial = centralAnalyticsStatus();
  const [enabled, setEnabled] = useState(initial.consentGranted);

  function update(value) {
    setCentralAnalyticsConsent(value);
    setEnabled(value);
  }

  return (
    <section className="analytics-preference" aria-labelledby="analytics-preference-title">
      <div>
        <p className="eyebrow">Privacy preference</p>
        <h2 id="analytics-preference-title">Anonymous Product Analytics</h2>
        <p>
          Help improve LoadScore by sharing anonymous feature-use events. Load routes, rates,
          broker messages, highlighted freight text, CSV contents, and personal details are not sent.
        </p>
      </div>
      <label className="analytics-toggle">
        <input type="checkbox" checked={enabled} onChange={(event) => update(event.target.checked)} />
        <span>{enabled ? "Optional analytics allowed" : "Optional analytics off"}</span>
      </label>
      <small>
        Essential local storage still works when this is off. {initial.configured
          ? "The configured PostHog project receives only allowlisted events when you opt in."
          : "Central analytics is not configured yet; this preference is saved for later."}
      </small>
    </section>
  );
}
