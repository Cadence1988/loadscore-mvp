import { useEffect, useState } from "react";
import { saveOnboardingState, shouldShowOnboarding } from "../logic/onboarding";
import { trackEvent } from "../analytics/analytics";

export default function FirstRunOnboarding({ onUseSample }) {
  const [visible, setVisible] = useState(() => shouldShowOnboarding(window.localStorage));
  useEffect(() => { if (visible) trackEvent("onboarding_started", { surface: "web" }); }, [visible]);
  if (!visible) return null;
  function close(status) {
    saveOnboardingState(window.localStorage, status);
    trackEvent(status === "completed" ? "onboarding_completed" : "onboarding_skipped", { surface: "web" });
    setVisible(false);
  }
  return (
    <section className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-card">
        <p className="eyebrow">Welcome to LoadScore Beta</p>
        <h2 id="onboarding-title">Evaluate freight with your actual truck economics.</h2>
        <ol>
          <li><strong>Set truck numbers.</strong><span> MPG, fuel price, and fixed cost per mile.</span></li>
          <li><strong>Set targets.</strong><span> RPM, profit, deadhead, score, and reload thresholds.</span></li>
          <li><strong>Choose an Operating Mode.</strong><span> Matching preferences—not subscription plans.</span></li>
          <li><strong>Score a load.</strong><span> Missing deadhead produces only a provisional estimate.</span></li>
        </ol>
        <p>Recovery changes the rules you selected; it never changes the underlying LoadScore or guarantees future freight.</p>
        <div className="onboarding-actions">
          <button type="button" onClick={() => { onUseSample(); close("completed"); }}>Try an Example Load</button>
          <button type="button" onClick={() => close("completed")}>Continue</button>
          <button className="text-button" type="button" onClick={() => close("skipped")}>Skip and never show automatically again</button>
        </div>
      </div>
    </section>
  );
}
