import type { SunetAparat } from '@xc/contracts'

/**
 * ISTORICUL SUNETULUI — punctele din care se desenează graficul de pe `/mic` (cerut de utilizator
 * pe 18.09.2026, „să facem grafic", după ce monitorul arăta doar cifra de acum).
 *
 * Aici stă numai SOCOTEALA: cum se cheamă cheia unei ore, ce chei atinge un interval, care se
 * mătură la 7 zile, cum se taie o oră la 180 de puncte și cum se compune răspunsul rutei. Scrierea
 * și citirea le face obiectul durabil `Aparat` (`aparat.ts`) — ca la `rotire.ts`, socoteala se poate
 * proba în Node, faptele nu.
 *
 * ⚠️ **DE CE PE CHEI ORARE, nu un singur șir.** O valoare de storage a unui obiect durabil are
 * limita de **128 KB**, iar telemetria bate la 20 s. Un array ținut într-o singură cheie ar fi
 * rescris ÎNTREG la fiecare bătaie (la 7 zile: ~1,2 MB scriși de 4320 de ori pe zi) și ar depăși
 * oricum limita după vreo zi și jumătate. Pe chei orare se rescrie doar ora curentă (~7 KB), citirea
 * ia numai orele din fereastra cerută, iar ștergerea e o tăietură lexicografică: cheia poartă ora în
 * ea (`sunet:AAAA-LL-ZZTHH`, UTC), deci ordinea alfabetică a cheilor E ordinea cronologică.
 *
 * ⚠️ **Ora din cheie e UTC**, nu ora bisericii. Cheia e un sertar, nu o etichetă citită de om:
 * în UTC nu există ora care se repetă la trecerea la ora de iarnă (ar amesteca două ore într-un
 * sertar) și nici cea care lipsește primăvara. Ceasul pe care-l vede omul se face la desenare, în
 * `Europe/Bucharest` (v. `mic.ts`).
 */

const ORA_MS = 60 * 60 * 1000

/** Toate cheile istoricului încep cu asta — și numai ele. */
export const PREFIX_SUNET = 'sunet:'

/** Cheia în care scriem ce oră e acum; se schimbă o dată pe oră și atunci se face curățenia. */
export const CHEIE_ORA_CURENTA = 'ora_sunet'

/** Cât ținem minte. Mai vechi de atât se șterge la prima trecere într-o oră nouă. */
export const ISTORIC_ZILE = 7

/**
 * Cât încape într-o oră: aparatul bate la 20 s, adică fix 180 de puncte. Un daemon care ar bate mai
 * des nu umflă cheia peste limită — se păstrează cele mai NOI 180 (v. `adaugaPunct`).
 */
export const PUNCTE_PE_ORA = 180

/** Ritmul telemetriei, în secunde — din el iese pasul dintre punctele desenate. */
export const PAS_TELEMETRIE_S = 20

/** Ferestrele pe care le poate cere pagina, în ore. Orice altceva cade pe cea implicită. */
export const ORE_VOIE = [6, 24, 168] as const
export const ORE_IMPLICIT = 24

/**
 * Câte puncte trimitem cel mult într-un răspuns. Graficul are sub 900 px lățime, deci mai multe
 * puncte n-ar desena nimic în plus — ar face doar un răspuns de câteva sute de KB la fiecare minut.
 * La 7 zile ar veni 30.240 de puncte brute; se rarefiază (v. `rareste`).
 */
export const MAX_PUNCTE = 1200

/** Un punct din grafic. */
export interface PunctSunet {
  /**
   * ISO — clipa în care a AJUNS telemetria, după ceasul workerului, nu după al aparatului.
   * ⚠️ Dinadins: ceasul aparatului se poate da înapoi la repornire (tot pricina pentru care
   * `ultimul_sunet` e monoton, v. `rotire.ts`), iar un ceas dat înapoi ar împrăștia punctele pe
   * axă și le-ar scrie în sertarul altei ore.
   */
  la: string
  /** RMS mediu pe fereastră, dBFS (număr negativ). */
  nivel: number
  /** Vârful pe aceeași fereastră, dBFS; `null` dacă aparatul nu l-a măsurat. */
  varf: number | null
}

/** Răspunsul rutei `GET /mic/sunet?ore=…`. */
export interface IstoricSunet {
  /** Pragul de activitate al APARATULUI, din ultima telemetrie; `null` dacă nu-l știm. */
  prag: number | null
  de_la: string
  pana_la: string
  /**
   * Câte secunde sunt, de drept, între două puncte vecine: 20 cât se trimit brute, mai mult după
   * rarefiere. Pagina rupe linia când distanța dintre două puncte trece mult peste el — fără
   * numărul ăsta, o fereastră de 7 zile ar părea numai goluri.
   */
  pas_s: number
  puncte: PunctSunet[]
}

/** Numerele care se pot desena; restul (lipsă, `NaN`) se socotesc „nemăsurat". */
function numar(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}

/** O zecimală ajunge pentru dBFS — și taie jumătate din octeții scriși la fiecare 20 s. */
function rotunjit(x: number): number {
  return Math.round(x * 10) / 10
}

/**
 * Cheia orei în care cade o clipă: `sunet:AAAA-LL-ZZTHH`, UTC. Se sortează alfabetic în ordine
 * cronologică — pe asta se sprijină și citirea pe interval, și ștergerea celor vechi.
 */
export function cheiaOrei(t: number | string): string {
  const ms = typeof t === 'number' ? t : Date.parse(t)
  return PREFIX_SUNET + new Date(Number.isFinite(ms) ? ms : 0).toISOString().slice(0, 13)
}

/** Prima cheie care NU mai intră în interval — `end`-ul citirii, care la `list` e exclusiv. */
export function dupaOra(t: number): string {
  return cheiaOrei(t + ORA_MS)
}

/**
 * Cheile orare atinse de intervalul `[deLa, panaLa]` — exact atâtea se citesc pentru un grafic.
 * Prima e ora în care cade `deLa` (punctele dinaintea lui se aruncă la compunere), ultima e ora lui
 * `panaLa`.
 */
export function cheileDin(deLa: number, panaLa: number): string[] {
  if (!Number.isFinite(deLa) || !Number.isFinite(panaLa) || panaLa < deLa) return []
  const chei: string[] = []
  const maxim = 24 * ISTORIC_ZILE + 2
  for (let t = Math.floor(deLa / ORA_MS) * ORA_MS; t <= panaLa && chei.length < maxim; t += ORA_MS) {
    chei.push(cheiaOrei(t))
  }
  return chei
}

/** Marginea vechimii: cheile strict mai mici decât asta au trecut de cele 7 zile și se șterg. */
export function limitaVechimii(acum: number): string {
  return cheiaOrei(acum - ISTORIC_ZILE * 24 * ORA_MS)
}

/**
 * Care din cheile date sunt de șters. ⚠️ Se cere `startsWith`: obiectul durabil mai are chei
 * (`comanda`, `stare`, `rotire`, `alarme`), iar o măturare care le-ar prinde ar șterge starea
 * emisiei, nu niște puncte de grafic.
 */
export function cheiDeSters(chei: Iterable<string>, acum: number): string[] {
  const limita = limitaVechimii(acum)
  return [...chei].filter((c) => c.startsWith(PREFIX_SUNET) && c < limita)
}

/**
 * Punctul de scris pentru o telemetrie, sau `null` dacă n-are ce desena. Fără `nivel` măsurat nu e
 * punct: o linie dusă prin „nemăsurat" ar minți mai tare decât un gol în grafic.
 */
export function punctDin(acum: number, s: SunetAparat | null): PunctSunet | null {
  const nivel = numar(s?.nivel)
  if (nivel === null || !Number.isFinite(acum)) return null
  const varf = numar(s?.varf)
  return { la: new Date(acum).toISOString(), nivel: rotunjit(nivel), varf: varf === null ? null : rotunjit(varf) }
}

/** Adaugă punctul la ora lui, ținând cheia sub limită: rămân cele mai NOI `PUNCTE_PE_ORA`. */
export function adaugaPunct(puncte: readonly PunctSunet[] | undefined, p: PunctSunet): PunctSunet[] {
  return [...(puncte ?? []), p].slice(-PUNCTE_PE_ORA)
}

/** Câte ore a cerut pagina. Orice în afara listei (lipsă, text, 10000) cade pe cele 24 implicite. */
export function oreCerute(x: string | null | undefined): number {
  const n = Number(x)
  return (ORE_VOIE as readonly number[]).includes(n) ? n : ORE_IMPLICIT
}

/**
 * RARIFIEREA, pentru ferestrele lungi: se strâng câte `factor` puncte vecine într-unul singur, cu
 * MAXIMUL fiecărei mărimi.
 *
 * ⚠️ Maximul, nu media: pagina asta e un monitor de PRAG — întrebarea omului e „a trecut vocea
 * peste −60?", iar o medie pe un sfert de oră ar îneca tocmai vârful pentru care se uită la grafic.
 * Liniștea nu se pierde: o bucată în care nu s-a auzit nimic n-are ce maxim să ridice.
 *
 * Se strânge după NUMĂR de puncte, nu după felii de timp, tocmai ca golurile să rămână goluri: o
 * pană de telemetrie nu naște bucăți goale, ci lasă două puncte vecine depărtate, iar pagina rupe
 * linia acolo (v. `pas_s`).
 */
export function rareste(puncte: readonly PunctSunet[], maxim: number = MAX_PUNCTE): { pas_s: number; puncte: PunctSunet[] } {
  const prag = Math.max(1, Math.floor(maxim))
  const factor = Math.max(1, Math.ceil(puncte.length / prag))
  if (factor === 1) return { pas_s: PAS_TELEMETRIE_S, puncte: [...puncte] }
  const iesire: PunctSunet[] = []
  for (let i = 0; i < puncte.length; i += factor) {
    const felie = puncte.slice(i, i + factor)
    let ales = felie[0] as PunctSunet
    let varf: number | null = null
    for (const p of felie) {
      if (p.nivel > ales.nivel) ales = p
      const v = numar(p.varf)
      if (v !== null && (varf === null || v > varf)) varf = v
    }
    iesire.push({ la: ales.la, nivel: ales.nivel, varf })
  }
  return { pas_s: factor * PAS_TELEMETRIE_S, puncte: iesire }
}

/**
 * Compune răspunsul rutei din bucățile orare citite din storage: se leagă, se taie la fereastra
 * cerută, se pun în ordine și se rarefiază. Bucățile vin de la `list`, deci deja în ordinea cheilor;
 * sortarea de aici păzește doar cazul în care ceasul a mai umblat.
 */
export function compuneIstoric(
  bucati: Iterable<readonly PunctSunet[] | undefined>,
  x: { deLa: number; panaLa: number; prag: number | null; maxim?: number },
): IstoricSunet {
  const toate: PunctSunet[] = []
  for (const bucata of bucati) {
    for (const p of bucata ?? []) {
      const nivel = numar(p?.nivel)
      const t = Date.parse(p?.la ?? '')
      if (nivel === null || !Number.isFinite(t) || t < x.deLa || t > x.panaLa) continue
      toate.push({ la: p.la, nivel, varf: numar(p.varf) })
    }
  }
  toate.sort((a, b) => (a.la < b.la ? -1 : a.la > b.la ? 1 : 0))
  const { pas_s, puncte } = rareste(toate, x.maxim ?? MAX_PUNCTE)
  return {
    prag: x.prag,
    de_la: new Date(x.deLa).toISOString(),
    pana_la: new Date(x.panaLa).toISOString(),
    pas_s,
    puncte,
  }
}
