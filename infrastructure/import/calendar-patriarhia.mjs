#!/usr/bin/env node
/**
 * Preia un an din calendarul oficial al Patriarhiei Romane si il scrie ca SQL pentru baza
 * `xc-calendar-*` (tabelele `zile` si `texte`), plus randurile de provenienta.
 *
 *   node infrastructure/import/calendar-patriarhia.mjs --an 2027 --iesire /tmp/import/calendar
 *   node infrastructure/import/calendar-patriarhia.mjs --an 2026 --din /cale/cu/luni --iesire /tmp/import/calendar
 *
 * Fara `--din`, anul se ia de la sursa: `calendar.patriarhia.ro/wp-json/wp/v2/calendar-entry-<AA>`
 * (WordPress REST, public). Copia bruta se salveaza in `<iesire>/<an>-brut.json`, ca arhiva
 * de provenienta (de urcat in R2 sub `calendar/patriarhia/<an>.json`).
 * Cu `--din`, se citesc fisierele lunare `<an>-<LL>.json` (forma { an, luna, preluat_la, zile: [...] })
 * — copii deja facute — fara sa se atinga sursa.
 *
 * Scriptul NU atinge nicio baza: produce fisiere `.sql`, cate unul pe luna, pe care le aplica
 * `wrangler d1 execute ... --file`. Preluarea e idempotenta (INSERT OR REPLACE).
 *
 * Extragerea propriu-zisa e in `apps/calendar/src/extragere.ts` — ACEEASI pe care o foloseste
 * workerul; Node o incarca direct (type stripping, Node >= 23.6).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { dataDinAcf, extrageZi, faraTaguri, sqlPentruZi, sqlValoare } from '../../apps/calendar/src/extragere.ts'
import { bazaLocala, bazaStaging, insereazaLoturi } from './d1.mjs'

const argumente = process.argv.slice(2)
function optiune(nume, implicit = null) {
  const i = argumente.indexOf(`--${nume}`)
  return i >= 0 ? argumente[i + 1] : implicit
}

const AN = Number(optiune('an'))
const DIN = optiune('din')
const IESIRE = optiune('iesire', '/tmp/import/calendar')
/**
 * `--scrie local` scrie direct in SQLite-ul lui wrangler dev; `--scrie staging --db-id <id>` prin
 * API-ul D1. Fara `--scrie`, doar fisierele .sql (atentie: instructiunile peste 100 KB — sinaxare
 * lungi — nu trec prin `wrangler d1 execute --file`).
 */
const SCRIE = optiune('scrie')
const DB_ID = optiune('db-id')
if (!AN || AN < 2000 || AN > 2100) {
  console.error('Lipseste --an <AAAA>')
  process.exit(1)
}
mkdirSync(IESIRE, { recursive: true })

const SURSA = 'Patriarhia Romana — calendar.patriarhia.ro'
const ENDPOINT = `https://calendar.patriarhia.ro/wp-json/wp/v2/calendar-entry-${String(AN).slice(2)}`

async function deLaSursa() {
  const zile = []
  let pagina = 1
  for (;;) {
    if (pagina > 20) throw new Error('prea multe pagini — forma sursei s-a schimbat?')
    const url = `${ENDPOINT}?per_page=100&page=${pagina}&orderby=id&order=asc`
    const r = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'biserica-platforma-v2 (calendar; preluare calendar oficial)' },
    })
    if (r.status === 400 && pagina > 1) break
    if (!r.ok) throw new Error(`sursa a raspuns ${r.status} la ${url}`)
    const lot = await r.json()
    if (!Array.isArray(lot) || lot.length === 0) break
    for (const intrare of lot) {
      zile.push({
        data: dataDinAcf(intrare.acf, null),
        id: intrare.id,
        link: intrare.link,
        titlu: faraTaguri(intrare.title?.rendered ?? intrare.acf?.['titlu-acf'] ?? ''),
        acf: intrare.acf ?? {},
      })
    }
    if (lot.length < 100) break
    pagina++
  }
  const preluat_la = new Date().toISOString()
  const brut = { an: AN, sursa: SURSA, endpoint: ENDPOINT, preluat_la, zile }
  const cale = join(IESIRE, `${AN}-brut.json`)
  writeFileSync(cale, JSON.stringify(brut))
  console.error(`copia bruta: ${cale} (${zile.length} intrari)`)
  return { zile, preluat_la, octeti: Buffer.byteLength(JSON.stringify(brut)) }
}

function dinFisiere() {
  const zile = []
  let preluat_la = null
  let octeti = 0
  for (let l = 1; l <= 12; l++) {
    const cale = join(DIN, `${AN}-${String(l).padStart(2, '0')}.json`)
    if (!existsSync(cale)) {
      console.error(`lipseste ${cale}`)
      continue
    }
    const text = readFileSync(cale, 'utf8')
    octeti += Buffer.byteLength(text)
    const luna = JSON.parse(text)
    preluat_la = preluat_la ?? luna.preluat_la
    for (const z of luna.zile) zile.push(z)
  }
  return { zile, preluat_la: preluat_la ?? new Date().toISOString(), octeti }
}

const { zile, preluat_la, octeti } = DIN ? dinFisiere() : await deLaSursa()

// Verificari inainte de a scrie ceva: forma sursei nu s-a schimbat.
if (zile.length === 0) throw new Error('sursa n-a dat nicio zi')
const datele = new Set()
for (const z of zile) {
  const d = dataDinAcf(z.acf, z.data)
  if (!d || !d.startsWith(String(AN))) throw new Error(`zi cu data straina de an: ${JSON.stringify(d)} (id ${z.id})`)
  if (datele.has(d)) throw new Error(`data dublata in sursa: ${d}`)
  datele.add(d)
  z.data = d
}
const zileInAn = (AN % 4 === 0 && AN % 100 !== 0) || AN % 400 === 0 ? 366 : 365
if (zile.length !== zileInAn) {
  console.error(`ATENTIE: ${zile.length} zile in loc de ${zileInAn}; continui, dar verifica sursa`)
}
zile.sort((a, b) => (a.data < b.data ? -1 : 1))

const IMPORTAT_LA = new Date().toISOString()
const peLuni = new Map()
const randuri = []
const texte = []
let cuSinaxar = 0
const rezumat = { cruce: {}, post: {}, perioada: {} }

for (const z of zile) {
  const { rand, sinaxar } = extrageZi(z, preluat_la)
  if (sinaxar) cuSinaxar++
  for (const c of ['cruce', 'post', 'perioada']) rezumat[c][rand[c] || '—'] = (rezumat[c][rand[c] || '—'] ?? 0) + 1
  randuri.push(rand)
  texte.push({ data: rand.data, sinaxar, preluat_la })
  const linii = peLuni.get(rand.luna) ?? []
  linii.push(...sqlPentruZi(rand, sinaxar))
  peLuni.set(rand.luna, linii)
}

const prima = zile[0].data
const ultima = zile[zile.length - 1].data
const motivVersiune = `preluare an ${AN} (sursa preluata la ${preluat_la})`

if (SCRIE) {
  const baza = SCRIE === 'local' ? await bazaLocala('importuri') : SCRIE === 'staging' ? bazaStaging(DB_ID) : null
  if (!baza) throw new Error('--scrie accepta doar local sau staging')
  console.error(`scriu in ${baza.fel}: ${baza.cale}`)
  const coloaneZi = Object.keys(randuri[0])
  await baza.tranzactie(async () => {
    const nz = await insereazaLoturi(baza, 'zile', coloaneZi, randuri)
    const nt = await insereazaLoturi(baza, 'texte', ['data', 'sinaxar', 'preluat_la'], texte, 6)
    await baza.ruleaza(
      `INSERT OR REPLACE INTO importuri (an, sursa, endpoint, zile, octeti, preluat_la, importat_la) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [AN, SURSA, ENDPOINT, zile.length, octeti, preluat_la, IMPORTAT_LA],
    )
    await baza.ruleaza(`INSERT INTO versiuni (moment, de_la, pana_la, motiv, autor) VALUES (?, ?, ?, ?, 'import')`, [IMPORTAT_LA, prima, ultima, motivVersiune])
    console.error(`scrise: ${nz} zile, ${nt} texte, provenienta`)
  })
  baza.inchide()
} else {
  for (const [luna, linii] of peLuni) {
    writeFileSync(join(IESIRE, `${AN}-${String(luna).padStart(2, '0')}.sql`), `${linii.join('\n')}\n`)
  }
  writeFileSync(
    join(IESIRE, `${AN}-provenienta.sql`),
    [
      `INSERT OR REPLACE INTO importuri (an, sursa, endpoint, zile, octeti, preluat_la, importat_la) VALUES (${AN}, ${sqlValoare(SURSA)}, ${sqlValoare(ENDPOINT)}, ${zile.length}, ${octeti}, ${sqlValoare(preluat_la)}, ${sqlValoare(IMPORTAT_LA)});`,
      `INSERT INTO versiuni (moment, de_la, pana_la, motiv, autor) VALUES (${sqlValoare(IMPORTAT_LA)}, ${sqlValoare(prima)}, ${sqlValoare(ultima)}, ${sqlValoare(motivVersiune)}, 'import');`,
      '',
    ].join('\n'),
  )
  console.error(`${peLuni.size} fisiere lunare + provenienta in ${IESIRE}`)
}

console.error(`an ${AN}: ${zile.length} zile (${prima} → ${ultima}), ${cuSinaxar} cu sinaxar`)
console.error(JSON.stringify(rezumat))
