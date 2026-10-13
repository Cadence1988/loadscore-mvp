# FREE-3 National Geography Foundation

## Architecture

```text
Official 2026 Census Gazetteer ZIPs
  -> scripts/data/build-census-geography.mjs
  -> compact deterministic place artifact
       -> website lazy autocomplete
       -> byte-identical extension artifact
  -> separate non-browser ZCTA reference
```

The canonical place model exposes `id`, `geoid`, `name`, `stateCode`, `displayName`, `latitude`, `longitude`, `geographyType`, `source`, and `sourceVintage`. Display text remains `City, ST`; identity is `place:<Census GEOID>`, never display text alone.

## Audit of the former architecture

- `src/data/cities.js` was a manually maintained 142-string universe and `AutocompleteInput.jsx` scanned it directly.
- Origin/destination, saved comparisons, bulk imports, fingerprints, sharing, alert preferences, and extension saved loads preserve human-readable strings.
- `marketScores.js` keyed 44 researched markets by normalized `City, ST` strings.
- Web pasted/CSV parsing and extension highlighted-text parsing extract city/state strings with regular expressions; they did not validate against a national place universe.
- The extension had no city autocomplete and maintained a separate parser.
- The only small/static-universe assumption was autocomplete's direct in-memory filter. Scoring itself never depended on the 142-entry list.

## Current behavior

- National autocomplete lazy-loads 32,071 official Census places only when a location field is used and renders at most 10 results.
- Search is case-insensitive, whitespace- and common-punctuation-tolerant, supports `City, ST` and `City ST`, and keeps state codes visible for disambiguation.
- The legacy 142 freight cities remain an autocomplete tie-break priority only. They do not affect LoadScore, NearSight, ForeSight, or Reload Score.
- City-only exact matches resolve only when unique. `Springfield` is ambiguous; `Springfield, IL` resolves.
- Existing strings remain untouched in local storage. Exact unambiguous legacy values can resolve to canonical records; unknown strings are preserved.
- All 44 curated markets resolve to canonical places and retain their exact existing scores. National geography does not create reload intelligence.
- A recognized but unscored place produces ForeSight `limited_data` with no numeric score.

## Website / extension relationship

The generator writes byte-identical compact place data to the website and extension. `src/logic/geographyCore.js` is the canonical runtime implementation and the generator copies it to `extension/geographyCore.js`; tests require exact file parity. Extension 0.6.2 uses the dataset for native capped suggestions and canonicalizes only unambiguous manually entered or deliberately highlighted locations. No permission or network request was added; the data is packaged locally.

## Performance strategy

The 3.37 MB place JSON is a separate lazy static asset, so it does not inflate the initial JavaScript bundle. It hydrates and indexes once in memory. Local warm search averaged roughly 15 ms across representative queries. The ZCTA artifact is not placed under `public` and is not shipped to browsers. The extension package includes its local place artifact for offline use.

## Future Place / ZCTA / mileage model

- **Place:** stable Census GEOID plus display name and representative point.
- **State:** explicit USPS-style two-letter code from the Gazetteer record; not inferred from text alone.
- **ZCTA:** separate Census statistical-area identifier and representative point; not a USPS ZIP authority.
- **User ZIP:** future raw user input requiring explicit resolution and ambiguity handling.
- **Routing point:** future provider-specific waypoint selected with source/version metadata.
- **Estimated route miles:** future routing-engine output, invalidated when route inputs change.
- **Driver-entered/paid miles:** remains user authority and must override estimates when deliberately entered.

There is no guaranteed one-to-one Place-to-ZCTA relationship. Coordinates must never be converted to straight-line truck mileage.

## FREE-4 integration points

FREE-4 may attach researched market intelligence to stable place IDs while keeping provenance, coverage, equipment/time context, and confidence explicit. It must not assign scores to all national places merely because they are recognized. Seasonal, commodity, port, FAF/CFS/USDA/BTS, and routing work require separate approved builds.
