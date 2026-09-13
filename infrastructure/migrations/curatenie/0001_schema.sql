-- A6 · Curatenia bisericii — schema bazei NOI (`xc-curatenie-*`).
--
-- Numele tabelelor si ale coloanelor sunt CELE DIN V1, dinadins: programarile, re-numerotarea
-- „trenulet" si cele trei rapoarte s-au portat interogare cu interogare, iar datele (29 de
-- voluntari, 81 de programari, 31 de rapoarte, 529 de mesaje) s-au copiat rand cu rand. Un
-- rebotez in romana ar fi cerut rescrierea fiecarui SELECT, cu nimic castigat in afara de risc.
--
-- Ce NU s-a copiat din V1, si de ce:
--   * `password_hash`, `password_reset_token`, `password_reset_expires_at` — dreptul de
--     administrare e al platformei (`cleaning.manage`), nu al unei parole din aplicatie;
--   * `persoana_id` s-a facut `user_id`, ca peste tot in V2.
--
-- Idempotenta: se poate rula de oricate ori.

-- Voluntarii. ⚠️ Aici stau nume, e-mail si telefon — singura aplicatie V2 care tine date
-- personale, fiindca utilizatorul a cerut anume sa RAMANA pickerul din V1 („mod simplu"): omul isi
-- alege numele din lista, fara cont. I s-a spus limpede ca se abate de la „datele stau intr-un
-- loc, autentificarea la fel"; a ales-o stiind (13.09.2026). Cine intra totusi cu contul
-- platformei se leaga de randul lui prin `user_id`, iar de atunci e recunoscut instantaneu.
CREATE TABLE IF NOT EXISTS volunteers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name  TEXT    NOT NULL,
    last_name   TEXT    NOT NULL,
    email       TEXT,
    phone       TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    -- `is_admin` a ramas ca ETICHETA a echipei (cine e „Admin" pe cartela, cine primeste
    -- rapoartele din oficiu), NU ca drept: dreptul il da autorizarea centrala.
    is_admin    INTEGER NOT NULL DEFAULT 0,
    slug        TEXT,
    is_volunteer INTEGER NOT NULL DEFAULT 1,
    is_monitor  INTEGER NOT NULL DEFAULT 0,
    -- Contul platformei legat de acest voluntar, cand omul a intrat o data cu el.
    user_id     TEXT
);
CREATE INDEX IF NOT EXISTS idx_volunteers_active ON volunteers(is_active);
CREATE INDEX IF NOT EXISTS idx_volunteers_name   ON volunteers(first_name, last_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_volunteers_slug ON volunteers(slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_volunteers_user ON volunteers(user_id) WHERE user_id IS NOT NULL;

-- O programare = un voluntar pe o POZITIE a unei duminici. Pozitiile se tin contigue (1..N):
-- la eliberare, cele de dupa se trag cu un rang mai jos („trenuletul" din V1).
CREATE TABLE IF NOT EXISTS assignments (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    sunday_date    TEXT    NOT NULL,
    slot_position  INTEGER NOT NULL CHECK (slot_position >= 1),
    volunteer_id   INTEGER NOT NULL,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(sunday_date, slot_position),
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_assignments_date      ON assignments(sunday_date);
CREATE INDEX IF NOT EXISTS idx_assignments_volunteer ON assignments(volunteer_id);

-- Jurnalul aplicatiei — „Mesaje de sistem" din panou: ce s-a ocupat, ce s-a eliberat, ce a facut
-- adminul, ce raport a plecat si catre cine. `status` = 'logged' | 'sent' | 'failed'.
CREATE TABLE IF NOT EXISTS notifications_log (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type     TEXT    NOT NULL,
    message        TEXT    NOT NULL,
    sunday_date    TEXT,
    slot_position  INTEGER,
    volunteer_id   INTEGER,
    status         TEXT    NOT NULL DEFAULT 'logged',
    error          TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    sent_at        TEXT,
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications_log(status, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_date   ON notifications_log(created_at DESC);

-- Setarile aplicatiei: cate pozitii are o duminica, ziua si ora fiecarui raport, bataia ceasului.
CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- Arhiva rapoartelor compuse de aplicatie, cu HTML-ul lor si cu lista destinatarilor. Posta
-- platformei tine arhiva LIVRARILOR; asta de aici e arhiva a ce a SCRIS curatenia, si e cea pe
-- care o rasfoieste adminul in panou (ca `scrisori` la biblioteca).
CREATE TABLE IF NOT EXISTS newsletter_history (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    sunday_date      TEXT    NOT NULL,
    subject          TEXT    NOT NULL,
    html_content     TEXT    NOT NULL,
    recipients_count INTEGER NOT NULL DEFAULT 0,
    failed_count     INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    kind             TEXT    NOT NULL DEFAULT 'weekly',
    recipients_json  TEXT,
    is_test          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_newsletter_kind ON newsletter_history(kind, id DESC);

-- Vacanta pe luni intregi. Interfata ei e ASCUNSA, ca in V1 (`VACANTA_IN_PAGINA = false`), dar
-- spatele e intreg: raportul lunar socoteste cati voluntari sunt indisponibili.
CREATE TABLE IF NOT EXISTS volunteer_vacations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    volunteer_id INTEGER NOT NULL,
    year         INTEGER NOT NULL,
    month        INTEGER NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(volunteer_id, year, month),
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vacations_volunteer ON volunteer_vacations(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_vacations_ym ON volunteer_vacations(year, month);
