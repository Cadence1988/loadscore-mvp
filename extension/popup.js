/* global chrome */
import {
  calculateLoadScore,
  calculateMinimumRate,
  parseHighlightedLoad,
} from "./loadScore.js";
import { evaluateAlertMatch } from "./evaluateAlertMatch.js";

const fieldIds = [
  "origin", "destination", "loadRate", "loadedMiles", "deadheadMiles",
  "mpg", "fuelPrice", "fixedCostPerMile", "reloadScore",
  "targetAllInRpm", "targetProfit",
  "minimumLoadScore", "maximumDeadhead", "minimumReloadScore",
  "preferredDestinations", "avoidedDestinations",
];
const numericFields = new Set([
  "loadRate", "loadedMiles", "deadheadMiles", "mpg", "fuelPrice",
  "fixedCostPerMile", "reloadScore", "targetAllInRpm", "targetProfit",
  "minimumLoadScore", "maximumDeadhead", "minimumReloadScore",
]);
const loadFieldIds = [
  "origin", "destination", "loadRate", "loadedMiles", "deadheadMiles", "reloadScore",
];
const alertLabels = {
  match: "Matches alert",
  near_match: "Almost matches",
  no_match: "Does not match",
  missing_data: "Missing data",
};
let savedLoads = [];
let negotiationText = "";

function getForm() {
  return Object.fromEntries(
    fieldIds.map((id) => [id, numericFields.has(id) ? Number(document.getElementById(id).value) : document.getElementById(id).value]),
  );
}

function getLoadEntry() {
  const form = getForm();
  return Object.fromEntries(loadFieldIds.map((id) => [id, form[id]]));
}

function render() {
  const form = getForm();
  const result = calculateLoadScore(form);
  const rate = calculateMinimumRate(form);
  const alertMatch = evaluateAlertMatch({ ...form, result }, form);
  document.getElementById("score").textContent = result.score;
  const badge = document.getElementById("label");
  badge.textContent = result.label;
  badge.className = `badge ${result.label.replace(" ", "-").toLowerCase()}`;
  document.getElementById("recommendation").textContent = result.recommendation;
  document.getElementById("all-in-rpm").textContent = `$${result.allInRpm.toFixed(2)}`;
  document.getElementById("profit").textContent = result.estimatedProfit.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  document.getElementById("total-miles").textContent = result.totalMiles.toFixed(0);
  document.getElementById("reload-result").textContent = `${result.reloadScore}/100`;
  const alertStatus = document.getElementById("alert-match-status");
  alertStatus.textContent = alertLabels[alertMatch.status];
  alertStatus.className = alertMatch.status;
  document.getElementById("local-alert-title").textContent = alertMatch.explanation;
  document.getElementById("negotiator-title").textContent = `Minimum rate: $${rate.minimumRate.toLocaleString()}`;
  const askMore = document.getElementById("ask-more");
  askMore.textContent = rate.meetsTarget
    ? "Target met"
    : `Ask +$${rate.askMore.toLocaleString()}`;
  askMore.className = rate.meetsTarget ? "met" : "";
  negotiationText = rate.meetsTarget
    ? `The current $${Number(form.loadRate || 0).toLocaleString()} offer from ${form.origin || "origin"} to ${form.destination || "destination"} meets my operating targets.`
    : `I can cover ${form.origin || "the origin"} to ${form.destination || "the destination"} for $${rate.minimumRate.toLocaleString()} based on the deadhead and operating cost. Can you make that work?`;
  document.getElementById("negotiation-message").textContent = negotiationText;
}

function setForm(values) {
  fieldIds.forEach((id) => {
    if (values[id] !== undefined && values[id] !== null) {
      document.getElementById(id).value = values[id];
    }
  });
  render();
}

function setLoadFields(values) {
  loadFieldIds.forEach((id) => {
    if (values[id] !== undefined && values[id] !== null) {
      document.getElementById(id).value = values[id];
    }
  });
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSavedLoads() {
  const container = document.getElementById("saved-loads");
  document.getElementById("saved-count").textContent = `${savedLoads.length}/7`;
  if (savedLoads.length === 0) {
    container.innerHTML = '<p class="saved-empty">No saved loads yet.</p>';
    void updateMatchedBadge();
    return;
  }

  const alertProfile = getForm();
  container.innerHTML = savedLoads
    .map((load) => {
      const result = calculateLoadScore({
        ...load,
        mpg: alertProfile.mpg,
        fuelPrice: alertProfile.fuelPrice,
        fixedCostPerMile: alertProfile.fixedCostPerMile,
      });
      const alertMatch = evaluateAlertMatch({ ...load, result }, alertProfile);
      return `
        <article class="saved-load">
          <div class="saved-load-top">
            <div>
              <strong>${escapeHtml(load.origin || "Unknown origin")} → ${escapeHtml(load.destination || "Unknown destination")}</strong>
              <span>$${Number(load.loadRate || 0).toLocaleString()} · ${Number(load.loadedMiles || 0).toLocaleString()} loaded mi · ${Number(load.deadheadMiles || 0).toLocaleString()} deadhead</span>
            </div>
            <span class="saved-load-score">${result.score}</span>
          </div>
          <div class="saved-alert">
            <span class="saved-alert-status ${alertMatch.status}">${alertLabels[alertMatch.status]}</span>
            <span class="saved-alert-explanation">${escapeHtml(alertMatch.explanation)}</span>
          </div>
          <div class="saved-load-actions">
            <button type="button" data-action="load" data-id="${load.id}">Load</button>
            <button class="remove-saved" type="button" data-action="remove" data-id="${load.id}">Remove</button>
          </div>
        </article>`;
    })
    .join("");
  void updateMatchedBadge();
}

async function updateMatchedBadge() {
  const alertProfile = getForm();
  const matchedCount = savedLoads.filter((load) => {
    const result = calculateLoadScore({
      ...load,
      mpg: alertProfile.mpg,
      fuelPrice: alertProfile.fuelPrice,
      fixedCostPerMile: alertProfile.fixedCostPerMile,
    });
    return evaluateAlertMatch({ ...load, result }, alertProfile).matches;
  }).length;
  await chrome.action.setBadgeBackgroundColor({ color: "#15803d" });
  await chrome.action.setBadgeText({ text: matchedCount > 0 ? String(matchedCount) : "" });
}

document.getElementById("load-form").addEventListener("input", async () => {
  render();
  renderSavedLoads();
  await chrome.storage.local.set({ loadScoreDraft: getForm() });
});

document.getElementById("parse-selection").addEventListener("click", async () => {
  const status = document.getElementById("parse-status");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: selectedText }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() || "",
    });
    if (!selectedText.trim()) {
      status.textContent = "No text is highlighted. Select the visible load offer and try again.";
      return;
    }
    const parsed = parseHighlightedLoad(selectedText);
    const filled = Object.entries(parsed).filter(([, value]) => value !== "");
    filled.forEach(([id, value]) => { document.getElementById(id).value = value; });
    status.textContent = filled.length
      ? `Filled ${filled.length} field${filled.length === 1 ? "" : "s"}. Review the values before using the score.`
      : "Text was read, but no route, rate, or mileage pattern was recognized.";
    render();
    renderSavedLoads();
    await chrome.storage.local.set({ loadScoreDraft: getForm() });
  } catch {
    status.textContent = "This page does not allow selected-text access. Enter the load manually.";
  }
});

document.getElementById("save-defaults").addEventListener("click", async () => {
  const form = getForm();
  await chrome.storage.local.set({
    loadScoreDefaults: {
      mpg: form.mpg,
      fuelPrice: form.fuelPrice,
      fixedCostPerMile: form.fixedCostPerMile,
      targetAllInRpm: form.targetAllInRpm,
      targetProfit: form.targetProfit,
      minimumLoadScore: form.minimumLoadScore,
      maximumDeadhead: form.maximumDeadhead,
      minimumReloadScore: form.minimumReloadScore,
      preferredDestinations: form.preferredDestinations,
      avoidedDestinations: form.avoidedDestinations,
    },
  });
  const { loadScoreDefaults } = await chrome.storage.local.get("loadScoreDefaults");
  document.getElementById("save-status").textContent = loadScoreDefaults
    ? "Truck settings saved"
    : "Truck settings could not be saved";
});

document.getElementById("copy-negotiation").addEventListener("click", async () => {
  await navigator.clipboard.writeText(negotiationText);
  document.getElementById("save-status").textContent = "Broker message copied";
});

document.getElementById("save-load").addEventListener("click", async () => {
  if (savedLoads.length >= 7) {
    document.getElementById("save-status").textContent = "Remove a saved load before adding another";
    return;
  }
  savedLoads = [
    { ...getLoadEntry(), id: crypto.randomUUID(), savedAt: new Date().toISOString() },
    ...savedLoads,
  ];
  await chrome.storage.local.set({ loadScoreSavedLoads: savedLoads });
  document.getElementById("save-status").textContent = "Load saved on this device";
  renderSavedLoads();
});

document.getElementById("saved-loads").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const load = savedLoads.find((item) => item.id === button.dataset.id);
  if (button.dataset.action === "load" && load) {
    setLoadFields(load);
    await chrome.storage.local.set({ loadScoreDraft: getForm() });
    document.getElementById("save-status").textContent = "Saved load loaded into calculator";
  } else if (button.dataset.action === "remove") {
    savedLoads = savedLoads.filter((item) => item.id !== button.dataset.id);
    await chrome.storage.local.set({ loadScoreSavedLoads: savedLoads });
    renderSavedLoads();
  }
});

const stored = await chrome.storage.local.get([
  "loadScoreDefaults",
  "loadScoreDraft",
  "loadScoreSavedLoads",
]);
savedLoads = Array.isArray(stored.loadScoreSavedLoads) ? stored.loadScoreSavedLoads : [];
setForm({ ...(stored.loadScoreDefaults || {}), ...(stored.loadScoreDraft || {}) });
renderSavedLoads();
