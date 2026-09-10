import { SCOPE_GLOBAL, SESIUNE_ANONIMA, type Principal, type SesiuneCurenta } from '@xc/contracts'
import { ClientAutorizare } from '@xc/authorization'
import { sesiuneCurenta } from '@xc/auth'
import { citesteConfig, navigatieDin } from '@xc/config'
import { Logger, correlationId } from '@xc/observability'
import { alerta, esc, html, pagina } from '@xc/ui'

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

function principalDin(sesiune: SesiuneCurenta): Principal | null {
  if (!sesiune.authenticated || !sesiune.user) return null
  return { userId: sesiune.user.id, email: sesiune.user.email }
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

    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const principal = principalDin(sesiune)

    if (!principal) {
      return new Response(null, { status: 303, headers: { location: `${nav.cont}/auth/login` } })
    }

    const authz = new ClientAutorizare(env.AUTORIZARE, cid)
    const decizie = await authz.can(principal, 'audit.read', SCOPE_GLOBAL)

    if (!decizie.allowed) {
      return html(
        pagina({
          titlu: 'Administrare',
          utilizator: principal.email,
          activ: 'admin',
          navigatie: nav,
          continut: `<div class="carte ingust">
            <h1>Administrare</h1>
            ${alerta('rea', 'Nu ai permisiunea <code>audit.read</code>.')}
            <p class="ajutor">Ești autentificat ca ${esc(principal.email)}, dar fără drepturile necesare.
            Asta confirmă totuși că sesiunea SSO funcționează și pe această aplicație.</p>
          </div>`,
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
          titlu: 'Administrare',
          utilizator: principal.email,
          activ: 'admin',
          navigatie: nav,
          continut: `
<div class="carte">
  <h1>Administrare</h1>
  <p class="ajutor">Ești autentificat ca <strong>${esc(principal.email)}</strong> — fără să te fi
  autentificat din nou pe această aplicație. Rolurile tale: ${sesiune.roles
    .map((r) => `<span class="eticheta">${esc(r.role)}</span>`)
    .join(' ')}</p>
  ${alerta('info', `Automatizarea a produs <strong>${actiuni.length}</strong> acțiuni până acum. Nicio comunicare reală nu a plecat: toate adaptoarele sunt în sandbox.`)}
</div>
<div class="carte">
  <h2>Audit — ultimele acțiuni</h2>
  ${tabelAudit(audit)}
</div>
<div class="carte">
  <h2>Comunicare — livrări înregistrate</h2>
  ${tabelLivrari(livrari)}
</div>`,
        }),
      )
    } catch (e) {
      log.error('eroare la citirea panoului', { eroare: e instanceof Error ? e.message : String(e) })
      return html(
        pagina({
          titlu: 'Administrare',
          utilizator: principal.email,
          activ: 'admin',
          navigatie: nav,
          continut: `<div class="carte">${alerta('rea', 'Nu am putut citi datele panoului.')}</div>`,
        }),
        500,
      )
    }
  },
}
