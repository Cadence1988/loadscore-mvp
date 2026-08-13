# Central Analytics Configuration

Updated: 2026-08-12

PostHog is the selected first provider and the provider-independent `trackEvent()` seam is preserved. See `centralized-product-analytics.md` for architecture, privacy controls, environment variables, dashboard specification, validation, and founder setup.

Central web delivery is live in the configured US Cloud PostHog project. Local bounded analytics remains the fallback, extension centralized delivery remains disabled/local-only, and no production project token is committed.

**FOUNDER ACTION REQUIRED — CREATE/CONFIGURE ANALYTICS PROJECT:** create PostHog project, disable autocapture/replay/heatmaps/logs/IP capture, define retention, add Vercel variables, deploy, opt in, inspect safe live events, test opt-out/failure, then build the documented First 50 dashboard.
