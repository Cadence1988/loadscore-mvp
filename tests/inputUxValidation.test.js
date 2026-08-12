import test from "node:test";
import assert from "node:assert/strict";
import { shouldSelectExistingValue as webShouldSelect } from "../src/logic/inputUx.js";
import { validateNumericField as validateWeb } from "../src/logic/inputValidation.js";
import { shouldSelectExistingValue as extensionShouldSelect } from "../extension/inputUx.js";
import { validateNumericField as validateExtension } from "../extension/inputValidation.js";

function input(value, type = "number") { return { tagName: "INPUT", type, value, readOnly: false, disabled: false }; }

test("populated web and extension inputs select for replacement on first entry", () => {
  assert.equal(webShouldSelect(input("45")), true);
  assert.equal(extensionShouldSelect(input("45")), true);
  assert.equal(webShouldSelect(input("")), false);
  assert.equal(webShouldSelect({ tagName: "TEXTAREA", value: "keep partial editing" }), false);
});

test("score boundaries accept 0 and 100 but reject values outside the range", () => {
  for (const validate of [validateWeb, validateExtension]) {
    assert.equal(validate("reloadScore", 0), "");
    assert.equal(validate("reloadScore", 100), "");
    assert.match(validate("reloadScore", 101), /between 0 and 100/);
    assert.match(validate("reloadScore", -1), /negative|between/);
  }
});

test("MPG, deadhead, rate, and temporary blanks validate safely", () => {
  assert.match(validateWeb("mpg", 0), /greater than 0/);
  assert.equal(validateWeb("mpg", 6.5), "");
  assert.equal(validateWeb("deadheadMiles", 0), "");
  assert.match(validateWeb("deadheadMiles", -1), /negative/);
  assert.equal(validateWeb("loadRate", ""), "Offered rate is required.");
  assert.equal(validateWeb("manualReloadScore", ""), "");
});

test("all operating mode thresholds share the same web and extension rules", () => {
  for (const field of ["minimumLoadScore", "targetAllInRpm", "targetProfit", "maximumDeadhead", "minimumReloadScore"]) {
    assert.equal(validateWeb(field, 50), validateExtension(field, 50), field);
  }
});
