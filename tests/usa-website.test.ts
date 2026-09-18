import { describe, expect, it } from 'vitest'
import home, { corp } from '../apps/home/src/index.js'
import { navigatieDin } from '../packages/config/src/index.js'
import { PERMISIUNI_IMPLICITE, SCOPE_GLOBAL } from '../packages/contracts/src/index.js'

/**
 * UȘA WEBSITE-ULUI — semnele de stare de pe butoanele aplicațiilor.
 *
 * ⚠️ Regula, cerută de user pe 17.09.2026, seara („voiam doar admin"): chenarele verzi și roșii
 * sunt însemnările NOASTRE de șantier și se văd NUMAI la admin. Pe ușa publică butoanele arată
 * toate la fel, ca până pe 17.09.
 *
 * De ce merită probe: e o scurgere tăcută. Dacă poarta cade, nimic nu se strică și nicio eroare nu
 * apare — doar că enoriașul citește pe ușa parohiei un chenar roșu la „Curățenia bisericii" și
 * înțelege că aplicația e stricată. Iar cealaltă direcție (chenarele dispărute și la admin) trece
 * la fel de nevăzută, fiindcă totul arată curat.
 */

const CONFIG = {
  MEDIU: 'staging',
  ORIGINE_PUBLICA: 'https://website.staging.sfantul-ilie.ro',
  DOMENIU_COOKIE: '.staging.sfantul-ilie.ro',
  EMAIL_SUPERADMIN: 'rubikmm@gmail.com',
}

const NAV = navigatieDin(CONFIG as never)

/** Sesiunea întoarsă de identitate. `roles` sunt EFECTIVE: sub mască, aici apare masca. */
function sesiune(roluri: string[], intrat = true) {
  return {
    authenticated: intrat,
    user: intrat
      ? {
          id: 'u1',
          email: 'cineva@example.com',
          displayName: 'Cineva',
          firstName: null,
          lastName: null,
          phone: null,
          shortName: null,
          emailVerifiedAt: null,
          disabledAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        }
      : null,
    // ⚠️ `scope` trece prin zod la citirea sesiunii: „*" NU e scope valid, iar o sesiune care nu
    // se parsează se preface tăcut în cea anonimă. Aici se cheamă `global`.
    roles: roluri.map((role) => ({ role, scope: SCOPE_GLOBAL })),
    sessionId: intrat ? 's1' : null,
    expiresAt: null,
    veziCa: null,
    poateVedeaCa: false,
  }
}

/**
 * AUTORIZAREA, ca la adevărat.
 *
 * ⚠️ Din 18.09.2026 chenarele NU mai atârnă de rolul citit din sesiune, ci de cheia Website-ului
 * (`website.manage`), hotărâtă de autorizarea centrală — așa poate fi cineva administrator numai
 * aici. Deci proba trebuie să răspundă ca serviciul: din rolurile EFECTIVE ale sesiunii (deci și
 * masca) plus granturile punctuale. Un `{}` întors de-a valma ar fi însemnat „refuz" la orice și ar
 * fi făcut proba să cadă pe o cauză greșită.
 */
function autorizare(roluri: string[], granturi: string[] = []) {
  return {
    fetch: async (_adresa: string, init?: RequestInit) => {
      const cerere = JSON.parse(String(init?.body ?? '{}')) as { permission?: string }
      const cheie = cerere.permission ?? ''
      const dinRol = roluri.some((r) =>
        (PERMISIUNI_IMPLICITE[r as keyof typeof PERMISIUNI_IMPLICITE] ?? []).includes(cheie as never),
      )
      const allowed = dinRol || granturi.includes(cheie)
      return new Response(JSON.stringify({ allowed, reason: 'probă', matchedScopes: [] }), {
        headers: { 'content-type': 'application/json' },
      })
    },
  }
}

function mediu(raspunsSesiune: unknown, granturi: string[] = []) {
  const roluri = ((raspunsSesiune as { roles?: { role: string }[] }).roles ?? []).map((r) => r.role)
  return {
    ...CONFIG,
    IDENTITATE: {
      fetch: async () =>
        new Response(JSON.stringify(raspunsSesiune), { headers: { 'content-type': 'application/json' } }),
    },
    // Ușa merge și fără bază: `rezumate` cade, e prinsă, iar cele două categorii lipsesc.
    DB: undefined,
    AUTORIZARE: autorizare(roluri, granturi),
    COMUNICARE: { fetch: async () => new Response('{}') },
    AUDIT: { fetch: async () => new Response('{}') },
  }
}

/**
 * ⚠️ FĂRĂ COOKIE NU SE ÎNTREABĂ NIMENI NIMIC: `sesiuneCurenta` întoarce sesiunea anonimă de-a
 * dreptul, fără să cheme identitatea. Prima scriere a probelor astea n-avea cookie, deci și
 * „adminul" primea ușa omului — proba trecea pe o cauză greșită. Cine intră cu cont are jeton.
 */
const usa = (env: unknown, cuCont = true) =>
  home.fetch(
    new Request('https://website.staging.sfantul-ilie.ro/', {
      headers: cuCont ? { cookie: 'xc_sesiune=jeton-de-proba' } : {},
    }),
    env as never,
  )

describe('ușa Website-ului — semnele de stare sunt numai ale adminului', () => {
  it('fără admin, niciun buton nu poartă stare', () => {
    const html = corp(NAV)
    expect(html).not.toContain('class="bine"')
    expect(html).not.toContain('class="urgent"')
    // …dar butoanele sunt toate acolo: poarta e pe CULOARE, nu pe ce se vede.
    expect(html).toContain('Curățenia bisericii')
    expect(html).toContain('Calendarul')
  })

  it('la admin, chenarele apar — verde și roșu', () => {
    const html = corp(NAV, true)
    expect(html).toContain('class="bine"')
    expect(html).toContain('class="urgent"')
  })

  it('ușa arată aceleași butoane, în aceeași ordine, la amândoi', () => {
    const nume = (h: string) => [...h.matchAll(/<b>([^<]+)<\/b>/g)].map((m) => m[1])
    expect(nume(corp(NAV))).toEqual(nume(corp(NAV, true)))
  })

  it('enoriașul neautentificat primește ușa fără chenare', async () => {
    const raspuns = await usa(mediu(sesiune([], false)), false)
    const text = await raspuns.text()
    expect(raspuns.status).toBe(200)
    expect(text).not.toContain('class="bine"')
    expect(text).not.toContain('class="urgent"')
  })

  it('utilizatorul cu cont, dar fără rol de admin, tot nu le vede', async () => {
    const text = await (await usa(mediu(sesiune(['user'])))).text()
    expect(text).not.toContain('class="bine"')
    expect(text).not.toContain('class="urgent"')
  })

  it('adminul și super-adminul le văd', async () => {
    for (const rol of ['admin', 'super-admin']) {
      const text = await (await usa(mediu(sesiune([rol])))).text()
      expect(text, rol).toContain('class="bine"')
      expect(text, rol).toContain('class="urgent"')
    }
  })

  /*
   * ⚠️ ADMINII PE APLICAȚIE (18.09.2026). Chenarele sunt ale Website-ului, deci le vede cine ține
   * Website-ul: un om cu rolul `user` și cheia `website.manage` dată punctual. Iar un administrator
   * al altei aplicații NU le vede — altfel „admin doar pe aplicația respectivă" ar fi o vorbă.
   */
  it('un om numit admin NUMAI la Website le vede, cu rolul `user`', async () => {
    const text = await (await usa(mediu(sesiune(['user']), ['website.manage']))).text()
    expect(text).toContain('class="bine"')
    expect(text).toContain('class="urgent"')
  })

  it('adminul altei aplicații (Programul) nu le vede', async () => {
    const text = await (await usa(mediu(sesiune(['user']), ['program.write', 'program.publish']))).text()
    expect(text).not.toContain('class="bine"')
    expect(text).not.toContain('class="urgent"')
  })

  /*
   * ⚠️ Masca „vezi ca": identitatea întoarce în `roles` MASCA, nu rolurile adevărate, deci
   * super-adminul care se uită „ca utilizator" vede ușa exact ca omul. Proba ține legătura asta:
   * dacă vreodată `eAdmin` s-ar calcula din altceva (rolurile reale, un câmp nou), chenarele ar
   * reapărea sub mască și previzualizarea ar minți.
   */
  it('sub masca „vezi ca utilizator", super-adminul vede ușa omului', async () => {
    const subMasca = { ...sesiune(['user']), veziCa: 'user', poateVedeaCa: true }
    const text = await (await usa(mediu(subMasca))).text()
    expect(text).not.toContain('class="bine"')
    expect(text).not.toContain('class="urgent"')
  })

  /*
   * ⚠️ Ușa anonimă se ține în cache-ul public 300 s. Dacă pagina adminului ar căpăta vreodată
   * același antet, chenarele ar putea fi servite de cache oricui — de aceea proba stă aici, lângă
   * regula pe care o apără, nu în `securitate.test.ts`.
   */
  it('pagina care poartă chenare nu se ține în niciun cache', async () => {
    const alAdminului = await usa(mediu(sesiune(['admin'])))
    expect(alAdminului.headers.get('cache-control')).toBe('private, no-store')
    const alOmului = await usa(mediu(sesiune([], false)), false)
    expect(alOmului.headers.get('cache-control')).toContain('public')
  })
})
