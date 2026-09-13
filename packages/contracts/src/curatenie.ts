import { z } from 'zod'
import { DataCalendaristica } from './calendar.js'

/**
 * Curatenia bisericii — programarea voluntarilor. Aplicatia nu ofera nimic platformei prin
 * `/v1` (nu sunt date publice), dar formele ei sunt validate cu aceleasi unelte ca restul.
 *
 * Un „slot" e o pozitie de voluntar la o duminica (1..N; primele patru sunt cele de baza). Un
 * voluntar poate ocupa o singura pozitie pe duminica; mutarea pe alta pozitie libera e permisa;
 * eliberarea „impinge" pozitiile de dupa el ca sa nu ramana goluri (regula „trenulet" din V1).
 *
 * ⚠️ **Voluntarul tine nume, e-mail si telefon — si asa a ramas si in V2, cerut anume de utilizator
 * (13.09.2026)**: omul isi alege numele din lista, fara cont („modul simplu" din V1). E singura
 * aplicatie V2 care pastreaza date personale, si e o abatere STIUTA de la „datele stau intr-un loc,
 * autentificarea la fel". Cine intra totusi cu contul platformei se leaga de rand prin `userId`.
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

/**
 * Cheile de setari, cu intelesul lor. Se tin in tabela `app_settings` — numele din V1, pastrat la
 * portare (13.09.2026) impreuna cu restul schemei, ca interogarile sa ramana cele probate acolo.
 *
 * ⚠️ Doua lucruri pe care schita de la inceput le nimerise altfel:
 *  - **cate pozitii are o duminica NU e o setare**: e `MIN_VOLUNTARI` din codul aplicatiei (patru),
 *    ca in V1. Nimeni n-a cerut vreodata s-o schimbe din panou;
 *  - **ziua raportului lunar nu se alege**: e LUNEA saptamanii care contine 1 ale lunii tinta, ca sa
 *    nu cada peste raportul de sambata. Din panou se alege doar ora.
 */
export const CHEI_SETARI_CURATENIE = {
  newsletter_weekday: 'ziua saptamanii (0=duminica) in care pleaca raportul saptamanal',
  newsletter_hour: 'ora (Bucuresti) la care pleaca raportul saptamanal',
  newsletter_last_sent_at: 'cand a plecat ultima data raportul saptamanal (ora locala)',
  newsletter_monthly_hour: 'ora (Bucuresti) la care pleaca raportul lunar',
  newsletter_monthly_last_sent_at: 'cand a plecat ultima data raportul lunar',
  newsletter_monthly_last_sent_for_ym: 'pentru ce luna a plecat ultimul raport lunar (AAAA-LL)',
  newsletter_alert_weekday: 'ziua saptamanii in care se cauta alerta „duminica nu e completa"',
  newsletter_alert_hour: 'ora (Bucuresti) la care se cauta alerta',
  newsletter_alert_last_sent_for_sunday: 'pentru ce duminica a plecat ultima alerta',
  newsletter_cron_last_check: 'ultima bataie a ceasului (ora locala) — beculetul din panou',
} as const
