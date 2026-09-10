-- Calendarul ortodox. Proprietar unic al acestor date: `app-calendar`.
--
-- `zile` e extrasul structurat al calendarului oficial (Patriarhia Romana), o zi pe rand,
-- exact cum l-a publicat sursa. Traducerea in vocabularul platformei (`zi_liturgica`) se face
-- la citire, in cod — asa o corectura de traducere nu cere re-import.

CREATE TABLE IF NOT EXISTS zile (
  data              TEXT    PRIMARY KEY,          -- 'YYYY-MM-DD'
  an                INTEGER NOT NULL,
  luna              INTEGER NOT NULL,             -- 1..12
  zi                INTEGER NOT NULL,             -- 1..31
  zi_saptamana      INTEGER NOT NULL,             -- 0 = duminica ... 6 = sambata

  titlu             TEXT    NOT NULL,             -- textul intreg al sursei, curat (diacritice cu virgula)
  titlu_html        TEXT    NOT NULL DEFAULT '',  -- acelasi titlu, cu marcajul sursei pe clasele temei (c-rosu, c-albastru)
  subtitlu          TEXT    NOT NULL DEFAULT '',

  cruce             TEXT    NOT NULL DEFAULT '',  -- '' | 'duminica' | 'rosie' | 'albastra' | 'neagra'
  cruce_text        TEXT    NOT NULL DEFAULT '',  -- cum scrie sursa: '(†) Roșie', '†) Neagră', 'Duminica'
  zi_libera         INTEGER NOT NULL DEFAULT 0,

  post              TEXT    NOT NULL DEFAULT '',  -- textul sursei: 'Post' | 'Dezlegare la pește' | 'Harți' | ...
  perioada          TEXT    NOT NULL DEFAULT '',  -- textul sursei: 'Postul Sfintelor Paști' | 'Perioada Triodului' | ...
  sambata_mortilor  TEXT    NOT NULL DEFAULT '',
  nunti             INTEGER NOT NULL DEFAULT 0,
  parastase         INTEGER NOT NULL DEFAULT 0,
  faza_lunii        TEXT    NOT NULL DEFAULT '',

  evanghelia        TEXT    NOT NULL DEFAULT '',  -- referinta din sursa, cu prefix: 'Ev. Marcu 9, 33-41'
  apostolul         TEXT    NOT NULL DEFAULT '',  -- 'Ap. Evrei 11, 8-16'

  sursa_id          INTEGER,                      -- id-ul intrarii la Patriarhie
  sursa_link        TEXT    NOT NULL DEFAULT '',
  preluat_la        TEXT    NOT NULL              -- cand a fost preluat de la sursa (ISO 8601)
);
CREATE INDEX IF NOT EXISTS idx_zile_an ON zile (an, luna, zi);

-- Textul lung al zilei: sinaxarul, ca HTML curatat. Textul pericopelor NU se tine aici —
-- se cere de la Biblia platformei la afisare (decizie user, 1 sept. 2026).
CREATE TABLE IF NOT EXISTS texte (
  data        TEXT PRIMARY KEY REFERENCES zile (data) ON DELETE CASCADE,
  sinaxar     TEXT,
  preluat_la  TEXT NOT NULL
);

-- Provenienta: ce an s-a preluat, de unde, cand.
CREATE TABLE IF NOT EXISTS importuri (
  an           INTEGER PRIMARY KEY,
  sursa        TEXT    NOT NULL,
  endpoint     TEXT    NOT NULL,
  zile         INTEGER NOT NULL,
  octeti       INTEGER NOT NULL,
  preluat_la   TEXT    NOT NULL,
  importat_la  TEXT    NOT NULL
);

-- Fiecare schimbare a datelor publicate (preluare de an sau corectura pe zile) e o versiune.
-- `versiune_calendar` = ziua ultimei schimbari + numarul ei din ziua aceea ('2026-09-10.1').
CREATE TABLE IF NOT EXISTS versiuni (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  moment   TEXT NOT NULL,               -- ISO 8601
  de_la    TEXT NOT NULL,               -- prima zi atinsa
  pana_la  TEXT NOT NULL,               -- ultima zi atinsa
  motiv    TEXT NOT NULL DEFAULT '',
  autor    TEXT                         -- user_id sau 'import'
);
CREATE INDEX IF NOT EXISTS idx_versiuni_moment ON versiuni (moment);

-- Corecturile scrise de mana peste sursa, cu valoarea veche pastrata (auditabile, reversibile).
CREATE TABLE IF NOT EXISTS corecturi (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  data           TEXT NOT NULL,
  camp           TEXT NOT NULL,
  valoare_veche  TEXT,
  valoare_noua   TEXT,
  motiv          TEXT NOT NULL DEFAULT '',
  autor          TEXT,
  moment         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_corecturi_data ON corecturi (data);

-- Abonarea la calendar NU sta aici: e o audienta a serviciului de comunicare (`calendar-abonati`),
-- cu adresa contului. Aplicatia nu tine adrese de email.

-- Outbox-ul: se scrie in aceeasi tranzactie cu mutatia de domeniu.
CREATE TABLE IF NOT EXISTS outbox (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  envelope_json TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  published_at  TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_nepublicat ON outbox (published_at, created_at);
