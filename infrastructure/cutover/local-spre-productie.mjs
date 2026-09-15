#!/usr/bin/env node
/**
 * Blocul de BAZA al fiecarui `wrangler.jsonc` (cel fara `env`, adica cel cu care merge `pnpm dev`)
 * arata inca spre resursele de staging. Cerinta utilizatorului, 15.09.2026:
 *
 *   „Pe local pot sa ramana toate containerele dar sa fie cu referinta catre online-ul corect."
 *
 * Deci: D1, R2 si KV din blocul de baza trec pe numele si id-urile de PRODUCTIE, luate chiar din
 * blocul `env.production` al aceluiasi fisier.
 *
 * ⚠️ `services` NU se atinge: acolo numele (`xc-identity`, `xc-authz`…) sunt numele de baza ale
 * celorlalti workeri din aceeasi sesiune `wrangler dev` — legaturile de serviciu se rezolva intre
 * ele, local. Puse pe `-production`, dezvoltarea locala ar cauta workeri care nu sunt in sesiune.
 *
 * ⚠️ Si o liniste: `pnpm dev` ruleaza cu `--persist-to .wrangler/state`, deci D1/R2/KV sunt
 * SIMULATE local — id-urile de aici sunt doar etichete, nu o usa spre datele vii ale parohiei.
 * Ce se schimba e cui ii seamana localul, nu unde scrie.
 *
 *   node infrastructure/cutover/local-spre-productie.mjs [--proba]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { globSync } from 'node:fs'

const PROBA = process.argv.includes('--proba')
const FISIERE = [...globSync('apps/*/wrangler.jsonc'), ...globSync('services/*/wrangler.jsonc')].sort()

/** JSONC → obiect, doar ca sa CITIM perechile; scrierea ramane textuala, ca sa nu pierdem comentariile. */
const faraComentarii = (t) => t.replace(/"(?:[^"\\]|\\.)*"|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => (m[0] === '"' ? m : ''))

let atinse = 0
for (const cale of FISIERE) {
  const text = readFileSync(cale, 'utf8')
  const cfg = JSON.parse(faraComentarii(text))
  const prod = cfg.env?.production
  if (!prod) continue

  // Unde se termina blocul de baza: la cheia `"env"` de nivel intai.
  const taietura = text.indexOf('\n  "env"')
  if (taietura < 0) continue
  let baza = text.slice(0, taietura)
  const restul = text.slice(taietura)

  /** Pereche cu pereche, dupa BINDING — nu dupa pozitie: ordinea poate sa difere intre blocuri. */
  const perechi = []
  const adauga = (aici, acolo, cheiaBinding, ...campuri) => {
    for (const a of aici ?? []) {
      const b = (acolo ?? []).find((x) => x[cheiaBinding] === a[cheiaBinding])
      if (!b) continue
      for (const c of campuri) if (a[c] && b[c] && a[c] !== b[c]) perechi.push([a[c], b[c]])
    }
  }
  adauga(cfg.d1_databases, prod.d1_databases, 'binding', 'database_name', 'database_id')
  adauga(cfg.r2_buckets, prod.r2_buckets, 'binding', 'bucket_name')
  adauga(cfg.kv_namespaces, prod.kv_namespaces, 'binding', 'id')

  let nou = baza
  for (const [din, in_] of perechi) nou = nou.split(`"${din}"`).join(`"${in_}"`)
  if (nou === baza) continue

  atinse++
  console.log(`${cale}`)
  for (const [din, in_] of perechi) console.log(`    ${din} → ${in_}`)
  if (!PROBA) writeFileSync(cale, nou + restul)
}
console.log(`\n${atinse} fisiere${PROBA ? ' (proba, nimic scris)' : ' schimbate'}.`)
