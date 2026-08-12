# LoadScore Privacy Policy — Beta Draft

Last updated: August 12, 2026

LoadScore helps drivers evaluate freight opportunities. This policy describes the current web and Chrome extension beta.

## Local notifications

If a user explicitly enables match notifications, LoadScore uses locally saved load details, local alert preferences, quiet hours, duplicate keys, and local notification history to decide whether to show a Chrome notification. Notifications are off by default. This does not enable load-board monitoring or scraping.

## Information stored locally

LoadScore may store truck-cost settings, alert preferences, drafts, saved loads, profiles, local feedback, notification settings/history, a random anonymous analytics identifier, and a bounded local product-event history in the browser or extension storage. Web and extension storage are currently separate.

Clearing the website's browser storage or removing/resetting the extension deletes the corresponding local data. LoadScore does not currently provide server-side account deletion because accounts and cloud storage do not exist.

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

No method of storage is perfectly secure. The current beta relies primarily on browser/extension storage and does not provide cloud accounts or cross-device recovery.

## Contact

Questions may be directed to rgm88@loadscore.app. Founder must verify this address and publish this policy at a stable public URL before Chrome Web Store submission.
