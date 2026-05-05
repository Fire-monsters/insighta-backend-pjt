require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

// ── Place your downloaded JSON file at src/config/profiles.json ──

async function seed() {
  const filePath = path.join(__dirname, 'profiles.json');

  if (!fs.existsSync(filePath)) {
    console.error('❌  profiles.json not found at src/config/profiles.json');
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(raw);
  
  const profiles = json.profiles || json; // handles both {profiles: [...]} and plain array
  if (!Array.isArray(profiles)) {
    console.error(' Expected an array of profiles in the JSON file');
    process.exit(1);
  }

  console.log(`📦  Found ${profiles.length} profiles. Seeding...`);

  let inserted = 0;
  let skipped = 0;

  for (const p of profiles) {
    try {
      await pool.query(
        `INSERT INTO profiles 
          (name, gender, gender_probability, age, age_group, country_id, country_name, country_probability)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (name) DO NOTHING`,
        [
          p.name,
          p.gender,
          p.gender_probability,
          p.age,
          p.age_group,
          p.country_id,
          p.country_name,
          p.country_probability,
        ]
      );
      inserted++;
    } catch (err) {
      console.warn(`⚠️  Skipped "${p.name}":`, err.message);
      skipped++;
    }
  }

  console.log(`✅  Done. Inserted: ${inserted}, Skipped: ${skipped}`);
  await pool.end();
}

seed();