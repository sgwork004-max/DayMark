PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  credit_limit INTEGER NOT NULL DEFAULT 300 CHECK (credit_limit >= 0),
  used_credits INTEGER NOT NULL DEFAULT 0 CHECK (used_credits >= 0),
  max_devices INTEGER NOT NULL DEFAULT 2 CHECK (max_devices >= 1),
  expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  device_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
  UNIQUE (license_id, device_hash)
);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  model TEXT NOT NULL,
  input_chars INTEGER NOT NULL,
  output_chars INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_devices_license ON devices(license_id);
CREATE INDEX IF NOT EXISTS idx_usage_license_created ON usage_events(license_id, created_at);
