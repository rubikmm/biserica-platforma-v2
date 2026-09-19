import { describe, expect, it } from 'vitest'
import { ruteazaSetari, type MediuSetari } from '../packages/setari/src/index.js'
import curatenie from '../apps/curatenie/src/index.js'

/**
 * SETĂRILE SUB MASCA „VEZI CA" (user, 14.09.2026: „când selectez un mod — «vezi ca neautentificat»
 * sau «vezi ca administrator» — să nu se mai ducă în Cont, pagină profil, să rămână în pagina în
 * care sunt"; și 19.09.2026: Setările sunt opțiunile aplicației, acolo stau și adminii ei).
 *
 * Ce era stricat: poarta din `@xc/setari` se uita numai la `principal`. Sub masca „neautentificat"
 * identitatea întoarce o sesiune ANONIMĂ — deci `principal` e `null` deși la tastatură stă un
 * super-admin — iar pagina îl arunca la intrarea platformei tocmai când voia să vadă ce vede un om
 * neintrat. La curățenie se vedea de două ori: `/admin` trimite acum în `/setari`, deci masca îl
 * scotea din aplicație pe drumul cel mai umblat.
 *
 * Probele păzesc trei lucruri:
 *  (a) drumul spre intrare rămâne ÎNTREG pentru omul care chiar nu e intrat (fără mască);
 *  (b) sub mască pagina se deschide, spune a cui e „vina" și NU arată rubricile omului intrat;
 *  (c) sub mască nu se scrie nimic — nicio faptă nu atinge vreun serviciu.
 *
 * Și una structurală: orice aplicație care cheamă `ruteazaSetari` îi dă și masca. Fără ea poarta
 * n-are cum să știe, iar aplicația uitată s-ar strica tăcut, într-un singur mod de vizualizare.
 */

// ---------------------------------------------------------------------------
// (1) Poarta, la sursă — cu uneltele Calendarului
// ---------------------------------------------------------------------------

/** Serviciile de probă: scriu unde s-a bătut. Sub mască lista trebuie să rămână GOALĂ. */
function mediu(urme: string[]): MediuSetari {
  const fetcher = (cine: string, raspuns: (cale: string) => unknown) =>
    ({
      fetch: async (adresa: string) => {
        const cale = new URL(adresa).pathname
        urme.push(`${cine}:${cale}`)
        return new Response(JSON.stringify(raspuns(cale)), { status: 200, headers: { 'content-type': 'application/json' } })
      },
    }) as unknown as Fetcher
  return {
    IDENTITATE: fetcher('identitate', () => ({ asocieri: [] })),
    COMUNICARE: fetcher('comunicare', (c) =>
      c === '/audiente/membri' ? { membri: [] } : c === '/preferinte/citeste' ? { optedOut: false } : { ok: true },
    ),
    AUTORIZARE: fetcher('autorizare', () => ({ allowed: false, reason: 'probă', matchedScopes: [] })),
    AUDIT: fetcher('audit', () => ({ intrari: [] })),
  }
}

function unelte(o: { veziCa?: string | null } = {}) {
  return {
    cod: 'calendar',
    nume: 'Calendar',
    prefix: '/calendar',
    cfg: { MEDIU: 'dev', DOMENIU_COOKIE: 'rubik' },
    cid: 'proba',
    // ⚠️ `null` chiar și sub mască: asta e tot rostul probei — identitatea nu mai știe pe nimeni.
    principal: null,
    urlCont: 'https://cont.test',
    urlTermeni: 'https://sfantul-ilie.ro/termeni',
    carcasa: (c: { titluPagina: string; corp: string }) => `<!--${c.titluPagina}-->${c.corp}`,
    ...o,
  }
}

describe('(a) fără mască, drumul spre intrare e neatins', () => {
  it('`/setari` fără cont trimite la intrare, cu întoarcere exact aici', async () => {
    const urme: string[] = []
    const r = await ruteazaSetari(new Request('https://calendar.test/setari'), '/setari', mediu(urme), unelte())
    expect(r!.status).toBe(303)
    expect(r!.headers.get('location')).toBe('https://cont.test/auth/login?spre=%2Fcalendar%2Fsetari')
    expect(urme).toEqual([])
  })
})

describe('(b) sub mască pagina rămâne în aplicație', () => {
  it('Calendar: 200, cu vorba măștii și cu drumul înapoi', async () => {
    const urme: string[] = []
    const r = await ruteazaSetari(
      new Request('https://calendar.test/setari'),
      '/setari',
      mediu(urme),
      unelte({ veziCa: 'anonim' }),
    )
    expect(r!.status).toBe(200)
    const h = await r!.text()
    expect(h).toContain('Te uiți ca neautentificat')
    expect(h).toContain('Un om neintrat n-are setări aici')
    // ⚠️ Nimic din ce e al omului intrat: un om neintrat n-are abonare, n-are preferință de e-mail.
    expect(h).not.toContain('Abonarea mea')
    expect(h).not.toContain('E-mailul de la platformă')
    expect(h).not.toContain('Apartenența mea')
    // Rămâne în aplicație: titlul ei și legătura înapoi în ea.
    expect(h).toContain('Setări — Calendar')
    expect(h).toContain('← Înapoi în Calendar')
    // Pagina ține de sesiune: nu se dă cache-ului nici sub mască.
    expect(r!.headers.get('cache-control')).toBe('private, no-store')
    // Și, mai ales: n-a întrebat nimic pe nimeni — n-avea pe cine.
    expect(urme).toEqual([])
  })

  it('masca „utilizator" își spune și ea numele, nu-l împrumută pe al alteia', async () => {
    const r = await ruteazaSetari(
      new Request('https://calendar.test/setari'),
      '/setari',
      mediu([]),
      unelte({ veziCa: 'user' }),
    )
    expect(await r!.text()).toContain('Te uiți ca utilizator')
  })
})

describe('(c) sub mască nu se scrie nimic', () => {
  it('o faptă trimisă de mână duce înapoi la pagină, fără să atingă vreun serviciu', async () => {
    const urme: string[] = []
    const date = new FormData()
    date.set('optedOut', '1')
    const r = await ruteazaSetari(
      new Request('https://calendar.test/setari/email', { method: 'POST', body: date }),
      '/setari/email',
      mediu(urme),
      unelte({ veziCa: 'anonim' }),
    )
    expect(r!.status).toBe(303)
    expect(r!.headers.get('location')).toBe('/calendar/setari')
    expect(urme).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// (2) Lanțul întreg, la curățenie: `/setari` și `/admin` sub masca „anonim"
// ---------------------------------------------------------------------------

interface RandV { id: number; user_id: string; slug: string | null; created_at: string; updated_at: string }

const v = (id: number, user_id: string): RandV =>
  ({ id, user_id, slug: null, created_at: '2026-01-01 10:00:00', updated_at: '2026-01-01 10:00:00' })

/** Un D1 de hârtie, cât îi trebuie paginii „/". Orice altă interogare cade zgomotos. */
function bazaDeProba(volunteers: RandV[]) {
  function executa(sqlBrut: string, p: unknown[]): Record<string, unknown>[] {
    const s = sqlBrut.replace(/\s+/g, ' ').trim()
    if (s.startsWith('SELECT * FROM volunteers WHERE id = ?')) return volunteers.filter((r) => r.id === Number(p[0]))
    if (s.startsWith('SELECT * FROM volunteers WHERE user_id = ?')) return volunteers.filter((r) => r.user_id === String(p[0]))
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

/**
 * ⚠️ Sub masca „neautentificat" identitatea întoarce o sesiune ANONIMĂ, cu masca și cu dreptul de a
 * purta măști lipite pe ea (identity-worker): fără om, fără roluri.
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

function mediulCurateniei(DB: unknown) {
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
          if (token === 'jeton-mascat') return raspunde(SESIUNE_MASCATA)
          return new Response('nu', { status: 401 })
        }
        if (cale === '/asocieri/membri') return raspunde({ membri: [] })
        if (cale === '/asocieri/ale-mele') return raspunde({ asocieri: [] })
        return raspunde({})
      },
    },
    AUTORIZARE: {
      fetch: async () =>
        new Response(JSON.stringify({ allowed: false, reason: 'probă', matchedScopes: [] }), {
          headers: { 'content-type': 'application/json' },
        }),
    },
  }
}

const CSRF = `xc_csrf=${'j'.repeat(43)}`
const CA_MASCAT = `xc_sesiune=jeton-mascat; ${CSRF}`

const cere = (cale: string, cookie: string) =>
  curatenie.fetch(
    new Request(`https://curatenie.test${cale}`, { headers: { cookie } }),
    mediulCurateniei(bazaDeProba([v(1, 'u1'), v(2, 'u2')])) as never,
    {} as ExecutionContext,
  )

describe('curățenia, lanțul întreg sub masca „anonim"', () => {
  it('„/" arată pagina aplicației, cu alegerea numelui', async () => {
    const r = await cere('/', CA_MASCAT)
    expect(r.status).toBe(200)
    expect(await r.text()).toContain('id="pickerFantoma"')
  })

  it('„/setari" se deschide și spune că te uiți ca neautentificat', async () => {
    const r = await cere('/setari', CA_MASCAT)
    expect(r.status).toBe(200)
    const html = await r.text()
    expect(html).toContain('Te uiți ca neautentificat')
    expect(html).toContain('Setări — Curățenia')
    expect(html).not.toContain('E-mailul de la platformă')
    expect(html).not.toContain('Apartenența mea')
    // ⚠️ Și panoul: rubrica aplicației atârnă de cheia ei, iar sub mască nu e cine s-o aibă.
    expect(html).not.toContain('Echipa și rapoartele')
  })

  /** Drumul cel mai umblat: `/admin` → `/setari` → pagină, fără nicio ieșire din aplicație. */
  it('„/admin" duce în Setări, iar Setările răspund 200 — nu la Cont', async () => {
    const r = await cere('/admin', CA_MASCAT)
    expect(r.status).toBe(303)
    const unde = r.headers.get('location') ?? ''
    expect(unde).toBe('/setari')
    expect(unde).not.toContain('cont.test')
    expect((await cere(unde, CA_MASCAT)).status).toBe(200)
  })

  /** Drumul spre intrare rămâne întreg pentru omul care chiar nu e intrat (fără mască). */
  it('fără mască și fără cont, „/setari" pleacă tot la intrarea platformei', async () => {
    const r = await cere('/setari', CSRF)
    expect(r.status).toBe(303)
    expect(r.headers.get('location') ?? '').toContain('cont.test')
  })
})

// ---------------------------------------------------------------------------
// (3) Structural: nicio aplicație nu uită masca
// ---------------------------------------------------------------------------

describe('toate aplicațiile îi dau poarta masca', () => {
  /**
   * ⚠️ Poarta e scrisă o dată, în `@xc/setari`, dar masca vine din aplicație — deci o aplicație
   * nouă (ori una rescrisă) o poate uita, și atunci se strică TĂCUT: totul merge, în afară de un
   * singur mod de vizualizare, pe care nu-l încearcă nimeni până pe producție.
   */
  it('fiecare apel al lui `ruteazaSetari` poartă `veziCa`', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const radacina = new URL('../', import.meta.url).pathname
    const faraMasca: string[] = []
    let gasite = 0
    const umbla = (dosar: string) => {
      for (const nume of readdirSync(dosar)) {
        const cale = join(dosar, nume)
        if (statSync(cale).isDirectory()) {
          if (nume !== 'node_modules' && !nume.startsWith('.')) umbla(cale)
          continue
        }
        if (!nume.endsWith('.ts')) continue
        const linii = readFileSync(cale, 'utf8').split('\n')
        linii.forEach((linie, i) => {
          if (!linie.includes('ruteazaSetari(')) return
          gasite++
          // obiectul uneltelor: de la apel până la rândul lui de închidere (`})` singur pe rând)
          const sfarsit = linii.findIndex((l, j) => j > i && l.trim() === '})')
          const apel = linii.slice(i, sfarsit < 0 ? i + 40 : sfarsit).join('\n')
          if (!/\bveziCa:/.test(apel)) faraMasca.push(`${cale.slice(radacina.length)}:${i + 1}`)
        })
      }
    }
    umbla(join(radacina, 'apps'))
    expect(faraMasca).toEqual([])
    // ⚠️ și că proba chiar a găsit apelurile: o căutare care nu prinde nimic „trece" degeaba
    expect(gasite).toBe(11)
  })
})
