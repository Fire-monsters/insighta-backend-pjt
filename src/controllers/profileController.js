const profileService = require('../services/profileService');
const { parseNaturalLanguageQuery } = require('../utils/nlpParser');
const { format } = require('fast-csv');

async function listProfiles(req, res) {
  try {
    const result = await profileService.getProfiles(req.query);
    return res.json({ status: 'success', ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ status: 'error', message: err.message });
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}

async function getProfile(req, res) {
  try {
    const profile = await profileService.getProfileById(req.params.id);
    if (!profile) return res.status(404).json({ status: 'error', message: 'Profile not found' });
    return res.json({ status: 'success', data: profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}

async function searchProfiles(req, res) {
  try {
    const { q, page, limit } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ status: 'error', message: 'Query parameter q is required' });
    }

    const parsed = parseNaturalLanguageQuery(q);
    if (!parsed) {
      return res.status(400).json({ status: 'error', message: 'Unable to interpret query' });
    }

    const result = await profileService.searchProfiles(parsed, { page, limit });
    return res.json({ status: 'success', ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ status: 'error', message: err.message });
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}

//Add the export function at the bottom:
async function exportProfiles(req, res) {
  try {
    // Reuse same filter logic but get ALL matching rows (no pagination)
    const pool = require('../config/db');
    const profileService = require('../services/profileService');

    // Build query with filters but no limit
    const filters = { ...req.query, limit: 10000, page: 1 };
    const result  = await profileService.getProfiles(filters);

    const filename = `profiles_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const csvStream = format({ headers: true });
    csvStream.pipe(res);

    const columns = [
      'id','name','gender','gender_probability','age','age_group',
      'country_id','country_name','country_probability','created_at'
    ];

    for (const row of result.data) {
      const entry = {};
      columns.forEach(col => { entry[col] = row[col]; });
      csvStream.write(entry);
    }

    csvStream.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Export failed' });
  }
}

async function createProfile(req, res) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ status: 'error', message: 'Name is required' });
    }

    const pool = require('../config/db');

    // Check for duplicate
    const existing = await pool.query('SELECT id FROM profiles WHERE name = $1', [name.trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ status: 'error', message: 'Profile with this name already exists' });
    }

    // For now, insert with placeholder values
    // (Stage 1 logic — calling external APIs — can be wired in later)
    return res.status(501).json({ status: 'error', message: 'External API enrichment not yet implemented' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}

async function deleteProfile(req, res) {
  try {
    const pool = require('../config/db');
    const result = await pool.query('DELETE FROM profiles WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }
    return res.json({ status: 'success', message: 'Profile deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}

module.exports = { listProfiles, getProfile, searchProfiles, exportProfiles, createProfile, deleteProfile };