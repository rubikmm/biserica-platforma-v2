#!/usr/bin/env node
/**
 * Scrie schema platformei in termeni Cloudflare, citita din `wrangler.jsonc` — deci nu imbatraneste:
 * se rescrie oricand, dupa adevarul din configuratii.
 *
 *   node infrastructure/cutover/schema-cloud.mjs > docs/architecture/cloud.md
 *
 * Ce iese: o harta a platformei (cine cheama pe cine, prin Service Binding), un tabel cu resursele
 * fiecarei aplicatii (D1, R2, KV, cozi, Durable Objects, cron, AI, Browser) si adresele.
 */
import { readFileSync, globSync } from 'node:fs'

function faraComentarii(t) {
  let o = ''
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (c === '"') {
      o += c; i++
      while (i < t.length && t[i] !== '"') { o += t[i]; if (t[i] === '\\') { o += t[i + 1]; i++ } i++ }
      o += t[i]; continue
    }
    if (c === '/' && t[i + 1] === '/') { while (i < t.length && t[i] !== '\n') i++; o += '\n'; continue }
    if (c === '/' && t[i + 1] === '*') { i = t.indexOf('*/', i) + 1; continue }
    o += c
  }
  return o
}

const MEDIU = process.argv.includes('--productie') ? 'production' : 'staging'

const fisiere = [...globSync('apps/*/wrangler.jsonc'), ...globSync('services/*/wrangler.jsonc')].sort()
const workeri = []
for (const f of fisiere) {
  const cfg = JSON.parse(faraComentarii(readFileSync(f, 'utf8')))
  const m = cfg.env?.[MEDIU]
  if (!m) continue
  const scurt = f.split('/')[1].replace(/-worker$/, '')
  workeri.push({
    fisier: f,
    scurt,
    fel: f.startsWith('apps/') ? 'aplicatie' : 'serviciu',
    nume: m.name,
    adresa: (m.routes ?? []).map((r) => r.pattern).join(', '),
    d1: (m.d1_databases ?? []).map((d) => d.database_name),
    r2: (m.r2_buckets ?? []).map((b) => b.bucket_name),
    kv: (m.kv_namespaces ?? []).map((k) => k.binding),
    cozi: [
      ...(m.queues?.producers ?? []).map((q) => `${q.queue} (scrie)`),
      ...(m.queues?.consumers ?? []).map((q) => `${q.queue} (citeste)`),
    ],
    do: (m.durable_objects?.bindings ?? []).map((d) => d.class_name),
    cron: m.triggers?.crons ?? [],
    ai: !!m.ai,
    browser: !!m.browser,
    catre: (m.services ?? []).map((s) => s.service),
  })
}

const dupaNume = new Map(workeri.map((w) => [w.nume, w]))
const scurtDin = (nume) => dupaNume.get(nume)?.scurt ?? nume.replace(/^xc-|-(staging|production)$/g, '')
const azi = new Date().toISOString().slice(0, 10)

console.log(`# Schema platformei in termeni Cloudflare — ${MEDIU}`)
console.log(`
> Generat din \`wrangler.jsonc\` cu \`node infrastructure/cutover/schema-cloud.mjs\` (${azi}).
> Nu se scrie de mana: se regenereaza dupa orice schimbare de legaturi sau resurse.
`)

console.log(`## La nivel de platforma

Fiecare aplicatie e un **Worker** separat, cu datele ei. Browserul vorbeste DOAR cu aplicatia de pe
subdomeniul lui; aplicatia e BFF-ul: ea cheama serviciile prin **Service Bindings** (chemare interna,
fara internet, fara DNS, fara CORS). Nimeni nu citeste baza altcuiva.

Trei straturi:

1. **Aplicatiile** (\`apps/\`) — au adresa publica si paginile. Proprietare pe domeniul lor.
2. **Serviciile** (\`services/\`) — n-au adresa publica: identitate, autorizare, audit, comunicare,
   evenimente, automatizare, media, chat. Se ajunge la ele numai prin Service Binding.
3. **Resursele** — D1 (baze), R2 (depozite), KV (comutatoare), Queues (evenimente),
   Durable Objects (starea vie a emisiei), Workers AI + AI Gateway (chatul), Browser Rendering (hartii).
`)

console.log('```mermaid\ngraph LR')
for (const w of workeri.filter((x) => x.fel === 'aplicatie')) console.log(`  ${w.scurt}["${w.scurt}"]`)
for (const w of workeri.filter((x) => x.fel === 'serviciu')) console.log(`  ${w.scurt}(("${w.scurt}"))`)
for (const w of workeri) for (const c of w.catre) if (dupaNume.has(c)) console.log(`  ${w.scurt} --> ${scurtDin(c)}`)
console.log('```\n')

console.log(`## Aplicatie cu aplicatie\n`)
for (const w of workeri) {
  console.log(`### ${w.scurt} — \`${w.nume}\`${w.fel === 'serviciu' ? ' *(serviciu intern)*' : ''}`)
  const r = []
  if (w.adresa) r.push(`- **Adresa**: ${w.adresa} (Custom Domain)`)
  else if (w.fel === 'aplicatie') r.push('- **Adresa**: — (inca fara Custom Domain)')
  if (w.d1.length) r.push(`- **D1**: ${w.d1.join(', ')}`)
  if (w.r2.length) r.push(`- **R2**: ${w.r2.join(', ')}`)
  if (w.kv.length) r.push(`- **KV**: ${w.kv.join(', ')}`)
  if (w.cozi.length) r.push(`- **Queues**: ${w.cozi.join(', ')}`)
  if (w.do.length) r.push(`- **Durable Objects**: ${w.do.join(', ')}`)
  if (w.cron.length) r.push(`- **Cron**: ${w.cron.join(', ')}`)
  if (w.ai) r.push('- **Workers AI** (prin AI Gateway)')
  if (w.browser) r.push('- **Browser Rendering**')
  r.push(w.catre.length ? `- **Cheama**: ${w.catre.map(scurtDin).join(', ')}` : '- **Cheama**: pe nimeni')
  const chemat = workeri.filter((x) => x.catre.includes(w.nume)).map((x) => x.scurt)
  if (chemat.length) r.push(`- **Chemat de**: ${chemat.join(', ')}`)
  console.log(r.join('\n') + '\n')
}

const nr = (f) => workeri.filter(f).length
console.log(`## Socoteala

- ${nr((w) => w.fel === 'aplicatie')} aplicatii + ${nr((w) => w.fel === 'serviciu')} servicii = ${workeri.length} Workers
- ${new Set(workeri.flatMap((w) => w.d1)).size} baze D1, ${new Set(workeri.flatMap((w) => w.r2)).size} depozite R2,
  ${new Set(workeri.flatMap((w) => w.kv)).size} spatiu KV, ${new Set(workeri.flatMap((w) => w.cozi.map((c) => c.split(' ')[0]))).size} cozi
- ${nr((w) => w.cron.length)} workeri cu ceas (cron), ${nr((w) => w.do.length)} cu Durable Objects
`)
