import { z } from 'zod'

export const Canal = z.enum(['email', 'whatsapp'])
export type Canal = z.infer<typeof Canal>

export const Sablon = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  channel: Canal,
  subject: z.string().min(1).nullable(),
  body: z.string().min(1),
})
export type Sablon = z.infer<typeof Sablon>

export const CerereComunicare = z.object({
  audienceId: z.string().min(1),
  templateId: z.string().min(1),
  channel: Canal,
  variables: z.record(z.string(), z.string()).default({}),
  idempotencyKey: z.string().min(1),
  correlationId: z.string().min(1),
})
export type CerereComunicare = z.infer<typeof CerereComunicare>

/**
 * Rezultatul unei incercari de livrare. In faza asta `provider` e mereu un adaptor sandbox,
 * iar `status` nu poate fi `sent` decat daca un adaptor real a fost activat explicit.
 */
export const InregistrareLivrare = z.object({
  id: z.string().min(1),
  requestId: z.string().min(1),
  channel: Canal,
  recipient: z.string().min(1),
  status: z.enum(['recorded', 'simulated', 'sent', 'failed', 'suppressed']),
  provider: z.string().min(1),
  createdAt: z.iso.datetime(),
})
export type InregistrareLivrare = z.infer<typeof InregistrareLivrare>

/** Mesajul pe care un adaptor de canal il primeste. Adaptorul nu vede niciodata secretele contului. */
export const MesajDeLivrat = z.object({
  channel: Canal,
  recipient: z.string().min(1),
  subject: z.string().nullable(),
  body: z.string().min(1),
  correlationId: z.string().min(1),
})
export type MesajDeLivrat = z.infer<typeof MesajDeLivrat>
