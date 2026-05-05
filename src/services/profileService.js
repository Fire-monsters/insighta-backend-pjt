const pool = require('../config/db');

const VALID_SORT_FIELDS = ['age', 'created_at', 'gender_probability'];
const VALID_ORDERS = ['asc', 'desc'];
const VALID_GENDERS = ['male', 'female'];
const VALID_AGE_GROUPS = ['child', 'teenager', 'adult', 'senior'];

function buildProfileQuery(filters) {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (filters.gender) {
    if (!VALID_GENDERS.includes(filters.gender)) throw { status: 422, message: 'Invalid gender value' };
    conditions.push(`gender = $${idx++}`);
    values.push(filters.gender);
  }

  if (filters.age_group) {
    if (!VALID_AGE_GROUPS.includes(filters.age_group)) throw { status: 422, message: 'Invalid age_group value' };
    conditions.push(`age_group = $${idx++}`);
    values.push(filters.age_group);
  }

  if (filters.country_id) {
    conditions.push(`UPPER(country_id) = $${idx++}`);
    values.push(filters.country_id.toUpperCase());
  }

  if (filters.min_age !== undefined) {
    const v = parseInt(filters.min_age);
    if (isNaN(v)) throw { status: 422, message: 'min_age must be a number' };
    conditions.push(`age >= $${idx++}`);
    values.push(v);
  }

  if (filters.max_age !== undefined) {
    const v = parseInt(filters.max_age);
    if (isNaN(v)) throw { status: 422, message: 'max_age must be a number' };
    conditions.push(`age <= $${idx++}`);
    values.push(v);
  }

  if (filters.min_gender_probability !== undefined) {
    const v = parseFloat(filters.min_gender_probability);
    if (isNaN(v)) throw { status: 422, message: 'min_gender_probability must be a number' };
    conditions.push(`gender_probability >= $${idx++}`);
    values.push(v);
  }

  if (filters.min_country_probability !== undefined) {
    const v = parseFloat(filters.min_country_probability);
    if (isNaN(v)) throw { status: 422, message: 'min_country_probability must be a number' };
    conditions.push(`country_probability >= $${idx++}`);
    values.push(v);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, values, idx };
}

async function getProfiles(filters) {
  const page  = Math.max(1, parseInt(filters.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(filters.limit) || 10));
  const offset = (page - 1) * limit;

  const sortBy = VALID_SORT_FIELDS.includes(filters.sort_by) ? filters.sort_by : 'created_at';
  const order  = VALID_ORDERS.includes(filters.order) ? filters.order : 'asc';

  const { where, values, idx } = buildProfileQuery(filters);

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM profiles ${where}`,
    values
  );
  const total = parseInt(countResult.rows[0].count);

  const dataResult = await pool.query(
    `SELECT * FROM profiles ${where} ORDER BY ${sortBy} ${order} LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset]
  );

  return { page, limit, total, data: dataResult.rows };
}

async function getProfileById(id) {
  const result = await pool.query('SELECT * FROM profiles WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function searchProfiles(parsedFilters, pagination) {
  return getProfiles({ ...parsedFilters, ...pagination });
}

module.exports = { getProfiles, getProfileById, searchProfiles };