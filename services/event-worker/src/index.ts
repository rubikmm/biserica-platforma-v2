import { parseEveniment, type Envelope } from '@xc/contracts'
import { marcheazaProcesat } from '@xc/events'
import { Logger } from '@xc/observability'

export interface Env {
  DB: D1Database
  AUTOMATIZARE: Fetcher
  MEDIU: string
}

const CONSUMATOR = 'event-worker'

/**
 * Coada livreaza „cel putin o data", deci fiecare mesaj poate veni de mai multe ori si in
 * alta ordine. Doua garduri: validarea envelope-ului si marcajul de idempotenta per consumator.
 */
async function proceseaza(env: Env, envelope: Envelope, log: Logger): Promise<void> {
  const eNou = await marcheazaProcesat(env.DB, envelope.id, CONSUMATOR)
  if (!eNou) {
    log.info('eveniment deja procesat, ignorat', { eventId: envelope.id, tip: envelope.type })
    return
  }

  const raspuns = await env.AUTOMATIZARE.fetch('https://automation.intern/eveniment', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(envelope),
  })

  if (!raspuns.ok) {
    // Aruncam ca mesajul sa fie reincercat de coada; marcajul se pune abia dupa succes.
    throw new Error(`automation-worker a raspuns ${raspuns.status}`)
  }
}

export default {
  async queue(lot: MessageBatch<unknown>, env: Env): Promise<void> {
    for (const mesaj of lot.messages) {
      const log = new Logger({
        service: 'event-worker',
        correlationId: 'coada',
      })

      let envelope: Envelope
      try {
        envelope = parseEveniment(mesaj.body)
      } catch (e) {
        // Un mesaj care nu trece de contract nu devine valid prin reincercare: il trimitem
        // direct in DLQ, cu motivul in log.
        log.error('envelope invalid, trimis in DLQ', {
          eroare: e instanceof Error ? e.message : String(e),
        })
        mesaj.ack()
        continue
      }

      const logCorelat = log.cu({ correlationId: envelope.correlationId })

      try {
        await proceseaza(env, envelope, logCorelat)
        mesaj.ack()
      } catch (e) {
        logCorelat.warn('procesare esuata, se reincearca', {
          eventId: envelope.id,
          eroare: e instanceof Error ? e.message : String(e),
        })
        mesaj.retry()
      }
    }
  },

  async fetch(): Promise<Response> {
    return new Response('event-worker: consumator de coada, fara rute HTTP', { status: 404 })
  },
}
