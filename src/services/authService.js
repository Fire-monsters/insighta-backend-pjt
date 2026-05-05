require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// ── GitHub OAuth ─────────────────────────────────────────────────
async function exchangeCodeForToken(code) {
  const response = await axios.post(
    'https://github.com/login/oauth/access_token',
    {
      client_id:     process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    },
    { headers: { Accept: 'application/json' } }
  );
  return response.data.access_token;
}

async function getGithubUser(accessToken) {
  const response = await axios.get('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

// ── User management ──────────────────────────────────────────────
async function findOrCreateUser(githubUser) {
  const { id, login, email, avatar_url } = githubUser;

  const existing = await pool.query(
    'SELECT * FROM users WHERE github_id = $1',
    [String(id)]
  );

  if (existing.rows.length > 0) {
    // Update last login
    await pool.query(
      'UPDATE users SET last_login_at = NOW(), username = $1, avatar_url = $2 WHERE github_id = $3',
      [login, avatar_url, String(id)]
    );
    return existing.rows[0];
  }

  // Create new user (default role: analyst)
  const result = await pool.query(
    `INSERT INTO users (github_id, username, email, avatar_url, last_login_at)
     VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
    [String(id), login, email || null, avatar_url]
  );
  return result.rows[0];
}

// ── Token management ─────────────────────────────────────────────
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY }
  );
}

async function saveRefreshToken(userId, token) {
  // expires_at = now + 5 minutes
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
}

async function rotateRefreshToken(oldToken) {
  // Verify old token
  let payload;
  try {
    payload = jwt.verify(oldToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw { status: 401, message: 'Invalid or expired refresh token' };
  }

  // Check it exists in DB
  const result = await pool.query(
    'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
    [oldToken]
  );
  if (result.rows.length === 0) {
    throw { status: 401, message: 'Refresh token not found or expired' };
  }

  // Get user
  const userResult = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [payload.userId]
  );
  const user = userResult.rows[0];
  if (!user || !user.is_active) {
    throw { status: 403, message: 'User is inactive' };
  }

  // Delete old token (one-time use)
  await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [oldToken]);

  // Issue new pair
  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await saveRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken };
}

async function revokeRefreshToken(token) {
  await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
}

module.exports = {
  exchangeCodeForToken,
  getGithubUser,
  findOrCreateUser,
  generateAccessToken,
  generateRefreshToken,
  saveRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
};