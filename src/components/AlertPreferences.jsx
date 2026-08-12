import { validateNumericFields } from "../logic/inputValidation";

export default function AlertPreferences({ targets, onChange, modeName = "Preferred" }) {
  const errors = validateNumericFields(targets, ["minimumLoadScore", "targetAllInRpm", "targetProfit", "maximumDeadhead", "minimumReloadScore"]);
  return (
    <section className="alert-rules-section" aria-labelledby="alert-rules-title">
      <div className="alert-rules-heading">
        <div>
          <p className="eyebrow">{modeName} settings</p>
          <h2 id="alert-rules-title">{modeName} Mode Rules</h2>
          <p>
            These local rules evaluate only loads you manually enter, save, or
            select. They do not monitor load boards or find loads automatically.
          </p>
        </div>
        <span className="local-only">Stored on this device</span>
      </div>

      <div className="alert-rule-grid">
        <label>
          Minimum LoadScore
          <input
            type="number"
            min="0"
            max="100"
            value={targets.minimumLoadScore}
            onChange={(event) => onChange("minimumLoadScore", event.target.value)}
            aria-invalid={Boolean(errors.minimumLoadScore)}
          />
          {errors.minimumLoadScore && <small className="input-error">{errors.minimumLoadScore}</small>}
        </label>
        <label>
          Minimum All-In RPM
          <input
            type="number"
            min="0"
            step="0.05"
            value={targets.targetAllInRpm}
            onChange={(event) => onChange("targetAllInRpm", event.target.value)}
            aria-invalid={Boolean(errors.targetAllInRpm)}
          />
          {errors.targetAllInRpm && <small className="input-error">{errors.targetAllInRpm}</small>}
        </label>
        <label>
          Minimum Estimated Profit
          <input
            type="number"
            min="0"
            step="50"
            value={targets.targetProfit}
            onChange={(event) => onChange("targetProfit", event.target.value)}
            aria-invalid={Boolean(errors.targetProfit)}
          />
          {errors.targetProfit && <small className="input-error">{errors.targetProfit}</small>}
        </label>
        <label>
          Maximum Deadhead Miles
          <input
            type="number"
            min="0"
            step="10"
            value={targets.maximumDeadhead}
            onChange={(event) => onChange("maximumDeadhead", event.target.value)}
            aria-invalid={Boolean(errors.maximumDeadhead)}
          />
          {errors.maximumDeadhead && <small className="input-error">{errors.maximumDeadhead}</small>}
        </label>
        <label>
          Minimum Reload Score
          <input
            type="number"
            min="0"
            max="100"
            value={targets.minimumReloadScore}
            onChange={(event) => onChange("minimumReloadScore", event.target.value)}
            aria-invalid={Boolean(errors.minimumReloadScore)}
          />
          {errors.minimumReloadScore && <small className="input-error">{errors.minimumReloadScore}</small>}
        </label>
      </div>

      <div className="destination-rules">
        <label>
          Preferred Destinations or Regions <span className="optional">Optional</span>
          <input
            value={targets.preferredDestinations}
            onChange={(event) => onChange("preferredDestinations", event.target.value)}
            placeholder="Atlanta, GA; Southeast; TX"
          />
          <small>Separate multiple entries with semicolons.</small>
        </label>
        <label>
          Avoided Destinations or Regions <span className="optional">Optional</span>
          <input
            value={targets.avoidedDestinations}
            onChange={(event) => onChange("avoidedDestinations", event.target.value)}
            placeholder="Miami, FL; Denver, CO; Northeast"
          />
          <small>Any avoided destination prevents a match.</small>
        </label>
      </div>

      <p className="alert-disclosure">
        Alert matches are estimates based on saved preferences and user-provided
        loads. Reload estimates are not live market data, and unknown markets use
        a neutral reload score of 50.
      </p>
    </section>
  );
}
