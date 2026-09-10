# ADR 0004 — RBAC cu scope-uri, decis central

**Stare**: acceptat, 10.09.2026

## Context

V1 verifică drepturile local, în fiecare aplicație. Rezultatul: reguli ușor diferite în locuri
diferite și nicio imagine de ansamblu asupra cine ce poate.

## Decizie

Roluri (`user`, `admin`, `super-admin`) plus scope-uri (`global`, `parish:<id>`, `team:<id>`,
`audience:<id>`). Permisiunile sunt chei explicite (`calendar.publish`, `audit.read`, …), definite
o singură dată în `packages/contracts`.

Deciziile se cer de la `authorization-worker`:

```ts
can(principal, permission, resourceScope): Promise<Decizie>
require(principal, permission, resourceScope): Promise<void>
```

Nicăieri în aplicații nu există `rol === 'admin'`.

## Detalii care contează

- **Indisponibilitatea autorizării înseamnă refuz**, nu permisiune. Starea sigură e „nu".
- Decizia întoarce și un motiv, legabil de o intrare de audit.
- Peste rol se pot adăuga granturi punctuale pe utilizator, fără rol nou.
- Ierarhia de scope-uri e într-o singură funcție (`scopeAcopera`); acolo se adaugă
  „parohia acoperă echipele ei", când va fi nevoie.

## Consecințe

- Un drept nou se adaugă într-un singur loc.
- Fiecare verificare e un apel intern — acceptabil, și oricum necesar pentru trasabilitate.
