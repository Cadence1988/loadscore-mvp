# FREE-4 Freight Market Intelligence Methodology

## Boundary and protected behavior

FREE-4 is a research foundation. The production calculator, 44 curated scores, unknown-market behavior, score formulas, Decision Lens, NearSight, ForeSight, analytics allowlist, local freight storage, billing/authentication, and extension remain unchanged. Generated evidence is not bundled into the website.

## Sources

The pipeline uses BTS FAF6.0 regional data and the official FAF6 Zones — 2022 CFS Geography polygons. It supplements those modeled flows with Census/BTS 2022 CFS final table CF2200A01/GAS01 truck-mode origin estimates. GAS01 is compact, region-aligned validation context; the public-use microdata and much larger detailed tables are intentionally outside this foundation.

Source URLs, vintages, retrieval dates, and SHA-256 hashes are embedded in each artifact. Raw archives remain in the operating-system temporary cache and are not committed.

## Transformation

The Node-only generator parses the official ZIP, DBF, shapefile, FAF CSV, and CFS table. FAF domestic mode `1` and CFS mode `11` identify truck records. It aggregates outbound and inbound thousand tons and million constant-2022-dollar values, commodity shares and diversity, and leading origin/destination regions. Ratios are zero-safe.

Research percentiles are calculated against all 134 domestic FAF6 regions for outbound freight, total handled truck freight, directional balance, and commodity diversity. They are relative indicators, not probabilities or live-market measurements.

## Market mapping and confidence

Each market is tied to its canonical Census place identifier and representative coordinates from the FREE-3 geography artifact. Point-in-polygon matching assigns the official FAF6 region. A named CFS area is HIGH confidence; a statewide or remainder region is MEDIUM confidence because it is a broad regional proxy. Failed containment is UNRESOLVED and is never repaired through name similarity or nearest-region guessing.

All 44 existing curated markets retain their exact scores. The priority list is added for research coverage only and receives no invented score.

## Controlled review flags

The review heuristic compares a current curated score with a simple composite of the research percentiles. It can label evidence `appears_consistent`, `needs_review`, `insufficient_evidence`, or `proxy_mismatch`. Priority-only markets are `not_applicable`. A flag is a queue for human research, never a recommendation or automatic score change.

## Known limitations

- FAF/CFS evidence is regional and annual, not city-level or real-time capacity.
- CFS shipper-survey estimates and FAF modeled totals have different coverage and should not be expected to match.
- Commodity categories do not establish trailer compatibility.
- Dry van, reefer, flatbed, and other equipment fields are schema-only; weights are disabled.
- No seasonality, lane mileage, route quality, broker data, private freight, scraped load-board data, or approved live integration is present.
- LoadScore remains a decision and alert layer, not a replacement load board.
