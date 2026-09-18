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

/**
 * SARBATOARE = rangul zilei e praznic imparatesc sau cruce rosie. Regula sta AICI, nu in pagini,
 * fiindca e o regula despre datele calendarului: o citesc si titlul zilei (`culoareRang`), si
 * grila lunii din antet, si amandoua trebuie sa spuna acelasi lucru.
 */
export function eRangRosu(rang: string): boolean {
  return rang === 'praznic_imparatesc' || rang === 'cruce_rosie'
}

/** Ultima zi a lunii `AAAA-LL`, fara biblioteci: ziua 0 a lunii urmatoare. */
export function ultimaZiALunii(luna: string): string {
  const an = Number(luna.slice(0, 4))
  const l = Number(luna.slice(5, 7))
  const zile = new Date(Date.UTC(an, l, 0)).getUTCDate()
  return `${luna}-${String(zile).padStart(2, '0')}`
}

/**
 * ZILELE ROSII ALE UNEI LUNI — praznicele si crucile rosii, pentru grila din antet.
 *
 * ⚠️ O SINGURA intrebare pe luna (`/v1/interval`), nu una pe zi: raspunsul aduce zilele intregi si
 * din ele luam numai `rang`. Nu se tine nimic pe partea noastra — sarbatorile sunt ale calendarului,
 * iar o copie a lor s-ar invechi in tacere la fiecare indreptare facuta acolo.
 *
 * Daca ziua nu e in intervalul acoperit de calendar (ori el tace), lista iese goala: grila se
 * deseneaza oricum, cu duminicile rosii — acelea se stiu din data, nu de la nimeni.
 */
export async function sarbatorileLunii(calendar: Fetcher, luna: string): Promise<string[]> {
  try {
    const r = await calendar.fetch(
      `https://calendar.intern/v1/interval?de_la=${luna}-01&pana_la=${ultimaZiALunii(luna)}`,
    )
    if (!r.ok) return []
    const raspuns = (await r.json()) as { zile?: Array<{ data: string; rang: string }> }
    return (raspuns.zile ?? []).filter((z) => eRangRosu(z.rang)).map((z) => z.data)
  } catch {
    return []
  }
}
