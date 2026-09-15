/**
 * ASOCIEREA articol ↔ număr de buletin, ținută de aplicația NEWSLETTER (user, 16.09.2026: „trebuie
 * să avem o asociere a articolelor cu numerele — aceasta se face la nivelul aplicației Newsletter").
 *
 * ⚠️ ÎMPĂRȚEALA, așa cum a cerut-o userul: ARTICOLUL e al Website-ului (baza `xc-home-production`),
 * ASOCIEREA e a Newsletterului. Aici se scrie numai legătura — care texte s-au citit la ce număr —,
 * fiindcă numărul de buletin e al newsletterului, nu al articolului. Website-ul nu ține numere, iar
 * Newsletterul nu ține texte: fiecare păstrează ce e al lui și cere restul (structura mare).
 *
 *   node infrastructure/import/chinonic/asocieri.mjs            arata
 *   node infrastructure/import/chinonic/asocieri.mjs --chiar    scrie `chinonic/asocieri.json` in R2
 *
 * Cere tokenul: `set -a; . /backup/_setup/cloudflare.env; set +a`.
 */
import { readFileSync } from 'node:fs'

const CHIAR = process.argv.includes('--chiar')
const DIN = process.argv.find((a) => a.startsWith('--din='))?.slice(6) ?? '/data/chinonic.json'
const GALEATA = process.argv.find((a) => a.startsWith('--in='))?.slice(5) ?? 'xc-newsletter-production'

const { CLOUDFLARE_ACCOUNT_ID: cont, CLOUDFLARE_API_TOKEN: jeton } = process.env
if (!cont || !jeton) {
  console.error('lipseste tokenul — set -a; . /backup/_setup/cloudflare.env; set +a')
  process.exit(1)
}
const adresa = (cheie) =>
  `https://api.cloudflare.com/client/v4/accounts/${cont}/r2/buckets/${GALEATA}/objects/${cheie
    .split('/').map(encodeURIComponent).join('/')}`

const articole = JSON.parse(readFileSync(DIN, 'utf8'))

/** Un rând pe NUMĂR, cu slugurile textelor citite la el, în ordinea din buletin. */
const peNumar = new Map()
for (const a of articole) {
  if (!peNumar.has(a.newsletterId)) {
    peNumar.set(a.newsletterId, { id: a.newsletterId, nr: a.nr, trimis: a.trimis, texte: [] })
  }
  peNumar.get(a.newsletterId).texte.push(a.slug)
}
const asocieri = [...peNumar.values()].sort((a, b) => a.trimis.localeCompare(b.trimis))

const cateTexte = asocieri.reduce((s, x) => s + x.texte.length, 0)
const dist = {}
for (const x of asocieri) dist[x.texte.length] = (dist[x.texte.length] ?? 0) + 1
console.log(`numere cu texte: ${asocieri.length} · texte cu totul: ${cateTexte}`)
console.log(`  câte texte pe număr: ${JSON.stringify(dist)}`)
console.log(`  cel mai vechi: ${asocieri[0]?.trimis?.slice(0, 10)} · cel mai nou: ${asocieri.at(-1)?.trimis?.slice(0, 10)}`)
console.log('\nultimele trei numere:')
for (const x of asocieri.slice(-3)) console.log(`  nr.${x.nr} (${x.trimis.slice(0, 10)}): ${x.texte.join(', ')}`)

if (!CHIAR) {
  console.log('\n(fara --chiar) — nu s-a scris nimic in depozit.')
  process.exit(0)
}

const r = await fetch(adresa('chinonic/asocieri.json'), {
  method: 'PUT',
  headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(asocieri),
})
if (!r.ok) {
  console.error(`PUT: ${r.status} ${(await r.text()).slice(0, 200)}`)
  process.exit(1)
}
console.log(`\nscris: chinonic/asocieri.json (${asocieri.length} numere)`)
