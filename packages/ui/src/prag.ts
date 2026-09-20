/**
 * PRAGUL DE DUMINICĂ, ora 12:00 a Bucureștiului — clipa de la care o hârtie a parohiei e publică.
 *
 * Născut la buletin (20.09.2026, cererea userului: „dacă este înainte de ziua pentru care este
 * programat buletinul — adică înainte de ora 12.00, duminica aceea — se poate doar «Validează și
 * programează»; dacă este duminică după ora 12.00 — «Validează și publică»"), urcat aici în aceeași
 * zi, când programul liturgic a cerut ACELAȘI prag: buletinul de duminica D tipărește programul
 * săptămânii care începe luni D+1, deci cele două apar în ACEEAȘI clipă și n-au voie să se despartă.
 * Un al doilea exemplar al socotelii ar fi fost exact felul în care se despart.
 *
 * Ce e al pragului: o ZI calendaristică (`YYYY-MM-DD`, o duminică) capătă o CLIPĂ — duminica aceea,
 * la 12:00, ora de perete a Bucureștiului. Clipa se scrie în bază și se compară acolo cu ceasul.
 *
 * ⚠️ ORA DE PERETE, NU UTC. Vara Bucureștiul e UTC+3 (12:00 → 09:00Z), iarna UTC+2 (12:00 → 10:00Z).
 * Scris o dată în UTC, pragul ar fi căzut la 11:00 sau la 13:00 jumătate de an — adică hârtia de
 * duminică ar fi apărut cu o oră mai devreme ori mai târziu decât spune parohia. De aceea decalajul
 * se cere de la `Intl.DateTimeFormat` PENTRU CLIPA ACEEA, nu se scrie nicăieri în cod: schimbările
 * de fus ale României (dacă vreodată) vin cu datele ICU ale platformei, nu cu o publicare de-a
 * noastră.
 *
 * ⚠️ FĂRĂ BIBLIOTECI. `Intl` e în Workers dintotdeauna; restul pachetului își face ora Bucureștiului
 * tot așa (`aziBucuresti`, `oraBucuresti`). Cele de acolo merg în sensul celălalt (clipă → ce scrie
 * ceasul); aici e singurul ajutor care întoarce CLIPA unei ore de perete.
 *
 * ⚠️ AICI NU SE HOTĂRĂȘTE NICIO STARE. Pragul spune doar „a venit clipa?"; dacă o hârtie e programată
 * ori publicată se citește din BAZĂ, de pe rândul ei — vezi lămurirea de la piciorul fișierului.
 */
import { dataCuZi } from './index.js'

const FUS = 'Europe/Bucharest'

/** Ora la care apar hârtiile de duminică. Una singură, ca s-o citească și textele, și pragul. */
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
export function decalaj(clipa: Date): number {
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
 * PRAGUL unei zile: ziua dată (`YYYY-MM-DD`, o duminică) la ora 12:00 a Bucureștiului, ca CLIPĂ.
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

/** Pragul, scris cum intră în bază: ISO UTC. */
export const pragScris = (data: string): string => pragPublicarii(data).toISOString()

/**
 * Se PROGRAMEAZĂ, nu se publică? Adică: mai e până duminică, ora 12:00.
 * ⚠️ Fix la 12:00:00 se PUBLICĂ (`<`, nu `<=`): pragul e clipa apariției, nu clipa de dinaintea ei.
 */
export const seProgrameaza = (data: string, acum: Date = new Date()): boolean =>
  acum.getTime() < pragPublicarii(data).getTime()

/*
 * ⚠️ NU CĂUTA AICI un `eProgramat(clipa, acum)`. A existat, în varianta dintâi de pe 20.09.2026, și
 * A IEȘIT la 14:11, când userul a cerut „o programare REALĂ — adică din uneltele de cron din
 * Cloudflare". Dacă starea unui rând s-ar deduce dintr-o dată pusă lângă ceas, ar fi DOUĂ adevăruri
 * despre același rând: unul scris pe el și unul socotit la fiecare citire — iar ele s-ar putea
 * despărți fără ca nimic să pârâie. Starea se citește din bază: `eProgramat` / `eProgramata` din
 * depozitele aplicațiilor se uită la COLOANĂ, nu la ceas.
 *
 * Ce rămâne al pragului e doar CLIPA, și se cere la validare (ce se scrie în bază) și acolo unde nu
 * există niciun rând de întrebat (poarta fișierelor buletinului, butonul care încă n-a fost apăsat).
 */

/** „duminică, 27 septembrie 2026, la ora 12:00" — cum se scrie apariția peste tot în platformă. */
export const candApare = (data: string): string =>
  `${dataCuZi(data)}, la ora ${String(ORA_APARITIEI).padStart(2, '0')}:00`
