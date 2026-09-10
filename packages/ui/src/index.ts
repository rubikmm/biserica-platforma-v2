/**
 * Carcasa comuna a interfetelor. Un singur loc pentru antet, stil si mesaje —
 * exact ce lipsea in V1, unde fiecare aplicatie avea copia ei.
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
  --accent: #7a5c3e; --accent-text: #fff; --margine: #e3ded7;
  --eroare-fundal: #fdeceb; --eroare-text: #8c261d;
  --bine-fundal: #eaf5ec; --bine-text: #1f6b33;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--fundal); color: var(--text);
  font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.antet {
  background: var(--carte); border-bottom: 1px solid var(--margine);
  padding: 0 1rem;
}
.antet-interior {
  max-width: 62rem; margin: 0 auto; display: flex; align-items: center;
  gap: 1.25rem; min-height: 3.5rem; flex-wrap: wrap;
}
.marca { font-weight: 650; letter-spacing: -0.01em; margin-right: auto; }
.antet a { color: var(--sters); text-decoration: none; font-size: .94rem; }
.antet a:hover, .antet a[aria-current="page"] { color: var(--text); }
main { max-width: 62rem; margin: 0 auto; padding: 1.75rem 1rem 4rem; }
.carte {
  background: var(--carte); border: 1px solid var(--margine);
  border-radius: 12px; padding: 1.5rem; margin-bottom: 1.25rem;
}
.ingust { max-width: 27rem; margin: 3rem auto; }
h1 { font-size: 1.5rem; margin: 0 0 .35rem; letter-spacing: -0.02em; }
h2 { font-size: 1.15rem; margin: 0 0 .75rem; }
p.ajutor { color: var(--sters); margin: 0 0 1.35rem; font-size: .94rem; }
label { display: block; font-size: .88rem; font-weight: 550; margin: .9rem 0 .3rem; }
input[type=text], input[type=email], input[type=password], input[type=datetime-local], textarea {
  width: 100%; padding: .6rem .7rem; border: 1px solid var(--margine);
  border-radius: 8px; font: inherit; background: #fff; color: inherit;
}
input:focus, textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
button {
  margin-top: 1.15rem; width: 100%; padding: .65rem 1rem; border: 0; border-radius: 8px;
  background: var(--accent); color: var(--accent-text); font: inherit; font-weight: 550;
  cursor: pointer;
}
button:hover { filter: brightness(1.08); }
button.secundar { background: transparent; color: var(--sters); border: 1px solid var(--margine); }
.alerta { padding: .7rem .85rem; border-radius: 8px; font-size: .93rem; margin-bottom: 1rem; }
.alerta.rea { background: var(--eroare-fundal); color: var(--eroare-text); }
.alerta.buna { background: var(--bine-fundal); color: var(--bine-text); }
.alerta.info { background: #eef2f7; color: #2c4460; }
.alerta a { color: inherit; font-weight: 600; word-break: break-all; }
.sub { color: var(--sters); font-size: .88rem; margin-top: 1.1rem; text-align: center; }
.sub a { color: var(--accent); }
table { width: 100%; border-collapse: collapse; font-size: .94rem; }
th, td { text-align: left; padding: .55rem .5rem; border-bottom: 1px solid var(--margine); }
th { color: var(--sters); font-weight: 550; font-size: .82rem; text-transform: uppercase; letter-spacing: .04em; }
.eticheta {
  display: inline-block; padding: .12rem .5rem; border-radius: 999px;
  font-size: .78rem; background: #eee9e2; color: var(--sters);
}
.eticheta.publicat { background: var(--bine-fundal); color: var(--bine-text); }
.gol { color: var(--sters); text-align: center; padding: 2rem 0; }
.randuri { display: flex; gap: .6rem; flex-wrap: wrap; }
.randuri button, .randuri form { margin: 0; width: auto; }
.randuri form button { margin-top: 0; }
`

/** Adresele celorlalte aplicatii. In dev sunt cai pe acelasi host; in staging, origini absolute. */
export interface Navigatie {
  cont: string
  calendar: string
  admin: string
}

const NAVIGATIE_DEV: Navigatie = { cont: '', calendar: '/calendar', admin: '/admin' }

export interface OptiuniPagina {
  titlu: string
  /** Emailul celui logat, daca e cineva — apare in antet, cu logout. */
  utilizator?: string | null
  /** Care intrare din antet e cea curenta: 'cont' | 'calendar' | 'admin'. */
  activ?: keyof Navigatie
  navigatie?: Navigatie
  continut: string
}

export function pagina(o: OptiuniPagina): string {
  const nav = o.navigatie ?? NAVIGATIE_DEV
  const intrari: Array<[keyof Navigatie, string, string]> = [
    ['cont', `${nav.cont}/`, 'Cont'],
    ['calendar', `${nav.calendar}/`, 'Calendar'],
    ['admin', `${nav.admin}/`, 'Administrare'],
  ]
  const legaturi = intrari
    .map(([cheie, href, eticheta]) => {
      const curent = o.activ === cheie ? ' aria-current="page"' : ''
      return `<a href="${esc(href)}"${curent}>${esc(eticheta)}</a>`
    })
    .join('')

  const zonaUtilizator = o.utilizator
    ? `<span style="font-size:.88rem;color:var(--sters)">${esc(o.utilizator)}</span>
       <a href="${esc(nav.cont)}/auth/logout">Ieșire</a>`
    : `<a href="${esc(nav.cont)}/auth/login">Intră</a>`

  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(o.titlu)}</title>
<style>${STIL}</style>
</head>
<body>
<header class="antet"><div class="antet-interior">
  <span class="marca">Platforma parohiei</span>
  ${legaturi}
  ${zonaUtilizator}
</div></header>
<main>${o.continut}</main>
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

export function alerta(fel: 'rea' | 'buna' | 'info', mesaj: string): string {
  return `<div class="alerta ${fel}">${mesaj}</div>`
}
