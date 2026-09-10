import { z } from 'zod'
import { Envelope, PayloadEvenimentCalendar, redacteaza } from '@xc/contracts'
import { acum, id, ruleaza, toate, unul } from '@xc/db'
import { Logger, correlationId } from '@xc/observability'

export interface Env {
  DB: D1Database
  COMUNICARE: Fetcher
  AUDIT: Fetcher
  MEDIU: string
}

function json(date: unknown, status = 200): Response {
  return new Response(JSON.stringify(date), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/**
 * O regula: declansator, filtru, actiune, proprietar, stare si politica de aprobare.
 * Actiunile cu risc mare nu se executa singure — se opresc in starea `asteapta_aprobare`.
 */
export interface Regula {
  id: string
  nume: string
  declansator: string
  risc: 'low' | 'high'
  proprietar: string
  activa: boolean
}

const REGULI_IMPLICITE: Regula[] = [
  {
    id: 'notificare-eveniment-publicat',
    nume: 'Anunță audiența când un eveniment de calendar e publicat',
    declansator: 'calendar.event.published.v1',
    risc: 'low',
    proprietar: 'calendar',
    activa: true,
  },
]

async function reguliPentru(db: D1Database, tip: string): Promise<Regula[]> {
  const randuri = await toate<{
    id: string
    nume: string
    declansator: string
    risc: string
    proprietar: string
    activa: number
  }>(db, `SELECT * FROM rules WHERE declansator = ? AND activa = 1`, [tip])

  if (randuri.length > 0) {
    return randuri.map((r) => ({
      id: r.id,
      nume: r.nume,
      declansator: r.declansator,
      risc: r.risc === 'high' ? 'high' : 'low',
      proprietar: r.proprietar,
      activa: r.activa === 1,
    }))
  }
  // Fallback pe regulile implicite, ca fluxul sa mearga si inainte de primul seed.
  return REGULI_IMPLICITE.filter((r) => r.declansator === tip && r.activa)
}

async function scrieAudit(env: Env, intrare: Record<string, unknown>): Promise<void> {
  try {
    await env.AUDIT.fetch('https://audit.intern/scrie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(intrare),
    })
  } catch {
    // auditul indisponibil nu opreste automatizarea
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cid = correlationId(req)
    const log = new Logger({ service: 'automation-worker', correlationId: cid })
    const cale = new URL(req.url).pathname

    if (req.method !== 'POST') return json({ eroare: 'doar POST' }, 405)

    try {
      if (cale === '/eveniment') {
        const envelope = Envelope.parse(await req.json())
        const reguli = await reguliPentru(env.DB, envelope.type)

        if (reguli.length === 0) {
          return json({ ok: true, actiuni: 0, motiv: 'nicio regula pentru acest tip' })
        }

        let create = 0

        // Cheia de idempotenta a producatorului, cand exista, bate id-ul envelope-ului: doua
        // publicari ale ACELUIASI eveniment de calendar produc envelope-uri diferite, dar
        // aceeasi cheie — si trebuie sa duca la o singura notificare, nu la doua.
        const cheieIdempotenta = envelope.idempotencyKey ?? envelope.id

        for (const regula of reguli) {
          const actionId = id()
          const existent = await unul<{ id: string }>(
            env.DB,
            `SELECT id FROM actions WHERE event_id = ? AND rule_id = ?`,
            [cheieIdempotenta, regula.id],
          )
          if (existent) continue

          const stare = regula.risc === 'high' ? 'asteapta_aprobare' : 'aprobata_automat'

          await ruleaza(
            env.DB,
            `INSERT INTO actions (id, rule_id, event_id, kind, risc, stare, correlation_id, input_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              actionId,
              regula.id,
              cheieIdempotenta,
              'communication.request',
              regula.risc,
              stare,
              envelope.correlationId,
              JSON.stringify(redacteaza(envelope.payload)),
              acum(),
            ],
          )
          create++

          if (stare !== 'aprobata_automat') {
            log.info('actiune oprita pentru aprobare umana', { actionId, regula: regula.id })
            continue
          }

          // Actiunea propriu-zisa: o CERERE de comunicare. Automatizarea nu trimite ea nimic
          // si nu atinge liste de destinatari — asta e treaba serviciului de comunicare.
          const payload = PayloadEvenimentCalendar.safeParse(envelope.payload)
          if (!payload.success) continue

          const raspuns = await env.COMUNICARE.fetch('https://comunicare.intern/cerere', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              audienceId: 'toti-enoriasii',
              templateId: 'eveniment-publicat',
              channel: 'email',
              variables: {
                titlu: payload.data.title,
                inceput: payload.data.startsAt,
              },
              idempotencyKey: `${cheieIdempotenta}:${regula.id}`,
              correlationId: envelope.correlationId,
            }),
          })

          await ruleaza(
            env.DB,
            `UPDATE actions SET stare = ?, executed_at = ? WHERE id = ?`,
            [raspuns.ok ? 'executata' : 'esuata', acum(), actionId],
          )

          await scrieAudit(env, {
            action: 'automation.action.executed',
            target: actionId,
            scope: 'global',
            actor: { type: 'system' },
            outcome: raspuns.ok ? 'success' : 'failure',
            correlationId: envelope.correlationId,
            summary: { regula: regula.id, eveniment: envelope.type },
          })
        }

        return json({ ok: true, actiuni: create })
      }

      if (cale === '/aproba') {
        const date = z
          .object({ actionId: z.string().min(1), aprobatDe: z.string().min(1) })
          .parse(await req.json())

        await ruleaza(
          env.DB,
          `UPDATE actions SET stare = 'aprobata', approved_by = ?, approved_at = ?
           WHERE id = ? AND stare = 'asteapta_aprobare'`,
          [date.aprobatDe, acum(), date.actionId],
        )

        await scrieAudit(env, {
          action: 'automation.action.approved',
          target: date.actionId,
          scope: 'global',
          actor: { type: 'user', id: date.aprobatDe },
          outcome: 'success',
          correlationId: cid,
          summary: {},
        })

        return json({ ok: true })
      }

      if (cale === '/actiuni') {
        const randuri = await toate(
          env.DB,
          `SELECT id, rule_id, kind, risc, stare, created_at FROM actions
           ORDER BY created_at DESC LIMIT 50`,
        )
        return json({ actiuni: randuri })
      }

      return json({ eroare: 'ruta necunoscuta' }, 404)
    } catch (e) {
      if (e instanceof z.ZodError) {
        return json({ eroare: 'date invalide', detalii: e.issues.map((i) => i.message) }, 400)
      }
      log.error('eroare neasteptata', { eroare: e instanceof Error ? e.message : String(e) })
      return json({ eroare: 'eroare interna' }, 500)
    }
  },
}
