import { z } from 'zod'
import { DataCalendaristica } from './calendar.js'

/**
 * Curatenia bisericii — programarea voluntarilor. Aplicatia nu ofera nimic platformei prin
 * `/v1` (nu sunt date publice), dar formele ei sunt validate cu aceleasi unelte ca restul.
 *
 * Un „slot" e o pozitie de voluntar la o duminica (1..N, N din setari). Un voluntar poate
 * ocupa o singura pozitie pe duminica; mutarea pe alta pozitie libera e permisa; eliberarea
 * „impinge" pozitiile de dupa el ca sa nu ramana goluri (regula „trenulet" din V1).
 */

export const Voluntar = z.object({
  id: z.number().int().positive(),
  prenume: z.string().trim().min(1).max(80),
  nume: z.string().trim().min(1).max(80),
  /** Identificator scurt, stabil, pentru linkuri si cookie: „mihai.p". */
  slug: z.string().regex(/^[a-z0-9.-]+$/),
  email: z.string().trim().toLowerCase().nullable(),
  telefon: z.string().trim().nullable(),
  activ: z.boolean(),
  /** Apare in lista de alegere si poate ocupa sloturi. */
  voluntar: z.boolean(),
  /** Primeste rapoartele (newsletterul saptamanal / lunar / alertele) fara sa fie voluntar. */
  monitor: z.boolean(),
  /** Contul V2 legat, cand omul a intrat o data cu contul platformei. */
  userId: z.string().nullable(),
  creatLa: z.string(),
})
export type Voluntar = z.infer<typeof Voluntar>

export const VoluntarDeScris = z.object({
  prenume: z.string().trim().min(1).max(80),
  nume: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().or(z.literal('')).optional(),
  telefon: z.string().trim().max(30).optional(),
  activ: z.boolean().default(true),
  voluntar: z.boolean().default(true),
  monitor: z.boolean().default(false),
})
export type VoluntarDeScris = z.infer<typeof VoluntarDeScris>

export const Programare = z.object({
  data: DataCalendaristica,
  pozitie: z.number().int().positive(),
  voluntarId: z.number().int().positive(),
  creatLa: z.string(),
})
export type Programare = z.infer<typeof Programare>

/** Actiunile din pagina de programare — aceleasi nume ca in V1, ca sa fie usor de urmarit. */
export const ACTIUNI_SLOT = ['toggle_slot', 'toggle_vacation_month', 'participation_payload'] as const

export const CerereSlot = z.object({
  data: DataCalendaristica,
  pozitie: z.number().int().positive(),
  /** Pentru admin: pe cine pune / scoate. Voluntarul de rand actioneaza doar pe el insusi. */
  voluntarId: z.number().int().positive().optional(),
})
export type CerereSlot = z.infer<typeof CerereSlot>

export const FELURI_NEWSLETTER = ['weekly', 'monthly', 'alert', 'system'] as const
export const FelNewsletter = z.enum(FELURI_NEWSLETTER)
export type FelNewsletter = z.infer<typeof FelNewsletter>

/** Cheile de setari ale aplicatiei, cu intelesul lor. Se tin in tabela `setari`. */
export const CHEI_SETARI_CURATENIE = {
  sloturi_pe_duminica: 'cate pozitii de voluntar are o duminica',
  newsletter_weekday: 'ziua saptamanii (0=duminica) in care pleaca raportul saptamanal',
  newsletter_hour: 'ora (Bucuresti) la care pleaca raportul saptamanal',
  monthly_day: 'ziua lunii in care pleaca raportul lunar',
  monthly_hour: 'ora (Bucuresti) la care pleaca raportul lunar',
  alert_weekday: 'ziua saptamanii in care pleaca alerta „duminica nu e completa"',
  alert_hour: 'ora (Bucuresti) la care pleaca alerta',
  cron_last_run: 'ultimul heartbeat al cronului (ISO)',
  luni_viitoare_vizibile: 'cate luni inainte se pot face programari',
} as const
