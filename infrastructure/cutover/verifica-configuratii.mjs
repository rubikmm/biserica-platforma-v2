#!/usr/bin/env node
/**
 * Citeste toate `wrangler.jsonc` ca JSON (fara comentarii) si spune ce s-a rupt.
 * Verificare ieftina, de rulat dupa orice atingere automata a configuratiilor.
 *
 *   node infrastructure/cutover/verifica-configuratii.mjs
 */
import { readFileSync, globSync } from 'node:fs'

/** Scoate comentariile, fara sa se atinga de ce e in ghilimele (`https://…`). */
function faraComentarii(t) {
  let o = ''
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (c === '"') {
      o += c
      i++
      while (i < t.length && t[i] !== '"') {
        o += t[i]
        if (t[i] === '\\') { o += t[i + 1]; i++ }
        i++
      }
      o += t[i]
      continue
    }
    if (c === '/' && t[i + 1] === '/') { while (i < t.length && t[i] !== '\n') i++; o += '\n'; continue }
    if (c === '/' && t[i + 1] === '*') { i = t.indexOf('*/', i) + 1; continue }
    o += c
  }
  return o
}

const fisiere = [...globSync('apps/*/wrangler.jsonc'), ...globSync('services/*/wrangler.jsonc')].sort()
let rele = 0
for (const f of fisiere) {
  try {
    const cfg = JSON.parse(faraComentarii(readFileSync(f, 'utf8')))
    const p = cfg.env?.production
    if (p) {
      const ramase = JSON.stringify(p).match(/-staging/g)
      if (ramase) { rele++; console.log(`STAGING in productie: ${f} (${ramase.length})`) }
    }
  } catch (e) {
    rele++
    console.log(`RUPT ${f}: ${String(e.message).slice(0, 90)}`)
  }
}
console.log(rele ? `${rele} de indreptat` : `toate cele ${fisiere.length} de configuratii se citesc curat`)
