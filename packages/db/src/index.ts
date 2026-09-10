/**
 * Helpere subtiri peste D1. Deliberat fara ORM: interogarile raman SQL vizibil, iar tiparea
 * se face la marginea fiecarui repository, cu Zod.
 */

export type Legaturi = ReadonlyArray<string | number | null>

export async function unul<T>(
  db: D1Database,
  sql: string,
  legaturi: Legaturi = [],
): Promise<T | null> {
  const rand = await db
    .prepare(sql)
    .bind(...legaturi)
    .first<T>()
  return rand ?? null
}

export async function toate<T>(
  db: D1Database,
  sql: string,
  legaturi: Legaturi = [],
): Promise<T[]> {
  const rezultat = await db
    .prepare(sql)
    .bind(...legaturi)
    .all<T>()
  return rezultat.results ?? []
}

export async function ruleaza(
  db: D1Database,
  sql: string,
  legaturi: Legaturi = [],
): Promise<D1Result> {
  return db
    .prepare(sql)
    .bind(...legaturi)
    .run()
}

/**
 * Scriere atomica: D1 `batch` ruleaza tot intr-o singura tranzactie implicita.
 * Aici se pune perechea „mutatia de domeniu + randul de outbox", ca sa nu poata exista una fara alta.
 */
export async function batch(db: D1Database, declaratii: D1PreparedStatement[]): Promise<void> {
  if (declaratii.length === 0) return
  await db.batch(declaratii)
}

export function acum(): string {
  return new Date().toISOString()
}

export function id(): string {
  return crypto.randomUUID()
}

/** Erorile de unicitate din SQLite au un mesaj recunoscibil; le traducem in ceva verificabil. */
export function eIncalcareUnicitate(e: unknown): boolean {
  const mesaj = e instanceof Error ? e.message : String(e)
  return mesaj.includes('UNIQUE constraint failed')
}
