import { z } from 'zod'

/**
 * Cheile de permisiuni ale platformei. Adaugarea unei chei noi se face AICI, o singura data;
 * aplicatiile nu inventeaza chei proprii si nu verifica niciodata `rol === 'admin'`.
 */
export const CHEI_PERMISIUNI = [
  'identity.manage',
  'roles.manage',
  'calendar.manage',
  'program.read',
  'program.write',
  'program.publish',
  'bulletin.write',
  'bulletin.publish',
  'cleaning.manage',
  // Biblioteca (A12 din V1): pangarul tine ecranul de la Hanul Coltei — pregateste cartea ceruta,
  // o da, o primeste inapoi. A doua cheie e dreptul OMULUI de a cere carti: se da individual, la
  // cont, si NU vine cu rolul, ca in V1 (acolo era dreptul „imprumut", pus de mana de un admin
  // dupa ce pangarul vedea cererea — vezi tabelul cererilor de acces al Bibliotecii).
  'library.manage',
  'library.borrow',
  /*
   * Emisia parohiei — LIVE-ul din biserica si radioul. O SINGURA cheie pentru amandoua
   * aplicatiile (`live` si `radio`), fiindca panoul e unul singur si comanda un singur aparat:
   * cine poate porni directul poate schimba si muzica. In V1 poarta era rolul `admin` verificat
   * local, cu parola aplicatiei; aici o hotaraste autorizarea centrala, ca peste tot.
   */
  'broadcast.manage',
  'communication.create',
  'communication.send',
  // Abonatii unei aplicatii: cine ii VEDE si cine poate scoate pe cineva din lista. Adaugarea NU
  // trece pe aici — ea ramane gestul omului, cu bifa termenilor si cu contul lui (user, 15.09.2026:
  // adminul „vede si scoate din lista"). Cheia e a administratorului aplicatiei, nu a oricui.
  'audience.manage',
  'automation.manage',
  /*
   * ⚠️ `audit.read` NU mai vine cu rolul de administrator din 15.09.2026 (user: „scot audit.read de
   * la administrator"). Jurnalul — cine ce a facut — ramane al super-adminului: asta a fost cererea
   * pentru zona de loguri din Setari, iar o cheie care se da si adminului n-ar mai fi inchis nimic.
   * ⚠️ Consecinta platita odata cu ea: pagina de pornire a Administrarii se sprijinea pe cheia asta,
   * deci un administrator ar fi luat 403 pe TOT panoul. De aceea poarta panoului s-a mutat pe
   * cheile fiecarei sectiuni (`apps/admin/src/index.ts`) — nu o lega la loc de `audit.read`.
   */
  'audit.read',
  // Aprinderea si stingerea modulelor (chatul, deocamdata). NU e a adminului: un modul pornit
  // costa bani la fiecare apasare, deci ramane la super-admin (11.09.2026).
  'modules.manage',
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
  user: ['program.read'],
  admin: [
    'calendar.manage',
    'program.read',
    'program.write',
    'program.publish',
    'bulletin.write',
    'bulletin.publish',
    'cleaning.manage',
    'library.manage',
    // Parintele comanda emisia din panou — in V1 `/control` cerea chiar rolul `admin`.
    'broadcast.manage',
    'communication.create',
    // Adminul vede abonatii aplicatiei lui si poate scoate pe cineva din lista (user, 15.09.2026).
    'audience.manage',
    'automation.manage',
    // ⚠️ `audit.read` A IESIT de aici pe 15.09.2026 — vezi lamurirea de la cheia ei. Jurnalul e al
    // super-adminului; nu o pune inapoi fara sa-l intrebi pe user.
  ],
  'super-admin': [...CHEI_PERMISIUNI],
}

// ---------------------------------------------------------------------------
// „Vezi ca" — pielea imprumutata
// ---------------------------------------------------------------------------

/**
 * Masca sub care un super-admin se uita la platforma cu ochii altui rol (adusa din V1,
 * cerere user 10.09.2026). NU e un rol: rolul adevarat din `role_assignments` ramane neatins.
 * Masca sta pe SESIUNE, la identitate, si coboara si ce vezi, si ce poti face — decizia o ia
 * tot autorizarea centrala (user, 10.09.2026), altfel previzualizarea ar fi doar un desen.
 */
export const MASTI = ['user', 'admin', 'anonim'] as const
export const Masca = z.enum(MASTI)
export type Masca = z.infer<typeof Masca>

/** Numele mastii pentru om, in romana — pentru meniu si pentru banda de jos. */
export function numeMasca(m: Masca): string {
  return m === 'anonim' ? 'neautentificat' : m === 'admin' ? 'administrator' : 'utilizator'
}

/** Treapta rolului. O masca se imprumuta doar SUB treapta ta; `anonim` e sub oricare. */
export const NIVEL_ROL: Record<Rol, number> = { user: 1, admin: 2, 'super-admin': 3 }

export function nivelMasca(m: Masca): number {
  return m === 'anonim' ? 0 : NIVEL_ROL[m]
}

/** Cea mai inalta treapta pe care o are omul, dupa atribuirile lui. */
export function treaptaCeaMaiInalta(roluri: readonly { role: Rol }[]): number {
  return roluri.reduce((max, r) => Math.max(max, NIVEL_ROL[r.role]), 0)
}

/** Principalul care cere o decizie de autorizare. */
export const Principal = z.object({
  userId: z.string().min(1),
  email: z.email(),
  /**
   * Masca purtata pe sesiune, daca exista. Autorizarea decide sub ea, nu sub rolurile reale:
   * un super-admin mascat ca `user` primeste exact refuzurile unui utilizator obisnuit.
   */
  veziCa: Masca.optional(),
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
