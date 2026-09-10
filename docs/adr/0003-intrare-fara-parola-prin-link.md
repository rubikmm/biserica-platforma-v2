# ADR 0003 — Intrare fără parolă, prin link pe email

**Stare**: acceptat, 10.09.2026 (decizie a utilizatorului; înlocuiește varianta „parolă + link")

## Context

Prima variantă avea parolă plus link de confirmare la fiecare intrare. Utilizatorul a cerut
explicit **fără parolă**: singurul gest e emailul → linkul.

V1 făcea deja același lucru cu un cod de 6 cifre; aici e link, tot la cererea lui — o apăsare pe
telefon, fără transcris cifre.

## Decizie

- Nu există parolă, hash de parolă, resetare de parolă. Tabela nu există.
- Contul se naște **la prima confirmare a unui link**, nu la un formular — nu există conturi
  neconfirmate.
- Sesiunea durează 30 de zile, cu revocare centrală.
- Scrisoarea pleacă prin Cloudflare Email Service (binding `send_email`), de pe
  `no-reply@posta.sfantul-ilie.ro`.

## Compensații

Linkul e comod, dar se poate da mai departe. De aceea: 15 minute de viață, consum unic atomic,
un link nou le anulează pe cele vechi, doar hash-ul în bază, rate limiting pe email și IP.

## Consecințe

- Fără parole nu există nimic de spart într-o scurgere a bazei.
- Siguranța contului e siguranța căsuței de email a omului — la fel ca la orice „am uitat parola".
- Dacă vreodată e nevoie de un al doilea factor, se adaugă în `identity-worker` fără să se atingă
  aplicațiile.
