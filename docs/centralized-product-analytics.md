# Privacy-First Centralized Product Analytics

Updated: 2026-08-13

## Status and provider

Production web analytics is live in the LoadScore US Cloud PostHog project; bounded local analytics remains the always-working sink. Real production events have been observed. PostHog was selected for custom events, anonymous identifiers, funnels, retention, and dashboards without LoadScore accounts. Product code continues to call only `trackEvent()`.

Architecture: product code → strict LoadScore sanitizer → bounded local sink → optional PostHog capture endpoint. Failure, blocking, missing configuration, development mode, or opt-out never interrupts LoadScore.

LoadScore uses only PostHog's custom-event ingestion endpoint. It does not load the browser SDK, so autocapture, pageview/pageleave capture, session replay, heatmaps, DOM/text/form/input capture, logs, and feature-flag requests are absent by design.

## Consent and identity

Central web analytics defaults ON with a clear, persistent opt-out. A stored `denied` preference remains denied after the upgrade; a stored `granted` preference remains granted; a missing preference is migrated once to `granted`. Turning it off stops future central requests; local settings/events keep working. The ID is a random local UUID—not fingerprint-, hardware-, email-, IP-, driver-, broker-, or freight-derived. Clearing storage may reset it. Web and extension IDs remain separate.

The stable local UUID becomes PostHog's `distinct_id`. Repeated `load_calculated` events on later days can therefore be attributed to the same anonymous installation. It is not a verified driver identity and is reset if the user clears the relevant browser storage.

## Strict data boundary

Only allowlisted event names pass. Properties are primitive-only and allowlisted; long strings are discarded and counts capped at 250. The production adapter sanitizes again before delivery. Origin, destination, lane, exact rate, broker details, references, raw/highlighted/pasted text, CSV contents, share text, credentials, cookies, passwords, driver contact/identity, precise location, and free-form feedback are dropped even if accidentally supplied.

PostHog payloads include `$process_person_profile: false`. The production project has client IP storage discarded. Session replay, autocapture, heatmaps, web-vitals/dead-click capture, form/input capture, console capture, and network header/body capture remain off.

## Event-quality semantics

- `load_calculated`: a driver has interacted with the form and a complete, valid evaluation settles. A local-only fingerprint prevents an unchanged evaluation from emitting again because of a rerender. A meaningfully changed evaluation can emit again.
- `minimum_rate_viewed`: the always-visible minimum-rate result is counted only after a meaningful complete evaluation, once per local evaluation fingerprint. Initial component mounting does not count.
- `alert_match`, `alert_near_match`, `alert_no_match`, and `alert_missing_data`: emitted once per unchanged local evaluation/status combination. React updates alone do not repeat them; changed evaluations may produce new outcomes.

The fingerprint can reflect freight inputs and therefore never leaves the device, never becomes an event property, and is never sent as a hash.

## Development and extension

Central delivery is suppressed unless environment is exactly `production`. Tests inject configuration and mock network delivery. Development builds show provider/configuration/consent/last-delivery status and the ten most recent sanitized local events—never tokens.

Extension custom-event code is configuration-ready but disabled. Enabling it later requires the client-safe token and only the exact ingestion origin in `host_permissions`, followed by Chrome disclosure review and a new package. No script is injected into freight sites and no broad permission is added now.

## What PostHog is

PostHog is LoadScore's usage dashboard. It tells us whether people are opening LoadScore, calculating loads, returning later, sharing results, using Operating Modes, and providing structured feedback. It is not a load board and does not receive the private freight details excluded above.

## Founder action required — create the LoadScore project

1. Open `https://posthog.com/` and choose **Get started — free**, or sign in if an account already exists.
2. At the **Data region** choice, select **United States** for the current LoadScore configuration. The matching ingestion host is `https://us.i.posthog.com`. Choose EU only after an intentional residency decision; an EU project must use its displayed EU host instead.
3. Create the organization/workspace if PostHog asks for one, then create a project named **LoadScore**.
4. Open the project's setup or **Settings > Project** page and copy only the **Project token**. PostHog describes this as the same client-side token used by frontend integrations.
5. Record the displayed ingestion/API host for the project's region.
6. Do **not** copy a Personal API key, private administrative key, password, or login credential into LoadScore or Vercel. Normal client event capture does not need one.

## Privacy-conservative project checklist

- **Session replay:** OFF.
- **Autocapture & heatmaps:** under **Settings > Project > Autocapture & heatmaps**, turn autocapture OFF and leave heatmaps OFF.
- **Forms, inputs, DOM/page text, pageviews, pageleaves, rage clicks, console logs, surveys and error capture:** do not enable. LoadScore does not load the PostHog browser SDK, so these are also absent in code.
- **IP data capture:** under **Settings > Project > General**, set the project to discard client IP data. PostHog also offers an organization default under **Settings > Organization > General**; the project setting is the one to verify for LoadScore.
- **Person profiles:** keep anonymous events without profiles. The adapter sends `$process_person_profile: false` on every request and never calls identify/alias/group.
- **Retention:** for the first beta, prefer 90 days if the current PostHog plan exposes a configurable retention choice. This is a conservative product/privacy recommendation, not legal advice. If retention is provider-controlled, record the displayed policy and review it before activation.
- **Other products:** do not enable session replay, web analytics autocapture, surveys, logs, feature flags or data pipelines merely to activate LoadScore product events.

## Exact environment variables

```text
VITE_ANALYTICS_ENABLED=true
VITE_ANALYTICS_PROVIDER=posthog
VITE_POSTHOG_PROJECT_TOKEN=<Project token from the LoadScore PostHog project>
VITE_POSTHOG_HOST=<regional ingestion host shown by PostHog>
VITE_ANALYTICS_ENVIRONMENT=production
```

All five use the `VITE_` prefix because Vite exposes them to the built browser application. The project token and host are client-side configuration, not private server credentials. They still belong in Vercel rather than committed source so environments can be controlled independently. Never use a PostHog Personal API key or other private administrative key here.

## Exact Vercel production setup

1. Open the LoadScore project in Vercel.
2. Open **Settings > Environment Variables**.
3. Add the five variables above for **Production**.
4. Save them.
5. Open **Deployments**, use the latest Production deployment's menu, and choose **Redeploy**.
6. Wait for the deployment to succeed before testing.

Environment-variable changes apply only to a new deployment. Do not add the variables to Preview or Development unless test traffic is deliberately planned; the adapter suppresses any environment other than exactly `production`.

## First real event and opt-out verification

Use a fresh/private browser profile if convenient so the default consent state is visible.

1. Open `https://loadscore-mvp.vercel.app/` and confirm **Anonymous Product Analytics** is OFF.
2. Open the LoadScore PostHog project in another tab and locate the live/recent events view.
3. Turn LoadScore analytics ON.
4. Enter a clearly synthetic load, for example origin `Test City, TX`, destination `Demo City, GA`, rate `2500`, loaded miles `800`, deadhead `50`, MPG `7`, fuel `3.75`, fixed cost/mile `0.65`, and calculate it. Do not paste a real offer for this verification.
5. Find `load_calculated` in PostHog. Record its random `distinct_id` as the founder-test installation ID and exclude that ID from First-50 reports. Do not attach a name or email to it.
6. Inspect the payload. It may contain event/timestamp, the random ID, build/surface/environment, score band and other allowlisted categories. It must not contain origin, destination, exact rate, broker, reference, highlighted/pasted text, CSV contents, name, email, phone, credentials or cookies.
7. Test a small representative group only: `app_opened`; one Operating Mode selection; `loadscore_result_copied` or shared; and one structured feedback event. Inspect each for the same boundary.
8. Turn analytics OFF, calculate a second synthetic load, and confirm no new centralized calculation event arrives. The calculation itself must still work.
9. If delivery fails, leave analytics OFF while checking the five Vercel variables, region host, production redeployment and PostHog live events. Missing configuration, provider failure and offline use must never block LoadScore.

Do not label analytics **LIVE / VERIFIED** until an event from the deployed LoadScore site is visibly confirmed in the real project.

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

### Reports to create after the first event is verified

Create a dashboard named **LoadScore — First 50 Driver Beta** and add:

1. Unique `distinct_id` count for `load_calculated`, excluding the recorded founder-test ID.
2. Total `app_opened`, `load_calculated`, and calculations per active installation for Today and Last 7 days.
3. Activation funnel: `app_opened` → `first_successful_calculation` → any one of comparison viewed, minimum rate viewed, Operating Mode selected, or result shared/copied.
4. Retention: starting event `load_calculated`; return event `load_calculated`; display next-day and 7-day retention, adding 30-day when enough time exists.
5. Feature-use trends for mode events, comparison, minimum rate, parser, paste/CSV import, Top 7, and sharing.
6. Recommendation-quality trends for positive/negative feedback and safe structured `reason_code` values.
7. Word-of-mouth trends for result copied/shared and extension CTA clicked.

The reports begin empty or founder-only. The manually confirmed `50_Real_Drivers_Goal` remains authoritative. Anonymous installations are not automatically verified working drivers.
