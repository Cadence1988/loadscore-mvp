import { useMemo, useState } from "react";
import "./styles.css";
import { marketScores } from "./data/marketScores";
import { calculateLoadScore } from "./logic/calculateLoadScore";
import AutocompleteInput from "./components/AutocompleteInput";
import FeedbackForm from "./components/FeedbackForm";

const defaultForm = {
  origin: "Dallas, TX",
  destination: "Atlanta, GA",
  loadRate: 1800,
  loadedMiles: 780,
  deadheadMiles: 35,
  mpg: 6.5,
  fuelPrice: 4.0,
  fixedCostPerMile: 0.65,
  manualReloadScore: ""
};

function money(value) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

function decimal(value) {
  return Number(value || 0).toFixed(2);
}

export default function App() {
  const [form, setForm] = useState(defaultForm);

  const detectedReloadScore = marketScores[form.destination] ?? null;

  const reloadScore =
    form.manualReloadScore !== ""
      ? Number(form.manualReloadScore)
      : detectedReloadScore ?? 50;

  const result = useMemo(() => {
    return calculateLoadScore({
      ...form,
      reloadScore
    });
  }, [form, reloadScore]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">LoadScore MVP</p>
          <h1>Know if a load is worth it in seconds.</h1>
          <p className="subhead">
            Calculate real profit, factor in deadhead, and check reload market
            strength before you commit.
          </p>
        </div>
      </section>

      <section className="app-grid">
        <form className="card form-card">
          <h2>Load Details</h2>

          <label>
            Origin
            <AutocompleteInput
              value={form.origin}
              onChange={(val) => updateField("origin", val)}
              placeholder="Dallas, TX"
            />
          </label>

          <label>
            Destination
            <AutocompleteInput
              value={form.destination}
              onChange={(val) => updateField("destination", val)}
              placeholder="Atlanta, GA"
            />
          </label>

          <div className="two-col">
            <label>
              Load Rate ($)
              <input
                type="number"
                value={form.loadRate}
                onChange={(e) => updateField("loadRate", e.target.value)}
              />
            </label>

            <label>
              Loaded Miles
              <input
                type="number"
                value={form.loadedMiles}
                onChange={(e) => updateField("loadedMiles", e.target.value)}
              />
            </label>
          </div>

          <div className="two-col">
            <label>
              Deadhead Miles
              <input
                type="number"
                value={form.deadheadMiles}
                onChange={(e) => updateField("deadheadMiles", e.target.value)}
              />
            </label>

            <label>
              Fuel MPG
              <input
                type="number"
                step="0.1"
                value={form.mpg}
                onChange={(e) => updateField("mpg", e.target.value)}
              />
            </label>
          </div>

          <div className="two-col">
            <label>
              Fuel Price/Gal
              <input
                type="number"
                step="0.01"
                value={form.fuelPrice}
                onChange={(e) => updateField("fuelPrice", e.target.value)}
              />
            </label>

            <label>
              Fixed Cost/Mile
              <input
                type="number"
                step="0.01"
                value={form.fixedCostPerMile}
                onChange={(e) =>
                  updateField("fixedCostPerMile", e.target.value)
                }
              />
            </label>
          </div>

          <label>
            Manual Reload Score Optional
            <input
              type="number"
              min="0"
              max="100"
              value={form.manualReloadScore}
              onChange={(e) =>
                updateField("manualReloadScore", e.target.value)
              }
              placeholder={
                detectedReloadScore
                  ? `Auto: ${detectedReloadScore}`
                  : "Default: 50"
              }
            />
          </label>

          <p className="helper">
            Reload Score estimates how strong the destination is for finding the
            next load. This MVP uses starter market data.
          </p>
        </form>

        <section className="card result-card">
          <div className="score-row">
            <div>
              <p className="eyebrow">LoadScore</p>
              <h2 className="score">{result.score}</h2>
            </div>
            <span className={`badge ${result.label.replace(" ", "-").toLowerCase()}`}>
              {result.label}
            </span>
          </div>

          <p className="result-summary">
            {result.reasons.length
              ? result.reasons.join(" ")
              : "Enter load details to calculate score."}
          </p>

          <div className="metrics">
            <div>
              <span>Total Miles</span>
              <strong>{decimal(result.totalMiles)}</strong>
            </div>
            <div>
              <span>Gross RPM</span>
              <strong>${decimal(result.grossRpm)}</strong>
            </div>
            <div>
              <span>All-In RPM</span>
              <strong>${decimal(result.allInRpm)}</strong>
            </div>
            <div>
              <span>Fuel Cost</span>
              <strong>{money(result.fuelCost)}</strong>
            </div>
            <div>
              <span>Fixed Cost</span>
              <strong>{money(result.fixedCost)}</strong>
            </div>
            <div>
              <span>Est. Profit</span>
              <strong>{money(result.estimatedProfit)}</strong>
            </div>
            <div>
              <span>Profit/Mile</span>
              <strong>${decimal(result.profitPerMile)}</strong>
            </div>
            <div>
              <span>Reload Score</span>
              <strong>{result.reloadScore}/100</strong>
            </div>
          </div>
        </section>
      </section>

      <section className="value-section">
        <h2>Built for faster load decisions.</h2>
        <div className="value-grid">
          <div>
            <h3>Real Profit</h3>
            <p>See beyond posted rate and estimate what is actually left.</p>
          </div>
          <div>
            <h3>Deadhead Matters</h3>
            <p>Factor empty miles before a good-looking load becomes weak.</p>
          </div>
          <div>
            <h3>Reload Score</h3>
            <p>Know whether the destination sets you up for the next move.</p>
          </div>
        </div>
      </section>

      <FeedbackForm />
    </main>
  );
}