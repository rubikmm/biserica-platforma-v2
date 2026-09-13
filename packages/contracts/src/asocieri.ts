import { z } from 'zod'

/**
 * ASOCIEREA unui om cu o aplicatie a platformei.
 *
 * De ce exista (user, 14.09.2026): pana atunci, „cine e in echipa de curatenie" era o lista de
 * persoane in baza aplicatiei, cu nume, e-mail si telefon — singura abatere ramasa de la „datele
 * stau intr-un loc, autentificarea la fel". Utilizatorul a cerut ca listele de oameni ale
 * aplicatiilor sa devina CONTURI ale platformei, iar apartenenta la o aplicatie sa fie un
 * COMUTATOR pe contul omului, pe care il vede fiecare la el.
 *
 * Aici sta doar apartenenta. Ce inseamna ea in aplicatie (pozitii, vacante, rapoarte) ramane al
 * aplicatiei; identitatea nu stie si nu trebuie sa stie.
 *
 * ⚠️ Doua stari, nu una (user, 14.09.2026: „sa fie totusi o validare… nici chiar oricine nu poate
 * ajunge in acest punct"):
 *   - `ceruta`    — omul a apasat comutatorul la el pe cont. NU e membru inca.
 *   - `acceptata` — un administrator al aplicatiei l-a primit. De acum e membru.
 * Iesirea nu cere voie: cine vrea sa plece, pleaca (randul se sterge).
 */
export const STARI_ASOCIERE = ['ceruta', 'acceptata'] as const
export const StareAsociere = z.enum(STARI_ASOCIERE)
export type StareAsociere = z.infer<typeof StareAsociere>

/**
 * Aplicatiile care au membri. Codul e cheia din `asocieri.aplicatie` si nu se schimba niciodata —
 * e scris in randuri. Numele si textul se pot schimba oricand, sunt doar pentru ochi.
 *
 * `etichete` e vocabularul pe care aplicatia il pune pe asociere. Identitatea il pastreaza ca pe
 * un sir de cuvinte si nu-l intelege: „monitor" nu inseamna nimic aici.
 *
 * ⚠️ `permisiune` e cheia care face din cineva ADMINISTRATOR al aplicatiei. Cand aplicatia aprinde
 * eticheta de admin, autorizarea centrala acorda cheia asta — eticheta nu e un desen, e numirea
 * insasi, si se poate apasa doar de cine o are deja (sau de un super-admin).
 */
export interface AplicatieCuMembri {
  cod: string
  nume: string
  descriere: string
  /** Adresa paginii aplicatiei, ca omul sa ajunga acolo de pe contul lui. Cheia din `URL_*`. */
  cheieUrl: string
  etichete: readonly { cod: string; nume: string; explicatie: string }[]
  /** Eticheta care inseamna „administrator" + cheia de permisiune pe care o acorda. */
  etichetaAdmin?: { cod: string; permisiune: string }
}

export const APLICATII_CU_MEMBRI: readonly AplicatieCuMembri[] = [
  {
    cod: 'curatenie',
    nume: 'Curățenia bisericii',
    descriere: 'Echipa care se înscrie la duminici, pe poziții, și primește rapoartele.',
    cheieUrl: 'URL_CURATENIE',
    etichete: [
      { cod: 'voluntar', nume: 'Voluntar', explicatie: 'Se poate înscrie la duminici.' },
      { cod: 'monitor', nume: 'Monitor', explicatie: 'Primește rapoartele săptămânale și lunare.' },
      { cod: 'admin', nume: 'Admin', explicatie: 'Administrează panoul curățeniei și primește în echipă.' },
    ],
    etichetaAdmin: { cod: 'admin', permisiune: 'cleaning.manage' },
  },
]

export function aplicatieCuMembri(cod: string): AplicatieCuMembri | undefined {
  return APLICATII_CU_MEMBRI.find((a) => a.cod === cod)
}

export const CodAplicatie = z.enum(
  APLICATII_CU_MEMBRI.map((a) => a.cod) as [string, ...string[]],
)

export const Asociere = z.object({
  userId: z.string().min(1),
  aplicatie: z.string().min(1),
  stare: StareAsociere,
  etichete: z.array(z.string()).default([]),
  /** Cine a cerut-o: omul insusi, sau administratorul care l-a adus. */
  cerutDe: z.string().nullable().default(null),
  /** Administratorul care a validat. `null` cat timp asocierea e doar ceruta. */
  acceptatDe: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Asociere = z.infer<typeof Asociere>

/** Omul + asocierea lui, asa cum le cere o aplicatie ca sa-si deseneze echipa. */
export const MembruAplicatie = z.object({
  userId: z.string().min(1),
  email: z.string(),
  displayName: z.string().nullable().default(null),
  firstName: z.string().nullable().default(null),
  lastName: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  shortName: z.string().nullable().default(null),
  disabledAt: z.string().nullable().default(null),
  stare: StareAsociere.nullable().default(null),
  etichete: z.array(z.string()).default([]),
  cerutDe: z.string().nullable().default(null),
  acceptatDe: z.string().nullable().default(null),
})
export type MembruAplicatie = z.infer<typeof MembruAplicatie>
