import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import {
  DEFAULT_RELOAD_SCORE,
  getCuratedMarketScore,
} from "./data/marketScores";
import { calculateLoadScore } from "./logic/calculateLoadScore";
import { evaluateAlertMatch } from "./logic/evaluateAlertMatch";
import AutocompleteInput from "./components/AutocompleteInput";
import AlertPreferences from "./components/AlertPreferences";
import ComparisonBoard from "./components/ComparisonBoard";
import DriverProfiles from "./components/DriverProfiles";
import FeedbackForm from "./components/FeedbackForm";
import MinimumRateGuide from "./components/MinimumRateGuide";
import RecommendationFeedback from "./components/RecommendationFeedback";
import ShareResult from "./components/ShareResult";
import {
  incrementCalculationCount,
  initializeAnalytics,
  markPeriodicFeedbackShown,
  scoreBand,
  shouldShowPeriodicFeedback,
  trackEvent,
} from "./analytics/analytics";

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
  maximumDeadhead: 100,
  minimumReloadScore: 50,
  preferredDestinations: "",
  avoidedDestinations: "",
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
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showPeriodicFeedback, setShowPeriodicFeedback] = useState(false);
  const lastTrackedCalculation = useRef("");
  const [targets, setTargets] = useState(() => ({
    ...defaultTargets,
    ...loadStored("loadscore-targets", {}),
  }));
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

  useEffect(() => {
    initializeAnalytics("web");
  }, []);

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

  const reloadScoreSourceKey =
    form.manualReloadScore !== ""
      ? "manual"
      : detectedReloadScore !== null
        ? "curated"
        : "default";

  const result = useMemo(() => {
    return calculateLoadScore({
      ...form,
      reloadScore
    });
  }, [form, reloadScore]);

  const currentAlertMatch = useMemo(
    () =>
      evaluateAlertMatch(
        {
          ...form,
          result,
          reloadScoreSource:
            form.manualReloadScore !== ""
              ? "manual"
              : detectedReloadScore !== null
                ? "curated"
                : "default",
        },
        targets,
      ),
    [detectedReloadScore, form, result, targets],
  );

  useEffect(() => {
    if (!hasInteracted) return undefined;
    const isComplete = Boolean(
      String(form.origin).trim()
      && String(form.destination).trim()
      && Number(form.loadRate) > 0
      && Number(form.loadedMiles) > 0,
    );

    const signature = JSON.stringify({
      origin: form.origin,
      destination: form.destination,
      loadRate: form.loadRate,
      loadedMiles: form.loadedMiles,
      deadheadMiles: form.deadheadMiles,
      manualReloadScore: form.manualReloadScore,
      mpg: form.mpg,
      fuelPrice: form.fuelPrice,
      fixedCostPerMile: form.fixedCostPerMile,
      alertStatus: currentAlertMatch.status,
    });

    const timer = window.setTimeout(() => {
      if (signature === lastTrackedCalculation.current) return;
      lastTrackedCalculation.current = signature;
      if (isComplete) {
        trackEvent("load_calculated", {
          surface: "web",
          score_band: scoreBand(result.score),
          reload_market_known: reloadScoreSourceKey !== "default",
          reload_score_source: reloadScoreSourceKey,
          deadhead_entered: Number(form.deadheadMiles) > 0,
          alert_status: currentAlertMatch.status,
        });
      }
      trackEvent(`alert_${currentAlertMatch.status}`, {
        surface: "web",
        score_band: scoreBand(result.score),
        alert_status: currentAlertMatch.status,
      });
      if (isComplete) {
        const calculationCount = incrementCalculationCount();
        if (shouldShowPeriodicFeedback(calculationCount)) {
          markPeriodicFeedbackShown(calculationCount);
          setShowPeriodicFeedback(true);
        }
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    currentAlertMatch.status,
    form,
    hasInteracted,
    reloadScoreSourceKey,
    result.score,
  ]);

  function updateField(field, value) {
    setHasInteracted(true);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateTarget(field, value) {
    setTargets((previous) => ({ ...previous, [field]: value }));
  }

  function saveCurrentLoad() {
    if (comparisonLoads.length >= 7) return;
    setHasInteracted(true);
    const nextLoad = {
      ...form,
      id: crypto.randomUUID(),
      result,
      reloadScoreSource: reloadScoreSourceKey,
    };
    setComparisonLoads((previous) => [...previous, nextLoad]);
    trackEvent("load_saved", {
      surface: "web",
      score_band: scoreBand(result.score),
      saved_load_count: comparisonLoads.length + 1,
      alert_status: currentAlertMatch.status,
    });
  }

  function removeComparisonLoad(id) {
    setComparisonLoads((previous) => previous.filter((load) => load.id !== id));
    trackEvent("comparison_load_removed", {
      surface: "web",
      saved_load_count: Math.max(0, comparisonLoads.length - 1),
    });
  }

  function clearComparisonLoads() {
    setComparisonLoads([]);
    trackEvent("comparison_cleared", { surface: "web", saved_load_count: 0 });
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

          <AlertMatchSummary alertMatch={currentAlertMatch} />

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

          <ShareResult
            form={form}
            result={result}
            targets={targets}
            reloadScoreSource={reloadScoreSourceKey}
          />

          <RecommendationFeedback
            score={result.score}
            showPeriodicPrompt={showPeriodicFeedback}
            onPeriodicComplete={() => setShowPeriodicFeedback(false)}
          />
        </section>
      </section>

      <AlertPreferences targets={targets} onChange={updateTarget} />

      <ComparisonBoard
        loads={comparisonLoads}
        alertProfile={targets}
        onRemove={removeComparisonLoad}
        onClear={clearComparisonLoads}
      />

      <DriverProfiles
        profiles={profiles}
        form={form}
        targets={targets}
        onSave={(profile) => {
          setProfiles((previous) => [...previous, profile]);
          trackEvent("profile_saved", {
            surface: "web",
            profile_count: profiles.length + 1,
          });
        }}
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
            maximumDeadhead: profile.maximumDeadhead ?? 100,
            minimumReloadScore: profile.minimumReloadScore ?? 50,
            preferredDestinations: profile.preferredDestinations ?? "",
            avoidedDestinations: profile.avoidedDestinations ?? "",
          }));
          trackEvent("profile_applied", {
            surface: "web",
            profile_count: profiles.length,
          });
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

const alertStatusLabels = {
  match: "Matches your alert rules",
  near_match: "Almost matches",
  no_match: "Does not match",
  missing_data: "Missing data",
};

function AlertMatchSummary({ alertMatch }) {
  return (
    <section className={`current-alert-match ${alertMatch.status}`} aria-live="polite">
      <div className="current-alert-heading">
        <div>
          <p className="eyebrow">Local alert check</p>
          <h3>{alertStatusLabels[alertMatch.status]}</h3>
        </div>
        <span className={`alert-status ${alertMatch.status}`}>
          {alertStatusLabels[alertMatch.status]}
        </span>
      </div>
      <p>{alertMatch.explanation}</p>
      {(alertMatch.failedRules.length > 0 || alertMatch.warnings.length > 0) && (
        <details>
          <summary>Review alert details</summary>
          <ul>
            {alertMatch.failedRules.map((rule) => (
              <li key={rule.key}>{rule.message}</li>
            ))}
            {alertMatch.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
      <small>
        This checks only the load you entered. It does not monitor load boards or
        guarantee financial results.
      </small>
    </section>
  );
}
