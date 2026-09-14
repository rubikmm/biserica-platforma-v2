import { z } from 'zod'

/**
 * RADIOUL — muzica psaltică a parohiei, fără niciun aparat.
 *
 * Muzica stă în depozit (R2), iar aplicația ține doar **CEASUL**: ce selecție curge și de când.
 * Ascultătorul ia fișierul din depozit și sare la secunda spusă. Toți aud aproape același lucru
 * pentru că toți citesc același ceas. Nu există ffmpeg, nici SFU, nici dispozitiv de repornit —
 * socoteala e pură (`ceSeAude` din `@xc/comanda`) și dă același răspuns în worker și în pagină.
 *
 * ⚠️ **Duratele sunt EXACTE, nu ghicite.** Indicele ține durata fiecărei piese numărată din cadre
 * (la urcare o măsoară browserul cu `decodeAudioData`; la remăsurare o numără workerul, vezi
 * `durate.ts` din `apps/radio`). În V1 `ffprobe` le estima din debit, iar la fișierele cu copertă
 * înglobată citea ceasul imaginii, nu al sunetului — de acolo venea „schimbă melodia în mijlocul
 * uneia". Dacă duratele nu sunt exacte, ceasul minte și tot radioul se strâmbă.
 */

/** O piesă din bibliotecă. `cale` e relativă la rădăcina muzicii, fără prefixul din depozit. */
export const FisierRadio = z.object({
  cale: z.string().min(1),
  /** Secunde, EXACTE (numărate din cadre, nu ghicite din debit). */
  durata: z.number().nonnegative(),
  /** Mărimea în depozit, când o știm. */
  octeti: z.number().int().nonnegative().optional(),
})
export type FisierRadio = z.infer<typeof FisierRadio>

/**
 * Indicele bibliotecii, ținut ca un singur obiect în depozit. `semnatura` e amprenta listei:
 * pagina își dă seama după ea că s-a schimbat ceva și cere din nou cuprinsul.
 */
export const BibliotecaRadio = z.object({
  generat_la: z.string(),
  semnatura: z.string(),
  fisiere: z.array(FisierRadio),
  /** Directoare care există chiar dacă sunt goale (cele canonice + cele făcute din pagină). */
  directoare: z.array(z.string()).optional(),
})
export type BibliotecaRadio = z.infer<typeof BibliotecaRadio>

/**
 * Structura canonică, adusă din V1: există mereu, chiar goală, ca Părintele să găsească aceleași
 * rafturi ca pe aparatul vechi.
 */
export const STRUCTURA_CANONICA: readonly string[] = [
  '01. Octoih',
  '01. Octoih/01. Postul Sfinților Apostoli',
  '01. Octoih/02. Postul Adormirii Maicii Domnului',
  '01. Octoih/03. Începutul Anului',
  '01. Octoih/04. Postul Nașterii Domnului',
  '01. Octoih/05. Perioada Nașterii Domnului',
  '01. Octoih/06. Perioada după Botezul Domnului',
  '02. Triod',
  '02. Triod/01. Perioada pregătitoare',
  '02. Triod/02. Postul Mare',
  '02. Triod/03. Săptămâna Patimilor',
  '03. Penticostar',
  '03. Penticostar/01. Săptămâna Luminată',
  '03. Penticostar/02. Perioada Pascală',
  '03. Penticostar/03. Înălțarea Domnului',
  '03. Penticostar/04. Perioada până la Rusalii',
  '03. Penticostar/05. Rusaliile',
  '03. Penticostar/06. Duminica Tuturor Sfinților',
  'DIVERSE',
] as const

/**
 * Ce cere omul de la radio — starea ceasului. `de` e clipa din care socotim ce se aude; se mută
 * ori de câte ori se schimbă selecția, iar la reluarea după o transmisiune în direct se preia
 * ceasul dinainte, ca radioul să nu o ia de la capăt.
 */
export const SelectieRadio = z.object({
  versiune: z.number().int().nonnegative(),
  pornit: z.boolean(),
  director: z.string().nullable(),
  /** Piesa cu care începe selecția; de la ea se rotește lista. */
  fisier_start: z.string().nullable(),
  /** ISO — momentul din care socotim ce se aude. */
  de: z.string(),
  /** Cine a pus selecția (nume afișat), pentru panou. */
  cine: z.string().nullable(),
})
export type SelectieRadio = z.infer<typeof SelectieRadio>

export const SELECTIE_GOALA: SelectieRadio = {
  versiune: 0,
  pornit: false,
  director: null,
  fisier_start: null,
  de: '',
  cine: null,
}

/** Ce se aude la radio în clipa asta — socotit din ceas, niciodată citit dintr-o stare scrisă. */
export const AcumRadio = z.object({
  pornit: z.boolean(),
  versiune: z.number().int().nonnegative(),
  director: z.string().nullable(),
  /** Piesa care se aude, cu secunda din ea. */
  cale: z.string().nullable(),
  secunda: z.number().nonnegative(),
  durata: z.number().nonnegative(),
  index: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  /** Ce urmează — pagina o încarcă din timp, ca să nu fie pauză între piese. */
  urmatoarea: z.string().nullable(),
  urmatoareaDurata: z.number().nonnegative(),
  cine: z.string().nullable(),
})
export type AcumRadio = z.infer<typeof AcumRadio>

/** Extensiile pe care le primește biblioteca. Tot ce nu e aici nu se urcă și nu se redă. */
export const EXTENSII_AUDIO = ['.mp3', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.flac'] as const
