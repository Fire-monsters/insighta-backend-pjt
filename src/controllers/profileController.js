const profileService = require('../services/profileService');
const { parseNaturalLanguageQuery } = require('../utils/nlpParser');

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

module.exports = { listProfiles, getProfile, searchProfiles };