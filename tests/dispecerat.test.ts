import { describe, expect, it } from 'vitest'
import admin from '../apps/admin/src/index.js'

/**
 * DISPECERATUL — ușa lăsată anume deschisă spre internet.
 *
 * Coada de WhatsApp e singurul loc din Administrare la care se ajunge FĂRĂ sesiune: pullerul de pe
 * NAS nu e om și nu poate avea cont. De aceea ușa asta merită păzită cu probe: dacă secretul se
 * pierde pe drum sau cineva o mută după verificarea de sesiune, ori se deschide tuturor, ori se
 * închide pullerului — și în al doilea caz mesajele se adună în tăcere, fără nicio eroare.
 */

const SECRET = 'secret-de-proba'

function mediu(raspunsComunicare = { mesaje: [] as unknown[] }) {
  let primite = 0
  const env = {
    MEDIU: 'staging',
    ORIGINE_PUBLICA: 'https://admin.staging.sfantul-ilie.ro',
    DOMENIU_COOKIE: '.staging.sfantul-ilie.ro',
    EMAIL_SUPERADMIN: 'rubikmm@gmail.com',
    SECRET_INTERN: SECRET,
    COMUNICARE: {
      fetch: async () => {
        primite++
        return new Response(JSON.stringify(raspunsComunicare), { headers: { 'content-type': 'application/json' } })
      },
    },
    // Dacă vreuna dintre ele e chemată, proba pică — semn că ușa a ajuns după verificarea sesiunii.
    IDENTITATE: { fetch: async () => { throw new Error('identitatea nu are ce căuta aici') } },
    AUTORIZARE: { fetch: async () => { throw new Error('autorizarea nu are ce căuta aici') } },
    AUDIT: { fetch: async () => { throw new Error('auditul nu are ce căuta aici') } },
    AUTOMATIZARE: { fetch: async () => { throw new Error('automatizarea nu are ce căuta aici') } },
  }
  return { env, cateAjunsLaComunicare: () => primite }
}

const cerere = (antete: Record<string, string> = {}, metoda = 'POST') =>
  new Request('https://admin.staging.sfantul-ilie.ro/dispecerat/coada', {
    method: metoda,
    headers: { 'content-type': 'application/json', ...antete },
    ...(metoda === 'POST' ? { body: '{}' } : {}),
  })

describe('dispecerat — ușa pullerului de WhatsApp', () => {
  it('fără secret: 404, nu 403 — nu se află că ușa există', async () => {
    const { env, cateAjunsLaComunicare } = mediu()
    const raspuns = await admin.fetch(cerere(), env as never)
    expect(raspuns.status).toBe(404)
    expect(cateAjunsLaComunicare()).toBe(0)
  })

  it('cu secret greșit: tot 404', async () => {
    const { env, cateAjunsLaComunicare } = mediu()
    const raspuns = await admin.fetch(cerere({ 'x-xc-intern': 'altceva' }), env as never)
    expect(raspuns.status).toBe(404)
    expect(cateAjunsLaComunicare()).toBe(0)
  })

  it('cu secretul bun: duce cererea la comunicare și întoarce coada', async () => {
    const { env, cateAjunsLaComunicare } = mediu({ mesaje: [{ id: 'l1', catre: '07xx', text: 'bună' }] })
    const raspuns = await admin.fetch(cerere({ 'x-xc-intern': SECRET }), env as never)
    expect(raspuns.status).toBe(200)
    expect(await raspuns.json()).toEqual({ mesaje: [{ id: 'l1', catre: '07xx', text: 'bună' }] })
    expect(cateAjunsLaComunicare()).toBe(1)
  })

  it('GET nu deschide coada, nici cu secretul bun', async () => {
    const { env, cateAjunsLaComunicare } = mediu()
    const raspuns = await admin.fetch(cerere({ 'x-xc-intern': SECRET }, 'GET'), env as never)
    expect(raspuns.status).toBe(404)
    expect(cateAjunsLaComunicare()).toBe(0)
  })

  // ⚠️ Fără secret pus pe worker, ușa trebuie să rămână ÎNCHISĂ — nu deschisă tuturor. Greșeala
  // firească ar fi „dacă nu e secret, nu verific nimic".
  it('dacă workerul n-are secret, ușa e închisă pentru toți', async () => {
    const { env, cateAjunsLaComunicare } = mediu()
    const raspuns = await admin.fetch(cerere({ 'x-xc-intern': '' }), { ...env, SECRET_INTERN: '' } as never)
    expect(raspuns.status).toBe(404)
    expect(cateAjunsLaComunicare()).toBe(0)
  })
})
