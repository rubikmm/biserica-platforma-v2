/**
 * Propunerea saptamanii, din PATRU izvoare: obiceiul ultimelor 52 de saptamani, aceeasi data in anii
 * trecuti, PRIVEGHERILE din anii trecuti (12.09.2026) si calendarul (praznice, cruci rosii, ajunul
 * lor). Nu se salveaza; arata motivele.
 *
 * La sfarsit se face o CURATARE: privegherea tine locul slujbelor pe care le cuprinde ea insasi —
 * vecernia din aceeasi seara si, cand are Liturghie, slujba de dimineata a zilei urmatoare.
 *
 * Randurile duminicii (pericope, numele duminicii, sfintii) NU intra in `detalii`: vin din calendar
 * la afisare, mereu la zi. In detalii raman doar numele praznicului care a cerut slujba.
 */
import type { IntrareVocabular, Slujba } from '@xc/contracts'
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

/** Numele scrise in `detalii` (JSON) — la privegheri, sfantul pentru care s-a stat noaptea. */
function numeleDin(detalii: string | null): string[] {
  if (!detalii) return []
  try {
    const d: unknown = JSON.parse(detalii)
    return Array.isArray(d) ? d.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []
  } catch {
    return []
  }
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

  // ---------------------------------------------------------------------------
  // Izvorul 3: PRIVEGHERILE din anii trecuti (user, 12.09.2026, 14:55)
  // ---------------------------------------------------------------------------
  // ⚠️ PRAGUL E UNU, nu „de mai multe ori" (user, 15:18: „pragul pentru o priveghere nu e să fie de
  // mai multe ci să fi fost măcar o slujbă de la ora 21"). Privegherea nu e un obicei saptamanal, e
  // o hotarare: daca s-a stat o data noaptea la un sfant, merita amintita la anul. De aceea izvorul
  // 2 (aceeasi data in anii trecuti) nu le prindea — el cere doua apariti si jumatate din ani, iar
  // privegherile sunt rare si impartite pe trei coduri.
  //
  // ⚠️ CUM SE RECUNOASTE una: ora de la 21:00 in sus ORI codul care spune el insusi „priveghere".
  // Ora e semnul adevarat (asa a spus utilizatorul), dar `priveghere_utrenia` se tine de la 18:00 si
  // s-ar pierde daca ne-am lua numai dupa ceas.
  //
  // Se propune slujba care CHIAR a fost — acelasi cod, aceeasi ora —, nu o priveghere inchipuita.
  const ePriveghere = (s: RandIstoricSlujba) => s.ora >= '21:00' || s.cod_nume.startsWith('priveghere')
  const privPeData = new Map<string, { ani: Set<string>; coduri: Map<string, string[]>; detalii: Set<string> }>()
  for (const s of istoric) {
    if (!ePriveghere(s)) continue
    const mmdd = s.data.slice(5)
    const x = privPeData.get(mmdd) ?? { ani: new Set<string>(), coduri: new Map<string, string[]>(), detalii: new Set<string>() }
    x.ani.add(s.data.slice(0, 4))
    x.coduri.set(s.cod_nume, [...(x.coduri.get(s.cod_nume) ?? []), s.ora])
    for (const d of numeleDin(s.detalii)) x.detalii.add(d)
    privPeData.set(mmdd, x)
  }
  const zileCuPriveghere = new Set<string>()
  for (const data of zileSapt) {
    const x = privPeData.get(data.slice(5))
    if (!x) continue
    // cand s-au tinut mai multe feluri de-a lungul anilor, il alegem pe cel mai des
    const [cod, ore] = [...x.coduri.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0]!
    const ani = [...x.ani].sort()
    zileCuPriveghere.add(data)
    pune(data, moda(ore), cod, `priveghere: în ${ani.join(', ')}`, Math.min(0.9, 0.45 + 0.1 * ani.length), [...x.detalii])
  }

  // Izvorul 4: calendarul — praznice, cruci rosii, ajunul lor
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

  // ---------------------------------------------------------------------------
  // ⚠️ CURATAREA: privegherea nu se dubleaza cu slujbele pe care le cuprinde ea insasi
  // ---------------------------------------------------------------------------
  // Asa s-a facut dintotdeauna, si se vede in arhiva: dupa `priveghere_liturghie` (21:00) a doua zi
  // NU se mai face Liturghie, fiindca privegherea o cuprinde; dupa `priveghere_utrenia` (18:00) a
  // doua zi urmeaza `ceasurile_liturghie` la 08:00, fiindca aceea tine doar pana la Utrenie.
  // Fara pasul asta, propunerea ar fi scris si vecernia din calendar in aceeasi seara, si Liturghia
  // de a doua zi — adica de doua ori aceeasi slujba.
  for (const data of zileCuPriveghere) {
    const priv = [...slujbe.values()].find((s) => s.data === data && (s.ora >= '21:00' || s.cod_nume.startsWith('priveghere')))
    if (!priv) continue
    for (const [cheie, s] of slujbe) {
      if (s.data === data && s.cod_nume !== priv.cod_nume && vocabular.get(s.cod_nume)?.categorie === 'seara') slujbe.delete(cheie)
    }
    if (!priv.cod_nume.includes('liturghie')) continue
    const maine = adaugaZile(data, 1)
    // ⚠️ Duminica dimineata NU se atinge niciodata. In toata arhiva nu e nicio priveghere sambata
    // seara (cele de la sfarsit de saptamana sunt duminica seara, pentru luni), deci cazul asta n-a
    // fost vazut — iar a sterge din greseala Liturghia duminicii ar fi cea mai urata greseala cu putinta.
    if (ziuaSaptamanii(maine) === 0) continue
    for (const [cheie, s] of slujbe) {
      if (s.data === maine && vocabular.get(s.cod_nume)?.categorie === 'dimineata') slujbe.delete(cheie)
    }
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

/**
 * Propunerea facuta SLUJBE, dintr-un singur loc: si foaia saptamanii, si raspunsul din chat au
 * nevoie de aceeasi lista. Cat timp maparea era scrisa de doua ori, cuvant cu cuvant, se putea
 * schimba numai una dintre ele.
 *
 * ⚠️ `transmisie` NU e un fleac de afisare: aparatul din biserica porneste transmisiunea numai dupa
 * campul asta, iar propunerea ajunge in baza exact cum e aici, in clipa in care omul o valideaza din
 * chat. Cat timp aici scria `false` fix, din 15.09.2026 — prima saptamana validata din propunere —
 * n-a mai pornit nicio transmisiune, in tacere. Acum e ADEVARAT MEREU, hotarare a userului
 * (18.09.2026): nu se ghiceste din obiceiul slujbelor trecute. Cine nu vrea transmisiune la o slujba
 * anume o stinge din chat — `program.modifica_slujba` primeste `transmisie`.
 *
 * `curatenie` ramane fals, ca pana acum: nu se propune singura.
 */
export function slujbeDinPropunere(p: Propunere): Slujba[] {
  return p.zile.flatMap((zi) =>
    zi.slujbe.map((s) => ({
      id: `${s.data}-${s.cod_nume}`,
      data: s.data,
      ora: s.ora,
      nume: s.nume,
      cod_nume: s.cod_nume,
      slujitor: null,
      loc: 'biserica',
      observatii: null,
      detalii: s.detalii,
      curatenie: false,
      transmisie: true,
    })),
  )
}
