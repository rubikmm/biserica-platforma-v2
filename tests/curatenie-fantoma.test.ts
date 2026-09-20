import { describe, expect, it } from 'vitest'
import curatenie from '../apps/curatenie/src/index.js'
import { duminicileLunii, lunaViitoare } from '../apps/curatenie/src/calendar.js'
import { acum } from '../apps/curatenie/src/timp.js'

/**
 * INTRAREA FANTOMĂ (user, 19.09.2026: „păstrăm intrarea fantomă doar cu numele (ex.: Mihai P.) și
 * astfel pre-logat un om poate face rezervări în calendar. Dacă vrea acces în platformă trebuie să
 * intre pe Cont normal. Dacă ești deja în platformă ca utilizator să nu mai fie selecția fantomă
 * deloc").
 *
 * Pickerul a fost scos pe 14.09.2026 și adus înapoi pe 19.09.2026 cu un înțeles NOU și mult mai
 * îngust. Probele de aici păzesc chiar granița lui, fiindcă toate patru se pot strica tăcut la o
 * curățare de cod și niciuna nu se vede din citirea unui singur fișier:
 *
 *  1. cine are SESIUNE nu are fantomă — oricâte cookie-uri ar căra cu el (altfel ar fi doi „eu");
 *  2. fantoma poate DOAR să rezerve; orice altă faptă e refuzată în `api.ts`, nu doar ascunsă în
 *     pagină — cine trimite formularul de mână ajunge tot acolo;
 *  3. fără nume ales nu se scrie nimic: pagina arată pickerul, iar `POST /api` cere cont;
 *  4. un cookie care nu mai duce nicăieri (rând șters, om scos din echipă) e ca și cum n-ar fi,
 *     și pleacă din browser — altfel un om scos din echipă ar rămâne cu ușa deschisă un an.
 */

// ---------------------------------------------------------------------------
// Baza de probă
// ---------------------------------------------------------------------------

interface RandV { id: number; user_id: string; slug: string | null; created_at: string; updated_at: string }
interface RandA { id: number; sunday_date: string; slot_position: number; volunteer_id: number; created_at: string }
interface RandVac { volunteer_id: number; year: number; month: number }

const v = (id: number, user_id: string): RandV =>
  ({ id, user_id, slug: null, created_at: '2026-01-01 10:00:00', updated_at: '2026-01-01 10:00:00' })

/**
 * Un D1 de hârtie. NU e un motor SQL: recunoaște, după textul normalizat, exact interogările pe
 * care le scrie curățenia, și le răspunde din trei tablouri. Dacă cineva schimbă o interogare fără
 * să treacă și pe aici, proba cade cu „interogare necunoscută" — adică zgomotos, cum se cuvine.
 */
function bazaDeProba(volunteers: RandV[], assignments: RandA[], vacante: RandVac[] = []) {
  const jurnal: { event_type: string; message: string }[] = []
  let urmatorulId = Math.max(0, ...assignments.map((a) => a.id)) + 1

  function executa(sqlBrut: string, p: unknown[]): Record<string, unknown>[] {
    const s = sqlBrut.replace(/\s+/g, ' ').trim()
    const numar = (i: number) => Number(p[i])
    const text = (i: number) => String(p[i])

    // --- volunteers ---------------------------------------------------------
    if (s.startsWith('SELECT * FROM volunteers WHERE id = ?')) return volunteers.filter((r) => r.id === numar(0))
    if (s.startsWith('SELECT * FROM volunteers WHERE user_id = ?')) return volunteers.filter((r) => r.user_id === text(0))
    if (s.startsWith('SELECT * FROM volunteers')) return [...volunteers]

    // --- assignments (citiri) ----------------------------------------------
    if (s.startsWith('SELECT a.*, v.user_id FROM assignments a JOIN volunteers v')) {
      return assignments
        .filter((a) => a.sunday_date >= text(0) && a.sunday_date <= text(1))
        .sort((x, y) => x.sunday_date.localeCompare(y.sunday_date) || x.slot_position - y.slot_position)
        .map((a) => ({ ...a, user_id: volunteers.find((r) => r.id === a.volunteer_id)?.user_id ?? '' }))
    }
    if (s.startsWith('SELECT a.slot_position, v.user_id, v.id AS volunteer_id FROM assignments a JOIN volunteers v')) {
      return assignments
        .filter((a) => a.sunday_date === text(0))
        .sort((x, y) => x.slot_position - y.slot_position)
        .map((a) => ({
          slot_position: a.slot_position,
          user_id: volunteers.find((r) => r.id === a.volunteer_id)?.user_id ?? '',
          volunteer_id: a.volunteer_id,
        }))
    }
    if (s.startsWith('SELECT DISTINCT substr(sunday_date, 1, 7) AS ym FROM assignments')) {
      return [...new Set(assignments.map((a) => a.sunday_date.slice(0, 7)))].sort().reverse().map((ym) => ({ ym }))
    }
    if (s.startsWith('SELECT * FROM assignments WHERE sunday_date = ? AND slot_position = ?')) {
      return assignments.filter((a) => a.sunday_date === text(0) && a.slot_position === numar(1))
    }
    if (s.startsWith('SELECT slot_position FROM assignments WHERE sunday_date = ? AND volunteer_id = ?')) {
      return assignments
        .filter((a) => a.sunday_date === text(0) && a.volunteer_id === numar(1))
        .map((a) => ({ slot_position: a.slot_position }))
    }
    if (s.startsWith('SELECT COUNT(*) FROM assignments WHERE sunday_date = ?')) {
      return [{ 'COUNT(*)': assignments.filter((a) => a.sunday_date === text(0)).length }]
    }

    // --- assignments (scrieri) ---------------------------------------------
    if (s.startsWith('INSERT INTO assignments')) {
      const rand: RandA = {
        id: urmatorulId++, sunday_date: text(0), slot_position: numar(1),
        volunteer_id: numar(2), created_at: '2026-09-19 10:00:00',
      }
      assignments.push(rand)
      return [{ id: rand.id }]
    }
    if (s.startsWith('DELETE FROM assignments WHERE id = ?')) {
      const i = assignments.findIndex((a) => a.id === numar(0))
      if (i >= 0) assignments.splice(i, 1)
      return []
    }
    if (s.startsWith('DELETE FROM assignments WHERE sunday_date = ? AND volunteer_id = ?')) {
      for (let i = assignments.length - 1; i >= 0; i--) {
        const a = assignments[i]!
        if (a.sunday_date === text(0) && a.volunteer_id === numar(1)) assignments.splice(i, 1)
      }
      return []
    }
    if (s.startsWith('DELETE FROM assignments WHERE sunday_date = ? AND slot_position = ?')) {
      for (let i = assignments.length - 1; i >= 0; i--) {
        const a = assignments[i]!
        if (a.sunday_date === text(0) && a.slot_position === numar(1)) assignments.splice(i, 1)
      }
      return []
    }
    // „Trenulețul": întâi totul la +1000, apoi cel mai mic rămas ia rangul următor.
    if (s.startsWith('UPDATE assignments SET slot_position = slot_position + 1000')) {
      for (const a of assignments) if (a.sunday_date === text(0)) a.slot_position += 1000
      return []
    }
    if (s.startsWith('UPDATE assignments SET slot_position = ? WHERE id = (SELECT id FROM assignments')) {
      const candidati = assignments
        .filter((a) => a.sunday_date === text(1) && a.slot_position > 1000)
        .sort((x, y) => x.slot_position - y.slot_position)
      if (candidati[0]) candidati[0].slot_position = numar(0)
      return []
    }

    // --- vacanțe ------------------------------------------------------------
    if (s.startsWith('SELECT v.id, v.user_id, vc.year, vc.month FROM volunteer_vacations')) {
      return vacante
        .filter((x) => x.year > numar(0) || (x.year === numar(0) && x.month >= numar(1)))
        .map((x) => ({
          id: x.volunteer_id, year: x.year, month: x.month,
          user_id: volunteers.find((r) => r.id === x.volunteer_id)?.user_id ?? '',
        }))
    }
    if (s.startsWith('SELECT year, month FROM volunteer_vacations WHERE volunteer_id = ?')) {
      return vacante.filter((x) => x.volunteer_id === numar(0)).map((x) => ({ year: x.year, month: x.month }))
    }
    if (s.startsWith('SELECT 1 FROM volunteer_vacations WHERE volunteer_id = ?')) {
      return vacante.some((x) => x.volunteer_id === numar(0) && x.year === numar(1) && x.month === numar(2))
        ? [{ 1: 1 }]
        : []
    }
    if (s.startsWith('SELECT id FROM volunteer_vacations WHERE volunteer_id = ?')) return []
    if (s.startsWith('INSERT INTO volunteer_vacations')) {
      vacante.push({ volunteer_id: numar(0), year: numar(1), month: numar(2) })
      return []
    }

    // --- jurnalul de mesaje + setări ---------------------------------------
    if (s.startsWith('INSERT INTO notifications_log')) {
      jurnal.push({ event_type: text(0), message: text(1) })
      return [{ id: jurnal.length }]
    }
    if (s.startsWith('SELECT MAX(created_at) FROM notifications_log')) return [{ m: null }]
    if (s.startsWith('SELECT value FROM app_settings')) return []

    throw new Error(`interogare necunoscută în baza de probă: ${s}`)
  }

  const declaratie = (sql: string, p: unknown[]) => ({
    sql,
    p,
    async all() { return { results: executa(sql, p) } },
    async first() { return executa(sql, p)[0] ?? null },
    async run() { return { meta: { last_row_id: executa(sql, p)[0]?.id ?? 0 } } },
  })

  const DB = {
    prepare: (sql: string) => ({ ...declaratie(sql, []), bind: (...p: unknown[]) => declaratie(sql, p) }),
    batch: async (st: { sql: string; p: unknown[] }[]) => st.map((x) => ({ results: executa(x.sql, x.p) })),
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new ArrayBuffer(0),
  }
  return { DB, assignments, jurnal }
}

// ---------------------------------------------------------------------------
// Mediul
// ---------------------------------------------------------------------------

/** Un om al platformei, așa cum îl dă identitatea la `/asocieri/membri`. */
const om = (userId: string, firstName: string, lastName: string, shortName: string | null, stare: string) => ({
  userId,
  email: `${firstName.toLowerCase()}@example.com`,
  displayName: `${firstName} ${lastName}`,
  firstName,
  lastName,
  phone: null,
  shortName,
  disabledAt: null,
  stare,
  etichete: ['voluntar'],
  cerutDe: null,
  acceptatDe: null,
})

/**
 * Echipa de probă:
 *   u1 / rândul 1 — Maria Ionescu, primită, ARE cont (folosită la proba cu sesiune);
 *   u2 / rândul 2 — Mihai Popescu, primit, cu „Mihai P." scris de el pe cont (fantoma);
 *   u3 / rândul 3 — Andrei Vasile, cerere ÎN AȘTEPTARE (nu e încă în echipă).
 */
const MEMBRI = [
  om('u1', 'Maria', 'Ionescu', null, 'acceptata'),
  om('u2', 'Mihai', 'Popescu', 'Mihai P.', 'acceptata'),
  om('u3', 'Andrei', 'Vasile', null, 'ceruta'),
]

const SESIUNE_MARIA = {
  authenticated: true,
  user: {
    id: 'u1', email: 'maria@example.com', displayName: 'Maria Ionescu',
    firstName: 'Maria', lastName: 'Ionescu', phone: null, shortName: null,
    emailVerifiedAt: null, disabledAt: null, createdAt: '2026-01-01T00:00:00.000Z',
  },
  roles: [{ role: 'user', scope: 'global' }],
  sessionId: 's1',
  expiresAt: null,
  veziCa: null,
  poateVedeaCa: false,
}

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
        if (cale === '/sesiune') {
          const { token } = JSON.parse(String(init?.body ?? '{}')) as { token?: string }
          if (token !== 'jeton-maria') return new Response('nu', { status: 401 })
          return new Response(JSON.stringify(SESIUNE_MARIA), { headers: { 'content-type': 'application/json' } })
        }
        if (cale === '/asocieri/membri') {
          return new Response(JSON.stringify({ membri: MEMBRI }), { headers: { 'content-type': 'application/json' } })
        }
        return new Response('{}', { headers: { 'content-type': 'application/json' } })
      },
    },
    // Nimeni din probe n-are `cleaning.manage`: fantoma nu poate ajunge admin nici din greșeală.
    AUTORIZARE: {
      fetch: async () =>
        new Response(JSON.stringify({ allowed: false, reason: 'probă', matchedScopes: [] }), {
          headers: { 'content-type': 'application/json' },
        }),
    },
  }
}

// ---------------------------------------------------------------------------
// Cererile
// ---------------------------------------------------------------------------

const JETON = 'j'.repeat(43)

/** Prima duminică a lunii VIITOARE: mereu în viitor și mereu editabilă, oricând ar rula proba. */
function duminicaLibera(): string {
  const [y, m] = lunaViitoare(acum())
  return duminicileLunii(y, m)[0]!
}

function ceruta(cale: string, cookie: string): Request {
  return new Request(`https://curatenie.test${cale}`, { headers: cookie ? { cookie } : {} })
}

function trimisa(cale: string, cookie: string, corp: Record<string, string>): Request {
  const date = new FormData()
  for (const [k, val] of Object.entries(corp)) date.set(k, val)
  date.set('csrf', JETON)
  return new Request(`https://curatenie.test${cale}`, {
    method: 'POST',
    body: date,
    headers: { cookie: `${cookie}${cookie ? '; ' : ''}xc_csrf=${JETON}`, origin: 'https://curatenie.test' },
  })
}

const CSRF = `xc_csrf=${JETON}`
const CA_MARIA = `xc_sesiune=jeton-maria; ${CSRF}`

const cere = (env: unknown, req: Request) => curatenie.fetch(req, env as never, {} as ExecutionContext)

/** Cookie-urile puse de răspuns, ca listă — `set-cookie` poate veni de mai multe ori. */
const cookiesDin = (r: Response): string[] => r.headers.getSetCookie?.() ?? []
const stergeFantoma = (r: Response) =>
  cookiesDin(r).some((c) => c.startsWith('curatenie_voluntar=;') && c.includes('Max-Age=0'))

function echipa() {
  return bazaDeProba([v(1, 'u1'), v(2, 'u2'), v(3, 'u3')], [])
}

// ===========================================================================

describe('(a) cine a intrat cu CONTUL n-are fantomă', () => {
  it('cookie-ul fantomă e ignorat, pickerul lipsește, iar cookie-ul pleacă din browser', async () => {
    const b = echipa()
    const r = await cere(mediu(b.DB), ceruta('/', `${CA_MARIA}; curatenie_voluntar=2`))
    expect(r.status).toBe(200)
    const html = await r.text()

    // Nici lista de nume, nici rândul „Ești …": omul are cont, pagina e a contului.
    expect(html).not.toContain('id="pickerFantoma"')
    expect(html).not.toContain('Nu ești tu?')
    expect(html).not.toContain('Mihai P.')
    // Calendarul e al ei, nu al fantomei din cookie.
    expect(html).toContain('Maria Ionescu')
    // ⚠️ Și cookie-ul mort pleacă: altfel ar aștepta cuminte până la următoarea ieșire din cont.
    expect(stergeFantoma(r)).toBe(true)
  })

  /** Poarta trebuie să fie pe SERVER: un cont care trimite „alege" de mână nu capătă o fantomă. */
  it('un om cu cont care cere `POST /alege` nu primește niciun cookie', async () => {
    const b = echipa()
    const r = await cere(mediu(b.DB), trimisa('/alege', CA_MARIA, { volunteer_id: '2' }))
    expect(r.status).toBe(303)
    expect(cookiesDin(r).some((c) => c.startsWith('curatenie_voluntar=2'))).toBe(false)
  })
})

describe('(b) fantoma: numai rezervări în calendar', () => {
  const CA_FANTOMA = `curatenie_voluntar=2; ${CSRF}`

  it('pagina o cunoaște după nume și îi dă calendarul editabil, fără picker', async () => {
    const b = echipa()
    const html = await (await cere(mediu(b.DB), ceruta('/', CA_FANTOMA))).text()

    // Rândul personal, în PAGINĂ, nu în meniul contului.
    expect(html).toContain('Ești <strong>Mihai P.</strong>')
    expect(html).toContain('Nu ești tu?')
    // Numele scurt e cel scris de om pe cont (`short_name`), nu cel socotit („Mihai P." oricum).
    expect(html).not.toContain('id="pickerFantoma"')
    // Sloturi apăsabile — asta a fost cererea: „poate face rezervări în calendar".
    expect(html).toContain('data-sunday=')
    // ⚠️ Antetul rămâne cel de NEintrat: capul meniului scrie „Cont" și duce la intrare.
    expect(html).not.toContain('>Ieșire<')
    expect(html).not.toContain('>Profil<')
    // ⚠️ Și n-are rândul de unelte de altădată: ușa spre platformă e una singură, meniul contului
    // (user, 19.09.2026). Butonul „Intră" al paginii era chiar excepția fantomei — a ieșit și el.
    expect(html).not.toContain('Contul meu')
    expect(html).not.toContain('btnAutentificare')
  })

  it('își ia o poziție la o duminică — rezervarea trece', async () => {
    const b = echipa()
    const duminica = duminicaLibera()
    const r = await cere(mediu(b.DB), trimisa('/api', CA_FANTOMA, {
      action: 'toggle_slot', sunday_date: duminica, slot: '1',
    }))
    expect(r.status).toBe(200)
    const raspuns = (await r.json()) as { ok: boolean; state?: string; volunteer_label?: string }
    expect(raspuns.ok).toBe(true)
    expect(raspuns.state).toBe('occupied')
    expect(raspuns.volunteer_label).toBe('Mihai P.')
    expect(b.assignments).toHaveLength(1)
    expect(b.assignments[0]).toMatchObject({ sunday_date: duminica, volunteer_id: 2 })
  })

  it('și și-o retrage tot ea — dar numai pe a ei', async () => {
    const duminica = duminicaLibera()
    const b = bazaDeProba(
      [v(1, 'u1'), v(2, 'u2'), v(3, 'u3')],
      [
        { id: 10, sunday_date: duminica, slot_position: 1, volunteer_id: 2, created_at: '' },
        { id: 11, sunday_date: duminica, slot_position: 2, volunteer_id: 1, created_at: '' },
      ],
    )
    const aEi = await cere(mediu(b.DB), trimisa('/api', `curatenie_voluntar=2; ${CSRF}`, {
      action: 'toggle_slot', sunday_date: duminica, slot: '1',
    }))
    expect(((await aEi.json()) as { state?: string }).state).toBe('free')

    // Poziția Mariei rămâne: „Nu poți elibera slotul altcuiva" e regula din V1, neatinsă.
    const aAltuia = await cere(mediu(b.DB), trimisa('/api', `curatenie_voluntar=2; ${CSRF}`, {
      action: 'toggle_slot', sunday_date: duminica, slot: '1',
    }))
    const j = (await aAltuia.json()) as { ok: boolean; error?: string }
    expect(j.ok).toBe(false)
    expect(j.error).toContain('Nu poți elibera slotul altcuiva')
  })

  /**
   * ⚠️ MIEZUL CERERII. Vacanța ține de cont, nu de un nume ales dintr-o listă. Refuzul stă în
   * `api.ts`, deci nu se poate ocoli trimițând formularul de mână.
   */
  it('vacanța i se refuză cu „Pentru asta intră în cont."', async () => {
    const b = echipa()
    const r = await cere(mediu(b.DB), trimisa('/api', CA_FANTOMA, {
      action: 'toggle_vacation_month', year: '2026', month: '12',
    }))
    expect(r.status).toBe(403)
    expect((await r.json()) as unknown).toMatchObject({ ok: false, error: 'Pentru asta intră în cont.' })
  })

  it('o acțiune necunoscută primește același refuz, nu „Acțiune necunoscută"', async () => {
    const b = echipa()
    const r = await cere(mediu(b.DB), trimisa('/api', CA_FANTOMA, { action: 'sterge_tot' }))
    expect(r.status).toBe(403)
    expect((await r.json()) as unknown).toMatchObject({ error: 'Pentru asta intră în cont.' })
  })

  it('panoul o trimite la intrarea cu contul, ca pe oricine fără sesiune', async () => {
    const b = echipa()
    const r = await cere(mediu(b.DB), ceruta('/admin', CA_FANTOMA))
    expect(r.status).toBe(303)
    const unde = r.headers.get('location') ?? ''
    expect(unde).toContain('https://cont.test/intra')
    // Întoarcerea e în Setări: acolo se vede panoul de pe 19.09.2026, nu la `/admin`.
    expect(unde).toContain(encodeURIComponent('/setari'))
  })

  it('„Nu ești tu?" uită numele, fără să atingă altceva', async () => {
    const b = echipa()
    const r = await cere(mediu(b.DB), trimisa('/iesi', CA_FANTOMA, {}))
    expect(r.status).toBe(303)
    expect(stergeFantoma(r)).toBe(true)
  })
})

describe('(c) fără sesiune și fără nume ales', () => {
  it('pagina arată pickerul, iar calendarul rămâne de citit', async () => {
    const b = echipa()
    const html = await (await cere(mediu(b.DB), ceruta('/', CSRF))).text()

    expect(html).toContain('id="pickerFantoma"')
    expect(html).toContain('Cine ești?')
    expect(html).toContain('action="/alege"')
    // Cei doi primiți în echipă sunt în listă; cel cu cererea în așteptare, nu.
    expect(html).toContain('Mihai P.')
    expect(html).toContain('Maria I.')
    expect(html).not.toContain('Andrei V.')
    // Calendarul se vede, dar sloturile sunt moarte.
    expect(html).toContain('Calendar')
    expect(html).toContain('doar vizualizare')
    expect(html).not.toContain('data-sunday=')
    /*
     * ⚠️ Pagina n-are nici rând de unelte, nici panou de intrare al ei (user, 19.09.2026). Cele
     * două uși ale vizitatorului sunt lista de nume și meniul contului din antet.
     */
    expect(html).not.toContain('Contul meu')
    expect(html).not.toContain('btnAutentificare')
    expect(html).not.toContain('authPanel')
    /*
     * ⚠️ Nici fereastra „Ești în modul vizualizare" nu mai există (user, 20.09.2026): apăsarea pe
     * un slot duce omul la lista de nume de sus, nu la un text care-i explică de ce nu poate.
     * Tot atunci a ieșit și nota de sub „Cine ești?" — lista se explică singură.
     */
    expect(html).not.toContain('viewOnlyDialog')
    expect(html).not.toContain('Ești în modul vizualizare')
    expect(html).not.toContain('btn-auth')
    expect(html).not.toContain('ținut minte pe')
    // Ce rămâne: slotul e clicabil și trimite la picker.
    expect(html).toContain('view-slot')
    expect(html).toContain("picker.scrollIntoView({ behavior: 'smooth', block: 'start' })")
  })

  it('`POST /api` de rezervare cere contul — nimic nu se scrie', async () => {
    const b = echipa()
    const r = await cere(mediu(b.DB), trimisa('/api', CSRF, {
      action: 'toggle_slot', sunday_date: duminicaLibera(), slot: '1',
    }))
    expect(r.status).toBe(401)
    expect(b.assignments).toHaveLength(0)
  })

  it('`POST /alege` pune cookie-ul, și numai pentru cine e cu adevărat în echipă', async () => {
    const b = echipa()
    const bun = await cere(mediu(b.DB), trimisa('/alege', CSRF, { volunteer_id: '2' }))
    expect(bun.status).toBe(303)
    expect(cookiesDin(bun).some((c) => c.startsWith('curatenie_voluntar=2') && c.includes('HttpOnly'))).toBe(true)

    // Rândul 3 are cererea în așteptare: nu e membru, deci nu se poate lua numele lui.
    const inAsteptare = await cere(mediu(b.DB), trimisa('/alege', CSRF, { volunteer_id: '3' }))
    expect(cookiesDin(inAsteptare).some((c) => c.startsWith('curatenie_voluntar=3'))).toBe(false)
  })

  /** Alegerea e o scriere: fără jetonul CSRF nu se pune niciun nume. */
  it('fără jetonul CSRF, `POST /alege` nu pune nimic', async () => {
    const b = echipa()
    const date = new FormData()
    date.set('volunteer_id', '2')
    const r = await cere(mediu(b.DB), new Request('https://curatenie.test/alege', {
      method: 'POST', body: date, headers: { cookie: CSRF, origin: 'https://curatenie.test' },
    }))
    expect(r.status).toBe(403)
    expect(cookiesDin(r).some((c) => c.startsWith('curatenie_voluntar=2'))).toBe(false)
  })
})

describe('(d) un cookie care nu mai duce nicăieri', () => {
  it('id inexistent → om anonim, cu pickerul la loc, și cookie-ul șters', async () => {
    const b = echipa()
    const r = await cere(mediu(b.DB), ceruta('/', `curatenie_voluntar=999; ${CSRF}`))
    const html = await r.text()
    expect(html).toContain('id="pickerFantoma"')
    expect(html).not.toContain('Nu ești tu?')
    expect(stergeFantoma(r)).toBe(true)
  })

  /** Omul scos din echipă (asociere stinsă / cerere în așteptare) nu rămâne cu ușa deschisă. */
  it('numele cuiva care nu mai e în echipă nu mai valorează nimic', async () => {
    const b = echipa()
    const r = await cere(mediu(b.DB), ceruta('/', `curatenie_voluntar=3; ${CSRF}`))
    expect(await r.text()).toContain('id="pickerFantoma"')
    expect(stergeFantoma(r)).toBe(true)

    const scriere = await cere(mediu(b.DB), trimisa('/api', `curatenie_voluntar=3; ${CSRF}`, {
      action: 'toggle_slot', sunday_date: duminicaLibera(), slot: '1',
    }))
    expect(scriere.status).toBe(401)
    expect(b.assignments).toHaveLength(0)
  })

  it('un cookie cu gunoi în el nu supără pagina', async () => {
    const b = echipa()
    const r = await cere(mediu(b.DB), ceruta('/', `curatenie_voluntar=nu-e-un-numar; ${CSRF}`))
    expect(r.status).toBe(200)
    expect(await r.text()).toContain('id="pickerFantoma"')
  })
})
