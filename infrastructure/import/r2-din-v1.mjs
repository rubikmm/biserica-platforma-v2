#!/usr/bin/env node
/**
 * Copiaza un depozit R2 din V1 in unul NOU, cu prefix `xc-`. Nu se refoloseste nimic:
 * obiectele se citesc si se scriu, unul cate unul, prin API-ul Cloudflare (tokenul din
 * `/backup/_setup/cloudflare.env`).
 *
 *   node infrastructure/import/r2-din-v1.mjs --din <bucket> --in <bucket>
 *                                            [--fire 6] [--doar <prefix>] [--iar]
 *
 * Folosit pana acum:
 *   biserica-biblioteca  -> xc-biblioteca-staging   2.996 obiecte, 164 MB (13.09.2026)
 *   biserica-buletin     -> xc-buletin-staging      1.856 obiecte, 964 MB (13.09.2026)
 *   biserica-newsletter  -> xc-newsletter-staging   1.423 obiecte, 722 MB (13.09.2026)
 *
 * Se reia de unde a ramas: ce exista deja in destinatie, cu aceeasi marime, se sare.
 * Cu `--iar` se rescrie tot, fara sa se uite la ce e acolo.
 */
const argumente = process.argv.slice(2)
const opt = (n, implicit = null) => {
  const i = argumente.indexOf(`--${n}`)
  return i >= 0 ? argumente[i + 1] : implicit
}
const are = (n) => argumente.includes(`--${n}`)

const DIN = opt('din')
const IN = opt('in')
if (!DIN || !IN) {
  console.error('folosire: node infrastructure/import/r2-din-v1.mjs --din <bucket> --in <bucket>')
  process.exit(1)
}
const FIRE = Number(opt('fire', '6'))
const DOAR = opt('doar')
const IAR = are('iar')

const CONT = process.env.CLOUDFLARE_ACCOUNT_ID
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
if (!CONT || !TOKEN) {
  console.error('lipseste CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN')
  console.error('inainte de rulare: set -a; . /backup/_setup/cloudflare.env; set +a')
  process.exit(1)
}

const API = `https://api.cloudflare.com/client/v4/accounts/${CONT}/r2/buckets`
const antet = { Authorization: `Bearer ${TOKEN}` }

/** Cheia intra in adresa: are diacritice si spatii la unele sluguri. */
const adresaObiect = (bucket, cheie) =>
  `${API}/${bucket}/objects/${cheie.split('/').map(encodeURIComponent).join('/')}`

/** Tipul se pastreaza: R2 nu-l ghiceste, iar o coperta servita ca `octet-stream` se descarca. */
function tipDupaNume(cheie) {
  if (cheie.endsWith('.json')) return 'application/json'
  if (cheie.endsWith('.jpg') || cheie.endsWith('.jpeg')) return 'image/jpeg'
  if (cheie.endsWith('.png')) return 'image/png'
  if (cheie.endsWith('.webp')) return 'image/webp'
  if (cheie.endsWith('.pdf')) return 'application/pdf'
  // Numerele newsletterului sunt bucati de HTML gata randate; servite ca `octet-stream`
  // s-ar descarca in loc sa se vada.
  if (cheie.endsWith('.html')) return 'text/html; charset=utf-8'
  return 'application/octet-stream'
}

/** Cererile catre API pica din cand in cand cu 5xx; se incearca de trei ori, cu rabdare. */
async function cuRabdare(ce, incercari = 3) {
  let ultima
  for (let i = 0; i < incercari; i++) {
    try {
      const r = await ce()
      if (r.ok || r.status === 404) return r
      ultima = new Error(`HTTP ${r.status} ${await r.text().catch(() => '')}`)
    } catch (e) {
      ultima = e
    }
    await new Promise((s) => setTimeout(s, 800 * (i + 1)))
  }
  throw ultima
}

async function listeaza(bucket) {
  const toate = []
  let cursor = null
  do {
    const u = new URL(`${API}/${bucket}/objects`)
    u.searchParams.set('per_page', '1000')
    if (cursor) u.searchParams.set('cursor', cursor)
    const r = await cuRabdare(() => fetch(u, { headers: antet }))
    const j = await r.json()
    if (!j.success) throw new Error(`listare ${bucket}: ${JSON.stringify(j.errors)}`)
    toate.push(...j.result.map((o) => ({ cheie: o.key, octeti: o.size })))
    cursor = j.result_info?.cursor || null
  } while (cursor)
  return toate
}

const omeneste = (o) => (o > 1e6 ? `${(o / 1e6).toFixed(1)} MB` : `${Math.round(o / 1000)} KB`)

console.log(`Copiez ${DIN} -> ${IN}${DOAR ? ` (doar ${DOAR})` : ''}${IAR ? ', rescriu tot' : ''}`)

const sursa = (await listeaza(DIN)).filter((o) => !DOAR || o.cheie.startsWith(DOAR))
const tinta = new Map((await listeaza(IN)).map((o) => [o.cheie, o.octeti]))
const deFacut = IAR ? sursa : sursa.filter((o) => tinta.get(o.cheie) !== o.octeti)

const total = sursa.reduce((s, o) => s + o.octeti, 0)
console.log(
  `${sursa.length} obiecte in sursa (${omeneste(total)}); ` +
    `${tinta.size} deja in tinta; de copiat ${deFacut.length}`,
)
if (deFacut.length === 0) {
  console.log('nimic de facut')
  process.exit(0)
}

let gata = 0
let octetiDusi = 0
const gresite = []

async function copiaza(o) {
  const r = await cuRabdare(() => fetch(adresaObiect(DIN, o.cheie), { headers: antet }))
  if (!r.ok) throw new Error(`citire ${o.cheie}: HTTP ${r.status}`)
  const trup = Buffer.from(await r.arrayBuffer())
  const p = await cuRabdare(() =>
    fetch(adresaObiect(IN, o.cheie), {
      method: 'PUT',
      headers: { ...antet, 'Content-Type': tipDupaNume(o.cheie) },
      body: trup,
    }),
  )
  if (!p.ok) throw new Error(`scriere ${o.cheie}: HTTP ${p.status}`)
  octetiDusi += trup.length
}

// Fire care se servesc din aceeasi coada: obiectele sunt inegale (o coperta mica are 9 KB,
// un PDF are 20 MB), deci impartirea in transe egale ar lasa un fir sa traga singur la urma.
const coada = deFacut.slice()
async function fir() {
  for (;;) {
    const o = coada.shift()
    if (!o) return
    try {
      await copiaza(o)
    } catch (e) {
      gresite.push({ cheie: o.cheie, de_ce: String(e.message || e) })
    }
    gata++
    if (gata % 100 === 0 || gata === deFacut.length) {
      console.log(`  ${gata}/${deFacut.length} (${omeneste(octetiDusi)})`)
    }
  }
}
await Promise.all(Array.from({ length: FIRE }, fir))

console.log(`\nCopiate ${gata - gresite.length}/${deFacut.length}, ${omeneste(octetiDusi)}`)
if (gresite.length) {
  console.log(`\n⚠️ ${gresite.length} nereusite (se reiau ruland din nou):`)
  for (const g of gresite.slice(0, 20)) console.log(`  ${g.cheie}: ${g.de_ce}`)
  process.exit(1)
}
