#!/usr/bin/env node
/**
 * Publica doi workeri care se leaga unul de altul (Cloudflare raspunde 10143: niciunul nu poate
 * fi primul). Ocolul: unul se publica fara legatura catre celalalt, apoi celalalt, apoi primul
 * se republica intreg.
 *
 *   node infrastructure/cutover/publica-cu-ocol.mjs --env production \
 *        --intai services/chat-worker --fara PROGRAM --apoi apps/program
 *
 * Configuratia ciuntita se scrie langa cea adevarata (`wrangler.ocol.jsonc`, sters la sfarsit),
 * fiindca `main` si `migrations_dir` sunt relative la locul fisierului.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const MEDIU = arg('env') ?? 'production'
const INTAI = arg('intai')
const FARA = arg('fara')
const APOI = arg('apoi')
if (!INTAI || !FARA || !APOI) {
  console.error('folosire: --intai <dir> --fara <BINDING> --apoi <dir> [--env production]')
  process.exit(1)
}

const publica = (config, eticheta) => {
  process.stdout.write(`${eticheta.padEnd(46)} `)
  try {
    execFileSync('npx', ['wrangler', 'deploy', '--env', MEDIU, '-c', config], { stdio: ['ignore', 'pipe', 'pipe'] })
    console.log('publicat')
  } catch (e) {
    console.log('ESUAT')
    console.error(String(e.stderr ?? e.stdout ?? e.message).replace(/\[[0-9;]*m/g, '').slice(-900))
    process.exit(1)
  }
}

const caleIntai = `${INTAI}/wrangler.jsonc`
const text = readFileSync(caleIntai, 'utf8')
// Scoate randul legaturii, cu virgula lui, oriunde ar fi (dev, staging, production).
const ciuntit = text.replace(new RegExp(`\\n\\s*\\{[^}]*"binding"\\s*:\\s*"${FARA}"[^}]*\\},?`, 'g'), '')
if (ciuntit === text) {
  console.error(`nu am gasit legatura ${FARA} in ${caleIntai}`)
  process.exit(1)
}
const caleOcol = `${INTAI}/wrangler.ocol.jsonc`
writeFileSync(caleOcol, ciuntit.replace(/,(\s*\])/g, '$1'))

try {
  publica(caleOcol, `${INTAI} (fara ${FARA})`)
  publica(`${APOI}/wrangler.jsonc`, APOI)
  publica(caleIntai, `${INTAI} (intreg)`)
} finally {
  rmSync(caleOcol, { force: true })
}
