#!/usr/bin/env node
/**
 * ADU LOCAL CE E ONLINE — bazele D1 si depozitele R2 din productie, coborate in starea simulata a
 * lui `pnpm dev` (`.wrangler/state`). Cerinta utilizatorului, 17.09.2026:
 *
 *   „preia baza de date fisiere - tot ce e online sa fie si local - ca sa vad exact ce e online
 *    si local"
 *
 * Localul e SIMULAT (Miniflare): D1 e un sqlite in `.wrangler/state/v3/d1`, R2 un dosar de blob-uri
 * in `v3/r2`. De aceea „aducerea" nu inseamna o legatura spre datele vii, ci o COPIE — se scrie
 * numai pe disc, la noi. In sens invers nu pleaca nimic: unealta asta nu scrie NICIODATA in
 * productie (singurele cereri catre Cloudflare sunt GET-uri).
 *
 *   node infrastructure/import/adu-local.mjs                     # socoteala: ce e online, ce e local
 *   node infrastructure/import/adu-local.mjs --chiar             # aduce tot
 *   node infrastructure/import/adu-local.mjs --chiar --doar buletin,newsletter
 *   node infrastructure/import/adu-local.mjs --chiar --fara-r2   # numai bazele (repede)
 *
 * ⚠️ `pnpm dev` TREBUIE OPRIT cat tine aducerea: sesiunea lui tine deschise aceleasi fisiere sqlite
 * si nu si-ar vedea oricum datele noi decat dupa repornire. Unealta se opreste singura daca il
 * gaseste pornit.
 *
 * ⚠️ CUM SE SCRIE IN R2-ul LOCAL: printr-un WORKER EFEMER (`adu-local/worker.js`), pornit cu
 * `wrangler dev` pe aceeasi stare. E singura cale si rapida, si cinstita: `wrangler r2 object put`
 * porneste cate un proces de fiecare obiect (3 s bucata, adica ore la 1800 de fisiere), iar scrisul
 * de-a dreptul in dosarul de blob-uri ar cere sa tinem noi minte formatul launtric al Miniflare —
 * care se schimba fara sa ne intrebe. Prin worker trec exact aceleasi cai ca la `pnpm dev`.
 *
 * ⚠️ E RELUABILA: ce e deja local cu aceeasi marime se sare, deci o rulare intrerupta se reia fara
 * sa coste de doua ori. La D1 insa tabelele aduse se RESCRIU intregi (drop + import), fiindca o
 * jumatate de tabel n-ar spune adevarul despre ce e online.
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const argumente = process.argv.slice(2)
const CHIAR = argumente.includes('--chiar')
const FARA_R2 = argumente.includes('--fara-r2')
const FARA_D1 = argumente.includes('--fara-d1')
const iDoar = argumente.indexOf('--doar')
const DOAR = iDoar >= 0 ? (argumente[iDoar + 1] ?? '').split(',').map((x) => x.trim()).filter(Boolean) : null
/**
 * ⚠️ `biserica-transmisiuni` (33 GB: muzica radioului si inregistrarile) NU se aduce local. E
 * singurul depozit fara prefixul `xc-`, refolosit dinadins din V1 (vezi repere), si n-are ce cauta
 * intr-o copie de lucru: ar umple discul si ar tine ore. Regula e pe PREFIX, nu pe nume — asa sare
 * singur si ce s-ar mai refolosi vreodata din V1. `--si-grele` il aduce totusi, daca chiar se cere.
 */
const SI_GRELE = argumente.includes('--si-grele')
const eGreu = (galeata) => !galeata.startsWith('xc-')

const STARE = '.wrangler/state'
const LUCRU = 'infrastructure/import/adu-local'
const PORT = 8799

/* ───────────────────────────── cheile contului ───────────────────────────── */

/**
 * Tokenul sta in `/backup/_setup/cloudflare.env`, nu in seif si nu in `.bashrc` (vezi repere). Daca
 * nu e deja in mediu, il citim de acolo — ca omul sa nu fie nevoit sa-si aduca aminte de `set -a`.
 */
const SEIF = '/backup/_setup/cloudflare.env'
if ((!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) && existsSync(SEIF)) {
  for (const rand of readFileSync(SEIF, 'utf8').split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(rand)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}
const CONT = process.env.CLOUDFLARE_ACCOUNT_ID
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
if (!CONT || !TOKEN) {
  console.error(`lipseste CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN (nici in ${SEIF})`)
  process.exit(1)
}

/**
 * ⚠️ R2 raspunde 429 la copierile mari — e regula, nu accidentul, si nu vine din paralelism (vezi
 * repere). Asteptarea pleaca din `Retry-After`, ca la `import/r2-din-v1.mjs` si la `backup-syno`.
 *
 * ⚠️ PAUZA E COMUNA TUTUROR FIRELOR (lectia din `r2-din-v1.mjs`): degeaba asteapta unul, daca
 * ceilalti bat in aceeasi usa si tin poarta inchisa. Cand unul primeste 429, toate se opresc pana la
 * clipa scrisa in `pauzaPanaLa`.
 */
let pauzaPanaLa = 0
const rasufla = async () => {
  const cat = pauzaPanaLa - Date.now()
  if (cat > 0) await new Promise((gata) => setTimeout(gata, cat))
}
const cuRabdare = async (url, init, incercari = 6) => {
  for (let i = 0; ; i++) {
    await rasufla()
    const r = await fetch(url, init)
    if (r.status !== 429 || i >= incercari) return r
    const asteapta = Number(r.headers.get('retry-after') ?? Math.min(60, 5 * 2 ** i))
    pauzaPanaLa = Math.max(pauzaPanaLa, Date.now() + asteapta * 1000)
  }
}

/** Cateva fire care mananca din acelasi sir. Mai multe n-ar ajuta: poarta e R2, nu noi. */
const FIRE = 4
const inParalel = async (lucruri, cateFire, treaba) => {
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(cateFire, lucruri.length) }, async () => {
      while (i < lucruri.length) await treaba(lucruri[i++])
    }),
  )
}

const apiPlin = async (cale) => {
  const r = await cuRabdare(`https://api.cloudflare.com/client/v4/accounts/${CONT}${cale}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  })
  const text = await r.text()
  let d
  try {
    d = JSON.parse(text)
  } catch {
    throw new Error(`${cale}: HTTP ${r.status}, raspuns care nu e JSON (${text.slice(0, 80)})`)
  }
  if (!d.success) throw new Error(`${cale}: ${JSON.stringify(d.errors).slice(0, 200)}`)
  return d
}

/* ───────────────────────── ce resurse are fiecare aplicatie ───────────────────────── */

/** JSONC → obiect: se taie comentariile, ghilimelele raman in pace. */
const faraComentarii = (t) => t.replace(/"(?:[^"\\]|\\.)*"|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => (m[0] === '"' ? m : ''))

/**
 * Perechea LOCAL ↔ ONLINE, binding cu binding.
 *
 * ⚠️ Blocul de BAZA al fiecarui `wrangler.jsonc` e ce vede `pnpm dev`, iar `env.production` e ce e
 * online. Din 15.09.2026 cele doua poarta aceleasi nume (`local-spre-productie.mjs`), dar unealta nu
 * se bizuie pe asta: cauta perechea dupa BINDING, nu dupa nume. Asa merge si daca localul ramane
 * vreodata in urma.
 */
const resurse = () => {
  const lista = []
  for (const cale of [...globSync('apps/*/wrangler.jsonc'), ...globSync('services/*/wrangler.jsonc')].sort()) {
    const cfg = JSON.parse(faraComentarii(readFileSync(cale, 'utf8')))
    const prod = cfg.env?.production
    if (!prod) continue
    const nume = dirname(cale).split('/').pop()
    if (DOAR && !DOAR.includes(nume)) continue
    const d1 = []
    for (const local of cfg.d1_databases ?? []) {
      const online = (prod.d1_databases ?? []).find((x) => x.binding === local.binding)
      if (online?.database_name) d1.push({ binding: local.binding, local: local.database_name, online: online.database_name })
    }
    const r2 = []
    for (const local of cfg.r2_buckets ?? []) {
      const online = (prod.r2_buckets ?? []).find((x) => x.binding === local.binding)
      if (!online?.bucket_name) continue
      if (eGreu(online.bucket_name) && !SI_GRELE) {
        console.log(`  (sărit: ${nume} · R2 ${online.bucket_name} — depozit greu, fără prefix xc-; vezi --si-grele)`)
        continue
      }
      r2.push({ binding: local.binding, local: local.bucket_name, online: online.bucket_name })
    }
    if (d1.length || r2.length) lista.push({ nume, cale, d1, r2 })
  }
  return lista
}

/* ─────────────────────────────── plasa: dev-ul pornit ─────────────────────────────── */

/**
 * ⚠️ Doua procese pe aceeasi stare se calca pe picioare: sesiunea `pnpm dev` tine deschise sqlite-urile
 * si oricum nu si-ar vedea datele noi fara repornire. Mai bine se opreste de mana, cu omul de fata.
 */
const procese = () => {
  try {
    return execFileSync('ps', ['-eo', 'pid,args'], { encoding: 'utf8' }).split('\n')
  } catch {
    return []
  }
}

/**
 * ⚠️ Workerul NOSTRU efemer nu se pune la socoteala: si el e un `wrangler dev --persist-to`. Semnul
 * lui e CONFIGURATIA, nu dosarul: `adu-local.mjs` insusi are dosarul in linia de comanda.
 */
const AL_NOSTRU = `${LUCRU}/wrangler.jsonc`
const devPornit = () =>
  procese().some(
    (r) => r.includes('wrangler') && r.includes(' dev ') && r.includes('--persist-to') && !r.includes(AL_NOSTRU),
  )

/**
 * O rulare picata poate lasa workerul efemer in viata; a doua ar gasi portul prins.
 * ⚠️ Se cauta dupa `AL_NOSTRU`, si NICIODATA dupa numele dosarului: unealta s-ar gasi pe ea insasi
 * in lista (linia ei de comanda e chiar `node infrastructure/import/adu-local.mjs`) si s-ar sinucide
 * indata dupa pornire — patit pe 17.09.2026, de doua ori, si arata exact ca o cadere fara pricina.
 */
const stingeWorkerulVechi = () => {
  for (const rand of procese()) {
    if (!rand.includes(AL_NOSTRU)) continue
    const pid = Number(rand.trim().split(/\s+/)[0])
    if (pid && pid !== process.pid) {
      try {
        process.kill(pid, 'SIGTERM')
      } catch {
        /* a murit intre timp */
      }
    }
  }
}

/* ─────────────────────────────── D1 ─────────────────────────────── */

const wrangler = (parametri, optiuni = {}) =>
  execFileSync('npx', ['wrangler', ...parametri], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...optiuni })

/**
 * ⚠️ IMPORTUL NU SE FACE CU `wrangler d1 execute --file`, ci pe fisierul sqlite de-a dreptul.
 * Motivul, platit la calendar pe 17.09.2026: exportul D1 scrie INSERT-uri cu MII de randuri intr-o
 * singura instructiune, iar motorul din `wrangler d1 execute --local` are un plafon de lungime —
 * pica cu `statement too long: SQLITE_TOOBIG` si baza ramane pe jumatate. Aceeasi instructiune
 * trece fara sa clipeasca prin `node:sqlite` (plafonul sqlite obisnuit e de 1 GB).
 *
 * Fisierul bazei nu se poate ghici: Miniflare il numeste cu un hash al obiectului Durable. De aceea
 * se pune intai un MARTOR printr-o comanda wrangler obisnuita (care stie singura ce baza e care) si
 * se cauta apoi fisierul care-l are. Cu WAL-ul in joc, cautarea se face prin sqlite, nu cu grep pe
 * octeti: martorul proaspat scris poate sa nu fi ajuns inca in fisierul mare.
 */
const fisierulBazei = (aplicatie, baza) => {
  const martor = `_adu_local_${process.pid}`
  wrangler([
    'd1', 'execute', baza.local, '--local', '--persist-to', STARE, '-c', aplicatie.cale,
    '--command', `CREATE TABLE IF NOT EXISTS "${martor}" (x)`, '-y',
  ])
  for (const f of globSync(join(STARE, 'v3/d1/miniflare-D1DatabaseObject/*.sqlite'))) {
    const db = new DatabaseSync(f)
    const are = db.prepare(`SELECT 1 FROM sqlite_master WHERE name = ?`).get(martor)
    db.close()
    if (are) return { fisier: f, martor }
  }
  throw new Error(`nu găsesc fișierul local al bazei ${baza.local}`)
}

/**
 * O baza, adusa intreaga: export din productie (`--remote`), apoi rescrisa in cea locala.
 *
 * ⚠️ Baza locala se GOLESTE de tot inainte (tabele si vederi, afara de cele ale sqlite si ale D1),
 * nu doar de tabelele din export: cerinta e „tot ce e online sa fie si local", deci ce a ramas local
 * din alte vremuri ar fi o minciuna in plus. Si `d1_migrations` vine din productie — asa jurnalul
 * migratiilor locale spune adevarul despre baza care tocmai a intrat.
 */
const aduD1 = (aplicatie, baza) => {
  const dosar = join('/tmp', 'adu-local')
  mkdirSync(dosar, { recursive: true })
  const sql = join(dosar, `${baza.online}.sql`)
  process.stdout.write(`  d1 ${baza.online} … `)
  wrangler(['d1', 'export', baza.online, '--remote', '--env', 'production', '-c', aplicatie.cale, '--output', sql])
  const text = readFileSync(sql, 'utf8')
  const { fisier, martor } = fisierulBazei(aplicatie, baza)

  /*
   * ⚠️ CU CHEILE STRAINE STINSE. Exportul D1 scrie tabelele in ordinea lui, nu in ordinea legaturilor:
   * la curatenie, `assignments` (care trimite la `volunteers`) vine PRIMA, iar randurile ei intra
   * inainte sa existe `volunteers` — cu cheile aprinse, sqlite se opreste cu „no such table:
   * main.volunteers", tocmai cand baza pare pe drumul cel bun. `PRAGMA defer_foreign_keys` din capul
   * exportului nu ajunge: el amana verificarea pana la capatul unei TRANZACTII, iar aici nu e niciuna.
   * Legaturile raman scrise in schema; doar verificarea de la scriere e stinsa, cat tine importul.
   */
  const db = new DatabaseSync(fisier, { enableForeignKeyConstraints: false })
  const vechi = db
    .prepare(`SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'`)
    .all()
  db.exec('PRAGMA defer_foreign_keys = TRUE')
  for (const t of vechi) db.exec(`DROP ${t.type === 'view' ? 'VIEW' : 'TABLE'} IF EXISTS "${t.name}"`)
  db.exec(`DROP TABLE IF EXISTS "${martor}"`)
  db.exec(text)
  const tabele = db
    .prepare(`SELECT count(*) AS cate FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
    .get()
  db.close()
  rmSync(sql, { force: true })
  console.log(`${tabele.cate} tabele, ${(text.length / 1048576).toFixed(1)} MB`)
}

/* ─────────────────────────────── R2 ─────────────────────────────── */

/** Toate obiectele unui depozit online: cheia si marimea, cu paginare. */
const obiecteOnline = async (galeata) => {
  const toate = []
  let cursor = null
  do {
    /* ⚠️ Cursorul sta in `result_info`, NU in `result` — cine se uita in `result` pleaca multumit cu
       primele 1000 de obiecte (patit la `biserica-biblioteca`, 15.09.2026). */
    const d = await apiPlin(
      `/r2/buckets/${galeata}/objects?per_page=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    )
    const lista = d.result
    for (const o of lista.objects ?? lista) toate.push({ key: o.key, size: o.size })
    cursor = d.result_info?.is_truncated ? d.result_info?.cursor : null
  } while (cursor)
  return toate
}

/** Worker efemer peste starea locala: prin el se scriu obiectele in R2-ul simulat. */
const WORKER = `/**
 * Worker EFEMER, pornit numai de \`adu-local.mjs\`: usa prin care obiectele din productie intra in
 * R2-ul simulat al lui \`pnpm dev\`. Nu se publica nicaieri si nu sta pornit: traieste cat tine o
 * aducere.
 *
 *   GET  /lista/<BINDING>        ce e deja local: cheie si marime
 *   PUT  /obiect/<BINDING>/<cheie urlencoded>   scrie obiectul (corpul cererii)
 */
export default {
  async fetch(req, env) {
    const u = new URL(req.url)
    const bucati = u.pathname.split('/').filter(Boolean)
    const galeata = env[bucati[1] ?? '']
    if (!galeata) return new Response('nu e nicio galeata cu numele asta', { status: 404 })

    if (bucati[0] === 'lista') {
      const toate = []
      let cursor = undefined
      do {
        const r = await galeata.list({ limit: 1000, cursor })
        for (const o of r.objects) toate.push({ key: o.key, size: o.size })
        cursor = r.truncated ? r.cursor : undefined
      } while (cursor)
      return Response.json(toate)
    }

    if (bucati[0] === 'obiect' && req.method === 'PUT') {
      const cheie = decodeURIComponent(bucati.slice(2).join('/'))
      const tip = req.headers.get('x-tip')
      await galeata.put(cheie, req.body, tip ? { httpMetadata: { contentType: tip } } : undefined)
      return new Response('scris')
    }
    return new Response('adresa nu exista', { status: 404 })
  },
}
`

/** Pornirea workerului efemer, cu bindinguri catre toate depozitele cerute. */
const pornesteWorkerul = async (galeti) => {
  stingeWorkerulVechi()
  mkdirSync(LUCRU, { recursive: true })
  writeFileSync(join(LUCRU, 'worker.js'), WORKER)
  writeFileSync(
    join(LUCRU, 'wrangler.jsonc'),
    `${JSON.stringify(
      {
        name: 'xc-adu-local',
        main: 'worker.js',
        compatibility_date: '2026-09-01',
        r2_buckets: galeti.map((g, i) => ({ binding: `B${i}`, bucket_name: g })),
      },
      null,
      2,
    )}\n`,
  )
  const copil = spawn(
    'npx',
    ['wrangler', 'dev', '-c', join(LUCRU, 'wrangler.jsonc'), '--persist-to', STARE, '--ip', '127.0.0.1', '--port', String(PORT)],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  )
  let plangeri = ''
  copil.stderr.on('data', (b) => {
    plangeri += b.toString()
  })
  for (let i = 0; i < 60; i++) {
    await new Promise((gata) => setTimeout(gata, 1000))
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/lista/B0`)
      if (r.ok) return copil
    } catch {
      /* inca nu raspunde */
    }
    if (copil.exitCode !== null) throw new Error(`workerul efemer a murit:\n${plangeri.slice(-500)}`)
  }
  copil.kill()
  throw new Error(`workerul efemer n-a pornit in 60 s:\n${plangeri.slice(-500)}`)
}

/** Un depozit, obiect cu obiect. Ce e deja local cu aceeasi marime se sare. */
const aduR2 = async (galeata, binding, online) => {
  const localLista = await (await fetch(`http://127.0.0.1:${PORT}/lista/${binding}`)).json()
  const local = new Map(localLista.map((o) => [o.key, o.size]))
  const sarite = online.filter((o) => local.get(o.key) === o.size).length
  const deAdus = online.filter((o) => local.get(o.key) !== o.size)
  let scrise = 0
  let octeti = 0
  await inParalel(deAdus, FIRE, async (o) => {
    const r = await cuRabdare(
      `https://api.cloudflare.com/client/v4/accounts/${CONT}/r2/buckets/${galeata}/objects/${encodeURIComponent(o.key)}`,
      { headers: { authorization: `Bearer ${TOKEN}` } },
    )
    if (!r.ok) throw new Error(`${o.key}: HTTP ${r.status}`)
    const trup = await r.arrayBuffer()
    const pus = await fetch(`http://127.0.0.1:${PORT}/obiect/${binding}/${encodeURIComponent(o.key)}`, {
      method: 'PUT',
      body: trup,
      headers: r.headers.get('content-type') ? { 'x-tip': r.headers.get('content-type') } : {},
    })
    if (!pus.ok) throw new Error(`${o.key}: nu s-a scris local (HTTP ${pus.status})`)
    scrise++
    octeti += trup.byteLength
    if (scrise % 100 === 0) process.stdout.write(`${scrise} `)
  })
  return { scrise, sarite, octeti }
}

/* ─────────────────────────────── mersul uneltei ─────────────────────────────── */

const marime = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(0)} MB` : `${(n / 1024).toFixed(0)} KB`)

const lista = resurse()
if (!lista.length) {
  console.error(DOAR ? `nicio aplicatie dintre: ${DOAR.join(', ')}` : 'nicio aplicatie cu D1 sau R2')
  process.exit(1)
}

if (CHIAR && devPornit()) {
  console.error('⚠️ `pnpm dev` e pornit, iar el tine aceleasi fisiere de stare deschise.')
  console.error('   Opreste-l, reia aducerea, apoi porneste-l la loc — abia atunci vede datele noi.')
  process.exit(1)
}

if (!CHIAR) {
  // SOCOTEALA: ce e online, cat e, si cat din el se afla deja local. Nu scrie nimic.
  console.log('SOCOTEALĂ (nu se scrie nimic). Aplicațiile cu date online:\n')
  let totalOcteti = 0
  let totalObiecte = 0
  for (const a of lista) {
    for (const b of a.d1) console.log(`  ${a.nume}  ·  D1 ${b.online}`)
    for (const g of a.r2) {
      const online = await obiecteOnline(g.online)
      const octeti = online.reduce((s, o) => s + o.size, 0)
      totalObiecte += online.length
      totalOcteti += octeti
      console.log(`  ${a.nume}  ·  R2 ${g.online}: ${online.length} obiecte, ${marime(octeti)}`)
    }
  }
  console.log(`\n  TOTAL R2: ${totalObiecte} obiecte, ${marime(totalOcteti)}`)
  console.log('\nAducerea: `--chiar` (adaugă `--fara-r2` dacă vrei doar bazele).')
  process.exit(0)
}

// ------------------------------------------------------------------ D1
if (!FARA_D1) {
  console.log('BAZELE D1 (export din producție → baza locală):')
  for (const a of lista) for (const b of a.d1) aduD1(a, b)
} else {
  console.log('D1: sărit (--fara-d1)')
}

// ------------------------------------------------------------------ R2
const galeti = lista.flatMap((a) => a.r2.map((g) => ({ ...g, aplicatie: a.nume })))
if (FARA_R2 || !galeti.length) {
  console.log(FARA_R2 ? 'R2: sărit (--fara-r2)' : 'R2: nimic de adus')
} else {
  console.log('\nDEPOZITELE R2 (obiect cu obiect; ce e deja local se sare):')
  const copil = await pornesteWorkerul(galeti.map((g) => g.local))
  try {
    for (const [i, g] of galeti.entries()) {
      process.stdout.write(`  r2 ${g.online} … `)
      const online = await obiecteOnline(g.online)
      const { scrise, sarite, octeti } = await aduR2(g.online, `B${i}`, online)
      console.log(`${scrise} aduse (${marime(octeti)}), ${sarite} deja`)
    }
  } finally {
    copil.kill()
  }
}

console.log('\nGata. Pornește `pnpm dev` la loc — abia repornit vede datele noi.')
