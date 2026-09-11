/**
 * Ce cere programul de la tipic (A9): pomenirile zilei din sinaxarul MINEIULUI, pentru foaia
 * „Sfinții zilei". Nu se tine nimic din ele aici — cartea e a tipicului.
 *
 * De ce doua liste pe aceeasi foaie: calendarul oficial si Mineiul nu spun acelasi lucru.
 * Mineiul trece toata ceata zilei, deci da cu cinci pana la zece nume mai mult (masurat pe patru
 * duminici, 10.09.2026); in schimb n-are sfintii romani canonizati dupa editie — Ioan de la
 * Prislop, Antim Ivireanul, Dumitru Staniloae sunt numai in calendar. Nu se contopesc si nu se
 * aleg una in locul alteia: se scriu GRUPATE DUPA SURSA, cu cartea langa ele (cerere user).
 */

export interface PomenireMinei {
  nume: string
  pomenire: string
  stih: string[]
  viata: string
}

export interface SfintiiDinMinei {
  titlu: string
  pomeniri: PomenireMinei[]
  /** Numele cartii, gata de scris pe foaie: volumul, editia si creditul culegatorului. */
  carte: string
}

interface RaspunsSfinti {
  titlu?: string
  pomeniri?: PomenireMinei[]
  carte?: { sursa?: string; editura?: string; credit?: string } | null
}

/** Volumul si anul editiei, apoi creditul — conditia sursei la lunile luate de pe sit. */
function numeleCartii(c: RaspunsSfinti['carte']): string {
  if (!c?.sursa) return ''
  const an = c.editura?.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? ''
  const cap = an && !c.sursa.includes(an) ? `${c.sursa}, ${an}` : c.sursa
  return c.credit ? `${cap} · ${c.credit}` : cap
}

/**
 * Pomenirile zilei din Minei; `null` daca tipicul tace sau nu are ziua. Foaia merge si fara ele —
 * atunci ramane doar lista calendarului, fara capul de grup.
 */
export async function sfintiiDinMinei(tipic: Fetcher, data: string): Promise<SfintiiDinMinei | null> {
  try {
    const r = await tipic.fetch(`https://tipic.intern/v1/sfinti/${data}`)
    if (!r.ok) return null
    const j = (await r.json()) as RaspunsSfinti
    const pomeniri = j.pomeniri ?? []
    if (!pomeniri.length) return null
    return { titlu: j.titlu ?? '', pomeniri, carte: numeleCartii(j.carte) }
  } catch {
    return null
  }
}
