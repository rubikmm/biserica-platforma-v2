#!/usr/bin/env node
/**
 * Coboara pe NAS tot ce NU se gaseste pe git: bazele D1, depozitele R2, spatiile KV, logurile
 * AI Gateway si inventarul contului. Cerinta utilizatorului, 14.09.2026:
 *
 *   „Sa avem un backup pe syno la tot ce nu gasim pe git si dupa cateva zile de la trecere
 *    sa curatam si gitul de toate repo v1."
 *
 * ⚠️ E POARTA CURATENIEI: nimic nu se sterge de la Cloudflare pana ce arhiva asta nu e scrisa si
 * verificata. Se ruleaza de cate ori vrei — ce e deja copiat, cu aceeasi marime, se sare.
 *
 *   node infrastructure/cutover/backup-syno.mjs [--unde /backup/_arhiva-cloudflare] [--fara-r2]
 *
 * Ce NU intra: codul (e in repo-uri) si secretele (Cloudflare nu le da inapoi — la restaurare se
 * pun altele noi; numele lor se scriu totusi in inventar, ca sa se stie ce lipseste).
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, statSync, createWriteStream } from 'node:fs'
import { join, dirname } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const arg = (n, implicit = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : implicit
}
const FARA_R2 = process.argv.includes('--fara-r2')
/**
 * `--doar-r2 a,b,c` — numai depozitele astea. Se copiaza ce URMEAZA SA SE STEARGA; depozitul
 * `biserica-transmisiuni` (11 GB) ramane in functiune, refolosit dinadins, deci n-are rost sa-l
 * caram pe NAS, iar cele `xc-*` sunt chiar datele vii.
 */
const DOAR_R2 = (arg('doar-r2') ?? '').split(',').map((x) => x.trim()).filter(Boolean)
const ZI = new Date().toISOString().slice(0, 10)
const UNDE = join(arg('unde', '/backup/_arhiva-cloudflare'), ZI)

const CONT = process.env.CLOUDFLARE_ACCOUNT_ID
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
if (!CONT || !TOKEN) {
  console.error('lipseste CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN')
  console.error('inainte de rulare: set -a; . /backup/_setup/cloudflare.env; set +a')
  process.exit(1)
}

/** Raspunsul INTREG, cu tot cu `result_info` — acolo sta cursorul paginarii. */
const apiPlin = async (cale) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CONT}${cale}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  })
  const d = await r.json()
  if (!d.success) throw new Error(`${cale}: ${JSON.stringify(d.errors).slice(0, 200)}`)
  return d
}
const api = async (cale) => (await apiPlin(cale)).result

const scrie = (cale, continut) => {
  mkdirSync(dirname(cale), { recursive: true })
  writeFileSync(cale, continut)
}

/** Cate lucruri n-au iesit. La final hotaraste codul de iesire: o arhiva pe jumatate nu e poarta. */
let esecuri = 0
const esuat = (ce, e) => {
  esecuri++
  console.log(`ESUAT ${ce}(${String(e.message ?? e).slice(0, 120)})`)
}

/**
 * Exportul D1 e in DOI TIMPI: prima cerere doar porneste treaba si intoarce `at_bookmark`; abia
 * intreband mai departe cu `current_bookmark` apare `signed_url`. Cine crede primul raspuns pleaca
 * fara nimic — pe 15.09.2026 toate cele 32 de baze au iesit asa, „ESUAT ([])", cu errors gol.
 */
const INCEPE = { output_format: 'polling', dump_options: { no_schema: false } }
const exportaD1 = async (id) => {
  let corp = INCEPE
  for (let pas = 0; pas < 150; pas++) {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CONT}/d1/database/${id}/export`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify(corp),
    })
    const d = await r.json()
    if (!d.success) throw new Error(JSON.stringify(d.errors ?? d).slice(0, 160))
    /*
     * ⚠️ Legatura de descarcare sta la `result.RESULT.signed_url`, cu un nivel mai adanc decat pare.
     * Aici a fost defectul: unealta se uita la `result.signed_url`, deci nu vedea niciodata nimic.
     * ⚠️ Si `output_format` e cerut si la cererile de urmarire, nu doar la prima (altfel 7400).
     */
    const url = d.result?.result?.signed_url
    if (url) return url
    // „Not currently exporting anything" inseamna ca treaba s-a incheiat intre doua intrebari: o iau de la capat.
    if (d.result?.success === false || !d.result?.at_bookmark) corp = INCEPE
    else corp = { output_format: 'polling', current_bookmark: d.result.at_bookmark }
    await new Promise((gata) => setTimeout(gata, 2000))
  }
  throw new Error('exportul nu s-a terminat in 5 minute')
}

console.log(`Arhiva Cloudflare → ${UNDE}`)
mkdirSync(UNDE, { recursive: true })

// ---------------------------------------------------------------- inventarul contului
const [workeri, domenii, baze, galeti, spatii, gateways] = await Promise.all([
  api('/workers/scripts'),
  api('/workers/domains?per_page=100'),
  api('/d1/database?per_page=100'),
  api('/r2/buckets?per_page=100').then((r) => r.buckets ?? r),
  api('/storage/kv/namespaces?per_page=100'),
  api('/ai-gateway/gateways').catch(() => []),
])

const inventar = {
  scris_la: new Date().toISOString(),
  workeri: workeri.map((w) => w.id).sort(),
  domenii: domenii.map((d) => ({ adresa: d.hostname, worker: d.service })).sort((a, b) => a.adresa.localeCompare(b.adresa)),
  baze_d1: baze.map((b) => ({ nume: b.name, id: b.uuid })).sort((a, b) => a.nume.localeCompare(b.nume)),
  depozite_r2: galeti.map((b) => b.name).sort(),
  spatii_kv: spatii.map((k) => ({ nume: k.title, id: k.id })),
  ai_gateway: gateways.map((g) => g.id),
  // ⚠️ Secretele nu se pot citi inapoi de la Cloudflare. Aici raman doar numele lor, ca la o
  // restaurare sa se stie ce trebuie pus la loc de mana.
  nota_secrete: 'valorile secretelor nu se pot exporta; vezi `wrangler secret list` per worker',
}
scrie(join(UNDE, 'inventar.json'), JSON.stringify(inventar, null, 2))
console.log(`  inventar: ${inventar.workeri.length} workeri, ${inventar.baze_d1.length} baze, ${inventar.depozite_r2.length} depozite, ${inventar.domenii.length} adrese`)

// ---------------------------------------------------------------- D1, baza cu baza
for (const b of inventar.baze_d1) {
  const cale = join(UNDE, 'd1', `${b.nume}.sql`)
  if (existsSync(cale) && statSync(cale).size > 0) { console.log(`  d1 ${b.nume}: deja`); continue }
  mkdirSync(dirname(cale), { recursive: true })
  process.stdout.write(`  d1 ${b.nume} … `)
  try {
    // `wrangler d1 export` cere un nume cunoscut de configuratie; pe API mergem direct, ca sa
    // prindem SI bazele V1, care nu sunt in niciun wrangler.jsonc de-al nostru.
    const fisier = await fetch(await exportaD1(b.id))
    await pipeline(Readable.fromWeb(fisier.body), createWriteStream(cale))
    console.log(`${(statSync(cale).size / 1024).toFixed(0)} KB`)
  } catch (e) {
    esuat('', e)
  }
}

// ---------------------------------------------------------------- KV, cheie cu cheie
for (const k of inventar.spatii_kv) {
  const cale = join(UNDE, 'kv', `${k.nume}.json`)
  if (existsSync(cale)) { console.log(`  kv ${k.nume}: deja`); continue }
  process.stdout.write(`  kv ${k.nume} … `)
  try {
    const chei = await api(`/storage/kv/namespaces/${k.id}/keys?limit=1000`)
    const perechi = {}
    for (const c of chei) {
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CONT}/storage/kv/namespaces/${k.id}/values/${encodeURIComponent(c.name)}`, {
        headers: { authorization: `Bearer ${TOKEN}` },
      })
      perechi[c.name] = await r.text()
    }
    scrie(cale, JSON.stringify(perechi, null, 2))
    console.log(`${chei.length} chei`)
  } catch (e) {
    esuat('', e)
  }
}

// ---------------------------------------------------------------- AI Gateway: logurile
for (const g of inventar.ai_gateway) {
  const cale = join(UNDE, 'ai-gateway', `${g}.json`)
  if (existsSync(cale)) { console.log(`  gateway ${g}: deja`); continue }
  process.stdout.write(`  gateway ${g} … `)
  try {
    // ⚠️ La loguri, `per_page` nu trece de 50 (altfel 7001) — deci pagina cu pagina.
    const loguri = []
    for (let pagina = 1; pagina <= 200; pagina++) {
      const lot = await api(`/ai-gateway/gateways/${g}/logs?per_page=50&page=${pagina}`)
      loguri.push(...lot)
      if (lot.length < 50) break
    }
    scrie(cale, JSON.stringify(loguri, null, 2))
    console.log(`${loguri.length} intrari`)
  } catch (e) {
    esuat('', e)
  }
}

// ---------------------------------------------------------------- R2, obiect cu obiect
if (FARA_R2) {
  console.log('  R2: sarit (--fara-r2)')
} else {
  for (const galeata of inventar.depozite_r2) {
    if (DOAR_R2.length > 0 && !DOAR_R2.includes(galeata)) continue
    process.stdout.write(`  r2 ${galeata} … `)
    let cursor = null
    let n = 0
    let sarite = 0
    try {
      do {
        /*
         * ⚠️ Cursorul paginarii sta in `result_info`, NU in `result` — cine se uita in `result`
         * primeste `undefined`, iese din bucla si pleaca cu primele 1000 de obiecte, multumit.
         * Asa s-a oprit `biserica-biblioteca` la fix 1000 pe 15.09.2026.
         */
        const d = await apiPlin(`/r2/buckets/${galeata}/objects?per_page=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
        const lista = d.result
        cursor = d.result_info?.is_truncated ? d.result_info?.cursor : null
        for (const o of lista.objects ?? lista) {
          const cale = join(UNDE, 'r2', galeata, o.key)
          if (existsSync(cale) && statSync(cale).size === o.size) { sarite++; continue }
          mkdirSync(dirname(cale), { recursive: true })
          const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CONT}/r2/buckets/${galeata}/objects/${encodeURIComponent(o.key)}`, {
            headers: { authorization: `Bearer ${TOKEN}` },
          })
          if (!r.ok) throw new Error(`${o.key}: HTTP ${r.status}`)
          await pipeline(Readable.fromWeb(r.body), createWriteStream(cale))
          n++
        }
      } while (cursor)
      console.log(`${n} copiate, ${sarite} deja`)
    } catch (e) {
      esuat(`dupa ${n} `, e)
    }
  }
}

if (esecuri > 0) {
  console.log(`\n⚠️ ${esecuri} lucruri N-AU iesit. Arhiva e pe jumatate: ${UNDE}`)
  console.log('NU se sterge nimic de la Cloudflare. Reia rularea — ce e deja copiat se sare.')
  process.exit(1)
}
console.log(`\nGata. Arhiva: ${UNDE}`)
console.log('⚠️ Verific-o inainte de orice stergere: fara ea, curatenia nu se incepe.')
