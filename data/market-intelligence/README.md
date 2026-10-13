# Freight Market Intelligence Data

This directory contains reproducible, research-only FREE-4 artifacts. They do not feed the production calculator, Reload Score, Decision Lens, NearSight, ForeSight, recommendations, or Chrome extension.

## Build

Run `npm run build:market-intelligence`. The script downloads the official inputs into the operating-system temporary directory. Run it with `-- --offline` to rebuild from an existing cache.

## Official inputs

- BTS Freight Analysis Framework 6.0 regional CSV (`FAF6.0.zip`), base year 2022.
- BTS FAF6 Zones — 2022 CFS Geography shapefile (`FAF6.zip`).
- Census/BTS 2022 Commodity Flow Survey final table CF2200A01/GAS01 (`CF2200A01.zip`), truck mode 11.

Every output records the source URLs, release/vintage, retrieval date, and SHA-256 checksums.

## Outputs

- `faf6-region-indicators.json`: all 134 domestic FAF6 regions, truck flows, directional commodity profiles, lanes, CFS context, and normalized research indicators.
- `free4-markets.json`: the 44 existing curated markets plus the named priority-research markets, mapped through official FAF polygons.
- `../../docs/market-intelligence/free4-market-research.md`: human-readable mapping audit and controlled review queue.
- `free5-seasonal-profiles.json`: USDA AMS quarterly refrigerated-movement profiles, NASS harvest context, explicit market mappings, equipment context, confidence, and founder-only review labels.
- `../../docs/market-intelligence/free5-seasonality-research.md`: human-readable FREE-5 founder review report.

FAF tons are thousands of tons. FAF values are millions of constant 2022 U.S. dollars. Percentiles use all 134 domestic FAF6 regions. A city in a named CFS area receives HIGH mapping confidence; a city in a statewide/remainder area receives MEDIUM confidence. Unresolved points are never guessed.

The comparison flag is only a research triage heuristic. It never creates or replaces a market score. Equipment categories are schema placeholders only; no equipment, seasonal, mileage, routing, live-load, or load-board weighting is applied.

FREE-5 can be rebuilt with `npm run build:seasonal-intelligence`. It uses complete 2019–2025 AMS quarterly data for structural profiles and keeps partial 2026 observations separate. The AMS source represents refrigerated truck movement, so REEFER is the only observed equipment context; DRY_VAN, FLATBED, and UNKNOWN remain unweighted schema contexts. NASS 2007 vegetable and 2010 field-crop usual harvest dates provide supporting context only. No FREE-5 evidence is bundled into the website or extension.
