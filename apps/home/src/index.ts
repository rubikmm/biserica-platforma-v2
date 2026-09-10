/**
 * Home-ul platformei: usa de intrare, la radacina domeniului. Listeaza aplicatiile, ca omul sa
 * poata intra in ele. Nu cere cont si nu tine date proprii.
 *
 * Cerere user (10.09.2026): „un home cum e acum website.sfantul-ilie.ro, dar nu mai pui șters și
 * punctat unele aplicații — doar să fie acolo listate ca să pot să intru pe ele."
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

interface Aplicatie {
  cheie: keyof Navigatie
  nume: string
  ce: string
}

/** Aplicatiile platformei, in ordinea in care se folosesc. Se adauga aici, pe masura ce se poarta. */
const APLICATII: Aplicatie[] = [
  { cheie: 'calendar', nume: 'Calendarul', ce: 'Ce zi liturgică este: sfinții zilei, postul, glasul, pericopele. Nucleul de care ascultă toate celelalte.' },
  { cheie: 'program', nume: 'Programul liturgic', ce: 'Ce se slujește și la ce oră, săptămână de săptămână. De aici iese foaia de pe ușa bisericii.' },
  { cheie: 'curatenie', nume: 'Curățenia', ce: 'Programarea voluntarilor la curățenia bisericii, după slujbele din program.' },
  { cheie: 'cont', nume: 'Contul', ce: 'Intrarea în platformă, fără parolă: îți vine un link pe e-mail.' },
  { cheie: 'admin', nume: 'Administrarea', ce: 'Ce s-a întâmplat pe platformă: audit, livrări, automatizări.' },
]

const STIL = `
.aplicatii { list-style:none; padding:0; margin:26px 0 0 }
.aplicatii li { margin:0 0 14px }
.aplicatii a.cap { display:block; text-decoration:none; color:var(--ink);
  border:1px solid var(--rule); border-radius:12px; padding:14px 16px; background:var(--tinta) }
.aplicatii a.cap:hover { border-color:var(--rosu) }
.aplicatii .nume { font:600 18px/1.3 ui-sans-serif,system-ui; display:block }
.aplicatii .adresa { font:12px/1.4 ui-sans-serif,system-ui; color:var(--faint); letter-spacing:.04em }
.aplicatii .ce { font:14px/1.5 ui-sans-serif,system-ui; color:var(--soft); margin:6px 0 0 }
.intro { color:var(--soft) }
`

function adresaLizibila(adresa: string): string {
  if (!adresa) return ''
  try {
    return new URL(adresa).host
  } catch {
    return adresa
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: 'app-home', correlationId: cid })
    const url = new URL(req.url)
    const nav = navigatieDin(cfg)

    if (url.pathname === '/health') {
      return json({ ok: true, app: 'home', mediu: env.MEDIU, ora: new Date().toISOString() }, 200, { 'cache-control': 'no-store' })
    }

    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const utilizator = sesiune.user?.displayName ?? sesiune.user?.email ?? null
    const eAdmin = sesiune.roles.some((r) => r.role === 'admin' || r.role === 'super-admin')

    if (url.pathname !== '/' && url.pathname !== '') {
      return html(
        pagina({
          nume: 'PLATFORMA',
          titlu: 'Platforma parohiei',
          titluPagina: 'Pagina nu există',
          acasa: '/',
          urlPlatforma: nav.home || '/',
          local: STIL,
          versiune: pkg.version,
          modificata: dataVersiunii(env.VERSIUNE),
          cont: { intrat: !!utilizator, nume: utilizator ?? 'Cont', admin: eAdmin, urlCont: nav.cont, urlAdmin: nav.admin },
          corp: `<h1>Pagina nu există</h1><p class="intro">Aplicațiile platformei sunt mai jos.</p>${lista(nav)}`,
        }),
        404,
      )
    }

    log.info('home')
    return html(
      pagina({
        nume: 'PLATFORMA',
        titlu: 'Platforma parohiei',
        acasa: '/',
        urlPlatforma: nav.home || '/',
        local: STIL,
        indexabil: false,
        versiune: pkg.version,
        modificata: dataVersiunii(env.VERSIUNE),
        cont: { intrat: !!utilizator, nume: utilizator ?? 'Cont', admin: eAdmin, urlCont: nav.cont, urlAdmin: nav.admin },
        corp: `
<h1>Platforma parohiei</h1>
<p class="intro">Aplicațiile parohiei „Sfântul Ilie – Hanul Colței", pe platforma nouă.
${env.MEDIU === 'staging' ? 'Aceasta e versiunea de probă: datele sunt copii, iar site-ul viu rămâne neatins.' : ''}</p>
${lista(nav)}`,
      }),
      200,
      { 'cache-control': 'public, max-age=300' },
    )
  },
}

function lista(nav: Navigatie): string {
  const randuri = APLICATII.map((a) => {
    const adresa = nav[a.cheie] || '/'
    return `<li>
      <a class="cap" href="${esc(adresa)}${adresa.startsWith('/') ? '/' : ''}">
        <span class="nume">${esc(a.nume)}</span>
        <span class="adresa">${esc(adresaLizibila(adresa))}</span>
        <span class="ce">${esc(a.ce)}</span>
      </a>
    </li>`
  }).join('')
  return `<ul class="aplicatii">${randuri}</ul>`
}
