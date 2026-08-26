# Free vs Driver Pro Entitlements

Status: **PRO-0 architecture decision only. No feature gates are active.**

## Product contract

- Free answers: **Is this load worth considering?**
- Driver Pro answers: **Which load fits my truck best, what should I ask for, and what should I do next?**
- Manual load economics stay useful without an account.
- Accounts are required only for paid access, restoring access, and later opt-in cloud features.
- One website and one Chrome extension serve both plans.
- Raw freight remains local by default.
- All currently shipped features remain available during the present free beta. This table is the target boundary for a later controlled paid beta, not an active paywall.

## Capability matrix

| Entitlement key | Target | Limit | Rationale |
|---|---|---:|---|
| `manual_load_scoring` | FREE | — | Core decision utility |
| `gross_rpm` | FREE | — | Basic load economics |
| `all_in_rpm` | FREE | — | Basic load economics |
| `fuel_cost` | FREE | — | Basic cost visibility |
| `fixed_operating_cost` | FREE | — | Basic cost visibility |
| `estimated_profit` | FREE | — | Core viability answer |
| `deadhead_analysis` | FREE | — | Core true-value calculation |
| `reload_score` | FREE | — | Core positioning context; current values are curated/static |
| `score_explanation` | FREE | — | Trust and safety require explanation |
| `minimum_rate_basic` | FREE | — | Shows the threshold that makes a load viable |
| `minimum_rate_advanced` | PRO | — | Scenario and negotiation workflow beyond the basic threshold |
| `broker_message` | PRO | — | Action-oriented negotiation workflow |
| `result_sharing` | FREE | — | Supports useful discussion and beta growth |
| `structured_feedback` | FREE | — | Required for product learning |
| `beta_diagnostics` | FREE | — | Required for safe support; excludes freight/private data |
| `profiles` | FREE_LIMITED | 1 | One truck can be personalized without paying |
| `profiles` | PRO | 5 | Multiple working configurations are repeat-use value |
| `saved_loads` | FREE_LIMITED | 3 | Enough to evaluate the feature honestly |
| `saved_loads` | PRO | 50 | Practical local history without promising cloud storage |
| `comparison` | FREE_LIMITED | 3 | Useful small decision set |
| `comparison` | PRO | 7 | Full implemented Top 7 workflow |
| `top_7` | PRO | 7 | Primary multi-load Pro workflow |
| `operating_mode_preferred` | FREE | — | Keep all modes available during beta |
| `operating_mode_flexible` | FREE | — | Keep all modes available during beta |
| `operating_mode_recovery` | FREE | — | Keep all modes available during beta |
| `highlight_parser_basic` | FREE | — | Quick extension value remains useful |
| `highlight_parser_advanced` | PRO | — | Expanded timing/equipment/reference extraction saves repeat work |
| `bulk_paste` | PRO | 250 rows/import | Implemented high-volume workflow; current validation ceiling remains |
| `csv_import` | PRO | 250 rows/import | Implemented high-volume workflow; current validation ceiling remains |
| `alert_basic` | FREE | 1 active rule set | Lets Free users experience local matching |
| `alert_advanced` | PRO | — | Expanded rules, histories, and multiple configurations |
| `cloud_profiles` | FUTURE_PRO | — | Not implemented; explicit opt-in only |
| `cloud_history` | FUTURE_PRO | — | Not implemented; raw freight stays local unless explicitly selected |
| `lookahead` | FUTURE_PRO | — | Not implemented or driver-validated |
| `journey_score` | FUTURE_PRO | — | Not implemented or driver-validated |
| `market_intelligence` | FUTURE_PRO | — | Requires approved, timestamped data |
| `approved_integrations` | FUTURE_PRO | — | Requires provider rights/contracts and lawful intake |
| `fleet_administration` | NOT_READY | — | Different roles, permissions, buyer, and support model |
| `brokerage_marketplace` | NOT_READY | — | Different product and legal/regulatory scope |

## Plan and capability model

Initial plan identifiers:

- `free`
- `founding_driver_pro`
- `driver_pro`

Plans resolve on the server to versioned capability keys and numeric limits. Components ask for a capability or limit; they do not inspect the plan name or a global `isPro` value.

Conceptual calls:

```js
canUse("bulk_paste")
canUse("broker_message")
limitFor("comparison")
limitFor("profiles")
```

The server is authoritative. A client cache may improve offline UX, but editing local storage can never create a paid server entitlement.

## Gate types

- **Soft gate:** explain Pro value without interrupting normal Free work. Example: a small Top 7 explanation after a three-load comparison.
- **Hard gate:** a clearly Pro-only workflow. Example: CSV import.
- **Limit gate:** allow use through the Free limit, then explain the exact limit and upgrade path. Example: attempting to add a fourth comparison load.

Never show a disabled control without an explanation, nag after every calculation, or block core economics.
