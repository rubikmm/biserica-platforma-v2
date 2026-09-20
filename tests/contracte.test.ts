import { describe, expect, it } from 'vitest'
import {
  Cod,
  MASTI_SIMPLE,
  NIVEL_ROL,
  NIVEL_MASCA_ADMIN,
  PERMISIUNI_IMPLICITE,
  ROLURI,
  Rol,
  nivelMasca,
  numeMasca,
  permisiunileMastii,
  parseEveniment,
  redacteaza,
  scopeAcopera,
  treaptaCeaMaiInalta,
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

  /**
   * ⚠️ ROLUL GLOBAL `admin` S-A STINS (user, 19.09.2026). Cheile de lucru ale aplicațiilor nu mai vin
   * dintr-o treaptă intermediară, ci din numirea pe aplicație (`admini.ts`). Proba păzește chiar
   * dispariția: dacă cineva îl pune la loc, aici se aprinde roșu.
   */
  it('rolurile sunt două: `user` și `super-admin` — `admin` nu mai există', () => {
    expect([...ROLURI]).toEqual(['user', 'super-admin'])
    expect(Rol.safeParse('admin').success).toBe(false)
    expect(Object.keys(PERMISIUNI_IMPLICITE).sort()).toEqual(['super-admin', 'user'])
    expect(Object.keys(NIVEL_ROL).sort()).toEqual(['super-admin', 'user'])
  })

  it('user obișnuit doar citește programul', () => {
    expect(PERMISIUNI_IMPLICITE.user).toEqual(['program.read'])
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
    type: 'program.week.validated.v1',
    occurredAt: new Date().toISOString(),
    producer: 'app-program',
    actor: { type: 'user', id: 'u1' },
    correlationId: 'c1',
    payload: {
      luni: '2026-09-07',
      duminica: '2026-09-13',
      stare: 'validat',
      titlu: '7 – 13 septembrie 2026',
      versiuneCalendar: '2026-09-01.1',
      slujbe: 5,
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

describe('codul de intrare (contract)', () => {
  it('acceptă cele șase cifre scrise una câte una', () => {
    expect(Cod.parse('123456')).toBe('123456')
  })

  it('acceptă codul lipit din scrisoare, cu spațiul de la mijloc', () => {
    expect(Cod.parse('123 456')).toBe('123456')
    expect(Cod.parse(' 123-456 ')).toBe('123456')
  })

  it('refuză ce nu face șase cifre', () => {
    expect(Cod.safeParse('12345').success).toBe(false)
    expect(Cod.safeParse('1234567').success).toBe(false)
    expect(Cod.safeParse('abcdef').success).toBe(false)
  })
})

describe('„vezi ca" — treptele măștii', () => {
  it('măștile simple sunt două; a treia poartă codul unei aplicații', () => {
    expect([...MASTI_SIMPLE]).toEqual(['user', 'anonim'])
  })

  it('masca merge doar SUB treapta ta', () => {
    const super_ = NIVEL_ROL['super-admin']
    expect(nivelMasca('admin:calendar')).toBeLessThan(super_)
    expect(nivelMasca('user')).toBeLessThan(nivelMasca('admin:calendar'))
    expect(nivelMasca('anonim')).toBe(0)
    expect(nivelMasca('admin:calendar')).toBe(NIVEL_MASCA_ADMIN)
  })

  it('treapta cea mai înaltă e a rolului cel mai mare deținut', () => {
    expect(treaptaCeaMaiInalta([{ role: 'user' }, { role: 'super-admin' }])).toBe(NIVEL_ROL['super-admin'])
    expect(treaptaCeaMaiInalta([{ role: 'user' }])).toBe(NIVEL_ROL.user)
    expect(treaptaCeaMaiInalta([])).toBe(0)
  })

  it('sub mască, permisiunile sunt ale omului împrumutat — nu ale unui rol', () => {
    expect(permisiunileMastii('anonim')).toEqual([])
    expect(permisiunileMastii('user')).toEqual(['program.read'])
    // Administratorul unei aplicații e un UTILIZATOR cu cheile ei: le are pe amândouă.
    expect(permisiunileMastii('admin:calendar')).toContain('program.read')
    expect(permisiunileMastii('admin:calendar')).toContain('calendar.manage')
    // …și nimic din alta, nici cheile platformei.
    expect(permisiunileMastii('admin:calendar')).not.toContain('cleaning.manage')
    expect(permisiunileMastii('admin:calendar')).not.toContain('roles.manage')
    // Cheile însoțitoare vin odată cu numirea, deci și cu masca.
    expect(permisiunileMastii('admin:program')).toEqual(
      expect.arrayContaining(['program.read', 'program.write', 'program.publish']),
    )
  })

  it('numele măștii e cel arătat omului', () => {
    expect(numeMasca('anonim')).toBe('neautentificat')
    expect(numeMasca('user')).toBe('utilizator')
    expect(numeMasca('admin:calendar')).toBe('administrator al aplicației „Calendarul"')
    expect(numeMasca('admin:curatenie')).toBe('administrator al aplicației „Curățenia bisericii"')
  })
})
