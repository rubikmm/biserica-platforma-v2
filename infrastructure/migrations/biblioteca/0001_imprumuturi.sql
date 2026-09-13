-- Biblioteca (A12 din V1) — rezervarile si imprumuturile.
--
-- Portata din `biserica-biblioteca/migrations/0001_imprumuturi.sql` (30 august 2026), cu o
-- singura schimbare de fond: `persoana_id` s-a facut `user_id`, numele pe care il poarta omul
-- peste toata platforma V2. Inauntru NU stau nume, email sau telefon — datele personale au un
-- singur proprietar, `identity-worker`, si se cer de acolo la afisare.
--
-- Catalogul (1349 de titluri) ramane in R2 si ramane PUBLIC. D1 tine doar ce e AL CUIVA.

-- O cerere isi traieste tot drumul in acelasi rand: se cere, se pregateste, se ridica,
-- se returneaza. Nu se muta dintr-un tabel in altul — asa istoria unei carti la un om
-- se citeste dintr-o singura privire.
--
-- stare:
--   ceruta       enoriasul a cerut cartea; pangarul nu s-a uitat inca
--   pregatita    pangarul a gasit-o si a pus-o deoparte; asteapta la pangar `asteapta_pana`
--   imprumutata  omul a ridicat-o; se returneaza pana la `scadenta`
--   returnata    s-a intors; dosarul e inchis
--   expirata     n-a venit s-o ridice in termen; cartea a redevenit libera
--   respinsa     pangarul n-a putut da curs (carte pierduta, imprumutata pe hartie…)
--   anulata      omul s-a razgandit inainte s-o ridice
--
-- „Intarziat" NU e o stare, ci o socoteala: `imprumutata` cu scadenta trecuta. Asa nu exista
-- doua adevaruri despre acelasi rand.
CREATE TABLE IF NOT EXISTS cereri (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            TEXT NOT NULL,
  carte_slug         TEXT NOT NULL,
  stare              TEXT NOT NULL,

  ceruta_la          TEXT NOT NULL,   -- moment exact, cu fus: 2026-09-13T19:04:11+03:00
  pregatita_la       TEXT,
  asteapta_pana      TEXT,            -- data: 7 zile de la pregatire (decizie user, 30 aug 2026)
  imprumutata_la     TEXT,
  scadenta           TEXT,            -- data: o luna de la ridicare (decizie user, 30 aug 2026)
  incheiata_la       TEXT,

  -- ziua in care s-a trimis ultima data anuntul de intarziere, ca ceasul de noapte
  -- sa nu trimita acelasi email in fiecare dimineata
  anuntat_intarziere TEXT
);

CREATE INDEX IF NOT EXISTS cereri_user  ON cereri (user_id, stare);
CREATE INDEX IF NOT EXISTS cereri_carte ON cereri (carte_slug, stare);
CREATE INDEX IF NOT EXISTS cereri_stare ON cereri (stare);

-- Scrisorile catre enorias, cate una la fiecare pas al cererii.
--
-- ⚠️ Deosebirea fata de V1: acolo scrisorile NU plecau (platforma n-avea furnizor de email),
-- si tabelul era singurul loc unde se vedeau. In V2 pleaca prin `communication-worker`, care
-- tine si arhiva livrarilor; tabelul de aici ramane jurnalul BIBLIOTECII — ce a compus ea, la
-- ce cerere, si daca posta a primit-o (`trimisa_la`). Adresa de email nu se tine nici aici:
-- se cere de la identitate in clipa trimiterii si nu se pastreaza dupa.
CREATE TABLE IF NOT EXISTS scrisori (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  cerere_id   INTEGER,
  sablon      TEXT NOT NULL,
  subiect     TEXT NOT NULL,
  corp        TEXT NOT NULL,
  creata_la   TEXT NOT NULL,
  trimisa_la  TEXT,
  -- ce a raspuns posta cand n-a putut duce scrisoarea; se citeste la /pangar/scrisori
  necaz       TEXT
);

CREATE INDEX IF NOT EXISTS scrisori_netrimise ON scrisori (trimisa_la, id);
