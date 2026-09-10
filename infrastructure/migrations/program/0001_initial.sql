-- Programul pilot. Proprietar unic al acestor date: `app-program`.

CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  location    TEXT,
  starts_at   TEXT NOT NULL,
  ends_at     TEXT,
  status      TEXT NOT NULL DEFAULT 'draft',
  scope       TEXT NOT NULL DEFAULT 'global',
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_stare ON events (status, starts_at);

-- Outbox-ul: se scrie in aceeasi tranzactie cu mutatia de domeniu.
CREATE TABLE IF NOT EXISTS outbox (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  envelope_json TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  published_at  TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_nepublicat ON outbox (published_at, created_at);
