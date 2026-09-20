import { describe, expect, it } from 'vitest'
import cont from '../apps/account/src/index.js'

/**
 * RUBRICA „APLICAȚIILE PE CARE LE ADMINISTREZI", din Profil (user, 19.09.2026: „este bine să
 * afișăm doar legături către aplicații din profil-admin — nu importăm toate setările aici").
 *
 * Ce păzesc probele, fiindcă se pot strica tăcut:
 *   - super-adminul vede O SINGURĂ legătură, spre Administrare — nu lista celor unsprezece;
 *   - adminul unei aplicații vede exact aplicația lui, cu legătura spre Setările EI, și nimic
 *     din Administrare (acolo n-are ce face);
 *   - omul fără nicio cheie nu vede rubrica deloc: o ușă pe care n-o poate deschide nu se arată.
 */

const OM = {
  id: 'u1',
  email: 'om@example.com',
  displayName: 'Omul',
  firstName: null,
  lastName: null,
  phone: null,
  shortName: null,
  emailVerifiedAt: null,
  disabledAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

/** Identitatea + autorizarea de probă. `chei` = ce are omul la autorizare, `roluri` = ce e pe sesiune. */
function mediu(o: { roluri: { role: string; scope: string }[]; chei?: string[] }) {
  const cerute: string[] = []
  return {
    cerute,
    env: {
      MEDIU: 'staging',
      ORIGINE_PUBLICA: 'https://cont.staging.sfantul-ilie.ro',
      DOMENIU_COOKIE: '.staging.sfantul-ilie.ro',
      EMAIL_SUPERADMIN: 'rubikmm@gmail.com',
      URL_CURATENIE: 'https://curatenie.staging.sfantul-ilie.ro',
      URL_PROGRAM: 'https://program.staging.sfantul-ilie.ro',
      URL_ADMIN: 'https://admin.staging.sfantul-ilie.ro',
      IDENTITATE: {
        fetch: async (adresa: string) => {
          const cale = new URL(adresa).pathname
          if (cale === '/sesiune') {
            return new Response(
              JSON.stringify({
                authenticated: true,
                user: OM,
                roles: o.roluri,
                sessionId: 's1',
                expiresAt: null,
                veziCa: null,
                poateVedeaCa: false,
              }),
              { headers: { 'content-type': 'application/json' } },
            )
          }
          return new Response(JSON.stringify({ asocieri: [] }), {
            headers: { 'content-type': 'application/json' },
          })
        },
      },
      AUTORIZARE: {
        fetch: async (adresa: string, init?: RequestInit) => {
          const cheie = (JSON.parse(String(init?.body ?? '{}')) as { permission?: string }).permission ?? ''
          cerute.push(cheie)
          return new Response(
            JSON.stringify({ allowed: (o.chei ?? []).includes(cheie), reason: 'probă', matchedScopes: [] }),
            { headers: { 'content-type': 'application/json' } },
          )
        },
      },
    },
  }
}

const profilul = (env: unknown) =>
  cont.fetch(
    new Request('https://cont.staging.sfantul-ilie.ro/', { headers: { cookie: 'xc_sesiune=jeton-de-proba' } }),
    env as never,
  )

const TITLU = 'Aplicațiile pe care le administrezi'

describe('rubrica aplicațiilor administrate, din Profil', () => {
  it('super-adminul are o singură legătură, spre Administrare, și nicio listă de aplicații', async () => {
    const m = mediu({ roluri: [{ role: 'super-admin', scope: 'global' }] })
    const text = await (await profilul(m.env)).text()
    expect(text).toContain(TITLU)
    expect(text).toContain('Ești super-administrator')
    expect(text).toContain('href="https://admin.staging.sfantul-ilie.ro/">Administrare</a>')
    // nicio aplicație pe listă și nicio legătură spre Setări
    expect(text).not.toContain('/setari')
    expect(text).not.toContain('Curățenia bisericii</a>')
    // ⚠️ nici nu se întreabă autorizarea: cheile îi vin din rol, cele unsprezece drumuri ar fi degeaba
    expect(m.cerute).toHaveLength(0)
  })

  it('adminul Curățeniei vede un singur rând, spre Setările ei, fără Administrare', async () => {
    const m = mediu({ roluri: [{ role: 'user', scope: 'global' }], chei: ['cleaning.manage'] })
    const text = await (await profilul(m.env)).text()
    expect(text).toContain(TITLU)
    expect(text).toContain('href="https://curatenie.staging.sfantul-ilie.ro/setari">Curățenia bisericii</a>')
    expect(text).not.toContain('Ești super-administrator')
    expect(text).not.toContain('https://program.staging.sfantul-ilie.ro/setari')
    // un singur rând: cheia lui deschide o singură aplicație
    expect(text.split('/setari"').length - 1).toBe(1)
    // cele unsprezece întrebări pleacă toate (deodată), nu doar prima
    expect(m.cerute).toContain('cleaning.manage')
    expect(m.cerute).toContain('program.write')
    expect(m.cerute.length).toBeGreaterThanOrEqual(11)
  })

  it('omul fără nicio cheie nu vede rubrica deloc', async () => {
    const m = mediu({ roluri: [{ role: 'user', scope: 'global' }] })
    const text = await (await profilul(m.env)).text()
    expect(text).not.toContain(TITLU)
    expect(text).not.toContain('/setari')
    // pagina e întreagă în rest
    expect(text).toContain('Aplicațiile mele')
    expect(text).toContain('Siguranță')
  })
})
