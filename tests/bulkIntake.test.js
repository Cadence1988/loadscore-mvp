import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { flagDuplicates, IMPORT_ROW_LIMIT, normalizeCsvRows, normalizeLoad, parseCsvDocument, parsePastedLoads, suggestColumnMapping } from "../src/logic/loadNormalizer.js";
import { calculateLoadScore } from "../src/logic/calculateLoadScore.js";
import { evaluateOperatingModes, migrateOperatingModes } from "../src/logic/operatingModes.js";

test("clean and alternate CSV headers normalize to the same standard shape", async () => {
  const clean = parseCsvDocument(await readFile(new URL("fixtures/loads-clean.csv", import.meta.url), "utf8"));
  const mixed = parseCsvDocument(await readFile(new URL("fixtures/loads-mixed.csv", import.meta.url), "utf8"));
  const cleanRows = normalizeCsvRows(clean, suggestColumnMapping(clean.headers));
  const mixedRows = normalizeCsvRows(mixed, suggestColumnMapping(mixed.headers));
  assert.equal(cleanRows[0].load.origin, "Dallas, TX");
  assert.equal(mixedRows[0].load.destination, "Atlanta, GA");
  assert.equal(cleanRows[0].load.source, "csv");
});

test("malformed CSV and missing rows are reported", () => {
  assert.match(parseCsvDocument('origin,destination\n"Dallas,TX').error, /unclosed/);
  assert.match(parseCsvDocument("origin,destination").error, /at least one data row/);
});

test("duplicates are flagged rather than deleted", async () => {
  const document = parseCsvDocument(await readFile(new URL("fixtures/loads-mixed.csv", import.meta.url), "utf8"));
  const rows = flagDuplicates(normalizeCsvRows(document, suggestColumnMapping(document.headers)));
  assert.equal(rows.length, 3);
  assert.equal(rows[1].duplicate, true);
  assert.equal(rows[2].status, "missing_required");
});

test("missing deadhead remains distinct from confirmed zero", () => {
  const missing = normalizeLoad({ origin: "Dallas, TX", destination: "Atlanta, GA", loadRate: 2000, loadedMiles: 800 }, "pasted_text");
  const zero = normalizeLoad({ origin: "Dallas, TX", destination: "Atlanta, GA", loadRate: 2000, loadedMiles: 800, deadheadMiles: 0 }, "manual");
  assert.equal(missing.load.deadheadMiles, null);
  assert.match(missing.warnings.join(" "), /unknown/);
  assert.equal(zero.load.deadheadMiles, 0);
});

test("multi-load paste parses expanded fields and confidence", () => {
  const rows = parsePastedLoads(`Dallas, TX -> Atlanta, GA | Rate: $2500 | Miles: 810 | Deadhead: 35 | Equipment: Dry Van | Weight: 42000 | Stops: 1 | Ref: TEST-1\n\nHouston, TX -> Phoenix, AZ | Rate: $2100 | Miles: 1175 | Pickup: 2026-08-13 09:00 | Delivery: 2026-08-15 14:00`);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].load.equipment.toLowerCase(), "dry van");
  assert.equal(rows[0].load.weight, 42000);
  assert.equal(rows[1].load.pickupDate, "2026-08-13");
  assert.equal(rows[1].load.source, "pasted_text");
  assert.equal(rows[1].confidence.deadheadMiles.status, "missing");
});

test("normalized imports use unchanged score and operating-mode evaluators", () => {
  const row = normalizeLoad({ origin: "Dallas, TX", destination: "Atlanta, GA", loadRate: 1800, loadedMiles: 780, deadheadMiles: 35 }, "csv");
  const result = calculateLoadScore({ ...row.load, mpg: 6.5, fuelPrice: 4, fixedCostPerMile: 0.65, reloadScore: 60 });
  const modes = evaluateOperatingModes({ ...row.load, result }, migrateOperatingModes());
  assert.equal(result.score, 70);
  assert.equal(modes.flexible.matches, true);
});

test("250-row browser-local beta limit processes quickly and truncates extras", () => {
  const lines = ["origin,destination,rate,loaded_miles"];
  for (let index = 0; index < 300; index += 1) lines.push(`"City ${index}, TX","City ${index}, GA",2000,800`);
  const started = performance.now();
  const document = parseCsvDocument(lines.join("\n"));
  const rows = normalizeCsvRows(document, suggestColumnMapping(document.headers));
  const elapsed = performance.now() - started;
  assert.equal(rows.length, IMPORT_ROW_LIMIT);
  assert.equal(document.truncated, true);
  assert.ok(elapsed < 1000, `processing took ${elapsed}ms`);
});
