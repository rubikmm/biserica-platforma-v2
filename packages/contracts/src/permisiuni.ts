import { z } from 'zod'

/**
 * Cheile de permisiuni ale platformei. Adaugarea unei chei noi se face AICI, o singura data;
 * aplicatiile nu inventeaza chei proprii si nu verifica niciodata `rol === 'admin'`.
 */
export const CHEI_PERMISIUNI = [
  'identity.manage',
  'roles.manage',
  'calendar.read',
  'calendar.write',
  'calendar.publish',
  'bulletin.write',
  'bulletin.publish',
  'cleaning.manage',
  'communication.create',
  'communication.send',
  'automation.manage',
  'audit.read',
] as const

export const Permisiune = z.enum(CHEI_PERMISIUNI)
export type Permisiune = z.infer<typeof Permisiune>

export const ROLURI = ['user', 'admin', 'super-admin'] as const
export const Rol = z.enum(ROLURI)
export type Rol = z.infer<typeof Rol>

/**
 * Scope-ul unei atribuiri de rol. `global` acopera tot; celelalte sunt legate de o resursa.
 * Forma textuala (cea stocata in D1 si vehiculata pe fir): `global`, `parish:<id>`, `team:<id>`,
 * `audience:<id>`.
 */
export const Scope = z
  .string()
  .regex(
    /^(global|parish:[a-z0-9-]+|team:[a-z0-9-]+|audience:[a-z0-9-]+)$/,
    'scope invalid: astept `global`, `parish:<id>`, `team:<id>` sau `audience:<id>`',
  )
export type Scope = z.infer<typeof Scope>

export const SCOPE_GLOBAL = 'global' satisfies Scope

/**
 * Ce poate fiecare rol, implicit. Atribuirile individuale de permisiuni (grant direct pe user)
 * se adauga peste, in `authorization-worker`.
 */
export const PERMISIUNI_IMPLICITE: Record<Rol, readonly Permisiune[]> = {
  user: ['calendar.read'],
  admin: [
    'calendar.read',
    'calendar.write',
    'calendar.publish',
    'bulletin.write',
    'bulletin.publish',
    'cleaning.manage',
    'communication.create',
    'automation.manage',
    'audit.read',
  ],
  'super-admin': [...CHEI_PERMISIUNI],
}

/** Principalul care cere o decizie de autorizare. */
export const Principal = z.object({
  userId: z.string().min(1),
  email: z.email(),
})
export type Principal = z.infer<typeof Principal>

export const CerereAutorizare = z.object({
  principal: Principal,
  permission: Permisiune,
  resourceScope: Scope,
  correlationId: z.string().min(1),
})
export type CerereAutorizare = z.infer<typeof CerereAutorizare>

export const Decizie = z.object({
  allowed: z.boolean(),
  /** De ce a iesit asa — se scrie in audit, nu se arata utilizatorului final. */
  reason: z.string(),
  /** Scope-urile prin care s-a acordat, pentru trasabilitate. */
  matchedScopes: z.array(Scope).default([]),
})
export type Decizie = z.infer<typeof Decizie>

/**
 * Un scope satisface cererea daca e identic sau daca e `global`.
 * Ierarhii mai adanci (parohie -> echipa) se adauga aici, intr-un singur loc.
 */
export function scopeAcopera(scopeDetinut: string, scopeCerut: string): boolean {
  if (scopeDetinut === SCOPE_GLOBAL) return true
  return scopeDetinut === scopeCerut
}
