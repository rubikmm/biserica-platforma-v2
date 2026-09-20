/**
 * RETRAGEREA (NE-PUBLICAREA) UNUI NUMĂR — user, 20.09.2026: „trebuie să avem și buton de
 * ne-publicare — dacă s-a publicat greșit — și să poată face asta și chat-ul."
 *
 * E inversul exact al validării, și de aceea e fapta cea mai periculoasă a buletinului: șterge un
 * rând din arhiva parohiei. Patru lucruri se pot strica TĂCUT, și de asta stă fiecare probă aici:
 *
 *   1. **cui i se arată butonul** — un „Retrage" scăpat pe un număr din 2014 ar fi o ușă deschisă
 *      peste arhiva adusă din V1, care nu se îndreaptă de aici. Nimic nu s-ar vedea până la apăsare;
 *   2. **ce se șterge** — RÂNDUL, nu fișierele. O ștergere care ar lua și PDF-ul ar face din
 *      retragere o pierdere: omul a cerut să îndrepte numărul, nu să-l scrie din nou;
 *   3. **unde se întoarce numărul** — sub CHEIA LUI de dinainte (`schita/616-2026-09-20.json`).
 *      Dacă `/nou` ar socoti mai departe ziua din calendar, un număr retras luni ar cere 616 pe
 *      duminica următoare, iar schița tocmai refăcută ar rămâne orfană în depozit — fără nicio
 *      eroare nicăieri;
 *   4. **ținta chatului** — bula stă numai pe `/nou`, deci numărul tocmai publicat NU mai e „cel
 *      următor". Acțiunea trebuie să-și afle singură ținta: numărul CURENT din arhivă;
 *   5. **cu ce se întoarce numărul** — ÎNTREG, cu adresele pozelor. De aceea schița nu se mai
 *      șterge la validare, ci se pune deoparte (`schita/arhiva/…`): refăcută din cererea păstrată,
 *      ea pierde adresa pozei (cererea ține doar `poza: true/false`), iar omul ar recompune numărul
 *      cu locul pozei gol, fără nicio eroare nicăieri.
 */
import { describe, expect, it } from 'vitest'
import buletin from '../apps/buletin/src/index.js'
import { actiuniBuletin, deRetras, retrageNumarul } from '../apps/buletin/src/actiuni.js'
import { cheiaCererii, cheiaCopertei, cheiaNumarului } from '../apps/buletin/src/compune.js'
import { type Schita, cheiaSchitei, cheiaSchiteiArhivate } from '../apps/buletin/src/schita.js'
import {
  type Ctx,
  type Meniu,
  buletinulNou,
  paginaAcasa,
  paginaBuletin,
  urmatorulCuSchita,
} from '../apps/buletin/src/pagini.js'
import type { Buletin } from '../apps/buletin/src/depozit.js'

// ---------------------------------------------------------------------------
// Numerele de probă
// ---------------------------------------------------------------------------

/** Numărul PUBLICAT DE AICI — singurul fel de număr care se poate retrage. */
const AL_NOSTRU: Buletin & { text: string } = {
  nr: 616,
  data: '2026-09-20',
  an: '2026',
  luna: '09',
  cheie_pdf: '2026/buletin-616-2026-09-20.pdf',
  cheie_poza: '2026/buletin-616-2026-09-20.jpg',
  cheie_poza_mica: '2026/buletin-616-2026-09-20.jpg',
  marime_pdf: 731717,
  pagini: 4,
  sursa: 'site',
  text: 'Textul numărului 616.',
}

/** Un număr adus din arhiva parohiei (V1). Nu se retrage de nicăieri. */
const DIN_ARHIVA: Buletin & { text: string } = {
  nr: 615,
  data: '2026-09-06',
  an: '2026',
  luna: '09',
  cheie_pdf: '2026/buletin-615-2026-09-06.pdf',
  cheie_poza: null,
  cheie_poza_mica: null,
  marime_pdf: 700000,
  pagini: 4,
  sursa: 'arhiva',
  text: 'Textul numărului 615.',
}

/** Ce a scris omul la ultima compunere — din ea se reface schița la retragere. */
const CEREREA = {
  motto: 'Rugăciunea este respirația sufletului.',
  motoAutor: 'Părintele Arsenie Papacioc',
  nr: 616,
  data: '2026-09-20',
  principal: {
    autor: 'SFÂNTUL IOAN GURĂ DE AUR',
    ani: '347-407',
    titlu: 'DESPRE RUGĂCIUNE',
    semnatura: 'Text de: Părintele Mihail Stanciu',
    text: 'Rândul întâi al articolului publicat greșit.',
    sursa: 'ziarullumina.ro',
    poza: true,
  },
  secundari: [{ autor: 'FĂRĂ AUTOR', titlu: 'AL DOILEA', text: 'Text scurt.', poza: false }],
  floare: true,
}

/**
 * SCHIȚA DE LA CARE A IEȘIT NUMĂRUL — cea de pe masa de lucru, la clipa validării.
 *
 * ⚠️ De ce stă aici, lângă cerere: ele DIFERĂ, și tocmai deosebirea e rostul arhivării. Cererea
 * ține `poza: true` (atâta îi trebuie foii: da/nu), schița ține ADRESA. Un număr retras pe drumul
 * cererii se întoarce cu locul pozei gol, fără nicio eroare nicăieri — de aceea schița se pune
 * deoparte la publicare, și de aceea retragerea o caută pe ea întâi.
 */
const POZA = 'https://media.sfantul-ilie.ro/poze/sfantul-ioan-gura-de-aur.jpg'

const SCHITA_CU_POZA: Schita = {
  nr: 616,
  data: '2026-09-20',
  motto: CEREREA.motto,
  motoAutor: CEREREA.motoAutor,
  principal: {
    autor: 'SFÂNTUL IOAN GURĂ DE AUR',
    ani: '347-407',
    titlu: 'DESPRE RUGĂCIUNE',
    semnatura: 'Text de: Părintele Mihail Stanciu',
    text: 'Rândul întâi al articolului publicat greșit.',
    sursa: 'ziarullumina.ro',
    poza: POZA,
    gata: ['text', 'autor', 'ani', 'pomenire', 'titlu', 'sursa'],
  },
  secundari: [
    { titlu: 'AL DOILEA', text: 'Text scurt.', gata: ['text', 'autor', 'ani', 'pomenire', 'titlu', 'sursa'] },
  ],
  gata: ['motto', 'mai_adaugam'],
  pas: { subiect: 'gata', articol: 's1' },
  actualizat: '2026-09-20T09:00:00.000Z',
}

// ---------------------------------------------------------------------------
// D1 și R2 de probă — o tabelă adevărată, ca ștergerea să se poată vedea
// ---------------------------------------------------------------------------

/**
 * Tabela `buletine`, cât îi trebuie retragerii: numerele se țin într-un șir, iar `DELETE` chiar
 * scoate rândul. ⚠️ Fără asta proba n-ar spune nimic: un D1 care răspunde mereu la fel ar trece și
 * dacă ștergerea n-ar face nimic.
 */
function dbFals(randuri: Array<Buletin & { text: string }>) {
  const stare = { randuri: [...randuri] }
  const ordonate = () =>
    [...stare.randuri].sort((a, b) => (a.data === b.data ? b.nr - a.nr : a.data < b.data ? 1 : -1))
  const prepare = (sql: string) => {
    const s = sql.replace(/\s+/g, ' ').trim()
    let legat: unknown[] = []
    const eu = {
      bind: (...a: unknown[]) => {
        legat = a
        return eu
      },
      async first() {
        if (s.startsWith('SELECT COUNT(*)')) {
          return { buletine: stare.randuri.length, ani: 1, ultimul: ordonate()[0]?.data ?? null }
        }
        if (s.includes('WHERE nr = ?1 AND data = ?2')) {
          return stare.randuri.find((r) => r.nr === legat[0] && r.data === legat[1]) ?? null
        }
        if (s.includes('WHERE data < ?2')) {
          return ordonate().find((r) => r.data < String(legat[1]) || (r.data === legat[1] && r.nr < Number(legat[0]))) ?? null
        }
        if (s.includes('WHERE data > ?2')) {
          return (
            [...ordonate()].reverse().find((r) => r.data > String(legat[1]) || (r.data === legat[1] && r.nr > Number(legat[0]))) ?? null
          )
        }
        if (s.includes('ORDER BY data DESC, nr DESC LIMIT 1')) return ordonate()[0] ?? null
        return null
      },
      async all() {
        if (s.includes('GROUP BY an')) {
          const ani = [...new Set(stare.randuri.map((r) => r.an))].sort().reverse()
          return { results: ani.map((an) => ({ an, cate: stare.randuri.filter((r) => r.an === an).length })) }
        }
        if (s.includes('WHERE an = ?1')) return { results: ordonate().filter((r) => r.an === legat[0]) }
        if (s.includes('ORDER BY data DESC, nr DESC LIMIT ?1')) return { results: ordonate().slice(0, Number(legat[0])) }
        return { results: [] }
      },
      async run() {
        // Publicarea (`scrieBuletin`) — ca drumul întreg „validez, apoi retrag" să se poată proba
        if (s.startsWith('INSERT OR REPLACE INTO buletine')) {
          const [nr, data, an, luna, pdf, poza, pozaMica, marime, pagini, text] = legat as [
            number, string, string, string, string, string | null, string | null, number, number, string,
          ]
          stare.randuri = [
            ...stare.randuri.filter((r) => !(r.nr === nr && r.data === data)),
            {
              nr, data, an, luna,
              cheie_pdf: pdf, cheie_poza: poza, cheie_poza_mica: pozaMica,
              marime_pdf: marime, pagini, sursa: 'site', text,
            },
          ]
          return { meta: { changes: 1 } }
        }
        if (s.startsWith('DELETE FROM buletine')) {
          const inainte = stare.randuri.length
          // ⚠️ `sursa = 'site'` e în SQL-ul adevărat: proba îl ține, ca încuietoarea să se vadă
          stare.randuri = stare.randuri.filter(
            (r) => !(r.nr === legat[0] && r.data === legat[1] && r.sursa === 'site'),
          )
          return { meta: { changes: inainte - stare.randuri.length } }
        }
        return { meta: { changes: 0 } }
      },
    }
    return eu
  }
  return { stare, db: { prepare } as unknown as D1Database }
}

/** R2 cu `list` care ÎNȚELEGE prefixul: de el atârnă găsirea schiței retrase. */
function r2Fals(inceput: Record<string, unknown> = {}) {
  const depozit = new Map<string, unknown>(Object.entries(inceput))
  const obiect = (cheie: string) => ({
    key: cheie,
    size: 731717,
    httpEtag: '"abc123"',
    async json() {
      return depozit.get(cheie)
    },
    async text() {
      return JSON.stringify(depozit.get(cheie))
    },
    async arrayBuffer() {
      return new ArrayBuffer(8)
    },
  })
  const bucket = {
    async head(cheie: string) {
      return depozit.has(cheie) ? obiect(cheie) : null
    },
    async get(cheie: string) {
      return depozit.has(cheie) ? obiect(cheie) : null
    },
    async list(o?: { prefix?: string }) {
      const p = o?.prefix ?? ''
      return { objects: [...depozit.keys()].filter((k) => k.startsWith(p)).map((k) => ({ key: k })) }
    },
    async put(cheie: string, val: unknown) {
      depozit.set(cheie, typeof val === 'string' ? JSON.parse(val) : val)
      return { httpEtag: '"pus"' }
    },
    async delete(cheie: string | string[]) {
      for (const k of Array.isArray(cheie) ? cheie : [cheie]) depozit.delete(k)
      return undefined
    },
  }
  return { depozit, bucket: bucket as unknown as R2Bucket }
}

/** Depozitul unui număr publicat: foaia, coperta și cererea păstrată lângă ele. */
const DEPOZITUL_LUI = () => ({
  [cheiaNumarului(AL_NOSTRU)]: null,
  [cheiaCopertei(AL_NOSTRU)]: null,
  [cheiaCererii(AL_NOSTRU)]: CEREREA,
})

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

function mediu(o: { randuri?: Array<Buletin & { text: string }>; depozit?: Record<string, unknown>; chei?: string[] } = {}) {
  const chei = o.chei ?? ['bulletin.write', 'bulletin.publish']
  const { stare, db } = dbFals(o.randuri ?? [DIN_ARHIVA, AL_NOSTRU])
  const { depozit, bucket } = r2Fals(o.depozit ?? DEPOZITUL_LUI())
  const auditate: Array<{ action: string; target: string; outcome: string; summary: Record<string, unknown> }> = []
  const env = {
    MEDIU: 'staging',
    ORIGINE_PUBLICA: 'https://buletin.staging.sfantul-ilie.ro',
    DOMENIU_COOKIE: '.staging.sfantul-ilie.ro',
    EMAIL_SUPERADMIN: 'rubikmm@gmail.com',
    SECRET_INTERN: 'secret',
    DB: db,
    FISIERE: bucket,
    IDENTITATE: { fetch: async () => new Response(JSON.stringify(SESIUNE), { headers: { 'content-type': 'application/json' } }) },
    AUTORIZARE: {
      fetch: async (_a: string, init?: RequestInit) => {
        const c = JSON.parse(String(init?.body ?? '{}')) as { permission?: string }
        return new Response(JSON.stringify({ allowed: chei.includes(c.permission ?? ''), reason: 'probă', matchedScopes: [] }), {
          headers: { 'content-type': 'application/json' },
        })
      },
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
        new Response(JSON.stringify({ titlu: '21 – 27 septembrie 2026', slujbe: 6, detalii: 5, stare: 'validat', rânduri: [] }), {
          headers: { 'content-type': 'application/json' },
        }),
    },
    BROWSER: { fetch: async () => new Response('{}') },
    MEDIA: { fetch: async () => new Response('nimic', { status: 404 }) },
    CONFIG: { get: async () => null },
  }
  return { env, stare, depozit, auditate }
}

/**
 * ⚠️ `waitUntil` CARE SE POATE AȘTEPTA. Arhivarea schiței la validare e amânată în el (ca auditul):
 * cu un `waitUntil` care aruncă promisiunea, proba s-ar uita în depozit înainte ca mutarea să se fi
 * făcut și ar trece, ori ar cădea, după cum se nimerește.
 */
const amanate: Array<Promise<unknown>> = []
const ctxExec = {
  waitUntil: (p: Promise<unknown>) => {
    amanate.push(p)
  },
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext

/** Așteaptă tot ce s-a amânat până acum (și golește coada, ca probele să nu se încurce). */
const amanatele = async (): Promise<void> => {
  await Promise.all(amanate.splice(0))
}

const cere = (env: unknown, cale: string, init: RequestInit = {}) =>
  buletin.fetch(
    new Request(`https://buletin.staging.sfantul-ilie.ro${cale}`, {
      ...init,
      headers: { cookie: 'xc_sesiune=jeton-de-proba', ...(init.headers ?? {}) },
    }),
    env as never,
    ctxExec,
  )

const retrage = (env: unknown, nr: number | string, data: string) =>
  cere(env, '/nou', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      // bariera de origine a aplicației e înaintea rutei, la orice POST
      origin: 'https://buletin.staging.sfantul-ilie.ro',
    },
    body: new URLSearchParams({ fapta: 'retrage', nr: String(nr), data }).toString(),
  })

/** Cealaltă față a aceleiași uși: publicarea. */
const valideaza = (env: unknown, nr: number | string, data: string) =>
  cere(env, '/nou', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: 'https://buletin.staging.sfantul-ilie.ro',
    },
    body: new URLSearchParams({ fapta: 'valideaza', nr: String(nr), data }).toString(),
  })

// ---------------------------------------------------------------------------
// 1. BUTONUL — cui i se arată și cui nu
// ---------------------------------------------------------------------------

const CTX: Ctx = {
  prefix: '/buletin',
  nav: { home: '', cont: '/cont', admin: '/admin' } as Ctx['nav'],
  utilizator: 'Părintele',
  eAdmin: true,
  versiune: '0.16.0',
  modificata: '20.09.2026',
}

const MENIU_CURENT: Meniu = { peEcran: AL_NOSTRU, acum: true, ani: ['2026'] }

describe('butonul „Retrage" — numai admin, numai numărul curent, numai publicat de aici', () => {
  it('se vede pe pagina numărului curent publicat de pe platformă, cu numărul și ziua în formular', () => {
    const h = paginaBuletin(CTX, MENIU_CURENT, AL_NOSTRU)
    expect(h).toContain('id="b-retrage"')
    expect(h).toContain('Retrage numărul din arhivă și adu-l înapoi ca schiță')
    // formularul-pereche al validării: aceeași ușă, `fapta` deosebită
    expect(h).toContain('<form class="modal-cutie" id="f-retrage" method="post" action="/buletin/nou">')
    expect(h).toContain('<input type="hidden" name="fapta" value="retrage">')
    expect(h).toContain('<input type="hidden" name="nr" value="616">')
    expect(h).toContain('<input type="hidden" name="data" value="2026-09-20">')
    // ⚠️ confirmarea e o FEREASTRĂ, nu o apăsare seacă — și spune ce NU se pierde
    expect(h).toContain('<dialog class="modal" id="d-retrage"')
    expect(h).toContain('nu se pierd')
  })

  /**
   * ⚠️ DOAR ICONIȚA, ca „Descarcă" (user, 20.09.2026, 09:00: „butonul să fie în rând cu celelalte
   * și doar icona"). Cuvântul scris umfla rândul de sub copertă peste lățimea unui telefon, iar
   * `flex-wrap` al lui `.btns.hartii` îl cobora pe al doilea rând. Proba se uită la ce rămâne ÎNTRE
   * `>` și `</button>`: doar SVG-ul, niciun cuvânt.
   */
  it('e DOAR iconiță: cuvântul „Retrage" stă în aria-label și title, nu scris pe buton', () => {
    const h = paginaBuletin(CTX, MENIU_CURENT, AL_NOSTRU)
    const buton = h.match(/<button[^>]*id="b-retrage"[^>]*>([\s\S]*?)<\/button>/)
    expect(buton, 'butonul #b-retrage trebuie să fie în pagină').not.toBeNull()
    const inauntru = buton![1]
    expect(inauntru).toContain('<svg')
    // scos SVG-ul, nu mai rămâne nimic de citit — nici „Retrage", nici un spațiu cu text
    expect(inauntru.replace(/<svg[\s\S]*?<\/svg>/g, '').trim()).toBe('')
    // dar cuvântul E acolo pentru cine nu vede iconița
    const capul = buton![0].slice(0, buton![0].indexOf('>') + 1)
    expect(capul).toContain('aria-label="Retrage numărul din arhivă')
    expect(capul).toContain('title="Retrage numărul din arhivă')
    // aceeași carcasă ca „Descarcă": `btn intreg`, ca să stea la fel în rând
    expect(capul).toContain('class="btn intreg"')
    expect(h).toContain('<a class="btn intreg" id="b-descarca"')
  })

  /**
   * ⚠️ FEREASTRA STĂ ÎN AFARA `<nav>`-ului, ca `fereastraRasfoit`: butoanele sunt navigare, un
   * `<dialog>` cu formular nu. Proba taie nav-ul din pagină și cere ca `#d-retrage` să nu fie în el.
   */
  it('fereastra de confirmare stă DUPĂ </nav>, nu printre butoane', () => {
    const h = paginaBuletin(CTX, MENIU_CURENT, AL_NOSTRU)
    const nav = h.match(/<nav class="btns hartii">[\s\S]*?<\/nav>/)
    expect(nav, 'rândul de butoane trebuie să fie în pagină').not.toBeNull()
    expect(nav![0]).toContain('id="b-retrage"')
    expect(nav![0]).not.toContain('<dialog')
    expect(nav![0]).not.toContain('id="d-retrage"')
    expect(h.indexOf('id="d-retrage"')).toBeGreaterThan(h.indexOf(nav![0]) + nav![0].length - 1)
    // ultimul din rând: după pastila lui Tipărește
    expect(nav![0].indexOf('id="b-retrage"')).toBeGreaterThan(nav![0].indexOf('id="b-revers"'))
  })

  it('și pe prima pagină fereastra iese din nav, lângă cea de răsfoit', () => {
    const h = paginaAcasa(CTX, { ...MENIU_CURENT }, AL_NOSTRU, [])
    const nav = h.match(/<nav class="btns hartii">[\s\S]*?<\/nav>/)!
    expect(nav[0]).toContain('id="b-retrage"')
    expect(nav[0]).not.toContain('<dialog')
    expect(h).toContain('id="d-retrage"')
  })

  it('se vede și pe prima pagină, care E chiar numărul curent', () => {
    expect(paginaAcasa(CTX, { ...MENIU_CURENT }, AL_NOSTRU, [])).toContain('id="b-retrage"')
  })

  it('NU se vede la cine nu ține buletinul', () => {
    const h = paginaBuletin({ ...CTX, eAdmin: false }, MENIU_CURENT, AL_NOSTRU)
    expect(h).not.toContain('id="b-retrage"')
    expect(h).not.toContain('value="retrage"')
    // dar butoanele obișnuite rămân: hârtia e publică
    expect(h).toContain('id="b-descarca"')
  })

  it('⚠️ NU se vede la un număr adus din arhiva parohiei — nu îndreptăm noi arhiva', () => {
    const h = paginaBuletin(CTX, { peEcran: DIN_ARHIVA, acum: true }, DIN_ARHIVA)
    expect(h).not.toContain('id="b-retrage"')
  })

  it('⚠️ NU se vede la un număr care are urmaș: a fost împărțit pe hârtie', () => {
    const h = paginaBuletin(CTX, { peEcran: AL_NOSTRU, acum: false }, AL_NOSTRU)
    expect(h).not.toContain('id="b-retrage"')
  })
})

// ---------------------------------------------------------------------------
// 2. FAPTA — `POST /nou`, `fapta=retrage`
// ---------------------------------------------------------------------------

describe('`POST /nou` cu `fapta=retrage` — rândul iese, schița se întoarce', () => {
  it('scoate rândul din arhivă, reface schița din cererea păstrată și duce omul la `/nou`', async () => {
    const { env, stare, depozit, auditate } = mediu()
    const r = await retrage(env, 616, '2026-09-20')

    expect(r.status).toBe(303)
    // în staging aplicația stă la rădăcină, deci montajul e gol (vezi `prefixSiCale` din `index.ts`)
    expect(r.headers.get('location')).toBe('/nou')

    // 1. rândul a IEȘIT din arhivă — numărul curent e iar cel dinainte
    expect(stare.randuri.map((x) => x.nr)).toEqual([615])

    // 2. schița s-a întors sub CHEIA LUI: același nr., aceeași zi
    const schita = depozit.get(cheiaSchitei(AL_NOSTRU)) as Schita
    expect(schita, 'schița trebuie scrisă sub cheia numărului retras').toBeDefined()
    expect(schita.nr).toBe(616)
    expect(schita.data).toBe('2026-09-20')
    expect(schita.motto).toBe(CEREREA.motto)
    expect(schita.motoAutor).toBe(CEREREA.motoAutor)
    expect(schita.principal.autor).toBe('SFÂNTUL IOAN GURĂ DE AUR')
    expect(schita.principal.titlu).toBe('DESPRE RUGĂCIUNE')
    expect(schita.principal.semnatura).toBe('Text de: Părintele Mihail Stanciu')
    expect(schita.principal.text).toBe('Rândul întâi al articolului publicat greșit.')
    expect(schita.principal.sursa).toBe('ziarullumina.ro')
    expect(schita.secundari).toHaveLength(1)
    expect(schita.secundari[0]!.titlu).toBe('AL DOILEA')
    /*
     * ⚠️ DRUMUL DE REZERVĂ ȘI PREȚUL LUI: fără schița pusă deoparte la publicare, numărul se reface
     * din cerere — iar cererea n-are ADRESA pozei, ci doar `poza: true`. Proba ține pierderea la
     * vedere: dacă ea dispare, înseamnă că s-a mers pe drumul cel bun (vezi arhiva, mai jos).
     */
    expect(schita.principal.poza).toBeUndefined()

    // 3. FIȘIERELE RĂMÂN: ele sunt de acum ale ciornei
    expect(depozit.has(cheiaNumarului(AL_NOSTRU))).toBe(true)
    expect(depozit.has(cheiaCopertei(AL_NOSTRU))).toBe(true)
    expect(depozit.has(cheiaCererii(AL_NOSTRU))).toBe(true)

    // 4. auditul spune ce număr a ieșit din arhivă
    const intrarea = auditate.find((i) => i.action === 'buletin.retrage')
    expect(intrarea, 'retragerea trebuie să lase o intrare de audit').toBeDefined()
    expect(intrarea!.target).toBe('616-2026-09-20')
    expect(intrarea!.outcome).toBe('success')
    expect(intrarea!.summary.izvor).toBe('cerere')
  })

  /**
   * ⚠️ SCHIȚA REFĂCUTĂ NU E UNA „NEATINSĂ". Cu `gata` gol, `/nou` ar socoti-o variantă zero și ar
   * porni o recompunere de la capăt peste foaia care trebuie îndreptată; iar bula ar relua
   * chestionarul de la „Care este textul articolului principal?".
   */
  it('schița refăcută e însemnată ca RĂSPUNSĂ, nu ca variantă zero', async () => {
    const { env, depozit } = mediu()
    await retrage(env, 616, '2026-09-20')
    const schita = depozit.get(cheiaSchitei(AL_NOSTRU)) as Schita
    expect(schita.gata).toContain('motto')
    expect(schita.gata).toContain('mai_adaugam')
    expect(schita.principal.gata).toEqual(
      expect.arrayContaining(['text', 'autor', 'ani', 'pomenire', 'titlu', 'sursa']),
    )
    expect(schita.pas).toMatchObject({ subiect: 'gata' })
  })

  it('numărul retras nu mai are pagină: `/buletin/616-2026-09-20` dă 404', async () => {
    const { env } = mediu()
    expect((await cere(env, '/buletin/616-2026-09-20')).status).toBe(200)
    await retrage(env, 616, '2026-09-20')
    const dupa = await cere(env, '/buletin/616-2026-09-20')
    expect(dupa.status).toBe(404)
    expect(await dupa.text()).toContain('Nu există numărul')
  })

  it('fără cererea păstrată retragerea TOT se face, dar schița pornește de la varianta de probă', async () => {
    const { env, stare, depozit } = mediu({
      depozit: { [cheiaNumarului(AL_NOSTRU)]: null, [cheiaCopertei(AL_NOSTRU)]: null },
    })
    const r = await retrage(env, 616, '2026-09-20')
    expect(r.status).toBe(303)
    expect(stare.randuri.map((x) => x.nr)).toEqual([615])
    const schita = depozit.get(cheiaSchitei(AL_NOSTRU)) as Schita
    expect(schita.nr).toBe(616)
    expect(schita.data).toBe('2026-09-20')
    // varianta de probă: locurile ocupate, nimic din ce scrisese omul
    expect(schita.principal.titlu).toBe('TITLU ARTICOL')
  })
})

describe('retragerea se REFUZĂ, nu se face pe jumătate', () => {
  it('⚠️ un număr din arhiva parohiei nu se retrage — 409, și rândul rămâne', async () => {
    const { env, stare } = mediu({ randuri: [DIN_ARHIVA] })
    const r = await retrage(env, 615, '2026-09-06')
    expect(r.status).toBe(409)
    expect(await r.text()).toContain('vine din arhiva parohiei')
    expect(stare.randuri).toHaveLength(1)
  })

  it('⚠️ un număr care nu e cel curent nu se retrage — 409, și arhiva rămâne întreagă', async () => {
    const { env, stare } = mediu()
    const r = await retrage(env, 615, '2026-09-06')
    expect(r.status).toBe(409)
    expect(await r.text()).toContain('doar numărul CURENT')
    expect(stare.randuri).toHaveLength(2)
  })

  it('rămâne al adminilor buletinului: fără cheie, 403 și nicio ștergere', async () => {
    const { env, stare } = mediu({ chei: [] })
    expect((await retrage(env, 616, '2026-09-20')).status).toBe(403)
    expect(stare.randuri).toHaveLength(2)
  })

  it('fără antetul Origin nu trece de bariera aplicației', async () => {
    const { env, stare } = mediu()
    const r = await cere(env, '/nou', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ fapta: 'retrage', nr: '616', data: '2026-09-20' }).toString(),
    })
    expect(r.status).toBe(403)
    expect(stare.randuri).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// 3. SCHIȚA PUSĂ DEOPARTE LA VALIDARE — ca retragerea să aducă numărul ÎNTREG
// ---------------------------------------------------------------------------

describe('validarea PUNE SCHIȚA DEOPARTE, nu o mai șterge', () => {
  /** Arhiva goală de numere de-ale noastre: ce urmează e chiar 616, cu schița lui pe masă. */
  const inainteDePublicare = () =>
    mediu({
      randuri: [DIN_ARHIVA],
      depozit: { ...DEPOZITUL_LUI(), [cheiaSchitei(AL_NOSTRU)]: SCHITA_CU_POZA },
    })

  it('schița trece la `schita/arhiva/…` cu TOT ce avea, iar cheia de lucru dispare', async () => {
    const { env, depozit } = inainteDePublicare()
    const r = await valideaza(env, 616, '2026-09-20')
    await amanatele()

    expect(r.status).toBe(303)
    expect(r.headers.get('location')).toBe('/buletin/616-2026-09-20')
    // de pe masa de lucru a ieșit: altfel `/nou` ar chema la nesfârșit înapoi numărul publicat
    expect(depozit.has(cheiaSchitei(AL_NOSTRU))).toBe(false)
    // …dar nu s-a pierdut, și nici nu s-a refăcut pe drum: același conținut, literă cu literă
    expect(depozit.get(cheiaSchiteiArhivate(AL_NOSTRU))).toEqual(SCHITA_CU_POZA)
  })

  it('validarea nu cade dacă nu e nicio schiță de pus deoparte (număr compus din argumente)', async () => {
    const { env, stare, depozit } = mediu({ randuri: [DIN_ARHIVA], depozit: DEPOZITUL_LUI() })
    // fără schiță pe masă, ziua numărului o dă calendarul — se ia de la ecran, ca omul
    const nou = buletinulNou(DIN_ARHIVA, new Date().toISOString().slice(0, 10))
    const r = await valideaza(env, nou.nr!, nou.data)
    await amanatele()
    expect(r.status).toBe(303)
    expect(stare.randuri.map((x) => x.nr)).toEqual([615, 616])
    expect(depozit.has(cheiaSchiteiArhivate({ nr: nou.nr, data: nou.data }))).toBe(false)
  })

  /**
   * ⚠️ PROBA CARE ȚINE PREFIXUL. `urmatorulCuSchita` listează `schita/<nr>-`; dacă schițele puse
   * deoparte ar fi stat sub `schita/616-2026-09-20.arhiva.json` (ori orice altă formă care începe
   * tot cu numărul), ecranul `/nou` ar fi arătat la nesfârșit numărul deja publicat.
   */
  it('schița pusă deoparte NU se mai vede în listarea numărului următor', async () => {
    const { bucket } = r2Fals({ [cheiaSchiteiArhivate(AL_NOSTRU)]: SCHITA_CU_POZA })
    expect(cheiaSchiteiArhivate(AL_NOSTRU).startsWith('schita/616-')).toBe(false)
    expect(await urmatorulCuSchita({ FISIERE: bucket }, DIN_ARHIVA, '2026-09-21')).toEqual({
      nr: 616,
      data: '2026-09-27',
    })
  })
})

describe('retragerea ia ÎNTÂI schița pusă deoparte', () => {
  /** Publicat cu schiță pusă deoparte — dar și cu cererea lângă el: arhiva are întâietate. */
  const dupaPublicare = () =>
    mediu({ depozit: { ...DEPOZITUL_LUI(), [cheiaSchiteiArhivate(AL_NOSTRU)]: SCHITA_CU_POZA } })

  it('numărul se întoarce ÎNTREG, cu adresa pozei, iar arhiva se golește', async () => {
    const { env, depozit, auditate } = dupaPublicare()
    const r = await retrage(env, 616, '2026-09-20')
    await amanatele()

    expect(r.status).toBe(303)
    // aceeași schiță, neatinsă — nu una refăcută din cerere
    expect(depozit.get(cheiaSchitei(AL_NOSTRU))).toEqual(SCHITA_CU_POZA)
    expect((depozit.get(cheiaSchitei(AL_NOSTRU)) as Schita).principal.poza).toBe(POZA)
    // …iar de la arhivă s-a MUTAT, nu s-a copiat: o a doua retragere n-are ce lua de acolo
    expect(depozit.has(cheiaSchiteiArhivate(AL_NOSTRU))).toBe(false)

    const intrarea = auditate.find((i) => i.action === 'buletin.retrage')
    expect(intrarea!.summary.izvor).toBe('arhiva')
  })

  it('spune omului pe care din cele trei drumuri s-a mers', async () => {
    const cuArhiva = await retrageNumarul(dupaPublicare().env as never)
    expect(cuArhiva).toMatchObject({ facut: true, izvor: 'arhiva' })
    expect(cuArhiva.text).toContain('întreg')
    expect(cuArhiva.text).toContain('pozele cu tot')

    const cuCerere = await retrageNumarul(mediu().env as never)
    expect(cuCerere).toMatchObject({ facut: true, izvor: 'cerere' })
    // ⚠️ pe drumul ăsta poza NU s-a întors: omul trebuie să afle, altfel iese foaia cu locul gol
    expect(cuCerere.text).toContain('ADRESELE POZELOR')

    const golit = mediu({ depozit: { [cheiaNumarului(AL_NOSTRU)]: null } })
    const cuNimic = await retrageNumarul(golit.env as never)
    expect(cuNimic).toMatchObject({ facut: true, izvor: 'implicita' })
    expect(cuNimic.text).toContain('varianta de probă')
  })

  /**
   * DRUMUL ÎNTREG, cap-coadă: se publică un număr cu poză, se vede că a intrat în arhivă, se retrage
   * — și poza e tot acolo. Asta e, de fapt, toată sarcina zilei, într-o singură probă.
   */
  it('publicat și retras, numărul se întoarce cu poza lui', async () => {
    const { env, stare, depozit } = mediu({
      randuri: [DIN_ARHIVA],
      depozit: { ...DEPOZITUL_LUI(), [cheiaSchitei(AL_NOSTRU)]: SCHITA_CU_POZA },
    })

    expect((await valideaza(env, 616, '2026-09-20')).status).toBe(303)
    await amanatele()
    expect(stare.randuri.map((x) => x.nr)).toEqual([615, 616])

    expect((await retrage(env, 616, '2026-09-20')).status).toBe(303)
    await amanatele()
    expect(stare.randuri.map((x) => x.nr)).toEqual([615])
    expect(depozit.get(cheiaSchitei(AL_NOSTRU))).toEqual(SCHITA_CU_POZA)
    expect(depozit.has(cheiaSchiteiArhivate(AL_NOSTRU))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 4. ÎNTOARCEREA PE `/nou` — numărul nu-și pierde ziua
// ---------------------------------------------------------------------------

describe('`urmatorulCuSchita` — schița începută are întâietate asupra calendarului', () => {
  it('⚠️ un număr retras LUNI rămâne pe duminica lui, nu sare pe cea următoare', async () => {
    const { bucket } = r2Fals({ [cheiaSchitei(AL_NOSTRU)]: { nr: 616, data: '2026-09-20' } })
    // socoteala din calendar ar da 27.09 — ziua de azi a trecut de duminica numărului
    expect(buletinulNou(DIN_ARHIVA, '2026-09-21')).toEqual({ nr: 616, data: '2026-09-27' })
    expect(await urmatorulCuSchita({ FISIERE: bucket }, DIN_ARHIVA, '2026-09-21')).toEqual({
      nr: 616,
      data: '2026-09-20',
    })
  })

  it('fără nicio schiță începută rămâne socoteala dinainte (duminica din calendar)', async () => {
    const { bucket } = r2Fals({})
    expect(await urmatorulCuSchita({ FISIERE: bucket }, DIN_ARHIVA, '2026-09-21')).toEqual(
      buletinulNou(DIN_ARHIVA, '2026-09-21'),
    )
  })

  it('schița altui număr nu se confundă cu a lui: prefixul e numărul, cu liniuță', async () => {
    const { bucket } = r2Fals({ 'schita/6160-2026-01-04.json': {}, 'schita/617-2026-09-27.json': {} })
    expect(await urmatorulCuSchita({ FISIERE: bucket }, DIN_ARHIVA, '2026-09-21')).toEqual({
      nr: 616,
      data: '2026-09-27',
    })
  })

  it('un depozit care tace nu închide ecranul: se cade pe socoteala din calendar', async () => {
    const stricat = { list: async () => { throw new Error('R2 tace') } } as unknown as R2Bucket
    expect(await urmatorulCuSchita({ FISIERE: stricat }, DIN_ARHIVA, '2026-09-21')).toEqual({
      nr: 616,
      data: '2026-09-27',
    })
  })

  it('cu arhiva goală nu e niciun număr de căutat', async () => {
    const { bucket } = r2Fals({})
    expect(await urmatorulCuSchita({ FISIERE: bucket }, null, '2026-09-21')).toEqual(buletinulNou(null, '2026-09-21'))
  })
})

describe('`/nou` după retragere: numărul retras, cu foaia lui, nu o variantă zero', () => {
  it('arată nr. 616 pe ziua lui, cu ciorna din depozit și cu butonul de validare', async () => {
    const { env } = mediu()
    await retrage(env, 616, '2026-09-20')
    const text = await (await cere(env, '/nou')).text()

    // numărul și ziua sunt ale schiței întoarse, nu ale duminicii socotite din calendar
    expect(text).toContain('<input type="hidden" name="data" value="2026-09-20">')
    expect(text).toContain('Validează și publică nr. 616')
    // foaia publicată se vede mai departe: fișierele n-au fost șterse
    expect(text).toContain('<section class="ciorna">')
    expect(text).toContain(cheiaNumarului(AL_NOSTRU))
    // ⚠️ și NU se pornește o recompunere de la zero peste ea
    expect(text).not.toContain('id="b-compune" data-auto')
    // ce scrisese omul se vede iar în schiță
    expect(text).toContain('DESPRE RUGĂCIUNE')
  })
})

// ---------------------------------------------------------------------------
// 5. CHATUL — acțiunea își află singură ținta
// ---------------------------------------------------------------------------

describe('acțiunea `buletin.retrage`', () => {
  const retragerea = actiuniBuletin.find((a) => a.nume === 'buletin.retrage')!

  it('e o scriere, cu cheia buletinului și cu propunerea Da/Nu', () => {
    expect(retragerea.efect).toBe('scrie')
    expect(retragerea.permisiune).toBe('bulletin.write')
    expect(retragerea.rezuma).toBeTypeOf('function')
  })

  it('propunerea spune numărul ADEVĂRAT, aflat din arhivă, și ce nu se pierde', async () => {
    const { env } = mediu()
    const rezumat = await retragerea.rezuma!({}, { env } as never)
    expect(rezumat).toContain('616')
    expect(rezumat).toContain('20 septembrie 2026')
    expect(rezumat).toContain('schiță')
    expect(rezumat).toContain('Fișierele nu se pierd')
  })

  /**
   * ⚠️ Ținta se AFLĂ, nu se cere de la model: bula stă pe `/nou`, unde numărul tocmai publicat nu
   * mai e „cel următor". Fără argumente, acțiunea retrage numărul CURENT.
   */
  it('fără argumente retrage numărul curent, și spune omului ce s-a întâmplat', async () => {
    const { env, stare, depozit } = mediu()
    const date = await retragerea.executa({}, { env, ctxExec } as never)
    expect(date).toMatchObject({ facut: true, nr: 616, data: '2026-09-20', izvor: 'cerere' })
    expect(stare.randuri.map((x) => x.nr)).toEqual([615])
    expect(depozit.has(cheiaSchitei(AL_NOSTRU))).toBe(true)
    const raport = retragerea.raportul!({ argumente: {}, date: date as never })
    expect(raport).toMatchObject({ facut: true })
    expect(raport!.text).toContain('a ieșit din arhivă')
  })

  it('⚠️ REFUZĂ când numărul curent vine din arhiva parohiei — și nu șterge nimic', async () => {
    const { env, stare } = mediu({ randuri: [DIN_ARHIVA] })
    await expect(retragerea.rezuma!({}, { env } as never)).rejects.toThrow(/arhiva parohiei/)
    const date = await retragerea.executa({}, { env, ctxExec } as never)
    expect(date).toMatchObject({ facut: false })
    expect(stare.randuri).toHaveLength(1)
    const raport = retragerea.raportul!({ argumente: {}, date: date as never })
    expect(raport).toMatchObject({ facut: false })
    expect(raport!.text).toContain('arhiva parohiei')
  })

  it('⚠️ REFUZĂ un nr./o zi care nu sunt ale numărului curent — verificare, nu țintă', async () => {
    const { env, stare } = mediu()
    const cernut = await deRetras(env as never, { nr: 615, data: '2026-09-06' })
    expect(cernut).toHaveProperty('piedica')
    const r = await retrageNumarul(env as never, { nr: 615, data: '2026-09-06' })
    expect(r.facut).toBe(false)
    expect(r.text).toContain('doar numărul CURENT')
    expect(stare.randuri).toHaveLength(2)
  })

  it('auditul spune ce număr a ieșit și de unde s-a refăcut schița', async () => {
    const { env } = mediu()
    const date = await retragerea.executa({}, { env, ctxExec } as never)
    expect(retragerea.auditDetalii!({ argumente: {}, date: date as never })).toMatchObject({
      facut: true,
      nr: 616,
      data: '2026-09-20',
      izvor: 'cerere',
    })
  })
})
