/**
 * Home-ul platformei: usa de intrare, la radacina domeniului. Listeaza aplicatiile, ca omul sa
 * poata intra in ele. Nu cere cont si nu tine date proprii.
 *
 * Afisarea e cea de la `website.sfantul-ilie.ro` din V1 (cerere user, 10.09.2026), cu doua
 * schimbari cerute tot atunci: fara textul de jos si **toate butoanele la fel** — nimic sters,
 * nimic punctat.
 */
import { SESIUNE_ANONIMA } from '@xc/contracts'
import { sesiuneCurenta } from '@xc/auth'
import { citesteConfig, navigatieDin, type Navigatie } from '@xc/config'
import { correlationId, Logger } from '@xc/observability'
import { dataVersiunii, esc, html, json, pagina } from '@xc/ui'
import pkg from '../package.json'

export interface Env {
  IDENTITATE: Fetcher
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  /** Data publicarii, pentru subsol — binding-ul `version_metadata`. */
  VERSIUNE?: { timestamp?: string }
}

/**
 * Aplicatiile platformei. Se adauga aici pe masura ce se poarta — dar NUMAI dupa ce adresa
 * lor raspunde: toate butoanele arata la fel (cerere user, 10.09.2026), deci un buton care
 * n-ar duce nicaieri n-are cum sa se deosebeasca de unul bun. Curatenia intra la publicare.
 */
const APLICATII: Array<{ cheie: keyof Navigatie; nume: string }> = [
  { cheie: 'calendar', nume: 'Calendarul' },
  { cheie: 'program', nume: 'Programul liturgic' },
  { cheie: 'tipic', nume: 'Tipicul' },
  { cheie: 'cont', nume: 'Contul' },
  { cheie: 'admin', nume: 'Admin' },
]

/** Stilul butoanelor e cel de la website (V1), fara starile stinse. */
const LOCAL = `
.apps { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr));
        gap:10px; margin:22px 0 8px }
.apps a { display:block; text-align:center; padding:12px 10px;
          border:1px solid var(--rule); border-radius:10px; color:var(--ink);
          text-decoration:none; font:15px/1.2 ui-sans-serif,system-ui }
.apps a:hover { border-color:var(--rosu); color:var(--rosu) }
.apps b { display:block; font-weight:400 }
.apps .adr { display:block; margin-top:4px; font:11.5px/1.2 ui-sans-serif,system-ui;
             color:var(--faint); letter-spacing:.01em }
.apps a:hover .adr { color:var(--rosu) }
`

function buton(nume: string, url: string): string {
  const adresa = url.replace(/^https:\/\/|\/$/g, '') || 'aici'
  return `    <a href="${esc(url)}${url.startsWith('/') ? '/' : ''}"><b>${esc(nume)}</b><span class="adr">${esc(adresa)}</span></a>`
}

function corp(nav: Navigatie): string {
  return `<nav class="apps" aria-label="Aplicațiile platformei">
${APLICATII.map((a) => buton(a.nume, nav[a.cheie] || '/')).join('\n')}
  </nav>`
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: 'app-home', correlationId: cid })
    const url = new URL(req.url)
    const nav = navigatieDin(cfg)

    if (url.pathname === '/health') {
      return json({ ok: true, app: 'home', mediu: env.MEDIU, versiune: pkg.version, publicat: env.VERSIUNE?.timestamp ?? null, ora: new Date().toISOString() }, 200, { 'cache-control': 'no-store' })
    }

    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const utilizator = sesiune.user?.displayName ?? sesiune.user?.email ?? null
    const eAdmin = sesiune.roles.some((r) => r.role === 'admin' || r.role === 'super-admin')
    const comune = {
      nume: 'PLATFORMA',
      titlu: 'Platforma parohiei',
      acasa: '/',
      urlPlatforma: nav.home || '/',
      local: LOCAL,
      versiune: pkg.version,
      modificata: dataVersiunii(env.VERSIUNE),
      cont: {
        intrat: !!utilizator,
        nume: utilizator ?? 'Cont',
        admin: eAdmin,
        urlCont: nav.cont,
        urlAdmin: nav.admin,
        poateVedeaCa: sesiune.poateVedeaCa,
        veziCa: sesiune.veziCa,
        spre: url.toString(),
      },
    }

    if (url.pathname !== '/' && url.pathname !== '') {
      return html(pagina({ ...comune, titluPagina: 'Pagina nu există', corp: `<h2>Pagina nu există</h2>${corp(nav)}` }), 404)
    }

    log.info('home')
    return html(pagina({ ...comune, corp: corp(nav) }), 200, { 'cache-control': 'public, max-age=300' })
  },
}
