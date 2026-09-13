import { z } from 'zod'

/**
 * Biblioteca parohiei (A12 din V1) — catalogul bibliotecii de la Hanul Coltei: ce carti exista
 * si in cate exemplare. **E un catalog, nu o biblioteca de texte**: cartile se imprumuta fizic,
 * de la pangar. Textele sfinte sunt alte aplicatii (Biblia, Tipicul) si nu se copiaza aici.
 *
 * Doua straturi, cu regimuri diferite:
 *  - **catalogul e public**, ca in V1: cine intra pe pagina vede titlurile, autorii, editurile
 *    si fisele imbogatite fara sa aiba cont;
 *  - **rezervarea e a omului**: cere permisiunea `library.borrow`, iar ecranul pangarului
 *    `library.manage`. Ce se scrie in baza tine numai `userId` — niciodata nume, email sau
 *    telefon (structura mare: datele personale au un singur proprietar).
 */

// ---------------------------------------------------------------------------
// Catalogul (R2) — forma in care il tine foaia parohiei
// ---------------------------------------------------------------------------

/**
 * Un rand din foaia parohiei. **Identitatea cartii e numarul de inventar** (`nr`), nu titlul:
 * parohia il pastreaza de la o versiune la alta, iar titlul se mai indreapta. Slugul nu se
 * schimba cat timp randul e aceeasi carte — el e adresa fisei, cheia copertei din depozit si
 * `carteSlug` din cererile de imprumut.
 *
 * Casuta goala e `null`: „*", „****", „-" si „—" inseamna toate acelasi lucru („nu se stie").
 */
export const CarteCatalog = z.object({
  nr: z.number().int(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  titlu: z.string().min(1),
  autor: z.string().nullable(),
  editura: z.string().nullable(),
  an: z.string().nullable(),
  loc: z.string().nullable(),
  bucati: z.number().int().nonnegative(),
})
export type CarteCatalog = z.infer<typeof CarteCatalog>

/** Un autor sau o editura, cu cate titluri are. `litera` se cere anume acolo unde nu se ia din nume. */
export const GrupCatalog = z.object({
  nume: z.string().min(1),
  slug: z.string().min(1),
  carti: z.number().int().nonnegative(),
  litera: z.string().optional(),
})
export type GrupCatalog = z.infer<typeof GrupCatalog>

/** Fisierul `catalog.json`, asa cum sta in depozit. Indexul de autori si edituri se face la citire. */
export const Catalog = z.object({
  sursa: z.string(),
  actualizatLaSursa: z.string().nullable(),
  preluatLa: z.string(),
  total: z.number().int(),
  totalAutori: z.number().int(),
  totalEdituri: z.number().int(),
  carti: z.array(CarteCatalog),
  autori: z.array(GrupCatalog),
  edituri: z.array(GrupCatalog),
})
export type Catalog = z.infer<typeof Catalog>

// ---------------------------------------------------------------------------
// Imbogatirea — ce aduc librariile online peste randul din foaie
// ---------------------------------------------------------------------------

/**
 * Ce se afla de pe la librarii despre o carte. **Sta deoparte**: nu se scrie nimic in catalog,
 * iar unde librariile spun altceva decat foaia parohiei (alt an, alta editura), ramane ce spune
 * foaia. Fiecare fisa spune de unde vine.
 */
export const Imbogatire = z.object({
  pagini: z.number().int().nullable(),
  descriere: z.string().nullable(),
  isbn: z.string().nullable(),
  format: z.string().nullable(),
  coperta_tip: z.string().nullable(),
  /** Anul si editura ASA CUM LE STIE MAGAZINUL — se arata doar cand difera de catalog. */
  an: z.string().nullable(),
  editura: z.string().nullable(),
  categorie: z.string().nullable(),
  coperta: z.string().nullable(),
  /** Cartea intreaga, acolo unde editura o da singura si gratuit (Predania). */
  pdf: z
    .object({
      fisier: z.string(),
      octeti: z.number().int(),
      sursa: z.object({ nume: z.string(), url: z.string() }),
    })
    .nullable(),
  sursa: z.object({ id: z.string(), nume: z.string(), url: z.string() }),
  adus_la: z.string(),
})
export type Imbogatire = z.infer<typeof Imbogatire>

// ---------------------------------------------------------------------------
// Rezervarea si imprumutul (D1)
// ---------------------------------------------------------------------------

/**
 * Drumul unei carti:
 *
 *   ceruta ──pangarul o gaseste──► pregatita ──omul o ridica──► imprumutata ──► returnata
 *     │                                │
 *     ├─ respinsa (pangarul)           ├─ expirata (n-a venit in 7 zile)
 *     └─ anulata (omul se razgandeste) └─ anulata (omul se razgandeste)
 *
 * „Intarziat" NU e o stare, ci o socoteala: `imprumutata` cu scadenta trecuta.
 */
export const STARI_CERERE = [
  'ceruta',
  'pregatita',
  'imprumutata',
  'returnata',
  'expirata',
  'respinsa',
  'anulata',
] as const
export const StareCerere = z.enum(STARI_CERERE)
export type StareCerere = z.infer<typeof StareCerere>

/** Cererile care tin o carte ocupata. */
export const STARI_ACTIVE = ['ceruta', 'pregatita', 'imprumutata'] as const satisfies readonly StareCerere[]

export const CerereCarte = z.object({
  id: z.number().int().positive(),
  userId: z.string().min(1),
  carteSlug: z.string().min(1),
  stare: StareCerere,
  cerutaLa: z.string(),
  pregatitaLa: z.string().nullable(),
  asteaptaPana: z.string().nullable(),
  imprumutataLa: z.string().nullable(),
  scadenta: z.string().nullable(),
  incheiataLa: z.string().nullable(),
})
export type CerereCarte = z.infer<typeof CerereCarte>

/**
 * Regulile parohiei, nu ale codului (hotarari ale utilizatorului, 30 august 2026). Stau aici,
 * la vedere, ca sa se poata schimba fara sa se umble prin ecrane.
 */
export const REGULI_IMPRUMUT = {
  /** Cat tine imprumutul, socotit de la ridicare. */
  luniImprumut: 1,
  /** Cat asteapta cartea pregatita la pangar, daca omul nu vine s-o ridice. */
  zileAsteptare: 7,
  /** Cate carti poate avea un om deodata: cerute + pregatite + imprumutate la un loc. */
  maximDeodata: 3,
} as const

/** Ce intoarce `GET /v1/eu` — blocul personal, pentru pagina contului. */
export const RezumatPersonalBiblioteca = z.object({
  active: z.number().int().nonnegative(),
  imprumutate: z.number().int().nonnegative(),
  intarziate: z.number().int().nonnegative(),
  carti: z.array(
    z.object({
      titlu: z.string(),
      slug: z.string(),
      stare: StareCerere,
      termen: z.string().nullable(),
    }),
  ),
})
export type RezumatPersonalBiblioteca = z.infer<typeof RezumatPersonalBiblioteca>
