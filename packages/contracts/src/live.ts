import { z } from 'zod'
import { AcumRadio, SelectieRadio } from './radio.js'

/**
 * LIVE-ul — transmisiunea slujbei din biserică.
 *
 * Sunetul NU trece prin worker: aparatul din biserică emite prin WHIP către Cloudflare Realtime
 * SFU, iar ascultătorii trag pista de acolo prin WebRTC (sub o secundă întârziere). Workerul face
 * doar semnalizarea — schimbă SDP-uri — și ține minte cine emite.
 *
 * ⚠️ **`live` e creierul, `radio` ascultă.** Cele două nu pot merge deodată, și starea are UN
 * SINGUR proprietar: aplicația `live`. Când pornește directul, ea stinge ceasul radioului prin
 * Service Binding; la STOP îl pornește la loc. `radio` nu hotărăște niciodată singur asupra
 * directului — îi cere lui `live`. Dacă se inversează vreodată sensul, se aud amândouă.
 */

/** Ce face aparatul din biserică. `radio` înseamnă pentru el BOXELE, nu emisia pe internet. */
export const StareAparat = z.enum(['oprit', 'radio', 'live'])
export type StareAparat = z.infer<typeof StareAparat>

/** Selecția radioului, așa cum o primește aparatul: destul cât să socotească singur, fără internet. */
export const SelectiePentruAparat = z.object({
  versiune: z.number().int().nonnegative(),
  director: z.string().nullable(),
  fisier_start: z.string().nullable(),
  /** ISO — de când curge selecția (ceasul comun cu paginile). */
  de: z.string(),
})
export type SelectiePentruAparat = z.infer<typeof SelectiePentruAparat>

/**
 * Comanda pentru aparat. `versiune` crește la fiecare schimbare — aparatul o cere în long-poll și
 * știe după ea dacă are ceva nou de făcut.
 */
export const ComandaAparat = z.object({
  versiune: z.number().int().nonnegative(),
  stare: StareAparat,
  director: z.string().nullable(),
  fisier_start: z.string().nullable(),
  selectie: SelectiePentruAparat.nullable().optional(),
  la: z.string(),
  /** Cine a dat comanda (nume afișat) — pentru panou și audit, nu se păstrează altundeva. */
  de: z.string().nullable(),
})
export type ComandaAparat = z.infer<typeof ComandaAparat>

export const COMANDA_GOALA: ComandaAparat = {
  versiune: 0,
  stare: 'oprit',
  director: null,
  fisier_start: null,
  la: '',
  de: null,
}

/**
 * CE AUDE microfonul bisericii, măsurat PE APARAT (18.09.2026). Vine în telemetrie, la fiecare
 * bătaie, și e al doilea ceas al rotirii albumelor: o oră de liniște cântărește cât o zi fără
 * comenzi (vezi `apps/live/src/rotire.ts`).
 *
 * ⚠️ **Pragul e treaba aparatului, nu a noastră.** Microfonul aude și boxele, deci „liniște" nu
 * înseamnă zero, ci RMS sub pragul potrivit acolo, în biserică; workerul nu-l socotește și nu-l
 * schimbă — primește doar `ultimul_peste_prag`, clipa în care s-a auzit ultima oară ceva.
 *
 * `null` (sau lipsă) = aparatul nu măsoară: versiune veche de daemon, microfon căzut. Atunci
 * rămâne numai ceasul de 24 h — nicio măsurătoare nu e mai bună decât una închipuită.
 */
export const SunetAparat = z.object({
  /** RMS mediu pe fereastră, dBFS (număr negativ) sau `null` dacă n-a putut fi măsurat. */
  nivel: z.number().nullable(),
  /** Vârful pe aceeași fereastră, dBFS sau `null`. */
  varf: z.number().nullable(),
  /** Pragul de „activitate" configurat pe aparat, dBFS sau `null`. */
  prag: z.number().nullable(),
  /** ISO UTC — ultima clipă în care sunetul a trecut de prag; `null` dacă n-a trecut niciodată. */
  ultimul_peste_prag: z.string().nullable(),
  /** Cât ține fereastra pe care s-a făcut măsurătoarea (secunde). */
  fereastra_s: z.number().nullable(),
})
export type SunetAparat = z.infer<typeof SunetAparat>

/** O slujbă din program, cât păstrează aparatul ca etichetă a înregistrării. */
export const SlujbaScurta = z.object({
  id: z.string(),
  data: z.string(),
  ora: z.string(),
  nume: z.string(),
  cod_nume: z.string().nullable().optional(),
})
export type SlujbaScurta = z.infer<typeof SlujbaScurta>

/** Programul slujbelor de pe aparat — copia lui locală, după care pornește singur LIVE. */
export const ProgramAparat = z.object({
  sursa: z.string(),
  activ: z.boolean(),
  sincronizat_la: z.string().nullable(),
  eroare: z.string().nullable(),
  /** [de_la, pana_la] (AAAA-LL-ZZ) — listă, nu tuplu: trece prin RPC-ul obiectului. */
  interval: z.array(z.string()).nullable(),
  slujbe: z.number().int().nonnegative(),
  transmise: z.number().int().nonnegative(),
  urmatoarea: SlujbaScurta.extend({ la: z.string(), pornita: z.boolean() }).nullable(),
})
export type ProgramAparat = z.infer<typeof ProgramAparat>

/**
 * Telemetria aparatului. Câmpurile sunt cele scrise de daemonul din biserică (`aparat/daemon.py`)
 * — se păstrează numele din V1 dinadins: aparatul e ACELAȘI, nu-l rescriem odată cu platforma.
 */
export const Telemetrie = z.object({
  aparat: z.string(),
  la: z.string(),
  stare: StareAparat,
  comanda_versiune: z.number().int().nonnegative(),
  activ_de_la: z.string().nullable(),
  director: z.string().nullable(),
  piesa: z.object({ cale: z.string(), index: z.number().int(), total: z.number().int(), secunda: z.number() }).nullable(),
  progres_s: z.number().nullable(),
  pid: z.record(z.string(), z.number()),
  /** Pe LIVE: fișierul în care se înregistrează acum, cât a crescut și ce slujbă e. */
  inregistrare: z
    .object({ fisier: z.string(), octeti: z.number(), slujba: SlujbaScurta.nullable().optional() })
    .nullable()
    .optional(),
  sursa_live: z.string().optional(),
  microfon: z
    .object({
      activ: z.boolean(),
      oprit: z.boolean().optional(),
      pid: z.number().nullable(),
      de: z.string().nullable(),
      eroare: z.string().nullable(),
    })
    .nullable()
    .optional(),
  /** Ce aude microfonul (18.09.2026). Lipsă sau `null`: aparatul nu măsoară — vezi `SunetAparat`. */
  sunet: SunetAparat.nullable().optional(),
  disc: z.object({ liber_gb: z.number(), total_gb: z.number() }).nullable(),
  ultima_eroare: z.string().nullable(),
  ultimul_mesaj: z.string().nullable(),
  continut: z.string().nullable(),
  worker_eroare: z.string().nullable(),
  /** De ce e în starea de acum: comandă, limita de ore, programul slujbelor, implicit, reluare. */
  motiv: z.string().optional(),
  /** O hotărâre luată PE APARAT (merge și fără internet), încă nepreluată aici. */
  decizie: z
    .object({
      stare: StareAparat,
      motiv: z.string(),
      la: z.string(),
      selectie: SelectiePentruAparat.nullable().optional(),
      slujba: SlujbaScurta.nullable().optional(),
    })
    .nullable()
    .optional(),
  /** Pe LIVE: când se încheie singur (limita de ore, socotită pe aparat). */
  live_limita_la: z.string().nullable().optional(),
  program: ProgramAparat.nullable().optional(),
  slujba: SlujbaScurta.nullable().optional(),
  legatura: z.object({ ok: z.boolean().nullable(), de: z.string().nullable() }).nullable().optional(),
})
export type Telemetrie = z.infer<typeof Telemetrie>

/** Starea canalului în SFU: chiar curge sunet, sau doar credem că da? */
export const StareDirect = z.object({
  direct: z.boolean(),
  configurat: z.boolean(),
  /** ISO — de când emite emițătorul curent (se schimbă la fiecare ffmpeg nou). */
  de: z.string().optional(),
  sfu: z.string().optional(),
})
export type StareDirect = z.infer<typeof StareDirect>

/** Câți ascultă acum — bătăile paginilor cu play apăsat, nimic despre om. */
export const NumarAscultatori = z.object({
  total: z.number().int().nonnegative(),
  live: z.number().int().nonnegative(),
  radio: z.number().int().nonnegative(),
  telefoane: z.number().int().nonnegative(),
})
export type NumarAscultatori = z.infer<typeof NumarAscultatori>

/**
 * Ce e pus în spate ACUM. `radio` are întâietate cât e pornit: în cele câteva secunde de
 * suprapunere de după STOP directul încă se aude, dar ascultătorul a trecut deja pe radio.
 * `porneste-live` = s-a comandat LIVE, sunetul din biserică încă n-a ajuns (cel mult 45 s).
 */
export const ModEmisie = z.enum(['live', 'radio', 'porneste-live', 'oprit'])
export type ModEmisie = z.infer<typeof ModEmisie>

/**
 * `GET /v1/stare` de la `live` — singurul adevăr pe care îl urmăresc paginile amândurora și
 * adresa publică din contract, pentru celelalte aplicații.
 */
export const StareEmisie = z.object({
  live: z.boolean(),
  mod: ModEmisie,
  direct: StareDirect,
  radio: AcumRadio,
  /** Pe LIVE: slujba din program de care ține directul, cu ora de la care emite. */
  slujba: z.object({ nume: z.string(), de: z.string().nullable() }).nullable(),
  /** Următoarea slujbă din program (cerută de la `program`), sau null. */
  urmatoarea: z.unknown().nullable(),
  ora: z.string(),
})
export type StareEmisie = z.infer<typeof StareEmisie>

/**
 * Tot ce arată panoul de administrare — același răspuns în amândouă aplicațiile, fiindcă e
 * același panou. Fiecare aplicație îl compune cerându-i celeilalte partea ei.
 */
export const StarePanou = z.object({
  radio: AcumRadio,
  selectie: SelectieRadio,
  director: z.string().nullable(),
  /**
   * ROTIREA ALBUMELOR (18.09.2026): când radioul cântă nesupravegheat, ceasul sare singur pe alt
   * album, apoi pe altul la capătul fiecăruia. Pornește pe DOUĂ ceasuri — o zi fără nicio comandă
   * de om, SAU o oră de liniște în biserică (microfonul, vezi `SunetAparat`). În panou e un singur
   * rând, discret — nu un buton: rotirea nu se aprinde și nu se stinge cu mâna, se oprește dând o
   * comandă. Socoteala stă în `apps/live/src/rotire.ts`.
   */
  rotire: z.object({
    /** ISO — de când cântă albumul pus de CEAS; `null` dacă selecția e a unui om sau a aparatului. */
    ales_la: z.string().nullable(),
    /** ISO — când sună ceasul: capătul albumului, sau clipa în care începe rotirea. */
    urmatoarea: z.string().nullable(),
    /** `true`: rotirea e în curs (cântă un album pus de ceas, ori a venit vremea); `false`: abia urmează. */
    activa: z.boolean(),
    /**
     * Din ce pricină ar porni rotirea la `urmatoarea`, ca panoul să spună de ce se schimbă albumul:
     * `liniste` = nu se mai aude nimic în biserică, `comanda` = nu s-a mai apăsat nimic de o zi.
     * `null` cât rotirea e deja pornită (atunci `urmatoarea` e capătul albumului) sau nu se știe.
     */
    motiv: z.enum(['liniste', 'comanda']).nullable(),
  }),
  biblioteca: z.object({ generat_la: z.string(), semnatura: z.string(), fisiere: z.number().int() }),
  aparat: Telemetrie.nullable(),
  viu: z.boolean(),
  comanda_versiune: z.number().int().nonnegative(),
  comanda_la: z.string(),
  comanda_de: z.string().nullable(),
  direct: StareDirect,
  ascultatori: NumarAscultatori.nullable(),
  pot_comanda: z.boolean(),
  super_admin: z.boolean(),
  acum: z.string(),
})
export type StarePanou = z.infer<typeof StarePanou>

/** Ce poate apăsa un administrator în panou. */
export const ActiunePanou = z.enum(['live', 'stop', 'oprit', 'director', 'piesa', 'urmatoarea', 'anterioara'])
export type ActiunePanou = z.infer<typeof ActiunePanou>

export const CererePanou = z.object({
  actiune: ActiunePanou,
  director: z.string().optional(),
  fisier: z.string().optional(),
})
export type CererePanou = z.infer<typeof CererePanou>
