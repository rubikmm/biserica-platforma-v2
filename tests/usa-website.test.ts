import { describe, expect, it } from 'vitest'
import home, { corp } from '../apps/home/src/index.js'
import { navigatieDin } from '../packages/config/src/index.js'
import { PERMISIUNI_IMPLICITE, SCOPE_GLOBAL } from '../packages/contracts/src/index.js'

/**
 * UȘA WEBSITE-ULUI — butoanele aplicațiilor arată TOATE LA FEL, pentru toată lumea.
 *
 * ⚠️ Regula de azi (user, 18.09.2026: „scoate bordurile și pentru admini — nu mai sunt relevante").
 * Semnele de stare — chenar verde `bine`, chenar roșu `urgent` — au trăit o zi (cerute pe 17.09,
 * restrânse seara la admin) și au fost scoase cu totul. Ușa se întoarce la regula veche, a userului
 * din 10.09.2026: butoanele se deosebesc numai prin nume.
 *
 * De ce merită probe: întoarcerea ar fi tăcută. Chenarele nu strică nimic și nu dau nicio eroare —
 * doar că enoriașul citește pe ușa parohiei un chenar roșu la „Curățenia bisericii" și înțelege că
 * aplicația e stricată. Probele astea păzesc și faptul că ușa e ACEEAȘI pentru oricine intră:
 * aceleași butoane, în aceeași ordine, cu aceleași adrese, cu cont sau fără.
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
 * AUTORIZAREA, ca la adevărat: răspunde din rolurile EFECTIVE ale sesiunii (deci și masca) plus
 * granturile punctuale. Un `{}` întors de-a valma ar însemna „refuz" la orice și ar face probele să
 * treacă ori să cadă pe o cauză greșită.
 *
 * ⚠️ Ușa nu mai întreabă ea însăși autorizarea de nimic (chenarele, singurul lucru care atârna de
 * cheia `website.manage`, s-au scos pe 18.09.2026) — dar pagina trece prin `@xc/setari`, care o
 * poate întreba. Și tocmai de-aia probele cu `website.manage` rămân: ele arată că nici cheia de
 * administrator al Website-ului nu mai schimbă ușa.
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

/** Butoanele aplicațiilor din pagina întreagă: numele și adresa fiecăruia, în ordine. */
function butoaneleUsii(pagina: string): string[] {
  const nav = pagina.match(/<nav class="apps"[\s\S]*?<\/nav>/)
  expect(nav, 'lipsește <nav class="apps"> din pagină').toBeTruthy()
  return [...(nav?.[0] ?? '').matchAll(/<a href="([^"]*)"[^>]*><b>([^<]+)<\/b>/g)]
    .map((m) => `${m[2]} → ${m[1]}`)
}

/** Clasele de stare de odinioară — niciuna nu mai are voie să apară nicăieri. */
function claseDeStare(pagina: string): string[] {
  return [...pagina.matchAll(/class="(bine|urgent)"/g)].map((m) => m[0])
}

describe('ușa Website-ului — butoanele arată la fel pentru toată lumea', () => {
  it('`corp` nu pune nicio clasă pe butoane', () => {
    const html = corp(NAV)
    expect(claseDeStare(html)).toEqual([])
    // niciun `<a ... class=...>` în lista de aplicații, oricum s-ar chema clasa
    expect(html).not.toMatch(/<a href="[^"]*"\s+class=/)
    // …dar butoanele sunt toate acolo
    expect(html).toContain('Curățenia bisericii')
    expect(html).toContain('Calendarul')
    expect(butoaneleUsii(html)).toHaveLength(12)
  })

  it('enoriașul neautentificat primește ușa fără chenare', async () => {
    const raspuns = await usa(mediu(sesiune([], false)), false)
    const text = await raspuns.text()
    expect(raspuns.status).toBe(200)
    expect(claseDeStare(text)).toEqual([])
  })

  it('utilizatorul cu cont nu vede chenare', async () => {
    const text = await (await usa(mediu(sesiune(['user'])))).text()
    expect(claseDeStare(text)).toEqual([])
  })

  it('nici adminul, nici super-adminul nu mai văd chenare', async () => {
    for (const rol of ['admin', 'super-admin']) {
      const text = await (await usa(mediu(sesiune([rol])))).text()
      expect(claseDeStare(text), rol).toEqual([])
    }
  })

  /*
   * ⚠️ ADMINII PE APLICAȚIE. Cheia Website-ului (`website.manage`) era singurul lucru de care
   * atârnau chenarele; proba rămâne ca să arate că nici ea nu mai schimbă nimic pe ușă.
   */
  it('nici omul numit admin NUMAI la Website nu vede chenare', async () => {
    const text = await (await usa(mediu(sesiune(['user']), ['website.manage']))).text()
    expect(claseDeStare(text)).toEqual([])
  })

  it('sub masca „vezi ca utilizator", ușa e tot cea a omului', async () => {
    const subMasca = { ...sesiune(['user']), veziCa: 'user', poateVedeaCa: true }
    const text = await (await usa(mediu(subMasca))).text()
    expect(claseDeStare(text)).toEqual([])
  })

  /*
   * ⚠️ MIEZUL REGULII: ușa nu se schimbă după cine intră. Aceleași butoane, în aceeași ordine, cu
   * aceleași adrese — la anonim, la om cu cont și la adminul Website-ului.
   */
  it('aceleași butoane, în aceeași ordine, cu aceleași adrese, la toți', async () => {
    const alOmului = butoaneleUsii(await (await usa(mediu(sesiune([], false)), false)).text())
    expect(alOmului.length).toBeGreaterThan(0)
    for (const [cine, env] of [
      ['cu cont', mediu(sesiune(['user']))],
      ['admin platformă', mediu(sesiune(['admin']))],
      ['admin Website', mediu(sesiune(['user']), ['website.manage'])],
    ] as const) {
      expect(butoaneleUsii(await (await usa(env)).text()), cine).toEqual(alOmului)
    }
  })

  /*
   * ⚠️ Ușa anonimă se ține în cache-ul public 300 s, iar cea a omului intrat deloc: pagina poartă
   * numele lui în antet (user, 11.09.2026). Proba stă aici fiindcă apără cealaltă jumătate a
   * regulii — ce e al unuia să nu ajungă prin cache la altul.
   */
  it('pagina omului intrat nu se ține în niciun cache, cea anonimă da', async () => {
    const alAdminului = await usa(mediu(sesiune(['admin'])))
    expect(alAdminului.headers.get('cache-control')).toBe('private, no-store')
    const alOmului = await usa(mediu(sesiune([], false)), false)
    expect(alOmului.headers.get('cache-control')).toContain('public')
  })
})
