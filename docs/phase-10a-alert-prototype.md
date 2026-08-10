# Phase 10A — User-Controlled Alert Prototype

Status: implemented locally and awaiting user review.

## What it does

Phase 10A evaluates only loads the user manually enters, saves, or supplies
through highlighted-text parsing. It does not discover or monitor loads.

The reusable alert evaluator returns:

```js
{
  status: "match" | "near_match" | "no_match" | "missing_data",
  matches: true | false,
  passedRules: [],
  failedRules: [],
  warnings: [],
  missingFields: [],
  explanation: ""
}
```

It evaluates:

- Minimum LoadScore
- Minimum all-in RPM
- Minimum estimated profit
- Maximum deadhead
- Minimum reload score
- Optional preferred destinations or regions
- Optional avoided destinations or regions
- Required origin, destination, offered rate, and loaded miles

Multiple destination preferences are separated with semicolons so city/state
commas remain intact.

## Status behavior

- **Matches alert:** all configured rules pass.
- **Almost matches:** exactly one rule fails and is within a documented tolerance,
  or the destination is outside an optional preferred list.
- **Does not match:** multiple rules fail, a target is missed materially, or an
  avoided destination matches.
- **Missing data:** required load fields are absent.

Near-match tolerances are intentionally simple and transparent:

- LoadScore within 5 points
- All-in RPM within $0.15
- Profit within the greater of $100 or 15% of the target
- Deadhead within 25 miles of the maximum
- Reload score within 10 points

## Web app

- Local alert preferences are stored with existing browser preferences.
- Named driver profiles include the alert rules.
- The current manual load shows an immediate local alert evaluation.
- Every saved comparison load shows a status and explanation.
- Existing top-seven ranking remains LoadScore, estimated profit, then all-in RPM.
- Alert matching is an additional layer and does not reorder the table.

## Chrome extension

- The active manual or parsed load shows a local alert status and explanation.
- Saved loads are reevaluated against the current truck costs and alert rules.
- Saved-load cards show status and explanation.
- The extension action badge shows the number of matching saved local loads.
- Badge text is cleared when no saved loads match.
- The badge is refreshed when the popup opens or local data changes; no background
  monitor or scheduler exists.

## Browser notifications

Not implemented in Phase 10A. Adding the `notifications` permission before the
store submission would require additional permission disclosure, icon assets,
anti-repeat state, and hands-on Chrome testing. The local UI and badge establish
the matching foundation first without adding a permission that is not yet needed.

Recommended next notification task:

1. Add a user-facing opt-in toggle.
2. Add notification icon assets.
3. Request notification capability only after explicit user action.
4. Notify only when the user saves or parses a matching load.
5. Store a per-load notification marker to prevent repeats.
6. Test permission and Chrome Web Store disclosure behavior.

## Safety and disclosure boundaries

- Static reload estimates are not live market data.
- Unknown markets use a neutral reload score of 50.
- Calculator and alert results are estimates, not financial guarantees.
- Parsed highlighted text must be reviewed by the user.
- No private scraping, continuous monitoring, login bypassing, cookies, credentials,
  broad host permissions, or automatic booking.

## What future true alerting requires

- An approved or user-controlled load intake source
- Secure backend normalization and deduplication
- Server-side scheduling or event delivery
- Authentication and cloud preferences
- Expiration handling
- Notification consent, quiet hours, and repeat protection
- Source timestamps and clear data provenance
- Approved integrations rather than private-site scraping
