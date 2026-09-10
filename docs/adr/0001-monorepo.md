# ADR 0001 — Monorepo cu pnpm workspaces și Turborepo

**Stare**: acceptat, 10.09.2026

## Context

În V1 fiecare aplicație e un repo/worker separat, iar codul comun (`src/comun/`: carcasă,
stiluri, JS, titluri, cont) e copiat fizic în toate cele 12. O schimbare de antet costă 12
intervenții și 12 ocazii de divergență.

## Decizie

Un singur repo, cu `packages/` partajate, `services/` interne și `apps/` client. pnpm workspaces
pentru legături între pachete, Turborepo pentru orchestrarea comenzilor.

## Consecințe

- Codul comun are un singur loc; o schimbare se face o dată.
- `pnpm dev` pornește toată platforma, cu Service Bindings funcționale între workeri.
- Cost: `pnpm install` cere `pnpm approve-builds` o dată (esbuild și workerd au scripturi de build).
- Deploy-ul rămâne per worker — monorepo nu înseamnă un singur artefact.
