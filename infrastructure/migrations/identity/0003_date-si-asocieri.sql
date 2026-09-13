-- Doua schimbari cerute de utilizator pe 14.09.2026, amandoua nascute din portarea curateniei.
--
-- 1. FISA OMULUI SE INTREGESTE. Pana acum `users` tinea „PII la minimum: email, nume afisat si
--    atat". Era prea putin: aplicatia de curatenie tinea despre acelasi om prenume, nume, telefon
--    si un nume scurt („Mihai P."), adica o A DOUA lista de persoane in platforma — exact ce nu
--    trebuia sa existe. Utilizatorul a cerut ca „datele pentru un utilizator sa se extinda la tot
--    ce are un user in Curatenia acum". Deci coloanele urca AICI, iar aplicatia ramane fara ele.
--
-- 2. ASOCIEREA CU O APLICATIE. Apartenenta la o aplicatie („e in echipa de curatenie") devine un
--    comutator pe contul omului, pe care il vede fiecare la el. Tabelul e generic dinadins:
--    `aplicatie` e un cod, iar `etichete` un sir de cuvinte al carui inteles il stie numai
--    aplicatia. Identitatea nu stie ce e un „monitor" si nu trebuie sa stie.
--
--    ⚠️ Doua stari, nu una (user, 14.09.2026): omul CERE, administratorul aplicatiei ACCEPTA.
--    „Nici chiar oricine nu poate ajunge in acest punct." Iesirea nu cere voie — randul se sterge.
--
-- Idempotenta: ALTER TABLE nu are `IF NOT EXISTS` in SQLite, deci migratia asta se ruleaza O
-- SINGURA DATA. La a doua rulare cade cu „duplicate column name" — e semnul ca era deja facuta.

ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name  TEXT;
ALTER TABLE users ADD COLUMN phone      TEXT;
ALTER TABLE users ADD COLUMN short_name TEXT;

CREATE TABLE IF NOT EXISTS asocieri (
  id          TEXT NOT NULL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Codul aplicatiei (`curatenie`, …). E scris in randuri, deci nu se schimba niciodata.
  aplicatie   TEXT NOT NULL,
  -- 'ceruta' | 'acceptata'
  stare       TEXT NOT NULL DEFAULT 'ceruta',
  -- JSON: sirul etichetelor puse de aplicatie (ex. ["voluntar","monitor"]).
  etichete    TEXT NOT NULL DEFAULT '[]',
  -- Cine a pornit-o: omul insusi, sau administratorul care l-a adus in echipa.
  cerut_de    TEXT,
  -- Administratorul care a validat. NULL cat timp asocierea e doar ceruta.
  acceptat_de TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (user_id, aplicatie)
);
CREATE INDEX IF NOT EXISTS idx_asocieri_app  ON asocieri (aplicatie, stare);
CREATE INDEX IF NOT EXISTS idx_asocieri_user ON asocieri (user_id);
