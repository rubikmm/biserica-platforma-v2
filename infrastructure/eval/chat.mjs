#!/usr/bin/env node
/**
 * SETUL DE PROBE AL CHATULUI — prin bucla adevărată, pe local, model cu model.
 *
 *   node infrastructure/eval/chat.mjs                       # modelul din KV
 *   node infrastructure/eval/chat.mjs @cf/openai/gpt-oss-120b claude-opus-4-8
 *
 * Ce măsoară: pentru fiecare frază, ce unealtă a chemat modelul (și cu ce a ieșit — propunere sau
 * nu), față de ce așteptăm. Nu e un test unitar: costă bani și timp, se rulează de mână, iar
 * scorul se citește în tabel. Cerință: `pnpm dev` pornit, modulul aprins pe local pentru `program`.
 *
 * De ce așa și nu altfel: modelele mici cad exact la ALEGEREA uneltei și la umplerea câmpurilor;
 * doar bucla întreagă (instrucțiuni + fundal + exemple + previzualizare) arată ce se întâmplă cu
 * adevărat. Fiecare probă începe o discuție nouă, ca să nu se ajute între ele.
 */
import { execFileSync } from 'node:child_process'

const B = process.env.B ?? 'http://127.0.0.1:8787'
const EMAIL = 'rubikmm@gmail.com'

/** Probele: fraza, unealta așteptată (sau null = niciuna), și dacă așteptăm o propunere. */
const PROBE = [
  // adăugare
  { text: 'pune un acatist joi la 18', unealta: 'program__adauga_slujba', propunere: true },
  { text: 'adaugă Sfântul Maslu marți la 18:00', unealta: 'program__adauga_slujba', propunere: true },
  { text: 'miercuri seara la 6 vecernie', unealta: 'program__adauga_slujba', propunere: true },
  { text: 'sâmbătă dimineață la 8 liturghie cu parastas', unealta: 'program__adauga_slujba', propunere: true },
  // modificare
  { text: 'mută liturghia de luni la 7', unealta: 'program__modifica_slujba', propunere: true },
  { text: 'Modifică ora slujbei de luni - 07.00 începe la ora 7 nu la 8', unealta: 'program__modifica_slujba', propunere: true },
  { text: 'vecernia de sâmbătă e la 17, nu la 18', unealta: 'program__modifica_slujba', propunere: true },
  { text: 'duminică slujește părintele Ioan la liturghie', unealta: 'program__modifica_slujba', propunere: true },
  { text: 'slujba de sâmbătă seara e în capelă', unealta: 'program__modifica_slujba', propunere: true },
  { text: 'liturghia de duminică nu se transmite online', unealta: 'program__modifica_slujba', propunere: true },
  // ambigue, dar rezolvabile de unealtă (o singură slujbă în zi)
  { text: 'luni începe la 7', unealta: 'program__modifica_slujba', propunere: true },
  // din discuțiile ADEVĂRATE de pe staging, 11.09.2026 seara — ambele duse la capăt (GLM 5.3 Flash);
  // frazele omului, nu ale noastre. Se adaugă aici fiecare discuție bună din export (discutii.mjs).
  { text: 'Slujba de luni să fie de la ora 7', unealta: 'program__modifica_slujba', propunere: true },
  { text: 'Adaugă marți la 18 slujba Sfântul Maslu', unealta: 'program__adauga_slujba', propunere: true },
  // NU e de aici: modelul trebuie să spună că nu poate, fără să inventeze
  { text: 'ce slujbe sunt duminică?', unealta: null, propunere: false },
  { text: 'fă-mi un raport cu slujbele din 2025', unealta: null, propunere: false },
  { text: 'bună seara!', unealta: null, propunere: false },
]

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8' })
}

async function sesiune() {
  const cap = await fetch(`${B}/cont/auth/login`)
  const csrf = (cap.headers.get('set-cookie') ?? '').match(/xc_csrf=([^;]+)/)?.[1]
  const jeton = (await cap.text()).match(/name="csrf" value="([^"]+)"/)?.[1]
  if (!csrf || !jeton) throw new Error('nu iau jetonul CSRF')
  const f = new URLSearchParams({ email: EMAIL, csrf: jeton })
  await fetch(`${B}/cont/auth/login`, { method: 'POST', headers: { cookie: `xc_csrf=${csrf}`, origin: B }, body: f })
  const cod = new URLSearchParams({ email: EMAIL, csrf: jeton, c1: '1', c2: '2', c3: '3', c4: '4', c5: '5', c6: '6' })
  const r = await fetch(`${B}/cont/auth/cod`, { method: 'POST', headers: { cookie: `xc_csrf=${csrf}`, origin: B }, body: cod, redirect: 'manual' })
  const ses = (r.headers.get('set-cookie') ?? '').match(/xc_sesiune=([^;]+)/)?.[1]
  if (!ses) throw new Error('nu primesc sesiune (e 123456 pornit în dev?)')
  return `xc_sesiune=${ses}; xc_csrf=${csrf}`
}

async function intreaba(cookie, text) {
  const r = await fetch(`${B}/program/chat/mesaj`, {
    method: 'POST',
    headers: { cookie, origin: B, 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  return r.json()
}

/** Modelul se schimbă în KV-ul local; chat-worker îl recitește la 3 s în dev. */
function puneModelul(model) {
  const actual = JSON.parse(sh('npx', ['wrangler', 'kv', 'key', 'get', 'modul:chat', '--binding', 'CONFIG', '-c', 'apps/admin/wrangler.jsonc', '--local', '--persist-to', '.wrangler/state']).split('\n').filter((l) => l.trim().startsWith('{')).pop() ?? '{}')
  const nou = JSON.stringify({ ...actual, model })
  sh('npx', ['wrangler', 'kv', 'key', 'put', 'modul:chat', nou, '--binding', 'CONFIG', '-c', 'apps/admin/wrangler.jsonc', '--local', '--persist-to', '.wrangler/state'])
  return actual.model
}

const modele = process.argv.slice(2)
const cookie = await sesiune()
const rezumat = []

for (const model of modele.length ? modele : [null]) {
  let vechi = null
  if (model) {
    vechi = puneModelul(model)
    await new Promise((r) => setTimeout(r, 4000))
  }
  console.log(`\n=== ${model ?? '(modelul din KV)'} ===`)
  let bune = 0
  const inceput = Date.now()
  for (const p of PROBE) {
    const t0 = Date.now()
    let j
    try {
      j = await intreaba(cookie, p.text)
    } catch (e) {
      console.log(`  ✗ ${p.text}  → EROARE ${e.message}`)
      continue
    }
    const unelte = j.unelte ?? []
    const prima = unelte[0] ?? null
    const uneltaBuna = p.unealta === null ? unelte.length === 0 : prima === p.unealta
    const propunereBuna = p.propunere ? Boolean(j.propunere) : !j.propunere
    const ok = uneltaBuna && propunereBuna
    bune += ok ? 1 : 0
    const s = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`  ${ok ? '✓' : '✗'} ${p.text}`)
    console.log(`      unealtă: ${prima ?? '—'}${unelte.length > 1 ? ` (+${unelte.length - 1})` : ''} | propunere: ${j.propunere ? 'da' : 'nu'} | ${s}s`)
    if (!ok) console.log(`      răspuns: ${(j.text ?? j.mesaj ?? '').slice(0, 140).replace(/\n/g, ' ')}`)
  }
  const total = ((Date.now() - inceput) / 1000).toFixed(0)
  console.log(`  ── ${bune}/${PROBE.length} în ${total}s`)
  rezumat.push({ model: model ?? '(KV)', bune, total })
  if (model && vechi) puneModelul(vechi)
}

if (rezumat.length > 1) {
  console.log('\n=== rezumat ===')
  for (const r of rezumat) console.log(`  ${String(r.bune).padStart(2)}/${PROBE.length}  ${r.model}  (${r.total}s)`)
}
