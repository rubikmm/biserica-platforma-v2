#!/usr/bin/env node
/**
 * Banc de proba pentru extragere: compara randurile scoase de `extragere.ts` din fisierele lunare
 * cu un set de referinta (JSON cu randuri `zile`), camp cu camp.
 *
 *   node infrastructure/import/verifica-calendar.mjs --din /tmp/v1/r2 --referinta /tmp/v1/zile.json
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { extrageZi } from '../../apps/calendar/src/extragere.ts'

const argumente = process.argv.slice(2)
const opt = (n) => {
  const i = argumente.indexOf(`--${n}`)
  return i >= 0 ? argumente[i + 1] : null
}
const DIN = opt('din')
const REF = JSON.parse(readFileSync(opt('referinta'), 'utf8'))
const peData = new Map(REF.map((r) => [r.data, r]))

const CAMPURI = ['titlu', 'titlu_html', 'subtitlu', 'cruce', 'cruce_text', 'zi_libera', 'post', 'perioada', 'sambata_mortilor', 'nunti', 'parastase', 'faza_lunii', 'evanghelia', 'apostolul', 'sursa_id', 'sursa_link', 'zi_saptamana']
const diferente = Object.fromEntries(CAMPURI.map((c) => [c, []]))
let total = 0

// titlu_html din V1 avea stilul sursei inline; al nostru are clasele temei. Comparam pe forma normalizata.
function normHtml(s) {
  return String(s ?? '')
    .replace(/<span style="color:#e52b34">/gi, '<span class="c-rosu">')
    .replace(/<span style="color:#1c58bb">/gi, '<span class="c-albastru">')
    .replace(/\s+/g, ' ')
    .trim()
}

for (const an of [2025, 2026]) {
  for (let l = 1; l <= 12; l++) {
    const cale = join(DIN, `${an}-${String(l).padStart(2, '0')}.json`)
    if (!existsSync(cale)) continue
    const luna = JSON.parse(readFileSync(cale, 'utf8'))
    for (const z of luna.zile) {
      const { rand } = extrageZi(z, luna.preluat_la)
      const ref = peData.get(rand.data)
      if (!ref) {
        console.log('lipsa in referinta', rand.data)
        continue
      }
      total++
      for (const c of CAMPURI) {
        let a = rand[c]
        let b = ref[c]
        if (c === 'titlu_html') {
          a = normHtml(a)
          b = normHtml(b)
        }
        if (String(a ?? '') !== String(b ?? '')) diferente[c].push({ data: rand.data, noi: a, v1: b })
      }
    }
  }
}

console.log(`zile comparate: ${total}`)
for (const c of CAMPURI) {
  const d = diferente[c]
  console.log(`${c}: ${d.length} diferente`)
  for (const x of d.slice(0, 3)) console.log('   ', x.data, '\n      noi:', String(x.noi).slice(0, 220), '\n      v1: ', String(x.v1).slice(0, 220))
}
