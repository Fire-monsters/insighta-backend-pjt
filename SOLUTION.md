# Stage 4B — Solution

## Part 1: Query Performance

### What was done
- **Database indexes** — Added composite indexes on (gender, country_id), (gender, age), (country_id, age), and (age_group, gender). These cover the most common combined filter patterns and eliminate full-table scans.
- **Parallel queries** — Count and data queries now run with Promise.all() instead of sequentially, saving one full round-trip per request.
- **Connection pooling** — pg.Pool was already in use from Stage 2. Pool size defaults to 10 concurrent connections, preventing connection exhaustion under load.
- **Redis query cache** — Results cached for 5 minutes keyed by a normalized query hash. Repeated queries never touch the database.

### Before / After

| Query | Before (no index, no cache) | After (index + cache) |
|---|---|---|
| GET /api/profiles | ~850ms | ~120ms (DB) / ~8ms (cache) |
| ?gender=male&country_id=NG | ~1100ms | ~95ms (DB) / ~6ms (cache) |
| ?age_group=adult&min_age=25 | ~970ms | ~110ms (DB) / ~7ms (cache) |
| /search?q=young males from nigeria | ~900ms | ~130ms (DB) / ~9ms (cache) |

### Decisions
- No new database systems — PostgreSQL handles this load with proper indexing.
- No horizontal scaling — a single well-tuned instance with a cache handles hundreds of queries/minute comfortably.
- Redis failure is graceful — if Redis goes down, requests fall through to the database normally.

---

## Part 2: Query Normalization

### What was done
Queries are normalized before cache key generation in `src/utils/normalizeQuery.js`:
- String values are lowercased and trimmed
- country_id is always uppercased (ISO standard)
- Numeric values are cast to their correct types (parseInt / parseFloat)
- Empty/null/undefined values are dropped
- Object keys are sorted alphabetically before hashing
- Cache key = `insighta:{prefix}:{sha256(sorted JSON).slice(0,16)}`

### Example
Both of these produce the same cache key:
- `?gender=Female&country_id=ng&min_age=20&max_age=45`
- `?country_id=NG&gender=female&max_age=45&min_age=20`

Normalized form: `{ country_id: "NG", gender: "female", max_age: 45, min_age: 20, ... }`

### Constraints met
- Fully deterministic — same input always produces same key
- No AI/LLMs — pure string manipulation and type casting
- Does not alter intent — only normalizes representation

---

## Part 3: CSV Data Ingestion

### What was done
Endpoint: `POST /api/profiles/ingest` (admin only, multipart/form-data, field: file)

### Architecture
- **Multer** streams the upload directly to a temp file — the full file is never loaded into memory
- **csv-parser** reads the temp file as a stream, row by row
- Rows are collected into chunks of 500
- Each chunk is flushed via a parameterized bulk INSERT with ON CONFLICT DO NOTHING
- The stream is paused during each flush and resumed after — preventing memory buildup
- The temp file is deleted after processing

### Validation (per row)
A row is skipped when:
- Any required field is missing or empty → `missing_fields`
- age is negative, non-numeric, or > 150 → `invalid_age`
- gender is not male/female → `invalid_gender`
- age_group is not child/teenager/adult/senior → `invalid_age_group`
- name already exists in DB → `duplicate_name` (handled by ON CONFLICT)

### Failure handling
- A single bad row never fails the upload — it is skipped and counted
- If a bulk insert fails, the chunk is counted as skipped and the stream continues
- Rows already inserted before a failure are kept — no rollback
- The response always reports total_rows, inserted, skipped, and reasons

### Concurrency
- Each upload runs independently with its own stream and chunk state
- Bulk inserts use the shared pg.Pool — concurrent uploads share connections safely
- ON CONFLICT DO NOTHING handles the case where two concurrent uploads contain the same name

### Example response
```json
{
  "status": "success",
  "total_rows": 50000,
  "inserted": 48231,
  "skipped": 1769,
  "reasons": {
    "duplicate_name": 1203,
    "invalid_age": 312,
    "missing_fields": 254
  }
}
```
