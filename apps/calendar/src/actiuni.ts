/**
 * CE ȘTIE SĂ FACĂ CALENDARUL — lista lui de acțiuni, publicată la `/_actiuni`.
 *
 * ⚠️ Fără logică proprie: fiecare `executa` cheamă funcțiile de depozit și desfacerea zilei, exact
 * ca rutele `/v1`. Calendarul e cel care spune CE ZI e — de el atârnă restul aplicațiilor.
 */
import { z } from 'zod'
import { actiune, registru } from '@xc/actiuni'
import { aziBucuresti, dataCeruta } from '@xc/ui'
import { aniPreluati, cauta, randulOriCalculat, versiuneaCalendarului } from './depozit.js'
import { ziLiturgica } from './traducere.js'

export interface EnvActiuniCalendar {
  DB: D1Database
}

const ZiCeruta = z
  .string()
  .default('azi')
  .describe('ziua: AAAA-LL-ZZ, „azi" sau „maine"')

function ziua(text: string | undefined): string {
  const d = dataCeruta(text ?? 'azi', aziBucuresti())
  if (!d) throw new Error(`nu înțeleg ziua „${text}"; scrie AAAA-LL-ZZ, „azi" sau „mâine"`)
  return d
}

export const ACTIUNI = registru<EnvActiuniCalendar>([
  actiune({
    nume: 'calendar.ziua',
    descriere:
      'Ce zi liturgică e: denumirea sărbătorii, sfinții pomeniți, rangul (cruce roșie sau ' +
      'neagră), postul zilei, glasul și pericopele. Aici e răspunsul la „ce sărbătoare e azi".',
    efect: 'citeste',
    intrare: z.object({ zi: ZiCeruta }),
    iesire: z.any(),
    exemple: ['ce sărbătoare e azi?', 'se postește miercuri?', 'ce zi e pe 14 septembrie?'],
    async executa({ zi }, c) {
      const data = ziua(zi)
      const [ani, v] = await Promise.all([aniPreluati(c.env.DB), versiuneaCalendarului(c.env.DB)])
      const r = await randulOriCalculat(c.env.DB, data, ani)
      if (!r) throw new Error(`ziua ${data} nu e în calendar`)
      return ziLiturgica(r, v.versiune)
    },
  }),

  actiune({
    nume: 'calendar.cauta',
    descriere:
      'Caută o sărbătoare sau un sfânt în calendar, după nume, și spune în ce zile cade. ' +
      'Cel puțin trei litere.',
    efect: 'citeste',
    intrare: z.object({
      text: z.string().min(3).describe('ce se caută: „Sfântul Ilie", „Adormirea"'),
      an: z.number().int().optional().describe('numai într-un an anume'),
    }),
    iesire: z.object({ gasite: z.number(), zile: z.array(z.any()) }),
    exemple: ['când e Sfântul Ilie?', 'în ce zi cade Adormirea Maicii Domnului?'],
    async executa({ text, an }, c) {
      const v = await versiuneaCalendarului(c.env.DB)
      const randuri = await cauta(c.env.DB, text, an)
      return { gasite: randuri.length, zile: randuri.map((r) => ziLiturgica(r, v.versiune)) }
    },
  }),
])
