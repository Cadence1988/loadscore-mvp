# Extension Manifest and Security Audit

Audited: August 12, 2026

Version 0.4.0 adds only the Chrome `notifications` permission and a minimal module service worker. This is used solely for explicit, driver-enabled alerts about qualifying loads already saved in LoadScore. No host permissions are requested, and there is no continuous load-board monitoring.

- Manifest version: 3.
- Build 1 version: 0.3.0.
- Action opens `popup.html`; icons declared at 16/32/48/128.
- `activeTab` and `scripting` are used only when the user clicks the highlighted-text parser.
- `storage` supports local settings, drafts, saved loads, preferences, events, and related local state.
- No host permissions, content scripts, cookies permission, webRequest permission, tabs-wide access, or background scraping.
- No remotely hosted JavaScript, dynamic remote modules, `eval`, or credentials.
- Raw selected text is parsed in memory and not written to analytics.
- Optional centralized extension analytics is disabled/config-empty. A future provider requires exact-origin permission/disclosure review.
- Build 2 may add only `notifications`, plus a local service worker, for explicit opt-in saved/provided-load alerts.
