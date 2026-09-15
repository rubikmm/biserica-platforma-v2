/**
 * Duce articolele scoase de `extrage.mjs` în baza Website-ului (`xc-home-production`, tabelul
 * `texte_chinonic`).
 *
 *   node infrastructure/import/chinonic/in-baza.mjs            arata ce ar scrie
 *   node infrastructure/import/chinonic/in-baza.mjs --chiar    scrie in baza
 *
 * ⚠️ RELUABIL: se scrie cu `INSERT … ON CONFLICT(slug) DO UPDATE`, iar `text_intreg` și `stare_text`
 * NU se ating la o reluare — ele sunt munca pasului următor (aducerea textului întreg) și n-are rost
 * să fie șterse fiindcă am mai rulat o dată extragerea.
 *
 * ⚠️ Nu se folosește `INSERT OR REPLACE`: acela șterge rândul și-l pune la loc, deci ar pierde tocmai
 * textul adus (lecția de la curățenie, 14.09.2026).
 *
 * Cere tokenul: `set -a; . /backup/_setup/cloudflare.env; set +a`.
 */
import { readFileSync } from 'node:fs'

const CHIAR = process.argv.includes('--chiar')
const DIN = process.argv.find((a) => a.startsWith('--din='))?.slice(6) ?? '/data/chinonic.json'
const BAZA = 'b970592e-85cd-4e07-b5dc-6abe9761098a' // xc-home-production

const { CLOUDFLARE_ACCOUNT_ID: cont, CLOUDFLARE_API_TOKEN: jeton } = process.env
if (!cont || !jeton) {
  console.error('lipseste tokenul — set -a; . /backup/_setup/cloudflare.env; set +a')
  process.exit(1)
}

async function sql(comanda, params = []) {
  for (let i = 1; i <= 5; i++) {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cont}/d1/database/${BAZA}/query`, {
      method: 'POST',
      headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sql: comanda, params }),
    })
    const j = await r.json()
    if (r.ok && j.success) return j.result
    if (i === 5) throw new Error(`D1: ${r.status} ${JSON.stringify(j.errors ?? j).slice(0, 240)}`)
    await new Promise((s) => setTimeout(s, 1000 * i))
  }
}

/** Numele sursei, cel care se ARATĂ. Pentru pagini e gazda; pentru PDF-urile noastre nu există un
 *  site străin, deci rămâne gol și vorbește mențiunea scrisă (`sursa_text`). */
const ALE_NOASTRE = /(^|\.)sfantul-ilie\.ro$/i
function numeleSursei(a) {
  for (const g of a.gazde ?? []) if (!ALE_NOASTRE.test(g)) return g
  return ''
}

const articole = JSON.parse(readFileSync(DIN, 'utf8'))
console.log(`de dus: ${articole.length} articole`)

const randuri = articole.map((a) => ({
  slug: a.slug,
  titlu: a.titlu ?? '',
  autor: a.autor ?? '',
  citit_la: (a.trimis ?? '').slice(0, 10),
  fragment: a.corpHtml ?? '',
  sursa_text: a.sursaText ?? '',
  sursa_nume: numeleSursei(a),
  sursa_url: a.sursaUrl ?? '',
  sursa_fel: a.sursaFel ?? 'fara',
  poza: a.poze?.[0] ?? '',
}))

const feluri = {}
for (const r of randuri) feluri[r.sursa_fel] = (feluri[r.sursa_fel] ?? 0) + 1
console.log('  după felul sursei:', JSON.stringify(feluri))
console.log('  cu nume de sursă:', randuri.filter((r) => r.sursa_nume).length)
console.log('  cu poză:', randuri.filter((r) => r.poza).length)
console.log('  cel mai vechi:', randuri.map((r) => r.citit_la).sort()[0],
  '· cel mai nou:', randuri.map((r) => r.citit_la).sort().at(-1))

if (!CHIAR) {
  console.log('\nprimele trei rânduri:')
  for (const r of randuri.slice(0, 3)) {
    console.log(`  ${r.citit_la} · ${r.slug}`)
    console.log(`     titlu: ${r.titlu || '(fără)'} | autor: ${r.autor || '—'}`)
    console.log(`     sursă: ${r.sursa_text || '—'} [${r.sursa_fel}] ${r.sursa_nume || ''}`)
  }
  console.log('\n(fara --chiar) — nu s-a scris nimic in baza.')
  process.exit(0)
}

const COMANDA = `INSERT INTO texte_chinonic
  (slug, titlu, autor, citit_la, fragment, sursa_text, sursa_nume, sursa_url, sursa_fel, poza)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET
    titlu = excluded.titlu, autor = excluded.autor, citit_la = excluded.citit_la,
    fragment = excluded.fragment, sursa_text = excluded.sursa_text,
    sursa_nume = excluded.sursa_nume, sursa_url = excluded.sursa_url,
    sursa_fel = excluded.sursa_fel, poza = excluded.poza,
    schimbat_la = datetime('now')`

let scrise = 0
for (const r of randuri) {
  await sql(COMANDA, [r.slug, r.titlu, r.autor, r.citit_la, r.fragment, r.sursa_text, r.sursa_nume, r.sursa_url, r.sursa_fel, r.poza])
  if (++scrise % 50 === 0) console.log(`  … ${scrise}/${randuri.length}`)
}
const [{ results }] = await sql('SELECT COUNT(*) AS cate FROM texte_chinonic')
console.log(`\ngata: ${scrise} scrise · in baza sunt ${results[0].cate} texte.`)
