import { z } from 'zod'
import { Rol, Scope } from './permisiuni.js'

/** Emailul e identificatorul principal. Normalizarea (trim + lowercase) e obligatorie la intrare. */
export const Email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('adresa de email nu pare valida'))

export const NumeAfisat = z.string().trim().min(1).max(120)

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

/**
 * Intrarea e FARA parola (decizie user, 10.09.2026): omul da emailul, primeste un link, il
 * deschide, si abia atunci exista sesiune. Acelasi gest naste si contul, la prima confirmare —
 * `displayName` e purtat prin jeton pana atunci. Nu exista conturi neconfirmate.
 */
export const CerereIntrare = z.object({
  email: Email,
  displayName: NumeAfisat.optional(),
})
export type CerereIntrare = z.infer<typeof CerereIntrare>

/**
 * Rezultatul cererii de intrare. Niciodata nu spune daca emailul are cont sau nu —
 * raspunsul e identic in ambele cazuri (anti-enumerare).
 */
export const RezultatIntrare = z.object({
  /** Mereu true catre browser; ce s-a intamplat in spate se vede doar in audit. */
  challengeSent: z.boolean(),
  /** Doar in dev: linkul care ar fi plecat pe email, ca sa poti testa fara livrare reala. */
  debugLink: z.string().nullable().optional(),
})
export type RezultatIntrare = z.infer<typeof RezultatIntrare>
