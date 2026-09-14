#!/usr/bin/env node
/**
 * Coboara pe NAS tot ce NU se gaseste pe git: bazele D1, depozitele R2, spatiile KV, logurile
 * AI Gateway si inventarul contului. Cerinta utilizatorului, 14.09.2026:
 *
 *   „Sa avem un backup pe syno la tot ce nu gasim pe git si dupa cateva zile de la trecere
 *    sa curatam si gitul de toate repo v1."
 *
 * ⚠️ E POARTA CURATENIEI: nimic nu se sterge de la Cloudflare pana ce arhiva asta nu e scrisa si
 * verificata. Se ruleaza de cate ori vrei — ce e deja copiat, cu aceeasi marime, se sare.
 *
 *   node infrastructure/cutover/backup-syno.mjs [--unde /backup/_arhiva-cloudflare] [--fara-r2]
 *
 * Ce NU intra: codul (e in repo-uri) si secretele (Cloudflare nu le da inapoi — la restaurare se
 * pun altele noi; numele lor se scriu totusi in inventar, ca sa se stie ce lipseste).
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, statSync, createWriteStream } from 'node:fs'
import { join, dirname } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const arg = (n, implicit = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : implicit
}
const FARA_R2 = process.argv.includes('--fara-r2')
const ZI = new Date().toISOString().slice(0, 10)
const UNDE = join(arg('unde', '/backup/_arhiva-cloudflare'), ZI)

const CONT = process.env.CLOUDFLARE_ACCOUNT_ID
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
if (!CONT || !TOKEN) {
  console.error('lipseste CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN')
  console.error('inainte de rulare: set -a; . /backup/_setup/cloudflare.env; set +a')
  process.exit(1)
}

const api = async (cale) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CONT}${cale}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  })
  const d = await r.json()
  if (!d.success) throw new Error(`${cale}: ${JSON.stringify(d.errors).slice(0, 200)}`)
  return d.result
}

const scrie = (cale, continut) => {
  mkdirSync(dirname(cale), { recursive: true })
  writeFileSync(cale, continut)
}

console.log(`Arhiva Cloudflare → ${UNDE}`)
mkdirSync(UNDE, { recursive: true })

// ---------------------------------------------------------------- inventarul contului
const [workeri, domenii, baze, galeti, spatii, gateways] = await Promise.all([
  api('/workers/scripts'),
  api('/workers/domains?per_page=100'),
  api('/d1/database?per_page=100'),
  api('/r2/buckets?per_page=100').then((r) => r.buckets ?? r),
  api('/storage/kv/namespaces?per_page=100'),
  api('/ai-gateway/gateways').catch(() => []),
])

const inventar = {
  scris_la: new Date().toISOString(),
  workeri: workeri.map((w) => w.id).sort(),
  domenii: domenii.map((d) => ({ adresa: d.hostname, worker: d.service })).sort((a, b) => a.adresa.localeCompare(b.adresa)),
  baze_d1: baze.map((b) => ({ nume: b.name, id: b.uuid })).sort((a, b) => a.nume.localeCompare(b.nume)),
  depozite_r2: galeti.map((b) => b.name).sort(),
  spatii_kv: spatii.map((k) => ({ nume: k.title, id: k.id })),
  ai_gateway: gateways.map((g) => g.id),
  // ⚠️ Secretele nu se pot citi inapoi de la Cloudflare. Aici raman doar numele lor, ca la o
  // restaurare sa se stie ce trebuie pus la loc de mana.
  nota_secrete: 'valorile secretelor nu se pot exporta; vezi `wrangler secret list` per worker',
}
scrie(join(UNDE, 'inventar.json'), JSON.stringify(inventar, null, 2))
console.log(`  inventar: ${inventar.workeri.length} workeri, ${inventar.baze_d1.length} baze, ${inventar.depozite_r2.length} depozite, ${inventar.domenii.length} adrese`)

// ---------------------------------------------------------------- D1, baza cu baza
for (const b of inventar.baze_d1) {
  const cale = join(UNDE, 'd1', `${b.nume}.sql`)
  if (existsSync(cale) && statSync(cale).size > 0) { console.log(`  d1 ${b.nume}: deja`); continue }
  mkdirSync(dirname(cale), { recursive: true })
  process.stdout.write(`  d1 ${b.nume} … `)
  try {
    // `wrangler d1 export` cere un nume cunoscut de configuratie; pe API mergem direct, ca sa
    // prindem SI bazele V1, care nu sunt in niciun wrangler.jsonc de-al nostru.
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CONT}/d1/database/${b.id}/export`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ output_format: 'polling', dump_options: { no_schema: false } }),
    })
    const d = await r.json()
    const url = d?.result?.signed_url
    if (!url) throw new Error(JSON.stringify(d.errors ?? d).slice(0, 160))
    const fisier = await fetch(url)
    await pipeline(Readable.fromWeb(fisier.body), createWriteStream(cale))
    console.log(`${(statSync(cale).size / 1024).toFixed(0)} KB`)
  } catch (e) {
    console.log(`ESUAT (${String(e.message).slice(0, 120)})`)
  }
}

// ---------------------------------------------------------------- KV, cheie cu cheie
for (const k of inventar.spatii_kv) {
  const cale = join(UNDE, 'kv', `${k.nume}.json`)
  if (existsSync(cale)) { console.log(`  kv ${k.nume}: deja`); continue }
  process.stdout.write(`  kv ${k.nume} … `)
  try {
    const chei = await api(`/storage/kv/namespaces/${k.id}/keys?limit=1000`)
    const perechi = {}
    for (const c of chei) {
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CONT}/storage/kv/namespaces/${k.id}/values/${encodeURIComponent(c.name)}`, {
        headers: { authorization: `Bearer ${TOKEN}` },
      })
      perechi[c.name] = await r.text()
    }
    scrie(cale, JSON.stringify(perechi, null, 2))
    console.log(`${chei.length} chei`)
  } catch (e) {
    console.log(`ESUAT (${String(e.message).slice(0, 120)})`)
  }
}

// ---------------------------------------------------------------- AI Gateway: logurile
for (const g of inventar.ai_gateway) {
  const cale = join(UNDE, 'ai-gateway', `${g}.json`)
  if (existsSync(cale)) { console.log(`  gateway ${g}: deja`); continue }
  process.stdout.write(`  gateway ${g} … `)
  try {
    const loguri = await api(`/ai-gateway/gateways/${g}/logs?per_page=1000`)
    scrie(cale, JSON.stringify(loguri, null, 2))
    console.log(`${loguri.length} intrari`)
  } catch (e) {
    console.log(`ESUAT (${String(e.message).slice(0, 120)})`)
  }
}

// ---------------------------------------------------------------- R2, obiect cu obiect
if (FARA_R2) {
  console.log('  R2: sarit (--fara-r2)')
} else {
  for (const galeata of inventar.depozite_r2) {
    process.stdout.write(`  r2 ${galeata} … `)
    let cursor = null
    let n = 0
    let sarite = 0
    try {
      do {
        const lista = await api(`/r2/buckets/${galeata}/objects?per_page=1000${cursor ? `&cursor=${cursor}` : ''}`)
        cursor = lista.cursor ?? null
        for (const o of lista.objects ?? lista) {
          const cale = join(UNDE, 'r2', galeata, o.key)
          if (existsSync(cale) && statSync(cale).size === o.size) { sarite++; continue }
          mkdirSync(dirname(cale), { recursive: true })
          const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CONT}/r2/buckets/${galeata}/objects/${encodeURIComponent(o.key)}`, {
            headers: { authorization: `Bearer ${TOKEN}` },
          })
          if (!r.ok) throw new Error(`${o.key}: HTTP ${r.status}`)
          await pipeline(Readable.fromWeb(r.body), createWriteStream(cale))
          n++
        }
      } while (cursor)
      console.log(`${n} copiate, ${sarite} deja`)
    } catch (e) {
      console.log(`ESUAT dupa ${n} (${String(e.message).slice(0, 120)})`)
    }
  }
}

console.log(`\nGata. Arhiva: ${UNDE}`)
console.log('⚠️ Verific-o inainte de orice stergere: fara ea, curatenia nu se incepe.')
