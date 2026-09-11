import { z } from 'zod'

export const Mediu = z.enum(['dev', 'staging', 'production'])
export type Mediu = z.infer<typeof Mediu>

/**
 * Variabilele comune tuturor workerilor. Se valideaza la prima folosire, nu la import:
 * in Workers `env` exista abia in `fetch`.
 */
export const VariabileComune = z.object({
  MEDIU: Mediu,
  /** Originea publica a aplicatiei curente in mediul curent, ex. `https://rubik:8474`. */
  ORIGINE_PUBLICA: z.string().min(1),
  /**
   * Domeniul cookie-ului. Gol = cookie host-only (cazul dev-ului pe `rubik`, unde un hostname
   * fara punct nu accepta atribut Domain). In staging: `.staging.sfantul-ilie.ro`.
   */
  DOMENIU_COOKIE: z.string().default(''),
  /** Emailul care primeste automat rolul `super-admin` la deschiderea contului. */
  EMAIL_SUPERADMIN: z.string().default(''),
  /**
   * Unde stau celelalte aplicatii, pentru antet si redirecturi. In dev (un singur host, prin
   * gateway) sunt cai: `/`, `/calendar`, `/program`, `/curatenie`, `/admin`. In
   * staging/productie sunt origini absolute, cate un subdomeniu de aplicatie. Goale = caile de dev.
   */
  /** Home-ul platformei: `staging.sfantul-ilie.ro` (in dev, radacina gateway-ului). */
  URL_HOME: z.string().default(''),
  URL_CONT: z.string().default(''),
  URL_CALENDAR: z.string().default(''),
  URL_PROGRAM: z.string().default(''),
  URL_CURATENIE: z.string().default(''),
  URL_TIPIC: z.string().default(''),
  URL_ADMIN: z.string().default(''),
})
export type VariabileComune = z.infer<typeof VariabileComune>

export function citesteConfig(env: unknown): VariabileComune {
  const rezultat = VariabileComune.safeParse(env)
  if (!rezultat.success) {
    // Nu tiparim `env` — ar putea contine secrete. Doar ce lipseste.
    const campuri = rezultat.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`configurare invalida sau incompleta: ${campuri}`)
  }
  return rezultat.data
}

/** Adresele celorlalte aplicatii, cu implicitul de dev (cai pe acelasi host). */
export interface Navigatie {
  home: string
  cont: string
  calendar: string
  program: string
  curatenie: string
  tipic: string
  admin: string
}

export function navigatieDin(cfg: VariabileComune): Navigatie {
  return {
    home: cfg.URL_HOME || '',
    cont: cfg.URL_CONT || '/cont',
    calendar: cfg.URL_CALENDAR || '/calendar',
    program: cfg.URL_PROGRAM || '/program',
    curatenie: cfg.URL_CURATENIE || '/curatenie',
    tipic: cfg.URL_TIPIC || '/tipic',
    admin: cfg.URL_ADMIN || '/admin',
  }
}

/**
 * Prefixul sub care e montata aplicatia in cererea curenta. Prin gateway-ul de preview fiecare
 * aplicatie sta sub calea ei (`/calendar`, `/program`…); pe subdomeniul propriu e la radacina.
 * Se taie o singura data, aici, si se poarta mai departe pentru linkuri.
 */
export function prefixSiCale(url: URL, montaj: string): { prefix: string; cale: string } {
  const arePrefix = url.pathname === montaj || url.pathname.startsWith(`${montaj}/`)
  if (!arePrefix) return { prefix: '', cale: url.pathname }
  return { prefix: montaj, cale: url.pathname.slice(montaj.length) || '/' }
}

/**
 * Adresa PUBLICA a paginii de acum — cea din bara browserului, nu cea vazuta de worker.
 * `req.url` nu e buna la asta: prin gateway-ul de preview workerul vede `http://127.0.0.1/program/…`,
 * nu `https://rubik:8474/program/…`. Comutatorul „vezi ca" trimitea inapoi adresa vazuta de worker,
 * contul n-o recunostea (`intoarcereSigura` o refuza) si omul ajungea pe pagina contului in loc sa
 * ramana unde era — reclamat de user, 11.09.2026. Calea si intrebarea raman ale paginii; se schimba
 * doar schema/gazda/portul, luate din `ORIGINE_PUBLICA`.
 */
export function adresaPaginii(cfg: VariabileComune, url: URL): string {
  try {
    return new URL(url.pathname + url.search, new URL(cfg.ORIGINE_PUBLICA).origin).toString()
  } catch {
    return url.toString()
  }
}

export function eProductie(cfg: VariabileComune): boolean {
  return cfg.MEDIU === 'production'
}

/**
 * Secretul de debug (codul de intrare aratat in pagina in loc sa plece pe email) e permis
 * DOAR in dev. E singurul loc care decide asta.
 */
export function permiteSecretDebug(cfg: VariabileComune): boolean {
  return cfg.MEDIU === 'dev'
}
