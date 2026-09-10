/**
 * Citirile si scrierile pe baza `xc-calendar-*`. Tot SQL-ul calendarului sta aici.
 */
import { acum, toate, unul, batch } from '@xc/db'
import { faraDiacritice, aziBucuresti } from '@xc/ui'
import { type Referinte, compuneAnul } from './compus.js'
import type { RandZi } from './traducere.js'
import { anul } from './pascalia.js'

const COLOANE = `data, an, luna, zi, zi_saptamana, titlu, titlu_html, subtitlu, cruce, cruce_text, zi_libera, post, perioada,
  sambata_mortilor, nunti, parastase, faza_lunii, evanghelia, apostolul, sursa_id, sursa_link, preluat_la`

export async function randulZilei(db: D1Database, data: string): Promise<RandZi | null> {
  return unul<RandZi>(db, `SELECT ${COLOANE} FROM zile WHERE data = ?`, [data])
}

export async function randurileLunii(db: D1Database, an: number, luna: number): Promise<RandZi[]> {
  return toate<RandZi>(db, `SELECT ${COLOANE} FROM zile WHERE an = ? AND luna = ? ORDER BY data`, [an, luna])
}

export async function randurileAnului(db: D1Database, an: number): Promise<RandZi[]> {
  return toate<RandZi>(db, `SELECT ${COLOANE} FROM zile WHERE an = ? ORDER BY data`, [an])
}

export async function randuriInterval(db: D1Database, deLa: string, panaLa: string): Promise<RandZi[]> {
  return toate<RandZi>(db, `SELECT ${COLOANE} FROM zile WHERE data >= ? AND data <= ? ORDER BY data`, [deLa, panaLa])
}

export interface Import {
  an: number
  sursa: string
  endpoint: string
  zile: number
  octeti: number
  preluat_la: string
  importat_la: string
}

export async function importurile(db: D1Database): Promise<Import[]> {
  return toate<Import>(db, `SELECT * FROM importuri ORDER BY an`)
}

export async function aniPreluati(db: D1Database): Promise<number[]> {
  const r = await toate<{ an: number }>(db, `SELECT DISTINCT an FROM zile ORDER BY an`)
  return r.map((x) => x.an)
}

export interface Versiune {
  id: number
  moment: string
  de_la: string
  pana_la: string
  motiv: string
  autor: string | null
}

export async function versiunile(db: D1Database): Promise<Versiune[]> {
  return toate<Versiune>(db, `SELECT * FROM versiuni ORDER BY moment DESC, id DESC LIMIT 200`)
}

/**
 * `versiune_calendar` = ziua (la Bucuresti) a ultimei schimbari + numarul ei din ziua aceea.
 * Schimbarile sunt randurile din `versiuni` (preluari de an + corecturi).
 */
export async function versiuneaCalendarului(db: D1Database): Promise<{ versiune: string; moment: string | null }> {
  const randuri = await toate<{ moment: string }>(db, `SELECT moment FROM versiuni ORDER BY moment ASC, id ASC`)
  if (!randuri.length) return { versiune: '0000-00-00.0', moment: null }
  const ultim = randuri[randuri.length - 1]!.moment
  const ziuaUltimei = aziBucuresti(new Date(ultim))
  const n = randuri.filter((r) => aziBucuresti(new Date(r.moment)) === ziuaUltimei).length
  return { versiune: `${ziuaUltimei}.${n}`, moment: ultim }
}

/** Versiunile de dupa o versiune data, ca intervale de recitit. */
export async function schimbariDupa(db: D1Database, dupa: string): Promise<Versiune[]> {
  const toateV = await toate<Versiune>(db, `SELECT * FROM versiuni ORDER BY moment ASC, id ASC`)
  const [zi, nrText] = dupa.split('.')
  const nr = Number(nrText ?? '0')
  let vazute = 0
  const iesire: Versiune[] = []
  for (const v of toateV) {
    const ziuaV = aziBucuresti(new Date(v.moment))
    if (!zi || ziuaV > zi) iesire.push(v)
    else if (ziuaV === zi) {
      vazute++
      if (vazute > nr) iesire.push(v)
    }
  }
  return iesire
}

export async function textulZilei(db: D1Database, data: string): Promise<string | null> {
  const r = await unul<{ sinaxar: string | null }>(db, `SELECT sinaxar FROM texte WHERE data = ?`, [data])
  return r?.sinaxar ?? null
}

/** Cautare in titluri, fara diacritice si fara majuscule; cel mult 100 de rezultate. */
export async function cauta(db: D1Database, q: string, an?: number): Promise<RandZi[]> {
  const randuri = an ? await randurileAnului(db, an) : await toate<RandZi>(db, `SELECT ${COLOANE} FROM zile ORDER BY data`)
  const ac = faraDiacritice(q)
  return randuri.filter((r) => faraDiacritice(r.titlu).includes(ac)).slice(0, 100)
}

export async function zileleCuCruce(db: D1Database, an: number, cruce: 'rosie' | 'neagra'): Promise<RandZi[]> {
  return toate<RandZi>(db, `SELECT ${COLOANE} FROM zile WHERE an = ? AND cruce = ? ORDER BY data`, [an, cruce])
}

// ---------------------------------------------------------------------------
// Anii calculati: referintele se tin in memoria izolatului
// ---------------------------------------------------------------------------

let referinteCache: { la: number; referinte: Referinte } | null = null

export async function referintele(db: D1Database): Promise<Referinte> {
  if (referinteCache && Date.now() - referinteCache.la < 10 * 60 * 1000) return referinteCache.referinte
  const ani = await aniPreluati(db)
  const referinte: Referinte = new Map()
  for (const an of ani) {
    const m = new Map<string, RandZi>()
    for (const r of await randurileAnului(db, an)) m.set(r.data.slice(5), r)
    referinte.set(an, m)
  }
  referinteCache = { la: Date.now(), referinte }
  return referinte
}

/** Un an se poate calcula daca e cu cel mult doi ani peste ultimul preluat si exista macar un an preluat. */
export function sePoateCalcula(an: number, aniPreluatiLista: number[]): boolean {
  if (!aniPreluatiLista.length) return false
  const ultim = Math.max(...aniPreluatiLista)
  return an > ultim && an <= ultim + 2 && an >= 1900 && an <= 2099
}

const anCompusCache = new Map<number, { la: number; zile: RandZi[] }>()

export async function zileleAnuluiCalculat(db: D1Database, an: number): Promise<RandZi[]> {
  const gata = anCompusCache.get(an)
  if (gata && Date.now() - gata.la < 10 * 60 * 1000) return gata.zile
  const compus = compuneAnul(an, await referintele(db))
  anCompusCache.set(an, { la: Date.now(), zile: compus.zile })
  return compus.zile
}

/** Randul unei zile: din baza daca e preluata, altfel calculat, altfel null. */
export async function randulOriCalculat(db: D1Database, data: string, ani: number[]): Promise<RandZi | null> {
  const an = anul(data)
  if (ani.includes(an)) return randulZilei(db, data)
  if (!sePoateCalcula(an, ani)) return null
  const zile = await zileleAnuluiCalculat(db, an)
  return zile.find((z) => z.data === data) ?? null
}

// ---------------------------------------------------------------------------
// Scrieri
// ---------------------------------------------------------------------------

export const CAMPURI_CORECTABILE = ['titlu', 'titlu_html', 'subtitlu', 'cruce', 'cruce_text', 'post', 'perioada', 'evanghelia', 'apostolul', 'zi_libera', 'nunti', 'parastase'] as const
export type CampCorectabil = (typeof CAMPURI_CORECTABILE)[number]

/** O corectura scrisa de mana peste sursa: schimba campul, pastreaza valoarea veche, deschide o versiune. */
export async function corecteaza(
  db: D1Database,
  data: string,
  camp: CampCorectabil,
  valoareNoua: string,
  motiv: string,
  autor: string,
  declaratiiInPlus: D1PreparedStatement[] = [],
): Promise<{ veche: string | null }> {
  const rand = await unul<Record<string, unknown>>(db, `SELECT ${camp} AS v FROM zile WHERE data = ?`, [data])
  if (!rand) throw new Error('ziua nu e preluată')
  const veche = rand.v === null || rand.v === undefined ? null : String(rand.v)
  const numerica = camp === 'zi_libera' || camp === 'nunti' || camp === 'parastase'
  const moment = acum()
  await batch(db, [
    db.prepare(`UPDATE zile SET ${camp} = ? WHERE data = ?`).bind(numerica ? Number(valoareNoua) || 0 : valoareNoua, data),
    db
      .prepare(`INSERT INTO corecturi (data, camp, valoare_veche, valoare_noua, motiv, autor, moment) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(data, camp, veche, valoareNoua, motiv, autor, moment),
    db.prepare(`INSERT INTO versiuni (moment, de_la, pana_la, motiv, autor) VALUES (?, ?, ?, ?, ?)`).bind(moment, data, data, `corectură ${camp}: ${motiv}`, autor),
    ...declaratiiInPlus,
  ])
  referinteCache = null
  anCompusCache.clear()
  return { veche }
}

export async function corecturile(db: D1Database): Promise<Array<{ data: string; camp: string; valoare_veche: string | null; valoare_noua: string | null; motiv: string; autor: string | null; moment: string }>> {
  return toate(db, `SELECT data, camp, valoare_veche, valoare_noua, motiv, autor, moment FROM corecturi ORDER BY moment DESC LIMIT 100`)
}

/** Scrie un an preluat (randuri + texte) si provenienta, in loturi. */
export async function scrieAnul(
  db: D1Database,
  an: number,
  randuri: Array<{ rand: RandZi; sinaxar: string | null }>,
  provenienta: { sursa: string; endpoint: string; octeti: number; preluat_la: string },
): Promise<void> {
  const LOT = 40
  for (let i = 0; i < randuri.length; i += LOT) {
    const lot = randuri.slice(i, i + LOT)
    const declaratii: D1PreparedStatement[] = []
    for (const { rand, sinaxar } of lot) {
      const r = rand as unknown as Record<string, string | number | null>
      const coloane = COLOANE.split(',').map((c) => c.trim())
      declaratii.push(
        db
          .prepare(`INSERT OR REPLACE INTO zile (${coloane.join(', ')}) VALUES (${coloane.map(() => '?').join(', ')})`)
          .bind(...coloane.map((c) => r[c] ?? null)),
        db.prepare(`INSERT OR REPLACE INTO texte (data, sinaxar, preluat_la) VALUES (?, ?, ?)`).bind(rand.data, sinaxar, rand.preluat_la),
      )
    }
    await batch(db, declaratii)
  }
  const moment = acum()
  const prima = randuri[0]?.rand.data ?? `${an}-01-01`
  const ultima = randuri[randuri.length - 1]?.rand.data ?? `${an}-12-31`
  await batch(db, [
    db
      .prepare(`INSERT OR REPLACE INTO importuri (an, sursa, endpoint, zile, octeti, preluat_la, importat_la) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(an, provenienta.sursa, provenienta.endpoint, randuri.length, provenienta.octeti, provenienta.preluat_la, moment),
    db
      .prepare(`INSERT INTO versiuni (moment, de_la, pana_la, motiv, autor) VALUES (?, ?, ?, ?, 'import')`)
      .bind(moment, prima, ultima, `preluare an ${an} (sursa preluată la ${provenienta.preluat_la})`),
  ])
  referinteCache = null
  anCompusCache.clear()
}
