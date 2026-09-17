/**
 * UMPLEREA DE PROBĂ — ce intră în foaie când omul n-a scris (încă) un articol.
 *
 * Cerere user, 17.09.2026, seara: „Dacă nu se introduce niciun articol — titlu, poză, text, autor,
 * sursă — trebuie să existe niște dummy text la toate, să fie clar, cum ar fi să fie scris chiar ce
 * reprezintă: Titlu articol, Nume Autor, 1999-1999, Lorem ipsum la text, Sursa: -. Și dacă se
 * selectează un articol secundar, tot așa, cu texte dummy, cât să intre fix."
 *
 * De ce: foaia se poate compune ORICÂND, ca să se vadă cum arată numărul (poza, calendarul, cât loc
 * e) înainte să existe textul. Un câmp gol NU e o greșeală de formă — e un loc care se umple cu text
 * de probă, scris la vedere ca text de probă, nu cu ceva care ar putea fi luat drept adevărat.
 *
 * ⚠️ CÂT TEXT DE PROBĂ: exact cât încape, după socoteală (`masuri.ts`), la PROGRAMUL ÎNTREG (treapta
 * 0, nu strâns). Împărțeala e a socotelii, nu a noastră: un secundar ia o pătrime din tot textul,
 * doi secundari 1/4 + 1/4 = jumătate, principalul ia restul. Regula userului, în cuvintele lui:
 * „textul secundar să fie 1/4 din toată cantitatea de text; dacă sunt 2 texte secundare 1/4 + 1/4 =
 * 0,5 din tot textul — și cu programul complet, nu micșorat. Când e text real și e prea mult, apelăm
 * la variante restrânse de program."
 *
 * ⚠️ Umplerea se face ÎN DOI PAȘI, fiindcă piesele fixe schimbă socoteala: întâi capetele (autor,
 * ani, titlu, sursă — ele mănâncă rânduri), abia apoi, cu socoteala refăcută, textul, la măsura
 * rămasă. Invers, textul de probă ar fi socotit fără rândul „Sursa: -" și ar da pe dinafară.
 */
import { type ArticolCerut, type NumarCerut, type Socoteala, semne, socoteste } from './masuri.js'

/** Ce se scrie în locul fiecărei piese lipsă — chiar ce reprezintă, ca să fie limpede că e probă. */
export const DE_PROBA = {
  titlu: 'TITLU ARTICOL',
  autor: 'NUME AUTOR',
  ani: '1999-1999',
  sursa: '-',
} as const

/** Lorem ipsum clasic — un paragraf; textul de probă se face din el, cât e nevoie. */
export const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut ' +
  'labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris ' +
  'nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit ' +
  'esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt ' +
  'in culpa qui officia deserunt mollit anim id est laborum.'

const eGol = (s: string | undefined): boolean => !s || !s.trim()

/**
 * ⚠️ LOREM IPSUM E MAI LAT DECÂT ROMÂNA: are cuvinte lungi („consectetur", „reprehenderit"), deci pe
 * un rând justificat de 85 mm intră mai puține semne decât cele 36,67 măsurate pe textul foii
 * parohiei. Probat pe randare (17.09.2026, `proba-foaie.mjs --gol`): cerute 9 082 de semne la
 * socoteală, au intrat 8 981 și tot au rămas 106 pe dinafară, cu golul de deasupra calendarului
 * strâns la 3 mm. De aceea textul de probă se cere cu ATÂT mai scurt decât spune socoteala — ca să
 * intre fix la golul normal de 6 mm, nu la cel de nevoie.
 */
export const LOREM_FATA_DE_ROMANA = 0.975

/**
 * Text de probă de cel mult `cat` semne (numărate ca pe hârtie, cu `semne()`), tăiat la cuvânt și
 * încheiat cu punct, pe paragrafe de câte două lorem-uri. Niciodată mai lung decât s-a cerut —
 * socoteala greșește în jos, iar proba n-are voie s-o împingă în sus.
 */
export function loremDe(cat: number): string {
  if (cat <= 0) return ''
  const paragrafe: string[] = []
  let t = ''
  while (semne(t) < cat) {
    const p = `${LOREM} ${LOREM}`
    paragrafe.push(p)
    t = paragrafe.join('\n\n')
  }
  // taie la cuvânt, sub măsură — cu un semn păstrat pentru punctul de la sfârșit
  const cuvinte = t.split(' ')
  let s = ''
  for (const c of cuvinte) {
    const urm = s ? `${s} ${c}` : c
    if (semne(urm) > cat - 1) break
    s = urm
  }
  s = s.replace(/[,;:]?\s*$/, '')
  if (!s) return ''
  return /[.!?]$/.test(s) ? s : `${s}.`
}

/** Un articol e „gol de tot" când n-are nici autor, nici titlu, nici text. */
export const eArticolGol = (a: ArticolCerut | undefined): boolean =>
  !a || (eGol(a.autor) && eGol(a.titlu) && eGol(a.text))

/**
 * Pasul întâi: capetele. Autorul, titlul și sursa lipsă se scriu de probă. Anii („1999-1999") vin
 * NUMAI cu autorul de probă — unui autor adevărat fără ani nu-i inventăm o viață.
 */
function capDeProba(a: ArticolCerut, cine: string, deProba: string[]): ArticolCerut {
  const b: ArticolCerut = { ...a }
  if (eGol(b.autor)) {
    b.autor = DE_PROBA.autor
    if (eGol(b.ani)) b.ani = DE_PROBA.ani
    deProba.push(`${cine}: autorul`)
  }
  if (eGol(b.titlu)) {
    b.titlu = DE_PROBA.titlu
    deProba.push(`${cine}: titlul`)
  }
  if (eGol(b.sursa)) {
    b.sursa = DE_PROBA.sursa
    deProba.push(`${cine}: sursa`)
  }
  return b
}

export interface Umplut {
  cerut: NumarCerut
  /** ce s-a pus de probă, în cuvinte („principal: textul (3 812 semne)") — gol dacă nimic */
  deProba: string[]
  /** socoteala cu care s-a umplut — cea de la programul întreg */
  socoteala: Socoteala
}

/**
 * Umple ce lipsește din număr cu text de probă, cât să intre fix.
 *
 * `calendar` e cel de la treapta 0 (programul întreg) — pe el se face măsura textului de probă.
 * Ce a scris omul rămâne neatins: se umplu numai câmpurile goale.
 */
export function umpleCuProba(cerut: NumarCerut, calendar?: NumarCerut['calendar']): Umplut {
  const deProba: string[] = []
  const principal = capDeProba(cerut.principal, 'principal', deProba)
  const secundari = (cerut.secundari ?? []).map((a, i) => capDeProba(a, `secundar ${i + 1}`, deProba))
  const cuCapete: NumarCerut = { ...cerut, principal, secundari, calendar }

  // pasul al doilea: textul, la măsura rămasă după capete
  const s = socoteste(cuCapete)
  const textDeProba = (a: ArticolCerut, cine: string): ArticolCerut => {
    if (!eGol(a.text)) return a
    const zona = s.zone.find((z) => z.cine === cine)
    const cat = zona ? Math.floor(zona.semne * LOREM_FATA_DE_ROMANA) : 0
    const text = loremDe(cat)
    deProba.push(`${cine}: textul (${semne(text)} de semne)`)
    return { ...a, text }
  }
  const plin: NumarCerut = {
    ...cuCapete,
    principal: textDeProba(principal, 'principal'),
    secundari: secundari.map((a, i) => textDeProba(a, `secundar ${i + 1}`)),
  }
  return { cerut: plin, deProba, socoteala: socoteste(plin) }
}
