/**
 * CE ȘTIE SĂ FACĂ PROGRAMUL — lista lui de acțiuni, publicată la `/_actiuni`.
 *
 * Se citește de un model de limbaj (modulul de chat), dar și de o altă aplicație sau de o
 * automatizare: toți cer la fel, nimeni n-are o cale privilegiată.
 *
 * ⚠️ Regula modulului: NICIO logică aici. Fiecare `executa` cheamă funcția de domeniu pe care o
 * cheamă și ruta `/v1` — `depozit.ts` pentru date, `hartii.ts` pentru hârtii. Dacă o acțiune ar
 * avea nevoie de cod nou, codul acela merge în domeniu, unde-l poate folosi și ruta publică.
 */
import { z } from 'zod'
import { actiune, registru, Obiect } from '@xc/actiuni'
import { Saptamana } from '@xc/contracts'
import { citesteConfig, navigatieDin } from '@xc/config'
import { aziBucuresti, dataCeruta, luneaSaptamanii, obiectDinHtml, oraBucuresti } from '@xc/ui'
import { saptamana, saptamanaDin, slujbaDin, slujbeInterval, slujbeleSaptamanii, urmatoareaSlujba } from './depozit.js'
import {
  htmlFoaiaSaptamanii,
  htmlPozaSaptamanii,
  htmlSfintiiZilei,
  LATIME_POZA,
  type EnvHartii,
} from './hartii.js'
import type { Ctx } from './pagini.js'

export interface EnvActiuniProgram extends EnvHartii {
  MEDIA: Fetcher
}

/** Ziua cerută, altfel ziua de azi. Aruncă doar la un text care nu e nici dată, nici cuvânt știut. */
function ziua(text: string | undefined): string {
  const azi = aziBucuresti()
  const d = dataCeruta(text ?? 'azi', azi)
  if (!d) throw new Error(`nu înțeleg ziua „${text}"; scrie AAAA-LL-ZZ, „azi", „mâine" sau „viitoare"`)
  return d
}

const ZiCeruta = z
  .string()
  .default('azi')
  .describe('ziua: AAAA-LL-ZZ, „azi", „maine" sau „viitoare" (peste o săptămână)')

const SaptamanaCeruta = z
  .string()
  .default('azi')
  .describe('o zi din săptămână: AAAA-LL-ZZ, „azi", „maine" sau „viitoare"')

/** Ctx-ul pozei: fără om și fără drepturi — în poză nu se apasă nimic, deci nu se scrie nimic al adminului. */
function ctxPoza(env: unknown): Ctx {
  return {
    prefix: '',
    nav: navigatieDin(citesteConfig(env)),
    utilizator: null,
    eAdmin: false,
    versiune: '',
    modificata: '',
  }
}

export const ACTIUNI = registru<EnvActiuniProgram>([
  actiune({
    nume: 'program.slujbele_zilei',
    descriere:
      'Slujbele dintr-o zi anume, cu ora, numele slujbei și locul. Pentru „ce slujbă e azi/mâine".',
    efect: 'citeste',
    intrare: z.object({ zi: ZiCeruta }),
    iesire: z.object({
      data: z.string(),
      stare: z.string().nullable(),
      slujbe: z.array(z.any()),
    }),
    exemple: ['ce slujbe sunt azi?', 'e ceva mâine dimineață?'],
    async executa({ zi }, c) {
      const data = ziua(zi)
      const rand = await saptamana(c.env.DB, luneaSaptamanii(data))
      const slujbe = (await slujbeInterval(c.env.DB, data, data)).map(slujbaDin)
      return { data, stare: rand?.stare ?? null, slujbe }
    },
  }),

  actiune({
    nume: 'program.slujbele_saptamanii',
    descriere:
      'Programul unei săptămâni întregi: toate slujbele, cu zi, oră și loc, plus starea ei ' +
      '(propunere sau validat). Săptămâna se cere prin orice zi din ea.',
    efect: 'citeste',
    intrare: z.object({ saptamana: SaptamanaCeruta }),
    iesire: Saptamana,
    exemple: ['cum arată programul săptămânii viitoare?', 'ce se slujește săptămâna asta?'],
    async executa({ saptamana: cerut }, c) {
      const luni = luneaSaptamanii(ziua(cerut))
      const rand = await saptamana(c.env.DB, luni)
      if (!rand) throw new Error(`săptămâna ${luni} nu e în bază`)
      return saptamanaDin(rand, await slujbeleSaptamanii(c.env.DB, luni))
    },
  }),

  actiune({
    nume: 'program.urmatoarea_slujba',
    descriere: 'Care e următoarea slujbă de acum înainte, cu ziua și ora ei.',
    efect: 'citeste',
    intrare: z.object({}),
    iesire: z.object({
      acum: z.object({ data: z.string(), ora: z.string() }),
      urmatoarea: z.any().nullable(),
    }),
    exemple: ['când e următoarea slujbă?', 'cât mai e până la Vecernie?'],
    async executa(_a, c) {
      const azi = aziBucuresti()
      const ora = oraBucuresti()
      const r = await urmatoareaSlujba(c.env.DB, azi, ora)
      return { acum: { data: azi, ora }, urmatoarea: r ? slujbaDin(r) : null }
    },
  }),

  // -------------------------------------------------------------- hârtiile
  actiune({
    nume: 'program.foaia_sfintilor',
    descriere:
      'Foaia „Sfinții zilei" pentru o zi: sfinții din calendar, apoi pomenirile cărților ' +
      'tipicului, fiecare fără cei spuși mai sus. Gata de tipărit sau de trimis.',
    efect: 'citeste',
    intrare: z.object({
      zi: ZiCeruta,
      cu_sinaxar: z.boolean().default(false).describe('adaugă și sinaxarul zilei, dacă există'),
    }),
    iesire: Obiect,
    exemple: ['trimite-mi foaia cu sfinții de duminică', 'fă-mi PDF-ul sfinților zilei'],
    async executa({ zi, cu_sinaxar }, c) {
      const data = ziua(zi)
      const foaie = await htmlSfintiiZilei(c.env, data, cu_sinaxar)
      if (!foaie) throw new Error('calendarul nu răspunde acum')
      return obiectDinHtml({
        media: c.env.MEDIA,
        browser: c.env.BROWSER,
        html: foaie.corp,
        fel: 'pdf',
        cale: `program/sfintii/${data}${cu_sinaxar ? '-cu-sinaxar' : ''}`,
        nume: foaie.nume,
        titlu: foaie.titlu,
      })
    },
  }),

  actiune({
    nume: 'program.foaia_saptamanii',
    descriere:
      'Foaia A4 a săptămânii — cea care se pune pe ușă. Numai din săptămâni validate. ' +
      'Pentru săptămâna nescrisă încă, cere „propunere".',
    efect: 'citeste',
    intrare: z.object({
      saptamana: SaptamanaCeruta,
      fel: z.enum(['foaie', 'propunere']).default('foaie'),
      format: z.enum(['pdf', 'jpg']).default('pdf'),
    }),
    iesire: Obiect,
    exemple: ['dă-mi foaia de pe ușă pentru săptămâna viitoare', 'vreau programul ca PDF'],
    async executa({ saptamana: cerut, fel, format }, c) {
      const data = ziua(cerut)
      const f = await htmlFoaiaSaptamanii(c.env, data, fel)
      if (!f.ok) throw new Error(f.mesaj)
      return obiectDinHtml({
        media: c.env.MEDIA,
        browser: c.env.BROWSER,
        html: f.corp,
        fel: format,
        cale: `program/foaie/${luneaSaptamanii(data)}-${fel}`,
        nume: f.nume,
        titlu: f.titlu,
      })
    },
  }),

  actiune({
    nume: 'program.poza_paginii',
    descriere:
      'Pagina săptămânii fotografiată, așa cum se vede pe ecran — bună de trimis pe WhatsApp. ' +
      'Cu sau fără coloana calendarului.',
    efect: 'citeste',
    intrare: z.object({
      saptamana: SaptamanaCeruta,
      cu_calendar: z.boolean().default(true),
    }),
    iesire: Obiect,
    exemple: ['fă-mi o poză cu programul săptămânii', 'trimite poza pe grup'],
    async executa({ saptamana: cerut, cu_calendar }, c) {
      const data = ziua(cerut)
      const azi = aziBucuresti()
      const poza = await htmlPozaSaptamanii(c.env, data, { ctx: ctxPoza(c.env), azi, cuCalendar: cu_calendar })
      return obiectDinHtml({
        media: c.env.MEDIA,
        browser: c.env.BROWSER,
        html: poza.corp,
        fel: 'jpg',
        cale: `program/poza/${luneaSaptamanii(data)}${cu_calendar ? '-cal' : ''}`,
        nume: poza.nume,
        titlu: poza.titlu,
        latime: LATIME_POZA,
      })
    },
  }),
])
