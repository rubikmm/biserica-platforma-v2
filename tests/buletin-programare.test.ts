/**
 * NUMĂRUL PROGRAMAT, CU CEAS ADEVĂRAT — user, 20.09.2026, în două trepte:
 *
 *   14:0x — „dacă este înainte de ziua pentru care este programat buletinul — adică înainte de ora
 *           12.00, duminica aceea — se poate doar «Validează și programează»; dacă este duminică
 *           după ora 12.00 — «Validează și publică»."
 *   14:11 — „să fie o programare REALĂ, adică din uneltele de cron din Cloudflare."
 *
 * A doua cerere a răsturnat mecanismul: starea nu se mai DEDUCE la fiecare citire, dintr-o dată
 * pusă lângă ceas, ci se SCRIE pe rând (`stare`), iar cine o schimbă e ceasul workerului
 * (`scheduled`). De aici și lucrurile care se pot strica tăcut, fiecare cu proba lui:
 *
 *   1. **pragul**, la ora de vară și la cea de iarnă — el hotărăște ce se scrie în `publicat_la`;
 *   2. **marginea**: fix la 12:00:00 se PUBLICĂ, nu se programează;
 *   3. **cernerea pe stare**, la toate citirile. O citire uitată scoate numărul public înainte de
 *      vreme, iar nimic nu s-ar vedea până atunci;
 *   4. **ceasul**: să treacă ce trebuie, când trebuie, și să fie IDEMPOTENT — bate de 24 de ori în
 *      fiecare duminică dimineața;
 *   5. **fișierele**: pagina ascunsă nu folosește la nimic dacă PDF-ul se ia de la `/fisier/`. Și
 *      aici poarta trebuie să fie de acord cu STAREA, nu doar cu ziua;
 *   6. **`atinsa`**: semnul după care se încuie retragerea. Aprins din greșeală de nașterea
 *      implicită, ar încuia retragerea de la prima privire pe `/nou`; neaprins de o scriere a
 *      omului, ar lăsa retragerea să ȘTEARGĂ o ciornă începută.
 */
import { describe, expect, it, vi } from 'vitest'
import buletin from '../apps/buletin/src/index.js'
import { actiuniBuletin, ciornaDeDupaEInceputa, schitaPastrata, valideazaNumarul } from '../apps/buletin/src/actiuni.js'
import { ORA_APARITIEI, candApare, pragPublicarii, seProgrameaza } from '../apps/buletin/src/ceas.js'
import { cheiaCererii, cheiaCopertei, cheiaNumarului, stergeCiornaIntreaga } from '../apps/buletin/src/compune.js'
import { type Schita, cheiaSchitei } from '../apps/buletin/src/schita.js'
import { cheiaBrosurii } from '../apps/buletin/src/tipar.js'
import { type Ctx, type Meniu, paginaAcasa, paginaArhiva, paginaBuletin, paginaNou } from '../apps/buletin/src/pagini.js'
import type { Buletin, StareaNumarului } from '../apps/buletin/src/depozit.js'

// ---------------------------------------------------------------------------
// 1. PRAGUL — duminica aceea, ora 12:00 a Bucureștiului, ca și clipă
// ---------------------------------------------------------------------------

describe('pragul publicării — 12:00 la București, și vara, și iarna', () => {
  /**
   * ⚠️ CIFRELE SUNT SCRISE ÎN UTC DINADINS: dacă cineva mută socoteala pe un decalaj fix, proba
   * cade la una dintre cele două jumătăți ale anului, nu la amândouă.
   */
  it('ora de vară (EEST, +3): duminica la 12:00 e 09:00Z', () => {
    expect(pragPublicarii('2026-09-27').toISOString()).toBe('2026-09-27T09:00:00.000Z')
    expect(pragPublicarii('2026-06-07').toISOString()).toBe('2026-06-07T09:00:00.000Z')
  })

  it('ora de iarnă (EET, +2): duminica la 12:00 e 10:00Z', () => {
    expect(pragPublicarii('2026-01-04').toISOString()).toBe('2026-01-04T10:00:00.000Z')
    expect(pragPublicarii('2026-12-06').toISOString()).toBe('2026-12-06T10:00:00.000Z')
  })

  /**
   * ⚠️ CHIAR ZILELE ÎN CARE SE MUTĂ CEASUL. Se mută la 03:00/04:00 dimineața, deci prânzul e deja în
   * fusul cel nou — dar tocmai aici ar cădea o socoteală făcută cu decalajul de la miezul nopții.
   */
  it('duminica în care se trece la ora de vară (29.03.2026): prânzul e deja EEST — 09:00Z', () => {
    expect(pragPublicarii('2026-03-29').toISOString()).toBe('2026-03-29T09:00:00.000Z')
    expect(pragPublicarii('2026-03-28').toISOString()).toBe('2026-03-28T10:00:00.000Z')
  })

  it('duminica în care se trece la ora de iarnă (25.10.2026): prânzul e deja EET — 10:00Z', () => {
    expect(pragPublicarii('2026-10-25').toISOString()).toBe('2026-10-25T10:00:00.000Z')
    expect(pragPublicarii('2026-10-18').toISOString()).toBe('2026-10-18T09:00:00.000Z')
  })

  /**
   * ⚠️ FEREASTRA CRONULUI trebuie să cuprindă amândouă pragurile. Expresia din `wrangler.jsonc` e
   * `9-10` (UTC), deci ora pragului, oricând peste an, trebuie să cadă în ea. Proba merge pe toate
   * duminicile anului, ca o schimbare de fus să nu treacă neobservată.
   */
  it('toate duminicile anului cad în fereastra cronului (09:00–10:55 UTC)', () => {
    const ore = new Set<number>()
    for (let d = new Date('2026-01-04T00:00:00Z'); d.getUTCFullYear() === 2026; d.setUTCDate(d.getUTCDate() + 7)) {
      ore.add(pragPublicarii(d.toISOString().slice(0, 10)).getUTCHours())
    }
    expect([...ore].sort((a, b) => a - b)).toEqual([9, 10])
  })

  it('ora aparițiilor e una singură, luată din `ORA_APARITIEI`', () => {
    expect(ORA_APARITIEI).toBe(12)
    expect(candApare('2026-09-27')).toBe('duminică, 27 septembrie 2026, la ora 12:00')
  })
})

describe('marginea: înainte se programează, de la 12:00:00 se publică', () => {
  const PRAG = pragPublicarii('2026-09-27') // 2026-09-27T09:00:00.000Z

  it('cu o săptămână înainte — se programează', () => {
    expect(seProgrameaza('2026-09-27', new Date('2026-09-20T12:00:00.000Z'))).toBe(true)
  })

  it('cu o milisecundă înainte de 12:00 — încă se programează', () => {
    expect(seProgrameaza('2026-09-27', new Date(PRAG.getTime() - 1))).toBe(true)
  })

  /** ⚠️ FIX LA 12:00:00 SE PUBLICĂ: pragul e clipa apariției, nu clipa de dinaintea ei. */
  it('fix la 12:00:00 — se publică', () => {
    expect(seProgrameaza('2026-09-27', PRAG)).toBe(false)
  })

  it('duminică după-amiază — se publică', () => {
    expect(seProgrameaza('2026-09-27', new Date('2026-09-27T15:00:00.000Z'))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Numerele de probă
// ---------------------------------------------------------------------------

type Rand = Buletin & { text: string; stare: StareaNumarului; publicat_la: string | null }

/** Adus din arhiva parohiei (V1): n-a avut niciodată prag, și e publicat din capul locului. */
const DIN_ARHIVA: Rand = {
  nr: 615, data: '2026-09-06', an: '2026', luna: '09',
  cheie_pdf: '2026/buletin-615-2026-09-06.pdf',
  cheie_poza: null, cheie_poza_mica: null,
  marime_pdf: 700000, pagini: 4, sursa: 'arhiva',
  text: 'Textul numarului 615 despre rugaciune.',
  stare: 'publicat', publicat_la: null,
}

/** Publicat de aici, duminica lui, după 12:00. */
const PUBLICAT: Rand = {
  nr: 616, data: '2026-09-20', an: '2026', luna: '09',
  cheie_pdf: '2026/buletin-616-2026-09-20.pdf',
  cheie_poza: '2026/buletin-616-2026-09-20.jpg',
  cheie_poza_mica: '2026/buletin-616-2026-09-20.jpg',
  marime_pdf: 731717, pagini: 4, sursa: 'site',
  text: 'Textul numarului 616 despre rugaciune.',
  stare: 'publicat', publicat_la: '2026-09-20T09:05:00.000Z',
}

/** PROGRAMAT: validat marți, apare duminică la 12:00 — când îl trece CEASUL. */
const PROGRAMAT: Rand = {
  nr: 617, data: '2026-09-27', an: '2026', luna: '09',
  cheie_pdf: '2026/buletin-617-2026-09-27.pdf',
  cheie_poza: '2026/buletin-617-2026-09-27.jpg',
  cheie_poza_mica: '2026/buletin-617-2026-09-27.jpg',
  marime_pdf: 740000, pagini: 4, sursa: 'site',
  text: 'Textul numarului 617 despre rugaciune.',
  stare: 'programat', publicat_la: '2026-09-27T09:00:00.000Z',
}

/** Marți, 22 septembrie: 617 e scris în bază, dar n-a apărut. */
const MARTI = '2026-09-22T10:00:00.000Z'
/** Duminică, fix la 12:00 ora Bucureștiului. */
const PRAGUL_LUI_617 = '2026-09-27T09:00:00.000Z'

// ---------------------------------------------------------------------------
// D1 de probă — unul care CHIAR cerne, pe STARE
// ---------------------------------------------------------------------------

/**
 * ⚠️ DE CE NU UN D1 CARE RĂSPUNDE MEREU LA FEL. Toată vizibilitatea stă într-o clauză de SQL. Un
 * fals care întoarce rândurile fără să se uite la ele ar trece și dacă cernerea lipsea din jumătate
 * din interogări — SQLite nu se plânge de așa ceva, doar întoarce mai mult și tace. Aici clauza se
 * CITEȘTE din SQL și se aplică pe rânduri, deci o citire rămasă necernută cade pe loc.
 * ⚠️ Iar unde se leagă un CEAS (interogările ceasului), falsul cere o clipă ISO întreagă: cu alt
 * argument nimerit acolo, comparația ar ieși din întâmplare falsă, proba ar trece verde, și
 * greșeala s-ar vedea abia în duminica în care numărul NU apare.
 */
const CLIPA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function dbFals(randuri: Rand[]) {
  const stare = { randuri: randuri.map((r) => ({ ...r })) }
  const ordonate = (r: Rand[]) => [...r].sort((a, b) => (a.data === b.data ? b.nr - a.nr : a.data < b.data ? 1 : -1))

  const prepare = (sql: string) => {
    const s = sql.replace(/\s+/g, ' ').trim()
    const cerne = s.includes("stare = 'publicat'")
    let legat: unknown[] = []

    /** Clipa legată la `?1`, cerută întreagă — vezi lămurirea de mai sus. */
    const ceasul = (): string => {
      const x = legat[0]
      if (typeof x !== 'string' || !CLIPA.test(x)) {
        throw new Error(`ceasul se leagă la ?1, dar acolo e ${JSON.stringify(x)} — în: ${s}`)
      }
      return x
    }
    /** Rândurile pe care le vede CHEMĂTORUL acestei interogări. */
    const vazute = (): Rand[] => (cerne ? stare.randuri.filter((r) => r.stare === 'publicat') : stare.randuri)

    const eu = {
      bind: (...a: unknown[]) => {
        legat = a
        return eu
      },
      async first() {
        const v = vazute()
        if (s.startsWith('SELECT COUNT(*) AS buletine')) {
          return { buletine: v.length, ani: new Set(v.map((r) => r.an)).size, ultimul: ordonate(v)[0]?.data ?? null }
        }
        if (s.startsWith('SELECT stare FROM buletine')) {
          const r = stare.randuri.find((x) => x.nr === legat[0] && x.data === legat[1])
          return r ? { stare: r.stare } : null
        }
        if (s.includes('WHERE nr = ?1 AND data = ?2')) {
          return v.find((r) => r.nr === legat[0] && r.data === legat[1]) ?? null
        }
        if (s.startsWith('SELECT nr, data FROM buletine')) {
          const cu = ordonate(v).filter((r) => r.nr === legat[0])
          return cu[0] ? { nr: cu[0].nr, data: cu[0].data } : null
        }
        if (s.includes('data < ?2')) {
          return ordonate(v).find((r) => r.data < String(legat[1]) || (r.data === legat[1] && r.nr < Number(legat[0]))) ?? null
        }
        if (s.includes('data > ?2')) {
          return [...ordonate(v)].reverse().find((r) => r.data > String(legat[1]) || (r.data === legat[1] && r.nr > Number(legat[0]))) ?? null
        }
        if (s.includes('ORDER BY data DESC, nr DESC LIMIT 1')) return ordonate(v)[0] ?? null
        return null
      },
      async all() {
        const v = vazute()
        // interogarea CEASULUI: rândurile programate cărora le-a venit clipa
        if (s.includes("stare = 'programat'")) {
          const acum = ceasul()
          return {
            results: stare.randuri
              .filter((r) => r.stare === 'programat' && r.publicat_la !== null && r.publicat_la <= acum)
              .sort((a, b) => (a.data === b.data ? a.nr - b.nr : a.data < b.data ? -1 : 1)),
          }
        }
        if (s.includes('COUNT(*) AS cate')) {
          const ani = [...new Set(v.map((r) => r.an))].sort().reverse()
          return { results: ani.map((an) => ({ an, cate: v.filter((r) => r.an === an).length })) }
        }
        if (s.includes('AS fragment')) {
          const tipar = String(legat[1] ?? '').replace(/^%|%$/g, '')
          return {
            results: ordonate(v)
              .filter((r) => r.text.includes(tipar) || r.nr === legat[2])
              .map((r) => ({ ...r, fragment: r.text })),
          }
        }
        if (s.includes('an = ?1')) return { results: ordonate(v).filter((r) => r.an === legat[0]) }
        if (s.includes('LIMIT ?1')) return { results: ordonate(v).slice(0, Number(legat[0])) }
        return { results: [] }
      },
      async run() {
        if (s.startsWith('UPDATE buletine SET stare')) {
          const acum = ceasul()
          /*
           * ⚠️ FALSUL URMEAZĂ CLAUZELE DIN SQL, nu-și pune ale lui. Idempotența ceasului stă chiar
           * în `stare = 'programat'`, iar pragul de timp în `publicat_la <= ?1`: un fals care le-ar
           * fi pus el, de la sine, ar fi trecut verde și peste ștergerea lor din interogare — adică
           * exact peste greșeala care ar face numărul să apară cu o săptămână mai devreme.
           */
          const doarProgramate = s.includes("stare = 'programat'")
          const [pusul = '', unde = ''] = s.slice('UPDATE buletine SET '.length).split(' WHERE ')
          const pana = /publicat_la <= \?1/.test(unde)
          const dupa = /publicat_la >= \?1/.test(unde)
          // ⚠️ Și ce se PUNE se citește din SQL: dacă interogarea ar rescrie `publicat_la`, falsul o
          // rescrie și el — altfel proba „păstrează clipa anunțată" n-ar avea ce vedea.
          const rescriePragul = /publicat_la\s*=\s*\?1/.test(pusul)
          let cate = 0
          for (const r of stare.randuri) {
            if (doarProgramate && r.stare !== 'programat') continue
            if (r.publicat_la === null) continue
            if (pana && !(r.publicat_la <= acum)) continue
            if (dupa && !(r.publicat_la >= acum)) continue
            r.stare = 'publicat'
            if (rescriePragul) r.publicat_la = acum
            cate++
          }
          return { meta: { changes: cate } }
        }
        if (s.startsWith('INSERT OR REPLACE INTO buletine')) {
          const [nr, data, an, luna, pdf, poza, pozaMica, marime, pagini, text, , starea, publicatLa] = legat as [
            number, string, string, string, string, string | null, string | null, number, number,
            string, string, StareaNumarului, string | null,
          ]
          stare.randuri = [
            ...stare.randuri.filter((r) => !(r.nr === nr && r.data === data)),
            {
              nr, data, an, luna,
              cheie_pdf: pdf, cheie_poza: poza, cheie_poza_mica: pozaMica,
              marime_pdf: marime, pagini, sursa: 'site', text,
              stare: starea, publicat_la: publicatLa,
            },
          ]
          return { meta: { changes: 1 } }
        }
        if (s.startsWith('DELETE FROM buletine')) {
          const inainte = stare.randuri.length
          stare.randuri = stare.randuri.filter((r) => !(r.nr === legat[0] && r.data === legat[1] && r.sursa === 'site'))
          return { meta: { changes: inainte - stare.randuri.length } }
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
  const obiect = (cheie: string) => ({
    key: cheie,
    size: 731717,
    httpEtag: '"abc123"',
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
      depozit.set(c, typeof val === 'string' ? JSON.parse(val) : val)
      return { httpEtag: '"pus"' }
    },
    async delete(c: string | string[]) { for (const k of Array.isArray(c) ? c : [c]) depozit.delete(k) },
  }
  return { depozit, bucket: bucket as unknown as R2Bucket }
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
const NIMENI = { authenticated: false, user: null, roles: [], sessionId: null, expiresAt: null, veziCa: null, poateVedeaCa: false }

function mediu(o: { randuri?: Rand[]; depozit?: Record<string, unknown>; admin?: boolean } = {}) {
  const admin = o.admin !== false
  const { stare, db } = dbFals(o.randuri ?? [DIN_ARHIVA, PUBLICAT])
  const { depozit, bucket } = r2Fals(o.depozit ?? {})
  const auditate: Array<{ action: string; target: string; outcome: string; summary: Record<string, unknown> }> = []
  const env = {
    MEDIU: 'staging',
    ORIGINE_PUBLICA: 'https://buletin.staging.sfantul-ilie.ro',
    DOMENIU_COOKIE: '.staging.sfantul-ilie.ro',
    EMAIL_SUPERADMIN: 'rubikmm@gmail.com',
    SECRET_INTERN: 'secret',
    DB: db,
    FISIERE: bucket,
    IDENTITATE: {
      fetch: async () => new Response(JSON.stringify(admin ? OMUL : NIMENI), { headers: { 'content-type': 'application/json' } }),
    },
    AUTORIZARE: {
      fetch: async () =>
        new Response(JSON.stringify({ allowed: admin, reason: 'probă', matchedScopes: [] }), {
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
    PROGRAM: {
      fetch: async () =>
        new Response(JSON.stringify({ titlu: '28 sept. – 4 oct. 2026', slujbe: 6, detalii: 5, stare: 'validat', rânduri: [] }), {
          headers: { 'content-type': 'application/json' },
        }),
    },
    BROWSER: { fetch: async () => new Response('{}') },
    MEDIA: { fetch: async () => new Response('nimic', { status: 404 }) },
    CONFIG: { get: async () => null },
  }
  return { env, stare, depozit, auditate }
}

const amanate: Array<Promise<unknown>> = []
const ctxExec = {
  waitUntil: (p: Promise<unknown>) => { amanate.push(p) },
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext
const amanatele = async (): Promise<void> => { await Promise.all(amanate.splice(0)) }

const cere = (env: unknown, cale: string, init: RequestInit = {}) =>
  buletin.fetch(
    new Request(`https://buletin.staging.sfantul-ilie.ro${cale}`, {
      ...init,
      headers: { cookie: 'xc_sesiune=jeton-de-proba', ...(init.headers ?? {}) },
    }),
    env as never,
    ctxExec,
  )

const posteaza = (env: unknown, camp: Record<string, string>) =>
  cere(env, '/nou', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: 'https://buletin.staging.sfantul-ilie.ro',
    },
    body: new URLSearchParams(camp).toString(),
  })

const valideaza = (env: unknown, nr: number, data: string) => posteaza(env, { fapta: 'valideaza', nr: String(nr), data })
const retrage = (env: unknown, nr: number, data: string) => posteaza(env, { fapta: 'retrage', nr: String(nr), data })
const stergeCiorna = (env: unknown, nr: number, data: string) =>
  posteaza(env, { fapta: 'sterge-ciorna', nr: String(nr), data })

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

/** Ceasul WORKERULUI, bătut o dată — chiar handlerul pe care-l cheamă Cron Triggers. */
const bateCeasul = (env: unknown) =>
  buletin.scheduled!(
    { cron: '*/5 9-10 * * SUN', scheduledTime: Date.now(), noRetry: () => undefined } as never,
    env as never,
    ctxExec,
  )

/** Depozitul unui număr COMPUS, gata de validat. */
const COMPUS = (nr: number, data: string) => ({
  [cheiaNumarului({ nr, data })]: null,
  [cheiaCopertei({ nr, data })]: null,
  [cheiaCererii({ nr, data })]: {
    motto: 'Rugăciunea este respirația sufletului.',
    nr, data,
    principal: { autor: 'SFÂNTUL IOAN GURĂ DE AUR', titlu: 'DESPRE RUGĂCIUNE', text: 'Rândul întâi.', sursa: '-' },
    floare: true,
  },
})

// ---------------------------------------------------------------------------
// 2. VALIDAREA — aceeași apăsare, două stări scrise
// ---------------------------------------------------------------------------

describe('validarea scrie STAREA pe rând, nu o lasă de dedus', () => {
  it('marți — rândul intră `programat`, cu clipa apariției în `publicat_la`', async () => {
    const { env, stare, auditate } = mediu({ depozit: COMPUS(617, '2026-09-27') })
    const r = await laCeasul(MARTI, () => valideaza(env, 617, '2026-09-27'))
    await amanatele()
    expect(r.status).toBe(303)
    expect(stare.randuri.find((x) => x.nr === 617)).toMatchObject({
      stare: 'programat',
      publicat_la: PRAGUL_LUI_617,
    })
    const a = auditate.find((x) => x.action === 'buletin.valideaza')
    expect(a?.summary).toMatchObject({ fel: 'programat', publicat_la: PRAGUL_LUI_617 })
  })

  it('fix duminică la 12:00 — rândul intră `publicat`, cu clipa apăsării', async () => {
    const { env, stare, auditate } = mediu({ depozit: COMPUS(617, '2026-09-27') })
    await laCeasul(PRAGUL_LUI_617, () => valideaza(env, 617, '2026-09-27'))
    await amanatele()
    expect(stare.randuri.find((x) => x.nr === 617)).toMatchObject({
      stare: 'publicat',
      publicat_la: PRAGUL_LUI_617,
    })
    expect(auditate.find((x) => x.action === 'buletin.valideaza')?.summary).toMatchObject({ fel: 'publicat' })
  })

  it('duminică după-amiază — `publicat`, pe loc', async () => {
    const { env, stare } = mediu({ depozit: COMPUS(617, '2026-09-27') })
    await laCeasul('2026-09-27T15:30:00.000Z', () => valideaza(env, 617, '2026-09-27'))
    await amanatele()
    expect(stare.randuri.find((x) => x.nr === 617)).toMatchObject({
      stare: 'publicat',
      publicat_la: '2026-09-27T15:30:00.000Z',
    })
  })

  it('un număr necompus nu se validează, nici programat', async () => {
    const { env, stare } = mediu({ depozit: {} })
    const r = await laCeasul(MARTI, () => valideaza(env, 617, '2026-09-27'))
    expect(r.status).toBe(409)
    expect(await r.text()).toContain('numărul nu e compus')
    expect(stare.randuri.some((x) => x.nr === 617)).toBe(false)
  })

  it('funcția de server spune singură ce a făcut, în vorbele omului', async () => {
    const { env } = mediu({ depozit: COMPUS(617, '2026-09-27') })
    const r = await laCeasul(MARTI, () => valideazaNumarul(env as never, { nr: 617, data: '2026-09-27' }))
    expect(r).toMatchObject({ facut: true, programat: true })
    expect(r.facut && r.text).toContain('duminică, 27 septembrie 2026, la ora 12:00')
  })
})

// ---------------------------------------------------------------------------
// 3. CEASUL — cine trece numărul pe „publicat"
// ---------------------------------------------------------------------------

describe('ceasul workerului (`scheduled`) — programarea adevărată', () => {
  it('ÎNAINTE de prag nu trece nimic: rândul rămâne programat', async () => {
    const { env, stare, auditate } = mediu({ randuri: [DIN_ARHIVA, PUBLICAT, PROGRAMAT] })
    await laCeasul(MARTI, async () => {
      await bateCeasul(env)
      await amanatele()
    })
    expect(stare.randuri.find((x) => x.nr === 617)?.stare).toBe('programat')
    expect(auditate).toHaveLength(0)
  })

  it('cu o milisecundă înainte de 12:00 tot nu trece', async () => {
    const { env, stare } = mediu({ randuri: [DIN_ARHIVA, PUBLICAT, PROGRAMAT] })
    await laCeasul('2026-09-27T08:59:59.999Z', async () => {
      await bateCeasul(env)
      await amanatele()
    })
    expect(stare.randuri.find((x) => x.nr === 617)?.stare).toBe('programat')
  })

  it('FIX la 12:00 trece — și scrie în audit ce a apărut', async () => {
    const { env, stare, auditate } = mediu({ randuri: [DIN_ARHIVA, PUBLICAT, PROGRAMAT] })
    await laCeasul(PRAGUL_LUI_617, async () => {
      await bateCeasul(env)
      await amanatele()
    })
    expect(stare.randuri.find((x) => x.nr === 617)?.stare).toBe('publicat')
    const a = auditate.find((x) => x.action === 'buletin.publica-programat')
    expect(a?.target).toBe('617-2026-09-27')
    expect(a?.summary).toMatchObject({ publicat_la: PRAGUL_LUI_617, trecut_la: PRAGUL_LUI_617 })
  })

  /**
   * ⚠️ `publicat_la` NU SE REscrie. Ceasul bate din cinci în cinci minute, deci de obicei trece
   * numărul mai târziu decât 12:00 — dar în bază trebuie să rămână clipa ANUNȚATĂ parohiei, cea pe
   * care ecranul a scris-o pe buton. Altfel „apare la 12:00" ar fi devenit, tăcut, „a apărut la
   * 12:03", iar eticheta de pe pagină ar fi început să mintă.
   */
  it('trecut mai târziu, păstrează clipa anunțată în `publicat_la`', async () => {
    const { env, stare } = mediu({ randuri: [DIN_ARHIVA, PUBLICAT, PROGRAMAT] })
    await laCeasul('2026-09-27T09:04:37.000Z', async () => {
      await bateCeasul(env)
      await amanatele()
    })
    expect(stare.randuri.find((x) => x.nr === 617)).toMatchObject({
      stare: 'publicat',
      publicat_la: PRAGUL_LUI_617,
    })
  })

  /**
   * ⚠️ IDEMPOTENT. Ceasul bate de 24 de ori în fiecare duminică dimineața: a doua bătaie nu mai are
   * ce găsi, nu scrie nimic în D1 și nu mai pune niciun rând în audit. Fără asta, registrul
   * parohiei ar fi primit 24 de intrări „nr. 617 a apărut" pentru același număr.
   */
  it('rulat de două ori, a doua oară nu face nimic', async () => {
    const { env, stare, auditate } = mediu({ randuri: [DIN_ARHIVA, PUBLICAT, PROGRAMAT] })
    await laCeasul(PRAGUL_LUI_617, async () => {
      await bateCeasul(env)
      await amanatele()
      await bateCeasul(env)
      await bateCeasul(env)
      await amanatele()
    })
    expect(stare.randuri.filter((x) => x.stare === 'publicat')).toHaveLength(3)
    expect(auditate.filter((x) => x.action === 'buletin.publica-programat')).toHaveLength(1)
  })

  it('nu atinge numerele deja publicate și nici pe cele din arhiva V1', async () => {
    const { env, stare } = mediu({ randuri: [DIN_ARHIVA, PUBLICAT, PROGRAMAT] })
    await laCeasul(PRAGUL_LUI_617, async () => {
      await bateCeasul(env)
      await amanatele()
    })
    expect(stare.randuri.find((x) => x.nr === 615)).toMatchObject({ stare: 'publicat', publicat_la: null })
    expect(stare.randuri.find((x) => x.nr === 616)?.publicat_la).toBe('2026-09-20T09:05:00.000Z')
  })

  /** Două numere programate deodată (617 pentru duminica asta, 618 pentru cea de peste o săptămână). */
  it('trece fiecare număr la clipa LUI, nu pe toate odată', async () => {
    const AL_OPTULEA: Rand = { ...PROGRAMAT, nr: 618, data: '2026-10-04', publicat_la: '2026-10-04T09:00:00.000Z' }
    const { env, stare } = mediu({ randuri: [PUBLICAT, PROGRAMAT, AL_OPTULEA] })
    await laCeasul(PRAGUL_LUI_617, async () => {
      await bateCeasul(env)
      await amanatele()
    })
    expect(stare.randuri.find((x) => x.nr === 617)?.stare).toBe('publicat')
    expect(stare.randuri.find((x) => x.nr === 618)?.stare).toBe('programat')
  })
})

// ---------------------------------------------------------------------------
// 4. VIZIBILITATEA — cernerea pe STARE
// ---------------------------------------------------------------------------

const CU_PROGRAMAT = [DIN_ARHIVA, PUBLICAT, PROGRAMAT]

describe('numărul programat, pentru omul de rând: nicăieri', () => {
  const anonim = () => mediu({ randuri: CU_PROGRAMAT, admin: false })

  it('prima pagină arată tot numărul PUBLICAT (616)', async () => {
    const h = await (await cere(anonim().env, '/')).text()
    expect(h).toContain('Nr. 616')
    expect(h).not.toContain('617')
  })

  it('pagina lui dă 404, și adresa la îndemână `/buletin/617` la fel', async () => {
    expect((await cere(anonim().env, '/buletin/617-2026-09-27')).status).toBe(404)
    expect((await cere(anonim().env, '/buletin/617')).status).toBe(404)
  })

  it('arhiva nu-l are, iar numărătoarea nu-l socotește', async () => {
    const h = await (await cere(anonim().env, '/arhiva?an=2026')).text()
    expect(h).not.toContain('617')
    expect(h).toContain('2 numere')
  })

  it('căutarea nu-l găsește — nici după text, nici după cifră', async () => {
    expect(await (await cere(anonim().env, '/cauta?q=rugaciune')).text()).not.toContain('617')
    expect(await (await cere(anonim().env, '/cauta?q=617')).text()).not.toContain('Nr. 617')
  })

  it('`/v1/curent` dă 616, `/v1/arhiva` nu-l listează, `/v1/numar/2026/617` dă 404', async () => {
    const curent = await cere(anonim().env, '/v1/curent')
    expect((await curent.json() as { buletin: { nr: number } }).buletin.nr).toBe(616)
    const arh = await cere(anonim().env, '/v1/arhiva?an=2026')
    expect((await arh.json() as { buletine: Array<{ nr: number }> }).buletine.map((b) => b.nr)).toEqual([616, 615])
    expect((await cere(anonim().env, '/v1/numar/2026/617')).status).toBe(404)
  })

  /**
   * ⚠️ `/v1` E UȘA MAȘINILOR, deschisă, fără sesiune — deci se citește MEREU cu ochii lumii, chiar
   * dacă cel care cere e adminul. Altfel website-ul ar fi pus numărul pe prima pagină cu o
   * săptămână înainte, doar fiindcă părintele avea cookie-ul în browser.
   */
  it('`/v1/curent` nu se deschide nici pentru admin', async () => {
    const r = await cere(mediu({ randuri: CU_PROGRAMAT, admin: true }).env, '/v1/curent')
    expect((await r.json() as { buletin: { nr: number } }).buletin.nr).toBe(616)
  })

  it('`/health` nu-l numără și nu-i spune ziua', async () => {
    const r = await cere(anonim().env, '/health')
    const date = await r.json() as { date: { buletine: number; ultimul: string } }
    expect(date.date.buletine).toBe(2)
    expect(date.date.ultimul).toBe('2026-09-20')
  })

  /**
   * ⚠️ DUPĂ CE TRECE CEASUL, numărul apare de la sine — fără ca cineva să atingă vreo pagină. Asta e
   * toată deosebirea față de varianta dintâi: nu ora din cerere îl scoate la lumină, ci starea
   * scrisă pe rând.
   */
  it('după ce bate ceasul, îl vede toată lumea — pe prima pagină, în arhivă, în `/v1`', async () => {
    const { env } = mediu({ randuri: CU_PROGRAMAT, admin: false })
    await laCeasul(PRAGUL_LUI_617, async () => {
      await bateCeasul(env)
      await amanatele()
    })
    expect(await (await cere(env, '/')).text()).toContain('Nr. 617')
    expect(await (await cere(env, '/arhiva?an=2026')).text()).toContain('3 numere')
    const api = await cere(env, '/v1/curent')
    expect((await api.json() as { buletin: { nr: number } }).buletin.nr).toBe(617)
  })
})

describe('poarta fișierelor ține pasul cu STAREA, nu doar cu ziua', () => {
  const cuFoile = (admin: boolean) =>
    mediu({
      randuri: CU_PROGRAMAT,
      admin,
      depozit: {
        '2026/buletin-617-2026-09-27.pdf': null,
        '2026/buletin-617-2026-09-27.jpg': null,
        '2026/buletin-616-2026-09-20.pdf': null,
      },
    })

  it('înainte de ziua lui: foaia, coperta și broșura dau 404', async () => {
    const { env } = cuFoile(false)
    for (const cale of [
      '/fisier/2026/buletin-617-2026-09-27.pdf',
      '/fisier/2026/buletin-617-2026-09-27.jpg',
      '/tipar/617-2026-09-27.pdf',
    ]) {
      expect((await laCeasul(MARTI, () => cere(env, cale))).status, cale).toBe(404)
    }
  })

  /**
   * ⚠️ FEREASTRA DINTRE PRAG ȘI CEAS. Duminică la 12:03 ziua a venit, dar ceasul poate să nu fi
   * bătut încă (bate din cinci în cinci minute) ori să fi căzut cu totul. Pagina numărului dă în
   * continuare 404, fiindcă rândul zice `programat` — iar foaia TREBUIE să tacă la fel. Poarta
   * întreabă starea tocmai pentru clipele astea; judecată doar după zi, ar fi dat PDF-ul unui număr
   * pe care restul aplicației îl ține ascuns.
   */
  it('ziua a venit dar ceasul n-a bătut: foaia tot tace, ca pagina', async () => {
    const { env } = cuFoile(false)
    const dupaPrag = '2026-09-27T09:03:00.000Z'
    expect((await laCeasul(dupaPrag, () => cere(env, '/buletin/617-2026-09-27'))).status).toBe(404)
    expect((await laCeasul(dupaPrag, () => cere(env, '/fisier/2026/buletin-617-2026-09-27.pdf'))).status).toBe(404)
  })

  it('după ce bate ceasul, foaia se dă — și se poate tipări', async () => {
    const { env } = cuFoile(false)
    await laCeasul(PRAGUL_LUI_617, async () => {
      await bateCeasul(env)
      await amanatele()
    })
    const r = await laCeasul('2026-09-27T09:06:00.000Z', () => cere(env, '/fisier/2026/buletin-617-2026-09-27.pdf'))
    expect(r.status).toBe(200)
  })

  it('foaia unui număr apărut se dă mai departe, cu cache-ul de până acum', async () => {
    const r = await laCeasul(MARTI, () => cere(cuFoile(false).env, '/fisier/2026/buletin-616-2026-09-20.pdf'))
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toBe('public, max-age=3600')
  })

  it('adminului i se dă, dar fără niciun cache — ca să nu iasă pe la muchie', async () => {
    const r = await laCeasul(MARTI, () => cere(cuFoile(true).env, '/fisier/2026/buletin-617-2026-09-27.pdf?v=abc'))
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toBe('private, no-store')
  })

  /**
   * ⚠️ POZELE URCATE ÎN BULĂ RĂMÂN DESCHISE, și trebuie să rămână. Browser Rendering le cere de pe
   * internet, de la `ORIGINE_PUBLICA`, dintr-o sesiune FĂRĂ cookie (`adresaPozei` din `actiuni.ts`)
   * — iar numărul se compune tocmai în săptămâna dinaintea zilei lui. Cernute odată cu foaia, locul
   * pozei ar fi rămas gol în PDF la FIECARE număr, fără nicio eroare nicăieri.
   */
  it('dar POZA urcată în bulă se dă mai departe: din ea se compune foaia', async () => {
    const cheie = 'poze/617-2026-09-27/sfantul-0f1e2d.jpg'
    const { env } = mediu({ randuri: CU_PROGRAMAT, admin: false, depozit: { [cheie]: null } })
    expect((await laCeasul(MARTI, () => cere(env, `/fisier/${cheie}`))).status).toBe(200)
  })
})

describe('pentru adminul buletinului, numărul programat se vede — și scrie de ce', () => {
  const caAdmin = () => mediu({ randuri: CU_PROGRAMAT, admin: true })

  it('e numărul curent pe prima pagină, cu eticheta „Programat"', async () => {
    const h = await (await cere(caAdmin().env, '/')).text()
    expect(h).toContain('Nr. 617')
    expect(h).toContain('Programat — apare duminică, 27 septembrie 2026, la ora 12:00')
  })

  it('pagina lui se deschide, poartă eticheta și nu se ține în niciun cache', async () => {
    const r = await cere(caAdmin().env, '/buletin/617-2026-09-27')
    expect(r.status).toBe(200)
    expect(await r.text()).toContain('Programat — apare duminică, 27 septembrie 2026, la ora 12:00')
    expect(r.headers.get('cache-control')).toBe('private, no-store')
  })

  it('îl vede în arhivă, cu semnul lui în raft', async () => {
    const h = await (await cere(caAdmin().env, '/arhiva?an=2026')).text()
    expect(h).toContain('3 numere')
    expect(h).toContain('fisa-programat')
  })

  it('`/nou` propune 618 și spune sus unde s-a dus 617', async () => {
    const h = await laCeasul(MARTI, async () => await (await cere(caAdmin().env, '/nou')).text())
    expect(h).toContain('Nr. 618')
    expect(h).toContain('Nr. 617 e programat pentru duminică, 27 septembrie 2026, la ora 12:00')
    expect(h).toContain('href="/buletin/617-2026-09-27"')
  })

  /** Răspunsul la întrebarea rămasă din runda dintâi: două programate deodată se scriu AMÂNDOUĂ. */
  it('două numere programate deodată: câte un rând pentru fiecare', async () => {
    const AL_OPTULEA: Rand = { ...PROGRAMAT, nr: 618, data: '2026-10-04', publicat_la: '2026-10-04T09:00:00.000Z' }
    const { env } = mediu({ randuri: [PUBLICAT, PROGRAMAT, AL_OPTULEA], admin: true })
    const h = await laCeasul(MARTI, async () => await (await cere(env, '/nou')).text())
    expect(h).toContain('Nr. 617 e programat pentru duminică, 27 septembrie 2026')
    expect(h).toContain('Nr. 618 e programat pentru duminică, 4 octombrie 2026')
  })

  it('după ce ceasul l-a trecut, rândul de sus nu se mai scrie', async () => {
    const { env } = caAdmin()
    await laCeasul(PRAGUL_LUI_617, async () => {
      await bateCeasul(env)
      await amanatele()
    })
    const h = await laCeasul('2026-09-27T15:00:00.000Z', async () => await (await cere(env, '/nou')).text())
    expect(h).not.toContain('e programat pentru')
  })
})

// ---------------------------------------------------------------------------
// 5. ICONIȚA DE ANULARE, VERDE CÂT E PROGRAMAT
// ---------------------------------------------------------------------------

const CTX: Ctx = {
  prefix: '/buletin',
  nav: { home: '', cont: '/cont', admin: '/admin' } as Ctx['nav'],
  utilizator: 'Părintele',
  eAdmin: true,
  versiune: '0.17.0',
  modificata: '20.09.2026',
}

describe('iconița de Anulare e VERDE cât timp numărul e programat', () => {
  const butonul = (h: string) => h.match(/<button[^>]*id="b-retrage"[^>]*>([\s\S]*?)<\/button>/)

  it('pe numărul programat: clasa verde, și numai simbolul înăuntru', () => {
    const b = butonul(paginaBuletin(CTX, { peEcran: PROGRAMAT, acum: true }, PROGRAMAT))
    expect(b, 'butonul #b-retrage trebuie să fie în pagină').not.toBeNull()
    expect(b![0]).toContain('class="btn intreg verde"')
    // ⚠️ DOAR SIMBOLUL: scos SVG-ul, nu mai rămâne niciun cuvânt scris pe buton
    expect(b![1]!.replace(/<svg[\s\S]*?<\/svg>/g, '').trim()).toBe('')
    expect(b![0]).toContain('Anulează programarea nr. 617')
  })

  it('pe numărul publicat: fără verde, cu vorba de până acum', () => {
    const b = butonul(paginaBuletin(CTX, { peEcran: PUBLICAT, acum: true }, PUBLICAT))
    expect(b![0]).toContain('class="btn intreg"')
    expect(b![0]).not.toContain('verde')
    expect(b![0]).toContain('Retrage numărul din arhivă')
  })

  it('după ce ceasul îl trece pe publicat, verdele dispare singur', () => {
    const trecut = { ...PROGRAMAT, stare: 'publicat' as StareaNumarului }
    expect(butonul(paginaBuletin(CTX, { peEcran: trecut, acum: true }, trecut))![0]).not.toContain('verde')
  })
})

describe('eticheta „Programat" se scrie numai unde are ce spune', () => {
  it('pe pagina numărului programat, da; pe a unuia apărut, nu', () => {
    expect(paginaBuletin(CTX, { peEcran: PROGRAMAT, acum: true }, PROGRAMAT)).toContain(
      'Programat — apare duminică, 27 septembrie 2026',
    )
    expect(paginaBuletin(CTX, { peEcran: PUBLICAT, acum: true }, PUBLICAT)).not.toContain('Programat — apare')
    expect(paginaBuletin(CTX, { peEcran: DIN_ARHIVA }, DIN_ARHIVA)).not.toContain('Programat — apare')
  })

  it('în raftul arhivei și în fâșia „Numerele dinainte" se scrie strâns', () => {
    expect(paginaArhiva(CTX, { arhiva: true }, '2026', [PROGRAMAT, PUBLICAT], 3)).toContain('fisa-programat')
    expect(paginaAcasa(CTX, { peEcran: PUBLICAT, acum: true }, PUBLICAT, [PROGRAMAT])).toContain('fisa-programat')
  })
})

// ---------------------------------------------------------------------------
// 6. BUTONUL DE VALIDARE — două scrisuri, unul singur pe ecran
// ---------------------------------------------------------------------------

const MENIU: Meniu = { nou: true, ani: ['2026'] }
const CIORNA = {
  facut: true,
  cheie: '2026/buletin-617-2026-09-27.pdf',
  cheiePoza: '2026/buletin-617-2026-09-27.jpg',
  versiune: 'abc',
  marime: 740000,
  plangeri: [],
}

describe('butonul de validare spune ce face, după ceasul serverului', () => {
  it('înainte de duminică: „Validează și programează", cu ziua apariției sub el', () => {
    const h = paginaNou(CTX, MENIU, { nr: 617, data: '2026-09-27' }, { raspuns: CIORNA, acum: MARTI })
    expect(h).toContain('Validează și programează nr. 617')
    expect(h).not.toContain('Validează și publică')
    expect(h).toContain('Numărul apare duminică, 27 septembrie 2026, la ora 12:00.')
  })

  it('de la 12:00: „Validează și publică", cu nota de până acum', () => {
    const h = paginaNou(CTX, MENIU, { nr: 617, data: '2026-09-27' }, { raspuns: CIORNA, acum: PRAGUL_LUI_617 })
    expect(h).toContain('Validează și publică nr. 617')
    expect(h).not.toContain('Validează și programează')
    expect(h).toContain('numărul intră în arhivă și devine numărul curent al parohiei')
  })

  it('cu o clipă înainte de 12:00 tot programează', () => {
    const h = paginaNou(CTX, MENIU, { nr: 617, data: '2026-09-27' }, { raspuns: CIORNA, acum: '2026-09-27T08:59:59.999Z' })
    expect(h).toContain('Validează și programează nr. 617')
  })

  /** Iarna pragul e 10:00Z: la 09:30Z încă se programează, deși vara ar fi fost publicat. */
  it('iarna pragul e cu o oră mai târziu în UTC', () => {
    const iarna = { nr: 700, data: '2026-12-06' }
    expect(paginaNou(CTX, MENIU, iarna, { raspuns: CIORNA, acum: '2026-12-06T09:30:00.000Z' })).toContain(
      'Validează și programează nr. 700',
    )
    expect(paginaNou(CTX, MENIU, iarna, { raspuns: CIORNA, acum: '2026-12-06T10:00:00.000Z' })).toContain(
      'Validează și publică nr. 700',
    )
  })
})

// ---------------------------------------------------------------------------
// 7. `atinsa` — semnul după care se încuie retragerea
// ---------------------------------------------------------------------------

const actiunea = (nume: string) => {
  const a = actiuniBuletin.find((x) => x.nume === nume)
  if (!a) throw new Error(`nu există acțiunea ${nume}`)
  return a
}
const ctxActiune = (env: unknown) => ({
  env,
  actor: { fel: 'utilizator' as const, principal: { userId: 'u1', email: 'p@example.com' } },
  correlationId: 'probă',
  ctxExec,
  prin: 'chat',
})

/** Schița de pe masa de lucru, așa cum stă în depozit. */
const dePeMasa = (depozit: Map<string, unknown>, nr: number, data: string): Schita | undefined =>
  depozit.get(cheiaSchitei({ nr, data })) as Schita | undefined

describe('„a început lucrul la ciornă" — ce aprinde semnul și ce nu', () => {
  /**
   * ⚠️ NAȘTEREA IMPLICITĂ NU E LUCRU ÎNCEPUT. Schița se scrie singură la prima intrare pe `/nou`,
   * cu locurile ocupate, ca numărul să se poată compune din prima clipă. Dacă simpla ei existență
   * ar aprinde semnul, retragerea numărului dinainte s-ar încuia chiar în clipa în care omul
   * deschide ecranul ca să vadă ce a greșit.
   */
  it('varianta zero, născută singură la prima intrare pe `/nou`: NEATINSĂ', async () => {
    const { env, depozit } = mediu({ randuri: [DIN_ARHIVA, PUBLICAT] })
    await laCeasul(MARTI, () => schitaPastrata(env as never))
    const s = dePeMasa(depozit, 617, '2026-09-27')
    expect(s, 'schița implicită trebuie să fie scrisă în depozit').toBeTruthy()
    expect(s!.atinsa).toBeUndefined()
  })

  it('„unde am rămas?" (`buletin.chestionar`) nu o atinge nici el', async () => {
    const { env, depozit } = mediu({ randuri: [DIN_ARHIVA, PUBLICAT] })
    await laCeasul(MARTI, () => actiunea('buletin.chestionar').executa({} as never, ctxActiune(env) as never))
    expect(dePeMasa(depozit, 617, '2026-09-27')?.atinsa).toBeUndefined()
  })

  it('un răspuns al omului (`buletin.raspunde`) o ATINGE', async () => {
    const { env, depozit } = mediu({ randuri: [DIN_ARHIVA, PUBLICAT] })
    await laCeasul(MARTI, () =>
      actiunea('buletin.raspunde').executa(
        { subiect: 'titlu', valoare: 'DESPRE RUGĂCIUNE' } as never,
        ctxActiune(env) as never,
      ),
    )
    expect(dePeMasa(depozit, 617, '2026-09-27')?.atinsa).toBe(true)
  })

  /** ⚠️ Odată aprins, nu se mai stinge de la o scriere „de sistem" venită după. */
  it('o scriere de sistem de după nu stinge semnul', async () => {
    const { env, depozit } = mediu({ randuri: [DIN_ARHIVA, PUBLICAT] })
    await laCeasul(MARTI, async () => {
      await actiunea('buletin.raspunde').executa({ subiect: 'titlu', valoare: 'X' } as never, ctxActiune(env) as never)
      await actiunea('buletin.chestionar').executa({} as never, ctxActiune(env) as never)
    })
    expect(dePeMasa(depozit, 617, '2026-09-27')?.atinsa).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 8. ÎNCUIETOAREA RETRAGERII
// ---------------------------------------------------------------------------

const SCHITA_ATINSA = (nr: number, data: string): Schita => ({
  nr, data,
  principal: { titlu: 'CEVA SCRIS DE OM', text: 'Rânduri strânse cu mâna.', gata: ['text', 'titlu'] },
  secundari: [],
  gata: ['motto'],
  atinsa: true,
  actualizat: '2026-09-21T10:00:00.000Z',
})

const SCHITA_NEATINSA = (nr: number, data: string): Schita => ({
  nr, data,
  principal: {},
  secundari: [],
  gata: [],
  actualizat: '2026-09-21T10:00:00.000Z',
})

const CHEIA_617 = cheiaSchitei({ nr: 617, data: '2026-09-27' })

describe('retragerea se încuie când s-a început ciorna următoare', () => {
  it('cu ciorna lui 617 NEÎNCEPUTĂ, „Retrage" se vede pe 616', async () => {
    const { env } = mediu({
      randuri: [DIN_ARHIVA, PUBLICAT],
      depozit: { [CHEIA_617]: SCHITA_NEATINSA(617, '2026-09-27') },
    })
    expect(await (await cere(env, '/')).text()).toContain('id="b-retrage"')
  })

  it('cu ciorna lui 617 ÎNCEPUTĂ, butonul nu se mai scrie', async () => {
    const { env } = mediu({
      randuri: [DIN_ARHIVA, PUBLICAT],
      depozit: { [CHEIA_617]: SCHITA_ATINSA(617, '2026-09-27') },
    })
    expect(await (await cere(env, '/')).text()).not.toContain('id="b-retrage"')
    expect(await (await cere(env, '/buletin/616-2026-09-20')).text()).not.toContain('id="b-retrage"')
  })

  /** ⚠️ Poarta e a UȘII, nu a butonului: o apăsare venită din altă parte primește același refuz. */
  it('apăsarea tot pică, cu refuz limpede și 409', async () => {
    const { env, stare } = mediu({
      randuri: [DIN_ARHIVA, PUBLICAT],
      depozit: { [CHEIA_617]: SCHITA_ATINSA(617, '2026-09-27') },
    })
    const r = await retrage(env, 616, '2026-09-20')
    expect(r.status).toBe(409)
    const h = await r.text()
    expect(h).toContain('ciorna nr. 617 e începută')
    expect(h).toContain('Șterge ciorna')
    expect(stare.randuri.map((x) => x.nr)).toEqual([615, 616])
  })

  /**
   * ⚠️ O CIORNĂ NEATINSĂ SE ȘTERGE LA RETRAGERE. Altfel ar rămâne pe masă lângă schița întoarsă a
   * numărului retras, iar `/nou` s-ar deschide pe ziua cea mai veche — adică pe numărul retras —,
   * lăsând varianta zero a celuilalt agățată în depozit, gata să se arate a doua oară.
   */
  it('retragerea șterge ciorna neîncepută a numărului următor', async () => {
    const { env, depozit } = mediu({
      randuri: [DIN_ARHIVA, PUBLICAT],
      depozit: {
        [CHEIA_617]: SCHITA_NEATINSA(617, '2026-09-27'),
        [cheiaCererii({ nr: 616, data: '2026-09-20' })]: { nr: 616, data: '2026-09-20', principal: {} },
      },
    })
    expect((await retrage(env, 616, '2026-09-20')).status).toBe(303)
    expect(depozit.has(CHEIA_617)).toBe(false)
    // …iar 616 s-a întors pe masă, ÎNSEMNAT, ca a doua retragere să nu-l poată șterge
    expect(dePeMasa(depozit, 616, '2026-09-20')?.atinsa).toBe(true)
  })

  /**
   * DRUMUL ÎNTREG al încuietorii: se retrage 616, schița lui se întoarce — și de acum 615 NU se mai
   * poate retrage, fiindcă asta ar șterge tocmai ce s-a recuperat.
   */
  it('după o retragere, a doua e încuiată de schița întoarsă', async () => {
    const { env } = mediu({
      randuri: [DIN_ARHIVA, PUBLICAT],
      depozit: { [cheiaCererii({ nr: 616, data: '2026-09-20' })]: { nr: 616, data: '2026-09-20', principal: {} } },
    })
    expect((await retrage(env, 616, '2026-09-20')).status).toBe(303)
    expect((await retrage(env, 615, '2026-09-06')).status).toBe(409)
  })

  it('funcția de ecran și ușa cântăresc la fel', async () => {
    const cuAtinsa = mediu({
      randuri: [DIN_ARHIVA, PUBLICAT],
      depozit: { [CHEIA_617]: SCHITA_ATINSA(617, '2026-09-27') },
    })
    expect(await ciornaDeDupaEInceputa(cuAtinsa.env as never, PUBLICAT)).toBe(true)
    const curata = mediu({ randuri: [DIN_ARHIVA, PUBLICAT] })
    expect(await ciornaDeDupaEInceputa(curata.env as never, PUBLICAT)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 9. „ȘTERGE CIORNA" — resetarea completă la zero
// ---------------------------------------------------------------------------

describe('„Șterge ciorna" — resetare completă la zero', () => {
  const cuCiornaInceputa = () =>
    mediu({
      randuri: [DIN_ARHIVA, PUBLICAT],
      depozit: { [CHEIA_617]: SCHITA_ATINSA(617, '2026-09-27'), ...COMPUS(617, '2026-09-27') },
    })

  it('butonul și fereastra lui se scriu pe `/nou` când e ceva de șters', async () => {
    const h = await laCeasul(MARTI, async () => await (await cere(cuCiornaInceputa().env, '/nou')).text())
    expect(h).toContain('id="b-sterge-ciorna"')
    expect(h).toContain('<dialog class="modal" id="d-sterge-ciorna"')
    expect(h).toContain('<input type="hidden" name="fapta" value="sterge-ciorna">')
    expect(h).toContain('Resetare completă la zero')
  })

  it('iese TOT ce ține de ciornă: schița, foaia, coperta, cererea și broșurile', async () => {
    const { env, depozit } = cuCiornaInceputa()
    const foaia = cheiaNumarului({ nr: 617, data: '2026-09-27' })
    depozit.set(cheiaBrosurii(foaia, 'a4', false), null)
    const r = await laCeasul(MARTI, () => stergeCiorna(env, 617, '2026-09-27'))
    await amanatele()
    expect(r.status).toBe(303)
    for (const cheie of [
      CHEIA_617,
      foaia,
      cheiaCopertei({ nr: 617, data: '2026-09-27' }),
      cheiaCererii({ nr: 617, data: '2026-09-27' }),
      cheiaBrosurii(foaia, 'a4', false),
    ]) {
      expect(depozit.has(cheie), cheie).toBe(false)
    }
  })

  /**
   * ⚠️ NU ÎNAPOI PE `/nou`: acolo varianta zero se naște din nou la prima privire, deci ștergerea ar
   * fi părut că n-a făcut nimic. Omul se duce la pagina numărului curent — acolo îl așteaptă chiar
   * butonul pentru care a făcut resetarea.
   */
  it('duce la pagina numărului curent, unde „Retrage" e din nou vizibil', async () => {
    const { env } = cuCiornaInceputa()
    const r = await laCeasul(MARTI, () => stergeCiorna(env, 617, '2026-09-27'))
    expect(r.status).toBe(303)
    expect(r.headers.get('location')).toBe('/buletin/616-2026-09-20')
    expect(await (await cere(env, '/')).text()).toContain('id="b-retrage"')
  })

  it('scrie în audit ce s-a aruncat', async () => {
    const { env, auditate } = cuCiornaInceputa()
    await laCeasul(MARTI, () => stergeCiorna(env, 617, '2026-09-27'))
    await amanatele()
    const a = auditate.find((x) => x.action === 'buletin.sterge-ciorna')
    expect(a?.target).toBe('617-2026-09-27')
    expect(a?.summary).toMatchObject({ atinsa: true })
  })

  it('nu atinge numerele din arhivă', async () => {
    const { env, stare } = cuCiornaInceputa()
    await laCeasul(MARTI, () => stergeCiorna(env, 617, '2026-09-27'))
    expect(stare.randuri.map((x) => x.nr)).toEqual([615, 616])
  })

  /**
   * ⚠️ ÎNCUIETOAREA DE DEDESUBT: un număr care are RÂND în arhivă nu e ciornă, ci un număr al
   * parohiei — și nimic nu se șterge, oricine ar cere.
   *
   * ⚠️ Se probează la FUNCȚIE, nu prin rută, și dinadins: prin rută nu se ajunge aici, fiindcă
   * verificarea „ce e pe ecran" cade mai devreme — validat între timp, numărul de pe ecran nu mai
   * e cel care urmează, iar ușa spune asta. Tocmai de aceea încuietoarea are nevoie de proba ei:
   * altfel ar fi cod pe care nimic nu-l ține în frâu, și care s-ar putea strica fără să se vadă.
   */
  it('un număr care are rând în arhivă nu se șterge, oricine ar cere', async () => {
    const { env, depozit } = mediu({ depozit: { ...COMPUS(617, '2026-09-27') } })
    const r = await stergeCiornaIntreaga(env as never, { nr: 617, data: '2026-09-27' }, true)
    expect(r.sters).toBe(false)
    expect(r.motiv).toContain('are deja rând în arhivă')
    expect(depozit.has(cheiaNumarului({ nr: 617, data: '2026-09-27' }))).toBe(true)
  })

  /**
   * …iar prin rută, aceeași apăsare primește refuzul care i se potrivește: nu „nu e ciornă", ci
   * „ecranul tău nu mai e cel de acum". Cele două refuzuri nu se calcă.
   */
  it('validat între timp, apăsarea spune că ecranul e vechi', async () => {
    const { env, depozit } = mediu({
      randuri: [DIN_ARHIVA, PUBLICAT, PROGRAMAT],
      depozit: { ...COMPUS(617, '2026-09-27') },
    })
    const r = await laCeasul(MARTI, () => stergeCiorna(env, 617, '2026-09-27'))
    expect(r.status).toBe(409)
    expect(await r.text()).toContain('nu mai e cea de acum')
    expect(depozit.has(cheiaNumarului({ nr: 617, data: '2026-09-27' }))).toBe(true)
  })

  it('ce e pe ecran se cântărește: o cerere pentru alt număr nu șterge ciorna de acum', async () => {
    const { env, depozit } = cuCiornaInceputa()
    const r = await laCeasul(MARTI, () => stergeCiorna(env, 618, '2026-10-04'))
    expect(r.status).toBe(409)
    expect(depozit.has(CHEIA_617)).toBe(true)
  })
})
