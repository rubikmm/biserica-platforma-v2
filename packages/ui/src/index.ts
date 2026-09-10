/**
 * Carcasa comuna a interfetelor. Un singur loc pentru antet, stil si mesaje —
 * exact ce lipsea in V1, unde fiecare aplicatie avea copia ei.
 *
 * Fiecare aplicatie isi aduce stilul propriu prin `stil` si scriptul prin `script`; antetul,
 * paleta si formele de baza raman aici, o singura data.
 */

export function esc(text: unknown): string {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const STIL = `
:root {
  --fundal: #f6f5f3; --carte: #fff; --text: #23201c; --sters: #6b645c;
  --accent: #7a5c3e; --accent-text: #fff; --margine: #e3ded7; --margine-tare: #cfc7bd;
  --eroare-fundal: #fdeceb; --eroare-text: #8c261d;
  --bine-fundal: #eaf5ec; --bine-text: #1f6b33;
  --atentie-fundal: #fff4e0; --atentie-text: #8a5a00;
  --rosu: #b3261e; --albastru: #1c58bb; --auriu: #a67c2e;
}
@media (prefers-color-scheme: dark) {
  :root {
    --fundal: #171512; --carte: #211e1a; --text: #ece7df; --sters: #a39a8e;
    --accent: #c9a577; --accent-text: #1b1612; --margine: #37322c; --margine-tare: #4a433b;
    --eroare-fundal: #3a1e1c; --eroare-text: #f3b4ad;
    --bine-fundal: #1d3122; --bine-text: #a8dcb2;
    --atentie-fundal: #3a2d12; --atentie-text: #f1cf86;
    --rosu: #f0665c; --albastru: #7ea6ee; --auriu: #d8b36a;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; background: var(--fundal); color: var(--text);
  font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
a { color: var(--accent); }
.antet {
  background: var(--carte); border-bottom: 1px solid var(--margine);
  padding: 0 1rem; position: sticky; top: 0; z-index: 20;
}
.antet-interior {
  max-width: 62rem; margin: 0 auto; display: flex; align-items: center;
  gap: 1.1rem; min-height: 3.5rem; flex-wrap: wrap;
}
.larg .antet-interior, .larg main { max-width: 78rem; }
.marca { font-weight: 650; letter-spacing: -0.01em; margin-right: auto; color: var(--text); text-decoration: none; }
.antet a { color: var(--sters); text-decoration: none; font-size: .94rem; }
.antet a:hover, .antet a[aria-current="page"] { color: var(--text); }
.antet a[aria-current="page"] { font-weight: 600; border-bottom: 2px solid var(--accent); padding-bottom: .1rem; }
main { max-width: 62rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.carte {
  background: var(--carte); border: 1px solid var(--margine);
  border-radius: 12px; padding: 1.5rem; margin-bottom: 1.25rem;
}
.ingust { max-width: 27rem; margin: 3rem auto; }
h1 { font-size: 1.5rem; margin: 0 0 .35rem; letter-spacing: -0.02em; }
h2 { font-size: 1.15rem; margin: 0 0 .75rem; }
h3 { font-size: 1rem; margin: 1.2rem 0 .4rem; }
p.ajutor { color: var(--sters); margin: 0 0 1.35rem; font-size: .94rem; }
label { display: block; font-size: .88rem; font-weight: 550; margin: .9rem 0 .3rem; }
input[type=text], input[type=email], input[type=password], input[type=datetime-local],
input[type=date], input[type=time], input[type=number], input[type=tel], select, textarea {
  width: 100%; padding: .6rem .7rem; border: 1px solid var(--margine);
  border-radius: 8px; font: inherit; background: var(--carte); color: inherit;
}
input:focus, textarea:focus, select:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
button, .buton {
  margin-top: 1.15rem; width: 100%; padding: .65rem 1rem; border: 0; border-radius: 8px;
  background: var(--accent); color: var(--accent-text); font: inherit; font-weight: 550;
  cursor: pointer; text-decoration: none; display: inline-block; text-align: center;
}
button:hover, .buton:hover { filter: brightness(1.08); }
button.secundar, .buton.secundar { background: transparent; color: var(--sters); border: 1px solid var(--margine); }
button.mic, .buton.mic { width: auto; margin: 0; padding: .35rem .7rem; font-size: .88rem; }
button.pericol { background: var(--rosu); color: #fff; }
button[disabled], .buton[aria-disabled="true"] { opacity: .45; cursor: default; filter: none; }
.alerta { padding: .7rem .85rem; border-radius: 8px; font-size: .93rem; margin-bottom: 1rem; }
.alerta.rea { background: var(--eroare-fundal); color: var(--eroare-text); }
.alerta.buna { background: var(--bine-fundal); color: var(--bine-text); }
.alerta.info { background: #eef2f7; color: #2c4460; }
.alerta.atentie { background: var(--atentie-fundal); color: var(--atentie-text); }
@media (prefers-color-scheme: dark) { .alerta.info { background: #1f2a38; color: #c5d5ea; } }
.alerta a { color: inherit; font-weight: 600; word-break: break-all; }
.sub { color: var(--sters); font-size: .88rem; margin-top: 1.1rem; text-align: center; }
.sub a { color: var(--accent); }
table { width: 100%; border-collapse: collapse; font-size: .94rem; }
th, td { text-align: left; padding: .55rem .5rem; border-bottom: 1px solid var(--margine); vertical-align: top; }
th { color: var(--sters); font-weight: 550; font-size: .82rem; text-transform: uppercase; letter-spacing: .04em; }
.eticheta {
  display: inline-block; padding: .12rem .5rem; border-radius: 999px;
  font-size: .78rem; background: #eee9e2; color: var(--sters); white-space: nowrap;
}
@media (prefers-color-scheme: dark) { .eticheta { background: #2e2923; } }
.eticheta.publicat, .eticheta.validat, .eticheta.buna { background: var(--bine-fundal); color: var(--bine-text); }
.eticheta.atentie, .eticheta.propus { background: var(--atentie-fundal); color: var(--atentie-text); }
.eticheta.rea { background: var(--eroare-fundal); color: var(--eroare-text); }
.gol { color: var(--sters); text-align: center; padding: 2rem 0; }
.randuri { display: flex; gap: .6rem; flex-wrap: wrap; align-items: center; }
.randuri button, .randuri form, .randuri .buton { margin: 0; width: auto; }
.randuri form button { margin-top: 0; }
.c-rosu { color: var(--rosu); }
.c-albastru { color: var(--albastru); }
.sters { color: var(--sters); }
.mic-text { font-size: .86rem; }
.nav-bara {
  display: flex; gap: .4rem; flex-wrap: wrap; align-items: center; justify-content: center;
  margin: 0 0 1.2rem;
}
.nav-bara a, .nav-bara span.acum {
  padding: .35rem .75rem; border: 1px solid var(--margine); border-radius: 999px;
  text-decoration: none; color: var(--text); font-size: .9rem; background: var(--carte);
}
.nav-bara a[aria-current="page"], .nav-bara span.acum { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
.nav-bara a.stins { opacity: .4; pointer-events: none; }
.tiparit { display: none; }
@media print {
  .antet, .nav-bara, .fara-tipar { display: none !important; }
  body { background: #fff; color: #000; }
  .carte { border: 0; padding: 0; }
  .tiparit { display: initial; }
}
`

/** Adresele celorlalte aplicatii. In dev sunt cai pe acelasi host; in staging, origini absolute. */
export interface Navigatie {
  cont: string
  calendar: string
  program: string
  curatenie: string
  admin: string
}

const NAVIGATIE_DEV: Navigatie = {
  cont: '',
  calendar: '/calendar',
  program: '/program',
  curatenie: '/curatenie',
  admin: '/admin',
}

export interface OptiuniPagina {
  titlu: string
  /** Emailul sau numele celui logat, daca e cineva — apare in antet, cu logout. */
  utilizator?: string | null
  /** Care intrare din antet e cea curenta. */
  activ?: keyof Navigatie
  navigatie?: Navigatie
  continut: string
  /** CSS propriu aplicatiei, pus dupa cel comun. */
  stil?: string
  /** JavaScript propriu aplicatiei, pus la sfarsitul paginii. */
  script?: string
  /** Continut suplimentar in <head> (meta, link-uri). */
  cap?: string
  /** Pagina ocupa latimea mare (calendare, tabele late). */
  larg?: boolean
  /** Paginile publice pot fi indexate; implicit nu. */
  indexabil?: boolean
  /** Ce se intampla la „Ieșire": implicit logout-ul contului. */
  linkIesire?: string
}

const ETICHETE: Array<[keyof Navigatie, string]> = [
  ['cont', 'Cont'],
  ['calendar', 'Calendar'],
  ['program', 'Program'],
  ['curatenie', 'Curățenie'],
  ['admin', 'Administrare'],
]

export function pagina(o: OptiuniPagina): string {
  const nav = o.navigatie ?? NAVIGATIE_DEV
  const legaturi = ETICHETE.map(([cheie, eticheta]) => {
    const curent = o.activ === cheie ? ' aria-current="page"' : ''
    return `<a href="${esc(nav[cheie])}/"${curent}>${esc(eticheta)}</a>`
  }).join('')

  const zonaUtilizator = o.utilizator
    ? `<span style="font-size:.88rem;color:var(--sters)">${esc(o.utilizator)}</span>
       <a href="${esc(o.linkIesire ?? `${nav.cont}/auth/logout`)}">Ieșire</a>`
    : `<a href="${esc(nav.cont)}/auth/login">Intră</a>`

  return `<!doctype html>
<html lang="ro"${o.larg ? ' class="larg"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="${o.indexabil ? 'index, follow' : 'noindex, nofollow'}">
<title>${esc(o.titlu)}</title>
<style>${STIL}${o.stil ?? ''}</style>
${o.cap ?? ''}
</head>
<body>
<header class="antet"><div class="antet-interior">
  <a class="marca" href="${esc(nav.cont)}/">Platforma parohiei</a>
  ${legaturi}
  ${zonaUtilizator}
</div></header>
<main>${o.continut}</main>
${o.script ? `<script>${o.script}</script>` : ''}
</body>
</html>`
}

export function html(corp: string, status = 200, antete: Record<string, string> = {}): Response {
  return new Response(corp, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'referrer-policy': 'same-origin',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      ...antete,
    },
  })
}

export function alerta(fel: 'rea' | 'buna' | 'info' | 'atentie', mesaj: string): string {
  return `<div class="alerta ${fel}">${mesaj}</div>`
}

// ---------------------------------------------------------------------------
// Raspunsurile de masina — forma din contractul platformei: `{ eroare: { cod, mesaj } }`
// ---------------------------------------------------------------------------

export const ANTETE_API: Record<string, string> = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': 'if-none-match, content-type',
  'x-content-type-options': 'nosniff',
}

export function json(date: unknown, status = 200, antete: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(date), { status, headers: { ...ANTETE_API, ...antete } })
}

export function eroareApi(status: number, cod: string, mesaj: string, extra: Record<string, unknown> = {}): Response {
  return json({ eroare: { cod, mesaj, ...extra } }, status)
}

/** ETag slab din continut; cu `If-None-Match` potrivit se raspunde 304 fara corp. */
export async function jsonCuEtag(req: Request, date: unknown, antete: Record<string, string> = {}): Promise<Response> {
  const corp = JSON.stringify(date)
  const amprenta = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(corp))
  const etag = `W/"${[...new Uint8Array(amprenta)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('')}"`
  const daca = req.headers.get('if-none-match')
  const antetele = { ...ANTETE_API, etag, ...antete }
  if (daca && daca.split(',').map((s) => s.trim()).includes(etag)) {
    return new Response(null, { status: 304, headers: antetele })
  }
  if (req.method === 'HEAD') return new Response(null, { status: 200, headers: antetele })
  return new Response(corp, { status: 200, headers: antetele })
}

// ---------------------------------------------------------------------------
// Date si ore, ora Bucurestiului, fara biblioteci
// ---------------------------------------------------------------------------

export const LUNI = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
]
export const LUNI_SCURT = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.']
export const ZILE_SAPTAMANA = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă']
export const ZILE_SAPTAMANA_COD = ['duminica', 'luni', 'marti', 'miercuri', 'joi', 'vineri', 'sambata'] as const

/** Data de azi la Bucuresti, ca 'YYYY-MM-DD'. */
export function aziBucuresti(acum: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(acum)
}

/** Ora de perete la Bucuresti, ca 'HH:MM'. */
export function oraBucuresti(acum: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(acum)
}

export function eDataValida(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Aritmetica pe zile, in UTC — datele calendaristice nu au fus. */
export function adaugaZile(data: string, zile: number): string {
  const d = new Date(`${data}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + zile)
  return d.toISOString().slice(0, 10)
}

export function ziuaSaptamanii(data: string): number {
  return new Date(`${data}T00:00:00Z`).getUTCDay()
}

export function zileIntre(deLa: string, panaLa: string): number {
  return Math.round((Date.parse(`${panaLa}T00:00:00Z`) - Date.parse(`${deLa}T00:00:00Z`)) / 86400000)
}

/** Lunea saptamanii care contine data. */
export function luneaSaptamanii(data: string): string {
  const zs = ziuaSaptamanii(data)
  return adaugaZile(data, zs === 0 ? -6 : 1 - zs)
}

/** „28 august 2026" */
export function dataLunga(data: string): string {
  const [a, l, z] = data.split('-').map(Number) as [number, number, number]
  return `${z} ${LUNI[l - 1] ?? ''} ${a}`
}

/** „duminică, 30 august 2026" */
export function dataCuZi(data: string): string {
  return `${ZILE_SAPTAMANA[ziuaSaptamanii(data)]}, ${dataLunga(data)}`
}

/** „7 – 13 septembrie 2026" sau „29 sept. – 5 oct. 2026" pentru intervale pe doua luni. */
export function intervalLizibil(deLa: string, panaLa: string): string {
  const [a1, l1, z1] = deLa.split('-').map(Number) as [number, number, number]
  const [a2, l2, z2] = panaLa.split('-').map(Number) as [number, number, number]
  if (a1 === a2 && l1 === l2) return `${z1} – ${z2} ${LUNI[l1 - 1] ?? ''} ${a1}`
  if (a1 === a2) return `${z1} ${LUNI_SCURT[l1 - 1] ?? ''} – ${z2} ${LUNI_SCURT[l2 - 1] ?? ''} ${a1}`
  return `${z1} ${LUNI_SCURT[l1 - 1] ?? ''} ${a1} – ${z2} ${LUNI_SCURT[l2 - 1] ?? ''} ${a2}`
}

/** Un moment ISO adus la ora Bucurestiului, lizibil: „10 septembrie 2026, 11:26". */
export function momentLizibil(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const zi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(d)
  return `${dataLunga(zi)}, ${oraBucuresti(d)}`
}

/** Text fara diacritice si fara majuscule, pentru cautari si comparatii. */
export function faraDiacritice(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replaceAll('ș', 's').replaceAll('ş', 's').replaceAll('ț', 't').replaceAll('ţ', 't')
    .replaceAll('Ș', 's').replaceAll('Ş', 's').replaceAll('Ț', 't').replaceAll('Ţ', 't')
    .toLowerCase()
}
