import { pieseDin, toateDirectoarele } from '@xc/comanda'
import type { BibliotecaRadio, SunetAparat } from '@xc/contracts'

/**
 * ROTIREA ALBUMELOR — socoteala pură, ca radioul să nu cânte o veșnicie același director.
 *
 * Radioul e un CEAS, nu un aparat care schimbă piese (`ceSeAude` din `@xc/comanda`): selecția curge
 * în buclă de la `de`, la nesfârșit, cu `% total` peste piesele unui SINGUR director. E frumos cât
 * omul alege ce se aude — dar în zilele în care nimeni nu atinge panoul, parohia ascultă același
 * album zi și noapte (cerere a utilizatorului, 18.09.2026). De aceea, când radioul cântă
 * nesupravegheat, ceasul sare singur pe alt album, apoi pe altul la capătul fiecăruia.
 *
 * **DOUĂ CEASURI pornesc prima săritură** (alegerea utilizatorului, 18.09.2026: „amândouă"):
 *   - **o zi fără nicio comandă de om** (`FARA_OM_MS`) — merge și fără microfon, e regula de temelie;
 *   - **o oră de liniște în biserică** (`FARA_SUNET_MS`), socotită din `ultimul_sunet`, dar nu mai
 *     devreme de o oră de la ultima comandă: o apăsare de om cere din nou o oră întreagă de liniște.
 * Fără date de sunet (aparat vechi, microfon căzut) rămâne numai ceasul de o zi.
 *
 * ⚠️ **Odată pornită, rotirea nu se mai uită la sunet**: cât cântă un album pus de CEAS, la fiecare
 * capăt se sare mai departe, chiar dacă între timp s-a auzit lumea în biserică. Altfel un „bună
 * ziua" la ora trei ar îngheța rotirea pe albumul de atunci; pornirea e la liniște, oprirea e la
 * comandă de om — nimic altceva.
 *
 * Aici stă numai SOCOTEALA: când e scadentă rotirea, ce album se alege, când sună ceasul data
 * viitoare. Cine o pune în faptă e obiectul durabil `Aparat` (`aparat.ts`), și o face pe ACELAȘI
 * drum ca o comandă din panou — ceasul radioului prin `puneCeas`, apoi o versiune nouă de comandă
 * pentru aparatul din biserică. Așa boxele și telefoanele aud la fel, iar aparatul n-are nimic de
 * învățat: pentru el e o comandă `radio` ca oricare alta.
 *
 * ⚠️ **Contorul e al OMULUI, nu al aparatului.** Hotărârile luate singur de aparatul din biserică
 * (LIVE la ora slujbei, întoarcerea la radio) intră prin `preiaDecizia` și NU repun contorul la
 * zero: altfel o slujbă de duminică ar amâna rotirea cu încă o zi, fără să fi cerut nimeni nimic.
 *
 * ⚠️ **`ceSeAude` și contractul `AcumRadio` NU se ating.** Socoteala „ce se aude" rămâne ceas pur;
 * rotirea doar dă comenzi noi la momentele potrivite.
 */

/** O zi fără nicio comandă de om — de atunci încolo ceasul rotește albumele. */
export const FARA_OM_MS = 24 * 60 * 60 * 1000

/**
 * O oră de liniște în biserică — al doilea ceas al rotirii. Se socotește de la cea mai recentă
 * dintre: ultima activitate auzită de microfon și ultima comandă de om.
 */
export const FARA_SUNET_MS = 60 * 60 * 1000

/** Câte albume alese de ceas ținem minte, ca să nu se repete curând. */
export const ISTORIE_MAX = 3

/**
 * `cine` pe care îl scrie ceasul în selecție. E o valoare FIXĂ, nu un nume de om: după ea știe
 * panoul să spună „ales de ceas", și tot după ea se vede în jurnal că rotirea n-a cerut-o nimeni.
 */
export const CINE_CEAS = 'ceas'

/** Ce ține minte obiectul durabil despre rotire. */
export interface StareRotire {
  /** ISO — ultima comandă dată de un OM din panou. `null`: n-am apucat încă să vedem niciuna. */
  ultima_om: string | null
  /** Ultimele albume alese de ceas, cel mai nou întâi (cel mult `ISTORIE_MAX`). */
  istorie: string[]
}

export const ROTIRE_GOALA: StareRotire = { ultima_om: null, istorie: [] }

/**
 * Contorul cu care pornește un radio despre care nu știm NICIO comandă de om: o zi în urmă, adică
 * scadent pe loc (user, 18.09.2026: „să fie deja peste 24h"). Se scrie o singură dată, la prima
 * atingere a obiectului durabil — de acolo încolo contorul e al apăsărilor adevărate.
 */
export function contorulDeStart(acum: number): string {
  return new Date(acum - FARA_OM_MS).toISOString()
}

// --- sunetul din biserică ---------------------------------------------------------
/*
 * Măsurătoarea vine de la aparat, prin telemetrie, deci e DATE STRĂINE: o versiune nouă de daemon,
 * un microfon care întoarce `NaN`, un câmp uitat. Nimic din ce e stricat n-are voie să strice
 * telemetria întreagă (starea aparatului, deciziile lui) — se ignoră câmpul, se ține restul.
 */

/** Numai numerele adevărate trec; `NaN`, `Infinity`, text sau lipsă înseamnă „n-am măsurătoare". */
function numarSau(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}

/** Numai o dată care se poate citi trece, și trece ca ISO normalizat. */
function clipaSau(x: unknown): string | null {
  if (typeof x !== 'string') return null
  const t = Date.parse(x)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

/**
 * Curăță `sunet` din telemetrie. `null` = aparatul nu măsoară (sau ce-a trimis e de nefolosit):
 * atunci rotirea rămâne pe ceasul de o zi, ca înainte de microfon.
 */
export function sunetCurat(x: unknown): SunetAparat | null {
  if (!x || typeof x !== 'object') return null
  const s = x as Record<string, unknown>
  const curat: SunetAparat = {
    nivel: numarSau(s.nivel),
    varf: numarSau(s.varf),
    prag: numarSau(s.prag),
    ultimul_peste_prag: clipaSau(s.ultimul_peste_prag),
    fereastra_s: numarSau(s.fereastra_s),
  }
  // Un obiect din care n-a rămas nimic e tot una cu „nu măsoară" — nu-l arătăm ca măsurătoare.
  const ceva = Object.values(curat).some((v) => v !== null)
  return ceva ? curat : null
}

/**
 * ⚠️ `ultimul_sunet` e MONOTON: crește sau stă, niciodată nu scade.
 *
 * Aparatul îl ține în memorie și-l pierde la repornire; un `null` de la el înseamnă „nu știu", nu
 * „n-a fost nimic". Dacă l-am lăsa să șteargă ce știam, o repornire de daemon la trei noaptea ar
 * părea o oră de liniște abia începută și ar amâna rotirea — sau, mai rău, un ceas al aparatului dat
 * înapoi ar rescrie trecutul. Aici ținem MAXIMUL a tot ce am primit vreodată.
 */
export function ultimulSunetNou(vechi: string | null, venit: string | null | undefined): string | null {
  const nou = clipaSau(venit)
  if (!nou) return vechi
  const v = vechi ? Date.parse(vechi) : Number.NaN
  if (!Number.isFinite(v)) return nou
  return Date.parse(nou) > v ? nou : vechi
}

/** Pricina pentru care ar porni rotirea. */
export type MotivRotire = 'liniste' | 'comanda'

export interface ScadentaRotirii {
  /** Clipa (ms de epocă) în care ceasul de liniște ar porni rotirea; `null` = n-avem sunet. */
  liniste: number | null
  /** Clipa în care ceasul de o zi ar porni rotirea. */
  comanda: number
  /** Cea mai apropiată dintre ele — dacă a trecut, rotirea e scadentă chiar acum. */
  la: number
  /** A cui e clipa de mai sus. */
  motiv: MotivRotire
}

/**
 * CÂND ar porni rotirea, pe fiecare din cele două ceasuri, și care vine primul.
 *
 * Un singur loc în care se leagă: `ultima_om + o zi` și `max(ultimul_sunet, ultima_om) + o oră`.
 * A doua scadență se sprijină pe MAXIMUL dintre cele două clipe tocmai fiindcă o comandă de om cere
 * din nou o oră întreagă de liniște — altfel un Părinte care apasă ceva în biserică ar vedea albumul
 * schimbându-se peste câteva minute, din liniștea de dinainte.
 *
 * ⚠️ Fără nicio comandă de om știută, radioul se socotește **NEPĂZIT**, nu proaspăt atins: ziua fără
 * comandă se ia ca și trecută (`acum − FARA_OM_MS`), deci rotirea e scadentă pe loc (user,
 * 18.09.2026: „să fie deja peste 24h"). Un radio despre care nu ținem minte nicio apăsare n-a fost
 * atins de nimeni cât ține memoria noastră — n-are de ce să mai aștepte încă o zi ca să se dezmorțească.
 */
export function scadentaRotirii(x: {
  acum: number
  ultimaOm: string | null
  ultimulSunet?: string | null
}): ScadentaRotirii {
  const o = x.ultimaOm ? Date.parse(x.ultimaOm) : Number.NaN
  const om = Number.isFinite(o) ? o : x.acum - FARA_OM_MS
  const s = x.ultimulSunet ? Date.parse(x.ultimulSunet) : Number.NaN
  const comanda = om + FARA_OM_MS
  const liniste = Number.isFinite(s) ? Math.max(s, om) + FARA_SUNET_MS : null
  const la = liniste !== null ? Math.min(comanda, liniste) : comanda
  return { liniste, comanda, la, motiv: liniste !== null && liniste <= comanda ? 'liniste' : 'comanda' }
}

/**
 * ALBUMELE dintre care alege ceasul: directoarele care au piese CHIAR ÎN ELE.
 *
 * Pornim de la `toateDirectoarele` — aceeași listă pe care o vede panoul — și păstrăm numai pe cele
 * cu muzică proprie. ⚠️ Un director-părinte (`DIVERSE`, `01. Octoih`) ar trece de filtru dacă am
 * întreba `pieseDin`, fiindcă acela numără RECURSIV; atunci „albumul" ar fi jumătate de bibliotecă
 * și capătul lui n-ar mai veni niciodată. Cele goale nu se aleg, cum nu se aleg nici din panou.
 */
export function albumeDin(b: BibliotecaRadio): string[] {
  const cuMuzica = new Set<string>()
  for (const f of b.fisiere) {
    if (f.durata <= 0) continue
    const i = f.cale.lastIndexOf('/')
    if (i > 0) cuMuzica.add(f.cale.slice(0, i))
  }
  return toateDirectoarele(b).filter((d) => cuMuzica.has(d))
}

/** Cât ține un album de la un capăt la altul (secunde) — după el se socotește capătul. */
export function durataAlbumului(b: BibliotecaRadio, director: string | null): number {
  return pieseDin(b, director).reduce((t, f) => t + f.durata, 0)
}

/**
 * Alt album, la întâmplare. Se ocolesc cel care cântă acum ȘI ultimele alese de ceas; dacă
 * ocolindu-le n-ar mai rămâne nimic (bibliotecă mică), se renunță la istorie și se ocolește doar
 * cel curent. `null` = n-are încotro sări — un singur album, sau niciunul.
 */
export function alegeAlbum(
  albume: readonly string[],
  curent: string | null,
  istorie: readonly string[] = [],
  aleator: () => number = Math.random,
): string | null {
  const altele = albume.filter((d) => d !== curent)
  if (altele.length === 0) return null
  const proaspete = altele.filter((d) => !istorie.includes(d))
  const din = proaspete.length > 0 ? proaspete : altele
  const i = Math.min(din.length - 1, Math.max(0, Math.floor(aleator() * din.length)))
  return din[i] ?? null
}

/**
 * A venit vremea primei sărituri? A trecut ziua fără comandă, SAU ora de liniște (când avem sunet).
 *
 * Cât nu știm de nicio comandă de om, răspunsul e DA: necunoscut înseamnă nepăzit (vezi
 * `scadentaRotirii`), nu „poate tocmai a apăsat cineva".
 */
export function eScadentaRotirea(acum: number, ultimaOm: string | null, ultimulSunet: string | null = null): boolean {
  return acum >= scadentaRotirii({ acum, ultimaOm, ultimulSunet }).la
}

/**
 * Rotirea e PORNITĂ? Două întrebări, în ordinea asta:
 *   1. cântă acum un album pus de ceas (`aleasaDeCeas`) — atunci rotirea e în curs și merge mai
 *      departe la capătul fiecărui album, orice s-ar auzi în biserică;
 *   2. altfel, a venit vremea primei sărituri (`eScadentaRotirea`).
 *
 * ⚠️ Fără prima întrebare, un sunet auzit după pornire ar împinge ceasul de liniște în viitor și ar
 * opri rotirea în loc — deși singurul lucru care o oprește e o comandă de om.
 */
export function eRotireaPornita(x: {
  acum: number
  ultimaOm: string | null
  ultimulSunet?: string | null
  aleasaDeCeas: boolean
}): boolean {
  return x.aleasaDeCeas || eScadentaRotirea(x.acum, x.ultimaOm, x.ultimulSunet ?? null)
}

/**
 * Clipa în care albumul de acum ajunge la capăt și ar lua-o de la prima piesă: `de + n × total`, cu
 * `n` cel mai mic care trece de `acum`. Selecția curge în buclă, deci „capătul" vine iar și iar.
 *
 * Marginea de câteva secunde (alarma sună „la sau după") e primită: se schimbă albumul la sfârșitul
 * ultimei piese sau la începutul primei, nu în mijlocul uneia.
 */
export function capatAlbumului(de: number, totalS: number, acum: number): number {
  const durata = totalS * 1000
  if (durata <= 0) return acum
  // Ceas stricat: `ceSeAude` socotește de la începutul selecției, deci capătul e la o durată de acum.
  if (!Number.isFinite(de)) return acum + durata
  return de + Math.max(1, Math.ceil((acum - de) / durata)) * durata
}

/**
 * Când să sune ceasul data viitoare, în milisecunde de epocă. `null` = n-are ce roti (LIVE, OPRIT
 * sau o selecție fără muzică), iar alarma se stinge.
 *
 * Două cazuri, în ordinea asta:
 *   - **încă nu e vremea**: ne trezim la cea mai apropiată dintre cele două scadențe (ziua fără
 *     comandă și ora de liniște);
 *   - **rotirea e pornită** (a trecut vremea, ori cântă deja un album al ceasului): ne trezim la
 *     capătul albumului care cântă acum.
 *
 * ⚠️ Alarma pusă aici e o socoteală de ACUM, iar `ultimul_sunet` se schimbă între timp, la fiecare
 * bătaie de telemetrie. Nu se reprogramează la fiecare bătaie (ar fi o scriere la 20 s degeaba): ne
 * trezim când credeam, recitim tot și, dacă sunetul a mutat scadența, ne culcăm la loc până la ea.
 * Așa alarma „urmărește" liniștea cu cel mult o oră în urmă, fără nicio scriere în plus.
 */
export function urmatoareaRotire(x: {
  acum: number
  ultimaOm: string | null
  ultimulSunet?: string | null
  /** Cântă deja un album pus de ceas? Atunci nu se mai așteaptă nicio scadență — doar capătul lui. */
  aleasaDeCeas?: boolean
  pornit: boolean
  de: string
  totalS: number
}): number | null {
  if (!x.pornit || x.totalS <= 0) return null
  if (!x.aleasaDeCeas) {
    const { la } = scadentaRotirii({ acum: x.acum, ultimaOm: x.ultimaOm, ultimulSunet: x.ultimulSunet ?? null })
    if (x.acum < la) return la
  }
  return capatAlbumului(Date.parse(x.de), x.totalS, x.acum)
}
