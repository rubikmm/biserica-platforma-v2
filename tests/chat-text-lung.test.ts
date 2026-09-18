/**
 * TEXTUL LUNG LIPIT ÎN BULĂ (user, 18.09.2026, 23:55: „a lipit textul mare al articolului și stă
 * foarte mult").
 *
 * Ce s-a întâmplat, citit din D1 (discuția `93cc78ab…`, 20:50): omul a lipit 9108 semne la întrebarea
 * „Care este textul principal din acest buletin?". Textul a plecat întreg la un model mic și gratuit
 * (glm-5.3-flash), căruia îi rămânea să-l scrie ÎNAPOI, literă cu literă, ca argument al lui
 * `buletin.raspunde`. Niciun mesaj al agentului n-a mai fost scris: lucrul a murit la mijloc, iar omul
 * a rămas cu „mă gândesc…".
 *
 * Deci două lucruri se probează aici, fiindcă două lucruri lipseau:
 *   1. **textul greu nu mai trece prin model** — cârligul `laText` îl dă aplicației, iar în discuție
 *      intră o frază. Fără proba asta, o rescriere a rutei ar putea să-l pună tăcut la loc în context;
 *   2. **un apel de model care atârnă e tăiat de un ceas** — `env.AI.run` nu primește `AbortSignal`,
 *      iar bugetul mesajului se cântărește doar între pașii buclei. Fără ceas, boala nu se vede ca
 *      eroare, ci ca TĂCERE: nimic scris nicăieri, ceea ce e mult mai greu de găsit a doua oară.
 */
import { describe, expect, it } from 'vitest'
import buletin from '../apps/buletin/src/index.js'
import { buletinulNou } from '../apps/buletin/src/pagini.js'
import { cheiaSchitei, type Schita } from '../apps/buletin/src/schita.js'
import { JS_CHAT } from '../packages/chat/src/bula.js'
import { modulChat, uitaConfigChat } from '../packages/chat/src/index.js'
import { cuCeas, intreabaModelul, type MesajModel } from '../services/chat-worker/src/creier.js'

const ctxExec = { waitUntil: () => undefined, passThroughOnException: () => undefined } as unknown as ExecutionContext

const CONFIG_PORNIT = {
  activ: true,
  aplicatii: { program: true, buletin: true },
  cineVede: 'admini',
  model: '@cf/zai-org/glm-5.3-flash',
  creier: 'workers-ai',
  indrumari: '',
  unelte: [] as string[],
}

function kvFals(date: Record<string, unknown>) {
  return {
    async get(cheie: string, fel?: string) {
      if (!(cheie in date)) return null
      const v = date[cheie]
      return fel === 'json' ? v : JSON.stringify(v)
    },
    async put() {},
    async delete() {},
  } as unknown as KVNamespace
}

/** Articolul de pe pagina întâi, cât e el în viață: vreo nouă mii de semne. */
const ARTICOL_LUNG =
  'Lucrarea lui de preot, de păstor de suflete și-a început-o în Mănăstirea Antim din București. '.repeat(100)

// ---------------------------------------------------------------------------
// Cârligul `laText` din modul, cu un creier de probă care ține minte ce a primit
// ---------------------------------------------------------------------------

describe('`laText`: ce ajunge la creier când aplicația ia textul în primire', () => {
  /** Creierul de probă: nu răspunde nimic, doar scrie ce i s-a cerut. */
  function mediu() {
    const primite: Array<{ cale: string; corp: Record<string, unknown> }> = []
    const env = {
      MEDIU: 'staging',
      SECRET_INTERN: 'secret',
      CONFIG: kvFals({ 'modul:chat': CONFIG_PORNIT }),
      CHAT: {
        fetch: async (adresa: string, init?: RequestInit) => {
          const cale = new URL(adresa).pathname
          primite.push({ cale, corp: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> })
          return new Response(JSON.stringify({ conversatieId: 'c1', mesajId: 'm1', inLucru: true }), {
            headers: { 'content-type': 'application/json' },
          })
        },
      } as unknown as Fetcher,
    } as never
    return { env, primite }
  }

  const CTX = {
    prefix: '',
    principal: { userId: 'u1', email: 'p@example.ro', roles: [] } as never,
    numeleOmului: 'Părintele',
    eAdmin: true,
  }

  const trimite = (modul: ReturnType<typeof modulChat>, env: unknown, text: string) =>
    modul.ruteaza(
      new Request('https://buletin.test/chat/mesaj', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, conversatieId: null }),
      }),
      env as never,
      ctxExec,
      '/chat/mesaj',
      CTX,
    )

  it('textul greu NU mai ajunge la model: în locul lui pleacă fraza aplicației', async () => {
    uitaConfigChat()
    const { env, primite } = mediu()
    const vazut: string[] = []
    const modul = modulChat({
      aplicatie: 'buletin',
      async laText(text) {
        vazut.push(text)
        return { mesaj: 'Am pus textul (9 108 de semne) ca textul articolului principal.', unelte: ['buletin.raspunde'] }
      },
    })

    const r = await trimite(modul, env, ARTICOL_LUNG)
    const j = (await r!.json()) as { inLucru: boolean; nota?: string; unelte?: string[] }

    // cârligul a văzut textul întreg, literă cu literă
    expect(vazut).toHaveLength(1)
    expect(vazut[0]).toBe(ARTICOL_LUNG)

    // ⚠️ MIEZUL: la creier au plecat DOUĂ cereri (`/mesaj` și `/lucreaza`) și NICIUNA n-a cărat textul
    expect(primite.map((p) => p.cale)).toEqual(['/mesaj', '/lucreaza'])
    for (const p of primite) {
      expect(String(p.corp.text ?? '')).not.toContain('Mănăstirea Antim')
    }
    expect(primite[0]!.corp.text).toBe('Am pus textul (9 108 de semne) ca textul articolului principal.')

    // vestea pentru ecranul de dedesubt pleacă ACUM, nu la răspunsul modelului
    expect(j.inLucru).toBe(true)
    expect(j.unelte).toEqual(['buletin.raspunde'])
    expect(j.nota).toContain('Am pus textul')
  })

  it('cârligul care se dă la o parte (`null`) lasă textul neatins', async () => {
    uitaConfigChat()
    const { env, primite } = mediu()
    const modul = modulChat({ aplicatie: 'buletin', async laText() { return null } })

    const j = (await (await trimite(modul, env, 'rămâne așa'))!.json()) as { nota?: string; unelte?: string[] }
    expect(primite[0]!.corp.text).toBe('rămâne așa')
    expect(j.nota).toBeUndefined()
    expect(j.unelte).toBeUndefined()
  })

  /**
   * ⚠️ Un articol lipit n-are voie să dispară fiindcă s-a împiedicat ceva în aplicație — e cel mai rău
   * fel de eroare. Cârligul căzut înseamnă „mergem pe drumul de dinainte", nu „am pierdut mesajul".
   */
  it('un cârlig care cade nu pierde mesajul omului', async () => {
    uitaConfigChat()
    const { env, primite } = mediu()
    const modul = modulChat({
      aplicatie: 'buletin',
      async laText() { throw new Error('depozitul tace') },
    })

    const r = await trimite(modul, env, ARTICOL_LUNG)
    expect(r!.status).toBe(200)
    expect(primite[0]!.corp.text).toBe(ARTICOL_LUNG)
  })

  it('o aplicație fără cârlig se poartă exact ca înainte', async () => {
    uitaConfigChat()
    const { env, primite } = mediu()
    const modul = modulChat({ aplicatie: 'program' })
    const j = (await (await trimite(modul, env, 'ce slujbe sunt duminică?'))!.json()) as { nota?: string }
    expect(primite[0]!.corp.text).toBe('ce slujbe sunt duminică?')
    expect(j.nota).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Bula: vestea și nota se așază înaintea semnului de viață
// ---------------------------------------------------------------------------

describe('bula, la prima mișcare a mesajului', () => {
  it('dă vestea și scrie nota ÎNAINTE de a se pune pe așteptat', () => {
    expect(JS_CHAT).toContain('if (j && j.unelte && j.unelte.length) vesteste(j);')
    expect(JS_CHAT).toContain("if (j && j.nota) semn.inainte(nodMesaj('agent', j.nota));")
  })

  it('scriptul rămâne JavaScript bun', () => {
    expect(() => new Function(JS_CHAT)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Ceasul peste un apel de model care atârnă
// ---------------------------------------------------------------------------

describe('`cuCeas` — plasa de sub un apel fără ceas al lui', () => {
  it('lasă răspunsul să treacă întreg când vine la vreme', async () => {
    expect(await cuCeas(Promise.resolve({ raspuns: 'gata' }), 1000)).toEqual({ gata: true, date: { raspuns: 'gata' } })
  })

  it('iese cu `gata:false` din ce atârnă, fără să aștepte la nesfârșit', async () => {
    expect(await cuCeas(new Promise(() => undefined), 20)).toEqual({ gata: false })
  })

  /** O eroare adevărată rămâne eroare: ea urcă la prinderea de sus, care o scrie în discuție. */
  it('o cădere se propagă, nu se preface în tăcere', async () => {
    await expect(cuCeas(Promise.reject(new Error('poarta a picat')), 1000)).rejects.toThrow('poarta a picat')
  })

  /** ⚠️ Promisiunea rămasă în urmă poate cădea DUPĂ ce ceasul a câștigat: fără prinderea din `cuCeas`
   *  ar fi o respingere fără stăpân, care în Workers omoară izolatul. */
  it('ce cade după ce ceasul a câștigat nu lasă o respingere fără stăpân', async () => {
    const tarziu = new Promise((_, nu) => setTimeout(() => nu(new Error('prea târziu')), 30))
    expect(await cuCeas(tarziu, 5)).toEqual({ gata: false })
    await new Promise((hai) => setTimeout(hai, 60))
  })
})

describe('apelul Workers AI, sub ceas', () => {
  const MESAJE: MesajModel[] = [{ rol: 'om', text: 'ce slujbe sunt duminică?' }]

  const mediu = (run: (intrare: Record<string, unknown>) => Promise<unknown>) => {
    const intrari: Record<string, unknown>[] = []
    const env = {
      AI_GATEWAY: 'xc-chat',
      MODEL_CHAT: '@cf/zai-org/glm-5.3-flash',
      AI: {
        run: async (_m: string, intrare: Record<string, unknown>) => {
          intrari.push(intrare)
          return await run(intrare)
        },
      },
    } as never
    return { env, intrari }
  }

  /**
   * ⚠️ PROBA BOLII DIN 18.09.2026. Fără ceas, apelul ăsta n-ar fi fost tăiat de nimic: bugetul
   * mesajului se cântărește doar între pașii buclei, deci cererea ar fi murit cu tot cu lucrul ei,
   * fără să scrie un rând. `expirat` e ușa pe care bucla iese ca să SPUNĂ ce a apucat.
   */
  it('un apel care atârnă întoarce `expirat`, nu tăcere', async () => {
    const { env } = mediu(() => new Promise(() => undefined))
    const r = await intreabaModelul(env, MESAJE, [], 'workers-ai', { pana: Date.now() })
    expect(r.expirat).toBe(true)
    expect(r.cereri).toEqual([])
    expect(r.text).toBe('')
  }, 15_000)

  it('un apel care răspunde la vreme trece neatins', async () => {
    const { env } = mediu(async () => ({ response: 'Duminică, la 9:30.' }))
    const r = await intreabaModelul(env, MESAJE, [], 'workers-ai', { pana: Date.now() + 60_000 })
    expect(r.expirat).toBeUndefined()
    expect(r.text).toBe('Duminică, la 9:30.')
  })
})

describe('bugetul de ieșire al primei încercări', () => {
  const mediu = (raspuns: (apel: number) => unknown) => {
    const intrari: Record<string, unknown>[] = []
    const env = {
      AI_GATEWAY: 'xc-chat',
      MODEL_CHAT: '@cf/zai-org/glm-5.3-flash',
      AI: {
        run: async (_m: string, intrare: Record<string, unknown>) => {
          intrari.push(intrare)
          return raspuns(intrari.length)
        },
      },
    } as never
    return { env, intrari }
  }

  const taiat = { choices: [{ finish_reason: 'length', message: { content: '' } }] }

  it('istoric obișnuit: se pleacă cu 2500, iar dacă răspunsul iese tăiat se mai încearcă cu 6000', async () => {
    const { env, intrari } = mediu((n) => (n === 1 ? taiat : { response: 'Gata.' }))
    const r = await intreabaModelul(env, [{ rol: 'om', text: 'bună' }], [], 'workers-ai', {})
    expect(intrari.map((i) => i.max_tokens)).toEqual([2500, 6000])
    expect(r.text).toBe('Gata.')
  })

  /**
   * ⚠️ HOTĂRÂREA DIN 19.09.2026: cu un mesaj greu în istoric se pleacă DE-A DREPTUL cu plafonul mare.
   * Un plafon nu costă nimic dacă modelul răspunde scurt (se plătesc tokenii scriși, nu cei îngăduiți),
   * pe când a doua încercare costă sigur — și dublează tocmai așteptarea de care ne plângem.
   */
  it('istoric cu un mesaj al omului peste 3000 de semne: 6000 din prima, și o singură încercare', async () => {
    const { env, intrari } = mediu(() => taiat)
    await intreabaModelul(env, [{ rol: 'om', text: 'a'.repeat(3001) }], [], 'workers-ai', {})
    expect(intrari.map((i) => i.max_tokens)).toEqual([6000])
  })

  it('un text lung venit de la o UNEALTĂ nu îngreunează socoteala — numai mesajul omului o face', async () => {
    const { env, intrari } = mediu((n) => (n === 1 ? taiat : { response: 'Gata.' }))
    await intreabaModelul(
      env,
      [{ rol: 'om', text: 'bună' }, { rol: 'unealta', text: 'x'.repeat(5000), idApel: 'a1' }],
      [],
      'workers-ai',
      {},
    )
    expect(intrari.map((i) => i.max_tokens)).toEqual([2500, 6000])
  })
})

// ---------------------------------------------------------------------------
// Buletinul, cap-coadă: textul lipit intră în SCHIȚĂ, nu în discuție
// ---------------------------------------------------------------------------

const ULTIMUL = {
  nr: 615, data: '2026-09-06', an: '2026', luna: '09',
  cheie_pdf: '2026/buletin-615-2026-09-06.pdf', cheie_poza: null, cheie_poza_mica: null,
  marime_pdf: 700000, pagini: 4, text: '', titlu: null, sursa: 'v1',
}
const URMATOR = buletinulNou(ULTIMUL, new Date().toISOString().slice(0, 10)) as { nr: number; data: string }

const SESIUNE = {
  authenticated: true,
  user: {
    id: 'u1', email: 'parintele@example.com', displayName: 'Părintele',
    firstName: null, lastName: null, phone: null, shortName: null,
    emailVerifiedAt: null, disabledAt: null, createdAt: '2026-01-01T00:00:00.000Z',
  },
  roles: [{ role: 'user', scope: 'global' }],
  sessionId: 's1', expiresAt: null, veziCa: null, poateVedeaCa: false,
}

function dbFals() {
  const raspunde = (sql: string) => {
    const s = sql.replace(/\s+/g, ' ')
    if (s.includes('FROM buletine ORDER BY data DESC')) return { first: ULTIMUL, results: [ULTIMUL] }
    if (s.includes('GROUP BY')) return { first: null, results: [{ an: '2026', cate: 12 }] }
    return { first: null, results: [] }
  }
  return {
    prepare: (sql: string) => {
      const r = raspunde(sql)
      const legat = { bind: () => legat, async first() { return r.first }, async all() { return { results: r.results } } }
      return legat
    },
  } as unknown as D1Database
}

function r2Fals(initial: Record<string, unknown> = {}) {
  const tinut = new Map<string, string>()
  for (const [k, v] of Object.entries(initial)) tinut.set(k, JSON.stringify(v))
  const obiect = (cheie: string) => ({
    key: cheie,
    size: tinut.get(cheie)!.length,
    httpEtag: '"abc123"',
    body: tinut.get(cheie)!,
    httpMetadata: { contentType: 'application/json' },
    writeHttpMetadata(h: Headers) { h.set('content-type', 'application/json') },
    async json() { return JSON.parse(tinut.get(cheie)!) },
    async text() { return tinut.get(cheie)! },
  })
  return {
    tinut,
    bucket: {
      async head(c: string) { return tinut.has(c) ? obiect(c) : null },
      async get(c: string) { return tinut.has(c) ? obiect(c) : null },
      async put(c: string, corp: unknown) { tinut.set(c, String(corp)); return { httpEtag: '"pus"' } },
      async delete(c: string) { tinut.delete(c) },
      async list({ prefix }: { prefix: string }) {
        return { objects: [...tinut.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }
      },
    } as unknown as R2Bucket,
  }
}

const ORIGINE = 'https://buletin.staging.sfantul-ilie.ro'

function mediuBuletin(depozit: Record<string, unknown> = {}) {
  const r2 = r2Fals(depozit)
  const catreCreier: Array<{ cale: string; text: string }> = []
  const env = {
    MEDIU: 'staging',
    ORIGINE_PUBLICA: ORIGINE,
    DOMENIU_COOKIE: '.staging.sfantul-ilie.ro',
    EMAIL_SUPERADMIN: 'rubikmm@gmail.com',
    SECRET_INTERN: 'secret',
    DB: dbFals(),
    FISIERE: r2.bucket,
    IDENTITATE: { fetch: async () => new Response(JSON.stringify(SESIUNE), { headers: { 'content-type': 'application/json' } }) },
    AUTORIZARE: {
      fetch: async () => new Response(JSON.stringify({ allowed: true, reason: 'probă', matchedScopes: [] }), {
        headers: { 'content-type': 'application/json' },
      }),
    },
    AUDIT: { fetch: async () => new Response('{}') },
    COMUNICARE: { fetch: async () => new Response(JSON.stringify({ membri: [] }), { headers: { 'content-type': 'application/json' } }) },
    PROGRAM: {
      fetch: async () =>
        new Response(
          JSON.stringify({ titlu: '21 – 27 septembrie 2026', slujbe: 6, detalii: 5, stare: 'validat', tabel: '', stil: '', de_la: '', pana_la: '', strans: 0 }),
          { headers: { 'content-type': 'application/json' } },
        ),
    },
    CALENDAR: { fetch: async () => new Response(JSON.stringify({ zile: [] }), { headers: { 'content-type': 'application/json' } }) },
    BROWSER: { fetch: async () => new Response('{}') },
    CHAT: {
      fetch: async (adresa: string, init?: RequestInit) => {
        const corp = JSON.parse(String(init?.body ?? '{}')) as { text?: string }
        catreCreier.push({ cale: new URL(adresa).pathname, text: String(corp.text ?? '') })
        return new Response(JSON.stringify({ conversatieId: 'c1', mesajId: 'm1', inLucru: true }), {
          headers: { 'content-type': 'application/json' },
        })
      },
    },
    MEDIA: { fetch: async () => new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } }) },
    CONFIG: kvFals({ 'modul:chat': CONFIG_PORNIT }),
  }
  return { env, tinut: r2.tinut, catreCreier }
}

const lipeste = (env: unknown, text: string) =>
  buletin.fetch(
    new Request(`${ORIGINE}/chat/mesaj`, {
      method: 'POST',
      headers: { cookie: 'xc_sesiune=jeton', origin: ORIGINE, 'content-type': 'application/json' },
      body: JSON.stringify({ text, conversatieId: null }),
    }),
    env as never,
    ctxExec,
  )

const schitaDin = (tinut: Map<string, string>): Schita | null => {
  const scris = tinut.get(cheiaSchitei(URMATOR))
  return scris ? (JSON.parse(scris) as Schita) : null
}

/** O schiță oprită la întrebarea TEXTULUI — exact locul din care s-a plâns userul. */
const LA_INTREBAREA_TEXT: Schita = {
  nr: URMATOR.nr, data: URMATOR.data, motto: 'Singur smerenia', motoAutor: 'Părintele Arsenie Papacioc',
  principal: {}, secundari: [], gata: ['motto'], actualizat: '2026-09-18T20:49:00.000Z',
}

describe('buletinul: textul lipit intră în schiță, nu în discuție', () => {
  it('la întrebarea textului, articolul lipit se scrie în schiță, iar la model pleacă o frază', async () => {
    const { env, tinut, catreCreier } = mediuBuletin({ [cheiaSchitei(URMATOR)]: LA_INTREBAREA_TEXT })
    const j = (await (await lipeste(env, ARTICOL_LUNG)).json()) as { nota?: string; unelte?: string[] }

    // textul a ajuns ÎNTREG în schiță, literă cu literă
    const schita = schitaDin(tinut)!
    expect(schita.principal.text).toBe(ARTICOL_LUNG.trimEnd())
    expect(schita.principal.gata).toContain('text')

    // ⚠️ și NU a ajuns la creier, pe niciuna dintre cele două cereri
    expect(catreCreier).toHaveLength(2)
    for (const c of catreCreier) expect(c.text).not.toContain('Mănăstirea Antim')
    expect(catreCreier[0]!.text).toMatch(/^Am pus textul \([\d ]+ de semne\) ca textul articolului principal\./)

    // ecranul de dedesubt află pe loc că schița s-a schimbat
    expect(j.unelte).toEqual(['buletin.raspunde'])
    expect(j.nota).toContain('Am pus textul')
  })

  it('un răspuns scurt („rămâne așa") rămâne un răspuns: nu se scrie nimic în schiță', async () => {
    const { env, tinut, catreCreier } = mediuBuletin({ [cheiaSchitei(URMATOR)]: LA_INTREBAREA_TEXT })
    await lipeste(env, 'rămâne așa')
    expect(schitaDin(tinut)!.principal.text).toBeUndefined()
    expect(catreCreier[0]!.text).toBe('rămâne așa')
  })

  /**
   * ⚠️ PRAGUL NU E DE AJUNS SINGUR. La întrebarea motto-ului, un text lung e chiar MOTTO-UL dictat,
   * nu articolul: fără paza asta, un citat de câteva rânduri ar fi ajuns tăcut textul paginii întâi,
   * iar omul ar fi văzut abia pe hârtie ce s-a întâmplat.
   */
  it('la întrebarea motto-ului, un text lung NU e luat drept articol', async () => {
    const laMotto: Schita = {
      nr: URMATOR.nr, data: URMATOR.data, motto: 'Un motto vechi',
      principal: {}, secundari: [], gata: [], actualizat: '2026-09-18T20:00:00.000Z',
    }
    const { env, tinut, catreCreier } = mediuBuletin({ [cheiaSchitei(URMATOR)]: laMotto })
    const lung = 'Rugăciunea este respirația sufletului, iar fără ea omul se usucă. '.repeat(10)
    const j = (await (await lipeste(env, lung)).json()) as { nota?: string }

    expect(schitaDin(tinut)!.principal.text).toBeUndefined()
    expect(catreCreier[0]!.text).toBe(lung)
    expect(j.nota).toBeUndefined()
  })

  it('când articolul are deja text, cârligul se dă la o parte — omul spune el unde-l vrea', async () => {
    const cuText: Schita = {
      nr: URMATOR.nr, data: URMATOR.data, motto: 'Un motto',
      principal: { text: 'Textul de dinainte.', gata: ['text'] },
      secundari: [], gata: ['motto'], actualizat: '2026-09-18T20:00:00.000Z',
    }
    const { env, tinut, catreCreier } = mediuBuletin({ [cheiaSchitei(URMATOR)]: cuText })
    await lipeste(env, ARTICOL_LUNG)
    expect(schitaDin(tinut)!.principal.text).toBe('Textul de dinainte.')
    expect(catreCreier[0]!.text).toBe(ARTICOL_LUNG)
  })
})
