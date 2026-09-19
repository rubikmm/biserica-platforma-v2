/**
 * SCHIȚA NUMĂRULUI NOU — foaia de lucru în care chatul strânge răspunsurile omului.
 *
 * Cererea userului (18.09.2026): formularul de pe `/nou` IESE cu totul, iar completările trec toate
 * prin bula de chat, ca un CHESTIONAR standard pornit de comanda „buletin nou": întrebări trimise
 * automat, în ordine, citite de AI, cu răspunsurile strânse aici.
 *
 * ⚠️ DE CE PE SERVER ȘI NU ÎN CONTEXTUL MODELULUI (hotărârea care ține tot restul): „partea grea o
 * duce codul, modelul doar potrivește fraza cu un subiect". Fiecare răspuns se scrie pe loc în
 * schița numărului care urmează, deci:
 *   - textul omului rămâne LITERĂ CU LITERĂ, cum l-a lipit — nu trece prin nicio rescriere;
 *   - discuția se poate relua a doua zi, de pe alt telefon: starea nu e în discuție, e aici;
 *   - modelul nu cară niciodată articolul prin context, deci modelul mic (glm-5.3-flash, gratuit)
 *     e destul: el vede o întrebare și un subiect, nu zece mii de semne.
 *
 * ⚠️ „SCHIȚĂ", NU „CIORNĂ". Numele „ciornă" e luat de mai înainte, în aplicația asta, pentru
 * PDF-ul compus și nevalidat (`ciornaDinDepozit`, `<section class="ciorna">`). Schița e altce: ce
 * s-a răspuns, ca date. Din schiță iese ciorna, nu invers.
 *
 * ⚠️ ÎN R2, NU ÎN D1 (18.09.2026, seara): o coloană nouă ar fi cerut o migrație pe producție într-o
 * seară în care se publică și alte lucruri. Forma e un JSON sub `schita/<nr>-<data>.json`, lângă
 * PDF-ul și cererea numărului. Se poate muta într-un rând D1 mai târziu fără să se schimbe nimic
 * din ce urmează: tot codul de aici vorbește cu `citesteSchita` / `scrieSchita` / `stergeSchita`.
 *
 * ⚠️ MAȘINA DE STĂRI E DETERMINISTĂ. `urmatoareaIntrebare` nu cheamă nimic și nu ghicește: din ce
 * scrie în schiță iese o singură întrebare următoare. Așa chestionarul se poate proba cap-coadă
 * fără model, fără rețea și fără depozit — iar dacă modelul cheamă de două ori același subiect, nu
 * se strică nimic.
 */
import { LUNI } from '@xc/ui'
import { SECUNDARI_MAXIM, type NumarCerut, semne, socoteste } from './masuri.js'
import { CAMPURI_CU_VARIANTE, eRefuz } from './refuz.js'
import { DE_PROBA, TEXT_IMPLICIT, eDeProba } from './umplere.js'

// ---------------------------------------------------------------------------
// Întrebările standard — și locurile lor de completat
// ---------------------------------------------------------------------------

/** Subiectele care au o ÎNTREBARE a chestionarului. Restul (`nota`, `poza`) se dau oricând. */
export const CHEI_INTREBARI = [
  'motto', 'text', 'autor', 'ani', 'pomenire', 'titlu', 'sursa', 'mai_adaugam',
] as const
export type CheieIntrebare = (typeof CHEI_INTREBARI)[number]

/**
 * CELE OPT ÎNTREBĂRI, în ordinea și în spiritul cerut de user (18.09.2026). Sunt EDITABILE din
 * Setări → „Chestionarul buletinului nou": textul de aici e doar punctul de pornire.
 *
 * Locurile de completat, scrise între acolade, se umplu de server ÎNAINTE ca întrebarea să plece
 * spre model — el n-are de căutat nimic, doar de pus întrebarea:
 *   {motto} {autor} {ani} {pomenire} {titluri} {sursa}
 *   {articol} — despre ce articol e vorba: „principal din acest buletin", „articolului secundar 1"
 */
export const INTREBARI_STANDARD: Record<CheieIntrebare, string> = {
  motto: 'Motto-ul: „{motto}" ({autor}). Rămâne așa sau introducem altul?',
  text: 'Care este textul {articol}?',
  autor: 'Am observat că autorul este {autor}. Este corect, îl folosim?',
  ani: 'Am găsit că a trăit între anii {ani}, este corect? Folosim?',
  pomenire: 'Am găsit că este prăznuit în calendarul ortodox la {pomenire}, este corect? Adăugăm?',
  titlu: 'Acestea sunt 3 posibile titluri: {titluri} — sintetizate din text. Folosim unul sau ai altă idee?',
  sursa: 'Am găsit că sursa textului este {sursa}. Este corect? Vrei să modifici ceva?',
  mai_adaugam: 'Mai adăugăm alte texte? (da/nu)',
}

/**
 * Ce se întreabă când CODUL n-a găsit nimic de propus. Nu sunt în Setări dinadins: sunt scurte,
 * n-au locuri de completat și n-au ce regla — dacă n-avem propunere, întrebarea e cea simplă.
 */
export const INTREBARI_SIMPLE: Partial<Record<CheieIntrebare, string>> = {
  motto: 'Care este motto-ul numărului?',
  autor: 'Cine e autorul {articol}?',
  ani: 'Știi anii vieții? (sau „nu")',
  sursa: 'Care e sursa textului? (sau „nu")',
}

/** Cheia din KV `CONFIG` sub care stau întrebările schimbate de adminul buletinului. */
export const CHEIE_CHESTIONAR = 'buletin:chestionar'

export type Chestionar = Partial<Record<CheieIntrebare, string>>

/**
 * Ce s-a scris în Setări, curățat: numai cheile știute, numai text, tăiat la 600 de semne. Un
 * câmp lăsat gol NU e o întrebare goală — înseamnă „ține textul standard".
 */
export function normalizeazaChestionar(brut: unknown): Chestionar {
  const o = (brut ?? {}) as Record<string, unknown>
  const c: Chestionar = {}
  for (const cheie of CHEI_INTREBARI) {
    const v = o[cheie]
    if (typeof v !== 'string') continue
    const text = v.replace(/\s+/g, ' ').trim().slice(0, 600)
    if (text && text !== INTREBARI_STANDARD[cheie]) c[cheie] = text
  }
  return c
}

/** Întrebările de folosit acum: standardul, cu ce a schimbat adminul peste el. */
export function intrebarile(c?: Chestionar | null): Record<CheieIntrebare, string> {
  return { ...INTREBARI_STANDARD, ...(c ?? {}) }
}

// ---------------------------------------------------------------------------
// Forma schiței
// ---------------------------------------------------------------------------

/** Cele trei locuri de articol ale unui număr. */
export type Articol = 'principal' | 's1' | 's2'

/** Cum se numesc zonele în socoteală (`masuri.ts`) și în vorbele omului. */
export const NUMELE_ZONEI: Record<Articol, string> = {
  principal: 'principal',
  s1: 'secundar 1',
  s2: 'secundar 2',
}

/** Cum se numește articolul în întrebare, la locul `{articol}`. */
export const NUMELE_IN_INTREBARE: Record<Articol, string> = {
  principal: 'principal din acest buletin',
  s1: 'articolului secundar 1',
  s2: 'articolului secundar 2',
}

export interface ArticolSchitei {
  autor?: string
  ani?: string
  /** ultimul rând al zonei negre, cu cruce: „† 16 august" */
  pomenire?: string
  titlu?: string
  text?: string
  sursa?: string
  /** mențiunea de deasupra sursei */
  nota?: string
  /** ADRESA pozei (nu da/nu): poza se dă ca URL, ca până acum */
  poza?: string
  /**
   * Subiectele deja HOTĂRÂTE pentru articolul ăsta — răspunse, păstrate sau sărite. Din ele iese
   * întrebarea următoare. ⚠️ „Sărit" trebuie ținut minte: altfel un „nu" la autor ar face
   * chestionarul să întrebe iar, la nesfârșit.
   */
  gata?: CheieIntrebare[]
  /**
   * Ce a găsit CODUL în calendarul parohiei pentru autorul ăsta: `undefined` = n-am căutat încă,
   * `''` = am căutat și nu e sfânt (întrebarea se sare), altfel ziua găsită („16 august").
   */
  pomenireCautata?: string
}

export interface Schita {
  /** numărul care urmează, din arhivă; `null` când arhiva e goală */
  nr: number | null
  data: string
  motto?: string
  motoAutor?: string
  principal: ArticolSchitei
  /** cel mult `SECUNDARI_MAXIM` */
  secundari: ArticolSchitei[]
  /** subiectele numărului (nu ale unui articol) deja hotărâte: `motto`, `mai_adaugam` */
  gata?: CheieIntrebare[]
  /**
   * UNDE S-A RĂMAS, scris la fiecare salvare. ⚠️ E o copie a ce spune `urmatoareaIntrebare`, ținută
   * ca să se poată citi schița fără să se mai socotească nimic (ecranul `/nou`, o privire în
   * depozit). Adevărul rămâne al mașinii de stări, nu al câmpului ăsta.
   */
  pas?: { subiect: CheieIntrebare | 'gata'; articol: Articol }
  actualizat: string
}

/** Cheia din depozit. `nr` lipsă (arhivă goală) se scrie `0`: tot un număr, tot o cheie bună. */
export const cheiaSchitei = (n: { nr: number | null; data: string }): string =>
  `schita/${n.nr ?? 0}-${n.data}.json`

/** Câte semne se primesc într-un câmp. Textul unui articol nu trece de atât nici pe hârtie. */
const MAXIM_TEXT = 40_000
const MAXIM_CAMP = 400

export interface EnvSchita {
  FISIERE: R2Bucket
  /** Calendarul parohiei: de la el se află ziua de pomenire a autorului (`/v1/cauta`). */
  CALENDAR?: Fetcher
}

/** O schiță nouă, cu motto-ul numărului trecut pus deja în ea — el e răspunsul implicit la 1. */
export function schitaGoala(n: {
  nr: number | null
  data: string
  motto?: string | null
  motoAutor?: string | null
}): Schita {
  return {
    nr: n.nr,
    data: n.data,
    ...(n.motto ? { motto: n.motto } : {}),
    ...(n.motoAutor ? { motoAutor: n.motoAutor } : {}),
    principal: {},
    secundari: [],
    gata: [],
    actualizat: new Date().toISOString(),
  }
}

/**
 * ARTICOLUL PRINCIPAL AL VARIANTEI ZERO — fiecare câmp cu locul lui ocupat, ca numărul să se poată
 * compune din prima clipă (user, 19.09.2026: „toate câmpurile să aibă ceva implicit ca să poți
 * genera varianta 0 de buletin").
 *
 * ⚠️ Pomenirea, mențiunea și poza NU primesc nimic: ele chiar lipsesc din multe numere adevărate,
 * deci un loc ocupat acolo ar fi o minciună pe hârtie, nu un ajutor. O adresă de poză inventată ar
 * lăsa, pe deasupra, un pătrat gol în foaie, fără nicio eroare nicăieri.
 */
export const ARTICOLUL_IMPLICIT = (): ArticolSchitei => ({
  autor: DE_PROBA.autor,
  ani: DE_PROBA.ani,
  titlu: DE_PROBA.titlu,
  text: TEXT_IMPLICIT,
  sursa: DE_PROBA.sursa,
})

/**
 * SCHIȚA IMPLICITĂ — cea care se scrie la PRIMA intrare pe `/nou` (user, 19.09.2026).
 *
 * E schița goală, cu locurile ocupate: motto-ul numărului trecut (mecanismul dinainte) și un articol
 * principal de probă, cu textul „text". Din ea iese VARIANTA ZERO a numărului, fără să se fi răspuns
 * la nicio întrebare.
 *
 * ⚠️ `gata` RĂMÂNE GOL — asta ține chestionarul în viață: mașina de stări întreabă mai departe de la
 * motto încolo, iar fiecare răspuns scrie peste locul lui. Dacă valorile astea ar fi fost însemnate
 * ca hotărâte, numărul zero ar fi fost și numărul final, iar bula n-ar mai fi avut ce întreba.
 */
export function schitaImplicita(n: {
  nr: number | null
  data: string
  motto?: string | null
  motoAutor?: string | null
}): Schita {
  return { ...schitaGoala(n), principal: ARTICOLUL_IMPLICIT() }
}

/**
 * SCHIȚA LA CARE OMUL N-A RĂSPUNS ÎNCĂ NIMIC — cea implicită, neatinsă.
 *
 * De ea atârnă compunerea de la sine a variantei zero: ecranul `/nou` o pornește NUMAI aici. Odată ce
 * omul a răspuns ceva, compunerea rămâne a lui (butonul ori chatul) — altfel un text prea lung ar
 * porni, la fiecare reîncărcare de pagină, o randare care se știe dinainte că va fi refuzată.
 */
export function eSchitaNeatinsa(s: Schita): boolean {
  if ((s.gata ?? []).length > 0 || s.secundari.length > 0) return false
  const a = s.principal
  return (a.gata ?? []).length === 0 && !a.nota && !a.poza && !a.pomenire
}

/** Ce scrie în depozit, adus la forma de acum. `null` când n-a fost începută nicio schiță. */
export async function citesteSchita(
  env: EnvSchita,
  n: { nr: number | null; data: string },
): Promise<Schita | null> {
  const obiect = await env.FISIERE.get(cheiaSchitei(n))
  if (!obiect) return null
  const brut = await obiect.json<Partial<Schita>>().catch(() => null)
  if (!brut) return null
  return {
    nr: typeof brut.nr === 'number' ? brut.nr : n.nr,
    data: typeof brut.data === 'string' ? brut.data : n.data,
    ...(brut.motto ? { motto: String(brut.motto) } : {}),
    ...(brut.motoAutor ? { motoAutor: String(brut.motoAutor) } : {}),
    principal: (brut.principal ?? {}) as ArticolSchitei,
    secundari: (Array.isArray(brut.secundari) ? brut.secundari : []).slice(0, SECUNDARI_MAXIM),
    gata: Array.isArray(brut.gata) ? (brut.gata as CheieIntrebare[]) : [],
    ...(brut.pas ? { pas: brut.pas } : {}),
    actualizat: typeof brut.actualizat === 'string' ? brut.actualizat : new Date().toISOString(),
  }
}

export async function scrieSchita(env: EnvSchita, s: Schita, pas?: Schita['pas']): Promise<void> {
  const deScris: Schita = { ...s, ...(pas ? { pas } : {}), actualizat: new Date().toISOString() }
  await env.FISIERE.put(cheiaSchitei(s), JSON.stringify(deScris), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: { nr: String(s.nr ?? 0), data: s.data },
  })
}

/**
 * ⚠️ Schița se șterge LA VALIDARE, nu la compunere: până se publică numărul, omul mai recompune de
 * câteva ori, iar a doua compunere pornește tot de la ce a răspuns.
 */
export async function stergeSchita(env: EnvSchita, n: { nr: number | null; data: string }): Promise<void> {
  await env.FISIERE.delete(cheiaSchitei(n)).catch(() => undefined)
}

export const articolul = (s: Schita, care: Articol): ArticolSchitei =>
  care === 'principal' ? s.principal : (s.secundari[care === 's1' ? 0 : 1] ?? {})

/** Articolele pe care le are schița acum, în ordinea foii. */
export function articolele(s: Schita): Articol[] {
  return ['principal', ...s.secundari.map((_, i): Articol => (i === 0 ? 's1' : 's2'))]
}

// ---------------------------------------------------------------------------
// Euristicile — ce propune CODUL, ca modelul să n-aibă de gândit
// ---------------------------------------------------------------------------

const randurile = (text: string): string[] =>
  (text ?? '').split(/\r?\n/).map((r) => r.trim()).filter(Boolean)

const curata = (s: string): string =>
  s.replace(/\s+/g, ' ').trim().replace(/^[„"'\-–—†\s]+/, '').replace(/[„"'\s]+$/, '').slice(0, 120)

/** Un rând care spune de unde e luat textul — nu e nici autor, nici titlu. */
const eRandDeSursa = (r: string): boolean => /^\s*(sursa|sursă|surse|din)\s*[:：]/i.test(r)

/**
 * AUTORUL, propus din text.
 *
 * ⚠️ Se încearcă ULTIMUL rând scurt înaintea primului: într-un articol lipit de pe un site,
 * primul rând e aproape totdeauna TITLUL, iar semnătura stă la sfârșit. Invers, ecranul ar propune
 * titlul ca autor la aproape fiecare număr.
 *
 * `null` = codul n-a găsit nimic; atunci propune modelul, iar dacă nici el, se întreabă simplu.
 */
export function autorPropus(text: string): string | null {
  const t = (text ?? '').trim()
  // ⚠️ Locul textului („text", din schița implicită) NU e un text: regula 3 de mai jos ar vedea în el
  // un rând scurt fără punct, adică un nume, și ar propune „text" drept autor al numărului.
  if (!t || eDeProba(t)) return null
  const r = randurile(t)
  const ultim = r[r.length - 1] ?? ''
  const prim = r[0] ?? ''

  // 1. „de Cutare" — forma cea mai des scrisă la semnătură
  for (const rand of [ultim, prim]) {
    const m = /^(?:de|De|DE)\s+([^,;.]{3,60})$/.exec(rand)
    if (m) return curata(m[1]!)
  }

  /*
   * 2. un nume cu titlu bisericesc, oriunde în capul textului.
   * ⚠️ Legăturile mici din nume („de", „din", „cel") se iau CU numele: fără ele, „Sfântul Ioan Gură
   * de Aur" s-ar tăia la „Sfântul Ioan Gură", iar căutarea în calendar n-ar mai nimeri nimic.
   */
  const m = /(Sfântul|Sfânta|Sfinții|Cuviosul|Cuvioasa|Părintele|Preacuviosul|Arhimandritul|Protosinghelul|Ierarhul|Episcopul|Mitropolitul|Patriarhul)\s+([A-ZȘȚĂÎÂ][^\s,;.]*(?:\s+(?:de|din|cel|al|a)\s+[A-ZȘȚĂÎÂ][^\s,;.]*|\s+[A-ZȘȚĂÎÂ][^\s,;.]*){0,3})/u
    .exec(t.slice(0, 500))
  if (m) return curata(`${m[1]!} ${m[2]!}`)

  // 3. un rând scurt, fără punct la capăt și fără verbe de frază — arată ca un nume
  for (const rand of [ultim, prim]) {
    if (!rand || rand.length > 60 || eRandDeSursa(rand)) continue
    if (/[.!?:]$/.test(rand)) continue
    if (/\s(și|care|este|sunt|a\s+fost|nu)\s/i.test(rand)) continue
    return curata(rand)
  }
  return null
}

/** ANII VIEȚII, dacă textul îi poartă: „(347-407)", „1661 – 1729". */
export function aniiPropusi(text: string): string | null {
  const m = /\b(\d{3,4})\s*[-–—]\s*(\d{3,4})\b/.exec(text ?? '')
  if (!m) return null
  const de = Number(m[1]), la = Number(m[2])
  // sub 100 sunt trimiteri la Scriptură ori numere de pagină, nu ani; peste 2100 nu e o viață
  if (de < 100 || la < de || la > 2100) return null
  return `${de}-${la}`
}

const taieLaCuvant = (s: string, cat: number): string => {
  if (s.length <= cat) return s
  const t = s.slice(0, cat)
  const spatiu = t.lastIndexOf(' ')
  return (spatiu > cat / 2 ? t.slice(0, spatiu) : t).trim()
}

/**
 * TITLURI CANDIDATE, ieftine: primul rând (dacă e scurt și fără punct final), un rând scris tot cu
 * majuscule (în foaia parohiei acela CHIAR e titlul) și prima propoziție tăiată la ~60 de semne.
 * Cel mult trei, fără duplicate. Lista poate ieși și cu una singură — atunci completează modelul.
 */
export function titluriPropuse(text: string): string[] {
  const t = (text ?? '').trim()
  if (!t) return []
  const r = randurile(t)
  const out: string[] = []
  const pune = (brut: string | null | undefined): void => {
    const c = curata(brut ?? '').replace(/[.,;:]+$/, '')
    if (c.length < 6 || c.length > 80) return
    if (out.some((x) => x.toLowerCase() === c.toLowerCase())) return
    out.push(c)
  }

  const prim = r[0]
  if (prim && prim.length <= 80 && !/[.!?]$/.test(prim) && !eRandDeSursa(prim)) pune(prim)
  pune(r.find((rand) => rand.length >= 6 && rand.length <= 80 && rand === rand.toUpperCase() && /[A-ZȘȚĂÎÂ]/.test(rand)))
  const prima = /^[^.!?]{10,400}[.!?]/.exec(t.replace(/\s+/g, ' '))
  if (prima) pune(taieLaCuvant(prima[0]!.replace(/[.!?]$/, ''), 60))
  return out.slice(0, 3)
}

const TLD_CUNOSCUT = /\.(ro|com|org|net|md|eu|info|gr|ru|it|fr|de|uk|tv)(\/|$|\b)/i

/** SURSA, din text: „Sursa: …", „din: …" sau un domeniu scris în el. */
export function sursaPropusa(text: string): string | null {
  const t = text ?? ''
  const cuNume = /(?:^|\n)\s*(?:Sursa|Sursă|SURSA)\s*[:：]\s*([^\n]{2,120})/.exec(t)
  if (cuNume) return curata(cuNume[1]!)
  const cuDin = /(?:^|\n)\s*(?:preluat\s+)?(?:din|Din|DIN)\s*[:：]\s*([^\n]{2,120})/.exec(t)
  if (cuDin) return curata(cuDin[1]!)
  const domeniu = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s)„"]*)?)/i.exec(t)
  if (domeniu && TLD_CUNOSCUT.test(domeniu[1]!)) return curata(domeniu[1]!)
  return null
}

/** Ziua scrisă cum stă în zona neagră: „16 august". */
export const ziLuna = (data: string): string => {
  const [, l, z] = data.split('-').map(Number) as [number, number, number]
  return `${z} ${LUNI[l - 1] ?? ''}`.trim()
}

/**
 * NUMELE DE CĂUTAT ÎN CALENDAR. Se scot titlurile bisericești din față: calendarul scrie „Sfântul
 * Ierarh Ioan Gură de Aur", deci căutarea după tot „Sfântul Ioan Gură de Aur" n-ar nimeri nimic,
 * pe când „Ioan Gură de Aur" e chiar înăuntru.
 */
export function numeDeCautat(autor: string): string {
  return (autor ?? '')
    .replace(/†/g, ' ')
    .replace(/\b(sfântul|sfânta|sfinții|sfântului|cuviosul|cuvioasa|părintele|preacuviosul|preacuvioasa|arhimandritul|protosinghelul|ierarhul|episcopul|mitropolitul|patriarhul|mucenicul|mucenița|mare|marele|apostolul|proorocul|prorocul)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * ZIUA DE POMENIRE, cerută CALENDARULUI (nu ghicită de model): `GET /v1/cauta?q=…&an=…` prin
 * Service Binding. `null` înseamnă „nu e sfânt în calendarul parohiei, ori calendarul n-a
 * răspuns" — atunci întrebarea se sare, nu se inventează o zi.
 *
 * ⚠️ Se caută în anul numărului: fără `an`, calendarul ar aduce toate zilele din bază ca să le
 * filtreze în worker. Praznicele cu dată fixă se repetă an de an, deci răspunsul e același.
 */
export async function pomenireaAutorului(
  env: EnvSchita,
  autor: string,
  data: string,
): Promise<string | null> {
  if (!env.CALENDAR) return null
  const q = numeDeCautat(autor)
  if (q.length < 3) return null
  try {
    const r = await env.CALENDAR.fetch(
      `https://xc-calendar/v1/cauta?q=${encodeURIComponent(q)}&an=${encodeURIComponent(data.slice(0, 4))}`,
    )
    if (!r.ok) return null
    const date = (await r.json()) as { zile?: Array<{ data?: unknown }> }
    const zi = (date.zile ?? []).find((z) => typeof z.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(z.data))
    return zi ? ziLuna(String(zi.data)) : null
  } catch {
    // Calendarul care tace nu oprește chestionarul: se trece peste întrebarea pomenirii.
    return null
  }
}

/**
 * CAUTĂ POMENIREA PENTRU CE N-A FOST CĂUTAT ÎNCĂ. Se cheamă din acțiune, ÎNAINTE de socotirea
 * întrebării următoare: mașina de stări rămâne astfel curată (nu cheamă nimic), iar întrebarea
 * despre pomenire se pune numai când codul chiar a găsit o zi.
 *
 * Întoarce `true` dacă s-a schimbat ceva în schiță (deci trebuie salvată).
 */
export async function cautaPomenirile(env: EnvSchita, s: Schita): Promise<boolean> {
  let schimbat = false
  for (const care of articolele(s)) {
    const a = articolul(s, care)
    if (!a.autor || a.pomenireCautata !== undefined) continue
    if ((a.gata ?? []).includes('pomenire')) continue
    a.pomenireCautata = (await pomenireaAutorului(env, a.autor, s.data)) ?? ''
    schimbat = true
  }
  return schimbat
}

// ---------------------------------------------------------------------------
// Mașina de stări: ce se întreabă acum
// ---------------------------------------------------------------------------

export interface Intrebare {
  /** `gata` = nu mai e nimic de întrebat, urmează compunerea */
  subiect: CheieIntrebare | 'gata'
  articol: Articol
  /** textul GATA FORMULAT, cu locurile completate — modelul îl pune așa cum e */
  text: string
  /** ce să facă modelul cu răspunsul omului */
  instructiune: string
  /** titlurile propuse, în ordinea din întrebare — ca „2" să se poată traduce înapoi */
  candidati?: string[]
}

/** Cum se traduce răspunsul omului în subiectul acțiunii — scris pentru un model mic. */
const CUM_RASPUNDE: Record<CheieIntrebare, string> = {
  motto: 'dacă rămâne cel de acum („da", „rămâne așa") → subiectul `pastreaza`; dacă dictează altul → `motto` cu textul lui (și, dacă spune cine l-a zis, încă o chemare cu `moto_autor`).',
  text: 'trimite tot ce a scris omul, LITERĂ CU LITERĂ, cu subiectul `text`. Nu scurta, nu îndrepta, nu rescrie nimic.',
  autor: '„da" / „corect" → `pastreaza`; alt nume → `autor` cu numele; „nu" / „nu se știe" → `sari`.',
  ani: '„da" → `pastreaza`; alți ani → `ani` (forma 1661-1729); „nu" → `sari`.',
  pomenire: '„da" → `pastreaza`; altă zi → `pomenire` (ex. 16 august); „nu" → `sari`.',
  titlu: 'trimite `titlu` cu TEXTUL titlului ales; un număr (1, 2, 3) merge numai pentru titlurile din lista de mai sus. Dacă lista are sub trei titluri, completeaz-o tu cu propuneri scurte scoase din text, numerotate mai departe. ⚠️ Un REFUZ („niciunul", „nu-mi place", „altul", „nu știu") NU e un titlu → `sari`, și spune-i că poate scrie titlul oricând, cu „titlu: …".',
  sursa: '„da" → `pastreaza`; altă sursă → `sursa`; „nu" / „nu are" → `sari`.',
  mai_adaugam: '„da" → `pastreaza` (se deschide un articol secundar); „nu" → `sari` (se încheie numărul).',
}

const CAP_INSTRUCTIUNE =
  'Pune omului EXACT întrebarea de mai jos, nimic în plus și fără introduceri. Când răspunde, ' +
  'cheamă `buletin.raspunde`: '

export const INSTRUCTIUNE_GATA =
  'Schița e completă. Cheamă `buletin.compune` FĂRĂ niciun argument — ia totul din schiță — apoi ' +
  'spune omului ce număr iese, ca să-l confirme.'

/** Locurile de completat, puse în șablon. Ce nu se știe rămâne nescris, nu devine „undefined". */
export function completeaza(sablon: string, locuri: Record<string, string>): string {
  return sablon.replace(/\{(\w+)\}/g, (tot, nume: string) => locuri[nume] ?? tot)
}

const scurt = (s: string, cat: number): string => (s.length <= cat ? s : `${taieLaCuvant(s, cat)}…`)

/**
 * ÎNTREBAREA URMĂTOARE — mașina de stări, deterministă: aceeași schiță dă mereu aceeași întrebare.
 *
 * Ordinea e cea cerută de user: motto-ul o dată, pentru tot numărul; apoi, pentru fiecare articol,
 * textul → autorul → anii → pomenirea → titlul → sursa; la capăt „mai adăugăm?".
 *
 * ⚠️ Anii și pomenirea se întreabă NUMAI dacă s-a fixat un autor: fără el, „a trăit între anii…"
 * n-are despre cine să fie. Pomenirea se întreabă doar când CODUL a găsit-o în calendar
 * (`pomenireCautata` plin) — altfel se sare, fără să se spună nimic.
 */
export function urmatoareaIntrebare(s: Schita, intrebari: Record<CheieIntrebare, string>): Intrebare {
  const gataNumar = s.gata ?? []

  if (!gataNumar.includes('motto')) {
    const sablon = s.motto ? intrebari.motto : (INTREBARI_SIMPLE.motto ?? intrebari.motto)
    return {
      subiect: 'motto',
      articol: 'principal',
      text: completeaza(sablon, {
        motto: s.motto ?? '',
        autor: s.motoAutor ?? 'nu se știe cine l-a spus',
        articol: NUMELE_IN_INTREBARE.principal,
      }),
      instructiune: CAP_INSTRUCTIUNE + CUM_RASPUNDE.motto,
    }
  }

  for (const care of articolele(s)) {
    const a = articolul(s, care)
    const gata = a.gata ?? []
    const loc = { articol: NUMELE_IN_INTREBARE[care] }
    const face = (subiect: CheieIntrebare, sablon: string, locuri: Record<string, string>, candidati?: string[]): Intrebare => ({
      subiect,
      articol: care,
      text: completeaza(sablon, { ...loc, ...locuri }),
      instructiune: CAP_INSTRUCTIUNE + CUM_RASPUNDE[subiect],
      ...(candidati ? { candidati } : {}),
    })

    if (!gata.includes('text')) return face('text', intrebari.text, {})

    if (!gata.includes('autor')) {
      const propus = autorPropus(a.text ?? '')
      return propus
        ? face('autor', intrebari.autor, { autor: propus })
        : face('autor', INTREBARI_SIMPLE.autor ?? intrebari.autor, {})
    }

    if (a.autor && !gata.includes('ani')) {
      const propusi = aniiPropusi(a.text ?? '')
      return propusi
        ? face('ani', intrebari.ani, { ani: propusi })
        : face('ani', INTREBARI_SIMPLE.ani ?? intrebari.ani, {})
    }

    if (a.autor && a.pomenireCautata && !gata.includes('pomenire')) {
      return face('pomenire', intrebari.pomenire, { pomenire: a.pomenireCautata })
    }

    if (!gata.includes('titlu')) {
      const candidati = titluriPropuse(a.text ?? '')
      return face(
        'titlu',
        intrebari.titlu,
        { titluri: candidati.length ? candidati.map((t, i) => `${i + 1}. ${t}`).join(' ') : '(niciunul scos din text)' },
        candidati,
      )
    }

    if (!gata.includes('sursa')) {
      const propusa = sursaPropusa(a.text ?? '')
      return propusa
        ? face('sursa', intrebari.sursa, { sursa: propusa })
        : face('sursa', INTREBARI_SIMPLE.sursa ?? intrebari.sursa, {})
    }
  }

  const toate = articolele(s)
  const ultimul = toate[toate.length - 1]!
  if (s.secundari.length < SECUNDARI_MAXIM && !gataNumar.includes('mai_adaugam')) {
    return {
      subiect: 'mai_adaugam',
      articol: ultimul,
      text: completeaza(intrebari.mai_adaugam, { articol: NUMELE_IN_INTREBARE[ultimul] }),
      instructiune: CAP_INSTRUCTIUNE + CUM_RASPUNDE.mai_adaugam,
    }
  }

  return { subiect: 'gata', articol: ultimul, text: '', instructiune: INSTRUCTIUNE_GATA }
}

// ---------------------------------------------------------------------------
// Scrierea unui răspuns
// ---------------------------------------------------------------------------

/**
 * LISTA ÎNCHISĂ de subiecte pe care le primește `buletin.raspunde`. Închisă dinadins (user,
 * 18.09.2026: „prefer o listă de 20 de subiecte pe care pot interacționa cu Chat-ul AI decât o
 * judecată avansată de la un model foarte bun"): un model mic nimerește între cincisprezece
 * cuvinte știute, dar inventează câmpuri dacă i se lasă loc.
 */
export const SUBIECTE = [
  // câmpurile foii
  'motto', 'moto_autor', 'text', 'autor', 'ani', 'pomenire', 'titlu', 'sursa', 'nota', 'poza',
  // răspunsuri la întrebarea de acum
  'mai_adaugam', 'pastreaza', 'sari',
  // îndreptări
  'sterge_secundar', 'de_la_capat',
] as const
export type Subiect = (typeof SUBIECTE)[number]

/** Articolul în care se scrie acum: cel al întrebării la care se răspunde. */
const scrieIn = (s: Schita, care: Articol): ArticolSchitei => {
  if (care === 'principal') return s.principal
  const i = care === 's1' ? 0 : 1
  s.secundari[i] ??= {}
  return s.secundari[i]!
}

const marcheaza = (lista: CheieIntrebare[] | undefined, cheie: CheieIntrebare): CheieIntrebare[] =>
  (lista ?? []).includes(cheie) ? (lista ?? []) : [...(lista ?? []), cheie]

const taie = (v: string, cat = MAXIM_CAMP): string => v.replace(/\s+/g, ' ').trim().slice(0, cat)

export interface Scris {
  schita: Schita
  /** ce s-a scris, în vorbele omului — se întoarce modelului ca să știe că a mers */
  scris: string
  /** articolul în care s-a scris (pentru măsură) */
  articol: Articol
}

/**
 * SCRIE UN RĂSPUNS ÎN SCHIȚĂ. Pur: întoarce o schiță nouă, nu atinge nimic din afară.
 *
 * ⚠️ `pastreaza` și `sari` se leagă de ÎNTREBAREA DE ACUM, socotită aici din aceeași mașină de
 * stări care a pus-o. Așa „da" înseamnă lucruri diferite la întrebări diferite (la autor: „ăsta e";
 * la „mai adăugăm?": „da, mai punem un text"), fără ca modelul să aibă de ținut minte nimic.
 *
 * ⚠️ `articol` SPUS ANUME (18.09.2026, seara): „titlul articolului secundar 1: …" nu e un răspuns la
 * întrebarea de acum, e o INSTRUCȚIUNE punctuală către un obiect al foii (cererea userului: „către un
 * obiect din lista de obiecte ce formează buletinul"). Atunci scrisul merge unde s-a spus, nu unde
 * ajunsese chestionarul. Fără el, purtarea rămâne cea dinainte, literă cu literă.
 */
export function scrieRaspuns(
  vechea: Schita,
  cerutBrut: { subiect: Subiect; valoare?: string; articol?: Articol },
  intrebari: Record<CheieIntrebare, string>,
): Scris {
  const s: Schita = {
    ...vechea,
    principal: { ...vechea.principal },
    secundari: vechea.secundari.map((a) => ({ ...a })),
    gata: [...(vechea.gata ?? [])],
  }
  const acum = urmatoareaIntrebare(vechea, intrebari)
  /*
   * ⚠️ AL TREILEA PĂZITOR AL REFUZULUI, cel de la ușa scrierii (19.09.2026, după „Niciunul" ajuns
   * titlu în PDF). Aici ajunge și modelul care cheamă `buletin.raspunde` de-a dreptul, sărind peste
   * hartă. Poarta e îngustă dinadins: numai un RĂSPUNS la întrebarea de acum (fără `articol`, pe
   * chiar subiectul ei, la un câmp cu variante propuse) se poate întoarce în `sari`. „titlu:
   * Niciunul" vine cu `articol` spus, deci trece neatins și rămâne titlul „Niciunul".
   */
  const cerut: { subiect: Subiect; valoare?: string; articol?: Articol } =
    cerutBrut.articol === undefined &&
    cerutBrut.subiect === acum.subiect &&
    CAMPURI_CU_VARIANTE.has(acum.subiect) &&
    eRefuz(cerutBrut.valoare ?? '')
      ? { subiect: 'sari' }
      : cerutBrut
  /*
   * ⚠️ Un articol cerut ANUME se și DESCHIDE dacă nu există: „titlul secundarului 1: …" înaintea
   * întrebării „mai adăugăm?" trebuie să lucreze, nu să scrie în gol. Peste `SECUNDARI_MAXIM` nu se
   * trece — acolo cade înapoi pe articolul întrebării de acum.
   */
  let care = acum.articol
  if (cerut.articol) {
    const trebuie = cerut.articol === 's1' ? 1 : cerut.articol === 's2' ? 2 : 0
    if (trebuie <= SECUNDARI_MAXIM) {
      while (s.secundari.length < trebuie) s.secundari.push({})
      care = cerut.articol
    }
  }
  const v = cerut.valoare ?? ''

  // ------------------------------------------------- îndreptările, întâi
  if (cerut.subiect === 'de_la_capat') {
    /*
     * ⚠️ GOALĂ DE TOT, nu implicită (19.09.2026, hotărât anume): „ia-o de la capăt" e o ștergere
     * cerută de om, iar numărul rămâne oricum compozabil — `umplere.ts` pune textul de probă la
     * compunere, fie că locurile stau scrise în schiță, fie că nu. Repusă implicită, ștergerea s-ar
     * fi văzut pe ecran ca „NUME AUTOR" reapărut singur, adică nu ca o ștergere.
     */
    const curat = schitaGoala({ nr: s.nr, data: s.data, motto: s.motto ?? null, motoAutor: s.motoAutor ?? null })
    return { schita: curat, scris: 'am luat schița de la capăt; motto-ul numărului trecut a rămas', articol: 'principal' }
  }
  if (cerut.subiect === 'sterge_secundar') {
    if (!s.secundari.length) return { schita: s, scris: 'nu e niciun articol secundar de șters', articol: care }
    s.secundari = s.secundari.slice(0, -1)
    s.gata = (s.gata ?? []).filter((c) => c !== 'mai_adaugam')
    return { schita: s, scris: `am șters ultimul articol secundar; au rămas ${s.secundari.length}`, articol: 'principal' }
  }

  // ------------------------------------------------- „da" și „nu" la întrebarea de acum
  if (cerut.subiect === 'pastreaza' || cerut.subiect === 'sari') {
    const pastrez = cerut.subiect === 'pastreaza'
    if (acum.subiect === 'gata') {
      return { schita: s, scris: 'nu mai e nimic de întrebat — schița e completă', articol: care }
    }
    if (acum.subiect === 'mai_adaugam') {
      s.gata = marcheaza(s.gata, 'mai_adaugam')
      if (!pastrez) return { schita: s, scris: 'nu mai adăugăm alte texte; se poate compune numărul', articol: care }
      if (s.secundari.length >= SECUNDARI_MAXIM) {
        return { schita: s, scris: `un număr ține cel mult ${SECUNDARI_MAXIM} articole secundare`, articol: care }
      }
      s.secundari = [...s.secundari, {}]
      s.gata = (s.gata ?? []).filter((c) => c !== 'mai_adaugam')
      return { schita: s, scris: `am deschis articolul secundar ${s.secundari.length}`, articol: s.secundari.length === 1 ? 's1' : 's2' }
    }
    if (acum.subiect === 'motto') {
      s.gata = marcheaza(s.gata, 'motto')
      return {
        schita: s,
        scris: pastrez ? `motto-ul rămâne: „${scurt(s.motto ?? '', 60)}"` : 'numărul rămâne fără motto',
        articol: care,
      }
    }
    const a = scrieIn(s, care)
    a.gata = marcheaza(a.gata, acum.subiect)
    if (!pastrez) {
      /*
       * ⚠️ La TITLU, „am sărit" nu e destul: omul tocmai a refuzat niște propuneri, deci trebuie să
       * afle pe loc că îl poate scrie singur oricând. Altfel numărul rămâne fără titlu, iar el crede
       * că nu mai are ce face.
       */
      const indemn = acum.subiect === 'titlu' ? '; spune-i că poate scrie titlul oricând, cu „titlu: …"' : ''
      return { schita: s, scris: `am sărit peste ${acum.subiect} la ${NUMELE_ZONEI[care]}${indemn}`, articol: care }
    }
    // „da, îl folosim": se scrie CE A PROPUS CODUL la întrebarea de acum
    const propus =
      acum.subiect === 'autor' ? autorPropus(a.text ?? '')
      : acum.subiect === 'ani' ? aniiPropusi(a.text ?? '')
      : acum.subiect === 'pomenire' ? (a.pomenireCautata ? `† ${a.pomenireCautata}` : null)
      : acum.subiect === 'titlu' ? (acum.candidati?.[0] ?? null)
      : acum.subiect === 'sursa' ? sursaPropusa(a.text ?? '')
      : null
    if (!propus) {
      return { schita: s, scris: `n-am ce păstra la ${acum.subiect}, deci am sărit peste el`, articol: care }
    }
    if (acum.subiect === 'autor') {
      a.autor = propus
      // autor nou → pomenirea se caută din nou (poate fi alt sfânt, ori niciunul)
      delete a.pomenireCautata
    } else if (acum.subiect === 'ani') a.ani = propus
    else if (acum.subiect === 'pomenire') a.pomenire = propus
    else if (acum.subiect === 'titlu') a.titlu = propus
    else if (acum.subiect === 'sursa') a.sursa = propus
    return { schita: s, scris: `${acum.subiect} la ${NUMELE_ZONEI[care]}: ${propus}`, articol: care }
  }

  // ------------------------------------------------- „mai adăugăm?", spus în cuvinte
  if (cerut.subiect === 'mai_adaugam') {
    const da = /^\s*(da|dа|yes|mai|încă|inca)\b/i.test(v)
    s.gata = marcheaza(s.gata, 'mai_adaugam')
    if (!da) return { schita: s, scris: 'nu mai adăugăm alte texte; se poate compune numărul', articol: care }
    if (s.secundari.length >= SECUNDARI_MAXIM) {
      return { schita: s, scris: `un număr ține cel mult ${SECUNDARI_MAXIM} articole secundare`, articol: care }
    }
    s.secundari = [...s.secundari, {}]
    s.gata = (s.gata ?? []).filter((c) => c !== 'mai_adaugam')
    return { schita: s, scris: `am deschis articolul secundar ${s.secundari.length}`, articol: s.secundari.length === 1 ? 's1' : 's2' }
  }

  // ------------------------------------------------- câmpurile numărului
  if (cerut.subiect === 'motto') {
    s.motto = taie(v, 600)
    s.gata = marcheaza(s.gata, 'motto')
    return { schita: s, scris: `motto: „${scurt(s.motto, 60)}"`, articol: care }
  }
  if (cerut.subiect === 'moto_autor') {
    s.motoAutor = taie(v)
    return { schita: s, scris: `motto-ul e al lui ${s.motoAutor}`, articol: care }
  }

  // ------------------------------------------------- câmpurile unui articol
  const a = scrieIn(s, care)
  switch (cerut.subiect) {
    case 'text': {
      /*
       * ⚠️ LITERĂ CU LITERĂ. Se aduc doar sfârșiturile de rând la o formă („\n") și se taie aerul
       * de la capete: rândurile goale DINĂUNTRU despart paragrafele pe hârtie, iar orice altă
       * curățare ar fi o rescriere a textului omului.
       */
      a.text = v.replace(/\r\n?/g, '\n').replace(/^\n+|\s+$/g, '').slice(0, MAXIM_TEXT)
      a.gata = marcheaza(a.gata, 'text')
      // text nou → autorul, anii, titlul și sursa se propun din el, deci pomenirea se recaută
      delete a.pomenireCautata
      return { schita: s, scris: `text la ${NUMELE_ZONEI[care]}: ${semne(a.text)} de semne`, articol: care }
    }
    case 'autor':
      a.autor = taie(v)
      a.gata = marcheaza(a.gata, 'autor')
      delete a.pomenireCautata
      return { schita: s, scris: `autor la ${NUMELE_ZONEI[care]}: ${a.autor}`, articol: care }
    case 'ani':
      a.ani = taie(v, 40)
      a.gata = marcheaza(a.gata, 'ani')
      return { schita: s, scris: `anii la ${NUMELE_ZONEI[care]}: ${a.ani}`, articol: care }
    case 'pomenire': {
      const curat = taie(v, 40).replace(/^†\s*/, '')
      a.pomenire = curat ? `† ${curat}` : undefined
      a.gata = marcheaza(a.gata, 'pomenire')
      return { schita: s, scris: `pomenire la ${NUMELE_ZONEI[care]}: ${a.pomenire ?? 'niciuna'}`, articol: care }
    }
    case 'titlu': {
      /*
       * ⚠️ „2" e un RĂSPUNS BUN: omul a citit trei titluri numerotate și a spus al doilea. Numărul
       * se traduce din candidații întrebării de acum — nu se scrie „2" ca titlu pe foaie.
       */
      const alesCuNumarul = /^\s*([1-9])\s*[.)]?\s*$/.exec(v)
      const dinLista = alesCuNumarul ? acum.candidati?.[Number(alesCuNumarul[1]) - 1] : undefined
      a.titlu = taie(dinLista ?? v, 200)
      a.gata = marcheaza(a.gata, 'titlu')
      return { schita: s, scris: `titlu la ${NUMELE_ZONEI[care]}: ${a.titlu}`, articol: care }
    }
    case 'sursa':
      a.sursa = taie(v, 200)
      a.gata = marcheaza(a.gata, 'sursa')
      return { schita: s, scris: `sursa la ${NUMELE_ZONEI[care]}: ${a.sursa}`, articol: care }
    case 'nota':
      // mențiunea de deasupra sursei nu e o întrebare a chestionarului: se dă când e de dat
      a.nota = taie(v, 400)
      return { schita: s, scris: `mențiunea de deasupra sursei la ${NUMELE_ZONEI[care]}: ${scurt(a.nota, 60)}`, articol: care }
    case 'poza':
      a.poza = taie(v, 600)
      return { schita: s, scris: `poza la ${NUMELE_ZONEI[care]}: ${a.poza}`, articol: care }
    default:
      return { schita: vechea, scris: `subiect necunoscut: ${String(cerut.subiect)}`, articol: care }
  }
}

// ---------------------------------------------------------------------------
// Din schiță în ce cere compunerea
// ---------------------------------------------------------------------------

/**
 * ⚠️ LOCURILE SCHIȚEI IMPLICITE IES AICI, GOALE (19.09.2026). Peste granița asta trece numai ce a
 * spus omul: „NUME AUTOR" ori „text" pleacă mai departe ca un câmp nescris, iar `umplere.ts` le pune
 * la loc, ca și până acum, cu socoteala lui și cu nota din `atentie`. Trecute ca atare, ar fi ieșit
 * pe hârtie cu patru semne de text și s-ar fi păstrat sub `compus/` ca și cum ar fi fost scrise.
 */
const fara = (v: string | undefined): string => (eDeProba(v) ? '' : (v ?? ''))

const caArticol = (a: ArticolSchitei): NumarCerut['principal'] => {
  const ani = fara(a.ani)
  const sursa = fara(a.sursa)
  return {
    autor: fara(a.autor),
    ...(ani ? { ani } : {}),
    ...(a.pomenire ? { pomenire: a.pomenire } : {}),
    titlu: fara(a.titlu),
    text: fara(a.text),
    ...(sursa ? { sursa } : {}),
    ...(a.nota ? { nota: a.nota } : {}),
    poza: Boolean(a.poza),
  }
}

/**
 * SCHIȚA, ÎN FORMA CERUTĂ DE COMPUNERE. Ce lipsește rămâne gol — `umplere.ts` pune text de probă
 * la vedere, ca și până acum. Aici nu se inventează nimic.
 */
export function catreCerere(s: Schita): NumarCerut {
  return {
    motto: s.motto ?? '',
    ...(s.motoAutor ? { motoAutor: s.motoAutor } : {}),
    nr: s.nr ?? 1,
    data: s.data,
    principal: caArticol(s.principal),
    secundari: s.secundari.map(caArticol),
    floare: true,
  }
}

/** Adresele pozelor, cum le cere `compune` (`p`, `s1`, `s2`). */
export function pozeleSchitei(s: Schita): Record<string, string> {
  const poze: Record<string, string> = {}
  if (s.principal.poza) poze.p = s.principal.poza
  s.secundari.forEach((a, i) => {
    if (a.poza) poze[`s${i + 1}`] = a.poza
  })
  return poze
}

/** MĂSURA unui articol: câte semne s-au scris, câte încap, câte au rămas (negativ = peste). */
export function masuraArticolului(
  s: Schita,
  care: Articol,
  calendar?: NumarCerut['calendar'],
): { semne: number; incap: number; ramase: number } {
  const socoteala = socoteste({ ...catreCerere(s), calendar })
  const zona = socoteala.zone.find((z) => z.cine === NUMELE_ZONEI[care])
  return {
    semne: zona?.scrise ?? 0,
    incap: zona?.semne ?? 0,
    ramase: zona?.ramase ?? 0,
  }
}

/**
 * CE E DEJA COMPLETAT, pe scurt — fără textele lungi. Se întoarce modelului la `buletin.chestionar`
 * („unde am rămas?") și se scrie pe ecranul `/nou`. ⚠️ Textele nu intră niciodată întregi: ele sunt
 * tot rostul schiței, ca modelul să nu le care prin context.
 */
export function rezumatulSchitei(s: Schita): string[] {
  const out: string[] = []
  if (s.motto) out.push(`motto: „${scurt(s.motto, 60)}"${s.motoAutor ? ` — ${s.motoAutor}` : ''}`)
  /*
   * ⚠️ LOCURILE NU SE DAU DREPT RĂSPUNSURI (19.09.2026). Schița implicită pornește cu „NUME AUTOR",
   * „TITLU ARTICOL" și „text" în câmpuri; spuse aici ca atare, modelul ar citi „principal: autor NUME
   * AUTOR, titlu «TITLU ARTICOL»" și ar crede că numărul e scris. Ce n-a spus omul e „încă nimic".
   */
  for (const care of articolele(s)) {
    const a = articolul(s, care)
    const parti: string[] = []
    if (!eDeProba(a.autor)) parti.push(`autor ${a.autor}`)
    if (!eDeProba(a.ani)) parti.push(`anii ${a.ani}`)
    if (a.pomenire) parti.push(`pomenire ${a.pomenire}`)
    if (!eDeProba(a.titlu)) parti.push(`titlu „${a.titlu}"`)
    if (!eDeProba(a.text)) parti.push(`text ${semne(a.text ?? '')} de semne`)
    if (!eDeProba(a.sursa)) parti.push(`sursa ${a.sursa}`)
    if (a.nota) parti.push('mențiune deasupra sursei')
    if (a.poza) parti.push('poză')
    out.push(`${NUMELE_ZONEI[care]}: ${parti.length ? parti.join(', ') : 'încă nimic (de probă, cât să se poată compune)'}`)
  }
  return out
}
