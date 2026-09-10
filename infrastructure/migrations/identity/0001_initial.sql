-- Identitate FARA parola: utilizatori, sesiuni, jetoane de intrare. PII tinut la minimum:
-- email, nume afisat si atat. Fara telefon, adresa sau alte date personale.
--
-- Nu exista tabela de parole si nici nu va exista (decizie user, 10.09.2026): intrarea e
-- email -> link -> sesiune. Contul se naste abia la prima confirmare a unui link.

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,
  display_name      TEXT,
  email_verified_at TEXT NOT NULL,      -- nu poate fi NULL: fara confirmare nu exista cont
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

-- Linkul de intrare. `user_id` e NULL cand adresa nu are inca un cont: contul se creeaza la
-- consumul jetonului, cu `display_name` purtat de aici. Un singur consum, atomic.
CREATE TABLE IF NOT EXISTS login_challenges (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL,
  user_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  consumed_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_challenges_email ON login_challenges (email, consumed_at);

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

-- Jurnalul scrisorilor plecate: ce adaptor, cui, cand, cu ce rezultat. In dev (adaptor sandbox)
-- de aici se citeste linkul; in staging/productie linkul NU se scrie (coloana ramane goala).
CREATE TABLE IF NOT EXISTS emails_iesire (
  id             TEXT PRIMARY KEY,
  catre          TEXT NOT NULL,
  subiect        TEXT NOT NULL,
  link           TEXT,
  adaptor        TEXT NOT NULL,
  livrat         INTEGER NOT NULL DEFAULT 0,
  detaliu        TEXT,
  correlation_id TEXT NOT NULL,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_emails_catre ON emails_iesire (catre, created_at);
