# LoadScore First-Driver Beta Guide

Updated: 2026-08-12

## Web beta

1. Open `https://loadscore-mvp.vercel.app`.
2. Review the short first-run guide or try the clearly synthetic example load.
3. Set MPG, fuel price, and fixed operating cost per mile.
4. Review RPM/profit targets and choose Preferred, Flexible, or Recovery.
5. Enter a load. A complete evaluation requires route, positive rate, positive loaded miles, and known deadhead (including explicitly confirmed zero).
6. Review score explanation, economics, mode fit, reload-score provenance, and minimum acceptable rate.
7. Try comparison or the local paste/CSV import if useful.
8. Use **Feedback & Beta** to report problems without automatically attaching freight details.

## Extension beta before Chrome Web Store approval

Use unpacked installation only with trusted invited testers. Open `chrome://extensions`, enable Developer Mode, choose **Load unpacked**, and select the repository's `extension` folder. After an update, press **Reload** on the LoadScore extension card.

Permissions: `activeTab` and `scripting` read only the visible text the tester deliberately highlights after clicking the parser; `storage` keeps local settings/history; `notifications` supports explicit opt-in alerts for loads already known to LoadScore. There are no broad host permissions or automatic load-board monitoring.

Version 0.6.0 protects unknown deadhead, supports replacement-friendly validated inputs, a compact quick start, Operating Modes, saved loads, highlighted parsing, sharing, and an Open Full LoadScore control. Replace these Developer Mode instructions with the official Store link only after approval.

The website CTA uses `VITE_CHROME_WEB_STORE_URL` as its single Store-link source. Until it contains an official Chrome Web Store URL, the public UI truthfully says the Store release is coming soon and offers no fake install destination.

**FOUNDER ACTION REQUIRED:** register/pay/verify the Chrome developer account, publish the privacy-policy URL, capture screenshots, complete disclosures, submit, and await approval.
