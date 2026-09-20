-- PROGRAMAREA unei saptamani (20.09.2026, user: „La programul liturgic aceeasi poveste cu Validare
-- si publicare / Validare si programare, la fel ca la Buletinul bisericii").
--
-- O saptamana validata INAINTE de duminica dinaintea ei nu se valideaza pe loc: se PROGRAMEAZA
-- pentru duminica aceea, ora 12:00 a Bucurestiului — aceeasi clipa in care apare buletinul care o
-- tipareste pe pagina a patra. Cronul workerului (`scheduled`, la 5 minute) o trece la `validat`.
--
-- ⚠️ CHECK-ul pe `stare` NU SE ATINGE. O stare noua ar fi cerut refacerea tabelului (SQLite nu stie
-- `ALTER … DROP CONSTRAINT`), adica un table-rebuild peste datele parohiei din productie, pentru
-- un singur cuvant. In loc de asta: o saptamana e PROGRAMATA cand `stare = 'propus'` SI
-- `programat_la IS NOT NULL`. Pentru cine citeste din afara (site, `/v1/*`, enorias) ea ramane
-- `propus`, cum si este — programul nu s-a schimbat, doar si-a primit ceasul.
--
-- `programat_la` = CLIPA anuntata (ISO UTC, duminica la 12:00), nu clipa apasarii. Ea ajunge, la
-- trecere, chiar in `validat_la`: pe foaie si in anunt scrie ora pe care a citit-o omul pe buton,
-- nu ora la care s-a nimerit sa bata cronul.
-- `programat_de` = cine a apasat; tot el ajunge in `validat_de`, ca validarea sa ramana a lui.
--
-- ⚠️ ALTER fara `IF NOT EXISTS` (SQLite n-are): migratia se ruleaza O SINGURA DATA pe fiecare baza.

ALTER TABLE saptamani ADD COLUMN programat_la TEXT;
ALTER TABLE saptamani ADD COLUMN programat_de TEXT;

-- Cronul intreaba de 12 ori pe ora „e vreuna scadenta?"; indexul il tine o citire ieftina.
CREATE INDEX IF NOT EXISTS idx_saptamani_programat ON saptamani (programat_la);
