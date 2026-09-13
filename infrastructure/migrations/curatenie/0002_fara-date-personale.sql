-- A6 · Curatenia — voluntarii devin CONTURI ale platformei (user, 14.09.2026).
--
-- Pe 13.09.2026 utilizatorul ceruse anume ca „pickerul sa ramana": omul isi alegea numele dintr-o
-- lista, fara cont, iar aplicatia tinea nume, e-mail si telefon. I se spusese atunci ca e o
-- abatere de la „datele stau intr-un loc, autentificarea la fel", si a ales-o stiind.
--
-- Pe 14.09.2026 s-a razgandit, si in directia buna: „toate conturile care sunt acum la Curatenie
-- se vor face conturi Utilizator pe platforma; datele pentru un utilizator se vor extinde la tot
-- ce are un user in Curatenia acum". Deci:
--
--   * `first_name`, `last_name`, `email`, `phone` urca la identitate (`users`);
--   * `is_volunteer`, `is_monitor`, `is_admin`, `is_active` devin starea + etichetele asocierii
--     `curatenie` de pe contul omului (`asocieri`);
--   * aici RAMAN doar `id` (de el atarna cheile straine ale programarilor, vacantelor si
--     jurnalului — de aceea nu se poate renunta la el), `user_id`, `slug` si datele randului.
--
-- ⚠️ ORDINEA CONTEAZA: migratia asta se ruleaza DUPA ce importul a umplut `user_id` pe toate
-- randurile (`infrastructure/import/curatenie-oameni-in-conturi.mjs`). Altfel randurile fara cont
-- s-ar pierde — un voluntar fara `user_id` n-ar mai avea cum sa fie cineva.
--
-- SQLite nu stie `DROP COLUMN` pe o tabela cu indici si chei straine care o tintesc, asa ca se
-- face pe drumul lung: tabela noua, copiere, redenumire. Cheile straine se sting cat tine mutarea.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS volunteers_nou (
    id         INTEGER PRIMARY KEY,
    -- Contul platformei. NU mai poate lipsi: fara cont nu exista voluntar.
    user_id    TEXT    NOT NULL,
    -- Adresa scurta a fisei („mihai.p"), a aplicatiei, nu a omului: e cheie de URL, nu un nume.
    slug       TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- `id` se pastreaza NESCHIMBAT: pe el se sprijina `assignments.volunteer_id`,
-- `volunteer_vacations.volunteer_id` si `notifications_log.volunteer_id`.
INSERT OR REPLACE INTO volunteers_nou (id, user_id, slug, created_at, updated_at)
SELECT id, user_id, slug, created_at, updated_at
  FROM volunteers
 WHERE user_id IS NOT NULL AND TRIM(user_id) <> '';

DROP TABLE volunteers;
ALTER TABLE volunteers_nou RENAME TO volunteers;

CREATE UNIQUE INDEX IF NOT EXISTS idx_volunteers_user ON volunteers(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_volunteers_slug ON volunteers(slug) WHERE slug IS NOT NULL;

PRAGMA foreign_keys = ON;
