---

## Stage 3 — Authentication & Multi-Interface

### What was added
- GitHub OAuth 2.0 with PKCE support
- Access tokens (3 min expiry) + Refresh tokens (5 min expiry)
- Role-based access control — admin and analyst
- API versioning (X-API-Version: 1 header required)
- CSV profile export
- Rate limiting (10 req/min on auth, 60 req/min on API)
- Request logging

### Auth Flow
1. User hits `GET /auth/github`
2. Redirected to GitHub OAuth
3. GitHub redirects back to `/auth/github/callback`
4. Backend exchanges code for GitHub token
5. Fetches GitHub user info
6. Creates or updates user in DB
7. Issues access + refresh token pair
8. CLI → tokens returned as JSON redirect to localhost:9876
9. Web → access token passed to frontend, refresh token in HTTP-only cookie

### Token Handling
- Access token stored in localStorage (web) or credentials.json (CLI)
- Refresh token stored in HTTP-only cookie (web) or credentials.json (CLI)
- Auto-refresh on 401 responses in both interfaces
- Tokens are rotated on every refresh (old token invalidated)

### Role Enforcement
- All /api/* routes require a valid Bearer token
- Admin role required for POST /api/profiles and DELETE /api/profiles/:id
- Analyst role can read and search only
- Inactive users (is_active = false) receive 403 on all requests

### Interfaces
- REST API — Bearer token auth
- CLI — globally installable via npm link, credentials at ~/.insighta/credentials.json
- Web Portal — HTTP-only cookie session, GitHub OAuth login

### Repositories
- Backend: https://github.com/YOUR_USERNAME/insighta-backend
- CLI: https://github.com/YOUR_USERNAME/insighta-cli
- Web: https://github.com/YOUR_USERNAME/insighta-web

### Live URLs
- Backend: https://your-backend.up.railway.app
- Web Portal: https://insighta-web.vercel.app
