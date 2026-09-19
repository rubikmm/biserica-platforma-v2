#!/usr/bin/env node
/**
 * LĂȚIMILE LITERELOR DIN TRAJAN, citite din font — de unde vine `LATIMI_TRAJAN` din `masuri.ts`.
 *
 * ⚠️ De ce există unealta și nu doar cifrele: socoteala trebuie să știe pe câte rânduri cade un
 * titlu, iar titlul e Trajan majuscule, nu Caladea justificată — media de 36.67 de semne pe rând a
 * textului nu-l măsoară nicicum. Majusculele inscripționale sunt foarte neegale („I" 0.44 em, „W"
 * 1.10), deci e nevoie de tabelul întreg. Scris aici ca să se poată REFACE: dacă se schimbă fontul
 * titlurilor, cifrele din `masuri.ts` nu se mai ghicesc, se măsoară din nou.
 *
 * Rulare:  node apps/buletin/unelte/masura-trajan.mjs apps/buletin/resurse/TrajanPro3-Regular.otf
 *
 * Citește `head` (unitsPerEm), `hhea` + `hmtx` (lățimile) și `cmap` format 4 (semn → glif). Fără
 * nicio bibliotecă: un OTF e un tabel de tabele, iar aici ne trebuie patru dintre ele.
 */
import { readFileSync } from 'node:fs'

const cale = process.argv[2]
if (!cale) {
  console.error('dă calea fontului: node apps/buletin/unelte/masura-trajan.mjs <font.otf>')
  process.exit(1)
}
const buf = readFileSync(cale)
const u16 = (o) => buf.readUInt16BE(o)
const u32 = (o) => buf.readUInt32BE(o)

const tabele = {}
for (let i = 0; i < u16(4); i++) {
  const o = 12 + i * 16
  tabele[buf.toString('ascii', o, o + 4)] = { off: u32(o + 8), len: u32(o + 12) }
}

const unitsPerEm = u16(tabele.head.off + 18)
const numHMetrics = u16(tabele.hhea.off + 34)
const hmtx = tabele.hmtx.off
// ⚠️ Ultima lățime din `hmtx` se repetă pentru toate glifele de după ea — așa e formatul.
const advance = (gid) => u16(hmtx + (gid < numHMetrics ? gid * 4 : (numHMetrics - 1) * 4))

const cmap = tabele.cmap.off
let sub = null
for (let i = 0; i < u16(cmap + 2); i++) {
  const o = cmap + 4 + i * 8
  const plat = u16(o)
  const enc = u16(o + 2)
  if ((plat === 3 && (enc === 1 || enc === 10)) || plat === 0) sub = cmap + u32(o + 4)
}
if (sub === null || u16(sub) !== 4) throw new Error('nu găsesc un cmap format 4 în font')
const segX2 = u16(sub + 6)
const endO = sub + 14
const startO = endO + segX2 + 2
const deltaO = startO + segX2
const rangeO = deltaO + segX2
const gid = (cp) => {
  for (let s = 0; s < segX2 / 2; s++) {
    if (u16(endO + s * 2) < cp) continue
    if (u16(startO + s * 2) > cp) return 0
    const ro = u16(rangeO + s * 2)
    if (ro === 0) return (cp + buf.readInt16BE(deltaO + s * 2)) & 0xffff
    const g = u16(rangeO + s * 2 + ro + (cp - u16(startO + s * 2)) * 2)
    return g === 0 ? 0 : (g + buf.readInt16BE(deltaO + s * 2)) & 0xffff
  }
  return 0
}

// Semnele care pot ajunge într-un titlu de buletin: alfabetul cu diacriticele românești, cifrele
// și punctuația folosită pe foaie. Ce lipsește din font se scrie `null`, ca să se vadă.
const SEMNE = `ABCDEFGHIJKLMNOPQRSTUVWXYZĂÂÎȘȚÄÖÜÉÈ 0123456789.,:;!?'"()[]-–—„”«»/&+`
const lat = {}
for (const c of SEMNE) {
  const g = gid(c.codePointAt(0))
  lat[c] = g ? Number((advance(g) / unitsPerEm).toFixed(3)) : null
}

const litere = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const medie = litere.split('').reduce((n, c) => n + lat[c], 0) / litere.length

console.log(`font: ${cale}  (unitsPerEm ${unitsPerEm})`)
console.log(JSON.stringify(lat))
console.log(`medie A–Z: ${medie.toFixed(4)} em  ·  spațiu: ${lat[' ']} em`)
