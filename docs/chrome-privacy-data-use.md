# Chrome Web Store Privacy and Data-Use Draft

## Permissions audit

| Permission | Current reason | Scope note |
|---|---|---|
| `activeTab` | Temporarily access the active tab after the user clicks the extension | No background browsing access |
| `scripting` | Run the explicit selection-reading function after “Use highlighted load text” | No automatic page scraping |
| `storage` | Save local truck settings, draft, saved loads, preferences, analytics foundation, and notification state | Browser-local only |
| `notifications` | Create user-opted-in alerts for saved/provided matching loads | Added only for Build 2; not load-board monitoring |

There are no broad host permissions. There is no remotely hosted executable code. Central extension analytics remains disabled until a provider is selected; at that time only the provider's exact origin may be added, followed by a fresh review.

## Data accessed

- User-entered freight and operating-cost fields.
- User-highlighted visible page text, only after explicit click.
- Locally saved preferences and load records.
- Optional safe product-use event categories.
- User-pasted freight text and user-selected CSV rows, processed locally for review and scoring.

Highlighted page text may qualify as website content/user-provided content in the developer dashboard. Founder must answer the dashboard's current wording based on the final package and should disclose that access is user-triggered and raw text is not retained or centrally transmitted.

## Data not collected

Passwords, load-board credentials, authentication cookies, browsing history, automatic page content, broker contact details for analytics, payment data, health data, precise location, and raw highlighted freight messages.

Raw pasted text and CSV row contents are also excluded from analytics and are not sent to a LoadScore backend in the current browser-local beta.

## Limited-use commitments

Data is used only to provide and improve LoadScore's freight-evaluation functionality, not for advertising, sale, credit decisions, or unrelated purposes. Human review of private user data is not part of the current beta.

## FOUNDER ACTION REQUIRED

- Select exact developer-dashboard disclosures using the dashboard's current questions.
- Provide the stable public privacy-policy URL.
- Confirm publisher/support identity and email.
- Re-check disclosures after selecting an analytics provider.
- Do not claim central transmission is active until endpoint configuration and user consent are live.
