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
        <h2 id="analytics-preference-title">Optional product analytics</h2>
        <p>
          Help improve LoadScore by allowing privacy-safe product-use events. Raw load text,
          lanes, broker contacts, credentials, and personal details are excluded.
        </p>
      </div>
      <label className="analytics-toggle">
        <input type="checkbox" checked={enabled} onChange={(event) => update(event.target.checked)} />
        <span>{enabled ? "Optional analytics allowed" : "Optional analytics off"}</span>
      </label>
      <small>
        Essential local storage still keeps settings and local history working. A production
        destination is inactive until the founder configures one.
      </small>
    </section>
  );
}
