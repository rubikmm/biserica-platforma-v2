# ADR 0007 — Acțiunile interne sunt un strat de sine stătător, iar chatul e doar clientul lui

**Stare**: acceptat, 11.09.2026

## Context

Utilizatorul a cerut un modul de chat cu AI care să poată *acționa* asupra aplicației, prin
„mecanisme interne api — expuse tot intern", fără să se confunde cu API-ul public și fără să
dubleze funcțiile care există deja.

Drumul comod ar fi fost să punem uneltele modelului în workerul de chat: o listă de funcții
scrise acolo, care cheamă ce le trebuie. Merge repede și e greșit din două motive. Întâi, ar face
din chat un al doilea loc în care se știe cum funcționează programul, calendarul și tipicul — exact
duplicarea pe care structura mare o interzice. Apoi, ar lega capacitatea de a cere ceva unei
aplicații de prezența unui model de limbaj: o altă aplicație care vrea o oră de slujbă ar trebui
să treacă printr-un chat ca să o afle.

## Decizie

Se construiesc **două lucruri separate**:

1. **Registrul de acțiuni** — fiecare aplicație își declară verbele în `src/actiuni.ts`
   (`@xc/actiuni`) și le expune la `GET /_actiuni` (manifestul, generat din schemele zod) și
   `POST /_actiuni/<nume>`. Calea se servește **numai** prin Service Binding, cu secretul
   platformei; de pe internet nu există.
2. **Modulul de chat** — `services/chat-worker` plus bula din `@xc/ui`. E primul client al
   registrului, nu proprietarul lui.

Regula care ține duplicarea la distanță: **o acțiune nu conține logică proprie** — cheamă exact
funcția de domeniu pe care o cheamă și ruta `/v1`.

O acțiune întoarce fie date, fie un **obiect care circulă** (o hârtie: „Sfinții zilei", foaia A4,
pozele). Obiectele se așază în `media-worker` și circulă **după cheie**, niciodată ca octeți prin
model sau prin chat; trimiterea lor e o acțiune a comunicării.

## Consecințe

- Registrul se merită singur: o altă aplicație, un crontab sau o unealtă de întreținere pot cere
  același lucru, în același fel, fără model de limbaj.
- Chatul nu poate face nimic ce n-ar putea face omul care scrie în el: permisiunile se verifică
  la `authorization-worker`, cu principalul lui real, mască „vezi ca" cu tot.
- Costul: fiecare aplicație are de întreținut un fișier în plus (`actiuni.ts`), iar descrierile
  trebuie scrise pentru cineva din afară. E prețul listei pe care o poate citi altcineva decât noi.
- Dacă modelul se dovedește prea slab la ales acțiunile (Workers AI, alegerea de pornire), se
  schimbă o singură funcție — `intreabaModelul` —, nu modulul.

Detaliile stau în `docs/architecture/chat-si-actiuni.md`.
