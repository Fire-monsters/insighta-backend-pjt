/**
 * Normalizes a parsed filter object into a canonical form.
 * Guarantees that two queries with the same intent produce the same cache key.
 *
 * Rules:
 * - All string values are lowercased and trimmed
 * - country_id is always uppercased (ISO code)
 * - Numeric values are cast to numbers
 * - Keys are sorted alphabetically before hashing
 * - Undefined/null/empty values are dropped entirely
 */

const crypto = require('crypto');

const VALID_GENDERS    = ['male', 'female'];
const VALID_AGE_GROUPS = ['child', 'teenager', 'adult', 'senior'];

function normalizeFilters(raw) {
  const normalized = {};

  // gender — lowercase, validate
  if (raw.gender) {
    const g = String(raw.gender).toLowerCase().trim();
    if (VALID_GENDERS.includes(g)) normalized.gender = g;
  }

  // age_group — lowercase, validate
  if (raw.age_group) {
    const ag = String(raw.age_group).toLowerCase().trim();
    if (VALID_AGE_GROUPS.includes(ag)) normalized.age_group = ag;
  }

  // country_id — always uppercase ISO code
  if (raw.country_id) {
    normalized.country_id = String(raw.country_id).toUpperCase().trim();
  }

  // Numeric fields — cast to integer/float, drop if NaN
  if (raw.min_age !== undefined && raw.min_age !== '') {
    const v = parseInt(raw.min_age);
    if (!isNaN(v) && v >= 0) normalized.min_age = v;
  }

  if (raw.max_age !== undefined && raw.max_age !== '') {
    const v = parseInt(raw.max_age);
    if (!isNaN(v) && v >= 0) normalized.max_age = v;
  }

  if (raw.min_gender_probability !== undefined && raw.min_gender_probability !== '') {
    const v = parseFloat(raw.min_gender_probability);
    if (!isNaN(v)) normalized.min_gender_probability = v;
  }

  if (raw.min_country_probability !== undefined && raw.min_country_probability !== '') {
    const v = parseFloat(raw.min_country_probability);
    if (!isNaN(v)) normalized.min_country_probability = v;
  }

  // Pagination + sorting — normalize to consistent defaults
  normalized.page  = Math.max(1, parseInt(raw.page)  || 1);
  normalized.limit = Math.min(50, Math.max(1, parseInt(raw.limit) || 10));

  const validSortFields = ['age', 'created_at', 'gender_probability'];
  const validOrders     = ['asc', 'desc'];
  normalized.sort_by = validSortFields.includes(raw.sort_by) ? raw.sort_by : 'created_at';
  normalized.order   = validOrders.includes(raw.order)       ? raw.order   : 'asc';

  return normalized;
}

/**
 * Produces a deterministic cache key from a filter object.
 * Keys are sorted alphabetically so order of input doesn't matter.
 */
function buildCacheKey(prefix, filters) {
  const sorted = Object.keys(filters)
    .sort()
    .reduce((acc, key) => {
      acc[key] = filters[key];
      return acc;
    }, {});

  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(sorted))
    .digest('hex')
    .slice(0, 16); // 16 chars is plenty for uniqueness

  return `insighta:${prefix}:${hash}`;
}

module.exports = { normalizeFilters, buildCacheKey };