/**
 * Paginile Bibliei. Afisarea, markup-ul si textele sunt cele din V1 (`biserica-biblia`, v0.8.4) —
 * „să respecți mesajele și grafica din V1" (user, 10.09.2026).
 *
 * Ce s-a schimbat fata de V1, si de ce:
 *  - pagina e DESCHISA (V1 cerea cont): „totul la liber, deocamdată" (user, 10.09.2026);
 *  - carcasa (antet, subsol, tema) vine din `@xc/ui`, nu din `src/comun/` copiat in aplicatie;
 *  - textele vazute de om s-au scris cu diacritice acolo unde V1 le pierduse („Căutare în text").
 */
import type { Navigatie } from "@xc/config"
import { ICOANE, esc, pagina } from "@xc/ui"
import type { Carte, Index, Parte } from "./depozit.js"
import type { Verset } from "./referinte.js"
import { LOCAL } from "./stil.js"

export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
  /** Administratorul BIBLIEI — cheia `bible.manage` (18.09.2026). Azi nu deschide nimic. */
  eAdmin: boolean
  /** Rolul global — DOAR randul „Administrare" din meniul contului atarna de el. */
  eAdminPlatforma?: boolean
  versiune: string
  modificata: string
  veziCa?: string | null
  poateVedeaCa?: boolean
  spre?: string
}

function contDin(ctx: Ctx) {
  return {
    intrat: !!ctx.utilizator,
    nume: ctx.utilizator ?? "Cont",
    // ⚠️ Panoul PLATFORMEI — rolul global, nu adminul Bibliei (18.09.2026).
    admin: ctx.eAdminPlatforma ?? false,
    urlCont: ctx.nav.cont,
    urlAdmin: ctx.nav.admin,
    // Setarile APLICATIEI, nu ale platformei (user, 15.09.2026) — de aceea adresa e a noastra.
    urlSetari: `${ctx.prefix}/setari`,
    poateVedeaCa: ctx.poateVedeaCa ?? false,
    veziCa: ctx.veziCa ?? null,
    spre: ctx.spre ?? "",
  }
}

/** Uneltele din antet: filele NT / VT si lupa de cautare — ca in V1 (user, 8 sept. 2026). */
function unelte(ctx: Ctx, deschis: boolean): string {
  const p = esc(ctx.prefix)
  return `
      <a class="btn" data-fila="nt" href="${p}/#nt">NT</a>
      <a class="btn" data-fila="vt" href="${p}/#vt">VT</a>
      <button class="btn${deschis ? " activ" : ""}" id="btn-cauta" type="button"
        aria-expanded="${deschis}" aria-controls="panou-cauta"
        aria-label="Căutare" title="Căutare">${ICOANE.lupa}</button>
    `
}

/** Panoul de cautare, sub unelte, tot in antet. */
function panouCautare(ctx: Ctx, q: string, deschis: boolean): string {
  return `<div id="panou-cauta"${deschis ? "" : " hidden"}>
      <form action="${esc(ctx.prefix)}/cauta" method="get">
        <input type="search" name="q" value="${esc(q)}" placeholder="cuvânt, sau referință (Ioan 3, 16)">
        <button type="submit">Caută</button>
      </form>
    </div>`
}

/** Scriptul lupei: deschide si inchide panoul de cautare. */
const JS_LUPA = `
var bc=document.getElementById("btn-cauta"), pc=document.getElementById("panou-cauta");
if(bc&&pc) bc.addEventListener("click",function(){
  var d=pc.hidden; pc.hidden=!d; bc.setAttribute("aria-expanded",String(d));
  if(d) pc.querySelector("input").focus();
});
`

function sablon(ctx: Ctx, titlu: string, corp: string, q = "", scripturi = ""): string {
  const deschis = q !== ""
  return pagina({
    nume: "BIBLIA",
    titlu: "Biblia",
    titluPagina: titlu,
    acasa: `${ctx.prefix}/`,
    urlPlatforma: ctx.nav.home || "/",
    local: LOCAL,
    cont: contDin(ctx),
    versiune: ctx.versiune,
    modificata: ctx.modificata,
    indexabil: true,
    unelte: unelte(ctx, deschis),
    subantet: panouCautare(ctx, q, deschis),
    corp,
    scripturi: `${JS_LUPA}${scripturi}`,
  })
}

export function paginaMesaj(ctx: Ctx, titlu: string, corp: string, q = ""): string {
  return sablon(ctx, titlu, corp, q)
}

/**
 * Carcasa goala a Bibliei — antet, subsol, stil — cu un corp dat de altcineva. O cere `@xc/setari`
 * (15.09.2026). Randul de unelte ramane, ca antetul sa fie acelasi peste tot.
 */
export function paginaCarcasa(ctx: Ctx, o: { titluPagina: string; corp: string; scripturi?: string }): string {
  return sablon(ctx, o.titluPagina, o.corp, "", o.scripturi ?? "")
}

const NUME_PARTE: Record<Parte, string> = {
  vt: "Vechiul Testament",
  ac: "Cărțile anaginoscomena (bune de citit)",
  nt: "Noul Testament",
}

function meniu(ctx: Ctx, ix: Index, parte: Parte): string {
  const lista = ix.carti.filter((c) => c.parte === parte)
  return `<ul>${lista
    .map((c) => `<li><a href="${esc(ctx.prefix)}/carte/${c.slug}">${esc(c.nume)}</a> <small>(${c.capitole} cap.)</small></li>`)
    .join("")}</ul>`
}

/** Sub titlul anaginoscomenelor, un rand care spune ce sunt — altfel deruteaza. */
const NOTA_AC = `<p><small>Tipărite în Biblia sinodală după Vechiul Testament: nu fac parte din canon,
dar Biserica le ține de folos la citit. „Ecclesiasticul" (Isus Sirah, 51 cap.) e altă carte decât
„Ecclesiastul" din Vechiul Testament (12 cap.) — numele doar se aseamănă.</small></p>`

/**
 * Coada Vechiului Testament: anaginoscomenele, cu randul care spune ce sunt. Ancora `#ac` ramane
 * valabila — linkurile vechi cad tot pe locul lor (V1, 7 sept. 2026).
 */
function anaginoscomena(ctx: Ctx, ix: Index): string {
  const n = ix.carti.filter((c) => c.parte === "ac").length
  if (n === 0) return ""
  return `<h3 id="ac">${NUME_PARTE.ac} <small>(${n} cărți)</small></h3>
      ${NOTA_AC}${meniu(ctx, ix, "ac")}`
}

/**
 * Acasa: butoanele din antet sunt file, se vede o singura sectiune, cu NT apasat la pornire
 * (user, 31 aug. 2026). Fara JS se vad toate — nu se pierde nimic. Anaginoscomenele n-au fila
 * lor: stau la coada Vechiului Testament, acolo unde le tipareste si Biblia sinodala.
 */
export function acasa(ctx: Ctx, ix: Index): string {
  const parti: Parte[] = ["nt", "vt"]
  const sectiuni = parti
    .map((p) => {
      const n = ix.carti.filter((c) => c.parte === p).length
      if (n === 0) return ""
      return `<section id="${p}" data-fila="${p}">
      <h2>${NUME_PARTE[p]} <small>(${n} cărți)</small></h2>
      ${meniu(ctx, ix, p)}${p === "vt" ? anaginoscomena(ctx, ix) : ""}
    </section>`
    })
    .join("")
  const file = `
(function(){
  var btnuri=document.querySelectorAll("a.btn[data-fila]");
  var sectiuni=document.querySelectorAll("section[data-fila]");
  function arata(f){
    sectiuni.forEach(function(s){s.hidden=(s.dataset.fila!==f)});
    btnuri.forEach(function(b){b.classList.toggle("activ",b.dataset.fila===f)});
  }
  btnuri.forEach(function(b){
    b.addEventListener("click",function(e){
      e.preventDefault();
      history.replaceState(null,"","#"+b.dataset.fila);
      arata(b.dataset.fila);
      scrollTo({top:0});
    });
  });
  var h=location.hash.slice(1);
  arata(h==="vt"||h==="ac" ? "vt" : "nt");
})();`
  return sablon(ctx, "Biblia", sectiuni, "", file)
}

/** Versetele unui capitol, cu numarul in fata si ancora `#v<numar>`. */
function versete(cap: Record<string, string>): string {
  return Object.entries(cap)
    .map(([n, t]) => `<p class="vers" id="v${n}"><b>${n}</b>${esc(t)}</p>`)
    .join("")
}

export function paginaCarte(ctx: Ctx, c: Carte, slug: string, capitol: number): string {
  const cap = c.capitole[capitol - 1]
  if (!cap) return sablon(ctx, c.nume, `<p>Capitolul ${capitol} nu există.</p>`)

  // patratele de atins cu degetul, nu sir de cifre — pe telefon erau prea inghesuite
  const sarituri = Array.from({ length: c.capitole.length }, (_, i) => i + 1)
    .map((n) => (n === capitol ? `<b class="acum">${n}</b>` : `<a href="${esc(ctx.prefix)}/carte/${slug}/${n}">${n}</a>`))
    .join("")

  return sablon(
    ctx,
    `${c.nume} ${capitol}`,
    `<h2>${esc(c.nume)}, capitolul ${capitol}</h2>
  <nav class="capitole">${sarituri}</nav>
  <article>${versete(cap)}</article>`,
  )
}

/** Un rezultat al cautarii in text, asa cum il scrie pagina. */
export interface Gasit {
  slug: string
  nume: string
  capitol: number
  verset: number
  text: string
}

/**
 * Pagina cautarii. Daca ce s-a scris e o referinta, raspunsul exact bate cautarea in text si se
 * scrie deasupra ei (V1). Cautarea se opreste la 100 de rezultate.
 */
export function paginaCautare(
  ctx: Ctx,
  q: string,
  exact: { nume: string; slug: string; capitol: number; coada: string; versete: Verset[]; maiMulte: boolean } | null,
  gasite: Gasit[],
  citite: number,
): string {
  if (!q.trim()) return sablon(ctx, "Caută", `<p>Scrie un cuvânt sau o referință.</p>`, q)

  let sus = ""
  if (exact && exact.versete.length > 0) {
    let capCurent = 0
    const v = exact.versete
      .map((x) => {
        const titluCap = x.capitol !== capCurent && exact.maiMulte ? `<p><small>capitolul ${x.capitol}</small></p>` : ""
        capCurent = x.capitol
        return `${titluCap}<p class="vers"><b>${x.numar}</b>${esc(x.text)}</p>`
      })
      .join("")
    sus = `<h2>${esc(exact.nume)} ${esc(exact.coada)}</h2>
      ${v}<p><a href="${esc(ctx.prefix)}/carte/${exact.slug}/${exact.capitol}">Capitolul întreg</a></p><hr>`
  }

  const randuri = gasite
    .map(
      (g) =>
        `<li><a href="${esc(ctx.prefix)}/carte/${g.slug}/${g.capitol}#v${g.verset}"><b>${esc(g.nume)} ${g.capitol}, ${g.verset}</b></a> — ${esc(g.text.slice(0, 220))}${g.text.length > 220 ? "…" : ""}</li>`,
    )
    .join("")

  return sablon(
    ctx,
    `Căutare: ${q}`,
    `${sus}
  <h2>Căutare în text: „${esc(q)}"</h2>
  <p><small>${gasite.length}${gasite.length >= 100 ? "+ (primele 100)" : ""} rezultate, din ${citite} cărți citite.</small></p>
  <ol>${randuri}</ol>
  ${gasite.length === 0 ? "<p>Niciun rezultat.</p>" : ""}`,
    q,
  )
}
