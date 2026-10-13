# Website / Extension Scoring Parity

Status: FREE-3 shares national geography data and normalization through one generated pipeline. Extension version is `0.6.2`.

## FREE-3 geography parity

The website and extension receive byte-identical `places-2026.json` artifacts from the Census geography builder. The canonical `src/logic/geographyCore.js` is copied into the extension by that same build, and automated tests require exact source and artifact parity. The extension uses its packaged local copy for capped native suggestions and unambiguous parser canonicalization. It adds no permissions and makes no runtime network request.

## Current duplication

- Main scoring exists in both `src/logic/calculateLoadScore.js` and `extension/loadScore.js`.
- Minimum-rate logic exists in both `src/logic/calculateMinimumRate.js` and `extension/loadScore.js`.
- Freight-text parsing exists in both `src/logic/loadNormalizer.js` and `extension/loadScore.js`.
- Validation, evaluation-trust, lifecycle, operating-mode, alert, analytics, and share-result helpers also have website and extension copies.
- NearSight, ForeSight, the explicit FREE-2 states, and calibration still exist only on the website.

## Risk

Independent copies can drift in thresholds, defaults, parser behavior, privacy allowlists, lifecycle rules, and explanatory text. A website release can therefore produce a different result from an older extension even when both receive the same inputs.

## Future shared-module strategy

1. Move pure, browser-safe domain functions into canonical modules with no React, DOM, storage, or extension API dependencies.
2. Make both Vite and the extension packaging process consume the same source modules, or generate the extension copies from those modules during a verified packaging step.
3. Keep UI adapters, storage, and browser permissions separate.
4. Add contract fixtures that execute identical inputs against website and packaged-extension builds and fail on any result difference.
5. Version the scoring contract and data snapshots in diagnostics so mismatches can be identified without collecting freight details.
6. Only then add Decision Lens to the extension and advance its version.

Every future scoring or parsing change still requires an explicit parity audit. Never silently copy website-only behavior into extension `0.6.2`.
