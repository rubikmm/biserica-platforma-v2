/**
 * CE ȘTIE SĂ FACĂ PROGRAMUL — lista lui de acțiuni, publicată la `/_actiuni`.
 *
 * Se citește de un model de limbaj (modulul de chat), dar și de o altă aplicație sau de o
 * automatizare: toți cer la fel, nimeni n-are o cale privilegiată.
 *
 * ⚠️ Regula modulului: NICIO logică aici. Fiecare `executa` cheamă funcția de domeniu pe care o
 * cheamă și ruta `/v1` — `depozit.ts` pentru date, `hartii.ts` pentru hârtii. Dacă o acțiune ar
 * avea nevoie de cod nou, codul acela merge în domeniu, unde-l poate folosi și ruta publică.
 *
 * Lista de la 11.09.2026 (user): următoarea și curenta (pentru live și radio), săptămâna curentă
 * și viitoare ca text / poză brută / pdf-tipar / jpg-tipar, arhiva ca fișier, plus tiparele
 * istoricului ca fundal — ca la „când e Sfântul Maslu?" chatul să răspundă din prima.
 */
import { z } from 'zod'
import { citesteConfig, navigatieDin } from '@xc/config'
import { actiune, registru, Obiect } from '@xc/actiuni'
import { Saptamana, Slujba } from '@xc/contracts'
import { aziBucuresti, dataCeruta, luneaSaptamanii, obiectDinHtml, obiectDinText, oraBucuresti } from '@xc/ui'
import {
  arhivaIntreaga,
  cautaInVocabular,
  saptamana,
  saptamanaDin,
  slujbaCurenta,
  slujbaDin,
  slujbeInterval,
  slujbeleSaptamanii,
  slujbeTrecuteDupaNume,
  tiparele,
  urmatoareaDupaNume,
  urmatoareaSlujba,
  vocabularul,
} from './depozit.js'
import {
  htmlFoaiaSaptamanii,
  htmlPozaSaptamanii,
  htmlSfintiiZilei,
  LATIME_POZA,
  textSaptamanii,
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
  .describe('o zi din săptămână: AAAA-LL-ZZ, „azi" (săptămâna curentă) sau „viitoare"')

/** Săptămâna cerută, în forma contractului; aruncă dacă nu e în bază. */
async function saptamanaCeruta(env: EnvActiuniProgram, cerut: string | undefined): Promise<Saptamana> {
  const luni = luneaSaptamanii(ziua(cerut))
  const rand = await saptamana(env.DB, luni)
  if (!rand) throw new Error(`săptămâna ${luni} nu e în bază`)
  return saptamanaDin(rand, await slujbeleSaptamanii(env.DB, luni))
}

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
  // ------------------------------------------------------------ live și radio
  actiune({
    nume: 'program.slujba_urmatoare',
    descriere: 'Următoarea slujbă de acum înainte: data, ora, numele, detaliile și locul. Pentru live și radio.',
    efect: 'citeste',
    intrare: z.object({}),
    iesire: z.object({
      acum: z.object({ data: z.string(), ora: z.string() }),
      slujba: Slujba.nullable(),
    }),
    exemple: ['când e următoarea slujbă?', 'cât mai e până la Vecernie?'],
    async executa(_a, c) {
      const azi = aziBucuresti()
      const ora = oraBucuresti()
      const r = await urmatoareaSlujba(c.env.DB, azi, ora)
      return { acum: { data: azi, ora }, slujba: r ? slujbaDin(r) : null }
    },
  }),

  actiune({
    nume: 'program.slujba_curenta',
    descriere:
      'Slujba în curs chiar acum (a început de cel mult trei ore și e ultima începută), sau nimic ' +
      'dacă nu se slujește. Pentru live și radio.',
    efect: 'citeste',
    intrare: z.object({}),
    iesire: z.object({
      acum: z.object({ data: z.string(), ora: z.string() }),
      slujba: Slujba.nullable(),
    }),
    exemple: ['se slujește acum?', 'ce e acum la biserică?'],
    async executa(_a, c) {
      const azi = aziBucuresti()
      const ora = oraBucuresti()
      const r = await slujbaCurenta(c.env.DB, azi, ora)
      return { acum: { data: azi, ora }, slujba: r ? slujbaDin(r) : null }
    },
  }),

  // ------------------------------------------------------------ o zi, o săptămână
  actiune({
    nume: 'program.slujbele_zilei',
    descriere: 'Slujbele dintr-o zi anume, cu ora, numele slujbei și locul. Pentru „ce slujbă e azi/mâine".',
    efect: 'citeste',
    intrare: z.object({ zi: ZiCeruta }),
    iesire: z.object({ data: z.string(), stare: z.string().nullable(), slujbe: z.array(Slujba) }),
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
      '(propunere sau validat). „azi" = săptămâna curentă, „viitoare" = cea de după.',
    efect: 'citeste',
    intrare: z.object({ saptamana: SaptamanaCeruta }),
    iesire: Saptamana,
    exemple: ['cum arată programul săptămânii viitoare?', 'ce se slujește săptămâna asta?'],
    async executa({ saptamana: cerut }, c) {
      return saptamanaCeruta(c.env, cerut)
    },
  }),

  actiune({
    nume: 'program.text_saptamanii',
    descriere:
      'Programul săptămânii ca text simplu, gata de citit la radio sau de lipit într-un mesaj: ' +
      'zilele, orele, numele slujbelor și rândurile lor de detalii.',
    efect: 'citeste',
    intrare: z.object({ saptamana: SaptamanaCeruta }),
    iesire: z.object({ de_la: z.string(), pana_la: z.string(), text: z.string() }),
    exemple: ['dă-mi programul săptămânii ca text', 'scrie-mi programul pentru grup'],
    async executa({ saptamana: cerut }, c) {
      const s = await saptamanaCeruta(c.env, cerut)
      return { de_la: s.de_la, pana_la: s.pana_la, text: textSaptamanii(s) }
    },
  }),

  // ------------------------------------------------------------ istoricul
  actiune({
    nume: 'program.cauta_slujba',
    descriere:
      'Când se face o slujbă anume, după numele ei („Sfântul Maslu", „Acatist"): următoarea ' +
      'programată, ultimele dăți când s-a făcut și obiceiul (ziua și ora la care se face de regulă).',
    efect: 'citeste',
    intrare: z.object({
      nume: z.string().min(3).describe('numele slujbei, cum îl spune omul'),
      cate: z.number().int().min(1).max(30).default(8).describe('câte apariții trecute'),
    }),
    iesire: z.object({
      gasite: z.array(
        z.object({
          slujba: z.object({ cod_nume: z.string(), nume: z.string() }),
          urmatoarea: Slujba.nullable(),
          trecute: z.array(Slujba),
          obicei: z.any().nullable(),
        }),
      ),
    }),
    exemple: ['când e Sfântul Maslu?', 'când s-a făcut ultima dată Acatistul?', 'la ce oră e de obicei Vecernia?'],
    async executa({ nume, cate }, c) {
      const azi = aziBucuresti()
      const potriviri = cautaInVocabular(await vocabularul(c.env.DB), nume).slice(0, 3)
      if (!potriviri.length) throw new Error(`nu cunosc nicio slujbă numită „${nume}"`)
      const tipare = await tiparele(c.env.DB, azi)
      const gasite = await Promise.all(
        potriviri.map(async (v) => ({
          slujba: { cod_nume: v.cod_nume, nume: v.nume },
          urmatoarea: await urmatoareaDupaNume(c.env.DB, v.cod_nume, azi).then((r) => (r ? slujbaDin(r) : null)),
          trecute: (await slujbeTrecuteDupaNume(c.env.DB, v.cod_nume, azi, cate)).map(slujbaDin),
          obicei: tipare.find((t) => t.cod_nume === v.cod_nume) ?? null,
        })),
      )
      return { gasite }
    },
  }),

  actiune({
    nume: 'program.paternuri',
    descriere:
      'Tiparele programului din ultimii doi ani: pentru fiecare slujbă, cât de des se face, în ce ' +
      'zile și la ce ore de obicei, ultima dată și următoarea programată. Cunoștință de fundal.',
    efect: 'citeste',
    fundal: true,
    intrare: z.object({}),
    iesire: z.object({ azi: z.string(), tipare: z.array(z.any()) }),
    async executa(_a, c) {
      const azi = aziBucuresti()
      return { azi, tipare: await tiparele(c.env.DB, azi) }
    },
  }),

  actiune({
    nume: 'program.arhiva',
    descriere:
      'Tot istoricul programului ca fișier JSON (toate săptămânile și slujbele din 2014 până azi), ' +
      'pentru analize sau alte aplicații. Mare — nu se citește într-un chat.',
    efect: 'citeste',
    intrare: z.object({}),
    iesire: Obiect,
    async executa(_a, c) {
      const a = await arhivaIntreaga(c.env.DB)
      const azi = aziBucuresti()
      return obiectDinText({
        media: c.env.MEDIA,
        text: JSON.stringify({ facuta: azi, numar_saptamani: a.saptamani.length, numar_slujbe: a.slujbe.length, ...a }),
        fel: 'json',
        cale: `program/arhiva/${azi}`,
        nume: `arhiva-program-${azi}`,
        titlu: `Arhiva programului — ${a.saptamani.length} săptămâni, până la ${azi}`,
      })
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
      'Foaia A4 a săptămânii — cea care se pune pe ușă — ca PDF sau JPG de tipar. Numai din ' +
      'săptămâni validate; pentru săptămâna nescrisă încă, cere „propunere".',
    efect: 'citeste',
    intrare: z.object({
      saptamana: SaptamanaCeruta,
      fel: z.enum(['foaie', 'propunere']).default('foaie'),
      format: z.enum(['pdf', 'jpg']).default('pdf'),
    }),
    iesire: Obiect,
    exemple: ['dă-mi foaia de pe ușă pentru săptămâna viitoare', 'vreau programul ca PDF de tipar'],
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
      'Poza brută a paginii săptămânii, așa cum se vede pe ecran, în două coloane (program și ' +
      'calendar) — bună de trimis pe WhatsApp. Cu `cu_calendar: false` iese doar programul.',
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
