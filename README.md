# LoadScore MVP

LoadScore is a React/Vite decision-support calculator for drivers,
owner-operators, dispatchers, and small fleets. It estimates the true value of a
load after deadhead, fuel, fixed operating costs, profit, and destination reload
strength.

## Implemented phases

- Phase 1: Manual load calculator and feedback form
- Phase 2: Expanded city autocomplete and separate curated reload estimates
- Phase 3: Score explanations with positives, warnings, and recommendation logic
- Phase 4: Save, compare, and rank up to five candidate loads
- Phase 5: Minimum acceptable rate and broker negotiation guidance
- Phase 6: Chrome extension manual calculator popup
- Phase 7: Explicit highlighted-text parsing for visible load offers
- Phase 8: Local saved driver profiles and preferences
- Phase 9: Paid-beta feature gates and launch checklist
- Phase 10: Top-seven ranking, local score alerts, persistence, and PWA foundation

Reload estimates are static starter data, not live freight-market data. A city
without a curated estimate receives a neutral reload score of `50`.

## Local development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run lint
npm run build
```

The minimum-rate calculation uses the higher of:

1. Total miles × the user's target all-in RPM
2. Estimated operating cost + the user's minimum desired trip profit

The result rounds up to the next $25 to provide a practical negotiation number.
