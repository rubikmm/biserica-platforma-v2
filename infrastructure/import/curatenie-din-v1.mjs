#!/usr/bin/env node
/**
 * Copiaza curatenia (A6) din baza V1 `biserica-curatenie` in cea NOUA, `xc-curatenie-*`.
 * O singura data, cu numaratoare de randuri; fara sincronizare continua.
 *
 *   node infrastructure/import/curatenie-din-v1.mjs --scrie staging
 *   node infrastructure/import/curatenie-din-v1.mjs --scrie local
 *
 * Randurile se citesc DIRECT din D1-ul V1, prin API-ul REST (tokenul din
 * `/backup/_setup/cloudflare.env`). Nu se scrie NIMIC in baza V1: aplicatia de acolo e VIE.
 *
 * Ce NU se copiaza, si de ce:
 *   * `password_hash`, `password_reset_token`, `password_reset_expires_at` — dreptul de
 *     administrare e al platformei (`cleaning.manage`), nu al unei parole din aplicatie. Cele trei
 *     hash-uri bcrypt raman in V1 si mor cu el;
 *   * `persoana_id` se copiaza, dar sub numele lui din V2: `user_id`.
 *
 * ⚠️ `newsletter_history.html_content` tine scrisoarea intreaga (zeci de KB): tabelul se trimite in
 * loturi mici, altfel cererea catre D1 trece de marimea primita.
 */
import { bazaLocala, bazaStaging, insereazaLoturi } from './d1.mjs'

const argumente = process.argv.slice(2)
const opt = (n, implicit = null) => {
  const i = argumente.indexOf(`--${n}`)
  return i >= 0 ? argumente[i + 1] : implicit
}

const SCRIE = opt('scrie', 'staging')
const DB_ID = opt('db-id', '0c60549b-9f84-4f92-a788-835929a2f8c7')
/** Baza V1, de unde se citeste. Read-only. */
const DB_V1 = opt('db-v1', 'bb33e97e-8a6b-4d7a-b927-bed546957a07')

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

/**
 * Tabelele, in ordinea in care se pot scrie (voluntarii intai — de ei atarna tot restul).
 * `alege` = ce se ia din V1; `coloane` = cum se scriu in V2. `lot` = cate randuri odata.
 */
const TABELE = [
  {
    nume: 'volunteers',
    alege: 'id, first_name, last_name, email, phone, is_active, created_at, updated_at, is_admin, slug, is_volunteer, is_monitor, persoana_id AS user_id',
    coloane: ['id', 'first_name', 'last_name', 'email', 'phone', 'is_active', 'created_at', 'updated_at', 'is_admin', 'slug', 'is_volunteer', 'is_monitor', 'user_id'],
    ordine: 'id',
  },
  {
    nume: 'assignments',
    alege: 'id, sunday_date, slot_position, volunteer_id, created_at',
    coloane: ['id', 'sunday_date', 'slot_position', 'volunteer_id', 'created_at'],
    ordine: 'id',
  },
  {
    nume: 'volunteer_vacations',
    alege: 'id, volunteer_id, year, month, created_at',
    coloane: ['id', 'volunteer_id', 'year', 'month', 'created_at'],
    ordine: 'id',
  },
  {
    nume: 'notifications_log',
    alege: 'id, event_type, message, sunday_date, slot_position, volunteer_id, status, error, created_at, sent_at',
    coloane: ['id', 'event_type', 'message', 'sunday_date', 'slot_position', 'volunteer_id', 'status', 'error', 'created_at', 'sent_at'],
    ordine: 'id',
    // ⚠️ Fara `lot` scris de mana: marimea implicita se socoteste din numarul de coloane, fiindca
    // D1 primeste cel mult 100 de valori legate intr-o singura comanda. Un lot de 100 de randuri x
    // 10 coloane = 1000 de valori si cade cu „too many SQL variables" (patit la prima rulare).
  },
  {
    nume: 'app_settings',
    alege: 'key, value',
    coloane: ['key', 'value'],
    ordine: 'key',
  },
  {
    // Scrisorile intregi — loturi mici.
    nume: 'newsletter_history',
    alege: 'id, sunday_date, subject, html_content, recipients_count, failed_count, created_at, kind, recipients_json, is_test',
    coloane: ['id', 'sunday_date', 'subject', 'html_content', 'recipients_count', 'failed_count', 'created_at', 'kind', 'recipients_json', 'is_test'],
    ordine: 'id',
    lot: 3,
  },
]

const baza = SCRIE === 'local' ? await bazaLocala('volunteers') : bazaStaging(DB_ID)
console.error(`scriu in ${baza.fel}: ${baza.cale}`)

/*
 * ⚠️ Tabelele se GOLESC intai, copil inainte de parinte.
 *
 * `insereazaLoturi` scrie cu `INSERT OR REPLACE`, iar REPLACE inseamna „sterge rândul de dinainte
 * si pune-l pe ăsta". La o a doua rulare, stergerea unui voluntar care are deja programari cade pe
 * `ON DELETE RESTRICT` din `assignments` — asa a picat prima reluare. Golirea in ordinea de mai jos
 * face scriptul reluabil de oricate ori, ceea ce la o copiere de date conteaza mai mult decat
 * pastrarea a ceva ce oricum vine din V1.
 */
for (const tabel of ['notifications_log', 'assignments', 'volunteer_vacations', 'newsletter_history', 'app_settings', 'volunteers']) {
  await baza.ruleaza(`DELETE FROM ${tabel}`)
}
console.error('tabelele au fost golite (copil inainte de parinte)')

let totalAsteptat = 0
let totalScris = 0

for (const t of TABELE) {
  const cate = Number((await intreabaV1(`SELECT COUNT(*) AS cate FROM ${t.nume}`))[0]?.cate ?? 0)
  totalAsteptat += cate
  if (cate === 0) {
    console.error(`  ${t.nume}: 0 (nimic de copiat)`)
    continue
  }
  const randuri = await intreabaV1(`SELECT ${t.alege} FROM ${t.nume} ORDER BY ${t.ordine}`)
  if (randuri.length !== cate) throw new Error(`${t.nume}: am cerut ${cate} randuri, am primit ${randuri.length}`)
  const n = await insereazaLoturi(baza, t.nume, t.coloane, randuri, t.lot ?? null)
  totalScris += n
  console.error(`  ${t.nume}: ${n}/${cate}`)
}

console.error(`scrise ${totalScris}/${totalAsteptat} randuri cu totul`)
if (totalScris !== totalAsteptat) {
  console.error('⚠️ numarul nu se potriveste — reia rularea (INSERT OR REPLACE, deci e idempotenta)')
  process.exitCode = 1
}
baza.inchide?.()
