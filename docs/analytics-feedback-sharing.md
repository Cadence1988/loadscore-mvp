# Analytics, Feedback, and Sharing Foundation

## Current status

LoadScore has a provider-independent `trackEvent(eventName, properties)` abstraction. No external analytics provider, account, endpoint, API key, or centralized dashboard is configured.

For this milestone, privacy-safe aggregate events are retained only in the current browser's local storage (maximum 200 events). Structured feedback is also local-only (maximum 50 entries). Clearing browser/extension storage removes the anonymous ID, repeat-use history, events, and feedback.

This is an instrumentation and testing foundation—not production analytics or centrally received driver feedback.

## Privacy boundary

Event properties are allowlisted. Raw highlighted text, raw freight offers, broker messages, origin/destination, broker contacts, driver names/emails, credentials, cross-site cookies, and load-board authentication data are not included in analytics events.

The anonymous identifier is randomly generated and stored locally. It is not fingerprinting and is not shared with a provider in the current build.

## First-driver beta learning additions

The current beta records an explicitly selected, allowlisted tester-source category; first successful complete calculation; second calculation; problem category; parser outcome/field category; feedback-form submission; and explicit willingness-to-pay response. A synthetic sample load emits only `sample_load_used` and does not count as real activation or calculation depth.

The in-product problem reporter stores only the driver's deliberately typed explanation plus structured categories. Its copyable diagnostic contains build versions, coarse browser category, random installation ID, selected mode, feature/error category, parser source/outcome/field status, and timestamp. It excludes raw freight text, routes, rates, broker contacts, credentials, cookies, and personal details. Email is prepared for the driver to review; it is never sent automatically.

## Periodic feedback trigger

The lightweight product prompt first becomes eligible after five meaningful, debounced calculations. After it is shown, it will not be shown again until at least ten additional calculations. It is optional and can be dismissed.

## Sharing

The web app supports clipboard copy and the Web Share API where available, with clipboard fallback. The extension supports clipboard copy. Shared text contains only the deliberately calculated lane summary, score, economics, selected score reasons, minimum rate, estimate notice, and the verified live Vercel URL.

## Future provider configuration

Before sending events to a real provider, define the vendor, consent/disclosure approach, retention/deletion rules, environment-specific configuration, event versioning, and production verification. Do not add provider secrets to client code.

Future referral attribution may add `referral_source`, `referral_code`, `referring_user_id`, `landing_source`, `signup_conversion`, and `paid_conversion` after accounts and consented centralized storage exist. Do not create fake user IDs before authentication exists.

QR support is a near-term growth feature for truck-stop sharing, printed Founding Driver cards, social media, fleet demos, and trucking events; it is not implemented in this milestone.
