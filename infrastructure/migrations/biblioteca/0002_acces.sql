-- Biblioteca — cererea dreptului de imprumut.
--
-- Portata din `biserica-biblioteca/migrations/0002_acces.sql` (8 septembrie 2026), cu
-- `persoana_id` → `user_id`.
--
-- ⚠️ **Pastrata anume, la cererea utilizatorului (13.09.2026)**, desi se abate de la regula
-- „drepturile stau intr-un loc": tabelul tine CEREREA, nu dreptul. Dreptul de imprumut
-- (`library.borrow`) se da tot central, din `/admin`, de catre autorizare — biblioteca doar
-- duce cererea omului in fata pangarului, ca butonul „Cere dreptul de împrumut" din „Cărțile
-- mele" sa nu fie un buton care nu duce nicaieri. Nimic din ce scrie aici nu acorda vreun drept.
--
-- Ca peste tot in aplicatie: NU stau nume, email sau telefon — numai `user_id`.

-- rezolvata_la gol = cererea asteapta pangarul. `raspuns`: 'activat' | 'refuzat'.
CREATE TABLE IF NOT EXISTS cereri_acces (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL,
  ceruta_la    TEXT NOT NULL,   -- moment exact, cu fus: 2026-09-13T03:22:41+03:00
  rezolvata_la TEXT,
  raspuns      TEXT
);

CREATE INDEX IF NOT EXISTS acces_user     ON cereri_acces (user_id, rezolvata_la);
CREATE INDEX IF NOT EXISTS acces_deschise ON cereri_acces (rezolvata_la, id);
