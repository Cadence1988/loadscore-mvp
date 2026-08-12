import test from "node:test";
import assert from "node:assert/strict";
import { isActiveLoad, isLoadExpired, normalizeLoadLifecycle, validateLoadTiming } from "../src/logic/loadLifecycle.js";

const now = new Date("2026-08-12T12:00:00");

test("old saved loads remain active and gain the available status", () => {
  assert.equal(normalizeLoadLifecycle({ origin: "Dallas" }, now).status, "available");
  assert.equal(isActiveLoad({ origin: "Dallas" }, now), true);
});

test("expiration requires a complete date and time", () => {
  assert.equal(isLoadExpired({ expirationDate: "2026-08-11" }, now), false);
  assert.match(validateLoadTiming({ expirationDate: "2026-08-11" }, now).warnings[0], /both a date and time/);
  assert.equal(isLoadExpired({ expirationDate: "2026-08-11", expirationTime: "23:00" }, now), true);
});

test("timing validation rejects reversed pickup, delivery, and expected empty times", () => {
  const validation = validateLoadTiming({
    pickupDate: "2026-08-13", pickupTime: "12:00",
    deliveryDate: "2026-08-13", deliveryTime: "10:00",
    expectedEmptyDate: "2026-08-13", expectedEmptyTime: "09:00",
  }, now);
  assert.equal(validation.errors.length, 2);
});

test("booked and covered loads are inactive", () => {
  assert.equal(isActiveLoad({ status: "booked" }, now), false);
  assert.equal(isActiveLoad({ status: "covered" }, now), false);
});
