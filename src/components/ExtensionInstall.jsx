import { useEffect } from "react";
import { EXTENSION_DISTRIBUTION, PRIVACY_POLICY_PATH } from "../config/extensionDistribution";
import { trackEvent } from "../analytics/analytics";

export default function ExtensionInstall({ calculationComplete = false }) {
  useEffect(() => { trackEvent("extension_page_viewed", { surface: "web" }); trackEvent("extension_install_cta_viewed", { surface: "web", status: EXTENSION_DISTRIBUTION.available ? "available" : "coming_soon" }); }, []);
  function clicked() { trackEvent("extension_install_cta_clicked", { surface: "web", status: "available" }); }
  return (
    <section className="extension-install" id="extension" aria-labelledby="extension-title">
      <div>
        <p className="eyebrow">Quick repeated use</p>
        <h2 id="extension-title">Keep LoadScore within reach while you’re looking at freight.</h2>
        <p>Use saved truck numbers, apply your Operating Mode, evaluate manually entered or deliberately highlighted visible load text, review saved opportunities, calculate minimum acceptable rate, and copy results without reopening the full workflow.</p>
        {calculationComplete && <p className="extension-nudge">Like having LoadScore handy? The extension is the quick-use companion to the full web app.</p>}
      </div>
      <div className="extension-feature-grid">
        <div><strong>Extension</strong><span>Quick calculator, deliberate highlighted-text parsing, modes, saved loads, minimum rate, and sharing.</span></div>
        <div><strong>Full web app</strong><span>Onboarding, paste/CSV imports, deeper comparison, advanced settings, privacy, and beta support.</span></div>
        <div><strong>Clear boundary</strong><span>No automatic load-board monitoring, passwords, cookies, load discovery, or automatic booking.</span></div>
      </div>
      <div className="extension-actions">
        {EXTENSION_DISTRIBUTION.available
          ? <a className="install-cta" href={EXTENSION_DISTRIBUTION.storeUrl} target="_blank" rel="noreferrer" onClick={clicked}>{EXTENSION_DISTRIBUTION.label}</a>
          : <span className="install-cta coming-soon" aria-disabled="true">{EXTENSION_DISTRIBUTION.label}</span>}
        <a href={PRIVACY_POLICY_PATH}>Privacy Policy</a>
      </div>
      <p className="privacy-note">Highlighted load text is read only after the driver deliberately activates the feature.</p>
    </section>
  );
}
