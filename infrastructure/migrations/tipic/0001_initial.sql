-- A9 · Tipicul. Proprietar unic al acestor date: aplicatia `tipic`.
--
-- Trei surse, asezate una sub alta in pagina, ca in V1 (user, 1 sept. 2026): randuiala scurta
-- (ROEA) spune CE se face, Anuarul liturgic si tipiconal o desfasoara, iar Mineiul da TEXTUL
-- slujbei. Ce e al altei aplicatii nu se tine aici: ziua liturgica, sfintii si pericopele se cer
-- de la `calendar`.

-- Randuiala scurta (ROEA): un paragraf telegrafic, numai pe zilele cu randuiala proprie (97/an).
CREATE TABLE IF NOT EXISTS randuiala (
  data        TEXT    PRIMARY KEY,           -- 'YYYY-MM-DD'
  an          INTEGER NOT NULL,
  zi          TEXT    NOT NULL DEFAULT '',   -- cum scrie sursa: 'DUMINICĂ'
  voscreasna  INTEGER,                       -- 1..11; referinta ei e fixa, din Evangheliar
  utrenie     TEXT    NOT NULL DEFAULT '[]', -- JSON: [{"ref":"Ioan 10, 9-16"}]
  apostol     TEXT    NOT NULL DEFAULT '[]',
  evanghelie  TEXT    NOT NULL DEFAULT '[]',
  tipic       TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_randuiala_an ON randuiala (an);

-- Randuiala desfasurata (Anuarul liturgic si tipiconal, IBMO): toate zilele anului.
CREATE TABLE IF NOT EXISTS tipiconal (
  data       TEXT    PRIMARY KEY,
  an         INTEGER NOT NULL,
  zi         TEXT    NOT NULL DEFAULT '',
  titlu      TEXT    NOT NULL DEFAULT '',    -- titlul zilei in forma cartii
  paragrafe  TEXT    NOT NULL DEFAULT '[]',  -- JSON: alineatele, in ordine
  pagini     TEXT    NOT NULL DEFAULT '[]'   -- JSON: paginile din carte
);
CREATE INDEX IF NOT EXISTS idx_tipiconal_an ON tipiconal (an);

-- Mineiul: textul slujbei. CARTEA NU TINE DE AN — Mineiul pe noiembrie e acelasi in fiecare
-- noiembrie —, deci cheia e (luna, zi), nu data intreaga.
CREATE TABLE IF NOT EXISTS minei (
  luna    INTEGER NOT NULL,                  -- 1..12
  zi      INTEGER NOT NULL,                  -- 1..31
  titlu   TEXT    NOT NULL DEFAULT '',
  bucati  TEXT    NOT NULL DEFAULT '[]',     -- JSON: [{fel,text,centrat}]
  pagini  TEXT    NOT NULL DEFAULT '[]',     -- JSON; gol la lunile culese din sit (n-au PDF)
  PRIMARY KEY (luna, zi)
);

-- Cartile din care vin toate cele de mai sus. `credit` e conditia sursei: la lunile luate de la
-- slujbe.teologie.net trebuie aratat numele culegatorului si adresa sitului, si asa se si arata,
-- in bara partii din pagina.
CREATE TABLE IF NOT EXISTS carti (
  cod      TEXT PRIMARY KEY,                 -- 'roea' | 'anuar' | 'minei-01' … 'minei-12'
  sursa    TEXT NOT NULL,
  editura  TEXT NOT NULL DEFAULT '',
  nota     TEXT NOT NULL DEFAULT '',
  credit   TEXT NOT NULL DEFAULT '',
  url      TEXT NOT NULL DEFAULT '',
  luna     INTEGER
);

-- Provenienta: ce s-a adus, de unde, cand, cate zile, cati octeti.
CREATE TABLE IF NOT EXISTS importuri (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  cod          TEXT    NOT NULL,             -- acelasi cod ca in `carti`
  sursa        TEXT    NOT NULL,
  zile         INTEGER NOT NULL,
  octeti       INTEGER NOT NULL,
  importat_la  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_importuri_cod ON importuri (cod, importat_la);
