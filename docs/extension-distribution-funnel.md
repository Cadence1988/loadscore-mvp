# Extension Distribution Funnel

Updated: 2026-08-12

## Current behavior

The website is the discovery, demo, onboarding, bulk-import, deep-review, privacy, and support surface. The Chrome extension is the quick repeated-use surface for manual scoring, deliberately highlighted visible text, saved truck numbers, Operating Modes, saved loads, minimum acceptable rate, and result copying.

The public website shows a truthful Store-coming-soon state until `VITE_CHROME_WEB_STORE_URL` contains an official `chromewebstore.google.com` or legacy `chrome.google.com/webstore` listing URL. No placeholder or fake install destination is used. Once the official URL exists, the same CTA automatically becomes the Store install link.

The public privacy route is `/privacy.html`. The extension opens the verified web app at `https://loadscore-mvp.vercel.app/` for full workflows and links to the live privacy page.

## Boundary

The extension does not automatically monitor DAT, Truckstop, or other load boards; discover freight; access passwords/cookies; bypass logins; or book freight. Highlighted visible text is accessed only after deliberate driver action.

## FOUNDER ACTION REQUIRED

1. Register, pay, and verify the Chrome Web Store developer account.
2. Capture and approve real extension screenshots.
3. Complete privacy/data-use declarations.
4. Submit `artifacts/loadscore-extension-v0.6.0.zip` and respond to review.
5. Set `VITE_CHROME_WEB_STORE_URL` to the approved official listing URL.
6. Deploy and verify the website CTA reaches the approved listing.
7. Begin Driver #1 outreach only after the installation path is verified.
