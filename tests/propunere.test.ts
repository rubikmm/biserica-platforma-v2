import { describe, expect, it } from 'vitest'
import { propune } from '../apps/program/src/propunere.js'
import type { RandIstoricSlujba } from '../apps/program/src/depozit.js'

/**
 * PRIVEGHERILE ÎN PROPUNEREA SĂPTĂMÂNII (user, 12.09.2026: „când se face propunerea programului, să
 * se sugereze și privegherile care au fost făcute în anii trecuți").
 *
 * Ce păzesc probele de aici, în ordinea în care contează:
 *  1. **pragul e UNU** — o singură priveghere în tot istoricul e destulă ca s-o sugerăm la anul
 *     („pragul pentru o priveghere nu e să fie de mai multe ci să fi fost măcar o slujbă de la ora 21");
 *  2. **nu se dublează**: privegherea ține locul vecerniei din aceeași seară și, când are Liturghie,
 *     al slujbei de dimineață a zilei următoare — așa s-a făcut dintotdeauna, se vede în arhivă;
 *  3. **`priveghere_utrenia` (18:00) NU înghite dimineața** de a doua zi: ea ține doar până la Utrenie,
 *     iar Liturghia urmează la 08:00;
 *  4. **Liturghia duminicii nu se atinge niciodată**, orice ar fi sâmbătă seara.
 */
const VOCABULAR = new Map([
  ['priveghere_liturghie', { cod_nume: 'priveghere_liturghie', nume: 'PRIVEGHERE: Vecernia și Litia, Utrenia și Sfânta Liturghie', categorie: 'seara' }],
  ['priveghere_utrenia', { cod_nume: 'priveghere_utrenia', nume: 'PRIVEGHERE: Vecernia, Litia și Utrenia', categorie: 'seara' }],
  ['vecernia_litia', { cod_nume: 'vecernia_litia', nume: 'Vecernia și Litia', categorie: 'seara' }],
  ['utrenia_liturghie', { cod_nume: 'utrenia_liturghie', nume: 'Utrenia și Sfânta Liturghie', categorie: 'dimineata' }],
  ['ceasurile_liturghie', { cod_nume: 'ceasurile_liturghie', nume: 'Ceasurile și Sfânta Liturghie', categorie: 'dimineata' }],
] as const) as never

/** O săptămână de luni, 2026-07-13 → duminică, 2026-07-19; privegherea hramului cade pe 19 iulie. */
const LUNI = '2026-07-13'

function istoric(...randuri: Array<Partial<RandIstoricSlujba> & { data: string }>): RandIstoricSlujba[] {
  return randuri.map((r) => ({
    ora: '21:00',
    cod_nume: 'priveghere_liturghie',
    luni: r.data.slice(0, 8) + '13',
    detalii: null,
    ...r,
  }))
}

describe('propunere — privegherile din anii trecuți', () => {
  it('o singură priveghere în tot istoricul e destulă ca să fie sugerată', () => {
    const p = propune(LUNI, istoric({ data: '2022-07-19' }), VOCABULAR, null)
    const ziua = p.zile.find((z) => z.data === '2026-07-19')
    expect(ziua?.slujbe.map((s) => s.cod_nume)).toContain('priveghere_liturghie')
  })

  // ⚠️ Slujba se cauta pe ZIUA ei, nu pe cod: cu un istoric mic, izvorul obiceiului umple si alte zile
  // cu acelasi cod (o saptamana din una inseamna 100%), si proba ar privi slujba nepotrivita.
  const inZiua = (p: ReturnType<typeof propune>, data: string, cod: string) =>
    p.zile.find((z) => z.data === data)?.slujbe.find((s) => s.cod_nume === cod)

  it('scrie în motive anii în care s-a privegheat, unul după altul', () => {
    const p = propune(LUNI, istoric({ data: '2021-07-19' }, { data: '2022-07-19' }, { data: '2024-07-19' }), VOCABULAR, null)
    expect(inZiua(p, '2026-07-19', 'priveghere_liturghie')?.motive.join(' ')).toContain('priveghere: în 2021, 2022, 2024')
  })

  it('ia numele sfântului din detaliile privegherii de atunci', () => {
    const p = propune(LUNI, istoric({ data: '2022-07-19', detalii: '["Sfântul și slăvitul Proroc Ilie Tesviteanul"]' }), VOCABULAR, null)
    expect(inZiua(p, '2026-07-19', 'priveghere_liturghie')?.detalii).toContain('Sfântul și slăvitul Proroc Ilie Tesviteanul')
  })

  it('o slujbă de la 21:00 se socotește priveghere chiar dacă nu se cheamă așa', () => {
    const p = propune(LUNI, istoric({ data: '2016-07-19', ora: '21:00', cod_nume: 'vecernia_litia' }), VOCABULAR, null)
    const ziua = p.zile.find((z) => z.data === '2026-07-19')
    expect(ziua?.slujbe.map((s) => s.cod_nume)).toContain('vecernia_litia')
  })

  it('privegherea ține locul vecerniei din aceeași seară — nu se scriu amândouă', () => {
    // vecernia de sâmbătă seara e obicei de ani de zile, deci izvorul 1 o propune
    const obicei: RandIstoricSlujba[] = []
    for (let s = 1; s <= 52; s++) {
      const zi = new Date(Date.UTC(2025, 6, 5) - s * 7 * 86400000).toISOString().slice(0, 10)
      obicei.push({ data: zi, ora: '18:00', cod_nume: 'vecernia_litia', luni: zi, detalii: null })
    }
    const p = propune(LUNI, [...obicei, ...istoric({ data: '2022-07-19' })], VOCABULAR, null)
    const ziua = p.zile.find((z) => z.data === '2026-07-19')
    const seara = ziua?.slujbe.filter((s) => s.cod_nume === 'vecernia_litia' || s.cod_nume.startsWith('priveghere')) ?? []
    expect(seara).toHaveLength(1)
    expect(seara[0]?.cod_nume).toBe('priveghere_liturghie')
  })

  it('privegherea CU Liturghie stinge slujba de dimineață a zilei următoare', () => {
    // priveghere marți seara (14 iulie), deci miercuri dimineața nu se mai face Liturghie
    const trecut = [
      ...istoric({ data: '2022-07-14' }),
      { data: '2022-07-15', ora: '08:00', cod_nume: 'utrenia_liturghie', luni: '2022-07-11', detalii: null },
      { data: '2023-07-15', ora: '08:00', cod_nume: 'utrenia_liturghie', luni: '2023-07-10', detalii: null },
      { data: '2024-07-15', ora: '08:00', cod_nume: 'utrenia_liturghie', luni: '2024-07-15', detalii: null },
    ]
    const p = propune(LUNI, trecut, VOCABULAR, null)
    const miercuri = p.zile.find((z) => z.data === '2026-07-15')
    expect(miercuri?.slujbe.map((s) => s.cod_nume) ?? []).not.toContain('utrenia_liturghie')
    expect(p.zile.find((z) => z.data === '2026-07-14')?.slujbe.map((s) => s.cod_nume)).toContain('priveghere_liturghie')
  })

  it('privegherea FĂRĂ Liturghie (18:00) lasă dimineața următoare neatinsă', () => {
    const trecut = [
      ...istoric({ data: '2022-07-14', ora: '18:00', cod_nume: 'priveghere_utrenia' }),
      { data: '2022-07-15', ora: '08:00', cod_nume: 'ceasurile_liturghie', luni: '2022-07-11', detalii: null },
      { data: '2023-07-15', ora: '08:00', cod_nume: 'ceasurile_liturghie', luni: '2023-07-10', detalii: null },
      { data: '2024-07-15', ora: '08:00', cod_nume: 'ceasurile_liturghie', luni: '2024-07-15', detalii: null },
    ]
    const p = propune(LUNI, trecut, VOCABULAR, null)
    expect(p.zile.find((z) => z.data === '2026-07-15')?.slujbe.map((s) => s.cod_nume)).toContain('ceasurile_liturghie')
  })

  it('nu stinge niciodată Liturghia duminicii, orice ar fi sâmbătă seara', () => {
    const trecut = [
      // priveghere sâmbătă seara (18 iulie 2026 cade sâmbătă)
      ...istoric({ data: '2021-07-18' }, { data: '2022-07-18' }),
      // Liturghia duminicii, obicei săptămânal
      ...Array.from({ length: 52 }, (_, s) => {
        const zi = new Date(Date.UTC(2025, 6, 6) - s * 7 * 86400000).toISOString().slice(0, 10)
        return { data: zi, ora: '08:00', cod_nume: 'utrenia_liturghie', luni: zi, detalii: null }
      }),
    ]
    const p = propune(LUNI, trecut, VOCABULAR, null)
    expect(p.zile.find((z) => z.data === '2026-07-19')?.slujbe.map((s) => s.cod_nume)).toContain('utrenia_liturghie')
  })
})
