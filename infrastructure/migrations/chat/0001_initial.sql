-- Modulul de Chat. Proprietar unic al acestor date: `chat-worker`.
--
-- Se tine AICI discutia si atat. Nimic despre parohie nu se copiaza in baza asta: programul,
-- calendarul si tipicul se CER prin actiuni, la fiecare intrebare (regula structurii mari —
-- „datele stau intr-un loc"). Un chat care si-ar face copie ar minti cuviincios a doua zi dupa
-- o corectura.
--
-- Date personale: NICIUNA. Doar `user_id`, ca in orice aplicatie a platformei.

-- O discutie. Urmeaza OMUL, nu pagina: de aceea nu tine de aplicatia in care s-a deschis
-- (aceea se scrie doar ca sa stim de unde a pornit) si merge mai departe din program in calendar.
CREATE TABLE IF NOT EXISTS conversatii (
  id             TEXT PRIMARY KEY,            -- uuid
  user_id        TEXT NOT NULL,
  aplicatie      TEXT NOT NULL DEFAULT '',    -- de unde a pornit: 'program', 'calendar', …
  creata_la      TEXT NOT NULL,
  ultimul_la     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversatii_om ON conversatii (user_id, ultimul_la DESC);

-- Mesajele, in ordine. `rol`: 'om' | 'agent' | 'unealta'.
-- `date_json` tine ce nu e text: obiectele intoarse (hartiile) si actiunile cerute, ca la
-- redeschiderea panoului cardurile sa se vada din nou, fara sa refacem nimic.
CREATE TABLE IF NOT EXISTS mesaje (
  id             TEXT PRIMARY KEY,
  conversatie_id TEXT NOT NULL REFERENCES conversatii(id) ON DELETE CASCADE,
  rol            TEXT NOT NULL,
  text           TEXT NOT NULL DEFAULT '',
  date_json      TEXT NOT NULL DEFAULT '{}',
  creat_la       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mesaje_conv ON mesaje (conversatie_id, creat_la);

-- Propunerile de actiune care SCHIMBA ceva. Nu se executa nimic pana nu apasa omul „Da".
-- Expira in zece minute: o confirmare data peste o ora ar privi alte date decat cele vazute.
CREATE TABLE IF NOT EXISTS propuneri (
  id             TEXT PRIMARY KEY,
  conversatie_id TEXT NOT NULL REFERENCES conversatii(id) ON DELETE CASCADE,
  aplicatie      TEXT NOT NULL,
  actiune        TEXT NOT NULL,
  argumente_json TEXT NOT NULL DEFAULT '{}',
  rezumat        TEXT NOT NULL DEFAULT '',    -- cum se citeste omului: „Trimit foaia la 42 de adrese"
  stare          TEXT NOT NULL DEFAULT 'asteapta', -- asteapta | facuta | refuzata | expirata
  creata_la      TEXT NOT NULL,
  expira_la      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_propuneri_conv ON propuneri (conversatie_id, creata_la DESC);
