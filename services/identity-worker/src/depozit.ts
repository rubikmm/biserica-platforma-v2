import { acum, eIncalcareUnicitate, id, ruleaza, toate, unul } from '@xc/db'
import type { Utilizator } from '@xc/contracts'
import { aExpirat, hashJeton, jetonNou, peste } from './jetoane.js'

export interface RandUtilizator {
  id: string
  email: string
  display_name: string | null
  email_verified_at: string
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

export type RezultatCreare =
  | { fel: 'creat'; utilizator: RandUtilizator }
  | { fel: 'exista'; utilizator: RandUtilizator }

/**
 * Se cheama DOAR la consumul unui link de intrare: contul se naste cu adresa deja confirmata.
 * Daca intre timp a aparut acelasi email (doua linkuri deschise aproape simultan), il intoarcem
 * pe cel existent — nu e o eroare, e aceeasi persoana.
 */
export async function creeazaUtilizatorConfirmat(
  db: D1Database,
  email: string,
  displayName: string | null,
): Promise<RezultatCreare> {
  const userId = id()
  try {
    await ruleaza(
      db,
      `INSERT INTO users (id, email, display_name, email_verified_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, email, displayName, acum(), acum(), acum()],
    )
  } catch (e) {
    if (eIncalcareUnicitate(e)) {
      const existent = await utilizatorDupaEmail(db, email)
      if (!existent) throw e
      return { fel: 'exista', utilizator: existent }
    }
    throw e
  }

  const creat = await utilizatorDupaId(db, userId)
  if (!creat) throw new Error('utilizatorul nu a putut fi recitit dupa creare')
  return { fel: 'creat', utilizator: creat }
}

// ---------------------------------------------------------------------------
// Linkul de intrare (jeton cu un singur consum)
// ---------------------------------------------------------------------------

export async function emiteLinkDeIntrare(
  db: D1Database,
  email: string,
  userId: string | null,
  displayName: string | null,
  durataSec: number,
): Promise<string> {
  // Un link nou le inchide pe cele vechi ale aceleiasi adrese: doar ultimul e bun.
  await ruleaza(
    db,
    `UPDATE login_challenges SET consumed_at = ? WHERE email = ? AND consumed_at IS NULL`,
    [acum(), email],
  )
  const jeton = jetonNou()
  await ruleaza(
    db,
    `INSERT INTO login_challenges (id, email, user_id, display_name, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id(), email, userId, displayName, await hashJeton(jeton), acum(), peste(durataSec)],
  )
  return jeton
}

interface RandChallenge {
  id: string
  email: string
  user_id: string | null
  display_name: string | null
  expires_at: string
  consumed_at: string | null
}

export type RezultatConsum =
  | { ok: true; email: string; userId: string | null; displayName: string | null }
  | { ok: false; motiv: 'jeton inexistent' | 'jeton deja folosit' | 'jeton expirat' }

/**
 * Consuma linkul daca e valid. Consumul e atomic (`UPDATE ... WHERE consumed_at IS NULL`),
 * deci doua apasari simultane pe acelasi link produc o singura sesiune.
 */
export async function consumaLinkDeIntrare(
  db: D1Database,
  jeton: string,
): Promise<RezultatConsum> {
  const rand = await unul<RandChallenge>(
    db,
    `SELECT id, email, user_id, display_name, expires_at, consumed_at
     FROM login_challenges WHERE token_hash = ?`,
    [await hashJeton(jeton)],
  )

  if (!rand) return { ok: false, motiv: 'jeton inexistent' }
  if (rand.consumed_at) return { ok: false, motiv: 'jeton deja folosit' }
  if (aExpirat(rand.expires_at)) return { ok: false, motiv: 'jeton expirat' }

  const rezultat = await ruleaza(
    db,
    `UPDATE login_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL`,
    [acum(), rand.id],
  )
  if ((rezultat.meta.changes ?? 0) === 0) return { ok: false, motiv: 'jeton deja folosit' }

  return { ok: true, email: rand.email, userId: rand.user_id, displayName: rand.display_name }
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

export async function actualizeazaNume(
  db: D1Database,
  userId: string,
  displayName: string,
): Promise<void> {
  await ruleaza(db, `UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?`, [
    displayName,
    acum(),
    userId,
  ])
}

export async function emailuriDeDebug(
  db: D1Database,
  catre: string,
  limita = 5,
): Promise<Array<{ subiect: string; link: string | null; adaptor: string; created_at: string }>> {
  return toate(
    db,
    `SELECT subiect, link, adaptor, created_at FROM emails_iesire WHERE catre = ?
     ORDER BY created_at DESC LIMIT ?`,
    [catre, limita],
  )
}
