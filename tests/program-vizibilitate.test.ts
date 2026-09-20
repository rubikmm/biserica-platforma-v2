/**
 * PUBLIC ARĂTĂM DOAR CE E CURENT — programul liturgic (20.09.2026, 23:33 și 23:55).
 *
 * Cele trei reguli ale userului:
 *   1. „Buletinul și programul sunt programate D-12:00, adică atunci devin curente și publice."
 *   2. „Public arătăm doar ce e curent." — confirmat anume și pentru live: transmisiunea pornește
 *      numai din săptămâni validate.
 *   3. Buletinul preia la validarea LUI programul validat; până atunci are nevoie de el ca să-și
 *      socotească spațiul — de aceea USA INTERNĂ („Trebuie să putem să lucrăm și la buletin cu un
 *      program în pagină, altfel nu putem calcula spațiul. Deci aș pune refuz, dar întârzierea
 *      lucrului la buletin ar fi nejustificată").
 *
 * ⚠️ CE SE POATE STRICA TĂCUT, și de aceea are fiecare proba lui:
 *   1. **o citire uitată**: e de ajuns o singură interogare fără clauză ca programul nepublicat să
 *      iasă în lume — și nimic nu s-ar vedea până în ziua în care s-ar vedea la toți;
 *   2. **„curentă" socotită din calendar**, nu din ce e publicat: duminică la 12:05 prima pagină ar
 *      arăta încă săptămâna care se încheie, deși foaia din mâna omului arată altceva;
 *   3. **marginea** săptămânii curente: o săptămână validată din import, departe în viitor, ar trage
 *      prima pagină după ea;
 *   4. **ușa internă**: deschisă cu un secret greșit, ori lăsată deschisă când secretul lipsește din
 *      mediu, ar fi o ușă publică fără nume;
 *   5. **`stare` față de `publica`**: buletinul se uită la prima (gestul omului), site-ul la a doua
 *      (fapta ceasului); confundate, ori buletinul ar scrie „PROPUS" pe un program programat de
 *      paroh, ori site-ul ar da afară o săptămână care n-a apărut încă.
 */
import { describe, expect, it, vi } from 'vitest'
import program from '../apps/program/src/index.js'
import {
  aniiArhivei,
  arhivaIntreaga,
  cerne,
  cerneSlujbe,
  LUMEA,
  saptamana,
  saptamanaCurenta,
  saptamanileAnului,
  saptamaniInterval,
  slujbaCurenta,
  slujbeInterval,
  slujbeleSaptamanii,
  tiparele,
  urmatoareaDupaNume,
  urmatoareaSlujba,
  VEDE_TOT,
  vedereaLui,
} from '../apps/program/src/depozit.js'
import { dbFals, saptamanaDeProba, SLUJBE, type Rand, type RandSlujbaProba } from './program-fals.js'

// ---------------------------------------------------------------------------
// Săptămânile de probă — una publicată, una programată, una din viitorul îndepărtat
// ---------------------------------------------------------------------------

/** Săptămâna 21–27 septembrie: PUBLICATĂ. E cea curentă în cea mai mare parte a probelor. */
const ACUM = '2026-09-21'
/** Săptămâna 28 sept. – 4 oct.: PROGRAMATĂ marți, apare duminică 27 la 12:00. */
const VIITOARE = '2026-09-28'
const PRAGUL = '2026-09-27T09:00:00.000Z'
/** O săptămână validată din import, prea departe ca să fie „curentă". */
const DEPARTE = '2026-11-02'

/** Marți, 22 septembrie, ora 13:00 a Bucureștiului. */
const MARTI = '2026-09-22T10:00:00.000Z'
/** Joi, 24 septembrie, 13:00 — săptămâna publicată nu mai are nicio slujbă de acum înainte. */
const JOI = '2026-09-24T10:00:00.000Z'
/** Duminică, 27 septembrie, 13:00 — ceasul a trecut deja săptămâna viitoare pe „validat". */
const DUMINICA_DUPA = '2026-09-27T10:00:00.000Z'

const publicata = (luni: string): Rand =>
  saptamanaDeProba(luni, { stare: 'validat', validat_de: 'u1', validat_la: `${luni}T09:00:00.000Z` })
const programata = (luni: string): Rand => saptamanaDeProba(luni, { programat_la: PRAGUL, programat_de: 'u1' })

const PUBLICATA = publicata(ACUM)
const PROGRAMATA = programata(VIITOARE)
/** Aceeași săptămână, după ce ceasul a trecut-o duminică la 12:00. */
const TRECUTA_DE_CEAS = saptamanaDeProba(VIITOARE, { stare: 'validat', validat_de: 'u1', validat_la: PRAGUL })

const TOATE_SLUJBELE = [...SLUJBE(ACUM), ...SLUJBE(VIITOARE)]

// ---------------------------------------------------------------------------
// Mediul
// ---------------------------------------------------------------------------

const OMUL = {
  authenticated: true,
  user: { id: 'u1', email: 'parintele@example.com', displayName: 'Părintele', firstName: null, lastName: null, phone: null, shortName: null, emailVerifiedAt: null, disabledAt: null, createdAt: '2026-01-01T00:00:00.000Z' },
  roles: [{ role: 'user', scope: 'global' }],
  sessionId: 's1', expiresAt: null, veziCa: null, poateVedeaCa: false,
}
const NIMENI = { authenticated: false, user: null, roles: [], sessionId: null, expiresAt: null, veziCa: null, poateVedeaCa: false }

const SECRET = 'secretul-platformei'

function mediu(o: { saptamani?: Rand[]; slujbe?: RandSlujbaProba[]; admin?: boolean; secret?: string | null } = {}) {
  const admin = o.admin === true
  const { stare, db } = dbFals({ saptamani: o.saptamani ?? [PUBLICATA, PROGRAMATA], slujbe: o.slujbe ?? TOATE_SLUJBELE })
  const env = {
    MEDIU: 'staging',
    ORIGINE_PUBLICA: 'https://program.staging.sfantul-ilie.ro',
    DOMENIU_COOKIE: '.staging.sfantul-ilie.ro',
    EMAIL_SUPERADMIN: 'rubikmm@gmail.com',
    ...(o.secret === null ? {} : { SECRET_INTERN: o.secret ?? SECRET }),
    DB: db,
    EVENIMENTE: { send: async () => undefined },
    CALENDAR: { fetch: async () => new Response(JSON.stringify({ versiune_calendar: '2026.9', zile: [] }), { headers: { 'content-type': 'application/json' } }) },
    TIPIC: { fetch: async () => new Response('{}') },
    BROWSER: { fetch: async () => new Response('{}') },
    MEDIA: { fetch: async () => new Response('{}') },
    AUDIT: { fetch: async () => new Response('{}') },
    COMUNICARE: { fetch: async () => new Response(JSON.stringify({ membri: [] }), { headers: { 'content-type': 'application/json' } }) },
    IDENTITATE: { fetch: async () => new Response(JSON.stringify(admin ? OMUL : NIMENI), { headers: { 'content-type': 'application/json' } }) },
    AUTORIZARE: { fetch: async () => new Response(JSON.stringify({ allowed: admin, reason: 'probă', matchedScopes: [] }), { headers: { 'content-type': 'application/json' } }) },
    CONFIG: { get: async () => null },
  }
  return { env, stare, db }
}

const ctxExec = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext

/** Ceasul serverului, fixat. ⚠️ Numai `Date`: promisiunile trebuie să curgă mai departe. */
async function laCeasul<T>(cand: string, ce: () => Promise<T> | T): Promise<T> {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(cand))
  try {
    return await ce()
  } finally {
    vi.useRealTimers()
  }
}

const cere = (env: unknown, cale: string, antete: Record<string, string> = {}) =>
  program.fetch(
    new Request(`https://program.staging.sfantul-ilie.ro${cale}`, { headers: { cookie: 'xc_sesiune=jeton-de-proba', ...antete } }),
    env as never,
    ctxExec,
  )

const CU_SECRET = { 'x-xc-intern': SECRET }

const jsonul = async (r: Response) => (await r.json()) as Record<string, unknown>

// ---------------------------------------------------------------------------
// 1. CLAUZA — una singură, și chiar în SQL
// ---------------------------------------------------------------------------

describe('clauza de vizibilitate: publicată ⟺ validată', () => {
  it('cu ochii lumii cerne pe `stare`, cu ai adminului nu cerne nimic', () => {
    expect(cerne(LUMEA)).toBe("stare = 'validat'")
    expect(cerne(VEDE_TOT)).toBe('')
    expect(cerne(LUMEA, 's.')).toBe("s.stare = 'validat'")
  })

  /** ⚠️ O slujbă se vede dacă SĂPTĂMÂNA ei se vede — altfel slujbele ar fi scăpat pe lângă. */
  it('slujbele se cern prin săptămâna lor, nu pe cont propriu', () => {
    expect(cerneSlujbe(LUMEA)).toBe("luni IN (SELECT luni FROM saptamani WHERE stare = 'validat')")
    expect(cerneSlujbe(VEDE_TOT)).toBe('')
  })

  /** ⚠️ Clauza n-are nicio legătură `?N`: e o constantă, deci nu mișcă numerele celorlalte. */
  it('clauza nu poartă niciun semn de întrebare', () => {
    expect(cerne(LUMEA)).not.toContain('?')
    expect(cerneSlujbe(LUMEA)).not.toContain('?')
  })

  it('vederea iese din `eAdmin`, nu din altceva', () => {
    expect(vedereaLui(true)).toBe(VEDE_TOT)
    expect(vedereaLui(false)).toBe(LUMEA)
  })
})

// ---------------------------------------------------------------------------
// 2. CITIRILE DEPOZITULUI — fiecare trece prin clauză
// ---------------------------------------------------------------------------

describe('citirile depozitului, cu ochii lumii', () => {
  const baza = () => dbFals({ saptamani: [PUBLICATA, PROGRAMATA], slujbe: TOATE_SLUJBELE }).db

  it('săptămâna programată nu există pentru lume, dar există pentru admin', async () => {
    const db = baza()
    expect(await saptamana(db, VIITOARE, LUMEA)).toBeNull()
    expect(await saptamana(db, VIITOARE, VEDE_TOT)).toMatchObject({ luni: VIITOARE, stare: 'propus' })
    // cea publicată se vede la amândoi
    expect(await saptamana(db, ACUM, LUMEA)).toMatchObject({ luni: ACUM, stare: 'validat' })
  })

  it('slujbele unei săptămâni nepublicate nu ies nici ele', async () => {
    const db = baza()
    expect(await slujbeleSaptamanii(db, VIITOARE, LUMEA)).toHaveLength(0)
    expect(await slujbeleSaptamanii(db, VIITOARE, VEDE_TOT)).toHaveLength(2)
    expect(await slujbeleSaptamanii(db, ACUM, LUMEA)).toHaveLength(2)
  })

  it('intervalul dă numai slujbele săptămânilor publicate', async () => {
    const db = baza()
    const lumea = await slujbeInterval(db, ACUM, '2026-10-04', LUMEA)
    expect(lumea.every((s) => s.luni === ACUM)).toBe(true)
    expect(await slujbeInterval(db, ACUM, '2026-10-04', VEDE_TOT)).toHaveLength(4)
  })

  it('și săptămânile intervalului', async () => {
    const db = baza()
    expect((await saptamaniInterval(db, ACUM, '2026-10-04', LUMEA)).map((s) => s.luni)).toEqual([ACUM])
    expect((await saptamaniInterval(db, ACUM, '2026-10-04', VEDE_TOT)).map((s) => s.luni)).toEqual([ACUM, VIITOARE])
  })

  it('arhiva: anii și rezumatele se cern la fel', async () => {
    const db = dbFals({ saptamani: [PUBLICATA, programata('2027-01-04')], slujbe: TOATE_SLUJBELE }).db
    expect(await aniiArhivei(db, LUMEA)).toEqual([2026])
    expect(await aniiArhivei(db, VEDE_TOT)).toEqual([2027, 2026])
    expect((await saptamanileAnului(db, LUMEA)).map((s) => s.luni)).toEqual([ACUM])
    expect((await saptamanileAnului(db, VEDE_TOT, 2027)).map((s) => s.luni)).toEqual(['2027-01-04'])
  })

  it('`arhivaIntreaga` (ușa mașinilor) nu scoate nici săptămâna, nici slujbele ei', async () => {
    const db = baza()
    const a = await arhivaIntreaga(db, LUMEA)
    expect(a.saptamani.map((s) => s.luni)).toEqual([ACUM])
    expect(a.slujbe.every((s) => s.luni === ACUM)).toBe(true)
    expect(JSON.stringify(a)).not.toContain(VIITOARE)
    expect((await arhivaIntreaga(db, VEDE_TOT)).saptamani).toHaveLength(2)
  })

  /**
   * ⚠️ INIMA REGULII 2, partea live: „următoarea" SARE peste slujbele săptămânilor nepublicate, nu
   * se oprește la prima ascunsă. Joi, în săptămâna publicată nu mai e nimic; pentru admin urmează
   * luni, 28 (programată), pentru lume abia săptămâna validată de după ea.
   */
  it('„următoarea slujbă" sare peste săptămânile nepublicate', async () => {
    const db = dbFals({
      saptamani: [PUBLICATA, PROGRAMATA, publicata('2026-10-05')],
      slujbe: [...TOATE_SLUJBELE, ...SLUJBE('2026-10-05')],
    }).db
    expect(await urmatoareaSlujba(db, '2026-09-24', '13:00', VEDE_TOT)).toMatchObject({ luni: VIITOARE, data: VIITOARE })
    expect(await urmatoareaSlujba(db, '2026-09-24', '13:00', LUMEA)).toMatchObject({ luni: '2026-10-05' })
  })

  it('fără nicio săptămână publicată după ea, „următoarea" e `null` pentru lume', async () => {
    const db = baza()
    expect(await urmatoareaSlujba(db, '2026-09-24', '13:00', VEDE_TOT)).not.toBeNull()
    expect(await urmatoareaSlujba(db, '2026-09-24', '13:00', LUMEA)).toBeNull()
  })

  it('„slujba în curs" (live și radio) nu pornește dintr-o săptămână nepublicată', async () => {
    const db = baza()
    expect(await slujbaCurenta(db, VIITOARE, '08:00', VEDE_TOT)).toMatchObject({ cod_nume: 'utrenia_liturghie' })
    expect(await slujbaCurenta(db, VIITOARE, '08:00', LUMEA)).toBeNull()
  })

  it('căutarea după nume și obiceiul nu spun nici ele când se face data viitoare', async () => {
    const db = baza()
    expect(await urmatoareaDupaNume(db, 'utrenia_liturghie', '2026-09-24', VEDE_TOT)).toMatchObject({ data: VIITOARE })
    expect(await urmatoareaDupaNume(db, 'utrenia_liturghie', '2026-09-24', LUMEA)).toBeNull()
    const lumea = await tiparele(db, '2026-09-24', LUMEA)
    expect(lumea.find((t) => t.cod_nume === 'utrenia_liturghie')?.urmatoarea ?? null).toBeNull()
    const adminul = await tiparele(db, '2026-09-24', VEDE_TOT)
    expect(adminul.find((t) => t.cod_nume === 'utrenia_liturghie')?.urmatoarea).toBe(VIITOARE)
  })
})

// ---------------------------------------------------------------------------
// 3. SĂPTĂMÂNA CURENTĂ = ULTIMA PUBLICATĂ
// ---------------------------------------------------------------------------

describe('„săptămâna curentă" e ultima PUBLICATĂ, nu cea calendaristică', () => {
  it('marți: curentă e săptămâna în curs, fiindcă ea e ultima publicată', async () => {
    const { db } = mediu()
    expect((await saptamanaCurenta(db, '2026-09-22'))?.luni).toBe(ACUM)
  })

  /**
   * ⚠️ CAZUL PENTRU CARE S-A FĂCUT TOATĂ LUCRAREA. Duminică la 12:00 cronul a trecut săptămâna
   * următoare pe „validat"; de la 12:05, „curentă" e EA — deși ziua de azi cade încă în săptămâna
   * care se încheie. Buletinul pe care omul tocmai l-a primit tipărește exact programul ăsta.
   */
  it('duminică după 12:00, când cronul a trecut săptămâna următoare: curentă e cea nouă', async () => {
    const { db } = dbFals({ saptamani: [PUBLICATA, TRECUTA_DE_CEAS], slujbe: TOATE_SLUJBELE })
    expect((await saptamanaCurenta(db, '2026-09-27'))?.luni).toBe(VIITOARE)
  })

  it('duminică dimineața, cât săptămâna următoare e încă doar programată: curentă rămâne cea veche', async () => {
    const { db } = mediu()
    expect((await saptamanaCurenta(db, '2026-09-27'))?.luni).toBe(ACUM)
  })

  /** ⚠️ MARGINEA: o săptămână validată din import, departe în viitor, nu are voie să fie „curentă". */
  it('o săptămână validată prea departe în viitor nu devine curentă', async () => {
    const { db } = dbFals({ saptamani: [PUBLICATA, publicata(DEPARTE)], slujbe: [] })
    expect((await saptamanaCurenta(db, '2026-09-22'))?.luni).toBe(ACUM)
  })

  it('fără nimic publicat: nicio săptămână curentă', async () => {
    const { db } = dbFals({ saptamani: [PROGRAMATA], slujbe: SLUJBE(VIITOARE) })
    expect(await saptamanaCurenta(db, '2026-09-22')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 4. PAGINILE
// ---------------------------------------------------------------------------

describe('paginile de om', () => {
  it('`/` public deschide săptămâna curentă, nu cea calendaristică', async () => {
    const { env } = mediu({ saptamani: [PUBLICATA, TRECUTA_DE_CEAS], slujbe: TOATE_SLUJBELE })
    const h = await laCeasul(DUMINICA_DUPA, async () => await (await cere(env, '/')).text())
    expect(h).toContain('28 septembrie')
    expect(h).toContain('Săptămâna curentă')
  })

  /** ⚠️ Și adminul: „adminul vede ce vede lumea, plus în plus" — nu altă săptămână curentă. */
  it('`/` la admin deschide aceeași săptămână curentă', async () => {
    const { env } = mediu({ saptamani: [PUBLICATA, TRECUTA_DE_CEAS], slujbe: TOATE_SLUJBELE, admin: true })
    const h = await laCeasul(DUMINICA_DUPA, async () => await (await cere(env, '/')).text())
    expect(h).toContain('28 septembrie')
  })

  it('`/` public, fără nimic publicat: pagină cu mesaj scurt, fără propunere', async () => {
    const { env } = mediu({ saptamani: [PROGRAMATA], slujbe: SLUJBE(VIITOARE) })
    const r = await laCeasul(MARTI, () => cere(env, '/'))
    const h = await r.text()
    expect(r.status).toBe(200)
    expect(h).toContain('Programul nu e publicat încă')
    expect(h).not.toContain('Sfântul Maslu')
    expect(h).not.toContain('class="stare propus"')
  })

  /** Adminul, în aceeași bază, are ce valida: săptămâna calendaristică, cu propunerea ei. */
  it('`/` la admin, fără nimic publicat: săptămâna calendaristică, ca până acum', async () => {
    const { env } = mediu({ saptamani: [PROGRAMATA], slujbe: SLUJBE(VIITOARE), admin: true })
    const r = await laCeasul(MARTI, () => cere(env, '/'))
    const h = await r.text()
    expect(r.status).toBe(200)
    expect(h).not.toContain('Programul nu e publicat încă')
    expect(h).toContain('21 – 27 septembrie 2026')
  })

  it('`/saptamana/<data>` public pe o săptămână nepublicată: 404, fără niciun rând din ea', async () => {
    const { env } = mediu()
    const r = await laCeasul(MARTI, () => cere(env, `/saptamana/${VIITOARE}`))
    const h = await r.text()
    expect(r.status).toBe(404)
    expect(h).toContain('Programul nu e publicat încă')
    expect(h).not.toContain('Sfântul Maslu')
  })

  it('`/saptamana/<data>` public pe una publicată: se deschide', async () => {
    const { env } = mediu()
    const r = await laCeasul(MARTI, () => cere(env, `/saptamana/${ACUM}`))
    expect(r.status).toBe(200)
    expect(await r.text()).toContain('Sfântul Maslu')
  })

  it('adminul deschide și săptămâna programată, cu eticheta ei', async () => {
    const { env } = mediu({ admin: true })
    const r = await laCeasul(MARTI, () => cere(env, `/saptamana/${VIITOARE}`))
    expect(r.status).toBe(200)
    expect(await r.text()).toContain('Programată — apare duminică, 27 septembrie 2026, la ora 12:00')
  })

  /**
   * ⚠️ SĂGEATA SE STINGE, NU SE ASCUNDE (regula rândului de unelte, 11.09.2026). Pentru enoriaș
   * săptămâna de după cea curentă nu e publicată PRIN DEFINIȚIE — curentă e ultima publicată.
   */
  it('săgeata „săptămâna viitoare": stinsă la enoriaș, vie la admin', async () => {
    const enorias = mediu()
    const h = await laCeasul(MARTI, async () => await (await cere(enorias.env, '/')).text())
    expect(h).toContain('class="btn viit gol"')
    expect(h).toContain('apare duminică, la ora 12:00')
    expect(h).not.toContain(`href="/saptamana/${VIITOARE}"`)

    const adminul = mediu({ admin: true })
    const ha = await laCeasul(MARTI, async () => await (await cere(adminul.env, '/')).text())
    expect(ha).toContain(`/saptamana/${VIITOARE}`)
    expect(ha).not.toContain('class="btn viit gol"')
  })

  it('arhiva publică ține numai săptămâni publicate; a adminului, tot', async () => {
    const enorias = mediu()
    const h = await laCeasul(MARTI, async () => await (await cere(enorias.env, '/arhiva')).text())
    expect(h).toContain(`/saptamana/${ACUM}?din=arhiva`)
    expect(h).not.toContain(`/saptamana/${VIITOARE}?din=arhiva`)

    const adminul = mediu({ admin: true })
    const ha = await laCeasul(MARTI, async () => await (await cere(adminul.env, '/arhiva')).text())
    expect(ha).toContain(`/saptamana/${VIITOARE}?din=arhiva`)
  })
})

// ---------------------------------------------------------------------------
// 5. `/v1/*` — ușa mașinilor, cu ochii lumii
// ---------------------------------------------------------------------------

describe('`/v1/*` fără antet: numai ce e publicat', () => {
  it('`/v1/saptamana/<data>` pe una programată: 404', async () => {
    const { env } = mediu()
    const r = await laCeasul(MARTI, () => cere(env, `/v1/saptamana/${VIITOARE}`))
    expect(r.status).toBe(404)
    expect(await r.text()).not.toContain('Sfântul Maslu')
  })

  it('`/v1/saptamana/<data>.txt` la fel', async () => {
    const { env } = mediu()
    expect((await laCeasul(MARTI, () => cere(env, `/v1/saptamana/${VIITOARE}.txt`))).status).toBe(404)
    expect((await laCeasul(MARTI, () => cere(env, `/v1/saptamana/${ACUM}.txt`))).status).toBe(200)
  })

  it('`/v1/zi/<data>` nu dă slujbele unei zile din săptămâna nepublicată', async () => {
    const { env } = mediu()
    const j = await jsonul(await laCeasul(MARTI, () => cere(env, `/v1/zi/${VIITOARE}`)))
    expect(j.slujbe).toEqual([])
    expect(j.stare).toBeNull()
  })

  it('`/v1/interval` nu dă nici săptămâna, nici slujbele ei', async () => {
    const { env } = mediu()
    const j = await jsonul(await laCeasul(MARTI, () => cere(env, `/v1/interval?de_la=${ACUM}&pana_la=2026-10-04`)))
    expect((j.saptamani as Array<{ de_la: string }>).map((s) => s.de_la)).toEqual([ACUM])
    expect((j.slujbe as Array<{ data: string }>).every((s) => s.data < VIITOARE)).toBe(true)
  })

  it('`/v1/saptamani` și `/v1/arhiva.json` nu scot săptămâna programată', async () => {
    const { env } = mediu()
    const s = await jsonul(await laCeasul(MARTI, () => cere(env, '/v1/saptamani')))
    expect((s.saptamani as Array<{ luni: string }>).map((x) => x.luni)).toEqual([ACUM])
    const a = await laCeasul(MARTI, () => cere(env, '/v1/arhiva.json'))
    expect(await a.text()).not.toContain(VIITOARE)
  })

  /** ⚠️ De aici cere live-ul, prin Service Binding și FĂRĂ antet. Forma rămâne neatinsă. */
  it('`/v1/urmatoarea` nu întoarce o slujbă dintr-o săptămână nepublicată', async () => {
    const { env } = mediu()
    const r = await laCeasul(JOI, () => cere(env, '/v1/urmatoarea'))
    const j = await jsonul(r)
    expect(r.status).toBe(200)
    expect(Object.keys(j)).toEqual(['acum', 'urmatoarea'])
    expect(j.urmatoarea).toBeNull()
  })

  it('`/v1/azi` și `/v1/curenta` se cern la fel', async () => {
    const { env } = mediu()
    const azi = await jsonul(await laCeasul(JOI, () => cere(env, '/v1/azi')))
    expect(azi.urmatoarea).toBeNull()
    // la 08:00 în lunea săptămânii programate s-ar sluji, dar săptămâna nu există pentru lume
    const curenta = await jsonul(await laCeasul(`${VIITOARE}T05:30:00.000Z`, () => cere(env, '/v1/curenta')))
    expect(curenta.slujba).toBeNull()
  })

  it('`/v1/cauta` nu spune nici el când se face data viitoare', async () => {
    const { env } = mediu()
    const j = await jsonul(await laCeasul(JOI, () => cere(env, '/v1/cauta?slujba=liturghie')))
    const gasite = j.gasite as Array<{ urmatoarea: unknown }>
    expect(gasite.every((g) => g.urmatoarea === null)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 6. UȘA INTERNĂ — contractul buletinului
// ---------------------------------------------------------------------------

describe('ușa internă (`x-xc-intern`)', () => {
  it('cu secretul bun, `/v1/*` se citește cu VEDE_TOT', async () => {
    const { env } = mediu()
    const r = await laCeasul(MARTI, () => cere(env, `/v1/saptamana/${VIITOARE}`, CU_SECRET))
    expect(r.status).toBe(200)
    expect((await jsonul(r)).stare).toBe('propus')
  })

  it('cu secretul greșit, ușa e închisă', async () => {
    const { env } = mediu()
    const r = await laCeasul(MARTI, () => cere(env, `/v1/saptamana/${VIITOARE}`, { 'x-xc-intern': 'altceva' }))
    expect(r.status).toBe(404)
  })

  it('fără antet, ușa e închisă', async () => {
    const { env } = mediu()
    expect((await laCeasul(MARTI, () => cere(env, `/v1/saptamana/${VIITOARE}`))).status).toBe(404)
  })

  /** ⚠️ Secret nescris în mediu = ușă ÎNCHISĂ. Mai bine tăcut închisă decât tăcut deschisă. */
  it('fără `SECRET_INTERN` în mediu, niciun antet nu deschide nimic', async () => {
    const { env } = mediu({ secret: null })
    const r = await laCeasul(MARTI, () => cere(env, `/v1/saptamana/${VIITOARE}`, CU_SECRET))
    expect(r.status).toBe(404)
  })

  it('răspunsul intern nu se ține în niciun cache', async () => {
    const { env } = mediu()
    const r = await laCeasul(MARTI, () => cere(env, `/v1/saptamana/${ACUM}`, CU_SECRET))
    expect(r.headers.get('cache-control')).toBe('private, no-store')
    const p = await laCeasul(MARTI, () => cere(env, `/v1/saptamana/${ACUM}`))
    expect(p.headers.get('cache-control')).toBe('public, max-age=300')
  })
})

describe('`/v1/tabel-tipar` — contractul buletinului', () => {
  /**
   * ⚠️ O SĂPTĂMÂNĂ PROGRAMATĂ DE UN OM CONTEAZĂ `validat`: validarea e gestul omului, publicarea e a
   * ceasului. De `stare` atârnă dacă buletinul scrie „PROPUS" pe pagina a patra — iar pe un program
   * programat de paroh n-are ce scrie. `publica` spune ce e cu adevărat afară.
   */
  it('intern, pe o săptămână programată: stare „validat", dar `publica: false`', async () => {
    const { env } = mediu()
    const j = await jsonul(await laCeasul(MARTI, () => cere(env, `/v1/tabel-tipar?data=${VIITOARE}`, CU_SECRET)))
    expect(j).toMatchObject({ ok: true, stare: 'validat', publica: false, programata: true, apare: PRAGUL, de_la: VIITOARE })
    expect(typeof j.amprenta).toBe('string')
  })

  it('intern, pe una publicată: `publica: true`, `programata: false`, `apare` = clipa validării', async () => {
    const { env } = mediu()
    const j = await jsonul(await laCeasul(MARTI, () => cere(env, `/v1/tabel-tipar?data=${ACUM}`, CU_SECRET)))
    expect(j).toMatchObject({ stare: 'validat', publica: true, programata: false, apare: `${ACUM}T09:00:00.000Z` })
  })

  it('intern, pe una doar propusă: `stare: "propus"` — buletinul scrie „PROPUS"', async () => {
    const { env } = mediu({ saptamani: [PUBLICATA, saptamanaDeProba(VIITOARE)], slujbe: TOATE_SLUJBELE })
    const j = await jsonul(await laCeasul(MARTI, () => cere(env, `/v1/tabel-tipar?data=${VIITOARE}`, CU_SECRET)))
    expect(j).toMatchObject({ stare: 'propus', publica: false, programata: false, apare: null })
  })

  it('FĂRĂ antet, pe o săptămână nepublicată: 404 `{ok:false, cod:"nepublicat"}`', async () => {
    const { env } = mediu()
    const r = await laCeasul(MARTI, () => cere(env, `/v1/tabel-tipar?data=${VIITOARE}`))
    expect(r.status).toBe(404)
    expect(await jsonul(r)).toMatchObject({ ok: false, cod: 'nepublicat', de_la: VIITOARE })
  })

  it('FĂRĂ antet, pe una publicată: tabelul iese, cu semnele pe el', async () => {
    const { env } = mediu()
    const j = await jsonul(await laCeasul(MARTI, () => cere(env, `/v1/tabel-tipar?data=${ACUM}`)))
    expect(j).toMatchObject({ ok: true, stare: 'validat', publica: true, de_la: ACUM })
  })
})

describe('`/v1/bucata-site` — prima pagină a sitului parohiei', () => {
  /**
   * ⚠️ REGULA 1, în forma în care o vede enoriașul: duminică la 12:05, `?data=azi` NU mai e
   * săptămâna în care cade ziua de azi, ci SĂPTĂMÂNA CURENTĂ — cea tocmai apărută.
   */
  it('`?data=azi` dă săptămâna CURENTĂ; duminică după 12:00, cea nouă', async () => {
    const { env } = mediu({ saptamani: [PUBLICATA, TRECUTA_DE_CEAS], slujbe: TOATE_SLUJBELE })
    const j = await jsonul(await laCeasul(DUMINICA_DUPA, () => cere(env, '/v1/bucata-site?data=azi')))
    expect(j).toMatchObject({ ok: true, de_la: VIITOARE, stare: 'validat', publica: true })
  })

  it('duminică dimineața, cât cea nouă e doar programată, rămâne cea în curs', async () => {
    const { env } = mediu()
    const j = await jsonul(await laCeasul(DUMINICA_DUPA, () => cere(env, '/v1/bucata-site?data=azi')))
    expect(j).toMatchObject({ de_la: ACUM })
  })

  it('o dată anume rămâne o dată anume: nepublicată → 404', async () => {
    const { env } = mediu()
    const r = await laCeasul(MARTI, () => cere(env, `/v1/bucata-site?data=${VIITOARE}`))
    expect(r.status).toBe(404)
    expect(await jsonul(r)).toMatchObject({ ok: false, cod: 'nepublicat' })
  })

  it('fără nimic publicat, WordPress primește 404 și rămâne cu ultima copie bună', async () => {
    const { env } = mediu({ saptamani: [PROGRAMATA], slujbe: SLUJBE(VIITOARE) })
    const r = await laCeasul(MARTI, () => cere(env, '/v1/bucata-site?data=azi'))
    expect(r.status).toBe(404)
    expect(await jsonul(r)).toMatchObject({ ok: false, cod: 'nepublicat' })
  })

  it('intern, o săptămână programată iese cu semnele pe ea', async () => {
    const { env } = mediu()
    const j = await jsonul(await laCeasul(MARTI, () => cere(env, `/v1/bucata-site?data=${VIITOARE}`, CU_SECRET)))
    expect(j).toMatchObject({ ok: true, de_la: VIITOARE, stare: 'validat', publica: false, programata: true })
  })
})
