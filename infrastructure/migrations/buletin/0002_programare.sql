-- NUMARUL PROGRAMAT — user, 20.09.2026: „daca este inainte de ziua pentru care este programat
-- buletinul — adica inainte de ora 12.00, duminica aceea — se poate doar «Valideaza si
-- programeaza»; daca este duminica dupa ora 12.00 — «Valideaza si publica»."
--
-- ⚠️ SI, LA 14:11 IN ACEEASI ZI: „sa fie o programare REALA — adica din uneltele de cron din
-- Cloudflare". Deosebirea nu e de amanunt, e de FEL:
--
--   * prima varianta tinea starea IMPLICITA — un rand era „programat" daca `publicat_la` se
--     intampla sa fie in viitor, iar fiecare citire compara ceasul. Nimeni nu trecea numarul: el
--     „devenea" public fiindca se schimba raspunsul la o intrebare pusa la fiecare cerere;
--   * varianta asta tine starea SCRISA (`stare`), iar cine o schimba e CEASUL WORKERULUI
--     (`triggers.crons` din `apps/buletin/wrangler.jsonc`, handlerul `scheduled`). Randul zice el
--     insusi ce e. O interogare care uita cernerea nu mai scoate numarul dupa o socoteala ascunsa,
--     iar „cand a aparut" se citeste din baza, nu se deduce.
--
-- Doua coloane, amandoua pe randul numarului:
--
--   `stare`       'programat' | 'publicat'. NOT NULL, implicit 'publicat' — asa raman cele 619
--                 numere aduse din V1 si tot ce s-a publicat de pe platforma pana acum: ele n-au
--                 trecut niciodata printr-o programare, deci sunt publicate din capul locului.
--   `publicat_la` clipa DE LA CARE e public, ISO UTC. La publicarea pe loc e chiar clipa apasarii;
--                 la programare e duminica lui, ora 12:00 a Bucurestiului, adusa in UTC (09:00Z
--                 vara, 10:00Z iarna — vezi `apps/buletin/src/ceas.ts`). NULL la randurile vechi,
--                 care n-au avut niciodata un prag: nu li se inventeaza unul.
--                 ⚠️ Ceasul NU rescrie `publicat_la` cand trece numarul pe 'publicat': acolo sta
--                 clipa ANUNTATA parohiei (duminica, 12:00), nu clipa in care s-a nimerit sa bata
--                 cronul (pana la cinci minute mai tarziu). Altfel „a aparut la 12:00" ar fi devenit
--                 „a aparut la 12:03", si n-ar mai fi fost adevarat ce scrie pe ecran.
--
-- Cine vede ce: neadminul vede DOAR `stare = 'publicat'` (o clauza, intr-un singur loc — `cerne`
-- din `src/depozit.ts`); adminul buletinului vede tot, cu eticheta „Programat — apare duminica, …".
--
-- Idempotenta: ALTER TABLE nu are `IF NOT EXISTS` in SQLite, deci migratia asta se ruleaza O
-- SINGURA DATA. La a doua rulare cade cu „duplicate column name" — e semnul ca era deja facuta.
-- (Aceeasi rânduiala ca la `identity/0003_date-si-asocieri.sql`.)

ALTER TABLE buletine ADD COLUMN stare TEXT NOT NULL DEFAULT 'publicat';
ALTER TABLE buletine ADD COLUMN publicat_la TEXT;

-- Ceasul intreaba, la fiecare cinci minute duminica dimineata, un singur lucru: „ce rand e
-- programat si i-a venit clipa?". Indexul e chiar intrebarea aceea.
CREATE INDEX IF NOT EXISTS idx_buletine_programate ON buletine(stare, publicat_la);
