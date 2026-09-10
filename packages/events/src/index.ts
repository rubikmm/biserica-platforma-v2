import { type Envelope, type TipEveniment, type Actor, parseEveniment } from '@xc/contracts'
import { acum, id, toate, ruleaza } from '@xc/db'

export const SQL_OUTBOX = `
CREATE TABLE IF NOT EXISTS outbox (
  id             TEXT PRIMARY KEY,
  type           TEXT NOT NULL,
  envelope_json  TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  published_at   TEXT,
  attempts       INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_nepublicat ON outbox (published_at, created_at);
`

export interface OptiuniEveniment {
  type: TipEveniment
  producer: string
  actor: Actor
  correlationId: string
  idempotencyKey?: string
  payload: unknown
}

export function construiesteEnvelope(o: OptiuniEveniment): Envelope {
  const env: Envelope = {
    id: id(),
    type: o.type,
    occurredAt: acum(),
    producer: o.producer,
    actor: o.actor,
    correlationId: o.correlationId,
    ...(o.idempotencyKey ? { idempotencyKey: o.idempotencyKey } : {}),
    payload: o.payload,
  }
  // Validam la producere, nu doar la consum: un eveniment stricat nu ajunge in outbox.
  return parseEveniment(env)
}

/**
 * Declaratia de insert in outbox. NU se executa singura — se da in acelasi `batch()` cu
 * mutatia de domeniu, ca ori sa existe amandoua, ori niciuna.
 */
export function declaratieOutbox(db: D1Database, env: Envelope): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO outbox (id, type, envelope_json, created_at) VALUES (?, ?, ?, ?)`,
    )
    .bind(env.id, env.type, JSON.stringify(env), env.occurredAt)
}

interface RandOutbox {
  id: string
  envelope_json: string
  attempts: number
}

/**
 * Golirea outbox-ului: se cheama dupa commit (prin `waitUntil`) SI periodic, din cron.
 * `waitUntil` singur nu e garantie — daca izolatul moare, randul ramane nepublicat si
 * il ia trecerea urmatoare.
 */
export async function golesteOutbox(
  db: D1Database,
  coada: Queue,
  limita = 50,
): Promise<{ publicate: number; esuate: number }> {
  const randuri = await toate<RandOutbox>(
    db,
    `SELECT id, envelope_json, attempts FROM outbox
     WHERE published_at IS NULL AND attempts < 10
     ORDER BY created_at LIMIT ?`,
    [limita],
  )

  let publicate = 0
  let esuate = 0

  for (const rand of randuri) {
    try {
      await coada.send(JSON.parse(rand.envelope_json))
      await ruleaza(db, `UPDATE outbox SET published_at = ? WHERE id = ?`, [acum(), rand.id])
      publicate++
    } catch (e) {
      const mesaj = e instanceof Error ? e.message : String(e)
      await ruleaza(
        db,
        `UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?`,
        [mesaj.slice(0, 500), rand.id],
      )
      esuate++
    }
  }

  return { publicate, esuate }
}

export const SQL_IDEMPOTENTA = `
CREATE TABLE IF NOT EXISTS evenimente_procesate (
  event_id     TEXT NOT NULL,
  consumer     TEXT NOT NULL,
  processed_at TEXT NOT NULL,
  PRIMARY KEY (event_id, consumer)
);
`

/**
 * Garda de idempotenta pentru consumatori. Coada livreaza „cel putin o data", deci fiecare
 * consumator trebuie sa poata primi acelasi eveniment de doua ori fara efect dublu.
 *
 * Returneaza `true` daca evenimentul e NOU pentru consumatorul asta (deci trebuie procesat).
 */
export async function marcheazaProcesat(
  db: D1Database,
  eventId: string,
  consumer: string,
): Promise<boolean> {
  const rezultat = await ruleaza(
    db,
    `INSERT OR IGNORE INTO evenimente_procesate (event_id, consumer, processed_at)
     VALUES (?, ?, ?)`,
    [eventId, consumer, acum()],
  )
  return (rezultat.meta.changes ?? 0) > 0
}
