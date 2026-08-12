import test from "node:test";
import assert from "node:assert/strict";
import { addNotificationHistory, buildNotificationContent, evaluateNotification, isWithinQuietHours, safeLoadKey } from "../extension/notificationEngine.js";

const load = { origin: "Dallas, TX", destination: "Atlanta, GA", loadRate: 1800, loadedMiles: 780, status: "available", loadIdentifier: "ABC-1" };
const match = { matches: true };
const now = new Date("2026-08-12T12:00:00");
const settings = { enabled: true, quietStart: "22:00", quietEnd: "06:00" };

test("notifications are off by default and only matches qualify", () => {
  assert.equal(evaluateNotification({ load, alertMatch: match, settings: { ...settings, enabled: false }, now }).reason, "disabled");
  assert.equal(evaluateNotification({ load, alertMatch: { matches: false }, settings, now }).reason, "not_a_match");
  assert.equal(evaluateNotification({ load, alertMatch: match, settings, now }).eligible, true);
});

test("expired, duplicate, and quiet-hour notifications are suppressed", () => {
  const key = safeLoadKey(load);
  assert.equal(evaluateNotification({ load: { ...load, status: "expired" }, alertMatch: match, settings, now }).reason, "inactive_or_expired");
  assert.equal(evaluateNotification({ load, alertMatch: match, settings, seenKeys: [key], now }).reason, "duplicate");
  assert.equal(evaluateNotification({ load, alertMatch: match, settings, now: new Date("2026-08-12T23:00:00") }).reason, "quiet_hours");
  assert.equal(isWithinQuietHours(new Date("2026-08-12T05:30:00"), "22:00", "06:00"), true);
});

test("notification identity and content exclude broker contact and raw text", () => {
  const content = buildNotificationContent({ ...load, brokerReference: "private", rawText: "private" }, { score: 84 });
  assert.doesNotMatch(JSON.stringify(content), /private/);
  assert.equal(safeLoadKey(load), safeLoadKey({ ...load, brokerReference: "changed" }));
});

test("notification history stays bounded", () => {
  const history = Array.from({ length: 150 }, (_, index) => ({ id: index }));
  assert.equal(addNotificationHistory(history, { id: "new" }).length, 100);
  assert.equal(addNotificationHistory(history, { id: "new" })[0].id, "new");
});
