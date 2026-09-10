/**
 * Citirile pe baza `xc-program-*`. Tot SQL-ul programului sta aici.
 */
import type { IntrareVocabular, Saptamana, Slujba, StareSaptamana } from '@xc/contracts'
import { toate, unul } from '@xc/db'
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

/** Saptamanile unui an: anul e cel al ZILEI DE LUNI (ca in V1) — nicio saptamana nu iese din anul ei, nici in arhiva, nici in `/v1/saptamani`. */
export async function saptamanileAnului(db: D1Database, an?: number): Promise<RezumatSaptamana[]> {
  const conditie = an ? `WHERE s.luni LIKE ?` : ''
  const legaturi = an ? [`${an}-%`] : []
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

// Scrierea si validarea manuala a saptamanii (scrieSaptamana, valideazaSaptamana, istoriculSaptamanii)
// au fost scoase la cererea userului (10.09.2026: „nu vreau să fac nimic manual"). Baza ramane doar
// citita de aplicatie; se umple prin import (infrastructure/import) si prin propunerea automata.

export { luneaSaptamanii }
