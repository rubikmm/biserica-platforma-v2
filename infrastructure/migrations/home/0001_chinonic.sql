-- TEXTELE CITITE LA CHINONIC — articolele citite la strană în timpul împărtășirii, scoase din
-- arhiva newsletterului (cerere user, 16.09.2026). Prima bază a Website-ului: până azi `home` n-avea
-- niciun depozit, era un singur `index.ts`.
--
-- ⚠️ ARTICOLUL E AL WEBSITE-ULUI, ASOCIEREA E A NEWSLETTERULUI (hotărât cu userul): aici stă textul,
-- iar legătura „ce s-a citit la numărul N" o ține aplicația Newsletter, în depozitul ei. De aceea
-- tabelul de mai jos păstrează doar DATA citirii — un fapt despre articol, nu despre buletin —, nu
-- numărul lui. Cine vrea numărul îl cere de la Newsletter.
--
-- ⚠️ `slug` e ADRESA fișei și nu se schimbă cât timp rândul e același text (regula slugului de la
-- bibliotecă). Se naște din titlu, iar la ciocnire i se adaugă numărul buletinului.

CREATE TABLE IF NOT EXISTS texte_chinonic (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  titlu        TEXT NOT NULL DEFAULT '',
  autor        TEXT NOT NULL DEFAULT '',
  -- data la care s-a citit la strană (ziua în care a plecat buletinul care îl cuprindea)
  citit_la     TEXT NOT NULL,
  -- fragmentul așa cum a apărut în newsletter: HTML curat, fără chenarul de email
  fragment     TEXT NOT NULL DEFAULT '',
  -- textul întreg, adus de la sursă; gol cât timp n-a fost adus (vezi `stare_text`)
  text_intreg  TEXT NOT NULL DEFAULT '',
  -- „netras" · „gata" · „fara-text" (PDF scanat, pagină moartă) · „eroare"
  stare_text   TEXT NOT NULL DEFAULT 'netras',
  -- ⚠️ SURSA ARE DOUĂ PĂRȚI, ȘI TREBUIE SĂ COEXISTE (user, 16.09.2026): mențiunea scrisă de om
  -- („Fișier PDF", numele cărții) ȘI legătura. Numele sursei e ce se ARATĂ; adresa e pentru adus.
  sursa_text   TEXT NOT NULL DEFAULT '',
  sursa_nume   TEXT NOT NULL DEFAULT '',
  sursa_url    TEXT NOT NULL DEFAULT '',
  sursa_fel    TEXT NOT NULL DEFAULT 'fara',   -- „pdf" · „pagina" · „fara"
  -- poza articolului, așa cum stă în depozitul newsletterului (`/media/…`)
  poza         TEXT NOT NULL DEFAULT '',
  creat_la     TEXT NOT NULL DEFAULT (datetime('now')),
  schimbat_la  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- lista se citește mereu de la cel mai nou spre cel mai vechi (10 + „Vezi toate")
CREATE INDEX IF NOT EXISTS idx_texte_chinonic_citit ON texte_chinonic (citit_la DESC);
CREATE INDEX IF NOT EXISTS idx_texte_chinonic_stare ON texte_chinonic (stare_text);
