/**
 * CE ȘTIE SĂ FACĂ TIPICUL — lista lui de acțiuni, publicată la `/_actiuni`.
 *
 * ⚠️ Fără logică proprie: fiecare `executa` cheamă funcția din `zi.ts`, aceeași pe care o cheamă
 * și rutele `/v1`.
 */
import { z } from 'zod'
import { actiune, registru } from '@xc/actiuni'
import { aziBucuresti, dataCeruta } from '@xc/ui'
import { sfintiiPeSurse, ziuaIntreaga, type EnvZi } from './zi.js'

export type EnvActiuniTipic = EnvZi

const ZiCeruta = z
  .string()
  .default('azi')
  .describe('ziua: AAAA-LL-ZZ, „azi" sau „maine"')

function ziua(text: string | undefined): string {
  const d = dataCeruta(text ?? 'azi', aziBucuresti())
  if (!d) throw new Error(`nu înțeleg ziua „${text}"; scrie AAAA-LL-ZZ, „azi" sau „mâine"`)
  return d
}

export const ACTIUNI = registru<EnvActiuniTipic>([
  actiune({
    nume: 'tipic.sfintii_zilei',
    descriere:
      'Sfinții unei zile așa cum îi numără cărțile tipicului (Mineiul, apoi Anuarul): numele, ' +
      'stihul și viața pe scurt, grupate pe cărți. Datele, nu hârtia — pentru foaia gata de ' +
      'trimis e „program.foaia_sfintilor".',
    efect: 'citeste',
    intrare: z.object({ zi: ZiCeruta }),
    iesire: z.object({
      data: z.string().nullable(),
      luna: z.number(),
      zi: z.number(),
      surse: z.array(z.any()),
    }),
    exemple: ['cine sunt sfinții de mâine?', 'ce pomenește Mineiul pe 13 septembrie?'],
    async executa({ zi }, c) {
      const data = ziua(zi)
      const r = await sfintiiPeSurse(c.env, Number(data.slice(5, 7)), Number(data.slice(8, 10)), data)
      if (!r) throw new Error(`nici Mineiul, nici Anuarul n-au ziua ${data}`)
      return r
    },
  }),

  actiune({
    nume: 'tipic.randuiala_zilei',
    descriere:
      'Rânduiala slujbei dintr-o zi, din cele trei cărți: Rânduiala Tipicului (ce se face), ' +
      'Anuarul liturgic (desfășurat) și Mineiul (textul slujbei).',
    efect: 'citeste',
    intrare: z.object({ zi: ZiCeruta }),
    iesire: z.object({
      data: z.string(),
      randuiala: z.any().nullable(),
      tipiconal: z.any().nullable(),
      minei: z.any().nullable(),
      carti: z.any(),
    }),
    exemple: ['ce spune tipicul pentru duminică?', 'ce glas e mâine?'],
    async executa({ zi }, c) {
      const data = ziua(zi)
      const z0 = await ziuaIntreaga(c.env, data)
      if (!z0.randuiala && !z0.tipiconal && !z0.minei) {
        throw new Error(`pentru ${data} nu există rânduială în cărțile tipicului`)
      }
      return z0
    },
  }),
])
