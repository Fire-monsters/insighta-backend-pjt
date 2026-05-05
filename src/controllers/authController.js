const authService = require('../services/authService');

// GET /auth/github — redirect to GitHub
async function redirectToGithub(req, res) {
  const isCLI = req.query.cli === 'true';

  const state = Buffer.from(JSON.stringify({ cli: isCLI })).toString('base64');

  const params = new URLSearchParams({
    client_id:    process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_CALLBACK_URL,
    scope:        'read:user user:email',
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}

// GET /auth/github/callback
async function handleCallback(req, res) {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).json({ status: 'error', message: 'Missing code' });

    // Decode state to check if request came from CLI
    let isCLI = false;
    try {
      const decoded = JSON.parse(Buffer.from(state || '', 'base64').toString());
      isCLI = decoded.cli === true;
    } catch {
      isCLI = false;
    }

    const githubToken = await authService.exchangeCodeForToken(code);
    const githubUser  = await authService.getGithubUser(githubToken);
    const user        = await authService.findOrCreateUser(githubUser);

    if (!user.is_active) {
      return res.status(403).json({ status: 'error', message: 'Account is inactive' });
    }

    const accessToken  = authService.generateAccessToken(user);
    const refreshToken = authService.generateRefreshToken(user);
    await authService.saveRefreshToken(user.id, refreshToken);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   5 * 60 * 1000,
    });

    if (isCLI) {
      // Redirect to CLI local callback server with tokens
      const params = new URLSearchParams({
        access_token:  accessToken,
        refresh_token: refreshToken,
        username:      user.username,
        role:          user.role,
        user_id:       user.id,
      });
      return res.redirect(`http://localhost:9876/callback?${params}`);
    }

    // Web portal redirect
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/success?access_token=${accessToken}`
    );
  } catch (err) {
    console.error('Auth callback error:', err);
    res.status(500).json({ status: 'error', message: 'Authentication failed' });
  }
}

// POST /auth/refresh
async function refreshToken(req, res) {
  try {
    // Accept from body (CLI) or cookie (web)
    const token = req.body.refresh_token || req.cookies?.refresh_token;
    if (!token) {
      return res.status(400).json({ status: 'error', message: 'Refresh token required' });
    }

    const { accessToken, refreshToken } = await authService.rotateRefreshToken(token);

    // Update cookie for web
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   5 * 60 * 1000,
    });

    return res.json({
      status:        'success',
      access_token:  accessToken,
      refresh_token: refreshToken,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ status: 'error', message: err.message });
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}

// POST /auth/logout
async function logout(req, res) {
  try {
    const token = req.body.refresh_token || req.cookies?.refresh_token;
    if (token) await authService.revokeRefreshToken(token);
    res.clearCookie('refresh_token');
    return res.json({ status: 'success', message: 'Logged out' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}

module.exports = { redirectToGithub, handleCallback, refreshToken, logout };