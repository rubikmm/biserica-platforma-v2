/**
 * Citirile si scrierile pe baza `xc-program-*`. Tot SQL-ul programului sta aici.
 */
import type { IntrareVocabular, Saptamana, Slujba, SlujbaDeScris, StareSaptamana } from '@xc/contracts'
import { acum, batch, toate, unul } from '@xc/db'
import { adaugaZile, intervalLizibil, luneaSaptamanii } from '@xc/ui'

export interface RandSaptamana {
  luni: string
  duminica: string
  stare: StareSaptamana
  titlu: string
  sursa: string
  sursa_id: string | null
  sursa_link: string | null
  versiune_calendar: string | null
  validat_de: string | null
  validat_la: string | null
  creat: string
  modificat: string
}

export interface RandSlujba {
  id: string
  luni: string
  data: string
  ora: string
  nume: string
  cod_nume: string
  slujitor: string | null
  loc: string
  detalii: string
  observatii: string | null
  curatenie: number
  transmisie: number
  ordine: number
  creat: string
  modificat: string
}

export function slujbaDin(r: RandSlujba): Slujba {
  let detalii: string[] = []
  try {
    const parsat = JSON.parse(r.detalii || '[]')
    if (Array.isArray(parsat)) detalii = parsat.map(String)
  } catch {
    detalii = []
  }
  return {
    id: r.id,
    data: r.data,
    ora: r.ora,
    nume: r.nume,
    cod_nume: r.cod_nume,
    slujitor: r.slujitor,
    loc: r.loc,
    observatii: r.observatii ?? (detalii.length ? detalii.join('; ') : null),
    detalii,
    curatenie: r.curatenie === 1,
    transmisie: r.transmisie === 1,
  }
}

export function saptamanaDin(s: RandSaptamana, slujbe: RandSlujba[]): Saptamana {
  return {
    de_la: s.luni,
    pana_la: s.duminica,
    stare: s.stare,
    titlu: s.titlu || intervalLizibil(s.luni, s.duminica),
    validat_de: s.validat_de,
    validat_la: s.validat_la,
    versiune_calendar: s.versiune_calendar,
    sursa: s.sursa,
    sursa_link: s.sursa_link,
    slujbe: slujbe.map(slujbaDin),
  }
}

export async function vocabularul(db: D1Database): Promise<IntrareVocabular[]> {
  const r = await toate<{ cod_nume: string; nume: string; categorie: string; ordine: number; activ: number }>(db, `SELECT * FROM vocabular ORDER BY ordine`)
  return r.map((v) => ({ cod_nume: v.cod_nume, nume: v.nume, categorie: v.categorie as IntrareVocabular['categorie'], ordine: v.ordine, activ: v.activ === 1 }))
}

export async function saptamana(db: D1Database, luni: string): Promise<RandSaptamana | null> {
  return unul<RandSaptamana>(db, `SELECT * FROM saptamani WHERE luni = ?`, [luni])
}

export async function slujbeleSaptamanii(db: D1Database, luni: string): Promise<RandSlujba[]> {
  return toate<RandSlujba>(db, `SELECT * FROM slujbe WHERE luni = ? ORDER BY data, ora, ordine`, [luni])
}

export async function slujbeInterval(db: D1Database, deLa: string, panaLa: string): Promise<RandSlujba[]> {
  return toate<RandSlujba>(db, `SELECT * FROM slujbe WHERE data >= ? AND data <= ? ORDER BY data, ora, ordine`, [deLa, panaLa])
}

export async function saptamaniInterval(db: D1Database, deLa: string, panaLa: string): Promise<RandSaptamana[]> {
  return toate<RandSaptamana>(db, `SELECT * FROM saptamani WHERE duminica >= ? AND luni <= ? ORDER BY luni`, [deLa, panaLa])
}

export interface RezumatSaptamana {
  luni: string
  duminica: string
  titlu: string
  stare: StareSaptamana
  sursa: string
  nr_slujbe: number
}

export async function saptamanileAnului(db: D1Database, an?: number): Promise<RezumatSaptamana[]> {
  const conditie = an ? `WHERE s.luni LIKE ? OR s.duminica LIKE ?` : ''
  const legaturi = an ? [`${an}-%`, `${an}-%`] : []
  return toate<RezumatSaptamana>(
    db,
    `SELECT s.luni, s.duminica, s.titlu, s.stare, s.sursa, COUNT(l.id) AS nr_slujbe
     FROM saptamani s LEFT JOIN slujbe l ON l.luni = s.luni ${conditie}
     GROUP BY s.luni ORDER BY s.luni DESC`,
    legaturi,
  )
}

export async function aniiArhivei(db: D1Database): Promise<number[]> {
  const r = await toate<{ an: string }>(db, `SELECT DISTINCT substr(luni, 1, 4) AS an FROM saptamani ORDER BY an DESC`)
  return r.map((x) => Number(x.an))
}

export async function acoperire(db: D1Database): Promise<{ de_la: string | null; pana_la: string | null; saptamani: number; slujbe: number }> {
  const r = await unul<{ de_la: string | null; pana_la: string | null; saptamani: number; slujbe: number }>(
    db,
    `SELECT (SELECT min(luni) FROM saptamani) de_la, (SELECT max(duminica) FROM saptamani) pana_la, (SELECT count(*) FROM saptamani) saptamani, (SELECT count(*) FROM slujbe) slujbe`,
  )
  return r ?? { de_la: null, pana_la: null, saptamani: 0, slujbe: 0 }
}

/** Saptamanile vecine care EXISTA in baza (pentru 404-ul de saptamana). */
export async function vecinele(db: D1Database, luni: string): Promise<{ inainte: string | null; dupa: string | null }> {
  const inainte = await unul<{ luni: string }>(db, `SELECT luni FROM saptamani WHERE luni < ? ORDER BY luni DESC LIMIT 1`, [luni])
  const dupa = await unul<{ luni: string }>(db, `SELECT luni FROM saptamani WHERE luni > ? ORDER BY luni ASC LIMIT 1`, [luni])
  return { inainte: inainte?.luni ?? null, dupa: dupa?.luni ?? null }
}

/** Istoricul cu cod, strict inaintea unei date — hrana propunerii. */
export interface RandIstoricSlujba {
  data: string
  ora: string
  cod_nume: string
  luni: string
}
export async function istoriculSlujbelor(db: D1Database, inainteDe: string): Promise<RandIstoricSlujba[]> {
  return toate<RandIstoricSlujba>(db, `SELECT data, ora, cod_nume, luni FROM slujbe WHERE data < ? ORDER BY data`, [inainteDe])
}

/** Urmatoarea slujba de la un moment incolo, in cel mult N zile. */
export async function urmatoareaSlujba(db: D1Database, data: string, ora: string, zile = 21): Promise<RandSlujba | null> {
  return unul<RandSlujba>(
    db,
    `SELECT * FROM slujbe WHERE (data > ? OR (data = ? AND ora >= ?)) AND data <= ? ORDER BY data, ora, ordine LIMIT 1`,
    [data, data, ora, adaugaZile(data, zile)],
  )
}

// ---------------------------------------------------------------------------
// Scrieri
// ---------------------------------------------------------------------------

function idSlujba(data: string, cod: string, folosite: Set<string>): string {
  let id = `${data}-${cod}`
  let n = 2
  while (folosite.has(id)) id = `${data}-${cod}-${n++}`
  folosite.add(id)
  return id
}

/**
 * Scrie (sau rescrie) slujbele unei saptamani. Id-urile existente (aceeasi data + cod) se pastreaza
 * — de ele atarna sloturile de curatenie; ce nu mai e in lista se sterge.
 */
export async function scrieSaptamana(
  db: D1Database,
  luni: string,
  slujbe: SlujbaDeScris[],
  vocabular: Map<string, IntrareVocabular>,
  userId: string,
  declaratiiInPlus: D1PreparedStatement[] = [],
): Promise<{ stare: StareSaptamana; ids: string[] }> {
  const duminica = adaugaZile(luni, 6)
  const existenta = await saptamana(db, luni)
  const existente = await slujbeleSaptamanii(db, luni)
  const moment = acum()
  const stare: StareSaptamana = existenta && existenta.stare !== 'propus' ? 'modificat_dupa_validare' : 'propus'
  const declaratii: D1PreparedStatement[] = []

  if (!existenta) {
    declaratii.push(
      db
        .prepare(`INSERT INTO saptamani (luni, duminica, stare, titlu, sursa, creat, modificat) VALUES (?, ?, 'propus', ?, 'manual', ?, ?)`)
        .bind(luni, duminica, intervalLizibil(luni, duminica), moment, moment),
    )
  } else {
    declaratii.push(db.prepare(`UPDATE saptamani SET stare = ?, modificat = ? WHERE luni = ?`).bind(stare, moment, luni))
  }

  // potrivim slujbele noi cu cele existente dupa (data, cod), in ordine
  const ramase = new Map<string, RandSlujba[]>()
  for (const e of existente) {
    const lista = ramase.get(`${e.data}|${e.cod_nume}`) ?? []
    lista.push(e)
    ramase.set(`${e.data}|${e.cod_nume}`, lista)
  }
  const folosite = new Set(existente.map((e) => e.id))
  const ids: string[] = []
  const peZi = new Map<string, number>()
  const sortate = [...slujbe].sort((a, b) => (a.data === b.data ? a.ora.localeCompare(b.ora) : a.data.localeCompare(b.data)))
  for (const s of sortate) {
    const ordine = peZi.get(s.data) ?? 0
    peZi.set(s.data, ordine + 1)
    const cheie = `${s.data}|${s.cod_nume}`
    const vechi = ramase.get(cheie)?.shift()
    const id = vechi?.id ?? idSlujba(s.data, s.cod_nume, folosite)
    ids.push(id)
    const nume = s.nume?.trim() || vocabular.get(s.cod_nume)?.nume || s.cod_nume
    if (vechi) {
      declaratii.push(
        db
          .prepare(`UPDATE slujbe SET ora = ?, nume = ?, slujitor = ?, loc = ?, detalii = ?, observatii = ?, curatenie = ?, transmisie = ?, ordine = ?, modificat = ? WHERE id = ?`)
          .bind(s.ora, nume, s.slujitor || null, s.loc, JSON.stringify(s.detalii), s.observatii || null, s.curatenie ? 1 : 0, s.transmisie ? 1 : 0, ordine, moment, id),
      )
    } else {
      declaratii.push(
        db
          .prepare(
            `INSERT INTO slujbe (id, luni, data, ora, nume, cod_nume, slujitor, loc, detalii, observatii, curatenie, transmisie, ordine, creat, modificat)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(id, luni, s.data, s.ora, nume, s.cod_nume, s.slujitor || null, s.loc, JSON.stringify(s.detalii), s.observatii || null, s.curatenie ? 1 : 0, s.transmisie ? 1 : 0, ordine, moment, moment),
      )
    }
  }
  for (const lista of ramase.values()) {
    for (const e of lista) {
      declaratii.push(db.prepare(`DELETE FROM slujbe WHERE id = ?`).bind(e.id))
      declaratii.push(db.prepare(`INSERT INTO istoric (moment, user_id, ce, luni, slujba_id, detalii) VALUES (?, ?, 'sters', ?, ?, ?)`).bind(moment, userId, luni, e.id, `${e.data} ${e.ora} ${e.nume}`))
    }
  }
  declaratii.push(
    db.prepare(`INSERT INTO istoric (moment, user_id, ce, luni, slujba_id, detalii) VALUES (?, ?, ?, ?, NULL, ?)`).bind(moment, userId, existenta ? 'schimbat' : 'scris', luni, `${slujbe.length} slujbe`),
  )
  await batch(db, [...declaratii, ...declaratiiInPlus])
  return { stare, ids }
}

export async function valideazaSaptamana(db: D1Database, luni: string, userId: string, versiuneCalendar: string | null, declaratiiInPlus: D1PreparedStatement[] = []): Promise<void> {
  const moment = acum()
  await batch(db, [
    db.prepare(`UPDATE saptamani SET stare = 'validat', validat_de = ?, validat_la = ?, versiune_calendar = ?, modificat = ? WHERE luni = ?`).bind(userId, moment, versiuneCalendar, moment, luni),
    db.prepare(`INSERT INTO istoric (moment, user_id, ce, luni, slujba_id, detalii) VALUES (?, ?, 'validat', ?, NULL, ?)`).bind(moment, userId, luni, versiuneCalendar ?? ''),
    ...declaratiiInPlus,
  ])
}

export async function istoriculSaptamanii(db: D1Database, luni: string): Promise<Array<{ moment: string; user_id: string | null; ce: string; detalii: string | null }>> {
  return toate(db, `SELECT moment, user_id, ce, detalii FROM istoric WHERE luni = ? ORDER BY moment DESC LIMIT 30`, [luni])
}

export { luneaSaptamanii }
