import { useState } from "react";
import { trackEvent } from "../analytics/analytics";

const defaultFb = {
  name: "",
  email: "",
  role: "Driver",
  wouldUse: "",
  missing: "",
  payFor: "",
  willingToPay: "",
};

export default function FeedbackForm() {
  const [fb, setFb] = useState(defaultFb);

  function update(field, value) {
    setFb((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const lines = [
      `Name: ${fb.name || "(not provided)"}`,
      `Email: ${fb.email || "(not provided)"}`,
      `Role: ${fb.role}`,
      `Would you use LoadScore? ${fb.wouldUse || "(no answer)"}`,
      `Would you consider paying if it repeatedly saves time or improves decisions? ${fb.willingToPay || "(no answer)"}`,
      "",
      "What is missing or confusing?",
      fb.missing || "(no answer)",
      "",
      "What would make this worth paying for?",
      fb.payFor || "(no answer)",
    ];
    const mailto =
      `mailto:rgm88@loadscore.app` +
      `?subject=${encodeURIComponent("LoadScore MVP Feedback")}` +
      `&body=${encodeURIComponent(lines.join("\n"))}`;
    trackEvent("feedback_form_submitted", { surface: "web" });
    if (fb.willingToPay) trackEvent("willing_to_pay_indicated", { surface: "web", willingness: fb.willingToPay.toLowerCase() });
    window.location.href = mailto;
  }

  return (
    <section className="feedback-section" id="feedback-form">
      <h2>Share Your Feedback</h2>
      <p className="feedback-intro">
        Help shape what LoadScore becomes. Takes under a minute.
      </p>

      <form className="card feedback-card" onSubmit={handleSubmit}>
        <div className="two-col">
          <label>
            Name <span className="optional">(optional)</span>
            <input
              value={fb.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Your name"
            />
          </label>
          <label>
            Email <span className="optional">(optional)</span>
            <input
              type="email"
              value={fb.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@example.com"
            />
          </label>
        </div>

        <label>
          Your Role
          <select
            value={fb.role}
            onChange={(e) => update("role", e.target.value)}
          >
            <option>Driver</option>
            <option>Owner-Operator</option>
            <option>Dispatcher</option>
            <option>Fleet Owner</option>
            <option>Other</option>
          </select>
        </label>

        <div className="fb-question">
          <p className="fb-label">Would you use LoadScore?</p>
          <div className="btn-group">
            {["Yes", "Maybe", "No"].map((opt) => (
              <button
                key={opt}
                type="button"
                className={`btn-option${fb.wouldUse === opt ? " selected" : ""}`}
                onClick={() => update("wouldUse", opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <label>
          What is missing or confusing?
          <textarea
            value={fb.missing}
            onChange={(e) => update("missing", e.target.value)}
            placeholder="Anything unclear, broken, or just not there yet?"
            rows={3}
          />
        </label>

        <label>
          What would make this worth paying for?
          <textarea
            value={fb.payFor}
            onChange={(e) => update("payFor", e.target.value)}
            placeholder="Features, data, integrations..."
            rows={3}
          />
        </label>

        <div className="fb-question">
          <p className="fb-label">Would you consider paying if LoadScore repeatedly saved time or improved decisions?</p>
          <div className="btn-group">{["Yes", "Maybe", "No"].map((option) => <button key={option} type="button" className={`btn-option${fb.willingToPay === option ? " selected" : ""}`} onClick={() => update("willingToPay", option)}>{option}</button>)}</div>
        </div>

        <div className="feedback-footer">
          <p className="mailto-note">
            Submitting opens your email app so you can review before sending.
          </p>
          <button type="submit" className="submit-btn">
            Submit Feedback
          </button>
        </div>
      </form>
    </section>
  );
}
