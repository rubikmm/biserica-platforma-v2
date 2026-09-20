import { describe, expect, it, vi } from 'vitest'

/*
 * ⚠️ Cele două aplicații ale emisiei își țin starea în obiecte durabile, deci lanțul lor de importuri
 * trece prin `cloudflare:workers` — un modul care există numai în workerd, nu în Node. Probele de
 * aici nu ating niciun obiect durabil (Setările și redirecturile nu-i cer nimic), așa că îi ținem
 * locul cu o clasă goală. Fără ea, fișierul n-ar putea nici măcar să încarce workerul.
 */
vi.mock('cloudflare:workers', () => ({ DurableObject: class {} }))

const { default: live } = await import('../apps/live/src/index.js')
const { default: radio } = await import('../apps/radio/src/index.js')

/**
 * PANOUL EMISIEI, MUTAT ÎN SETĂRI (user, 20.09.2026: „trebuie reparat și acolo, live și radio. Acel
 * panou de administrare să fie văzut doar de admini și să se numească Setări").
 *
 * Până azi cele două aplicații ale emisiei erau singurele cu o potriveală locală: rândul
 * „Administrare" din meniul contului nu ducea la Administrarea platformei, ci la panoul emisiei, și
 * se aprindea pentru oricine avea `broadcast.manage` (cerut pe 14.09.2026, când panoul era o pagină
 * a lui). Modelul platformei e celălalt: „Administrare" e al super-adminului, iar adminul unei
 * aplicații își găsește TOTUL în Setări — precedentul e curățenia, de pe 19.09.
 *
 * Ce se păzește aici, fiindcă se poate strica tăcut:
 *  1. panoul chiar ajunge în `/setari` la radio — cu scripturile lui, altfel e o poză;
 *  2. îl vede numai cine are cheia;
 *  3. adresele vechi (`/admin`, la amândouă) nu cad în gol;
 *  4. rândul „Administrare" e iar al super-adminului REAL, la amândouă.
 */

// ---------------------------------------------------------------------------
// Mediul
// ---------------------------------------------------------------------------

const sesiune = (id: string, nume: string, jeton: string, rol: string) => ({
  authenticated: true,
  user: {
    id,
    email: `${id}@example.com`,
    displayName: nume,
    firstName: nume.split(' ')[0],
    lastName: nume.split(' ')[1] ?? '',
    phone: null,
    shortName: null,
    emailVerifiedAt: null,
    disabledAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  roles: [{ role: rol, scope: 'global' }],
  sessionId: `s-${id}`,
  expiresAt: null,
  veziCa: null,
  poateVedeaCa: rol === 'super-admin',
  jeton,
})

/**
 * u1 — Părintele: ARE `broadcast.manage` (numit la emisie), dar NU e super-admin.
 * u2 — un enoriaș cu cont, fără nicio cheie.
 * u9 — super-adminul platformei: are toate cheile, deci și pe a emisiei.
 */
const SESIUNI = [
  sesiune('u1', 'Părintele Ilie', 'jeton-parinte', 'user'),
  sesiune('u2', 'Vlad Enoriașul', 'jeton-vlad', 'user'),
  sesiune('u9', 'Rubik Super', 'jeton-super', 'super-admin'),
]

const OAMENI = SESIUNI.map((s) => ({
  userId: s.user.id,
  email: s.user.email,
  displayName: s.user.displayName,
  disabledAt: null,
}))

function mediu(origine: string) {
  return {
    MEDIU: 'staging',
    ORIGINE_PUBLICA: origine,
    DOMENIU_COOKIE: '',
    EMAIL_SUPERADMIN: 'rubikmm@gmail.com',
    URL_HOME: 'https://home.test',
    URL_CONT: 'https://cont.test',
    URL_LIVE: 'https://live.test',
    URL_RADIO: 'https://radio.test',
    URL_ADMIN: 'https://admin.test',
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
        if (cale === '/utilizatori/lista') return raspunde({ utilizatori: OAMENI })
        // ⚠️ `@xc/setari` cere asocierile omului pentru rubrica „Apartenența mea".
        if (cale === '/asocieri/ale-mele') return raspunde({ asocieri: [] })
        return raspunde({})
      },
    },
    /** Cheia emisiei o are Părintele (numit) și super-adminul (rol). Enoriașul, niciuna. */
    AUTORIZARE: {
      fetch: async (adresa: string, init?: RequestInit) => {
        const cale = new URL(adresa).pathname
        const raspunde = (date: unknown) =>
          new Response(JSON.stringify(date), { headers: { 'content-type': 'application/json' } })
        if (cale === '/cine-are') return raspunde({ prinGrant: ['u1'], prinRol: ['u9'] })
        const corp = JSON.parse(String(init?.body ?? '{}')) as {
          principal?: { userId?: string }
          permission?: string
        }
        const cine = corp.principal?.userId
        const allowed = cine === 'u9' || (cine === 'u1' && corp.permission === 'broadcast.manage')
        return raspunde({ allowed, reason: 'probă', matchedScopes: [] })
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Cererile
// ---------------------------------------------------------------------------

const CSRF = `xc_csrf=${'j'.repeat(43)}`
const CA_EMISIE = `xc_sesiune=jeton-parinte; ${CSRF}`
const CA_ENORIAS = `xc_sesiune=jeton-vlad; ${CSRF}`
const CA_SUPER = `xc_sesiune=jeton-super; ${CSRF}`

const laRadio = (cale: string, cookie: string) =>
  radio.fetch(
    new Request(`https://radio.test${cale}`, { headers: { cookie } }),
    mediu('https://radio.test') as never,
    {} as ExecutionContext,
  )

const laLive = (cale: string, cookie: string) =>
  live.fetch(
    new Request(`https://live.test${cale}`, { headers: { cookie } }),
    mediu('https://live.test') as never,
    {} as ExecutionContext,
  )

/** Meniul contului stă în antet; restul paginii n-are de ce să fie citit pentru el. */
const meniul = (pagina: string) => pagina.slice(pagina.indexOf('</head>'))

// ===========================================================================

describe('(a) panoul emisiei se vede în Setările radioului', () => {
  it('cine are cheia găsește acolo rubrica „Emisia", cu panoul întreg', async () => {
    const r = await laRadio('/setari', CA_EMISIE)
    expect(r.status).toBe(200)
    const html = await r.text()

    expect(html).toContain('<h2>Emisia</h2>')
    // panoul însuși: comutatorul, cartela de stare, playerul din el
    expect(html).toContain('data-mod="live"')
    expect(html).toContain('id="bloc-acum"')
    expect(html).toContain('id="audio-radio"')
    // ⚠️ ȘI SCRIPTURILE: fără ele panoul ar fi o poză — butoanele n-ar comanda nimic, iar starea
    // n-ar mai fi citită niciodată. `@xc/setari` randează rubrica, dar scripturile le pune
    // aplicația pe carcasă, numai când rubrica a intrat în pagină.
    expect(html).toContain('/admin/stare')
    expect(html).toContain('/admin/comanda')
    // rubrica aplicației stă după cele ale platformei și înaintea drumului înapoi
    expect(html.indexOf('<h2>Emisia</h2>')).toBeLessThan(html.indexOf('← Înapoi în'))
  })

  it('un om fără cheie nu vede nici rubrica, nici panoul, nici scripturile lui', async () => {
    const html = await (await laRadio('/setari', CA_ENORIAS)).text()

    expect(html).toContain('Setări — Radioul')
    expect(html).not.toContain('<h2>Emisia</h2>')
    expect(html).not.toContain('data-mod="live"')
    expect(html).not.toContain('/admin/stare')
  })
})

describe('(b) adresele vechi ale panoului', () => {
  it('`/admin` la radio duce în Setări, unde stă acum panoul', async () => {
    const r = await laRadio('/admin', CA_EMISIE)
    expect(r.status).toBe(303)
    expect(r.headers.get('location')).toBe('/setari')
  })

  /** Și cine n-are cheia ajunge tot acolo: Setările îi arată ce e al lui, fără pagină de refuz. */
  it('`/admin` la radio nu mai randează panoul nimănui', async () => {
    const r = await laRadio('/admin', CA_ENORIAS)
    expect(r.status).toBe(303)
    expect(r.headers.get('location')).toBe('/setari')
  })

  /** Datele și comenzile au rămas pe rutele lor — panoul le cere din pagina Setărilor. */
  it('`/admin/stare` cere mai departe cheia emisiei', async () => {
    expect((await laRadio('/admin/stare', CA_ENORIAS)).status).toBe(403)
  })

  it('`/admin` la live trimite în SETĂRILE radioului, nu la panoul de dinainte', async () => {
    const r = await laLive('/admin', CA_EMISIE)
    expect(r.status).toBe(303)
    expect(r.headers.get('location')).toBe('https://radio.test/setari')
  })
})

describe('(c) Setările transmisiunii spun unde e panoul', () => {
  it('cine are cheia găsește drumul spre Setările radioului', async () => {
    const html = await (await laLive('/setari', CA_EMISIE)).text()
    expect(html).toContain('<h2>Emisia</h2>')
    expect(html).toContain('Panoul emisiei stă în Setările radioului.')
    expect(html).toContain('href="https://radio.test/setari"')
    // ⚠️ Panoul NU se dublează aici: e unul singur, dincolo (regula din 14.09.2026).
    expect(html).not.toContain('data-mod="live"')
  })

  it('un om fără cheie nu vede rândul — n-are ce căuta acolo', async () => {
    const html = await (await laLive('/setari', CA_ENORIAS)).text()
    expect(html).not.toContain('<h2>Emisia</h2>')
    expect(html).not.toContain('Panoul emisiei stă în Setările radioului.')
  })
})

/*
 * ⚠️ Rândul „Administrare" din meniul contului e NUMAI al super-adminului REAL (user, 19.09.2026:
 * „un admin nu vede altceva decât Setări"), și de pe 20.09.2026 și la emisie. Proba se uită la
 * amândouă aplicațiile: ele au fost ultimele două care mai trimiteau rândul ăsta în altă parte.
 */
describe('(d) „Administrare" e iar al platformei, la live și la radio', () => {
  for (const [nume, cere] of [
    ['radio', laRadio],
    ['live', laLive],
  ] as const) {
    it(`${nume}: super-adminul are rândul, și duce la Administrarea platformei`, async () => {
      const m = meniul(await (await cere('/setari', CA_SUPER)).text())
      expect(m).toContain('>Administrare</a>')
      expect(m).toContain('href="https://admin.test/"')
    })

    it(`${nume}: cine ține emisia NU-l are — panoul lui e în Setări`, async () => {
      const m = meniul(await (await cere('/setari', CA_EMISIE)).text())
      expect(m).not.toContain('>Administrare</a>')
      expect(m).toContain('>Setări</a>')
      // nicio urmă din potriveala veche: rândul nu mai duce la panou
      expect(m).not.toContain('/admin"')
    })
  }
})
