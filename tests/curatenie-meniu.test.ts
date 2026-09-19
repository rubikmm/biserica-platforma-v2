import { describe, expect, it } from 'vitest'
import curatenie from '../apps/curatenie/src/index.js'
import { LOCAL } from '../apps/curatenie/src/stil.js'
import { paginaLuna, type Ctx as CtxCalendar } from '../apps/calendar/src/pagini.js'
import { STIL_COMUN } from '../packages/ui/src/index.js'

/**
 * MENIUL DE CONT AL CURĂȚENIEI E AL CARCASEI, NU AL APLICAȚIEI (user, 19.09.2026, 21:06, pe
 * producție: „încă se vede ciudat meniul de la Cont. Vreau să fie exact ca la Calendar și celelalte
 * aplicații. Să pot să modific și «vezi ca» — trebuie să testez și adminii din aplicația asta").
 *
 * Ce era stricat: stilul aplicației (`stil.ts`, moștenit din V1) mai purta o regulă scrisă pe
 * selectoarele ANTETULUI, dintr-o vreme când curățenia avea contul ei și abia urma să fie legată de
 * platformă. Se stingea la o clasă pe <body> pe care legarea prin carcasă n-a mai pus-o niciodată,
 * deci era mereu aprinsă și ascundea din meniu tot ce duce la aplicația de cont: „Profil", „Ieșire"
 * și cele trei comutatoare „vezi ca". Rămâneau „Setări", „Administrare" și două linii despărțitoare
 * cu nimic între ele. Sub masca „neautentificat" meniul e făcut NUMAI din comutatoare, deci se golea
 * cu totul: super-adminul mascat rămânea fără drum înapoi.
 *
 * Nimic din asta nu se vedea citind aplicația: markup-ul era bun, sesiunea era bună, doar o linie de
 * CSS de la coada unui fișier de 860 de rânduri stingea meniul. De aceea probele de aici nu se uită
 * la o regulă anume, ci la DOUĂ lucruri care rămân adevărate oricum ar fi rescris stilul:
 *
 *  (a) meniul desenat de curățenie, pentru o sesiune dată, e IDENTIC cu cel desenat de Calendar
 *      pentru aceeași sesiune — Calendarul e etalonul cerut de user;
 *  (b) stilul aplicației nu numește niciun selector al meniului — nici ca să-l ascundă, nici ca
 *      să-l „potrivească". Ce trebuie schimbat acolo se schimbă în `@xc/ui`.
 *
 * Și (c): sub mască pagina rămâne pagina curățeniei (lista de nume), nu un drum spre Cont.
 */

// ---------------------------------------------------------------------------
// Baza de probă — numai citirile pe care le face pagina „/"
// ---------------------------------------------------------------------------

interface RandV { id: number; user_id: string; slug: string | null; created_at: string; updated_at: string }

const v = (id: number, user_id: string): RandV =>
  ({ id, user_id, slug: null, created_at: '2026-01-01 10:00:00', updated_at: '2026-01-01 10:00:00' })

/** Un D1 de hârtie: recunoaște, după textul normalizat, interogările paginii. Restul cade zgomotos. */
function bazaDeProba(volunteers: RandV[]) {
  function executa(sqlBrut: string, p: unknown[]): Record<string, unknown>[] {
    const s = sqlBrut.replace(/\s+/g, ' ').trim()
    const numar = (i: number) => Number(p[i])
    const text = (i: number) => String(p[i])

    if (s.startsWith('SELECT * FROM volunteers WHERE id = ?')) return volunteers.filter((r) => r.id === numar(0))
    if (s.startsWith('SELECT * FROM volunteers WHERE user_id = ?')) return volunteers.filter((r) => r.user_id === text(0))
    if (s.startsWith('SELECT * FROM volunteers')) return [...volunteers]
    if (s.startsWith('SELECT a.*, v.user_id FROM assignments a JOIN volunteers v')) return []
    if (s.startsWith('SELECT DISTINCT substr(sunday_date, 1, 7) AS ym FROM assignments')) return []
    if (s.startsWith('SELECT v.id, v.user_id, vc.year, vc.month FROM volunteer_vacations')) return []
    if (s.startsWith('SELECT year, month FROM volunteer_vacations WHERE volunteer_id = ?')) return []
    if (s.startsWith('SELECT MAX(created_at) FROM notifications_log')) return [{ m: null }]
    if (s.startsWith('SELECT value FROM app_settings')) return []

    throw new Error(`interogare necunoscută în baza de probă: ${s}`)
  }

  const declaratie = (sql: string, p: unknown[]) => ({
    sql,
    p,
    async all() { return { results: executa(sql, p) } },
    async first() { return executa(sql, p)[0] ?? null },
    async run() { return { meta: { last_row_id: 0 } } },
  })

  return {
    prepare: (sql: string) => ({ ...declaratie(sql, []), bind: (...p: unknown[]) => declaratie(sql, p) }),
    batch: async (st: { sql: string; p: unknown[] }[]) => st.map((x) => ({ results: executa(x.sql, x.p) })),
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new ArrayBuffer(0),
  }
}

// ---------------------------------------------------------------------------
// Mediul: un SUPER-ADMIN, cu mască și fără
// ---------------------------------------------------------------------------

const om = (userId: string, firstName: string, lastName: string) => ({
  userId,
  email: `${firstName.toLowerCase()}@example.com`,
  displayName: `${firstName} ${lastName}`,
  firstName,
  lastName,
  phone: null,
  shortName: null,
  disabledAt: null,
  stare: 'acceptata',
  etichete: ['voluntar'],
  cerutDe: null,
  acceptatDe: null,
})

const MEMBRI = [om('u1', 'Maria', 'Ionescu'), om('u2', 'Mihai', 'Popescu')]

const NUME_SUPER = 'Marius Rubik'

/**
 * Super-adminul nemascat. `poateVedeaCa` vine GATA CALCULAT de la identitate (din rolul adevărat),
 * exact ca pe viu — aplicația nu citește ea roluri ca să deseneze un meniu.
 */
const SESIUNE_SUPER = {
  authenticated: true,
  user: {
    id: 'u1', email: 'rubikmm@gmail.com', displayName: NUME_SUPER,
    firstName: 'Marius', lastName: 'Rubik', phone: null, shortName: null,
    emailVerifiedAt: null, disabledAt: null, createdAt: '2026-01-01T00:00:00.000Z',
  },
  roles: [{ role: 'super-admin', scope: 'global' }],
  sessionId: 's1',
  expiresAt: null,
  veziCa: null,
  poateVedeaCa: true,
}

/**
 * ⚠️ Sub masca „neautentificat" identitatea întoarce o sesiune ANONIMĂ, cu masca și cu dreptul de a
 * purta măști lipite pe ea (identity-worker). Adică: fără om, fără roluri — tocmai de aceea meniul
 * cu comutatoare e singurul drum de întoarcere, și tocmai de aceea trebuie să existe.
 */
const SESIUNE_MASCATA = {
  authenticated: false,
  user: null,
  roles: [] as { role: string; scope: string }[],
  sessionId: null,
  expiresAt: null,
  veziCa: 'anonim',
  poateVedeaCa: true,
}

/**
 * ⚠️ Sub masca „→ Administrator" identitatea PĂSTREAZĂ omul și îi ÎNLOCUIEȘTE rolurile cu rolul
 * global `admin` (`services/identity-worker/src/index.ts`, `roles: veziCa ? [{ role: veziCa… }]`).
 * Deci exact asta vede aplicația și de la un administrator global adevărat, nemascat: aceeași
 * sesiune servește ambele cazuri, și tocmai de aceea proba de mai jos le acoperă pe amândouă.
 */
const SESIUNE_ADMIN = {
  ...SESIUNE_SUPER,
  roles: [{ role: 'admin', scope: 'global' }],
  veziCa: 'admin',
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
        const raspunde = (date: unknown) =>
          new Response(JSON.stringify(date), { headers: { 'content-type': 'application/json' } })
        if (cale === '/sesiune') {
          const { token } = JSON.parse(String(init?.body ?? '{}')) as { token?: string }
          if (token === 'jeton-super') return raspunde(SESIUNE_SUPER)
          if (token === 'jeton-mascat') return raspunde(SESIUNE_MASCATA)
          if (token === 'jeton-admin') return raspunde(SESIUNE_ADMIN)
          return new Response('nu', { status: 401 })
        }
        if (cale === '/asocieri/membri') return raspunde({ membri: MEMBRI })
        return raspunde({})
      },
    },
    /** Nimeni n-are `cleaning.manage`: meniul contului nu atârnă de cheia aplicației, ci de rol. */
    AUTORIZARE: {
      fetch: async () =>
        new Response(JSON.stringify({ allowed: false, reason: 'probă', matchedScopes: [] }), {
          headers: { 'content-type': 'application/json' },
        }),
    },
  }
}

const JETON = 'j'.repeat(43)
const CSRF = `xc_csrf=${JETON}`
const CA_SUPER = `xc_sesiune=jeton-super; ${CSRF}`
const CA_MASCAT = `xc_sesiune=jeton-mascat; ${CSRF}`
const CA_ADMIN = `xc_sesiune=jeton-admin; ${CSRF}`

const cere = (env: unknown, cale: string, cookie: string) =>
  curatenie.fetch(new Request(`https://curatenie.test${cale}`, { headers: { cookie } }), env as never, {} as ExecutionContext)

const echipa = () => bazaDeProba([v(1, 'u1'), v(2, 'u2')])

// ---------------------------------------------------------------------------
// Meniul, ca bucată de HTML
// ---------------------------------------------------------------------------

/**
 * Meniul contului din antet, exact așa cum iese din carcasă. Se caută marcajul, nu cuvintele:
 * numele claselor apar oricum în `<style>`, pe orice pagină, fără să însemne că se vede ceva.
 * `null` când pagina n-a desenat niciun meniu (om neintrat, fără mască).
 */
function meniulContului(html: string): string | null {
  const i = html.indexOf('<details class="cont-meniu">')
  if (i < 0) return null
  const j = html.indexOf('</details>', i)
  return html.slice(i, j + '</details>'.length)
}

/** Etalonul: aceeași sesiune, desenată de Calendar. Aceleași adrese, ca menirile să fie comparabile. */
function meniulCalendarului(o: { utilizator: string | null; eAdminPlatforma: boolean; veziCa: string | null; poateVedeaCa: boolean }): string | null {
  const ctx = {
    prefix: '',
    nav: { home: '', cont: 'https://cont.test', admin: '/admin' },
    utilizator: o.utilizator,
    eAdmin: false,
    eAdminPlatforma: o.eAdminPlatforma,
    versiune: '0',
    modificata: '',
    anCurent: 2026,
    veziCa: o.veziCa,
    poateVedeaCa: o.poateVedeaCa,
    spre: 'https://curatenie.test/',
  } as unknown as CtxCalendar
  return meniulContului(paginaLuna({ ctx, an: 2026, luna: 9, randuri: [], calculat: false, azi: '2026-09-19' }))
}

// ===========================================================================

describe('(a) meniul contului: curățenia desenează exact ce desenează Calendarul', () => {
  it('super-adminul nemascat are același meniu, rând cu rând', async () => {
    const html = await (await cere(mediu(echipa()), '/', CA_SUPER)).text()
    const alCuratenie = meniulContului(html)

    expect(alCuratenie).not.toBeNull()
    expect(alCuratenie).toBe(
      meniulCalendarului({ utilizator: NUME_SUPER, eAdminPlatforma: true, veziCa: null, poateVedeaCa: true }),
    )

    /*
     * ⚠️ Și rândurile pe nume, ca proba să spună CE lipsește atunci când cade — o comparație de
     * șiruri singură ar arăta doar că cele două pagini s-au depărtat, nu și încotro.
     */
    const meniu = alCuratenie ?? ''
    for (const rand of ['Profil', 'Setări', 'Administrare', 'Ieșire', '→ Utilizator', '→ Administrator', '→ Neautentificat']) {
      expect(meniu).toContain(rand)
    }
    // Ușa spre platformă, nu spre o pagină a curățeniei: profilul și ieșirea sunt ale contului.
    expect(meniu).toContain('href="https://cont.test/"')
    expect(meniu).toContain('href="https://cont.test/auth/logout"')
    // Setările sunt ale APLICAȚIEI, ca la toate aplicațiile V2.
    expect(meniu).toContain('href="/setari"')
    // Comutatoarele duc la aplicația de cont și se întorc exact în pagina de acum.
    expect(meniu).toContain(`https://cont.test/vezi-ca?ca=user&spre=${encodeURIComponent('https://curatenie.test/')}`)
  })

  it('sub masca „neautentificat" rămâne meniul cu drumul de întoarcere, tot ca la Calendar', async () => {
    const html = await (await cere(mediu(echipa()), '/', CA_MASCAT)).text()
    const alCuratenie = meniulContului(html)

    expect(alCuratenie).not.toBeNull()
    expect(alCuratenie).toBe(
      meniulCalendarului({ utilizator: null, eAdminPlatforma: false, veziCa: 'anonim', poateVedeaCa: true }),
    )

    const meniu = alCuratenie ?? ''
    // Rândul purtat e roșu și, apăsat din nou, scoate masca — singura ieșire de când banda a plecat.
    expect(meniu).toMatch(/class="cont-acum"[^>]*>→ Neautentificat</)
    expect(meniu).toContain('https://cont.test/vezi-ca?ca=real')
    // Nimic din contul adevărat: masca înseamnă că platforma nu mai știe pe nimeni.
    expect(meniu).not.toContain('Profil')
    expect(meniu).not.toContain('Ieșire')
  })
})

describe('(b) stilul aplicației nu se atinge de antet, de meniu și de subsol', () => {
  /**
   * ⚠️ Selectoarele meniului sunt ale CARCASEI. Dacă un rând de-al ei trebuie ascuns ori vopsit,
   * asta se cere în `@xc/ui`, pentru toate aplicațiile deodată — altfel iese exact ce a văzut
   * userul pe 19.09.2026: un meniu care arată altfel într-o singură aplicație, fără ca vreun
   * fișier al ei să pară de vină.
   */
  it('`LOCAL` nu numește niciun selector al meniului de cont', () => {
    for (const selector of ['cont-lista', 'cont-meniu', 'cont-acum', 'cont-desparte', 'cu-platforma']) {
      expect(LOCAL).not.toContain(selector)
    }
  })

  it('nici antetul, nici subsolul carcasei nu sunt rescrise de aplicație', () => {
    for (const selector of ['.sus', '.eyebrow', '.titlu', '.subsol', '.versiune', '.buton-tema']) {
      expect(LOCAL).not.toContain(selector)
    }
  })

  /**
   * Și dovada pe pagina întreagă: regulile despre meniu care ajung la browser sunt CELE ALE
   * CARCASEI, toate, și numai ele. Se numără, fiindcă numele claselor apar în `<style>` oricum.
   */
  it('pagina nu poartă nicio regulă despre meniu în afară de ale carcasei', async () => {
    const html = await (await cere(mediu(echipa()), '/', CA_SUPER)).text()
    const stil = html.slice(html.indexOf('<style>'), html.indexOf('</style>'))
    const cate = (text: string, ac: string) => text.split(ac).length - 1
    for (const selector of ['.cont-lista', '.cont-meniu', 'cu-platforma']) {
      expect(cate(stil, selector)).toBe(cate(STIL_COMUN, selector))
    }
  })
})

describe('(c) masca nu te scoate din curățenie', () => {
  /**
   * ⚠️ Regula platformei (user, 14.09.2026: „când selectez un mod… să rămână în pagina în care
   * sunt"). Masca „neautentificat" lasă sesiunea fără om, deci o pagină care se uită numai la
   * `userId` l-ar trimite pe super-adminul mascat tocmai din aplicația pe care voia s-o vadă.
   */
  it('pagina „/" arată lista de nume, nu un drum spre Cont', async () => {
    const r = await cere(mediu(echipa()), '/', CA_MASCAT)
    expect(r.status).toBe(200)
    const html = await r.text()
    expect(html).toContain('id="pickerFantoma"')
    // Cine e mascat vede ce vede un om neintrat: calendarul e de citit, nu de apăsat.
    expect(html).toContain('doar vizualizare')
  })

  it('`/admin` sub mască nu mai pleacă la intrarea platformei', async () => {
    const r = await cere(mediu(echipa()), '/admin', CA_MASCAT)
    expect(r.status).toBe(303)
    const unde = r.headers.get('location') ?? ''
    expect(unde).not.toContain('cont.test')
    expect(unde).toBe('/setari')
  })

  /** Drumul spre intrare rămâne întreg pentru omul care chiar nu e intrat (fără mască). */
  it('`/admin` fără mască și fără cont duce mai departe la intrarea platformei', async () => {
    const r = await cere(mediu(echipa()), '/admin', CSRF)
    expect(r.status).toBe(303)
    expect(r.headers.get('location') ?? '').toContain('https://cont.test/intra')
  })
})

// ---------------------------------------------------------------------------
// (d) „Administrare" în meniu e NUMAI al super-adminului
// ---------------------------------------------------------------------------

/**
 * ⚠️ HOTĂRÂREA USERULUI, 19.09.2026: „văd că un admin are acces la Administrare globală — nu ar
 * trebui să vadă altceva decât Setări". Adică rândul „Administrare" din meniul contului, care duce
 * la panoul PLATFORMEI, e al super-adminului și atât. Un administrator — de aplicație sau chiar cu
 * rolul global `admin` — vede Profil / Setări / Ieșire; adminii de aplicație se numesc din Setări.
 *
 * Până acum rândul se aprindea în ZECE aplicații cu `role === 'admin' || role === 'super-admin'`,
 * deci și sub masca „→ Administrator" — tocmai cazul în care userul l-a văzut pe producție. Cum
 * masca doar COBOARĂ treapta (identity-worker: rolurile reale se înlocuiesc cu rolul mascat), un
 * rând legat numai de `super-admin` dispare de la sine sub orice mască. Asta se probează aici.
 */
describe('(d) rândul „Administrare" din meniu e numai al super-adminului', () => {
  it('rolul global `admin` (și masca „→ Administrator") nu-l vede — dar are Setări', async () => {
    const html = await (await cere(mediu(echipa()), '/', CA_ADMIN)).text()
    const meniu = meniulContului(html) ?? ''
    expect(meniu).not.toBe('')

    // Rândul lipsește ca MARCAJ, nu ca simplu cuvânt: „Administrare" apare oricum în pagină.
    expect(meniu).not.toContain('>Administrare</a>')
    // Și nici drumul spre panoul platformei, oricum ar fi scris rândul care l-ar purta.
    expect(meniu).not.toContain('/admin/')

    // Ce îi RĂMÂNE: exact atât, nici mai puțin.
    expect(meniu).toContain('>Setări</a>')
    expect(meniu).toContain('>Profil</a>')
    expect(meniu).toContain('>Ieșire</a>')

    // Aceeași sesiune, desenată de Calendar: etalonul spune la fel.
    expect(meniu).toBe(
      meniulCalendarului({ utilizator: NUME_SUPER, eAdminPlatforma: false, veziCa: 'admin', poateVedeaCa: true }),
    )
  })

  it('super-adminul adevărat îl vede mai departe', async () => {
    const html = await (await cere(mediu(echipa()), '/', CA_SUPER)).text()
    const meniu = meniulContului(html) ?? ''
    expect(meniu).toContain('>Administrare</a>')
    expect(meniu).toContain('>Setări</a>')
  })

  /**
   * Structural, fiindcă regula e a PLATFORMEI, nu a curățeniei: aprinderea rândului stă în zece
   * fișiere deodată, iar o aplicație nouă (sau una rescrisă) o poate lua pe cea veche de la vecin.
   * Se caută tiparul care aprinde rândul din sesiunea de ACUM — nu orice pomenire a rolului
   * `admin`: `apps/admin` îl compară legitim ca să AȘEZE oamenii pe cete în lista Oameni și să le
   * scrie eticheta de rol, iar acolo e vorba de rolul ALTUIA, nu de meniul celui care se uită.
   */
  it('nicio aplicație nu mai aprinde rândul din rolul `admin`', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const radacina = new URL('../', import.meta.url).pathname

    /*
     * ⚠️ `live` și `radio` sunt excepția hotărâtă pe 18.09.2026: acolo rândul nu duce la panoul
     * platformei, ci la panoul EMISIEI, și e pe cheia `broadcast.manage` — deci nici nu intră în
     * tiparul de mai jos. Sunt sărite ca să se vadă negru pe alb că excepția e știută, nu uitată.
     */
    const EXCEPTII = ['live', 'radio']
    const vinovate: string[] = []
    let cuSuperAdmin = 0
    let fisiere = 0

    const umbla = (dosar: string) => {
      for (const nume of readdirSync(dosar)) {
        const cale = join(dosar, nume)
        if (statSync(cale).isDirectory()) {
          if (nume !== 'node_modules' && !nume.startsWith('.')) umbla(cale)
          continue
        }
        if (!nume.endsWith('.ts')) continue
        fisiere++
        const brut = readFileSync(cale, 'utf8')
        // Fără comentarii (rândurile de explicații numesc tiparul vechi ca să spună că a plecat)
        // și fără spații ori fel de ghilimele, ca proba să nu atârne de formatare.
        const cod = brut
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '')
          .replace(/"/g, "'")
          .replace(/\s+/g, '')
        const scurt = cale.slice(radacina.length)
        if (/r\.role==='super-admin'/.test(cod)) cuSuperAdmin++
        // (1) rolul curent citit ca „admin", oricum ar fi scris restul expresiei;
        // (2) perechea „admin SAU super-admin", în ambele ordini — forma de dinainte de 19.09.2026.
        if (
          /sesiune\.roles\.some\(\(r\)=>r\.role==='admin'/.test(cod) ||
          /r\.role==='admin'\|\|/.test(cod) ||
          /\|\|r\.role==='admin'/.test(cod)
        ) {
          vinovate.push(scurt)
        }
      }
    }

    for (const app of readdirSync(join(radacina, 'apps'))) {
      if (EXCEPTII.includes(app)) continue
      const src = join(radacina, 'apps', app, 'src')
      if (statSync(src).isDirectory()) umbla(src)
    }

    expect(vinovate).toEqual([])
    // ⚠️ Și că proba chiar s-a uitat la cod: o căutare care nu prinde nimic „trece" degeaba.
    expect(fisiere).toBeGreaterThan(20)
    expect(cuSuperAdmin).toBeGreaterThanOrEqual(10)
  })
})
