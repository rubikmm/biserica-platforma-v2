import { describe, expect, it } from 'vitest'
import { curataCanalele, desface } from '../services/chat-worker/src/creier.js'

/**
 * Ce n-am voie să aflu greșit mai târziu: că o pagină de gândire a modelului (canalul `analysis`
 * al lui gpt-oss) ajunge la om ca răspuns. S-a întâmplat pe 11.09.2026, seara — omul a primit
 * „<|channel|>analysis We need to modify slujba of Monday…" în loc de o propunere.
 */

describe('canalele modelului', () => {
  it('un text curat rămâne cum e', () => {
    expect(curataCanalele('Bună ziua! Cu ce vă pot ajuta?')).toBe('Bună ziua! Cu ce vă pot ajuta?')
  })

  it('gândirea scursă fără canal final se aruncă toată', () => {
    expect(curataCanalele('<|channel|>analysis We need to modify slujba of Monday at 07: call program__modifica…')).toBe('')
  })

  it('când există canalul final, rămâne doar el', () => {
    const brut = '<|channel|>analysis The user wants…<|end|><|start|>assistant<|channel|>final<|message|>Am pregătit schimbarea.'
    expect(curataCanalele(brut)).toBe('Am pregătit schimbarea.')
  })

  it('text bun urmat de un marcaj rătăcit păstrează textul bun', () => {
    expect(curataCanalele('Gata, am pregătit.<|channel|>analysis and now…')).toBe('Gata, am pregătit.')
  })
})

describe('desfacerea răspunsului', () => {
  it('spune când modelul a fost oprit de buget și nu ia gândirea drept răspuns', () => {
    const r = desface({
      choices: [{ finish_reason: 'length', message: { content: '', reasoning: 'User wants to change…', tool_calls: null } }],
    })
    expect(r.taiat).toBe(true)
    expect(r.text).toBe('')
    expect(r.cereri).toEqual([])
  })

  it('ia apelurile de unealtă din forma OpenAI, cu id-ul lor', () => {
    const r = desface({
      choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{ id: 'apel-1', type: 'function', function: { name: 'program__modifica_slujba', arguments: '{"zi":"luni","schimbari":{"ora":"07:00"}}' } }] } }],
    })
    expect(r.taiat).toBe(false)
    expect(r.cereri).toEqual([{ nume: 'program__modifica_slujba', argumente: { zi: 'luni', schimbari: { ora: '07:00' } }, id: 'apel-1' }])
  })

  it('curăță și textul venit în forma simplă Workers AI', () => {
    const r = desface({ response: '<|channel|>analysis bla<|channel|>final<|message|>Marți, la 18:00.' })
    expect(r.text).toBe('Marți, la 18:00.')
  })
})
