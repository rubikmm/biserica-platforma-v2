-- A3 · arhiva buletinelor parohiei, pe platforma V2.
--
-- Un rand = un numar aparut. Fisierele nu stau aici, ci in R2 (`xc-buletin-staging`); in baza stau
-- doar CHEILE lor — `2026/buletin-615-2026-09-06.pdf` — pe care aplicatia le serveste la
-- `/fisier/<cheie>`.
--
-- Cheia primara e (nr, data), nu una singura, fiindca arhiva parohiei are amandoua felurile de
-- neregula: acelasi numar filat cu doua date si doua numere in aceeasi zi (445 si 446 pe 17 iulie
-- 2022). Nu le indreptam noi — le aratam cum sunt.
--
-- `text` = primele patru pagini, scoase din PDF la importul din V1; `text_plat` = acelasi text fara
-- diacritice si cu litere mici, LITERA CU LITERA (aceeasi lungime). Cautarea se face pe `text_plat`,
-- iar fragmentul aratat in rezultate se taie din `text` la aceeasi pozitie — de aceea `plat()` din
-- `src/depozit.ts` trebuie sa ramana exact functia cu care s-a scris coloana.
--
-- ⚠️ Tabelul `abonati` din V1 NU s-a adus: in V2 abonarea e o audienta a comunicarii, iar aplicatia
-- nu tine nicio adresa de e-mail (structura mare, user 10.09.2026).

CREATE TABLE IF NOT EXISTS buletine (
  nr              INTEGER NOT NULL,            -- numarul de pe hartie
  data            TEXT NOT NULL,               -- ziua aparitiei, 'YYYY-MM-DD'
  an              TEXT NOT NULL,               -- 'YYYY', pentru filtrarea din arhiva
  luna            TEXT NOT NULL,               -- 'MM', pentru gruparea pe luni
  cheie_pdf       TEXT,                        -- cheia din R2; null la numerele ramase doar cu poza
  cheie_poza      TEXT,                        -- pagina 1, latime 1400
  cheie_poza_mica TEXT,                        -- pagina 1, latime 460 (raftul arhivei)
  marime_pdf      INTEGER NOT NULL DEFAULT 0,
  pagini          INTEGER,
  sursa           TEXT NOT NULL DEFAULT 'arhiva',  -- 'arhiva' · 'site' · 'arhiva+site' · 'arhiva-poza'
  text            TEXT NOT NULL DEFAULT '',
  text_plat       TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (nr, data)
);

CREATE INDEX IF NOT EXISTS idx_buletine_data ON buletine(data DESC);
CREATE INDEX IF NOT EXISTS idx_buletine_an ON buletine(an, data DESC);
