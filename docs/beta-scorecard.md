# First 50 Driver Beta Scorecard Definition

Updated: 2026-08-12

This is a metric definition—not a live centralized dashboard. Current local event histories cannot be aggregated across installations.

When consented centralized analytics is configured, calculate:

- Unique beta installations: distinct random installation IDs.
- Activation: installation with first successful complete calculation.
- Depth: multiple-load calculation, comparison, Operating Mode, and import use.
- Sharing/feedback: copied/shared result, problem report, recommendation feedback, and feedback form.
- Retention: repeat-day installation; Day 7 only when sufficient elapsed data exists.
- Product quality: positive/negative recommendation ratio, parser outcome categories, missing-field categories, and problem areas.
- Acquisition: explicitly supplied allowlisted tester-source categories only.
- Monetization evidence: explicit willingness-to-pay response only. Do not infer payment; no paid event exists.

The local anonymous ID is random, not hardware-derived, and resets if browser/extension storage is cleared. Web and extension currently have separate IDs. Raw freight, routes, broker information, and user text are excluded from analytics.
