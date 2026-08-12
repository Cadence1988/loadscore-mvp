export const LOAD_STATUSES = ["available", "viewed", "interested", "requested", "pending_confirmation", "booked", "covered", "expired", "rejected"];
export const ACTIVE_LOAD_STATUSES = new Set(["available", "viewed", "interested", "requested", "pending_confirmation"]);
export function completeLocalDateTime(date, time) {
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? null : value;
}
export function isLoadExpired(load, now = new Date()) {
  if (load?.status === "expired") return true;
  const expiresAt = completeLocalDateTime(load?.expirationDate, load?.expirationTime);
  return expiresAt ? expiresAt.getTime() <= now.getTime() : false;
}
export function isActiveLoad(load, now = new Date()) {
  return ACTIVE_LOAD_STATUSES.has(load?.status || "available") && !isLoadExpired(load, now);
}
export function normalizeLoadLifecycle(load = {}, now = new Date()) {
  const normalized = { ...load, status: LOAD_STATUSES.includes(load.status) ? load.status : "available" };
  return isLoadExpired(normalized, now) ? { ...normalized, status: "expired" } : normalized;
}
export function validateLoadTiming(load) {
  const errors = [];
  const warnings = [];
  for (const [label, date, time] of [["Pickup", load.pickupDate, load.pickupTime], ["Delivery", load.deliveryDate, load.deliveryTime], ["Expected empty", load.expectedEmptyDate, load.expectedEmptyTime], ["Expiration", load.expirationDate, load.expirationTime]]) {
    if ((date && !time) || (!date && time)) warnings.push(`${label} needs both a date and time.`);
  }
  const pickup = completeLocalDateTime(load.pickupDate, load.pickupTime);
  const delivery = completeLocalDateTime(load.deliveryDate, load.deliveryTime);
  const empty = completeLocalDateTime(load.expectedEmptyDate, load.expectedEmptyTime);
  if (pickup && delivery && delivery < pickup) errors.push("Delivery cannot be before pickup.");
  if (delivery && empty && empty < delivery) errors.push("Expected empty time cannot be before delivery.");
  return { errors, warnings, expired: isLoadExpired(load) };
}
