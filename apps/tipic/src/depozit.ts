/**
 * Citirile pe baza `xc-tipic-*`. Tot SQL-ul tipicului sta aici.
 *
 * Aplicatia e NUMAI de citit: cartile intra prin `infrastructure/import/tipic-din-v1.mjs`, nu
 * prin pagina. Coloanele cu liste (referintele pericopelor, alineatele Anuarului, bucatile
 * Mineiului) sunt JSON in D1 si se desfac aici, la margine, nu prin aplicatie.
 */
import { toate, unul } from '@xc/db'
import type { CarteTipic, RanduialaZi, ReferintaPericopa, TipiconalZi, ZiMinei } from '@xc/contracts'

/** JSON din coloana; o coloana stricata nu darama pagina — se intoarce lista goala. */
function lista<T>(brut: unknown): T[] {
  if (typeof brut !== 'string' || !brut) return []
  try {
    const v = JSON.parse(brut)
    return Array.isArray(v) ? (v as T[]) : []
  } catch {
    return []
  }
}

interface RandRanduiala {
  data: string
  zi: string
  voscreasna: number | null
  utrenie: string
  apostol: string
  evanghelie: string
  tipic: string
}

export async function randuialaZilei(db: D1Database, data: string): Promise<RanduialaZi | null> {
  const r = await unul<RandRanduiala>(
    db,
    `SELECT data, zi, voscreasna, utrenie, apostol, evanghelie, tipic FROM randuiala WHERE data = ?`,
    [data],
  )
  if (!r) return null
  return {
    data: r.data,
    zi: r.zi,
    voscreasna: r.voscreasna,
    utrenie: lista<ReferintaPericopa>(r.utrenie),
    apostol: lista<ReferintaPericopa>(r.apostol),
    evanghelie: lista<ReferintaPericopa>(r.evanghelie),
    tipic: r.tipic,
  }
}

interface RandTipiconal {
  data: string
  zi: string
  titlu: string
  paragrafe: string
  pagini: string
}

export async function tipiconalZilei(db: D1Database, data: string): Promise<TipiconalZi | null> {
  const r = await unul<RandTipiconal>(db, `SELECT data, zi, titlu, paragrafe, pagini FROM tipiconal WHERE data = ?`, [data])
  if (!r) return null
  return {
    data: r.data,
    zi: r.zi,
    titlu: r.titlu,
    paragrafe: lista<string>(r.paragrafe),
    pagini: lista<number>(r.pagini),
  }
}

interface RandMinei {
  luna: number
  zi: number
  titlu: string
  bucati: string
  pagini: string
}

/** Cartea nu tine de an: ziua se cauta dupa numarul ei din luna, nu dupa data intreaga. */
export async function mineiZilei(db: D1Database, luna: number, zi: number): Promise<ZiMinei | null> {
  const r = await unul<RandMinei>(db, `SELECT luna, zi, titlu, bucati, pagini FROM minei WHERE luna = ? AND zi = ?`, [luna, zi])
  if (!r) return null
  return {
    luna: r.luna,
    zi: r.zi,
    titlu: r.titlu,
    bucati: lista<ZiMinei['bucati'][number]>(r.bucati),
    pagini: lista<number>(r.pagini),
  }
}

export async function cartile(db: D1Database): Promise<Map<string, CarteTipic>> {
  const randuri = await toate<CarteTipic>(db, `SELECT cod, sursa, editura, nota, credit, url, luna FROM carti`)
  return new Map(randuri.map((c) => [c.cod, c]))
}

/**
 * Zilele care se pot alege din calendarul paginii: cele cu randuiala proprie (ROEA) SAU cu
 * rand in Anuar. Mineiul nu intra in lista — el are toate zilele oricarui an, deci n-ar mai
 * ramane nimic stins, iar ce cauta cititorul aici e randuiala.
 */
export async function zileleCuRanduiala(db: D1Database): Promise<string[]> {
  const randuri = await toate<{ data: string }>(
    db,
    `SELECT data FROM randuiala UNION SELECT data FROM tipiconal ORDER BY data`,
  )
  return randuri.map((r) => r.data)
}

export interface Acoperire {
  randuiala: number
  tipiconal: number
  minei: Array<{ luna: number; zile: number }>
}

export async function acoperire(db: D1Database): Promise<Acoperire> {
  const [r, t, m] = await Promise.all([
    unul<{ n: number }>(db, `SELECT COUNT(*) AS n FROM randuiala`),
    unul<{ n: number }>(db, `SELECT COUNT(*) AS n FROM tipiconal`),
    toate<{ luna: number; zile: number }>(db, `SELECT luna, COUNT(*) AS zile FROM minei GROUP BY luna ORDER BY luna`),
  ])
  return { randuiala: r?.n ?? 0, tipiconal: t?.n ?? 0, minei: m }
}
