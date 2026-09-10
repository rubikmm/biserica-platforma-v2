import { acum, eIncalcareUnicitate, id, ruleaza, toate, unul } from '@xc/db'
import type { Utilizator } from '@xc/contracts'
import { aExpirat, hashJeton, jetonNou, peste } from './jetoane.js'

export interface RandUtilizator {
  id: string
  email: string
  display_name: string | null
  password_hash: string
  email_verified_at: string | null
  disabled_at: string | null
  created_at: string
}

export function catreUtilizator(rand: RandUtilizator): Utilizator {
  return {
    id: rand.id,
    email: rand.email,
    displayName: rand.display_name,
    emailVerifiedAt: rand.email_verified_at,
    disabledAt: rand.disabled_at,
    createdAt: rand.created_at,
  }
}

export async function utilizatorDupaEmail(
  db: D1Database,
  email: string,
): Promise<RandUtilizator | null> {
  return unul<RandUtilizator>(db, `SELECT * FROM users WHERE email = ?`, [email])
}

export async function utilizatorDupaId(
  db: D1Database,
  userId: string,
): Promise<RandUtilizator | null> {
  return unul<RandUtilizator>(db, `SELECT * FROM users WHERE id = ?`, [userId])
}

export async function numaraUtilizatori(db: D1Database): Promise<number> {
  const rand = await unul<{ n: number }>(db, `SELECT COUNT(*) AS n FROM users`)
  return rand?.n ?? 0
}

export type RezultatCreare =
  | { fel: 'creat'; utilizator: RandUtilizator }
  | { fel: 'exista' }

export async function creeazaUtilizator(
  db: D1Database,
  email: string,
  hashParola: string,
  displayName: string | null,
): Promise<RezultatCreare> {
  const userId = id()
  try {
    await ruleaza(
      db,
      `INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, email, displayName, hashParola, acum(), acum()],
    )
  } catch (e) {
    if (eIncalcareUnicitate(e)) return { fel: 'exista' }
    throw e
  }

  const creat = await utilizatorDupaId(db, userId)
  if (!creat) throw new Error('utilizatorul nu a putut fi recitit dupa creare')
  return { fel: 'creat', utilizator: creat }
}

// ---------------------------------------------------------------------------
// Jetoane cu un singur consum (challenge de login + verificare email)
// ---------------------------------------------------------------------------

type TabelaJeton = 'login_challenges' | 'email_verification_tokens'

export async function emiteJeton(
  db: D1Database,
  tabela: TabelaJeton,
  userId: string,
  durataSec: number,
): Promise<string> {
  const jeton = jetonNou()
  await ruleaza(
    db,
    `INSERT INTO ${tabela} (id, user_id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id(), userId, await hashJeton(jeton), acum(), peste(durataSec)],
  )
  return jeton
}

interface RandJeton {
  id: string
  user_id: string
  expires_at: string
  consumed_at: string | null
}

/**
 * Consuma un jeton daca e valid. Consumul e atomic: `UPDATE ... WHERE consumed_at IS NULL`,
 * deci doua apasari simultane pe acelasi link produc o singura sesiune.
 */
export async function consumaJeton(
  db: D1Database,
  tabela: TabelaJeton,
  jeton: string,
): Promise<{ ok: true; userId: string } | { ok: false; motiv: string }> {
  const hash = await hashJeton(jeton)
  const rand = await unul<RandJeton>(
    db,
    `SELECT id, user_id, expires_at, consumed_at FROM ${tabela} WHERE token_hash = ?`,
    [hash],
  )

  if (!rand) return { ok: false, motiv: 'jeton inexistent' }
  if (rand.consumed_at) return { ok: false, motiv: 'jeton deja folosit' }
  if (aExpirat(rand.expires_at)) return { ok: false, motiv: 'jeton expirat' }

  const rezultat = await ruleaza(
    db,
    `UPDATE ${tabela} SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL`,
    [acum(), rand.id],
  )
  if ((rezultat.meta.changes ?? 0) === 0) return { ok: false, motiv: 'jeton deja folosit' }

  return { ok: true, userId: rand.user_id }
}

/** La emiterea unui challenge nou, cele nefolosite ale aceluiasi user se invalideaza. */
export async function invalideazaJetoaneleAnterioare(
  db: D1Database,
  tabela: TabelaJeton,
  userId: string,
): Promise<void> {
  await ruleaza(
    db,
    `UPDATE ${tabela} SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL`,
    [acum(), userId],
  )
}

// ---------------------------------------------------------------------------
// Sesiuni
// ---------------------------------------------------------------------------

export interface RandSesiune {
  id: string
  user_id: string
  expires_at: string
  revoked_at: string | null
}

export async function creeazaSesiune(
  db: D1Database,
  userId: string,
  durataSec: number,
  ip: string,
  userAgent: string,
): Promise<{ jeton: string; expiraLa: string }> {
  const jeton = jetonNou()
  const expiraLa = peste(durataSec)
  await ruleaza(
    db,
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id(), userId, await hashJeton(jeton), acum(), expiraLa, ip, userAgent.slice(0, 300)],
  )
  return { jeton, expiraLa }
}

export async function sesiuneDupaJeton(
  db: D1Database,
  jeton: string,
): Promise<RandSesiune | null> {
  const rand = await unul<RandSesiune>(
    db,
    `SELECT id, user_id, expires_at, revoked_at FROM sessions WHERE token_hash = ?`,
    [await hashJeton(jeton)],
  )
  if (!rand) return null
  if (rand.revoked_at) return null
  if (aExpirat(rand.expires_at)) return null
  return rand
}

export async function revocaSesiune(db: D1Database, jeton: string): Promise<void> {
  await ruleaza(
    db,
    `UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`,
    [acum(), await hashJeton(jeton)],
  )
}

/** Revocare centrala: toate sesiunile unui utilizator, dintr-o data. */
export async function revocaToateSesiunile(db: D1Database, userId: string): Promise<number> {
  const rezultat = await ruleaza(
    db,
    `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`,
    [acum(), userId],
  )
  return rezultat.meta.changes ?? 0
}

export async function marcheazaEmailVerificat(db: D1Database, userId: string): Promise<void> {
  await ruleaza(db, `UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?`, [
    acum(),
    acum(),
    userId,
  ])
}

export async function emailuriDeDebug(
  db: D1Database,
  catre: string,
  limita = 5,
): Promise<Array<{ subiect: string; link: string; created_at: string }>> {
  return toate(
    db,
    `SELECT subiect, link, created_at FROM emails_iesire WHERE catre = ?
     ORDER BY created_at DESC LIMIT ?`,
    [catre, limita],
  )
}
