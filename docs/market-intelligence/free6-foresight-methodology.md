# FREE-6 ForeSight 2.0 Shadow Methodology

## Status and boundary

ForeSight 2.0 is `NOT_APPROVED_FOR_PRODUCTION`. It is an offline, founder-only research pipeline. The generated model and artifact are not imported by the website, extension, analytics, production ForeSight, NearSight, LoadScore, Decision Lens, recommendations, saved-load rankings, or comparison flows. The existing 44 curated scores remain authoritative.

## Candidate structural models

All candidates use FREE-4 percentiles normalized across 134 FAF6 domestic regions. They differ only in defensible emphasis:

| Candidate | Outbound | Total truck freight | Outbound balance | Commodity diversity |
|---|---:|---:|---:|---:|
| `outbound_led` (selected) | 40% | 30% | 20% | 10% |
| `balanced_flow` | 30% | 30% | 25% | 15% |
| `resilient_mix` | 30% | 25% | 20% | 25% |

`outbound_led` is selected because destination reload potential is most directly connected to outbound freight strength, total freight intensity provides the second anchor, balance adds directional context, and diversity is a smaller stabilizer. Selection is based on freight logic plus sensitivity review—not on forcing agreement with today's curated scores.

The structural formula is the weighted mean of the four percentiles, bounded to 0–100. It does not claim probability, capacity, rates, or real-time availability.

## Seasonal deviation

FREE-5 is used only to describe a market's current quarter relative to its own 2019–2025 structural quarterly pattern. For each eligible commodity profile, `(quarter average ratio - 1) × 8` is bounded to ±8. Eligible contributions are combined using square-root shipment-volume weights. Square-root weighting respects profile relevance without allowing raw agricultural magnitude to become a second structural freight score.

The final seasonal term is bounded to ±8 points. USDA NASS harvest dates remain qualitative support and add no points. Partial 2026 AMS observations are excluded.

## Equipment and confidence gates

- `REEFER`: eligible where AMS directly observes refrigerated movement.
- `DRY_VAN`, `FLATBED`: no adjustment because FREE-5 does not quantify those equipment shares.
- `UNKNOWN`: structural baseline only.
- HIGH geography + HIGH historical consistency + HIGH evidence confidence: full eligible modifier.
- Any MEDIUM and no LOW: 50% modifier.
- Any LOW, severe geography mismatch, stale evidence, non-REEFER evidence, or missing quarter: adjustment withheld.

Medium statewide/gateway mappings receive the reduced factor. LOW broad multi-state proxy mappings are withheld. No equipment conversion factor is invented.

## Freshness

- FAF6 base year 2022 is `AGING` at the 2026-10-12 evaluation date. It remains useful as structural context, not dynamic intelligence.
- Complete AMS 2019–2025 seasonal profiles are `CURRENT_ENOUGH` for structural seasonality.
- Partial 2026 data is reported in FREE-5 provenance but `currentYearDataUsed` is always false.
- Evidence too old for dynamic use becomes `STALE_FOR_DYNAMIC_USE`; missing evidence is `NOT_APPLICABLE`.

## Backtest and review

The deterministic Q4 REEFER research scenario covers all 44 curated markets, all 24 FREE-4 priority-only markets, and an explicit unresolved record for Eagle Pass. Eagle Pass receives no invented score because FREE-4 has no official mapped record for it. Unknown equipment always produces the structural-only result.

Curated deltas are classified as close agreement (≤5), moderate disagreement (6–10), or material disagreement (>10). Founder review categories are `STRONGLY_SUPPORTED`, `GENERALLY_SUPPORTED`, `EVIDENCE_STRONGER_THAN_CURRENT_SCORE`, `EVIDENCE_WEAKER_THAN_CURRENT_SCORE`, and `INSUFFICIENT_EVIDENCE`. A large delta is a research queue, not proof that the current score is wrong.

Sensitivity tests all three structural candidates, caps of 6/8/10, and MEDIUM-confidence factors of 0.35/0.50/0.65. A market is flagged unstable when structural rank range exceeds 10, structural score range exceeds 8, or seasonal scenario range exceeds 5.

## Why the model stays offline

Offline generation is the safer architecture: the research artifacts add no browser-bundle weight, create no accidental UI or recommendation dependency, cannot leak destination/equipment/commodity data to analytics, and keep website/extension parity intact. A future shared runtime module is possible only after founder approval and a controlled rollout design.

## Production activation gate

Activation requires founder review, final model selection, acceptable confidence coverage, calibration approval, a rollout plan, fallback behavior, and an extension parity plan. Current limitations—annual regional FAF evidence, seasonal coverage of only 14 mapped markets, material disagreements, and sensitivity flags—support the recommendation to gather more evidence first.
