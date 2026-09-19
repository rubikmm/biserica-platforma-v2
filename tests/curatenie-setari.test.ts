import { describe, expect, it } from 'vitest'
import curatenie from '../apps/curatenie/src/index.js'

/**
 * PANOUL CURĂȚENIEI, MUTAT ÎN SETĂRI (user, 19.09.2026: „meniul de cont trebuie să se vadă ca la
 * celelalte aplicații. Cele 3 butoane dispar din zona de meniu — administrarea devine setări").
 *
 * Până atunci curățenia avea ceva ce n-avea nicio altă aplicație: un rând de butoane în antet
 * („Intră", „Contul meu", „Administrare") și o pagină `/admin` numai a ei. Probele de aici păzesc
 * cele patru lucruri care se pot strica tăcut la mutare:
 *
 *  1. `/setari` arată ȘI rubricile platformei, ȘI panoul — dar panoul numai celui cu cheia;
 *  2. formularele panoului își poartă `action` spre ruta lor de scriere: fără el ar posta pe
 *     `/setari`, unde `@xc/setari` le înghite fără eroare și fără faptă;
 *  3. o scriere se întoarce la `/setari?tab=<fila de unde s-a apăsat>`, nu la ruta de scriere;
 *  4. adresele vechi (`/admin`, `/?intra=1`) nu cad: duc unde duceau butoanele.
 */

// ---------------------------------------------------------------------------
// Baza de probă
// ---------------------------------------------------------------------------

interface RandV { id: number; user_id: string; slug: string | null; created_at: string; updated_at: string }

const v = (id: number, user_id: string): RandV =>
  ({ id, user_id, slug: null, created_at: '2026-01-01 10:00:00', updated_at: '2026-01-01 10:00:00' })

/**
 * Un D1 de hârtie, cât îi trebuie panoului pe filele „Voluntari" și „Mesaje de sistem": echipa,
 * jurnalul (gol) și golirea lui. Orice altă interogare cade zgomotos — dacă panoul începe să ceară
 * altceva de pe aceste file, proba trebuie să afle, nu să tacă.
 */
function bazaDeProba(volunteers: RandV[]) {
  const scrieri: string[] = []

  function executa(sqlBrut: string): Record<string, unknown>[] {
    const s = sqlBrut.replace(/\s+/g, ' ').trim()
    if (s.startsWith('SELECT * FROM volunteers')) return [...volunteers]
    if (s.startsWith('SELECT n.*, v.user_id FROM notifications_log')) return []
    if (s.startsWith('SELECT event_type, COUNT(*) as cnt FROM notifications_log')) return []
    if (s.startsWith('SELECT MAX(created_at) FROM notifications_log')) return [{ m: null }]
    if (s.startsWith('DELETE FROM notifications_log')) {
      scrieri.push(s)
      return []
    }
    throw new Error(`interogare necunoscută în baza de probă: ${s}`)
  }

  const declaratie = (sql: string) => ({
    async all() { return { results: executa(sql) } },
    async first() { return executa(sql)[0] ?? null },
    async run() {
      executa(sql)
      return { meta: { last_row_id: 0, changes: 0 } }
    },
  })

  const DB = {
    prepare: (sql: string) => ({ ...declaratie(sql), bind: (..._p: unknown[]) => declaratie(sql) }),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new ArrayBuffer(0),
  }
  return { DB, scrieri }
}

// ---------------------------------------------------------------------------
// Mediul
// ---------------------------------------------------------------------------

const om = (userId: string, firstName: string, lastName: string, stare: string | null) => ({
  userId,
  email: `${firstName.toLowerCase()}@example.com`,
  displayName: `${firstName} ${lastName}`,
  firstName,
  lastName,
  phone: null,
  shortName: null,
  disabledAt: null,
  stare,
  etichete: stare === 'acceptata' ? ['voluntar'] : [],
  cerutDe: null,
  acceptatDe: null,
})

/** u1 — Maria, ARE `cleaning.manage`; u2 — Mihai, în echipă fără cheie; u9 — neasociat. */
const MEMBRI = [
  om('u1', 'Maria', 'Ionescu', 'acceptata'),
  om('u2', 'Mihai', 'Popescu', 'acceptata'),
  om('u9', 'Ana', 'Radu', null),
]

const sesiune = (id: string, nume: string, jeton: string) => ({
  authenticated: true,
  user: {
    id, email: `${id}@example.com`, displayName: nume,
    firstName: nume.split(' ')[0], lastName: nume.split(' ')[1] ?? '', phone: null, shortName: null,
    emailVerifiedAt: null, disabledAt: null, createdAt: '2026-01-01T00:00:00.000Z',
  },
  roles: [{ role: 'user', scope: 'global' }],
  sessionId: `s-${id}`,
  expiresAt: null,
  veziCa: null,
  poateVedeaCa: false,
  jeton,
})

const SESIUNI = [sesiune('u1', 'Maria Ionescu', 'jeton-maria'), sesiune('u2', 'Mihai Popescu', 'jeton-mihai')]

function mediu(DB: unknown) {
  return {
    DB,
    MEDIU: 'staging',
    ORIGINE_PUBLICA: 'https://curatenie.test',
    DOMENIU_COOKIE: '',
    EMAIL_SUPERADMIN: 'rubikmm@gmail.com',
    URL_CONT: 'https://cont.test',
    IDENTITATE: {
      fetch: async (adresa: string, init?: RequestInit) => {
        const cale = new URL(adresa).pathname
        const raspunde = (date: unknown) =>
          new Response(JSON.stringify(date), { headers: { 'content-type': 'application/json' } })
        if (cale === '/sesiune') {
          const { token } = JSON.parse(String(init?.body ?? '{}')) as { token?: string }
          const s = SESIUNI.find((x) => x.jeton === token)
          if (!s) return new Response('nu', { status: 401 })
          return raspunde(s)
        }
        if (cale === '/asocieri/membri') return raspunde({ membri: MEMBRI })
        if (cale === '/utilizatori/lista') return raspunde({ utilizatori: MEMBRI })
        // ⚠️ `@xc/setari` cere asocierile omului pentru rubrica „Apartenența mea": un răspuns
        // fără cheia `asocieri` ar strica pagina, nu doar rubrica.
        if (cale === '/asocieri/ale-mele') return raspunde({ asocieri: [] })
        return raspunde({})
      },
    },
    /** Cheia curățeniei o are DOAR Maria. Nimeni n-are `audience.manage` ori `audit.read`. */
    AUTORIZARE: {
      fetch: async (adresa: string, init?: RequestInit) => {
        const cale = new URL(adresa).pathname
        const corp = JSON.parse(String(init?.body ?? '{}')) as {
          principal?: { userId?: string }
          permission?: string
        }
        if (cale === '/cine-are') {
          return new Response(JSON.stringify({ prinGrant: ['u1'], prinRol: [] }), {
            headers: { 'content-type': 'application/json' },
          })
        }
        const allowed = corp.principal?.userId === 'u1' && corp.permission === 'cleaning.manage'
        return new Response(JSON.stringify({ allowed, reason: 'probă', matchedScopes: [] }), {
          headers: { 'content-type': 'application/json' },
        })
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Cererile
// ---------------------------------------------------------------------------

const JETON = 'j'.repeat(43)
const CSRF = `xc_csrf=${JETON}`
const CA_ADMIN = `xc_sesiune=jeton-maria; ${CSRF}`
const CA_VOLUNTAR = `xc_sesiune=jeton-mihai; ${CSRF}`

const cere = (env: unknown, req: Request) => curatenie.fetch(req, env as never, {} as ExecutionContext)

const ceruta = (cale: string, cookie: string) =>
  new Request(`https://curatenie.test${cale}`, { headers: cookie ? { cookie } : {} })

function trimisa(cale: string, cookie: string, corp: Record<string, string>): Request {
  const date = new FormData()
  for (const [k, val] of Object.entries(corp)) date.set(k, val)
  date.set('csrf', JETON)
  return new Request(`https://curatenie.test${cale}`, {
    method: 'POST',
    body: date,
    headers: { cookie, origin: 'https://curatenie.test' },
  })
}

const echipa = () => bazaDeProba([v(1, 'u1'), v(2, 'u2')])

// ===========================================================================

describe('(a) panoul se vede în Setări, și numai celui cu cheia', () => {
  it('adminul găsește acolo și rubricile platformei, și filele panoului', async () => {
    const b = echipa()
    const r = await cere(mediu(b.DB), ceruta('/setari', CA_ADMIN))
    expect(r.status).toBe(200)
    const html = await r.text()

    // Rubricile scrise o dată, în `@xc/setari`, pentru toate aplicațiile.
    expect(html).toContain('Apartenența mea')
    expect(html).toContain('Administratorii aplicației')
    // Panoul, ca rubrică a aplicației, DUPĂ ele.
    expect(html).toContain('Echipa și rapoartele')
    expect(html).toContain('?tab=voluntari')
    expect(html).toContain('Mesaje de sistem')
    expect(html.indexOf('Apartenența mea')).toBeLessThan(html.indexOf('Echipa și rapoartele'))
    // Nu doar filele: conținutul lor. Fila deschisă din oficiu e echipa.
    expect(html).toContain('volunteer-card')
    expect(html).toContain('Maria Ionescu')

    // ⚠️ Fiecare formular al panoului își poartă ruta de scriere ȘI fila de pe care s-a apăsat.
    // Fără ele ar posta pe /setari, unde `@xc/setari` îl înghite tăcut (butonul s-ar apăsa, dar
    // nu s-ar întâmpla nimic), ori l-ar întoarce pe altă filă decât cea de unde a plecat.
    expect(html).toContain('<form method="post" action="/admin?tab=voluntari"')
    expect(html).not.toContain('<form method="post" class=')
  })

  it('un voluntar fără cheie vede doar ce e al lui', async () => {
    const b = echipa()
    const html = await (await cere(mediu(b.DB), ceruta('/setari', CA_VOLUNTAR))).text()

    expect(html).toContain('Apartenența mea')
    expect(html).not.toContain('Echipa și rapoartele')
    expect(html).not.toContain('Mesaje de sistem')
    expect(html).not.toContain('action="/admin"')
  })
})

describe('(b) adresele vechi ale panoului', () => {
  it('`/admin?tab=alert` duce la aceeași filă în Setări', async () => {
    const b = echipa()
    const r = await cere(mediu(b.DB), ceruta('/admin?tab=alert', CA_ADMIN))
    expect(r.status).toBe(303)
    expect(r.headers.get('location')).toBe('/setari?tab=alert')
  })

  it('`/admin` fără filă duce la Setări, iar cine n-are cheia ajunge tot acolo', async () => {
    const b = echipa()
    expect((await cere(mediu(b.DB), ceruta('/admin', CA_ADMIN))).headers.get('location')).toBe('/setari')
    const faraCheie = await cere(mediu(b.DB), ceruta('/admin', CA_VOLUNTAR))
    expect(faraCheie.status).toBe(303)
    expect(faraCheie.headers.get('location')).toBe('/setari')
  })

  /** ⚠️ Refuzul rămâne întreg pe SCRIERE: cine trimite formularul de mână se lovește de el. */
  it('o scriere fără cheie e refuzată, nu redirectată', async () => {
    const b = echipa()
    const r = await cere(mediu(b.DB), trimisa('/admin', CA_VOLUNTAR, { action: 'clear_log' }))
    expect(r.status).toBe(403)
    expect(b.scrieri).toHaveLength(0)
  })

  /** `?intra=1` deschidea panoul de intrare din pagină; acum ușa e una singură, a contului. */
  it('`/?intra=1` trimite la intrarea platformei', async () => {
    const b = echipa()
    const r = await cere(mediu(b.DB), ceruta('/?intra=1', CSRF))
    expect(r.status).toBe(303)
    const unde = r.headers.get('location') ?? ''
    expect(unde).toContain('https://cont.test/intra')
    expect(unde).toContain(`spre=${encodeURIComponent('https://curatenie.test/')}`)
  })
})

describe('(c) scrierile panoului se întorc în Setări', () => {
  it('„Șterge tot logul" golește jurnalul și aduce omul înapoi pe fila lui', async () => {
    const b = echipa()
    const r = await cere(mediu(b.DB), trimisa('/admin?tab=log', CA_ADMIN, { action: 'clear_log' }))
    expect(r.status).toBe(303)
    const unde = r.headers.get('location') ?? ''
    expect(unde.startsWith('/setari?tab=log')).toBe(true)
    expect(unde).not.toContain('/admin')
    expect(b.scrieri).toHaveLength(1)
  })
})
