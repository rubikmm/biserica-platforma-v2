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

/** Un exemplu cu argumente: cum se traduce o fraza a omului in campurile actiunii. */
export interface ExempluActiune {
  fraza: string
  argumente: Record<string, unknown>
}

/**
 * CE FACE O ACTIUNE CU LUMEA:
 *
 *   `citeste` — nu schimba nimic. Se executa pe loc, ori de cate ori o cere modelul.
 *   `scrie`   — schimba DATELE PAROHIEI (programul, arhiva buletinului, o scrisoare care pleaca).
 *               Se opreste si se propune omului cu Da/Nu, si intra in audit.
 *   `ciorna`  — scrie DOAR in ciorna aplicatiei: o foaie de lucru a omului care sta in chat, nu
 *               inca o dată a parohiei. Se face pe loc, FARA Da/Nu.
 *
 * ⚠️ DE CE `ciorna` NU CERE CONFIRMARE (user, 18.09.2026, la chestionarul buletinului nou): un
 * chestionar de opt intrebari cu Da/Nu la fiecare raspuns ar fi saisprezece apasari pentru un
 * singur numar — iar omul tocmai a spus ce vrea, in vorbele lui. Regula care ține asta in frau:
 * ciorna **nu e o dată a parohiei si nu pleaca nicaieri** — nu se publica, nu se trimite, nu se
 * vede din afara ecranului celui care o scrie. Confirmarea rămâne UNA, acolo unde ciorna devine
 * fapt: la compunere (`buletin.compune`, efect `scrie`).
 * Cand un efect nou ar atinge date adevarate, el e `scrie`, nu inca un `ciorna`.
 */
export const EFECTE = ['citeste', 'scrie', 'ciorna'] as const
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
  /** Vezi `EFECTE`: `citeste` nu schimba nimic, `scrie` cere Da/Nu si audit, `ciorna` nici una. */
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
  /**
   * Fraze omenesti care duc la ea: ajuta modelul sa aleaga si omul sa inteleaga. Cu argumente
   * (`{ fraza, argumente }`) devin ANTRENAMENT IN CONTEXT: modelul vede ce se pune in fiecare camp
   * pentru o fraza ca a omului — pentru modelele mici e diferenta dintre 3/5 si 5/5.
   */
  exemple?: Array<string | ExempluActiune>
  /**
   * CUNOSTINTE DE FUNDAL: actiunea (fara argumente, de citire) se cheama INAINTE de orice raspuns,
   * iar rezultatul ei intra in contextul modelului — nu e o unealta pe care s-o aleaga, e ce stie
   * dinainte. Pentru ce e mic si mereu util: tiparele programului („Sfantul Maslu se face de obicei
   * marti seara"). Un rezultat de fundal trebuie sa ramana MIC (cateva KB): se plateste la fiecare
   * mesaj.
   */
  fundal?: boolean
  /**
   * NU E O UNEALTA PENTRU MODEL, e o usa pentru cod (19.09.2026, odata cu harta aplicatiilor).
   *
   * Actiunea ramane in manifest si se poate cere ca oricare alta — dar nu intra in lista de unelte
   * trimisa modelului. Asa potrivitorul hartii (`buletin.harta`) e chemat de chat CA SERVICIU, fara
   * sa devina inca un verb pe care un model mic l-ar incerca la intamplare.
   */
  ascunsa?: boolean
  /**
   * Are voie sa o ceara un SERVICIU (nu un om)? Implicit nu, pentru actiunile cu permisiune:
   * altfel un serviciu ar ocoli tacut drepturile. Actiunile fara permisiune sunt oricum deschise.
   */
  permiteServicii?: boolean
  /**
   * URMAREA: ce se propune omului DUPĂ ce acțiunea asta s-a făcut. Exemplu: după orice schimbare
   * în program, „validez săptămâna?". `argumente` spune cum se umplu câmpurile urmării din
   * argumentele acțiunii făcute: { câmpul urmării: câmpul de aici }. Chatul previzualizează urmarea
   * (deci dacă n-are sens — săptămâna e deja validată — nu întreabă nimic) și o propune cu Da/Nu.
   */
  urmare?: { actiune: string; argumente: Record<string, string> }
  /**
   * PREVIZUALIZAREA — ce se va intampla, spus omului INAINTE sa apese „Da". Doar pentru
   * `efect: 'scrie'`: se cheama cu argumentele deja validate si cu dreptul deja verificat, poate
   * citi baza (ca sa spuna „ora 08:00 → 07:00"), dar NU schimba nimic. Arunca daca cererea n-are
   * sens („nu gasesc slujba") — atunci nu se propune nimic, iar omul afla de ce.
   */
  rezuma?: (argumente: z.infer<I>, c: ContextActiune<E>) => Promise<string>
  /**
   * CE SE SCRIE DESPRE FAPTA ASTA IN AUDIT (`summary_json`), peste ce scrie montarea singura:
   * `{ argumente }` la izbanda, `{ eroare }` la cadere. Se scrie DOAR unde argumentele nu spun
   * nimic despre ce s-a intamplat — `buletin.compune` se cheama fara niciun argument, deci un rand
   * de audit cu `{ argumente: {} }` nu spune de ce n-a iesit numarul.
   *
   * ⚠️ Ce intoarce ajunge intr-o coloana citita cu ochiul: tine-l mic si taie mesajele lungi.
   */
  auditDetalii?: (
    r: { argumente: z.infer<I>; date?: z.infer<O>; eroare?: string },
  ) => Record<string, unknown>
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
/** Pus pe un POST de actiune: validare + drept + `rezuma`, FARA executie. */
export const ANTET_PREVIZUALIZARE = 'x-xc-previzualizare'

/** Ce intoarce o previzualizare. */
export interface Previzualizare {
  previzualizare: true
  rezumat: string
}

/** Calea, sub care nimic nu se serveste de pe internet. */
export const CALE_ACTIUNI = '/_actiuni'
