/* global chrome */
import { addNotificationHistory, buildNotificationContent, evaluateNotification } from "./notificationEngine.js";
import { trackEvent } from "./analytics.js";

const SETTINGS_KEY = "loadScoreNotificationSettings";
const SEEN_KEY = "loadScoreNotificationSeenKeys";
const HISTORY_KEY = "loadScoreNotificationHistory";

async function recordSuppression(reason) {
  const event = reason === "duplicate"
    ? "notification_suppressed_duplicate"
    : reason === "quiet_hours"
      ? "notification_suppressed_quiet_hours"
      : null;
  if (event) await trackEvent(event, { surface: "extension", suppression_reason: reason });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "evaluateNotification") return false;
  void (async () => {
    const stored = await chrome.storage.local.get([SETTINGS_KEY, SEEN_KEY, HISTORY_KEY]);
    const decision = evaluateNotification({
      load: message.load,
      alertMatch: message.alertMatch,
      settings: stored[SETTINGS_KEY],
      seenKeys: stored[SEEN_KEY] || [],
    });
    if (!decision.eligible) {
      await recordSuppression(decision.reason);
      sendResponse(decision);
      return;
    }
    const content = buildNotificationContent(message.load, message.result);
    const notificationId = `loadscore-${decision.key}-${Date.now()}`;
    await chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl: "icons/icon-128.png",
      title: content.title,
      message: content.message,
      contextMessage: "Saved locally in LoadScore",
      buttons: [{ title: "Dismiss" }],
      priority: 1,
    });
    const item = { id: notificationId, key: decision.key, createdAt: new Date().toISOString(), state: "created" };
    await chrome.storage.local.set({
      [SEEN_KEY]: [decision.key, ...(stored[SEEN_KEY] || []).filter((key) => key !== decision.key)].slice(0, 100),
      [HISTORY_KEY]: addNotificationHistory(stored[HISTORY_KEY], item),
    });
    await trackEvent("notification_created", { surface: "extension", notification_reason: decision.reason });
    sendResponse({ ...decision, notificationId });
  })().catch(() => sendResponse({ eligible: false, reason: "notification_error" }));
  return true;
});

async function updateHistory(id, state) {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const history = (stored[HISTORY_KEY] || []).map((item) => item.id === id ? { ...item, state, updatedAt: new Date().toISOString() } : item);
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
}

chrome.notifications.onClicked.addListener((id) => {
  void updateHistory(id, "opened");
  void trackEvent("notification_opened", { surface: "extension" });
  if (chrome.action.openPopup) void chrome.action.openPopup().catch(() => undefined);
});

chrome.notifications.onButtonClicked.addListener((id) => {
  void chrome.notifications.clear(id);
  void updateHistory(id, "dismissed");
  void trackEvent("notification_dismissed", { surface: "extension" });
});

chrome.notifications.onClosed.addListener((id, byUser) => {
  if (byUser) {
    void updateHistory(id, "dismissed");
    void trackEvent("notification_dismissed", { surface: "extension" });
  }
});
