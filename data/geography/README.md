# Census geography provenance

Generated on 2026-10-12 by `scripts/data/build-census-geography.mjs`.

## Official inputs

- Agency: U.S. Census Bureau
- Vintage: 2026 Gazetteer Files
- Places: `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_place_national.zip`
  - Retrieved SHA-256: `af678e2d990827c89ee39b98c82de6e90b693c7361ff0e559ae3076670dd2863`
- ZCTAs: `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_zcta_national.zip`
  - Retrieved SHA-256: `f1e9046b91f6e60686a99343cb2752834c02b0764939403b331c78c017e2c54c`
- Census landing page: `https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html`

## Generated outputs

- `public/data/geography/places-2026.json`: 32,071 driver-facing place records; 3,374,422 bytes.
- `extension/data/geography/places-2026.json`: byte-identical extension artifact.
- `data/geography/zcta-2026.json`: 33,791 separate ZCTA reference records; 1,047,317 bytes; not shipped in the website bundle.
- Place artifact SHA-256: `a3ce0929cb3a57fe9c0d630af2e00d5cc927f00a9b53948b5c8507dddc6228e2`.
- ZCTA artifact SHA-256: `b5f6dfa1fc45a744d60170ba3be75d9999141e0a24eb22fc78f9e4ad66a5204e`.

The builder downloads the official ZIPs, verifies structure, parses pipe-delimited records, rejects malformed identifiers/coordinates, rejects duplicate IDs, filters driver-facing places to the 50 states and District of Columbia, applies five documented legacy display-name compatibility overrides, sorts deterministically, emits compact arrays, and copies the canonical runtime helper to the extension.

Puerto Rico is excluded from production place search because current product scope is 50 states plus D.C. The unexposed national ZCTA reference retains all records from the official national file, including Puerto Rico; future work must make an explicit scope decision before exposing any ZCTA lookup.

## Interpretation limits

Census Gazetteer coordinates are representative internal points. They are not truck-route origins, destinations, or road-mileage estimates. A Census ZCTA is a statistical area and is not an authoritative USPS operational ZIP Code. City/place and ZCTA relationships are many-to-many in practice; never infer a one-to-one relationship.

Run `npm run build:geography` to retrieve the official files and regenerate outputs. Use `node scripts/data/build-census-geography.mjs --offline` only when the two official ZIPs already exist in the script's documented temporary cache.
