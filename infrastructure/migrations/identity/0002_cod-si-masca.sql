-- Doua schimbari cerute de utilizator pe 10.09.2026, amandoua in identitate:
--
-- 1. INTRAREA CU COD, nu cu link. Motivul dat: „e prea slaba securitatea doar cu link" — un
--    link din scrisoare poate fi deschis de scanerele antivirus ale furnizorului, poate fi
--    redirectionat, si intra fara ca omul sa scrie nimic. Codul cere omul la tastatura unde a
--    pornit intrarea. Tabela `login_challenges` (jetonul linkului) e inlocuita de
--    `coduri_intrare`, care are in plus contorul de greseli.
--
-- 2. „VEZI CA", masca super-adminului (adusa din V1). Sta pe SESIUNE, nu intr-un cookie: cine
--    umbla la cookie nu-si schimba drepturile, iar masca il urmeaza pe om in toate aplicatiile
--    platformei, fiindca sesiunea e una singura.

CREATE TABLE IF NOT EXISTS coduri_intrare (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL,
  -- NULL cand adresa nu are inca un cont: contul se creeaza la confirmarea codului,
  -- cu `display_name` purtat de aici.
  user_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  -- SHA-256 al lui `email:cod`, niciodata al codului singur: un tabel cu un milion de hash-uri
  -- ar sparge altfel orice cod din baza dintr-o privire.
  cod_hash     TEXT NOT NULL,
  -- Greselile se numara pe codul in curs; la a sasea, codul se stinge.
  incercari    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  consumed_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_coduri_email ON coduri_intrare (email, consumed_at);

-- Masca purtata de sesiune: `user`, `admin`, `anonim` sau NULL (omul se uita cu ochii lui).
ALTER TABLE sessions ADD COLUMN vezi_ca TEXT;

-- Coloana `link` nu mai are ce tine: nu mai pleaca niciun link. Ramane locul secretului de
-- dezvoltare (codul), scris DOAR de adaptorul sandbox.
ALTER TABLE emails_iesire RENAME COLUMN link TO secret_debug;

-- Drumul cu link nu mai exista nicaieri in cod.
DROP TABLE IF EXISTS login_challenges;
