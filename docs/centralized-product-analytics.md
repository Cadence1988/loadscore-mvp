# Privacy-First Centralized Product Analytics

Updated: 2026-08-12

## Status and provider

The adapter is complete and configuration-ready for PostHog; bounded local analytics remains the always-working sink. Central delivery is disabled because no LoadScore PostHog project/token is configured. PostHog was selected for custom events, anonymous identifiers, funnels, retention, and dashboards without LoadScore accounts. Product code continues to call only `trackEvent()`.

Architecture: product code → strict LoadScore sanitizer → bounded local sink → optional PostHog capture endpoint. Failure, blocking, missing configuration, development mode, or opt-out never interrupts LoadScore.

LoadScore uses only PostHog's custom-event ingestion endpoint. It does not load the browser SDK, so autocapture, pageview/pageleave capture, session replay, heatmaps, DOM/text/form/input capture, logs, and feature-flag requests are absent by design.

## Web environment variables

```text
VITE_ANALYTICS_ENABLED=true
VITE_ANALYTICS_PROVIDER=posthog
VITE_POSTHOG_PROJECT_TOKEN=<client-safe project token>
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_ANALYTICS_ENVIRONMENT=production
```

Use the EU ingestion host for an EU project. Never place a PostHog personal API key or other private credential in browser code. Vercel values stay outside Git.

## Consent and identity

Central analytics defaults OFF. The driver must enable Anonymous Product Analytics. Turning it off stops future central requests; local settings/events keep working. The ID is a random local UUID—not fingerprint-, hardware-, email-, IP-, driver-, broker-, or freight-derived. Clearing storage may reset it. Web and extension IDs remain separate.

## Strict data boundary

Only allowlisted event names pass. Properties are primitive-only and allowlisted; long strings are discarded and counts capped at 250. The production adapter sanitizes again before delivery. Origin, destination, lane, exact rate, broker details, references, raw/highlighted/pasted text, CSV contents, share text, credentials, cookies, passwords, driver contact/identity, precise location, and free-form feedback are dropped even if accidentally supplied.

PostHog payloads include `$process_person_profile: false`. Founder must disable IP capture in PostHog project settings, define retention, and review PostHog as a subprocessor before activation.

## Development and extension

Central delivery is suppressed unless environment is exactly `production`. Tests inject configuration and mock network delivery. Development builds show provider/configuration/consent/last-delivery status and the ten most recent sanitized local events—never tokens.

Extension custom-event code is configuration-ready but disabled. Enabling it later requires the client-safe token and only the exact ingestion origin in `host_permissions`, followed by Chrome disclosure review and a new package. No script is injected into freight sites and no broad permission is added now.

## FOUNDER ACTION REQUIRED — CREATE/CONFIGURE ANALYTICS PROJECT

1. Create a PostHog project in the desired US/EU region.
2. Disable project autocapture, session replay, heatmaps, surveys, logs, and IP capture.
3. Set retention and review privacy/subprocessor terms.
4. Add the five web environment variables in Vercel.
5. Deploy, opt in on a test browser, inspect payload and PostHog Live Events.
6. Confirm opt-out stops requests and provider blocking does not affect LoadScore.
7. Build the dashboard below; exclude founder/test/sample activity from verified-driver claims.
8. Separately decide whether extension delivery justifies an exact host permission.

## Dashboard specification — LoadScore — First 50 Driver Beta

- Today / 7 days: unique installations, app/extension opens, loads calculated, calculations per installation, first calculations, shares, feedback.
- Activation: open → `load_calculated` → comparison/minimum-rate/mode/share.
- First use: open → `first_successful_calculation` → `multiple_loads_calculated` → later-day `load_calculated`.
- Retention: `load_calculated` again on Day 1, Day 7, and later Day 30.
- Adoption: modes; save/comparison; parser use/outcome; paste/CSV/Top 7; sharing; negotiation.
- Quality: recommendation feedback/reason codes and parser partial/failure rate.
- Growth: result copied/shared and extension CTA clicked.
- Extension: CTA viewed, CTA clicked, extension opened—never label CTA clicks as installs.
- Import quality: opened/completed, capped counts, valid/provisional/duplicate counts, parser failures.
- Revenue signal: explicit willingness-to-pay only; no payment metric exists.

The manually confirmed `50_Real_Drivers_Goal` remains authoritative. Anonymous installations are not automatically verified working drivers.
