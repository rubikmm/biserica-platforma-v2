/**
 * Textul pericopelor vine din Biblia platformei (A10), la afisare — calendarul o cere, n-o copiaza
 * (decizie user, 1 sept. 2026). Aici e doar canonizarea referintei si cererea.
 *
 * A10 raspunde la `GET /v1/pasaj?ref=<referinta>` cu
 * `{ referinta, carte, slug, capitol, versete: [{ numar, text, capitol }], sursa }`.
 */
import { canonizeazaReferinta } from './titluri.js'

export interface Verset {
  numar: number
  text: string
  capitol?: number
}

export interface BucataPericopa {
  referinta: string
  adresa: string
  versete: Verset[] | null
  nota?: string
}

export interface PericopaCuText {
  referinta: string
  bucati: BucataPericopa[]
}

/** Ce intelege A10: fara prefix, fara cifre romane, „Fapte" -> „Faptele Apostolilor", „Iacov" -> „Iacob". */
export function pentruBiblia(ref: string): string {
  return canonizeazaReferinta(ref)
    .replace(/^Fapte(le)?( Sfinților)?( Apostolilor)?\b/, 'Faptele Apostolilor')
    .replace(/^Iacov\b/, 'Iacob')
}

/**
 * „Luca 10, 38-42; 11, 27-28" -> doua bucati, fiecare cu cartea si capitolul ei.
 * „Matei 10, 32-33; 37-38 și 19, 27-30" -> trei. „Marcu 2, 23-3, 5" ramane intreaga (trecerea
 * intre capitole o desface A10).
 */
export function bucatile(ref: string): string[] {
  const s = pentruBiblia(ref)
  const parti = s.split(/;\s*|\s+și\s+/).map((p) => p.trim()).filter(Boolean)
  const iesire: string[] = []
  let carte = ''
  let capitol = ''
  for (const p of parti) {
    const m = /^([1-3]?\s?[A-ZȘȚĂÂÎ][^\d,]*?)\s+(\d+)\s*,\s*(.+)$/.exec(p)
    if (m) {
      carte = m[1]!.trim()
      capitol = m[2]!
      iesire.push(`${carte} ${capitol}, ${m[3]!.trim()}`)
      continue
    }
    const mc = /^(\d+)\s*,\s*(.+)$/.exec(p)
    if (mc && carte) {
      capitol = mc[1]!
      iesire.push(`${carte} ${capitol}, ${mc[2]!.trim()}`)
      continue
    }
    if (/^[\d\s-]+$/.test(p) && carte && capitol) {
      iesire.push(`${carte} ${capitol}, ${p}`)
      continue
    }
    iesire.push(p)
  }
  return iesire
}

interface RaspunsPasaj {
  referinta?: string
  slug?: string
  capitol?: number
  versete?: Array<{ numar: number; text: string; capitol?: number }>
}

export async function textulPericopei(urlBiblia: string, ref: string): Promise<PericopaCuText> {
  const bucati = bucatile(ref)
  const rezultate = await Promise.all(
    bucati.map(async (b): Promise<BucataPericopa> => {
      const adresa = `${urlBiblia}/v1/pasaj?ref=${encodeURIComponent(b)}`
      try {
        const r = await fetch(adresa, {
          headers: { accept: 'application/json' },
          cf: { cacheTtl: 86400, cacheEverything: true },
        } as RequestInit)
        if (!r.ok) return { referinta: b, adresa, versete: null, nota: `Biblia a răspuns ${r.status}` }
        const j = (await r.json()) as RaspunsPasaj
        const versete = (j.versete ?? []).map((v) => ({ numar: v.numar, text: v.text, capitol: v.capitol }))
        const primul = versete[0]
        const adresaOm = j.slug && j.capitol ? `${urlBiblia}/carte/${j.slug}/${j.capitol}${primul ? `#v${primul.numar}` : ''}` : adresa
        return { referinta: b, adresa: adresaOm, versete: versete.length ? versete : null, ...(versete.length ? {} : { nota: 'fără text' }) }
      } catch (e) {
        return { referinta: b, adresa, versete: null, nota: e instanceof Error ? e.message : 'Biblia nu răspunde' }
      }
    }),
  )
  return { referinta: canonizeazaReferinta(ref), bucati: rezultate }
}

/** Cele 11 Evanghelii ale Invierii (voscresnele), citite la Utrenia duminicii. */
export const VOSCRESNE: Record<number, string> = {
  1: 'Matei 28, 16-20',
  2: 'Marcu 16, 1-8',
  3: 'Marcu 16, 9-20',
  4: 'Luca 24, 1-12',
  5: 'Luca 24, 12-35',
  6: 'Luca 24, 36-53',
  7: 'Ioan 20, 1-10',
  8: 'Ioan 20, 11-18',
  9: 'Ioan 20, 19-31',
  10: 'Ioan 21, 1-14',
  11: 'Ioan 21, 15-25',
}
