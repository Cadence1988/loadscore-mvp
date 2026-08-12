# Bulk and Pasted Freight Intake

Updated: 2026-08-12

The web app accepts deliberately pasted freight text and user-authorized CSV files. Both paths feed one standard load normalizer, preview rows locally, disclose missing/ambiguous values, flag duplicates without deleting them, and require the user to press **Score reviewed opportunities**.

Supported normalized fields include route, rate, loaded miles, deadhead, pickup/delivery timing, equipment, weight, stops, broker/reference, load ID, expiration, and source provenance. Missing deadhead remains unknown rather than becoming confirmed zero. For current calculations only, unknown deadhead uses a zero-mile fallback while retaining a visible warning.

CSV headers receive small, documented alias matching and can be manually mapped or ignored. The browser-local beta limit is **250 rows**. A synthetic 300-row test verifies truncation and processed the allowed 250 rows in under one second in the test environment.

Valid reviewed rows use the existing LoadScore engine, Operating Mode evaluator, minimum-rate logic, and unchanged ranking order: score, estimated profit, then all-in RPM. Results provide All, Preferred, Flexible, and Recovery filters and show up to seven strongest opportunities. Filters never switch the active mode automatically.

Raw paste text, CSV contents, lanes, and broker data are excluded from analytics. Only safe counts, source category, completion, and mode events are eligible. No external freight source, DAT/Truckstop access, scraping, booking, or background monitoring is implied.
