/**
 * CÂND APARE UN NUMĂR — pragul de duminică, ora 12:00, ora Bucureștiului.
 *
 * Cererea userului (20.09.2026): „dacă este înainte de ziua pentru care este programat buletinul —
 * adică înainte de ora 12.00, duminica aceea — se poate doar «Validează și programează»; dacă este
 * duminică după ora 12.00 — «Validează și publică»."
 *
 * Deci un număr are, pe lângă ziua lui calendaristică (`data`, mereu o duminică), o CLIPĂ de la care
 * e public: duminica aceea, la 12:00, ora de perete a Bucureștiului. Clipa se scrie în bază
 * (`publicat_la`, ISO UTC) și se compară acolo cu ceasul de acum — vizibilitatea se hotărăște LA
 * CITIRE, nu de un cron. Un cron ar fi însemnat un al doilea adevăr despre același număr: între
 * ora 12:00 și clipa în care s-ar fi trezit el, numărul ar fi fost programat pentru bază și apărut
 * pentru om, ori invers.
 *
 * ⚠️ ORA DE PERETE, NU UTC. Vara Bucureștiul e UTC+3 (12:00 → 09:00Z), iarna UTC+2 (12:00 → 10:00Z).
 * Scris o dată în UTC, pragul ar fi căzut la 11:00 sau la 13:00 jumătate de an — adică numărul de
 * duminică ar fi apărut cu o oră mai devreme ori mai târziu decât spune parohia. De aceea decalajul
 * se cere de la `Intl.DateTimeFormat` PENTRU CLIPA ACEEA, nu se scrie nicăieri în cod: schimbările
 * de fus ale României (dacă vreodată) vin cu datele ICU ale platformei, nu cu o publicare de-a
 * noastră.
 *
 * ⚠️ FĂRĂ BIBLIOTECI. `Intl` e în Workers dintotdeauna; restul platformei își face ora Bucureștiului
 * tot așa (`@xc/ui` — `aziBucuresti`, `oraBucuresti`; `apps/biblioteca/src/zile.ts`). Nu există încă
 * un ajutor COMUN care să întoarcă CLIPA unei ore de perete — cele de acolo merg în sensul celălalt
 * (clipă → ce scrie ceasul) —, deci acesta stă aici, la buletin, până când îl mai cere cineva.
 */
import { dataCuZi } from '@xc/ui'

const FUS = 'Europe/Bucharest'

/** Ora la care apare numărul, duminica. Una singură, ca s-o citească și textele, și pragul. */
export const ORA_APARITIEI = 12

const FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUS,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/**
 * Decalajul fusului la CLIPA dată, în milisecunde (vara +3h, iarna +2h): ce arată ceasul de perete
 * minus ce arată ceasul UTC.
 *
 * ⚠️ `hour: '24'` — `Intl` scrie miezul nopții „24" în unele versiuni de ICU (ciclul `h24`), iar
 * `Date.UTC(…, 24, …)` ar sări o zi înainte. Se aduce la „00", ca ziua să rămână a ei.
 */
function decalaj(clipa: Date): number {
  const p: Record<string, string> = {}
  for (const x of FMT.formatToParts(clipa)) if (x.type !== 'literal') p[x.type] = x.value
  const ora = p.hour === '24' ? '00' : (p.hour ?? '00')
  const perete = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(ora),
    Number(p.minute ?? '0'),
    Number(p.second ?? '0'),
  )
  // ceasul de perete n-are milisecunde: se taie și din clipă, altfel decalajul ar ieși cu o fracțiune
  return perete - Math.floor(clipa.getTime() / 1000) * 1000
}

/**
 * PRAGUL unui număr: ziua lui (`YYYY-MM-DD`, o duminică) la ora 12:00 Bucureștiului, ca CLIPĂ.
 *
 * Socoteala e o scădere cu verificare: se pleacă de la ora scrisă ca și cum ar fi UTC, se scade
 * decalajul de atunci, apoi se ia decalajul CLIPEI GĂSITE și se scade el. A doua trecere e pentru
 * zilele în care fusul se schimbă chiar atunci (ultima duminică din martie și din octombrie): la
 * 12:00 amândouă trecerile dau același lucru — ceasul se mută la 03:00/04:00, nu la prânz —, dar
 * socoteala rămâne bună și dacă ora aparițiilor s-ar muta vreodată spre dimineață.
 *
 * 2026-03-29 → 09:00Z (EEST, +3) · 2026-09-27 → 09:00Z (EEST, +3) · 2026-10-25 → 10:00Z (EET, +2).
 */
export function pragPublicarii(data: string, ora: number = ORA_APARITIEI): Date {
  const naiv = Date.parse(`${data}T${String(ora).padStart(2, '0')}:00:00Z`)
  if (Number.isNaN(naiv)) return new Date(Number.NaN)
  const intai = naiv - decalaj(new Date(naiv))
  return new Date(naiv - decalaj(new Date(intai)))
}

/** Pragul, scris cum intră în bază: ISO UTC. Tot de aici iese și `publicat_la` la validare. */
export const pragScris = (data: string): string => pragPublicarii(data).toISOString()

/**
 * Se PROGRAMEAZĂ, nu se publică? Adică: mai e până duminică, ora 12:00.
 * ⚠️ Fix la 12:00:00 se PUBLICĂ (`<`, nu `<=`): pragul e clipa apariției, nu clipa de dinaintea ei.
 */
export const seProgrameaza = (data: string, acum: Date = new Date()): boolean =>
  acum.getTime() < pragPublicarii(data).getTime()

/*
 * ⚠️ NU CĂUTA AICI un `eProgramat(publicat_la, acum)`. A existat, în varianta dintâi de pe
 * 20.09.2026, și A IEȘIT la 14:11, când userul a cerut „o programare REALĂ — adică din uneltele de
 * cron din Cloudflare". Dacă starea unui număr s-ar deduce, aici, dintr-o dată pusă lângă ceas, ar
 * fi din nou DOUĂ adevăruri despre același rând: unul scris pe el (`stare`) și unul socotit la
 * fiecare citire — iar ele s-ar putea despărți fără ca nimic să pârâie. Starea se citește din bază:
 * `eProgramat(b)` din `depozit.ts` se uită la coloană, nu la ceas.
 *
 * Ce rămâne al ceasului de aici e doar PRAGUL, și se cere în două locuri: la validare (ce se scrie
 * în `publicat_la`) și la poarta fișierelor, unde ziua se citește din numele fișierului și unde,
 * pentru o ciornă, nu există niciun rând de întrebat.
 */

/** „duminică, 27 septembrie 2026, la ora 12:00" — cum se scrie apariția peste tot în aplicație. */
export const candApare = (data: string): string =>
  `${dataCuZi(data)}, la ora ${String(ORA_APARITIEI).padStart(2, '0')}:00`
