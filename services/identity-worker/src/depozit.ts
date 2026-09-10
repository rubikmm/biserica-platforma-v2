import { acum, eIncalcareUnicitate, id, ruleaza, toate, unul } from '@xc/db'
import type { Masca, Utilizator } from '@xc/contracts'
import {
  INCERCARI_COD,
  aExpirat,
  codDeSaseCifre,
  hashCod,
  hashJeton,
  jetonNou,
  peste,
} from './jetoane.js'

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
 * Se cheama DOAR la confirmarea unui cod de intrare: contul se naste cu adresa deja confirmata.
 * Daca intre timp a aparut acelasi email (doua coduri confirmate aproape simultan), il intoarcem
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
// Codul de intrare (sase cifre, un singur consum)
// ---------------------------------------------------------------------------

/**
 * Naste un cod pentru adresa data si il intoarce IN CLAR — o singura data, cat sa incapa in
 * scrisoare. In baza ramane doar amprenta lui `email:cod`.
 */
export async function emiteCodDeIntrare(
  db: D1Database,
  email: string,
  userId: string | null,
  displayName: string | null,
  durataSec: number,
): Promise<string> {
  // Un cod nou le stinge pe cele vechi ale aceleiasi adrese: doar ultimul e bun.
  await ruleaza(
    db,
    `UPDATE coduri_intrare SET consumed_at = ? WHERE email = ? AND consumed_at IS NULL`,
    [acum(), email],
  )
  const cod = codDeSaseCifre()
  await ruleaza(
    db,
    `INSERT INTO coduri_intrare (id, email, user_id, display_name, cod_hash, incercari, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [id(), email, userId, displayName, await hashCod(email, cod), acum(), peste(durataSec)],
  )
  return cod
}

interface RandCod {
  id: string
  email: string
  user_id: string | null
  display_name: string | null
  cod_hash: string
  incercari: number
  expires_at: string
  consumed_at: string | null
}

export type RezultatConsum =
  | { ok: true; email: string; userId: string | null; displayName: string | null }
  | { ok: false; motiv: 'cod inexistent' | 'cod deja folosit' | 'cod expirat' | 'cod gresit'; ramase?: number }

/**
 * Confirma codul, daca e bun. Doua griji:
 *
 * 1. Numarul de incercari creste INAINTE de comparatie — o intrerupere de retea la mijloc nu
 *    trebuie sa ofere o incercare gratis (V1, aceeasi regula).
 * 2. Consumul e atomic (`UPDATE ... WHERE consumed_at IS NULL`), deci doua trimiteri simultane
 *    ale aceluiasi cod produc o singura sesiune.
 *
 * Cautarea e dupa email, nu dupa amprenta: altfel n-am putea numara greselile pe codul in curs.
 */
export async function confirmaCodDeIntrare(
  db: D1Database,
  email: string,
  cod: string,
): Promise<RezultatConsum> {
  const rand = await unul<RandCod>(
    db,
    `SELECT id, email, user_id, display_name, cod_hash, incercari, expires_at, consumed_at
     FROM coduri_intrare WHERE email = ? AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [email],
  )

  if (!rand) return { ok: false, motiv: 'cod inexistent' }
  if (aExpirat(rand.expires_at)) return { ok: false, motiv: 'cod expirat' }

  // Prea multe greseli: codul se stinge aici, nu se mai poate incerca pe el.
  if (rand.incercari >= INCERCARI_COD) {
    await ruleaza(db, `UPDATE coduri_intrare SET consumed_at = ? WHERE id = ?`, [acum(), rand.id])
    return { ok: false, motiv: 'cod expirat' }
  }

  await ruleaza(db, `UPDATE coduri_intrare SET incercari = incercari + 1 WHERE id = ?`, [rand.id])

  if ((await hashCod(email, cod)) !== rand.cod_hash) {
    return { ok: false, motiv: 'cod gresit', ramase: INCERCARI_COD - rand.incercari - 1 }
  }

  const rezultat = await ruleaza(
    db,
    `UPDATE coduri_intrare SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL`,
    [acum(), rand.id],
  )
  if ((rezultat.meta.changes ?? 0) === 0) return { ok: false, motiv: 'cod deja folosit' }

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
  /** Masca „vezi ca", daca sesiunea poarta una. Sta AICI, nu intr-un cookie: cine schimba
   *  cookie-ul nu-si schimba drepturile, iar masca il urmeaza pe om in toate aplicatiile. */
  vezi_ca: string | null
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
    `SELECT id, user_id, expires_at, revoked_at, vezi_ca FROM sessions WHERE token_hash = ?`,
    [await hashJeton(jeton)],
  )
  if (!rand) return null
  if (rand.revoked_at) return null
  if (aExpirat(rand.expires_at)) return null
  return rand
}

/**
 * Pune (sau scoate, cu `null`) masca „vezi ca" pe sesiunea data. Nu verifica nimic despre
 * drepturi — cine cheama a verificat deja rolul ADEVARAT, mai sus, in `/vezi-ca`.
 */
export async function puneMasca(
  db: D1Database,
  jeton: string,
  masca: Masca | null,
): Promise<boolean> {
  const rezultat = await ruleaza(
    db,
    `UPDATE sessions SET vezi_ca = ? WHERE token_hash = ? AND revoked_at IS NULL`,
    [masca, await hashJeton(jeton)],
  )
  return (rezultat.meta.changes ?? 0) > 0
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
): Promise<Array<{ subiect: string; secret: string | null; adaptor: string; created_at: string }>> {
  return toate(
    db,
    `SELECT subiect, secret_debug AS secret, adaptor, created_at FROM emails_iesire WHERE catre = ?
     ORDER BY created_at DESC LIMIT ?`,
    [catre, limita],
  )
}
