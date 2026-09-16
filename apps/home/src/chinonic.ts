/**
 * TEXTE CITITE LA CHINONIC — secțiunea Website-ului cu articolele citite la strană în timpul
 * împărtășirii (cerere user, 16.09.2026).
 *
 * De unde vin: din arhiva newsletterului. Un număr de buletin are trei părți — programul liturgic
 * (din A2), buletinul parohiei (din A3) și textele citite la chinonic. Primele două trăiesc în
 * aplicațiile lor; al treilea n-a fost salvat nicăieri până acum. Uneltele care le-au scos și le-au
 * adus aici: `infrastructure/import/chinonic/`.
 *
 * ⚠️ ARTICOLUL E AL WEBSITE-ULUI, ASOCIEREA CU NUMĂRUL E A NEWSLETTERULUI (hotărât cu userul). Aici
 * nu se ține numărul buletinului, ci doar DATA citirii — un fapt despre text, nu despre buletin.
 *
 * ⚠️⚠️ FORMA FIȘEI, cerută anume (user, 16.09.2026): „titlu + autor (Sinaxar sau fără autor ca
 * excepție) + text scurt + citește tot (desfășurare) + Sursa: [carte] + site (cu url-ul pus efectiv)
 * — dacă e 404 acel url să nu se pună, așa știu că nu mai era valabil linkul". Deci:
 *   - lista arată ÎNTOTDEAUNA aceleași cinci lucruri, în aceeași ordine;
 *   - „Citește tot" e MARCAJUL textului întreg: îl are numai unde textul chiar a fost adus, iar unde
 *     nu s-a putut aduce scrie limpede că e doar bucata din buletin;
 *   - legătura spre sursă se scrie numai cât timp adresa mai trăiește (`link_stare`, scrisă de
 *     `infrastructure/import/chinonic/verifica-linkurile.mjs`). O adresă moartă lasă numele gol de
 *     legătură — tocmai ca să se VADĂ că nu mai e valabilă.
 */
import { LUNI, esc } from '@xc/ui'

/** Un text, așa cum stă în baza Website-ului. */
export interface Text {
  slug: string
  titlu: string
  autor: string
  citit_la: string
  fragment: string
  text_intreg: string
  stare_text: string
  sursa_text: string
  sursa_nume: string
  sursa_url: string
  sursa_fel: string
  poza: string
  /** „viu" · „mort" · „picat" · „ocolit" · gol cât timp adresa n-a fost întrebată încă. */
  link_stare?: string
}

export const CALE = '/texte-citite-la-chinonic'
/** Câte se arată pe ușa Website-ului, înainte de „Vezi toate" (cerut anume: 10). */
export const CATE_PE_ACASA = 10

const CAMPURI = `slug, titlu, autor, citit_la, fragment, text_intreg, stare_text,
                 sursa_text, sursa_nume, sursa_url, sursa_fel, poza, link_stare`

export async function celeDeAcasa(db: D1Database, cate = CATE_PE_ACASA): Promise<Text[]> {
  const r = await db.prepare(`SELECT ${CAMPURI} FROM texte_chinonic ORDER BY citit_la DESC, id DESC LIMIT ?`)
    .bind(cate).all<Text>()
  return r.results ?? []
}

export async function toate(db: D1Database): Promise<Text[]> {
  const r = await db.prepare(`SELECT ${CAMPURI} FROM texte_chinonic ORDER BY citit_la DESC, id DESC`).all<Text>()
  return r.results ?? []
}

/**
 * ⚠️ LISTA MARE NU CARĂ TEXTELE (user, 16.09.2026: „lista mare nu o mai fișa complet că se îngreunează
 * browser-ul"). 448 de texte întregi înseamnă vreo 3 MB scoși din bază și trimiși în pagină la
 * fiecare deschidere, ca să se vadă din ei niște titluri. Aici se cer numai faptele DESPRE text —
 * lungimile, nu conținutul —, iar textul se citește din fișa lui.
 */
export interface Rezumat {
  slug: string
  titlu: string
  autor: string
  citit_la: string
  stare_text: string
  sursa_text: string
  sursa_nume: string
  sursa_url: string
  sursa_fel: string
  link_stare?: string
  n_fragment: number
  n_text: number
}

export async function rezumate(db: D1Database): Promise<Rezumat[]> {
  const r = await db.prepare(`SELECT slug, titlu, autor, citit_la, stare_text, sursa_text, sursa_nume,
      sursa_url, sursa_fel, link_stare, LENGTH(fragment) AS n_fragment, LENGTH(text_intreg) AS n_text
    FROM texte_chinonic ORDER BY citit_la DESC, id DESC`).all<Rezumat>()
  return r.results ?? []
}

/** Un număr de buletin, așa cum îl ține Newsletterul: id-ul lui, numărul scris și ziua trimiterii. */
export interface Numar {
  id: number
  nr: number | null
  trimis: string
  texte: string[]
}

/**
 * ⚠️ NUMĂRUL SE CERE DE LA NEWSLETTER, nu se ține aici (structura mare: „ce ține de altă aplicație se
 * cere, nu se copiază"). Website-ul are articolul, Newsletterul are asocierea articol ↔ număr.
 * Dacă binding-ul tace, pagina se scrie mai departe, doar fără numere — o pagină de lucru nu are voie
 * să cadă fiindcă vecinul n-a răspuns.
 */
export async function numereleDupaSlug(newsletter?: Fetcher): Promise<Map<string, Numar>> {
  const dupaSlug = new Map<string, Numar>()
  if (!newsletter) return dupaSlug
  try {
    const r = await newsletter.fetch('https://newsletter/v1/chinonic/asocieri')
    if (!r.ok) return dupaSlug
    const numere = (await r.json()) as Numar[]
    for (const n of numere) for (const slug of n.texte ?? []) dupaSlug.set(slug, n)
  } catch {
    return dupaSlug
  }
  return dupaSlug
}

export async function unul(db: D1Database, slug: string): Promise<Text | null> {
  return await db.prepare(`SELECT ${CAMPURI} FROM texte_chinonic WHERE slug = ?`).bind(slug).first<Text>()
}

/** Câte sunt cu totul — se scrie pe „Vezi toate", ca omul să știe ce-l așteaptă. */
export async function cate(db: D1Database): Promise<number> {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM texte_chinonic').first<{ n: number }>()
  return r?.n ?? 0
}

/** „15 septembrie 2026" — data citirii, scrisă ca peste tot în platformă. */
export function ziua(d: string): string {
  const [an, luna, zi] = d.split('-').map(Number)
  if (!an || !luna || !zi) return d
  return `${zi} ${LUNI[luna - 1] ?? ''} ${an}`
}

/** Pozele stau în depozitul newsletterului, cu adrese `/media/…` — de acolo se servesc. */
const poza = (t: Text, urlNewsletter: string) =>
  t.poza.startsWith('/') ? `${urlNewsletter}${t.poza}` : t.poza

/**
 * ⚠️ TEXTUL ÎNTREG E MARCAJUL. Un text e „întreg" numai dacă aducerea lui a trecut proba userului
 * (începe la fel ca fragmentul din buletin) — altfel arătăm bucata din buletin și o spunem.
 */
export const areTot = (t: Text): boolean => t.stare_text === 'gata' && !!t.text_intreg

/*
 * ⚠️ AUTORUL SE SCRIE INTOTDEAUNA (user, 16.09.2026: „Toate trebuie să aibă titlu și autor… dacă nu
 * au autor scriem «Fără autor»"). Un rand gol acolo unde la vecini stă un nume se citeste ca o
 * scapare; „Fără autor" spune limpede ca textul chiar n-are unul.
 * ⚠️ „Sinaxar" NU se ghiceste aici, ci sta scris in baza: regula e la import (`titlu-autor.mjs`,
 * `eSinaxar`), sub probe, si se pune la fiecare extragere. Pagina doar scrie ce a hotarat importul.
 */
const numeleAutorului = (t: Text): string => t.autor || 'Fără autor'
const faraAutor = (t: Text): string => (t.autor ? '' : ' ch-niciun-autor')

/**
 * ⚠️⚠️ VIEȚILE DE SFINȚI AU O SINGURĂ SURSĂ: SINAXARUL (user, 16.09.2026: „viețile de sfinți — să le
 * validezi, lasă doar Sinaxar la sursă și atât"). O viață de sfânt nu e textul cuiva: e aceeași
 * povestire, tipărită în sinaxar și repovestită de zeci de site-uri. A scrie de pe care dintre ele am
 * luat-o nu spune nimic despre text, iar o adresă moartă acolo nu e o pierdere: sursa n-a fost
 * niciodată site-ul. De aceea la sinaxare rândul „Sursa" scrie doar «Sinaxar», fără mențiune și fără
 * legătură — și de aceea ele nu mai intră în categoria adreselor moarte.
 *
 * ⚠️ Adresa NU se șterge din bază: de acolo se aduce textul (`adu-textul.mjs`). Aici se schimbă numai
 * ce se scrie în pagină.
 */
export const eSinaxar = (autor: string): boolean => autor === 'Sinaxar'

/** HTML-ul textului, dezbrăcat: din el se face bucata scurtă din listă. */
const dezbraca = (h: string): string =>
  h.replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim()

/** Cât se vede din text înainte de „Citește tot" — cât să se înțeleagă despre ce e, nu mai mult. */
const SCURT = 400

/** Bucata scurtă, tăiată la cuvânt: un text rupt în mijlocul unui cuvânt arată ca o stricăciune. */
export function textScurt(t: Text): string {
  const intreg = dezbraca(areTot(t) ? t.text_intreg : t.fragment)
  if (intreg.length <= SCURT) return intreg
  const taiat = intreg.slice(0, SCURT)
  const capat = taiat.lastIndexOf(' ')
  const bucata = (capat > SCURT / 2 ? taiat.slice(0, capat) : taiat).replace(/[,;:–—-]$/, '')
  // o propozitie incheiata nu mai are nevoie de puncte de suspensie: „…Tracia.…" arata a stricaciune
  return /[.!?…]$/.test(bucata) ? bucata : `${bucata}…`
}

/**
 * SURSA, scrisă sub text. Are două părți care coexistă (user, 16.09.2026): mențiunea scrisă de om
 * — de multe ori o carte întreagă, cu editură și pagini — și site-ul de unde s-a luat.
 *
 * ⚠️ LEGĂTURA SE PUNE NUMAI DACĂ ADRESA MAI TRĂIEȘTE. Unde a murit (404/410) sau unde nu mai
 * răspunde nimeni, rămâne doar numele, nelegat: „așa știu că nu mai era valabil linkul" (user).
 * Cine scrie `link_stare`: `infrastructure/import/chinonic/verifica-linkurile.mjs`.
 */
const adresaSeScrie = (t: Text): boolean =>
  !eSinaxar(t.autor) && !!t.sursa_url && t.link_stare !== 'mort' && t.link_stare !== 'picat'

function sursa(t: Text): string {
  // ⚠️ la o viață de sfânt, sursa e Sinaxarul — atât, oricare ar fi site-ul de unde s-a adus textul
  if (eSinaxar(t.autor)) return '<p class="ch-sursa"><span>Sursa:</span> Sinaxar</p>'
  const parti: string[] = []
  if (t.sursa_text) parti.push(esc(t.sursa_text))
  // numele site-ului, legat cât timp adresa trăiește; unde nu există nume (PDF-urile parohiei),
  // vorbeste mentiunea scrisa, iar legatura se agata de ea
  const nume = t.sursa_nume && !t.sursa_text.toLowerCase().includes(t.sursa_nume.toLowerCase())
    ? t.sursa_nume
    : ''
  if (nume) parti.push(esc(nume))
  if (!parti.length && !adresaSeScrie(t)) return ''
  const eticheta = nume || t.sursa_nume || (t.sursa_fel === 'pdf' ? 'fișierul PDF' : 'sursa')
  const drum = adresaSeScrie(t)
    ? `<a class="ch-drum" href="${esc(t.sursa_url)}" target="_blank" rel="noopener nofollow">${esc(eticheta)} ↗</a>`
    : ''
  // cand adresa traieste, numele nelegat iese si ramane doar legatura (ca sa nu scrie de doua ori)
  const scrise = drum && nume ? parti.slice(0, -1) : parti
  return `<p class="ch-sursa"><span>Sursa:</span> ${[...scrise, drum].filter(Boolean).join(' · ')}</p>`
}

/** Textul întreg, așa cum intră în fișă și în desfășurarea din listă. */
export const corpTextului = (t: Text): string =>
  areTot(t)
    ? `<div class="ch-text">${t.text_intreg}</div>`
    : `<div class="ch-text ch-fragment">${t.fragment}</div>`

/*
 * ⚠️ „CITEȘTE TOT" MERGE ȘI FĂRĂ JS. E o legătură adevărată către fișă (adresa ei e permanentă);
 * scriptul de jos doar o prinde din zbor și aduce textul în loc să mute omul din pagină. Fără
 * script, apăsarea deschide fișa — nimic nu se pierde.
 */
const citesteTot = (t: Text): string =>
  areTot(t)
    ? `<a class="ch-tot" href="${CALE}/${esc(t.slug)}" data-chinonic="${esc(t.slug)}">Citește tot</a>`
    : `<span class="ch-doar">Doar bucata citită la strană` +
      `${adresaSeScrie(t) ? ' — textul întreg e la sursă' : ''}</span>`

/** O fișă din listă: titlu, autor, bucata scurtă, „Citește tot", sursa. Aceleași cinci, mereu. */
const fisa = (t: Text): string =>
  `<li class="ch-fisa">
  <h3 class="ch-titlu"><a href="${CALE}/${esc(t.slug)}">${esc(t.titlu || '(fără titlu)')}</a></h3>
  <p class="ch-autor${faraAutor(t)}">${esc(numeleAutorului(t))}</p>
  <div class="ch-scurt">${esc(textScurt(t))}</div>
  <p class="ch-rand-tot">${citesteTot(t)}<span class="ch-cand">citit la strană pe ${esc(ziua(t.citit_la))}</span></p>
  ${sursa(t)}
</li>`

/** Bucata de pe ușa Website-ului: cele mai noi zece și „Vezi toate". */
export function bucataDeAcasa(texte: Text[], nTotal: number): string {
  if (!texte.length) return ''
  return `<section class="ch-acasa">
  <h2>Texte citite la chinonic</h2>
  <p class="ch-spune">Ce s-a citit la strană, în timpul împărtășirii.</p>
  <ul class="ch-lista">${texte.map(fisa).join('')}</ul>
  <p class="ch-toate"><a href="${CALE}">Vezi toate — ${nTotal} ${nTotal === 1 ? 'text' : 'texte'} →</a></p>
</section>`
}

/* — LISTA MARE ȘI PAGINA DE STARE, amândouă din rezumate (fără textele întregi) — */

export const CALE_STARE = `${CALE}/stare`

const areTotR = (r: Rezumat): boolean => r.stare_text === 'gata' && r.n_text > 0
// ⚠️ sinaxarul ESTE sursa unei vieți de sfânt (vezi `eSinaxar`): rândul e completat prin definiție,
// iar adresa de site nu se mai judecă — nu de acolo vine textul, ci din sinaxar
const areSursaR = (r: Rezumat): boolean => eSinaxar(r.autor) || !!(r.sursa_text || r.sursa_nume || r.sursa_url)
const adresaVie = (r: Rezumat): boolean =>
  !eSinaxar(r.autor) && !!r.sursa_url && r.link_stare !== 'mort' && r.link_stare !== 'picat'
const numeR = (r: Rezumat): string => r.autor || 'Fără autor'

/** Cele două OK-uri cerute de user: textul preluat și sursa completată. Bifa spune și de ce, în `title`. */
const bifa = (da: boolean, ce: string, deCe: string): string =>
  `<span class="ch-bifa ${da ? 'da' : 'nu'}" title="${esc(deCe)}">${da ? '✓' : '—'} ${ce}</span>`

/**
 * ⚠️ UN RÂND DIN LISTA MARE = titlu, autor, două bife. Atât (user, 16.09.2026). Textul se citește în
 * fișă; aici pagina trebuie doar să se deschidă repede, cu 448 de rânduri în ea.
 */
const randCompact = (r: Rezumat): string =>
  `<li class="ch-rand">
  <a class="ch-t" href="${CALE}/${esc(r.slug)}">${esc(r.titlu || '(fără titlu)')}</a>
  <span class="ch-a${r.autor ? '' : ' ch-niciun-autor'}">${esc(numeR(r))}</span>
  <span class="ch-bife">${bifa(areTotR(r), 'text', areTotR(r) ? 'textul întreg e preluat' : pricinaTextului(r))}${
    bifa(areSursaR(r), 'sursă', eSinaxar(r.autor)
      ? 'viață de sfânt — sursa e Sinaxarul'
      : areSursaR(r)
        ? `${r.sursa_nume || r.sursa_text}${adresaVie(r) ? ' — cu legătură' : r.sursa_url ? ' — adresa nu mai trăiește' : ' — fără adresă'}`
        : 'nicio sursă scrisă')}</span>
</li>`

/** Anul citirii, singurul fapt după care se filtrează lista mare. */
const anulCitirii = (r: Rezumat): number => +r.citit_la.slice(0, 4)

/** Un segment de bară: ce scrie pe el, unde duce, dacă e cel deschis. */
interface Segment {
  nume: string
  href: string
  activ: boolean
  titlu?: string
}

/**
 * ⚠️ BARA ANILOR E CEA DE LA PROGRAM ȘI NEWSLETTER — aceeași pastilă, aceeași fâșie derulabilă,
 * aceleași clase (`bara-ani` / `an-buton`), ca aplicațiile să se recunoască între ele. Ce lipsește
 * dinadins sunt săgețile ‹ ›: acolo le scrie JS-ul antetului, iar Website-ul n-are antetul acela;
 * fâșia se derulează cu degetul, iar anii chinonicului sunt puțini.
 *
 * ⚠️ FILTRUL E O NAVIGARE, nu o ascundere din JavaScript: fiecare alegere are adresa ei
 * (`?an=2025`), merge fără script, se poate da mai departe și se poate lăsa înapoi. Serverul trimite
 * în pagină NUMAI rândurile alese — adică pagina se și ușurează, nu doar pare mai scurtă.
 */
function baraSegmentelor(eticheta: string, segmente: Segment[]): string {
  const butoane = segmente
    .map((s) => `<a class="an-buton${s.activ ? ' activ' : ''}" href="${esc(s.href)}"`
      + `${s.activ ? ' aria-current="page"' : ''}${s.titlu ? ` title="${esc(s.titlu)}"` : ''}>${esc(s.nume)}</a>`)
    .join('')
  return `<div class="bara-ani"><div class="fasie"><nav class="ani" aria-label="${esc(eticheta)}">${butoane}</nav></div></div>`
}

/**
 * Pagina cu toate — **un singur an o dată** (user, 16.09.2026: „aici să avem o filtrare pe ani…
 * totul ascuns în afară de ce e selectat; la intrare prima opțiune selectată").
 *
 * ⚠️ PRIMA OPȚIUNE E ANUL CEL MAI NOU, fiindcă anii merg descrescător — și tot el e cel ales când
 * nu se cere niciunul ori când se cere unul care nu există. Nu există „toți anii": ar însemna tocmai
 * lista de dinainte, cea de care s-a plâns că îngreunează browserul.
 */
export function paginaToate(rez: Rezumat[], anCerut?: string | number | null): string {
  const cuText = rez.filter(areTotR).length
  const ani = [...new Set(rez.map(anulCitirii))].sort((a, b) => b - a)
  const cerut = Number(anCerut)
  const an = ani.includes(cerut) ? cerut : (ani[0] ?? 0)
  const ale = rez.filter((r) => anulCitirii(r) === an)
  const bara = ani.length
    ? baraSegmentelor('Anii citirii', ani.map((a) => ({ nume: String(a), href: `${CALE}?an=${a}`, activ: a === an })))
    : ''
  return `<div class="cap">
  <h1 class="titlu-lista">Texte citite la chinonic</h1>
  <p class="sursa">Ce s-a citit la strană, în timpul împărtășirii — ${rez.length} texte, din
  ${ani[ani.length - 1] ?? ''} încoace. ${cuText} au textul întreg preluat.</p>
  ${bara}
  <p class="ch-spre-stare"><a href="${CALE_STARE}">Starea lor, pe categorii →</a></p>
</div>
${ale.length
    ? `<h2 class="anul">${an} <span class="ch-cate">${ale.length} ${ale.length === 1 ? 'text' : 'texte'}</span></h2>
<ul class="ch-compacta">${ale.map(randCompact).join('')}</ul>`
    : '<p class="ch-spune">Niciun text în anul acesta.</p>'}`
}

/** De ce nu are textul întreg — scris scurt, ca să se poată căuta pricina, nu doar lipsa. */
function pricinaTextului(r: Rezumat): string {
  if (!r.sursa_url) return 'nu are adresă de sursă — nu e de unde aduce'
  if (r.link_stare === 'mort') return 'adresa sursei nu mai există (404)'
  if (r.link_stare === 'picat') return 'adresa sursei nu mai răspunde'
  if (r.stare_text === 'nesigur') return 'textul adus nu începe ca bucata din buletin'
  if (r.stare_text === 'fara-text') return r.sursa_fel === 'pdf' ? 'PDF fără strat de text (scanare)' : 'pagina n-a dat text'
  if (r.stare_text === 'eroare') return 'adresa a răspuns rău la aducere'
  if (r.stare_text === 'netras') return 'încă n-a fost adus'
  return 'fără text întreg'
}

/** Numărul de buletin la care s-a citit, cerut de la Newsletter — cu legătură spre numărul lui. */
function dinCeNumar(n: Numar | undefined, urlNewsletter: string): string {
  if (!n) return '<span class="ch-nr necunoscut">număr necunoscut</span>'
  const scris = `${n.nr ? `nr. ${n.nr}` : 'fără număr'} · ${(n.trimis ?? '').slice(0, 10)}`
  return urlNewsletter
    ? `<a class="ch-nr" href="${esc(urlNewsletter)}/n/${n.id}" target="_blank" rel="noopener">${esc(scris)}</a>`
    : `<span class="ch-nr">${esc(scris)}</span>`
}

/** Un rând de investigat: titlu, autor, din ce număr vine și ce e în neregulă cu el. */
const randDeInvestigat = (r: Rezumat, n: Numar | undefined, urlNewsletter: string, pricina: string): string =>
  `<li class="ch-rand">
  <a class="ch-t" href="${CALE}/${esc(r.slug)}">${esc(r.titlu || '(fără titlu)')}</a>
  <span class="ch-a${r.autor ? '' : ' ch-niciun-autor'}">${esc(numeR(r))}</span>
  <span class="ch-de-ce">${esc(pricina)}</span>
  ${dinCeNumar(n, urlNewsletter)}
</li>`

/**
 * PAGINA DE STARE — locul de investigat, cerut de user (16.09.2026): „restul pe categorii… fără text
 * preluat, fără autor, fără sursă etc. cu toate problemele — dar să le văd separat pe scurt și dacă
 * intru pe ele le pot inspecta; să scrie și din ce news sunt luate".
 *
 * ⚠️ E o pagină de LUCRU, nu una de citit: rândurile sunt scurte, categoriile se pot suprapune
 * (același text poate fi și fără autor, și fără text întreg) și nu se indexează la căutare.
 *
 * ⚠️ O SINGURĂ CATEGORIE O DATĂ (user, 16.09.2026: „aici la fel — să fie filtrare, adică totul
 * ascuns în afară de ce e selectat; la intrare prima opțiune selectată"). Cuprinsul nu mai e un șir
 * de ancore care sar prin pagină, ci FILTRUL însuși: se scrie numai categoria aleasă, iar celelalte
 * rămân doar ca butoane, cu numărul lor. Prima opțiune — „Fără textul întreg", cea mai mare — e cea
 * deschisă când nu se cere alta.
 *
 * ⚠️ Anii filtrează ÎNĂUNTRUL categoriei și acolo prima opțiune e „Toți anii": pe o pagină de
 * investigat, a ascunde din pornire tot afară de anul curent ar ascunde tocmai ce e de cercetat.
 */
export function paginaStare(
  rez: Rezumat[],
  numere: Map<string, Numar>,
  urlNewsletter: string,
  ceCerut?: string | null,
  anCerut?: string | number | null,
): string {
  const grupe: { cheie: string; nume: string; spune: string; care: (r: Rezumat) => boolean; pricina: (r: Rezumat) => string }[] = [
    {
      cheie: 'fara-text',
      nume: 'Fără textul întreg',
      spune: 'Fișa arată doar bucata citită în buletin. Pricina e scrisă la fiecare.',
      care: (r) => !areTotR(r),
      pricina: pricinaTextului,
    },
    {
      cheie: 'fara-autor',
      nume: 'Fără autor',
      spune: 'Buletinul n-a scris niciun nume, iar titlul nu e de sinaxar — numele e de căutat la sursă.',
      care: (r) => !r.autor,
      pricina: (r) => {
        if (adresaVie(r)) return 'de căutat în pagina sursei'
        if (areSursaR(r)) return `de căutat la „${r.sursa_nume || r.sursa_text}", dar fără adresă vie`
        return 'nici măcar sursa nu e scrisă'
      },
    },
    {
      cheie: 'fara-sursa',
      nume: 'Fără sursă',
      spune: 'Nici mențiune scrisă, nici legătură — nu se știe de unde a fost luat.',
      care: (r) => !areSursaR(r),
      pricina: () => 'nimic în rândul „Sursă" al buletinului',
    },
    {
      cheie: 'link-mort',
      nume: 'Cu adresa sursei moartă',
      spune: 'Adresa a fost întrebată și nu mai trăiește; în pagină rămâne doar numele, fără legătură. ' +
        'Viețile de sfinți nu intră aici: sursa lor e Sinaxarul, nu site-ul de unde s-a adus textul.',
      // ⚠️ sinaxarele ies din categorie (user, 16.09.2026) — o adresă moartă nu le strică nimic
      care: (r) => !eSinaxar(r.autor) && (r.link_stare === 'mort' || r.link_stare === 'picat'),
      pricina: (r) => (r.link_stare === 'mort' ? 'răspunde 404 — pagina a fost ștearsă' : 'nu mai răspunde nimeni la adresă'),
    },
    {
      cheie: 'fara-titlu',
      nume: 'Fără titlu',
      spune: 'Buletinul n-a scris niciun titlu, iar la sursă nu s-a găsit unul.',
      care: (r) => !r.titlu,
      pricina: () => 'de scris de mână în `indreptari.json`',
    },
    {
      cheie: 'fisa-goala',
      nume: 'Cu bucată prea scurtă ca să poată fi verificat',
      spune: 'Buletinul n-a lăsat decât câteva cuvinte, deci textul adus de la sursă n-a avut cu ce fi ' +
        'verificat. Unde textul E în bază, el se poate arăta oricând — e hotărârea ta.',
      care: (r) => r.n_fragment < 40 && !areTotR(r),
      pricina: (r) => (r.n_text > 500
        ? `numai ${r.n_fragment} semne în buletin, dar textul adus (${r.n_text} semne) stă în bază`
        : `numai ${r.n_fragment} semne în buletin și niciun text adus`),
    },
  ]

  /*
   * ⚠️ SE INVESTIGHEAZĂ NUMAI TEXTELE LEGATE DE UN NUMĂR TRIMIS (user, 16.09.2026: „vreau să mă uit
   * doar pe texte care fac parte dintr-un anumit buletin online publicat și transmis… pune-le
   * separat, că nu vreau să mă uit pe ele"). Un text fără asociere n-are cum fi cercetat: nu se știe
   * din ce număr vine, deci nici unde să te uiți ca să-l îndrepți. De aceea IESE din toate
   * categoriile și stă într-a lui, ultima.
   *
   * ⚠️ Dar numai când Newsletterul CHIAR a răspuns. Dacă binding-ul tace, harta e goală și „fără
   * număr" ar înghiți toate textele — necunoașterea noastră s-ar citi ca o lipsă a lor. Atunci
   * pagina rămâne cum era, cu toate categoriile întregi.
   */
  const stimNumerele = numere.size > 0
  const areNumar = (r: Rezumat): boolean => numere.has(r.slug)
  const cuNumar = stimNumerele
    ? grupe.map((g) => ({ ...g, care: (r: Rezumat) => areNumar(r) && g.care(r) }))
    : grupe
  if (stimNumerele) {
    cuNumar.push({
      cheie: 'fara-numar',
      nume: 'Fără număr de buletin',
      spune: 'Textul e în bază, dar Newsletterul nu-l leagă de niciun număr trimis — deci nu se știe ' +
        'din ce buletin vine. Stau deoparte, scoase din celelalte categorii: n-ai de unde începe.',
      care: (r) => !areNumar(r),
      pricina: () => 'nicio asociere cu un număr trimis',
    })
  }

  /*
   * ⚠️ CUPRINSUL E FILTRUL, nu un șir de ancore: se scrie o singură categorie o dată, cea aleasă,
   * iar celelalte rămân butoane cu numărul lor. Alegerea e o navigare (`?ce=…`), deci merge fără
   * JavaScript și are adresă — un rând de investigat se poate da mai departe așa cum e.
   */
  const ales = cuNumar.find((g) => g.cheie === ceCerut) ?? cuNumar[0]!
  const ale = rez.filter(ales.care)
  const ani = [...new Set(ale.map(anulCitirii))].sort((a, b) => b - a)
  const cerut = Number(anCerut)
  const an = ani.includes(cerut) ? cerut : 0 // 0 = toți anii, prima opțiune a barei
  const randuri = an ? ale.filter((r) => anulCitirii(r) === an) : ale

  const cuprins = cuNumar
    .map((g) => `<li${g.cheie === ales.cheie ? ' class="activ"' : ''}>`
      + `<a href="${CALE_STARE}?ce=${g.cheie}${an ? `&amp;an=${an}` : ''}">${esc(g.nume)}</a>`
      + ` <b>${rez.filter(g.care).length}</b></li>`)
    .join('')

  const baraAni = ani.length > 1
    ? baraSegmentelor('Anii citirii', [
      { nume: 'Toți anii', href: `${CALE_STARE}?ce=${ales.cheie}`, activ: !an },
      ...ani.map((a) => ({ nume: String(a), href: `${CALE_STARE}?ce=${ales.cheie}&an=${a}`, activ: a === an })),
    ])
    : ''

  const sectiune = `<section class="ch-grupa" id="${ales.cheie}">
  <h2>${esc(ales.nume)} <span class="ch-cate">${ale.length}${an ? ` · ${randuri.length} în ${an}` : ''}</span></h2>
  <p class="ch-spune">${esc(ales.spune)}</p>
  ${baraAni}
  ${randuri.length
    ? `<ul class="ch-compacta">${randuri.map((r) => randDeInvestigat(r, numere.get(r.slug), urlNewsletter, ales.pricina(r))).join('')}</ul>`
    : `<p class="ch-spune">${an ? 'Niciunul în anul acesta.' : 'Niciunul — categoria e goală.'}</p>`}
</section>`

  const cuText = rez.filter(areTotR).length
  const cuAutor = rez.filter((r) => r.autor).length
  const cuSursa = rez.filter(areSursaR).length
  return `<div class="cap">
  <h1 class="titlu-lista">Texte citite la chinonic — starea lor</h1>
  <p class="sursa">${rez.length} texte · ${cuText} cu textul întreg · ${cuAutor} cu autor ·
  ${cuSursa} cu sursă scrisă. Numărul de buletin vine de la Newsletter; apasă-l ca să deschizi numărul.</p>
  <ul class="ch-cuprins">${cuprins}</ul>
  <p class="ch-spre-stare"><a href="${CALE}">← Lista întreagă</a></p>
</div>
${sectiune}`
}

/** Pagina unui text. */
export function paginaText(t: Text, urlNewsletter: string): string {
  /*
   * Ordinea ceruta de user (16.09.2026): TITLUL, apoi AUTORUL sub el, apoi textul. Autorul e rand
   * de sine statator, nu lipit de data: e parte din ce s-a citit, data e doar cand.
   */
  return `<div class="cap">
  <h1 class="titlu-lista">${esc(t.titlu || '(fără titlu)')}</h1>
  <p class="ch-autorul${faraAutor(t)}">${esc(numeleAutorului(t))}</p>
  <p class="sursa">citit la strană pe ${esc(ziua(t.citit_la))}</p>
</div>
${t.poza ? `<img class="ch-poza" src="${esc(poza(t, urlNewsletter))}" alt="">` : ''}
${corpTextului(t)}
${areTot(t) ? '' : `<p class="ch-partial">Aici e doar bucata citită în buletin. Textul întreg încă n-a fost adus.</p>`}
${sursa(t)}
<nav class="vecini"><a href="${CALE}">← Toate textele citite la chinonic</a></nav>`
}

/*
 * ⚠️ DESFĂȘURAREA — „citește tot" fără să se mute omul din pagină (user, 16.09.2026). Textul se cere
 * de la fișa lui, cu `?bucata=text` (numai corpul, fără carcasă), și se pune sub bucata scurtă. E
 * îmbunătățire progresivă: fără script legătura duce la fișă, ca înainte, iar pagina cu toate rămâne
 * ușoară — 448 de texte întregi n-au ce căuta deodată în ea.
 */
export const JS_CHINONIC = `
(function(){
  document.addEventListener('click', function(ev){
    var a = ev.target.closest && ev.target.closest('a.ch-tot'); if (!a) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;
    ev.preventDefault();
    var fisa = a.closest('.ch-fisa'); if (!fisa) return;
    var desfasurat = fisa.querySelector('.ch-desfasurat');
    if (desfasurat) { // a doua apăsare strânge la loc
      var deschis = desfasurat.hasAttribute('hidden');
      if (deschis) desfasurat.removeAttribute('hidden'); else desfasurat.setAttribute('hidden','');
      a.textContent = deschis ? 'Strânge' : 'Citește tot';
      fisa.querySelector('.ch-scurt').hidden = deschis;
      return;
    }
    a.textContent = 'Se aduce…';
    fetch(a.getAttribute('href') + '?bucata=text').then(function(r){ return r.ok ? r.text() : Promise.reject(r.status) })
      .then(function(h){
        var d = document.createElement('div'); d.className = 'ch-desfasurat'; d.innerHTML = h;
        fisa.querySelector('.ch-scurt').hidden = true;
        a.parentNode.insertAdjacentElement('afterend', d);
        a.textContent = 'Strânge';
      })
      .catch(function(){ a.textContent = 'Citește tot'; window.location = a.getAttribute('href') });
  });
})();
`

export const STIL_CHINONIC = `
/* TEXTE CITITE LA CHINONIC (16.09.2026) — lista de pe usa Website-ului si paginile lor. */
.ch-acasa { margin:34px 0 0; padding:20px 0 0; border-top:1px solid var(--rule) }
.ch-acasa > h2 { margin:0 0 2px; font-size:21px; font-weight:400 }
.ch-spune { margin:0 0 12px; color:var(--faint); font-size:14px }
/* ⚠️ o fisa = titlu, autor, bucata scurta, „Citeste tot", sursa — mereu in aceeasi ordine */
.ch-lista { list-style:none; padding:0; margin:0 }
.ch-fisa { padding:16px 0 18px; border-bottom:1px solid var(--rule) }
.ch-fisa:last-child { border-bottom:0 }
.ch-titlu { margin:0; font-size:18px; font-weight:600; line-height:1.35 }
.ch-titlu a { color:var(--ink); text-decoration:none }
.ch-titlu a:hover { color:var(--rosu); text-decoration:underline }
/* autorul, sub titlu: se citeste ca o lamurire, nu ca parte din titlu */
.ch-autor { display:block; margin:3px 0 0; color:var(--soft); font-size:14px }
/* „Fără autor" e o lipsa marturisita, nu un nume: se scrie mai stins si inclinat */
.ch-niciun-autor { font-style:italic; opacity:.65 }
.ch-scurt { margin:8px 0 0; color:var(--ink); line-height:1.65; font-size:15px }
.ch-desfasurat { margin:10px 0 0 }
.ch-rand-tot { display:flex; flex-wrap:wrap; align-items:baseline; gap:10px; margin:8px 0 0 }
.ch-tot { color:var(--rosu); text-decoration:none; font:600 13.5px/1 ui-sans-serif,system-ui;
          cursor:pointer }
.ch-tot:hover { text-decoration:underline }
/* unde textul intreg n-a putut fi adus se scrie limpede — e marcajul, pe dos */
.ch-doar { color:var(--faint); font:13px/1.4 ui-sans-serif,system-ui; font-style:italic }
.ch-cand { color:var(--faint); font:12.5px/1.4 ui-sans-serif,system-ui }
/* ⚠️ LISTA MARE E COMPACTA: titlu, autor, doua bife. Fara text, ca sa se deschida repede cu 448 de
   randuri in ea (user, 16.09.2026: „lista mare nu o mai fisa complet ca se ingreuneaza browser-ul") */
.ch-compacta { list-style:none; padding:0; margin:0 }
.ch-rand { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 10px;
           padding:7px 0; border-bottom:1px solid var(--rule) }
.ch-rand:last-child { border-bottom:0 }
.ch-t { color:var(--ink); text-decoration:none; font-size:15px; flex:1 1 320px }
.ch-t:hover { color:var(--rosu); text-decoration:underline }
.ch-a { color:var(--faint); font:13px/1.4 ui-sans-serif,system-ui; flex:0 1 auto }
.ch-bife { display:flex; gap:8px; flex:0 0 auto }
.ch-bifa { font:12px/1.4 ui-sans-serif,system-ui; white-space:nowrap }
.ch-bifa.da { color:var(--verde,#3a7d44) }
.ch-bifa.nu { color:var(--faint); opacity:.75 }
/* ⚠️ BARA ANILOR — aceeasi ca la Program si la Newsletter (aceleasi clase, acelasi desen), ca sa se
   recunoasca dintr-o privire ca e acelasi lucru. Fara sageti: aici nu e antetul care le scrie. */
.bara-ani { display:flex; align-items:stretch; margin:10px 0 0;
            border:1px solid var(--rule); border-radius:10px; background:var(--tinta);
            overflow:hidden }
.bara-ani .fasie { flex:1 1 auto; min-width:0; overflow-x:auto; overscroll-behavior-x:contain;
                   -webkit-overflow-scrolling:touch; scrollbar-width:none }
.bara-ani .fasie::-webkit-scrollbar { display:none }
.bara-ani .ani { display:flex; align-items:stretch; gap:0; width:max-content; padding:0 }
.an-buton { flex:none; display:flex; align-items:center; justify-content:center;
            color:var(--soft); text-decoration:none; background:transparent;
            border:0; border-radius:0; padding:10px 13px;
            font:600 12.5px/1 ui-sans-serif,system-ui; letter-spacing:.03em; white-space:nowrap }
.an-buton + .an-buton { border-left:1px solid var(--rule) }
.an-buton:hover { color:var(--rosu); background:var(--paper) }
/* anul deschis: rosu si plin, ca segmentul pe care esti din pastila */
.an-buton.activ { color:var(--rosu); font-weight:700;
                  background:color-mix(in srgb, var(--rosu) 11%, transparent) }
/* pagina de stare — locul de investigat */
/* ⚠️ CUPRINSUL E FILTRUL: pastila apasata e cea deschisa, celelalte duc la ea. Se vede care e
   aleasa, altfel omul n-ar sti de ce vede o singura categorie (user, 16.09.2026). */
.ch-cuprins { list-style:none; display:flex; flex-wrap:wrap; gap:8px; padding:0; margin:12px 0 0 }
.ch-cuprins li { border:1px solid var(--rule); border-radius:999px; padding:5px 12px; font-size:13px }
.ch-cuprins a { color:var(--ink); text-decoration:none }
.ch-cuprins a:hover { color:var(--rosu) }
.ch-cuprins b { color:var(--rosu) }
.ch-cuprins li.activ { border-color:var(--rosu);
                       background:color-mix(in srgb, var(--rosu) 11%, transparent) }
.ch-cuprins li.activ a { color:var(--rosu); font-weight:600 }
.ch-grupa { margin:30px 0 0; padding:16px 0 0; border-top:1px solid var(--rule) }
.ch-grupa > h2 { margin:0 0 2px; font-size:19px; font-weight:400 }
.ch-cate { color:var(--faint); font-size:15px }
.ch-de-ce { color:var(--faint); font:12.5px/1.4 ui-sans-serif,system-ui; flex:0 1 auto }
.ch-nr { color:var(--soft); font:12.5px/1.4 ui-sans-serif,system-ui; text-decoration:none;
         white-space:nowrap }
.ch-nr:hover { color:var(--rosu); text-decoration:underline }
.ch-nr.necunoscut { opacity:.55 }
.ch-spre-stare { margin:10px 0 0 }
.ch-spre-stare a { color:var(--rosu); text-decoration:none; font:600 13px/1 ui-sans-serif,system-ui }
.ch-spre-stare a:hover { text-decoration:underline }
.ch-toate { margin:16px 0 0 }
.ch-toate a { color:var(--rosu); text-decoration:none; font:600 13.5px/1 ui-sans-serif,system-ui }
.ch-toate a:hover { text-decoration:underline }
.anul { margin:28px 0 2px; font-size:19px; color:var(--soft) }

/* pagina unui text */
/* autorul, sub titlu: scris mai mare decat data, fiindca e parte din ce s-a citit */
.ch-autorul { margin:2px 0 4px; font-size:17px; color:var(--soft) }
.ch-poza { display:block; width:100%; height:auto; border-radius:12px; margin:18px 0 0 }
/* ⚠️ textul e al nostru, in <p>-uri curate, deci ia culorile temei — nu mai e HTML de email cu
   scris negru scris inline, care pe tema intunecata nu se vedea (user, 16.09.2026) */
.ch-text { color:var(--ink) }
.ch-text { margin:18px 0 0; line-height:1.7 }
.ch-text p { margin:0 0 12px }
/* fragmentul se vede ca fragment: o dunga la stanga spune ca textul nu e intreg */
.ch-fragment { padding-left:14px; border-left:3px solid var(--rule) }
.ch-partial { margin:12px 0 0; color:var(--faint); font-size:13.5px }
.ch-sursa { margin:12px 0 0; padding:10px 12px; background:var(--tinta);
            border:1px solid var(--rule); border-radius:10px;
            color:var(--soft); font-size:13px }
.ch-sursa > span { font-weight:600; color:var(--ink) }
.ch-drum { color:var(--rosu) }
@media (max-width:560px) {
  .ch-titlu { font-size:17px }
}
`
