CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS profiles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR     NOT NULL UNIQUE,
  gender        VARCHAR     NOT NULL CHECK (gender IN ('male', 'female')),
  gender_probability  FLOAT NOT NULL,
  age           INT         NOT NULL,
  age_group     VARCHAR     NOT NULL CHECK (age_group IN ('child', 'teenager', 'adult', 'senior')),
  country_id    VARCHAR(2)  NOT NULL,
  country_name  VARCHAR     NOT NULL,
  country_probability FLOAT NOT NULL,
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns (Stage 4B prep)
CREATE INDEX IF NOT EXISTS idx_profiles_gender      ON profiles(gender);
CREATE INDEX IF NOT EXISTS idx_profiles_age_group   ON profiles(age_group);
CREATE INDEX IF NOT EXISTS idx_profiles_country_id  ON profiles(country_id);
CREATE INDEX IF NOT EXISTS idx_profiles_age         ON profiles(age);