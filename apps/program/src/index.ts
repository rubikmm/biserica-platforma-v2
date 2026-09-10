import { z } from 'zod'
import {
  CerereCreareEveniment,
  SESIUNE_ANONIMA,
  SCOPE_GLOBAL,
  type EvenimentProgram,
  type Principal,
  type SesiuneCurenta,
} from '@xc/contracts'
import { ClientAutorizare, EroareAutorizare } from '@xc/authorization'
import {
  NUME_COOKIE_CSRF,
  citesteCookie,
  construiesteCookie,
  sesiuneCurenta,
  verificaCsrf,
  verificaTokenCsrf,
} from '@xc/auth'
import { citesteConfig, navigatieDin } from '@xc/config'
import { acum, batch, id, ruleaza, toate, unul } from '@xc/db'
import { construiesteEnvelope, declaratieOutbox, golesteOutbox } from '@xc/events'
import { Logger, correlationId } from '@xc/observability'
import { html } from '@xc/ui'
import { paginaAdministrare, paginaPublica, paginaRefuz } from './pagini.js'

export interface Env {
  DB: D1Database
  IDENTITATE: Fetcher
  AUTORIZARE: Fetcher
  AUDIT: Fetcher
  EVENIMENTE: Queue
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
}

interface RandEveniment {
  id: string
  title: string
  description: string | null
  location: string | null
  starts_at: string
  ends_at: string | null
  status: string
  scope: string
  created_at: string
  updated_at: string
}

function catreEveniment(r: RandEveniment): EvenimentProgram {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    location: r.location,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    status: r.status === 'published' ? 'published' : r.status === 'archived' ? 'archived' : 'draft',
    scope: r.scope,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function redirect(catre: string, antete: Record<string, string> = {}): Response {
  return new Response(null, { status: 303, headers: { location: catre, ...antete } })
}

function principalDin(sesiune: SesiuneCurenta): Principal | null {
  if (!sesiune.authenticated || !sesiune.user) return null
  return { userId: sesiune.user.id, email: sesiune.user.email }
}

async function scrieAudit(
  env: Env,
  intrare: {
    action: string
    target: string
    outcome: 'success' | 'failure' | 'denied'
    correlationId: string
    actorId?: string
    summary?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await env.AUDIT.fetch('https://audit.intern/scrie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: intrare.action,
        target: intrare.target,
        scope: SCOPE_GLOBAL,
        actor: intrare.actorId ? { type: 'user', id: intrare.actorId } : { type: 'system' },
        outcome: intrare.outcome,
        correlationId: intrare.correlationId,
        summary: intrare.summary ?? {},
      }),
    })
  } catch {
    // auditul indisponibil nu blocheaza operatia, dar nici nu o ascunde: ramane in log
  }
}

function jetonCsrfNou(): string {
  const octeti = crypto.getRandomValues(new Uint8Array(24))
  let binar = ''
  for (const octet of octeti) binar += String.fromCharCode(octet)
  return btoa(binar).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function asiguraCsrf(req: Request, domeniu: string): { jeton: string; setCookie?: string } {
  const existent = citesteCookie(req, NUME_COOKIE_CSRF)
  if (existent) return { jeton: existent }
  const jeton = jetonCsrfNou()
  return {
    jeton,
    setCookie: construiesteCookie(NUME_COOKIE_CSRF, jeton, { maxAge: 4 * 60 * 60, domeniu }),
  }
}

/** `datetime-local` vine fara fus; il interpretam ca ora locala a parohiei. */
function dinInputLocal(valoare: string): string | null {
  if (!valoare) return null
  const d = new Date(`${valoare}:00+03:00`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: 'app-program', correlationId: cid })
    const url = new URL(req.url)

    // Prin gateway-ul de preview aplicatia e montata la `/program`; pe subdomeniul propriu e la
    // radacina. Taiem prefixul o singura data, aici, si il purtam mai departe pentru linkuri.
    const areprefix = url.pathname === '/program' || url.pathname.startsWith('/program/')
    const prefix = areprefix ? '/program' : ''
    const cale = areprefix ? url.pathname.slice('/program'.length) || '/' : url.pathname
    const nav = navigatieDin(cfg)
    const ctx = { prefix, nav }

    if (req.method === 'POST') {
      const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA])
      if (problema) return html(paginaRefuz(ctx, `Verificare de securitate: ${problema}.`), 403)
    }

    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const principal = principalDin(sesiune)
    const authz = new ClientAutorizare(env.AUTORIZARE, cid)

    try {
      // ------------------------------------------------------------ public
      if (cale === '/' && req.method === 'GET') {
        const randuri = await toate<RandEveniment>(
          env.DB,
          `SELECT * FROM events WHERE status = 'published' ORDER BY starts_at ASC LIMIT 100`,
        )
        return html(
          paginaPublica({
            ctx,
            evenimente: randuri.map(catreEveniment),
            utilizator: sesiune.user?.email ?? null,
          }),
        )
      }

      // ----------------------------------------------------- administrare
      if (cale === '/admin' && req.method === 'GET') {
        if (!principal) return redirect(`${nav.cont}/auth/login`)

        const decizie = await authz.can(principal, 'program.write', SCOPE_GLOBAL)
        if (!decizie.allowed) {
          await scrieAudit(env, {
            action: 'program.admin.open',
            target: 'program',
            outcome: 'denied',
            correlationId: cid,
            actorId: principal.userId,
            summary: { motiv: decizie.reason },
          })
          return html(
            paginaRefuz(ctx, 'Nu ai permisiunea de a administra programul.', sesiune.user?.email),
            403,
          )
        }

        const randuri = await toate<RandEveniment>(
          env.DB,
          `SELECT * FROM events ORDER BY starts_at DESC LIMIT 100`,
        )
        const csrf = asiguraCsrf(req, cfg.DOMENIU_COOKIE)
        return html(
          paginaAdministrare({
            ctx,
            evenimente: randuri.map(catreEveniment),
            csrf: csrf.jeton,
            utilizator: sesiune.user?.email ?? '',
            mesaj: url.searchParams.get('ok') ?? undefined,
          }),
          200,
          csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {},
        )
      }

      // ---------------------------------------------------------- creare
      if (cale === '/creeaza' && req.method === 'POST') {
        if (!principal) return redirect(`${nav.cont}/auth/login`)
        const formular = await req.formData()
        const problemaCsrf = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problemaCsrf) return html(paginaRefuz(ctx, problemaCsrf), 403)

        await authz.require(principal, 'program.write', SCOPE_GLOBAL)

        const inceput = dinInputLocal(String(formular.get('inceput') ?? ''))
        if (!inceput) return html(paginaRefuz(ctx, 'Data de început nu e validă.'), 400)

        const date = CerereCreareEveniment.parse({
          title: String(formular.get('titlu') ?? ''),
          location: String(formular.get('loc') ?? '') || undefined,
          description: String(formular.get('descriere') ?? '') || undefined,
          startsAt: inceput,
        })

        const eventId = id()
        const envelope = construiesteEnvelope({
          type: 'program.event.created.v1',
          producer: 'app-program',
          actor: { type: 'user', id: principal.userId },
          correlationId: cid,
          idempotencyKey: eventId,
          payload: {
            eventId,
            title: date.title,
            startsAt: date.startsAt,
            endsAt: null,
            status: 'draft',
          },
        })

        // Mutatia si randul de outbox intra impreuna sau deloc.
        await batch(env.DB, [
          env.DB
            .prepare(
              `INSERT INTO events (id, title, description, location, starts_at, ends_at, status, scope, created_by, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
            )
            .bind(
              eventId,
              date.title,
              date.description ?? null,
              date.location ?? null,
              date.startsAt,
              null,
              SCOPE_GLOBAL,
              principal.userId,
              acum(),
              acum(),
            ),
          declaratieOutbox(env.DB, envelope),
        ])

        await scrieAudit(env, {
          action: 'program.event.created',
          target: eventId,
          outcome: 'success',
          correlationId: cid,
          actorId: principal.userId,
          summary: { titlu: date.title },
        })

        await golesteOutbox(env.DB, env.EVENIMENTE)
        return redirect(`${prefix}/admin?ok=Ciorna+a+fost+salvata`)
      }

      // -------------------------------------------------------- publicare
      if (cale === '/publica' && req.method === 'POST') {
        if (!principal) return redirect(`${nav.cont}/auth/login`)
        const formular = await req.formData()
        const problemaCsrf = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problemaCsrf) return html(paginaRefuz(ctx, problemaCsrf), 403)

        await authz.require(principal, 'program.publish', SCOPE_GLOBAL)

        const eventId = z.string().min(1).parse(String(formular.get('id') ?? ''))
        const existent = await unul<RandEveniment>(env.DB, `SELECT * FROM events WHERE id = ?`, [
          eventId,
        ])
        if (!existent) return html(paginaRefuz(ctx, 'Evenimentul nu există.'), 404)

        const envelope = construiesteEnvelope({
          type: 'program.event.published.v1',
          producer: 'app-program',
          actor: { type: 'user', id: principal.userId },
          correlationId: cid,
          idempotencyKey: `publicare:${eventId}`,
          payload: {
            eventId,
            title: existent.title,
            startsAt: existent.starts_at,
            endsAt: existent.ends_at,
            status: 'published',
          },
        })

        await batch(env.DB, [
          env.DB
            .prepare(`UPDATE events SET status = 'published', updated_at = ? WHERE id = ?`)
            .bind(acum(), eventId),
          declaratieOutbox(env.DB, envelope),
        ])

        await scrieAudit(env, {
          action: 'program.event.published',
          target: eventId,
          outcome: 'success',
          correlationId: cid,
          actorId: principal.userId,
          summary: { titlu: existent.title },
        })

        const rezultat = await golesteOutbox(env.DB, env.EVENIMENTE)
        log.info('eveniment publicat', { eventId, outbox: rezultat })

        return redirect(`${prefix}/admin?ok=Evenimentul+a+fost+publicat`)
      }

      // ------------------------------------------------------- arhivare
      if (cale === '/arhiveaza' && req.method === 'POST') {
        if (!principal) return redirect(`${nav.cont}/auth/login`)
        const formular = await req.formData()
        const problemaCsrf = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problemaCsrf) return html(paginaRefuz(ctx, problemaCsrf), 403)

        await authz.require(principal, 'program.publish', SCOPE_GLOBAL)
        const eventId = z.string().min(1).parse(String(formular.get('id') ?? ''))

        await ruleaza(env.DB, `UPDATE events SET status = 'archived', updated_at = ? WHERE id = ?`, [
          acum(),
          eventId,
        ])

        await scrieAudit(env, {
          action: 'program.event.archived',
          target: eventId,
          outcome: 'success',
          correlationId: cid,
          actorId: principal.userId,
        })

        return redirect(`${prefix}/admin?ok=Evenimentul+a+fost+arhivat`)
      }

      return html(paginaRefuz(ctx, 'Pagina nu există.', sesiune.user?.email), 404)
    } catch (e) {
      if (e instanceof EroareAutorizare) {
        await scrieAudit(env, {
          action: 'program.permission.denied',
          target: e.permission,
          outcome: 'denied',
          correlationId: cid,
          actorId: principal?.userId,
          summary: { motiv: e.reason },
        })
        return html(paginaRefuz(ctx, 'Nu ai permisiunea necesară.', sesiune.user?.email), 403)
      }
      if (e instanceof z.ZodError) {
        return html(paginaRefuz(ctx, e.issues[0]?.message ?? 'Date invalide.'), 400)
      }
      log.error('eroare neasteptata', { eroare: e instanceof Error ? e.message : String(e) })
      return html(paginaRefuz(ctx, 'A apărut o eroare neașteptată.'), 500)
    }
  },

  /** Plasa de siguranta a outbox-ului: ce n-a apucat sa plece la scriere, pleaca aici. */
  async scheduled(_eveniment: ScheduledController, env: Env): Promise<void> {
    const rezultat = await golesteOutbox(env.DB, env.EVENIMENTE)
    if (rezultat.publicate > 0 || rezultat.esuate > 0) {
      new Logger({ service: 'app-program', correlationId: 'cron' }).info('outbox golit', rezultat)
    }
  },
}
