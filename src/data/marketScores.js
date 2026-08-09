export const marketScores = {
  "Allentown, PA": 68,
  "Dallas, TX": 85,
  "Atlanta, GA": 88,
  "Baltimore, MD": 67,
  "Birmingham, AL": 72,
  "Buffalo, NY": 58,
  "Chattanooga, TN": 78,
  "Chicago, IL": 82,
  "Cincinnati, OH": 73,
  "Cleveland, OH": 69,
  "Columbia, SC": 68,
  "Los Angeles, CA": 70,
  "Phoenix, AZ": 65,
  "Denver, CO": 40,
  "Salt Lake City, UT": 38,
  "Miami, FL": 35,
  "New York, NY": 45,
  "Houston, TX": 78,
  "Jacksonville, FL": 62,
  "Laredo, TX": 74,
  "Louisville, KY": 75,
  "Memphis, TN": 80,
  "Milwaukee, WI": 68,
  "Minneapolis, MN": 67,
  "Nashville, TN": 73,
  "New Orleans, LA": 52,
  "Oklahoma City, OK": 65,
  "Omaha, NE": 62,
  "Ontario, CA": 72,
  "Orlando, FL": 48,
  "Philadelphia, PA": 66,
  "Pittsburgh, PA": 60,
  "Portland, OR": 50,
  "Raleigh, NC": 66,
  "Richmond, VA": 65,
  "Savannah, GA": 64,
  "Seattle, WA": 52,
  "St. Louis, MO": 71,
  "Tampa, FL": 50,
  "Toledo, OH": 66,
  "Indianapolis, IN": 76,
  "Columbus, OH": 74,
  "Kansas City, MO": 72,
  "Charlotte, NC": 70,
};

export const DEFAULT_RELOAD_SCORE = 50;

function normalizeCity(value) {
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

const normalizedMarketScores = new Map(
  Object.entries(marketScores).map(([city, score]) => [normalizeCity(city), score]),
);

export function getCuratedMarketScore(city) {
  return normalizedMarketScores.get(normalizeCity(city)) ?? null;
}
