import { z } from 'zod'
import { DataCalendaristica } from './calendar.js'

/**
 * `slujba` si `saptamana` — decizia parohiei, nu proprietatea zilei. Produse NUMAI de
 * aplicatia `program`. Forma e cea din CONTRACTE.md; `cod_nume` vine din vocabularul inchis
 * si nu e niciodata null; `id`-ul unei slujbe e stabil (de el atarna slotul de curatenie).
 */

export const Ora = z.string().regex(/^\d{2}:\d{2}$/, 'ora se scrie HH:MM')

export const CATEGORII_SLUJBA = ['dimineata', 'seara', 'alte'] as const
export const CategorieSlujba = z.enum(CATEGORII_SLUJBA)
export type CategorieSlujba = z.infer<typeof CategorieSlujba>

export const IntrareVocabular = z.object({
  cod_nume: z.string().regex(/^[a-z][a-z0-9_]*$/),
  nume: z.string().min(1),
  categorie: CategorieSlujba,
  ordine: z.number().int(),
  activ: z.boolean(),
})
export type IntrareVocabular = z.infer<typeof IntrareVocabular>

export const STARI_SAPTAMANA = ['propus', 'validat', 'modificat_dupa_validare'] as const
export const StareSaptamana = z.enum(STARI_SAPTAMANA)
export type StareSaptamana = z.infer<typeof StareSaptamana>

export const LOCURI_CUNOSCUTE = ['biserica', 'capela', 'cimitir', 'afara'] as const

export const Slujba = z.object({
  id: z.string().min(1),
  data: DataCalendaristica,
  ora: Ora,
  nume: z.string().min(1),
  cod_nume: z.string().min(1),
  slujitor: z.string().nullable(),
  loc: z.string().min(1),
  observatii: z.string().nullable(),
  /** Randurile „→ …" de sub slujba, cum se scriu pe foaie. Aditiv fata de contract. */
  detalii: z.array(z.string()),
  curatenie: z.boolean(),
  transmisie: z.boolean(),
})
export type Slujba = z.infer<typeof Slujba>

export const Saptamana = z.object({
  de_la: DataCalendaristica,
  pana_la: DataCalendaristica,
  stare: StareSaptamana,
  titlu: z.string(),
  validat_de: z.string().nullable(),
  validat_la: z.string().nullable(),
  versiune_calendar: z.string().nullable(),
  sursa: z.string(),
  sursa_link: z.string().nullable(),
  slujbe: z.array(Slujba),
})
export type Saptamana = z.infer<typeof Saptamana>

// ---------------------------------------------------------------------------
// Scrierea — interna aplicatiei, dar validata cu aceleasi forme
// ---------------------------------------------------------------------------

export const SlujbaDeScris = z.object({
  data: DataCalendaristica,
  ora: Ora,
  cod_nume: z.string().min(1),
  /** Gol = numele din vocabular. */
  nume: z.string().trim().max(200).optional(),
  slujitor: z.string().trim().max(120).optional(),
  loc: z.string().trim().min(1).max(60).default('biserica'),
  detalii: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
  observatii: z.string().trim().max(1000).optional(),
  curatenie: z.boolean().default(true),
  transmisie: z.boolean().default(true),
})
export type SlujbaDeScris = z.infer<typeof SlujbaDeScris>

export const SaptamanaDeScris = z.object({
  luni: DataCalendaristica,
  slujbe: z.array(SlujbaDeScris).max(60),
})
export type SaptamanaDeScris = z.infer<typeof SaptamanaDeScris>

export const CODURI_EROARE_PROGRAM = [
  'data_lipsa',
  'data_invalida',
  'an_invalid',
  'interval_invers',
  'interval_prea_lung',
  'saptamana_inexistenta',
  'saptamana_nevalidata',
  'zi_inexistenta',
  'calendar_indisponibil',
  'pdf_indisponibil',
  'adresa_inexistenta',
  'metoda_nepermisa',
] as const
