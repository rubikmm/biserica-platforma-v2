import { describe, expect, it } from 'vitest'
import { desfaceClaude, spreClaude, type BlocClaude } from '../services/chat-worker/src/creier.js'

/**
 * Drumul Claude (prin AI Gateway): istoricul nostru trebuie să ajungă la API în forma pe care o
 * cere — altfel cererea cade cu 400 înainte să se întâmple ceva. Ce n-am voie să aflu greșit mai
 * târziu: rezultatele uneltelor lipite într-un singur mesaj, tura brută pusă înapoi neschimbată,
 * și un răspuns cu tool_use desfăcut cu id-ul lui.
 */

describe('istoricul, în forma Anthropic', () => {
  it('instrucțiunile merg în system, omul și agentul în messages', () => {
    const r = spreClaude([
      { rol: 'sistem', text: 'Ești asistentul.' },
      { rol: 'om', text: 'Bună!' },
      { rol: 'agent', text: 'Salut! Cu ce te pot ajuta?' },
      { rol: 'om', text: 'Ce e mâine?' },
    ])
    expect(r.system).toBe('Ești asistentul.')
    expect(r.messages).toEqual([
      { role: 'user', content: 'Bună!' },
      { role: 'assistant', content: [{ type: 'text', text: 'Salut! Cu ce te pot ajuta?' }] },
      { role: 'user', content: 'Ce e mâine?' },
    ])
  })

  it('rezultatele uneltelor care se țin lanț intră într-un singur mesaj user', () => {
    const r = spreClaude([
      { rol: 'om', text: 'ce slujbe sunt luni și marți?' },
      {
        rol: 'agent',
        text: '',
        apeluri: [
          { nume: 'program__slujbele_zilei', argumente: { zi: 'luni' }, id: 'toolu_1' },
          { nume: 'program__slujbele_zilei', argumente: { zi: 'marti' }, id: 'toolu_2' },
        ],
      },
      { rol: 'unealta', text: '{"slujbe":[]}', numeUnealta: 'program__slujbele_zilei', idApel: 'toolu_1' },
      { rol: 'unealta', text: '{"slujbe":[1]}', numeUnealta: 'program__slujbele_zilei', idApel: 'toolu_2' },
    ])
    expect(r.messages).toHaveLength(3)
    expect(r.messages[1]).toEqual({
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'toolu_1', name: 'program__slujbele_zilei', input: { zi: 'luni' } },
        { type: 'tool_use', id: 'toolu_2', name: 'program__slujbele_zilei', input: { zi: 'marti' } },
      ],
    })
    expect(r.messages[2]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'toolu_1', content: '{"slujbe":[]}' },
        { type: 'tool_result', tool_use_id: 'toolu_2', content: '{"slujbe":[1]}' },
      ],
    })
  })

  it('tura brută a asistentului se pune înapoi exact cum a venit, gândire cu tot', () => {
    const brut: BlocClaude[] = [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'tool_use', id: 'toolu_9', name: 'x', input: {} },
    ]
    const r = spreClaude([
      { rol: 'om', text: 'fă ceva' },
      { rol: 'agent', text: '', apeluri: [{ nume: 'x', argumente: {}, id: 'toolu_9' }], brut },
      { rol: 'unealta', text: 'gata', idApel: 'toolu_9' },
    ])
    expect(r.messages[1]).toEqual({ role: 'assistant', content: brut })
  })

  it('o tură a asistentului nu poate deschide discuția, iar mesajele goale nu se trimit', () => {
    const r = spreClaude([
      { rol: 'agent', text: 'Salut!' },
      { rol: 'om', text: '   ' },
      { rol: 'om', text: 'bună' },
    ])
    expect(r.messages).toEqual([{ role: 'user', content: 'bună' }])
  })
})

describe('răspunsul lui Claude, în forma noastră', () => {
  it('ia textul și apelurile de unealtă, cu id-urile lor, și păstrează blocurile brute', () => {
    const content: BlocClaude[] = [
      { type: 'text', text: 'Pregătesc schimbarea.' },
      { type: 'tool_use', id: 'toolu_5', name: 'program__modifica_slujba', input: { zi: 'luni', schimbari: { ora: '07:00' } } },
    ]
    const r = desfaceClaude({ content, stop_reason: 'tool_use' })
    expect(r.text).toBe('Pregătesc schimbarea.')
    expect(r.cereri).toEqual([{ nume: 'program__modifica_slujba', argumente: { zi: 'luni', schimbari: { ora: '07:00' } }, id: 'toolu_5' }])
    expect(r.taiat).toBe(false)
    expect(r.brut).toBe(content)
  })

  it('știe când a fost tăiat de buget', () => {
    expect(desfaceClaude({ content: [{ type: 'text', text: 'Încep' }], stop_reason: 'max_tokens' }).taiat).toBe(true)
  })

  it('gândirea nu ajunge niciodată în text', () => {
    const r = desfaceClaude({
      content: [
        { type: 'thinking', thinking: 'mă gândesc…', signature: 's' },
        { type: 'text', text: 'Marți, la 18:00.' },
      ],
      stop_reason: 'end_turn',
    })
    expect(r.text).toBe('Marți, la 18:00.')
  })
})
