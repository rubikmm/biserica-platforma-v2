/**
 * Scoate din baza Website-ului (`xc-home-production`, `texte_chinonic`) listele de investigat,
 * o categorie o dată, ca text Markdown la ieșire (se redirectează într-un fișier).
 *
 *   node infrastructure/import/chinonic/stari.mjs                    socoteala pe categorii
 *   node infrastructure/import/chinonic/stari.mjs --lista=nesigur    lista unei categorii
 *
 * Categoriile (se exclud, în ordinea asta — un articol apare într-una singură):
 *   fara-link · eroare · fara-text · nesigur · gata · netras
 * ⚠️ `fara-link` se socotește ÎNAINTE de stare: fără adresă n-avea de unde să se tragă textul, deci
 * rândul a rămas „netras" — dar pricina lui nu e că n-a ajuns la el aducerea, ci că n-are sursă.
 *
 * Cere tokenul: `set -a; . /backup/_setup/cloudflare.env; set +a`.
 */
const BAZA = 'b970592e-85cd-4e07-b5dc-6abe9761098a' // xc-home-production
const SITE = 'https://website.sfantul-ilie.ro/texte-citite-la-chinonic'

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

const CATEGORII = {
  'fara-link': 'Fără link către sursă — nu există de unde aduce textul',
  eroare: 'Erori la aducerea textului — adresa a răspuns rău',
  'fara-text': 'Fără text — s-a ajuns la sursă, dar n-a ieșit text folositor (PDF scanat, pagină goală)',
  nesigur: 'Nesigure — a ieșit text, dar nu începe ca fragmentul din buletin',
  gata: 'Cu textul întreg — proba a trecut, fișa arată textul complet',
  netras: 'Netrase — are adresă, dar aducerea n-a ajuns încă la ele',
}
/** Tăieturi de-a curmezișul stărilor, pentru hotărârile omului. */
const TAIETURI = {
  'fara-autor': ['Fără autor — nici nume scos din buletin, nici „Sinaxar" după titlu; de căutat la sursă',
    (t) => !t.autor],
  'link-mort': ['Adresa sursei nu mai trăiește (404/410) ori nu mai răspunde nimeni — legătura NU se mai scrie în pagină',
    (t) => t.link_stare === 'mort' || t.link_stare === 'picat'],
}

/** Categoria unui rând: `fara-link` bate starea, fiindcă e o pricină, nu o etapă. */
function categoria(t) {
  if (!t.sursa_url) return 'fara-link'
  return t.stare_text
}

const toate = await sql(`SELECT slug, titlu, autor, citit_la, stare_text, sursa_text, sursa_nume,
  sursa_url, sursa_fel, link_stare, link_cod, LENGTH(fragment) AS n_fragment, LENGTH(text_intreg) AS n_text,
  SUBSTR(fragment, 1, 150) AS inceput_fragment, SUBSTR(text_intreg, 1, 150) AS inceput_text
  FROM texte_chinonic ORDER BY citit_la DESC`)

const CERUTA = process.argv.find((a) => a.startsWith('--lista='))?.slice(8)

if (!CERUTA) {
  const socoteala = {}
  for (const t of toate) socoteala[categoria(t)] = (socoteala[categoria(t)] ?? 0) + 1
  console.log(`${toate.length} texte în baza Website-ului\n`)
  for (const [nume, descriere] of Object.entries(CATEGORII)) {
    console.log(`  ${String(socoteala[nume] ?? 0).padStart(3)} · ${nume.padEnd(10)} ${descriere}`)
  }
  for (const [nume, [descriere, prinde]] of Object.entries(TAIETURI)) {
    console.log(`  ${String(toate.filter(prinde).length).padStart(3)} · ${nume.padEnd(10)} ${descriere}`)
  }
  console.log(`\nlista uneia: node infrastructure/import/chinonic/stari.mjs --lista=<${[...Object.keys(CATEGORII), ...Object.keys(TAIETURI)].join('|')}>`)
  process.exit(0)
}
if (!CATEGORII[CERUTA] && !TAIETURI[CERUTA]) {
  console.error(`categorie necunoscută: ${CERUTA} (am: ${[...Object.keys(CATEGORII), ...Object.keys(TAIETURI)].join(', ')})`)
  process.exit(1)
}

const alese = TAIETURI[CERUTA] ? toate.filter(TAIETURI[CERUTA][1]) : toate.filter((t) => categoria(t) === CERUTA)
console.log(`# Chinonic · ${CERUTA} — ${alese.length} texte\n`)
console.log(`${(TAIETURI[CERUTA]?.[0] ?? CATEGORII[CERUTA])}.\n`)
console.log(`_Scos din \`xc-home-production\` la ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC._\n`)

let i = 0
for (const t of alese) {
  console.log(`## ${++i}. ${t.titlu || '(fără titlu)'}`)
  console.log(`- **Autor:** ${t.autor || '—'}`)
  console.log(`- **Citit la:** ${t.citit_la} · **stare:** ${categoria(t)} · **fișa:** ${SITE}/${t.slug}`)
  const sursa = [t.sursa_text || '—', t.sursa_nume ? `(${t.sursa_nume})` : '', `[${t.sursa_fel}]`]
  console.log(`- **Sursa scrisă:** ${sursa.filter(Boolean).join(' ')}`)
  const cumEAdresa = t.sursa_url
    ? `${t.sursa_url}  ·  ${t.link_stare || 'neîntrebată'}${t.link_cod ? ` (${t.link_cod})` : ''}`
    : '— (nu există)'
  console.log(`- **Adresa sursei:** ${cumEAdresa}`)
  console.log(`- **Semne:** fragment ${t.n_fragment} · text adus ${t.n_text}`)
  if (CERUTA === 'nesigur') {
    // la nesigure pricina se vede numai punand cele doua inceputuri unul sub altul
    console.log(`- **Începutul fragmentului:** ${(t.inceput_fragment || '').replace(/\s+/g, ' ')}…`)
    console.log(`- **Începutul textului adus:** ${(t.inceput_text || '').replace(/\s+/g, ' ')}…`)
  }
  console.log('')
}
