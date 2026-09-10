-- Automatizare: reguli si actiunile produse de ele.
-- Fiecare regula are proprietar; automatizarea nu detine logica de domeniu a nimanui.

CREATE TABLE IF NOT EXISTS rules (
  id          TEXT PRIMARY KEY,
  nume        TEXT NOT NULL,
  declansator TEXT NOT NULL,
  risc        TEXT NOT NULL DEFAULT 'low',
  proprietar  TEXT NOT NULL,
  activa      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reguli_declansator ON rules (declansator, activa);

-- O actiune per (eveniment, regula) — de aici idempotenta la reluarea unui mesaj din coada.
CREATE TABLE IF NOT EXISTS actions (
  id             TEXT PRIMARY KEY,
  rule_id        TEXT NOT NULL,
  event_id       TEXT NOT NULL,
  kind           TEXT NOT NULL,
  risc           TEXT NOT NULL,
  stare          TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  input_json     TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  executed_at    TEXT,
  approved_by    TEXT,
  approved_at    TEXT,
  UNIQUE (event_id, rule_id)
);
CREATE INDEX IF NOT EXISTS idx_actiuni_stare ON actions (stare, created_at DESC);
