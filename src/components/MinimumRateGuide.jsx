import { useEffect, useRef } from "react";
import { calculateMinimumRate } from "../logic/calculateMinimumRate";
import { moneyBand, trackEvent } from "../analytics/analytics";

function money(value) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function MinimumRateGuide({ form, targets, onTargetChange, meaningfulEvaluation = false, evaluationFingerprint = "" }) {
  const guidance = calculateMinimumRate({ ...form, ...targets });
  const lastTrackedRate = useRef(null);

  useEffect(() => {
    if (!meaningfulEvaluation || guidance.totalMiles <= 0 || evaluationFingerprint === lastTrackedRate.current) return;
    lastTrackedRate.current = evaluationFingerprint;
    trackEvent("minimum_rate_viewed", {
      surface: "web",
      minimum_rate_band: moneyBand(guidance.minimumRate),
      target_met: guidance.meetsTarget,
    });
  }, [evaluationFingerprint, guidance.meetsTarget, guidance.minimumRate, guidance.totalMiles, meaningfulEvaluation]);

  return (
    <section className="minimum-rate" aria-labelledby="minimum-rate-title">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Phase 5</p>
          <h3 id="minimum-rate-title">What would make this load worth it?</h3>
        </div>
        <span className={`target-status ${guidance.meetsTarget ? "met" : "short"}`}>
          {guidance.meetsTarget ? "Target met" : "Below target"}
        </span>
      </div>

      <div className="target-inputs">
        <label>
          Target All-In RPM
          <input
            type="number"
            min="0"
            step="0.05"
            value={targets.targetAllInRpm}
            onChange={(event) => onTargetChange("targetAllInRpm", event.target.value)}
          />
        </label>
        <label>
          Minimum Trip Profit
          <input
            type="number"
            min="0"
            step="50"
            value={targets.targetProfit}
            onChange={(event) => onTargetChange("targetProfit", event.target.value)}
          />
        </label>
      </div>

      <div className="rate-answer">
        <div>
          <span>Recommended minimum rate</span>
          <strong>{money(guidance.minimumRate)}</strong>
        </div>
        <div>
          <span>{guidance.askMore > 0 ? "Ask the broker for" : "Offer above target by"}</span>
          <strong>
            {guidance.askMore > 0
              ? `+${money(guidance.askMore)}`
              : money(Math.max(0, Number(form.loadRate) - guidance.minimumRate))}
          </strong>
        </div>
      </div>

      <p className="rate-explanation">
        Based on {guidance.totalMiles.toFixed(0)} total miles, estimated operating
        cost of {money(guidance.operatingCost)}, and your two targets. The higher
        requirement—{guidance.controllingTarget}—sets the minimum, rounded up to
        the next $25.
      </p>
    </section>
  );
}
