import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  DEFAULT_RELOAD_SCORE,
  getCuratedMarketScore,
} from "./data/marketScores";
import { calculateLoadScore } from "./logic/calculateLoadScore";
import AutocompleteInput from "./components/AutocompleteInput";
import ComparisonBoard from "./components/ComparisonBoard";
import DriverProfiles from "./components/DriverProfiles";
import FeedbackForm from "./components/FeedbackForm";
import MinimumRateGuide from "./components/MinimumRateGuide";

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

const defaultTargets = {
  targetAllInRpm: 2.25,
  targetProfit: 500,
  minimumLoadScore: 70,
};

function loadStored(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

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
  const [targets, setTargets] = useState(() =>
    loadStored("loadscore-targets", defaultTargets),
  );
  const [comparisonLoads, setComparisonLoads] = useState(() =>
    loadStored("loadscore-comparisons", []),
  );
  const [profiles, setProfiles] = useState(() =>
    loadStored("loadscore-profiles", []),
  );

  useEffect(() => {
    localStorage.setItem("loadscore-targets", JSON.stringify(targets));
  }, [targets]);

  useEffect(() => {
    localStorage.setItem("loadscore-comparisons", JSON.stringify(comparisonLoads));
  }, [comparisonLoads]);

  useEffect(() => {
    localStorage.setItem("loadscore-profiles", JSON.stringify(profiles));
  }, [profiles]);

  const detectedReloadScore = getCuratedMarketScore(form.destination);

  const reloadScore =
    form.manualReloadScore !== ""
      ? Number(form.manualReloadScore)
      : detectedReloadScore ?? DEFAULT_RELOAD_SCORE;

  const reloadScoreSource =
    form.manualReloadScore !== ""
      ? "Manual score"
      : detectedReloadScore !== null
        ? "Curated starter estimate"
        : "Neutral default for an unscored market";

  const result = useMemo(() => {
    return calculateLoadScore({
      ...form,
      reloadScore
    });
  }, [form, reloadScore]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateTarget(field, value) {
    setTargets((previous) => ({ ...previous, [field]: value }));
  }

  function saveCurrentLoad() {
    setComparisonLoads((previous) => {
      if (previous.length >= 7) return previous;
      return [
        ...previous,
        {
          ...form,
          id: crypto.randomUUID(),
          result,
        },
      ];
    });
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
        <form className="card form-card" onSubmit={(event) => event.preventDefault()}>
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
            next load. This MVP uses curated starter estimates—not live market
            data. Cities without an estimate default to {DEFAULT_RELOAD_SCORE}.
          </p>

          <button
            className="compare-save-button"
            type="button"
            onClick={saveCurrentLoad}
            disabled={comparisonLoads.length >= 7}
          >
            {comparisonLoads.length >= 7
              ? "Comparison list is full"
              : `Save to Compare (${comparisonLoads.length}/7)`}
          </button>
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

          <div className="result-summary">
            <strong>Recommendation</strong>
            <p>{result.explanation.recommendation}</p>
          </div>

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
              <small>{reloadScoreSource}</small>
            </div>
          </div>

          <section className="score-explanation" aria-labelledby="score-explanation-title">
            <div className="explanation-heading">
              <div>
                <p className="eyebrow">Score explanation</p>
                <h3 id="score-explanation-title">Why this load scored {result.score}</h3>
              </div>
              <span className="starting-score">Starts at 50</span>
            </div>

            <div className="factor-columns">
              <FactorList
                title="Positives"
                emptyText="No score bonuses yet."
                factors={result.explanation.positives}
                tone="positive"
              />
              <FactorList
                title="Warnings"
                emptyText="No score penalties found."
                factors={result.explanation.warnings}
                tone="warning"
              />
            </div>

            {result.explanation.neutral.length > 0 && (
              <details className="neutral-details">
                <summary>Other factors ({result.explanation.neutral.length})</summary>
                <ul>
                  {result.explanation.neutral.map((factor) => (
                    <li key={factor.title}>{factor.detail}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <MinimumRateGuide
            form={form}
            targets={targets}
            onTargetChange={updateTarget}
          />
        </section>
      </section>

      <ComparisonBoard
        loads={comparisonLoads}
        alertThreshold={Number(targets.minimumLoadScore) || 70}
        onRemove={(id) =>
          setComparisonLoads((previous) =>
            previous.filter((load) => load.id !== id),
          )
        }
        onClear={() => setComparisonLoads([])}
      />

      <DriverProfiles
        profiles={profiles}
        form={form}
        targets={targets}
        onTargetChange={updateTarget}
        onSave={(profile) => setProfiles((previous) => [...previous, profile])}
        onDelete={(id) =>
          setProfiles((previous) => previous.filter((profile) => profile.id !== id))
        }
        onApply={(profile) => {
          setForm((previous) => ({
            ...previous,
            mpg: profile.mpg,
            fuelPrice: profile.fuelPrice,
            fixedCostPerMile: profile.fixedCostPerMile,
          }));
          setTargets((previous) => ({
            ...previous,
            targetAllInRpm: profile.targetAllInRpm,
            targetProfit: profile.targetProfit,
            minimumLoadScore: profile.minimumLoadScore ?? 70,
          }));
        }}
      />

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

function FactorList({ title, emptyText, factors, tone }) {
  return (
    <div className={`factor-group ${tone}`}>
      <h4>{title}</h4>
      {factors.length === 0 ? (
        <p className="empty-factor">{emptyText}</p>
      ) : (
        <ul>
          {factors.map((factor) => (
            <li key={factor.title}>
              <div>
                <strong>{factor.title}</strong>
                <span>{factor.detail}</span>
              </div>
              <b className="impact">
                {factor.impact > 0 ? "+" : ""}{factor.impact}
              </b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
