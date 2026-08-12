# LoadScore Chrome Extension MVP

Current beta package: version 0.5.0. It includes Operating Modes, expanded user-triggered highlighted-text parsing, optional lifecycle fields, and opt-in local match notifications. Full multi-load paste and CSV review are intentionally handled by the web app to keep the popup practical.

## Install locally

1. Open Chrome and visit `chrome://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Choose this `extension` folder.
5. Pin LoadScore from the Extensions menu.

The popup supports manual load entry, restores the last unfinished entry, saves
truck-cost defaults, and stores up to seven loads locally with load/remove
controls. For selected-text parsing, highlight a visible load offer on the
current page before opening the extension, then select **Use highlighted load
text**.

The basic broker negotiator uses the saved truck costs, target all-in RPM, and
minimum desired trip profit to calculate a minimum acceptable rate and create a
copyable message. More advanced broker-specific strategies remain a possible
paid feature.

## Local alert rules

The extension evaluates manual, parsed, and saved local loads against:

- Minimum LoadScore
- Minimum all-in RPM
- Minimum estimated profit
- Maximum deadhead
- Minimum reload score
- Optional preferred and avoided destinations

Saved loads show Matches alert, Almost matches, Does not match, or Missing data.
The toolbar badge counts matching saved local loads only. The badge refreshes
when the popup is opened or its local data changes; it is not a live-load monitor.

Browser notifications are intentionally deferred until an explicit opt-in flow,
repeat prevention, notification assets, and Chrome Web Store permission
disclosures are ready.

## Privacy and platform safety

- No page is scraped automatically.
- No usernames, passwords, cookies, or private API calls are accessed.
- The extension reads only text the user has deliberately highlighted after the
  user clicks the parsing button.
- Parsed values must be reviewed by the user before relying on the score.
