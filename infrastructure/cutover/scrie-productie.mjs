#!/usr/bin/env node
/**
 * Umple blocurile `env.production` din wrangler.jsonc, dupa chipul lui `env.staging`.
 *
 *   node infrastructure/cutover/scrie-productie.mjs [--scrie]
 *
 * Fara `--scrie` doar arata ce ar pune. Blocul de productie isi pastreaza `name` si `vars`
 * (scrise de mana, cu URL_* pe domeniile parohiei); de la staging se imprumuta LEGATURILE
 * (D1, R2, KV, cozi, servicii, browser, DO, crons), cu numele trecute pe `-production`.
 *
 * ⚠️ `routes` NU se copiaza: hostname-ul de productie apartine inca lui V1, iar mutarea lui e
 * pasul explicit al cutover-ului, unul cate unul. Se adauga separat, la comutare.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { globSync } from 'node:fs'

const SCRIE = process.argv.includes('--scrie')

/** Bazele D1 create pentru productie, 14.09.2026. */
const D1 = {
  'xc-identity-production': '4d8cd18f-6a5b-4555-b9f0-b3d46bec10ff',
  'xc-authz-production': 'a4290844-79ce-494a-b791-e852dc6c1f40',
  'xc-audit-production': '2a5ad207-2493-449b-8cd9-feb0c3e88fed',
  'xc-calendar-production': '03c9980e-406c-419f-ae4b-4da6eae956ec',
  'xc-program-production': '75c595db-de40-4821-a0ed-7cd80cab22ca',
  'xc-curatenie-production': '19733db9-6b13-4937-bdf3-70286b74d2a2',
  'xc-tipic-production': '82283f8f-701a-47b6-b0da-05dbd3a9e024',
  'xc-biblioteca-production': '20a9b980-f065-46a3-904d-d42bc097f579',
  'xc-buletin-production': '264f3cc0-d762-4b0a-9bd0-7c1007b80090',
  'xc-communication-production': '107b0ae4-8b3b-4b04-b629-2aa53079672f',
  'xc-automation-production': '7c4dd88d-f392-45a7-a7a7-0096f9fc2a2c',
  'xc-chat-production': 'fc262cfc-2879-4ce5-b5f0-45d3f754fe09',
}
/** Singurul KV (`CONFIG`, panoul de module), perechea de productie. */
const KV_PRODUCTIE = '5d9c6f96328743858c40c577fbbdb947'

/** Ce nu se imprumuta de la staging: numele, variabilele si ruta. */
const SARITE = new Set(['name', 'vars', 'routes'])

/** Sare peste siruri si comentarii, ca acoladele din ele sa nu strice numaratoarea. */
function inchidere(text, start) {
  const deschis = text[start]
  const inchis = deschis === '{' ? '}' : ']'
  let adancime = 0
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      i++
      while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1
      continue
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i) + 1
      continue
    }
    if (c === deschis) adancime++
    else if (c === inchis && --adancime === 0) return i
  }
  throw new Error('acolada neinchisa')
}

/** Spanul blocului `"<cheie>": { … }`, de la acolada pana la perechea ei. */
function bloc(text, cheie, de = 0) {
  const m = new RegExp(`"${cheie}"\\s*:\\s*[{\\[]`).exec(text.slice(de))
  if (!m) return null
  const start = de + m.index + m[0].length - 1
  return { start, stop: inchidere(text, start) }
}

/** Cheile de prim nivel dintr-un bloc, cu spanul fiecareia. */
function chei(text, span) {
  const iesire = []
  let i = span.start + 1
  while (i < span.stop) {
    const c = text[i]
    if (c === '/' && text[i + 1] === '/') { while (text[i] !== '\n') i++; continue }
    if (c === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i) + 2; continue }
    if (c !== '"') { i++; continue }
    const numeStop = text.indexOf('"', i + 1)
    const nume = text.slice(i + 1, numeStop)
    let j = text.indexOf(':', numeStop) + 1
    while (/\s/.test(text[j])) j++
    let valStop
    if (text[j] === '{' || text[j] === '[') valStop = inchidere(text, j)
    else {
      valStop = j
      while (valStop < span.stop && !',\n'.includes(text[valStop])) valStop++
      valStop--
    }
    iesire.push({ nume, start: i, stop: valStop })
    i = valStop + 1
    while (i < span.stop && /[\s,]/.test(text[i])) i++
  }
  return iesire
}

/** Numele si id-urile trec de pe staging pe productie. */
function peProductie(text) {
  let t = text.replace(/-staging\b/g, '-production')
  t = t.replace(/"database_id"\s*:\s*"[^"]*"/g, (m, offset, sir) => {
    const inainte = sir.slice(0, offset)
    const nume = /"database_name"\s*:\s*"([^"]+)"[^]*$/.exec(inainte)?.[1]
    return nume && D1[nume] ? `"database_id": "${D1[nume]}"` : m
  })
  t = t.replace(/("binding"\s*:\s*"CONFIG"\s*,\s*"id"\s*:\s*)"[^"]*"/g, `$1"${KV_PRODUCTIE}"`)
  return t
}

const fisiere = [
  ...globSync('apps/*/wrangler.jsonc'),
  ...globSync('services/*/wrangler.jsonc'),
].sort()

for (const f of fisiere) {
  const text = readFileSync(f, 'utf8')
  const env = bloc(text, 'env')
  if (!env) { console.log(`—    ${f}: fara env`); continue }
  const staging = bloc(text, 'staging', env.start)
  const productie = bloc(text, 'production', env.start)
  if (!staging || !productie) { console.log(`—    ${f}: fara staging/production`); continue }

  const cheiProductie = chei(text, productie)
  const areDeja = new Set(cheiProductie.map((c) => c.nume))
  const deAdus = chei(text, staging).filter((c) => !SARITE.has(c.nume) && !areDeja.has(c.nume))
  if (!deAdus.length) { console.log(`=    ${f}: nimic de adus`); continue }

  const bucati = deAdus.map((c) => peProductie(text.slice(c.start, c.stop + 1)))
  // ⚠️ Se insereaza dupa ULTIMA cheie, nu inaintea acoladei: intre ele poate sta un comentariu,
  // iar o virgula pusa dupa el ar intra in comentariu si ar rupe fisierul.
  const ultima = cheiProductie[cheiProductie.length - 1]
  const taietura = ultima ? ultima.stop + 1 : productie.start + 1
  const nou =
    text.slice(0, taietura) +
    (ultima ? ',' : '') +
    '\n      ' +
    bucati.join(',\n      ') +
    text.slice(taietura)

  console.log(`+    ${f}: ${deAdus.map((c) => c.nume).join(', ')}`)
  if (SCRIE) writeFileSync(f, nou)
}
