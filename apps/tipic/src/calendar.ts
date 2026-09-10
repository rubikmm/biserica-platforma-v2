/**
 * Ce cere tipicul de la calendar (A1): ziua liturgica — titlul, sfintii, pericopele, glasul —
 * si TEXTUL pericopelor. Nu se tine nimic din astea aici.
 *
 * Textul vine tot de la calendar, nu direct de la Biblia: calendarul e singurul care vorbeste cu
 * ea (`/v1/pericopa?ref=`), altfel legatura s-ar face din doua locuri. Tot de acolo vine si
 * voscreasna, dupa numar — lista celor 11 Evanghelii ale Invierii sta la calendar.
 */
import type { ZiLiturgica } from '@xc/contracts'

export interface Verset {
  numar: number
  text: string
  capitol?: number
}
export interface BucataPericopa {
  referinta: string
  versete: Verset[] | null
}
export interface Pericopa {
  referinta: string
  bucati: BucataPericopa[]
}

/** Ziua liturgica; `null` daca ea nu e in intervalul calendarului sau daca el tace. */
export async function ziuaCalendarului(calendar: Fetcher, data: string): Promise<ZiLiturgica | null> {
  try {
    const r = await calendar.fetch(`https://calendar.intern/v1/zi/${data}`)
    if (!r.ok) return null
    return (await r.json()) as ZiLiturgica
  } catch {
    return null
  }
}

async function cerePericopa(calendar: Fetcher, cautare: string): Promise<Pericopa | null> {
  try {
    const r = await calendar.fetch(`https://calendar.intern/v1/pericopa?${cautare}`)
    if (!r.ok) return null
    return (await r.json()) as Pericopa
  } catch {
    return null
  }
}

export function textulPericopei(calendar: Fetcher, ref: string): Promise<Pericopa | null> {
  return cerePericopa(calendar, `ref=${encodeURIComponent(ref)}`)
}

export function textulVoscresnei(calendar: Fetcher, nr: number): Promise<Pericopa | null> {
  return cerePericopa(calendar, `voscreasna=${nr}`)
}
