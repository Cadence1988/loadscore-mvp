# LoadScore Privacy Policy — Beta Draft

Last updated: August 31, 2026

LoadScore helps drivers evaluate freight opportunities. This policy describes the current web and Chrome extension beta.

LoadScore labels evaluations with missing material information, including unknown deadhead, as provisional or needing review. This is a product-safety behavior and does not transmit the missing information.

## Local notifications

If a user explicitly enables match notifications, LoadScore uses locally saved load details, local alert preferences, quiet hours, duplicate keys, and local notification history to decide whether to show a Chrome notification. Notifications are off by default. This does not enable load-board monitoring or scraping.

## Pasted text and CSV imports

Pasted freight text and selected CSV files are parsed and evaluated locally in the web browser. Raw pasted text, CSV rows, routes, and broker information are not included in product analytics. The current beta does not upload import files to a LoadScore backend because no such production backend exists.

## Information stored locally

LoadScore may store truck-cost settings, alert preferences, drafts, saved loads, profiles, local feedback, notification settings/history, a random anonymous analytics identifier, and a bounded local product-event history in the browser or extension storage. Web and extension storage are currently separate.

Clearing the website's browser storage or removing/resetting the extension deletes the corresponding local data.

## Optional website account

LoadScore offers optional email magic-link accounts through Supabase Auth. Supabase processes the email address and authentication/session records needed to sign in. When the PRO-2 database migration is activated, Supabase also stores a minimal account-profile row and a Free/inactive account-tier foundation row. The browser may read only its own safe account state and may update only its own display name; it cannot write billing/tier state. LoadScore does not send account email, user UUID, database IDs, magic-link token, authorization code, or session tokens to PostHog. Creating an account does not upload local freight, truck settings, saved loads, comparisons, alerts, imports, or preferences. Signing out does not delete that local data. Account deletion/support procedures must be finalized before broad production account distribution.

The PRO-3 billing foundation is test-mode only. During a founder-run Stripe test, Stripe may receive the authenticated LoadScore account UUID as a customer/subscription mapping identifier and the selected allowlisted test-plan key; Stripe processes test Checkout/payment details on its hosted page. LoadScore stores server-authoritative Stripe customer/subscription relationships, safe subscription status/dates, and a minimal webhook event receipt ledger in Supabase. The ledger does not store full webhook payloads, card data, email, billing addresses, or freight. These billing identifiers and events are excluded from PostHog. A Checkout redirect does not grant paid access, and no live charging or paid capability is enabled in PRO-3.

## Highlighted text

The extension accesses highlighted, user-visible page text only after the user clicks “Use highlighted load text.” It attempts to recognize route, rate, and mileage fields. The raw highlighted text is not retained in analytics and is not sent to a LoadScore server in the current beta. Recognized values may be placed in the local form or saved locally when the user chooses.

## Optional product analytics

Essential local application storage works without optional centralized analytics. Optional analytics defaults off and requires the user to enable it.

If a centralized analytics destination is configured, LoadScore may transmit an anonymous random installation identifier, event name, timestamp, product surface, score band, reload-source category, feature-use indicators, parser outcome, alert status, and structured feedback reason codes. Analytics excludes raw highlighted text, entire freight messages, lanes, broker contacts, passwords, load-board credentials, third-party cookies, and unnecessary personal information.

No centralized analytics provider is configured in the current source release. This policy must be updated with the selected provider, retention period, and subprocessors before central collection is activated.

## Feedback

Quick structured recommendation feedback is stored locally in the current beta. The separate feedback form opens the user's email application so the user can review the message before sending it. Email feedback is handled by the user's email provider and the LoadScore support mailbox.

## Sharing

LoadScore creates a previewable text summary only after the user chooses Copy or Share. The summary may contain lane, offered rate, score, estimated economics, reload estimate, score reasons, and minimum rate. It excludes raw highlighted text, broker contacts, account data, and credentials. Native sharing is handled by the operating system or chosen receiving application.

## Notifications

Notifications default off. If enabled, the extension may create local notifications for saved or user-provided loads that match the user's rules. Notification history and duplicate-suppression data are stored locally and bounded. LoadScore does not monitor load boards automatically.

## Retention

Local analytics history is bounded to 200 events. Local structured feedback is bounded to 50 entries. Notification history is bounded as documented in the current product. A future central provider's retention must be documented before activation.

## Data sale and advertising

LoadScore does not sell personal information or use current beta data for targeted advertising.

## Security and limitations

No method of storage is perfectly secure. The current beta relies primarily on browser/extension storage. Optional authentication does not provide cloud freight storage, local-data synchronization, or cross-device recovery.

## Contact

Questions may be directed to rgm88@loadscore.app. Founder must verify this address and publish this policy at a stable public URL before Chrome Web Store submission.
