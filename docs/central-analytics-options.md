# Central Analytics Configuration Options

Updated: 2026-08-12

The product calls only `trackEvent()`. The production adapter accepts a configurable HTTPS endpoint and site ID through:

- `VITE_ANALYTICS_ENDPOINT`
- `VITE_ANALYTICS_SITE_ID`

Local bounded event storage remains the fallback, failures never block calculations, and optional central analytics consent defaults off. Possible later destinations include a privacy-conscious hosted analytics service or a small founder-controlled event endpoint. Selection requires reviewing data terms, retention, deletion, security, geographic processing, pricing, and Chrome disclosure impacts.

**FOUNDER ACTION REQUIRED — CENTRAL ANALYTICS CONFIGURATION:** choose a provider, create the account/endpoint, configure deployment environment variables outside Git, update privacy/subprocessor/retention documentation, verify consented end-to-end delivery, and re-review extension host-permission needs. No provider or credentials are currently configured.
