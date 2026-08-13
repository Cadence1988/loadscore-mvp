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
          Enabled by default to help improve the LoadScore beta. LoadScore sends limited
          feature-use events, such as when a load is calculated, compared, or shared.
          Raw routes, rates, broker details, highlighted freight text, CSV contents, and
          personal driver information are not sent.
        </p>
      </div>
      <label className="analytics-toggle">
        <input type="checkbox" checked={enabled} onChange={(event) => update(event.target.checked)} />
        <span>{enabled ? "Optional analytics allowed" : "Optional analytics off"}</span>
      </label>
      <small>
        Turn this off at any time. Essential local storage and the calculator still work.
        {initial.configured
          ? " PostHog receives only explicit allowlisted product events while this is on."
          : " Central analytics is not configured; this preference is saved locally."}
      </small>
    </section>
  );
}
