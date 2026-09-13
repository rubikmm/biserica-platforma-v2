/**
 * Catalogul, asa cum se citeste din depozit (R2 `xc-biblioteca-*`).
 *
 * Fisierul `catalog.json` e foaia parohiei, atat: 1349 de titluri, cu autorul si editura scrise
 * cum le-a scris cine a facut evidenta. Tot ce urmeaza — despartirea autorilor din aceeasi
 * casuta, unirea felurilor de a scrie acelasi om, curatarea numelor de edituri — se face AICI,
 * la citire, si nu se scrie niciodata inapoi in depozit. Asa o foaie noua a parohiei nu strica
 * nimic si nu trebuie tinuta o a doua copie a catalogului.
 *
 * Portat din `biserica-biblioteca/src/index.ts` (`catalog`, `indexAutori`, `indexEdituri`,
 * `cauta`), cuvant cu cuvant acolo unde nu era nevoie de schimbare.
 */
import {
  FARA_AUTOR, autorii, dupaNume, faraGhilimele, numeAfisat, numeDeAsezare, numeEditura, numeUnit,
  plat, slugAutor, slugDin, slugScris,
} from "./nume.js"
import { type FoaieImbogatire, citesteImbogatirea } from "./imbogatire.js"

export interface Carte {
  nr: number
  slug: string
  titlu: string
  autor: string | null
  editura: string | null
  an: string | null
  loc: string | null
  bucati: number
}

export interface Grup {
  nume: string
  slug: string
  carti: number
  /** Litera ceruta anume, cand nu se ia din nume: „Fără autor" sta la „#", nu la F. */
  litera?: string
}

export interface Catalog {
  sursa: string
  actualizatLaSursa: string | null
  preluatLa: string
  total: number
  totalAutori: number
  totalEdituri: number
  carti: Carte[]
  autori: Grup[]
  edituri: Grup[]
  /** Autorii dupa slug — pus la citire, nu vine din json. */
  autoriDupaSlug: Map<string, Grup>
  /** Slugul vechi (cu titlu in el, cum era pana la unirea autorilor) -> slugul de azi. */
  aliasAutori: Map<string, string>
  /** Editurile dupa slug, unite si curatate la citire — vezi `indexEdituri`. */
  editurileDupaSlug: Map<string, Grup>
  /** Ce s-a aflat de pe la librarii, pe slugul cartii. Goala daca n-a fost urcata. */
  imb: FoaieImbogatire
}

/** Catalogul asa cum sta in depozit: fara indexul pe care ni-l facem noi. */
type CatalogBrut = Omit<Catalog, "autoriDupaSlug" | "aliasAutori" | "editurileDupaSlug" | "imb">

// Memorarea e pe izolat si EXPIRA: fara termen, un izolat batran servea foaia veche ore intregi
// dupa o urcare in depozit (vazut in V1 la culesul din 31 aug 2026 — fisele noi apareau si
// dispareau de la o cerere la alta, dupa izolatul care raspundea).
let cache: Catalog | null = null
let cacheLa = 0
const CACHE_TINE = 10 * 60_000

export async function catalog(depozit: R2Bucket): Promise<Catalog> {
  if (cache && Date.now() - cacheLa < CACHE_TINE) return cache
  const o = await depozit.get("catalog.json")
  if (!o) throw new Error("catalog.json lipseste din depozit")
  const brut = await o.json<CatalogBrut>()
  const { autori, alias } = indexAutori(brut.carti)
  const edituri = indexEdituri(brut.carti)
  // Imbogatirea e in plus, nu temelie: daca lipseste, catalogul se deschide la fel.
  const imb = await citesteImbogatirea(depozit)
  cache = {
    ...brut,
    autori,
    totalAutori: autori.length,
    aliasAutori: alias,
    edituri,
    totalEdituri: edituri.length,
    autoriDupaSlug: new Map(autori.map((g) => [g.slug, g])),
    editurileDupaSlug: new Map(edituri.map((g) => [g.slug, g])),
    imb,
  }
  cacheLa = Date.now()
  return cache
}

/** Numai pentru probe: sterge foaia tinuta minte, ca urmatoarea citire s-o ia din depozit. */
export function uitaCatalogul(): void {
  cache = null
  cacheLa = 0
}

/**
 * Indexul autorilor, facut la citirea catalogului. Lista de autori din json e cea a foii
 * parohiei: casute cu doi-trei oameni la un loc si acelasi om scris in mai multe feluri. Aici
 * casutele se taie in oameni (`autorii`), oamenii se aduna sub acelasi slug (`slugAutor`) si
 * fiecare primeste un singur nume de aratat (`numeUnit`) — vezi `nume.ts`.
 * Ordinea ramane cea din V1: dupa cate titluri are fiecare.
 */
function indexAutori(carti: Carte[]): { autori: Grup[]; alias: Map<string, string> } {
  // Pentru fiecare autor tinem toate felurile in care e scris — si separat pe cele scrise chiar
  // pe numele lui, nu aduse aici de tabelul ACEIASI. Numele de aratat se alege dintre ale lui:
  // altfel „Iertheos" (5 carti) ar boteza pe „Hierotheos Vlachos".
  const strans = new Map<string, { toate: Map<string, number>; ale_lui: Map<string, number> }>()
  const alias = new Map<string, string>()
  const aduna = (m: Map<string, number>, a: string) => m.set(a, (m.get(a) ?? 0) + 1)
  for (const k of carti)
    for (const a of autorii(k.autor)) {
      const s = slugAutor(a)
      const g = strans.get(s) ?? { toate: new Map(), ale_lui: new Map() }
      aduna(g.toate, a)
      if (slugScris(a) === s) aduna(g.ale_lui, a)
      strans.set(s, g)
      // Adresa de pana la unire avea titlul in slug, iar casuta cu doi autori era un singur
      // slug. Le tinem minte pe amandoua, ca linkurile vechi sa nu cada.
      for (const vechi of [slugDin(a), slugScris(a), slugDin(k.autor ?? "")])
        if (vechi && vechi !== s && !alias.has(vechi)) alias.set(vechi, s)
    }
  const autori = [...strans.entries()]
    .map(([slug, g]) => ({
      slug,
      nume: numeUnit(g.ale_lui.size > 0 ? g.ale_lui : g.toate),
      carti: [...g.toate.values()].reduce((n, x) => n + x, 0),
    }))
    .sort((a, b) => b.carti - a.carti || dupaNume("autor")(a.nume, b.nume))
  // Cartile fara autor nu sunt ale nimanui, dar sunt ale bibliotecii: pana la 31 aug 2026 nu se
  // ajungea la ele din lista de autori. Stau la un loc, sub „#" (decizie user).
  const orfane = carti.filter((k) => autorii(k.autor).length === 0).length
  if (orfane > 0) autori.push({ ...FARA_AUTOR, carti: orfane })
  return { autori, alias }
}

/**
 * Indexul editurilor, facut tot la citire. Lista din json avea doua neajunsuri, amandoua
 * vizibile pe ecran (gasite in V1, 31 aug 2026):
 *
 *  - ghilimelele din foaia veche, puse cum s-a nimerit („Părinți Aghioriți" cu ele peste tot
 *    numele, si una fara ghilimeaua de inchidere). Numele care incepea cu ghilimea nu se aseza
 *    la litera lui, ci la „#";
 *  - opt edituri figurau de DOUA ori, deosebite doar prin majuscule sau diacritice („AXA" si
 *    „Axa", „Mănăstirea Slatioara" si „Mănăstirea Slătioara"). Amandoua duceau la acelasi slug,
 *    deci pagina uneia arata numai jumatate din titluri, iar cealalta jumatate nu se putea vedea
 *    de nicaieri.
 *
 * Se unesc dupa slug — slugul e identitatea, ca la autori — si se alege un singur fel de scris
 * (`numeEditura`). Slugurile raman aceleasi, deci niciun link vechi nu cade.
 */
function indexEdituri(carti: Carte[]): Grup[] {
  const strans = new Map<string, Map<string, number>>()
  for (const k of carti) {
    if (!k.editura?.trim()) continue
    const s = slugDin(faraGhilimele(k.editura))
    if (!s) continue
    const m = strans.get(s) ?? new Map<string, number>()
    m.set(k.editura, (m.get(k.editura) ?? 0) + 1)
    strans.set(s, m)
  }
  return [...strans.entries()]
    .map(([slug, m]) => ({
      slug,
      nume: numeEditura(m),
      carti: [...m.values()].reduce((n, x) => n + x, 0),
    }))
    .sort((a, b) => b.carti - a.carti || dupaNume("editura")(a.nume, b.nume))
}

/**
 * Adrese de carte care s-au mutat — tabel scris de mana, un rand de sters daca nu mai e bun.
 *
 * Numarul de inventar tine loc de identitate, nu titlul, asa ca aproape nimic nu se muta de la o
 * foaie a parohiei la alta. Aici intra doar randurile la care parohia a indreptat o incurcatura
 * si a pus la acelasi numar cu totul ALTA carte; adresa dinainte ramane si duce la ce e acum
 * acolo (301).
 *
 * 8 septembrie 2026, foaia din 17 iulie 2025:
 *   nr. 108   era trecut de doua ori „Dogmatica"; al doilea rand e de fapt „Pelerinaj la
 *             Mormantul Domnului" (Sfantul Ioan Damaschin, IBMBOR)
 *   nr. 1016  era trecut de doua ori „Valoarea sufletului" (si la nr. 190); aici e brosura
 *             despre Sfanta Xenia din Sankt Petersburg
 */
export const MUTATE: Record<string, string> = {
  "dogmatica": "pelerinaj-la-mormantul-domnului-2",
  "valoarea-sufletului-2": "sfanta-xenia-din-sankt-petersburg-ocrotitoarea-familiei-viata-minunile-si-acatis",
}

/** Slugul editurii unei carti — acelasi drum ca la indexare, ghilimelele scoase. */
export const slugEditura = (e: string) => slugDin(faraGhilimele(e))

/** Numele editurii cum s-a hotarat la citire (unit si fara ghilimele), nu cum e in rand. */
export const numeleEditurii = (c: Catalog, e: string) =>
  c.editurileDupaSlug.get(slugEditura(e))?.nume ?? faraGhilimele(e)

/** Autorii unei carti, gata de aratat: numele unit al fiecaruia si slugul lui. */
export function autoriiCartii(c: Catalog, k: Carte): Grup[] {
  return autorii(k.autor).map((a) => {
    const slug = slugAutor(a)
    return c.autoriDupaSlug.get(slug) ?? { slug, nume: numeAfisat(a), carti: 1 }
  })
}

export const titlulDin = (c: Catalog, slug: string) =>
  c.carti.find((x) => x.slug === slug)?.titlu ?? slug

/**
 * Se cauta si dupa numele din catalog, si dupa cel prescurtat de noi, si cu intrebarea scrisa
 * oricum: „Sfantul Ioan", „Sf. Ioan" si „Arhimandrit Cleopa" gasesc toate ce trebuie, desi in
 * foaie scrie „Sfantul Ioan…" si „Arhim Cleopa Ilie".
 */
export function cauta(c: Catalog, q: string): Carte[] {
  const cautate = [...new Set([plat(q.trim()), plat(numeDeAsezare(q.trim()))])].filter(Boolean)
  if (cautate.length === 0) return []
  const are = (s: string | null | undefined) => !!s && cautate.some((n) => plat(s).includes(n))
  return c.carti
    .filter((x) => are(x.titlu) || are(x.editura) || are(x.autor) || autoriiCartii(c, x).some((a) => are(a.nume)))
    .slice(0, 300)
}
