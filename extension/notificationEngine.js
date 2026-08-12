import { isActiveLoad } from "./loadLifecycle.js";

export const DEFAULT_NOTIFICATION_SETTINGS = { enabled: false, quietStart: "22:00", quietEnd: "06:00" };
export const MAX_NOTIFICATION_HISTORY = 100;

function minutes(time) {
  const [hour, minute] = String(time || "").split(":").map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
}

export function isWithinQuietHours(now, start, end) {
  const startMinutes = minutes(start);
  const endMinutes = minutes(end);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  return startMinutes < endMinutes
    ? current >= startMinutes && current < endMinutes
    : current >= startMinutes || current < endMinutes;
}

export function safeLoadKey(load = {}) {
  const source = load.loadIdentifier
    ? `id|${load.loadIdentifier}`
    : [load.source, load.origin, load.destination, load.loadRate, load.pickupDate, load.pickupTime].join("|");
  let hash = 5381;
  for (const character of source.toLowerCase()) hash = ((hash << 5) + hash) ^ character.charCodeAt(0);
  return `load-${(hash >>> 0).toString(36)}`;
}

export function evaluateNotification({ load, alertMatch, settings, seenKeys = [], now = new Date() }) {
  if (!settings?.enabled) return { eligible: false, reason: "disabled" };
  if (!load?.origin || !load?.destination || !Number(load?.loadRate)) return { eligible: false, reason: "missing_data" };
  if (!isActiveLoad(load, now)) return { eligible: false, reason: "inactive_or_expired" };
  if (!alertMatch?.matches) return { eligible: false, reason: "not_a_match" };
  const key = safeLoadKey(load);
  if (seenKeys.includes(key)) return { eligible: false, reason: "duplicate", key };
  if (isWithinQuietHours(now, settings.quietStart, settings.quietEnd)) return { eligible: false, reason: "quiet_hours", key };
  return { eligible: true, reason: "matching_saved_load", key };
}

export function buildNotificationContent(load, result) {
  return {
    title: `LoadScore ${Number(result?.score) || 0}: matching saved load`,
    message: `${load.origin} to ${load.destination} · $${Number(load.loadRate || 0).toLocaleString()} · ${Number(load.loadedMiles || 0).toLocaleString()} mi`,
  };
}

export function addNotificationHistory(history, item) {
  return [item, ...(Array.isArray(history) ? history : [])].slice(0, MAX_NOTIFICATION_HISTORY);
}

export function countActiveMatches(loads, evaluateMatch, now = new Date()) {
  return loads.filter((load) => isActiveLoad(load, now) && evaluateMatch(load)?.matches).length;
}
