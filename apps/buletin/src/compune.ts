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
import { dataLunga, pdfCuRaport } from '@xc/ui'
import { foaieHtml, textCurat } from './foaie.js'
import { type NumarCerut, type Socoteala, SECUNDARI_MAXIM, semne, socoteste } from './masuri.js'

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
  cheie?: string
  calendar?: Calendar | null
  plangeri: string[]
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

/** Numărul de plângeri pe care le poate avea cererea înainte de orice socoteală. */
export function plangeriDeForma(cerut: NumarCerut): string[] {
  const p: string[] = []
  if (!cerut.principal?.text?.trim()) p.push('articolul principal n-are text')
  if (!cerut.principal?.titlu?.trim()) p.push('articolul principal n-are titlu')
  if (!cerut.principal?.autor?.trim()) p.push('articolul principal n-are autor — dacă nu se știe, scrie „Fără autor"')
  if ((cerut.secundari ?? []).length > SECUNDARI_MAXIM) p.push(`cel mult ${SECUNDARI_MAXIM} articole secundare`)
  for (const [i, a] of (cerut.secundari ?? []).entries()) {
    if (!a.text?.trim()) p.push(`secundarul ${i + 1} n-are text`)
    if (!a.autor?.trim()) p.push(`secundarul ${i + 1} n-are autor`)
    if (!a.titlu?.trim()) p.push(`secundarul ${i + 1} n-are titlu`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cerut.data ?? '')) p.push('data se scrie AAAA-LL-ZZ')
  if (!Number.isInteger(cerut.nr) || cerut.nr <= 0) p.push('numărul e un întreg pozitiv')
  return p
}

export async function compune(env: EnvCompunere, o: OptiuniCompunere): Promise<Compus> {
  const { cerut } = o
  const deForma = plangeriDeForma(cerut)

  /*
   * CALENDARUL SE STRÂNGE TREAPTĂ CU TREAPTĂ, numai cât e nevoie (user, 17.09.2026): întâi întreg;
   * dacă textul nu încape, fără sfinții duminicii; „în extremis", și fără pericopă. Se oprește la
   * prima treaptă la care socoteala tace. Dacă nici la a treia nu încape, vina e a textului, nu a
   * calendarului — și se răspunde cu cifrele de la treapta a treia, ca omul să știe cât să taie.
   */
  let calendar: Calendar | null = null
  let socoteala: Socoteala | null = null
  let plangeri: string[] = []
  const trepte: Strans[] = o.faraCalendar ? [0] : [0, 1, 2]
  for (const treapta of trepte) {
    let c: Calendar | null = null
    let eroareCalendar: string | null = null
    if (!o.faraCalendar) {
      const r = await calendarulNumarului(env, cerut.data, treapta)
      if ('eroare' in r) eroareCalendar = `calendarul: ${r.eroare}`
      else c = r
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

  if (plangeri.length && !o.chiarDacaNuIncape) {
    return { ok: false, socoteala, calendar, plangeri }
  }

  const html = foaieHtml({
    cerut,
    poze: o.poze,
    calendar: calendar ? { tabel: calendar.tabel, stil: calendar.stil } : null,
    floare: socoteala.floare,
    dataScrisa: dataLunga(cerut.data),
  })

  if (o.doarHtml) return { ok: plangeri.length === 0, socoteala, calendar, plangeri, cheie: undefined, pdf: undefined, raport: undefined }

  const { pdf, raport } = await randeaza(env, html)
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
    calendar,
    plangeri,
    cheie: cheiaNumarului(cerut),
  }
}

/** Cheia din depozit: aceeași formă ca la numerele venite din V1. */
export const cheiaNumarului = (cerut: NumarCerut): string =>
  `${cerut.data.slice(0, 4)}/buletin-${cerut.nr}-${cerut.data}.pdf`

/**
 * Randarea, cu raportul curgerii.
 *
 * ⚠️ Browser Rendering așteaptă `data-potrivit` înainte să tipărească — marcajul `data-potrivire`
 * din foaie e semnul după care `@xc/ui` știe să aștepte, iar scriptul foii îl ridică după ce a
 * terminat de curs. Fără el s-ar tipări pagina goală, înainte ca textul să fi ajuns în coloane.
 */
async function randeaza(env: EnvCompunere, html: string): Promise<{ pdf: ArrayBuffer; raport?: Compus['raport'] }> {
  return await pdfCuRaport<Compus['raport']>(env.BROWSER, html)
}

/** Textul numărului, pentru căutarea din arhivă. */
export { textCurat, semne }
