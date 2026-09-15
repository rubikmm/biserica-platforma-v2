/**
 * Paginile buletinului: numarul curent, un numar din arhiva, Arhiva pe ani si luni, cautarea.
 *
 * Afisarea, markup-ul si textele sunt cele din V1 (`biserica-buletin`, v0.5.0) — „să respecți
 * mesajele și grafica din V1" (user, 10.09.2026).
 *
 * Ce s-a schimbat fata de V1, si de ce:
 *  - carcasa (antet, subsol, tema) vine din `@xc/ui`, nu din `src/comun/` copiat in aplicatie;
 *  - ⚠️ ABONAREA e butonul cu plic + fereastra de la Program, ca la Calendar si Tipic (user,
 *    12–13.09.2026), nu campul de e-mail din randul de unelte al V1: pe platforma e acelasi gest,
 *    deci are aceeasi infatisare in toate aplicatiile. Butonul il vad TOTI, si adminii;
 *  - zilele scurte din raft se scriu cu `LUNI_SCURT` din `@xc/ui` (platforma scrie „mart.",
 *    „noiem."; V1 scria „mar.", „noi.") — restul textelor sunt cuvant cu cuvant din V1.
 */
import type { Navigatie } from '@xc/config'
import { ICOANE, LUNI, LUNI_SCURT, dataCuZi, dataLunga, esc, pagina } from '@xc/ui'
import { JS_ABONARE, abonamentul, butonAbonare, fereastraAbonare } from '@xc/abonare'
import { type Buletin, type BuletinScurt, type Gasit, plat } from './depozit.js'
import { LOCAL } from './stil.js'

export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
  /** Adresa contului — fereastra de abonare o scrie in camp si o incuie; `null` la neautentificat. */
  emailulContului?: string | null
  eAdmin: boolean
  versiune: string
  modificata: string
  veziCa?: string | null
  poateVedeaCa?: boolean
  spre?: string
}

/** Ce-i trebuie antetului ca sa se aseze. Il umple index.ts. */
export interface Meniu {
  /** pagina deschisa e Arhiva (butonul ei ramane aprins) */
  arhiva?: boolean
  /** `null` = cautarea sta inchisa; sir (chiar gol) = formularul e deschis, cu ce s-a cautat in el */
  q?: string | null
  /** vestea de dupa `POST /abonare` (`?abonat=1|2|0`) */
  veste?: 'inscris' | 'scos' | 'eroare' | null
}

/** Iconita Arhivei: cutie cu capac — aceeasi ca in V1 (venita acolo din A2). */
const IC_ARHIVA = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>`

/** Iconita hartiei de tipar: foaie cu coltul indoit — din V1; a ramas la numerele fara PDF. */
const IC_PDF = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>`

/** Cartea deschisa: semnul rasfoitului. */
const IC_CARTE = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6.5S10 4.8 6.8 4.8c-1.4 0-2.3.3-2.8.5v13c.5-.2 1.4-.5 2.8-.5C10 17.8 12 19.5 12 19.5"/><path d="M12 6.5S14 4.8 17.2 4.8c1.4 0 2.3.3 2.8.5v13c-.5-.2-1.4-.5-2.8-.5C14 17.8 12 19.5 12 19.5"/><path d="M12 6.5v13"/></svg>`

/* Plicul abonarii a plecat in `@xc/abonare`, odata cu butonul lui: acolo e acelasi desen pentru
   toate aplicatiile, deci nu se mai poate intampla sa se schimbe intr-un loc si in celelalte nu. */

function contDin(ctx: Ctx) {
  return {
    intrat: !!ctx.utilizator,
    nume: ctx.utilizator ?? 'Cont',
    admin: ctx.eAdmin,
    urlCont: ctx.nav.cont,
    urlAdmin: ctx.nav.admin,
    // Setarile APLICATIEI, nu ale platformei (user, 15.09.2026) — de aceea adresa e a noastra.
    urlSetari: `${ctx.prefix}/setari`,
    poateVedeaCa: ctx.poateVedeaCa ?? false,
    veziCa: ctx.veziCa ?? null,
    spre: ctx.spre ?? '',
  }
}

/** Adresa paginii unui numar. Numarul singur n-ar fi cheie: arhiva parohiei are numere filate cu
 *  doua date si zile cu doua numere — de aceea in adresa stau amandoua. */
export const adresa = (ctx: Ctx, b: { nr: number; data: string }): string => `${ctx.prefix}/buletin/${b.nr}-${b.data}`

/** Adresa unui fisier din R2, asa cum il serveste aplicatia. */
export const fisier = (ctx: Ctx, cheie: string): string => `${ctx.prefix}/fisier/${cheie}`

/** „6 sept." — pentru raftul arhivei, unde anul si luna scriu deja deasupra. */
const ziuaScurt = (data: string): string => {
  const [, l, z] = data.split('-').map(Number) as [number, number, number]
  return `${z} ${LUNI_SCURT[l - 1] ?? ''}`
}

/**
 * ABONAREA — butonul, fereastra si tot drumul de dupa ea stau in `@xc/abonare`, pachetul comun
 * (user, 15.09.2026: „ar trebui să fie la fel peste tot. Nu ar trebui să copiez logica în mai multe
 * locuri"). Al buletinului a ramas numai randul din registru: audienta `buletin-abonati`.
 *
 * ⚠️ CINE IL VEDE: **TOATA LUMEA, si adminii** (user, 12.09.2026: „și ei se comportă ca un utilizator
 * care poate vor să fie anunțați"). Regula sta acum in pachet, langa buton.
 *
 * ⚠️ Pana la 15.09.2026 fereastra era numai infatisare: `<form method="dialog">` o inchidea si atat,
 * deci din pagina nu se abona nimeni, desi ruta `POST /abonare` era intreaga dedesubt. Acum trimite.
 */
const ABONAMENT = abonamentul('buletin')

/** Fereastra, cu adresa contului completata cand omul e intrat, si cu termenii platformei. */
function fereastraBuletinului(ctx: Ctx): string {
  return fereastraAbonare({
    prefix: ctx.prefix,
    spre: ctx.spre ?? `${ctx.prefix}/`,
    urlTermeni: `${ctx.nav.home || ''}/termeni`,
    emailulContului: ctx.emailulContului ?? null,
  })
}

/** Randul din antet: abonarea, o liniuta verticala, apoi Arhiva si lupa (asezarea din V1). */
function unelte(ctx: Ctx, m: Meniu): string {
  const p = esc(ctx.prefix)
  return (
    butonAbonare(ABONAMENT) +
    `<span class="desparte" aria-hidden="true"></span>` +
    `<a class="btn mic${m.arhiva ? ' activ' : ''}" href="${p}/arhiva" title="Arhiva buletinelor"` +
    ` aria-label="Arhiva buletinelor">${IC_ARHIVA}</a>` +
    `<a class="btn mic" href="${p}/cauta" id="cauta-buton" aria-expanded="${m.q === null || m.q === undefined ? 'false' : 'true'}"` +
    ` title="Căutare în buletine" aria-label="Căutare în buletine">${ICOANE.lupa}</a>`
  )
}

/** Formularul de cautare, sub linia antetului. Ascuns cat lupa n-a fost apasata; pe `/cauta` e deschis. */
function formularCautare(ctx: Ctx, m: Meniu): string {
  const deschis = m.q !== null && m.q !== undefined
  return `<form action="${esc(ctx.prefix)}/cauta" method="get" id="cautare"${deschis ? '' : ' hidden'}>
      <input type="search" name="q" value="${esc(m.q ?? '')}" placeholder="un cuvânt din buletin, sau numărul lui">
      <button type="submit">Caută</button>
    </form>`
}

/** Vestea de dupa abonare, sub antet — ruta exista, fereastra inca nu trimite nimic spre ea. */
function vesteaAbonarii(m: Meniu): string {
  if (m.veste === 'inscris') return `<p class="veste bine">Gata, te-am trecut pe listă.</p>`
  if (m.veste === 'scos') return `<p class="veste bine">Te-am scos de pe listă.</p>`
  if (m.veste === 'eroare') return `<p class="veste rau">Nu s-a putut. Încearcă din nou.</p>`
  return ''
}

/** JS-ul paginilor: lupa care deschide formularul si butonul care deschide fereastra de abonare.
 *  Scris fara sageti si fara let/const, ca JS-ul carcasei — telefoanele vechi ale enoriasilor
 *  il citesc si pe acela. */
const JS_PAGINI = `
(function(){
  var f = document.getElementById("cautare"), b = document.getElementById("cauta-buton");
  if (!f || !b) return;
  b.addEventListener("click", function(e){
    e.preventDefault();
    var era = f.hidden;
    f.hidden = !era;
    b.setAttribute("aria-expanded", era ? "true" : "false");
    if (era) { var c = f.querySelector("input"); if (c) c.focus(); }
  });
})();
(function(){
  // RĂSFOITUL, cu modulul Real3D FlipBook — acelasi de la jurnaluldeafaceri (cerere user,
  // 13.09.2026). Tot ce urmeaza e ES5 DINADINS: pe un telefon vechi, o singura sintaxa noua ar face
  // bucata asta de script sa nu se mai citeasca, si ar cadea odata cu ea si lupa, si abonarea.
  //
  // Modulul isi aduce singur fratii (three.js, pdf.js, webgl, sunetul) din acelasi dosar cu
  // flipbook.min.js, deci de aici se incarca doar jQuery si el; restul vin dupa nevoie.
  var d = document.getElementById("d-rasfoit");
  if (!d) return;
  var pdf = d.getAttribute("data-pdf");
  var baza = d.getAttribute("data-js") + "/";
  var v = "?v=" + encodeURIComponent(d.getAttribute("data-v") || "");
  var cutie = document.getElementById("r-carte");
  var vorba = document.getElementById("r-vorba");
  var pornit = false;

  function deschidePdf(){ window.open(pdf, "_blank", "noopener"); }

  // Cine n-are <dialog> nu poate rasfoi aici: ii dam foaia, ca sa nu apese in gol. De aceea butonul
  // a ramas un link adevarat catre PDF.
  var poate = !!d.showModal;

  function aduScript(src){
    return new Promise(function(res, rej){
      var s = document.createElement("script");
      s.src = src;
      s.onload = function(){ res(); };
      s.onerror = function(){ rej(new Error(src)); };
      document.head.appendChild(s);
    });
  }

  function aduStil(href){
    var l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href;
    document.head.appendChild(l);
  }

  function pregateste(){
    if (pornit) return;
    pornit = true;
    aduStil(baza + "css/flipbook.style.css" + v);
    aduStil(baza + "css/font-awesome.css" + v);
    var lant = window.jQuery ? Promise.resolve() : aduScript(baza + "jquery.min.js" + v);
    lant.then(function(){
      return aduScript(baza + "js/flipbook.min.js" + v);
    }).then(function(){
      vorba.hidden = true;
      window.jQuery(cutie).flipBook({
        pdfUrl: pdf,
        // ⚠️ Fara rootFolder modulul si-ar cauta sunetul, preloaderul si iconitele langa PAGINA,
        // nu langa el. Adresa se termina cu bara — asa o lipeste de numele fisierelor.
        rootFolder: baza,
        viewMode: "webgl", viewModeMobile: "webgl",
        mode: "normal",
        // Fundalul e al ferestrei noastre, nu al modulului: altfel se vede o alta culoare pe sub el.
        backgroundColor: "#14161a", backgroundTransparent: false,
        sound: true, shadows: true,
        zoomMin: 0.85, zoomStep: 2,
        pageTextureSize: 1600, pageTextureSizeMobile: 1200,
        // ⚠️ PE TELEFON se intampla tot ce se vede mai putin (patit 13.09.2026, reclamat de user:
        // „deschide varianta free … nu e icoana de sunet pe bara de jos si nici efectele normale").
        // Modulul are un set de comutatoare numai pentru mobil, iar din fabrica ele TAIE:
        //   singlePageModeIfMobile -> forteaza o pagina pe ecran si sarace intoarcerea;
        //   btn*IfMobile nescrise  -> butoanele raman hideOnMobile, deci sunetul dispare.
        // Asezarea de aici e cea probata pe jurnaluldeafaceri, de unde vine si modulul.
        singlePageMode: false, singlePageModeIfMobile: false,
        responsiveView: true, responsiveViewTreshold: 768,
        thumbnailsOnStart: false, contentOnStart: false,
        // Butoanele modulului: paginile, zoomul, miniaturile, sunetul. Fara descarcare si fara
        // tiparire — foaia se ia de la adresa ei, iar din pagina nu mai duce niciun buton la PDF
        // (cerere user, 13.09.2026: „iese de tot").
        btnDownloadPdf: { enabled: false }, btnDownloadPages: { enabled: false },
        btnPrint: { enabled: false }, btnShare: { enabled: false },
        btnExpand: { enabled: false },
        btnSoundIfMobile: true, btnTocIfMobile: true, btnThumbsIfMobile: true,
        btnDownloadPdfIfMobile: false, btnDownloadPagesIfMobile: false,
        btnPrintIfMobile: false, btnShareIfMobile: false, btnExpandIfMobile: false,
        deeplinkingEnabled: false,
        height: cutie.clientHeight || 600
      });
    })["catch"](function(){
      // Nu lasam omul cu ochii pe o fereastra goala: ii deschidem foaia, ca inainte de rasfoit.
      vorba.hidden = false;
      vorba.textContent = "Nu s-a putut răsfoi aici. Deschid foaia…";
      setTimeout(function(){ d.close(); deschidePdf(); }, 1200);
    });
  }

  function deschide(e){
    if (e) e.preventDefault();
    if (!poate) { deschidePdf(); return; }
    d.showModal();
    pregateste();
  }

  var declansatoare = document.querySelectorAll("[data-rasfoit]");
  for (var i = 0; i < declansatoare.length; i++) declansatoare[i].addEventListener("click", deschide);

  document.getElementById("r-inchide").addEventListener("click", function(){ d.close(); });

  // Legatura de-a dreptul catre rasfoit: ?rasfoit=1. Tot ea e si calea prin care se fotografiaza.
  if (poate && /[?&]rasfoit=1/.test(location.search)) deschide();
})();
`

/**
 * Carcasa goala a buletinului — antet, subsol, stil — cu un corp dat de altcineva. O cere
 * `@xc/abonare`, ca ecranul celor sase cifre sa fie IN buletin, nu intr-o pagina straina a contului.
 * Fara randul de unelte: cat scrii codul n-ai ce cauta si n-ai de ce sa te abonezi a doua oara.
 */
export function paginaCarcasa(ctx: Ctx, o: { titluPagina: string; corp: string; scripturi?: string }): string {
  return pagina({
    nume: 'BULETINUL',
    titlu: 'Buletinul parohial',
    titluPagina: o.titluPagina,
    acasa: `${ctx.prefix}/`,
    urlPlatforma: ctx.nav.home || '/',
    local: LOCAL,
    cont: contDin(ctx),
    versiune: ctx.versiune,
    modificata: ctx.modificata,
    ...(o.scripturi ? { scripturi: o.scripturi } : {}),
    corp: o.corp,
  })
}

function sablon(ctx: Ctx, m: Meniu, titluPagina: string | undefined, corp: string): string {
  return pagina({
    nume: 'BULETINUL',
    titlu: 'Buletinul parohial',
    titluPagina,
    acasa: `${ctx.prefix}/`,
    urlPlatforma: ctx.nav.home || '/',
    local: LOCAL,
    cont: contDin(ctx),
    versiune: ctx.versiune,
    modificata: ctx.modificata,
    indexabil: true,
    unelte: unelte(ctx, m),
    subantet: `${fereastraBuletinului(ctx)}${formularCautare(ctx, m)}`,
    corp: `${vesteaAbonarii(m)}${corp}`,
    scripturi: JS_PAGINI + JS_ABONARE,
  })
}

/** Poza unui numar, in raft sau pe pagina lui. Fara poza (rar) ramane un dreptunghi cu numarul scris. */
function poza(ctx: Ctx, b: { nr: number; cheie_poza_mica: string | null }, clasa: string): string {
  if (!b.cheie_poza_mica) return `<span class="${clasa} fara">nr. ${b.nr}</span>`
  return `<img class="${clasa}" src="${fisier(ctx, b.cheie_poza_mica)}" alt="" loading="lazy" decoding="async"
     width="460" height="650">`
}

/** O fisa din raft: poza paginii intai, numarul si ziua. */
const fisa = (ctx: Ctx, b: BuletinScurt): string =>
  `<a class="fisa" href="${adresa(ctx, b)}">${poza(ctx, b, 'cop')}<b>Nr. ${b.nr}</b><span>${ziuaScurt(b.data)}</span></a>`

/**
 * Butonul unui numar: RĂSFOIEȘTE. Din 13.09.2026 a luat locul celor doua butoane de PDF ale V1
 * („Deschide PDF-ul" și „Descarcă") — cerere user: „în loc să deschidem pdf-ul"; „iese de tot".
 *
 * ⚠️ E un LINK adevarat catre PDF, nu un buton gol: JS-ul ii ia clicul si deschide rasfoitul peste
 * pagina. Asa, pe un telefon prea vechi pentru rasfoit (fara `<dialog>` ori fara module ES), omul
 * tot ajunge la foaie in loc sa apese in gol. Adresa `/fisier/…` ramane oricum vie — o citeaza
 * newsletterul.
 *
 * Fara PDF (doua numere vechi au ramas doar cu poza), butonul se stinge in loc sa duca in gol.
 */
function butonRasfoit(ctx: Ctx, b: Buletin): string {
  if (!b.cheie_pdf) {
    return (
      `<span class="btn intreg gol" title="Numărul acesta a rămas în arhivă doar ca poză">` +
      `${IC_PDF} Fără PDF</span>`
    )
  }
  const marime = b.marime_pdf ? ` <small>· ${(b.marime_pdf / 1048576).toFixed(1)} MB</small>` : ''
  return (
    `<a class="btn intreg" id="b-rasfoit" data-rasfoit href="${fisier(ctx, b.cheie_pdf)}"` +
    ` target="_blank" rel="noopener">${IC_CARTE} Răsfoiește${marime}</a>`
  )
}

/**
 * FEREASTRA DE RĂSFOIT — peste pagină, pe tot ecranul (cerere user, 13.09.2026), ca la
 * `jurnaluldeafaceri`. Înăuntru se desenează paginile PDF-ului și se întorc cu degetul sau cu
 * săgețile.
 *
 * ⚠️ Motorul de acum e cel LIBER: `page-flip` 2.0.7 (MIT) pentru întoarcerea paginii și `pdf.js`
 * 6.3.289 (Apache-2.0) pentru desenat, aduse din depozit la prima apăsare (vezi
 * `unelte/urca-rasfoit.mjs`). Utilizatorul vrea, la capăt, chiar **Real3D FlipBook** de la
 * `jurnaluldeafaceri` (CodeCanyon, WebGL, cu sunet), cu a doua licență cumpărată — de aceea
 * fereastra, butonul și adresa `?rasfoit=1` sunt scrise ca să rămână NESCHIMBATE la schimbarea
 * motorului: se înlocuiește doar bucata din JS care umple `#r-carte`.
 *
 * Nu se pune decât unde numărul chiar are PDF.
 */
function fereastraRasfoit(ctx: Ctx, b: Buletin): string {
  if (!b.cheie_pdf) return ''
  return `<dialog class="rasfoit" id="d-rasfoit" aria-label="Răsfoiește numărul ${b.nr}"
  data-pdf="${fisier(ctx, b.cheie_pdf)}" data-js="${esc(ctx.prefix)}/flipbook" data-v="${esc(ctx.versiune)}">
  <div class="rasfoit-cap">
    <b>Nr. ${b.nr}</b> <span class="rasfoit-cand">${dataLunga(b.data)}</span>
    <button type="button" class="modal-x" id="r-inchide" aria-label="Închide răsfoitul">&times;</button>
  </div>
  <div class="rasfoit-scena"><div class="rasfoit-carte" id="r-carte"></div></div>
  <p class="rasfoit-vorba" id="r-vorba">Se pregătește…</p>
</dialog>`
}

/** Coperta: pagina intai, mare, care duce in PDF. */
function coperta(ctx: Ctx, b: Buletin): string {
  const mare = b.cheie_poza
    ? `<img src="${fisier(ctx, b.cheie_poza)}" alt="Pagina întâi a numărului ${b.nr}" width="1400" height="1980">`
    : poza(ctx, b, 'cop')
  // Coperta deschide RĂSFOITUL, ca și butonul de sub ea (`data-rasfoit`); `href` rămâne fișierul,
  // ca ea să facă ceva și acolo unde răsfoitul nu poate rula.
  return b.cheie_pdf
    ? `<a class="coperta" data-rasfoit href="${fisier(ctx, b.cheie_pdf)}" target="_blank" rel="noopener"
         title="Răsfoiește numărul">${mare}</a>`
    : `<span class="coperta">${mare}</span>`
}

/**
 * PRIMA PAGINA: numarul curent, intreg — pagina lui intai, mare, care duce in PDF — si dedesubt fasia
 * numerelor dinainte. Ce cauta omul care intra aici e buletinul de duminica asta; arhiva e la un buton
 * distanta, in antet.
 */
export function paginaAcasa(ctx: Ctx, m: Meniu, b: Buletin | null, dinainte: BuletinScurt[], cate: number): string {
  if (!b) {
    return sablon(
      ctx,
      m,
      undefined,
      `<h2>Buletinul parohiei</h2>
<p class="gol">Arhiva nu e încă în bază. Importul se rulează din <code>infrastructure/import/</code>.</p>`,
    )
  }
  return sablon(
    ctx,
    m,
    `Nr. ${b.nr}`,
    `<div class="cap-numar">
  <p class="eticheta">Numărul curent</p>
  <h2>Nr. ${b.nr}</h2>
  <p class="cand">${dataCuZi(b.data)}</p>
</div>
${coperta(ctx, b)}
<nav class="btns hartii">${butonRasfoit(ctx, b)}</nav>${fereastraRasfoit(ctx, b)}
${
  dinainte.length
    ? `<h3 class="titlu-fasie">Numerele dinainte</h3>
<div class="raft fasie">${dinainte.map((x) => fisa(ctx, x)).join('')}</div>`
    : ''
}
<p class="marunt sub-fasie"><a href="${esc(ctx.prefix)}/arhiva">Arhiva întreagă</a> — ${cate} numere, din 2012 până azi.</p>`,
  )
}

/** Pagina unui numar din arhiva: aceeasi asezare ca prima pagina, plus sagetile spre vecini. */
export function paginaBuletin(
  ctx: Ctx,
  m: Meniu,
  b: Buletin,
  v: { inainte: BuletinScurt | null; dupa: BuletinScurt | null },
): string {
  const sageata = (x: BuletinScurt | null, text: string) =>
    x ? `<a class="btn" href="${adresa(ctx, x)}">${text}</a>` : `<span class="btn gol">${text}</span>`
  return sablon(
    ctx,
    m,
    `Nr. ${b.nr}`,
    `<div class="cap-numar">
  <p class="eticheta"><a href="${esc(ctx.prefix)}/arhiva?an=${b.an}">${b.an}</a> · ${LUNI[Number(b.luna) - 1]}</p>
  <h2>Nr. ${b.nr}</h2>
  <p class="cand">${dataCuZi(b.data)}${b.pagini ? ` · ${b.pagini} pagini` : ''}</p>
</div>
${coperta(ctx, b)}
<nav class="btns hartii">${butonRasfoit(ctx, b)}</nav>${fereastraRasfoit(ctx, b)}
<nav class="btns vecini">${sageata(v.inainte, `◀ <span class="cuv">numărul dinainte</span>`)}${sageata(
      v.dupa,
      `<span class="cuv">numărul următor</span> ▶`,
    )}</nav>`,
  )
}

/**
 * ARHIVA: **un singur an pe ecran**, ca la A2 — 619 de numere intr-un teanc nu se rasfoiesc. Bara de
 * sus (patratelele `.capitole` din carcasa) schimba anul, iar anul vine din adresa („?an=2019"), nu
 * dintr-o stare din pagina: linkul se poate da mai departe si merge butonul „înapoi" al browserului.
 *
 * In anul deschis, numerele stau grupate PE LUNI, in rafturi de fise cu pagina intai — la un buletin
 * coperta spune mai mult decat orice titlu, fiindca titlul lui e chiar ce scrie pe ea.
 */
export function paginaArhiva(
  ctx: Ctx,
  m: Meniu,
  ani: { an: string; cate: number }[],
  ales: string,
  buletine: BuletinScurt[],
  total: number,
): string {
  const butoane = ani.length
    ? `<nav class="capitole">${ani
        .map(
          (a) =>
            `<a${a.an === ales ? ` class="acum"` : ''} href="${esc(ctx.prefix)}/arhiva?an=${a.an}" title="${a.cate} numere">${a.an}</a>`,
        )
        .join('')}</nav>`
    : ''
  const peLuna = new Map<string, BuletinScurt[]>()
  for (const b of buletine) peLuna.set(b.luna, [...(peLuna.get(b.luna) ?? []), b])
  const luni = [...peLuna]
    .map(([luna, ss]) => {
      const nume = LUNI[Number(luna) - 1] ?? ''
      // in raft numerele merg INAINTE (prima duminica a lunii intai), ca o fasie de calendar citita de
      // la stanga la dreapta; lista vine descrescator, deci lunile raman de la cea mai noua
      return (
        `<h4>${nume[0]?.toUpperCase() ?? ''}${nume.slice(1)}</h4>` +
        `<div class="raft">${[...ss].reverse().map((x) => fisa(ctx, x)).join('')}</div>`
      )
    })
    .join('\n')
  return sablon(
    ctx,
    m,
    'Arhiva',
    `<h2>Arhiva buletinelor</h2>
<p class="marunt">${total} numere, din 2012 până azi. Aduse din arhiva parohiei și de pe sfantul-ilie.ro.</p>
${butoane}
${ales ? `<section class="an"><h3>${ales} <small>· ${buletine.length} numere</small></h3>\n${luni}</section>` : ''}`,
  )
}

/** Bucata de text in care s-a nimerit cuvantul cautat, cu el ingrosat. Pozitia se cauta pe forma fara
 *  diacritice — de acolo si `plat()` — dar se taie din textul adevarat, cu diacriticele lui. */
function fragmentul(fragment: string, q: string): string {
  const cautat = plat(q.trim())
  const i = plat(fragment).indexOf(cautat)
  if (i < 0 || !cautat) return `…${esc(fragment)}…`
  return (
    `…${esc(fragment.slice(0, i))}<mark>${esc(fragment.slice(i, i + cautat.length))}</mark>` +
    `${esc(fragment.slice(i + cautat.length))}…`
  )
}

/** Rezultatele cautarii: un rand pe numar — pagina intai mica, numarul, ziua si fragmentul gasit. */
export function paginaCautare(ctx: Ctx, m: Meniu, q: string, gasite: Gasit[]): string {
  const cerut = q.trim()
  if (!cerut) {
    return sablon(
      ctx,
      m,
      'Căutare',
      `<h2>Căutare</h2>
<p class="marunt">Scrie un cuvânt în caseta de sus: se caută în textul buletinelor (primele pagini ale
fiecărui număr), fără să conteze diacriticele. Un număr scris singur — „615" — deschide numărul acela.</p>`,
    )
  }
  if (!gasite.length) {
    return sablon(
      ctx,
      m,
      `Căutare: ${cerut}`,
      `<h2>Căutare: „${esc(cerut)}"</h2>
<p class="gol">Niciun buletin nu spune asta.</p>`,
    )
  }
  return sablon(
    ctx,
    m,
    `Căutare: ${cerut}`,
    `<h2>Căutare: „${esc(cerut)}"</h2>
<p class="marunt">${gasite.length} ${gasite.length === 1 ? 'număr găsit' : 'numere găsite'}${
      gasite.length >= 60 ? ' (primele 60)' : ''
    }.</p>
<div class="gasite">${gasite
      .map(
        (g) => `<a class="gasit" href="${adresa(ctx, g)}">
  ${poza(ctx, g, 'cop mica')}
  <div>
    <b>Nr. ${g.nr}</b> <span>${dataLunga(g.data)}</span>
    <p>${fragmentul(g.fragment ?? '', cerut)}</p>
  </div>
</a>`,
      )
      .join('')}</div>`,
  )
}

/** Pagina scurta de mesaj (nu există, eroare) — cu antetul intreg, ca in V1. */
export function paginaMesaj(ctx: Ctx, m: Meniu, titlu: string, corp: string): string {
  return sablon(ctx, m, titlu, `<h2>${esc(titlu)}</h2>\n${corp}`)
}
