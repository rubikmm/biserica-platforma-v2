/**
 * „PROGRAMUL S-A SCHIMBAT DE LA ULTIMA COMPUNERE" (user, 19.09.2026: „am modificat programul și nu
 * mi-l citește… ar trebui ca, de fiecare dată când se compune, să verifice dacă buletinul a suferit
 * vreo modificare… se poate și cu un flag pentru dată, nu neapărat să îl regenereze automat").
 *
 * ⚠️ CE S-A ÎNTÂMPLAT DE FAPT, pe 19.09.2026 (aflat din audit și din D1, nu ghicit): săptămâna
 * 21–27 septembrie s-a schimbat la 10:54:49Z (o slujbă în plus, marți), iar ultima compunere
 * IZBUTITĂ a numărului 616 fusese la 10:47:07Z — cea de la 10:55:55Z, de după schimbare, s-a oprit
 * la socoteală și n-a scris nimic. Pe ecran a rămas deci foaia de la 10:47, cu programul dinainte,
 * iar nimic din pagină nu spunea asta. Programul SE CITEȘTE proaspăt la fiecare compunere (legătura
 * de serviciu nu trece prin niciun cache); ce lipsea era semnul că foaia de pe ecran a rămas în urmă.
 *
 * Probele de aici păzesc lanțul acelui semn, capăt cu capăt:
 *   1. programul dă o AMPRENTĂ a săptămânii, care se schimbă la orice schimbare a ei și NU se schimbă
 *      când buletinul cere aceeași săptămână strânsă (altfel semnul ar sta aprins degeaba);
 *   2. amprenta se păstrează lângă numărul compus (`compus/…json`) și intră în `?v=`;
 *   3. ecranul `/nou` compară și scrie chenarul — dar numai când chiar are ce compara.
 */
import { describe, expect, it } from 'vitest'
import type { IntrareVocabular } from '@xc/contracts'
import {
  amprentaFoii,
  cheiaCererii,
  pastreazaNumarul,
  programulFolosit,
  programulSaSchimbat,
  type Calendar,
} from '../apps/buletin/src/compune.js'
import { type Ctx, buletinulNou, paginaNou } from '../apps/buletin/src/pagini.js'
import type { NumarCerut } from '../apps/buletin/src/masuri.js'
import { tabelulSaptamanii } from '../apps/program/src/hartii.js'
import { VEDE_TOT } from '../apps/program/src/depozit.js'

// ─────────────────────────────── programul: amprenta săptămânii ───────────────────────────────

const VOCABULAR = new Map<string, IntrareVocabular>([
  ['utrenia_liturghie', { cod_nume: 'utrenia_liturghie', nume: 'Utrenia și Sfânta Liturghie', categorie: 'dimineata', ordine: 1, activ: true }],
  ['vecernia_litia', { cod_nume: 'vecernia_litia', nume: 'Vecernia și Litia', categorie: 'seara', ordine: 9, activ: true }],
  ['maslu', { cod_nume: 'maslu', nume: 'Sfântul Maslu', categorie: 'alte', ordine: 22, activ: true }],
])

type RandProba = { data: string; ora: string; cod: string; detalii?: string[] }

const randSlujba = (s: RandProba, i: number) => ({
  id: `${s.data}-${s.cod}-${i}`,
  luni: '2026-09-21',
  data: s.data,
  ora: s.ora,
  nume: VOCABULAR.get(s.cod)?.nume ?? s.cod,
  cod_nume: s.cod,
  slujitor: null,
  loc: 'biserica',
  detalii: JSON.stringify(s.detalii ?? []),
  observatii: null,
  curatenie: 0,
  transmisie: 1,
  ordine: i,
  creat: '2026-09-15T08:00:00.000Z',
  modificat: '2026-09-15T08:00:00.000Z',
})

/** D1 cât îi trebuie tabelului săptămânii: rândul ei, slujbele ei și ceasul ultimei atingeri. */
function dbFals(o: { slujbe: RandProba[]; stare?: 'validat' | 'propus'; modificat?: string }) {
  const rand = {
    luni: '2026-09-21', duminica: '2026-09-27', stare: o.stare ?? 'validat',
    titlu: '', sursa: 'manual', sursa_id: null, sursa_link: null, versiune_calendar: null,
    validat_de: 'u1', validat_la: '2026-09-15T08:00:00.000Z',
    creat: '2026-09-15T08:00:00.000Z', modificat: o.modificat ?? '2026-09-19T10:54:49.462Z',
  }
  return {
    prepare(sql: string) {
      return {
        bind() { return this },
        async first() {
          if (sql.includes('FROM saptamani WHERE luni')) return rand
          if (sql.includes('MAX(m)')) return { modificat: o.modificat ?? '2026-09-19T10:54:49.462Z' }
          return null
        },
        async all() {
          if (sql.includes('FROM slujbe WHERE luni')) return { results: o.slujbe.map(randSlujba) }
          return { results: [] }
        },
      }
    },
  } as unknown as D1Database
}

const CALENDAR_TACE = { fetch: async () => new Response(JSON.stringify({ zile: [] }), { headers: { 'content-type': 'application/json' } }) } as unknown as Fetcher

const envProgram = (o: Parameters<typeof dbFals>[0]) =>
  ({ DB: dbFals(o), CALENDAR: CALENDAR_TACE, TIPIC: CALENDAR_TACE, BROWSER: CALENDAR_TACE })

const CELE_TREI: RandProba[] = [
  { data: '2026-09-23', ora: '21:00', cod: 'utrenia_liturghie', detalii: ['Sfântul Cuvios Siluan Atonitul'] },
  { data: '2026-09-26', ora: '18:00', cod: 'vecernia_litia' },
  {
    data: '2026-09-27', ora: '08:00', cod: 'utrenia_liturghie',
    // rândul pericopei e cel care CADE la treapta a treia — pe el se sprijină proba de mai jos
    detalii: ['Ap. 2 Corinteni 9, 6-11; Ev. Luca 5, 1-11; glas 8, voscr. 6', 'Duminica a 18-a după Rusalii'],
  },
]
/** Aceeași săptămână, cu slujba adăugată marți — chiar schimbarea din 19.09.2026. */
const CU_MASLUL: RandProba[] = [{ data: '2026-09-22', ora: '18:00', cod: 'maslu' }, ...CELE_TREI]

const tabelul = async (slujbe: RandProba[], strans: 0 | 1 | 2 = 0) => {
  // `VEDE_TOT`: buletinul cere tabelul pe UȘA INTERNĂ (20.09.2026), deci vede și o săptămână
  // nepublicată — altfel n-ar putea socoti spațiul paginii a patra înainte de duminică.
  const t = await tabelulSaptamanii(envProgram({ slujbe }), '2026-09-21', VEDE_TOT, VOCABULAR, strans)
  if (!t.ok) throw new Error('tabelul n-a ieșit')
  return t
}

describe('amprenta programului săptămânii (`/v1/tabel-tipar`)', () => {
  it('se schimbă când se adaugă o slujbă — altfel nimeni n-ar afla că foaia a rămas în urmă', async () => {
    const inainte = await tabelul(CELE_TREI)
    const dupa = await tabelul(CU_MASLUL)
    expect(inainte.amprenta).toMatch(/^[0-9a-f]{20}$/)
    expect(dupa.amprenta).not.toBe(inainte.amprenta)
    // și tabelul chiar s-a schimbat: proba nu compară două hash-uri ale aceluiași lucru
    expect(inainte.tabel).not.toContain('Sfântul Maslu')
    expect(dupa.tabel).toContain('Sfântul Maslu')
  })

  it('nu se schimbă la aceeași săptămână cerută de două ori', async () => {
    expect((await tabelul(CU_MASLUL)).amprenta).toBe((await tabelul(CU_MASLUL)).amprenta)
  })

  /**
   * ⚠️ PROBA CARE ȚINE SEMNUL SĂ NU MINTĂ. Buletinul cere tabelul STRÂNS când textul nu mai încape
   * (`strans=1|2`), iar ecranul `/nou` îl cere întreg. Dacă amprenta s-ar lua pe tabelul strâns,
   * un număr compus cu programul micșorat ar părea veșnic „schimbat" — un chenar roșu care nu se
   * mai stinge orice ai face, adică unul pe care omul învață să nu se mai uite.
   */
  it('e aceeași la orice treaptă de strângere: e amprenta SĂPTĂMÂNII, nu a tabelului tipărit', async () => {
    const [t0, t1, t2] = await Promise.all([tabelul(CU_MASLUL, 0), tabelul(CU_MASLUL, 1), tabelul(CU_MASLUL, 2)])
    expect(t1.amprenta).toBe(t0.amprenta)
    expect(t2.amprenta).toBe(t0.amprenta)
    // treptele chiar strâng ceva — altfel proba de sus n-ar dovedi nimic
    expect(t2.detalii).toBeLessThan(t0.detalii)
  })

  it('spune și CÂND s-a atins ultima oară săptămâna, ca ecranul să poată scrie ora', async () => {
    expect((await tabelul(CU_MASLUL)).modificat_la).toBe('2026-09-19T10:54:49.462Z')
  })
})

// ─────────────────────────────── buletinul: comparația ───────────────────────────────

const PROGRAM_VECHI = { amprenta: 'aaaaaaaaaaaaaaaaaaaa', modificat_la: '2026-09-18T19:05:04.621Z', stare: 'validat' as const }
const ACUM = { amprenta: 'bbbbbbbbbbbbbbbbbbbb', modificat_la: '2026-09-19T10:54:49.462Z' }

describe('s-a schimbat programul de la ultima compunere?', () => {
  it('da, când amprentele diferă — și spune ceasul schimbării', () => {
    expect(programulSaSchimbat(PROGRAM_VECHI, ACUM)).toEqual({ modificat_la: '2026-09-19T10:54:49.462Z' })
  })

  it('nu, când e aceeași amprentă', () => {
    expect(programulSaSchimbat(PROGRAM_VECHI, { amprenta: PROGRAM_VECHI.amprenta, modificat_la: ACUM.modificat_la })).toBe(null)
  })

  /**
   * ⚠️ Tăcere, nu alarmă, când nu se poate ști: numerele compuse înainte de 19.09.2026 n-au amprentă
   * păstrată, iar programul care n-a răspuns n-are una de dat. Un semn aprins din necunoaștere ar
   * fi aprins la ORICE intrare pe ecran, până n-ar mai însemna nimic.
   */
  it('tace când lipsește oricare dintre amprente', () => {
    expect(programulSaSchimbat(undefined, ACUM)).toBe(null)
    expect(programulSaSchimbat({ modificat_la: null }, ACUM)).toBe(null)
    expect(programulSaSchimbat(PROGRAM_VECHI, null)).toBe(null)
    expect(programulSaSchimbat(PROGRAM_VECHI, { amprenta: undefined, modificat_la: null })).toBe(null)
  })

  it('ia din calendarul primit exact ce se păstrează: amprenta, ceasul și starea', () => {
    const c = { amprenta: 'cccc', modificat_la: '2026-09-19T10:00:00.000Z', stare: 'propus' } as Calendar
    expect(programulFolosit(c)).toEqual({ amprenta: 'cccc', modificat_la: '2026-09-19T10:00:00.000Z', stare: 'propus' })
    expect(programulFolosit(null)).toBeUndefined()
  })
})

describe('amprenta foii din adresa `?v=`', () => {
  it('se schimbă când se schimbă programul, chiar dacă fișierul ar avea același etag', () => {
    expect(amprentaFoii('"abc123"', 'aaaaaaaaaa')).not.toBe(amprentaFoii('"abc123"', 'bbbbbbbbbb'))
    expect(amprentaFoii('"abc123"', 'aaaaaaaaaa')).toBe('abc123-aaaaaaaaaa')
  })

  it('rămâne o adresă bună și fără amprenta programului (numere compuse înainte)', () => {
    expect(amprentaFoii('"abc123"')).toBe('abc123')
    expect(amprentaFoii(null, null)).not.toBe('')
  })
})

// ─────────────────────────────── ce rămâne în depozit ───────────────────────────────

const CERUT: NumarCerut = {
  motto: 'Un citat scurt.',
  nr: 616,
  data: '2026-09-20',
  principal: { autor: 'AUTOR', titlu: 'TITLU', text: 'Un text.' },
}

describe('programul se păstrează lângă numărul compus', () => {
  it('intră în `compus/…json`, ca ecranul să aibă cu ce compara la reîncărcare', async () => {
    const puse = new Map<string, string>()
    const r2 = {
      async put(cheie: string, corp: unknown) {
        if (typeof corp === 'string') puse.set(cheie, corp)
        return { httpEtag: '"etag616"' }
      },
      async delete() { return undefined },
    } as unknown as R2Bucket

    const pus = await pastreazaNumarul(
      { FISIERE: r2 },
      { cerut: CERUT, pdf: new ArrayBuffer(8), program: PROGRAM_VECHI },
    )
    const scris = JSON.parse(puse.get(cheiaCererii(CERUT)) ?? '{}') as { program?: unknown; nr?: number }
    expect(scris.nr).toBe(616)
    expect(scris.program).toEqual(PROGRAM_VECHI)
    // amprenta foii poartă și programul: adresa se schimbă când se schimbă pagina a patra
    expect(pus.versiune).toBe('etag616-aaaaaaaaaa')
  })
})

// ─────────────────────────────── ecranul `/nou` ───────────────────────────────

const CTX: Ctx = {
  prefix: '/buletin',
  nav: { home: '', cont: '/cont', admin: '/admin' } as Ctx['nav'],
  utilizator: 'Părintele',
  eAdmin: true,
  versiune: '0.12.1',
  modificata: '19.09.2026',
}
const NOU = buletinulNou({ nr: 615, data: '2026-09-06', an: '2026', luna: '09', cheie_pdf: null, cheie_poza_mica: null, pagini: 4 }, '2026-09-19')

const ecran = (programSchimbat?: { modificat_la: string | null } | null) =>
  paginaNou(CTX, { nou: true, ani: ['2026'] }, NOU, {
    calendar: { titlu: '21 – 27 septembrie 2026', slujbe: 4, stare: 'validat' },
    programSchimbat,
    raspuns: {
      facut: true,
      cheie: '2026/buletin-616-2026-09-20.pdf',
      cheiePoza: '2026/buletin-616-2026-09-20.jpg',
      versiune: 'etag616-aaaaaaaaaa',
      marime: 731717,
      plangeri: [],
    },
  })

/**
 * Numai bucata butonului: în pagina întreagă „atentie-program" apare oricum în foaia de stil, iar
 * „data-auto" în scriptul butonului — deci o probă pe tot HTML-ul ar trece mereu, fără să vadă nimic.
 */
const compunerea = (h: string): string => {
  const i = h.indexOf('<section class="compunerea">')
  return h.slice(i, h.indexOf('</section>', i))
}

describe('semnul de pe ecranul `/nou`', () => {
  it('se scrie când programul s-a schimbat, cu ora lui, lângă butonul de compunere', () => {
    const s = compunerea(ecran({ modificat_la: '2026-09-19T10:54:49.462Z' }))
    expect(s).toContain('class="atentie-program"')
    expect(s).toContain('Programul s-a schimbat de la ultima compunere')
    expect(s).toContain('recompune numărul')
    // ora Bucureștiului (UTC+3 în septembrie), nu cea din ISO
    expect(s).toMatch(/la ora (13:54|19\.09, 13:54)/)
    // ⚠️ ÎNAINTEA butonului: e o îndemnare la fapta de dedesubt
    expect(s.indexOf('atentie-program')).toBeLessThan(s.indexOf('id="b-compune"'))
  })

  it('NU se scrie când foaia e la zi — ecranul rămâne fără vorbărie, cum s-a cerut', () => {
    const s = compunerea(ecran(null))
    expect(s).not.toContain('atentie-program')
    expect(s).not.toContain('Programul s-a schimbat')
    expect(s).toContain('id="b-compune"')
  })

  /**
   * ⚠️ Semnul NU pornește nicio compunere (user: „nu neapărat să îl regenereze automat de la zero").
   * `data-auto` e al variantei zero, la prima intrare pe un număr fără foaie — nu al foii rămase în urmă.
   */
  it('nu recompune singur: butonul rămâne al omului', () => {
    expect(compunerea(ecran({ modificat_la: null }))).toContain('id="b-compune">Compune numărul</button>')
  })

  it('fără ceas (săptămâna nu e în baza programului) scrie doar vestea, fără „la ora"', () => {
    const s = compunerea(ecran({ modificat_la: null }))
    expect(s).toContain('Programul s-a schimbat de la ultima compunere —')
    expect(s).not.toContain('la ora')
  })
})
