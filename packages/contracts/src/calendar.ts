import { z } from 'zod'

/**
 * `zi_liturgica` — proprietatea unei zile, nu decizia noastra. Produsa NUMAI de aplicatia
 * `calendar`; toti ceilalti o primesc si o afiseaza, nimeni n-o recalculeaza.
 *
 * Forma e cea din CONTRACTE.md al platformei (6 sept. 2026): numele campurilor in romana,
 * fara diacritice, cu underscore. Listele inchise nu se largesc de pe canalul unei aplicatii.
 */

export const DataCalendaristica = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data se scrie YYYY-MM-DD')

/**
 * `cruce_nedeclarata` (decizie user, 9 sept. 2026): sfantul are cruce, dar sursa n-a spus
 * culoarea ei (la duminici calendarul oficial scrie doar „Duminica"). Nu se ghiceste.
 */
export const RANGURI = [
  'praznic_imparatesc',
  'cruce_rosie',
  'cruce_albastra',
  'cruce_neagra',
  'cruce_nedeclarata',
  'simplu',
] as const
export const Rang = z.enum(RANGURI)
export type Rang = z.infer<typeof Rang>

/** Semnul din calendarul tiparit: `(†)` praznic, `†)` polieleu, `†` cruce; treapta slujbei, nu culoarea. */
export const Semn = z.enum(['(†)', '†)', '†']).nullable()
export type Semn = z.infer<typeof Semn>

export const PERIOADE = [
  'triod',
  'postul_mare',
  'saptamana_patimilor',
  'saptamana_luminata',
  'penticostar',
  'postul_sfintilor_apostoli',
  'postul_adormirii',
  'postul_nasterii',
  'peste_an',
] as const
export const Perioada = z.enum(PERIOADE)
export type Perioada = z.infer<typeof Perioada>

export const DEZLEGARI = [
  'niciuna',
  'ajunare',
  'dezlegare_untdelemn_vin',
  'dezlegare_peste',
  'dezlegare_branza_lapte_oua_peste',
  'harti',
] as const
export const Dezlegare = z.enum(DEZLEGARI)
export type Dezlegare = z.infer<typeof Dezlegare>

export const ZILE_SAPTAMANII = ['duminica', 'luni', 'marti', 'miercuri', 'joi', 'vineri', 'sambata'] as const
export const ZiSaptamana = z.enum(ZILE_SAPTAMANII)
export type ZiSaptamana = z.infer<typeof ZiSaptamana>

export const SfantAlZilei = z.object({
  nume: z.string().min(1),
  rang: Rang,
  semn: Semn,
})
export type SfantAlZilei = z.infer<typeof SfantAlZilei>

export const SursaZi = z.object({
  fel: z.enum(['patriarhia', 'calculat']),
  id: z.number().int().nullable().optional(),
  link: z.string().nullable().optional(),
  preluat_la: z.string().nullable().optional(),
  /** Pe zilele calculate: cum s-a socotit (de unde vin sfintii, ce a dat Pascalia). */
  nota: z.string().optional(),
})

export const ZiLiturgica = z.object({
  data: DataCalendaristica,
  zi_saptamana: ZiSaptamana,
  /** Numele duminicii sau al zilei mari; `null` in celelalte zile. */
  denumire: z.string().nullable(),
  sfinti: z.array(SfantAlZilei),
  rang: Rang,
  semn: Semn,
  perioada: Perioada,
  glas: z.number().int().min(1).max(8).nullable(),
  evanghelia_invierii: z.number().int().min(1).max(11).nullable(),
  post: z.object({ este: z.boolean(), dezlegare: Dezlegare }),
  canonic: z.object({
    nunti: z.boolean().nullable(),
    parastase: z.boolean().nullable(),
    aliturgica: z.boolean(),
  }),
  pericope: z.object({
    apostol: z.string().nullable(),
    evanghelie: z.string().nullable(),
  }),
  local: z.array(SfantAlZilei),
  zi_libera: z.boolean(),
  note: z.array(z.string()),
  /** Titlul intreg al calendarului oficial — ADEVARUL; restul e desfacerea lui. */
  titlu: z.string(),
  titlu_html: z.string(),
  versiune_calendar: z.string(),
  sursa: SursaZi,
})
export type ZiLiturgica = z.infer<typeof ZiLiturgica>

/** Raspunsul lui `GET /v1/interval`. */
export const IntervalLiturgic = z.object({
  de_la: DataCalendaristica,
  pana_la: DataCalendaristica,
  versiune_calendar: z.string(),
  zile: z.array(ZiLiturgica),
})
export type IntervalLiturgic = z.infer<typeof IntervalLiturgic>

/** Reperele mobile ale unui an, din Pascalie. */
export const RepereAn = z.object({
  an: z.number().int(),
  pasti: DataCalendaristica,
  repere: z.record(z.string(), DataCalendaristica),
  posturi: z.array(
    z.object({
      cod: Perioada,
      nume: z.string(),
      de_la: DataCalendaristica,
      pana_la: DataCalendaristica,
    }),
  ),
})
export type RepereAn = z.infer<typeof RepereAn>

/** Textele lungi ale zilei — HTML curatat; se cer separat, nu vin cu ziua. */
export const TexteZi = z.object({
  data: DataCalendaristica,
  sinaxar: z.string().nullable(),
  apostol: z.string().nullable(),
  evanghelie: z.string().nullable(),
})
export type TexteZi = z.infer<typeof TexteZi>

export const CODURI_EROARE_CALENDAR = [
  'data_invalida',
  'zi_inexistenta',
  'interval_invalid',
  'interval_prea_mare',
  'an_neacoperit',
  'cautare_scurta',
  'adresa_inexistenta',
] as const
