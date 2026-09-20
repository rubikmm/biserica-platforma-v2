import { z } from 'zod'
import { aplicatiaAdministrabila, cheileAdminului } from './admini.js'

/**
 * Cheile de permisiuni ale platformei. Adaugarea unei chei noi se face AICI, o singura data;
 * aplicatiile nu inventeaza chei proprii si nu verifica niciodata un rol anume.
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
   * Cheile de administrare ale aplicatiilor care pana pe 18.09.2026 nu aveau niciuna: ele isi
   * citeau adminul din ROLUL global (`sesiune.roles`), deci un om nu putea fi facut administrator
   * NUMAI acolo — trebuia rol de admin pe toata platforma. Utilizatorul a cerut atunci ca „toate
   * aplicatiile sa aiba capacitatea de a avea setat administratori", iar el sa-i numeasca la fiecare
   * aplicatie in parte. Vezi registrul din `admini.ts`: acolo scrie care cheie face pe cineva
   * administratorul carei aplicatii.
   */
  'newsletter.manage',
  'typicon.manage',
  'bible.manage',
  'website.manage',
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

/**
 * ROLURILE PLATFORMEI — doua, si atat (user, 19.09.2026).
 *
 * ⚠️ Rolul global `admin` S-A STINS. Modelul e acum: oricine e autentificat e UTILIZATOR;
 * „administratorul unei aplicatii" e un utilizator care tine CHEILE acelei aplicatii (registrul din
 * `admini.ts`, date prin `permission_grants`); super-adminul e admin pe toate, fiindca are toate
 * cheile. Nu mai exista „admin pe platforma" — o treapta care dadea peste tot, dar nu se putea
 * retrage de nicaieri.
 *
 * ⚠️ Consecinta pe date: randurile `role = 'admin'` ramase in `role_assignments` nu mai trec de
 * `Rol.safeParse` si sunt IGNORATE tacit de autorizare (vezi `roluri()` din authorization-worker).
 * Cine avea rolul asta ramane, practic, utilizator: ce trebuie sa pastreze i se da inapoi ca
 * numire pe aplicatie, din Setarile fiecarei aplicatii.
 */
export const ROLURI = ['user', 'super-admin'] as const
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
 *
 * ⚠️ Lista are DOUA intrari, nu trei (19.09.2026). Cheile de lucru ale aplicatiilor — `calendar.manage`,
 * `program.write`, `cleaning.manage`, `broadcast.manage`… — nu mai vin din niciun rol intermediar: ele
 * se dau OM CU OM, la aplicatia lui, din Setarile ei. Vezi `admini.ts`.
 */
export const PERMISIUNI_IMPLICITE: Record<Rol, readonly Permisiune[]> = {
  user: ['program.read'],
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
 *
 * ⚠️ MASCA DE ADMINISTRATOR E PE APLICATIE, NU PE PLATFORMA (user, 19.09.2026). Cat timp a existat
 * rolul global `admin`, masca „→ Administrator" imprumuta ACEL rol — adica o treapta care nu mai
 * exista. Acum super-adminul care alege randul din meniul unei aplicatii se uita la platforma ca un
 * UTILIZATOR care tine cheile ACELEI aplicatii: `admin:calendar`, `admin:curatenie`…
 *
 * Valorile mastii: `user` · `anonim` · `admin:<cod>`, unde `<cod>` e un cod din
 * `APLICATII_ADMINISTRABILE`. Un cod care nu e in registru NU e masca valida — altfel masca ar
 * deschide un panou fantoma.
 */
export const MASTI_SIMPLE = ['user', 'anonim'] as const
export type MascaSimpla = (typeof MASTI_SIMPLE)[number]

export const PREFIX_MASCA_ADMIN = 'admin:'

export type Masca = MascaSimpla | `admin:${string}`

/**
 * Codul aplicatiei dintr-o masca `admin:<cod>`, DACA e in registru; altfel `null`.
 * Pentru `user`/`anonim` raspunsul e tot `null` — ele nu tin de nicio aplicatie.
 */
export function codulMastii(m: string): string | null {
  if (!m.startsWith(PREFIX_MASCA_ADMIN)) return null
  return aplicatiaAdministrabila(m.slice(PREFIX_MASCA_ADMIN.length))?.cod ?? null
}

/** E `v` o masca valida? Singurul loc in care se hotaraste asta. */
export function eMasca(v: unknown): v is Masca {
  if (typeof v !== 'string') return false
  return (MASTI_SIMPLE as readonly string[]).includes(v) || codulMastii(v) !== null
}

export const Masca = z
  .string()
  .refine(eMasca, 'masca invalida: astept `user`, `anonim` sau `admin:<cod-aplicatie>`')
  .transform((v) => v as Masca)

/** Numele mastii pentru om, in romana — pentru meniu, pentru Profil si pentru Setari. */
export function numeMasca(m: Masca | string): string {
  if (m === 'anonim') return 'neautentificat'
  if (m === 'user') return 'utilizator'
  const cod = codulMastii(m)
  const app = cod ? aplicatiaAdministrabila(cod) : undefined
  return app ? `administrator al aplicației „${app.nume}"` : 'administrator'
}

/**
 * CE POATE MASCA. Nu mai e o cautare in `PERMISIUNI_IMPLICITE` (rolul `admin` a disparut de acolo):
 *  - `anonim` → nimic;
 *  - `user` → cat un utilizator obisnuit;
 *  - `admin:<cod>` → cat un utilizator PLUS cheile aplicatiei, exact cele care se dau la numire.
 *
 * ⚠️ Granturile personale si rolurile adevarate raman in afara: sub masca se vede numai ce vede
 * omul imprumutat, altfel previzualizarea ar minti.
 */
export function permisiunileMastii(m: Masca): readonly Permisiune[] {
  if (m === 'anonim') return []
  const cod = codulMastii(m)
  if (!cod) return PERMISIUNI_IMPLICITE.user
  return [...new Set<Permisiune>([...PERMISIUNI_IMPLICITE.user, ...cheileAdminului(cod)])]
}

/** Treapta rolului. O masca se imprumuta doar SUB treapta ta; `anonim` e sub oricare. */
export const NIVEL_ROL: Record<Rol, number> = { user: 1, 'super-admin': 3 }

/**
 * Treapta mastii de administrator de aplicatie: intre utilizator si super-admin. Nu e un rol —
 * e locul din care validarea „numai in jos" (`/vezi-ca`) stie ca super-adminul poate cobori aici,
 * iar un utilizator nu.
 */
export const NIVEL_MASCA_ADMIN = 2

export function nivelMasca(m: Masca): number {
  if (m === 'anonim') return 0
  if (m === 'user') return NIVEL_ROL.user
  return NIVEL_MASCA_ADMIN
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
