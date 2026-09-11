import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  ANTET_ACTOR,
  ANTET_SECRET,
  actiune,
  manifest,
  modulActiuni,
  registru,
  unelteDinManifest,
  type Actor,
} from '../packages/actiuni/src/index.js'

/**
 * Ce se probeaza aici e GARDA si CONTRACTUL, nu ce fac aplicatiile cu ele. Doua lucruri n-am voie
 * sa le aflu gresite mai tarziu: (1) ca `/_actiuni` raspunde cuiva care n-are secretul platformei,
 * (2) ca o actiune cu permisiune se executa fara sa fi intrebat autorizarea centrala.
 */

const SECRET = 'secret-de-proba'

const ACTIUNI = registru<any>([
  actiune({
    nume: 'proba.aduna',
    descriere: 'Aduna doua numere.',
    efect: 'citeste',
    intrare: z.object({ a: z.number(), b: z.number() }),
    iesire: z.object({ suma: z.number() }),
    exemple: ['cat fac doi si cu doi?'],
    async executa({ a, b }) {
      return { suma: a + b }
    },
  }),
  actiune({
    nume: 'proba.scrie',
    descriere: 'Scrie ceva — cere drept.',
    efect: 'scrie',
    permisiune: 'program.write',
    intrare: z.object({ text: z.string() }),
    iesire: z.object({ scris: z.string() }),
    async executa({ text }) {
      return { scris: text }
    },
  }),
])

const MODUL = modulActiuni<any>({ aplicatie: 'proba', versiune: '1.0.0', actiuni: ACTIUNI })

const ctxExec = { waitUntil: () => undefined, passThroughOnException: () => undefined } as unknown as ExecutionContext

const OMUL: Actor = { fel: 'utilizator', principal: { userId: 'u1', email: 'om@exemplu.ro' } }

function cerere(cale: string, o: { secret?: string; actor?: Actor; corp?: unknown; metoda?: string } = {}) {
  const antete: Record<string, string> = {}
  if (o.secret) antete[ANTET_SECRET] = o.secret
  if (o.actor) antete[ANTET_ACTOR] = JSON.stringify(o.actor)
  return new Request(`https://proba.intern${cale}`, {
    method: o.metoda ?? (o.corp !== undefined ? 'POST' : 'GET'),
    headers: antete,
    ...(o.corp !== undefined ? { body: JSON.stringify(o.corp) } : {}),
  })
}

/** Autorizarea, jucata: raspunde ce i se cere si tine minte daca a fost intrebata. */
function autorizare(permite: boolean) {
  const intrebari: unknown[] = []
  return {
    intrebari,
    fetch: async (_u: string, init?: RequestInit) => {
      intrebari.push(JSON.parse(String(init?.body ?? '{}')))
      return new Response(
        JSON.stringify({ allowed: permite, reason: permite ? 'are rolul' : 'nu are dreptul', matchedScopes: [] }),
        { headers: { 'content-type': 'application/json' } },
      )
    },
  } as unknown as Fetcher & { intrebari: unknown[] }
}

describe('garda: /_actiuni nu exista de pe internet', () => {
  it('fara secret raspunde 404, nu 403 — nu confirmam ca ar fi ceva acolo', async () => {
    const r = await MODUL.ruteaza(cerere('/_actiuni'), { SECRET_INTERN: SECRET }, ctxExec, '/_actiuni')
    expect(r?.status).toBe(404)
  })

  it('cu secret gresit, la fel', async () => {
    const r = await MODUL.ruteaza(cerere('/_actiuni', { secret: 'altceva' }), { SECRET_INTERN: SECRET }, ctxExec, '/_actiuni')
    expect(r?.status).toBe(404)
  })

  it('fara SECRET_INTERN in mediu, modulul e inchis cu totul', async () => {
    const r = await MODUL.ruteaza(cerere('/_actiuni', { secret: SECRET }), {}, ctxExec, '/_actiuni')
    expect(r?.status).toBe(404)
  })

  it('o cale care nu e a modulului il lasa pe aplicatie sa-si vada de treaba', async () => {
    const r = await MODUL.ruteaza(cerere('/v1/azi', { secret: SECRET }), { SECRET_INTERN: SECRET }, ctxExec, '/v1/azi')
    expect(r).toBeNull()
  })
})

describe('manifestul', () => {
  it('se naste din scheme, cu forma argumentelor', async () => {
    const r = await MODUL.ruteaza(cerere('/_actiuni', { secret: SECRET }), { SECRET_INTERN: SECRET }, ctxExec, '/_actiuni')
    const m = (await r!.json()) as ReturnType<typeof manifest>
    expect(m.aplicatie).toBe('proba')
    expect(m.actiuni.map((a) => a.nume)).toEqual(['proba.aduna', 'proba.scrie'])
    const aduna = m.actiuni[0]!
    expect(aduna.intrare).toMatchObject({ type: 'object' })
    expect((aduna.intrare as { properties: Record<string, unknown> }).properties).toHaveProperty('a')
    expect(aduna.permisiune).toBeNull()
    expect(m.actiuni[1]!.permisiune).toBe('program.write')
  })

  it('uneltele pentru model spun cand o actiune schimba date', () => {
    const unelte = unelteDinManifest(manifest('proba', '1.0.0', ACTIUNI))
    expect(unelte[1]!.description).toContain('SCHIMBĂ date')
    expect(unelte[0]!.description).toContain('Exemple: cat fac doi si cu doi?')
  })

  it('doua actiuni cu acelasi nume sunt oprite din scris', () => {
    expect(() =>
      registru([
        actiune({ nume: 'x.y', descriere: 'a', efect: 'citeste', intrare: z.object({}), iesire: z.object({}), executa: async () => ({}) }),
        actiune({ nume: 'x.y', descriere: 'b', efect: 'citeste', intrare: z.object({}), iesire: z.object({}), executa: async () => ({}) }),
      ]),
    ).toThrow(/dublata/)
  })
})

describe('executia', () => {
  const env = { SECRET_INTERN: SECRET, MEDIU: 'dev' }

  it('merge si intoarce ce spune schema', async () => {
    const r = await MODUL.ruteaza(
      cerere('/_actiuni/proba.aduna', { secret: SECRET, actor: OMUL, corp: { a: 2, b: 3 } }),
      env,
      ctxExec,
      '/_actiuni/proba.aduna',
    )
    expect(r?.status).toBe(200)
    expect(await r!.json()).toEqual({ ok: true, date: { suma: 5 } })
  })

  it('argumentele gresite cad cu 400 si spun unde', async () => {
    const r = await MODUL.ruteaza(
      cerere('/_actiuni/proba.aduna', { secret: SECRET, actor: OMUL, corp: { a: 'doi', b: 3 } }),
      env,
      ctxExec,
      '/_actiuni/proba.aduna',
    )
    expect(r?.status).toBe(400)
    const j = (await r!.json()) as { cod: string; mesaj: string }
    expect(j.cod).toBe('argumente_invalide')
    expect(j.mesaj).toContain('a:')
  })

  it('actiunea necunoscuta e 404', async () => {
    const r = await MODUL.ruteaza(
      cerere('/_actiuni/proba.nimic', { secret: SECRET, actor: OMUL, corp: {} }),
      env,
      ctxExec,
      '/_actiuni/proba.nimic',
    )
    expect(r?.status).toBe(404)
  })

  it('fara cine cere, nu se executa nimic', async () => {
    const r = await MODUL.ruteaza(
      cerere('/_actiuni/proba.aduna', { secret: SECRET, corp: { a: 1, b: 1 } }),
      env,
      ctxExec,
      '/_actiuni/proba.aduna',
    )
    expect(r?.status).toBe(400)
  })
})

describe('drepturile: aceleasi porti ca pentru un om', () => {
  it('o actiune cu permisiune intreaba autorizarea centrala si se supune refuzului', async () => {
    const authz = autorizare(false)
    const r = await MODUL.ruteaza(
      cerere('/_actiuni/proba.scrie', { secret: SECRET, actor: OMUL, corp: { text: 'ceva' } }),
      { SECRET_INTERN: SECRET, AUTORIZARE: authz },
      ctxExec,
      '/_actiuni/proba.scrie',
    )
    expect(r?.status).toBe(403)
    expect((await r!.json() as { cod: string }).cod).toBe('fara_drept')
    expect(authz.intrebari).toHaveLength(1)
    expect(authz.intrebari[0]).toMatchObject({ permission: 'program.write', principal: { userId: 'u1' } })
  })

  it('cu drept, trece', async () => {
    const authz = autorizare(true)
    const r = await MODUL.ruteaza(
      cerere('/_actiuni/proba.scrie', { secret: SECRET, actor: OMUL, corp: { text: 'ceva' } }),
      { SECRET_INTERN: SECRET, AUTORIZARE: authz },
      ctxExec,
      '/_actiuni/proba.scrie',
    )
    expect(r?.status).toBe(200)
    expect(await r!.json()).toEqual({ ok: true, date: { scris: 'ceva' } })
  })

  it('masca „vezi ca" ajunge la autorizare — altfel previzualizarea ar minti', async () => {
    const authz = autorizare(true)
    await MODUL.ruteaza(
      cerere('/_actiuni/proba.scrie', {
        secret: SECRET,
        actor: { fel: 'utilizator', principal: { userId: 'u1', veziCa: 'user' } },
        corp: { text: 'ceva' },
      }),
      { SECRET_INTERN: SECRET, AUTORIZARE: authz },
      ctxExec,
      '/_actiuni/proba.scrie',
    )
    expect(authz.intrebari[0]).toMatchObject({ principal: { veziCa: 'user' } })
  })

  it('un serviciu nu poate cere o actiune care tine de dreptul unei persoane', async () => {
    const authz = autorizare(true)
    const r = await MODUL.ruteaza(
      cerere('/_actiuni/proba.scrie', {
        secret: SECRET,
        actor: { fel: 'serviciu', nume: 'automatizare' },
        corp: { text: 'ceva' },
      }),
      { SECRET_INTERN: SECRET, AUTORIZARE: authz },
      ctxExec,
      '/_actiuni/proba.scrie',
    )
    expect(r?.status).toBe(403)
    expect((await r!.json() as { cod: string }).cod).toBe('nepermis_serviciilor')
    expect(authz.intrebari).toHaveLength(0)
  })

  it('serviciul de politici cazut inseamna REFUZ, nu trecere', async () => {
    const cazut = { fetch: async () => new Response('nu merg', { status: 500 }) } as unknown as Fetcher
    const r = await MODUL.ruteaza(
      cerere('/_actiuni/proba.scrie', { secret: SECRET, actor: OMUL, corp: { text: 'ceva' } }),
      { SECRET_INTERN: SECRET, AUTORIZARE: cazut },
      ctxExec,
      '/_actiuni/proba.scrie',
    )
    expect(r?.status).toBe(403)
  })
})
