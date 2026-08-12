/* global chrome */
import {
  calculateLoadScore,
  calculateMinimumRate,
  parseHighlightedLoad,
} from "./loadScore.js";
import { evaluateAlertMatch } from "./evaluateAlertMatch.js";
import {
  getCentralAnalyticsConsent,
  initializeExtensionAnalytics,
  scoreBand,
  setCentralAnalyticsConsent,
  trackEvent,
} from "./analytics.js";
import { buildExtensionShareText } from "./shareResult.js";
import { isLoadExpired, normalizeLoadLifecycle, validateLoadTiming } from "./loadLifecycle.js";
import { countActiveMatches, DEFAULT_NOTIFICATION_SETTINGS } from "./notificationEngine.js";

const fieldIds = [
  "origin", "destination", "loadRate", "loadedMiles", "deadheadMiles",
  "mpg", "fuelPrice", "fixedCostPerMile", "reloadScore",
  "targetAllInRpm", "targetProfit",
  "minimumLoadScore", "maximumDeadhead", "minimumReloadScore",
  "preferredDestinations", "avoidedDestinations",
  "pickupDate", "pickupTime", "deliveryDate", "deliveryTime",
  "expectedEmptyDate", "expectedEmptyTime", "equipment", "brokerReference",
  "source", "loadIdentifier", "expirationDate", "expirationTime", "status",
];
const numericFields = new Set([
  "loadRate", "loadedMiles", "deadheadMiles", "mpg", "fuelPrice",
  "fixedCostPerMile", "reloadScore", "targetAllInRpm", "targetProfit",
  "minimumLoadScore", "maximumDeadhead", "minimumReloadScore",
]);
const loadFieldIds = [
  "origin", "destination", "loadRate", "loadedMiles", "deadheadMiles", "reloadScore",
  "pickupDate", "pickupTime", "deliveryDate", "deliveryTime",
  "expectedEmptyDate", "expectedEmptyTime", "equipment", "brokerReference",
  "source", "loadIdentifier", "expirationDate", "expirationTime", "status",
];
const alertLabels = {
  match: "Matches alert",
  near_match: "Almost matches",
  no_match: "Does not match",
  missing_data: "Missing data",
};
let savedLoads = [];
let negotiationText = "";
let shareText = "";
let calculationTimer;
let lastTrackedCalculation = "";
let lastTrackedMinimumRate = null;

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
  const timing = validateLoadTiming(form);
  document.getElementById("timing-status").textContent = timing.errors[0]
    || timing.warnings[0]
    || (timing.expired ? "This load has expired and is excluded from active matches." : "");
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
  shareText = buildExtensionShareText({ form, result, rate });
  if (result.totalMiles > 0 && rate.minimumRate !== lastTrackedMinimumRate) {
    lastTrackedMinimumRate = rate.minimumRate;
    void trackEvent("minimum_rate_viewed", {
      surface: "extension",
      minimum_rate_band: rate.minimumRate >= 3000 ? "3000_plus" : rate.minimumRate >= 2000 ? "2000_2999" : rate.minimumRate >= 1000 ? "1000_1999" : "under_1000",
      target_met: rate.meetsTarget,
    });
  }
}

function scheduleCalculationTracking() {
  window.clearTimeout(calculationTimer);
  calculationTimer = window.setTimeout(() => {
    const form = getForm();
    const result = calculateLoadScore(form);
    const alertMatch = evaluateAlertMatch({ ...form, result }, form);
    const signature = JSON.stringify({
      origin: form.origin,
      destination: form.destination,
      loadRate: form.loadRate,
      loadedMiles: form.loadedMiles,
      deadheadMiles: form.deadheadMiles,
      reloadScore: form.reloadScore,
      alertStatus: alertMatch.status,
    });
    if (signature === lastTrackedCalculation) return;
    lastTrackedCalculation = signature;
    if (alertMatch.status !== "missing_data") {
      void trackEvent("load_calculated", {
        surface: "extension",
        score_band: scoreBand(result.score),
        reload_market_known: false,
        reload_score_source: "user_entered",
        deadhead_entered: Number(form.deadheadMiles) > 0,
        alert_status: alertMatch.status,
      });
    }
    void trackEvent(`alert_${alertMatch.status}`, {
      surface: "extension",
      score_band: scoreBand(result.score),
      alert_status: alertMatch.status,
    });
  }, 700);
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
    .map((originalLoad) => {
      const load = normalizeLoadLifecycle(originalLoad);
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
          <span class="lifecycle-meta">${escapeHtml(load.equipment || "Equipment not specified")} · ${escapeHtml(load.status.replaceAll("_", " "))}</span>
          ${isLoadExpired(load) ? '<span class="expired-label">Expired · inactive</span>' : ""}
          <label>Status<select data-action="status" data-id="${load.id}">
            ${["available", "viewed", "interested", "requested", "pending_confirmation", "booked", "covered", "expired", "rejected"].map((status) => `<option value="${status}" ${load.status === status ? "selected" : ""}>${status.replaceAll("_", " ")}</option>`).join("")}
          </select></label>
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
  const matchedCount = countActiveMatches(savedLoads, (load) => {
    const result = calculateLoadScore({
      ...load,
      mpg: alertProfile.mpg,
      fuelPrice: alertProfile.fuelPrice,
      fixedCostPerMile: alertProfile.fixedCostPerMile,
    });
    return evaluateAlertMatch({ ...load, result }, alertProfile);
  });
  await chrome.action.setBadgeBackgroundColor({ color: "#15803d" });
  await chrome.action.setBadgeText({ text: matchedCount > 0 ? String(matchedCount) : "" });
}

document.getElementById("load-form").addEventListener("input", async () => {
  render();
  renderSavedLoads();
  scheduleCalculationTracking();
  await chrome.storage.local.set({ loadScoreDraft: getForm() });
});

document.getElementById("analytics-consent").addEventListener("change", async (event) => {
  await setCentralAnalyticsConsent(event.target.checked);
});

async function saveNotificationSettings() {
  const settings = {
    enabled: document.getElementById("notifications-enabled").checked,
    quietStart: document.getElementById("quiet-start").value,
    quietEnd: document.getElementById("quiet-end").value,
  };
  await chrome.storage.local.set({ loadScoreNotificationSettings: settings });
  document.getElementById("notification-status").textContent = settings.enabled
    ? "Notifications enabled for new qualifying saved loads."
    : "Notifications are off.";
  await trackEvent(settings.enabled ? "notifications_enabled" : "notifications_disabled", { surface: "extension" });
}

document.getElementById("notifications-enabled").addEventListener("change", saveNotificationSettings);
document.getElementById("quiet-start").addEventListener("change", saveNotificationSettings);
document.getElementById("quiet-end").addEventListener("change", saveNotificationSettings);

document.getElementById("parse-selection").addEventListener("click", async () => {
  const status = document.getElementById("parse-status");
  await trackEvent("highlight_parser_used", { surface: "extension" });
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: selectedText }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() || "",
    });
    if (!selectedText.trim()) {
      status.textContent = "No text is highlighted. Select the visible load offer and try again.";
      await trackEvent("highlight_parser_failed", {
        surface: "extension",
        parser_result: "no_selection",
      });
      return;
    }
    const parsed = parseHighlightedLoad(selectedText);
    const filled = Object.entries(parsed).filter(([, value]) => value !== "");
    filled.forEach(([id, value]) => { document.getElementById(id).value = value; });
    status.textContent = filled.length
      ? `Filled ${filled.length} field${filled.length === 1 ? "" : "s"}. Review the values before using the score.`
      : "Text was read, but no route, rate, or mileage pattern was recognized.";
    const requiredFields = ["origin", "destination", "loadRate", "loadedMiles"];
    const requiredCount = requiredFields.filter((field) => parsed[field] !== "").length;
    const parserEvent = requiredCount === requiredFields.length
      ? "highlight_parser_success"
      : filled.length > 0
        ? "highlight_parser_partial"
        : "highlight_parser_failed";
    await trackEvent(parserEvent, {
      surface: "extension",
      parser_result: parserEvent.replace("highlight_parser_", ""),
    });
    render();
    renderSavedLoads();
    scheduleCalculationTracking();
    await chrome.storage.local.set({ loadScoreDraft: getForm() });
  } catch {
    status.textContent = "This page does not allow selected-text access. Enter the load manually.";
    await trackEvent("highlight_parser_failed", {
      surface: "extension",
      parser_result: "page_blocked",
    });
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
  if (loadScoreDefaults) {
    await trackEvent("profile_saved", { surface: "extension" });
  }
});

document.getElementById("copy-negotiation").addEventListener("click", async () => {
  await navigator.clipboard.writeText(negotiationText);
  document.getElementById("save-status").textContent = "Broker message copied";
  await trackEvent("broker_message_copied", {
    surface: "extension",
    share_method: "clipboard",
  });
});

document.getElementById("copy-result").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shareText);
    document.getElementById("share-status").textContent = "LoadScore result copied. Review it before sending.";
    await trackEvent("loadscore_result_copied", {
      surface: "extension",
      share_method: "clipboard",
    });
  } catch {
    document.getElementById("share-status").textContent = "Copy was blocked on this page.";
  }
});

document.getElementById("save-load").addEventListener("click", async () => {
  if (savedLoads.length >= 7) {
    document.getElementById("save-status").textContent = "Remove a saved load before adding another";
    return;
  }
  const load = normalizeLoadLifecycle({ ...getLoadEntry(), id: crypto.randomUUID(), savedAt: new Date().toISOString() });
  const timing = validateLoadTiming(load);
  if (timing.errors.length > 0) {
    document.getElementById("save-status").textContent = timing.errors[0];
    return;
  }
  savedLoads = [
    load,
    ...savedLoads,
  ];
  await chrome.storage.local.set({ loadScoreSavedLoads: savedLoads });
  document.getElementById("save-status").textContent = "Load saved on this device";
  await trackEvent("load_saved", {
    surface: "extension",
    saved_load_count: savedLoads.length,
  });
  if ([load.pickupDate, load.pickupTime, load.deliveryDate, load.deliveryTime, load.expirationDate, load.expirationTime].some(Boolean)) {
    await trackEvent("load_timing_added", { surface: "extension", status: load.status });
  }
  if (load.equipment) await trackEvent("equipment_selected", { surface: "extension", equipment: load.equipment });
  if (load.status === "expired") await trackEvent("load_expired", { surface: "extension", status: "expired" });
  const form = getForm();
  const result = calculateLoadScore(form);
  const alertMatch = evaluateAlertMatch({ ...load, result }, form);
  const notificationDecision = await chrome.runtime.sendMessage({ type: "evaluateNotification", load, result, alertMatch });
  if (notificationDecision?.eligible) document.getElementById("save-status").textContent = "Load saved and match notification created";
  renderSavedLoads();
  await renderNotificationHistory();
});

document.getElementById("saved-loads").addEventListener("change", async (event) => {
  const select = event.target.closest('select[data-action="status"]');
  if (!select) return;
  savedLoads = savedLoads.map((load) => load.id === select.dataset.id ? { ...load, status: select.value } : load);
  await chrome.storage.local.set({ loadScoreSavedLoads: savedLoads });
  await trackEvent("load_status_changed", { surface: "extension", status: select.value });
  renderSavedLoads();
});

async function renderNotificationHistory() {
  const stored = await chrome.storage.local.get("loadScoreNotificationHistory");
  const history = Array.isArray(stored.loadScoreNotificationHistory) ? stored.loadScoreNotificationHistory.slice(0, 10) : [];
  document.getElementById("notification-history").innerHTML = history.length
    ? history.map((item) => `<div class="notification-item"><strong>${escapeHtml(item.state || "created")}</strong><span>${escapeHtml(new Date(item.createdAt).toLocaleString())}</span></div>`).join("")
    : '<p class="saved-empty">No notifications yet.</p>';
}

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
    await trackEvent("comparison_load_removed", {
      surface: "extension",
      saved_load_count: savedLoads.length,
    });
    renderSavedLoads();
  }
});

const stored = await chrome.storage.local.get([
  "loadScoreDefaults",
  "loadScoreDraft",
  "loadScoreSavedLoads",
  "loadScoreNotificationSettings",
]);
savedLoads = Array.isArray(stored.loadScoreSavedLoads) ? stored.loadScoreSavedLoads : [];
const notificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS, ...(stored.loadScoreNotificationSettings || {}) };
document.getElementById("notifications-enabled").checked = notificationSettings.enabled;
document.getElementById("quiet-start").value = notificationSettings.quietStart;
document.getElementById("quiet-end").value = notificationSettings.quietEnd;
document.getElementById("analytics-consent").checked = await getCentralAnalyticsConsent();
setForm({ ...(stored.loadScoreDefaults || {}), ...(stored.loadScoreDraft || {}) });
renderSavedLoads();
await renderNotificationHistory();
await initializeExtensionAnalytics();
if (savedLoads.length > 0) {
  await trackEvent("comparison_viewed", {
    surface: "extension",
    saved_load_count: savedLoads.length,
  });
}
