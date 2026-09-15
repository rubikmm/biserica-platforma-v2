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
 * ⚠️ UNDE MERGE: articolul trebuie să ajungă ÎNTREG la noi, fără trimitere în afară; din sursă rămâne
 * doar numele, pentru cinstirea autorului (user: „să nu facă trimitere în afară, doar ca să facem
 * referire la autor și sursă"). Până când textul întreg e adus pentru toate, legătura se arată
 * NUMAI unde textul lipsește — altfel omul ar rămâne cu un fragment și fără drum mai departe.
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
}

export const CALE = '/texte-citite-la-chinonic'
/** Câte se arată pe ușa Website-ului, înainte de „Vezi toate" (cerut anume: 10). */
export const CATE_PE_ACASA = 10

const CAMPURI = `slug, titlu, autor, citit_la, fragment, text_intreg, stare_text,
                 sursa_text, sursa_nume, sursa_url, sursa_fel, poza`

export async function celeDeAcasa(db: D1Database, cate = CATE_PE_ACASA): Promise<Text[]> {
  const r = await db.prepare(`SELECT ${CAMPURI} FROM texte_chinonic ORDER BY citit_la DESC, id DESC LIMIT ?`)
    .bind(cate).all<Text>()
  return r.results ?? []
}

export async function toate(db: D1Database): Promise<Text[]> {
  const r = await db.prepare(`SELECT ${CAMPURI} FROM texte_chinonic ORDER BY citit_la DESC, id DESC`).all<Text>()
  return r.results ?? []
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
 * SURSA, scrisă sub text. Are două părți care coexistă (user, 16.09.2026): mențiunea scrisă de om
 * — de multe ori o carte întreagă, cu editură și pagini — și numele site-ului de unde s-a luat.
 * ⚠️ Legătura se scrie DOAR cât timp textul întreg lipsește. Când îl avem, articolul e la noi și nu
 * mai trimite pe nimeni afară; rămâne numele, pentru cinstirea autorului.
 */
function sursa(t: Text): string {
  const parti: string[] = []
  if (t.sursa_text) parti.push(esc(t.sursa_text))
  if (t.sursa_nume && !t.sursa_text.toLowerCase().includes(t.sursa_nume.toLowerCase())) {
    parti.push(esc(t.sursa_nume))
  }
  if (!parti.length) return ''
  const areTot = t.stare_text === 'gata' && !!t.text_intreg
  const drum = !areTot && t.sursa_url && t.sursa_fel === 'pagina'
    ? ` <a class="ch-drum" href="${esc(t.sursa_url)}" target="_blank" rel="noopener nofollow">deschide sursa</a>`
    : ''
  return `<p class="ch-sursa"><span>Sursa:</span> ${parti.join(' · ')}${drum}</p>`
}

/** Un rând din listă: data mică la stânga, titlul după ea — ca listele newsletterului. */
const rand = (t: Text): string =>
  `<li><span class="cand">${esc(ziua(t.citit_la))}</span>` +
  `<a href="${CALE}/${esc(t.slug)}">${esc(t.titlu || '(fără titlu)')}</a>` +
  `${t.autor ? `<span class="ch-autor">${esc(t.autor)}</span>` : ''}</li>`

/** Bucata de pe ușa Website-ului: cele mai noi zece și „Vezi toate". */
export function bucataDeAcasa(texte: Text[], nTotal: number): string {
  if (!texte.length) return ''
  return `<section class="ch-acasa">
  <h2>Texte citite la chinonic</h2>
  <p class="ch-spune">Ce s-a citit la strană, în timpul împărtășirii.</p>
  <ul class="numere">${texte.map(rand).join('')}</ul>
  <p class="ch-toate"><a href="${CALE}">Vezi toate — ${nTotal} ${nTotal === 1 ? 'text' : 'texte'} →</a></p>
</section>`
}

/** Pagina cu toate, pe ani: de la cel mai nou spre cel mai vechi. */
export function paginaToate(texte: Text[]): string {
  const ani = [...new Set(texte.map((t) => +t.citit_la.slice(0, 4)))].sort((a, b) => b - a)
  const peAni = ani
    .map((an) => `<h2 class="anul">${an}</h2>
<ul class="numere">${texte.filter((t) => +t.citit_la.slice(0, 4) === an).map(rand).join('')}</ul>`)
    .join('')
  return `<div class="cap">
  <h1 class="titlu-lista">Texte citite la chinonic</h1>
  <p class="sursa">Ce s-a citit la strană, în timpul împărtășirii — ${texte.length} texte, din
  ${ani[ani.length - 1]} încoace.</p>
</div>
${peAni}`
}

/** Pagina unui text. */
export function paginaText(t: Text, urlNewsletter: string): string {
  const areTot = t.stare_text === 'gata' && !!t.text_intreg
  const corp = areTot
    ? `<div class="ch-text">${t.text_intreg}</div>`
    : `<div class="ch-text ch-fragment">${t.fragment}</div>`
  return `<div class="cap">
  <h1 class="titlu-lista">${esc(t.titlu || '(fără titlu)')}</h1>
  <p class="sursa">${t.autor ? `${esc(t.autor)} · ` : ''}citit la strană pe ${esc(ziua(t.citit_la))}</p>
</div>
${t.poza ? `<img class="ch-poza" src="${esc(poza(t, urlNewsletter))}" alt="">` : ''}
${corp}
${areTot ? '' : `<p class="ch-partial">Aici e doar bucata citită în buletin. Textul întreg încă n-a fost adus.</p>`}
${sursa(t)}
<nav class="vecini"><a href="${CALE}">← Toate textele citite la chinonic</a></nav>`
}

export const STIL_CHINONIC = `
/* TEXTE CITITE LA CHINONIC (16.09.2026) — lista de pe usa Website-ului si paginile lor. */
.ch-acasa { margin:34px 0 0; padding:20px 0 0; border-top:1px solid var(--rule) }
.ch-acasa > h2 { margin:0 0 2px; font-size:21px; font-weight:400 }
.ch-spune { margin:0 0 12px; color:var(--faint); font-size:14px }
.numere { list-style:none; padding:0; margin:0 }
.numere li { padding:9px 0; border-bottom:1px solid var(--rule) }
.numere li:last-child { border-bottom:0 }
.numere .cand { display:inline-block; min-width:128px; color:var(--faint);
                font:13px/1.5 ui-sans-serif,system-ui }
.numere a { color:var(--ink); text-decoration:none }
.numere a:hover { color:var(--rosu); text-decoration:underline }
/* autorul, dupa titlu: se citeste ca o lamurire, nu ca parte din titlu */
.ch-autor { display:block; margin:2px 0 0 128px; color:var(--faint); font-size:13px }
.ch-toate { margin:14px 0 0 }
.ch-toate a { color:var(--rosu); text-decoration:none; font:600 13.5px/1 ui-sans-serif,system-ui }
.ch-toate a:hover { text-decoration:underline }
.anul { margin:28px 0 2px; font-size:19px; color:var(--soft) }

/* pagina unui text */
.ch-poza { display:block; width:100%; height:auto; border-radius:12px; margin:18px 0 0 }
.ch-text { margin:18px 0 0; line-height:1.7 }
.ch-text p { margin:0 0 12px }
/* fragmentul se vede ca fragment: o dunga la stanga spune ca textul nu e intreg */
.ch-fragment { padding-left:14px; border-left:3px solid var(--rule) }
.ch-partial { margin:12px 0 0; color:var(--faint); font-size:13.5px }
.ch-sursa { margin:18px 0 0; padding:12px 14px; background:var(--tinta);
            border:1px solid var(--rule); border-radius:10px;
            color:var(--soft); font-size:13.5px }
.ch-sursa > span { font-weight:600; color:var(--ink) }
.ch-drum { color:var(--rosu) }
@media (max-width:560px) {
  .numere .cand { min-width:0; display:block; margin:0 0 2px }
  .ch-autor { margin-left:0 }
}
`
