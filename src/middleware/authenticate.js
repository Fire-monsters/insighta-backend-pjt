const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Fetch user from DB to check is_active
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [payload.userId]);
    const user   = result.rows[0];

    if (!user || !user.is_active) {
      return res.status(403).json({ status: 'error', message: 'Account is inactive' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ status: 'error', message: 'Access token expired' });
    }
    return res.status(401).json({ status: 'error', message: 'Invalid access token' });
  }
}

module.exports = authenticate;