import { evaluateAlertMatch } from "../logic/evaluateAlertMatch";

function money(value) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

const statusLabels = {
  match: "Matches alert",
  near_match: "Almost matches",
  no_match: "Does not match",
  missing_data: "Missing data",
};

export default function ComparisonBoard({ loads, onRemove, onClear, alertProfile }) {
  const rankedLoads = [...loads].sort(
    (a, b) =>
      b.result.score - a.result.score ||
      b.result.estimatedProfit - a.result.estimatedProfit ||
      b.result.allInRpm - a.result.allInRpm,
  );
  const evaluatedLoads = rankedLoads.map((load) => ({
    ...load,
    alertMatch: evaluateAlertMatch(load, alertProfile),
  }));
  const matchedCount = evaluatedLoads.filter((load) => load.alertMatch.matches).length;

  return (
    <section className="comparison-section" aria-labelledby="comparison-title">
      <div className="comparison-header">
        <div>
          <p className="eyebrow">Phase 4</p>
          <h2 id="comparison-title">Compare Loads</h2>
          <p>
            Save up to seven offers. Loads rank by score, estimated profit, then
            all-in RPM. Alert rules add another decision layer without changing
            that ranking.
          </p>
        </div>
        <div className="comparison-actions">
          {loads.length > 0 && (
            <span className="match-count">{matchedCount} matched saved load{matchedCount === 1 ? "" : "s"}</span>
          )}
          {loads.length > 0 && (
            <button className="text-button" type="button" onClick={onClear}>
              Clear all
            </button>
          )}
        </div>
      </div>

      {rankedLoads.length === 0 ? (
        <div className="comparison-empty">
          <strong>No saved loads yet.</strong>
          <span>Use “Save to Compare” above, change the load details, and save again.</span>
        </div>
      ) : (
        <div className="comparison-table-wrap">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Load</th>
                <th>Score</th>
                <th>All-In RPM</th>
                <th>Est. Profit</th>
                <th>Reload</th>
                <th>Alert Match</th>
                <th aria-label="Remove load" />
              </tr>
            </thead>
            <tbody>
              {evaluatedLoads.map((load, index) => (
                <tr key={load.id} className={index === 0 ? "winner" : ""}>
                  <td>
                    <span className="rank">#{index + 1}</span>
                    {index === 0 && <small>Best fit</small>}
                  </td>
                  <td>
                    <strong>{load.origin} → {load.destination}</strong>
                    <span>{money(Number(load.loadRate) || 0)} offer</span>
                  </td>
                  <td>
                    <strong>{load.result.score}</strong>
                    <span>{load.result.label}</span>
                  </td>
                  <td>${load.result.allInRpm.toFixed(2)}</td>
                  <td>{money(load.result.estimatedProfit)}</td>
                  <td>{load.result.reloadScore}/100</td>
                  <td className="alert-match-cell">
                    <span className={`alert-status ${load.alertMatch.status}`}>
                      {statusLabels[load.alertMatch.status]}
                    </span>
                    <small>{load.alertMatch.explanation}</small>
                    {load.alertMatch.warnings.map((warning) => (
                      <small className="alert-warning" key={warning}>{warning}</small>
                    ))}
                  </td>
                  <td>
                    <button
                      className="remove-button"
                      type="button"
                      onClick={() => onRemove(load.id)}
                      aria-label={`Remove ${load.origin} to ${load.destination}`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
