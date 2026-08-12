import { useMemo, useState } from "react";
import { trackEvent } from "../analytics/analytics";
import { calculateLoadScore } from "../logic/calculateLoadScore";
import { calculateMinimumRate } from "../logic/calculateMinimumRate";
import { getCuratedMarketScore, DEFAULT_RELOAD_SCORE } from "../data/marketScores";
import { activeModeEvaluation, MODE_DEFINITIONS, MODE_ORDER, profileForMode } from "../logic/operatingModes";
import { flagDuplicates, IMPORT_ROW_LIMIT, normalizeCsvRows, normalizeLoad, parseCsvDocument, parsePastedLoads, STANDARD_FIELDS, suggestColumnMapping } from "../logic/loadNormalizer";

const previewFields = ["origin", "destination", "loadRate", "loadedMiles", "deadheadMiles", "pickupDate", "pickupTime", "deliveryDate", "deliveryTime", "equipment", "weight", "stops", "brokerReference", "loadIdentifier", "expirationDate", "expirationTime"];
const fieldLabels = { loadRate: "Rate", loadedMiles: "Loaded miles", deadheadMiles: "Deadhead", pickupDate: "Pickup date", pickupTime: "Pickup time", deliveryDate: "Delivery date", deliveryTime: "Delivery time", brokerReference: "Broker/reference", loadIdentifier: "Load ID", expirationDate: "Expires date", expirationTime: "Expires time" };

function rowCounts(rows) {
  return {
    ready: rows.filter((row) => row.status === "ready").length,
    review: rows.filter((row) => row.status === "review").length,
    missing: rows.filter((row) => row.status === "missing_required").length,
    duplicate: rows.filter((row) => row.status === "duplicate").length,
  };
}

export default function BulkImport({ truckDefaults, modeConfiguration, onSaveTop }) {
  const [tab, setTab] = useState("paste");
  const [pasteText, setPasteText] = useState("");
  const [csvDocument, setCsvDocument] = useState(null);
  const [mapping, setMapping] = useState({});
  const [rows, setRows] = useState([]);
  const [scored, setScored] = useState([]);
  const [filter, setFilter] = useState("all");
  const counts = useMemo(() => rowCounts(rows), [rows]);

  function previewPaste() {
    trackEvent("paste_import_opened", { surface: "web" });
    const parsed = flagDuplicates(parsePastedLoads(pasteText));
    setRows(parsed); setScored([]);
    trackEvent("import_rows_detected", { surface: "web", import_count: parsed.length, import_source: "pasted_text" });
  }

  async function readCsv(event) {
    trackEvent("csv_import_opened", { surface: "web" });
    const file = event.target.files?.[0];
    if (!file) return;
    const document = parseCsvDocument(await file.text());
    if (document.error) {
      setCsvDocument(document); setRows([]);
      trackEvent("csv_import_failed", { surface: "web", import_source: "csv" });
      return;
    }
    const suggested = suggestColumnMapping(document.headers);
    setCsvDocument(document); setMapping(suggested);
    const parsed = flagDuplicates(normalizeCsvRows(document, suggested));
    setRows(parsed); setScored([]);
    trackEvent("import_rows_detected", { surface: "web", import_count: document.totalRows, import_source: "csv" });
  }

  function updateMapping(header, field) {
    const next = { ...mapping, [header]: field };
    setMapping(next);
    setRows(flagDuplicates(normalizeCsvRows(csvDocument, next)));
    setScored([]);
  }

  function updateRow(index, field, value) {
    const next = rows.map((row, rowIndex) => rowIndex === index
      ? { ...normalizeLoad({ ...row.load, [field]: value }, row.load.source), rowNumber: row.rowNumber }
      : row);
    setRows(flagDuplicates(next)); setScored([]);
  }

  function scoreRows() {
    const valid = rows.filter((row) => !row.duplicate && row.errors.length === 0);
    const evaluated = valid.map((row) => {
      const curated = getCuratedMarketScore(row.load.destination);
      const reloadScore = curated ?? DEFAULT_RELOAD_SCORE;
      const calculationInput = { ...truckDefaults, ...row.load, deadheadMiles: row.load.deadheadMiles ?? 0, reloadScore };
      const result = calculateLoadScore(calculationInput);
      const load = { ...row.load, deadheadMiles: row.load.deadheadMiles, reloadScoreSource: curated === null ? "default" : "curated", result };
      const modeMatch = activeModeEvaluation(load, modeConfiguration);
      const minimumRate = calculateMinimumRate({ ...calculationInput, ...profileForMode(modeConfiguration, modeConfiguration.activeMode) }).minimumRate;
      return { ...load, id: crypto.randomUUID(), result, modeMatch, minimumRate, importWarnings: row.warnings };
    }).sort((a, b) => b.result.score - a.result.score || b.result.estimatedProfit - a.result.estimatedProfit || b.result.allInRpm - a.result.allInRpm);
    setScored(evaluated); setFilter("all");
    trackEvent(tab === "csv" ? "csv_import_completed" : "paste_import_completed", { surface: "web", import_count: evaluated.length, import_source: tab === "csv" ? "csv" : "pasted_text" });
    trackEvent("bulk_scoring_completed", { surface: "web", import_count: evaluated.length, mode: modeConfiguration.activeMode });
    if (evaluated.length) trackEvent("bulk_top7_viewed", { surface: "web", import_count: Math.min(7, evaluated.length), mode: modeConfiguration.activeMode });
  }

  const filtered = scored.filter((load) => filter === "all" || load.modeMatch.evaluations[filter]?.matches);
  const topSeven = filtered.slice(0, 7);

  return (
    <section className="bulk-import" id="import-opportunities" aria-labelledby="bulk-import-title">
      <div className="section-heading-row"><div><p className="eyebrow">User-controlled local intake</p><h2 id="bulk-import-title">Import Opportunities</h2></div><span className="local-only">Maximum {IMPORT_ROW_LIMIT} rows</span></div>
      <p>Paste freight text or choose an authorized CSV. Review every parsed value before scoring. Nothing is uploaded to LoadScore analytics.</p>
      <div className="import-tabs"><button className={tab === "paste" ? "active" : ""} onClick={() => setTab("paste")} type="button">Paste Text</button><button className={tab === "csv" ? "active" : ""} onClick={() => setTab("csv")} type="button">Upload CSV</button></div>
      {tab === "paste" ? <div className="import-entry"><textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder={'Dallas, TX -> Atlanta, GA | Rate: $2500 | Miles: 810 | Deadhead: 35 | Equipment: Dry Van\n\nHouston, TX -> Phoenix, AZ | Rate: $2100 | Miles: 1175'} /><button type="button" onClick={previewPaste} disabled={!pasteText.trim()}>Preview pasted loads</button></div>
        : <div className="import-entry"><input type="file" accept=".csv,text/csv" onChange={readCsv} />{csvDocument?.error && <p className="import-error">{csvDocument.error}</p>}{csvDocument?.truncated && <p className="import-warning">Only the first {IMPORT_ROW_LIMIT} rows are previewed to protect browser performance.</p>}</div>}

      {tab === "csv" && csvDocument?.headers?.length > 0 && <details className="mapping-review" open><summary>Review column mapping</summary><div className="mapping-grid">{csvDocument.headers.map((header) => <label key={header}>{header}<select value={mapping[header] || ""} onChange={(event) => updateMapping(header, event.target.value)}><option value="">Ignore</option>{STANDARD_FIELDS.map((field) => <option value={field} key={field}>{fieldLabels[field] || field}</option>)}</select></label>)}</div></details>}

      {rows.length > 0 && <><div className="import-counts"><span>{rows.length} detected</span><span>{counts.ready} ready</span><span>{counts.review} review</span><span>{counts.missing} missing required</span><span>{counts.duplicate} duplicate</span></div><div className="import-preview">{rows.map((row, index) => <details className={`import-row ${row.status}`} key={`${row.rowNumber}-${index}`}><summary>Row {row.rowNumber}: {row.load.origin || "Missing origin"} → {row.load.destination || "Missing destination"} <b>{row.status.replaceAll("_", " ")}</b></summary><div className="preview-grid">{previewFields.map((field) => <label key={field}>{fieldLabels[field] || field}<input value={row.load[field] ?? ""} onChange={(event) => updateRow(index, field, event.target.value)} /><small className={row.confidence[field]?.status}>{row.confidence[field]?.label}</small></label>)}</div>{row.errors.map((error) => <p className="import-error" key={error}>{error}</p>)}{row.warnings.map((warning) => <p className="import-warning" key={warning}>{warning}</p>)}</details>)}</div><button className="bulk-score-button" type="button" onClick={scoreRows} disabled={rows.every((row) => row.duplicate || row.errors.length)}>Score reviewed opportunities</button></>}

      {scored.length > 0 && <section className="bulk-results"><div className="section-heading-row"><div><p className="eyebrow">Ranked with unchanged LoadScore logic</p><h3>Top 7 Opportunities</h3></div><button type="button" onClick={() => onSaveTop(topSeven)}>Save visible Top 7 to Compare</button></div><div className="mode-filters"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")} type="button">All ({scored.length})</button>{MODE_ORDER.map((mode) => <button className={filter === mode ? "active" : ""} onClick={() => setFilter(mode)} type="button" key={mode}>{MODE_DEFINITIONS[mode].name} ({scored.filter((load) => load.modeMatch.evaluations[mode].matches).length})</button>)}</div>{topSeven.length === 0 ? <p className="comparison-empty">No {MODE_DEFINITIONS[filter]?.name || ""} matches found. Choose another filter—the mode is never changed automatically.</p> : <div className="bulk-cards">{topSeven.map((load, index) => <article key={load.id}><b>#{index + 1} · {load.modeMatch.label}</b><h4>{load.origin} → {load.destination}</h4><div><span>Score <strong>{load.result.score}</strong></span><span>All-in RPM <strong>${load.result.allInRpm.toFixed(2)}</strong></span><span>Profit <strong>${Math.round(load.result.estimatedProfit).toLocaleString()}</strong></span><span>Deadhead <strong>{load.deadheadMiles === null ? "Unknown" : `${load.deadheadMiles} mi`}</strong></span><span>Reload <strong>{load.result.reloadScore}/100</strong></span><span>Minimum rate <strong>${load.minimumRate.toLocaleString()}</strong></span></div>{load.importWarnings.map((warning) => <small key={warning}>{warning}</small>)}</article>)}</div>}</section>}
    </section>
  );
}
