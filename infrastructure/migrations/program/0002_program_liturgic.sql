-- Programul liturgic (A2 din V1) ia locul pilotului. Proprietar unic: `app-program`.
-- Ce se slujeste efectiv, la ce ora: saptamani (luni -> duminica), slujbe cu id STABIL, vocabularul
-- inchis al celor 29 de nume, istoricul schimbarilor. Ziua liturgica NU se tine aici — se cere de la
-- calendar la afisare. Abonatii NU se tin aici — audienta `program-abonati` a comunicarii.

DROP TABLE IF EXISTS events;

CREATE TABLE IF NOT EXISTS vocabular (
  cod_nume   TEXT PRIMARY KEY,                 -- cum se recunoaste in cod: 'utrenia_liturghie'
  nume       TEXT NOT NULL,                    -- cum se scrie pe foaia A4
  categorie  TEXT NOT NULL CHECK (categorie IN ('dimineata', 'seara', 'alte')),
  ordine     INTEGER NOT NULL,
  activ      INTEGER NOT NULL DEFAULT 1        -- 0 = nu se mai propune, dar istoricul ramane
);

CREATE TABLE IF NOT EXISTS saptamani (
  luni              TEXT PRIMARY KEY,          -- 'YYYY-MM-DD', lunea saptamanii
  duminica          TEXT NOT NULL,
  stare             TEXT NOT NULL DEFAULT 'propus'
                    CHECK (stare IN ('propus', 'validat', 'modificat_dupa_validare')),
  titlu             TEXT NOT NULL DEFAULT '',  -- „7 – 13 septembrie 2026"
  sursa             TEXT NOT NULL,             -- 'wp_program' | 'wp_articol' | 'wp_live' | 'manual' | 'propunere'
  sursa_id          TEXT,
  sursa_link        TEXT,
  versiune_calendar TEXT,                      -- pe ce versiune a calendarului s-a validat
  validat_de        TEXT,                      -- user_id-ul celui care a validat, sau 'import'
  validat_la        TEXT,                      -- ISO 8601
  creat             TEXT NOT NULL,
  modificat         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS slujbe (
  id          TEXT PRIMARY KEY,                -- stabil: '2026-09-08-utrenia_liturghie' (+ '-2' la a doua)
  luni        TEXT NOT NULL REFERENCES saptamani (luni) ON DELETE CASCADE,
  data        TEXT NOT NULL,
  ora         TEXT NOT NULL,                   -- 'HH:MM', ora de perete
  nume        TEXT NOT NULL,                   -- cum s-a scris (poate diferi de vocabular)
  cod_nume    TEXT NOT NULL REFERENCES vocabular (cod_nume),
  slujitor    TEXT,
  loc         TEXT NOT NULL DEFAULT 'biserica',
  detalii     TEXT NOT NULL DEFAULT '[]',      -- JSON: randurile „→ …" scrise de parohie
  observatii  TEXT,
  curatenie   INTEGER NOT NULL DEFAULT 1,      -- genereaza slot la curatenie
  transmisie  INTEGER NOT NULL DEFAULT 1,
  ordine      INTEGER NOT NULL DEFAULT 0,
  creat       TEXT NOT NULL,
  modificat   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_slujbe_data ON slujbe (data, ora, ordine);
CREATE INDEX IF NOT EXISTS idx_slujbe_luni ON slujbe (luni);
CREATE INDEX IF NOT EXISTS idx_slujbe_cod ON slujbe (cod_nume, data);

CREATE TABLE IF NOT EXISTS istoric (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  moment     TEXT NOT NULL,
  user_id    TEXT,                             -- NULL la import si la masini
  ce         TEXT NOT NULL,                    -- 'import' | 'scris' | 'validat' | 'schimbat' | 'sters'
  luni       TEXT,
  slujba_id  TEXT,
  detalii    TEXT
);
CREATE INDEX IF NOT EXISTS idx_istoric_luni ON istoric (luni, moment);

-- Vocabularul celor 29 de nume (27 din listele site-ului vechi + te_deum si procesiunea_floriilor,
-- decizie user 7 sept. 2026). Lista e inchisa; `cod_nume` nu e niciodata null.
INSERT OR IGNORE INTO vocabular (cod_nume, nume, categorie, ordine, activ) VALUES
  ('utrenia_liturghie', 'Utrenia și Sfânta Liturghie', 'dimineata', 1, 1),
  ('ceasurile_liturghie', 'Ceasurile și Sfânta Liturghie', 'dimineata', 2, 1),
  ('ceasurile_liturghie_vasile', 'Ceasurile și Sfânta Liturghie a Sfântului Vasile cel Mare', 'dimineata', 3, 1),
  ('ceasurile_liturghie_parastas', 'Ceasurile, Sfânta Liturghie și Parastas', 'dimineata', 4, 1),
  ('liturghia_darurilor', 'Liturghia Darurilor mai înainte sfințite', 'dimineata', 5, 1),
  ('ceasurile_epitaf', 'Ceasurile și scoaterea Sfântului Epitaf', 'dimineata', 6, 1),
  ('vecernia_invierii', 'Vecernia Învierii', 'dimineata', 7, 1),
  ('vecernia', 'Vecernia', 'seara', 8, 1),
  ('vecernia_litia', 'Vecernia și Litia', 'seara', 9, 1),
  ('denia', 'Denia', 'seara', 10, 1),
  ('denia_canonului_mare', 'Denia Canonului Mare', 'seara', 11, 1),
  ('denia_acatistului', 'Denia Acatistului Bunei Vestiri', 'seara', 12, 1),
  ('denia_12_evanghelii', 'Denia celor 12 Evanghelii', 'seara', 13, 1),
  ('prohodul', 'Prohodul Domnului', 'seara', 14, 1),
  ('vecernia_iertarii', 'Vecernia Iertării', 'seara', 15, 1),
  ('pavecernita_mare', 'Pavecernița Mare', 'seara', 16, 1),
  ('pavecernita_mare_litia', 'Pavecernița Mare și Litia', 'seara', 17, 1),
  ('priveghere_utrenia', 'PRIVEGHERE: Vecernia, Litia și Utrenia', 'seara', 18, 1),
  ('priveghere_liturghie', 'PRIVEGHERE: Vecernia și Litia, Utrenia și Sfânta Liturghie', 'seara', 19, 1),
  ('priveghere_ceasurile_liturghie', 'PRIVEGHERE: Vecernia și Litia, Ceasurile și Sfânta Liturghie', 'seara', 20, 1),
  ('slujba_invierii', 'Slujba Învierii', 'seara', 21, 1),
  ('maslu', 'Sfântul Maslu', 'alte', 22, 1),
  ('paraclisul', 'Paraclisul Maicii Domnului', 'alte', 23, 1),
  ('spovedanie', 'Taina Spovedaniei', 'alte', 24, 1),
  ('cateheza', 'Cateheză', 'alte', 25, 1),
  ('parastas_obste', 'Parastas de obște', 'alte', 26, 1),
  ('conferinta', 'Conferință', 'alte', 27, 1),
  ('te_deum', 'Slujba de Te Deum', 'alte', 28, 1),
  ('procesiunea_floriilor', 'Procesiunea de Florii', 'alte', 29, 1);
