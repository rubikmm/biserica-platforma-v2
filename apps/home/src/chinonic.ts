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
 * ⚠️⚠️ TREI PAGINI, TREI TREBURI (forma cerută de user, 16.09.2026, seara):
 *   - **ușa Website-ului**: două categorii, zece rânduri fiecare, DOAR titlul și autorul, plus
 *     „Vezi toate" („să afișezi cele două categorii articole-chinonic și articole-buletin doar titlul
 *     și autorul cu link — 10 elemente + vezi toate");
 *   - **lista întreagă**: numai CELE BUNE, filtrate pe ani („la vezi toate să se vadă direct cele
 *     bune — filtru pe ani"), cu legătură spre pagina de probleme;
 *   - **pagina de probleme**: tot ce nu e bun, pe feluri de lipsă, o categorie o dată („și cu link
 *     către pagina cu probleme unde avem clar filtru cu ce probleme au").
 * ⚠️ Fișa bogată de pe ușă — bucată de text, „Citește tot", sursa — a IEȘIT atunci: pe ușă se scrie
 * numai titlul și autorul. Nu o readu.
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

/**
 * ⚠️⚠️ TEXTELE DIN BULETINUL PAROHIEI STAU DEOPARTE, LA ADRESA LOR (user, 16.09.2026: „elimină toate
 * textele preluate din buletinul parohiei, fișier PDF care se află în newsletter… le poți muta la
 * `texte-din-buletin`, ca să fie începută treaba de adunare a materialelor pentru website").
 *
 * Ce le deosebește: sursa lor nu e un text publicat undeva, ci un PDF al parohiei, urcat în arhiva
 * newsletterului (`newsletter.sfantul-ilie.ro/media/uploads/…`). Din newsletter ne interesează numai
 * ARTICOLELE de după programul liturgic și după buletin — 1, 2 ori 3 la fiecare număr; ce vine din
 * fișierul parohiei nu e articolul citit la strană, ci materialul nostru, de lucrat mai departe.
 *
 * ⚠️ Nu se șterge nimic din bază: rândurile trec într-o a doua secțiune, cu aceleași fișe. Slugul
 * rămâne al textului, deci vechea adresă de la chinonic duce, printr-o mutare permanentă (301), la
 * noua ei casă — regula slugului nu se încalcă.
 */
export const CALE_BULETIN = '/texte-din-buletin'
const GAZDA_BULETIN = '//newsletter.sfantul-ilie.ro/'
/** Aceeași judecată, scrisă o dată pentru bază și o dată pentru pagini — să nu se despartă. */
const UNDE_BULETIN = `(sursa_fel = 'pdf' AND instr(sursa_url, '${GAZDA_BULETIN}') > 0)`
export const dinBuletin = (t: { sursa_fel: string; sursa_url: string }): boolean =>
  t.sursa_fel === 'pdf' && t.sursa_url.includes(GAZDA_BULETIN)

/** Adresa fișei se citește din text: fiecare secțiune își ține ai ei, nimeni nu cară calea cu el. */
export const caleaLui = (t: { sursa_fel: string; sursa_url: string }): string =>
  dinBuletin(t) ? CALE_BULETIN : CALE

/** Cele două grămezi. Una e de citit, cealaltă e material de lucru — dar se cercetează la fel. */
export type Fel = 'chinonic' | 'buletin'

/** Pagina de lucru a unei secțiuni: fiecare grămadă are problemele ei, la adresa ei. */
export const stareaLui = (cale: string): string => `${cale}/stare`
export const CALE_STARE = stareaLui(CALE)
export const CALE_STARE_BULETIN = stareaLui(CALE_BULETIN)

const CAILE: Record<Fel, { cale: string; titlu: string }> = {
  chinonic: { cale: CALE, titlu: 'Texte citite la chinonic' },
  buletin: { cale: CALE_BULETIN, titlu: 'Texte din buletinul parohiei' },
}
export const felulCaii = (cale: string): Fel => (cale === CALE_BULETIN ? 'buletin' : 'chinonic')

const CAMPURI = `slug, titlu, autor, citit_la, fragment, text_intreg, stare_text,
                 sursa_text, sursa_nume, sursa_url, sursa_fel, poza, link_stare`

/**
 * ⚠️ NICI O PAGINĂ NU CARĂ TEXTELE (user, 16.09.2026: „lista mare nu o mai fișa complet că se
 * îngreunează browser-ul"). 448 de texte întregi înseamnă vreo 3 MB scoși din bază și trimiși în
 * pagină la fiecare deschidere, ca să se vadă din ei niște titluri. Aici se cer numai faptele DESPRE
 * text — lungimile, nu conținutul —, iar textul se citește din fișa lui.
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

/** `fel` alege secțiunea: textele citite la chinonic ori cele scoase din fișierele parohiei. */
export async function rezumate(db: D1Database, fel: Fel = 'chinonic'): Promise<Rezumat[]> {
  const r = await db.prepare(`SELECT slug, titlu, autor, citit_la, stare_text, sursa_text, sursa_nume,
      sursa_url, sursa_fel, link_stare, LENGTH(fragment) AS n_fragment, LENGTH(text_intreg) AS n_text
    FROM texte_chinonic WHERE ${fel === 'buletin' ? '' : 'NOT '}${UNDE_BULETIN}
    ORDER BY citit_la DESC, id DESC`).all<Rezumat>()
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
const numeleAutorului = (t: { autor: string }): string => t.autor || 'Fără autor'
const faraAutor = (t: { autor: string }): string => (t.autor ? '' : ' ch-niciun-autor')

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

/** Textul întreg, așa cum intră în fișă. */
export const corpTextului = (t: Text): string =>
  areTot(t)
    ? `<div class="ch-text">${t.text_intreg}</div>`
    : `<div class="ch-text ch-fragment">${t.fragment}</div>`

/* — UȘA WEBSITE-ULUI: două categorii, zece rânduri, titlu și autor — */

/**
 * ⚠️⚠️ UN RÂND DE PE UȘĂ = TITLU LEGAT + AUTOR. Atât (user, 16.09.2026: „doar titlul și autorul cu
 * link — 10 elemente + vezi toate"). Înainte pe ușă stătea fișa întreagă, cu bucată de text, „Citește
 * tot" și sursa; de acum lucrurile acelea se văd în fișă, unde e locul lor.
 */
const randDeUsa = (r: Rezumat): string =>
  `<li class="ch-rand">
  <a class="ch-t" href="${caleaLui(r)}/${esc(r.slug)}">${esc(r.titlu || '(fără titlu)')}</a>
  <span class="ch-a${faraAutor(r)}">${esc(numeleAutorului(r))}</span>
</li>`

/**
 * O categorie pe ușa Website-ului: cele mai noi zece BUNE și „Vezi toate".
 *
 * ⚠️ Se arată numai cele bune, ca și în lista întreagă: ușa e fața parohiei, nu locul de lucru. Ce
 * n-are textul adus ori n-are autor se vede în pagina de probleme, nu aici.
 */
function categoriaDeAcasa(rez: Rezumat[], fel: Fel, spune: string): string {
  const bune = rez.filter(eBun)
  if (!bune.length) return ''
  const { cale, titlu } = CAILE[fel]
  const zece = bune.slice(0, CATE_PE_ACASA)
  return `<section class="ch-categorie">
  <h2>${esc(titlu)}</h2>
  <p class="ch-spune">${esc(spune)}</p>
  <ul class="ch-compacta">${zece.map(randDeUsa).join('')}</ul>
  <p class="ch-toate"><a href="${cale}">Vezi toate — ${bune.length} ${bune.length === 1 ? 'text' : 'texte'} →</a></p>
</section>`
}

/** Bucata de pe ușa Website-ului: cele două categorii, una lângă alta. */
export function bucataDeAcasa(chinonic: Rezumat[], buletin: Rezumat[]): string {
  const doua = [
    categoriaDeAcasa(chinonic, 'chinonic', 'Ce s-a citit la strană, în timpul împărtășirii.'),
    categoriaDeAcasa(buletin, 'buletin', 'Texte scoase din buletinele parohiei.'),
  ].filter(Boolean)
  if (!doua.length) return ''
  return `<div class="ch-usa">${doua.join('')}</div>`
}

/* — LISTA ÎNTREAGĂ ȘI PAGINA DE PROBLEME, amândouă din rezumate (fără textele întregi) — */

const areTotR = (r: Rezumat): boolean => r.stare_text === 'gata' && r.n_text > 0
// ⚠️ sinaxarul ESTE sursa unei vieți de sfânt (vezi `eSinaxar`): rândul e completat prin definiție,
// iar adresa de site nu se mai judecă — nu de acolo vine textul, ci din sinaxar
const areSursaR = (r: Rezumat): boolean => eSinaxar(r.autor) || !!(r.sursa_text || r.sursa_nume || r.sursa_url)
const adresaVie = (r: Rezumat): boolean =>
  !eSinaxar(r.autor) && !!r.sursa_url && r.link_stare !== 'mort' && r.link_stare !== 'picat'

/**
 * ⚠️⚠️ „BUN" ÎNSEAMNĂ CHIAR BUN (user, 16.09.2026: „fă o categorie cu tot ce este bun, dar ai grijă
 * să pui doar ce este chiar bun acolo"). De aceea se cer TOATE deodată, nu „mai nimic de făcut":
 *   - are titlu și are autor scris — la viețile de sfinți autorul e «Sinaxar», adică un nume, nu o lipsă;
 *   - textul întreg e adus ȘI a trecut proba (`stare_text = gata`), nu doar stă în bază („nesigur");
 *   - textul adus e mai lung decât bucata din buletin — altfel n-am adus nimic pe deasupra ei;
 *   - bucata din buletin a avut cel puțin 40 de semne, adică proba a avut cu ce fi făcută. La sinaxare
 *     proba nu se cere (hotărârea userului), deci nici lungimea bucății nu le judecă;
 *   - sursa e scrisă, iar adresa ei încă trăiește, ca omul să poată ajunge la ea; la sinaxare sursa e
 *     Sinaxarul și atât.
 *
 * ⚠️⚠️ ACEEAȘI JUDECATĂ ȚINE ACUM TREI PAGINI: ce se scrie pe ușă, ce se scrie în lista întreagă și ce
 * se numără în categoria „Bune" din pagina de probleme. Dacă se lărgește aici, se lărgește peste tot —
 * de aceea nu se lărgește fără măsurătoare.
 */
export const eBun = (r: Rezumat): boolean =>
  !!r.titlu && !!r.autor && areTotR(r) && r.n_text > r.n_fragment
  && (eSinaxar(r.autor) || (r.n_fragment >= 40 && adresaVie(r)))

/** Anul citirii, singurul fapt după care se filtrează lista întreagă. */
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
 * ⚠️⚠️ UN RÂND DIN LISTA ÎNTREAGĂ = titlu, autor, ziua citirii. Bifele „✓ text" și „✓ sursă" au ieșit
 * odată cu trecerea listei pe NUMAI CELE BUNE (user, 16.09.2026): într-o listă unde toate au textul
 * adus și sursa vie, două bife verzi pe fiecare rând nu mai spun nimic. Ce lipsește se vede în pagina
 * de probleme, cu pricina scrisă.
 */
const randCompact = (r: Rezumat): string =>
  `<li class="ch-rand">
  <a class="ch-t" href="${caleaLui(r)}/${esc(r.slug)}">${esc(r.titlu || '(fără titlu)')}</a>
  <span class="ch-a${faraAutor(r)}">${esc(numeleAutorului(r))}</span>
  <span class="ch-cand">${esc(ziua(r.citit_la))}</span>
</li>`

/**
 * LISTA ÎNTREAGĂ — **numai cele bune, un singur an o dată** (user, 16.09.2026: „la vezi toate să se
 * vadă direct cele bune — filtru pe ani / și cu link către pagina cu probleme").
 *
 * ⚠️ PRIMA OPȚIUNE E ANUL CEL MAI NOU, fiindcă anii merg descrescător — și tot el e cel ales când
 * nu se cere niciunul ori când se cere unul care nu există. Nu există „toți anii": ar însemna tocmai
 * lista de dinainte, cea de care s-a plâns că îngreunează browserul.
 */
export function paginaToate(rez: Rezumat[], anCerut?: string | number | null): string {
  return listaCelorBune(rez, anCerut, 'chinonic',
    'Ce s-a citit la strană, în timpul împărtășirii.')
}

/**
 * TEXTELE DIN BULETINUL PAROHIEI — a doua secțiune, cerută de user (16.09.2026). Aceeași listă, ca
 * să se poată lucra la fel în ea; alta e numai proveniența, iar asta se spune limpede în cap.
 *
 * ⚠️ NU e o listă de citit, ci grămada de materiale de unde începe adunarea pentru website: textele
 * astea n-au venit de la un autor publicat undeva, ci din fișierele PDF ale parohiei.
 */
export function paginaBuletin(rez: Rezumat[], anCerut?: string | number | null): string {
  return listaCelorBune(rez, anCerut, 'buletin',
    'Texte scoase din fișierele PDF ale parohiei, urcate în arhiva newsletterului. Ele stau deoparte '
    + 'de cele citite la chinonic: de aici începe adunarea materialelor pentru website.')
}

/** Anii din care s-a citit, de la cel mai nou la cel mai vechi. */
const aniiDin = (rez: Rezumat[]): number[] => [...new Set(rez.map(anulCitirii))].sort((a, b) => b - a)

/**
 * Trupul comun al celor două liste: cap, bara anilor, rândurile anului ales.
 *
 * ⚠️ SE CÂNTĂRESC TOATE, DAR SE SCRIU NUMAI CELE BUNE — iar ce a rămas afară se SPUNE, cu legătură
 * spre locul unde se lucrează la el. O listă care ascunde în tăcere o parte din arhivă ar minți.
 */
function listaCelorBune(
  rez: Rezumat[],
  anCerut: string | number | null | undefined,
  fel: Fel,
  spune: string,
): string {
  const { cale, titlu } = CAILE[fel]
  const bune = rez.filter(eBun)
  const deLucru = rez.length - bune.length
  const ani = aniiDin(bune)
  const cerut = Number(anCerut)
  const an = ani.includes(cerut) ? cerut : (ani[0] ?? 0)
  const ale = bune.filter((r) => anulCitirii(r) === an)
  const bara = ani.length
    ? baraSegmentelor('Anii citirii', ani.map((a) => ({ nume: String(a), href: `${cale}?an=${a}`, activ: a === an })))
    : ''
  const celalalt = fel === 'chinonic'
    ? `<p class="ch-spre-stare"><a href="${CALE_BULETIN}">Texte din buletinul parohiei →</a></p>`
    : `<p class="ch-spre-stare"><a href="${CALE}">← Textele citite la chinonic</a></p>`
  return `<div class="cap">
  <h1 class="titlu-lista">${esc(titlu)}</h1>
  <p class="sursa">${esc(spune)} <b>${bune.length} ${bune.length === 1 ? 'text bun' : 'texte bune'}</b>,
  din ${ani[ani.length - 1] ?? ''} încoace.</p>
  ${bara}
  <p class="ch-spre-stare"><a href="${stareaLui(cale)}">${deLucru
    ? `Cele cu probleme — ${deLucru} de lămurit →`
    : 'Starea lor, pe categorii →'}</a></p>
  ${celalalt}
</div>
${ale.length
    ? `<h2 class="anul">${an} <span class="ch-cate">${ale.length} ${ale.length === 1 ? 'text' : 'texte'}</span></h2>
<ul class="ch-compacta">${ale.map(randCompact).join('')}</ul>`
    : '<p class="ch-spune">Niciun text bun în anul acesta.</p>'}`
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
  <a class="ch-t" href="${caleaLui(r)}/${esc(r.slug)}">${esc(r.titlu || '(fără titlu)')}</a>
  <span class="ch-a${faraAutor(r)}">${esc(numeleAutorului(r))}</span>
  <span class="ch-de-ce">${esc(pricina)}</span>
  ${dinCeNumar(n, urlNewsletter)}
</li>`

/**
 * ⚠️ FELUL SURSEI, așa cum e el în arhivă (user, 16.09.2026, întrebat cum arată datele): „sursa în
 * general este website, dar ocazional mai este PDF sau tot ocazional este fără link, doar o mențiune
 * carte. Există foarte rare situațiile fără sursă." De aceea cele patru feluri se NUMĂRĂ în capul
 * paginii de probleme: așa se vede dintr-o privire dacă o cifră a plecat de unde trebuia să fie.
 */
const felulSursei = (r: Rezumat): 'pagina' | 'pdf' | 'mentiune' | 'fara' => {
  if (r.sursa_url) return r.sursa_fel === 'pdf' ? 'pdf' : 'pagina'
  if (r.sursa_text || r.sursa_nume) return 'mentiune'
  return 'fara'
}

/**
 * PAGINA DE PROBLEME — locul de investigat, cerut de user (16.09.2026): „restul pe categorii… fără
 * text preluat, fără autor, fără sursă etc. cu toate problemele — dar să le văd separat pe scurt și
 * dacă intru pe ele le pot inspecta; să scrie și din ce news sunt luate", apoi, seara: „link către
 * pagina cu probleme unde avem clar filtru cu ce probleme au".
 *
 * ⚠️ E o pagină de LUCRU, nu una de citit: rândurile sunt scurte, categoriile se pot suprapune
 * (același text poate fi și fără autor, și fără text întreg) și nu se indexează la căutare.
 *
 * ⚠️ O SINGURĂ CATEGORIE O DATĂ (user, 16.09.2026: „aici la fel — să fie filtrare, adică totul
 * ascuns în afară de ce e selectat; la intrare prima opțiune selectată"). Cuprinsul nu e un șir de
 * ancore care sar prin pagină, ci FILTRUL însuși: se scrie numai categoria aleasă, iar celelalte
 * rămân doar ca butoane, cu numărul lor.
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
  fel: Fel = 'chinonic',
): string {
  const { cale } = CAILE[fel]
  const caleStare = stareaLui(cale)
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
      spune: 'Buletinul n-a scris niciun nume, iar titlul nu e de sinaxar — numele e de căutat la '
        + 'sursă. Aproape toate textele au autor, deci fiecare rând de aici e o lipsă adevărată.',
      care: (r) => !r.autor,
      pricina: (r) => {
        if (adresaVie(r)) return 'de căutat în pagina sursei'
        if (areSursaR(r)) return `de căutat la „${r.sursa_nume || r.sursa_text}", dar fără adresă vie`
        return 'nici măcar sursa nu e scrisă'
      },
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
      /*
       * ⚠️ NU E UN DEFECT, E UN FEL DE SURSĂ (user, 16.09.2026: „tot ocazional este fără link, doar o
       * mențiune carte"). Stă aici fiindcă e singurul loc unde se pot vedea la un loc — un text care
       * arată cartea, dar nu are unde trimite. Textul întreg la ele nu se poate aduce de nicăieri.
       */
      cheie: 'doar-mentiune',
      nume: 'Cu sursa scrisă, dar fără legătură',
      spune: 'Buletinul a scris numai mențiunea — o carte, o editură —, fără nicio adresă. Nu e o '
        + 'greșeală: așa a fost publicat. Dar de acolo nu se poate aduce textul întreg.',
      care: (r) => felulSursei(r) === 'mentiune',
      pricina: (r) => `numai mențiunea: „${r.sursa_text || r.sursa_nume}"`,
    },
    {
      cheie: 'fara-sursa',
      nume: 'Fără sursă',
      spune: 'Nici mențiune scrisă, nici legătură — nu se știe de unde a fost luat. Sunt foarte rare.',
      care: (r) => !areSursaR(r),
      pricina: () => 'nimic în rândul „Sursă" al buletinului',
    },
    {
      cheie: 'fara-titlu',
      nume: 'Fără titlu',
      spune: 'Buletinul n-a scris niciun titlu, iar la sursă nu s-a găsit unul. Toate textele trebuie '
        + 'să aibă titlu, deci categoria asta trebuie să rămână goală.',
      care: (r) => !r.titlu,
      pricina: () => 'de scris de mână în `indreptari.json`',
    },
    {
      /*
       * ⚠️ AICI SE VEDE UN DEFECT DE CITIRE, nu o lipsă a buletinului (user, 16.09.2026: „toate au
       * text scurt — chiar dacă structural nu pare că e, vizual se vede mereu, 10-12 rânduri de text
       * după autor"). Dacă un rând ajunge aici, extragerea n-a găsit corpul articolului, deși el e în
       * pagină — așa s-a descoperit că textele puse ca CITAT în buletin nu erau citite deloc.
       */
      cheie: 'fisa-goala',
      nume: 'Fără bucata din buletin',
      spune: 'Din buletin n-au ieșit decât câteva semne, deci textul adus de la sursă n-a avut cu ce '
        + 'fi verificat. Toate textele au în buletin 10-12 rânduri după autor: dacă un rând stă aici, '
        + 'citirea buletinului a dat greș, nu buletinul.',
      care: (r) => r.n_fragment < 40,
      pricina: (r) => (r.n_text > 500
        ? `numai ${r.n_fragment} semne din buletin, dar textul adus (${r.n_text} semne) stă în bază`
        : `numai ${r.n_fragment} semne din buletin și niciun text adus`),
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
   * ⚠️ CATEGORIA CELOR BUNE stă LA URMĂ, dinadins: pagina asta e locul de lucru, iar prima categorie e
   * și cea deschisă la intrare — acolo trebuie să fie ce e de făcut, nu ce e gata. Ca linie de sosire
   * însă, numărul ei se citește din cuprins fără să intri în ea, și asta se voia.
   */
  const bune = {
    cheie: 'bune',
    nume: 'Bune — nimic de făcut',
    spune: 'Au tot ce trebuie: titlu, autor, textul întreg adus și trecut prin probă, mai lung decât ' +
      'bucata din buletin, și o sursă la care se poate ajunge. Ele sunt cele care se văd în lista ' +
      'întreagă și pe ușa Website-ului.',
    care: eBun,
    pricina: (r: Rezumat) => (eSinaxar(r.autor)
      ? `${r.n_text} semne · sursa: Sinaxar`
      : `${r.n_text} semne · ${r.sursa_nume || r.sursa_text || 'sursă scrisă'}, cu adresa vie`),
  }
  cuNumar.push(stimNumerele ? { ...bune, care: (r: Rezumat) => areNumar(r) && eBun(r) } : bune)

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
      + `<a href="${caleStare}?ce=${g.cheie}${an ? `&amp;an=${an}` : ''}">${esc(g.nume)}</a>`
      + ` <b>${rez.filter(g.care).length}</b></li>`)
    .join('')

  const baraAni = ani.length > 1
    ? baraSegmentelor('Anii citirii', [
      { nume: 'Toți anii', href: `${caleStare}?ce=${ales.cheie}`, activ: !an },
      ...ani.map((a) => ({ nume: String(a), href: `${caleStare}?ce=${ales.cheie}&an=${a}`, activ: a === an })),
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

  const peFel = (f: ReturnType<typeof felulSursei>) => rez.filter((r) => felulSursei(r) === f).length
  return `<div class="cap">
  <h1 class="titlu-lista">${esc(CAILE[fel].titlu)} — ce e de lămurit</h1>
  <p class="sursa">${rez.length} texte · <b>${rez.filter(eBun).length} chiar bune</b>. Sursa lor:
  ${peFel('pagina')} de pe un site · ${peFel('pdf')} din PDF · ${peFel('mentiune')} numai cu mențiunea
  scrisă · ${peFel('fara')} fără nicio sursă. Numărul de buletin vine de la Newsletter; apasă-l ca să
  deschizi numărul.</p>
  <ul class="ch-cuprins">${cuprins}</ul>
  <p class="ch-spre-stare"><a href="${cale}">← Lista celor bune</a></p>
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
<nav class="vecini"><a href="${caleaLui(t)}">${dinBuletin(t)
    ? '← Toate textele din buletinul parohiei'
    : '← Toate textele citite la chinonic'}</a></nav>`
}

export const STIL_CHINONIC = `
/* TEXTE CITITE LA CHINONIC (16.09.2026) — cele doua categorii de pe usa Website-ului si paginile lor. */
/* ⚠️ pe usa stau DOUA categorii, una langa alta pe ecran larg, una sub alta pe telefon (user,
   16.09.2026: „sub lista de aplicații să afișezi cele două categorii") */
.ch-usa { display:grid; gap:26px; margin:34px 0 0; padding:20px 0 0; border-top:1px solid var(--rule) }
@media (min-width:860px) { .ch-usa { grid-template-columns:1fr 1fr; gap:34px } }
.ch-categorie > h2 { margin:0 0 2px; font-size:21px; font-weight:400 }
.ch-spune { margin:0 0 12px; color:var(--faint); font-size:14px }
/* ⚠️ LISTELE SUNT COMPACTE PESTE TOT: titlu legat + autor. Fara text, ca sa se deschida repede
   (user, 16.09.2026: „doar titlul și autorul cu link") */
.ch-compacta { list-style:none; padding:0; margin:0 }
.ch-rand { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 10px;
           padding:7px 0; border-bottom:1px solid var(--rule) }
.ch-rand:last-child { border-bottom:0 }
.ch-t { color:var(--ink); text-decoration:none; font-size:15px; flex:1 1 260px }
.ch-t:hover { color:var(--rosu); text-decoration:underline }
.ch-a { color:var(--faint); font:13px/1.4 ui-sans-serif,system-ui; flex:0 1 auto }
/* „Fără autor" e o lipsa marturisita, nu un nume: se scrie mai stins si inclinat */
.ch-niciun-autor { font-style:italic; opacity:.65 }
.ch-cand { color:var(--faint); font:12.5px/1.4 ui-sans-serif,system-ui; white-space:nowrap }
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
/* pagina de probleme — locul de investigat */
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
.ch-text { color:var(--ink); margin:18px 0 0; line-height:1.7 }
.ch-text p { margin:0 0 12px }
/* ⚠️ FORMAREA MINIMA a textului adus (user, 16.09.2026: „text raw cu formatare minimă — bold,
   italic, liste"): atat se pastreaza din izvor, si atat se deseneaza aici. Regula e in
   infrastructure/import/chinonic/formatare.mjs — patru marcaje, nimic mai mult. */
.ch-text strong { font-weight:600 }
.ch-text em { font-style:italic }
.ch-text ul { margin:0 0 12px; padding-left:22px }
.ch-text li { margin:0 0 5px }
.ch-text blockquote { margin:0 0 12px; padding-left:14px; border-left:3px solid var(--rule);
                      color:var(--soft) }
.ch-text blockquote p:last-child { margin-bottom:0 }
/* ⚠️ subtitlul dinauntrul textului e PARAGRAF INGROSAT, nu titlu de secțiune (hotararea userului,
   16.09.2026: „paragraf bold") — deci nu-si ia rang in pagina, doar puțin aer deasupra */
.ch-text .ch-sub { margin:20px 0 10px }
/* fragmentul se vede ca fragment: o dunga la stanga spune ca textul nu e intreg */
.ch-fragment { padding-left:14px; border-left:3px solid var(--rule) }
.ch-partial { margin:12px 0 0; color:var(--faint); font-size:13.5px }
.ch-sursa { margin:12px 0 0; padding:10px 12px; background:var(--tinta);
            border:1px solid var(--rule); border-radius:10px;
            color:var(--soft); font-size:13px }
.ch-sursa > span { font-weight:600; color:var(--ink) }
.ch-drum { color:var(--rosu) }
`
