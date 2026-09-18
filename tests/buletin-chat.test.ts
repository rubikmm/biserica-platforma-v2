/**
 * BULA DE CHAT A BULETINULUI (user, 18.09.2026: „când am făcut bula de chat AI am făcut-o să fie
 * transmisibilă. Deci să facem Buletinul să aibă această funcție și să fie afișată doar pe /nou —
 * când fac un buletin nou, ca să pot trimite instrucțiuni, texte etc. care să se lege la API-ul
 * buletinului nou și să-l completeze").
 *
 * Trei lucruri se pot strica TĂCUT, și de asta stau aici:
 *   1. **„doar pe /nou"** — o bulă scăpată pe paginile publice ale buletinului n-ar da nicio eroare:
 *      ar sta frumos în colț, la vederea oricui are cont, și ar costa bani la fiecare apăsare;
 *   2. **poarta** — dacă bula s-ar desena după alt criteriu decât cel după care răspund rutele
 *      `/chat…`, s-ar ajunge la una din două: buton mort, ori ușă deschisă fără buton;
 *   3. **umplerea ecranului din ciorna compusă** — dacă `/nou` s-ar deschide iar cu formularul gol,
 *      tot ce a compus chatul s-ar pierde exact în clipa reîncărcării de după „Da, fă-o".
 */
import { beforeEach, describe, expect, it } from 'vitest'
import buletin from '../apps/buletin/src/index.js'
import { actiuniBuletin } from '../apps/buletin/src/actiuni.js'
import { cheiaCererii, cheiaCopertei, cheiaNumarului, pastreazaNumarul } from '../apps/buletin/src/compune.js'
import { cheiaSchitei } from '../apps/buletin/src/schita.js'
import { cheiaBrosurii } from '../apps/buletin/src/tipar.js'
import { buletinulNou } from '../apps/buletin/src/pagini.js'
import { CE_VEDE_BULA, aplicatiileLegate } from '../services/chat-worker/src/index.js'
import { uitaConfigChat } from '../packages/chat/src/comutator.js'

// ---------------------------------------------------------------------------
// Serviciile de probă
// ---------------------------------------------------------------------------

const ULTIMUL = {
  nr: 615,
  data: '2026-09-06',
  an: '2026',
  luna: '09',
  cheie_pdf: '2026/buletin-615-2026-09-06.pdf',
  cheie_poza: null,
  cheie_poza_mica: null,
  marime_pdf: 700000,
  pagini: 4,
  text: '',
  titlu: null,
  sursa: 'v1',
}

/**
 * Numărul care urmează celui din arhivă. ⚠️ Se socotește CU ACEEAȘI regulă ca serverul (`buletinulNou`
 * peste ziua de azi), nu scris de mână: data lui atârnă de ziua în care rulează probele, iar socoteala
 * ei are probele ei (`duminicaNoua`). Aici se probează legătura, nu calendarul.
 */
const URMATOR = buletinulNou(ULTIMUL, new Date().toISOString().slice(0, 10)) as { nr: number; data: string }

const CERERE_PASTRATA = {
  motto: 'Rugăciunea este respirația sufletului.',
  motoAutor: 'Părintele Arsenie Papacioc',
  nr: URMATOR.nr,
  data: URMATOR.data,
  principal: {
    autor: 'SFÂNTUL IOAN GURĂ DE AUR',
    ani: '347-407',
    titlu: 'DESPRE RUGĂCIUNE',
    text: 'Rândul întâi al articolului scris de chat.',
    sursa: 'ziarullumina.ro',
  },
  secundari: [{ autor: 'FĂRĂ AUTOR', titlu: 'AL DOILEA', text: 'Text scurt.' }],
  floare: true,
}

/** Schița numărului, cum o lasă chestionarul din bulă — ea e ce arată ecranul `/nou`. */
const SCHITA_PASTRATA = {
  nr: URMATOR.nr,
  data: URMATOR.data,
  motto: 'Rugăciunea este respirația sufletului.',
  motoAutor: 'Părintele Arsenie Papacioc',
  principal: {
    autor: 'SFÂNTUL IOAN GURĂ DE AUR',
    ani: '347-407',
    titlu: 'DESPRE RUGĂCIUNE',
    text: 'Rândul întâi al articolului scris de chat.',
    sursa: 'ziarullumina.ro',
    gata: ['text', 'autor', 'ani', 'titlu', 'sursa'],
  },
  secundari: [{ autor: 'FĂRĂ AUTOR', titlu: 'AL DOILEA', text: 'Text scurt.' }],
  gata: ['motto'],
  actualizat: '2026-09-18T20:00:00.000Z',
}

/** D1, cât îi trebuie paginii: ultimul număr și numărătoarea anilor. */
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
      const legat = {
        bind: () => legat,
        async first() { return r.first },
        async all() { return { results: r.results } },
      }
      return legat
    },
  } as unknown as D1Database
}

/**
 * R2, cu obiectele pe care le are numărul: `cu` spune ce e în depozit.
 * ⚠️ `head` întoarce și `httpEtag`: din el iese amprenta randării (`?v=`), fără care browserul ar
 * arăta foaia dinainte.
 */
function r2Fals(cu: Record<string, unknown>) {
  const obiect = (cheie: string) => ({
    key: cheie,
    size: 731717,
    httpEtag: '"abc123"',
    async json() { return cu[cheie] },
    async text() { return JSON.stringify(cu[cheie]) },
  })
  return {
    async head(cheie: string) { return cheie in cu ? obiect(cheie) : null },
    async get(cheie: string) { return cheie in cu ? obiect(cheie) : null },
    async list() { return { objects: Object.keys(cu).filter((k) => k.startsWith('compus/')).map((k) => ({ key: k })) } },
    async put() { return { httpEtag: '"pus"' } },
    async delete() { return undefined },
  } as unknown as R2Bucket
}

const SESIUNE = {
  authenticated: true,
  user: {
    id: 'u1', email: 'parintele@example.com', displayName: 'Părintele',
    firstName: null, lastName: null, phone: null, shortName: null,
    emailVerifiedAt: null, disabledAt: null, createdAt: '2026-01-01T00:00:00.000Z',
  },
  roles: [{ role: 'user', scope: 'global' }],
  sessionId: 's1',
  expiresAt: null,
  veziCa: null,
  poateVedeaCa: false,
}

const CONFIG_PORNIT = {
  activ: true,
  aplicatii: { program: true, buletin: true },
  cineVede: 'admini',
  model: '@cf/zai-org/glm-5.3-flash',
  creier: 'workers-ai',
  indrumari: '',
  unelte: ['buletin.compune', 'buletin.socoteala'],
}

function mediu(o: { config?: unknown; cheiOmului?: string[]; depozit?: Record<string, unknown>; faraChat?: boolean } = {}) {
  const chei = o.cheiOmului ?? ['bulletin.write', 'bulletin.publish']
  const ajunseLaCreier: string[] = []
  const env = {
    MEDIU: 'staging',
    ORIGINE_PUBLICA: 'https://buletin.staging.sfantul-ilie.ro',
    DOMENIU_COOKIE: '.staging.sfantul-ilie.ro',
    EMAIL_SUPERADMIN: 'rubikmm@gmail.com',
    SECRET_INTERN: 'secret',
    DB: dbFals(),
    FISIERE: r2Fals(o.depozit ?? {}),
    IDENTITATE: { fetch: async () => new Response(JSON.stringify(SESIUNE), { headers: { 'content-type': 'application/json' } }) },
    AUTORIZARE: {
      fetch: async (_a: string, init?: RequestInit) => {
        const c = JSON.parse(String(init?.body ?? '{}')) as { permission?: string }
        return new Response(JSON.stringify({ allowed: chei.includes(c.permission ?? ''), reason: 'probă', matchedScopes: [] }), {
          headers: { 'content-type': 'application/json' },
        })
      },
    },
    AUDIT: { fetch: async () => new Response('{}') },
    COMUNICARE: { fetch: async () => new Response(JSON.stringify({ membri: [] }), { headers: { 'content-type': 'application/json' } }) },
    // programul: tabelul de pe pagina a patra
    PROGRAM: {
      fetch: async () =>
        new Response(JSON.stringify({ titlu: '14 – 20 septembrie 2026', slujbe: 6, detalii: 5, stare: 'validat', rânduri: [] }), {
          headers: { 'content-type': 'application/json' },
        }),
    },
    BROWSER: { fetch: async () => new Response('{}') },
    ...(o.faraChat ? {} : { CHAT: { fetch: async (adresa: string) => { ajunseLaCreier.push(new URL(adresa).pathname); return new Response(JSON.stringify({ conversatieId: 'c1', text: 'Am înțeles.', obiecte: [], propunere: null, unelte: [] }), { headers: { 'content-type': 'application/json' } }) } } }),
    MEDIA: { fetch: async () => new Response('nimic', { status: 404 }) },
    CONFIG: { get: async () => (o.config === undefined ? CONFIG_PORNIT : o.config) },
  }
  return { env, ajunseLaCreier }
}

// ⚠️ Comutatoarele se țin un minut în memoria modulului: fără uitarea asta, o probă ar citi
// configurația probei dinainte și ar trece (ori ar cădea) pe o cauză care nu e a ei.
beforeEach(() => uitaConfigChat())

const ctxExec = { waitUntil: () => undefined, passThroughOnException: () => undefined } as unknown as ExecutionContext

const cere = (env: unknown, cale: string, init: RequestInit = {}) =>
  buletin.fetch(
    new Request(`https://buletin.staging.sfantul-ilie.ro${cale}`, {
      ...init,
      headers: { cookie: 'xc_sesiune=jeton-de-proba', ...(init.headers ?? {}) },
    }),
    env as never,
    ctxExec,
  )

// ---------------------------------------------------------------------------
// „Doar pe /nou"
// ---------------------------------------------------------------------------

describe('bula de chat a buletinului — numai pe ecranul numărului nou', () => {
  it('se vede pe `/nou`, la cine ține buletinul', async () => {
    const { env } = mediu()
    const text = await (await cere(env, '/nou')).text()
    expect(text).toContain('id="xc-chat"')
    // titlul cerut în modul, ca să se știe ce face bula asta
    expect(text).toContain('Scrie buletinul')
  })

  it('⚠️ NU se vede pe prima pagină, nici pe pagina unui număr — acolo e hârtie publică', async () => {
    const { env } = mediu()
    for (const cale of ['/', '/arhiva', '/buletin/615-2026-09-06']) {
      const text = await (await cere(env, cale)).text()
      expect(text, cale).not.toContain('id="xc-chat"')
    }
  })

  it('nu se vede dacă buletinul nu e bifat în Module', async () => {
    const { env } = mediu({ config: { ...CONFIG_PORNIT, aplicatii: { program: true } } })
    expect(await (await cere(env, '/nou')).text()).not.toContain('id="xc-chat"')
  })

  it('nu se vede dacă modulul e stins de tot', async () => {
    const { env } = mediu({ config: { ...CONFIG_PORNIT, activ: false } })
    expect(await (await cere(env, '/nou')).text()).not.toContain('id="xc-chat"')
  })

  it('nu se vede fără creier legat, oricât ar fi pornit comutatorul', async () => {
    const { env } = mediu({ faraChat: true })
    expect(await (await cere(env, '/nou')).text()).not.toContain('id="xc-chat"')
  })
})

// ---------------------------------------------------------------------------
// Poarta rutelor — aceeași cu a bulei
// ---------------------------------------------------------------------------

describe('rutele chatului din buletin', () => {
  it('duc mesajul la creier când omul ține buletinul', async () => {
    const { env, ajunseLaCreier } = mediu()
    const r = await cere(env, '/chat/mesaj', {
      method: 'POST',
      // ⚠️ `origin` ca la browser: bariera de origine a aplicației e ÎNAINTEA rutelor chatului, deci
      // fără antetul ăsta proba ar cădea pe 403 și n-ar spune nimic despre poarta pe care o probează.
      headers: { 'content-type': 'application/json', origin: 'https://buletin.staging.sfantul-ilie.ro' },
      body: JSON.stringify({ text: 'compune numărul următor' }),
    })
    expect(r.status).toBe(200)
    expect(ajunseLaCreier).toEqual(['/mesaj'])
  })

  /** ⚠️ 404, nu 403: pentru cine n-are voie, modulul nu există — nu se află nici că e stins. */
  it('răspund 404 cui nu ține buletinul, și nu ajunge nimic la creier', async () => {
    const { env, ajunseLaCreier } = mediu({ cheiOmului: [] })
    const r = await cere(env, '/chat/mesaj', {
      method: 'POST',
      // ⚠️ `origin` ca la browser: bariera de origine a aplicației e ÎNAINTEA rutelor chatului, deci
      // fără antetul ăsta proba ar cădea pe 403 și n-ar spune nimic despre poarta pe care o probează.
      headers: { 'content-type': 'application/json', origin: 'https://buletin.staging.sfantul-ilie.ro' },
      body: JSON.stringify({ text: 'compune numărul următor' }),
    })
    expect(r.status).toBe(404)
    expect(ajunseLaCreier).toEqual([])
  })

  it('răspund 404 și când modulul e stins din Module', async () => {
    const { env, ajunseLaCreier } = mediu({ config: { ...CONFIG_PORNIT, aplicatii: {} } })
    const r = await cere(env, '/chat/mesaj', {
      method: 'POST',
      // ⚠️ `origin` ca la browser: bariera de origine a aplicației e ÎNAINTEA rutelor chatului, deci
      // fără antetul ăsta proba ar cădea pe 403 și n-ar spune nimic despre poarta pe care o probează.
      headers: { 'content-type': 'application/json', origin: 'https://buletin.staging.sfantul-ilie.ro' },
      body: JSON.stringify({ text: 'ceva' }),
    })
    expect(r.status).toBe(404)
    expect(ajunseLaCreier).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Ecranul se umple din ce s-a compus și din ce s-a răspuns în chat
// ---------------------------------------------------------------------------

describe('`/nou` se deschide cu ciorna compusă și cu schița din chat', () => {
  const depozitCuCiorna = {
    [cheiaNumarului(URMATOR)]: null,
    [cheiaCopertei(URMATOR)]: null,
    [cheiaCererii(URMATOR)]: CERERE_PASTRATA,
    [cheiaSchitei(URMATOR)]: SCHITA_PASTRATA,
    [`compus/2026/buletin-${URMATOR.nr}-${URMATOR.data}.json`]: CERERE_PASTRATA,
  }

  /**
   * ⚠️ Din 18.09.2026, seara, ecranul ARATĂ schița, nu o editează: formularul a ieșit cu totul, iar
   * completările trec prin bulă. Ce se probează aici e că răspunsurile din chat se văd la
   * reîncărcare — fără asta, tot ce s-a răspuns ar părea pierdut după „Da, fă-o".
   */
  it('arată schița strânsă din chat, numai de citit', async () => {
    const { env } = mediu({ depozit: depozitCuCiorna })
    const text = await (await cere(env, '/nou')).text()
    expect(text).toContain('<section class="schita">')
    expect(text).toContain('SFÂNTUL IOAN GURĂ DE AUR')
    expect(text).toContain('DESPRE RUGĂCIUNE')
    expect(text).toContain('Rândul întâi al articolului scris de chat.')
    expect(text).toContain('Rugăciunea este respirația sufletului.')
    // și articolul secundar, cu numele lui
    expect(text).toContain('Articolul secundar 1')
    // niciun câmp de scris: totul trece prin bulă
    expect(text).not.toContain('name="p_text"')
    expect(text).not.toContain('value="compune"')
  })

  it('arată ciorna cu butoanele ei și cu amprenta randării', async () => {
    const { env } = mediu({ depozit: depozitCuCiorna })
    const text = await (await cere(env, '/nou')).text()
    expect(text).toContain('<section class="ciorna">')
    expect(text).toContain(`${cheiaNumarului(URMATOR)}?v=abc123`)
    expect(text).toContain('Validează')
  })

  it('fără nimic în depozit, ecranul spune că nu s-a început nimic', async () => {
    const { env } = mediu()
    const text = await (await cere(env, '/nou')).text()
    expect(text).not.toContain('<section class="ciorna">')
    expect(text).toContain('Se completează din chat')
    expect(text).toContain('Niciun articol încă')
  })

  it('rămâne al adminilor buletinului: fără cheie, 403', async () => {
    const { env } = mediu({ cheiOmului: [] })
    expect((await cere(env, '/nou')).status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// Întrebările chestionarului, salvate din Setări
// ---------------------------------------------------------------------------

/**
 * ⚠️ Ruta asta scrie în KV o cheie pe care o citește apoi FIECARE mesaj al bulei. Cele două lucruri
 * care se pot strica tăcut: paza (oricine ar putea rescrie întrebările parohiei) și butonul
 * „Înapoi la textele standard" — dacă ar SCRIE standardul în loc să golească cheia, o îndreptare
 * din cod n-ar mai ajunge niciodată la parohie.
 */
describe('POST /setari/chestionar', () => {
  const CSRF = 'jeton-csrf-de-proba'
  function cuKv(o: Parameters<typeof mediu>[0] = {}) {
    const scrise = new Map<string, string>()
    const sterse: string[] = []
    const { env } = mediu(o)
    return {
      scrise,
      sterse,
      env: {
        ...env,
        CONFIG: {
          get: env.CONFIG.get,
          put: async (cheie: string, val: string) => { scrise.set(cheie, val) },
          delete: async (cheie: string) => { sterse.push(cheie) },
        },
      },
    }
  }
  const trimite = (env: unknown, corp: Record<string, string>) =>
    cere(env, '/setari/chestionar', {
      method: 'POST',
      headers: {
        origin: 'https://buletin.staging.sfantul-ilie.ro',
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `xc_sesiune=jeton-de-proba; xc_csrf=${CSRF}`,
      },
      body: new URLSearchParams(corp).toString(),
    })

  it('scrie în KV numai întrebările schimbate, și duce înapoi la Setări', async () => {
    const { env, scrise } = cuKv()
    const r = await trimite(env, { csrf: CSRF, fapta: 'salveaza', autor: 'Zic eu că e {autor}?', titlu: '' })
    expect(r.status).toBe(303)
    expect(r.headers.get('location')).toContain('chestionar=salvat')
    const scris = JSON.parse(scrise.get('buletin:chestionar')!) as Record<string, string>
    expect(scris.autor).toBe('Zic eu că e {autor}?')
    // câmpul gol nu devine o întrebare goală: înseamnă „ține textul standard"
    expect(scris.titlu).toBeUndefined()
  })

  it('„Înapoi la textele standard" GOLEȘTE cheia, nu scrie standardul în ea', async () => {
    const { env, scrise, sterse } = cuKv()
    const r = await trimite(env, { csrf: CSRF, fapta: 'standard' })
    expect(r.status).toBe(303)
    expect(sterse).toEqual(['buletin:chestionar'])
    expect(scrise.size).toBe(0)
  })

  it('fără jeton CSRF pereche, nu se scrie nimic', async () => {
    const { env, scrise } = cuKv()
    const r = await trimite(env, { csrf: 'altceva', fapta: 'salveaza', autor: 'x' })
    expect(r.headers.get('location')).toContain('chestionar=rau')
    expect(scrise.size).toBe(0)
  })

  it('cine nu ține buletinul nu poate scrie întrebările lui', async () => {
    const { env, scrise } = cuKv({ cheiOmului: [] })
    await trimite(env, { csrf: CSRF, fapta: 'salveaza', autor: 'x' })
    expect(scrise.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Numărul nu se ghicește: îl ia arhiva
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

describe('nr. și data nu vin de la model, ci din arhivă', () => {
  it('socoteala fără nr/data socotește numărul care urmează', async () => {
    const { env } = mediu()
    const r = (await actiunea('buletin.socoteala').executa(
      { motto: '', principal: { text: 'ceva' } } as never,
      ctxActiune(env) as never,
    )) as { nr: number; data: string }
    expect(r.nr).toBe(URMATOR.nr)
    expect(r.data).toBe(URMATOR.data)
  })

  /**
   * ⚠️ Rezumatul e ce citește omul în propunerea cu Da/Nu. Dacă ar scrie alt număr decât cel care se
   * compune, omul ar aproba una și s-ar face alta — iar PDF-ul se scrie sub cheia numărului.
   */
  it('rezumatul propunerii spune numărul adevărat, luat din arhivă', async () => {
    const { env } = mediu()
    const rezumat = await actiunea('buletin.compune').rezuma!(
      { motto: 'Un motto.', principal: { autor: 'AUTOR', titlu: 'TITLU', text: 'Text.' } } as never,
      ctxActiune(env) as never,
    )
    expect(rezumat).toContain(`nr. ${URMATOR.nr}`)
    expect(rezumat).toContain(cheiaNumarului(URMATOR))
  })

  /** Numărul cerut ANUME rămâne cu putere: „compune 620" nu trebuie să devină tăcut „616". */
  it('numărul scris anume nu se rescrie cu cel din arhivă', async () => {
    const { env } = mediu()
    const rezumat = await actiunea('buletin.compune').rezuma!(
      { motto: 'Un motto.', nr: 620, data: '2026-11-01', principal: { autor: 'A', titlu: 'T', text: 'x' } } as never,
      ctxActiune(env) as never,
    )
    expect(rezumat).toContain('nr. 620')
  })
})

// ---------------------------------------------------------------------------
// Fiecare bulă vede numai ce-i trebuie
// ---------------------------------------------------------------------------

describe('ce aplicații vede bula fiecărei aplicații', () => {
  const env = { PROGRAM: {}, CALENDAR: {}, TIPIC: {}, BULETIN: {} } as never

  /**
   * ⚠️ ȘI CALENDARUL, din 18.09.2026: foaia se scrie despre sfântul zilei, iar pomenirea lui se caută
   * în calendar. Fără el, bula buletinului n-avea de unde ști cine se prăznuiește duminica ce vine —
   * și un model mic, întrebat fără unealtă, ghicește. Programul și tipicul rămân pe dinafară: de
   * acelea nu se leagă nimic din foaie.
   */
  it('bula buletinului vede buletinul și calendarul — nu programul, nu tipicul', () => {
    const vazute = aplicatiileLegate(env, 'buletin').map((a) => a.nume)
    expect(vazute).toEqual(['calendar', 'buletin'])
    expect(vazute).not.toContain('program')
    expect(vazute).not.toContain('tipic')
  })

  /**
   * ⚠️ Altfel regulile și măsurile buletinului (cunoștințe de FUNDAL, cerute la fiecare mesaj) ar
   * intra în contextul programului — plătite la fiecare apăsare, despre o treabă care nu e a lui.
   */
  it('bula programului vede programul, calendarul și tipicul — nu buletinul', () => {
    const vazute = aplicatiileLegate(env, 'program').map((a) => a.nume)
    expect(vazute).toEqual(['program', 'calendar', 'tipic'])
    expect(vazute).not.toContain('buletin')
  })

  it('o aplicație fără rând în registru vede tot, ca până acum — un chat nou nu rămâne mut', () => {
    expect(CE_VEDE_BULA['tipic']).toBeUndefined()
    expect(aplicatiileLegate(env, 'tipic').map((a) => a.nume)).toEqual(['program', 'calendar', 'tipic', 'buletin'])
  })
})

// ---------------------------------------------------------------------------
// Ce rămâne în depozit după o compunere
// ---------------------------------------------------------------------------

/**
 * ⚠️ PĂȚIT PE 18.09.2026 (user: „a zis că Compune buletinul după o modificare și nu se vede nimic —
 * ar trebui să se regenereze și imaginea… și fișierele PDF").
 *
 * Erau DOUĂ drumuri către aceeași treabă: ruta formularului punea PDF-ul, COPERTA, cererea păstrată
 * și arunca broșurile vechi; acțiunea `buletin.compune` — cea prin care lucrează chatul — punea
 * numai PDF-ul. Deci un număr recompus din bulă arăta coperta dinainte (ori niciuna), iar
 * „Tipărește" dădea broșura foii vechi. **Nimic nu dădea vreo eroare.**
 *
 * De atunci treaba stă într-un singur loc, `pastreazaNumarul`, iar probele astea îl păzesc.
 */
describe('pastreazaNumarul — un singur loc pentru amândouă drumurile', () => {
  const CERUT = {
    motto: 'Un motto.',
    nr: 616,
    data: '2026-09-20',
    principal: { autor: 'AUTOR', titlu: 'TITLU', text: 'Text.' },
    floare: true,
  } as never

  function depozitCareTineMinte() {
    const puse = new Map<string, { corp: unknown; tip?: string }>()
    const sterse: string[] = []
    const FISIERE = {
      async put(cheie: string, corp: unknown, o?: { httpMetadata?: { contentType?: string } }) {
        puse.set(cheie, { corp, tip: o?.httpMetadata?.contentType })
        return { httpEtag: '"etag-nou"' }
      },
      async delete(cheie: string | string[]) {
        for (const c of Array.isArray(cheie) ? cheie : [cheie]) sterse.push(c)
      },
    } as unknown as R2Bucket
    return { env: { FISIERE }, puse, sterse }
  }

  const pdf = new ArrayBuffer(1234)
  const poza = new ArrayBuffer(99)

  it('pune PDF-ul ȘI coperta, păstrează cererea, și aruncă broșurile vechi', async () => {
    const { env, puse, sterse } = depozitCareTineMinte()
    const r = await pastreazaNumarul(env, { cerut: CERUT, pdf, coperta: poza })

    expect(puse.get(cheiaNumarului(CERUT))?.tip).toBe('application/pdf')
    expect(puse.get(cheiaCopertei(CERUT))?.tip).toBe('image/jpeg')
    expect(puse.has(cheiaCererii(CERUT))).toBe(true)
    // broșurile: toate patru, ca „Tipărește" să nu dea foaia dinainte
    expect(sterse).toEqual(
      expect.arrayContaining([
        cheiaBrosurii(cheiaNumarului(CERUT), 'a4', false),
        cheiaBrosurii(cheiaNumarului(CERUT), 'a4', true),
        cheiaBrosurii(cheiaNumarului(CERUT), 'a3', false),
        cheiaBrosurii(cheiaNumarului(CERUT), 'a3', true),
      ]),
    )
    // amprenta randării, din etag: fără ea browserul ar arăta foaia veche sub aceeași adresă
    expect(r.versiune).toBe('etag-nou')
    expect(r.cheiePoza).toBe(cheiaCopertei(CERUT))
    expect(r.marime).toBe(1234)
  })

  it('fără copertă nouă, o ȘTERGE pe cea veche — o poză rămasă ar arăta un număr care nu mai e', async () => {
    const { env, puse, sterse } = depozitCareTineMinte()
    const r = await pastreazaNumarul(env, { cerut: CERUT, pdf, coperta: null })
    expect(puse.has(cheiaCopertei(CERUT))).toBe(false)
    expect(sterse).toContain(cheiaCopertei(CERUT))
    expect(r.cheiePoza).toBeNull()
  })

  it('un depozit fără etag tot dă o amprentă — altfel adresa ar rămâne aceeași', async () => {
    const FISIERE = {
      async put() { return undefined },
      async delete() { return undefined },
    } as unknown as R2Bucket
    const r = await pastreazaNumarul({ FISIERE }, { cerut: CERUT, pdf })
    expect(r.versiune).not.toBe('')
  })
})
