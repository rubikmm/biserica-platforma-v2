import { describe, expect, it } from 'vitest'
import { MODELE, felDupaId, modelDupaId, normalizeaza } from '../packages/chat/src/index.js'

/**
 * Lista de modele și traducerea configului. Ce n-am voie să aflu greșit mai târziu: o configurare
 * scrisă de panoul vechi (doar `creier`) trebuie să se citească fără să se piardă nimic, iar
 * drumul (Claude sau Workers AI) trebuie să iasă din id, nu din memorie.
 */

describe('lista de modele', () => {
  it('are amândouă grupurile și fiecare id merge pe drumul lui', () => {
    expect(MODELE.some((m) => m.grup === 'gratuit')).toBe(true)
    expect(MODELE.some((m) => m.grup === 'platit')).toBe(true)
    for (const m of MODELE) expect(felDupaId(m.id)).toBe(m.fel)
  })

  it('id-urile sunt unice și fără punct dublu (numele uneltelor folosesc __)', () => {
    const ids = MODELE.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(modelDupaId('claude-opus-4-8')?.nume).toBe('Claude Opus 4.8')
    expect(modelDupaId('ceva-inventat')).toBeNull()
  })
})

describe('configul, cu model', () => {
  it('modelul ales din panou hotărăște drumul', () => {
    expect(normalizeaza({ activ: true, model: '@cf/openai/gpt-oss-120b' })).toMatchObject({ model: '@cf/openai/gpt-oss-120b', creier: 'workers-ai' })
    expect(normalizeaza({ activ: true, model: 'claude-sonnet-5' })).toMatchObject({ model: 'claude-sonnet-5', creier: 'claude' })
    expect(normalizeaza({ activ: true, model: '' })).toMatchObject({ model: '', creier: 'fara' })
  })

  it('o configurare veche, doar cu creier, se traduce în modelul implicit al drumului', () => {
    expect(normalizeaza({ activ: true, creier: 'claude' })).toMatchObject({ model: 'claude-opus-4-8', creier: 'claude' })
    expect(normalizeaza({ activ: true, creier: 'workers-ai' })).toMatchObject({ model: '@cf/openai/gpt-oss-120b', creier: 'workers-ai' })
    expect(normalizeaza({ activ: true, creier: 'gateway' })).toMatchObject({ creier: 'workers-ai' })
    expect(normalizeaza({ activ: true, creier: 'fara' })).toMatchObject({ model: '', creier: 'fara' })
  })

  it('fără nimic scris, e Claude Opus 4.8', () => {
    expect(normalizeaza({})).toMatchObject({ model: 'claude-opus-4-8', creier: 'claude', activ: false })
  })
})
