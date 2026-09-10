import { acum, ruleaza, unul } from '@xc/db'

/**
 * Limitare pe fereastra glisanta, tinuta in D1. Doua chei independente: emailul incercat si
 * adresa IP — ca nici un atacator cu multe IP-uri sa nu macine un singur cont, nici un IP
 * sa nu macine multe conturi.
 */

export interface Limita {
  incercari: number
  ferestraSec: number
}

export const LIMITA_LOGIN_EMAIL: Limita = { incercari: 8, ferestraSec: 15 * 60 }
export const LIMITA_LOGIN_IP: Limita = { incercari: 30, ferestraSec: 15 * 60 }

export async function inregistreazaIncercare(
  db: D1Database,
  cheie: string,
  fel: string,
): Promise<void> {
  await ruleaza(
    db,
    `INSERT INTO login_attempts (cheie, fel, created_at) VALUES (?, ?, ?)`,
    [cheie, fel, acum()],
  )
}

export async function eBlocat(
  db: D1Database,
  cheie: string,
  fel: string,
  limita: Limita,
): Promise<boolean> {
  const deLa = new Date(Date.now() - limita.ferestraSec * 1000).toISOString()
  const rand = await unul<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM login_attempts WHERE cheie = ? AND fel = ? AND created_at > ?`,
    [cheie, fel, deLa],
  )
  return (rand?.n ?? 0) >= limita.incercari
}

/** Dupa o autentificare reusita, contorul cheii respective se sterge. */
export async function resetIncercari(db: D1Database, cheie: string, fel: string): Promise<void> {
  await ruleaza(db, `DELETE FROM login_attempts WHERE cheie = ? AND fel = ?`, [cheie, fel])
}

export async function curataIncercariVechi(db: D1Database): Promise<void> {
  const deLa = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await ruleaza(db, `DELETE FROM login_attempts WHERE created_at < ?`, [deLa])
}

export function ipCerere(req: Request): string {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? 'necunoscut'
}
