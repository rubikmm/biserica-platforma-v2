/**
 * CARCASA · structura si stilul tuturor aplicatiilor platformei.
 *
 * Grafica e cea din V1, mutata aici neschimbata (cerere user, 10.09.2026: „să avem la fel
 * footerul și antetul; nu vreau altă variantă grafică acum"). Deosebirea fata de V1 e ca acolo
 * fisierul se raspandea prin copiere in fiecare aplicatie; aici e un singur pachet, importat.
 *
 * Aplicatia nu scrie niciodata <html>, antetul sau subsolul. Da doar ce pune in sloturi:
 *   .titlu     NUMELE aplicatiei (link spre radacina ei) + contul        [nume, cont]
 *   .eyebrow   sfantul-ilie.ro — usa platformei
 *   .btns      randul de unelte al aplicatiei                            [unelte]
 *   (sub ele)  panouri care se deschid din unelte                        [subantet]
 *   .cine      randul personal, ultimul din antet                        [personal]
 *   <main>     continutul                                                [corp]
 *   subsol     tema + versiunea + copyright, la fel peste tot
 */

export function esc(text: unknown): string {
  return String(text ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

// ---------------------------------------------------------------------------
// Stilul global (V1: src/comun/stil-comun.ts)
// ---------------------------------------------------------------------------

export const STIL_COMUN = `
:root {
  --ink:#14181F; --paper:#FCFCFB; --soft:#4A5261; --faint:#808A9B;
  --rule:#DCDFE6; --rosu:#C62234; --albastru:#1C58BB; --tinta:#F4F5F7;
  --azi:#12D96A; --azi-fund:rgba(18,217,106,.10);
}
@media (prefers-color-scheme: dark) { :root:not([data-tema="light"]) {
  --ink:#E7EAEF; --paper:#0E1116; --soft:#A7B0BE; --faint:#75808F;
  --rule:#262D37; --rosu:#F0616F; --albastru:#7FA6F0; --tinta:#161B22;
  --azi:#3BFF9E; --azi-fund:rgba(59,255,158,.09);
} }
:root[data-tema="dark"] {
  --ink:#E7EAEF; --paper:#0E1116; --soft:#A7B0BE; --faint:#75808F;
  --rule:#262D37; --rosu:#F0616F; --albastru:#7FA6F0; --tinta:#161B22;
  --azi:#3BFF9E; --azi-fund:rgba(59,255,158,.09);
}
* { box-sizing:border-box }
html { scroll-behavior:smooth; scroll-padding-top:170px;
       overflow-y:scroll; scrollbar-gutter:stable }
body { margin:0; padding:0 20px 80px; background:var(--paper); color:var(--ink);
       font:17px/1.55 "Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
       -webkit-text-size-adjust:100%; touch-action:manipulation;
       -webkit-tap-highlight-color:transparent }
/* ⚠️ REGULA FERESTRELOR (user, 13.09.2026): cat timp ceva sta deschis PESTE pagina — abonarea,
   rasfoitul, chatul, orice pop-up de maine — pagina din spate NU se deruleaza. Clasa sta pe
   <html>, nu pe body: radacina are overflow-y:scroll (mai sus), deci derularea e a ei, iar
   overflow:hidden scris pe body nu se mai propaga la fereastra si nu opreste nimic — asa a scapat
   pana acum. scrollbar-gutter:stable tine locul barei, deci nimic nu sare in laturi la blocare.
   Punerea si scoaterea clasei le face carcasa singura (JS_CAP), nu aplicatia. */
html.cu-fereastra, html.cu-fereastra body { overflow:hidden; overscroll-behavior:none }
.w { max-width:680px; margin:0 auto }
.w.lat { max-width:900px }
a { color:var(--rosu); text-decoration-thickness:1px; text-underline-offset:2px }
.eyebrow { font:600 11px/1 ui-sans-serif,system-ui; letter-spacing:.16em;
           text-transform:uppercase; color:var(--faint); margin:44px 0 12px }
.eyebrow a { color:var(--faint); text-decoration:none }
h1:first-child { margin-top:48px }
h1 a { color:inherit; text-decoration:none }
h1 + .eyebrow, .titlu + .eyebrow { margin:4px 0 16px }
.titlu { display:flex; align-items:baseline; justify-content:space-between; gap:12px }
.titlu h1 { letter-spacing:.06em }
.cont { display:inline-flex; align-items:center; gap:7px; color:var(--soft);
        text-decoration:none; font:13px/1 ui-sans-serif,system-ui;
        white-space:nowrap; max-width:45% }
.cont span { overflow:hidden; text-overflow:ellipsis }
.cont svg { flex:none }
.cont:hover { color:var(--rosu) }
.cont-meniu { position:relative; max-width:45%; display:flex;
              border:0; border-radius:0; padding:0; margin:0 }
.cont-meniu .cont { max-width:100% }
.cont-meniu summary { cursor:pointer; list-style:none; user-select:none }
.cont-meniu summary::-webkit-details-marker { display:none }
.cont-meniu[open] summary { color:var(--rosu); margin-bottom:0 }
/* numele contului, rosu cat timp porti o masca „vezi ca" — semnul de la prima privire ca nu te uiti
   cu drepturile tale (user, 11.09.2026, dupa ce banda de jos a iesit) */
.cont-meniu summary.mascat { color:var(--rosu) }
.cont-meniu summary.mascat svg { color:var(--rosu) }
.cont-lista { position:absolute; right:0; top:calc(100% + 8px); min-width:170px;
              background:var(--paper); border:1px solid var(--rule); border-radius:10px;
              padding:6px 0; box-shadow:0 8px 24px rgba(0,0,0,.10); z-index:60 }
.cont-lista a { display:block; padding:9px 16px; color:var(--ink); text-decoration:none;
                font:14px/1.2 ui-sans-serif,system-ui }
.cont-lista a:hover { background:var(--tinta); color:var(--rosu) }
.cont-desparte { border:0; border-top:1px solid var(--rule); margin:6px 0 }
/* Masca purtata ACUM: acelasi rand din meniu, scris rosu. E si singurul semn ca omul nu se uita cu
   ochii lui, si drumul inapoi — la a doua apasare scoate masca (user, 11.09.2026: „«Vezi ca
   utilizator» sau «Vezi ca neautentificat» să fie cu roșu dacă sunt pe el. Iar la a doua apăsare…
   să revin la ce sunt eu, super admin"). Banda rosie de jos a iesit atunci — „nu am nevoie de el". */
.cont-lista a.cont-acum { color:var(--rosu); font-weight:600 }
h1 { font-size:36px; font-weight:400; letter-spacing:-.02em; margin:0 0 10px }
h1 .cod { color:var(--rosu) }
h2 { font-size:25px; font-weight:400; letter-spacing:-.01em; margin:34px 0 10px }
h3 { font-size:17px; font-weight:600; margin:26px 0 8px }
p { margin:10px 0 }
small { color:var(--faint) }
code { font:14px ui-monospace,SFMono-Regular,Menlo,monospace; background:var(--tinta);
       padding:1px 5px; border-radius:5px }
hr { border:0; border-top:1px solid var(--rule); margin:26px 0 }
ul, ol { padding-left:22px } li { margin:3px 0 }
table { border-collapse:collapse; width:100%; font-size:15.5px }
th { text-align:left; font:600 10.5px/1.3 ui-sans-serif,system-ui; letter-spacing:.1em;
     text-transform:uppercase; color:var(--faint); padding:8px 8px 6px;
     border-bottom:1px solid var(--rule) }
td { padding:7px 8px; border-bottom:1px solid var(--rule); vertical-align:top }
tr:last-child td { border-bottom:0 }
input, select, textarea, button { font:16px ui-sans-serif,system-ui; padding:8px 12px;
                border:1px solid var(--rule); border-radius:8px;
                background:var(--tinta); color:var(--ink) }
button { cursor:pointer }
form { display:flex; gap:8px; flex-wrap:wrap; margin:14px 0 }
form[hidden] { display:none }
form input[type=search] { flex:1; min-width:200px }
label { display:block; font:600 12px/1.4 ui-sans-serif,system-ui; color:var(--faint);
        letter-spacing:.04em; margin:10px 0 3px }
nav.rand a { margin-right:14px }
header nav.rand { margin:12px 0 }
footer { color:var(--faint); font-size:14px }
footer a { color:var(--faint) }
details { border:1px solid var(--rule); border-radius:10px; padding:10px 14px; margin:14px 0 }
summary { cursor:pointer; color:var(--soft) }
details[open] summary { margin-bottom:8px }
.sus { position:sticky; top:0; z-index:6; background:var(--paper); margin:0 -20px;
       padding:8px 20px 10px; border-bottom:1px solid var(--rule) }
.sus h1 { margin:12px 0 0; transition:font-size .15s ease }
.sus .eyebrow { margin:2px 0 10px; transition:font-size .15s ease }
.sus.mic h1 { font-size:19px; margin-top:6px }
.sus.mic .eyebrow { font-size:8.5px; margin-bottom:8px }
.btns { display:flex; gap:10px; margin:0 0 4px; flex-wrap:wrap }
.btn { flex:1; text-align:center; padding:9px 6px; border:1px solid var(--rule);
       border-radius:10px; background:var(--tinta); color:var(--ink);
       font:15px ui-sans-serif,system-ui; text-decoration:none; cursor:pointer }
.btn[aria-expanded="true"], .btn.activ { border-color:var(--rosu); color:var(--rosu) }
.btn svg { vertical-align:-4px }
.btn.intreg { flex:none; display:inline-block; padding:11px 20px }
.btn.gol { opacity:.4; pointer-events:none }
.capitole { display:flex; flex-wrap:wrap; gap:8px; margin:14px 0 }
.capitole a, .capitole b.acum { min-width:42px; padding:8px 2px; text-align:center;
  border:1px solid var(--rule); border-radius:8px; text-decoration:none;
  font:15px ui-sans-serif,system-ui; color:var(--ink); font-weight:400 }
.capitole b.acum { border-color:var(--rosu); color:var(--rosu); font-weight:600 }
.cine { margin:2px 0 6px; text-align:right; font:12px/1.6 ui-sans-serif,system-ui;
        color:var(--faint) }
.cine a { color:var(--soft); text-decoration:none }
.cine a:hover { color:var(--rosu); text-decoration:underline }
.sus.mic .cine { display:none }
.subsol-linie { border:0; border-top:1px solid var(--rule); margin:40px 0 0 }
.versiune { margin:16px 0 0; display:flex; align-items:center; justify-content:center; gap:10px;
            font:11px/1 ui-sans-serif,system-ui; letter-spacing:.08em; color:var(--faint) }
.buton-tema { font:11px/1 ui-sans-serif,system-ui; letter-spacing:.08em; color:var(--faint);
              background:none; border:1px solid var(--rule); border-radius:3px;
              padding:5px 9px; cursor:pointer }
.buton-tema:hover { color:var(--ink); border-color:var(--soft) }
.subsol { margin-top:12px; font:13px/1.55 ui-sans-serif,system-ui; color:var(--faint) }
.subsol p { margin:0 0 8px }
.copyright { text-align:center }
.alerta { padding:10px 14px; border:1px solid var(--rule); border-radius:10px;
          font:15px/1.45 ui-sans-serif,system-ui; margin:14px 0 }
.alerta.rea { border-color:var(--rosu); color:var(--rosu) }
.alerta.buna { border-color:#2E8A4A; color:#2E8A4A }
.alerta.atentie { border-color:#B8860B; color:#8A5A00 }
.gol { color:var(--faint); font-style:italic }
.c-rosu { color:var(--rosu) }
.c-albastru { color:var(--albastru) }
.sters { color:var(--faint) }
.mic-text { font:13px/1.5 ui-sans-serif,system-ui }
@media print {
  .sus, .btns, .cine, .subsol-linie, .versiune, .subsol, .fara-tipar { display:none !important }
  body { padding:0; background:#fff; color:#000 }
}
`

// ---------------------------------------------------------------------------
// JS-ul global (V1: src/comun/js-comun.ts) — tema dupa soare + antetul care se strange
// ---------------------------------------------------------------------------

export const JS_CAP = `
(function () {
  // ⚠️ REGULA FERESTRELOR, partea care miscă (user, 13.09.2026: „să fie o regulă generală când faci
  // un pop-up"). Nicio aplicatie nu mai scrie de mana oprirea derularii: ORICE <dialog> deschis cu
  // showModal() o capata singur, fiindca aici i se imbraca metoda — asa o primesc si ferestrele
  // scrise maine, fara sa-si aduca aminte cineva. Ferestrele care nu sunt <dialog> (panoul
  // chatului) cheama xcFereastra.blocheaza() / .dezblocheaza().
  // Numaratoarea e pentru ferestre suprapuse: fundalul se elibereaza cand se inchide ULTIMA.
  var de = document.documentElement;
  var deschise = 0;
  function blocheaza(){ if (++deschise === 1) de.classList.add('cu-fereastra'); }
  function dezblocheaza(){ if (deschise > 0 && --deschise === 0) de.classList.remove('cu-fereastra'); }
  window.xcFereastra = { blocheaza: blocheaza, dezblocheaza: dezblocheaza };

  var D = window.HTMLDialogElement;
  if (!D || !D.prototype || !D.prototype.showModal) return;
  var nativ = D.prototype.showModal;
  D.prototype.showModal = function () {
    // Intai deschiderea adevarata: daca fereastra era deja deschisa, ea arunca si nu numaram nimic.
    var r = nativ.apply(this, arguments);
    var f = this;
    if (!f.__xcBlocat) {
      f.__xcBlocat = true;
      blocheaza();
      // „close" vine si de la Escape, si de la <form method="dialog">, si de la .close() — deci
      // orice fel de inchidere elibereaza pagina.
      f.addEventListener('close', function la(){
        f.removeEventListener('close', la);
        f.__xcBlocat = false;
        dezblocheaza();
      });
    }
    return r;
  };
})();
(function () {
  var radacina = document.documentElement;
  radacina.className += ' cu-js';
  var LAT=44.4268, LON=26.1025, RAD=Math.PI/180, ORA=3600e3;
  function soare(d){
    var an=d.getFullYear();
    var n=Math.floor((d-new Date(an,0,1))/864e5)+1;
    var B=RAD*360/365*(n-81);
    var eot=9.87*Math.sin(2*B)-7.53*Math.cos(B)-1.5*Math.sin(B);
    var decl=23.45*Math.sin(B)*RAD;
    var cosH=(Math.sin(-0.833*RAD)-Math.sin(LAT*RAD)*Math.sin(decl))/(Math.cos(LAT*RAD)*Math.cos(decl));
    if(cosH<-1||cosH>1) return null;
    var H=Math.acos(cosH)/RAD;
    var amiaza=720-4*LON-eot;
    function laMin(m){ var t=new Date(Date.UTC(an,d.getMonth(),d.getDate())); t.setUTCMinutes(Math.round(m)); return t; }
    return { rasarit:laMin(amiaza-4*H), apus:laMin(amiaza+4*H) };
  }
  function faza(acum){
    var s=soare(acum); if(!s) return "zi";
    var ziDeLa=+s.rasarit+ORA, noapteDeLa=+s.apus+ORA;
    return (+acum>=ziDeLa && +acum<noapteDeLa) ? "zi" : "noapte";
  }
  function aleasa(){
    var m=document.cookie.match(/(?:^|; )tema=(dark|light)/);
    if(m) return m[1];
    try{ var v=localStorage.getItem("tema"); if(v==="dark"||v==="light") return v; }catch(e){}
    return null;
  }
  function tineMinte(t){
    var d=/(^|\\.)sfantul-ilie\\.ro$/.test(location.hostname) ? ";domain=.sfantul-ilie.ro" : "";
    document.cookie="tema="+t+";path=/;max-age=31536000;SameSite=Lax"+d;
    try{ localStorage.setItem("tema", t); }catch(e){}
  }
  function aplica(){
    var manual=aleasa();
    var tema = manual || (faza(new Date(Date.now()))==="noapte" ? "dark" : "light");
    radacina.setAttribute("data-tema", tema);
    var mc=document.querySelector('meta[name="theme-color"]');
    if(mc) mc.setAttribute("content", tema==="dark" ? "#0E1116" : "#FCFCFB");
    var b=document.getElementById("btn-tema");
    if(b){ b.hidden=false; b.textContent = tema==="dark" ? "\\u2600 zi" : "\\u263D noapte"; }
  }
  aplica();
  addEventListener("DOMContentLoaded", function () {
    aplica();
    var b=document.getElementById("btn-tema");
    if(b) b.addEventListener("click", function(){
      var tema = radacina.getAttribute("data-tema")==="dark" ? "light" : "dark";
      tineMinte(tema);
      aplica();
    });
  });
  setInterval(aplica, 60e3);
  document.addEventListener("gesturestart", function(e){ e.preventDefault(); });
})();
`

export const JS_JOS = `
(function(){
  var cap=document.getElementById("cap");
  if(!cap) return;
  var de=document.documentElement;
  var PRAG_LASA=8, PRAG_MIN=30, MARJA=8;
  var stransa=false, pierdut=-1;
  function pierdere(){
    if(pierdut>=0) return pierdut;
    var st=document.createElement("style");
    st.textContent="#cap,#cap *{transition:none!important}";
    document.head.appendChild(st);
    var era=cap.classList.contains("mic");
    cap.classList.add("mic");    var mic=cap.offsetHeight;
    cap.classList.remove("mic"); var mare=cap.offsetHeight;
    cap.classList.toggle("mic",era);
    st.remove();
    pierdut=Math.max(0,mare-mic);
    return pierdut;
  }
  function laDerulare(){
    var y=window.pageYOffset||de.scrollTop;
    var acum;
    if(stransa) acum = y>PRAG_LASA;
    else {
      var p=pierdere();
      acum = y>Math.max(PRAG_MIN,p+PRAG_LASA+MARJA)
          && (de.scrollHeight-window.innerHeight-p)>PRAG_LASA;
    }
    if(acum===stransa) return;
    stransa=acum;
    cap.classList.toggle("mic",stransa);
  }
  addEventListener("scroll",laDerulare,{passive:true});
  addEventListener("resize",function(){ pierdut=-1; laDerulare(); });
  laDerulare();
})();
(function(){
  document.addEventListener("click", function(e){
    var deschise=document.querySelectorAll("details.cont-meniu[open]");
    for (var i=0;i<deschise.length;i++){
      if(!deschise[i].contains(e.target)) deschise[i].removeAttribute("open");
    }
  });
})();
`

// ---------------------------------------------------------------------------
// Iconitele platformei
// ---------------------------------------------------------------------------

export const ICOANE = {
  om: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.8-3.6 4.7-5.1 8-5.1s6.2 1.5 8 5.1"/></svg>`,
  lupa: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.6-4.6"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>`,
  foaie: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>`,
  arhiva: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/></svg>`,
  /*
   * Iconițele fișierelor (cerere user, 11.09.2026): aceeași foaie cu colțul îndoit ca la `foaie`, dar
   * cu semnul a CE e înăuntru — rânduri de text la PDF (o hârtie de citit/tipărit), o poză la JPEG.
   * Se deosebesc dintr-o ochire, fără litere: „PDF" scris în 24 de puncte ar ieși pâclă la 17 px.
   * Trasătura e puțin mai subțire decât la celelalte iconițe (1,7 față de 2), fiindcă desenul dinăuntru
   * ar îmbâcsi foaia la grosimea obișnuită.
   */
  pdf: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8.5 13.5h7M8.5 17h4.5"/></svg>`,
  jpg: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><circle cx="9.5" cy="13" r="1"/><path d="m7.4 18.3 3.1-3.4 2 2.1 1.7-1.8 2.4 2.7"/></svg>`,
}

// ---------------------------------------------------------------------------
// Contul din antet
// ---------------------------------------------------------------------------

export interface Cont {
  /** Unde duce cand nu e nimeni intrat. */
  href?: string
  nume?: string
  intrat?: boolean
  admin?: boolean
  /** Adresa profilului si a iesirii — aplicatia de cont. */
  urlCont?: string
  urlAdmin?: string
  /**
   * Setarile APLICATIEI CURENTE (`<prefix>/setari`), nu ale platformei — de aceea le da fiecare
   * aplicatie, nu se socotesc aici (user, 15.09.2026: „setările specifice ale fiecărei aplicații").
   * Randul se scrie numai pentru cine e intrat: pagina e a unui om anume si oricum cere cont.
   * Aplicatia care nu da nimic aici (Contul insusi, unde Profilul E pagina) nu capata randul.
   */
  urlSetari?: string
  /** `true` pentru super-admin (si pentru cine poarta deja o masca): apare grupul „Vezi ca". */
  poateVedeaCa?: boolean
  /** Masca purtata acum, daca exista: `user`, `admin` sau `anonim`. */
  veziCa?: string | null
  /** Pagina de acum, ca intoarcerea de la comutator sa cada exact aici. */
  spre?: string
}

/** Numele mastii pentru om — acelasi cuvant in meniu si pe banda. */
function numeleMastii(m: string): string {
  return m === 'anonim' ? 'neautentificat' : m === 'admin' ? 'administrator' : 'utilizator'
}

function comutatorVeziCa(urlCont: string, ca: string, spre: string): string {
  return `${esc(urlCont)}/vezi-ca?ca=${esc(ca)}${spre ? `&spre=${encodeURIComponent(spre)}` : ''}`
}

/**
 * Grupul „Vezi ca" din meniu — adus din V1 (user, 10.09.2026): super-adminul se uita la
 * platforma cu ochii unui utilizator, ai unui administrator sau ai unui om neintrat, fara sa
 * se atinga de contul lui. Comutarea se cere la aplicatia de cont, fiindca acolo sta sesiunea
 * pe care se scrie masca; ea il trimite pe om inapoi exact unde era (`spre`).
 *
 * ⚠️ Cele trei randuri sunt COMUTATOARE, nu linkuri intr-un singur sens (user, 11.09.2026): randul
 * mastii purtate acum e scris rosu si, apasat a doua oara, scoate masca. De aceea nu mai exista un
 * al patrulea rand, „Revino la super admin" — iesirea e chiar randul pe care esti.
 *
 * ⚠️ Cuvintele „Vezi ca" au IESIT din cele trei randuri (user, 12.09.2026: „în loc de «vezi ca…» să
 * fie o săgeată"): a rămas săgeata si rolul — „→ Utilizator". Doar numele s-a schimbat; comutatorul,
 * randul rosu si drumul inapoi sunt neatinse.
 */
function randuriVeziCa(c: Cont): string {
  const urlCont = c.urlCont ?? ''
  const spre = c.spre ?? ''
  const cere = (ca: string, text: string) =>
    c.veziCa === ca
      ? `\n          <a class="cont-acum" href="${comutatorVeziCa(urlCont, 'real', spre)}" aria-current="true"` +
        ` title="Te uiți ca ${esc(numeleMastii(ca))} — apasă din nou ca să revii la contul tău">${text}</a>`
      : `\n          <a href="${comutatorVeziCa(urlCont, ca, spre)}">${text}</a>`
  return (
    cere('user', '→ Utilizator') +
    cere('admin', '→ Administrator') +
    cere('anonim', '→ Neautentificat')
  )
}

function veziCa(c: Cont): string {
  if (!c.poateVedeaCa) return ''
  return `\n          <hr class="cont-desparte">` + randuriVeziCa(c) + `\n          <hr class="cont-desparte">`
}

function contul(c: Cont): string {
  const urlCont = c.urlCont ?? ''
  const nume = c.nume ?? 'Cont'
  /*
   * ⚠️ Cat timp masca e pusa, NUMELE DIN ANTET e scris rosu (user, 11.09.2026: „dacă am vreo setare cu
   * «Vezi ca», să fie numele contului cu roșu — și asta e suficient ca să-mi dau seama că văd
   * restricționat față de contul meu de super-admin"). E tot ce a mai ramas din banda de jos: un semn
   * care se vede din prima privire, fara sa deschizi meniul. Sub masca „neautentificat" se inroseste
   * cuvantul „Cont", singurul scris acolo.
   */
  const capul = `<summary class="cont${c.veziCa ? ' mascat' : ''}">${ICOANE.om}<span>${esc(nume)}</span></summary>`
  if (!c.intrat) {
    /*
     * ⚠️ Sub masca „neautentificat" platforma nu mai stie pe nimeni, deci in antet scrie tot „Cont",
     * ca oricarui om neintrat — dar cuvantul deschide un meniu cu UN SINGUR lucru in el: comutatoarele
     * „Vezi ca", din care se iese inapoi la contul adevarat. De cand banda rosie de jos a iesit (user,
     * 11.09.2026: „să dispară banner-ul de jos"), asta e SINGURUL drum de intoarcere din masca anonima.
     * Daca-l scoti, super-adminul mascat ramane inchis afara si trebuie sa scrie de mana
     * `/cont/vezi-ca?ca=real`. Enoriasul adevarat nu-l vede niciodata: `poateVedeaCa` si `veziCa` vin
     * amandoua de pe sesiune, iar el n-are nici sesiune, nici masca.
     */
    if (c.poateVedeaCa && c.veziCa) {
      return `<details class="cont-meniu">
        ${capul}
        <nav class="cont-lista">${randuriVeziCa(c)}
        </nav>
      </details>`
    }
    // Linkul de intrare poarta pagina de acum, ca dupa cele sase cifre omul sa se intoarca exact
    // aici, nu in pagina contului (user, 11.09.2026). Fara ea, contul il lasa la Home.
    const spre = c.spre ? `?spre=${encodeURIComponent(c.spre)}` : ''
    return `<a class="cont" href="${esc(c.href ?? `${urlCont}/auth/login${spre}`)}">${ICOANE.om}<span>${esc(nume)}</span></a>`
  }
  /*
   * ⚠️ Ordinea randurilor merge de la om spre platforma: Profil (cine esti, peste tot) → Setari (ce
   * tine de tine AICI, in aplicatia asta) → Administrare (platforma intreaga, numai cine are cheia).
   * „Setari" il vede ORICINE e intrat, si enoriasul: treptele se vad in PAGINA, nu in meniu — un
   * utilizator simplu isi gaseste acolo abonarea, adminul si lista, super-adminul si jurnalul
   * (user, 15.09.2026: „fiecare nivel va vedea mai multe lucruri").
   */
  return `<details class="cont-meniu">
        ${capul}
        <nav class="cont-lista">
          <a href="${esc(urlCont)}/">Profil</a>${c.urlSetari ? `
          <a href="${esc(c.urlSetari)}">Setări</a>` : ''}${c.admin ? `
          <a href="${esc(c.urlAdmin ?? '')}/">Administrare</a>` : ''}${veziCa(c)}
          <a href="${esc(urlCont)}/auth/logout">Ieșire</a>
        </nav>
      </details>`
}

/*
 * ⚠️ BANDA DE JOS „te uiți ca…" A IESIT CU TOTUL (user, 11.09.2026: „când fac probele pe diverse
 * drepturi de utilizator, aș vrea să fie totul mai simplu, adică să dispară banner-ul de jos").
 * Semnul ca masca e pusa si iesirea din ea sunt acum amandoua in meniul de cont, pe randul rosu.
 * Daca vreodata se cere inapoi: se desena pe server, din sesiune (nu din cookie prin JS, ca in V1),
 * si de aceea aparea si cu JS-ul oprit.
 */

// ---------------------------------------------------------------------------
// Pagina
// ---------------------------------------------------------------------------

export interface OptiuniPagina {
  /** NUMELE din antet — un cuvant, cu majuscule: CALENDAR, PROGRAMUL, CURĂȚENIE. */
  nume: string
  /** Numele intreg al aplicatiei, pentru <title>. */
  titlu: string
  /** Ce scrie in <title> inaintea numelui bisericii. Implicit: `titlu`. */
  titluPagina?: string
  /** Unde duce numele din antet (radacina aplicatiei). */
  acasa?: string
  /** Unde duce `sfantul-ilie.ro` de sub titlu: home-ul platformei. */
  urlPlatforma?: string
  /** Stilul aplicatiei — se lipeste DUPA cel global si il suprascrie. */
  local?: string
  cont?: Cont | null
  /** Randul de unelte din antet. */
  unelte?: string
  /** Ce sta in antet sub unelte. */
  subantet?: string
  /** Randul personal — ultimul din antet. */
  personal?: string
  corp: string
  /** Data publicarii, pentru subsol. */
  modificata?: string
  versiune?: string
  metaExtra?: string
  scripturi?: string
  clasaCorp?: string
  /** Pagina ocupa latimea mare (arhive, tabele late). */
  lat?: boolean
  indexabil?: boolean
  /**
   * Modulul de Chat, cand e pornit pentru aplicatia si omul acesta (vezi `@xc/chat`). Carcasa nu
   * stie ce e inauntru: primeste stilul, HTML-ul si scriptul si le pune la locurile lor.
   */
  chat?: BucataChat
}

/** Bucatile bulei de chat. Forma sta aici ca sa nu atarne carcasa de pachetul chatului. */
export interface BucataChat {
  stil: string
  html: string
  js: string
}

export function subsol(versiune = '0.1.0', modificata = ''): string {
  return `<hr class="subsol-linie">
<p class="versiune">
  <button id="btn-tema" type="button" class="buton-tema" aria-label="Schimbă tema" hidden></button>
  <span>Versiunea: ${esc(versiune)}${modificata ? ` / ${esc(modificata)}` : ''}</span>
</p>
<footer class="subsol">
  <p class="copyright">${new Date().getFullYear()} © Biserica Sfântul Ilie - Hanul Colței</p>
</footer>`
}

function antet(p: OptiuniPagina): string {
  const c = p.cont === null ? '' : contul(p.cont ?? {})
  return `<header class="sus" id="cap">
  <div class="w${p.lat ? ' lat' : ''}">
    <div class="titlu">
      <h1><a href="${esc(p.acasa ?? '/')}">${esc(p.nume)}</a></h1>
      ${c}
    </div>
    <p class="eyebrow"><a href="${esc(p.urlPlatforma || '/')}">sfantul-ilie.ro</a></p>${p.unelte ? `\n    <nav class="btns">${p.unelte}</nav>` : ''}${p.subantet ? `\n    ${p.subantet}` : ''}${p.personal ? `\n    ${p.personal}` : ''}
  </div>
</header>`
}

export function pagina(p: OptiuniPagina): string {
  const w = `w${p.lat ? ' lat' : ''}`
  return `<!doctype html>
<html lang="ro"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#FCFCFB">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${esc(p.titlu)}">
<meta name="robots" content="${p.indexabil ? 'index, follow' : 'noindex, nofollow'}">${p.metaExtra ? `\n${p.metaExtra}` : ''}
<title>${esc(p.titluPagina ?? p.titlu)} · Sfântul Ilie — Hanul Colței</title>
<style>${STIL_COMUN}${p.local ?? ''}${p.chat?.stil ?? ''}</style>
<script>${JS_CAP}</script>
</head><body${p.clasaCorp ? ` class="${esc(p.clasaCorp)}"` : ''}>
${antet(p)}
<div class="${w}">
<main>${p.corp}</main>
${subsol(p.versiune, p.modificata)}
</div>
${p.chat ? `\n${p.chat.html}` : ''}
<script>${JS_JOS}</script>${p.scripturi ? `\n<script>${p.scripturi}</script>` : ''}${p.chat ? `\n<script>${p.chat.js}</script>` : ''}
</body></html>`
}

export function html(corp: string, status = 200, antete: Record<string, string> = {}): Response {
  return new Response(corp, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'referrer-policy': 'same-origin',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      ...antete,
    },
  })
}

export function alerta(fel: 'rea' | 'buna' | 'info' | 'atentie', mesaj: string): string {
  return `<div class="alerta ${fel}">${mesaj}</div>`
}

/**
 * „10.09.2026 - 13:40" — data SI ora publicarii, la Bucuresti, din binding-ul `version_metadata`.
 * Modelul e cel cerut de user (10.09.2026): `Versiunea: 0.2.0 / 10.09.2026 - 13:40`.
 */
export function dataVersiunii(meta?: { timestamp?: string }): string {
  const t = meta?.timestamp
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  const zi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(d)
  const [a, l, z] = zi.split('-').map(Number) as [number, number, number]
  return `${String(z).padStart(2, '0')}.${String(l).padStart(2, '0')}.${a} - ${oraBucuresti(d)}`
}

// ---------------------------------------------------------------------------
// Raspunsurile de masina — forma din contractul platformei: `{ eroare: { cod, mesaj } }`
// ---------------------------------------------------------------------------

export const ANTETE_API: Record<string, string> = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': 'if-none-match, content-type',
  'x-content-type-options': 'nosniff',
}

export function json(date: unknown, status = 200, antete: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(date), { status, headers: { ...ANTETE_API, ...antete } })
}

export function eroareApi(status: number, cod: string, mesaj: string, extra: Record<string, unknown> = {}): Response {
  return json({ eroare: { cod, mesaj, ...extra } }, status)
}

/** ETag slab din continut; cu `If-None-Match` potrivit se raspunde 304 fara corp. */
export async function jsonCuEtag(req: Request, date: unknown, antete: Record<string, string> = {}): Promise<Response> {
  const corp = JSON.stringify(date)
  const amprenta = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(corp))
  const etag = `W/"${[...new Uint8Array(amprenta)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('')}"`
  const daca = req.headers.get('if-none-match')
  const antetele = { ...ANTETE_API, etag, ...antete }
  if (daca && daca.split(',').map((s) => s.trim()).includes(etag)) {
    return new Response(null, { status: 304, headers: antetele })
  }
  if (req.method === 'HEAD') return new Response(null, { status: 200, headers: antetele })
  return new Response(corp, { status: 200, headers: antetele })
}

// ---------------------------------------------------------------------------
// Date si ore, ora Bucurestiului, fara biblioteci
// ---------------------------------------------------------------------------

export const LUNI = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
]
export const LUNI_SCURT = ['ian.', 'feb.', 'mart.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'noiem.', 'dec.']
export const ZILE_SAPTAMANA = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă']
export const ZILE_SAPTAMANA_COD = ['duminica', 'luni', 'marti', 'miercuri', 'joi', 'vineri', 'sambata'] as const

export function aziBucuresti(acum: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(acum)
}

export function oraBucuresti(acum: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit', hour12: false }).format(acum)
}

/**
 * Ziua ceruta in vorbe sau in cifre: `azi`, `maine`, `viitoare` (peste o saptamana) sau o data
 * scrisa AAAA-LL-ZZ. `null` cand nu e niciuna.
 *
 * A stat copiata in calendar, program si tipic (aceeasi functie, trei locuri) pana pe 11.09.2026,
 * cand a urcat aici: cuvintele pe care le intelege platforma sunt ale platformei, nu ale unei
 * aplicatii, iar de acum si actiunile le folosesc.
 */
export function dataCeruta(text: string, azi: string): string | null {
  const t = faraDiacritice(text).toLowerCase().trim()
  if (t === 'azi' || t === 'astazi') return azi
  if (t === 'maine') return adaugaZile(azi, 1)
  if (t === 'poimaine') return adaugaZile(azi, 2)
  if (t === 'viitoare') return adaugaZile(azi, 7)
  // Numele zilei („luni", „marti", „duminica"): urmatoarea zi cu numele asta, azi inclusiv —
  // omul spune „slujba de luni" si intelege lunea care vine (11.09.2026).
  const zi = ZILE_SAPTAMANA_COD.indexOf(t as (typeof ZILE_SAPTAMANA_COD)[number])
  if (zi >= 0) return adaugaZile(azi, (zi - ziuaSaptamanii(azi) + 7) % 7)
  return eDataValida(text) ? text : null
}

export function eDataValida(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function adaugaZile(data: string, zile: number): string {
  const d = new Date(`${data}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + zile)
  return d.toISOString().slice(0, 10)
}

export function ziuaSaptamanii(data: string): number {
  return new Date(`${data}T00:00:00Z`).getUTCDay()
}

export function zileIntre(deLa: string, panaLa: string): number {
  return Math.round((Date.parse(`${panaLa}T00:00:00Z`) - Date.parse(`${deLa}T00:00:00Z`)) / 86400000)
}

export function luneaSaptamanii(data: string): string {
  const zs = ziuaSaptamanii(data)
  return adaugaZile(data, zs === 0 ? -6 : 1 - zs)
}

export function dataLunga(data: string): string {
  const [a, l, z] = data.split('-').map(Number) as [number, number, number]
  return `${z} ${LUNI[l - 1] ?? ''} ${a}`
}

export function dataCuZi(data: string): string {
  return `${ZILE_SAPTAMANA[ziuaSaptamanii(data)]}, ${dataLunga(data)}`
}

export function intervalLizibil(deLa: string, panaLa: string): string {
  const [a1, l1, z1] = deLa.split('-').map(Number) as [number, number, number]
  const [a2, l2, z2] = panaLa.split('-').map(Number) as [number, number, number]
  if (a1 === a2 && l1 === l2) return `${z1} – ${z2} ${LUNI[l1 - 1] ?? ''} ${a1}`
  if (a1 === a2) return `${z1} ${LUNI_SCURT[l1 - 1] ?? ''} – ${z2} ${LUNI_SCURT[l2 - 1] ?? ''} ${a1}`
  return `${z1} ${LUNI_SCURT[l1 - 1] ?? ''} ${a1} – ${z2} ${LUNI_SCURT[l2 - 1] ?? ''} ${a2}`
}

export function momentLizibil(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const zi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(d)
  return `${dataLunga(zi)}, ${oraBucuresti(d)}`
}

export function faraDiacritice(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replaceAll('ș', 's').replaceAll('ş', 's').replaceAll('ț', 't').replaceAll('ţ', 't')
    .replaceAll('Ș', 's').replaceAll('Ş', 's').replaceAll('Ț', 't').replaceAll('Ţ', 't')
    .toLowerCase()
}

// Hartiile (PDF/JPG/PNG prin Browser Rendering) si cache-ul lor — vezi hartie.ts
export * from "./hartie.js"
