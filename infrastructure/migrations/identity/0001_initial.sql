-- Identitate: utilizatori, sesiuni, jetoane. PII tinut la minimum:
-- email, nume afisat si atat. Fara telefon, adresa sau alte date personale.

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,
  display_name      TEXT,
  password_hash     TEXT NOT NULL,
  email_verified_at TEXT,
  disabled_at       TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- Identitati externe (Google, Apple...). Neutilizata acum, dar modelata de la inceput,
-- ca adaugarea unui provider sa nu ceara schimbarea tabelei `users`.
CREATE TABLE IF NOT EXISTS identities (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  UNIQUE (provider, provider_subject)
);

-- Sesiuni opace. `token_hash` = SHA-256 al jetonului; jetonul in clar nu se stocheaza nicaieri.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  ip         TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id, revoked_at);

-- Al doilea factor: linkul trimis pe email la fiecare autentificare.
CREATE TABLE IF NOT EXISTS login_challenges (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_challenges_user ON login_challenges (user_id, consumed_at);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  consumed_at TEXT
);

-- Contorul de rate limiting. Se curata singur (intrarile mai vechi de 24h).
CREATE TABLE IF NOT EXISTS login_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cheie      TEXT NOT NULL,
  fel        TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts ON login_attempts (cheie, fel, created_at);

-- Consimtaminte (GDPR). Retentie: se pastreaza cat timp exista contul.
CREATE TABLE IF NOT EXISTS consents (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  revoked_at TEXT
);

-- Emailurile „trimise" de adaptorul sandbox. In dev, de aici se citeste linkul de confirmare.
-- In productie tabela ramane goala (adaptorul real nu scrie continut aici).
CREATE TABLE IF NOT EXISTS emails_iesire (
  id             TEXT PRIMARY KEY,
  catre          TEXT NOT NULL,
  subiect        TEXT NOT NULL,
  text           TEXT NOT NULL,
  link           TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  adaptor        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_emails_catre ON emails_iesire (catre, created_at);
