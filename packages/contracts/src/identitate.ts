import { z } from 'zod'
import { Rol, Scope } from './permisiuni.js'

/** Emailul e identificatorul principal. Normalizarea (trim + lowercase) e obligatorie la intrare. */
export const Email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('adresa de email nu pare valida'))

export const Parola = z
  .string()
  .min(12, 'parola trebuie sa aiba cel putin 12 caractere')
  .max(200, 'parola e prea lunga')

export const Utilizator = z.object({
  id: z.string().min(1),
  email: Email,
  displayName: z.string().min(1).nullable(),
  emailVerifiedAt: z.iso.datetime().nullable(),
  disabledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
})
export type Utilizator = z.infer<typeof Utilizator>

export const AtribuireRol = z.object({
  role: Rol,
  scope: Scope,
})
export type AtribuireRol = z.infer<typeof AtribuireRol>

/** Ce primeste o aplicatie cand intreaba „cine e pe sesiunea asta?". Fara PII in plus. */
export const SesiuneCurenta = z.object({
  authenticated: z.boolean(),
  user: Utilizator.nullable(),
  roles: z.array(AtribuireRol).default([]),
  sessionId: z.string().nullable(),
  expiresAt: z.iso.datetime().nullable(),
})
export type SesiuneCurenta = z.infer<typeof SesiuneCurenta>

export const SESIUNE_ANONIMA: SesiuneCurenta = {
  authenticated: false,
  user: null,
  roles: [],
  sessionId: null,
  expiresAt: null,
}

// ---------------------------------------------------------------------------
// Cereri catre identity-worker
// ---------------------------------------------------------------------------

export const CerereInregistrare = z.object({
  email: Email,
  password: Parola,
  displayName: z.string().trim().min(1).max(120).optional(),
})
export type CerereInregistrare = z.infer<typeof CerereInregistrare>

export const CerereLogin = z.object({
  email: Email,
  password: z.string().min(1),
})
export type CerereLogin = z.infer<typeof CerereLogin>

/**
 * Rezultatul pasului 1 din login. Niciodata nu spune daca emailul exista sau daca parola
 * a fost gresita — raspunsul e identic in ambele cazuri (anti-enumerare).
 */
export const RezultatPasul1 = z.object({
  /** Mereu true catre browser; ce s-a intamplat in spate se vede doar in audit. */
  challengeSent: z.boolean(),
  /** Doar in dev/sandbox: linkul care ar fi plecat pe email, ca sa poti testa fara SMTP. */
  debugLink: z.string().nullable().optional(),
})
export type RezultatPasul1 = z.infer<typeof RezultatPasul1>

export const SCOP_TOKEN = ['login_challenge', 'email_verification'] as const
export const ScopToken = z.enum(SCOP_TOKEN)
export type ScopToken = z.infer<typeof ScopToken>
