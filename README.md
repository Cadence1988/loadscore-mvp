# LoadScore MVP

LoadScore is a React/Vite decision-support calculator for drivers,
owner-operators, dispatchers, and small fleets. It estimates the true value of a
load after deadhead, fuel, fixed operating costs, profit, and destination reload
strength.

## Implemented phases

- Phase 1: Manual load calculator and feedback form
- Phase 2: Expanded city autocomplete and separate curated reload estimates
- Phase 3: Score explanations with positives, warnings, and recommendation logic
- Phase 4: Save and compare candidate loads; the current Top 7 workflow ranks up to seven
- Phase 5: Minimum acceptable rate and broker negotiation guidance
- Phase 6: Chrome extension manual calculator popup
- Phase 7: Explicit highlighted-text parsing for visible load offers
- Phase 8: Local saved driver profiles and preferences
- Phase 9: Paid-beta architecture scaffold and launch checklist; paid access is not implemented
- Phase 10: Top-seven ranking, local score alerts, persistence, and PWA foundation
- Phase 10A: Transparent local alert rules, match explanations, and extension badge

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

## Driver Pro architecture status

PRO-0 and the PRO-1 website magic-link account system are implemented. PRO-2 now
contains a migration-driven secure account database/RLS foundation; production
migration and authenticated database-read verification remain pending. Anonymous
calculator use and local freight data are unchanged. LoadScore still has no
Stripe integration, paid subscription activation, entitlement enforcement, cloud
freight sync, or extension authentication. See:

- [`docs/driver-pro-architecture.md`](docs/driver-pro-architecture.md)
- [`docs/free-vs-pro-entitlements.md`](docs/free-vs-pro-entitlements.md)
- [`docs/paid-beta-roadmap.md`](docs/paid-beta-roadmap.md)
- [`docs/authentication.md`](docs/authentication.md)
- [`docs/database-and-rls.md`](docs/database-and-rls.md)
