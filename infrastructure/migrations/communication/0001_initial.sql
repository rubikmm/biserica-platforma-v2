-- Comunicare: audiente, preferinte, sabloane versionate, cereri si livrari.
-- Aplicatiile NU scriu aici — ele emit o cerere si atat.

CREATE TABLE IF NOT EXISTS audiences (
  id          TEXT PRIMARY KEY,
  nume        TEXT NOT NULL,
  descriere   TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audience_members (
  audience_id TEXT NOT NULL REFERENCES audiences(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  channel     TEXT NOT NULL,
  adresa      TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (audience_id, user_id, channel)
);

-- Preferintele si consimtamantul destinatarului. `opted_out = 1` opreste livrarea,
-- indiferent ce cere aplicatia.
CREATE TABLE IF NOT EXISTS preferences (
  user_id    TEXT NOT NULL,
  channel    TEXT NOT NULL,
  opted_out  INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, channel)
);

CREATE TABLE IF NOT EXISTS templates (
  id         TEXT NOT NULL,
  version    INTEGER NOT NULL,
  channel    TEXT NOT NULL,
  subject    TEXT,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (id, version, channel)
);

CREATE TABLE IF NOT EXISTS requests (
  id              TEXT PRIMARY KEY,
  audience_id     TEXT NOT NULL,
  template_id     TEXT NOT NULL,
  channel         TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  correlation_id  TEXT NOT NULL,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deliveries (
  id         TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  channel    TEXT NOT NULL,
  recipient  TEXT NOT NULL,
  status     TEXT NOT NULL,
  provider   TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_livrari_moment ON deliveries (created_at DESC);
