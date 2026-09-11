import { z } from 'zod'
import { Obiect, type Permisiune, type Principal, type Scope } from '@xc/contracts'

/**
 * CE E O ACTIUNE
 *
 * Un verb al unei aplicatii, declarat o singura data si publicat pe lista ei. Deosebirea fata de
 * rutele `/v1` (publice, de citit, cu cache) si fata de rutele interne de serviciu (perechi
 * private intre doi workeri) e ca actiunile formeaza o LISTA pe care o poate citi oricine are
 * dreptul sa ceara: un model de limbaj, o alta aplicatie, o unealta de intretinere.
 *
 * ⚠️ REGULA CARE TINE DUBLAREA LA DISTANTA: o actiune NU contine logica proprie. `executa` cheama
 * exact functia de domeniu pe care o cheama si ruta `/v1`. Daca simti nevoia de cod nou aici,
 * codul acela apartine domeniului (`src/date.ts`) — scrie-l acolo, unde il poate folosi si ruta
 * publica. Semnul rau: o actiune care isi cheama prin HTTP propriul `/v1`.
 */

export const EFECTE = ['citeste', 'scrie'] as const
export const Efect = z.enum(EFECTE)
export type Efect = z.infer<typeof Efect>

/**
 * Hartia care circula sta in `@xc/contracts` (forma) si se face cu `obiectDinHtml` din `@xc/ui`
 * (unde stau toate hartiile). Aici o reexportam doar ca sa poata fi scrisa o actiune importand
 * dintr-un singur loc.
 */
export { Obiect }

/** Cine cere. Lantul e de incredere fiindca toate verigile sunt workerii nostri, legati prin bindings. */
export type Actor =
  | { fel: 'utilizator'; principal: Principal }
  | { fel: 'serviciu'; nume: string }

export interface ContextActiune<E = unknown> {
  env: E
  actor: Actor
  correlationId: string
  /** Pentru `waitUntil` — scrierea in audit nu tine raspunsul pe loc. */
  ctxExec: ExecutionContext
  /** De unde a venit cererea: `chat`, `automatizare`, numele aplicatiei. Ajunge in audit. */
  prin: string
}

export interface Actiune<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType, E = any> {
  /** `<aplicatie>.<verb>`, unic pe platforma. Asa se vede in audit cine ce a cerut. */
  nume: string
  /**
   * Scrisa pentru cineva care n-a vazut codul: din ea alege modelul ce sa cheme, si tot ea e
   * documentatia pentru o alta aplicatie. O descriere lenesa („da saptamana") e un bug.
   */
  descriere: string
  efect: Efect
  /** Cheie din CHEI_PERMISIUNI. Lipsa ei inseamna „la liber", ca restul platformei. */
  permisiune?: Permisiune
  /** Implicit `global`. Pentru actiunile legate de o resursa anume, se calculeaza din argumente. */
  scope?: Scope | ((argumente: z.infer<I>) => Scope)
  intrare: I
  iesire: O
  /**
   * `date` (JSON de citit) sau `obiect` (o hartie care circula). Se deduce singur cand `iesire`
   * e chiar `Obiect`; se scrie de mana doar pentru formele invelite (`Obiect.array()` etc.).
   */
  felIesirii?: 'date' | 'obiect'
  /** Fraze omenesti care duc la ea: ajuta modelul sa aleaga si omul sa inteleaga. */
  exemple?: string[]
  /**
   * Are voie sa o ceara un SERVICIU (nu un om)? Implicit nu, pentru actiunile cu permisiune:
   * altfel un serviciu ar ocoli tacut drepturile. Actiunile fara permisiune sunt oricum deschise.
   */
  permiteServicii?: boolean
  executa: (argumente: z.infer<I>, c: ContextActiune<E>) => Promise<z.infer<O>>
}

/**
 * Ajutor de scriere: pastreaza tipurile lui `intrare`/`iesire` pana in `executa`, ca argumentele
 * sa fie tipizate fara adnotari de mana.
 */
export function actiune<I extends z.ZodType, O extends z.ZodType, E = any>(
  a: Actiune<I, O, E>,
): Actiune<I, O, E> {
  return a
}

export type Registru<E = any> = ReadonlyArray<Actiune<any, any, E>>

/** Lista aplicatiei, cu numele verificate: doua actiuni cu acelasi nume sunt o greseala de scris. */
export function registru<E = any>(actiuni: Registru<E>): Registru<E> {
  const vazute = new Set<string>()
  for (const a of actiuni) {
    if (vazute.has(a.nume)) throw new Error(`actiune dublata: ${a.nume}`)
    // `__` e rezervat: acolo se traduce punctul cand numele pleaca spre model (vezi `numeUnealta`),
    // iar un nume care-l contine n-ar mai putea fi tradus inapoi.
    if (a.nume.includes('__')) throw new Error(`nume de actiune cu doua liniute de subliniere: ${a.nume}`)
    vazute.add(a.nume)
  }
  return actiuni
}

// ---------------------------------------------------------------------------
// Ce se intoarce
// ---------------------------------------------------------------------------

export const CODURI_EROARE = [
  'necunoscuta',
  'argumente_invalide',
  'fara_drept',
  'nepermis_serviciilor',
  'eroare_interna',
  'indisponibil',
] as const
export type CodEroare = (typeof CODURI_EROARE)[number]

export type Rezultat<T = unknown> =
  | { ok: true; date: T }
  | { ok: false; cod: CodEroare; mesaj: string }

/** Antetele intre workeri. `_XC_` ca sa nu se incurce cu ale platformei sau ale Cloudflare. */
export const ANTET_SECRET = 'x-xc-intern'
export const ANTET_ACTOR = 'x-xc-actor'
export const ANTET_PRIN = 'x-xc-prin'

/** Calea, sub care nimic nu se serveste de pe internet. */
export const CALE_ACTIUNI = '/_actiuni'
