import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extensionDistribution, PRIVACY_POLICY_PATH, VERIFIED_WEB_APP_URL } from "../src/config/extensionDistribution.js";
import { supportedEvents } from "../src/analytics/analytics.js";

test("Chrome Store CTA stays truthful until an official URL is configured", () => {
  assert.deepEqual(extensionDistribution(""), { available: false, storeUrl: "", label: "Chrome extension beta — Store release coming soon" });
  assert.equal(extensionDistribution("https://example.com/fake").available, false);
  const live = extensionDistribution("https://chromewebstore.google.com/detail/loadscore/abc");
  assert.equal(live.available, true);
  assert.match(live.label, /Get the LoadScore/);
});

test("distribution links have one verified web source and a public privacy path", () => {
  assert.equal(VERIFIED_WEB_APP_URL, "https://loadscore-mvp.vercel.app/");
  assert.equal(PRIVACY_POLICY_PATH, "/privacy.html");
});

test("install funnel events are allowlisted without personal data", () => {
  for (const event of ["extension_install_cta_viewed", "extension_install_cta_clicked", "extension_page_viewed", "open_full_loadscore_clicked"]) assert.equal(supportedEvents.has(event), true, event);
});

test("extension package includes new runtime modules and public privacy copy matches boundaries", async () => {
  const packaging = await readFile(new URL("../scripts/package-extension.ps1", import.meta.url), "utf8");
  assert.match(packaging, /inputUx\.js/);
  assert.match(packaging, /inputValidation\.js/);
  const privacy = await readFile(new URL("../public/privacy.html", import.meta.url), "utf8");
  assert.match(privacy, /extension reads deliberately highlighted/i);
  assert.match(privacy, /session replay.*disabled/i);
  assert.match(privacy, /does not automatically monitor load boards/i);
});
