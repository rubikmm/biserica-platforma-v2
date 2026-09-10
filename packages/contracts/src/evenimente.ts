import { z } from 'zod'

/** Tipurile de evenimente publicate in aceasta faza. Versionate explicit, cu `.vN` in nume. */
export const TIPURI_EVENIMENTE = [
  'program.event.created.v1',
  'program.event.updated.v1',
  'program.event.published.v1',
  'user.notification_preferences_changed.v1',
  'communication.delivery.requested.v1',
  'automation.action.proposed.v1',
  'automation.action.approved.v1',
] as const

export const TipEveniment = z.enum(TIPURI_EVENIMENTE)
export type TipEveniment = z.infer<typeof TipEveniment>

export const Actor = z.object({
  type: z.enum(['user', 'system', 'ai']),
  id: z.string().min(1).optional(),
})
export type Actor = z.infer<typeof Actor>

/**
 * Envelope-ul standard. Orice mesaj care trece prin coada are forma asta; `payload` se
 * valideaza separat, cu schema tipului respectiv (vezi `schemaPayload`).
 */
export const Envelope = z.object({
  id: z.uuid(),
  type: TipEveniment,
  occurredAt: z.iso.datetime(),
  producer: z.string().min(1),
  actor: Actor,
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1).optional(),
  payload: z.unknown(),
})
export type Envelope = z.infer<typeof Envelope>

// ---------------------------------------------------------------------------
// Payload-urile, per tip de eveniment
// ---------------------------------------------------------------------------

export const PayloadEvenimentProgram = z.object({
  eventId: z.string().min(1),
  title: z.string().min(1),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  status: z.enum(['draft', 'published', 'archived']),
})

export const PayloadPreferinteNotificare = z.object({
  userId: z.string().min(1),
  channels: z.array(z.enum(['email', 'whatsapp'])),
  optedOut: z.boolean(),
})

export const PayloadCerereLivrare = z.object({
  requestId: z.string().min(1),
  audienceId: z.string().min(1),
  templateId: z.string().min(1),
  channel: z.enum(['email', 'whatsapp']),
  variables: z.record(z.string(), z.string()).default({}),
})

export const PayloadActiuneAutomata = z.object({
  actionId: z.string().min(1),
  ruleId: z.string().min(1),
  kind: z.string().min(1),
  risk: z.enum(['low', 'high']),
  input: z.record(z.string(), z.unknown()).default({}),
})

const SCHEME_PAYLOAD = {
  'program.event.created.v1': PayloadEvenimentProgram,
  'program.event.updated.v1': PayloadEvenimentProgram,
  'program.event.published.v1': PayloadEvenimentProgram,
  'user.notification_preferences_changed.v1': PayloadPreferinteNotificare,
  'communication.delivery.requested.v1': PayloadCerereLivrare,
  'automation.action.proposed.v1': PayloadActiuneAutomata,
  'automation.action.approved.v1': PayloadActiuneAutomata,
} as const satisfies Record<TipEveniment, z.ZodType>

export function schemaPayload(tip: TipEveniment): z.ZodType {
  return SCHEME_PAYLOAD[tip]
}

/** Valideaza envelope + payload deodata. Arunca daca nu se potrivesc — consumatorii nu vad `any`. */
export function parseEveniment(brut: unknown): Envelope {
  const env = Envelope.parse(brut)
  schemaPayload(env.type).parse(env.payload)
  return env
}
