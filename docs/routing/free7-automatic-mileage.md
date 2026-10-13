# FREE-7 Automatic Route Mileage and Manual Override

## Status

Website code is configuration-ready as `2026.10.12-beta.12`. Production routing is **not activated or verified** because `GOOGLE_ROUTES_API_KEY` is not configured. The calculator fails safely to manual mileage. Extension `0.6.2` is unchanged.

## Existing-flow audit

Before FREE-7, `loadedMiles` was a single value with no explicit provenance. `deadheadMiles` was already separate and remains separate. Main LoadScore, NearSight, minimum-rate calculations, operating-mode evaluation, saves, comparison ranking, sharing, imports, and extension scoring consume loaded miles; cost/RPM calculations consume loaded plus deadhead. CSV/pasted text and highlighted extension text already recognized explicit mileage, but did not label it `PARSED`. Saved loads persisted `loadedMiles` and their calculated result; comparison cards used that result and recomputed Decision Lens from saved raw fields. Website and extension had duplicate mileage handling. No route provider existed.

## Provider decision

Google Routes `computeRoutes` is selected for the initial standard road estimate. It provides a production-grade HTTPS API, explicit `distanceMeters`, required field masks, documented quota controls, and a 10,000-request monthly free usage cap for the Essentials SKU before usage pricing. Mapbox offers strong road directions but its published Directions profiles do not include truck routing. HERE supports truck routing, but its current public plan/contract detail is less direct for this small beta. Google now documents large-vehicle routing with vehicle dimensions, but access is limited to provisioned customers; FREE-7 therefore uses `DRIVE`/`TRAFFIC_UNAWARE` and labels the result estimated.

Official references:

- https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes
- https://developers.google.com/maps/billing-and-pricing/pricing
- https://developers.google.com/maps/documentation/routes/lvr
- https://developers.google.com/maps/api-security-best-practices
- https://developers.google.com/maps/documentation/routes/policies

## Security architecture and API

`browser → POST /api/routing/distance → Google Routes → normalized distance`

The server validates the method, same-site origin where supplied, LoadScore client marker, request shape, coordinate ranges, and distinct endpoints. It rate-limits by forwarded client address, coalesces only simultaneous identical requests, times provider calls out after eight seconds, requests only `routes.distanceMeters`, and returns sanitized errors. The only required environment variable is server-only `GOOGLE_ROUTES_API_KEY`; it must never use a `VITE_` prefix. Restrict it to the Routes API and configure Google/Vercel quotas and alerts.

No unrestricted key is included in source, browser code, analytics, saved loads, or the extension. The endpoint returns only status, miles, provider identifier, route type, estimated flag, timestamp, and profile.

## Coordinate source and accuracy

The website resolves exact entries against the FREE-3 Census 2026 canonical place dataset and uses representative latitude/longitude. These are city/place anchors, not pickup and delivery addresses. ZCTA input is not added. A future seam may use ZCTA representative points, but ZCTA must never be described as an authoritative USPS ZIP and cannot be treated as street precision.

No straight-line fallback exists.

## Mileage source and precedence

`resolveLoadedMiles` is the shared source contract:

1. `MANUAL` — driver/broker-entered miles
2. `PARSED` — an explicit trusted value from reviewed paste/CSV/highlighted text
3. `ESTIMATED_ROUTE` — Google standard road estimate
4. `NONE`

The object records value, source, and estimated status. New saved loads can also retain manual, parsed, and estimated values plus provider/profile/timestamp metadata. Existing records with only `loadedMiles` remain readable and are treated as legacy user-controlled mileage.

## UX and routing states

Canonical origin and destination values trigger a 600 ms debounced request. Raw or ambiguous typing never calls the route endpoint. States are `WAITING_FOR_LOCATIONS`, `LOADING`, `READY`, `ERROR`, and `UNAVAILABLE`; `IDLE` remains available to future flows.

With no manual value, a ready estimate becomes effective mileage and can make NearSight preliminary while deadhead remains unknown. Entering manual mileage immediately overrides it. The estimate can remain visible as secondary context. Clearing manual mileage falls back to the current matching estimate. Editing either location immediately hides the stale estimate and requests a new one after resolution. Routing failure never clears manual mileage and never blocks the calculator.

## Parsed loads, saves, and comparisons

Explicit paste/CSV mileage is labeled `PARSED` and outranks a route estimate. A driver correction is stored as `MANUAL` and wins. Ambiguous or missing parsed mileage is not manufactured. Saved comparison records preserve the effective value and available provenance without destructive migration. Comparison cards use the shared resolver and show a compact source label.

## Cost control and caching

The browser reuses the current matching estimate while the route is unchanged and aborts obsolete requests. The server coalesces simultaneous identical requests and enforces a per-instance 20-request/minute client-address window. It does **not** persistently cache Google distance results because Google restricts caching of most Routes content. Before production activation, set conservative Google daily quotas/budget alerts and consider Vercel Firewall/rate controls because serverless in-memory limits are not globally authoritative.

## Privacy and analytics

No routing analytics events were added. Exact origin, destination, coordinates, place IDs, route pair, ZCTA, and mileage remain outside the analytics allowlist. Google receives coordinates only when the estimate is requested. The public privacy policy now documents this optional processing.

## Extension plan

The extension remains unchanged at `0.6.2`: no host permission, routing provider key, or endpoint call was added. Safe parity requires an authenticated or separately abuse-protected extension-to-LoadScore endpoint design, production routing verification, and package/privacy review. Provider secrets must never enter the extension.

## Future upgrades

- Provision Google large-vehicle routing or an approved commercial truck-routing provider, collect explicit vehicle dimensions/weight/hazmat context, display partial-restriction warnings, and retest pricing/terms.
- Add optional precise address inputs only with a lawful geocoding/privacy design and clear user consent.
- Add ZCTA representative routing only as approximate geography, not USPS ZIP truth.
- Add automatic deadhead later from an explicit truck-location input; never infer it from loaded-route endpoints.
