/**
 * Paginile programului liturgic — saptamana (programul scris sau propunerea ei, in aceeasi asezare),
 * arhiva, scrierea si validarea — pe carcasa comuna (@xc/ui).
 *
 * Grafica, markup-ul si TEXTELE de aici sunt cele din V1 (biserica-program, src/pagini.ts + src/stil.ts,
 * starea de la 9 sept. 2026), aduse ca atare — cerere user, 10.09.2026: „să respecți mesajele și grafica
 * din V1" si „afișarea și bara de navigare să fie identice". Ce difera e doar ce tine de structura V2:
 *   - abonarea n-are camp de e-mail (adresa e a contului; abonarea e o audienta a comunicarii);
 *   - adresele poarta prefixul aplicatiei (in preview toate stau pe un singur host).
 * Scrierea si validarea MANUALA a saptamanii (pagina /admin, care in V1 nu exista) au fost scoase cu totul
 * la cererea userului (10.09.2026, 16:36: „nu vreau să fac nimic manual") — programul are saptamanile
 * importate din V1 si propunerea automata, ca in V1.
 *
 * Antetul (V1, 9 sept. 2026): pe randul de unelte (`.btns` al carcasei) sta ABONAREA — buton + vorba —
 * iar in capat, dupa o liniuta verticala, meniul „Informații utile". Navigarea saptamanii sta SUB linia
 * antetului, intr-o casuta centrata lipita de ea (`navJos`, slotul `subantet` al carcasei).
 */
import type { IntrareVocabular, Slujba, StareSaptamana } from '@xc/contracts'
import type { Navigatie } from '@xc/config'
import { ICOANE, LUNI, ZILE_SAPTAMANA, adaugaZile, alerta, esc, intervalLizibil, luneaSaptamanii, pagina, ziuaSaptamanii } from '@xc/ui'
import type { CalendarSaptamana, ZiPeProgram } from './calendar.js'
import { ziRosie } from './calendar.js'
import { randurileSlujbei } from './foaie.js'

export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
  eAdmin: boolean
  versiune: string
  modificata: string
  /** „Vezi ca" — vin din sesiune, gata calculate de identitate; doar pentru meniu si banda. */
  veziCa?: string | null
  poateVedeaCa?: boolean
  spre?: string
}

/** Ce-i trebuie antetului ca sa se aseze: navigarea, abonarea, meniul de informatii. Il umple index.ts. */
export interface Meniu {
  /** saptamanile vecine; `null` stinge sageata */
  vecini: { inainte: string | null; dupa: string | null }
  /** adresa foii FARA extensie si FARA prefix (`/v1/foaie/<luni>`, `/v1/propunere/<luni>`); null = n-are foaie */
  foaie: string | null
  /** ziua de azi (Bucuresti) — bulina din mijloc duce la saptamana ei */
  azi: string
  /** saptamana de pe ecran e cea de azi — bulina ramane apasata */
  acum?: boolean
  /** pagina deschisa e Arhiva (butonul ei ramane aprins) */
  arhiva?: boolean
  /** omul intrat e deja pe lista programului */
  abonat?: boolean
  /** vestea de dupa `POST /abonare` sau `/dezabonare` (`?abonat=1|0|2`) */
  veste?: { text: string; fel: 'bine' | 'rau' } | null
  /** unde se intoarce formularul de abonare (calea paginii de acum, cu prefix) */
  spre?: string
}

const STARE: Record<string, string> = {
  validat: 'validat',
  propus: 'propus',
  modificat_dupa_validare: 'modificat după validare',
  propunere: 'propunere',
}

/** Iconita Arhivei: cutie cu capac — exact cea din V1 (18px, cu manerul desenat separat). */
const IC_ARHIVA = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>`

// ---------------------------------------------------------------------------
// Stilul local — V1 src/stil.ts, ca atare; adaugirile V2 sunt marcate
// ---------------------------------------------------------------------------

export const STIL = `
.marunt { font-size:14px; color:var(--faint) }

/* capul saptamanii: titlul + starea (navigarea si hartiile au urcat in meniul din antet, 8 sept. 2026) */
.sapt-cap { display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap; margin:26px 0 14px }
.sapt-cap h2 { margin:0 }
.stare { font:600 10.5px/1 ui-sans-serif,system-ui; letter-spacing:.12em; text-transform:uppercase;
         padding:5px 9px; border-radius:999px; border:1px solid var(--rule); color:var(--soft); white-space:nowrap }
.stare.validat { border-color:var(--azi); color:var(--ink); background:var(--azi-fund) }
.stare.propus { border-color:var(--albastru); color:var(--albastru) }

/* ANTETUL, refacut la 9 sept. 2026 (cerere user). Randul lui de unelte (.btns al carcasei) tine acum
   ABONAREA — buton + vorba — iar in capat, dupa o liniuta verticala, meniul „Informații utile". Navigarea
   saptamanii a coborat sub linia antetului, in .nav-jos (mai jos). Regulile scrise pe .btns tin de amandoua:
   casuta de jos poarta aceeasi clasa dinadins, ca sa nu se scrie de doua ori acelasi lucru. */
/* V2: carcasa comuna lasa .btns sa se rupa (flex-wrap:wrap); in V1 randul nu se rupea pe desktop, iar
   abonarea se sprijina pe asta — vorba se strange, nu sare pe randul urmator. Pe telefon se rupe (mai jos). */
.btns { flex-wrap:nowrap }
.btns .gol { opacity:.35; pointer-events:none }
/* abonarea: butonul stramt, vorba curge in restul randului */
.btns .abon-btn { flex:0 0 auto; padding-left:18px; padding-right:18px; white-space:nowrap }
.btns .abon-vorba { flex:1 1 auto; min-width:0; align-self:center;
                    font:13.5px/1.35 ui-sans-serif,system-ui; color:var(--soft) }
.btns .abon-vorba.bine { color:var(--albastru) }
.btns .abon-vorba.rau { color:var(--rosu) }
/* cu cont: formularul se intinde pe toata linia (cerere user, 9 sept. 2026) */
.btns .abon { flex:1 1 auto; display:flex; flex-wrap:nowrap; gap:8px; margin:0; min-width:0 }
/* V2: fara camp de e-mail (adresa e a contului) — vorba ia locul campului si se poate strange */
.btns .abon .abon-vorba { flex:1 1 auto; min-width:0 }
/* „Informații utile": buton care deschide un meniu mic, ca meniul contului din carcasa — <details>,
   deci merge si fara JS (JS-ul local il inchide doar la click in afara). */
.btns .meniu-info { position:relative; flex:0 0 auto; display:flex;
                    border:0; border-radius:0; padding:0; margin:0 }
.btns .meniu-info summary { list-style:none; cursor:pointer; color:var(--ink);
                            white-space:nowrap; margin:0 }
.btns .meniu-info summary::-webkit-details-marker { display:none }
.btns .meniu-info[open] summary { border-color:var(--rosu); color:var(--rosu) }
.info-lista { position:absolute; right:0; top:calc(100% + 8px); min-width:220px;
              background:var(--paper); border:1px solid var(--rule); border-radius:10px;
              padding:6px 0; box-shadow:0 8px 24px rgba(0,0,0,.10); z-index:60 }
.info-rand { display:block; width:100%; text-align:left; padding:9px 16px; margin:0;
             border:0; border-radius:0; background:none; color:var(--ink);
             font:14px/1.2 ui-sans-serif,system-ui; cursor:pointer }
.info-rand:hover { background:var(--tinta); color:var(--rosu) }
/* NAVIGAREA coborata: casuta atarna de linia antetului (.sus e sticky, deci pozitionat — ii e si
   bloc de referinta), centrata, cu colturile de sus DREPTE si cele de jos rotunde (cerere user,
   9 sept. 2026). N-are chenar sus: linia antetului ii tine loc de capac. */
.nav-jos { position:absolute; left:50%; top:calc(100% + 1px); transform:translateX(-50%); z-index:5 }
.nav-jos .cutie { margin:0; padding:7px 12px 8px; max-width:calc(100vw - 24px);
                  background:var(--paper); border:1px solid var(--rule); border-top:0;
                  border-radius:0 0 12px 12px; box-shadow:0 8px 18px rgba(0,0,0,.07) }
/* casuta e cat continutul ei, nu cat randul: butoanele nu mai cresc si nu-si mai rup cuvintele
   in doua (in antet crescusera, ca sa umple randul — aici randul e al casutei) */
.nav-jos .btn { flex:0 0 auto; white-space:nowrap; padding-left:14px; padding-right:14px }
/* casuta pluteste peste inceputul paginii — ii face loc */
main { padding-top:34px }
.btns .btn { min-width:0 }
/* bulina din mijloc (user, 8 sept. 2026: „doar o bulină pe centru"): un punct, fara text, la fel de inalta
   ca sagetile; duce la saptamana de azi */
.btns .punct { flex:0 0 auto; display:flex; align-items:center; justify-content:center; padding-left:20px; padding-right:20px }
.btns .punct::before { content:""; width:9px; height:9px; border-radius:50%; background:currentColor }
.btns .punct:hover { color:var(--rosu); border-color:var(--rosu) }
/* bara verticala dintre navigare si butoanele saptamanii (cerere user, 8 sept. 2026) */
.btns .desparte { flex:0 0 1px; align-self:stretch; background:var(--rule); margin:0 3px }
/* butoanele mici: nu cresc, stau cat le tine continutul — iconita Arhivei, apoi PDF si JPG */
.btns .mic { flex:0 0 auto; display:flex; align-items:center; justify-content:center; gap:6px;
             padding-left:14px; padding-right:14px; font:600 12.5px/1 ui-sans-serif,system-ui; letter-spacing:.06em }
.btns .mic svg { vertical-align:0 }
/* pe telefon nu incap si cuvintele sagetilor: raman doar ◀ si ▶. Tot acolo, vorba abonarii („trebuie
   să-ți faci cont") trece pe randul ei, sub buton (order o duce ultima), iar formularul se poate rupe. */
@media (max-width:600px) {
  .btns { gap:7px; flex-wrap:wrap }
  .btns .cuv { display:none }
  .btns .mic { padding-left:10px; padding-right:10px }
  .btns .punct { padding-left:14px; padding-right:14px }
  .btns .abon-vorba { flex:1 0 100%; order:9; font-size:12.5px }
  .btns .abon { flex-wrap:wrap }
  .btns .abon .abon-vorba { flex:1 0 100%; white-space:normal }
  /* casuta de jos NU se rupe pe doua randuri: ar creste cat un antet si ar acoperi titlul */
  .nav-jos .cutie { padding-left:8px; padding-right:8px }
  .nav-jos .btns { flex-wrap:nowrap; gap:6px }
  .nav-jos .btn { padding-left:10px; padding-right:10px }
  .nav-jos .mic { padding-left:8px; padding-right:8px }
}

/* o zi din program */
.zi { margin:0 0 22px; padding:0 0 14px; border-bottom:1px solid var(--rule) }
.zi:last-child { border-bottom:0 }
.zi h3 { margin:16px 0 4px; font-size:17px }
/* capul zilei: numele la stanga, iar duminica butonul foii cu sfintii zilei la dreapta
   (cerere user, 9 sept. 2026 — foaia se tipareste si se citeste la sfarsitul Liturghiei) */
.zi-cap { display:flex; align-items:baseline; justify-content:space-between; gap:12px }
.zi-cap h3 { flex:1 1 auto; min-width:0 }
.zi-cap .sfintii { flex:0 0 auto; align-self:center; display:inline-flex; align-items:center; gap:7px;
                   padding:7px 12px; white-space:nowrap;
                   font:600 11.5px/1 ui-sans-serif,system-ui; letter-spacing:.04em;
                   text-decoration:none; border-radius:8px }
/* iconita spune ce fel de fisier e; langa ea doar numele (cerere user, 9 sept. 2026) */
.zi-cap .sfintii svg { flex:none; vertical-align:0; color:var(--soft) }
.zi-cap .sfintii:hover svg { color:inherit }
.zi-cap .sfintii:hover { border-color:var(--rosu); color:var(--rosu) }
/* calendarul zilei de la A1: sta in pagina, dar ascuns — il aprinde „Informații utile" →
   „Afișează calendarul" (clasa cu-calendar pe body, tinuta minte in localStorage) */
.cal { display:none; margin:4px 0 10px; padding:8px 12px; background:var(--tinta);
       border-left:3px solid var(--rule); border-radius:0 8px 8px 0 }
body.cu-calendar .cal { display:block }
.cal-titlu { margin:0; font-size:15px; line-height:1.45 }
.cal-rand { margin:3px 0 0; font:13px/1.5 ui-sans-serif,system-ui; color:var(--soft) }
.cal .cr { color:var(--rosu); margin-right:3px }
.cal .c-albastru { color:var(--albastru) }
/* zilele in care nu se slujeste stau in pagina doar ca sa-si arate calendarul (cerere user, 9 sept.
   2026): se vad numai cand calendarul e aprins. Cat sunt ascunse, programul se incheie cu ultima zi
   CU slujbe — ea ramane fara linie dedesubt, fiindca .zi:last-child ar cadea pe o zi ascunsa. */
body:not(.cu-calendar) .zi.goala { display:none }
body:not(.cu-calendar) .zi.ultima { border-bottom:0 }
/* titlul zilei rosu duminica si la praznice / sfinti cu cruce rosie („Joi, 6 august"; user, 8 sept. 2026) */
.zi.rosie h3 { color:var(--rosu) }
.zi.azi h3::after { content:"azi"; font:600 9.5px/1 ui-sans-serif,system-ui; letter-spacing:.14em; text-transform:uppercase;
                    color:var(--ink); background:var(--azi-fund); border:1px solid var(--azi); border-radius:999px; padding:3px 7px; margin-left:10px; vertical-align:2px }
.slujba { display:grid; grid-template-columns:56px 1fr; column-gap:12px; margin:6px 0 }
.slujba .ora { font:600 15px/1.55 ui-sans-serif,system-ui; color:var(--soft); letter-spacing:.02em }
.slujba .nume { font-weight:600 }
.slujba .nume.dimineata { color:var(--rosu) }
.slujba .det { grid-column:2; margin:1px 0 0; font-size:14.5px; color:var(--soft); line-height:1.45 }
.slujba .det::before { content:"→ "; color:var(--faint) }
/* randurile „→" cu numele duminicii si cu sarbatorile cu rosu (praznice, sfinti cu cruce rosie, dupa A1):
   bold + rosu, ca in foaia A4 — si duminica (user, 8 sept. 2026) */
.slujba .det.rosu { font-weight:600; color:var(--rosu) }
.gol { color:var(--faint); font-style:italic }

/* arhiva */
/* butoanele cu anii: patratelele .capitole din carcasa, dar anul ALES ramane link (a.acum,
   nu b.acum ca la literele din A12) — userul vrea sa se poata apasa si cand e selectat (8 sept. 2026). */
.capitole a.acum { border-color:var(--rosu); color:var(--rosu); font-weight:600 }
.an h3 { margin:26px 0 6px }
/* capul de luna, deasupra batonului ei */
.an h4 { margin:18px 0 6px; font:600 11px/1 ui-sans-serif,system-ui;
         letter-spacing:.14em; text-transform:uppercase; color:var(--soft) }
/* saptamanile lunii: un BATON segmentat EGAL (user, 8 sept. 2026) — zone de latime egala, lipite,
   despartite de linii de 1px. Liniile sunt umbre pe zona (dreapta + jos), nu gap prin care se vede
   fundalul batonului: pe telefon randul se rupe (auto-fit face 2 coloane sub ~450 px) si ultima zona
   poate lasa un loc gol — cu fundal colorat ar iesi acolo un dreptunghi gri. Ce iese in afara
   (umbra ultimei coloane, a ultimului rand) taie overflow:hidden.
   In zona: perioada sus, numarul de slujbe dedesubt; starea doar cand NU e „validat". */
.baton { display:grid; grid-template-columns:repeat(auto-fit,minmax(128px,1fr));
         background:var(--paper); border:1px solid var(--rule); border-radius:10px; overflow:hidden }
.baton a { padding:9px 8px 10px; text-align:center; text-decoration:none; color:var(--ink);
           box-shadow:1px 0 0 var(--rule), 0 1px 0 var(--rule) }
.baton a:hover { background:var(--tinta); color:var(--rosu) }
.baton b { display:block; font-size:15.5px; font-weight:600; white-space:nowrap }
.baton span { display:block; margin-top:2px; font:12.5px ui-sans-serif,system-ui; color:var(--faint) }
.baton i { display:block; margin-top:4px; font:600 9px/1 ui-sans-serif,system-ui; font-style:normal;
           letter-spacing:.12em; text-transform:uppercase; color:var(--albastru) }

/* propunerea */
.nelamuriri { border-left:3px solid var(--rosu); padding:2px 0 2px 16px; margin:22px 0; color:var(--soft) }

/* foaia A4 de pe usa: doar programul, fara antet, subsol si navigare */
@media print {
  header.sus, .subsol-linie, .versiune, footer.subsol, .btns, .nav-jos, .zi-cap .sfintii,
  .zi.goala, .cine, .marunt, .nelamuriri { display:none !important }
  body { padding:0; font-size:14pt; color:#000; background:#fff }
  main { padding-top:0 }
  .w { max-width:none }
  .zi { break-inside:avoid; border-bottom:0; margin-bottom:10pt; padding-bottom:0 }
  .slujba .nume.dimineata, .slujba .det.rosu, .zi.rosie h3 { color:#000 }
  .stare { display:none }
}
`

/**
 * JS-ul paginilor de om (slotul `scripturi`): meniul „Informații utile" si comutatorul calendarului.
 * Scris ca JS-ul comun al carcasei — fara sageti, fara let/const — ca sa mearga si pe telefoanele vechi
 * ale enoriasilor. Alegerea „arata calendarul" se tine in localStorage, deci ramane de la o pagina la alta.
 */
export const SCRIPT = `
(function(){
  var CHEIE = "program_calendar";
  var buton = document.getElementById("b-calendar");
  function pune(pornit){
    document.body.classList.toggle("cu-calendar", pornit);
    if (buton) {
      buton.textContent = pornit ? "Ascunde calendarul" : "Afișează calendarul";
      buton.setAttribute("aria-pressed", pornit ? "true" : "false");
    }
  }
  var pornit = false;
  try { pornit = localStorage.getItem(CHEIE) === "1"; } catch (e) {}
  pune(pornit);
  if (buton) buton.addEventListener("click", function(){
    pornit = !pornit;
    pune(pornit);
    try { localStorage.setItem(CHEIE, pornit ? "1" : "0"); } catch (e) {}
    var meniu = buton.parentNode && buton.parentNode.parentNode;
    if (meniu && meniu.removeAttribute) meniu.removeAttribute("open");
  });
  // details nu se inchide singur la click in afara — ca meniul contului din carcasa
  document.addEventListener("click", function(e){
    var deschise = document.querySelectorAll("details.meniu-info[open]");
    for (var i = 0; i < deschise.length; i++) {
      if (!deschise[i].contains(e.target)) deschise[i].removeAttribute("open");
    }
  });
})();
`

// ---------------------------------------------------------------------------
// Bucati comune
// ---------------------------------------------------------------------------

function contDin(ctx: Ctx) {
  return {
    intrat: !!ctx.utilizator,
    nume: ctx.utilizator ?? 'Cont',
    admin: ctx.eAdmin,
    urlCont: ctx.nav.cont,
    urlAdmin: ctx.nav.admin,
    poateVedeaCa: ctx.poateVedeaCa ?? false,
    veziCa: ctx.veziCa ?? null,
    spre: ctx.spre ?? '',
  }
}

function comune(ctx: Ctx) {
  return {
    nume: 'PROGRAMUL',
    titlu: 'Programul liturgic',
    acasa: `${ctx.prefix}/`,
    urlPlatforma: ctx.nav.home || '/',
    local: STIL,
    cont: contDin(ctx),
    versiune: ctx.versiune,
    modificata: ctx.modificata,
  }
}

/**
 * ABONAREA — randul din antet (`.btns` al carcasei), de la 9 sept. 2026 (cerere user).
 *
 * Fara cont: butonul „Abonează-te" (duce la intrare) si vorba care lamureste de ce — trebuie cont.
 * Cu cont: in V1 era un camp de e-mail cu butonul dupa el; in V2 adresa e a contului, deci ramane
 * butonul (Abonează-te / Dezabonează-te, dupa cum e omul pe lista) si, in locul campului, vorba —
 * sau vestea de dupa apasare.
 */
function abonarea(ctx: Ctx, m: Meniu): string {
  if (!ctx.utilizator) {
    return `<a class="btn abon-btn" href="${esc(ctx.nav.cont)}/auth/login">Abonează-te</a>`
      + `<span class="abon-vorba">Ca să primești programul pe e-mail trebuie să-ți faci cont.</span>`
  }
  const vorba = m.veste
    ? `<span class="abon-vorba ${m.veste.fel}">${esc(m.veste.text)}</span>`
    : m.abonat
      ? `<span class="abon-vorba">Primești programul pe e-mail.</span>`
      : `<span class="abon-vorba">Programul vine pe e-mailul contului.</span>`
  return `<form class="abon" method="post" action="${esc(ctx.prefix)}/${m.abonat ? 'dezabonare' : 'abonare'}">
      <input type="hidden" name="spre" value="${esc(m.spre ?? `${ctx.prefix}/`)}">
      <button class="btn abon-btn" type="submit">${m.abonat ? 'Dezabonează-te' : 'Abonează-te'}</button>${vorba}
    </form>`
}

/**
 * „Informații utile" — butonul din capatul randului de abonare, despartit de el printr-o liniuta
 * verticala (cerere user, 9 sept. 2026). Deschide un meniu mic, ca meniul contului din carcasa: un
 * `<details>`, deci merge si fara JS; JS-ul local il inchide la click in afara si tine minte alegerea.
 * Deocamdata are o singura functie — arata calendarul zilei (sfintii, numele duminicii), ascuns de pe pagini.
 */
function informatii(): string {
  return `<details class="meniu-info">
      <summary class="btn mic">Informații <span class="cuv">utile</span></summary>
      <nav class="info-lista">
        <button type="button" class="info-rand" id="b-calendar" aria-pressed="false">Afișează calendarul</button>
      </nav>
    </details>`
}

/** Randul din antet: abonarea, o liniuta verticala si meniul „Informații utile". */
function unelte(ctx: Ctx, m: Meniu): string {
  return abonarea(ctx, m) + `<span class="desparte" aria-hidden="true"></span>` + informatii()
}

/**
 * NAVIGAREA — sub linia antetului, intr-o casuta centrata, lipita de linie, cu colturile de sus drepte
 * si cele de jos rotunde (cerere user, 9 sept. 2026). Casuta atarna de antet (`position:absolute` in
 * `.sus`, care e sticky), deci merge cu el la derulare. Inauntru: sageata dinainte / bulina / sageata
 * urmatoarea, o bara despartitoare, apoi butoanele mici ale saptamanii din context: Arhiva (doar
 * iconita) si hartiile ei — PDF de tiparit, JPG de trimis pe WhatsApp.
 *
 * Sirul e deschis doar INAPOI: inainte se merge un singur pas, pana la saptamana viitoare, iar acolo
 * sageata ramane stinsa (user, 9 sept. 2026 — o singura propunere; limita se pune in index.ts). Bulina
 * din mijloc n-are text (user, 8 sept. 2026), duce la saptamana de azi si ramane APASATA cand chiar pe
 * ea esti — ca butonul Arhivei cand esti pe Arhiva.
 */
function navJos(ctx: Ctx, m: Meniu): string {
  const p = esc(ctx.prefix)
  const sageata = (l: string | null, text: string, deCe = '') =>
    l ? `<a class="btn" href="${p}/saptamana/${l}">${text}</a>`
      : `<span class="btn gol"${deCe ? ` title="${deCe}"` : ''}>${text}</span>`
  const hartie = (ext: 'pdf' | 'jpg', titlu: string) => (m.foaie
    ? `<a class="btn mic" href="${p}${m.foaie}.${ext}" target="_blank" rel="noopener" title="${titlu}">${ext.toUpperCase()}</a>`
    : `<span class="btn mic gol" title="Foaia se deschide de pe pagina unei săptămâni cu program validat">${ext.toUpperCase()}</span>`)
  return `<nav class="nav-jos"><div class="btns cutie">`
    + sageata(m.vecini.inainte, `◀ <span class="cuv">săptămâna dinainte</span>`)
    + `<a class="btn punct${m.acum ? ' activ' : ''}" href="${p}/saptamana/${esc(m.azi)}" title="săptămâna de azi" aria-label="săptămâna de azi"></a>`
    + sageata(m.vecini.dupa, `<span class="cuv">săptămâna următoare</span> ▶`, 'Înainte se vede o singură săptămână — cea viitoare, cu propunerea ei')
    + `<span class="desparte" aria-hidden="true"></span>`
    + `<a class="btn mic${m.arhiva ? ' activ' : ''}" href="${p}/arhiva" title="Arhiva programelor" aria-label="Arhiva programelor">${IC_ARHIVA}</a>`
    + hartie('pdf', 'Foaia A4, de tipărit')
    + hartie('jpg', 'Foaia ca poză, de trimis pe WhatsApp')
    + `</div></nav>`
}

/** Antetul intreg al paginilor de om: randul de unelte, casuta de navigare, JS-ul lor. */
function antetul(ctx: Ctx, m: Meniu) {
  return { unelte: unelte(ctx, m), subantet: navJos(ctx, m), scripturi: SCRIPT }
}

/** „Luni, 7 septembrie" — cu majuscula, ca in V1. */
function numeleZilei(data: string): string {
  const [, l, z] = data.split('-').map(Number) as [number, number, number]
  const zi = ZILE_SAPTAMANA[ziuaSaptamanii(data)] ?? ''
  return `${zi.charAt(0).toUpperCase()}${zi.slice(1)}, ${z} ${LUNI[l - 1] ?? ''}`
}

/**
 * Butonul de la duminica, aliniat la dreapta numelui zilei (cerere user, 9 sept. 2026): foaia cu sfintii
 * zilei, de tiparit — se citeste la sfarsitul Sfintei Liturghii. Scrie „[iconita de hartie] Sfinții zilei":
 * ce fel de fisier e spune iconita, nu inca trei cuvinte langa numele zilei.
 */
const butonSfintii = (ctx: Ctx, data: string) =>
  `<a class="btn sfintii" href="${esc(ctx.prefix)}/v1/sfintii-zilei/${data}.pdf" target="_blank" rel="noopener"`
  + ` title="Sfinții zilei, fișier PDF — de tipărit și citit la sfârșitul Sfintei Liturghii">`
  + `${ICOANE.foaie}<span>Sfinții zilei</span></a>`

/**
 * Calendarul zilei de la A1, sub numele zilei: TITLUL zilei asa cum il da calendarul (`titlu_html`, gata
 * asezat). Sta MEREU in pagina, dar ascuns de stil; se aprinde din meniul „Informații utile" →
 * „Afișează calendarul". Pe randul de sub titlu: notele calendarului (rare) si semnul ca ziua e
 * imprumutata dintr-un an de reper — acela nu se ascunde, ca sa nu treaca o zi aproximativa drept sigura.
 */
function calendarulZilei(z: ZiPeProgram | undefined): string {
  if (!z) return ''
  const rand = [
    ...(z.note ?? []).map(esc),
    z.aproximativ ? `<i>calendar împrumutat din anul curent — aproximativ</i>` : '',
  ].filter(Boolean).join(' · ')
  return `<div class="cal">
  <p class="cal-titlu">${z.titlu_html || esc(z.titlu)}</p>
  ${rand ? `<p class="cal-rand">${rand}</p>` : ''}
</div>`
}

/** O slujba: ora, numele (colorat dupa categorie), randurile „→" (rosii la duminica si la sarbatorile cu rosu). */
function slujbaHtml(s: Slujba, vocabular: Map<string, IntrareVocabular>, zi: ZiPeProgram | undefined, maine: ZiPeProgram | undefined, dinCalendar: boolean, granita: string): string {
  const categorie = vocabular.get(s.cod_nume)?.categorie
  const randuri = randurileSlujbei(s, categorie, zi, maine, dinCalendar, granita)
  const det = randuri.map((r) => `<p class="det${r.rosu ? ' rosu' : ''}">${esc(r.text)}</p>`).join('')
  const slujitor = s.slujitor ? `<p class="det">${esc(s.slujitor)}</p>` : ''
  return `<div class="slujba"><span class="ora">${esc(s.ora)}</span><span class="nume ${esc(categorie ?? 'alte')}">${esc(s.nume)}</span>${det}${slujitor}</div>`
}

/**
 * O zi din program: capul zilei (numele; duminica si butonul „Sfinții zilei"), calendarul ascuns, slujbele.
 * Ziua e rosie duminica si la praznice / sfinti cu cruce rosie, dupa rangul de la calendar. Ziua fara
 * nicio slujba (`goala`) sta in pagina doar ca sa-si arate calendarul; `ultima` = ultima zi CU slujbe,
 * care incheie programul cand calendarul e stins.
 */
function ziuaHtml(o: {
  ctx: Ctx
  data: string
  slujbe: Slujba[]
  vocabular: Map<string, IntrareVocabular>
  cal: CalendarSaptamana | null
  dinCalendar: boolean
  granita: string
  azi: string
  ultima: boolean
}): string {
  const z = o.cal?.zile.get(o.data)
  const maine = o.cal?.zile.get(adaugaZile(o.data, 1))
  const zs = ziuaSaptamanii(o.data)
  const duminica = zs === 0
  const clase = ['zi', o.data === o.azi ? 'azi' : '', duminica || (z && ziRosie(z)) ? 'rosie' : '',
    o.slujbe.length ? '' : 'goala', o.ultima ? 'ultima' : ''].filter(Boolean).join(' ')
  const randuri = o.slujbe.map((s) => slujbaHtml(s, o.vocabular, z, maine, o.dinCalendar, o.granita)).join('\n')
  return `<section class="${clase}" id="z${o.data}">
  <div class="zi-cap"><h3>${numeleZilei(o.data)}</h3>${duminica ? butonSfintii(o.ctx, o.data) : ''}</div>
  ${calendarulZilei(z)}
  ${randuri}
</section>`
}

// ---------------------------------------------------------------------------
// Pagina saptamanii — programul scris sau propunerea lui, aceeasi asezare
// ---------------------------------------------------------------------------

export interface OptiuniSaptamana {
  ctx: Ctx
  luni: string
  titlu: string
  stare: StareSaptamana | 'propunere'
  slujbe: Slujba[]
  vocabular: Map<string, IntrareVocabular>
  cal: CalendarSaptamana | null
  dinCalendar: boolean
  azi: string
  meniu: Meniu
  nelamuriri?: string[]
}

export function paginaSaptamana(o: OptiuniSaptamana): string {
  const duminica = adaugaZile(o.luni, 6)
  const cuSlujbe = new Set(o.slujbe.map((s) => s.data))
  const ultima = [...cuSlujbe].sort().pop() ?? null
  const zile: string[] = []
  for (let i = 0; i < 7; i++) {
    const data = adaugaZile(o.luni, i)
    const ale = o.slujbe.filter((s) => s.data === data)
    // o zi goala care n-are nici calendar nu se scrie deloc — n-ar avea ce arata
    if (!ale.length && !o.cal?.zile.get(data)) continue
    zile.push(ziuaHtml({ ctx: o.ctx, data, slujbe: ale, vocabular: o.vocabular, cal: o.cal, dinCalendar: o.dinCalendar, granita: duminica, azi: o.azi, ultima: data === ultima }))
  }
  const clasaStare = o.stare === 'propunere' ? 'propus' : o.stare
  const cap = `<div class="sapt-cap"><h2>${esc(o.titlu)}</h2><span class="stare ${esc(clasaStare)}">${esc(STARE[o.stare] ?? o.stare)}</span></div>`
  const gol = o.slujbe.length ? '' : `<p class="gol">${o.stare === 'propunere' ? 'Nimic de propus — istoricul nu spune nimic despre această săptămână.' : 'Săptămână fără slujbe înregistrate.'}</p>`
  const nelamuriri = o.nelamuriri?.length
    ? `<div class="nelamuriri"><b>Nelămuriri</b><ul>${o.nelamuriri.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`
    : ''
  const meniu: Meniu = { ...o.meniu, acum: o.luni === luneaSaptamanii(o.azi) }
  return pagina({
    ...comune(o.ctx),
    titluPagina: o.stare === 'propunere' ? `Propunere · ${o.titlu}` : o.titlu,
    indexabil: true,
    ...antetul(o.ctx, meniu),
    corp: `${cap}${gol}${zile.join('\n')}
${nelamuriri}`,
  })
}

// ---------------------------------------------------------------------------
// Arhiva: un singur an pe ecran, saptamanile grupate pe luni, luna = baton segmentat egal
// ---------------------------------------------------------------------------

export interface RezumatArhiva {
  luni: string
  duminica: string
  stare: StareSaptamana
  nr_slujbe: number
}

export function perioadaScurta(luni: string, duminica: string): string {
  const [, l1, z1] = luni.split('-').map(Number) as [number, number, number]
  const [, l2, z2] = duminica.split('-').map(Number) as [number, number, number]
  if (l1 === l2) return `${z1} – ${z2}`
  return intervalLizibil(luni, duminica).replace(/\s\d{4}$/, '')
}

export function paginaArhiva(o: { ctx: Ctx; an: number; ani: number[]; saptamani: RezumatArhiva[]; total: number; deLa: string | null; meniu: Meniu }): string {
  const p = esc(o.ctx.prefix)
  // anii DESCRESCATOR (cel de care e nevoie mereu, primul); anul ales ramane link (a.acum), se poate apasa
  const butoane = o.ani.length ? `<nav class="capitole">${o.ani.map((a) => `<a${a === o.an ? ' class="acum"' : ''} href="?an=${a}">${a}</a>`).join('')}</nav>` : ''
  const peLuni = new Map<number, RezumatArhiva[]>()
  for (const s of [...o.saptamani].sort((a, b) => a.luni.localeCompare(b.luni))) {
    const l = Number(s.luni.slice(5, 7))
    const lista = peLuni.get(l) ?? []
    lista.push(s)
    peLuni.set(l, lista)
  }
  // lunile de la cea mai noua; in baton saptamanile merg INAINTE (3–9, 10–16, …), ca o fasie de calendar
  const luni = [...peLuni.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([l, lista]) => {
      const nume = LUNI[l - 1] ?? ''
      const zone = lista
        .map((s) => `<a href="${p}/saptamana/${s.luni}"><b>${esc(perioadaScurta(s.luni, s.duminica))}</b>`
          + `<span>${s.nr_slujbe} ${s.nr_slujbe === 1 ? 'slujbă' : 'slujbe'}</span>`
          + (s.stare === 'validat' ? '' : `<i>${esc(STARE[s.stare] ?? s.stare)}</i>`) + `</a>`)
        .join('')
      return `<h4>${nume.charAt(0).toUpperCase()}${nume.slice(1)}</h4><div class="baton">${zone}</div>`
    })
    .join('\n')
  const bloc = `<section class="an"><h3>${o.an} <small>· ${o.saptamani.length} săptămâni</small></h3>
${luni || '<p class="gol">Niciun program în anul acesta.</p>'}</section>`
  return pagina({
    ...comune(o.ctx),
    titluPagina: 'Arhiva',
    ...antetul(o.ctx, { ...o.meniu, arhiva: true }),
    corp: `<h2>Arhiva programelor</h2>
<p class="marunt">${o.total} săptămâni, din ${o.deLa ? esc(o.deLa.slice(0, 4)) : '—'} până azi. Importate din site-ul vechi; se completează de aici înainte.</p>
${butoane}
${bloc}`,
  })
}

/**
 * Pagina de mesaj (adresa gresita, refuz, eroare). Cu `meniu`, poarta antetul intreg al paginilor de om,
 * ca in V1; fara `mesaj`, ramane doar titlul si cele doua linkuri (pagina „Nu există", ca in V1).
 */
export function paginaMesaj(ctx: Ctx, titlu: string, mesaj: string, fel: 'rea' | 'buna' | 'info' = 'info', meniu?: Meniu): string {
  return pagina({
    ...comune(ctx),
    titluPagina: titlu,
    ...(meniu ? antetul(ctx, meniu) : {}),
    corp: `<h2>${esc(titlu)}</h2>${mesaj ? alerta(fel, esc(mesaj)) : ''}<p><a href="${esc(ctx.prefix)}/">Programul săptămânii</a> · <a href="${esc(ctx.prefix)}/arhiva">Arhiva</a></p>`,
  })
}
