import { useState } from "react";
import {
  savePeriodicProductFeedback,
  saveRecommendationFeedback,
} from "../feedback/feedbackStore";

const negativeReasons = [
  ["rate_recommendation", "Rate recommendation seemed wrong"],
  ["deadhead_weight", "Too much / too little weight on deadhead"],
  ["reload_estimate", "Reload estimate seemed wrong"],
  ["destination", "Destination issue"],
  ["timing", "Timing issue"],
  ["equipment", "Equipment issue"],
  ["broker", "Broker issue"],
  ["score_confusing", "Score was confusing"],
  ["driver_method", "Doesn't match how I would evaluate the load"],
  ["other", "Other"],
];

const positiveReasons = [
  ["profit_estimate", "Profit estimate"],
  ["all_in_rpm", "All-in RPM"],
  ["reload_score", "Reload Score"],
  ["explanation", "LoadScore explanation"],
  ["minimum_rate", "Minimum acceptable rate"],
  ["broker_guidance", "Broker guidance"],
  ["comparison", "Comparison"],
  ["alert_match", "Alert match"],
  ["other", "Other"],
];

export default function RecommendationFeedback({
  score,
  showPeriodicPrompt,
  onPeriodicComplete,
}) {
  const [sentiment, setSentiment] = useState("");
  const [selection, setSelection] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [periodicComment, setPeriodicComment] = useState("");
  const [periodicSubmitted, setPeriodicSubmitted] = useState(false);

  function chooseSentiment(value) {
    setSentiment(value);
    setSelection("");
    setSubmitted(false);
  }

  function submitRecommendation() {
    saveRecommendationFeedback({
      sentiment,
      score,
      reasonCode: sentiment === "negative" ? selection : "",
      usefulFeature: sentiment === "positive" ? selection : "",
    });
    setSubmitted(true);
  }

  function submitPeriodic(event) {
    event.preventDefault();
    if (!periodicComment.trim()) return;
    savePeriodicProductFeedback(periodicComment);
    setPeriodicSubmitted(true);
    onPeriodicComplete?.();
  }

  const choices = sentiment === "positive" ? positiveReasons : negativeReasons;

  return (
    <section className="recommendation-feedback" aria-labelledby="decision-feedback-title">
      <div>
        <p className="eyebrow">Quick driver feedback</p>
        <h3 id="decision-feedback-title">Did LoadScore make this decision easier?</h3>
      </div>

      <div className="sentiment-actions">
        <button
          className={sentiment === "positive" ? "selected positive" : ""}
          type="button"
          onClick={() => chooseSentiment("positive")}
        >
          👍 Yes
        </button>
        <button
          className={sentiment === "negative" ? "selected negative" : ""}
          type="button"
          onClick={() => chooseSentiment("negative")}
        >
          👎 No
        </button>
      </div>

      {sentiment && !submitted && (
        <div className="feedback-detail">
          <label>
            {sentiment === "positive" ? "What was most useful?" : "What could we improve?"}
            <select value={selection} onChange={(event) => setSelection(event.target.value)}>
              <option value="">Choose one (optional)</option>
              {choices.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={submitRecommendation}>Save feedback</button>
        </div>
      )}

      {submitted && (
        <p className="feedback-confirmation" role="status">
          Thanks. This feedback is saved only on this device until a secure backend is connected.
        </p>
      )}

      {showPeriodicPrompt && !periodicSubmitted && (
        <form className="periodic-feedback" onSubmit={submitPeriodic}>
          <label>
            You've been using LoadScore to evaluate freight. What's one thing we could make faster, clearer, or smarter?
            <textarea
              rows="2"
              maxLength="1000"
              value={periodicComment}
              onChange={(event) => setPeriodicComment(event.target.value)}
              placeholder="One improvement would be..."
            />
          </label>
          <div>
            <button type="submit" disabled={!periodicComment.trim()}>Save note</button>
            <button className="text-button" type="button" onClick={onPeriodicComplete}>Not now</button>
          </div>
        </form>
      )}
    </section>
  );
}
