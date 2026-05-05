const fs     = require('fs');
const csv    = require('csv-parser');
const pool   = require('../config/db');

const REQUIRED_FIELDS  = ['name', 'gender', 'age', 'age_group', 'country_id', 'country_name'];
const VALID_GENDERS    = ['male', 'female'];
const VALID_AGE_GROUPS = ['child', 'teenager', 'adult', 'senior'];
const CHUNK_SIZE       = 500; // rows per bulk insert

/**
 * Validates a single CSV row.
 * Returns { valid: true } or { valid: false, reason: 'key' }
 */
function validateRow(row) {
  // Check required fields exist and are not empty
  for (const field of REQUIRED_FIELDS) {
    if (!row[field] || String(row[field]).trim() === '') {
      return { valid: false, reason: 'missing_fields' };
    }
  }

  const age = parseInt(row.age);
  if (isNaN(age) || age < 0 || age > 150) {
    return { valid: false, reason: 'invalid_age' };
  }

  if (!VALID_GENDERS.includes(String(row.gender).toLowerCase().trim())) {
    return { valid: false, reason: 'invalid_gender' };
  }

  if (!VALID_AGE_GROUPS.includes(String(row.age_group).toLowerCase().trim())) {
    return { valid: false, reason: 'invalid_age_group' };
  }

  const genderProb  = parseFloat(row.gender_probability);
  const countryProb = parseFloat(row.country_probability);
  if (isNaN(genderProb)  || genderProb  < 0 || genderProb  > 1) return { valid: false, reason: 'invalid_gender_probability' };
  if (isNaN(countryProb) || countryProb < 0 || countryProb > 1) return { valid: false, reason: 'invalid_country_probability' };

  return { valid: true };
}

/**
 * Bulk inserts a chunk of validated rows.
 * Uses ON CONFLICT DO NOTHING to handle duplicates gracefully.
 * Returns { inserted, duplicates }
 */
async function bulkInsert(rows) {
  if (rows.length === 0) return { inserted: 0, duplicates: 0 };

  // Build parameterized bulk insert
  // e.g. ($1,$2,...,$8), ($9,$10,...,$16), ...
  const values  = [];
  const placeholders = rows.map((row, i) => {
    const base = i * 8;
    values.push(
      String(row.name).trim(),
      String(row.gender).toLowerCase().trim(),
      parseFloat(row.gender_probability),
      parseInt(row.age),
      String(row.age_group).toLowerCase().trim(),
      String(row.country_id).toUpperCase().trim(),
      String(row.country_name).trim(),
      parseFloat(row.country_probability)
    );
    return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8})`;
  });

  const query = `
    INSERT INTO profiles
      (name, gender, gender_probability, age, age_group, country_id, country_name, country_probability)
    VALUES ${placeholders.join(',')}
    ON CONFLICT (name) DO NOTHING
  `;

  const result = await pool.query(query, values);

  // rowCount = actually inserted; rows.length - rowCount = duplicates skipped
  const inserted   = result.rowCount;
  const duplicates = rows.length - inserted;
  return { inserted, duplicates };
}

/**
 * POST /api/profiles/ingest
 * Streams the uploaded CSV file, validates rows in chunks,
 * and bulk inserts valid rows into the database.
 */
async function ingestCSV(req, res) {
  if (!req.file) {
    return res.status(400).json({ status: 'error', message: 'No CSV file uploaded' });
  }

  const filePath = req.file.path;

  const stats = {
    total_rows: 0,
    inserted:   0,
    skipped:    0,
    reasons:    {},
  };

  let chunk        = [];
  let streamClosed = false;

  function trackSkip(reason) {
    stats.skipped++;
    stats.reasons[reason] = (stats.reasons[reason] || 0) + 1;
  }

  async function flushChunk() {
    if (chunk.length === 0) return;
    const toInsert = chunk.splice(0); // take all, reset chunk
    try {
      const { inserted, duplicates } = await bulkInsert(toInsert);
      stats.inserted += inserted;
      if (duplicates > 0) {
        stats.reasons['duplicate_name'] = (stats.reasons['duplicate_name'] || 0) + duplicates;
        stats.skipped += duplicates;
      }
    } catch (err) {
      // If bulk insert fails, count the whole chunk as skipped
      console.error('Bulk insert error:', err.message);
      stats.skipped += toInsert.length;
      stats.reasons['insert_error'] = (stats.reasons['insert_error'] || 0) + toInsert.length;
    }
  }

  return new Promise((resolve) => {
    const stream = fs.createReadStream(filePath)
      .pipe(csv());

    stream.on('data', async (row) => {
      stats.total_rows++;

      const validation = validateRow(row);
      if (!validation.valid) {
        trackSkip(validation.reason);
        return;
      }

      chunk.push(row);

      // When chunk is full, pause stream, flush, then resume
      if (chunk.length >= CHUNK_SIZE) {
        stream.pause();
        await flushChunk();
        stream.resume();
      }
    });

    stream.on('end', async () => {
      // Flush any remaining rows
      await flushChunk();

      // Clean up temp file
      fs.unlink(filePath, () => {});

      streamClosed = true;
      resolve(
        res.json({
          status:     'success',
          total_rows: stats.total_rows,
          inserted:   stats.inserted,
          skipped:    stats.skipped,
          reasons:    stats.reasons,
        })
      );
    });

    stream.on('error', async (err) => {
      console.error('CSV stream error:', err.message);
      await flushChunk();
      fs.unlink(filePath, () => {});
      if (!streamClosed) {
        resolve(
          res.status(500).json({
            status:     'partial',
            message:    'Stream error — partial results',
            total_rows: stats.total_rows,
            inserted:   stats.inserted,
            skipped:    stats.skipped,
            reasons:    stats.reasons,
          })
        );
      }
    });
  });
}

module.exports = { ingestCSV };