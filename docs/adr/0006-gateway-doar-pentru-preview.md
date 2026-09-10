# ADR 0006 — Gateway-ul există doar pentru preview local

**Stare**: acceptat, 10.09.2026

## Context

Arhitectura are câte o aplicație per subdomeniu. Containerul de test are însă un singur port
public: Apache trimite `https://rubik:8474` către `wrangler dev` pe 8787.

Fără o soluție, fluxul cap-coadă (autentificare pe cont → calendar fără reautentificare) n-ar
putea fi încercat local.

## Decizie

`apps/gateway` — un worker subțire care mapează căi către aplicații prin Service Bindings:
`/calendar` → calendar, `/admin` → admin, restul → cont. Trimite cererea mai departe neschimbată,
inclusiv cookie-urile.

**Nu se folosește în staging sau producție.** Acolo fiecare aplicație are domeniul ei, iar SSO-ul
vine din cookie-ul pe domeniul părinte.

## De ce nu e o piesă de arhitectură

Un gateway permanent ar deveni un punct central prin care trece tot — exact tiparul pe care
briefull îl interzice („nu construi un mega-dispecer"). Aici e o unealtă de dezvoltare, cu un rost
îngust și explicit.

## Consecință de urmărit

În dev, toate aplicațiile sunt pe același host, deci cookie-ul e host-only și SSO-ul „merge" chiar
dacă domeniul ar fi greșit configurat. **Testul real al SSO-ului între subdomenii se face pe
staging**, nu local.
