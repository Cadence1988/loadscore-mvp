# FREE-5 Seasonal and Commodity Intelligence Methodology

## Boundary

FREE-5 is an internal research layer. It does not change the 44 curated Reload Scores, main LoadScore, NearSight, ForeSight, Decision Lens, recommendations, operating modes, saved comparisons, analytics, website UI, extension, routing, or mileage. It never claims that harvest or shipment movement equals truck availability.

## Official inputs

1. USDA AMS Agricultural Refrigerated Truck Quarterly, `Quarterly Shipment Volumes by Origin and Commodity`, retrieved 2026-10-12. The workbook contains quarterly refrigerated truck tonnage by origin and commodity from 2000 through partial 2026.
2. USDA NASS `Field Crops: Usual Planting and Harvesting Dates`, October 2010. Its usual dates are based on 20 years of historical crop-progress estimates plus specialist knowledge.
3. USDA NASS `Vegetables: Usual Planting and Harvesting Dates`, May 2007. It supplies state/season planting and harvest context compiled by NASS field offices with grower and specialist consultation.

Raw files stay in the operating-system temporary cache. Generated metadata retains source agency, dataset, URL, source page, vintage, retrieval date, transformation version, and SHA-256 checksum.

## FREE-4 commodity audit

FREE-4 SCTG2 codes 01–08 are treated as broadly agriculture-related for context: live animals/fish, cereal grains, other agricultural products, animal feed, meat/seafood, milled grain products, other foodstuffs, and beverages. Specialty-crop movement aligns most directly with SCTG2 03, but the categories are not equivalent and are never numerically combined.

The selected California, Arizona, Florida, Pacific Northwest, Texas-border, and Southeast markets show meaningful agriculture-related FREE-4 outbound shares or are important USDA gateway/research candidates. AMS refrigerated movement directly establishes REEFER context for the retained profiles. It does not establish dry-van relevance. AMS separately documents some western onion movement on open flatbeds, so FLATBED remains a noted possible context without a weight. All other unmeasured equipment relevance remains UNKNOWN.

No AMS origin in the selected workbook is city-level. Statewide origins align only as regional evidence; PNW and SOUTHEAST are broader multi-state proxies. Mexico-Arizona and Mexico-Texas align to border-gateway research, not domestic growing areas. The mapping model records these mismatches instead of claiming clean city precision.

## Structural profiles

Structural seasonality uses seven complete calendar years, 2019–2025. Partial 2026 records are retained separately with `automaticAdjustmentAllowed: false`. The workbook is quarterly, so FREE-5 does not infer monthly or weekly precision.

Commodity variants normalize into 14 groups: apples, berries, broccoli/cauliflower, citrus, grapes, leafy greens, lettuce, melons, onions, peppers, potatoes, sweet corn, tomatoes, and tree fruit. A profile requires at least five observed years and 1,000 total tons.

For each origin/group/year, quarterly shipment shares sum to one. Structural quarterly shares are the mean of the annual shares, preventing large years from dominating the seasonal shape. The annual quarterly baseline is 25%.

- Peak: share at least one-half population standard deviation above 25%.
- Shoulder: above 25% but below the peak threshold.
- Off: share at least one-half population standard deviation below 25%.
- Normal: remaining quarters.

Peak intensity is the largest quarterly share divided by 25%. Seasonal concentration is the Herfindahl sum of squared quarterly shares. Volume and peak-intensity percentiles use all retained AMS origin/commodity profiles.

## Historical consistency

Each year’s largest quarter is compared with the structural peak quarter. HIGH means agreement in at least five of seven years; MEDIUM means at least three; LOW means fewer than three. Missing years are explicit. Official negative correction rows are retained. If corrections leave an origin/commodity/year/quarter aggregate below zero, that aggregate is explicitly floored to zero and counted; negative movement is not treated as physical shipment volume.

## Harvest context

NASS usual harvest dates validate whether movement timing is agriculturally plausible. The older 2007 and 2010 vintages reduce confidence and never create current-year status. Harvest timing is supporting evidence—not a freight, capacity, or pricing signal.

Field corn, soybeans, wheat, and rice were explored through NASS. They are not assigned specialty-crop refrigerated profiles because this AMS workbook is not a compatible movement source for those bulk crops. No suitable livestock/meat movement series was integrated, so no livestock seasonality was fabricated.

## Market mapping

Fourteen FREE-4 markets are connected to eight AMS origin geographies. Statewide and broad multi-state origins retain scope-mismatch warnings. Mexico-Arizona and Mexico-Texas describe cross-border streams through gateways, not production in the named city. HIGH, MEDIUM, and LOW mapping confidence is deterministic and separate from historical-pattern confidence.

## Equipment context

The AMS workbook directly supports REEFER context. DRY_VAN, FLATBED, and UNKNOWN exist in the schema but receive no weights. Onion records preserve the AMS warning that some western movements can use open flatbeds; no share is inferred. Potato alternatives remain UNKNOWN because this source only quantifies refrigerated movement.

## FREE-4 connection and double counting

FREE-4 FAF annual agricultural flows represent structural freight. FREE-5 AMS movement describes the seasonal distribution of related activity, while NASS harvest dates describe agricultural timing. Adding all three at full weight would double- or triple-count related phenomena. Each market therefore carries a `doubleCountingKey`; a future model must estimate deviation from the structural baseline rather than adding raw signals.

## Founder-only review

Review statuses are `strong_seasonal_evidence`, `moderate_seasonal_evidence`, `weak_evidence`, `geography_mismatch`, `insufficient_history`, and `no_reliable_evidence`. Candidate labels identify future research only. They are prohibited from runtime scoring until a later methodology, validation, calibration, and founder-approval gate.
