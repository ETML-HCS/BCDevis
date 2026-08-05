CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  next_device_number INTEGER NOT NULL DEFAULT 1 CHECK (next_device_number > 0),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'editor', 'reader')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  last_revision BIGINT,
  last_snapshot JSONB,
  last_seen_at TIMESTAMPTZ NOT NULL,
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_state (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS shared_settings (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  PRIMARY KEY (organization_id, key)
);

CREATE TABLE IF NOT EXISTS quote_counters (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value BIGINT NOT NULL CHECK (value >= 0),
  PRIMARY KEY (organization_id, key)
);

CREATE TABLE IF NOT EXISTS custom_services (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  PRIMARY KEY (organization_id, id)
);

CREATE TABLE IF NOT EXISTS catalog_overrides (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  PRIMARY KEY (organization_id, service_id)
);

CREATE TABLE IF NOT EXISTS quotes (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  number TEXT NOT NULL,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, number)
);

CREATE TABLE IF NOT EXISTS quote_number_sequences (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL,
  quote_day TEXT NOT NULL,
  next_value BIGINT NOT NULL DEFAULT 1 CHECK (next_value > 0),
  PRIMARY KEY (organization_id, prefix, quote_day)
);

CREATE TABLE IF NOT EXISTS quote_number_reservations (
  id BIGSERIAL PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL,
  quote_day TEXT NOT NULL,
  first_value BIGINT NOT NULL,
  last_value BIGINT NOT NULL,
  reserved_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quote_id TEXT,
  quote_number TEXT,
  client_name TEXT,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  sha256 TEXT NOT NULL,
  content BYTEA NOT NULL,
  uploaded_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_by_device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  revision BIGINT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS audit_org_idx ON audit_log(organization_id, id DESC);
CREATE INDEX IF NOT EXISTS quotes_updated_idx ON quotes(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS quote_number_reservations_org_idx ON quote_number_reservations(organization_id, id DESC);
CREATE INDEX IF NOT EXISTS documents_org_created_idx ON documents(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS documents_quote_idx ON documents(organization_id, quote_id);
