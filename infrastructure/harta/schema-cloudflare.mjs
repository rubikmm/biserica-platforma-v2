/**
 * Desenează schema contului Cloudflare — cine pe cine cheamă și ce ține fiecare.
 *
 * Adevărul se ia de la workerii PUBLICAȚI, prin API, nu din `wrangler.jsonc`. Pe 15.09.2026
 * fișierele mințeau în două locuri deodată (o coadă rămasă pe staging, un binding KV despre care
 * credeam că e la doi workeri și era la trei) — iar contul viu a spus de fiecare dată adevărul.
 *
 *   set -a; . /backup/_setup/cloudflare.env; set +a
 *   node infrastructure/harta/schema-cloudflare.mjs > schema.html
 *
 * Culorile vin din paleta validată a casei (skill-ul dataviz): albastru = aplicație cu adresă,
 * aqua = serviciu fără ușă în stradă, portocaliu = coada. Identitatea unui nod nu stă NICIODATĂ
 * doar în culoare — fiecare cutie își poartă numele, iar sub schemă e tabelul întreg.
 */

const CONT = process.env.CLOUDFLARE_ACCOUNT_ID
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
if (!CONT || !TOKEN) {
  console.error('lipseste tokenul: set -a; . /backup/_setup/cloudflare.env; set +a')
  process.exit(1)
}

const api = async (cale) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CONT}${cale}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  })
  const d = await r.json()
  if (!d.success) throw new Error(`${cale}: ${JSON.stringify(d.errors).slice(0, 160)}`)
  return d.result
}

const scurt = (s) => s.replace(/^xc-/, '').replace(/-production$/, '')

// ---------------------------------------------------------------- ce avem
const [scripturi, domenii, cozi] = await Promise.all([
  api('/workers/scripts'),
  api('/workers/domains?per_page=200'),
  api('/queues?per_page=100').catch(() => []),
])

const adrese = {}
for (const d of domenii) (adrese[d.service] ??= []).push(d.hostname.replace('.sfantul-ilie.ro', ''))

const N = {}
for (const s of scripturi) {
  const [set, ceas] = await Promise.all([
    api(`/workers/scripts/${s.id}/settings`),
    api(`/workers/scripts/${s.id}/schedules`).catch(() => ({ schedules: [] })),
  ])
  const b = set?.bindings ?? []
  N[scurt(s.id)] = {
    adrese: adrese[s.id] ?? [],
    cheama: b.filter((x) => x.type === 'service').map((x) => scurt(x.service)).sort(),
    d1: b.some((x) => x.type === 'd1'),
    r2: b.filter((x) => x.type === 'r2_bucket').map((x) => x.bucket_name),
    kv: b.some((x) => x.type === 'kv_namespace'),
    coada: b.filter((x) => x.type === 'queue').map((x) => x.queue_name),
    ai: b.some((x) => x.type === 'ai'),
    browser: b.some((x) => x.type === 'browser'),
    email: b.some((x) => x.type === 'send_email'),
    cron: (ceas?.schedules ?? []).map((x) => x.cron),
  }
}

/** De câți e chemat fiecare — de aici iese „temelia". */
const chemat = {}
for (const [, d] of Object.entries(N)) for (const c of d.cheama) chemat[c] = (chemat[c] ?? 0) + 1

/**
 * Temelia = serviciile fără ușă în stradă pe care se sprijină aproape toată platforma.
 * Pragul e patru: sub el, o legătură spune ceva despre aplicație si merita desenata; peste el,
 * linia n-ar mai spune nimic — ar trece prin tot desenul. De aceea temelia se arata ca BANDA,
 * iar cine ce cheama din ea scrie in pastilele din cutie.
 */
const TEMELIA = Object.keys(N)
  .filter((n) => N[n].adrese.length === 0 && (chemat[n] ?? 0) >= 4)
  .sort((a, b) => (chemat[b] ?? 0) - (chemat[a] ?? 0))

const publice = Object.keys(N).filter((n) => N[n].adrese.length > 0)
const interne = Object.keys(N).filter((n) => N[n].adrese.length === 0 && !TEMELIA.includes(n))

/**
 * Asezarea pe randuri e ALEASA, nu calculata: vecinii de pe acelasi rand sunt cei care se cheama
 * intre ei, ca sagetile sa fie scurte si sa nu se incruciseze. Daca apare o aplicatie noua, pune-o
 * langa cele cu care vorbeste, altfel desenul se incalceste.
 */
const RAND_1 = ['home', 'account', 'admin', 'buletin', 'newsletter', 'biblioteca', 'curatenie']
const RAND_2 = ['biblia', 'calendar', 'tipic', 'program', 'live', 'radio']
const RAND_3 = ['media', 'chat', 'events', 'automation']

const asezate = new Set([...RAND_1, ...RAND_2, ...RAND_3, ...TEMELIA])
const uitate = Object.keys(N).filter((n) => !asezate.has(n))
if (uitate.length) console.error(`⚠️ noduri neasezate (adauga-le pe un rand): ${uitate.join(', ')}`)

// ---------------------------------------------------------------- geometrie
const L = 150 // latimea unei cutii
const H = 58
const GX = 18
const CANVAS_W = 1240
const randY = { 1: 96, 2: 232, 3: 368, temelie: 500 }

const pozitii = {}
const asazaRand = (nume, y, latime = L) => {
  const total = nume.length * latime + (nume.length - 1) * GX
  let x = Math.round((CANVAS_W - total) / 2)
  for (const n of nume) {
    pozitii[n] = { x, y, w: latime, h: H }
    x += latime + GX
  }
}
asazaRand(RAND_1, randY[1])
asazaRand(RAND_2, randY[2])
asazaRand([...RAND_3, 'COADA'], randY[3])
asazaRand(TEMELIA, randY.temelie, 240) // mai late: aici scrie și de câți e chemat fiecare

const centru = (n) => ({ x: pozitii[n].x + pozitii[n].w / 2, y: pozitii[n].y + pozitii[n].h / 2 })
const sus = (n) => ({ x: centru(n).x, y: pozitii[n].y })
const jos = (n) => ({ x: centru(n).x, y: pozitii[n].y + H })
const stanga = (n) => ({ x: pozitii[n].x, y: centru(n).y })
const dreapta = (n) => ({ x: pozitii[n].x + pozitii[n].w, y: centru(n).y })

const randul = (n) => (RAND_1.includes(n) ? 1 : RAND_2.includes(n) ? 2 : RAND_3.includes(n) ? 3 : 4)

/** Drumul dintre doua cutii: drept intre vecini, arc altfel — niciodata peste o a treia cutie. */
function drum(de, la) {
  const [ra, rb] = [randul(de), randul(la)]
  if (ra === rb) {
    const [a, b] = pozitii[de].x < pozitii[la].x ? [dreapta(de), stanga(la)] : [stanga(de), dreapta(la)]
    const dist = Math.abs(b.x - a.x)
    if (dist <= GX + 6) return { d: `M${a.x},${a.y} L${b.x},${b.y}`, varf: b }
    // Sar peste cutiile dintre ele, pe deasupra.
    const inalt = a.y - 30 - dist / 14
    return { d: `M${a.x},${a.y} C${a.x + (b.x - a.x) / 4},${inalt} ${a.x + ((b.x - a.x) * 3) / 4},${inalt} ${b.x},${b.y}`, varf: b }
  }
  const a = ra < rb ? jos(de) : sus(de)
  const b = ra < rb ? sus(la) : jos(la)
  const mij = (a.y + b.y) / 2
  return { d: `M${a.x},${a.y} C${a.x},${mij} ${b.x},${mij} ${b.x},${b.y}`, varf: b }
}

// ---------------------------------------------------------------- legaturile de desenat
const legaturi = []
for (const [de, d] of Object.entries(N)) {
  for (const la of d.cheama) {
    if (TEMELIA.includes(la)) continue // temelia e banda, nu linie
    if (!pozitii[de] || !pozitii[la]) continue
    legaturi.push({ de, la, fel: 'cheama' })
  }
}
// Coada, singura legatura care nu e o chemare: doi scriu in ea, unul o consuma.
const coada = cozi.find((q) => (q.consumers ?? []).length > 0)
if (coada) {
  for (const p of coada.producers ?? []) if (pozitii[scurt(p.script)]) legaturi.push({ de: scurt(p.script), la: 'COADA', fel: 'coada' })
  for (const c of coada.consumers ?? []) if (pozitii[scurt(c.script)]) legaturi.push({ de: 'COADA', la: scurt(c.script), fel: 'coada' })
}

// ---------------------------------------------------------------- desenul
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * ⚠️ Poarta desenului: SVG-ul NU taie textul și nu-l trece pe rândul următor — ce nu încape curge
 * peste cutia vecină, fără nicio eroare nicăieri. Cum unealta se rulează din nou după fiecare
 * schimbare, iar numele aplicațiilor viitoare nu le știm, măsurarea trebuie să fie în ea.
 * Lățimile sunt aproximări ale fonturilor din `<style>` (mono ~0.6em, sans-bold ~0.56em); marja e
 * lăsată dinadins strâmtă, ca să se plângă înainte să se vadă.
 */
const LATIME_CARACTER = { nume: 7.9, sub: 6.6, pastile: 6.3 }
const platite = []
function masoara(text, clasa, latimeCutie, cine) {
  const incape = (latimeCutie - 20) / LATIME_CARACTER[clasa]
  if (String(text).length > incape) platite.push(`${cine} (${clasa}): „${text}" — ${String(text).length} semne, încap ${Math.floor(incape)}`)
  return text
}
const INITIALA = { identity: 'i', authz: 'd', audit: 'j', communication: 's' }
const NUME_TEMELIE = {
  identity: 'identitate', authz: 'drepturi', audit: 'jurnal', communication: 'scrisori',
}
const ROMANESTE = {
  account: 'cont', home: 'website', curatenie: 'curățenie', biblia: 'biblia',
  biblioteca: 'bibliotecă', events: 'evenimente', automation: 'automatizare', chat: 'chat',
  media: 'media', live: 'live', radio: 'radio', program: 'program', calendar: 'calendar',
  tipic: 'tipic', buletin: 'buletin', newsletter: 'newsletter', admin: 'administrare',
}

const CANVAS_H = randY.temelie + 150

/**
 * Ceasul, pe înțelesul omului. ⚠️ Nu e doar frumusețe: cronul scris întreg (cel din cinci în cinci
 * minute) umfla pastila peste marginea cutiei, iar SVG-ul nu taie și nu trece pe rândul următor —
 * textul curge peste vecin, tăcut. Ce intră într-o cutie de lățime fixă se scurtează ÎNAINTE.
 *
 * ⚠️ Și încă una, plătită pe loc: un cron scris ca atare într-un comentariu de BLOC îl închide,
 * fiindcă începe cu stea-slash. În comentarii, cronurile se scriu în cuvinte.
 */
const CEAS_OMENESTE = {
  '0 3 * * *': '3:00',
  '0 6 * * *': '6:00',
  '0 * * * *': 'orar',
  '*/5 * * * *': '5min',
}
const ceas = (c) => '⏱' + (CEAS_OMENESTE[c] ?? c)

/** Adresele, strânse: una întreagă și câte mai sunt — altfel `home` cu trei nume iese din cutie. */
function adreseScurt(a) {
  if (a.length === 0) return 'fără adresă'
  if (a.length === 1) return a[0]
  return `${a[0]} +${a.length - 1}`
}

function pastileleLui(d) {
  const p = []
  if (d.d1) p.push('D1')
  for (const g of d.r2) p.push(g.startsWith('xc-') ? 'R2' : 'R2 ' + g.replace(/^biserica-/, ''))
  if (d.kv) p.push('KV')
  if (d.ai) p.push('AI')
  if (d.browser) p.push('poză')
  if (d.email) p.push('e-mail')
  if (d.cron.length) p.push(ceas(d.cron[0]))
  return p
}

function cutie(n) {
  const p = pozitii[n]
  const d = N[n]
  const fel = d.adrese.length ? 'publica' : 'interna'
  const temelie = d.cheama.filter((c) => TEMELIA.includes(c)).map((c) => INITIALA[c] ?? c[0]).join(' ')

  return `<g class="nod ${fel}">
    <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="7"/>
    <text class="nume" x="${p.x + 10}" y="${p.y + 21}">${esc(masoara(ROMANESTE[n] ?? n, 'nume', p.w, n))}</text>
    <text class="sub" x="${p.x + 10}" y="${p.y + 36}">${esc(masoara(adreseScurt(d.adrese), 'sub', p.w, n))}</text>
    <text class="pastile" x="${p.x + 10}" y="${p.y + 50}">${esc(masoara(pastileleLui(d).join(' '), 'pastile', p.w - (temelie ? 26 : 0), n))}</text>
    ${temelie ? `<text class="temelie-cheie" x="${p.x + p.w - 8}" y="${p.y + 50}">${esc(temelie)}</text>` : ''}
  </g>`
}

const svg = `<svg viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" class="schema" role="img"
     aria-label="Schema legăturilor dintre workerii Cloudflare ai parohiei">
  <defs>
    <marker id="varf" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,1 L9,5 L0,9 z" class="varf"/>
    </marker>
    <marker id="varf-coada" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,1 L9,5 L0,9 z" class="varf-coada"/>
    </marker>
  </defs>

  <text class="titlu-zona" x="24" y="${randY[1] - 22}">Aplicații cu ușă în stradă</text>
  <text class="titlu-zona" x="24" y="${randY[3] - 22}">Servicii fără adresă</text>

  ${legaturi.map((l) => {
    const { d } = drum(l.de, l.la)
    return `<path class="linie ${l.fel}" d="${d}" marker-end="url(#${l.fel === 'coada' ? 'varf-coada' : 'varf'})"/>`
  }).join('\n  ')}

  ${[...RAND_1, ...RAND_2, ...RAND_3].map(cutie).join('\n  ')}

  <g class="nod coada-nod">
    <rect x="${pozitii.COADA.x}" y="${pozitii.COADA.y}" width="${L}" height="${H}" rx="7"/>
    <text class="nume" x="${pozitii.COADA.x + 10}" y="${pozitii.COADA.y + 21}">coada</text>
    <text class="sub" x="${pozitii.COADA.x + 10}" y="${pozitii.COADA.y + 36}">xc-events</text>
    <text class="pastile" x="${pozitii.COADA.x + 10}" y="${pozitii.COADA.y + 50}">+ coadă de eșec</text>
  </g>

  <g class="banda">
    <rect x="24" y="${randY.temelie - 34}" width="${CANVAS_W - 48}" height="${H + 62}" rx="10"/>
    <text class="titlu-banda" x="40" y="${randY.temelie - 12}">Temelia — pe astea se sprijină toate</text>
    ${TEMELIA.map((n) => {
      const p = pozitii[n]
      const d = N[n]
      const res = [`chemat de ${chemat[n] ?? 0}`, ...pastileleLui(d)]
      return `<g class="nod temelie">
      <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${H}" rx="7"/>
      <text class="nume" x="${p.x + 10}" y="${p.y + 21}">${esc(masoara(NUME_TEMELIE[n] ?? n, 'nume', p.w - 20, n))} <tspan class="cheie">${INITIALA[n] ?? ''}</tspan></text>
      <text class="sub" x="${p.x + 10}" y="${p.y + 36}">${esc(masoara(n, 'sub', p.w, n))}</text>
      <text class="pastile" x="${p.x + 10}" y="${p.y + 50}">${esc(masoara(res.join(' '), 'pastile', p.w, n))}</text>
    </g>`
    }).join('\n    ')}
  </g>
</svg>`

// ---------------------------------------------------------------- tabelul (schema, în cuvinte)
const randuriTabel = Object.keys(N).sort().map((n) => {
  const d = N[n]
  const tine = [
    d.d1 ? 'D1' : null,
    ...d.r2.map((g) => `R2 ${g}`),
    d.kv ? 'KV' : null,
    d.ai ? 'AI' : null,
    d.browser ? 'Chrome' : null,
    d.email ? 'e-mail' : null,
    ...d.coada.map((q) => `scrie în ${q}`),
  ].filter(Boolean)
  return `<tr>
    <td><strong>${esc(n)}</strong></td>
    <td>${esc(d.adrese.join(', ') || '—')}</td>
    <td class="mic">${esc(d.cheama.join(', ') || '—')}</td>
    <td class="mic">${esc(tine.join(', ') || '—')}</td>
    <td class="mic">${esc(d.cron.join(', ') || '—')}</td>
  </tr>`
}).join('\n')

const azi = new Date().toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' })

console.log(`<!doctype html>
<html lang="ro">
<meta charset="utf-8">
<title>Schema Cloudflare — parohia Sfântul Ilie</title>
<style>
  :root {
    color-scheme: light;
    --surface:        #fcfcfb;
    --surface-2:      #f4f4f1;
    --text-primary:   #0b0b0b;
    --text-secondary: #52514e;
    --text-muted:     #76756f;
    --publica:        #2a78d6;
    --interna:        #1baf7a;
    --coada:          #eb6834;
    --linie:          #9a9a93;
    --chenar:         #dedcd5;
  }
  @media (prefers-color-scheme: dark) {
    :root:where(:not([data-theme="light"])) {
      color-scheme: dark;
      --surface:        #1a1a19;
      --surface-2:      #242422;
      --text-primary:   #ffffff;
      --text-secondary: #c3c2b7;
      --text-muted:     #94938a;
      --publica:        #3987e5;
      --interna:        #199e70;
      --coada:          #d95926;
      --linie:          #6e6e66;
      --chenar:         #3a3a36;
    }
  }
  body { font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
         background: var(--surface); color: var(--text-primary);
         max-width: 78rem; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.5rem; margin-bottom: .2rem; }
  h2 { font-size: 1.05rem; margin-top: 2.4rem; }
  .sub { color: var(--text-secondary); margin-top: 0; }
  .schema { width: 100%; height: auto; display: block; margin: 1.5rem 0 .5rem; }

  .nod rect { fill: var(--surface-2); stroke: var(--chenar); stroke-width: 1.5; }
  .nod.publica rect { stroke: var(--publica); stroke-width: 2; }
  .nod.interna rect { stroke: var(--interna); stroke-width: 2; }
  .nod.coada-nod rect { stroke: var(--coada); stroke-width: 2; }
  .nod.temelie rect { fill: var(--surface); stroke: var(--interna); stroke-width: 2; }
  .nod .nume { font: 600 14px system-ui, sans-serif; fill: var(--text-primary); }
  .nod .sub  { font: 11px ui-monospace, Menlo, Consolas, monospace; fill: var(--text-secondary); }
  .nod .pastile { font: 10.5px ui-monospace, Menlo, Consolas, monospace; fill: var(--text-muted); }
  .nod .cheie, .temelie-cheie { font: 700 12px ui-monospace, monospace; fill: var(--interna); }
  .temelie-cheie { text-anchor: end; letter-spacing: 1px; }

  .linie { fill: none; stroke: var(--linie); stroke-width: 2; opacity: .85; }
  .linie.coada { stroke: var(--coada); stroke-width: 2.5; }
  .varf { fill: var(--linie); }
  .varf-coada { fill: var(--coada); }

  .banda rect { fill: none; stroke: var(--chenar); stroke-width: 1.5; stroke-dasharray: 5 4; }
  .titlu-zona, .titlu-banda { font: 600 12px system-ui, sans-serif; fill: var(--text-muted);
                              text-transform: uppercase; letter-spacing: .08em; }

  .legenda { display: flex; flex-wrap: wrap; gap: 1.4rem; margin: .5rem 0 0;
             font-size: .88rem; color: var(--text-secondary); }
  .legenda span { display: flex; align-items: center; gap: .45rem; }
  .cheie-culoare { width: 15px; height: 15px; border-radius: 4px; border: 2px solid; background: var(--surface-2); }
  .nota { background: var(--surface-2); border-left: 3px solid var(--publica);
          padding: .7rem 1rem; margin: 1.4rem 0; font-size: .93rem; }
  table { border-collapse: collapse; width: 100%; margin-top: .6rem; }
  th, td { text-align: left; padding: .4rem .6rem; border-bottom: 1px solid var(--chenar);
           vertical-align: top; font-size: .9rem; }
  th { color: var(--text-secondary); font-weight: 600; }
  td.mic { font: 12px ui-monospace, Menlo, Consolas, monospace; color: var(--text-secondary); }
</style>

<h1>Cum sunt legate toate pe Cloudflare</h1>
<p class="sub">Parohia Sfântul Ilie — Hanul Colței · ${esc(azi)} · citit din contul viu, nu din fișiere</p>

${svg}

<div class="legenda">
  <span><i class="cheie-culoare" style="border-color: var(--publica)"></i> aplicație cu adresă</span>
  <span><i class="cheie-culoare" style="border-color: var(--interna)"></i> serviciu fără adresă</span>
  <span><i class="cheie-culoare" style="border-color: var(--coada)"></i> coada de evenimente</span>
  <span>săgeata arată <strong>cine cheamă pe cine</strong></span>
  <span><code>i</code> identitate · <code>d</code> drepturi · <code>j</code> jurnal · <code>s</code> scrisori</span>
</div>

<div class="nota">
  <strong>De ce temelia e o bandă și nu linii.</strong> Identitatea e chemată de ${chemat.identity ?? 0}
  din cele ${Object.keys(N).length} aplicații, drepturile de ${chemat.authz ?? 0}, jurnalul de
  ${chemat.audit ?? 0}, scrisorile de ${chemat.communication ?? 0}. Desenate ca săgeți, ar face
  peste ${(chemat.identity ?? 0) + (chemat.authz ?? 0) + (chemat.audit ?? 0) + (chemat.communication ?? 0)}
  de linii peste tot desenul și n-ai mai vedea nimic. Așa că ele stau jos, ca temelie, iar
  <strong>literele din colțul fiecărei cutii</strong> spun exact ce cheamă acea aplicație:
  <code>i</code> identitate, <code>d</code> drepturi, <code>j</code> jurnal, <code>s</code> scrisori.
  Săgețile desenate sunt doar cele care spun ceva despre aplicația aceea anume.
</div>

<h2>Aceeași schemă, în cuvinte — toate legăturile, fără excepție</h2>
<table>
  <tr><th>Worker</th><th>Adrese</th><th>Cheamă</th><th>Ține</th><th>Ceas</th></tr>
  ${randuriTabel}
</table>

<p class="sub" style="margin-top:1.6rem; font-size:.86rem">
  Desenată cu <code>infrastructure/harta/schema-cloudflare.mjs</code> — rulează unealta din nou după
  orice schimbare și schema se reface singură.
</p>
`)

if (platite.length) {
  console.error(`\n⚠️ TEXT CARE NU ÎNCAPE ÎN CUTIE (curge peste vecin, SVG-ul nu taie):`)
  for (const p of platite) console.error(`   ${p}`)
  console.error(`   Scurtează textul sau lărgește cutia (L = ${L}).`)
} else {
  console.error('desenul e întreg: tot textul încape în cutii')
}
