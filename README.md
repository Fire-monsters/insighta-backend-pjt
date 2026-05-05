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


---

## Stage 4B — System Optimization & Data Ingestion

### Query Performance
- Composite DB indexes on common filter combinations
- Redis query cache (5-min TTL) — cache hits return in under 10ms
- Parallel count + data queries via Promise.all()
- Connection pooling via pg.Pool

### Query Normalization
- All filters normalized before cache key generation
- String values lowercased, country_id uppercased, numerics cast
- Keys sorted alphabetically — query param order never affects cache key
- Two queries with the same intent always hit the same cache entry

### CSV Ingestion
- Endpoint: POST /api/profiles/ingest (admin only)
- Streams file via multer → csv-parser, never loads full file into memory
- Bulk inserts in chunks of 500 rows
- Bad rows skipped, never fail the upload
- Concurrent uploads supported via shared pg.Pool
- Returns summary: total_rows, inserted, skipped, reasons
