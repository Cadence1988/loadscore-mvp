# LoadScore Phases 6–10

## Phase 6: Chrome extension MVP

Implemented as an unpacked Manifest V3 extension in `extension/`:

- Manual calculator popup
- User-controlled truck defaults stored with `chrome.storage.local`
- No account, cookie, or site-data access

## Phase 7: Highlighted-text parsing

Implemented with explicit user action:

- User highlights a visible load offer
- User clicks **Use highlighted load text**
- The extension reads only the current selection
- Route, rate, loaded miles, and deadhead patterns are extracted when present
- The user must review parsed values

There are no automatic content scripts, broad host permissions, private API
calls, login access, or scraping loops.

## Phase 8: Saved profiles and preferences

Implemented locally in the web app:

- Named driver/truck profiles
- MPG, fuel price, fixed cost per mile
- Target all-in RPM and minimum trip profit
- Minimum LoadScore alert threshold
- Saved comparisons and settings persist in the browser

Cloud synchronization remains gated until authentication and a database are
chosen.

## Phase 9: Paid beta

Foundation only. Paid access is disabled in `src/config/productFeatures.js`.
Before activation, decide and configure:

1. Billing provider and product prices
2. Authentication provider
3. Database and account ownership model
4. Refund/cancellation language
5. Privacy policy and terms
6. Chrome Web Store developer account and listing review
7. Beta cohort, support process, and success metrics

Never place billing secret keys in the React app or Chrome extension. Checkout,
webhooks, and subscription authorization must run on a trusted server.

## Phase 10: Full-app foundation

Current foundation:

- Top-seven load comparison and ranking
- Local score-match alerts
- Persistent profiles, targets, and candidate loads
- Web app manifest and service worker for installability/offline fallback
- Explicit feature gates for future cloud profiles, push alerts, billing, and
  approved integrations

Next server-backed milestones:

1. Authentication and cloud profile sync
2. Saved load history with accepted/rejected outcomes
3. Server-authorized subscription entitlements
4. Opt-in push alerts
5. Approved market-data integrations with clear source timestamps
6. Mobile/PWA field testing before considering native apps
