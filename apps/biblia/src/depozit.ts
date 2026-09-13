/**
 * Depozitul Bibliei: cele 80 de carti in JSON, una pe fisier, in R2 (`xc-biblia-staging`).
 * Datele stau in depozit, nu in cod — ca in V1, unde s-au si copiat de aici (bucket NOU, nimic
 * refolosit din V1).
 *
 * Cartile citite o data raman in memoria izolatului: cautarea in text le parcurge pe toate, si
 * a doua cautare din aceeasi instanta nu mai coboara in R2.
 */

/** „ac" = cartile anaginoscomena (bune de citit), tiparite in Biblia sinodala intre Testamente. */
export type Parte = 'vt' | 'ac' | 'nt'

export interface CarteIndex {
  nume: string
  slug: string
  parte: Parte
  capitole: number
  versete: number
}

export interface Index {
  sursa: string
  url: string
  carti: CarteIndex[]
}

/** O carte intreaga: capitolele in ordine, fiecare un obiect `{ "1": "text", … }`. */
export interface Carte {
  id: number
  nume: string
  parte: string
  sursa: string
  capitole: Record<string, string>[]
}

let indexul: Index | null = null
const cartile = new Map<string, Carte>()

export async function index(depozit: R2Bucket): Promise<Index> {
  if (indexul) return indexul
  const o = await depozit.get("index.json")
  if (!o) throw new Error("index.json lipseste din depozit")
  indexul = await o.json<Index>()
  return indexul
}

export async function carte(depozit: R2Bucket, slug: string): Promise<Carte | null> {
  const stiuta = cartile.get(slug)
  if (stiuta) return stiuta
  const o = await depozit.get(`carti/${slug}.json`)
  if (!o) return null
  const c = await o.json<Carte>()
  cartile.set(slug, c)
  return c
}
