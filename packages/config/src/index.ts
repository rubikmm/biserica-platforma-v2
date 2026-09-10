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
   * gateway) sunt cai: `/`, `/program`, `/admin`. In staging/productie sunt origini absolute,
   * cate un subdomeniu de aplicatie. Goale = caile de dev.
   */
  URL_CONT: z.string().default(''),
  URL_PROGRAM: z.string().default(''),
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
  cont: string
  program: string
  admin: string
}

export function navigatieDin(cfg: VariabileComune): Navigatie {
  return {
    cont: cfg.URL_CONT || '',
    program: cfg.URL_PROGRAM || '/program',
    admin: cfg.URL_ADMIN || '/admin',
  }
}

export function eProductie(cfg: VariabileComune): boolean {
  return cfg.MEDIU === 'production'
}

/**
 * Linkul de debug (linkul de intrare afisat in interfata in loc sa plece pe email)
 * e permis DOAR in dev. E singurul loc care decide asta.
 */
export function permiteLinkDebug(cfg: VariabileComune): boolean {
  return cfg.MEDIU === 'dev'
}
