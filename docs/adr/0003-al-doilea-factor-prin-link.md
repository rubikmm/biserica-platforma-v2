# ADR 0003 — Al doilea factor prin link, nu prin cod

**Stare**: acceptat, 10.09.2026 (decizie a utilizatorului)

## Context

Cerința: verificare pe email la fiecare autentificare, pentru toată lumea. Două variante uzuale —
cod din 6 cifre, sau link de confirmare.

## Decizie

Link. Motivul dat de utilizator: „mi se pare puțin mai ușor de folosit" — o apăsare pe telefon,
fără comutat între aplicații și fără transcris cifre.

Primul factor rămâne parola, deci autentificarea e cu adevărat în doi factori: ceva ce știi și
ceva ce controlezi.

## Compensații de securitate

Linkul e mai comod, dar și mai ușor de retrimis mai departe decât un cod citit cu ochii. De aceea:

- valabil 15 minute;
- consum unic, atomic (`UPDATE … WHERE consumed_at IS NULL`) — două apăsări simultane dau o
  singură sesiune;
- emiterea unuia nou invalidează jetoanele anterioare ale aceluiași utilizator;
- în baza de date se ține doar hash-ul.

## Alternativă păstrată

Trecerea la cod din 6 cifre, sau la passwordless (doar email → link), sunt schimbări izolate în
`identity-worker`, nu rescrieri.
