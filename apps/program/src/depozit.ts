/**
 * Citirile pe baza `xc-program-*`. Tot SQL-ul programului sta aici.
 */
import type { IntrareVocabular, Saptamana, Slujba, StareSaptamana } from '@xc/contracts'
import { toate, unul } from '@xc/db'
import { adaugaZile, faraDiacritice, intervalLizibil, luneaSaptamanii } from '@xc/ui'

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

// ---------------------------------------------------------------------------
// Istoricul pe NUMELE slujbei si tiparele lui (11.09.2026)
// ---------------------------------------------------------------------------

/**
 * Slujba in curs ACUM: ultima care a inceput azi. Slujbele au doar ora de inceput, asa ca
 * „in curs" e o conventie: a inceput de cel mult `oreDeViata` ore (implicit 3) — cat tine o
 * Liturghie cu tot cu Utrenie — si n-a inceput alta dupa ea. Pentru live si radio.
 */
export async function slujbaCurenta(db: D1Database, data: string, ora: string, oreDeViata = 3): Promise<RandSlujba | null> {
  const r = await unul<RandSlujba>(db, `SELECT * FROM slujbe WHERE data = ? AND ora <= ? ORDER BY ora DESC, ordine DESC LIMIT 1`, [data, ora])
  if (!r) return null
  const [h1, m1] = r.ora.split(':').map(Number)
  const [h2, m2] = ora.split(':').map(Number)
  const minute = (h2! * 60 + m2!) - (h1! * 60 + m1!)
  return minute <= oreDeViata * 60 ? r : null
}

/** Aparitiile trecute ale unei slujbe (dupa `cod_nume`), cele mai noi intai. */
export async function slujbeTrecuteDupaNume(db: D1Database, codNume: string, inainteDe: string, limita = 12): Promise<RandSlujba[]> {
  return toate<RandSlujba>(db, `SELECT * FROM slujbe WHERE cod_nume = ? AND data < ? ORDER BY data DESC, ora DESC LIMIT ?`, [codNume, inainteDe, limita])
}

/** Urmatoarea aparitie programata a unei slujbe (dupa `cod_nume`), de la ziua data inainte. */
export async function urmatoareaDupaNume(db: D1Database, codNume: string, deLa: string): Promise<RandSlujba | null> {
  return unul<RandSlujba>(db, `SELECT * FROM slujbe WHERE cod_nume = ? AND data >= ? ORDER BY data, ora LIMIT 1`, [codNume, deLa])
}

export interface TiparSlujba {
  cod_nume: string
  nume: string
  /** Cate aparitii in intervalul socotit. */
  aparitii: number
  /** Zilele saptamanii in care se face, cele mai dese intai: [zi, de cate ori]. */
  zile: Array<[string, number]>
  /** Orele la care se face, cele mai dese intai: [ora, de cate ori]. */
  ore: Array<[string, number]>
  ultima: string | null
  urmatoarea: string | null
}

const NUME_ZILE = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă']

/**
 * TIPARELE programului: pentru fiecare nume de slujba, cat de des se face, in ce zile si la ce
 * ore de obicei, ultima data si urmatoarea programata. E cunostinta de fundal a chatului
 * („Sfantul Maslu se face marti seara") si tine cateva KB, nu tot istoricul — se plateste la
 * fiecare mesaj. Se socoteste pe ultimii `ani` (implicit 2), ca obiceiurile vechi sa nu traga.
 */
export async function tiparele(db: D1Database, azi: string, ani = 2): Promise<TiparSlujba[]> {
  const deLa = `${Number(azi.slice(0, 4)) - ani}${azi.slice(4)}`
  const [randuri, vocabular, viitoare] = await Promise.all([
    toate<{ data: string; ora: string; cod_nume: string }>(db, `SELECT data, ora, cod_nume FROM slujbe WHERE data >= ? AND data < ? ORDER BY data`, [deLa, azi]),
    toate<{ cod_nume: string; nume: string }>(db, `SELECT cod_nume, nume FROM vocabular ORDER BY ordine`),
    toate<{ cod_nume: string; data: string }>(db, `SELECT cod_nume, MIN(data) AS data FROM slujbe WHERE data >= ? GROUP BY cod_nume`, [azi]),
  ])
  const numeDupaCod = new Map(vocabular.map((v) => [v.cod_nume, v.nume]))
  const urmatoareaDupaCod = new Map(viitoare.map((v) => [v.cod_nume, v.data]))

  const strans = new Map<string, { zile: Map<string, number>; ore: Map<string, number>; n: number; ultima: string }>()
  for (const r of randuri) {
    const t = strans.get(r.cod_nume) ?? { zile: new Map(), ore: new Map(), n: 0, ultima: r.data }
    const zi = NUME_ZILE[new Date(`${r.data}T12:00:00Z`).getUTCDay()]!
    t.zile.set(zi, (t.zile.get(zi) ?? 0) + 1)
    t.ore.set(r.ora, (t.ore.get(r.ora) ?? 0) + 1)
    t.n += 1
    if (r.data > t.ultima) t.ultima = r.data
    strans.set(r.cod_nume, t)
  }
  const descrescator = (m: Map<string, number>, cate: number): Array<[string, number]> =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, cate)

  return [...strans.entries()]
    .map(([cod, t]) => ({
      cod_nume: cod,
      nume: numeDupaCod.get(cod) ?? cod,
      aparitii: t.n,
      zile: descrescator(t.zile, 3),
      ore: descrescator(t.ore, 3),
      ultima: t.ultima,
      urmatoarea: urmatoareaDupaCod.get(cod) ?? null,
    }))
    .sort((a, b) => b.aparitii - a.aparitii)
}

/** Tot ce e in baza, pentru arhiva: saptamanile si slujbele lor. Mare — nu se da unui model. */
export async function arhivaIntreaga(db: D1Database): Promise<{ saptamani: RandSaptamana[]; slujbe: RandSlujba[] }> {
  const [saptamani, slujbe] = await Promise.all([
    toate<RandSaptamana>(db, `SELECT * FROM saptamani ORDER BY luni`),
    toate<RandSlujba>(db, `SELECT * FROM slujbe ORDER BY data, ora, ordine`),
  ])
  return { saptamani, slujbe }
}

/**
 * Numele unei slujbe, asa cum il spune un om („maslu", „Sfântul Maslu", „liturghie"), potrivit pe
 * vocabularul inchis. Fara diacritice si fara majuscule; se cauta si in `nume`, si in `cod_nume`.
 * Intoarce toate potrivirile, cea mai scurta (deci cea mai apropiata) intai.
 */
export function cautaInVocabular(vocabular: IntrareVocabular[], text: string): IntrareVocabular[] {
  const cautat = faraDiacritice(text).toLowerCase().trim()
  if (cautat.length < 3) return []
  const cuvinte = cautat.split(/\s+/).filter((c) => c.length >= 3)
  return vocabular
    .filter((v) => {
      const nume = faraDiacritice(v.nume).toLowerCase()
      if (nume.includes(cautat) || cautat.includes(nume)) return true
      return cuvinte.length > 0 && cuvinte.every((c) => nume.includes(c) || v.cod_nume.includes(c))
    })
    .sort((a, b) => a.nume.length - b.nume.length)
}
