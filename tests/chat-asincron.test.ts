/**
 * CHATUL CARE NU MAI ȚINE OMUL ÎN LOC (user, 18.09.2026: „mi se cam blochează fereastra de chat și
 * am nevoie de niște îmbunătățiri generale ferestrei și a modului cum răspunde").
 *
 * Un mesaj măsurat pe viu a ținut 2 min 49 s. Pe drumul vechi, răspunsul venea pe cererea care-l
 * ceruse: la peste vreo sută de secunde conexiunea cădea, bula spunea „Nu am putut trimite mesajul",
 * iar răspunsul — scris în D1 — apărea „de nicăieri" la reîncărcarea paginii.
 *
 * De aceea mesajul are acum două mișcări: `/mesaj` scrie ce a spus omul și întoarce îndată
 * `{inLucru:true}`, iar `/lucreaza` face treaba, ținut în viață de `waitUntil` AL APLICAȚIEI. Bula
 * întreabă `/stare` la câteva secunde.
 *
 * Ce se poate strica TĂCUT, și de asta stă fiecare probă aici:
 *   1. **lucrul dublat** — dacă `/lucreaza` s-ar chema de două ori (o sondare pornită de două ori, o
 *      apăsare dublă), s-ar plăti două răspunsuri și s-ar scrie amândouă în discuție;
 *   2. **bugetul de timp** — fără ceas, bucla se întinde la trei minute și nimeni nu vede nicio
 *      eroare: doar un om care așteaptă și crede că s-a rupt ceva;
 *   3. **propunerea pierdută** — butoanele Da/Nu refăcute din istoric: fără ele, cine strânge panoul
 *      rămâne cu o propunere pe care nu mai are cum s-o confirme;
 *   4. **tăierea mesajului** — 2000 de semne tăiau în tăcere articolul buletinului (vreo 9000).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import creier from '../services/chat-worker/src/index.js'
import { intreabaModelul } from '../services/chat-worker/src/creier.js'
import { JS_CHAT, STIL_CHAT } from '../packages/chat/src/bula.js'
import { modulChat, uitaConfigChat } from '../packages/chat/src/index.js'
import { ANTET_ACTOR, ANTET_SECRET } from '../packages/actiuni/src/index.js'

// ---------------------------------------------------------------------------
// D1 de probă: cele trei tabele ale chatului, ținute în memorie
// ---------------------------------------------------------------------------

interface RandMesaj {
  rowid: number
  id: string
  conversatie_id: string
  rol: string
  text: string
  date_json: string
  creat_la: string
}

/**
 * ⚠️ Cunoaște ANUME comenzile din `depozit.ts` și se plânge la oricare alta: dacă depozitul capătă o
 * comandă nouă, proba cade cu numele ei în față, nu tace și trece.
 */
function d1Fals() {
  const conversatii: Array<Record<string, unknown>> = []
  const mesaje: RandMesaj[] = []
  const propuneri: Array<Record<string, unknown>> = []
  let rowid = 0

  function executa(s: string, a: unknown[]) {
    const gol = { first: null as unknown, results: [] as unknown[], meta: { changes: 0 } }
    if (s.startsWith('SELECT * FROM conversatii')) {
      const c = conversatii.find((x) => x.id === a[0] && x.user_id === a[1] && !x.stearsa_la) ?? null
      return { ...gol, first: c, results: c ? [c] : [] }
    }
    if (s.startsWith('INSERT INTO conversatii')) {
      conversatii.push({ id: a[0], user_id: a[1], aplicatie: a[2], creata_la: a[3], ultimul_la: a[4], stearsa_la: null })
      return { ...gol, meta: { changes: 1 } }
    }
    if (s.startsWith('UPDATE conversatii SET ultimul_la')) {
      const c = conversatii.find((x) => x.id === a[0])
      if (c) c.ultimul_la = a[1]
      return { ...gol, meta: { changes: c ? 1 : 0 } }
    }
    if (s.startsWith('UPDATE conversatii SET stearsa_la')) {
      const c = conversatii.find((x) => x.id === a[0] && x.user_id === a[1] && !x.stearsa_la)
      if (c) c.stearsa_la = a[2]
      return { ...gol, meta: { changes: c ? 1 : 0 } }
    }
    if (s.startsWith('INSERT INTO mesaje')) {
      mesaje.push({
        rowid: ++rowid,
        id: String(a[0]),
        conversatie_id: String(a[1]),
        rol: String(a[2]),
        text: String(a[3]),
        date_json: String(a[4]),
        creat_la: String(a[5]),
      })
      return { ...gol, meta: { changes: 1 } }
    }
    if (s.startsWith('UPDATE mesaje SET date_json')) {
      const m = mesaje.find((x) => x.id === a[0])
      if (m) m.date_json = String(a[1])
      return { ...gol, meta: { changes: m ? 1 : 0 } }
    }
    if (s.startsWith('SELECT * FROM mesaje')) {
      // aceeași ordine ca în bază: cele mai noi întâi, tăiate la limită (depozitul le întoarce)
      const ale = mesaje.filter((m) => m.conversatie_id === a[0]).sort((x, y) => x.rowid - y.rowid)
      const ultimele = ale.slice(-Number(a[1] ?? 16)).reverse()
      return { ...gol, first: ultimele[0] ?? null, results: ultimele }
    }
    if (s.startsWith('INSERT INTO propuneri')) {
      propuneri.push({
        id: a[0], conversatie_id: a[1], aplicatie: a[2], actiune: a[3], argumente_json: a[4],
        rezumat: a[5], stare: a[6], creata_la: a[7], expira_la: a[8],
      })
      return { ...gol, meta: { changes: 1 } }
    }
    if (s.startsWith('SELECT p.* FROM propuneri')) {
      const p = propuneri.find(
        (x) => x.id === a[0] && conversatii.some((c) => c.id === x.conversatie_id && c.user_id === a[1]),
      ) ?? null
      return { ...gol, first: p }
    }
    if (s.startsWith('UPDATE propuneri SET stare')) {
      const p = propuneri.find((x) => x.id === a[0])
      if (p) p.stare = a[1]
      return { ...gol, meta: { changes: p ? 1 : 0 } }
    }
    if (s.startsWith('SELECT id, stare, expira_la FROM propuneri')) {
      return { ...gol, results: propuneri.filter((p) => p.conversatie_id === a[0]) }
    }
    throw new Error(`comandă necunoscută în proba de D1: ${s}`)
  }

  function prepare(sql: string) {
    const s = sql.replace(/\s+/g, ' ').trim()
    let a: unknown[] = []
    const st = {
      bind(...args: unknown[]) {
        a = args
        return st
      },
      async first() {
        return executa(s, a).first
      },
      async all() {
        return { results: executa(s, a).results }
      },
      async run() {
        return { meta: executa(s, a).meta }
      },
      ruleaza() {
        return executa(s, a)
      },
    }
    return st
  }

  const db = {
    prepare,
    async batch(comenzi: Array<{ ruleaza: () => unknown }>) {
      return comenzi.map((c) => c.ruleaza())
    },
  } as unknown as D1Database

  return { db, conversatii, mesaje, propuneri }
}

// ---------------------------------------------------------------------------
// Mediul creierului
// ---------------------------------------------------------------------------

const CONFIG_GLOBAL = {
  activ: true,
  aplicatii: { program: true },
  cineVede: 'admini',
  model: '@cf/zai-org/glm-5.3-flash',
  creier: 'workers-ai',
  indrumari: '',
  unelte: [] as string[],
}

function kvFals(inceput: Record<string, unknown>) {
  const date = new Map<string, string>(Object.entries(inceput).map(([k, v]) => [k, JSON.stringify(v)]))
  return {
    async get(cheie: string, fel?: string) {
      const scris = date.get(cheie)
      if (scris === undefined) return null
      return fel === 'json' ? JSON.parse(scris) : scris
    },
    async put(cheie: string, valoare: string) {
      date.set(cheie, valoare)
    },
  } as unknown as KVNamespace
}

/** Manifestul Programului, cu câte o acțiune din fiecare efect — inclusiv `ciorna` (18.09.2026). */
const ACTIUNI = [
  {
    nume: 'program.slujbele_zilei', descriere: 'Slujbele unei zile.', efect: 'citeste', permisiune: null,
    da: 'date', intrare: { type: 'object', properties: {} }, iesire: { type: 'object', properties: {} },
    exemple: [], fundal: false, urmare: null,
  },
  {
    nume: 'program.adauga_slujba', descriere: 'Adaugă o slujbă.', efect: 'scrie', permisiune: null,
    da: 'date', intrare: { type: 'object', properties: {} }, iesire: { type: 'object', properties: {} },
    exemple: [], fundal: false, urmare: null,
  },
  {
    nume: 'program.scrie_ciorna', descriere: 'Scrie în ciorna omului.', efect: 'ciorna', permisiune: null,
    da: 'date', intrare: { type: 'object', properties: {} }, iesire: { type: 'object', properties: {} },
    exemple: [], fundal: false, urmare: null,
  },
]

/** Un răspuns de la Workers AI, în forma pe care o desface `creier.ts`. */
const vorba = (text: string) => ({ response: text })
const cheamaUnealta = (nume: string, id = 'apel-1') => ({
  response: '',
  tool_calls: [{ id, type: 'function', function: { name: nume, arguments: '{}' } }],
})

function mediuCreier(o: { modelul?: (apel: number) => unknown; program?: (cale: string, prev: boolean) => unknown } = {}) {
  const { db, mesaje, propuneri, conversatii } = d1Fals()
  const apeluriModel: unknown[] = []
  const cerutDeLaProgram: string[] = []
  const env = {
    MEDIU: 'staging',
    SECRET_INTERN: 'secret',
    DB: db,
    AI_GATEWAY: 'xc-chat',
    AI: {
      run: async (_model: string, intrare: unknown) => {
        apeluriModel.push(intrare)
        return (o.modelul ?? (() => vorba('Gata.')))(apeluriModel.length)
      },
    },
    CONFIG: kvFals({ 'modul:chat': CONFIG_GLOBAL }),
    PROGRAM: {
      fetch: async (adresa: string, init?: RequestInit) => {
        const cale = new URL(adresa).pathname
        const prev = Boolean((init?.headers as Record<string, string> | undefined)?.['x-xc-previzualizare'])
        if (cale.endsWith('/_actiuni')) {
          return new Response(JSON.stringify({ aplicatie: 'program', versiune: '1.0.0', actiuni: ACTIUNI }), {
            headers: { 'content-type': 'application/json' },
          })
        }
        cerutDeLaProgram.push((prev ? 'prev:' : '') + decodeURIComponent(cale.split('/').pop() ?? ''))
        const raspuns = o.program?.(cale, prev)
        if (raspuns) return new Response(JSON.stringify(raspuns), { headers: { 'content-type': 'application/json' } })
        return new Response(JSON.stringify(prev ? { ok: true, date: { rezumat: 'Adaug Vecernia marți la 18:00.' } } : { ok: true, date: { scris: true } }), {
          headers: { 'content-type': 'application/json' },
        })
      },
    } as unknown as Fetcher,
  } as never
  return { env, db, mesaje, propuneri, conversatii, apeluriModel, cerutDeLaProgram }
}

const ctxExec = { waitUntil: () => undefined, passThroughOnException: () => undefined } as unknown as ExecutionContext

const ACTORUL = JSON.stringify({ fel: 'utilizator', principal: { userId: 'u1', email: 'p@example.ro', roles: [] } })

function cere(env: unknown, cale: string, corp?: unknown) {
  return creier.fetch(
    new Request(`https://chat.intern${cale}`, {
      method: corp === undefined ? 'GET' : 'POST',
      headers: { [ANTET_SECRET]: 'secret', [ANTET_ACTOR]: ACTORUL, 'content-type': 'application/json' },
      ...(corp === undefined ? {} : { body: JSON.stringify(corp) }),
    }),
    env as never,
    ctxExec,
  )
}

beforeEach(() => uitaConfigChat())

// ---------------------------------------------------------------------------

describe('mesajul în două mișcări: nimeni nu mai stă pe firul cererii', () => {
  it('`/mesaj` cu `asincron` scrie ce a spus omul și răspunde ÎNDATĂ, fără să cheme modelul', async () => {
    const { env, mesaje, apeluriModel } = mediuCreier()
    const r = await cere(env, '/mesaj', { text: 'ce slujbe sunt mâine?', aplicatie: 'program', asincron: true })
    const j = (await r.json()) as { conversatieId: string; mesajId: string; inLucru: boolean }

    expect(r.status).toBe(200)
    expect(j.inLucru).toBe(true)
    expect(j.conversatieId).toBeTruthy()
    // ⚠️ miezul: niciun apel de model pe cererea asta — altfel n-am rezolvat nimic
    expect(apeluriModel).toHaveLength(0)
    expect(mesaje.map((m) => m.rol)).toEqual(['om'])
    // starea lucrului stă lângă mesajul omului, de unde o citește sondarea
    expect(JSON.parse(mesaje[0]!.date_json).lucru.etapa).toContain('gândesc')
  })

  it('`/stare` spune întâi la ce e creierul, apoi dă răspunsul întreg', async () => {
    const { env, mesaje } = mediuCreier({
      modelul: (apel) => (apel === 1 ? cheamaUnealta('program__slujbele_zilei') : vorba('Mâine e Vecernia, la 18:00.')),
    })
    const pornit = (await (await cere(env, '/mesaj', { text: 'mâine?', aplicatie: 'program', asincron: true })).json()) as {
      conversatieId: string
      mesajId: string
    }

    const inLucru = (await (await cere(env, `/stare?id=${pornit.conversatieId}`)).json()) as { gata: boolean; etapa: string }
    expect(inLucru.gata).toBe(false)
    expect(inLucru.etapa).toContain('gândesc')

    await cere(env, '/lucreaza', { conversatieId: pornit.conversatieId, mesajId: pornit.mesajId, aplicatie: 'program' })

    const gata = (await (await cere(env, `/stare?id=${pornit.conversatieId}`)).json()) as {
      gata: boolean
      raspuns: { text: string; propunere: unknown }
    }
    expect(gata.gata).toBe(true)
    expect(gata.raspuns.text).toContain('Vecernia')
    // etapa nu mai are ce căuta în firul discuției: ea a fost doar pentru așteptare
    expect(mesaje.map((m) => m.rol)).toEqual(['om', 'agent'])
  })

  it('⚠️ chemat de două ori, `/lucreaza` NU mai întreabă modelul a doua oară', async () => {
    const { env, mesaje, apeluriModel } = mediuCreier({ modelul: () => vorba('Un singur răspuns.') })
    const pornit = (await (await cere(env, '/mesaj', { text: 'salut', aplicatie: 'program', asincron: true })).json()) as {
      conversatieId: string
      mesajId: string
    }
    const corp = { conversatieId: pornit.conversatieId, mesajId: pornit.mesajId, aplicatie: 'program' }
    await cere(env, '/lucreaza', corp)
    const alDoilea = (await (await cere(env, '/lucreaza', corp)).json()) as { text: string }

    expect(apeluriModel).toHaveLength(1)
    expect(alDoilea.text).toBe('Un singur răspuns.')
    expect(mesaje.filter((m) => m.rol === 'agent')).toHaveLength(1)
  })

  it('nimeni nu lucrează în discuția altuia', async () => {
    const { env } = mediuCreier()
    const pornit = (await (await cere(env, '/mesaj', { text: 'salut', aplicatie: 'program', asincron: true })).json()) as {
      conversatieId: string
    }
    const alAltuia = await creier.fetch(
      new Request('https://chat.intern/lucreaza', {
        method: 'POST',
        headers: {
          [ANTET_SECRET]: 'secret',
          [ANTET_ACTOR]: JSON.stringify({ fel: 'utilizator', principal: { userId: 'ALTUL', email: 'x@y.ro', roles: [] } }),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ conversatieId: pornit.conversatieId }),
      }),
      env as never,
      ctxExec,
    )
    expect(alAltuia.status).toBe(404)
  })

  it('drumul vechi (fără `asincron`) răspunde tot dintr-o bucată', async () => {
    const { env } = mediuCreier({ modelul: () => vorba('Gata, pe loc.') })
    const j = (await (await cere(env, '/mesaj', { text: 'salut', aplicatie: 'program' })).json()) as { text: string }
    expect(j.text).toBe('Gata, pe loc.')
  })
})

describe('efectele acțiunilor', () => {
  it('`scrie` se oprește și propune; `ciorna` se face pe loc, fără Da/Nu', async () => {
    const { env, cerutDeLaProgram, propuneri } = mediuCreier({
      modelul: (apel) => (apel === 1 ? cheamaUnealta('program__adauga_slujba') : vorba('Am pregătit-o.')),
    })
    const j = (await (await cere(env, '/mesaj', { text: 'adaugă Vecernia marți', aplicatie: 'program' })).json()) as {
      propunere: { rezumat: string } | null
    }
    expect(j.propunere?.rezumat).toContain('Vecernia')
    expect(propuneri).toHaveLength(1)
    // ⚠️ s-a cerut PREVIZUALIZAREA, nu execuția: nimic nu se schimbă până nu apasă omul
    expect(cerutDeLaProgram).toEqual(['prev:program.adauga_slujba'])

    const alDoilea = mediuCreier({
      modelul: (apel) => (apel === 1 ? cheamaUnealta('program__scrie_ciorna') : vorba('Am scris în ciornă.')),
    })
    uitaConfigChat()
    const c = (await (await cere(alDoilea.env, '/mesaj', { text: 'scrie în ciornă', aplicatie: 'program' })).json()) as {
      propunere: unknown
      text: string
    }
    expect(c.propunere).toBeNull()
    expect(alDoilea.propuneri).toHaveLength(0)
    expect(alDoilea.cerutDeLaProgram).toEqual(['program.scrie_ciorna'])
  })
})

describe('bugetul de timp', () => {
  it('bucla se oprește când s-a scurs bugetul și spune ce a apucat', async () => {
    // Ceasul sare cu un minut LA FIECARE APEL DE MODEL — adică exact ce se întâmplă pe viu, doar că
    // fără așteptare: al treilea ocol nu mai încape în cele 90 de secunde ale bugetului.
    const adevaratul = Date.now
    let saritura = 0
    vi.spyOn(Date, 'now').mockImplementation(() => adevaratul() + saritura)
    try {
      const { env, apeluriModel } = mediuCreier({
        modelul: () => {
          saritura += 60_000
          return cheamaUnealta('program__slujbele_zilei')
        },
      })
      const j = (await (await cere(env, '/mesaj', { text: 'mult de lucru', aplicatie: 'program' })).json()) as { text: string }
      // ⚠️ nu s-au făcut toți cei trei pași: ceasul a oprit bucla mai devreme
      expect(apeluriModel).toHaveLength(2)
      expect(j.text).toContain('timpul pe care mi-l dau')
      // și se spune ce a apucat, nu doar că n-a ieșit
      expect(j.text).toContain('program.slujbele_zilei')
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('reîncercarea cu buget dublat a Workers AI NU se mai face cu vremea scursă', async () => {
    let apeluri = 0
    const env = {
      AI_GATEWAY: 'xc-chat',
      AI: {
        run: async () => {
          apeluri++
          // tăiat de `max_tokens` și fără text: cazul în care se reîncerca
          return { choices: [{ finish_reason: 'length', message: { content: '', tool_calls: null } }] }
        },
      },
    } as never

    await intreabaModelul(env, [{ rol: 'om', text: 'ceva' }], [], 'workers-ai', { pana: Date.now() + 60_000 })
    expect(apeluri).toBe(2)

    apeluri = 0
    await intreabaModelul(env, [{ rol: 'om', text: 'ceva' }], [], 'workers-ai', { pana: Date.now() - 1 })
    expect(apeluri).toBe(1)
  })
})

describe('mesajul omului nu se mai taie la 2000 de semne', () => {
  it('un articol de buletin (vreo 9000) intră întreg; tăierea e la 12000', async () => {
    const { env, mesaje } = mediuCreier({ modelul: () => vorba('Am citit.') })
    const articol = 'a'.repeat(9000)
    await cere(env, '/mesaj', { text: articol, aplicatie: 'program', asincron: true })
    expect(mesaje[0]!.text).toHaveLength(9000)

    const { env: env2, mesaje: mesaje2 } = mediuCreier({ modelul: () => vorba('Am citit.') })
    uitaConfigChat()
    await cere(env2, '/mesaj', { text: 'b'.repeat(13000), aplicatie: 'program', asincron: true })
    expect(mesaje2[0]!.text).toHaveLength(12000)
  })
})

describe('propunerea, la redeschiderea panoului', () => {
  async function discutieCuPropunere(minuteDeViata: number) {
    const { env, propuneri } = mediuCreier({
      modelul: (apel) => (apel === 1 ? cheamaUnealta('program__adauga_slujba') : vorba('O fac dacă îmi confirmi.')),
    })
    const j = (await (await cere(env, '/mesaj', { text: 'adaugă Vecernia', aplicatie: 'program' })).json()) as {
      conversatieId: string
    }
    // vremea propunerii se mută în trecut ori în viitor, după ce probăm
    propuneri[0]!.expira_la = new Date(Date.now() + minuteDeViata * 60_000).toISOString()
    const istoric = (await (await cere(env, `/discutie?id=${j.conversatieId}`)).json()) as {
      mesaje: Array<{ rol: string; date: { propunere?: unknown; propunereTrecuta?: { stare: string } } }>
    }
    return istoric.mesaje[istoric.mesaje.length - 1]!
  }

  it('⚠️ propunerea vie se re-randează din istoric — altfel omul nu mai are cum să confirme', async () => {
    const ultimul = await discutieCuPropunere(9)
    expect(ultimul.date.propunere).toBeTruthy()
    expect(ultimul.date.propunereTrecuta).toBeUndefined()
  })

  it('propunerea expirată nu mai vine ca butoane, ci ca veste: „a expirat"', async () => {
    const ultimul = await discutieCuPropunere(-1)
    expect(ultimul.date.propunere).toBeNull()
    expect(ultimul.date.propunereTrecuta?.stare).toBe('expirata')
  })

  it('istoricul cerut cu un id străin nu deschide o discuție nouă', async () => {
    const { env, conversatii } = mediuCreier()
    const j = (await (await cere(env, '/discutie?id=nu-exista')).json()) as { mesaje: unknown[] }
    expect(j.mesaje).toEqual([])
    expect(conversatii).toHaveLength(0)
  })
})

/**
 * BULA — hotărârile care nu se văd de pe server.
 *
 * ⚠️ Probe pe TEXTUL scriptului, fiindcă probele astea n-au DOM (mediul e `node`). Nu păzesc cum
 * arată, ci trei hotărâri care s-ar putea pierde tăcut la o rescriere — și fiecare a costat deja o
 * plângere a utilizatorului pe 18.09.2026.
 */
describe('bula: ce s-a hotărât pe 18.09.2026', () => {
  it('fundalul se oprește NUMAI pe ecran îngust — pe lat panoul e un colț, nu o fereastră', () => {
    expect(JS_CHAT).toContain('var vrem = Boolean(cum) && eIngust();')
  })

  it('panoul nu se mai redeschide singur pe telefon', () => {
    expect(JS_CHAT).toContain("localStorage.getItem(CHEIE_DESCHIS) === '1' && !eIngust()")
  })

  it('Enter face rând nou pe ecran îngust, iar pe lat trimite ca până acum', () => {
    expect(JS_CHAT).toContain('if (eIngust() || ev.shiftKey) return;')
  })

  it('așteptarea se sondează, nu se mai stă pe firul cererii', () => {
    expect(JS_CHAT).toContain("prefix + '/chat/stare?id='")
  })

  it('punctele care bat se opresc pentru cine a cerut mai puțină mișcare', () => {
    expect(STIL_CHAT).toContain('@media (prefers-reduced-motion:reduce)')
    expect(STIL_CHAT).toMatch(/prefers-reduced-motion[\s\S]*xc-chat-puncte i \{ animation:none/)
  })
})

// ---------------------------------------------------------------------------
// Partea din aplicație: cine ține lumina aprinsă
// ---------------------------------------------------------------------------

describe('aplicația pornește lucrul și îl ține în viață', () => {
  function mediuAplicatie() {
    const ajunse: Array<{ cale: string; corp: Record<string, unknown> }> = []
    const env = {
      MEDIU: 'staging',
      SECRET_INTERN: 'secret',
      CONFIG: kvFals({ 'modul:chat': { ...CONFIG_GLOBAL, aplicatii: { program: true } } }),
      CHAT: {
        fetch: async (adresa: string, init?: RequestInit) => {
          const cale = new URL(adresa).pathname
          ajunse.push({ cale, corp: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> })
          if (cale === '/mesaj') {
            return new Response(JSON.stringify({ conversatieId: 'c1', mesajId: 'm1', inLucru: true }), {
              headers: { 'content-type': 'application/json' },
            })
          }
          return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } })
        },
      } as unknown as Fetcher,
    }
    const tinute: Array<Promise<unknown>> = []
    const ctx = {
      waitUntil: (p: Promise<unknown>) => tinute.push(p),
      passThroughOnException: () => undefined,
    } as unknown as ExecutionContext
    return { env, ajunse, tinute, ctx }
  }

  const CHAT_PROGRAM = modulChat({ aplicatie: 'program' })
  const ctxChat = {
    prefix: '',
    principal: { userId: 'u1', email: 'p@example.ro', roles: [] } as never,
    numeleOmului: 'Părintele',
    eAdmin: true,
  }

  const mesajul = (corp: unknown) =>
    new Request('https://program.test/chat/mesaj', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corp),
    })

  it('întoarce îndată `{inLucru:true}` și cheamă `/lucreaza` ținut de `waitUntil`', async () => {
    const { env, ajunse, tinute, ctx } = mediuAplicatie()
    const r = await CHAT_PROGRAM.ruteaza(mesajul({ text: 'salut' }), env as never, ctx, '/chat/mesaj', ctxChat)
    const j = (await r!.json()) as { inLucru: boolean; conversatieId: string }

    expect(j.inLucru).toBe(true)
    expect(j.conversatieId).toBe('c1')
    expect(ajunse.map((a) => a.cale)).toEqual(['/mesaj', '/lucreaza'])
    // prima mișcare cere anume drumul asincron; a doua duce discuția și mesajul
    expect(ajunse[0]!.corp.asincron).toBe(true)
    expect(ajunse[1]!.corp).toMatchObject({ conversatieId: 'c1', mesajId: 'm1', aplicatie: 'program' })
    // ⚠️ MIEZUL: lucrul e ținut în viață de cererea aplicației. Fără asta, o cerere de serviciu
    // pornită și nepăzită poate fi tăiată la mijloc, iar omul sondează după un răspuns care nu vine.
    expect(tinute).toHaveLength(1)
    await tinute[0]
  })

  it('un chat-worker care răspunde întreg (fără `inLucru`) nu mai pornește nimic', async () => {
    const ajunse: string[] = []
    const env = {
      MEDIU: 'staging',
      SECRET_INTERN: 'secret',
      CONFIG: kvFals({ 'modul:chat': CONFIG_GLOBAL }),
      CHAT: {
        fetch: async (adresa: string) => {
          ajunse.push(new URL(adresa).pathname)
          return new Response(JSON.stringify({ conversatieId: 'c1', text: 'Gata.', obiecte: [], propunere: null, unelte: [] }), {
            headers: { 'content-type': 'application/json' },
          })
        },
      } as unknown as Fetcher,
    }
    const tinute: Array<Promise<unknown>> = []
    const ctx = { waitUntil: (p: Promise<unknown>) => tinute.push(p) } as unknown as ExecutionContext
    const r = await CHAT_PROGRAM.ruteaza(mesajul({ text: 'salut' }), env as never, ctx, '/chat/mesaj', ctxChat)
    expect((await r!.json()) as { text: string }).toMatchObject({ text: 'Gata.' })
    expect(ajunse).toEqual(['/mesaj'])
    expect(tinute).toHaveLength(0)
  })

  it('ruta de sondare trece mai departe la creier, cu discuția cerută', async () => {
    const { env, ajunse, ctx } = mediuAplicatie()
    const r = await CHAT_PROGRAM.ruteaza(
      new Request('https://program.test/chat/stare?id=c1'),
      env as never,
      ctx,
      '/chat/stare',
      ctxChat,
    )
    expect(r!.status).toBe(200)
    expect(ajunse[0]!.cale).toBe('/stare')
  })
})

// ---------------------------------------------------------------------------
// „DA, FĂ-O" — așteptarea care nu se mai pierde (19.09.2026)
// ---------------------------------------------------------------------------

/**
 * CONFIRMAREA UNEI PROPUNERI ținea omul în loc la fel ca mesajul, până pe 19.09.2026 — dar fără
 * niciun leac: `/confirma` execută acțiunea SINCRON, pe conexiunea bulei, iar o acțiune grea (la
 * buletin, `buletin.compune` randează PDF-ul într-un browser adevărat, un minut și mai bine) ține
 * cererea deschisă până cade. Bula n-avea nici ceas, nici sondare: butoanele rămâneau stinse și nu
 * se scria niciun cuvânt. Așa a arătat, la ecran, „tot aștept și nu răspunde" (user, 19.09.2026).
 *
 * ⚠️ „Gata" NU se poate socoti aici din mesajul agentului, ca la un mesaj obișnuit: după o propunere,
 * ULTIMUL mesaj e chiar cel care o poartă, deci `gata` e adevărat din prima clipă. Semnul că s-a
 * isprăvit e altul, și e un FAPT, nu un steag: propunerea nu mai așteaptă.
 */
describe('sondarea unei confirmări: `/stare` spune și starea propunerii', () => {
  /** Duce discuția până la propunerea cu Da/Nu și întoarce ce trebuie sondării. */
  async function panaLaPropunere() {
    const m = mediuCreier({
      modelul: (apel) => (apel === 1 ? cheamaUnealta('program__adauga_slujba') : vorba('Am pregătit-o.')),
    })
    const pornit = (await (await cere(m.env, '/mesaj', { text: 'adaugă Vecernia', aplicatie: 'program', asincron: true })).json()) as {
      conversatieId: string
      mesajId: string
    }
    await cere(m.env, '/lucreaza', { conversatieId: pornit.conversatieId, mesajId: pornit.mesajId, aplicatie: 'program' })
    const gata = (await (await cere(m.env, `/stare?id=${pornit.conversatieId}`)).json()) as {
      raspuns: { propunere: { id: string; rezumat: string } | null }
    }
    expect(gata.raspuns.propunere).toBeTruthy()
    return { ...m, conversatieId: pornit.conversatieId, propunereId: gata.raspuns.propunere!.id }
  }

  it('cât timp propunerea așteaptă, sondarea spune „asteapta" — nu „gata, s-a făcut"', async () => {
    const { env, conversatieId, propunereId } = await panaLaPropunere()
    const j = (await (await cere(env, `/stare?id=${conversatieId}&propunere=${propunereId}`)).json()) as {
      gata: boolean
      propunereStare: string
    }
    // ⚠️ `gata` E DEJA ADEVĂRAT (mesajul propunerii e al agentului): tocmai de aceea nu el e semnul
    expect(j.gata).toBe(true)
    expect(j.propunereStare).toBe('asteapta')
  })

  it('după „Da, fă-o" sondarea vede propunerea „facuta" și dă mesajul NOU', async () => {
    const { env, conversatieId, propunereId } = await panaLaPropunere()
    const c = (await (await cere(env, '/confirma', { propunereId, raspuns: 'da' })).json()) as { ok: boolean }
    expect(c.ok).toBe(true)

    const j = (await (await cere(env, `/stare?id=${conversatieId}&propunere=${propunereId}`)).json()) as {
      gata: boolean
      propunereStare: string
      raspuns: { text: string }
    }
    expect(j.propunereStare).toBe('facuta')
    expect(j.gata).toBe(true)
    expect(j.raspuns.text).toContain('Gata.')
  })

  it('după „Nu" propunerea e „refuzata", deci pagina nu se mai reîncarcă degeaba', async () => {
    const { env, conversatieId, propunereId } = await panaLaPropunere()
    await cere(env, '/confirma', { propunereId, raspuns: 'nu' })
    const j = (await (await cere(env, `/stare?id=${conversatieId}&propunere=${propunereId}`)).json()) as {
      propunereStare: string
    }
    expect(j.propunereStare).toBe('refuzata')
  })

  /** ⚠️ Fără `?propunere=`, răspunsul rămâne cel dinainte, literă cu literă: sondarea mesajelor nu se atinge. */
  it('fără `?propunere=`, răspunsul e neschimbat — nicio cheie în plus', async () => {
    const { env, conversatieId } = await panaLaPropunere()
    const j = (await (await cere(env, `/stare?id=${conversatieId}`)).json()) as Record<string, unknown>
    expect('propunereStare' in j).toBe(false)
  })

  it('aplicația duce `propunere` mai departe la creier, la sondare', async () => {
    const ajunse: string[] = []
    const env = {
      MEDIU: 'staging',
      SECRET_INTERN: 'secret',
      CONFIG: kvFals({ 'modul:chat': CONFIG_GLOBAL }),
      CHAT: {
        fetch: async (adresa: string) => {
          ajunse.push(new URL(adresa).search)
          return new Response('{}', { headers: { 'content-type': 'application/json' } })
        },
      } as unknown as Fetcher,
    }
    await modulChat({ aplicatie: 'program' }).ruteaza(
      new Request('https://program.test/chat/stare?id=c1&propunere=p9'),
      env as never,
      ctxExec,
      '/chat/stare',
      { prefix: '', principal: { userId: 'u1', email: 'p@example.ro', roles: [] } as never, numeleOmului: 'Om', eAdmin: true },
    )
    expect(ajunse[0]).toContain('id=c1')
    expect(ajunse[0]).toContain('propunere=p9')
  })

  /** Bula: fără rândurile astea, sondarea confirmării n-ar exista, oricât de bine ar răspunde serverul. */
  it('bula sondează confirmarea și nu mai spune „n-am putut trimite" peste o treabă făcută', () => {
    expect(JS_CHAT).toContain("'&propunere=' + encodeURIComponent(id)")
    expect(JS_CHAT).toContain("if (s === 'facuta') deReincarcat = true;")
    expect(JS_CHAT).not.toContain('Nu am putut trimite confirmarea.')
  })
})

// ---------------------------------------------------------------------------
// „GATA." PESTE UN LUCRU NEFĂCUT (user, 19.09.2026, 12:35)
// ---------------------------------------------------------------------------

/**
 * CE S-A ÎNTÂMPLAT, aflat din chat și din audit, nu ghicit: omul a schimbat titlul articolului
 * principal al nr. 616 (12:32:51Z), a cerut compunerea din bulă, a apăsat „Da" — și a citit
 * „Gata. Compun buletinul nr. 616 din 20 septembrie 2026: …". Foaia de pe ecran rămăsese însă cea
 * de dinainte: compunerea REFUZASE, fiindcă la randare rămâneau 64 de semne pe dinafară.
 *
 * Vina n-a fost a compunerii, care a răspuns cinstit `facut:false` cu plângerea ei, ci a
 * confirmării: `r.ok` spune că ACȚIUNEA a mers, nu că lumea s-a schimbat, iar `/confirma` le lua
 * drept unul și același lucru. Un refuz cuminte (cod 200, `facut:false`) trecea drept izbândă —
 * în bulă, în starea propunerii și în reîncărcarea ecranului.
 */
describe('confirmarea nu mai spune „Gata." peste o faptă nefăcută', () => {
  const REFUZ = 'Numărul 616 NU s-a compus, foaia rămâne cea de dinainte: la randare au rămas 64 de semne pe dinafară.'

  /**
   * Duce discuția până la „Da/Nu". Cu `refuza`, aplicația răspunde cum a răspuns buletinul pe
   * 19.09.2026: `ok:true` (acțiunea a mers) și `raport.facut:false` (foaia n-a fost scrisă).
   */
  async function panaLaRefuz(refuza = true) {
    const m = mediuCreier({
      modelul: (apel) => (apel === 1 ? cheamaUnealta('program__adauga_slujba') : vorba('Am pregătit-o.')),
      program: (_cale, prev) =>
        prev
          ? { ok: true, date: { rezumat: 'Compun buletinul nr. 616 din 20 septembrie 2026.' } }
          : refuza
            ? { ok: true, date: { facut: false }, raport: { facut: false, text: REFUZ } }
            : { ok: true, date: { facut: true } },
    })
    const pornit = (await (await cere(m.env, '/mesaj', { text: 'compune', aplicatie: 'program', asincron: true })).json()) as {
      conversatieId: string
      mesajId: string
    }
    await cere(m.env, '/lucreaza', { conversatieId: pornit.conversatieId, mesajId: pornit.mesajId, aplicatie: 'program' })
    const gata = (await (await cere(m.env, `/stare?id=${pornit.conversatieId}`)).json()) as {
      raspuns: { propunere: { id: string } | null }
    }
    return { ...m, conversatieId: pornit.conversatieId, propunereId: gata.raspuns.propunere!.id }
  }

  it('citește omului REFUZUL, cu cifra lui — nu „Gata." peste foaia neatinsă', async () => {
    const { env, propunereId } = await panaLaRefuz()
    const c = (await (await cere(env, '/confirma', { propunereId, raspuns: 'da' })).json()) as {
      ok: boolean
      text: string
      reincarca: boolean
    }
    expect(c.text).not.toContain('Gata.')
    expect(c.text).toContain('64 de semne')
    expect(c.text).toContain('NU s-a compus')
    // roșul lucrului nefăcut: bula scrie rândul cu `mesaj('rea', …)` doar când `ok` e fals
    expect(c.ok).toBe(false)
    // și ecranul nu se mai împrospătează degeaba: n-are peste ce
    expect(c.reincarca).toBe(false)
  })

  it('propunerea rămâne „refuzata", deci nici sondarea nu spune că s-a făcut', async () => {
    const { env, propuneri, propunereId } = await panaLaRefuz()
    await cere(env, '/confirma', { propunereId, raspuns: 'da' })
    expect(propuneri[0]!.stare).toBe('refuzata')
  })

  it('refuzul se scrie în discuție, ca omul să-l regăsească la reîncărcare', async () => {
    const { env, mesaje, propunereId } = await panaLaRefuz()
    await cere(env, '/confirma', { propunereId, raspuns: 'da' })
    expect(mesaje[mesaje.length - 1]!.text).toContain('64 de semne')
  })

  /** ⚠️ Plasa: o aplicație care nu trimite niciun raport rămâne cum era — „Gata." peste o izbândă. */
  it('fără raport în plic, izbânda se spune ca până acum', async () => {
    const { env, propunereId } = await panaLaRefuz(false)
    const c = (await (await cere(env, '/confirma', { propunereId, raspuns: 'da' })).json()) as {
      ok: boolean
      text: string
      reincarca: boolean
    }
    expect(c.ok).toBe(true)
    expect(c.reincarca).toBe(true)
    expect(c.text).toContain('Gata.')
  })
})
