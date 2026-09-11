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
import { actiune, registru, Obiect, type ContextActiune } from '@xc/actiuni'
import { Saptamana, Slujba, type IntrareVocabular, type SlujbaDeScris } from '@xc/contracts'
import { golesteOutbox } from '@xc/events'
import { adaugaZile, aziBucuresti, dataCeruta, dataCuZi, luneaSaptamanii, obiectDinHtml, obiectDinText, oraBucuresti } from '@xc/ui'
import {
  adaugaSlujba,
  arhivaIntreaga,
  cautaInVocabular,
  modificaSlujba,
  scrieSaptamana,
  stergeSlujba,
  valideazaSaptamana,
  type CineScrie,
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
  saptamanaOriPropunere,
  textSaptamanii,
  type EnvHartii,
} from './hartii.js'
import { titluSaptamanii } from './foaie.js'
import type { Ctx } from './pagini.js'

export interface EnvActiuniProgram extends EnvHartii {
  MEDIA: Fetcher
  /** Coada evenimentelor: scrierile pun in outbox si il golesc dupa commit. */
  EVENIMENTE: Queue
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
  .describe('ziua: AAAA-LL-ZZ, „azi", „maine", „viitoare" (peste o săptămână) sau numele zilei („luni", „marti" = următoarea zi cu numele ăsta)')

const SaptamanaCeruta = z
  .string()
  .default('azi')
  .describe('o zi din săptămână: AAAA-LL-ZZ, „azi" (săptămâna curentă) sau „viitoare"')

/** Săptămâna cerută, în forma contractului: cea scrisă, iar dacă nu e — propunerea ei, ca pe pagină. */
async function saptamanaCeruta(env: EnvActiuniProgram, cerut: string | undefined): Promise<Saptamana> {
  const luni = luneaSaptamanii(ziua(cerut))
  const s = await saptamanaOriPropunere(env, luni, await harta(env))
  if (s.rand) return saptamanaDin(s.rand, await slujbeleSaptamanii(env.DB, luni))
  return {
    de_la: luni,
    pana_la: adaugaZile(luni, 6),
    stare: 'propus',
    titlu: titluSaptamanii(luni),
    validat_de: null,
    validat_la: null,
    versiune_calendar: null,
    sursa: 'propunere',
    sursa_link: null,
    slujbe: s.slujbe,
  }
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

// ---------------------------------------------------------------------------
// Ajutoarele scrierii: cum se gaseste o slujba dupa vorbele omului, cine scrie
// ---------------------------------------------------------------------------

const OraOptionala = z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM').optional()

function cineScrie(c: ContextActiune<EnvActiuniProgram>): CineScrie {
  return { userId: c.actor.fel === 'utilizator' ? c.actor.principal.userId : null, correlationId: c.correlationId }
}

async function harta(env: EnvActiuniProgram): Promise<Map<string, IntrareVocabular>> {
  return new Map((await vocabularul(env.DB)).map((v) => [v.cod_nume, v]))
}

/** Numele din vocabular cel mai apropiat de ce a spus omul; arunca daca nu e niciunul. */
async function numeleDinVocabular(env: EnvActiuniProgram, text: string): Promise<IntrareVocabular> {
  const potriviri = cautaInVocabular(await vocabularul(env.DB), text)
  if (!potriviri.length) throw new Error(`nu cunosc nicio slujbă numită „${text}"`)
  return potriviri[0]!
}

/** Forma de scris a unei slujbe din contract — pentru asezarea propunerii in baza. */
function deScris(s: Slujba): SlujbaDeScris {
  return {
    data: s.data,
    ora: s.ora,
    cod_nume: s.cod_nume,
    nume: s.nume,
    ...(s.slujitor ? { slujitor: s.slujitor } : {}),
    loc: s.loc,
    detalii: s.detalii,
    ...(s.observatii ? { observatii: s.observatii } : {}),
    curatenie: s.curatenie,
    transmisie: s.transmisie,
  }
}

/**
 * Slujba pe care o are omul in minte: ziua + numele (+ ora, daca sunt doua la fel in zi).
 * Se cauta in ce se VEDE — saptamana scrisa, iar daca nu e, propunerea ei — ca sa se poata
 * schimba si ce nu e inca in baza. `scrisa` spune daca trebuie scrisa intai.
 */
async function gasesteSlujba(
  env: EnvActiuniProgram,
  zi: string | undefined,
  numeSpus: string | undefined,
  ora?: string,
): Promise<{ slujba: Slujba; scrisa: boolean; luni: string; toate: Slujba[] }> {
  const data = ziua(zi)
  const luni = luneaSaptamanii(data)
  const vocab = await vocabularul(env.DB)
  // Fara nume („slujba de luni") se iau toate slujbele zilei; ora sau unicitatea o aleg.
  const coduri = numeSpus ? new Set(cautaInVocabular(vocab, numeSpus).map((v) => v.cod_nume)) : null
  if (coduri && !coduri.size) throw new Error(`nu cunosc nicio slujbă numită „${numeSpus}"`)
  const s = await saptamanaOriPropunere(env, luni, new Map(vocab.map((v) => [v.cod_nume, v])))
  let candidate = s.slujbe.filter((x) => x.data === data && (!coduri || coduri.has(x.cod_nume)))
  if (ora) candidate = candidate.filter((x) => x.ora === ora)
  const ce = numeSpus ? `slujbă „${numeSpus}"` : 'slujbă'
  if (!candidate.length) throw new Error(`${dataCuZi(data)} nu are nicio ${ce}${ora ? ` la ${ora}` : ''}`)
  if (candidate.length > 1) {
    throw new Error(`${dataCuZi(data)} are ${candidate.length} slujbe (${candidate.map((x) => `${x.ora} ${x.nume}`).join('; ')}) — spune numele sau ora`)
  }
  return { slujba: candidate[0]!, scrisa: Boolean(s.rand), luni, toate: s.slujbe }
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
      // Ca pe pagina: saptamana scrisa, iar daca nu e — propunerea ei, cu starea „propunere".
      const data = ziua(zi)
      const s = await saptamanaOriPropunere(c.env, luneaSaptamanii(data), await harta(c.env))
      return { data, stare: s.rand?.stare ?? 'propunere', slujbe: s.slujbe.filter((x) => x.data === data) }
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

  // ------------------------------------------------------------ SCRIEREA
  //
  // Toate cer dreptul central (`program.write`, la validare `program.publish`), toate sunt
  // `efect: 'scrie'` — deci din chat devin propuneri cu „Da/Nu", iar `rezuma` spune omului
  // exact ce urmeaza, verificat, inainte sa apese. Nimic nu se schimba pana atunci.
  //
  // ⚠️ Saptamana viitoare NU e scrisa in baza (e propunere, socotita din zbor). Orice schimbare
  // in ea o SCRIE intai — asa cum era drumul din V1: propunere → scrisa → (modificata) → validata.
  // Rezumatul o spune, ca omul sa confirme stiind.

  actiune({
    nume: 'program.modifica_slujba',
    descriere:
      'Schimbă o slujbă din program: ora, locul, slujitorul, observațiile sau rândurile de ' +
      'detalii. Slujba se găsește după zi („luni") și, dacă ziua are mai multe, după nume sau ' +
      'ora de acum. Cheam-o direct, fără să întrebi: dacă e nevoie de mai mult, îți spune ea.',
    efect: 'scrie',
    permisiune: 'program.write',
    intrare: z.object({
      zi: ZiCeruta,
      slujba: z.string().min(3).optional().describe('numele slujbei („liturghie", „vecernia"); se poate lăsa gol dacă ziua are una singură sau se dă ora'),
      ora: OraOptionala.describe('ora ei de ACUM („începe la 8" → 08:00); alege slujba când sunt mai multe în zi'),
      schimbari: z.object({
        ora: OraOptionala.describe('ora NOUĂ, HH:MM'),
        loc: z.string().trim().min(1).max(60).optional(),
        slujitor: z.string().trim().max(120).nullable().optional(),
        observatii: z.string().trim().max(1000).nullable().optional(),
        detalii: z.array(z.string().trim().min(1).max(300)).max(12).optional().describe('rândurile „→" de sub slujbă, toate'),
        transmisie: z.boolean().optional(),
      }),
    }),
    iesire: Slujba,
    exemple: ['mută liturghia de luni la 7', 'schimbă ora vecerniei de sâmbătă la 17:00', 'slujba de marți e în capelă'],
    async rezuma({ zi, slujba, ora, schimbari }, c) {
      const g = await gasesteSlujba(c.env, zi, slujba, ora)
      const parti: string[] = []
      if (schimbari.ora) parti.push(`ora ${g.slujba.ora} → ${schimbari.ora}`)
      if (schimbari.loc) parti.push(`locul ${g.slujba.loc} → ${schimbari.loc}`)
      if (schimbari.slujitor !== undefined) parti.push(`slujitor: ${schimbari.slujitor ?? '—'}`)
      if (schimbari.observatii !== undefined) parti.push(`observații: ${schimbari.observatii ?? '—'}`)
      if (schimbari.detalii) parti.push(`detalii: ${schimbari.detalii.join(' / ') || '—'}`)
      if (schimbari.transmisie !== undefined) parti.push(schimbari.transmisie ? 'cu transmisie' : 'fără transmisie')
      if (!parti.length) throw new Error('nu s-a cerut nicio schimbare')
      return `Schimb „${g.slujba.nume}" de ${dataCuZi(g.slujba.data)}: ${parti.join(', ')}.${g.scrisa ? '' : ' Săptămâna nu e scrisă încă — o scriu întâi din propunere.'}`
    },
    async executa({ zi, slujba, ora, schimbari }, c) {
      const g = await gasesteSlujba(c.env, zi, slujba, ora)
      const cine = cineScrie(c)
      if (!g.scrisa) await scrieSaptamana(c.env.DB, g.luni, g.toate.map(deScris), cine)
      const r = await modificaSlujba(c.env.DB, g.slujba.id, schimbari, cine)
      c.ctxExec.waitUntil(golesteOutbox(c.env.DB, c.env.EVENIMENTE))
      return slujbaDin(r)
    },
  }),

  actiune({
    nume: 'program.adauga_slujba',
    descriere:
      'Adaugă o slujbă în program, într-o zi și la o oră, cu numele din vocabularul închis al ' +
      'slujbelor. Omul confirmă înainte.',
    efect: 'scrie',
    permisiune: 'program.write',
    intrare: z.object({
      zi: ZiCeruta,
      slujba: z.string().min(3).describe('numele slujbei („acatist", „sfântul maslu")'),
      ora: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM'),
      loc: z.string().trim().min(1).max(60).default('biserica'),
      detalii: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
      observatii: z.string().trim().max(1000).optional(),
    }),
    iesire: Slujba,
    exemple: ['pune un acatist joi la 18', 'adaugă Sfântul Maslu marți la 18:00'],
    async rezuma({ zi, slujba, ora, loc }, c) {
      const data = ziua(zi)
      const v = await numeleDinVocabular(c.env, slujba)
      const scrisa = Boolean(await saptamana(c.env.DB, luneaSaptamanii(data)))
      return `Adaug „${v.nume}" ${dataCuZi(data)}, la ${ora}${loc !== 'biserica' ? `, la ${loc}` : ''}.${scrisa ? '' : ' Săptămâna nu e scrisă încă — o scriu întâi din propunere.'}`
    },
    async executa({ zi, slujba, ora, loc, detalii, observatii }, c) {
      const data = ziua(zi)
      const v = await numeleDinVocabular(c.env, slujba)
      const cine = cineScrie(c)
      const luni = luneaSaptamanii(data)
      if (!(await saptamana(c.env.DB, luni))) {
        const s = await saptamanaOriPropunere(c.env, luni, await harta(c.env))
        await scrieSaptamana(c.env.DB, luni, s.slujbe.map(deScris), cine)
      }
      const r = await adaugaSlujba(c.env.DB, { data, ora, cod_nume: v.cod_nume, loc, detalii, observatii, curatenie: true, transmisie: true }, cine)
      c.ctxExec.waitUntil(golesteOutbox(c.env.DB, c.env.EVENIMENTE))
      return slujbaDin(r)
    },
  }),

  actiune({
    nume: 'program.sterge_slujba',
    descriere: 'Scoate o slujbă din program. Slujba se găsește după zi și nume. Omul confirmă înainte.',
    efect: 'scrie',
    permisiune: 'program.write',
    intrare: z.object({
      zi: ZiCeruta,
      slujba: z.string().min(3).optional().describe('numele slujbei; se poate lăsa gol dacă ziua are una singură sau se dă ora'),
      ora: OraOptionala.describe('ora ei; alege slujba când sunt mai multe în zi'),
    }),
    iesire: z.object({ sters: z.string() }),
    exemple: ['scoate vecernia de vineri', 'anulează acatistul de joi'],
    async rezuma({ zi, slujba, ora }, c) {
      const g = await gasesteSlujba(c.env, zi, slujba, ora)
      return `Scot „${g.slujba.nume}" de ${dataCuZi(g.slujba.data)}, ora ${g.slujba.ora}.${g.scrisa ? '' : ' Săptămâna nu e scrisă încă — o scriu întâi din propunere.'}`
    },
    async executa({ zi, slujba, ora }, c) {
      const g = await gasesteSlujba(c.env, zi, slujba, ora)
      const cine = cineScrie(c)
      if (!g.scrisa) await scrieSaptamana(c.env.DB, g.luni, g.toate.map(deScris), cine)
      await stergeSlujba(c.env.DB, g.slujba.id, cine)
      c.ctxExec.waitUntil(golesteOutbox(c.env.DB, c.env.EVENIMENTE))
      return { sters: g.slujba.id }
    },
  }),

  actiune({
    nume: 'program.scrie_propunerea',
    descriere:
      'Scrie în bază propunerea unei săptămâni (calculată din istoric și calendar), ca să poată fi ' +
      'apoi modificată și validată. Fără asta, săptămâna viitoare e doar o propunere din zbor.',
    efect: 'scrie',
    permisiune: 'program.write',
    intrare: z.object({ saptamana: SaptamanaCeruta }),
    iesire: Saptamana,
    exemple: ['scrie propunerea pentru săptămâna viitoare', 'salvează programul propus'],
    async rezuma({ saptamana: cerut }, c) {
      const luni = luneaSaptamanii(ziua(cerut))
      const s = await saptamanaOriPropunere(c.env, luni, await harta(c.env))
      if (s.rand) throw new Error(`săptămâna ${titluSaptamanii(luni)} e deja scrisă (${s.rand.stare})`)
      return `Scriu propunerea săptămânii ${titluSaptamanii(luni)}: ${s.slujbe.length} slujbe, ca „propus".`
    },
    async executa({ saptamana: cerut }, c) {
      const luni = luneaSaptamanii(ziua(cerut))
      const s = await saptamanaOriPropunere(c.env, luni, await harta(c.env))
      if (s.rand) throw new Error(`săptămâna ${titluSaptamanii(luni)} e deja scrisă (${s.rand.stare})`)
      const rand = await scrieSaptamana(c.env.DB, luni, s.slujbe.map(deScris), cineScrie(c))
      c.ctxExec.waitUntil(golesteOutbox(c.env.DB, c.env.EVENIMENTE))
      return saptamanaDin(rand, await slujbeleSaptamanii(c.env.DB, luni))
    },
  }),

  actiune({
    nume: 'program.valideaza_saptamana',
    descriere:
      'Validează o săptămână: din acel moment se tipărește foaia de pe ușă și pleacă anunțul. ' +
      'Dacă săptămâna nu e scrisă încă, se scrie întâi din propunere. Omul confirmă înainte.',
    efect: 'scrie',
    permisiune: 'program.publish',
    intrare: z.object({ saptamana: SaptamanaCeruta }),
    iesire: Saptamana,
    exemple: ['validează săptămâna viitoare', 'programul e bun, publică-l'],
    async rezuma({ saptamana: cerut }, c) {
      const luni = luneaSaptamanii(ziua(cerut))
      const s = await saptamanaOriPropunere(c.env, luni, await harta(c.env))
      if (s.rand?.stare === 'validat') throw new Error(`săptămâna ${titluSaptamanii(luni)} e deja validată`)
      return `Validez săptămâna ${titluSaptamanii(luni)} (${s.slujbe.length} slujbe).${s.rand ? '' : ' Nu e scrisă încă — o scriu întâi din propunere.'}`
    },
    async executa({ saptamana: cerut }, c) {
      const luni = luneaSaptamanii(ziua(cerut))
      const cine = cineScrie(c)
      const s = await saptamanaOriPropunere(c.env, luni, await harta(c.env))
      if (s.rand?.stare === 'validat') throw new Error(`săptămâna ${titluSaptamanii(luni)} e deja validată`)
      if (!s.rand) await scrieSaptamana(c.env.DB, luni, s.slujbe.map(deScris), cine)
      const rand = await valideazaSaptamana(c.env.DB, luni, cine, s.cal?.versiune ?? null)
      c.ctxExec.waitUntil(golesteOutbox(c.env.DB, c.env.EVENIMENTE))
      return saptamanaDin(rand, await slujbeleSaptamanii(c.env.DB, luni))
    },
  }),
])
