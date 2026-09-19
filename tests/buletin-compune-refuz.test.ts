/**
 * REFUZUL COMPUNERII, AJUNS LA OM (user, 19.09.2026, 12:35: „am schimbat titlul articolului
 * principal… am dat compune, am scris în chat să compună… nicio modificare").
 *
 * ⚠️ CE S-A ÎNTÂMPLAT, aflat din audit, din chat și din depozit, nu ghicit. Titlul nr. 616 a devenit
 * „CHIPUL BLÂND AL DUHOVNICULUI" la 12:32:51Z (era „Niciunul", opt semne). Un titlu mai lung mănâncă
 * din coloana articolului, iar textul era deja la limită (9108 semne dintr-o măsură de ~9178, după
 * ce Sfântul Maslu de marți intrase în programul de pe pagina a patra). Cele două compuneri care au
 * urmat — 12:33:04Z și 12:33:49Z — au REFUZAT pe drept: „la randare au rămas 64 de semne pe
 * dinafară". Compunerea și-a făcut datoria; ce s-a stricat e DRUMUL REFUZULUI către om:
 *
 *   1. în bulă, „Da" răspundea „Gata. Compun buletinul nr. 616 …" peste o foaie neatinsă — vezi
 *      `tests/chat-asincron.test.ts`, unde stă proba confirmării;
 *   2. sub butonul din `/nou`, plângerea se scria `marunt rau`, dar `rau` era stilat DOAR pe
 *      `.veste` — deci ieșea gri-estompat, leit cu rândul nevinovat de dinaintea ei;
 *   3. cifra „cu cât e peste" se pierdea: pe drumul refuzului, `semne_pe_dinafara` se întorcea
 *      `null`, deși randarea CHIAR avusese loc și numărase 64 (de aceea rândul de audit de la
 *      12:33:04Z scrie `"semne_pe_dinafara":null` lângă o plângere care spune 64).
 */
import { describe, expect, it, vi } from 'vitest'
import type { NumarCerut } from '../apps/buletin/src/masuri.js'
import {
  actiuniBuletin,
  compuneNumarul,
  rezumatAuditCompunere,
  vorbaIzbanzii,
  vorbaRefuzului,
} from '../apps/buletin/src/actiuni.js'
import { LOCAL } from '../apps/buletin/src/stil.js'
import { type Ctx, buletinulNou, paginaNou } from '../apps/buletin/src/pagini.js'

/**
 * ⚠️ Se joacă DOAR randarea (`compune`) și scrierea în depozit (`pastreazaNumarul`): restul lui
 * `compuneNumarul` — hotărârea „s-a făcut / n-a ieșit", cifrele duse mai departe, plângerile — e
 * chiar ce se probează, deci rămâne cel adevărat.
 */
const compuneJucat = vi.fn()
const pastratJucat = vi.fn(async () => ({ cheie: '2026/buletin-616-2026-09-20.pdf', versiune: 'abc' }))

vi.mock('../apps/buletin/src/compune.js', async (adevarat) => ({
  ...(await adevarat<typeof import('../apps/buletin/src/compune.js')>()),
  compune: (...a: unknown[]) => compuneJucat(...a),
  pastreazaNumarul: (...a: unknown[]) => pastratJucat(...a),
}))

/** Arhiva tace: numărul și data vin din argumente, ca la o cerere din afara chatului. */
const ENV = {
  DB: { prepare: () => ({ bind() { return this }, async first() { return null }, async all() { return { results: [] } } }) },
} as never

const CERUT: NumarCerut = {
  motto: 'Maica Domnului ne iubește mult.',
  nr: 616,
  data: '2026-09-20',
  principal: { autor: 'SFÂNTUL SOFIAN', titlu: 'CHIPUL BLÂND AL DUHOVNICULUI', text: 'x', sursa: '-' },
  floare: true,
}

const NUMARUL = {
  nr: 616,
  data: '2026-09-20',
  principal: { autor: 'SFÂNTUL SOFIAN', titlu: 'CHIPUL BLÂND AL DUHOVNICULUI', text: 'x' },
}

/** Randarea de la 12:33: hârtia s-a făcut, dar 64 de semne au rămas afară — deci `ok:false`. */
const CU_SEMNE_AFARA = {
  ok: false,
  socoteala: { plangeri: [], incape: true, zone: [], floare: true },
  raport: { intrate: 9044, peDinafara: 64, coloaneFolosite: 6 },
  pdf: new ArrayBuffer(8),
  coperta: new ArrayBuffer(4),
  calendar: null,
  plangeri: ['la randare au rămas 64 de semne pe dinafară — socoteala zicea că încap, dar hârtia zice altfel; scurtează cu cel puțin atât'],
  atentie: [],
  cerut: CERUT,
}

/** Randarea izbutită, pentru partea cealaltă a probei. */
const IZBUTITA = { ...CU_SEMNE_AFARA, ok: true, plangeri: [], raport: { intrate: 9108, peDinafara: 0, coloaneFolosite: 6 } }

describe('compunerea refuzată: cifrele randării nu se mai pierd pe drum', () => {
  it('ține „cu cât e peste" (64) și cât a intrat — tocmai ele lipseau din rândul de audit', async () => {
    compuneJucat.mockResolvedValueOnce(CU_SEMNE_AFARA)
    const r = await compuneNumarul(ENV, NUMARUL)
    expect(r.facut).toBe(false)
    expect(r.semne_pe_dinafara).toBe(64)
    expect(r.semne_intrate).toBe(9044)
    expect(r.plangeri.join(' ')).toContain('64 de semne')
  })

  it('nu scrie nimic în depozit: foaia de pe ecran rămâne, pe drept, cea de dinainte', async () => {
    pastratJucat.mockClear()
    compuneJucat.mockResolvedValueOnce(CU_SEMNE_AFARA)
    const r = await compuneNumarul(ENV, NUMARUL)
    expect(pastratJucat).not.toHaveBeenCalled()
    expect(r.cheie).toBeNull()
  })

  it('rândul de audit poartă acum cifra, nu `null` lângă o plângere care spune 64', async () => {
    compuneJucat.mockResolvedValueOnce(CU_SEMNE_AFARA)
    const r = await compuneNumarul(ENV, NUMARUL)
    expect(rezumatAuditCompunere(r)).toMatchObject({ facut: false, semne_pe_dinafara: 64 })
  })

  it('când randarea nici n-a apucat să se facă, cifra rămâne `null` — nu se inventează', async () => {
    compuneJucat.mockResolvedValueOnce({ ...CU_SEMNE_AFARA, raport: undefined, pdf: undefined, plangeri: ['principal: 412 de semne peste măsură (încap 9178, sunt 9590)'] })
    const r = await compuneNumarul(ENV, NUMARUL)
    expect(r.semne_pe_dinafara).toBeNull()
    // cifra stă atunci în plângerea socotelii, cu vorbele ei
    expect(r.plangeri.join(' ')).toContain('412 de semne')
  })
})

describe('vorba refuzului: una singură, pentru amândouă ușile', () => {
  it('spune întâi FAPTA (foaia rămâne cea veche), apoi motivul cu cifra lui', () => {
    const v = vorbaRefuzului({ nr: 616, plangeri: ['la randare au rămas 64 de semne pe dinafară'] })
    expect(v).toContain('Numărul 616 NU s-a compus')
    expect(v).toContain('foaia rămâne cea de dinainte')
    expect(v).toContain('64 de semne')
  })

  it('fără nicio plângere spune măcar că n-a încăput — nu tace', () => {
    expect(vorbaRefuzului({ nr: 616, plangeri: [] })).toContain('nu încape pe hârtie')
  })
})

/**
 * ⚠️ IZBÂNDA CU CEDARE NU TACE (19.09.2026, 16:31): când foaia a ieșit numai fiindcă i-am scos
 * floarea ori sfinții duminicii din calendar, lipsa lor se VEDE pe pagina a patra. Cine n-a fost
 * înștiințat crede că s-a stricat ceva — deci cedarea călătorește până în bulă, ca și refuzul.
 */
describe('ce s-a cedat ajunge la om, nu rămâne în compunere', () => {
  const CU_CEDARE = { ...IZBUTITA, cedat: 'fără floare, calendar fără sfinții duminicii' }

  it('`compuneNumarul` duce `cedat` mai departe', async () => {
    compuneJucat.mockResolvedValueOnce(CU_CEDARE)
    const r = await compuneNumarul(ENV, NUMARUL)
    expect(r.facut).toBe(true)
    expect(r.cedat).toBe('fără floare, calendar fără sfinții duminicii')
  })

  it('foaia ieșită întreagă nu spune nimic — n-a fost nimic de cedat', async () => {
    compuneJucat.mockResolvedValueOnce(IZBUTITA)
    const r = await compuneNumarul(ENV, NUMARUL)
    expect(r.cedat).toBeNull()
    expect(vorbaIzbanzii(r)).toBe('')
  })

  it('bula citește fapta făcută ȘI ce s-a cedat pentru ea', async () => {
    compuneJucat.mockResolvedValueOnce(CU_CEDARE)
    const date = await compuneNumarul(ENV, NUMARUL)
    const raport = actiuniBuletin.find((a) => a.nume === 'buletin.compune')!.raportul!({ argumente: {}, date })
    expect(raport).toMatchObject({ facut: true })
    expect(raport!.text).toContain('s-a compus')
    expect(raport!.text).toContain('fără floare')
  })
})

describe('`buletin.compune` își raportează refuzul, ca bula să nu mai spună „Gata."', () => {
  const compune = actiuniBuletin.find((a) => a.nume === 'buletin.compune')!

  it('la `facut:false` raportează fapta nefăcută, cu vorba refuzului', async () => {
    compuneJucat.mockResolvedValueOnce(CU_SEMNE_AFARA)
    const date = await compuneNumarul(ENV, NUMARUL)
    const raport = compune.raportul!({ argumente: {}, date })
    expect(raport).toMatchObject({ facut: false })
    expect(raport!.text).toContain('NU s-a compus')
    expect(raport!.text).toContain('64 de semne')
  })

  it('la izbândă raportează fapta făcută — „Gata." rămâne unde i-e locul', async () => {
    compuneJucat.mockResolvedValueOnce(IZBUTITA)
    const date = await compuneNumarul(ENV, NUMARUL)
    expect(date.facut).toBe(true)
    expect(compune.raportul!({ argumente: {}, date })).toMatchObject({ facut: true })
  })
})

// ---------------------------------------------------------------------------
// Ușa cealaltă: butonul „Compune numărul" de pe `/nou`
// ---------------------------------------------------------------------------

const CTX: Ctx = {
  prefix: '/buletin',
  nav: { home: '', cont: '/cont', admin: '/admin' } as Ctx['nav'],
  utilizator: 'Părintele',
  eAdmin: true,
  versiune: '0.12.3',
  modificata: '19.09.2026',
}
const NOU = buletinulNou({ nr: 615, data: '2026-09-06', an: '2026', luna: '09', cheie_pdf: null, cheie_poza_mica: null, pagini: 4 }, '2026-09-19')

describe('refuzul de sub buton: se vede că E un refuz', () => {
  const pagina = paginaNou(CTX, { nou: true, ani: ['2026'] }, NOU, { calendar: null })

  /**
   * ⚠️ PROBA DEFECTULUI: rândul se scrie de mult `class="marunt rau"`, dar `rau` era stilat NUMAI pe
   * `.veste`. Gri-estompat sub un buton, „nu s-a compus: au rămas 64 de semne pe dinafară" arăta
   * exact ca „se compune varianta de probă…" de dinaintea lui — adică a trecut neluat în seamă.
   */
  it('stilul cunoaște rândul refuzului, nu doar vestea abonării', () => {
    expect(LOCAL).toContain('.compunerea .marunt.rau')
    expect(LOCAL.slice(LOCAL.indexOf('.compunerea .marunt.rau'))).toContain('var(--rosu)')
  })

  it('butonul scrie rândul cu semnul refuzului pe el', () => {
    expect(pagina).toContain("veste.className = rau ? 'marunt rau' : 'marunt'")
  })

  it('butonul spune fraza scrisă de server — aceeași ca în bulă', () => {
    expect(pagina).toContain('j.spune')
    // plasa rămâne: un răspuns venit fără frază (403, 405, 500) tot se citește
    expect(pagina).toContain('j.plangeri.join')
  })
})
