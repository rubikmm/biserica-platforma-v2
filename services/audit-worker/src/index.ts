import { z } from 'zod'
import { IntrareAudit, redacteaza } from '@xc/contracts'
import { acum, id, ruleaza, toate } from '@xc/db'
import { Logger, correlationId } from '@xc/observability'

export interface Env {
  DB: D1Database
  MEDIU: string
}

const SERVICIU = 'audit-worker'

function json(date: unknown, status = 200): Response {
  return new Response(JSON.stringify(date), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

const CerereCitire = z.object({
  target: z.string().optional(),
  action: z.string().optional(),
  /*
   * Familia de actiuni a unei aplicatii: `calendar.` prinde `calendar.subscribe`,
   * `calendar.unsubscribe` si tot ce va mai scrie calendarul de acum inainte (15.09.2026, pentru
   * zona de loguri din Setari). Pana acum se putea cere numai o actiune ANUME, deci „ce s-a
   * intamplat in aplicatia asta" nu se putea intreba deloc.
   *
   * ⚠️ Se cere sa se termine cu punct si sa n-aiba `%` ori `_`: altfel un prefix scris de mana ar
   * deveni un tipar LIKE si ar scoate din jurnal si ce nu e al aplicatiei.
   */
  prefixActiune: z
    .string()
    .regex(/^[a-z0-9-]+\.$/, 'prefixul unei aplicatii se scrie `nume.`, cu punct la coada')
    .optional(),
  limita: z.number().int().min(1).max(200).default(50),
})

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cid = correlationId(req)
    const log = new Logger({ service: SERVICIU, correlationId: cid })
    const cale = new URL(req.url).pathname

    if (req.method !== 'POST') return json({ eroare: 'doar POST' }, 405)

    try {
      if (cale === '/scrie') {
        const intrare = IntrareAudit.parse(await req.json())
        // A doua redactare, aici: chiar daca apelantul a uitat, in audit nu intra secrete.
        const rezumat = JSON.stringify(redacteaza(intrare.summary))

        await ruleaza(
          env.DB,
          `INSERT INTO audit_log
             (id, action, target, scope, actor_type, actor_id, outcome, correlation_id, summary_json, occurred_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id(),
            intrare.action,
            intrare.target,
            intrare.scope,
            intrare.actor.type,
            intrare.actor.id ?? null,
            intrare.outcome,
            intrare.correlationId,
            rezumat,
            intrare.occurredAt ?? acum(),
          ],
        )
        return json({ ok: true })
      }

      if (cale === '/citeste') {
        // Citirea e permisa doar apelantilor interni care au verificat deja `audit.read`.
        const date = CerereCitire.parse(await req.json())
        const conditii: string[] = []
        const legaturi: (string | number)[] = []

        if (date.target) {
          conditii.push('target = ?')
          legaturi.push(date.target)
        }
        if (date.action) {
          conditii.push('action = ?')
          legaturi.push(date.action)
        }
        if (date.prefixActiune) {
          conditii.push('action LIKE ?')
          legaturi.push(`${date.prefixActiune}%`)
        }

        const unde = conditii.length ? `WHERE ${conditii.join(' AND ')}` : ''
        legaturi.push(date.limita)

        const randuri = await toate(
          env.DB,
          `SELECT action, target, scope, actor_type, actor_id, outcome, correlation_id, summary_json, occurred_at
           FROM audit_log ${unde} ORDER BY occurred_at DESC LIMIT ?`,
          legaturi,
        )
        return json({ intrari: randuri })
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
