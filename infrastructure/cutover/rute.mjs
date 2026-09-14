#!/usr/bin/env node
/**
 * Muta hostname-urile parohiei de la workerii V1 la cei `xc-*-production`, UNUL CATE UNUL.
 *
 *   node infrastructure/cutover/rute.mjs                    # cine ce tine acum
 *   node infrastructure/cutover/rute.mjs --muta admin       # muta un hostname pe V2
 *   node infrastructure/cutover/rute.mjs --inapoi admin     # il da inapoi la V1
 *
 * ⚠️ Un hostname tine de UN SINGUR worker: `PUT /workers/domains` il ia de la cine il are si il da
 * celuilalt. De aceea drumul inapoi e tot un PUT, si tine cateva minute — nu se pierde nimic.
 *
 * ⚠️ Workerii au `workers_dev: false`, deci NU exista usa de proba inainte de mutare: prima data
 * cand V2 se vede pe viu e chiar clipa mutarii. De aceea se face unul cate unul si se incearca
 * imediat dupa — `--muta` cere singur pagina si spune ce a primit.
 */
const argumente = process.argv.slice(2)
const opt = (n) => { const i = argumente.indexOf(`--${n}`); return i >= 0 ? argumente[i + 1] : null }

const CONT = process.env.CLOUDFLARE_ACCOUNT_ID
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
if (!CONT || !TOKEN) {
  console.error('lipseste CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN')
  console.error('inainte de rulare: set -a; . /backup/_setup/cloudflare.env; set +a')
  process.exit(1)
}
const antet = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const API = 'https://api.cloudflare.com/client/v4'

/**
 * Ce se muta si unde. Numele scurt e cheia din linia de comanda.
 * Ce NU e aici nu se muta, dinadins:
 *   comunicari — A7 nu se porteaza (Dispeceratul e anexa in `admin`), se stinge la curatenie;
 *   predici, rugaciuni — se sterg si se refac mai tarziu (hotarare din 14.09.2026);
 *   audio — adrese vechi (`biserica-adrese-vechi`), redirecturi;
 *   transmisiuni — ramane al V1 pana la cutover-ul emisiei, care e pas separat (NOTES 0b).
 */
const MUTARI = [
  { nume: 'admin', gazda: 'admin.sfantul-ilie.ro', v1: 'biserica-admin', v2: 'xc-admin-production' },
  { nume: 'biblia', gazda: 'biblia.sfantul-ilie.ro', v1: 'biserica-biblia', v2: 'xc-biblia-production' },
  { nume: 'biblioteca', gazda: 'biblioteca.sfantul-ilie.ro', v1: 'biserica-biblioteca', v2: 'xc-biblioteca-production' },
  { nume: 'buletin', gazda: 'buletin.sfantul-ilie.ro', v1: 'biserica-buletin', v2: 'xc-buletin-production' },
  { nume: 'calendar', gazda: 'calendar.sfantul-ilie.ro', v1: 'biserica-calendar', v2: 'xc-calendar-production' },
  { nume: 'cont', gazda: 'cont.sfantul-ilie.ro', v1: 'biserica-cont', v2: 'xc-account-production' },
  { nume: 'curatenie', gazda: 'curatenie.sfantul-ilie.ro', v1: 'biserica-curatenie', v2: 'xc-curatenie-production' },
  { nume: 'newsletter', gazda: 'newsletter.sfantul-ilie.ro', v1: 'biserica-newsletter', v2: 'xc-newsletter-production' },
  { nume: 'program', gazda: 'program.sfantul-ilie.ro', v1: 'biserica-program', v2: 'xc-program-production' },
  { nume: 'tipic', gazda: 'tipic.sfantul-ilie.ro', v1: 'biserica-tipic', v2: 'xc-tipic-production' },
  { nume: 'website', gazda: 'website.sfantul-ilie.ro', v1: 'biserica-website', v2: 'xc-home-production' },
  // Emisia: gazde NOI, nu luate de la V1 (in V1 emisia statea pe `transmisiuni.sfantul-ilie.ro`).
  // Custom Domain-ul le face si DNS-ul. `--inapoi` n-are unde sa le duca: le dezleaga.
  { nume: 'live', gazda: 'live.sfantul-ilie.ro', v1: null, v2: 'xc-live-production' },
  { nume: 'radio', gazda: 'radio.sfantul-ilie.ro', v1: null, v2: 'xc-radio-production' },
]

async function cere(cale, optiuni = {}) {
  const r = await fetch(`${API}${cale}`, { headers: antet, ...optiuni })
  const j = await r.json().catch(() => ({}))
  if (!j.success) throw new Error(`${cale}: HTTP ${r.status} ${JSON.stringify(j.errors ?? j).slice(0, 300)}`)
  return j.result
}

const domenii = async () => await cere(`/accounts/${CONT}/workers/domains`)

/** Zona se ia o data: toate gazdele stau in `sfantul-ilie.ro`. */
let zona = null
async function zonaId() {
  if (!zona) zona = (await cere('/zones?name=sfantul-ilie.ro'))[0].id
  return zona
}

/** Cere pagina si spune ce a raspuns — proba de dupa mutare. */
async function incearca(gazda) {
  try {
    const r = await fetch(`https://${gazda}/`, { redirect: 'manual' })
    const unde = r.headers.get('location')
    return `HTTP ${r.status}${unde ? ` → ${unde}` : ''}`
  } catch (e) {
    return `NU RASPUNDE (${String(e.message || e).slice(0, 80)})`
  }
}

/**
 * ⚠️ `override_existing_origin` e OBLIGATORIU: fara el Cloudflare raspunde 409 („already in use by
 * other custom domain") si nu face nimic. Aici tocmai asta vrem — hostname-ul se ia de la workerul
 * V1 si se da celui de productie.
 */
async function leaga(gazda, serviciu) {
  await cere(`/accounts/${CONT}/workers/domains`, {
    method: 'PUT',
    body: JSON.stringify({
      zone_id: await zonaId(), hostname: gazda, service: serviciu,
      environment: 'production', override_existing_origin: true,
    }),
  })
}

const numeCerut = opt('muta') ?? opt('inapoi')
const inapoi = argumente.includes('--inapoi')

if (!numeCerut) {
  const acum = new Map((await domenii()).map((d) => [d.hostname, d.service]))
  console.log('Hostname                             tine de                    starea')
  for (const m of MUTARI) {
    const cine = acum.get(m.gazda) ?? '(nelegat)'
    const unde = cine === m.v2 ? '✓ pe V2'
      : m.v1 && cine === m.v1 ? 'pe V1'
      : !m.v1 && !acum.has(m.gazda) ? 'inca nelegata (gazda noua)'
      : `⚠️ ${cine}`
    console.log(`  ${m.gazda.padEnd(34)} ${cine.padEnd(26)} ${unde}`)
  }
  console.log('\nCu --muta <nume> se muta unul. Nume: ' + MUTARI.map((m) => m.nume).join(', '))
  process.exit(0)
}

const m = MUTARI.find((x) => x.nume === numeCerut)
if (!m) {
  console.error(`nu stiu de „${numeCerut}". Nume: ${MUTARI.map((x) => x.nume).join(', ')}`)
  process.exit(1)
}

const tinta = inapoi ? m.v1 : m.v2
const legat = (await domenii()).find((d) => d.hostname === m.gazda)
const acum = legat?.service ?? '(nelegat)'

console.log(`${m.gazda}`)
console.log(`  acum:     ${acum}`)
console.log(`  inainte:  ${await incearca(m.gazda)}`)
if (acum === tinta) { console.log(`  ✓ tine deja de ${tinta} — nu ating nimic`); process.exit(0) }

if (inapoi && !tinta) {
  // Gazda noua n-are V1 la care sa se intoarca: se dezleaga, si ramane fara nimic in spate.
  if (!legat) { console.log('  nu e legata de nimic — nu ating nimic'); process.exit(0) }
  console.log('  dezleg (n-are V1)')
  await cere(`/accounts/${CONT}/workers/domains/${legat.id}`, { method: 'DELETE' })
  console.log(`  dupa:     ${await incearca(m.gazda)}`)
  process.exit(0)
}

console.log(`  ${legat ? 'mut' : 'leg'} →     ${tinta}`)
await leaga(m.gazda, tinta)

// Cateva secunde pana prinde peste tot; se incearca de mai multe ori, ca sa nu para cazut degeaba.
for (const pauza of [3000, 5000, 8000]) {
  await new Promise((s) => setTimeout(s, pauza))
  const raspuns = await incearca(m.gazda)
  console.log(`  dupa:     ${raspuns}`)
  if (/HTTP (2|3)\d\d/.test(raspuns)) break
}

const dupa = (await domenii()).find((d) => d.hostname === m.gazda)?.service ?? '(nelegat)'
console.log(`  tine de:  ${dupa}${dupa === tinta ? ' ✓' : ' ⚠️ NU S-A PRINS'}`)
if (dupa !== tinta) process.exit(1)
console.log(`\n  drumul inapoi: node infrastructure/cutover/rute.mjs --inapoi ${m.nume}`)
