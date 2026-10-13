import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";

const VINTAGE = "2026";
const RETRIEVAL_DATE = "2026-10-12";
const PLACE_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_place_national.zip";
const ZCTA_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_zcta_national.zip";
const STATE_CODES = new Set(["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]);
const DRIVER_NAME_OVERRIDES = new Map([
  ["1608830", "Boise"],
  ["1836003", "Indianapolis"],
  ["2146027", "Lexington"],
  ["1349008", "Macon"],
  ["4752006", "Nashville"],
]);
const root = resolve(import.meta.dirname, "..", "..");

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }

async function download(url) {
  const response = await fetch(url, { headers: { "User-Agent": "LoadScore geography build (official Census data)" } });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function extractTextFromZip(zip) {
  let eocd = -1;
  for (let offset = zip.length - 22; offset >= Math.max(0, zip.length - 65557); offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error("ZIP end-of-central-directory record not found.");
  const entries = zip.readUInt16LE(eocd + 10);
  let cursor = zip.readUInt32LE(eocd + 16);
  for (let index = 0; index < entries; index += 1) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Malformed ZIP central directory.");
    const method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const uncompressedSize = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    if (name.toLowerCase().endsWith(".txt")) {
      if (zip.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Malformed ZIP local header.");
      const localNameLength = zip.readUInt16LE(localOffset + 26);
      const localExtraLength = zip.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = zip.subarray(start, start + compressedSize);
      const contents = method === 8 ? inflateRawSync(compressed) : method === 0 ? compressed : null;
      if (!contents || contents.length !== uncompressedSize) throw new Error(`Unsupported or invalid ZIP entry: ${name}`);
      return contents.toString("utf8").replace(/^\uFEFF/, "");
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error("No Gazetteer text file found in ZIP.");
}

function parsePipe(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split("|").map((value) => value.trim());
  return lines.slice(1).map((line) => Object.fromEntries(line.split("|").map((value, index) => [headers[index], value.trim()])));
}

function driverName(name) {
  return name.replace(/\s+(?:city and borough|city and county|consolidated government|metropolitan government|metro government|unified government|urban county government|municipality|borough|village|town|city|CDP|balance)$/i, "").trim();
}

function coordinate(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Malformed ${label}: ${value}`);
  return parsed;
}

function formatJson(value) { return `${JSON.stringify(value)}\n`; }

async function output(path, value) {
  const contents = formatJson(value);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
  return { path, bytes: Buffer.byteLength(contents), sha256: sha256(contents) };
}

async function main() {
  const cache = join(tmpdir(), "loadscore-census-gazetteer-2026");
  await mkdir(cache, { recursive: true });
  const offline = process.argv.includes("--offline");
  const placeZipPath = join(cache, "2026_Gaz_place_national.zip");
  const zctaZipPath = join(cache, "2026_Gaz_zcta_national.zip");
  const placeZip = offline ? await readFile(placeZipPath) : await download(PLACE_URL);
  const zctaZip = offline ? await readFile(zctaZipPath) : await download(ZCTA_URL);
  if (!offline) {
    await writeFile(placeZipPath, placeZip);
    await writeFile(zctaZipPath, zctaZip);
  }

  const places = parsePipe(extractTextFromZip(placeZip))
    .filter((row) => STATE_CODES.has(row.USPS))
    .map((row) => {
      const name = DRIVER_NAME_OVERRIDES.get(row.GEOID) || driverName(row.NAME);
      const latitude = coordinate(row.INTPTLAT, "place latitude");
      const longitude = coordinate(row.INTPTLONG, "place longitude");
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new Error(`Out-of-range place coordinate: ${row.GEOID}`);
      return [`place:${row.GEOID}`, row.GEOID, name, row.USPS, `${name}, ${row.USPS}`, latitude, longitude, row.LSAD === "57" || /\sCDP$/i.test(row.NAME) ? "census_designated_place" : "incorporated_place"];
    })
    .sort((a, b) => a[4].localeCompare(b[4], "en") || a[1].localeCompare(b[1]));

  const placeIds = new Set(places.map((row) => row[0]));
  if (placeIds.size !== places.length) throw new Error("Duplicate canonical place IDs detected.");

  const zctas = parsePipe(extractTextFromZip(zctaZip))
    .map((row) => {
      const latitude = coordinate(row.INTPTLAT, "ZCTA latitude");
      const longitude = coordinate(row.INTPTLONG, "ZCTA longitude");
      if (!/^\d{5}$/.test(row.GEOID) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new Error(`Malformed ZCTA record: ${row.GEOID}`);
      return [row.GEOID, latitude, longitude];
    })
    .sort((a, b) => a[0].localeCompare(b[0]));
  if (new Set(zctas.map((row) => row[0])).size !== zctas.length) throw new Error("Duplicate ZCTA identifiers detected.");

  const placeDataset = {
    metadata: { agency: "U.S. Census Bureau", dataset: "2026 Gazetteer — Places", vintage: VINTAGE, retrieved: RETRIEVAL_DATE, sourceUrl: PLACE_URL, sourceSha256: sha256(placeZip), scope: "50 states and District of Columbia; Puerto Rico excluded from driver-facing place search", recordCount: places.length },
    fields: ["id", "geoid", "name", "stateCode", "displayName", "latitude", "longitude", "geographyType"],
    records: places,
  };
  const zctaDataset = {
    metadata: { agency: "U.S. Census Bureau", dataset: "2026 Gazetteer — ZIP Code Tabulation Areas", vintage: VINTAGE, retrieved: RETRIEVAL_DATE, sourceUrl: ZCTA_URL, sourceSha256: sha256(zctaZip), scope: "National Census ZCTA file including Puerto Rico; not exposed in production UI", recordCount: zctas.length, disclaimer: "Census ZCTAs are statistical areas, not authoritative USPS operational ZIP Codes and not road-mileage estimates." },
    fields: ["zcta5", "latitude", "longitude"],
    records: zctas,
  };

  const outputs = [];
  outputs.push(await output(join(root, "public", "data", "geography", "places-2026.json"), placeDataset));
  outputs.push(await output(join(root, "extension", "data", "geography", "places-2026.json"), placeDataset));
  outputs.push(await output(join(root, "data", "geography", "zcta-2026.json"), zctaDataset));
  await writeFile(join(root, "extension", "geographyCore.js"), await readFile(join(root, "src", "logic", "geographyCore.js"), "utf8"), "utf8");
  process.stdout.write(`${JSON.stringify({ placeCount: places.length, zctaCount: zctas.length, outputs }, null, 2)}\n`);
}

await main();
