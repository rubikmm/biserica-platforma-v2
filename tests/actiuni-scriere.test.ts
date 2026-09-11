import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ANTET_ACTOR, ANTET_PREVIZUALIZARE, ANTET_SECRET, actiune, modulActiuni, registru, type Actor } from '../packages/actiuni/src/index.js'
import { dataCeruta } from '../packages/ui/src/index.js'

/**
 * Partea EXECUTIVĂ a acțiunilor: previzualizarea (ce ar urma, fără să se facă) și cuvintele
 * omului pentru zile. Ce n-am voie să aflu greșit mai târziu: că o previzualizare a executat ceva,
 * sau că „luni" a ajuns la o altă zi decât lunea care vine.
 */

const SECRET = 'secret-de-proba'
const OMUL: Actor = { fel: 'utilizator', principal: { userId: 'u1' } }
const ctxExec = { waitUntil: () => undefined, passThroughOnException: () => undefined } as unknown as ExecutionContext

let executari = 0
const ACTIUNI = registru<any>([
  actiune({
    nume: 'proba.muta',
    descriere: 'Muta o slujba la alta ora.',
    efect: 'scrie',
    intrare: z.object({ ora: z.string().regex(/^\d{2}:\d{2}$/) }),
    iesire: z.object({ ora: z.string() }),
    async rezuma({ ora }) {
      if (ora === '25:00') throw new Error('nu există ora 25')
      return `Mut slujba la ${ora}.`
    },
    async executa({ ora }) {
      executari += 1
      return { ora }
    },
  }),
])
const MODUL = modulActiuni<any>({ aplicatie: 'proba', versiune: '1.0.0', actiuni: ACTIUNI })

function cerere(corp: unknown, previzualizare: boolean) {
  return new Request('https://proba.intern/_actiuni/proba.muta', {
    method: 'POST',
    headers: {
      [ANTET_SECRET]: SECRET,
      [ANTET_ACTOR]: JSON.stringify(OMUL),
      ...(previzualizare ? { [ANTET_PREVIZUALIZARE]: '1' } : {}),
    },
    body: JSON.stringify(corp),
  })
}

describe('previzualizarea', () => {
  it('spune ce ar urma și NU execută nimic', async () => {
    const inainte = executari
    const r = await MODUL.ruteaza(cerere({ ora: '07:00' }, true), { SECRET_INTERN: SECRET, MEDIU: 'dev' }, ctxExec, '/_actiuni/proba.muta')
    expect(r?.status).toBe(200)
    expect(await r!.json()).toEqual({ ok: true, date: { previzualizare: true, rezumat: 'Mut slujba la 07:00.' } })
    expect(executari).toBe(inainte)
  })

  it('o cerere fără sens cade la previzualizare, cu motivul ei', async () => {
    const r = await MODUL.ruteaza(cerere({ ora: '25:00' }, true), { SECRET_INTERN: SECRET, MEDIU: 'dev' }, ctxExec, '/_actiuni/proba.muta')
    expect(r?.status).toBe(400)
    const j = (await r!.json()) as { cod: string; mesaj: string }
    expect(j.cod).toBe('argumente_invalide')
    expect(j.mesaj).toBe('nu există ora 25')
  })

  it('argumentele greșite cad ÎNAINTE de rezumat', async () => {
    const r = await MODUL.ruteaza(cerere({ ora: 'sapte' }, true), { SECRET_INTERN: SECRET, MEDIU: 'dev' }, ctxExec, '/_actiuni/proba.muta')
    expect(r?.status).toBe(400)
  })

  it('fără antet, aceeași cerere chiar execută', async () => {
    const inainte = executari
    const r = await MODUL.ruteaza(cerere({ ora: '07:00' }, false), { SECRET_INTERN: SECRET, MEDIU: 'dev' }, ctxExec, '/_actiuni/proba.muta')
    expect(await r!.json()).toEqual({ ok: true, date: { ora: '07:00' } })
    expect(executari).toBe(inainte + 1)
  })
})

describe('zilele, cum le spune omul', () => {
  // 2026-09-11 e vineri
  const azi = '2026-09-11'
  it('„luni" spusă vineri e lunea care vine', () => expect(dataCeruta('luni', azi)).toBe('2026-09-14'))
  it('„vineri" spusă vineri e chiar azi', () => expect(dataCeruta('vineri', azi)).toBe('2026-09-11'))
  it('„joi" spusă vineri e joia viitoare, nu cea trecută', () => expect(dataCeruta('joi', azi)).toBe('2026-09-17'))
  it('merge și cu diacritice și majuscule', () => expect(dataCeruta('Marți', azi)).toBe('2026-09-15'))
  it('„duminică" spusă vineri e poimâine', () => expect(dataCeruta('duminică', azi)).toBe('2026-09-13'))
  it('cuvintele vechi rămân', () => {
    expect(dataCeruta('azi', azi)).toBe(azi)
    expect(dataCeruta('maine', azi)).toBe('2026-09-12')
    expect(dataCeruta('viitoare', azi)).toBe('2026-09-18')
    expect(dataCeruta('2026-12-25', azi)).toBe('2026-12-25')
    expect(dataCeruta('cândva', azi)).toBeNull()
  })
})
