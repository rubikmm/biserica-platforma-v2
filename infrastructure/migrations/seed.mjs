#!/usr/bin/env node
/**
 * Date de pornire: audienta demo, sabloanele de comunicare si regula de automatizare.
 *
 * NU creeaza utilizatori si NU pune parole. Primul super-admin se face singur, la
 * inregistrare, daca adresa se potriveste cu `EMAIL_SUPERADMIN` (vezi
 * docs/runbooks/seed-super-admin.md).
 */
import { execFileSync } from 'node:child_process'
import { resolve, join } from 'node:path'

const RADACINA = resolve(import.meta.dirname, '../..')
const argumente = process.argv.slice(2)
const local = !argumente.includes('--remote')
const indexEnv = argumente.indexOf('--env')
const mediu = indexEnv >= 0 ? argumente[indexEnv + 1] : null

const ACUM = new Date().toISOString()

const SEED = [
  {
    baza: 'xc-communication-staging',
    config: 'services/communication-worker/wrangler.jsonc',
    sql: `
      INSERT OR IGNORE INTO audiences (id, nume, descriere, created_at)
      VALUES ('toti-enoriasii', 'Toți enoriașii', 'Audiență implicită pentru anunțuri generale', '${ACUM}');

      INSERT OR IGNORE INTO templates (id, version, channel, subject, body, created_at)
      VALUES (
        'eveniment-publicat', 1, 'email',
        'Un eveniment nou: {{titlu}}',
        'Bună,

În calendarul parohiei a fost publicat un eveniment nou: {{titlu}}, pe {{inceput}}.

Doamne ajută!',
        '${ACUM}'
      );

      INSERT OR IGNORE INTO templates (id, version, channel, subject, body, created_at)
      VALUES (
        'eveniment-publicat', 1, 'whatsapp', NULL,
        'Eveniment nou în calendarul parohiei: {{titlu}}, pe {{inceput}}.',
        '${ACUM}'
      );

      -- Un singur destinatar demo, ca fluxul sa fie vizibil cap-coada in panoul de administrare.
      -- Adresa e cea a super-adminului; adaptorul e sandbox, deci NU pleaca niciun mesaj.
      INSERT OR IGNORE INTO audience_members (audience_id, user_id, channel, adresa, created_at)
      VALUES ('toti-enoriasii', 'demo-superadmin', 'email', 'rubikmm@gmail.com', '${ACUM}');
    `,
  },
  {
    baza: 'xc-automation-staging',
    config: 'services/automation-worker/wrangler.jsonc',
    sql: `
      INSERT OR IGNORE INTO rules (id, nume, declansator, risc, proprietar, activa, created_at)
      VALUES (
        'notificare-eveniment-publicat',
        'Anunță audiența când un eveniment de calendar e publicat',
        'calendar.event.published.v1',
        'low', 'calendar', 1, '${ACUM}'
      );
    `,
  },
]

for (const intrare of SEED) {
  const argumenteWrangler = [
    'wrangler@4',
    'd1',
    'execute',
    intrare.baza,
    local ? '--local' : '--remote',
    '--yes',
    '--config',
    join(RADACINA, intrare.config),
    '--command',
    intrare.sql,
  ]
  // Aceeasi stare locala ca `wrangler dev` — vezi comentariul din ruleaza.mjs.
  if (local) argumenteWrangler.push('--persist-to', join(RADACINA, '.wrangler/state'))
  if (mediu) argumenteWrangler.push('--env', mediu)

  process.stdout.write(`seed ${intrare.baza} … `)
  try {
    execFileSync('npx', ['--yes', ...argumenteWrangler], {
      cwd: RADACINA,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    console.log('ok')
  } catch (e) {
    console.log('ESUAT')
    console.error(String(e.stderr ?? e.stdout ?? e.message).slice(0, 2000))
    process.exit(1)
  }
}

console.log('\nSeed aplicat.')
