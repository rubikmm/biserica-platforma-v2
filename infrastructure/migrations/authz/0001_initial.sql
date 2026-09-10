-- Autorizare: atribuiri de rol si granturi punctuale de permisiuni.
-- Proprietarul acestor date e `authorization-worker`; nicio alta aplicatie nu scrie aici.

CREATE TABLE IF NOT EXISTS role_assignments (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  role       TEXT NOT NULL,
  scope      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE (user_id, role, scope)
);
CREATE INDEX IF NOT EXISTS idx_roluri_user ON role_assignments (user_id, revoked_at);

-- Permisiuni date direct unui utilizator, peste ce ii ofera rolul.
CREATE TABLE IF NOT EXISTS permission_grants (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  permission TEXT NOT NULL,
  scope      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE (user_id, permission, scope)
);
CREATE INDEX IF NOT EXISTS idx_granturi_user ON permission_grants (user_id, revoked_at);
