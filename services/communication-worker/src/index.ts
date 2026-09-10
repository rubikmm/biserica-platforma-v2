import { z } from 'zod'
import { CerereComunicare, type MesajDeLivrat } from '@xc/contracts'
import { acum, id, ruleaza, toate, unul } from '@xc/db'
import { Logger, correlationId } from '@xc/observability'

export interface Env {
  DB: D1Database
  MEDIU: string
  /** Comutator explicit. Cat timp nu e „da", niciun adaptor real nu poate fi ales. */
  LIVRARE_REALA: string
}

function json(date: unknown, status = 200): Response {
  return new Response(JSON.stringify(date), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

interface AdaptorCanal {
  nume: string
  livreaza(mesaj: MesajDeLivrat): Promise<{ status: 'simulated' | 'sent' | 'failed'; detaliu: string }>
}

/** Adaptoarele sandbox: inregistreaza, nu trimit. Singurele active in aceasta faza. */
const ADAPTOR_EMAIL_SANDBOX: AdaptorCanal = {
  nume: 'email-sandbox',
  async livreaza(mesaj) {
    return { status: 'simulated', detaliu: `email simulat catre ${mesaj.recipient}` }
  },
}

const ADAPTOR_WHATSAPP_SANDBOX: AdaptorCanal = {
  nume: 'whatsapp-sandbox',
  async livreaza(mesaj) {
    return { status: 'simulated', detaliu: `whatsapp simulat catre ${mesaj.recipient}` }
  },
}

function alegeAdaptor(env: Env, canal: 'email' | 'whatsapp'): AdaptorCanal {
  if (env.LIVRARE_REALA === 'da') {
    // Aici s-ar lega adaptoarele reale. Deliberat neimplementat: nu exista furnizor configurat,
    // iar activarea trebuie sa fie o decizie explicita a utilizatorului, nu un efect secundar.
    throw new Error('livrarea reala nu are inca niciun adaptor configurat')
  }
  return canal === 'email' ? ADAPTOR_EMAIL_SANDBOX : ADAPTOR_WHATSAPP_SANDBOX
}

interface RandDestinatar {
  user_id: string
  adresa: string
  opted_out: number
}

async function destinatari(
  db: D1Database,
  audienceId: string,
  canal: string,
): Promise<RandDestinatar[]> {
  return toate<RandDestinatar>(
    db,
    `SELECT m.user_id, m.adresa, COALESCE(p.opted_out, 0) AS opted_out
     FROM audience_members m
     LEFT JOIN preferences p ON p.user_id = m.user_id AND p.channel = ?
     WHERE m.audience_id = ? AND m.channel = ?`,
    [canal, audienceId, canal],
  )
}

async function sablon(
  db: D1Database,
  templateId: string,
  canal: string,
): Promise<{ subject: string | null; body: string } | null> {
  return unul(
    db,
    `SELECT subject, body FROM templates WHERE id = ? AND channel = ?
     ORDER BY version DESC LIMIT 1`,
    [templateId, canal],
  )
}

function completeaza(text: string, variabile: Record<string, string>): string {
  return text.replaceAll(/\{\{(\w+)\}\}/g, (_, cheie: string) => variabile[cheie] ?? '')
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cid = correlationId(req)
    const log = new Logger({ service: 'communication-worker', correlationId: cid })
    const cale = new URL(req.url).pathname

    if (req.method !== 'POST') return json({ eroare: 'doar POST' }, 405)

    try {
      if (cale === '/cerere') {
        const date = CerereComunicare.parse(await req.json())

        // Idempotenta la nivel de cerere: acelasi `idempotencyKey` nu produce a doua campanie.
        const existent = await unul<{ id: string }>(
          env.DB,
          `SELECT id FROM requests WHERE idempotency_key = ?`,
          [date.idempotencyKey],
        )
        if (existent) {
          return json({ ok: true, requestId: existent.id, reluat: true })
        }

        const requestId = id()
        await ruleaza(
          env.DB,
          `INSERT INTO requests (id, audience_id, template_id, channel, idempotency_key, correlation_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            requestId,
            date.audienceId,
            date.templateId,
            date.channel,
            date.idempotencyKey,
            date.correlationId,
            acum(),
          ],
        )

        const model = await sablon(env.DB, date.templateId, date.channel)
        if (!model) {
          return json({ ok: false, motiv: 'sablon inexistent', requestId }, 400)
        }

        const adaptor = alegeAdaptor(env, date.channel)
        const lista = await destinatari(env.DB, date.audienceId, date.channel)
        let inregistrate = 0
        let suprimate = 0

        for (const destinatar of lista) {
          if (destinatar.opted_out === 1) {
            await ruleaza(
              env.DB,
              `INSERT INTO deliveries (id, request_id, channel, recipient, status, provider, created_at)
               VALUES (?, ?, ?, ?, 'suppressed', ?, ?)`,
              [id(), requestId, date.channel, destinatar.adresa, adaptor.nume, acum()],
            )
            suprimate++
            continue
          }

          const rezultat = await adaptor.livreaza({
            channel: date.channel,
            recipient: destinatar.adresa,
            subject: model.subject ? completeaza(model.subject, date.variables) : null,
            body: completeaza(model.body, date.variables),
            correlationId: date.correlationId,
          })

          await ruleaza(
            env.DB,
            `INSERT INTO deliveries (id, request_id, channel, recipient, status, provider, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id(), requestId, date.channel, destinatar.adresa, rezultat.status, adaptor.nume, acum()],
          )
          inregistrate++
        }

        log.info('cerere de comunicare procesata', {
          requestId,
          inregistrate,
          suprimate,
          adaptor: adaptor.nume,
        })

        return json({ ok: true, requestId, inregistrate, suprimate, adaptor: adaptor.nume })
      }

      if (cale === '/livrari') {
        const date = z.object({ limita: z.number().int().min(1).max(200).default(50) })
          .parse(await req.json().catch(() => ({})))
        const randuri = await toate(
          env.DB,
          `SELECT d.channel, d.recipient, d.status, d.provider, d.created_at, r.template_id
           FROM deliveries d JOIN requests r ON r.id = d.request_id
           ORDER BY d.created_at DESC LIMIT ?`,
          [date.limita],
        )
        return json({ livrari: randuri })
      }

      if (cale === '/preferinte') {
        const date = z
          .object({
            userId: z.string().min(1),
            channel: z.enum(['email', 'whatsapp']),
            optedOut: z.boolean(),
          })
          .parse(await req.json())

        await ruleaza(
          env.DB,
          `INSERT INTO preferences (user_id, channel, opted_out, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (user_id, channel) DO UPDATE SET opted_out = excluded.opted_out, updated_at = excluded.updated_at`,
          [date.userId, date.channel, date.optedOut ? 1 : 0, acum()],
        )
        return json({ ok: true })
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
