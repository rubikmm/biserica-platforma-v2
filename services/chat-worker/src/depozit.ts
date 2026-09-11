/**
 * Discuțiile, în D1. Doar `user_id` — nici nume, nici email, nici telefon (regula platformei).
 * Nimic despre parohie nu se copiază aici: programul și calendarul se cer prin acțiuni.
 */

export interface Conversatie {
  id: string
  user_id: string
  aplicatie: string
  creata_la: string
  ultimul_la: string
}

export type RolScris = 'om' | 'agent' | 'unealta'

export interface MesajScris {
  id: string
  conversatie_id: string
  rol: RolScris
  text: string
  date_json: string
  creat_la: string
}

export interface Propunere {
  id: string
  conversatie_id: string
  aplicatie: string
  actiune: string
  argumente_json: string
  rezumat: string
  stare: 'asteapta' | 'facuta' | 'refuzata' | 'expirata'
  creata_la: string
  expira_la: string
}

const acum = () => new Date().toISOString()

/** Discuția cerută, dacă e a omului; altfel una nouă. Nimeni nu intră în discuția altuia. */
export async function conversatia(
  db: D1Database,
  userId: string,
  aplicatie: string,
  id?: string | null,
): Promise<Conversatie> {
  if (id) {
    const gasita = await db
      .prepare('SELECT * FROM conversatii WHERE id = ?1 AND user_id = ?2')
      .bind(id, userId)
      .first<Conversatie>()
    if (gasita) return gasita
  }
  const noua: Conversatie = {
    id: crypto.randomUUID(),
    user_id: userId,
    aplicatie,
    creata_la: acum(),
    ultimul_la: acum(),
  }
  await db
    .prepare('INSERT INTO conversatii (id, user_id, aplicatie, creata_la, ultimul_la) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(noua.id, noua.user_id, noua.aplicatie, noua.creata_la, noua.ultimul_la)
    .run()
  return noua
}

export async function scrieMesaj(
  db: D1Database,
  m: { conversatie_id: string; rol: RolScris; text: string; date?: unknown },
): Promise<MesajScris> {
  const scris: MesajScris = {
    id: crypto.randomUUID(),
    conversatie_id: m.conversatie_id,
    rol: m.rol,
    text: m.text,
    date_json: JSON.stringify(m.date ?? {}),
    creat_la: acum(),
  }
  await db.batch([
    db
      .prepare('INSERT INTO mesaje (id, conversatie_id, rol, text, date_json, creat_la) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
      .bind(scris.id, scris.conversatie_id, scris.rol, scris.text, scris.date_json, scris.creat_la),
    db.prepare('UPDATE conversatii SET ultimul_la = ?2 WHERE id = ?1').bind(m.conversatie_id, scris.creat_la),
  ])
  return scris
}

/**
 * Ultimele mesaje, în ordinea în care s-au spus. Se taie la un număr mic dinadins: o discuție
 * lungă dusă întreagă la model costă la fiecare replică, iar un chat de parohie n-are nevoie de
 * memoria de acum o oră.
 */
export async function mesajeleDin(db: D1Database, conversatieId: string, limita = 16): Promise<MesajScris[]> {
  const r = await db
    .prepare('SELECT * FROM mesaje WHERE conversatie_id = ?1 ORDER BY creat_la DESC, rowid DESC LIMIT ?2')
    .bind(conversatieId, limita)
    .all<MesajScris>()
  return (r.results ?? []).reverse()
}

export async function scriePropunere(
  db: D1Database,
  p: { conversatie_id: string; aplicatie: string; actiune: string; argumente: unknown; rezumat: string },
  minuteDeViata = 10,
): Promise<Propunere> {
  const noua: Propunere = {
    id: crypto.randomUUID(),
    conversatie_id: p.conversatie_id,
    aplicatie: p.aplicatie,
    actiune: p.actiune,
    argumente_json: JSON.stringify(p.argumente ?? {}),
    rezumat: p.rezumat,
    stare: 'asteapta',
    creata_la: acum(),
    expira_la: new Date(Date.now() + minuteDeViata * 60_000).toISOString(),
  }
  await db
    .prepare(
      'INSERT INTO propuneri (id, conversatie_id, aplicatie, actiune, argumente_json, rezumat, stare, creata_la, expira_la) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)',
    )
    .bind(
      noua.id,
      noua.conversatie_id,
      noua.aplicatie,
      noua.actiune,
      noua.argumente_json,
      noua.rezumat,
      noua.stare,
      noua.creata_la,
      noua.expira_la,
    )
    .run()
  return noua
}

/** Propunerea, dacă e a omului și dacă n-a trecut vremea ei. */
export async function propunereaDe(
  db: D1Database,
  id: string,
  userId: string,
): Promise<{ p: Propunere; motiv?: 'expirata' | 'raspunsa' } | null> {
  const p = await db
    .prepare(
      'SELECT p.* FROM propuneri p JOIN conversatii c ON c.id = p.conversatie_id WHERE p.id = ?1 AND c.user_id = ?2',
    )
    .bind(id, userId)
    .first<Propunere>()
  if (!p) return null
  if (p.stare !== 'asteapta') return { p, motiv: 'raspunsa' }
  if (p.expira_la < acum()) {
    await inchidePropunerea(db, p.id, 'expirata')
    return { p: { ...p, stare: 'expirata' }, motiv: 'expirata' }
  }
  return { p }
}

export async function inchidePropunerea(db: D1Database, id: string, stare: Propunere['stare']): Promise<void> {
  await db.prepare('UPDATE propuneri SET stare = ?2 WHERE id = ?1').bind(id, stare).run()
}

/** Omul își poate șterge discuția. Mesajele și propunerile cad odată cu ea. */
export async function stergeConversatia(db: D1Database, id: string, userId: string): Promise<boolean> {
  const a = await db
    .prepare('SELECT id FROM conversatii WHERE id = ?1 AND user_id = ?2')
    .bind(id, userId)
    .first<{ id: string }>()
  if (!a) return false
  await db.batch([
    db.prepare('DELETE FROM propuneri WHERE conversatie_id = ?1').bind(id),
    db.prepare('DELETE FROM mesaje WHERE conversatie_id = ?1').bind(id),
    db.prepare('DELETE FROM conversatii WHERE id = ?1').bind(id),
  ])
  return true
}
