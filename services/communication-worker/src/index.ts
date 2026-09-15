import { z } from 'zod'
import { CerereComunicare } from '@xc/contracts'
import { acum, id, ruleaza, toate, unul } from '@xc/db'
import { Logger, correlationId } from '@xc/observability'
import { alegePostasul, textDinHtml, type MediuPosta } from '@xc/posta'

/**
 * Singurul serviciu care livreaza email (si, mai tarziu, WhatsApp). Doua feluri de cereri:
 *  - `/cerere`: campanie pe audienta + sablon (automatizarile);
 *  - `/trimite`: scrisoare compusa de o aplicatie (rapoartele curateniei, foaia programului),
 *    catre destinatari numiti — arhivata AICI, o singura data, cu livrarea fiecaruia.
 * Audientele (abonarile) se tin tot aici: aplicatiile inscriu/scot membri, nu tin liste proprii.
 * Cat timp `LIVRARE_REALA` nu e „da", totul merge in sandbox: se inregistreaza, nu pleaca.
 */
export interface Env extends MediuPosta {
  DB: D1Database
  MEDIU: string
  LIVRARE_REALA: string
}

function json(date: unknown, status = 200): Response {
  return new Response(JSON.stringify(date), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })
}

interface RandDestinatar {
  user_id: string
  adresa: string
  opted_out: number
}

async function destinatari(db: D1Database, audienceId: string, canal: string): Promise<RandDestinatar[]> {
  return toate<RandDestinatar>(
    db,
    `SELECT m.user_id, m.adresa, COALESCE(p.opted_out, 0) AS opted_out
     FROM audience_members m
     LEFT JOIN preferences p ON p.user_id = m.user_id AND p.channel = ?
     WHERE m.audience_id = ? AND m.channel = ?`,
    [canal, audienceId, canal],
  )
}

async function sablon(db: D1Database, templateId: string, canal: string): Promise<{ subject: string | null; body: string } | null> {
  return unul(db, `SELECT subject, body FROM templates WHERE id = ? AND channel = ? ORDER BY version DESC LIMIT 1`, [templateId, canal])
}

function completeaza(text: string, variabile: Record<string, string>): string {
  return text.replaceAll(/\{\{(\w+)\}\}/g, (_, cheie: string) => variabile[cheie] ?? '')
}

async function eOprit(db: D1Database, userId: string | null, canal: string): Promise<boolean> {
  if (!userId) return false
  const p = await unul<{ opted_out: number }>(db, `SELECT opted_out FROM preferences WHERE user_id = ? AND channel = ?`, [userId, canal])
  return p?.opted_out === 1
}

const Destinatar = z.object({ userId: z.string().min(1).nullable().default(null), adresa: z.email() })

const CerereTrimitere = z.object({
  sursa: z.string().min(1).max(40),
  destinatari: z.array(Destinatar).min(1).max(500),
  subiect: z.string().min(1).max(300),
  html: z.string().min(1),
  text: z.string().optional(),
  raspundeLa: z.email().optional(),
  idempotencyKey: z.string().min(1),
  correlationId: z.string().min(1),
  test: z.boolean().default(false),
  meta: z.record(z.string(), z.unknown()).default({}),
})

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cid = correlationId(req)
    const log = new Logger({ service: 'communication-worker', correlationId: cid })
    const cale = new URL(req.url).pathname
    const livrareReala = env.LIVRARE_REALA === 'da'

    if (req.method !== 'POST') return json({ eroare: 'doar POST' }, 405)

    try {
      // ------------------------------------------------------------ campanii pe audienta
      if (cale === '/cerere') {
        const date = CerereComunicare.parse(await req.json())
        const existent = await unul<{ id: string }>(env.DB, `SELECT id FROM requests WHERE idempotency_key = ?`, [date.idempotencyKey])
        if (existent) return json({ ok: true, requestId: existent.id, reluat: true })

        const requestId = id()
        await ruleaza(
          env.DB,
          `INSERT INTO requests (id, audience_id, template_id, channel, idempotency_key, correlation_id, created_at, sursa)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'automatizare')`,
          [requestId, date.audienceId, date.templateId, date.channel, date.idempotencyKey, date.correlationId, acum()],
        )
        const model = await sablon(env.DB, date.templateId, date.channel)
        if (!model) return json({ ok: false, motiv: 'sablon inexistent', requestId }, 400)
        if (date.channel !== 'email') return json({ ok: false, motiv: 'canalul whatsapp nu are inca adaptor', requestId }, 501)

        const postas = alegePostasul(env, livrareReala, (m) => log.warn(m))
        const lista = await destinatari(env.DB, date.audienceId, date.channel)
        let inregistrate = 0
        let suprimate = 0
        for (const d of lista) {
          if (d.opted_out === 1) {
            await ruleaza(env.DB, `INSERT INTO deliveries (id, request_id, channel, recipient, status, provider, created_at, user_id) VALUES (?, ?, 'email', ?, 'suppressed', ?, ?, ?)`, [id(), requestId, d.adresa, postas.nume, acum(), d.user_id])
            suprimate++
            continue
          }
          const corp = completeaza(model.body, date.variables)
          const rezultat = await postas.trimite({
            catre: d.adresa,
            subiect: model.subject ? completeaza(model.subject, date.variables) : '(fără subiect)',
            text: corp,
            correlationId: date.correlationId,
          })
          await ruleaza(env.DB, `INSERT INTO deliveries (id, request_id, channel, recipient, status, provider, created_at, user_id, detaliu) VALUES (?, ?, 'email', ?, ?, ?, ?, ?, ?)`, [id(), requestId, d.adresa, rezultat.stare, postas.nume, acum(), d.user_id, rezultat.detaliu.slice(0, 300)])
          inregistrate++
        }
        log.info('cerere de comunicare procesata', { requestId, inregistrate, suprimate, adaptor: postas.nume })
        return json({ ok: true, requestId, inregistrate, suprimate, adaptor: postas.nume })
      }

      // ------------------------------------------------------------ scrisoare compusa de o aplicatie
      if (cale === '/trimite') {
        const date = CerereTrimitere.parse(await req.json())
        const existent = await unul<{ id: string }>(env.DB, `SELECT id FROM requests WHERE idempotency_key = ?`, [date.idempotencyKey])
        if (existent) return json({ ok: true, requestId: existent.id, reluat: true })

        const requestId = id()
        await ruleaza(
          env.DB,
          `INSERT INTO requests (id, audience_id, template_id, channel, idempotency_key, correlation_id, created_at, sursa, subject, body_html, test, meta_json)
           VALUES (?, ?, ?, 'email', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [requestId, `direct:${date.sursa}`, date.sursa, date.idempotencyKey, date.correlationId, acum(), date.sursa, date.subiect, date.html, date.test ? 1 : 0, JSON.stringify(date.meta)],
        )
        const postas = alegePostasul(env, livrareReala, (m) => log.warn(m))
        const text = date.text ?? textDinHtml(date.html)
        const livrari: Array<{ userId: string | null; adresa: string; stare: string }> = []
        for (const d of date.destinatari) {
          if (await eOprit(env.DB, d.userId, 'email')) {
            await ruleaza(env.DB, `INSERT INTO deliveries (id, request_id, channel, recipient, status, provider, created_at, user_id) VALUES (?, ?, 'email', ?, 'suppressed', ?, ?, ?)`, [id(), requestId, d.adresa, postas.nume, acum(), d.userId])
            livrari.push({ userId: d.userId, adresa: d.adresa, stare: 'suppressed' })
            continue
          }
          const rezultat = await postas.trimite({ catre: d.adresa, subiect: date.subiect, text, html: date.html, raspundeLa: date.raspundeLa, correlationId: date.correlationId })
          await ruleaza(env.DB, `INSERT INTO deliveries (id, request_id, channel, recipient, status, provider, created_at, user_id, detaliu) VALUES (?, ?, 'email', ?, ?, ?, ?, ?, ?)`, [id(), requestId, d.adresa, rezultat.stare, postas.nume, acum(), d.userId, rezultat.detaliu.slice(0, 300)])
          livrari.push({ userId: d.userId, adresa: d.adresa, stare: rezultat.stare })
        }
        log.info('scrisoare trimisa', { requestId, sursa: date.sursa, destinatari: livrari.length, adaptor: postas.nume })
        return json({ ok: true, requestId, adaptor: postas.nume, livrari })
      }

      // ------------------------------------------------------------ audiente (abonari)
      if (cale === '/audiente/inscrie') {
        const date = z
          .object({ audienceId: z.string().regex(/^[a-z0-9-]+$/), nume: z.string().min(1).max(120).optional(), userId: z.string().min(1), channel: z.enum(['email', 'whatsapp']).default('email'), adresa: z.string().min(3) })
          .parse(await req.json())
        await ruleaza(env.DB, `INSERT OR IGNORE INTO audiences (id, nume, descriere, created_at) VALUES (?, ?, NULL, ?)`, [date.audienceId, date.nume ?? date.audienceId, acum()])
        await ruleaza(
          env.DB,
          `INSERT INTO audience_members (audience_id, user_id, channel, adresa, created_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (audience_id, user_id, channel) DO UPDATE SET adresa = excluded.adresa`,
          [date.audienceId, date.userId, date.channel, date.adresa, acum()],
        )
        await ruleaza(env.DB, `INSERT INTO preferences (user_id, channel, opted_out, updated_at) VALUES (?, ?, 0, ?) ON CONFLICT (user_id, channel) DO UPDATE SET opted_out = 0, updated_at = excluded.updated_at`, [date.userId, date.channel, acum()])
        return json({ ok: true })
      }

      if (cale === '/audiente/scoate') {
        const date = z.object({ audienceId: z.string().min(1), userId: z.string().min(1), channel: z.enum(['email', 'whatsapp']).default('email') }).parse(await req.json())
        await ruleaza(env.DB, `DELETE FROM audience_members WHERE audience_id = ? AND user_id = ? AND channel = ?`, [date.audienceId, date.userId, date.channel])
        return json({ ok: true })
      }

      if (cale === '/audiente/membri') {
        const date = z.object({ audienceId: z.string().min(1), userId: z.string().min(1).optional() }).parse(await req.json())
        const membri = date.userId
          ? await toate(env.DB, `SELECT user_id, channel, adresa, created_at FROM audience_members WHERE audience_id = ? AND user_id = ?`, [date.audienceId, date.userId])
          : await toate(env.DB, `SELECT user_id, channel, adresa, created_at FROM audience_members WHERE audience_id = ? ORDER BY created_at DESC`, [date.audienceId])
        return json({ membri })
      }

      // ------------------------------------------------------------ arhiva
      if (cale === '/istoric') {
        const date = z.object({ sursa: z.string().min(1), limita: z.number().int().min(1).max(200).default(50), id: z.string().optional() }).parse(await req.json())
        if (date.id) {
          const cerere = await unul(env.DB, `SELECT id, sursa, subject, body_html, test, meta_json, created_at FROM requests WHERE id = ? AND sursa = ?`, [date.id, date.sursa])
          if (!cerere) return json({ eroare: 'inexistent' }, 404)
          const livrari = await toate(env.DB, `SELECT user_id, recipient, status, provider, detaliu, created_at FROM deliveries WHERE request_id = ? ORDER BY created_at`, [date.id])
          return json({ cerere, livrari })
        }
        const cereri = await toate(
          env.DB,
          `SELECT r.id, r.subject, r.test, r.meta_json, r.created_at,
                  (SELECT count(*) FROM deliveries d WHERE d.request_id = r.id) AS destinatari,
                  (SELECT count(*) FROM deliveries d WHERE d.request_id = r.id AND d.status = 'failed') AS esuate
           FROM requests r WHERE r.sursa = ? ORDER BY r.created_at DESC LIMIT ?`,
          [date.sursa, date.limita],
        )
        return json({ cereri })
      }

      if (cale === '/livrari') {
        const date = z.object({ limita: z.number().int().min(1).max(200).default(50) }).parse(await req.json().catch(() => ({})))
        const randuri = await toate(
          env.DB,
          `SELECT d.channel, d.recipient, d.status, d.provider, d.created_at, r.template_id
           FROM deliveries d JOIN requests r ON r.id = d.request_id ORDER BY d.created_at DESC LIMIT ?`,
          [date.limita],
        )
        return json({ livrari: randuri })
      }

      // ------------------------------------------------------------ Dispeceratul: trimitere pe audienta
      /**
       * Scrisoare compusa de OM, in Dispecerat, catre o audienta intreaga. Deosebirea fata de
       * `/cerere` e ca nu cere sablon: textul vine din pagina. Deosebirea fata de `/trimite` e ca
       * destinatarii nu se numesc, ci se afla din audienta.
       *
       * ⚠️ Pe WhatsApp nu pleaca nimic de aici: mesajele intra in coada, iar pullerul de pe NAS le ia.
       */
      if (cale === '/trimite-audienta') {
        const date = z
          .object({
            audienceId: z.string().min(1),
            channel: z.enum(['email', 'whatsapp']),
            subiect: z.string().max(300).default(''),
            text: z.string().min(1),
            sursa: z.string().min(1).max(40).default('dispecerat'),
            idempotencyKey: z.string().min(1),
            correlationId: z.string().min(1),
          })
          .parse(await req.json())

        const existent = await unul<{ id: string }>(env.DB, `SELECT id FROM requests WHERE idempotency_key = ?`, [date.idempotencyKey])
        if (existent) return json({ ok: true, requestId: existent.id, reluat: true })

        const requestId = id()
        await ruleaza(
          env.DB,
          `INSERT INTO requests (id, audience_id, template_id, channel, idempotency_key, correlation_id, created_at, sursa, subject, body_html)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [requestId, date.audienceId, `direct:${date.sursa}`, date.channel, date.idempotencyKey, date.correlationId, acum(), date.sursa, date.subiect, date.text],
        )

        const lista = await destinatari(env.DB, date.audienceId, date.channel)
        let plecate = 0
        let asteapta = 0
        let suprimate = 0
        const postas = date.channel === 'email' ? alegePostasul(env, livrareReala, (m) => log.warn(m)) : null

        for (const d of lista) {
          if (d.opted_out === 1) {
            await ruleaza(env.DB, `INSERT INTO deliveries (id, request_id, channel, recipient, status, provider, created_at, user_id) VALUES (?, ?, ?, ?, 'suppressed', ?, ?, ?)`, [id(), requestId, date.channel, d.adresa, postas?.nume ?? 'whatsapp-puller', acum(), d.user_id])
            suprimate++
            continue
          }
          if (date.channel === 'whatsapp') {
            // Intra in coada. Cine chiar trimite e pullerul din casa, nu workerul asta.
            await ruleaza(env.DB, `INSERT INTO deliveries (id, request_id, channel, recipient, status, provider, created_at, user_id, corp) VALUES (?, ?, 'whatsapp', ?, 'in_asteptare', 'whatsapp-puller', ?, ?, ?)`, [id(), requestId, d.adresa, acum(), d.user_id, date.text])
            asteapta++
            continue
          }
          const rezultat = await postas!.trimite({ catre: d.adresa, subiect: date.subiect || '(fără subiect)', text: date.text, correlationId: date.correlationId })
          await ruleaza(env.DB, `INSERT INTO deliveries (id, request_id, channel, recipient, status, provider, created_at, user_id, detaliu) VALUES (?, ?, 'email', ?, ?, ?, ?, ?, ?)`, [id(), requestId, d.adresa, rezultat.stare, postas!.nume, acum(), d.user_id, rezultat.detaliu.slice(0, 300)])
          plecate++
        }
        log.info('dispecerat: trimitere pe audienta', { requestId, canal: date.channel, plecate, asteapta, suprimate })
        return json({ ok: true, requestId, plecate, asteapta, suprimate, adaptor: postas?.nume ?? 'whatsapp-puller' })
      }

      // ------------------------------------------------------------ coada WhatsApp (pullerul de pe NAS)
      if (cale === '/coada') {
        const date = z.object({ channel: z.enum(['whatsapp']).default('whatsapp'), limita: z.number().int().min(1).max(50).default(20) }).parse(await req.json().catch(() => ({})))
        const randuri = await toate<{ id: string; recipient: string; corp: string | null }>(
          env.DB,
          `SELECT id, recipient, corp FROM deliveries WHERE channel = ? AND status = 'in_asteptare' ORDER BY created_at LIMIT ?`,
          [date.channel, date.limita],
        )
        for (const r of randuri) {
          await ruleaza(env.DB, `UPDATE deliveries SET status = 'in_lucru', luat_la = ?, incercari = incercari + 1 WHERE id = ?`, [acum(), r.id])
        }
        return json({ mesaje: randuri.map((r) => ({ id: r.id, catre: r.recipient, text: r.corp ?? '' })) })
      }

      if (cale === '/livrat') {
        const date = z.object({ id: z.string().min(1), stare: z.enum(['sent', 'failed']), detaliu: z.string().max(300).default('') }).parse(await req.json())
        await ruleaza(env.DB, `UPDATE deliveries SET status = ?, detaliu = ?, livrat_la = ? WHERE id = ?`, [date.stare, date.detaliu, acum(), date.id])
        return json({ ok: true })
      }

      // ------------------------------------------------------------ starea dispeceratului
      if (cale === '/stare') {
        const audiente = await toate(
          env.DB,
          `SELECT a.id, a.nume,
                  (SELECT count(*) FROM audience_members m WHERE m.audience_id = a.id AND m.channel = 'email') AS email,
                  (SELECT count(*) FROM audience_members m WHERE m.audience_id = a.id AND m.channel = 'whatsapp') AS whatsapp
           FROM audiences a ORDER BY a.nume`,
        )
        const coada = await unul<{ n: number }>(env.DB, `SELECT count(*) AS n FROM deliveries WHERE channel = 'whatsapp' AND status IN ('in_asteptare','in_lucru')`)
        const ultimaLuare = await unul<{ luat_la: string | null }>(env.DB, `SELECT luat_la FROM deliveries WHERE luat_la IS NOT NULL ORDER BY luat_la DESC LIMIT 1`)
        return json({
          livrareReala,
          audiente,
          coadaWhatsapp: coada?.n ?? 0,
          ultimaLuareDePuller: ultimaLuare?.luat_la ?? null,
        })
      }

      /*
       * Ce si-a ales omul, ca sa-i putem ARATA starea inainte s-o schimbe (15.09.2026, pentru
       * pagina de Setari). Pana acum preferinta se putea numai scrie — deci nicaieri in platforma
       * nu se vedea daca omul si-a oprit scrisorile sau nu.
       * Lipsa randului inseamna „primeste": asa scrie si `/trimite-audienta`, care suprima doar pe
       * `opted_out = 1`. Nu intoarce `null` — ar fi pus pagina sa ghiceasca.
       */
      if (cale === '/preferinte/citeste') {
        const date = z.object({ userId: z.string().min(1), channel: z.enum(['email', 'whatsapp']).default('email') }).parse(await req.json())
        const rand = await unul<{ opted_out: number }>(env.DB, `SELECT opted_out FROM preferences WHERE user_id = ? AND channel = ?`, [date.userId, date.channel])
        return json({ optedOut: rand ? rand.opted_out === 1 : false })
      }

      if (cale === '/preferinte') {
        const date = z.object({ userId: z.string().min(1), channel: z.enum(['email', 'whatsapp']), optedOut: z.boolean() }).parse(await req.json())
        await ruleaza(
          env.DB,
          `INSERT INTO preferences (user_id, channel, opted_out, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (user_id, channel) DO UPDATE SET opted_out = excluded.opted_out, updated_at = excluded.updated_at`,
          [date.userId, date.channel, date.optedOut ? 1 : 0, acum()],
        )
        return json({ ok: true })
      }

      return json({ eroare: 'ruta necunoscuta' }, 404)
    } catch (e) {
      if (e instanceof z.ZodError) return json({ eroare: 'date invalide', detalii: e.issues.map((i) => i.message) }, 400)
      log.error('eroare neasteptata', { eroare: e instanceof Error ? e.message : String(e) })
      return json({ eroare: 'eroare interna' }, 500)
    }
  },
}
