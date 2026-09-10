#!/usr/bin/env node
/**
 * Ruleaza migratiile SQL peste bazele D1.
 *
 *   node infrastructure/migrations/ruleaza.mjs --local
 *   node infrastructure/migrations/ruleaza.mjs --remote --env staging
 *
 * `--local` scrie in starea din `.wrangler/state`, aceeasi pe care o foloseste `wrangler dev`.
 * `--remote` atinge bazele reale din Cloudflare — se cere confirmare in afara lui staging.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const RADACINA = resolve(import.meta.dirname, '../..')

/** Ce migratii apartin carei baze, si prin ce configuratie de worker se ajunge la ea. */
const BAZE = [
  { director: 'identity', config: 'services/identity-worker/wrangler.jsonc', binding: 'DB' },
  { director: 'authz', config: 'services/authorization-worker/wrangler.jsonc', binding: 'DB' },
  { director: 'audit', config: 'services/audit-worker/wrangler.jsonc', binding: 'DB' },
  { director: 'program', config: 'apps/program/wrangler.jsonc', binding: 'DB' },
  { director: 'communication', config: 'services/communication-worker/wrangler.jsonc', binding: 'DB' },
  { director: 'automation', config: 'services/automation-worker/wrangler.jsonc', binding: 'DB' },
]

const argumente = process.argv.slice(2)
const local = argumente.includes('--local')
const remote = argumente.includes('--remote')
const indexEnv = argumente.indexOf('--env')
const mediu = indexEnv >= 0 ? argumente[indexEnv + 1] : null

if (local === remote) {
  console.error('Alege exact una: --local sau --remote')
  process.exit(1)
}

if (remote && mediu !== 'staging') {
  console.error(
    'Refuz: `--remote` e permis doar cu `--env staging` in aceasta faza.\n' +
      'Productia nu se atinge fara o decizie explicita a utilizatorului.',
  )
  process.exit(1)
}

function numeBazaDin(director) {
  return `xc-${director === 'authz' ? 'authz' : director}-staging`
}

let totalFisiere = 0

for (const baza of BAZE) {
  const cale = join(RADACINA, 'infrastructure/migrations', baza.director)
  const fisiere = readdirSync(cale)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  if (fisiere.length === 0) continue

  console.log(`\n=== ${baza.director} (${fisiere.length} fisiere) ===`)

  for (const fisier of fisiere) {
    const argumenteWrangler = [
      'wrangler@4',
      'd1',
      'execute',
      numeBazaDin(baza.director),
      local ? '--local' : '--remote',
      '--yes',
      '--config',
      join(RADACINA, baza.config),
      '--file',
      join(cale, fisier),
    ]
    // Toate comenzile locale trebuie sa scrie in ACEEASI stare pe care o citeste `wrangler dev`.
    // Fara asta, fiecare configuratie isi face propriul `.wrangler/state` langa ea si migratiile
    // ajung intr-o baza pe care aplicatia nu o vede niciodata.
    if (local) argumenteWrangler.push('--persist-to', join(RADACINA, '.wrangler/state'))
    if (mediu) argumenteWrangler.push('--env', mediu)

    process.stdout.write(`  ${fisier} … `)
    try {
      execFileSync('npx', ['--yes', ...argumenteWrangler], {
        cwd: RADACINA,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      console.log('ok')
      totalFisiere++
    } catch (e) {
      console.log('ESUAT')
      console.error(String(e.stderr ?? e.stdout ?? e.message).slice(0, 2000))
      process.exit(1)
    }
  }
}

console.log(`\nGata: ${totalFisiere} fisiere de migratie aplicate (${local ? 'local' : 'remote'}).`)
