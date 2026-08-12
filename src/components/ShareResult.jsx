import { useMemo, useState } from "react";
import { calculateMinimumRate } from "../logic/calculateMinimumRate";
import { trackEvent } from "../analytics/analytics";
import { buildShareText } from "../sharing/buildShareText";

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

export default function ShareResult({ form, result, targets, reloadScoreSource, modeLabel }) {
  const [status, setStatus] = useState("");
  const minimumRate = calculateMinimumRate({ ...form, ...targets }).minimumRate;
  const shareText = useMemo(
    () => buildShareText({ form, result, reloadScoreSource, minimumRate, modeLabel }),
    [form, minimumRate, modeLabel, reloadScoreSource, result],
  );

  async function copyResult() {
    try {
      await copyText(shareText);
      trackEvent("loadscore_result_copied", { surface: "web", share_method: "clipboard" });
      setStatus("LoadScore result copied. Review it before sending.");
    } catch {
      setStatus("Copy was blocked by this browser. Select and copy the summary below.");
    }
  }

  async function shareResult() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "LoadScore result", text: shareText });
        trackEvent("loadscore_result_shared", { surface: "web", share_method: "native_share" });
        setStatus("Share sheet opened.");
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    await copyResult();
    setStatus("Native sharing is unavailable, so the result was copied instead.");
  }

  return (
    <section className="share-result" aria-labelledby="share-result-title">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Driver-to-driver</p>
          <h3 id="share-result-title">Share LoadScore Result</h3>
        </div>
        <span className="estimate-label">Estimates labeled</span>
      </div>
      <p>
        Share the lane, score, key economics, explanation, and minimum rate—without broker contacts, personal data, or raw highlighted text.
      </p>
      <div className="share-actions">
        <button type="button" onClick={copyResult}>Copy Result</button>
        <button className="primary" type="button" onClick={shareResult}>Share Result</button>
      </div>
      <details className="share-preview">
        <summary>Preview shared text</summary>
        <pre>{shareText}</pre>
      </details>
      <p className="share-status" aria-live="polite">{status}</p>
    </section>
  );
}
