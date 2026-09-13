#!/usr/bin/env node
/**
 * Copiaza arhiva buletinului (A3) din baza V1 `biserica-buletin` in cea NOUA, `xc-buletin-*`.
 * O singura data, cu verificare de numar de randuri; fara sincronizare continua.
 *
 *   node infrastructure/import/buletin-din-v1.mjs --scrie staging --db-id <id>
 *   node infrastructure/import/buletin-din-v1.mjs --scrie local
 *
 * Randurile se citesc DIRECT din D1-ul V1, prin API-ul REST (tokenul din
 * `/backup/_setup/cloudflare.env`), an cu an: textul celor 619 numere face vreo 4,6 MB cu totul,
 * prea mult pentru un singur raspuns.
 *
 * Ce NU se copiaza: tabelul `abonati` al V1 (e-mail, nume, persoana_id). In V2 abonarea e o
 * audienta a comunicarii, iar aplicatia nu tine nicio adresa — structura mare, user 10.09.2026.
 *
 * ⚠️ `text_plat` se copiaza ASA CUM E, nu se recalculeaza: cautarea taie fragmentul din `text` la
 * pozitia gasita in `text_plat`, deci cele doua coloane trebuie sa ramana litera cu litera in
 * dreptul aceleiasi pozitii, ca in V1.
 */
import { bazaLocala, bazaStaging, insereazaLoturi } from './d1.mjs'

const argumente = process.argv.slice(2)
const opt = (n, implicit = null) => {
  const i = argumente.indexOf(`--${n}`)
  return i >= 0 ? argumente[i + 1] : implicit
}

const SCRIE = opt('scrie', 'staging')
const DB_ID = opt('db-id', '63edbc94-001d-4097-8a40-9ddd98227e94')
/** Baza V1, de unde se citeste. Nu se scrie NIMIC in ea. */
const DB_V1 = opt('db-v1', 'def4f89e-b949-4954-bb6a-d3868461ab94')

const CONT = process.env.CLOUDFLARE_ACCOUNT_ID
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
if (!CONT || !TOKEN) {
  console.error('lipseste CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN')
  console.error('inainte de rulare: set -a; . /backup/_setup/cloudflare.env; set +a')
  process.exit(1)
}

/** O intrebare pusa bazei V1, prin API-ul REST. Doar SELECT. */
async function intreabaV1(sql, params = []) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CONT}/d1/database/${DB_V1}/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  })
  const j = await r.json().catch(() => ({}))
  if (!j.success) throw new Error(`V1: ${JSON.stringify(j.errors ?? j)}`)
  return j.result?.[0]?.results ?? []
}

const COLOANE = [
  'nr', 'data', 'an', 'luna',
  'cheie_pdf', 'cheie_poza', 'cheie_poza_mica',
  'marime_pdf', 'pagini', 'sursa', 'text', 'text_plat',
]

const ani = (await intreabaV1('SELECT an, COUNT(*) AS cate FROM buletine GROUP BY an ORDER BY an')).map((r) => r)
const asteptate = ani.reduce((s, a) => s + a.cate, 0)
console.error(`V1: ${asteptate} buletine in ${ani.length} ani (${ani[0]?.an}–${ani[ani.length - 1]?.an})`)

const baza = SCRIE === 'local' ? await bazaLocala('buletine') : bazaStaging(DB_ID)
console.error(`scriu in ${baza.fel}: ${baza.cale}`)

let scrise = 0
for (const { an, cate } of ani) {
  const randuri = await intreabaV1(`SELECT ${COLOANE.join(', ')} FROM buletine WHERE an = ? ORDER BY data, nr`, [an])
  if (randuri.length !== cate) throw new Error(`anul ${an}: am cerut ${cate} randuri, am primit ${randuri.length}`)
  const n = await insereazaLoturi(baza, 'buletine', COLOANE, randuri)
  scrise += n
  console.error(`  ${an}: ${n}`)
}

const gasite = await baza.ruleaza('SELECT COUNT(*) AS cate FROM buletine').catch(() => null)
console.error(`scrise ${scrise}/${asteptate} buletine`)
if (scrise !== asteptate) {
  console.error('⚠️ numarul nu se potriveste — reia rularea (INSERT OR REPLACE, deci e idempotenta)')
  process.exitCode = 1
}
if (gasite) console.error('verificare in baza noua:', JSON.stringify(gasite.results ?? gasite))
baza.inchide?.()
