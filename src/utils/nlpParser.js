const countryMap = require('./countryMap');

function parseNaturalLanguageQuery(query) {
  if (!query || typeof query !== 'string') return null;

  const q = query.toLowerCase().trim();
  const filters = {};

  // ── Gender ──────────────────────────────────────────
  if (/\bmales?\b/.test(q) && !/\bfemales?\b/.test(q)) {
    filters.gender = 'male';
  } else if (/\bfemales?\b|\bwomen\b|\bwoman\b|\bgirls?\b/.test(q)) {
    filters.gender = 'female';
  }
  // "male and female" → no gender filter (both)

  // ── Age groups ──────────────────────────────────────
  if (/\bchildren\b|\bchild\b|\bkids?\b/.test(q)) {
    filters.age_group = 'child';
  } else if (/\bteenagers?\b|\bteens?\b/.test(q)) {
    filters.age_group = 'teenager';
  } else if (/\badults?\b/.test(q)) {
    filters.age_group = 'adult';
  } else if (/\bseniors?\b|\belderly\b|\bold people\b/.test(q)) {
    filters.age_group = 'senior';
  }

  // ── "young" → ages 16–24 (not a stored age_group) ──
  if (/\byoung\b/.test(q)) {
    filters.min_age = 16;
    filters.max_age = 24;
  }

  // ── Explicit age expressions ─────────────────────────
  // "above 30" / "over 30" / "older than 30"
  const aboveMatch = q.match(/(?:above|over|older than)\s+(\d+)/);
  if (aboveMatch) filters.min_age = parseInt(aboveMatch[1]);

  // "below 25" / "under 25" / "younger than 25"
  const belowMatch = q.match(/(?:below|under|younger than)\s+(\d+)/);
  if (belowMatch) filters.max_age = parseInt(belowMatch[1]);

  // "between 20 and 45" / "aged 20-45" / "ages 20 to 45"
  const betweenMatch = q.match(/(?:between|aged?|ages?)\s+(\d+)\s*(?:and|to|-)\s*(\d+)/);
  if (betweenMatch) {
    filters.min_age = parseInt(betweenMatch[1]);
    filters.max_age = parseInt(betweenMatch[2]);
  }

  // ── min_age from "above X" overrides "young" if both ─
  // (explicit always wins)

  // ── Country ──────────────────────────────────────────
  // Try to match "from <country>" or "in <country>" or "living in <country>"
  const countryPatterns = [
    /(?:from|in|living in|based in)\s+([a-z\s]+?)(?:\s+(?:aged?|between|above|below|over|under|who|$))/,
    /(?:from|in|living in|based in)\s+([a-z]+)$/,
  ];

  for (const pattern of countryPatterns) {
    const match = q.match(pattern);
    if (match) {
      const countryName = match[1].trim();
      const countryId = resolveCountry(countryName);
      if (countryId) {
        filters.country_id = countryId;
        break;
      }
    }
  }

  // If no filters were extracted at all, return null
  if (Object.keys(filters).length === 0) return null;

  return filters;
}

function resolveCountry(name) {
  const n = name.toLowerCase().trim();
  return countryMap[n] || null;
}

module.exports = { parseNaturalLanguageQuery };