/**
 * Paginile Bibliotecii — afisarea, markup-ul si textele din V1 (`biserica-biblioteca`), mutate
 * pe carcasa comuna `@xc/ui`.
 *
 * Ce s-a schimbat fata de V1, si de ce:
 *  - **catalogul e deschis**: paginile de citit nu mai cer cont („totul la liber, deocamdata").
 *    In V1 poarta cadea dupa `/v1`, deci fisa unei carti cerea intrare; acum cere doar ce e AL
 *    OMULUI (`/eu`) si ecranul pangarului;
 *  - carcasa (antet, subsol, tema, meniul contului, „vezi ca") vine din `@xc/ui`, nu din
 *    `src/comun/` copiat in aplicatie;
 *  - `persoana_id` s-a facut `user_id`, iar rolul de pangar e o permisiune a platformei
 *    (`library.manage`), nu `rol === "admin"` citit local;
 *  - **modul de proba a iesit** cu totul: in V2 local = staging, nu mai exista persoane false.
 *
 * Restul — clasele, ordinea rubricilor, cuvintele — sunt cele din V1. „E multa munca acolo pe
 * care nu vreau s-o refac acum" (user, 10.09.2026).
 */
import { type Navigatie, adresaPaginii } from "@xc/config"
import { ICOANE, type OptiuniPagina, dataCuZi, esc, pagina as carcasa } from "@xc/ui"
import { type Carte, type Catalog, type Grup, autoriiCartii, numeleEditurii, slugEditura, titlulDin } from "./depozit.js"
import { semn } from "./imbogatire.js"
import { type Cerere, type CerereAcces, MAXIM_DEODATA, ZILE_ASTEPTARE, eIntarziata, zileRamase } from "./imprumut.js"
import { FARA_AUTOR, dupaNume, litera, numeDeAsezare } from "./nume.js"
import { LOCAL } from "./stil.js"

/** Ce stie pagina despre cine se uita la ea si unde e montata aplicatia. */
export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
  userId: string | null
  /** Are dreptul de imprumut (`library.borrow`) — hotarat de autorizarea centrala. */
  poateImprumuta: boolean
  /** Tine ecranul pangarului (`library.manage`). */
  ePangar: boolean
  eAdmin: boolean
  /** Jetonul CSRF pereche cu cookie-ul, scris in fiecare formular al paginii. */
  csrf: string
  versiune: string
  modificata: string
  /** „Vezi ca" — vin din sesiune, gata calculate de identitate; doar pentru meniul contului. */
  veziCa?: string | null
  poateVedeaCa?: boolean
  spre?: string
}

/**
 * Doua iconite ale bibliotecii, tinute aici si nu in carcasa: pangarul si raftul tau de carti
 * sunt ale acestei aplicatii, nu ale platformei.
 *
 * Desenate ca cele din `ICOANE`: 24x24, numai contur, aceeasi grosime, ca sa stea in acelasi rand
 * cu lupa fara sa se vada ca vin din alta mana.
 */
export const ICOANE_BIBLIOTECA = {
  // lupa cu plus, in coltul copertei de pe fisa (cerere user, 8 sept. 2026, noaptea)
  mareste: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.6-4.6"/><path d="M11 8v6M8 11h6"/></svg>`,
  pangar: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10 4.5 4h15L21 10Z"/><path d="M4.5 10v10h15V10"/><path d="M9.5 20v-5.5h5V20"/></svg>`,
  carti: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="M9.5 2v7l2.5-2 2.5 2V2"/></svg>`,
}

/** Raspunsurile scurte de dupa o apasare de buton, aratate ca banda peste pagina. */
const MESAJE: Record<string, { text: string; bun: boolean }> = {
  ceruta: { text: "Am notat cererea. Pangarul caută cartea și primești un mesaj când e pregătită.", bun: true },
  anulata: { text: "Am notat că renunți. Cartea e din nou liberă.", bun: true },
  deja_ceruta: { text: "Ai deja cartea aceasta cerută sau împrumutată.", bun: false },
  prea_multe: { text: `Poți avea cel mult ${MAXIM_DEODATA} cărți deodată. Adu una înapoi și cere din nou.`, bun: false },
  fara_exemplar: { text: "Toate exemplarele sunt luate acum. Întreabă la pangar când se întoarce unul.", bun: false },
  fara_drept: { text: "Contul tău nu are încă dreptul de împrumut. Se activează la pangar, o singură dată.", bun: false },
  nu_e_a_ta: { text: "Cererea nu e a ta.", bun: false },
  prea_tarziu: { text: "Cartea e deja la tine — se aduce înapoi la pangar.", bun: false },
  alta_stare: { text: "Între timp s-a schimbat ceva. Am reîncărcat pagina.", bun: false },
  fara_cerere: { text: "Cererea nu există.", bun: false },
  acces_cerut: { text: "Am notat. Pangarul îți activează dreptul în cont; îl vezi aici după ce intri din nou.", bun: true },
  acces_deja: { text: "Cererea ta de acces e deja la pangar.", bun: false },
  acces_ai: { text: "Ai deja dreptul de împrumut.", bun: true },
}

/**
 * Gazda unei adrese, pentru textul unui link — ca in V1, unde scria chiar `cont.sfantul-ilie.ro`.
 * In dev adresa contului e o cale (`/cont`), si atunci se scrie ea.
 */
function gazda(adresa: string): string {
  try {
    return new URL(adresa).host
  } catch {
    return adresa
  }
}

/** Jetonul CSRF, scris in fiecare formular: perechea cookie-ului, verificata la fiecare POST. */
const jetonul = (ctx: Ctx) => `<input type="hidden" name="csrf" value="${esc(ctx.csrf)}">`

/** Banda de raspuns de dupa o apasare de buton. Codul vine din `?r=` din adresa. */
function banda(cod: string | null): string {
  const m = cod ? MESAJE[cod] : null
  if (!m) return ""
  return `<p class="raspuns ${m.bun ? "bun" : "rau"}">${esc(m.text)}</p>`
}

// --- Cadrul paginii ----------------------------------------------------------

/**
 * Butoanele din antet: Autori, Edituri, lupa, si — pentru cine e intrat — pangarul si raftul lui.
 * Cele personale stau DUPA lupa (cerere user, 8 sept. 2026), cu iconita si cu numele in tooltip,
 * ca lupa: pe telefon cinci butoane cu text n-ar incapea pe un rand, iar numele intreg ramane la
 * indemana in `aria-label` si in `title`.
 *
 * ⚠️ Butoanele fara drept se STING, nu se ascund (regula platformei, 11–12.09.2026): pangarul
 * scris palit spune ce e acolo si de ce nu se poate apasa, iar randul are aceeasi forma la toti.
 */
function unelteAntet(ctx: Ctx, q: string | null): string {
  const p = ctx.prefix
  const buton = (adresa: string, nume: string, icoana: string) =>
    `<a class="btn icon" href="${p}${adresa}" aria-label="${nume}" title="${nume}">${icoana}</a>`
  const stins = (nume: string, pricina: string, icoana: string) =>
    `<span class="btn icon gol" aria-label="${nume}" title="${pricina}" aria-disabled="true">${icoana}</span>`
  return `
      <a class="btn" href="${p}/autori">Autori</a>
      <a class="btn" href="${p}/edituri">Edituri</a>
      <a class="btn icon" href="${p}/cauta" id="cauta-buton" aria-expanded="${q === null ? "false" : "true"}"
         aria-label="Căutare" title="Căutare">${ICOANE.lupa}</a>
      ${ctx.ePangar
        ? buton("/pangar", "Pangar", ICOANE_BIBLIOTECA.pangar)
        : stins("Pangar", "Ecranul pangarului — îți trebuie dreptul de bibliotecar", ICOANE_BIBLIOTECA.pangar)}
      ${ctx.userId
        ? buton("/eu", "Cărțile mele", ICOANE_BIBLIOTECA.carti)
        : stins("Cărțile mele", "Intră în cont ca să-ți vezi cărțile", ICOANE_BIBLIOTECA.carti)}
    `
}

/** Contul, in dreapta titlului: numele tau daca esti intrat, altfel „Cont". */
function contul(ctx: Ctx): OptiuniPagina["cont"] {
  return {
    intrat: !!ctx.utilizator,
    nume: ctx.utilizator ?? undefined,
    admin: ctx.eAdmin,
    href: ctx.nav.cont,
    urlCont: ctx.nav.cont,
    urlAdmin: ctx.nav.admin,
    poateVedeaCa: ctx.poateVedeaCa,
    veziCa: ctx.veziCa,
    spre: ctx.spre,
  }
}

/**
 * `q` null = cautarea sta inchisa; sir (chiar gol) = formularul e deschis — asa pagina `/cauta`
 * merge si fara JavaScript, butonul din antet fiind un link obisnuit spre ea.
 */
export function pagina(ctx: Ctx, titlu: string, corp: string, q: string | null = null): string {
  return carcasa({
    nume: "BIBLIOTECA",
    titlu: "Biblioteca",
    titluPagina: titlu,
    acasa: ctx.prefix || "/",
    urlPlatforma: ctx.nav.home,
    local: LOCAL,
    versiune: ctx.versiune,
    modificata: ctx.modificata,
    cont: contul(ctx),
    unelte: unelteAntet(ctx, q),
    subantet: `<form action="${ctx.prefix}/cauta" method="get" id="cautare"${q === null ? " hidden" : ""}>
      <input type="search" name="q" value="${esc(q ?? "")}" placeholder="titlu, autor sau editură">
      <button type="submit">Caută</button>
    </form>`,
    corp,
    scripturi: SCRIPTURI,
  })
}

/**
 * Cele trei bucati de JavaScript ale paginii, aduse din V1 neatinse: deschiderea cautarii, lupa
 * copertei si „Incarca mai multe".
 */
const SCRIPTURI = `
var fc=document.getElementById("cautare"),bc=document.getElementById("cauta-buton");
if(fc&&bc)bc.addEventListener("click",function(e){e.preventDefault();var era=fc.hidden;fc.hidden=!era;
bc.setAttribute("aria-expanded",era?"true":"false");if(era)fc.querySelector("input").focus()});
/* Lupa copertei (user, 8 sept. 2026). Aplicatia are pinch-zoom oprit — „aplicatie, nu
   site" — deci marirea si-o face coperta singura: trei trepte la fiecare atingere (cat
   incape pe ecran, marimea ei intreaga, de doua ori atat), iar cadrul se plimba cu
   degetul. Fara JS, linkul ramane bun: duce la poza mare, ca orice link. */
var lm=document.querySelector("a.mareste");
if(lm)lm.addEventListener("click",function(e){
  e.preventDefault();
  var ov=document.createElement("div");
  ov.className="coperta-mare";
  ov.innerHTML='<div class="cadru"><img alt=""></div>'+
    '<button type="button" class="inchide" aria-label="Închide">×</button>'+
    '<p class="ajutor">Atinge coperta ca s-o mărești</p>';
  var im=ov.querySelector("img"),pas=0;
  im.src=lm.getAttribute("href");
  im.addEventListener("click",function(ev){
    ev.stopPropagation();
    if(!im.naturalWidth)return;            // inca nu s-a incarcat: n-avem dupa ce masura
    pas=(pas+1)%3;
    if(pas===0){im.removeAttribute("style");ov.classList.remove("marit")}
    else{ov.classList.add("marit");im.style.width=(im.naturalWidth*pas)+"px"}
  });
  /* ⚠️ Coperta marita e o fereastra peste pagina, deci pagina din spate nu se deruleaza cat sta ea
     deschisa (regula generala a ferestrelor, user 13.09.2026). Oprirea se cere carcasei — nu se mai
     scrie overflow-ul pe corp: radacina are overflow-y:scroll, si de pe corp nu se propaga. */
  var inchisa=false;
  function inchide(){if(inchisa)return;inchisa=true;
    ov.remove();document.removeEventListener("keydown",tasta);
    if(window.xcFereastra)window.xcFereastra.dezblocheaza()}
  function tasta(ev){if(ev.key==="Escape")inchide()}
  ov.addEventListener("click",inchide);
  document.addEventListener("keydown",tasta);
  document.body.appendChild(ov);
  if(window.xcFereastra)window.xcFereastra.blocheaza();
});
/* „Incarca mai multe" (user, 8 sept. 2026). Randurile de dupa al zecelea sunt deja in
   pagina, ascunse; aici doar se descopera, cate a ales omul. Lotul apasat ramane ales,
   iar cand nu mai are ce descoperi, cutia se ridica. */
var mm=document.querySelectorAll(".mai-multe");
for(var mi=0;mi<mm.length;mi++)(function(cutia){
  var ul=cutia.previousElementSibling,ramase=cutia.querySelector(".ramase"),pas=10;
  function descopera(n){
    var ascunse=ul.querySelectorAll("li.peste");
    var cate=n?Math.min(n,ascunse.length):ascunse.length;
    for(var j=0;j<cate;j++)ascunse[j].classList.remove("peste");
    if(ascunse.length-cate>0){ramase.textContent=String(ascunse.length-cate);return}
    var intai=ascunse[0]&&ascunse[0].querySelector(".ce a");
    cutia.remove();
    if(intai)intai.focus();               // cutia s-a dus: degetul ramane in lista
  }
  cutia.querySelector(".inca").addEventListener("click",function(){descopera(pas)});
  var lot=cutia.querySelectorAll(".cate button");
  for(var k=0;k<lot.length;k++)lot[k].addEventListener("click",function(){
    for(var z=0;z<lot.length;z++){
      lot[z].classList.toggle("acum",lot[z]===this);
      lot[z].setAttribute("aria-pressed",lot[z]===this?"true":"false");
    }
    pas=Number(this.value);
    descopera(pas);
  });
})(mm[mi]);
`

// --- Listele de carti --------------------------------------------------------

/**
 * Coperta mica de la inceputul fiecarui rand, in TOATE listele de carti (cerere user, 7 sept.
 * 2026): lista (cautare, autor, editura), vecinatatile de pe fisa, cartile mele, ecranul
 * pangarului. Cartea fara coperta primeste acelasi chenar ca pe fisa, micsorat — asa toate
 * randurile au aceeasi forma, iar copertile lipsa nu se citesc drept greseli. 52 px latime,
 * 80 px inaltime.
 *
 * Fara alt si fara tab: titlul de langa ea e linkul adevarat; coperta e acelasi link, inca o
 * data, pentru deget. Poza e cea de 160 px (`coperti-mici/`), nu cea de fisa.
 */
export function copertaMica(ctx: Ctx, c: Catalog, slug: string, titlu: string): string {
  return c.imb.carti[slug]?.coperta
    ? `<a class="cm" href="${ctx.prefix}/carte/${slug}" tabindex="-1"><img src="${ctx.prefix}/coperta/mica/${slug}.jpg"
        alt="" width="52" height="80" loading="lazy" title="${esc(titlu)}"></a>`
    : `<a class="cm fara" href="${ctx.prefix}/carte/${slug}" tabindex="-1" title="fără copertă"></a>`
}

/** Cate randuri se vad la deschiderea unei liste si loturile din care omul alege cat mai vine
 *  dupa aceea (cerere user, 8 sept. 2026). 0 = „Toate". Implicit 10. */
const PRIMELE = 10
const LOTURI = [10, 20, 50, 100, 0]

/**
 * Lista de carti — un rand pe carte, acelasi peste tot: cautare, autor, editura si vecinatatile
 * de pe fisa. Trei coloane (cerere user, 7 sept. 2026, dupa-amiaza): coperta, titlul cu autorul
 * dedesubt, si pe 30% din latime editura cu anul si exemplarele. Nu e tabel cu cinci coloane:
 * acela se stringea pe telefon pana nu se mai citea nimic.
 *
 * Mai lunga de 10 randuri, lista se deschide cu primele 10 si o cutie „Încarcă mai multe".
 * Restul randurilor sunt TRIMISE, dar ascunse (`li.peste`): descoperirea lor e o apasare, nu
 * inca o cerere la server. Fara JavaScript se vad toate randurile si cutia nu exista.
 */
export function listaCarti(ctx: Ctx, c: Catalog, carti: Carte[]): string {
  if (carti.length === 0) return "<p>Niciun rezultat.</p>"
  const p = ctx.prefix
  const mai = carti.length - PRIMELE
  return `<ul class="carti">${carti
    .map((x, i) => {
      const autori =
        autoriiCartii(c, x)
          .map((a) => `<a href="${p}/autor/${a.slug}">${esc(a.nume)}</a>`)
          .join(" · ") || `<a class="niciunul" href="${p}/autor/${FARA_AUTOR.slug}">${FARA_AUTOR.nume}</a>`
      const rest = [x.an ? esc(x.an) : null, `${x.bucati} ${x.bucati === 1 ? "exemplar" : "exemplare"}`]
        .filter(Boolean)
        .join(" · ")
      return `<li${mai > 0 && i >= PRIMELE ? ` class="peste"` : ""}>${copertaMica(ctx, c, x.slug, x.titlu)}
    <div class="ce"><a href="${p}/carte/${x.slug}">${esc(x.titlu)}</a>${semn(c.imb.carti[x.slug])}
      <div class="sub">${autori}</div></div>
    <div class="rest">${
      x.editura ? `<a href="${p}/editura/${slugEditura(x.editura)}">${esc(numeleEditurii(c, x.editura))}</a>` : "—"
    }
      <div class="sub">${rest}</div></div></li>`
    })
    .join("")}</ul>${mai > 0 ? maiMulte(mai) : ""}`
}

/** Cutia de sub o lista lunga: „Încarcă mai multe" si loturile din care se alege cat. Apasarea
 *  unui lot il si alege pentru data viitoare. */
function maiMulte(mai: number): string {
  return `<div class="mai-multe">
    <button type="button" class="inca">Încarcă mai multe
      <small>(încă <span class="ramase">${mai}</span>)</small></button>
    <div class="cate" role="group" aria-label="Câte titluri se încarcă">${LOTURI.map(
      (n) =>
        `<button type="button" value="${n}" aria-pressed="${n === PRIMELE}"${n === PRIMELE ? ` class="acum"` : ""}>${
          n || "Toate"
        }</button>`,
    ).join("")}</div>
  </div>
  <noscript><style>ul.carti li.peste{display:grid}.mai-multe{display:none}</style></noscript>`
}

function lista(ctx: Ctx, g: Grup[], fel: "autor" | "editura"): string {
  return `<ul>${g
    .map((x) => `<li><a href="${ctx.prefix}/${fel}/${x.slug}">${esc(x.nume)}</a> <small>(${x.carti})</small></li>`)
    .join("")}</ul>`
}

/**
 * Paginile `/autori` si `/edituri`: **o singura litera pe ecran**, nu toate una sub alta. Bara de
 * sus (patratelele `.capitole`, ca la capitolele Bibliei) schimba litera, nu coboara la ea — 508
 * autori intr-un teanc nu se citesc, iar linkul care sare in jos lasa omul in mijlocul listei
 * fara sa stie unde e.
 *
 * Litera aleasa vine din adresa („?l=B"), nu dintr-o stare din pagina: asa se poate da linkul mai
 * departe si merge si butonul „inapoi" al browserului. Fara ea se deschide la A. Litera si
 * ordinea vin din numele FARA titlul din fata (vezi `nume.ts`): „Cleopa Ilie, Arhim." sta la C.
 */
export function listaPeLitere(ctx: Ctx, g: Grup[], fel: "autor" | "editura", ceruta: string | null): string {
  const grupe = new Map<string, Grup[]>()
  for (const x of [...g].sort((a, b) => dupaNume(fel)(a.nume, b.nume))) {
    const l = x.litera ?? litera(x.nume, fel)
    if (!grupe.has(l)) grupe.set(l, [])
    grupe.get(l)!.push(x)
  }
  const litere = [...grupe.keys()].sort()
  // „#" (ce nu incepe cu o litera) n-are ce cauta intr-o adresa: in link se scrie „alte".
  const cheia = (l: string) => (l === "#" ? "alte" : l)
  const aleasa =
    litere.find((l) => cheia(l) === (ceruta ?? "").toUpperCase()) ??
    litere.find((l) => cheia(l).toLowerCase() === (ceruta ?? "").toLowerCase()) ??
    (litere.includes("A") ? "A" : litere[0])
  const aici = grupe.get(aleasa!) ?? []
  return `<nav class="capitole">${litere
    .map((l) => (l === aleasa ? `<b class="acum">${l}</b>` : `<a href="?l=${cheia(l)}">${l}</a>`))
    .join("")}</nav>
<h3>${aleasa} <small>(${aici.length})</small></h3>${lista(ctx, aici, fel)}`
}

// --- Partea personala: ecrane ------------------------------------------------

/** Cum se spune, pe scurt, unde a ajuns o carte. */
export function starea(x: Cerere): { text: string; fel: "buna" | "atentie" | "problema" | "neutra" } {
  const zile = zileRamase(x)
  switch (x.stare) {
    case "ceruta":
      return { text: "cerută; pangarul o caută pe raft", fel: "neutra" }
    case "pregatita":
      return {
        text: `te așteaptă la pangar până ${dataCuZi(x.asteapta_pana!)}`,
        fel: zile !== null && zile <= 2 ? "atentie" : "buna",
      }
    case "imprumutata":
      if (eIntarziata(x)) return { text: `trebuia adusă până ${dataCuZi(x.scadenta!)}`, fel: "problema" }
      return {
        text: `de returnat până ${dataCuZi(x.scadenta!)}`,
        fel: zile !== null && zile <= 5 ? "atentie" : "buna",
      }
    case "returnata":
      return { text: "adusă înapoi", fel: "neutra" }
    case "expirata":
      return { text: "rezervarea s-a stins", fel: "neutra" }
    case "respinsa":
      return { text: "nu s-a putut", fel: "neutra" }
    case "anulata":
      return { text: "ai renunțat", fel: "neutra" }
  }
}

export function paginaEu(
  ctx: Ctx,
  c: Catalog,
  mele: Cerere[],
  vechi: Cerere[],
  acces: CerereAcces | null,
  raspuns: string | null,
): string {
  const p = ctx.prefix
  const rand = (x: Cerere) => {
    const s = starea(x)
    const titlu = titlulDin(c, x.carte_slug)
    const poateRenunta = x.stare === "ceruta" || x.stare === "pregatita"
    return `<li class="cer ${s.fel}">${copertaMica(ctx, c, x.carte_slug, titlu)}<div class="ce">
      <a href="${p}/carte/${x.carte_slug}">${esc(titlu)}</a>
      <span class="stare">${esc(s.text)}</span>
      ${
        poateRenunta
          ? `<form method="post" action="${p}/eu/renunta">
        ${jetonul(ctx)}<input type="hidden" name="id" value="${x.id}">
        <button type="submit">Renunț</button></form>`
          : ""
      }
    </div></li>`
  }

  // Cine n-are dreptul de imprumut il poate cere de aici (user, 8 sept. 2026): butonul sta pe
  // acelasi rand cu bara rosie, ca pe fisa cartii. Dreptul nu se da din biblioteca — cererea
  // ajunge la pangar, care o activeaza in cont.
  const fara = ctx.poateImprumuta
    ? ""
    : `<div class="cutie"><div class="imprumut">
    ${
      acces
        ? ""
        : `<form method="post" action="${p}/eu/acces" class="cere">
      ${jetonul(ctx)}<button type="submit">Solicită acces</button>
    </form>`
    }
    <p class="pangar">Contul tău nu are încă <b>dreptul de împrumut</b>. Se activează la pangar,
    o singură dată, și rămâne. Catalogul îl poți citi și fără el.${
      acces
        ? ` <b>Cererea ta e la pangar</b> din ${esc(dataCuZi(acces.ceruta_la.slice(0, 10)))}; dreptul îl vezi
        aici după ce intri din nou în cont.`
        : ""
    }</p>
  </div></div>`

  return pagina(
    ctx,
    "Cărțile mele",
    `
  <h2>Cărțile mele</h2>
  ${banda(raspuns)}
  ${fara}
  ${
    mele.length
      ? `<ul class="cereri">${mele.map(rand).join("")}</ul>`
      : `<p>Nu ai nicio carte cerută sau împrumutată. Caută una în catalog și apasă
       <b>Împrumută cartea</b> pe fișa ei.</p>`
  }

  <p><small>Informații utile: Pangarul caută cartea pe raft și îți scrie când e pregătită. De atunci
  te așteaptă ${ZILE_ASTEPTARE} zile la pangar, iar împrumutul ține o lună de la ridicare.
  Poți avea cel mult ${MAXIM_DEODATA} cărți deodată.</small></p>

  ${
    vechi.length
      ? `<details><summary>Ce a fost înainte (${vechi.length})</summary>
    <ul class="cereri">${vechi
      .map((x) => {
        const s = starea(x)
        const titlu = titlulDin(c, x.carte_slug)
        return `<li class="cer neutra">${copertaMica(ctx, c, x.carte_slug, titlu)}<div class="ce">
        <a href="${p}/carte/${x.carte_slug}">${esc(titlu)}</a>
        <span class="stare">${esc(s.text)}</span></div></li>`
      })
      .join("")}</ul></details>`
      : ""
  }`,
  )
}

export const NUMAI_PANGAR = `<h2>Numai pentru pangar</h2>
  <p>Ecranul acesta e pentru cine ține <b>pangarul</b>. Dacă ar trebui să-l ai,
  se cere la parohie.</p><p><a href="/">Înapoi la catalog</a></p>`

export function paginaPangar(ctx: Ctx, c: Catalog, toate: Cerere[], acces: CerereAcces[]): string {
  const p = ctx.prefix
  const buton = (x: Cerere, fapta: string, eticheta: string) =>
    `<form method="post" action="${p}/pangar/fa">
       ${jetonul(ctx)}<input type="hidden" name="id" value="${x.id}">
       <input type="hidden" name="fapta" value="${fapta}">
       <button type="submit">${eticheta}</button></form>`

  const grup = (titlu: string, stare: Cerere["stare"], gol: string, fapte: (x: Cerere) => string) => {
    const r = toate.filter((x) => x.stare === stare)
    if (r.length === 0) return `<h3>${titlu}</h3><p><small>${gol}</small></p>`
    return `<h3>${titlu} <small>(${r.length})</small></h3>
      <ul class="cereri">${r
        .map((x) => {
          const s = starea(x)
          const titluCartii = titlulDin(c, x.carte_slug)
          return `<li class="cer ${s.fel}">${copertaMica(ctx, c, x.carte_slug, titluCartii)}<div class="ce">
          <a href="${p}/carte/${x.carte_slug}">${esc(titluCartii)}</a>
          <span class="stare">${esc(s.text)} · ${esc(x.user_id)}</span>
          <span class="fapte">${fapte(x)}</span></div></li>`
        })
        .join("")}</ul>`
  }

  return pagina(
    ctx,
    "Pangar",
    `
  <h2>Pangar</h2>
  <p><small>Cererile enoriașilor, în ordinea în care au venit. Fiecare apăsare trimite și
  scrisoarea potrivită — se văd la <a href="${p}/pangar/scrisori">scrisori</a>.</small></p>

  ${
    acces.length
      ? `<h3>Cer dreptul de împrumut <small>(${acces.length})</small></h3>
  <ul class="cereri">${acces
    .map(
      (a) => `<li class="cer neutra"><div class="ce">
    <b>${esc(a.user_id)}</b>
    <span class="stare">a cerut accesul ${esc(dataCuZi(a.ceruta_la.slice(0, 10)))}</span>
    <span class="fapte">
      <form method="post" action="${p}/pangar/acces">
        ${jetonul(ctx)}<input type="hidden" name="id" value="${a.id}">
        <input type="hidden" name="fapta" value="activat">
        <button type="submit">Am activat dreptul</button></form>
      <form method="post" action="${p}/pangar/acces">
        ${jetonul(ctx)}<input type="hidden" name="id" value="${a.id}">
        <input type="hidden" name="fapta" value="refuzat">
        <button type="submit">Nu acum</button></form>
    </span></div></li>`,
    )
    .join("")}</ul>
  <p><small>Dreptul se dă din <a href="${esc(ctx.nav.admin)}">administrare</a>, la contul omului —
  biblioteca doar ține cererile. După ce l-ai dat, omul îl vede aici când intră din nou
  în cont.</small></p>`
      : ""
  }

  ${grup(
    "De căutat pe raft",
    "ceruta",
    "Nicio cerere nouă.",
    (x) => buton(x, "pregateste", "Am pregătit-o") + buton(x, "da", "A luat-o acum") + buton(x, "respinge", "Nu se poate"),
  )}

  ${grup("Puse deoparte", "pregatita", "Nimic pus deoparte.", (x) =>
    buton(x, "da", "A ridicat-o") + buton(x, "elibereaza", "Pun cartea la loc"),
  )}

  ${grup("La oameni acasă", "imprumutata", "Nicio carte împrumutată.", (x) => buton(x, "primeste", "S-a întors"))}

  <p class="pangar">Oamenii sunt scriși cu <b>identificatorul de cont</b>, nu cu numele:
  numele e al contului platformei și nu se copiază aici.</p>`,
  )
}

/** Un rand din tabelul `scrisori`, asa cum se citeste la /pangar/scrisori. */
export interface RandScrisoare {
  id: number
  user_id: string
  sablon: string
  subiect: string
  corp: string
  creata_la: string
  trimisa_la: string | null
  necaz: string | null
}

export function paginaScrisori(ctx: Ctx, scrisori: RandScrisoare[]): string {
  const netrimise = scrisori.filter((s) => !s.trimisa_la).length
  return pagina(
    ctx,
    "Scrisori",
    `
  <h2>Scrisori</h2>
  <p class="pangar">Ce a scris biblioteca la fiecare pas al unei cereri. Scrisorile pleacă prin
  <b>poșta platformei</b>, care ține și arhiva livrărilor; aici se vede ce s-a compus, la ce
  cerere, și dacă a plecat. Adresa de email nu se ține în bibliotecă: se cere de la cont în
  clipa trimiterii și nu se păstrează.${
    netrimise
      ? ` <b>${netrimise} ${netrimise === 1 ? "scrisoare n-a plecat" : "scrisori n-au plecat"}</b> — pricina scrie sub fiecare.`
      : ""
  }</p>

  ${
    scrisori.length === 0
      ? "<p>Nicio scrisoare încă.</p>"
      : scrisori
          .map(
            (s) => `
  <details>
    <summary><b>${esc(s.subiect)}</b><br><small>${esc(s.creata_la.slice(0, 16).replace("T", " "))}
      · ${esc(s.user_id)} · ${esc(s.sablon)}
      · ${s.trimisa_la ? "trimisă" : "netrimisă"}${s.necaz ? `: ${esc(s.necaz)}` : ""}</small></summary>
    <pre>${esc(s.corp)}</pre>
  </details>`,
          )
          .join("")
  }`,
  )
}

// --- Fisa unei carti ---------------------------------------------------------

/** Vecinatatile (acelasi autor, aceeasi editura) sunt taiate la 5 (cerere user, 7 sept. 2026 —
 *  erau 8, dar cu coperta de 52 px opt randuri fac o pagina). */
const VECINI = 5

/**
 * Fisa unei carti. Catalogul spune ce EXISTA, nu da textul: de aceea fisa se incheie cu drumul
 * spre pangar, nu cu un buton de citit. Sub fiecare lista de vecini e MEREU linkul spre pagina
 * intreaga, si cand n-au ramas mai multe: acolo e si cartea de fata, si lista toata.
 */
export function fisaCarte(
  ctx: Ctx,
  c: Catalog,
  k: Carte,
  libere: number,
  aMea: Cerere | null,
  raspuns: string | null,
): string {
  const p = ctx.prefix
  const vecini = (titlu: string, r: Carte[], tot: string) => {
    if (r.length === 0) return ""
    return `<h3>${titlu}</h3>
    ${listaCarti(ctx, c, r.slice(0, VECINI))}
    <p><small><a href="${tot}">${r.length > VECINI ? `Toate cele ${r.length + 1} &rarr;` : "Mai multe &rarr;"}</a></small></p>`
  }

  const aiCartii = autoriiCartii(c, k)
  const slugEd = k.editura ? slugEditura(k.editura) : null
  const numeEd = k.editura ? numeleEditurii(c, k.editura) : null
  const aceleasiEditura = slugEd
    ? c.carti.filter((x) => x.editura && slugEditura(x.editura) === slugEd && x.slug !== k.slug)
    : []

  const rand = (eticheta: string, valoare: string | null) => (valoare ? `<dt>${eticheta}</dt><dd>${valoare}</dd>` : "")

  /** „2,4 MB" — cat tine fisierul, cu virgula, ca omul sa stie ce descarca. */
  const marime = (n: number) =>
    n >= 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.round(n / 1024)} KB`

  // Ce s-a aflat de pe la librarii, daca s-a aflat ceva. Randurile din catalog raman primele si
  // neatinse: ce spune parohia e adevarul, restul vine in completare.
  const i = c.imb.carti[k.slug]

  return pagina(
    ctx,
    k.titlu,
    `
  <h2>${esc(k.titlu)}${semn(i)}</h2>
  ${banda(raspuns)}

  <div class="carte">
    ${
      i?.coperta
        ? `<figure class="coperta">
      <a class="mareste" href="${p}/coperta/mare/${k.slug}.jpg" aria-label="Vezi coperta mare">
        <img src="${p}/coperta/${k.slug}.jpg" alt="Coperta cărții „${esc(k.titlu)}”" loading="lazy">
        <span class="zoom" aria-hidden="true">${ICOANE_BIBLIOTECA.mareste}</span>
      </a>
    </figure>`
        : `<figure class="coperta fara"><span>fără copertă</span></figure>`
    }
    <dl class="fisa">
      ${rand(
        aiCartii.length > 1 ? "Autorii" : "Autorul",
        aiCartii.map((a) => `<a href="${p}/autor/${a.slug}">${esc(a.nume)}</a>`).join(" · ") ||
          `<a class="niciunul" href="${p}/autor/${FARA_AUTOR.slug}">${FARA_AUTOR.nume}</a>`,
      )}
      ${rand("Editura", slugEd ? `<a href="${p}/editura/${slugEd}">${esc(numeEd!)}</a>` : null)}
      ${rand("Anul", k.an ? esc(k.an) : null)}
      ${rand("Locul", k.loc ? esc(k.loc) : null)}
      <dt>Exemplare</dt><dd>${k.bucati}${
        libere < k.bucati ? ` <small>(${libere} ${libere === 1 ? "liber" : "libere"})</small>` : ""
      }</dd>
      <dt>Nr. în catalog</dt><dd>${k.nr}</dd>
      ${rand("Pagini", i?.pagini ? String(i.pagini) : null)}
      ${rand("Format", i?.format ? esc(i.format) : null)}
      ${rand("Coperta", i?.coperta_tip ? esc(i.coperta_tip) : null)}
      ${rand("ISBN", i?.isbn ? esc(i.isbn) : null)}
    </dl>
  </div>

  ${i?.descriere ? `<div class="descriere"><p>${esc(i.descriere)}</p></div>` : ""}
  ${
    i?.pdf
      ? `<p class="pdf"><a class="btn" href="${p}/pdf/${k.slug}.pdf">Citește cartea în PDF</a>
    <small>${marime(i.pdf.octeti)} — pusă la îndemână, gratuit, de
    <a href="${esc(i.pdf.sursa.url)}" rel="nofollow noopener" target="_blank">${esc(i.pdf.sursa.nume)}</a>.</small></p>`
      : ""
  }
  ${
    i
      ? (() => {
          // Textul e al userului (7 sept. 2026): ce s-a adus, de unde, si un singur cuvant spre
          // pagina cu sursele — nu o propozitie despre catalogul parohiei.
          const aduse = [
            i.coperta ? "coperta" : null,
            i.descriere ? "descrierea" : null,
            i.pagini || i.isbn || i.format ? "detaliile de tipar" : null,
          ].filter(Boolean) as string[]
          return `<p class="sursa"><small>${aduse.join(", ").replace(/^./, (x) => x.toUpperCase())}
    ${aduse.length > 1 ? "vin" : "vine"} de la
    <a href="${esc(i.sursa.url)}" rel="nofollow noopener" target="_blank">${esc(i.sursa.nume)}</a>.<br>
    Despre completările automate: <a href="${p}/despre-imbogatire">Surse</a>.</small></p>`
        })()
      : ""
  }

  ${cutiaDeImprumut(ctx, k, libere, aMea)}

  ${aiCartii
    .map((a) =>
      vecini(
        `Alte cărți de ${esc(numeDeAsezare(a.nume))}`,
        c.carti.filter((x) => x.slug !== k.slug && autoriiCartii(c, x).some((y) => y.slug === a.slug)),
        `${p}/autor/${a.slug}`,
      ),
    )
    .join("")}
  ${vecini(`Alte cărți de la ${esc(numeEd ?? "")}`, aceleasiEditura, slugEd ? `${p}/editura/${slugEd}` : `${p}/edituri`)}`,
  )
}

/**
 * Ce se poate face cu cartea. Cartea se ia tot de la pangar — rezervarea nu schimba asta, doar
 * scuteste drumul degeaba. Regulile (cat te asteapta, cat tine imprumutul) nu stau pe fisa: le
 * are pangarul pe ecranul lui (user, 8 sept. 2026).
 */
function cutiaDeImprumut(ctx: Ctx, k: Carte, libere: number, aMea: Cerere | null): string {
  const p = ctx.prefix
  const drum = `<p class="pangar">Cartea se împrumută <b>de la pangar</b>. Catalogul arată doar ce se află
  în bibliotecă; textul nu se citește aici.</p>`
  // Cutia e despartita de rest printr-o linie subtire deasupra si una dedesubt (user, 8 sept.
  // 2026) — in orice stare ar fi cartea, nu doar cand are buton.
  const cutie = (x: string) => `<div class="cutie">${x}</div>`

  if (aMea) {
    const s = starea(aMea)
    return cutie(`${drum}<p class="raspuns bun">Cartea aceasta e a ta acum: ${esc(s.text)}.
      <a href="${p}/eu">Cărțile mele &rarr;</a></p>`)
  }

  if (!ctx.userId) {
    return cutie(
      `${drum}<p><a class="btn intreg" href="${esc(ctx.nav.cont)}/intra?spre=${encodeURIComponent(
        `${ctx.prefix}/carte/${k.slug}`,
      )}">Intră în cont ca s-o poți împrumuta</a></p>`,
    )
  }

  if (!ctx.poateImprumuta) {
    return cutie(`${drum}<p><small>Ca să ceri cărți îți trebuie <b>dreptul de împrumut</b>. Se activează
      la pangar, o singură dată. Îl poți cere din <a href="${p}/eu">Cărțile mele</a>.</small></p>`)
  }

  if (libere <= 0) {
    return cutie(`${drum}<p><small>Toate cele ${k.bucati} exemplare sunt luate acum. Întreabă la pangar
      când se întoarce unul.</small></p>`)
  }

  // Textul e al userului (7 sept. 2026): butonul spune „Împrumută", nu „Cere" — omul vrea cartea,
  // nu o cerere. Butonul sta pe acelasi rand cu bara rosie, inaintea ei (user, 8 sept. 2026).
  return cutie(`<div class="imprumut">
  <form method="post" action="${p}/eu/cere" class="cere">
    ${jetonul(ctx)}<input type="hidden" name="slug" value="${k.slug}">
    <button type="submit">Împrumută cartea</button>
  </form>
  ${drum}</div>`)
}

// --- Paginile de sine statatoare ---------------------------------------------

/**
 * Pagina care spune de unde vin copertile si descrierile. Nu e o formalitate: adresa ei e scrisa
 * in User-Agent-ul cu care unealta bate la usa librariilor, ca oricine se uita in jurnalul
 * serverului lui sa vada intr-un minut cine suntem si de ce am trecut pe acolo.
 */
export function despreImbogatire(ctx: Ctx, c: Catalog): string {
  const surse = Object.values(c.imb.surse)
  const cate = new Map<string, number>()
  for (const i of Object.values(c.imb.carti)) cate.set(i.sursa.nume, (cate.get(i.sursa.nume) ?? 0) + 1)
  return pagina(
    ctx,
    "De unde vin copertele și descrierile",
    `
  <h2>De unde vin copertele și descrierile</h2>

  <p>Catalogul bibliotecii ține minte ce a scris cine a făcut evidența: titlul, autorul,
  editura, anul, locul și câte exemplare sunt în raft. Atât trebuie ca să găsești cartea,
  dar e puțin pentru cine n-a văzut-o niciodată.</p>

  <p>De aceea, pentru o parte dintre titluri, am căutat cartea la librăriile ortodoxe
  online și am adus de acolo <b>coperta</b>, <b>câte pagini are</b> și <b>câteva rânduri
  despre ce e înăuntru</b>. Fișele completate așa se recunosc după copertă, oriunde apare
  cartea; cele completate fără copertă poartă semnul <span class="imb">✦</span> lângă titlu.</p>

  <h3>Ce nu se schimbă</h3>
  <p>Nimic din ce a scris biblioteca. Ce vine din altă parte stă deoparte și se adaugă
  la fișă; dacă se șterge tot, catalogul rămâne întreg. Când librăria spune altceva decât
  tabelul parohiei — alt an, altă editură — <b>rămâne ce spune tabelul parohiei</b>.</p>

  <h3>Cine ne-a dat</h3>
  ${
    surse.length
      ? `<ul>${surse
          .map(
            (x) => `<li><a href="${esc(x.gazda)}" rel="nofollow noopener"
    target="_blank">${esc(x.nume)}</a>${cate.get(x.nume) ? ` <small>(${cate.get(x.nume)} fișe)</small>` : ""}</li>`,
          )
          .join("")}</ul>`
      : "<p>Încă nimic.</p>"
  }
  <p>Fiecare fișă completată spune, jos de tot, de la cine anume vine și duce la pagina
  cărții de acolo. Cine vrea cartea lui, o găsește de cumpărat. Coperțile le ținem la noi
  ca linkurile să nu cadă și ca browserul cititorului să nu dea de știre magazinului ce
  răsfoiește.</p>

  ${
    c.imb.cu_pdf
      ? `<h3>Cărțile în PDF</h3>
  <p>Unele edituri își dau cărțile și în PDF, gratuit, pe site-ul lor —
  <b>Editura Predania</b> face asta cu aproape tot ce tipărește. Unde e așa,
  fișa are un buton <b>„Citește cartea în PDF"</b>: e chiar fișierul editurii, păstrat
  la noi ca linkul să nu cadă, iar dedesubt scrie de la cine vine și duce la pagina
  cărții de acolo. ${c.imb.cu_pdf} ${c.imb.cu_pdf === 1 ? "carte are" : "cărți au"} așa ceva.
  Nu punem niciodată PDF-uri pe care editura nu le dă ea însăși, iar dacă o editură
  ne cere să scoatem un fișier, îl scoatem.</p>`
      : ""
  }

  <h3>Dacă e ceva greșit</h3>
  <p>Potrivirea dintre o carte din raft și o fișă de magazin se face după titlu și autor,
  și se poate înșela — mai ales la cărțile de rugăciune, care au zeci de ediții. Dacă o
  copertă sau o descriere nu e a cărții din raft, spuneți la pangar și o scoatem. La fel,
  dacă o librărie ne cere să nu-i mai arătăm coperțile.</p>

  <p><small>Ultima strângere: ${c.imb.facut_la ? esc(c.imb.facut_la) : "—"}.
  ${c.imb.total} fișe completate din ${c.total} titluri.</small></p>`,
  )
}

export function acasa(ctx: Ctx, c: Catalog): string {
  const p = ctx.prefix
  const exemplare = c.carti.reduce((s, x) => s + x.bucati, 0)
  return pagina(
    ctx,
    "Biblioteca parohiei",
    `
  <p><b>${c.total}</b> titluri, <b>${exemplare}</b> exemplare,
     <b>${c.totalAutori}</b> autori, <b>${c.totalEdituri}</b> edituri.</p>
  ${
    c.imb.total > 0
      ? `<p><small><b>${c.imb.total}</b> dintre fișe sunt completate cu
  ce se află pe la librăriile online.</small></p>`
      : ""
  }

  <div class="cutie"><div class="imprumut">
    <a class="btn intreg cere" href="${p}/eu">Cărțile mele</a>
    <p class="pangar">Cărțile se împrumută <b>de la pangar</b>. Cu un cont pe
    <a href="${esc(ctx.nav.cont)}">${esc(gazda(ctx.nav.cont))}</a> poți cere o carte de aici: pangarul o pune
    deoparte, îți scrie când e gata, și te așteaptă ${ZILE_ASTEPTARE} zile.</p>
  </div></div>

  <div class="doua">
    <section>
      <h2>Autori <small>(primii 10 din ${c.totalAutori})</small></h2>
      ${lista(ctx, c.autori.slice(0, 10), "autor")}
      <p><a href="${p}/autori">Toți autorii &rarr;</a></p>
    </section>
    <section>
      <h2>Edituri <small>(primele 10 din ${c.totalEdituri})</small></h2>
      ${lista(ctx, c.edituri.slice(0, 10), "editura")}
      <p><a href="${p}/edituri">Toate editurile &rarr;</a></p>
    </section>
  </div>`,
  )
}

/** Pagina scurta de mesaj — folosita la 404, la refuzuri si la verificarea de securitate. */
export function paginaMesaj(ctx: Ctx, titlu: string, text: string, status = 200): string {
  return pagina(ctx, titlu, `<h2>${esc(titlu)}</h2><p>${esc(text)}</p><p><a href="${ctx.prefix || "/"}">Înapoi la catalog</a></p>`)
}

/** Adresa publica a paginii de acum — pentru intoarcerea de la cont si de la comutatorul mastii. */
export const spreDin = adresaPaginii
