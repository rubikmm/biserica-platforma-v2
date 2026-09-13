#!/usr/bin/env node
/**
 * Urca in depozitul buletinului, sub `flipbook/`, asseturile modulului de rasfoit **Real3D
 * FlipBook** (v3.7.10, CodeCanyon — creativeinteractivemedia), luate de la `jurnaluldeafaceri`,
 * unde se foloseste pentru revista si editoriale.
 *
 *   node apps/buletin/unelte/urca-flipbook.mjs --din /tmp/fb [--in xc-buletin-staging]
 *
 * ⚠️ **LICENTA**: Real3D FlipBook e un produs cumparat, iar licenta Envato se socoteste PE PRODUS
 * FINAL (un sit), nu dupa cati oameni intra. Copia de aici e a doua folosinta, deci cere licenta ei
 * — utilizatorul a spus ca o cumpara (13.09.2026). **De confirmat inainte de cutover-ul pe
 * productie**; pana atunci sta doar pe staging.
 *
 * Ce NU s-a adus: cele 168 de `js/cmaps/*.bcmap` (codari chinezesti/japoneze, de care buletinul
 * parohiei n-are trebuinta) si CSS-urile de administrare ale pluginului. Daca vreun PDF va cere
 * cmaps, se aduc si ele si se pune `cMapUrl` in optiuni.
 *
 * jQuery (MIT) vine din acelasi loc: modulul e scris ca plugin de jQuery.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const argumente = process.argv.slice(2)
const opt = (n, implicit = null) => {
  const i = argumente.indexOf(`--${n}`)
  return i >= 0 ? argumente[i + 1] : implicit
}
const DIN = opt('din', '/tmp/fb')
const IN = opt('in', 'xc-buletin-staging')

const CONT = process.env.CLOUDFLARE_ACCOUNT_ID
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
if (!CONT || !TOKEN) {
  console.error('lipseste CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN')
  process.exit(1)
}

const TIPURI = {
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject',
  bcmap: 'application/octet-stream',
}

function toate(dir) {
  const gasite = []
  for (const nume of readdirSync(dir)) {
    const cale = join(dir, nume)
    if (statSync(cale).isDirectory()) gasite.push(...toate(cale))
    else gasite.push(cale)
  }
  return gasite
}

const fisiere = toate(DIN)
console.log(`urc ${fisiere.length} fisiere in ${IN} sub flipbook/`)

let octeti = 0
for (const cale of fisiere) {
  const cheie = `flipbook/${relative(DIN, cale).split('\\').join('/')}`
  const ext = cale.slice(cale.lastIndexOf('.') + 1).toLowerCase()
  const trup = readFileSync(cale)
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CONT}/r2/buckets/${IN}/objects/${cheie}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': TIPURI[ext] ?? 'application/octet-stream' },
    body: trup,
  })
  if (!r.ok) {
    console.error(`  ${cheie}: HTTP ${r.status} ${(await r.text()).slice(0, 150)}`)
    process.exitCode = 1
    continue
  }
  octeti += trup.length
}
console.log(`gata: ${(octeti / 1e6).toFixed(1)} MB`)
