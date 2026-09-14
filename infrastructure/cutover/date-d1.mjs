#!/usr/bin/env node
/**
 * Muta datele din bazele D1 de staging in cele de productie, tabel cu tabel.
 *
 *   node infrastructure/cutover/date-d1.mjs            # arata ce ar copia
 *   node infrastructure/cutover/date-d1.mjs --scrie    # copiaza
 *   node infrastructure/cutover/date-d1.mjs --scrie --doar curatenie,program
 *
 * ⚠️ Nu se copiaza TOT. Ce e istorie a mediului de staging (sesiuni, coduri de intrare, incercari
 * de login, livrari incercate, coada de evenimente, auditul si discutiile chatului) ramane acolo:
 * productia incepe curata. Se muta numai ce e al PAROHIEI — datele venite din V1 si conturile.
 *
 * Schema e deja pusa de migratii, deci exportul e fara schema. `d1_migrations`, `_cf_KV` si
 * `sqlite_sequence` nu se ating niciodata.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, existsSync } from 'node:fs'

const argumente = process.argv.slice(2)
const SCRIE = argumente.includes('--scrie')
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
 * D1. Aici nu se renunta la prima palma: se asteapta si se incearca din nou, de trei ori.
 */
function wrangler(args, incercari = 3) {
  for (let i = 1; ; i++) {
    try {
      return execFileSync('npx', ['wrangler', ...args], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 }).toString()
    } catch (e) {
      const text = String(e.stderr ?? '') + String(e.stdout ?? '')
      if (i < incercari && /\b971\b|Retry-After|throttling/i.test(text)) {
        process.stdout.write(' (971, astept 65s)')
        dormi(65)
        continue
      }
      e.text = text
      throw e
    }
  }
}

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
for (const baza of BAZE) {
  if (DOAR && !DOAR.includes(baza.nume)) continue
  console.log(`\n=== ${baza.nume} ===`)

  for (const tabel of baza.tabele) {
    const deUnde = randuri(baza, 'staging', tabel)
    const inainte = randuri(baza, 'production', tabel)
    process.stdout.write(`  ${tabel.padEnd(22)} staging ${String(deUnde).padStart(6)} → productie ${String(inainte).padStart(6)}`)

    if (deUnde === null || inainte === null) { console.log('  (tabel lipsa — sar)'); continue }
    if (deUnde === 0) { console.log('  (gol — sar)'); continue }
    if (inainte > 0) { console.log('  (are deja randuri — sar)'); continue }
    if (!SCRIE) { console.log('  ← de copiat'); continue }

    const fisier = `/tmp/d1-${baza.nume}-${tabel}.sql`
    try {
      wrangler([
        'd1', 'export', `xc-${baza.nume}-staging`, '--remote', '--env', 'staging',
        '-c', `${baza.config}/wrangler.jsonc`, '--no-schema', '--table', tabel, '--output', fisier,
      ])
      if (!existsSync(fisier)) throw new Error('exportul n-a scris fisierul')
      wrangler([
        'd1', 'execute', `xc-${baza.nume}-production`, '--remote', '--env', 'production',
        '-c', `${baza.config}/wrangler.jsonc`, '--yes', '--file', fisier,
      ])
      const dupa = randuri(baza, 'production', tabel)
      console.log(`  copiat → ${dupa}${dupa === deUnde ? '' : '  ⚠️ ALTA SOCOTEALA'}`)
      totalMutate += dupa ?? 0
    } catch (e) {
      console.log('  ESUAT')
      console.error(String(e.stderr ?? e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(-700))
    } finally {
      rmSync(fisier, { force: true })
    }
  }
}
console.log(`\n${SCRIE ? `Gata: ${totalMutate} de randuri pe productie.` : 'Proba uscata — cu --scrie se copiaza.'}`)
