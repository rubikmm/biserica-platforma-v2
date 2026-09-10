import { describe, expect, it } from 'vitest'
import {
  hashJeton,
  hashCod,
  jetonNou,
  codDeSaseCifre,
  aExpirat,
  peste,
  DURATA_COD_SEC,
  DURATA_SESIUNE_SEC,
  INCERCARI_COD,
} from '../services/identity-worker/src/jetoane.js'
import {
  construiesteCookie,
  cookieSters,
  citesteCookie,
  egaleInTimpConstant,
  principalDin,
  verificaCsrf,
} from '../packages/auth/src/index.js'
import { codFrumos, scrisoareaCodului } from '../services/identity-worker/src/email.js'
import { SESIUNE_ANONIMA, type SesiuneCurenta } from '../packages/contracts/src/index.js'

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

  it('codul e scurt, sesiunea e lungă (fără parolă, codul e singurul gest de intrare)', () => {
    expect(DURATA_COD_SEC).toBe(10 * 60)
    expect(DURATA_SESIUNE_SEC).toBeGreaterThanOrEqual(7 * 24 * 60 * 60)
  })
})

describe('codul de intrare', () => {
  it('are șase cifre, mereu', () => {
    for (let i = 0; i < 500; i++) expect(codDeSaseCifre()).toMatch(/^\d{6}$/)
  })

  it('folosește toate cele zece cifre (fără înclinare din modulo)', () => {
    const vazute = new Set<string>()
    for (let i = 0; i < 500; i++) for (const c of codDeSaseCifre()) vazute.add(c)
    expect(vazute.size).toBe(10)
  })

  it('nu se repetă în serie', () => {
    const set = new Set(Array.from({ length: 200 }, () => codDeSaseCifre()))
    expect(set.size).toBeGreaterThan(190)
  })

  it('amprenta leagă codul de adresă: același cod, alt email, alt hash', async () => {
    const a = await hashCod('ana@exemplu.ro', '123456')
    const b = await hashCod('bogdan@exemplu.ro', '123456')
    expect(a).not.toBe(b)
    expect(a).toBe(await hashCod('ana@exemplu.ro', '123456'))
    expect(a).not.toContain('123456')
  })

  it('lasă cinci greșeli, ca în V1', () => {
    expect(INCERCARI_COD).toBe(5)
  })
})

describe('scrisoarea cu codul', () => {
  it('taie codul 3-3, la fel ca cele șase căsuțe din pagină', () => {
    expect(codFrumos('123456')).toBe('123 456')
  })

  it('poartă codul în subiect, în text și în HTML — și niciun link de intrare', () => {
    const s = scrisoareaCodului('ana@exemplu.ro', '123456', false)
    expect(s.subiect).toContain('123 456')
    expect(s.text).toContain('123 456')
    expect(s.html).toContain('123 456')
    expect(s.text).not.toMatch(/https?:\/\//)
    expect(s.html).not.toContain('<a href')
  })

  it('spune altceva la cont nou față de intrare', () => {
    expect(scrisoareaCodului('a@b.ro', '111222', true).text).toContain('cont nou')
    expect(scrisoareaCodului('a@b.ro', '111222', false).text).not.toContain('cont nou')
  })

  it('scapă adresa în HTML (nu se scrie ce vine de la om nemestecat)', () => {
    const s = scrisoareaCodului('a<b>@x.ro', '111222', false)
    expect(s.html).not.toContain('<b>')
    expect(s.html).toContain('&lt;b&gt;')
  })
})

describe('„vezi ca" — masca ajunge la autorizare', () => {
  const cuMasca = (veziCa: SesiuneCurenta['veziCa']): SesiuneCurenta => ({
    ...SESIUNE_ANONIMA,
    authenticated: true,
    user: {
      id: 'u1',
      email: 'sef@exemplu.ro',
      displayName: 'Șeful',
      emailVerifiedAt: null,
      disabledAt: null,
      createdAt: new Date().toISOString(),
    },
    roles: [{ role: 'user', scope: 'global' }],
    sessionId: 's1',
    expiresAt: null,
    veziCa,
    poateVedeaCa: true,
  })

  it('principalul poartă masca, ca decizia să se ia sub ea', () => {
    expect(principalDin(cuMasca('user'))?.veziCa).toBe('user')
    expect(principalDin(cuMasca('admin'))?.veziCa).toBe('admin')
  })

  it('fără mască, principalul nu inventează una', () => {
    expect(principalDin(cuMasca(null))).toEqual({ userId: 'u1', email: 'sef@exemplu.ro' })
  })

  it('sesiunea anonimă nu dă principal (masca „neautentificat" ajunge aici)', () => {
    expect(principalDin(SESIUNE_ANONIMA)).toBeNull()
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
