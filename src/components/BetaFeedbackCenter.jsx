import { useEffect, useMemo, useState } from "react";
import { getAnonymousInstallationId, trackEvent } from "../analytics/analytics";
import { allowlistedTesterSource, buildDiagnostic, diagnosticText, PARSER_FIELDS, PROBLEM_CATEGORIES, saveLocalBetaReport, sourceFromUrl, TESTER_SOURCE_KEY, TESTER_SOURCES } from "../beta/betaSupport";
import { EXTENSION_BUILD_VERSION, PRODUCT_STAGE, WEB_BUILD_VERSION } from "../config/version";

export default function BetaFeedbackCenter({ activeMode }) {
  const initialSource = sourceFromUrl(window.location.href) || allowlistedTesterSource(localStorage.getItem(TESTER_SOURCE_KEY) || "");
  const [source, setSource] = useState(initialSource);
  const [category, setCategory] = useState("score");
  const [feature, setFeature] = useState("calculator");
  const [explanation, setExplanation] = useState("");
  const [parserSource, setParserSource] = useState("");
  const [parserOutcome, setParserOutcome] = useState("");
  const [parserFields, setParserFields] = useState([]);
  const [status, setStatus] = useState("");
  const diagnostic = useMemo(() => buildDiagnostic({ installationId: getAnonymousInstallationId(), mode: activeMode, feature, category, parserSource, parserOutcome, parserFields, userAgent: navigator.userAgent }), [activeMode, category, feature, parserFields, parserOutcome, parserSource]);

  useEffect(() => {
    const referredSource = sourceFromUrl(window.location.href);
    if (!referredSource || localStorage.getItem(TESTER_SOURCE_KEY) === referredSource) return;
    localStorage.setItem(TESTER_SOURCE_KEY, referredSource);
    trackEvent("beta_source_recorded", { surface: "web", tester_source: referredSource });
  }, []);

  function updateSource(value) {
    const safe = allowlistedTesterSource(value);
    setSource(safe);
    if (safe) { localStorage.setItem(TESTER_SOURCE_KEY, safe); trackEvent("beta_source_recorded", { surface: "web", tester_source: safe }); }
    else localStorage.removeItem(TESTER_SOURCE_KEY);
  }
  function saveReport() {
    saveLocalBetaReport(localStorage, { category, feature, explanation, parserSource, parserOutcome, parserFields });
    trackEvent("problem_reported", { surface: "web", feature_area: feature, error_category: category, parser_result: parserOutcome || "not_applicable" });
    if (category === "parser") trackEvent("parser_feedback_submitted", { surface: "web", parser_result: parserOutcome || "not_selected", import_source: parserSource || "unknown" });
    setStatus("Report saved on this device. Copy the diagnostic or prepare an email to send it to LoadScore.");
  }
  async function copyDiagnostic() {
    try { await navigator.clipboard.writeText(diagnosticText(diagnostic)); trackEvent("diagnostic_copied", { surface: "web", feature_area: feature, error_category: category }); setStatus("Safe diagnostic info copied."); }
    catch { setStatus("Copy was blocked. Expand the preview and copy it manually."); }
  }
  function prepareEmail() {
    trackEvent("problem_report_prepared", { surface: "web", feature_area: feature, error_category: category });
    const body = [`Problem category: ${category}`, `Feature: ${feature}`, "", "Driver explanation (entered deliberately):", explanation || "(none)", "", "Safe diagnostic:", diagnosticText(diagnostic)].join("\n");
    window.location.href = `mailto:rgm88@loadscore.app?subject=${encodeURIComponent("LoadScore Beta Problem Report")}&body=${encodeURIComponent(body)}`;
  }
  function toggleParserField(field) { setParserFields((previous) => previous.includes(field) ? previous.filter((item) => item !== field) : [...previous, field]); }

  return (
    <section className="beta-center" id="feedback-beta" aria-labelledby="beta-center-title">
      <div className="section-heading-row"><div><p className="eyebrow">{PRODUCT_STAGE}</p><h2 id="beta-center-title">Feedback & Beta</h2></div><span className="local-only">Web {WEB_BUILD_VERSION} · Extension {EXTENSION_BUILD_VERSION}</span></div>
      <p>LoadScore is under active development. Calculations are estimates—review load details before making a freight decision.</p>
      <div className="beta-tools">
        <details onToggle={(event) => { if (event.currentTarget.open) trackEvent("problem_report_started", { surface: "web", feature_area: feature }); }}><summary>Something look wrong? Report a problem</summary>
          <div className="two-col"><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{PROBLEM_CATEGORIES.map((item) => <option value={item} key={item}>{item.replaceAll("_", " ")}</option>)}</select></label><label>Feature area<select value={feature} onChange={(event) => setFeature(event.target.value)}><option>calculator</option><option>comparison</option><option>import</option><option>operating modes</option><option>extension</option><option>notifications</option><option>sharing</option><option>onboarding</option></select></label></div>
          <label>What happened? <span className="optional">Optional; do not paste private freight details</span><textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} rows="3" /></label>
          {category === "parser" && <div className="parser-report"><div className="two-col"><label>Parser source<select value={parserSource} onChange={(event) => setParserSource(event.target.value)}><option value="">Select</option><option value="highlighted_text">Highlighted text</option><option value="pasted_text">Pasted text</option><option value="csv">CSV</option></select></label><label>Outcome<select value={parserOutcome} onChange={(event) => setParserOutcome(event.target.value)}><option value="">Select</option><option>success</option><option>partial</option><option>failure</option></select></label></div><p>Which fields need work? The original freight message is not attached.</p><div className="field-checks">{PARSER_FIELDS.map((field) => <label key={field}><input type="checkbox" checked={parserFields.includes(field)} onChange={() => toggleParserField(field)} />{field.replaceAll("_", " ")}</label>)}</div></div>}
          <div className="beta-actions"><button type="button" onClick={saveReport}>Save report locally</button><button type="button" onClick={copyDiagnostic}>Copy Diagnostic Info</button><button type="button" onClick={prepareEmail}>Prepare Email Report</button></div>
          <details className="diagnostic-preview"><summary>Exactly what diagnostic info includes</summary><pre>{diagnosticText(diagnostic)}</pre></details>
        </details>
        <details><summary>How did you hear about LoadScore?</summary><label>Tester source<select value={source} onChange={(event) => updateSource(event.target.value)}>{TESTER_SOURCES.map((item) => <option value={item} key={item || "unknown"}>{item ? item.replaceAll("_", " ") : "Not provided"}</option>)}</select></label><p className="privacy-note">LoadScore never guesses your source. Only this allowlisted category is stored.</p></details>
        <details><summary>Suggest an improvement</summary><p>Use the feedback form below or email LoadScore. Avoid including private broker or load-board information.</p><a href="#feedback-form">Open feedback form</a></details>
        <details><summary>Share LoadScore</summary><button type="button" onClick={async () => { try { await navigator.clipboard.writeText("Try LoadScore Beta: https://loadscore-mvp.vercel.app"); trackEvent("loadscore_result_shared", { surface: "web", share_method: "beta_link_copy" }); setStatus("Beta link copied."); } catch { setStatus("Copy was blocked."); } }}>Copy beta link</button></details>
      </div>
      <p className="beta-status" aria-live="polite">{status}</p>
    </section>
  );
}
