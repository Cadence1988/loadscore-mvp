import { useState } from "react";
import { trackEvent } from "../analytics/analytics.js";
import {
  buildDualScoreFeedbackProperties,
  DUAL_SCORE_FEEDBACK_REASONS,
} from "../logic/dualScoreFeedback.js";

export default function DualScoreFeedback({ dualScore }) {
  const [pendingResponse, setPendingResponse] = useState("");
  const [reason, setReason] = useState("none");
  const [submitted, setSubmitted] = useState(false);

  function submit(response, reasonCategory = "none") {
    const properties = buildDualScoreFeedbackProperties(response, reasonCategory, dualScore);
    if (!properties) return;
    trackEvent("dual_score_feedback_submitted", properties);
    setSubmitted(true);
    setPendingResponse("");
  }

  if (submitted) {
    return <p className="dual-score-feedback-thanks" role="status">Thanks—your calibration feedback was recorded without load details.</p>;
  }

  return (
    <section className="dual-score-feedback" aria-labelledby="dual-score-feedback-title">
      <strong id="dual-score-feedback-title">Does this decision view match how you see this load?</strong>
      <div className="dual-score-feedback-actions" role="group" aria-label="Decision view feedback">
        <button type="button" onClick={() => submit("yes")}>Yes</button>
        <button type="button" onClick={() => { setPendingResponse("mostly"); setReason("none"); }}>Mostly</button>
        <button type="button" onClick={() => { setPendingResponse("no"); setReason("none"); }}>No</button>
      </div>
      {pendingResponse && (
        <div className="dual-score-feedback-reason">
          <label htmlFor="dual-score-feedback-reason">Optional reason</label>
          <select id="dual-score-feedback-reason" value={reason} onChange={(event) => setReason(event.target.value)}>
            <option value="none">No reason selected</option>
            {DUAL_SCORE_FEEDBACK_REASONS.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}
          </select>
          <button type="button" onClick={() => submit(pendingResponse, reason)}>Submit feedback</button>
        </div>
      )}
      <small>Optional, no sign-in required, and no lane, rate, mileage, or exact score is included.</small>
    </section>
  );
}
