/**
 * Legatura cu calendarul (A1): programul NU recalculeaza nimic din ziua liturgica — o cere prin
 * legatura de serviciu si o afiseaza. Cand calendarul tace, tine ultima versiune buna.
 *
 * Pentru arhiva (2014 → primul an oficial), zilele se IMPRUMUTA din anul curent: sfintii cu data
 * fixa sunt aceiasi in orice an; numele duminicii, glasul si pericopele NU se imprumuta, iar ziua
 * e insemnata `aproximativ` (decizie user, 8 sept. 2026: „oriunde navighez sărbătorile cu roșu să
 * se vadă cu roșu — dacă nu ai calendarul 2017, ia reper anul curent").
 */
import type { Rang, ZiLiturgica } from '@xc/contracts'
import { adaugaZile, aziBucuresti, faraDiacritice, ziuaSaptamanii, ZILE_SAPTAMANA_COD } from '@xc/ui'

export interface ZiPeProgram extends ZiLiturgica {
  aproximativ?: boolean
}

export interface CalendarSaptamana {
  zile: Map<string, ZiPeProgram>
  versiune: string | null
  vechi: boolean
}

export const ORDINE_RANG: Record<Rang, number> = {
  praznic_imparatesc: 6,
  cruce_rosie: 5,
  cruce_albastra: 4,
  cruce_neagra: 3,
  cruce_nedeclarata: 2,
  simplu: 1,
}

const ultimaBuna = new Map<string, { zile: ZiPeProgram[]; versiune: string | null }>()

async function cereInterval(calendar: Fetcher, deLa: string, panaLa: string): Promise<{ zile: ZiPeProgram[]; versiune: string | null; vechi: boolean } | null> {
  const cheie = `${deLa}/${panaLa}`
  try {
    const r = await calendar.fetch(`https://calendar.intern/v1/interval?de_la=${deLa}&pana_la=${panaLa}`)
    if (r.ok) {
      const j = (await r.json()) as { versiune_calendar?: string; zile?: ZiPeProgram[] }
      const zile = j.zile ?? []
      ultimaBuna.set(cheie, { zile, versiune: j.versiune_calendar ?? null })
      return { zile, versiune: j.versiune_calendar ?? null, vechi: false }
    }
  } catch {
    // cadem pe ultima versiune buna
  }
  const veche = ultimaBuna.get(cheie)
  return veche ? { ...veche, vechi: true } : null
}

const MUTATOARE = ['intrarea domnului in ierusalim', 'invierea domnului', 'inaltarea domnului', 'pogorarea sfantului duh', 'sfintele pasti', 'sfanta treime']

/** Copia unei zile de reper pe alta data: raman sfintii si titlul; cad numele duminicii, glasul, pericopele. */
function dupaReper(reper: ZiPeProgram, data: string): ZiPeProgram {
  const sfinti = reper.sfinti.filter((s) => !MUTATOARE.some((m) => faraDiacritice(s.nume).startsWith(m)))
  let rang: Rang = 'simplu'
  for (const s of sfinti) if (ORDINE_RANG[s.rang] > ORDINE_RANG[rang]) rang = s.rang
  return {
    ...reper,
    data,
    zi_saptamana: ZILE_SAPTAMANA_COD[ziuaSaptamanii(data)]!,
    denumire: null,
    glas: null,
    evanghelia_invierii: null,
    pericope: { apostol: null, evanghelie: null },
    sfinti,
    rang,
    aproximativ: true,
  }
}

/**
 * Zilele intervalului, cu imprumut din anul curent pentru ce lipseste (arhiva veche). Se cer cel
 * mult doua intervale de reper (o saptamana calare pe 31 dec. da doua bucati).
 */
export async function calendarulIntervalului(calendar: Fetcher, deLa: string, panaLa: string): Promise<CalendarSaptamana | null> {
  const direct = await cereInterval(calendar, deLa, panaLa)
  if (!direct) return null
  const zile = new Map<string, ZiPeProgram>()
  for (const z of direct.zile) zile.set(z.data, z)

  // ce lipseste se imprumuta din anul curent
  const anCurent = Number(aziBucuresti().slice(0, 4))
  const lipsa: string[] = []
  for (let d = deLa; d <= panaLa; d = adaugaZile(d, 1)) if (!zile.has(d)) lipsa.push(d)
  if (lipsa.length) {
    const perechi = lipsa
      .map((d) => ({ d, reper: `${anCurent}-${d.slice(5)}` }))
      .filter((p) => p.d.slice(5) !== '02-29')
    // bucati consecutive de reper
    const bucati: Array<{ deLa: string; panaLa: string }> = []
    for (const p of perechi) {
      const ultima = bucati[bucati.length - 1]
      if (ultima && adaugaZile(ultima.panaLa, 1) === p.reper) ultima.panaLa = p.reper
      else bucati.push({ deLa: p.reper, panaLa: p.reper })
    }
    for (const b of bucati) {
      const r = await cereInterval(calendar, b.deLa, b.panaLa)
      if (!r) continue
      const peData = new Map(r.zile.map((z) => [z.data, z]))
      for (const p of perechi) {
        if (p.reper < b.deLa || p.reper > b.panaLa) continue
        const reper = peData.get(p.reper)
        if (reper) zile.set(p.d, dupaReper(reper, p.d))
      }
    }
  }
  return { zile, versiune: direct.versiune, vechi: direct.vechi }
}

export async function ziuaCalendarului(calendar: Fetcher, data: string): Promise<ZiPeProgram | null> {
  try {
    const r = await calendar.fetch(`https://calendar.intern/v1/zi/${data}`)
    if (!r.ok) return null
    return (await r.json()) as ZiPeProgram
  } catch {
    return null
  }
}

export async function texteleZilei(calendar: Fetcher, data: string): Promise<{ sinaxar: string | null; titlu_html: string } | null> {
  try {
    const r = await calendar.fetch(`https://calendar.intern/v1/texte/${data}`)
    if (!r.ok) return null
    return (await r.json()) as { sinaxar: string | null; titlu_html: string }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Ce e „mare" intr-o zi si cum se potriveste cu un rand scris de mana
// ---------------------------------------------------------------------------

export function sfintiiRosii(z: ZiPeProgram) {
  return z.sfinti.filter((s) => ORDINE_RANG[s.rang] >= ORDINE_RANG.cruce_rosie)
}
export function ziRosie(z: ZiPeProgram): boolean {
  return ORDINE_RANG[z.rang] >= ORDINE_RANG.cruce_rosie || sfintiiRosii(z).length > 0
}
export function numeZi(z: ZiPeProgram): string[] {
  return [...z.sfinti.map((s) => s.nume), ...(z.denumire ? [z.denumire] : [])]
}
export function ziuaMare(z: ZiPeProgram): string | null {
  return sfintiiRosii(z)[0]?.nume ?? z.denumire
}

export function dezbracat(s: string): string {
  return faraDiacritice(s.replace(/^\s*(\(†\)|†\)|†)\s*/, ''))
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function cuprinde(a: string, b: string): boolean {
  const ca = a.split(' ')
  const cb = b.split(' ')
  return ca.every((x) => cb.some((y) => y === x || y.startsWith(x) || x.startsWith(y)))
}

/** „E o sarbatoare cu rosu?" pentru un rand „→" scris de mana. */
export function probaMare(mari: string[]): (text: string) => boolean {
  const m = mari.map(dezbracat).filter((x) => x.length > 6)
  return (text: string) => {
    const n = dezbracat(text)
    if (n.length <= 6) return false
    return m.some((x) => x === n || x.includes(n) || n.includes(x) || cuprinde(n, x) || cuprinde(x, n))
  }
}

export function numeMari(z: ZiPeProgram): string[] {
  const nume = sfintiiRosii(z).map((s) => s.nume)
  if (z.denumire && ORDINE_RANG[z.rang] >= ORDINE_RANG.cruce_rosie) nume.push(z.denumire)
  return nume
}

/** Randurile de sub slujba de seara care doar repeta sarbatoarea de maine cad. */
export function faraSarbatoareaDeMaine(detalii: string[], numeleDeMaine: string[]): string[] {
  const proba = probaMare(numeleDeMaine)
  return detalii.filter((d) => !proba(d))
}

/** Randurile duminicii, din calendar: pericope + glas, numele duminicii, TOTI sfintii. */
export function randurileDuminicii(z: ZiPeProgram): string[] {
  const iesire: string[] = []
  const cap: string[] = []
  if (z.pericope.apostol) cap.push(`Ap. ${z.pericope.apostol}`)
  if (z.pericope.evanghelie) cap.push(`Ev. ${z.pericope.evanghelie}`)
  if (z.glas) cap.push(`glas ${z.glas}${z.evanghelia_invierii ? `, voscr. ${z.evanghelia_invierii}` : ''}`)
  if (cap.length) iesire.push(cap.join('; '))
  if (z.denumire) iesire.push(z.denumire)
  for (const s of z.sfinti) iesire.push(s.nume)
  return iesire
}
