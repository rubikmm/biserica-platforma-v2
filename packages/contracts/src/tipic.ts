import { z } from 'zod'
import { DataCalendaristica } from './calendar.js'

/**
 * A9 · Tipicul — rânduiala slujbei zilei. Proprietar unic al datelor: aplicația `tipic`.
 *
 * Trei surse, așezate una sub alta, ca în V1 (decizie user, 1 sept. 2026):
 *   1. `randuiala`  — Rânduiala Tipicului (ROEA): un paragraf telegrafic, doar pe zilele mari;
 *   2. `tipiconal`  — Anuarul liturgic și tipiconal (IBMO): toate zilele anului, desfășurat;
 *   3. `minei`      — TEXTUL slujbei: stihirile, canoanele, sinaxarul.
 *
 * Ce e al altei aplicații nu se ține aici: ziua liturgică, sfinții și pericopele se cer de la
 * `calendar`, iar textul pericopelor tot de la el (el îl aduce de la Biblia).
 */

/** O trimitere la Scriptură, așa cum o scrie tipicul: numai referința, fără text. */
export const ReferintaPericopa = z.object({ ref: z.string().min(1) })
export type ReferintaPericopa = z.infer<typeof ReferintaPericopa>

/** Rânduiala scurtă a zilei (ROEA) — un rezumat, pe zilele cu rânduială proprie. */
export const RanduialaZi = z.object({
  data: DataCalendaristica,
  /** Cum scrie sursa: `DUMINICĂ`, `LUNI`. */
  zi: z.string().default(''),
  /** Numărul Evangheliei Învierii (1..11); referința ei e fixă și vine din rânduiala Evangheliarului. */
  voscreasna: z.number().int().min(1).max(11).nullable(),
  utrenie: z.array(ReferintaPericopa),
  apostol: z.array(ReferintaPericopa),
  evanghelie: z.array(ReferintaPericopa),
  /** Paragraful întreg al tipicului, așa cum e tipărit. */
  tipic: z.string(),
})
export type RanduialaZi = z.infer<typeof RanduialaZi>

/** Rânduiala desfășurată a zilei (Anuarul liturgic și tipiconal). */
export const TipiconalZi = z.object({
  data: DataCalendaristica,
  zi: z.string().default(''),
  /** Titlul zilei în forma cărții: `(†) Înălțarea Sfintei Cruci (Post)`. */
  titlu: z.string().default(''),
  paragrafe: z.array(z.string()),
  /** Paginile din carte pe care stă ziua — pentru trimiterea în PDF. */
  pagini: z.array(z.number().int()),
})
export type TipiconalZi = z.infer<typeof TipiconalZi>

/**
 * Felul unei bucăți din Minei — haina pe care i-o dă cartea: numele slujbei, indicația
 * tipiconală (măruntă și roșie), textul cântat sau sinaxarul.
 */
export const FelBucataMinei = z.enum(['sectiune', 'rubrica', 'text', 'sinaxar'])
export type FelBucataMinei = z.infer<typeof FelBucataMinei>

export const BucataMinei = z.object({
  fel: FelBucataMinei,
  text: z.string(),
  /** Rândul cules centrat în carte se așază centrat și în pagină; se măsoară, nu se ghicește. */
  centrat: z.boolean().optional(),
})
export type BucataMinei = z.infer<typeof BucataMinei>

/** O zi din Minei. CARTEA NU ȚINE DE AN: cheia e (luna, zi), nu data întreagă. */
export const ZiMinei = z.object({
  luna: z.number().int().min(1).max(12),
  zi: z.number().int().min(1).max(31),
  titlu: z.string().default(''),
  bucati: z.array(BucataMinei),
  pagini: z.array(z.number().int()),
})
export type ZiMinei = z.infer<typeof ZiMinei>

/**
 * Cartea din care vine o parte a paginii. `credit` e cine a cules textul, când nu e chiar cartea:
 * lunile luate de la slujbe.teologie.net se dau cu condiția să fie arătat numele culegătorului și
 * adresa sitului — și așa se și arată, în bara părții.
 */
export const CarteTipic = z.object({
  cod: z.string().min(1),
  sursa: z.string().min(1),
  editura: z.string().default(''),
  nota: z.string().default(''),
  credit: z.string().default(''),
  url: z.string().default(''),
  luna: z.number().int().min(1).max(12).nullable(),
})
export type CarteTipic = z.infer<typeof CarteTipic>

/** Răspunsul lui `GET /v1/zi/<data>`: tot ce știe tipicul despre o zi, cu cărțile din care vine. */
export const ZiTipic = z.object({
  data: DataCalendaristica,
  randuiala: RanduialaZi.nullable(),
  tipiconal: TipiconalZi.nullable(),
  minei: ZiMinei.nullable(),
  carti: z.object({
    randuiala: CarteTipic.nullable(),
    tipiconal: CarteTipic.nullable(),
    minei: CarteTipic.nullable(),
  }),
})
export type ZiTipic = z.infer<typeof ZiTipic>

/**
 * O pomenire din sinaxarul Mineiului. Mineiul trece TOATĂ ceata zilei, deci dă mai multe nume
 * decât calendarul oficial (verificat pe patru duminici, 10.09.2026: între cinci și zece în plus);
 * în schimb nu-i are pe sfinții români canonizați după ediție. Cele două liste stau una lângă
 * alta, fiecare cu sursa ei — nu se contopesc.
 */
export const PomenireMinei = z.object({
  /** Numele, fără formula de început („Tot în această zi, pomenirea…"). */
  nume: z.string(),
  /** Rândul întreg, cum e tipărit în carte. */
  pomenire: z.string(),
  /** Stihul (distihul) pomenirii, rând cu rând; poate lipsi. */
  stih: z.array(z.string()),
  /** Viața pe scurt, dacă o dă cartea. */
  viata: z.string(),
})
export type PomenireMinei = z.infer<typeof PomenireMinei>

/** Pomenirile zilei dintr-o singură carte, cu cartea la vedere. */
export const SursaSfinti = z.object({
  /** `minei` sau `tipiconal` (Anuarul liturgic și tipiconal). */
  cod: z.string().min(1),
  carte: CarteTipic.nullable(),
  /** Titlul zilei în cartea aceea. */
  titlu: z.string(),
  pomeniri: z.array(PomenireMinei),
})
export type SursaSfinti = z.infer<typeof SursaSfinti>

/**
 * Răspunsul lui `GET /v1/sfinti/<data>`: sfinții zilei GRUPAȚI PE CĂRȚI, în ordinea în care se
 * citesc pe foaie (user, 11.09.2026) — întâi Mineiul, care trece toată ceata zilei, apoi Anuarul.
 * Cine le arată pune calendarul deasupra și taie din fiecare carte ce s-a spus mai sus.
 */
export const SfintiiZileiTipic = z.object({
  data: DataCalendaristica.nullable(),
  luna: z.number().int().min(1).max(12),
  zi: z.number().int().min(1).max(31),
  surse: z.array(SursaSfinti),
})
export type SfintiiZileiTipic = z.infer<typeof SfintiiZileiTipic>
