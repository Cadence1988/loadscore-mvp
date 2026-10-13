# FREE-2: Progressive Scoring and Driver Calibration

Status: implemented for website beta `2026.10.12-beta.10`.

## Score-state contract

| State | Meaning | Current use |
| --- | --- | --- |
| `incomplete` | Not enough input for a defensible score | NearSight before rate/loaded miles; ForeSight before destination |
| `preliminary` | Useful partial result with an important input missing | NearSight has rate and loaded miles but deadhead is unknown |
| `complete` | Required inputs for that view are present | NearSight with known deadhead; ForeSight with a curated destination score |
| `limited_data` | Driver input is sufficient, but trusted market intelligence is unavailable | ForeSight for an unscored destination; never numeric |

NearSight still uses the FREE-1 immediate-economics thresholds and normalization. ForeSight still uses the exact existing curated Reload Score. The main LoadScore formula and comparison ranking are unchanged.

## Reactive flow and minimum inputs

- The calculator recomputes from React state immediately; there is no fake delay or “AI analyzing” state.
- Main LoadScore keeps its existing completeness/trust boundary: origin, destination, positive rate, positive loaded miles, and known deadhead are required for a complete, rankable evaluation.
- NearSight starts with positive rate and positive loaded miles. It is preliminary until deadhead is entered or explicitly confirmed as zero.
- ForeSight needs a destination before lookup. A destination not present in `marketScores.js` returns `limited_data`, not the legacy numeric default.

## Saved and comparison loads

Saved loads remain under the existing `loadscore-comparisons` local-storage key and retain their existing raw form fields and main `result`. The comparison board derives NearSight and ForeSight at render time through `calculateStoredLoadDualScore`; it does not persist a second authoritative score. Older entries with missing fields degrade to unavailable, preliminary, or limited-data labels without migration. Ranking remains main LoadScore, estimated profit, then all-in RPM.

## Driver calibration

The Decision Lens asks an optional “Yes / Mostly / No” question. Mostly and No can include one coarse reason; there is no free text and no sign-in requirement. The event `dual_score_feedback_submitted` allows only:

- `surface`
- `response`
- `reason_category`
- `nearsight_band`
- `foresight_band`

No lane, city, rate, mileage, deadhead, profit, exact score, broker field, pasted text, email, account identifier, or Stripe identifier is sent.

## FREE-3 geography integration seams

- `src/components/AutocompleteInput.jsx` filters the static `src/data/cities.js` array directly.
- `src/App.jsx`, `src/components/BulkImport.jsx`, and the comparison Decision Lens call `getCuratedMarketScore` from `src/data/marketScores.js`.
- `src/logic/loadNormalizer.js` and highlighted-text parsing preserve route text as city/state strings; normalization currently trims/collapses text rather than assigning stable geographic IDs.
- Saved loads persist human-readable `origin` and `destination` strings. A future authoritative dataset should retain those display strings while introducing a versioned, stable geographic identifier as optional metadata.
- The extension has its own parser and form strings and does not import the website city or market modules.
- Replacing the current static list with a national dataset will require indexed search, aliases, canonicalization, duplicate city/state handling, dataset versioning, and tests for performance and backward compatibility. It must not make nearby-city or state-level market inferences.

## Future mileage integration seam

Manual `loadedMiles` and `deadheadMiles` remain authoritative today. Validation is in `src/logic/inputValidation.js`; evaluation completeness is in `src/logic/evaluationTrust.js`; consumers include main scoring, NearSight, minimum rate, operating-mode alerts, bulk intake, saved comparisons, sharing, and extension copies. A future routing adapter should return estimated mileage plus provider/source/version metadata, mark whether a value is estimated or driver-entered, preserve manual override priority, invalidate stale estimates when route fields change, and keep older local records readable. No routing API is included in FREE-2.

## Known limits

- Curated destination coverage remains intentionally limited.
- Calibration is anonymous and coarse; it does not learn per-driver preferences yet.
- Decision Lens has not been added to the Chrome extension.
- Automatic routing, national geography, and new market datasets remain future work.
