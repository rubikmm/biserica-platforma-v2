import { describe, expect, it } from 'vitest'
import {
  PERMISIUNI_IMPLICITE,
  parseEveniment,
  redacteaza,
  scopeAcopera,
  Scope,
  Email,
} from '../packages/contracts/src/index.js'

describe('scope-uri', () => {
  it('`global` acoperă orice', () => {
    expect(scopeAcopera('global', 'parish:sf-ilie')).toBe(true)
    expect(scopeAcopera('global', 'global')).toBe(true)
  })

  it('un scope punctual nu acoperă altul', () => {
    expect(scopeAcopera('parish:sf-ilie', 'parish:alta')).toBe(false)
    expect(scopeAcopera('parish:sf-ilie', 'global')).toBe(false)
    expect(scopeAcopera('team:cor', 'parish:sf-ilie')).toBe(false)
  })

  it('validează forma textuală', () => {
    expect(Scope.safeParse('global').success).toBe(true)
    expect(Scope.safeParse('parish:sf-ilie').success).toBe(true)
    expect(Scope.safeParse('inventat:ceva').success).toBe(false)
    expect(Scope.safeParse('parish:MAJUSCULE').success).toBe(false)
  })
})

describe('roluri', () => {
  it('super-admin are toate permisiunile', () => {
    expect(PERMISIUNI_IMPLICITE['super-admin']).toContain('roles.manage')
    expect(PERMISIUNI_IMPLICITE['super-admin']).toContain('communication.send')
  })

  it('admin nu poate trimite comunicări în masă și nu gestionează roluri', () => {
    expect(PERMISIUNI_IMPLICITE.admin).not.toContain('communication.send')
    expect(PERMISIUNI_IMPLICITE.admin).not.toContain('roles.manage')
    expect(PERMISIUNI_IMPLICITE.admin).not.toContain('identity.manage')
  })

  it('user obișnuit doar citește calendarul', () => {
    expect(PERMISIUNI_IMPLICITE.user).toEqual(['calendar.read'])
  })
})

describe('email', () => {
  it('normalizează spațiile și majusculele', () => {
    expect(Email.parse('  RubikMM@Gmail.COM ')).toBe('rubikmm@gmail.com')
  })

  it('respinge adrese invalide', () => {
    expect(Email.safeParse('fara-arond').success).toBe(false)
  })
})

describe('redactare', () => {
  it('taie cheile sensibile, oricât de adânc', () => {
    const rezultat = redacteaza({
      email: 'cineva@exemplu.ro',
      password: 'secret123',
      imbricat: { token: 'abc', cookie: 'xyz', ok: 'vizibil' },
    }) as Record<string, unknown>

    expect(rezultat.email).toBe('cineva@exemplu.ro')
    expect(rezultat.password).toBe('[redactat]')
    const imbricat = rezultat.imbricat as Record<string, unknown>
    expect(imbricat.token).toBe('[redactat]')
    expect(imbricat.cookie).toBe('[redactat]')
    expect(imbricat.ok).toBe('vizibil')
  })

  it('trunchiază valorile lungi', () => {
    const lung = 'x'.repeat(500)
    expect(String(redacteaza(lung))).toContain('…[500]')
  })

  it('nu intră în recursie infinită', () => {
    const ciclic: Record<string, unknown> = {}
    ciclic.eu = ciclic
    expect(() => redacteaza(ciclic)).not.toThrow()
  })
})

describe('evenimente', () => {
  const valid = {
    id: crypto.randomUUID(),
    type: 'calendar.event.published.v1',
    occurredAt: new Date().toISOString(),
    producer: 'app-calendar',
    actor: { type: 'user', id: 'u1' },
    correlationId: 'c1',
    payload: {
      eventId: 'e1',
      title: 'Vecernie',
      startsAt: new Date().toISOString(),
      endsAt: null,
      status: 'published',
    },
  }

  it('acceptă un eveniment corect', () => {
    expect(() => parseEveniment(valid)).not.toThrow()
  })

  it('respinge un tip necunoscut', () => {
    expect(() => parseEveniment({ ...valid, type: 'inventat.v1' })).toThrow()
  })

  it('respinge un payload care nu se potrivește cu tipul', () => {
    expect(() => parseEveniment({ ...valid, payload: { altceva: true } })).toThrow()
  })

  it('respinge un envelope fără correlationId', () => {
    const { correlationId, ...fara } = valid
    expect(() => parseEveniment(fara)).toThrow()
  })
})
