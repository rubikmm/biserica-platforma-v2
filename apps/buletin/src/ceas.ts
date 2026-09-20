/**
 * CÂND APARE UN NUMĂR — pragul de duminică, ora 12:00, ora Bucureștiului.
 *
 * Cererea userului (20.09.2026): „dacă este înainte de ziua pentru care este programat buletinul —
 * adică înainte de ora 12.00, duminica aceea — se poate doar «Validează și programează»; dacă este
 * duminică după ora 12.00 — «Validează și publică»."
 *
 * ⚠️ SOCOTEALA NU MAI E AICI. A stat în fișierul ăsta o zi — 20.09.2026, dimineața — și a urcat în
 * `@xc/ui` (`packages/ui/src/prag.ts`) în aceeași seară, când programul liturgic a cerut ACELAȘI
 * prag: buletinul de duminica D tipărește programul săptămânii care începe luni D+1, deci numărul și
 * săptămâna apar în aceeași clipă. Două exemplare ale socotelii ar fi fost exact felul în care cele
 * două ajung să apară la ore diferite, fără ca nimic să pârâie.
 *
 * Ce a rămas aici e NUMELE: buletinul cere pragul pe ZIUA NUMĂRULUI (mereu o duminică), deci
 * `pragPublicarii(data)` se citește firesc în codul lui. Programul are ceasul lui,
 * `apps/program/src/ceas.ts`, unde cheia e lunea săptămânii și pragul e al duminicii dinainte.
 *
 * Lămuririle lungi (ora de perete vs. UTC, decalajul cerut de la ICU, marginea de la 12:00:00, de ce
 * NU există aici un `eProgramat(publicat_la, acum)`) stau la locul socotelii, în `prag.ts`.
 */
export { ORA_APARITIEI, candApare, pragPublicarii, pragScris, seProgrameaza } from '@xc/ui'
