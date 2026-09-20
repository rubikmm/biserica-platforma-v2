/**
 * CÂND APARE O SĂPTĂMÂNĂ — pragul ei, cu numele programului.
 *
 * Cererea userului (20.09.2026, după ce mecanismul a intrat la buletin): „La programul liturgic
 * aceeași poveste cu Validare și publicare / Validare și programare, la fel ca la Buletinul
 * bisericii."
 *
 * ⚠️ PRAGUL UNEI SĂPTĂMÂNI E DUMINICA DINAINTEA EI, la 12:00. Nu lunea ei, nu duminica ei de la
 * capăt. Motivul e al hârtiei, nu al calendarului: buletinul de duminica D tipărește pe pagina a
 * patra programul săptămânii care începe luni D+1, iar cele două se dau enoriașilor în aceeași
 * clipă — duminică, la ieșirea de la Liturghie. Deci săptămâna 21–27 septembrie apare duminică,
 * 20 septembrie, la 12:00: `luni − 1 zi`.
 *
 * Socoteala clipei (ora de perete a Bucureștiului, decalajul cerut de la ICU, marginea de la
 * 12:00:00) nu e aici și nici la buletin: e una singură, în `@xc/ui` (`packages/ui/src/prag.ts`).
 * Aici stă doar traducerea „cheia săptămânii → ziua de prag", care e a programului.
 *
 * ⚠️ NICIO STARE NU SE HOTĂRĂȘTE AICI. Dacă o săptămână e programată se citește din COLOANĂ
 * (`eProgramata` din `depozit.ts`), nu din ceas — lecția buletinului, un singur adevăr, cel din bază.
 */
import { adaugaZile, candApare, pragPublicarii } from '@xc/ui'

/** Duminica dinaintea săptămânii care începe la `luni` — ziua pe care stă pragul ei. */
export const duminicaDinainte = (luni: string): string => adaugaZile(luni, -1)

/** CLIPA de la care săptămâna `luni` e validată: duminica dinainte, ora 12:00 a Bucureștiului. */
export const pragSaptamanii = (luni: string): Date => pragPublicarii(duminicaDinainte(luni))

/**
 * Se PROGRAMEAZĂ, nu se publică? Adică: mai e până duminica dinainte, ora 12:00.
 * ⚠️ Fix la 12:00:00 se PUBLICĂ (`<`, nu `<=`): pragul e clipa apariției, nu cea de dinaintea ei.
 */
export const seProgrameaza = (luni: string, acum: Date = new Date()): boolean =>
  acum.getTime() < pragSaptamanii(luni).getTime()

/** „duminică, 20 septembrie 2026, la ora 12:00" — cum se scrie apariția săptămânii `luni`. */
export const candApareSaptamana = (luni: string): string => candApare(duminicaDinainte(luni))
