/**
 * BULETINUL PREIA LA VALIDARE PROGRAMUL VALIDAT (user, 20.09.2026, 23:33: „Buletinul și programul
 * sunt programate D-12:00, adică atunci devin curente și publice. Public arătăm doar ce e curent.
 * Buletinul preia la momentul validării ce program era validat").
 *
 * Întrebat ce se face cu buletinul care are nevoie de program CÂT E ÎNCĂ PROPUS — refuz sau
 * propunere? —, userul (23:55): „Trebuie să putem să lucrăm și la buletin cu un program în pagină,
 * altfel nu putem calcula spațiul. Deci aș pune refuz, dar întârzierea lucrului la buletin ar fi
 * nejustificată." De aici cele DOUĂ apăsări, cu reguli deosebite, pe care le păzesc probele de aici:
 *
 *   1. COMPUNEREA merge pe orice program, și pe o propunere — dar tabelul se cere pe UȘA INTERNĂ
 *      (`x-xc-intern`), fiindcă din 20.09.2026 programul nu mai arată public decât ce e curent. Fără
 *      antet, `/nou` n-ar mai putea compune deloc săptămâna viitoare, iar 404-ul ar fi părut al
 *      programului, nu al secretului;
 *   2. VALIDAREA cere programul VALIDAT, cerut din nou în clipa apăsării: propus → refuz 409;
 *      program mut → 503, fără nicio scriere; schimbat de la compunere → se RECOMPUNE numărul, ca
 *      pagina a patra să poarte programul de acum.
 *
 * ⚠️ „Validat" înseamnă GESTUL OMULUI, nu apariția: o săptămână validată marți, programată pentru
 * duminică, trece — altfel buletinul n-ar fi putut fi validat niciodată înaintea săptămânii lui.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ANTET_SECRET } from '../packages/actiuni/src/contract.js'
import type { Buletin, StareaNumarului } from '../apps/buletin/src/depozit.js'

/** Fiecare randare își spune HTML-ul: din el se vede DACĂ s-a recompus și cu ce program. */
const randari: string[] = []

/*
 * ⚠️ Se joacă pe CALEA FIȘIERULUI, nu pe „@xc/ui" (aceeași pățanie ca la `buletin-cedari`): numele
 * pachetului nu se rezolvă din `tests/`, iar un `vi.mock` nerezolvat nu se aplică ȘI NU SE PLÂNGE —
 * proba ar chema browserul adevărat.
 */
vi.mock('../packages/ui/src/index.js', async (adevarat) => ({
  ...(await adevarat<typeof import('../packages/ui/src/index.js')>()),
  pdfCuRaportSiCoperta: async (_browser: unknown, html: string) => {
    randari.push(html)
    return { pdf: new ArrayBuffer(8), coperta: new ArrayBuffer(4), raport: { intrate: 8000, peDinafara: 0, coloaneFolosite: 7 } }
  },
}))

const buletin = (await import('../apps/buletin/src/index.js')).default
const { valideazaNumarul } = await import('../apps/buletin/src/actiuni.js')
const { calendarulNumarului, cheiaCererii, cheiaCopertei, cheiaNumarului } = await import('../apps/buletin/src/compune.js')
type CerereaPastrata = import('../apps/buletin/src/compune.js').CerereaPastrata

// ---------------------------------------------------------------------------
// Numerele și ceasul — aceleași ca la `buletin-programare`
// ---------------------------------------------------------------------------

type Rand = Buletin & { text: string; stare: StareaNumarului; publicat_la: string | null }

/** Ultimul apărut: 616, duminica trecută. Deci cel care urmează e 617 / 27.09. */
const PUBLICAT: Rand = {
  nr: 616, data: '2026-09-20', an: '2026', luna: '09',
  cheie_pdf: '2026/buletin-616-2026-09-20.pdf',
  cheie_poza: '2026/buletin-616-2026-09-20.jpg',
  cheie_poza_mica: '2026/buletin-616-2026-09-20.jpg',
  marime_pdf: 731717, pagini: 4, sursa: 'site',
  text: 'Textul numarului 616 despre rugaciune.',
  stare: 'publicat', publicat_la: '2026-09-20T09:05:00.000Z',
}

const NR = 617
const ZIUA = '2026-09-27'
/** Marți, 22 septembrie: se lucrează la 617, programul lui e săptămâna 28.09–4.10. */
const MARTI = '2026-09-22T10:00:00.000Z'
const SAPTAMANA = { de_la: '2026-09-28', pana_la: '2026-10-04', titlu: '28 sept. – 4 oct. 2026' }

// ---------------------------------------------------------------------------
// Falsurile — aceleași forme ca în `buletin-programare.test.ts`, cu programul de aici
// ---------------------------------------------------------------------------

/** D1 cât îi trebuie validării: ultimul număr din arhivă și rândul pe care ea îl scrie. */
function dbFals(randuri: Rand[]) {
  const stare = { randuri: randuri.map((r) => ({ ...r })), scrieri: 0 }
  const ordonate = (r: Rand[]) => [...r].sort((a, b) => (a.data === b.data ? b.nr - a.nr : a.data < b.data ? 1 : -1))
  const prepare = (sql: string) => {
    const s = sql.replace(/\s+/g, ' ').trim()
    const cerne = s.includes("stare = 'publicat'")
    let legat: unknown[] = []
    const vazute = (): Rand[] => (cerne ? stare.randuri.filter((r) => r.stare === 'publicat') : stare.randuri)
    const eu = {
      bind: (...a: unknown[]) => { legat = a; return eu },
      async first() {
        const v = vazute()
        if (s.includes('WHERE nr = ?1 AND data = ?2')) return v.find((r) => r.nr === legat[0] && r.data === legat[1]) ?? null
        if (s.includes('ORDER BY data DESC, nr DESC LIMIT 1')) return ordonate(v)[0] ?? null
        return null
      },
      async all() { return { results: [] } },
      async run() {
        if (s.startsWith('INSERT OR REPLACE INTO buletine')) {
          const [nr, data, an, luna, pdf, poza, pozaMica, marime, pagini, text, , starea, publicatLa] = legat as [
            number, string, string, string, string, string | null, string | null, number, number,
            string, string, StareaNumarului, string | null,
          ]
          stare.scrieri++
          stare.randuri = [
            ...stare.randuri.filter((r) => !(r.nr === nr && r.data === data)),
            {
              nr, data, an, luna, cheie_pdf: pdf, cheie_poza: poza, cheie_poza_mica: pozaMica,
              marime_pdf: marime, pagini, sursa: 'site', text, stare: starea, publicat_la: publicatLa,
            },
          ]
          return { meta: { changes: 1 } }
        }
        return { meta: { changes: 0 } }
      },
    }
    return eu
  }
  return { stare, db: { prepare } as unknown as D1Database }
}

function r2Fals(inceput: Record<string, unknown> = {}) {
  const depozit = new Map<string, unknown>(Object.entries(inceput))
  const scrieri: string[] = []
  const obiect = (cheie: string) => ({
    key: cheie, size: 731717, httpEtag: '"abc123"',
    async json() { return depozit.get(cheie) },
    async text() { return JSON.stringify(depozit.get(cheie)) },
    async arrayBuffer() { return new ArrayBuffer(8) },
    writeHttpMetadata(_h: Headers) { /* proba nu se uită la content-type */ },
    body: 'x',
  })
  const bucket = {
    async head(c: string) { return depozit.has(c) ? obiect(c) : null },
    async get(c: string) { return depozit.has(c) ? obiect(c) : null },
    async list(o?: { prefix?: string }) {
      const p = o?.prefix ?? ''
      return { objects: [...depozit.keys()].filter((k) => k.startsWith(p)).map((k) => ({ key: k })) }
    },
    async put(c: string, val: unknown) {
      scrieri.push(c)
      depozit.set(c, typeof val === 'string' ? JSON.parse(val) : val)
      return { httpEtag: '"pus"' }
    },
    async delete(c: string | string[]) { for (const k of Array.isArray(c) ? c : [c]) depozit.delete(k) },
  }
  return { depozit, scrieri, bucket: bucket as unknown as R2Bucket }
}

/**
 * PROGRAMUL, CU UȘA LUI INTERNĂ — falsul cerne chiar cum cerne aplicația `program` de pe 20.09.2026:
 * fără antetul `x-xc-intern`, o săptămână NEPUBLICATĂ nu există (404 `nepublicat`, formă plată).
 * Cu antet, răspunsul poartă semnele întregi: `stare`, `publica`, `programata`, `apare`.
 */
interface Semne {
  stare?: 'validat' | 'propus'
  publica?: boolean
  programata?: boolean
  apare?: string | null
  amprenta?: string
  /** programul nu răspunde deloc (rețea căzută) */
  mut?: boolean
}

function programFals(s: Semne = {}) {
  const cereri: Array<{ adresa: string; secret: string | null }> = []
  const fetch = async (adresa: string, init?: RequestInit) => {
    const antete = new Headers((init?.headers ?? {}) as HeadersInit)
    const secret = antete.get(ANTET_SECRET)
    cereri.push({ adresa: String(adresa), secret })
    if (s.mut) throw new Error('fetch failed')
    const stare = s.stare ?? 'validat'
    const programata = s.programata ?? false
    const publica = s.publica ?? (stare === 'validat' && !programata)
    if (!secret && !publica) {
      return new Response(
        JSON.stringify({ ok: false, cod: 'nepublicat', mesaj: 'Săptămâna nu e publicată.', ...SAPTAMANA, titlu: undefined }),
        { status: 404, headers: { 'content-type': 'application/json' } },
      )
    }
    const strans = Number(new URL(String(adresa)).searchParams.get('strans') ?? 0)
    return new Response(
      JSON.stringify({
        ok: true,
        // marcajul `data-strans` e al probei: din el se vede ce tabel a intrat în foaie
        tabel: `<table class="program" data-strans="${strans}" data-amprenta="${s.amprenta ?? 'amp-nou'}"></table>`,
        stil: '', titlu: SAPTAMANA.titlu, de_la: SAPTAMANA.de_la, pana_la: SAPTAMANA.pana_la,
        slujbe: 6, detalii: 5, strans,
        stare, publica, programata,
        apare: s.apare ?? '2026-09-27T09:00:00.000Z',
        amprenta: s.amprenta ?? 'amp-nou',
        modificat_la: '2026-09-21T08:00:00.000Z',
      }),
      { headers: { 'content-type': 'application/json' } },
    )
  }
  return { cereri, PROGRAM: { fetch } }
}

const OMUL = {
  authenticated: true,
  user: {
    id: 'u1', email: 'parintele@example.com', displayName: 'Părintele',
    firstName: null, lastName: null, phone: null, shortName: null,
    emailVerifiedAt: null, disabledAt: null, createdAt: '2026-01-01T00:00:00.000Z',
  },
  roles: [{ role: 'user', scope: 'global' }],
  sessionId: 's1', expiresAt: null, veziCa: null, poateVedeaCa: false,
}

/** Depozitul unui număr COMPUS, gata de validat — cu programul cu care s-a tipărit foaia. */
const COMPUS = (program?: CerereaPastrata['program']) => ({
  [cheiaNumarului({ nr: NR, data: ZIUA })]: null,
  [cheiaCopertei({ nr: NR, data: ZIUA })]: null,
  [cheiaCererii({ nr: NR, data: ZIUA })]: {
    motto: 'Rugăciunea este respirația sufletului.',
    nr: NR, data: ZIUA,
    principal: { autor: 'SFÂNTUL IOAN GURĂ DE AUR', titlu: 'DESPRE RUGĂCIUNE', text: 'Rândul întâi.', sursa: '-' },
    floare: true,
    ...(program ? { program } : {}),
  } satisfies CerereaPastrata,
})

function mediu(o: { semne?: Semne; depozit?: Record<string, unknown>; secret?: string | null } = {}) {
  const { stare, db } = dbFals([PUBLICAT])
  const { depozit, scrieri, bucket } = r2Fals(o.depozit ?? {})
  const { cereri, PROGRAM } = programFals(o.semne)
  const auditate: Array<{ action: string; target: string; outcome: string }> = []
  const env = {
    MEDIU: 'staging',
    ORIGINE_PUBLICA: 'https://buletin.staging.sfantul-ilie.ro',
    DOMENIU_COOKIE: '.staging.sfantul-ilie.ro',
    EMAIL_SUPERADMIN: 'rubikmm@gmail.com',
    ...(o.secret === null ? {} : { SECRET_INTERN: o.secret ?? 'secretul-platformei' }),
    DB: db,
    FISIERE: bucket,
    IDENTITATE: { fetch: async () => new Response(JSON.stringify(OMUL), { headers: { 'content-type': 'application/json' } }) },
    AUTORIZARE: {
      fetch: async () =>
        new Response(JSON.stringify({ allowed: true, reason: 'probă', matchedScopes: [] }), {
          headers: { 'content-type': 'application/json' },
        }),
    },
    AUDIT: {
      fetch: async (_a: string, init?: RequestInit) => {
        auditate.push(JSON.parse(String(init?.body ?? '{}')))
        return new Response('{}')
      },
    },
    COMUNICARE: { fetch: async () => new Response(JSON.stringify({ membri: [] }), { headers: { 'content-type': 'application/json' } }) },
    PROGRAM,
    BROWSER: { fetch: async () => new Response('{}') },
    MEDIA: { fetch: async () => new Response('nimic', { status: 404 }) },
    CONFIG: { get: async () => null },
  }
  return { env, stare, depozit, scrieri, cereri, auditate }
}

const amanate: Array<Promise<unknown>> = []
const ctxExec = {
  waitUntil: (p: Promise<unknown>) => { amanate.push(p) },
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext
const amanatele = async (): Promise<void> => { await Promise.all(amanate.splice(0)) }

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

const valideaza = (env: unknown) =>
  buletin.fetch(
    new Request('https://buletin.staging.sfantul-ilie.ro/nou', {
      method: 'POST',
      headers: {
        cookie: 'xc_sesiune=jeton-de-proba',
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'https://buletin.staging.sfantul-ilie.ro',
      },
      body: new URLSearchParams({ fapta: 'valideaza', nr: String(NR), data: ZIUA }).toString(),
    }),
    env as never,
    ctxExec,
  )

const cerereaPastrata = (depozit: Map<string, unknown>): CerereaPastrata =>
  depozit.get(cheiaCererii({ nr: NR, data: ZIUA })) as CerereaPastrata

const ecranulNou = (env: unknown) =>
  buletin.fetch(
    new Request('https://buletin.staging.sfantul-ilie.ro/nou', { headers: { cookie: 'xc_sesiune=jeton-de-proba' } }),
    env as never,
    ctxExec,
  )

beforeEach(() => {
  randari.length = 0
  amanate.length = 0
})

// ---------------------------------------------------------------------------
// 1. COMPUNEREA — tabelul se cere pe ușa internă
// ---------------------------------------------------------------------------

describe('compunerea cere tabelul pe UȘA INTERNĂ', () => {
  it('cererea către `/v1/tabel-tipar` poartă antetul `x-xc-intern` cu `SECRET_INTERN`', async () => {
    const { env, cereri } = mediu()
    const c = await calendarulNumarului(env as never, ZIUA)
    expect('eroare' in c).toBe(false)
    expect(cereri).toHaveLength(1)
    expect(cereri[0]!.secret).toBe('secretul-platformei')
    // ⚠️ și ziua cerută e a DOUA ZI după număr: programul de pe pagina a patra e al săptămânii care urmează
    expect(cereri[0]!.adresa).toContain(`data=${SAPTAMANA.de_la}`)
  })

  it('semnele ușii interne ajung în calendar: `publica`, `programata`, `apare`', async () => {
    const { env } = mediu({ semne: { stare: 'validat', programata: true, publica: false, apare: '2026-10-04T09:00:00.000Z' } })
    const c = await calendarulNumarului(env as never, ZIUA)
    expect(c).toMatchObject({ stare: 'validat', publica: false, programata: true, apare: '2026-10-04T09:00:00.000Z' })
  })

  /**
   * ⚠️ MESAJUL NUMEȘTE SECRETUL, nu „programul indisponibil". Fără antet, 404-ul `nepublicat` e
   * singurul semn că ușa internă e închisă — iar spus generic, omul ar fi căutat o zi întreagă prin
   * aplicația Programul, unde totul e la locul lui.
   */
  it('fără secret, programul refuză săptămâna nepublicată — iar mesajul spune `SECRET_INTERN`', async () => {
    const { env, cereri } = mediu({ secret: null, semne: { stare: 'propus' } })
    const c = await calendarulNumarului(env as never, ZIUA)
    expect(cereri[0]!.secret).toBeNull()
    expect(c).toMatchObject({ cod: 'nepublicat' })
    const eroare = 'eroare' in c ? c.eroare : ''
    expect(eroare).toContain('ușa internă')
    expect(eroare).toContain('SECRET_INTERN')
    expect(eroare).not.toContain('indisponibil')
  })
})

// ---------------------------------------------------------------------------
// 2. VALIDAREA — refuzul pe program nevalidat
// ---------------------------------------------------------------------------

describe('validarea refuză un număr al cărui program nu e validat', () => {
  it('program PROPUS → 409, cu vorbele userului, și NIMIC scris', async () => {
    const { env, stare, depozit, scrieri } = mediu({ semne: { stare: 'propus' }, depozit: COMPUS({ amprenta: 'amp-1' }) })
    const cate = depozit.size
    const r = await laCeasul(MARTI, () => valideazaNumarul(env as never, { nr: NR, data: ZIUA }))
    expect(r).toMatchObject({ facut: false, status: 409 })
    expect(r.facut === false && r.text).toContain(`Programul săptămânii ${SAPTAMANA.titlu} nu e validat`)
    expect(r.facut === false && r.text).toContain('Buletinul preia la validare programul validat')
    // nimic în D1, nimic în R2 — nici măcar cererea păstrată nu s-a rescris
    expect(stare.scrieri).toBe(0)
    expect(stare.randuri.some((x) => x.nr === NR)).toBe(false)
    expect(scrieri).toHaveLength(0)
    expect(depozit.size).toBe(cate)
    expect(randari).toHaveLength(0)
  })

  it('pe ecran, apăsarea primește 409, cu motivul scris în pagină', async () => {
    const { env, stare } = mediu({ semne: { stare: 'propus' }, depozit: COMPUS({ amprenta: 'amp-1' }) })
    const r = await laCeasul(MARTI, () => valideaza(env))
    await amanatele()
    expect(r.status).toBe(409)
    expect(await r.text()).toContain('nu e validat')
    expect(stare.randuri.some((x) => x.nr === NR)).toBe(false)
  })

  /**
   * ⚠️ 503, NU 409: n-am aflat că programul e nevalidat, ci că nu putem afla. Un 409 ar fi trimis
   * omul să valideze un program care poate e de mult validat, iar vina e a legăturii.
   */
  it('programul MUT (rețea) → 503, fără nicio scriere', async () => {
    const { env, stare, scrieri } = mediu({ semne: { mut: true }, depozit: COMPUS({ amprenta: 'amp-1' }) })
    const r = await laCeasul(MARTI, () => valideazaNumarul(env as never, { nr: NR, data: ZIUA }))
    expect(r).toMatchObject({ facut: false, status: 503 })
    expect(r.facut === false && r.text).toContain('Nu s-a scris nimic')
    expect(stare.scrieri).toBe(0)
    expect(scrieri).toHaveLength(0)
  })

  it('pe ecran, programul mut dă 503, nu 409', async () => {
    const { env } = mediu({ semne: { mut: true }, depozit: COMPUS({ amprenta: 'amp-1' }) })
    const r = await laCeasul(MARTI, () => valideaza(env))
    await amanatele()
    expect(r.status).toBe(503)
  })
})

// ---------------------------------------------------------------------------
// 3. VALIDAREA — programul validat, cu și fără schimbare
// ---------------------------------------------------------------------------

describe('programul e validat: se validează, iar foaia se recompune doar dacă trebuie', () => {
  it('amprentă EGALĂ — nu se recompune nimic, se validează ce e compus', async () => {
    const { env, stare } = mediu({
      semne: { stare: 'validat', amprenta: 'amp-1' },
      depozit: COMPUS({ amprenta: 'amp-1', stare: 'validat' }),
    })
    const r = await laCeasul(MARTI, () => valideazaNumarul(env as never, { nr: NR, data: ZIUA }))
    expect(r).toMatchObject({ facut: true, programat: true })
    expect(randari).toHaveLength(0)
    expect(stare.randuri.find((x) => x.nr === NR)).toMatchObject({ stare: 'programat', publicat_la: '2026-09-27T09:00:00.000Z' })
  })

  /**
   * ⚠️ SEMNELE SE ÎMPROSPĂTEAZĂ ȘI LA AMPRENTĂ EGALĂ: `publica`, `programata` și `apare` NU intră în
   * amprentă (ea e a tabelului și a stării), deci o săptămână validată marți și apărută duminică are
   * aceeași amprentă, dar altă poveste. Lângă numărul validat trebuie să rămână ce era ATUNCI.
   */
  it('amprentă egală — dar semnele programului se scriu proaspete lângă număr', async () => {
    const { env, depozit } = mediu({
      semne: { stare: 'validat', amprenta: 'amp-1', programata: true, publica: false, apare: '2026-10-04T09:00:00.000Z' },
      depozit: COMPUS({ amprenta: 'amp-1', stare: 'validat' }),
    })
    await laCeasul(MARTI, () => valideazaNumarul(env as never, { nr: NR, data: ZIUA }))
    expect(cerereaPastrata(depozit).program).toMatchObject({
      amprenta: 'amp-1', stare: 'validat', publica: false, programata: true, apare: '2026-10-04T09:00:00.000Z',
    })
  })

  /**
   * DRUMUL ZILEI, nu un caz rar: numărul se compune pe propunere (`stare` intră în amprentă), preotul
   * validează programul, apoi validează buletinul. Amprenta diferă ÎNTOTDEAUNA atunci, deci pagina a
   * patra se reface — altfel foaia ar fi ieșit pe hârtie cu programul de ieri și cu atenția „PROPUS".
   */
  it('amprentă DIFERITĂ — se recompune, iar lângă număr rămâne programul NOU', async () => {
    const { env, stare, depozit } = mediu({
      semne: { stare: 'validat', amprenta: 'amp-nou', apare: '2026-09-27T09:00:00.000Z' },
      depozit: COMPUS({ amprenta: 'amp-vechi', stare: 'propus' }),
    })
    const r = await laCeasul(MARTI, () => valideazaNumarul(env as never, { nr: NR, data: ZIUA }))
    expect(r).toMatchObject({ facut: true })
    // s-a randat din nou, iar în foaie a intrat tabelul de ACUM
    expect(randari.length).toBeGreaterThan(0)
    expect(randari.at(-1)).toContain('data-amprenta="amp-nou"')
    expect(cerereaPastrata(depozit).program).toMatchObject({ amprenta: 'amp-nou', stare: 'validat' })
    expect(stare.randuri.find((x) => x.nr === NR)?.stare).toBe('programat')
  })

  /**
   * ⚠️ AMPRENTA NECUNOSCUTĂ NU E O SCHIMBARE (regula lui `programulSaSchimbat`): un număr compus
   * înainte de 19.09.2026 n-are ce compara, iar o recompunere pornită din necunoaștere ar fi
   * înlocuit tăcut foaia pe care omul tocmai o privise.
   */
  it('cerere veche, fără amprentă — nu se recompune, dar validarea trece', async () => {
    const { env, stare } = mediu({ semne: { stare: 'validat' }, depozit: COMPUS() })
    const r = await laCeasul(MARTI, () => valideazaNumarul(env as never, { nr: NR, data: ZIUA }))
    expect(r).toMatchObject({ facut: true })
    expect(randari).toHaveLength(0)
    expect(stare.randuri.some((x) => x.nr === NR)).toBe(true)
  })

  /**
   * ⚠️ O SĂPTĂMÂNĂ PROGRAMATĂ CONTEAZĂ VALIDATĂ. Validarea e gestul omului, publicarea e a ceasului —
   * iar buletinul se validează cu zile înainte de săptămâna lui, adică exact când programul ei e
   * validat, dar încă neapărut. Refuzată aici, regula s-ar fi mușcat singură de coadă.
   */
  it('săptămână VALIDATĂ dar încă programată (nepublică) — validarea trece', async () => {
    const { env, stare } = mediu({
      semne: { stare: 'validat', programata: true, publica: false, amprenta: 'amp-1' },
      depozit: COMPUS({ amprenta: 'amp-1', stare: 'validat' }),
    })
    const r = await laCeasul(MARTI, () => valideazaNumarul(env as never, { nr: NR, data: ZIUA }))
    expect(r).toMatchObject({ facut: true, programat: true })
    expect(stare.randuri.find((x) => x.nr === NR)?.stare).toBe('programat')
  })
})

// ---------------------------------------------------------------------------
// 4. ECRANUL — refuzul se vede ÎNAINTE de apăsare
// ---------------------------------------------------------------------------

describe('`/nou`: rândul de sub butonul de validare', () => {
  /**
   * ⚠️ De ce un rând, și nu o încuietoare pe buton: compunerea pe o propunere e ÎNGĂDUITĂ (așa a
   * cerut userul, ca să se poată socoti spațiul), iar programul se poate valida între timp — chiar
   * din cealaltă fereastră. Un buton stins ar fi mințit atunci; rândul doar spune ce urmează.
   */
  it('program PROPUS — scrie „Validarea va cere programul validat."', async () => {
    const { env } = mediu({ semne: { stare: 'propus' }, depozit: COMPUS({ amprenta: 'amp-1', stare: 'propus' }) })
    const h = await laCeasul(MARTI, async () => await (await ecranulNou(env)).text())
    expect(h).toContain('value="valideaza"')
    expect(h).toContain('Validarea va cere programul validat.')
  })

  it('program VALIDAT — rândul nu se scrie', async () => {
    const { env } = mediu({ semne: { stare: 'validat' }, depozit: COMPUS({ amprenta: 'amp-1', stare: 'validat' }) })
    const h = await laCeasul(MARTI, async () => await (await ecranulNou(env)).text())
    expect(h).toContain('value="valideaza"')
    expect(h).not.toContain('Validarea va cere programul validat.')
  })
})
