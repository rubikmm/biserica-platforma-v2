import { SCOPE_GLOBAL, SESIUNE_ANONIMA, type SesiuneCurenta } from '@xc/contracts'
import { ClientAutorizare } from '@xc/authorization'
import { principalDin, sesiuneCurenta } from '@xc/auth'
import { citesteConfig, navigatieDin } from '@xc/config'
import { Logger, correlationId } from '@xc/observability'
import { alerta, dataVersiunii, esc, html, pagina } from '@xc/ui'
import pkg from '../package.json'

export interface Env {
  IDENTITATE: Fetcher
  AUTORIZARE: Fetcher
  AUDIT: Fetcher
  AUTOMATIZARE: Fetcher
  COMUNICARE: Fetcher
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  VERSIUNE?: { timestamp?: string }
}

interface IntrareAuditRand {
  action: string
  target: string
  outcome: string
  actor_id: string | null
  occurred_at: string
}

interface LivrareRand {
  channel: string
  recipient: string
  status: string
  provider: string
  template_id: string
  created_at: string
}

function tabelAudit(intrari: IntrareAuditRand[]): string {
  if (!intrari.length) return '<p class="gol">Nicio intrare de audit încă.</p>'
  const randuri = intrari
    .map(
      (i) => `<tr>
        <td>${esc(i.action)}</td>
        <td><span class="eticheta ${i.outcome === 'success' ? 'publicat' : ''}">${esc(i.outcome)}</span></td>
        <td>${esc(i.occurred_at)}</td>
      </tr>`,
    )
    .join('')
  return `<table><thead><tr><th>Acțiune</th><th>Rezultat</th><th>Când</th></tr></thead><tbody>${randuri}</tbody></table>`
}

function tabelLivrari(livrari: LivrareRand[]): string {
  if (!livrari.length) return '<p class="gol">Nicio livrare înregistrată încă.</p>'
  const randuri = livrari
    .map(
      (l) => `<tr>
        <td>${esc(l.channel)}</td>
        <td>${esc(l.recipient)}</td>
        <td><span class="eticheta">${esc(l.status)}</span></td>
        <td>${esc(l.provider)}</td>
      </tr>`,
    )
    .join('')
  return `<table><thead><tr><th>Canal</th><th>Destinatar</th><th>Stare</th><th>Adaptor</th></tr></thead><tbody>${randuri}</tbody></table>`
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cfg = citesteConfig(env)
    const nav = navigatieDin(cfg)
    const cid = correlationId(req)
    const log = new Logger({ service: 'app-admin', correlationId: cid })
    const url = new URL(req.url)

    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const principal = principalDin(sesiune)

    if (!principal) {
      return new Response(null, { status: 303, headers: { location: `${nav.cont}/auth/login` } })
    }

    const eAdmin = sesiune.roles.some((r) => r.role === 'admin' || r.role === 'super-admin')
    const authz = new ClientAutorizare(env.AUTORIZARE, cid)
    const decizie = await authz.can(principal, 'audit.read', SCOPE_GLOBAL)

    if (!decizie.allowed) {
      return html(
        pagina({
          ...comune(env, nav, principal.email, eAdmin, sesiune, url.toString()),
          corp: `<h2>Administrare</h2>
            ${alerta('rea', 'Nu ai permisiunea <code>audit.read</code>.')}
            <p class="ajutor">Ești autentificat ca ${esc(principal.email)}, dar fără drepturile necesare.
            Asta confirmă totuși că sesiunea funcționează și pe această aplicație.</p>`,
        }),
        403,
      )
    }

    try {
      const [raspunsAudit, raspunsLivrari, raspunsActiuni] = await Promise.all([
        env.AUDIT.fetch('https://audit.intern/citeste', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ limita: 25 }),
        }),
        env.COMUNICARE.fetch('https://comunicare.intern/livrari', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ limita: 25 }),
        }),
        env.AUTOMATIZARE.fetch('https://automation.intern/actiuni', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }),
      ])

      const audit = raspunsAudit.ok
        ? ((await raspunsAudit.json()) as { intrari: IntrareAuditRand[] }).intrari
        : []
      const livrari = raspunsLivrari.ok
        ? ((await raspunsLivrari.json()) as { livrari: LivrareRand[] }).livrari
        : []
      const actiuni = raspunsActiuni.ok
        ? ((await raspunsActiuni.json()) as { actiuni: unknown[] }).actiuni
        : []

      return html(
        pagina({
          ...comune(env, nav, principal.email, eAdmin, sesiune, url.toString()),
          corp: `
<h2>Administrare</h2>
  <p>Ești autentificat ca <strong>${esc(principal.email)}</strong> — fără să te fi
  autentificat din nou pe această aplicație. Rolurile tale: ${sesiune.roles
    .map((r) => `<span class="eticheta">${esc(r.role)}</span>`)
    .join(' ')}</p>
  ${alerta('info', `Automatizarea a produs <strong>${actiuni.length}</strong> acțiuni până acum. Nicio comunicare reală nu a plecat: toate adaptoarele sunt în sandbox.`)}

<h3>Audit — ultimele acțiuni</h3>
  ${tabelAudit(audit)}

<h3>Comunicare — livrări înregistrate</h3>
  ${tabelLivrari(livrari)}`,
        }),
      )
    } catch (e) {
      log.error('eroare la citirea panoului', { eroare: e instanceof Error ? e.message : String(e) })
      return html(
        pagina({
          ...comune(env, nav, principal.email, eAdmin, sesiune, url.toString()),
          corp: `${alerta("rea", "Nu am putut citi datele panoului.")}`,
        }),
        500,
      )
    }
  },
}

/** Carcasa comuna a paginilor de administrare. */
function comune(
  env: Env,
  nav: ReturnType<typeof navigatieDin>,
  email: string,
  eAdmin: boolean,
  sesiune: SesiuneCurenta,
  spre: string,
) {
  return {
    nume: 'ADMINISTRARE',
    titlu: 'Administrarea platformei',
    acasa: `${nav.admin}/`,
    urlPlatforma: nav.home || '/',
    local: STIL,
    versiune: pkg.version,
    modificata: dataVersiunii(env.VERSIUNE),
    cont: {
      intrat: true,
      nume: email,
      admin: eAdmin,
      urlCont: nav.cont,
      urlAdmin: nav.admin,
      poateVedeaCa: sesiune.poateVedeaCa,
      veziCa: sesiune.veziCa,
      spre,
    },
  }
}

const STIL = `
.eticheta { display:inline-block; border:1px solid var(--rule); border-radius:999px;
            padding:1px 8px; font:12px ui-sans-serif,system-ui; color:var(--soft) }
.eticheta.publicat { border-color:#2E8A4A; color:#2E8A4A }
`
