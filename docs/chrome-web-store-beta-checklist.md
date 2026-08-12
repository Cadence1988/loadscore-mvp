# Chrome Web Store Beta Submission Checklist

## Distribution funnel update — 2026-08-12

- Public privacy route: `/privacy.html`.
- Store CTA configuration: `VITE_CHROME_WEB_STORE_URL`.
- Pre-approval state: truthful Store-coming-soon label with no fake URL.
- Submission artifact target: `artifacts/loadscore-extension-v0.6.0.zip`.
- After approval: configure the official URL, deploy, verify CTA, then begin outside-driver outreach.

## Package readiness

- [x] Manifest V3 audited.
- [x] Minimum current permissions documented.
- [x] No broad host permissions or remotely hosted executable code.
- [x] LoadScore icon master and 16/32/48/128 icon set prepared.
- [x] Repeatable packaging command: `npm run package:extension`.
- [x] Clean versioned ZIP generated and inspected.
- [x] Listing, single-purpose statement, privacy policy, data-use draft, and screenshot plan prepared.

## FOUNDER ACTION REQUIRED

- [ ] Register the Chrome Web Store developer account.
- [ ] Pay the registration fee.
- [ ] Verify developer email.
- [ ] Confirm publisher name and support email.
- [ ] Publish privacy policy at a stable public HTTPS URL.
- [ ] Reload/test the final unpacked extension in Chrome.
- [ ] Capture/upload final screenshots using `chrome-web-store-screenshot-plan.md`.
- [ ] Upload the exact versioned ZIP from `artifacts/`.
- [ ] Paste short/full descriptions and single-purpose statement.
- [ ] Complete Privacy tab selections using current dashboard wording.
- [ ] Choose distribution: recommended controlled/unlisted beta first.
- [ ] Add review/test instructions explaining highlighted-text parsing is user-triggered.
- [ ] Submit for review and log submission date/status.
- [ ] After approval, verify the public/unlisted install link and link it from the website.

## Review notes

LoadScore evaluates manually entered, saved, or explicitly highlighted freight information. It does not automatically monitor load boards, scrape authenticated pages, book freight, or guarantee financial results.
