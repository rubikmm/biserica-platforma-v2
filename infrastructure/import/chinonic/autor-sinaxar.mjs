/**
 * Pune autorul „Sinaxar" la vieţile sfinţilor care au rămas fără autor, peste baza VIE — ca să nu
 * fie nevoie de o extragere întreagă doar pentru atât. Regula e aceeaşi, din `titlu-autor.mjs`
 * (`eSinaxar`), pe care `extrage.mjs` o aplică oricum la fiecare import — deci ce se scrie aici nu
 * se pierde la următoarea rulare.
 *
 *   node infrastructure/import/chinonic/autor-sinaxar.mjs            arata pe cine ar atinge
 *   node infrastructure/import/chinonic/autor-sinaxar.mjs --chiar    scrie in baza
 *
 * ⚠️ Nu atinge niciun rând care ARE autor: hotărârea omului (`indreptari.json`) și numele scoase din
 * buletin rămân cum sunt.
 *
 * Cere tokenul: `set -a; . /backup/_setup/cloudflare.env; set +a`.
 */
import { eSinaxar } from './titlu-autor.mjs'

const BAZA = 'b970592e-85cd-4e07-b5dc-6abe9761098a' // xc-home-production
const CHIAR = process.argv.includes('--chiar')

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
    if (r.ok && j.success) return j.result[0].results
    if (i === 5) throw new Error(`D1: ${r.status} ${JSON.stringify(j.errors ?? j).slice(0, 240)}`)
    await new Promise((s) => setTimeout(s, 1000 * i))
  }
}

const faraAutor = await sql(`SELECT slug, titlu FROM texte_chinonic WHERE autor = '' ORDER BY citit_la DESC`)
const sinaxare = faraAutor.filter((t) => eSinaxar(t.titlu))

console.log(`fără autor: ${faraAutor.length} · dintre ele sinaxare: ${sinaxare.length} · rămân fără autor: ${faraAutor.length - sinaxare.length}\n`)
for (const t of sinaxare) console.log(`  Sinaxar ← ${t.titlu}`)
console.log('\nrămân „Fără autor":')
for (const t of faraAutor.filter((t) => !eSinaxar(t.titlu))) console.log(`  ${t.titlu}`)

if (!CHIAR) {
  console.log('\n(fara --chiar) — nu s-a scris nimic in baza.')
  process.exit(0)
}
for (const t of sinaxare) {
  await sql(`UPDATE texte_chinonic SET autor = 'Sinaxar', schimbat_la = datetime('now') WHERE slug = ? AND autor = ''`, [t.slug])
}
console.log(`\ngata: ${sinaxare.length} articole au primit autorul „Sinaxar".`)
