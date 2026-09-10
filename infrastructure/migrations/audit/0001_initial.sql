-- Audit append-only. Nu exista UPDATE sau DELETE pe tabela asta nicaieri in cod.
-- `summary_json` contine DOAR date redactate (vezi `redacteaza()` din @xc/contracts).

CREATE TABLE IF NOT EXISTS audit_log (
  id             TEXT PRIMARY KEY,
  action         TEXT NOT NULL,
  target         TEXT NOT NULL,
  scope          TEXT NOT NULL,
  actor_type     TEXT NOT NULL,
  actor_id       TEXT,
  outcome        TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  summary_json   TEXT NOT NULL,
  occurred_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_moment ON audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tinta ON audit_log (target, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_corelare ON audit_log (correlation_id);

-- Marcajele de idempotenta ale consumatorilor de coada (folosite de event-worker).
CREATE TABLE IF NOT EXISTS evenimente_procesate (
  event_id     TEXT NOT NULL,
  consumer     TEXT NOT NULL,
  processed_at TEXT NOT NULL,
  PRIMARY KEY (event_id, consumer)
);
