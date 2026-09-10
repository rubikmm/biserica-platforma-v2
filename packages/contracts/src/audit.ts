import { z } from 'zod'
import { Actor } from './evenimente.js'

/**
 * O intrare de audit. Append-only: `audit-worker` nu expune update sau delete.
 * Regula de continut: NICIODATA parole, token-uri, cookie-uri sau corpuri complete de mesaj.
 */
export const IntrareAudit = z.object({
  action: z.string().min(1),
  target: z.string().min(1),
  scope: z.string().min(1),
  actor: Actor,
  outcome: z.enum(['success', 'failure', 'denied']),
  correlationId: z.string().min(1),
  /** Rezumat redactat, nu starea bruta. Trece prin `redacteaza()` inainte de scriere. */
  summary: z.record(z.string(), z.unknown()).default({}),
  occurredAt: z.iso.datetime().optional(),
})
export type IntrareAudit = z.infer<typeof IntrareAudit>

const CHEI_INTERZISE = [
  'password',
  'parola',
  'token',
  'cookie',
  'secret',
  'authorization',
  'passwordhash',
  'password_hash',
  'body',
  'content',
]

/**
 * Taie din obiect cheile sensibile, recursiv, inainte ca el sa ajunga in audit sau in log.
 * Valorile lungi se trunchiaza — auditul e pentru „ce s-a intamplat", nu pentru continut.
 */
export function redacteaza(valoare: unknown, adancime = 0): unknown {
  if (adancime > 6) return '[prea adanc]'
  if (valoare === null || valoare === undefined) return valoare
  if (typeof valoare === 'string') {
    return valoare.length > 200 ? `${valoare.slice(0, 200)}…[${valoare.length}]` : valoare
  }
  if (typeof valoare === 'number' || typeof valoare === 'boolean') return valoare
  if (Array.isArray(valoare)) {
    return valoare.slice(0, 20).map((v) => redacteaza(v, adancime + 1))
  }
  if (typeof valoare === 'object') {
    const iesire: Record<string, unknown> = {}
    for (const [cheie, val] of Object.entries(valoare as Record<string, unknown>)) {
      if (CHEI_INTERZISE.includes(cheie.toLowerCase())) {
        iesire[cheie] = '[redactat]'
        continue
      }
      iesire[cheie] = redacteaza(val, adancime + 1)
    }
    return iesire
  }
  return '[netransmisibil]'
}
