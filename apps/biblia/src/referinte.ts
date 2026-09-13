/**
 * Referintele si scoaterea versetelor — codul V1, mutat aici cuvant cu cuvant (regulile de citire
 * a unei referinte sunt ale cartii, nu ale platformei; se schimba doar cand se schimba cartea).
 */
import type { Carte, CarteIndex, Index } from "./depozit.js"

/** Fara diacritice si fara majuscule — ca sa se caute „manastire" si sa gaseasca „mănăstire". */
export function plat(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[șş]/gi, "s")
    .replace(/[țţ]/gi, "t")
    .toLowerCase()
}

export interface Interval {
  capitol: number
  de_la: number | null
  pana_la: number | null
}

/**
 * Referinta scrisa cum o scrie omul sau cum o tipareste tipicul:
 *   „Ioan 3, 16-18" · „In 3,16" · „1 Corinteni 13"
 *   „Luca 1, 1-25, 57-68, 76, 80"  — versete discontinue din acelasi capitol
 *   „Evrei 12, 28-13, 8"           — trecere peste capitol (12:28 pana la 13:8)
 *   „Galateni 5, 22 - 6, 2"        — la fel, cu spatii sau en-dash
 *   „Luca 10, 38-42 și 11, 27-28"  — doua pericope legate cu „și"
 * Intoarce cartea si lista de intervale (capitol + de_la..pana_la).
 * Trecerea peste capitol se recunoaste dupa „a-b" cu b < a urmat de restul — un interval intors
 * nu exista, deci b-ul mai mic e un numar de capitol.
 */
export function citesteRef(ref: string, ix: Index): { carte: CarteIndex; intervale: Interval[] } | null {
  const s = ref
    .replace(/ /g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+(și|si)\s+/gi, "; ")
    .trim()
  const m = s.match(/^(.+?)\s+(\d[\d\s,;:.\-]*)$/)
  if (!m) return null
  const n = plat(m[1]!).replace(/\.$/, "").trim()
  const c =
    ix.carti.find((x) => plat(x.nume) === n) ??
    ix.carti.find((x) => x.slug === n.replace(/\s+/g, "-")) ??
    ix.carti.find((x) => plat(x.nume).startsWith(n)) ??
    ix.carti.find((x) => plat(x.nume).replace(/\s+/g, "").startsWith(n.replace(/\s+/g, "")))
  if (!c) return null

  const intervale: Interval[] = []
  for (const grup of m[2]!.replace(/[:.]/g, ",").split(";")) {
    const parti = grup.split(",").map((x) => x.trim()).filter(Boolean)
    if (parti.length === 0) continue
    let cap = Number(parti[0])
    if (!Number.isInteger(cap)) return null
    if (parti.length === 1) {
      intervale.push({ capitol: cap, de_la: null, pana_la: null })
      continue
    }
    let continuare = false // tocmai am trecut intr-un capitol nou, urmeaza versetul de sfarsit
    for (const seg of parti.slice(1)) {
      const t = seg.match(/^(\d+)(?:\s*-\s*(\d+))?$/)
      if (!t) return null
      const a = Number(t[1])
      const b = t[2] ? Number(t[2]) : null
      if (continuare) {
        intervale.push({ capitol: cap, de_la: 1, pana_la: b ?? a })
        continuare = false
      } else if (b !== null && b < a) {
        intervale.push({ capitol: cap, de_la: a, pana_la: null })
        cap = b
        continuare = true
      } else {
        intervale.push({ capitol: cap, de_la: a, pana_la: b ?? a })
      }
    }
    if (continuare) intervale.push({ capitol: cap, de_la: 1, pana_la: null })
  }
  if (intervale.length === 0) return null
  return { carte: c, intervale }
}

export interface Verset {
  numar: number
  text: string
  capitol: number
}

/** Versetele cerute, in ordine; `capitol` insoteste fiecare verset. */
export function extrage(c: Carte, intervale: Interval[]): Verset[] {
  const iesire: Verset[] = []
  for (const iv of intervale) {
    const cap = c.capitole[iv.capitol - 1]
    if (!cap) continue
    const numere = Object.keys(cap).map(Number).sort((x, y) => x - y)
    const a = iv.de_la ?? 1
    const b = iv.pana_la ?? numere[numere.length - 1] ?? 0
    for (const nr of numere) {
      if (nr >= a && nr <= b) iesire.push({ numar: nr, text: cap[String(nr)]!, capitol: iv.capitol })
    }
  }
  return iesire
}
