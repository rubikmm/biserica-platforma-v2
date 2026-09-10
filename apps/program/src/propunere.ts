/**
 * Propunerea saptamanii: din obiceiul ultimelor 52 de saptamani, din aceeasi data in anii trecuti
 * si din calendar (praznice, cruci rosii, ajunul lor). Nu se salveaza; arata motivele.
 *
 * Randurile duminicii (pericope, numele duminicii, sfintii) NU intra in `detalii`: vin din calendar
 * la afisare, mereu la zi. In detalii raman doar numele praznicului care a cerut slujba.
 */
import type { IntrareVocabular } from '@xc/contracts'
import { adaugaZile, ziuaSaptamanii, LUNI_SCURT } from '@xc/ui'
import { type CalendarSaptamana, ORDINE_RANG, ziuaMare } from './calendar.js'
import type { RandIstoricSlujba } from './depozit.js'

export interface SlujbaPropusa {
  data: string
  ora: string
  cod_nume: string
  nume: string
  detalii: string[]
  motive: string[]
  incredere: number
}

export interface Propunere {
  luni: string
  duminica: string
  zile: Array<{ data: string; slujbe: SlujbaPropusa[] }>
  despre: { saptamani_obicei: number; ani_aceeasi_data: number; calendar: boolean; versiune_calendar: string | null }
  nelamuriri: string[]
}

function moda(ore: string[]): string {
  const n = new Map<string, number>()
  for (const o of ore) n.set(o, (n.get(o) ?? 0) + 1)
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? '07:00'
}

export function propune(luni: string, istoric: RandIstoricSlujba[], vocabular: Map<string, IntrareVocabular>, cal: CalendarSaptamana | null): Propunere {
  const duminica = adaugaZile(luni, 6)
  const zileSapt = Array.from({ length: 7 }, (_, i) => adaugaZile(luni, i))
  const slujbe = new Map<string, SlujbaPropusa>()
  const nelamuriri: string[] = []

  const pune = (data: string, ora: string, cod: string, motiv: string, incredere: number, detalii: string[] = []) => {
    const cheie = `${data}|${cod}`
    const existent = slujbe.get(cheie)
    const nume = vocabular.get(cod)?.nume ?? cod
    if (existent) {
      existent.motive.push(motiv)
      existent.incredere = Math.max(existent.incredere, incredere)
      for (const d of detalii) if (!existent.detalii.includes(d)) existent.detalii.push(d)
      if (existent.ora !== ora) nelamuriri.push(`${data}: ${nume} — ora ${existent.ora} sau ${ora}? (izvoare diferite)`)
      return
    }
    slujbe.set(cheie, { data, ora, cod_nume: cod, nume, detalii: [...detalii], motive: [motiv], incredere })
  }

  // Izvorul 1: obiceiul saptamanal (ultimele 52 de saptamani cu program)
  const luniDistincte = [...new Set(istoric.map((s) => s.luni))].sort()
  const ultimele = new Set(luniDistincte.slice(-52))
  const peZiCod = new Map<string, { ore: string[]; saptamani: Set<string> }>()
  for (const s of istoric) {
    if (!ultimele.has(s.luni)) continue
    const cheie = `${ziuaSaptamanii(s.data)}|${s.cod_nume}`
    const x = peZiCod.get(cheie) ?? { ore: [], saptamani: new Set<string>() }
    x.ore.push(s.ora)
    x.saptamani.add(s.luni)
    peZiCod.set(cheie, x)
  }
  const N = ultimele.size || 1
  for (const [cheie, x] of peZiCod) {
    const frecventa = x.saptamani.size / N
    if (frecventa < 0.5) continue
    const [zs, cod] = cheie.split('|') as [string, string]
    const data = zileSapt.find((d) => ziuaSaptamanii(d) === Number(zs))
    if (!data) continue
    pune(data, moda(x.ore), cod, `obicei: în ${x.saptamani.size} din ultimele ${N} săptămâni`, frecventa)
  }

  // Izvorul 2: aceeasi data in anii trecuti
  const peDataCod = new Map<string, Map<string, string[]>>()
  const aniCuProgramPeData = new Map<string, Set<string>>()
  for (const s of istoric) {
    const mmdd = s.data.slice(5)
    const an = s.data.slice(0, 4)
    // anii in care a existat program in saptamana care contine acea zi-si-luna
    for (let i = 0; i < 7; i++) {
      const d = adaugaZile(s.luni, i)
      const set = aniCuProgramPeData.get(d.slice(5)) ?? new Set<string>()
      set.add(an)
      aniCuProgramPeData.set(d.slice(5), set)
    }
    const coduri = peDataCod.get(mmdd) ?? new Map<string, string[]>()
    const ore = coduri.get(s.cod_nume) ?? []
    ore.push(s.ora)
    coduri.set(s.cod_nume, ore)
    peDataCod.set(mmdd, coduri)
  }
  let aniAceeasiData = 0
  for (const data of zileSapt) {
    const mmdd = data.slice(5)
    const ani = aniCuProgramPeData.get(mmdd)?.size ?? 0
    const coduri = peDataCod.get(mmdd)
    if (!coduri || ani < 2) continue
    aniAceeasiData = Math.max(aniAceeasiData, ani)
    for (const [cod, ore] of coduri) {
      if (ore.length < 2 || ore.length / ani < 0.5) continue
      const [, l, z] = data.split('-').map(Number) as [number, number, number]
      pune(data, moda(ore), cod, `pe ${z} ${LUNI_SCURT[l - 1]}, în ${ore.length} din ${ani} ani`, ore.length / ani)
    }
  }

  // Izvorul 3: calendarul — praznice, cruci rosii, ajunul lor
  if (cal) {
    const oreLiturghie = istoric.filter((s) => ziuaSaptamanii(s.data) !== 0 && vocabular.get(s.cod_nume)?.categorie === 'dimineata').map((s) => s.ora)
    const oreVecernie = istoric.filter((s) => s.cod_nume === 'vecernia_litia').map((s) => s.ora)
    const oraLiturghie = oreLiturghie.length ? moda(oreLiturghie) : '07:00'
    const oraVecernie = oreVecernie.length ? moda(oreVecernie) : '18:00'
    const zileCuLuneaDeDupa = [...zileSapt, adaugaZile(duminica, 1)]
    for (const data of zileCuLuneaDeDupa) {
      const z = cal.zile.get(data)
      if (!z || ORDINE_RANG[z.rang] < ORDINE_RANG.cruce_rosie) continue
      const nume = ziuaMare(z) ?? z.titlu
      const eticheta = z.rang === 'praznic_imparatesc' ? 'praznic împărătesc' : 'cruce roșie'
      const inSaptamana = data <= duminica
      if (inSaptamana) {
        const areDimineata = [...slujbe.values()].some((s) => s.data === data && vocabular.get(s.cod_nume)?.categorie === 'dimineata')
        if (!areDimineata) pune(data, oraLiturghie, 'utrenia_liturghie', `calendar: ${eticheta} — ${nume}`, 0.7, [nume])
        else for (const s of slujbe.values()) if (s.data === data && vocabular.get(s.cod_nume)?.categorie === 'dimineata') { if (!s.detalii.includes(nume)) s.detalii.push(nume); s.motive.push(`calendar: ${eticheta} — ${nume}`) }
      }
      const ajun = adaugaZile(data, -1)
      if (ajun >= luni && ajun <= duminica) {
        const areSeara = [...slujbe.values()].some((s) => s.data === ajun && vocabular.get(s.cod_nume)?.categorie === 'seara')
        if (!areSeara) pune(ajun, oraVecernie, 'vecernia_litia', `calendar: în ajun de ${nume}`, 0.6, [nume])
        else for (const s of slujbe.values()) if (s.data === ajun && vocabular.get(s.cod_nume)?.categorie === 'seara' && !s.detalii.includes(nume)) s.detalii.push(nume)
      }
    }
  } else {
    nelamuriri.push('Calendarul n-a răspuns: propunerea nu știe de praznicele săptămânii.')
  }

  const toateSlujbele = [...slujbe.values()].sort((a, b) => a.data.localeCompare(b.data) || a.ora.localeCompare(b.ora))
  const zile = zileSapt.map((data) => ({ data, slujbe: toateSlujbele.filter((s) => s.data === data) })).filter((z) => z.slujbe.length)
  return {
    luni,
    duminica,
    zile,
    despre: { saptamani_obicei: ultimele.size, ani_aceeasi_data: aniAceeasiData, calendar: !!cal, versiune_calendar: cal?.versiune ?? null },
    nelamuriri: [...new Set(nelamuriri)],
  }
}
