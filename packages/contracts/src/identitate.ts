import { z } from 'zod'
import { Masca, Rol, Scope } from './permisiuni.js'

/** Emailul e identificatorul principal. Normalizarea (trim + lowercase) e obligatorie la intrare. */
export const Email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('adresa de email nu pare valida'))

export const NumeAfisat = z.string().trim().min(1).max(120)

/** Telefonul, cum il scrie omul. Se pastreaza forma lui; se curata doar la `tel:`. */
export const Telefon = z.string().trim().max(40)

/**
 * Fisa omului, la identitate. Pana pe 14.09.2026 tinea doar `email` + `displayName` — atat cat
 * trebuia ca sa scrie un nume in antet. Utilizatorul a cerut atunci ca fisa sa cuprinda **tot ce
 * tinea despre un om aplicatia de curatenie** (prenume, nume, telefon, nume scurt), ca sa nu mai
 * existe o a doua lista de persoane in platforma. Sunt singurele date personale din V2 si stau
 * intr-un singur loc — cine are nevoie de ele le CERE de aici.
 *
 * ⚠️ Toate cele patru sunt optionale: un cont nascut dintr-o intrare obisnuita n-are decat adresa.
 */
export const Utilizator = z.object({
  id: z.string().min(1),
  email: Email,
  displayName: z.string().min(1).nullable(),
  firstName: z.string().nullable().default(null),
  lastName: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  /** Numele scurt, cum se scrie pe un buton: „Mihai P.". Vine din curatenie (V1: `slug`/`numeScurt`). */
  shortName: z.string().nullable().default(null),
  emailVerifiedAt: z.iso.datetime().nullable(),
  disabledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
})
export type Utilizator = z.infer<typeof Utilizator>

/** Ce se poate schimba la fisa unui om. Tot ce lipseste ramane neatins. */
export const DateUtilizator = z.object({
  displayName: NumeAfisat.optional(),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  phone: Telefon.optional(),
  shortName: z.string().trim().max(60).optional(),
})
export type DateUtilizator = z.infer<typeof DateUtilizator>

export const AtribuireRol = z.object({
  role: Rol,
  scope: Scope,
})
export type AtribuireRol = z.infer<typeof AtribuireRol>

/**
 * Ce primeste o aplicatie cand intreaba „cine e pe sesiunea asta?". Fara PII in plus.
 *
 * `roles` sunt rolurile EFECTIVE: daca sesiunea poarta o masca „vezi ca", aici apare masca,
 * nu rolurile adevarate. Aplicatia nu trebuie sa stie de mascarada ca sa se poarte corect —
 * singurele campuri care o privesc sunt `veziCa` si `poateVedeaCa`, si doar pentru afisare.
 */
export const SesiuneCurenta = z.object({
  authenticated: z.boolean(),
  user: Utilizator.nullable(),
  roles: z.array(AtribuireRol).default([]),
  sessionId: z.string().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  /** Masca purtata acum, pentru banda de jos. `null` = omul se uita cu ochii lui. */
  veziCa: Masca.nullable().default(null),
  /**
   * Daca in meniu apare grupul „Vezi ca". Il calculeaza identitatea, din rolul ADEVARAT —
   * asa nicio aplicatie nu ajunge sa citeasca ea roluri ca sa deseneze un meniu. E `true` si
   * cat timp masca e pusa, altfel omul ar ramane fara drum de intoarcere.
   */
  poateVedeaCa: z.boolean().default(false),
})
export type SesiuneCurenta = z.infer<typeof SesiuneCurenta>

export const SESIUNE_ANONIMA: SesiuneCurenta = {
  authenticated: false,
  user: null,
  roles: [],
  sessionId: null,
  expiresAt: null,
  veziCa: null,
  poateVedeaCa: false,
}

// ---------------------------------------------------------------------------
// Cereri catre identity-worker
// ---------------------------------------------------------------------------

/**
 * Intrarea e FARA parola si FARA link (decizii user, 10.09.2026): omul da emailul, primeste un
 * COD DE SASE CIFRE, il scrie, si abia atunci exista sesiune. Acelasi gest naste si contul, la
 * prima confirmare — `displayName` e purtat pana atunci. Nu exista conturi neconfirmate.
 *
 * De ce cod si nu link: un link din scrisoare poate fi deschis de scanerele antivirus ale
 * furnizorului, redirectionat sau apasat de oricine ajunge la cutia postala, si intra fara sa
 * scrie nimic. Codul cere omul la tastatura unde a pornit intrarea.
 */
export const CerereIntrare = z.object({
  email: Email,
  displayName: NumeAfisat.optional(),
})
export type CerereIntrare = z.infer<typeof CerereIntrare>

/**
 * Codul de pe email, asa cum vine de la om: sase cifre, cu sau fara spatiul de la mijloc
 * (in scrisoare scrie `123 456`, iar in pagina sunt sase casute). Se curata de tot ce nu e
 * cifra inainte de verificare — lipirea din scrisoare, cu spatiu cu tot, trebuie sa mearga.
 */
export const LUNGIME_COD = 6
export const Cod = z
  .string()
  .transform((s) => s.replace(/\D/g, ''))
  .refine((s) => s.length === LUNGIME_COD, 'codul are sase cifre')
export type Cod = z.infer<typeof Cod>

export const CerereConfirmareCod = z.object({
  email: Email,
  cod: Cod,
})
export type CerereConfirmareCod = z.infer<typeof CerereConfirmareCod>

/**
 * Rezultatul cererii de intrare. Niciodata nu spune daca emailul are cont sau nu —
 * raspunsul e identic in ambele cazuri (anti-enumerare).
 */
export const RezultatIntrare = z.object({
  /** Mereu true catre browser; ce s-a intamplat in spate se vede doar in audit. */
  challengeSent: z.boolean(),
  /** Doar in dev: codul care ar fi plecat pe email, ca sa poti testa fara livrare reala. */
  debugCod: z.string().nullable().optional(),
})
export type RezultatIntrare = z.infer<typeof RezultatIntrare>
