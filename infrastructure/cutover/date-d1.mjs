#!/usr/bin/env node
/**
 * Muta datele din bazele D1 de staging in cele de productie, tabel cu tabel.
 *
 *   node infrastructure/cutover/date-d1.mjs            # arata ce ar copia
 *   node infrastructure/cutover/date-d1.mjs --scrie    # copiaza
 *   node infrastructure/cutover/date-d1.mjs --scrie --doar curatenie,program
 *   node infrastructure/cutover/date-d1.mjs --scrie --curata     # goleste si reface ce a ramas pe jumatate
 *
 * ⚠️ Nu se copiaza TOT. Ce e istorie a mediului de staging (sesiuni, coduri de intrare, incercari
 * de login, livrari incercate, coada de evenimente, auditul si discutiile chatului) ramane acolo:
 * productia incepe curata. Se muta numai ce e al PAROHIEI — datele venite din V1 si conturile.
 *
 * Schema e deja pusa de migratii, deci exportul e fara schema. `d1_migrations`, `_cf_KV` si
 * `sqlite_sequence` nu se ating niciodata.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'

const argumente = process.argv.slice(2)
const SCRIE = argumente.includes('--scrie')
/** ⚠️ Goleste tabelele ramase pe jumatate si le reface. Numai in `xc-*-production`, numai la cerere. */
const CURATA = argumente.includes('--curata')
const iDoar = argumente.indexOf('--doar')
const DOAR = iDoar >= 0 ? (argumente[iDoar + 1] ?? '').split(',').filter(Boolean) : null

/** Ce se muta, de unde. Ce lipseste din lista nu se muta — dinadins. */
const BAZE = [
  { nume: 'identity', config: 'services/identity-worker', tabele: ['users', 'identities', 'asocieri', 'consents'] },
  { nume: 'authz', config: 'services/authorization-worker', tabele: ['role_assignments', 'permission_grants'] },
  { nume: 'communication', config: 'services/communication-worker', tabele: ['audiences', 'audience_members', 'preferences', 'templates'] },
  { nume: 'calendar', config: 'apps/calendar', tabele: ['zile', 'texte', 'versiuni', 'corecturi', 'importuri'] },
  { nume: 'program', config: 'apps/program', tabele: ['vocabular', 'saptamani', 'slujbe', 'istoric'] },
  { nume: 'tipic', config: 'apps/tipic', tabele: ['carti', 'minei', 'randuiala', 'tipiconal', 'importuri'] },
  { nume: 'biblioteca', config: 'apps/biblioteca', tabele: ['cereri', 'cereri_acces', 'scrisori'] },
  { nume: 'buletin', config: 'apps/buletin', tabele: ['buletine'] },
  { nume: 'curatenie', config: 'apps/curatenie', tabele: ['volunteers', 'app_settings', 'assignments', 'volunteer_vacations', 'newsletter_history', 'notifications_log'] },
  { nume: 'automation', config: 'services/automation-worker', tabele: ['rules', 'actions'] },
]

const dormi = (s) => execFileSync('sleep', [String(s)])

/**
 * ⚠️ Cloudflare raspunde 971 („wait 60 seconds") cand se cere prea des — pravalia intreaga, nu doar
 * D1. Aici nu se renunta la prima palma: se asteapta si se incearca din nou.
 *
 * ⚠️ A doua palma, vazuta la `tipic` (14.09.2026): `completeMultipartUpload ... internal error
 * (10001)` — wrangler urca fisierul de import prin R2, iar urcarea pica de la sine. Patru tabele
 * la rand au cazut asa. E trecatoare, deci se trateaza la fel: asteapta si incearca din nou.
 */
function wrangler(args, incercari = 4) {
  for (let i = 1; ; i++) {
    try {
      return execFileSync('npx', ['wrangler', ...args], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 }).toString()
    } catch (e) {
      const text = String(e.stderr ?? '') + String(e.stdout ?? '')
      const prea_des = /\b971\b|Retry-After|throttling/i.test(text)
      const trecatoare = /\b10001\b|internal error|completeMultipartUpload|\b50[023]\b/i.test(text)
      if (i < incercari && (prea_des || trecatoare)) {
        const pauza = prea_des ? 65 : 10 * i
        process.stdout.write(` (${prea_des ? '971' : 'eroare trecatoare'}, astept ${pauza}s)`)
        dormi(pauza)
        continue
      }
      e.text = text
      throw e
    }
  }
}

/**
 * ⚠️ D1 taie orice SQL mai lung de ~100 KB: `statement too long: SQLITE_TOOBIG`. Limita e pe
 * STATEMENT, nu pe fisier — iar `d1 export` scrie un INSERT pe rand, cu textul inline, deci un
 * singur sinaxar lung (102 KB la `calendar.texte`) nu incape si nu se poate taia in doua.
 * De aceea fisierul se trimite in bucati doar cat sa nu supere limita, iar randurile care tot
 * nu incap merg pe drumul ocolit de mai jos, cu valorile scoase din SQL.
 */
const CAT_INCAPE = 90_000

/**
 * Trimite fisierul exportat in productie. `d1 export` scrie **un INSERT pe linie**, deci un fisier
 * prea mare se taie curat pe linii — fara sa se umble in interiorul vreunui statement, unde stau
 * ghilimele si `;` din textele liturgice. `PRAGMA`-ul din capul fisierului merge cu fiecare bucata.
 */
/** Uuid-ul bazei de productie, pentru cererile facute de-a dreptul la API. */
const uuiduri = new Map()
function uuidProductie(baza) {
  if (!uuiduri.has(baza.nume)) {
    const out = wrangler(['d1', 'info', `xc-${baza.nume}-production`, '--json'])
    uuiduri.set(baza.nume, JSON.parse(out.slice(out.indexOf('{'))).uuid)
  }
  return uuiduri.get(baza.nume)
}

/**
 * Drumul ocolit pentru randurile care nu incap intr-un INSERT: valorile ies din SQL si merg ca
 * PARAMETRI. `INSERT INTO t (a,b) VALUES (?,?),(?,?)` ramane de cateva sute de octeti oricat de
 * lung ar fi textul, fiindca limita de 100 KB se uita la SQL, nu la parametri.
 */
async function importaPrinApi(baza, tabel) {
  const cont = process.env.CLOUDFLARE_ACCOUNT_ID
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!cont || !token) throw new Error('lipseste CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN')

  const out = wrangler([
    'd1', 'execute', `xc-${baza.nume}-staging`, '--remote', '--env', 'staging',
    '-c', `${baza.config}/wrangler.jsonc`, '--json', '--command', `SELECT * FROM ${tabel}`,
  ])
  const randuri = JSON.parse(out.slice(out.indexOf('[')))[0].results
  if (randuri.length === 0) return

  const coloane = Object.keys(randuri[0])
  const capul = `INSERT INTO "${tabel}" (${coloane.map((c) => `"${c}"`).join(',')}) VALUES `
  const unRand = `(${coloane.map(() => '?').join(',')})`
  const adresa = `https://api.cloudflare.com/client/v4/accounts/${cont}/d1/database/${uuidProductie(baza)}/query`

  // ⚠️ Doua limite deodata, si cea mai stramta hotaraste. SQLite nu primeste mai mult de 100 de
  // variabile intr-un statement (`too many SQL variables`), deci un lot are cel mult
  // 100/coloane randuri; iar randurile sunt inegale (un sinaxar are 100 KB, altul 2 KB), deci
  // lotul se si cantareste, pana aproape de 2 MB — cat duce linistit o cerere.
  const MAX_VARIABILE = 100
  const catIncapeInLot = Math.max(1, Math.floor(MAX_VARIABILE / coloane.length))
  const loturi = []
  let lot = []
  let cat = 0
  for (const r of randuri) {
    const greutate = coloane.reduce((s, c) => s + String(r[c] ?? '').length, 0)
    if (lot.length && (lot.length >= catIncapeInLot || cat + greutate > 2_000_000)) {
      loturi.push(lot); lot = []; cat = 0
    }
    lot.push(r)
    cat += greutate
  }
  if (lot.length) loturi.push(lot)

  process.stdout.write(`  (prin API, ${randuri.length} randuri in ${loturi.length} loturi)`)
  for (const l of loturi) {
    const raspuns = await fetch(adresa, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql: capul + l.map(() => unRand).join(',') + ';',
        params: l.flatMap((r) => coloane.map((c) => (r[c] === null || r[c] === undefined ? null : String(r[c])))),
      }),
    })
    const j = await raspuns.json().catch(() => ({}))
    if (!raspuns.ok || !j.success) throw new Error(`API D1: HTTP ${raspuns.status} ${JSON.stringify(j.errors ?? j).slice(0, 300)}`)
  }
}

async function importa(baza, tabel, fisier) {
  const executa = (f) => wrangler([
    'd1', 'execute', `xc-${baza.nume}-production`, '--remote', '--env', 'production',
    '-c', `${baza.config}/wrangler.jsonc`, '--yes', '--file', f,
  ])

  const cuprins = readFileSync(fisier, 'utf8')
  if (cuprins.length <= CAT_INCAPE) return executa(fisier)

  const linii = cuprins.split('\n')
  const pragme = linii.filter((l) => l.startsWith('PRAGMA'))
  const restul = linii.filter((l) => l.trim() && !l.startsWith('PRAGMA'))

  // Un singur rand mai lung decat limita nu se poate taia in doua: tot tabelul merge pe ocolite.
  if (restul.some((l) => l.length > CAT_INCAPE)) return importaPrinApi(baza, tabel)

  const bucati = []
  let acum = []
  let cat = 0
  for (const linie of restul) {
    if (cat + linie.length > CAT_INCAPE && acum.length) { bucati.push(acum); acum = []; cat = 0 }
    acum.push(linie)
    cat += linie.length + 1
  }
  if (acum.length) bucati.push(acum)

  process.stdout.write(`  (${omeneste(cuprins.length)}, in ${bucati.length} bucati)`)
  for (let i = 0; i < bucati.length; i++) {
    const f = `${fisier}.${i}`
    writeFileSync(f, [...pragme, ...bucati[i]].join('\n') + '\n')
    try { executa(f) } finally { rmSync(f, { force: true }) }
  }
  return ''
}

const omeneste = (o) => (o > 1e6 ? `${(o / 1e6).toFixed(1)} MB` : `${Math.round(o / 1000)} KB`)

/** Cate randuri are un tabel. `null` = tabelul chiar lipseste; eroarea de retea se arunca mai departe. */
function randuri(baza, mediu, tabel) {
  try {
    const out = wrangler([
      'd1', 'execute', `xc-${baza.nume}-${mediu}`, '--remote', '--env', mediu,
      '-c', `${baza.config}/wrangler.jsonc`, '--json',
      '--command', `SELECT COUNT(*) AS n FROM ${tabel}`,
    ])
    return JSON.parse(out.slice(out.indexOf('[')))[0].results[0].n
  } catch (e) {
    if (/no such table/i.test(e.text ?? '')) return null
    throw e
  }
}

let totalMutate = 0
/** ⚠️ Ce n-a intrat. Fara asta, un „Gata: N randuri" cu cod 0 ascunde tabele lipsa (14.09.2026). */
const nereusite = []
for (const baza of BAZE) {
  if (DOAR && !DOAR.includes(baza.nume)) continue
  console.log(`\n=== ${baza.nume} ===`)

  for (const tabel of baza.tabele) {
    const deUnde = randuri(baza, 'staging', tabel)
    const inainte = randuri(baza, 'production', tabel)
    process.stdout.write(`  ${tabel.padEnd(22)} staging ${String(deUnde).padStart(6)} → productie ${String(inainte).padStart(6)}`)

    if (deUnde === null || inainte === null) { console.log('  (tabel lipsa — sar)'); continue }
    if (deUnde === 0) { console.log('  (gol — sar)'); continue }

    // ⚠️ „Are deja randuri" NU inseamna „e gata": `calendar.texte` a ramas la 228 din 730 dupa un
    // import cazut la mijloc, si sarindu-l tacut ar fi plecat asa pe productie (14.09.2026).
    if (inainte > 0 && inainte !== deUnde) {
      if (!CURATA) {
        console.log(`  ⚠️ PE JUMATATE (${inainte} din ${deUnde}) — reia cu --curata`)
        nereusite.push(`${baza.nume}.${tabel} (pe jumatate: ${inainte} din ${deUnde})`)
        continue
      }
      if (!SCRIE) { console.log(`  ⚠️ PE JUMATATE (${inainte} din ${deUnde}) — s-ar goli si reface`); continue }
      console.log(`  ⚠️ PE JUMATATE (${inainte} din ${deUnde}) — golesc si refac`)
      wrangler([
        'd1', 'execute', `xc-${baza.nume}-production`, '--remote', '--env', 'production',
        '-c', `${baza.config}/wrangler.jsonc`, '--yes', '--command', `DELETE FROM ${tabel}`,
      ])
      process.stdout.write(`  ${tabel.padEnd(22)} refac`)
    } else if (inainte > 0) { console.log('  (are deja randuri — sar)'); continue }

    if (!SCRIE) { console.log('  ← de copiat'); continue }

    const fisier = `/tmp/d1-${baza.nume}-${tabel}.sql`
    try {
      wrangler([
        'd1', 'export', `xc-${baza.nume}-staging`, '--remote', '--env', 'staging',
        '-c', `${baza.config}/wrangler.jsonc`, '--no-schema', '--table', tabel, '--output', fisier,
      ])
      if (!existsSync(fisier)) throw new Error('exportul n-a scris fisierul')
      await importa(baza, tabel, fisier)
      const dupa = randuri(baza, 'production', tabel)
      const potrivit = dupa === deUnde
      console.log(`  copiat → ${dupa}${potrivit ? '' : '  ⚠️ ALTA SOCOTEALA'}`)
      if (!potrivit) nereusite.push(`${baza.nume}.${tabel} (${dupa} din ${deUnde})`)
      totalMutate += dupa ?? 0
    } catch (e) {
      console.log('  ESUAT')
      nereusite.push(`${baza.nume}.${tabel}`)
      console.error(String(e.stderr ?? e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(-700))
    } finally {
      rmSync(fisier, { force: true })
    }
  }
}
console.log(`\n${SCRIE ? `Gata: ${totalMutate} de randuri pe productie.` : 'Proba uscata — cu --scrie se copiaza.'}`)
if (nereusite.length) {
  console.log(`\n⚠️ ${nereusite.length} NEREUSITE (se reiau ruland din nou):`)
  for (const n of nereusite) console.log(`  ${n}`)
  process.exit(1)
}
