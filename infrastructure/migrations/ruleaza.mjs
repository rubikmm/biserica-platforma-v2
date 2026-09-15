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
  { director: 'calendar', config: 'apps/calendar/wrangler.jsonc', binding: 'DB' },
  { director: 'program', config: 'apps/program/wrangler.jsonc', binding: 'DB' },
  { director: 'curatenie', config: 'apps/curatenie/wrangler.jsonc', binding: 'DB' },
  { director: 'tipic', config: 'apps/tipic/wrangler.jsonc', binding: 'DB' },
  { director: 'biblioteca', config: 'apps/biblioteca/wrangler.jsonc', binding: 'DB' },
  { director: 'buletin', config: 'apps/buletin/wrangler.jsonc', binding: 'DB' },
  { director: 'communication', config: 'services/communication-worker/wrangler.jsonc', binding: 'DB' },
  { director: 'automation', config: 'services/automation-worker/wrangler.jsonc', binding: 'DB' },
  { director: 'chat', config: 'services/chat-worker/wrangler.jsonc', binding: 'DB' },
  // ⚠️ Website-ul are baza abia din 16.09.2026, odata cu „Texte citite la chinonic". Pana atunci
  // `home` n-avea niciun depozit.
  { director: 'home', config: 'apps/home/wrangler.jsonc', binding: 'DB' },
]

const argumente = process.argv.slice(2)
const local = argumente.includes('--local')
const remote = argumente.includes('--remote')
const indexEnv = argumente.indexOf('--env')
const mediu = indexEnv >= 0 ? argumente[indexEnv + 1] : null
/**
 * `--doar identity,calendar` — migreaza numai bazele numite. Pe remote conteaza: o migratie care
 * schimba forma unei baze citite de un worker DEJA publicat il strica pana la publicarea celui nou.
 */
const indexDoar = argumente.indexOf('--doar')
const doar = indexDoar >= 0 ? (argumente[indexDoar + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean) : null

if (local === remote) {
  console.error('Alege exact una: --local sau --remote')
  process.exit(1)
}

// Productia s-a deschis pe 14.09.2026, la cererea utilizatorului („pornește înlocuirea v1 cu v2").
// Bariera n-a cazut, s-a mutat: pe productie se cere `--chiar-productia`, scris anume de fiecare data.
if (remote && mediu !== 'staging' && mediu !== 'production') {
  console.error('Refuz: `--remote` merge cu `--env staging` sau `--env production`.')
  process.exit(1)
}

if (remote && mediu === 'production' && !argumente.includes('--chiar-productia')) {
  console.error(
    'Refuz: migratiile pe PRODUCTIE cer `--chiar-productia` pe linia de comanda.\n' +
      'Acolo stau datele parohiei; nu se atinge din obisnuinta.',
  )
  process.exit(1)
}

function numeBazaDin(director) {
  return `xc-${director}-${mediu ?? 'staging'}`
}

/**
 * Pe ce bază se scrie.
 *
 * ⚠️ LOCAL SE CHEAMĂ PRIN BINDING (`DB`), nu prin NUMELE bazei. Numele e al mediului, iar `--local`
 * n-are mediu: până acum cădea pe `xc-<x>-staging`, ceea ce a mers cât timp blocul fără `env` al
 * configurațiilor purta numele de staging. De când acela e `xc-<x>-production` (scris de
 * `infrastructure/cutover/scrie-productie.mjs`, 14.09.2026), `pnpm migreaza` cădea la primul fișier
 * cu „Couldn't find a D1 DB with the name or binding 'xc-identity-staging'" — deci baza locală
 * rămânea GOALĂ, iar `pnpm dev` răspundea 500 („no such table") la orice pagină cu date.
 * Găsit pe 15.09.2026, când localul a rămas singurul loc de probă.
 *
 * Binding-ul nu se schimbă de la un mediu la altul, deci local merge oricând. Pe remote rămâne
 * NUMELE: acolo alegerea bazei e tocmai lucrul care trebuie scris pe față.
 */
function tintaDin(baza) {
  return local ? baza.binding : numeBazaDin(baza.director)
}

let totalFisiere = 0

for (const baza of BAZE) {
  if (doar && !doar.includes(baza.director)) continue
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
      tintaDin(baza),
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
