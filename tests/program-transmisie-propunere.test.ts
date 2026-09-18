import { describe, expect, it } from 'vitest'
import { slujbeDinPropunere, type Propunere, type SlujbaPropusa } from '../apps/program/src/propunere.js'

/**
 * TRANSMISIA ÎN PROPUNEREA SĂPTĂMÂNII — probă de DEFECT TRĂIT, nu de formă.
 *
 * ⚠️ Câmpul `transmisie` nu e afișare: aparatul din biserică pornește transmisiunea NUMAI pentru
 * slujbele care îl au adevărat, iar propunerea intră în bază exact așa cum iese din maparea de
 * aici, în clipa în care omul validează săptămâna din chat. Cât timp propunerea scria
 * `transmisie: false` fix, din 15.09.2026 — prima săptămână validată din propunere — n-a mai pornit
 * nicio transmisiune, în tăcere: nimic nu se vedea pe foaie, nimeni n-avea de unde ști.
 *
 * Regula de acum e simplă și e hotărârea utilizatorului (18.09.2026): **orice slujbă propusă iese
 * cu `transmisie: true`**, fără să se ghicească din obiceiul slujbelor trecute. Cine nu vrea
 * transmisiune la o slujbă anume o stinge din chat (`program.modifica_slujba` primește `transmisie`).
 *
 * Proba stă pe `slujbeDinPropunere`, nu pe `hartii.ts`: acolo e scrisă maparea, o singură dată
 * pentru amândoi chemătorii (foaia săptămânii și răspunsul din chat), iar `hartii.ts` nu se poate
 * importa în teste — trage fonturi binare prin `foaie.ts`.
 */
const propusa = (data: string, ora: string, cod: string, nume: string): SlujbaPropusa => ({
  data,
  ora,
  cod_nume: cod,
  nume,
  detalii: [],
  motive: ['obicei: în 40 din ultimele 52 de săptămâni'],
  incredere: 0.8,
})

const propunere = (zile: Propunere['zile']): Propunere => ({
  luni: '2026-09-14',
  duminica: '2026-09-20',
  zile,
  despre: { saptamani_obicei: 52, ani_aceeasi_data: 3, calendar: true, versiune_calendar: '2026.1' },
  nelamuriri: [],
})

describe('propunerea săptămânii, făcută slujbe', () => {
  it('orice slujbă propusă se transmite — și curățenia rămâne nepusă', () => {
    const slujbe = slujbeDinPropunere(
      propunere([
        {
          data: '2026-09-14',
          slujbe: [
            propusa('2026-09-14', '07:00', 'utrenia_liturghie', 'Utrenia și Sfânta Liturghie'),
            propusa('2026-09-14', '18:00', 'vecernia_litia', 'Vecernia și Litia'),
          ],
        },
        { data: '2026-09-16', slujbe: [propusa('2026-09-16', '17:00', 'maslu', 'Sfântul Maslu')] },
        { data: '2026-09-20', slujbe: [propusa('2026-09-20', '08:00', 'ceasurile_liturghie', 'Ceasurile și Sfânta Liturghie')] },
      ]),
    )
    expect(slujbe).toHaveLength(4)
    expect(slujbe.map((s) => s.transmisie)).toEqual([true, true, true, true])
    expect(slujbe.map((s) => s.curatenie)).toEqual([false, false, false, false])
  })

  it('e adevărat și pentru o slujbă pe care istoricul n-a văzut-o niciodată (priveghere de hram)', () => {
    const [s] = slujbeDinPropunere(
      propunere([
        { data: '2026-09-19', slujbe: [propusa('2026-09-19', '21:00', 'priveghere_liturghie', 'PRIVEGHERE: Vecernia și Litia, Utrenia și Sfânta Liturghie')] },
      ]),
    )
    expect(s?.transmisie).toBe(true)
  })

  it('câmpurile de bază trec neatinse: id, dată, oră, nume, cod', () => {
    const [s] = slujbeDinPropunere(
      propunere([{ data: '2026-09-15', slujbe: [propusa('2026-09-15', '07:30', 'utrenia_liturghie', 'Utrenia și Sfânta Liturghie')] }]),
    )
    expect(s).toMatchObject({
      id: '2026-09-15-utrenia_liturghie',
      data: '2026-09-15',
      ora: '07:30',
      nume: 'Utrenia și Sfânta Liturghie',
      cod_nume: 'utrenia_liturghie',
    })
  })

  it('o propunere fără nicio zi nu scoate nicio slujbă', () => {
    expect(slujbeDinPropunere(propunere([]))).toEqual([])
  })
})
