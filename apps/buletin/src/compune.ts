/**
 * COMPUNEREA UNUI NUMĂR — de la ce s-a scris la PDF-ul de tipar.
 *
 * Trei pași, în ordinea asta și din motive care nu se schimbă:
 *   1. **socoteala** (`masuri.ts`) — încape textul? Dacă nu, se răspunde cu cifre, nu se compune
 *      pe jumătate. E aritmetică, deci costă nimic și se poate cere și singură.
 *   2. **calendarul** — se CERE de la aplicația `program` (`/v1/tabel-tipar`, Service Binding
 *      `PROGRAM`), nu se desenează aici. Programul e proprietarul formei.
 *   3. **randarea** — HTML autonom → PDF prin Browser Rendering, apoi în depozit.
 *
 * ⚠️ CURGEREA SPUNE ADEVĂRUL, SOCOTEALA DOAR ÎL PREVESTEȘTE. Scriptul din pagină numără semnele
 * care au intrat cu adevărat și le scrie în `data-raport`; dacă a rămas text pe dinafară, numărul
 * NU se dă drept bun, oricât de bine ar fi ieșit socoteala. Ordinea asta — întâi socoteala, la
 * urmă proba randării — e singura care nu minte nici pe repede, nici pe încet.
 */
import { dataLunga, pdfCuRaportSiCoperta } from '@xc/ui'
import { capulTextului, mottoDinText } from './depozit.js'
import { foaieHtml, textCurat } from './foaie.js'
import { type NumarCerut, type Socoteala, SECUNDARI_MAXIM, semne, socoteste } from './masuri.js'
import { umpleCuProba } from './umplere.js'

export interface EnvCompunere {
  BROWSER: Fetcher
  PROGRAM: Fetcher
  FISIERE: R2Bucket
}

export interface Calendar {
  tabel: string
  stil: string
  titlu: string
  de_la: string
  pana_la: string
  slujbe: number
  detalii: number
  /** treapta la care a fost strâns: 0 întreg, 1 fără sfinți, 2 și fără pericopă */
  strans: Strans
  /**
   * `validat` = săptămâna confirmată de parohie; `propus` = ce era disponibil, neconfirmat.
   * ⚠️ Din 17.09.2026, seara, programul PROPUS se folosește „fără probleme" (user) — dar cu
   * atenția atrasă LA ÎNCEPUT, la vedere: un număr compus pe o propunere nu tace despre asta.
   */
  stare: 'validat' | 'propus'
}

/**
 * Tabelul săptămânii, de la program.
 *
 * ⚠️ Data cerută e a numărului (duminica de pe foaie), dar programul are nevoie de o zi DIN
 * săptămâna tipărită, iar aceea e cea care URMEAZĂ: numărul 615, datat 6 septembrie, poartă
 * programul pentru 7–13 septembrie (regulă veche a parohiei). De aceea se cere ziua de a doua zi,
 * nu ziua numărului — greșeala se vede abia pe hârtie, cu o săptămână veche tipărită în 300 de
 * exemplare.
 */
export type Strans = 0 | 1 | 2

/** Cum se spune omului fiecare treaptă a calendarului strâns. */
export const NUMELE_TREPTEI: Record<Strans, string> = {
  0: 'programul întreg',
  1: 'programul fără sfinții duminicii',
  2: 'programul fără sfinții duminicii și fără pericopă (apostol, evanghelie, glas)',
}

export async function calendarulNumarului(env: EnvCompunere, dataNumarului: string, strans: Strans = 0): Promise<Calendar | { eroare: string; cod: string }> {
  const aDouaZi = new Date(`${dataNumarului}T12:00:00Z`)
  aDouaZi.setUTCDate(aDouaZi.getUTCDate() + 1)
  const cerut = aDouaZi.toISOString().slice(0, 10)
  const r = await env.PROGRAM.fetch(`https://xc-program/v1/tabel-tipar?data=${cerut}&strans=${strans}`)
  if (!r.ok) {
    const corp = (await r.json().catch(() => ({}))) as { cod?: string; mesaj?: string }
    return {
      cod: corp.cod ?? 'program_indisponibil',
      eroare: corp.mesaj ?? `programul a răspuns ${r.status} pentru săptămâna care începe ${cerut}`,
    }
  }
  return (await r.json()) as Calendar
}

export interface Compus {
  ok: boolean
  socoteala: Socoteala
  /** ce a intrat cu adevărat, măsurat la randare */
  raport?: { intrate: number; peDinafara: number; coloaneFolosite: number }
  pdf?: ArrayBuffer
  /** pagina întâi ca poză, din aceeași randare — coperta de pe ecran și, la validare, a arhivei */
  coperta?: ArrayBuffer
  cheie?: string
  calendar?: Calendar | null
  /** ce oprește compunerea — cu cifre */
  plangeri: string[]
  /**
   * ce NU oprește compunerea, dar trebuie spus la vedere: programul e PROPUS (nevalidat), sau o
   * parte a numărului e text de probă. Se scriu la începutul răspunsului, nu la coadă.
   */
  atentie: string[]
  /** numărul așa cum s-a compus — cu umplerea de probă, unde omul n-a scris */
  cerut: NumarCerut
}

export interface OptiuniCompunere {
  cerut: NumarCerut
  /** pozele, ca data-URI: `p` cea mare, `s1`/`s2` cele mici */
  poze?: Record<string, string>
  /** fără calendar, pentru o probă rapidă */
  faraCalendar?: boolean
  /** compune chiar dacă socoteala se plânge — pentru previzualizare, niciodată pentru tipar */
  chiarDacaNuIncape?: boolean
  /** numai HTML-ul, fără browser (probele și previzualizarea în pagină) */
  doarHtml?: boolean
}

/**
 * Plângerile de formă — ce nu se poate compune deloc.
 *
 * ⚠️ Un articol GOL nu mai e plângere (user, 17.09.2026, seara): autorul, titlul, textul și sursa
 * lipsă se umplu cu text de probă, la vedere (`umplere.ts`). Rămân plângeri doar numărul, data și
 * mai mult de doi secundari — la ele nu există „de probă".
 */
export function plangeriDeForma(cerut: NumarCerut): string[] {
  const p: string[] = []
  if ((cerut.secundari ?? []).length > SECUNDARI_MAXIM) p.push(`cel mult ${SECUNDARI_MAXIM} articole secundare`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cerut.data ?? '')) p.push('data se scrie AAAA-LL-ZZ')
  if (!Number.isInteger(cerut.nr) || cerut.nr <= 0) p.push('numărul e un întreg pozitiv')
  return p
}

/** Ce se spune la vedere despre un calendar propus — aceleași cuvinte în pagină și în API. */
export const atentiePropus = (c: Pick<Calendar, 'titlu'>): string =>
  `PROPUS — programul săptămânii ${c.titlu} nu e validat: s-a folosit ce era disponibil (propunerea). ` +
  'Validează-l în aplicația Programul înainte de tipar.'

export async function compune(env: EnvCompunere, o: OptiuniCompunere): Promise<Compus> {
  const deForma = plangeriDeForma(o.cerut)

  /*
   * ÎNTÂI CALENDARUL ÎNTREG (treapta 0), fiindcă pe el se face UMPLEREA DE PROBĂ: ce n-a scris omul
   * se umple cu text de probă cât încape „cu programul complet, nu micșorat" (user, 17.09.2026).
   * Strângerea calendarului e numai pentru text ADEVĂRAT prea lung, nu pentru probă.
   */
  let c0: Calendar | null = null
  let eroareCalendar: string | null = null
  if (!o.faraCalendar) {
    const r = await calendarulNumarului(env, o.cerut.data, 0)
    if ('eroare' in r) eroareCalendar = `calendarul: ${r.eroare}`
    else c0 = r
  }
  const { cerut, deProba } = umpleCuProba(o.cerut, c0 ? { slujbe: c0.slujbe, detalii: c0.detalii } : undefined)

  /*
   * CALENDARUL SE STRÂNGE TREAPTĂ CU TREAPTĂ, numai cât e nevoie (user, 17.09.2026): întâi întreg;
   * dacă textul nu încape, fără sfinții duminicii; „în extremis", și fără pericopă. Se oprește la
   * prima treaptă la care socoteala tace. Dacă nici la a treia nu încape, vina e a textului, nu a
   * calendarului — și se răspunde cu cifrele de la treapta a treia, ca omul să știe cât să taie.
   */
  let calendar: Calendar | null = null
  let socoteala: Socoteala | null = null
  let plangeri: string[] = []
  const trepte: Strans[] = o.faraCalendar || eroareCalendar ? [0] : [0, 1, 2]
  for (const treapta of trepte) {
    let c: Calendar | null = null
    if (!o.faraCalendar && !eroareCalendar) {
      if (treapta === 0) c = c0
      else {
        const r = await calendarulNumarului(env, cerut.data, treapta)
        if ('eroare' in r) eroareCalendar = `calendarul: ${r.eroare}`
        else c = r
      }
    }
    const s = socoteste({
      ...cerut,
      calendar: c ? { slujbe: c.slujbe, detalii: c.detalii } : undefined,
    })
    calendar = c
    socoteala = s
    plangeri = [...deForma, ...(eroareCalendar ? [eroareCalendar] : []), ...s.plangeri]
    // fără calendar nu e ce strânge; iar dacă încape, nu se strânge degeaba
    if (eroareCalendar || s.incape) break
  }
  if (!socoteala) throw new Error('socoteala n-a rulat')
  if (calendar && calendar.strans > 0) {
    plangeri = plangeri.filter((p) => !p.startsWith('calendarul singur'))
  }

  // ce se spune LA ÎNCEPUT, chiar dacă numărul iese: programul propus și textul de probă
  const atentie: string[] = []
  if (calendar?.stare === 'propus') atentie.push(atentiePropus(calendar))
  if (deProba.length) atentie.push(`text de probă la: ${deProba.join('; ')}`)

  if (plangeri.length && !o.chiarDacaNuIncape) {
    return { ok: false, socoteala, calendar, plangeri, atentie, cerut }
  }

  const html = foaieHtml({
    cerut,
    poze: o.poze,
    calendar: calendar ? { tabel: calendar.tabel, stil: calendar.stil } : null,
    floare: socoteala.floare,
    dataScrisa: dataLunga(cerut.data),
  })

  if (o.doarHtml) {
    return { ok: plangeri.length === 0, socoteala, calendar, plangeri, atentie, cerut, cheie: undefined, pdf: undefined, raport: undefined }
  }

  const { pdf, raport, coperta } = await randeaza(env, html)
  if (raport && raport.peDinafara > 0) {
    plangeri.push(
      `la randare au rămas ${raport.peDinafara} de semne pe dinafară — socoteala zicea că încap, ` +
      `dar hârtia zice altfel; scurtează cu cel puțin atât`,
    )
  }

  return {
    ok: plangeri.length === 0,
    socoteala,
    raport,
    pdf,
    coperta,
    calendar,
    plangeri,
    atentie,
    cerut,
    cheie: cheiaNumarului(cerut),
  }
}

/** Cheia din depozit: aceeași formă ca la numerele venite din V1. */
export const cheiaNumarului = (cerut: Pick<NumarCerut, 'nr' | 'data'>): string =>
  `${cerut.data.slice(0, 4)}/buletin-${cerut.nr}-${cerut.data}.pdf`

/**
 * Cheia COPERTEI — pagina întâi ca poză, sub același nume ca la numerele aduse din V1
 * (`2026/buletin-613-2026-08-09.jpg`), ca arhiva să nu aibă două feluri de nume.
 *
 * ⚠️ Una singură, nu două: în V1 erau `…jpg` (1400) și `…-mic.jpg` (460), tăiate la import cu o
 * unealtă care nu există în Worker. Aici poza iese din aceeași sesiune de browser ca PDF-ul, la o
 * singură măsură (~1590 px), iar rândul din arhivă o pune în amândouă coloanele. Raftul o arată mai
 * mică decât e — un fișier ceva mai greu la un număr pe săptămână, nu la toate cele 619.
 */
export const cheiaCopertei = (cerut: Pick<NumarCerut, 'nr' | 'data'>): string =>
  `${cerut.data.slice(0, 4)}/buletin-${cerut.nr}-${cerut.data}.jpg`

/**
 * CEREREA PĂSTRATĂ LÂNGĂ PDF — numărul ca date (motto, articole), nu doar ca foaie.
 *
 * De ce: numerele vechi sunt fișiere, iar din ele nu se mai poate lua nimic ca atare. Ce se compune
 * de aici înainte se păstrează și ca JSON, sub `compus/`, ca următorul număr să pornească de la el
 * (motto-ul „de la numărul trecut", user 17.09.2026) și ca „un AI simplu care înlocuiește un text"
 * să aibă ce înlocui. Se păstrează CE A SCRIS OMUL, nu umplerea de probă — aceea se reface oricând.
 */
export const cheiaCererii = (cerut: Pick<NumarCerut, 'nr' | 'data'>): string =>
  `compus/${cerut.data.slice(0, 4)}/buletin-${cerut.nr}-${cerut.data}.json`

export async function pastreazaCererea(env: Pick<EnvCompunere, 'FISIERE'>, cerut: NumarCerut): Promise<string> {
  const cheie = cheiaCererii(cerut)
  await env.FISIERE.put(cheie, JSON.stringify(cerut), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: { nr: String(cerut.nr), data: cerut.data },
  })
  return cheie
}

/**
 * MOTTO-UL NUMĂRULUI TRECUT, cu care se precompletează numărul nou (user, 17.09.2026: „Motto —
 * trebuie să fie precompletat motto-ul trecut, de la numărul trecut").
 *
 * Două izvoare, în ordinea asta: (1) cel mai nou număr COMPUS aici, a cărui cerere e păstrată sub
 * `compus/` — dacă e cel puțin la fel de nou ca arhiva; (2) altfel textul scos din PDF-ul celui
 * mai nou număr din arhivă, unde motto-ul stă între parohie și pastilă (`mottoDinText`). Dacă
 * niciunul nu dă nimic, `null`: câmpul rămâne gol, nu se inventează un citat.
 */
export async function mottoDinainte(
  env: { FISIERE: R2Bucket; DB: D1Database },
  curent: { nr: number; data: string } | null,
): Promise<{ motto: string; motoAutor?: string } | null> {
  const lista = await env.FISIERE.list({ prefix: 'compus/' })
  const compuse = lista.objects
    .map((o) => ({ cheie: o.key, m: /buletin-(\d+)-(\d{4}-\d{2}-\d{2})\.json$/.exec(o.key) }))
    .filter((x): x is { cheie: string; m: RegExpExecArray } => !!x.m)
    .map((x) => ({ cheie: x.cheie, nr: Number(x.m[1]), data: x.m[2]! }))
    .sort((a, b) => (a.data === b.data ? b.nr - a.nr : a.data < b.data ? 1 : -1))
  const celMaiNou = compuse[0]
  if (celMaiNou && (!curent || celMaiNou.data >= curent.data)) {
    const obiect = await env.FISIERE.get(celMaiNou.cheie)
    const c = obiect ? await obiect.json<Partial<NumarCerut>>().catch(() => null) : null
    if (c?.motto?.trim()) return { motto: c.motto.trim(), motoAutor: c.motoAutor?.trim() || undefined }
  }
  if (!curent) return null
  return mottoDinText(await capulTextului(env.DB, curent.nr, curent.data))
}

/**
 * Randarea, cu raportul curgerii.
 *
 * ⚠️ Browser Rendering așteaptă `data-potrivit` înainte să tipărească — marcajul `data-potrivire`
 * din foaie e semnul după care `@xc/ui` știe să aștepte, iar scriptul foii îl ridică după ce a
 * terminat de curs. Fără el s-ar tipări pagina goală, înainte ca textul să fi ajuns în coloane.
 */
async function randeaza(env: EnvCompunere, html: string): Promise<{ pdf: ArrayBuffer; raport?: Compus['raport']; coperta?: ArrayBuffer }> {
  return await pdfCuRaportSiCoperta<Compus['raport']>(env.BROWSER, html)
}

/** Textul numărului, pentru căutarea din arhivă. */
export { textCurat, semne }
