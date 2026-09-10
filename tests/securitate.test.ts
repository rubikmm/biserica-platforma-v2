import { describe, expect, it } from 'vitest'
import {
  hashParola,
  verificaParola,
} from '../services/identity-worker/src/parole.js'
import { hashJeton, jetonNou, aExpirat, peste } from '../services/identity-worker/src/jetoane.js'
import {
  construiesteCookie,
  cookieSters,
  citesteCookie,
  egaleInTimpConstant,
  verificaCsrf,
} from '../packages/auth/src/index.js'

describe('parole', () => {
  it('acceptă parola corectă și o respinge pe cea greșită', async () => {
    const hash = await hashParola('parolaMeaFoarteLunga123')
    expect(await verificaParola('parolaMeaFoarteLunga123', hash)).toBe(true)
    expect(await verificaParola('parolaMeaFoarteLunga124', hash)).toBe(false)
  })

  it('produce hash-uri diferite pentru aceeași parolă (sare per utilizator)', async () => {
    const a = await hashParola('aceeasiParolaLunga12')
    const b = await hashParola('aceeasiParolaLunga12')
    expect(a).not.toBe(b)
    expect(await verificaParola('aceeasiParolaLunga12', a)).toBe(true)
    expect(await verificaParola('aceeasiParolaLunga12', b)).toBe(true)
  })

  it('scrie parametrii în hash, ca iterațiile să poată crește ulterior', async () => {
    const hash = await hashParola('oarecareParolaLunga1')
    expect(hash.startsWith('pbkdf2$210000$')).toBe(true)
  })

  it('respinge un hash stricat fără să arunce', async () => {
    expect(await verificaParola('orice', 'gunoi')).toBe(false)
    expect(await verificaParola('orice', 'pbkdf2$1$x$y')).toBe(false)
    expect(await verificaParola('orice', '')).toBe(false)
  })
})

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
    const c = construiesteCookie('xc_sesiune', 'v', {
      maxAge: 100,
      domeniu: '.staging.sfantul-ilie.ro',
    })
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
    const req = new Request('https://rubik:8474/', { method: 'GET' })
    expect(verificaCsrf(req, permise)).toBeNull()
  })

  it('respinge POST fără Origin', () => {
    const req = new Request('https://rubik:8474/', { method: 'POST' })
    expect(verificaCsrf(req, permise)).toBe('lipseste antetul Origin')
  })

  it('respinge POST dintr-o origine străină', () => {
    const req = new Request('https://rubik:8474/', {
      method: 'POST',
      headers: { origin: 'https://atacator.ro' },
    })
    expect(verificaCsrf(req, permise)).toBe('origine neacceptata')
  })

  it('acceptă POST din originea proprie', () => {
    const req = new Request('https://rubik:8474/', {
      method: 'POST',
      headers: { origin: 'https://rubik:8474' },
    })
    expect(verificaCsrf(req, permise)).toBeNull()
  })

  it('compararea în timp constant nu se lasă păcălită de lungimi', () => {
    expect(egaleInTimpConstant('abc', 'abc')).toBe(true)
    expect(egaleInTimpConstant('abc', 'abd')).toBe(false)
    expect(egaleInTimpConstant('abc', 'abcd')).toBe(false)
  })
})
