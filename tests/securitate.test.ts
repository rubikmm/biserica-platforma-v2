import { describe, expect, it } from 'vitest'
import { hashJeton, jetonNou, aExpirat, peste, DURATA_LINK_SEC, DURATA_SESIUNE_SEC } from '../services/identity-worker/src/jetoane.js'
import {
  construiesteCookie,
  cookieSters,
  citesteCookie,
  egaleInTimpConstant,
  verificaCsrf,
} from '../packages/auth/src/index.js'
import { scrisoareaDeIntrare } from '../services/identity-worker/src/email.js'

describe('jetoane', () => {
  it('generează jetoane unice', () => {
    const set = new Set(Array.from({ length: 200 }, () => jetonNou()))
    expect(set.size).toBe(200)
  })

  it('hash-ul e stabil și diferit de jetonul în clar', async () => {
    const jeton = jetonNou()
    const h1 = await hashJeton(jeton)
    const h2 = await hashJeton(jeton)
    expect(h1).toBe(h2)
    expect(h1).not.toBe(jeton)
    expect(h1).toHaveLength(64)
  })

  it('recunoaște expirarea', () => {
    expect(aExpirat(peste(60))).toBe(false)
    expect(aExpirat(peste(-1))).toBe(true)
  })

  it('linkul e scurt, sesiunea e lungă (fără parolă, linkul e singurul gest de intrare)', () => {
    expect(DURATA_LINK_SEC).toBe(15 * 60)
    expect(DURATA_SESIUNE_SEC).toBeGreaterThanOrEqual(7 * 24 * 60 * 60)
  })
})

describe('scrisoarea de intrare', () => {
  it('conține linkul, atât în text cât și în HTML, și nu îl deformează', () => {
    const link = 'https://rubik:8474/auth/confirma?jeton=abc_DEF-123'
    const s = scrisoareaDeIntrare(link, false)
    expect(s.text).toContain(link)
    expect(s.html).toContain(`href="${link}"`)
  })

  it('spune altceva la cont nou față de intrare', () => {
    expect(scrisoareaDeIntrare('https://x/y', true).text).toContain('Bine ai venit')
    expect(scrisoareaDeIntrare('https://x/y', false).text).not.toContain('Bine ai venit')
  })
})

describe('cookie-uri', () => {
  it('pune mereu HttpOnly, Secure și SameSite', () => {
    const c = construiesteCookie('xc_sesiune', 'valoare', { maxAge: 100, domeniu: '' })
    expect(c).toContain('HttpOnly')
    expect(c).toContain('Secure')
    expect(c).toContain('SameSite=Lax')
  })

  it('omite Domain pentru gazde fără punct (cazul `rubik`)', () => {
    const c = construiesteCookie('xc_sesiune', 'v', { maxAge: 100, domeniu: 'rubik' })
    expect(c).not.toContain('Domain=')
  })

  it('pune Domain pentru domeniul de staging', () => {
    const c = construiesteCookie('xc_sesiune', 'v', { maxAge: 100, domeniu: '.staging.sfantul-ilie.ro' })
    expect(c).toContain('Domain=.staging.sfantul-ilie.ro')
  })

  it('ștergerea expiră imediat', () => {
    expect(cookieSters('xc_sesiune', '')).toContain('Max-Age=0')
  })

  it('citește valoarea corectă dintre mai multe cookie-uri', () => {
    const req = new Request('https://exemplu.ro', {
      headers: { cookie: 'a=1; xc_sesiune=abc%3Ddef; b=2' },
    })
    expect(citesteCookie(req, 'xc_sesiune')).toBe('abc=def')
    expect(citesteCookie(req, 'inexistent')).toBeNull()
  })
})

describe('CSRF', () => {
  const permise = ['https://rubik:8474']

  it('lasă GET-urile să treacă', () => {
    expect(verificaCsrf(new Request('https://rubik:8474/', { method: 'GET' }), permise)).toBeNull()
  })

  it('respinge POST fără Origin', () => {
    expect(verificaCsrf(new Request('https://rubik:8474/', { method: 'POST' }), permise)).toBe(
      'lipseste antetul Origin',
    )
  })

  it('respinge POST dintr-o origine străină', () => {
    const req = new Request('https://rubik:8474/', { method: 'POST', headers: { origin: 'https://atacator.ro' } })
    expect(verificaCsrf(req, permise)).toBe('origine neacceptata')
  })

  it('acceptă POST din originea proprie', () => {
    const req = new Request('https://rubik:8474/', { method: 'POST', headers: { origin: 'https://rubik:8474' } })
    expect(verificaCsrf(req, permise)).toBeNull()
  })

  it('compararea în timp constant nu se lasă păcălită de lungimi', () => {
    expect(egaleInTimpConstant('abc', 'abc')).toBe(true)
    expect(egaleInTimpConstant('abc', 'abd')).toBe(false)
    expect(egaleInTimpConstant('abc', 'abcd')).toBe(false)
  })
})
