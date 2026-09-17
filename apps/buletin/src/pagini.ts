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
 *
 * ⚠️ MENIUL DIN ANTET, REFACUT LA 17.09.2026 DUPA CHIPUL CALENDARULUI, AL PROGRAMULUI SI AL
 * NEWSLETTERULUI (user: „să aranjăm meniul principal cum am făcut la Calendar și Programul
 * liturgic"). Randul de unelte are acum O PASTILA cat tot randul si, singura afara la DREAPTA,
 * ABONAREA. Asezarea V1 — abonarea intai, o liniuta despartitoare, apoi Arhiva si lupa — a cazut
 * toata, cu tot cu formularul de cautare scris sub antet.
 *
 *   PASTILA, in ordinea ceruta:
 *     1. BULINA numarului curent, prima — duce mereu la numarul de duminica asta;
 *     2. ZONA DE SCRIS: „Buletinul nr. 615" pe cel curent, data lui pe unul din arhiva, iar pe
 *        paginile care nu tin de un numar anume — „Arhiva", „Căutare", „Buletin nou";
 *     3. SAGEATA-DREAPTA — BULETINUL NOU (vezi mai jos);
 *     4. ARHIVA — cheie care coboara fasia anilor, ca la Program;
 *     5. LUPA — cheie care coboara bara cautarii, ca la Calendar.
 *
 * ⚠️ SAGEATA NU E O NAVIGARE, E O FAPTA (aceeasi regula ca la A8): duce la `/nou`, ecranul
 * buletinului care URMEAZA sa apara. Fiind o fapta de admin, se scrie NUMAI pentru admini —
 * enoriasul ramane cu bulina, scrisul, Arhiva si lupa.
 * ⚠️ Sagetile „◀ numărul dinainte / numărul următor ▶" de sub un numar AU IESIT si ele (user,
 * 17.09.2026, seara) — inapoi se merge prin Arhiva, ca la A8. Ce a iesit inainte e randul vechi de unelte.
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
  /** pagina deschisa e „Buletin nou" (sageata ramane aprinsa) */
  nou?: boolean
  /** numarul de pe ecran, pentru zona de scris; `null` pe paginile care nu tin de unul (arhiva, cautarea) */
  peEcran?: { nr: number; data: string } | null
  /** numarul de pe ecran e chiar cel curent — bulina ramane apasata si scrisul spune numarul lui */
  acum?: boolean
  /** arhiva n-are niciun numar: bulina se stinge, nu dispare (randul nu joaca de la o pagina la alta) */
  gol?: boolean
  /** pagina deschisa e Arhiva (butonul ei ramane aprins) */
  arhiva?: boolean
  /** `null` = bara cautarii sta inchisa; sir (chiar gol) = e coborata de la server, cu ce s-a cautat in ea */
  q?: string | null
  /**
   * ANII ARHIVEI, descrescator — fasia care coboara din cheia Arhivei, ca la Program si la A8.
   * ⚠️ GOL INSEAMNA „fara bara": atunci segmentul Arhivei ramane LINKUL catre /arhiva — o cheie care
   * ar cobori o fasie goala n-ar face nimic la apasare.
   */
  ani?: string[]
  /** anul deschis in arhiva, marcat rosu in fasie */
  anDeschis?: string
  /** vestea de dupa `POST /abonare` (`?abonat=1|2|0`) */
  veste?: 'inscris' | 'scos' | 'eroare' | null
}

/** Iconita Arhivei: cutie cu capac — aceeasi ca in V1 (venita acolo din A2). */
const IC_ARHIVA = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>`

/* Sageata sta SINGURA in buton, fara niciun invelis — lectia platita la Program pe 15.09.2026: un
   invelis e copil flexibil, deci cutia lui e o linie de scris, iar desenul ramane pe linia de baza
   si iese cu vreo doi pixeli mai sus decat vecinii. */
const IC_INAINTE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12h14"/><path d="m12.5 6 6 6-6 6"/></svg>`

/** Iconita hartiei de tipar: foaie cu coltul indoit — din V1; a ramas la numerele fara PDF. */
const IC_PDF = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>`

/** Săgeata in jos spre o talpa: semnul descarcarii, acelasi desen ca peste tot pe internet. */
const IC_DESCARCA = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 19h16"/></svg>`

/** Imprimanta: foaia care intra sus, hartia care iese jos. */
const IC_TIPAR = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 8V3h10v5"/><path d="M5 8h14a2 2 0 0 1 2 2v6h-4"/><path d="M5 16H3v-6a2 2 0 0 1 2-2"/><rect x="7" y="14" width="10" height="7" rx="1"/></svg>`

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

/** „6 sept. 2026" — scrisul din pastila pe numerele care nu sunt cel curent, la ecrane mici. */
const dataScurta = (data: string): string => `${ziuaScurt(data)} ${data.slice(0, 4)}`

/**
 * ZONA DE SCRIS din pastila — pe ce numar esti, in cuvinte. Ca la Calendar, la Program si la A8, ea
 * ia tot spatiul ramas, iar butoanele de langa stau la masura lor fixa: scrisul e lucrul dupa care se
 * uita omul intai, deci nu se strange el primul.
 *
 * Cinci feluri, dupa ce arata pagina:
 *   - numarul curent (si prima pagina) → „Buletinul nr. 615";
 *   - un numar din arhiva             → data lui („6 septembrie 2026");
 *   - pagina Arhivei                  → „Arhiva";
 *   - ecranul buletinului nou         → „Buletin nou";
 *   - pagina cautarii                 → „Căutare".
 *
 * ⚠️ NU SE PRESCURTEAZA CE INCAPE (regula lui A8, 15.09.2026): „Buletin nou" ramane intreg la orice
 * latime, iar pe numarul curent scrie CHIAR numarul lui, nu un generic „Curent". Forma scurta se
 * scrie ALATURI de cea lunga si se alege din CSS; cand cele doua sunt la fel, scrisul nu se schimba.
 * ⚠️ NU e un buton: nu duce nicaieri si nu se apasa (vezi `.acum` din `stil.ts`, fundal de hartie).
 */
function scrisulNumarului(m: Meniu): string {
  const zona = (lung: string, scurt: string, titlu: string) =>
    `<span class="acum" title="${esc(titlu)}"><b class="lung">${esc(lung)}</b><b class="scurt">${esc(scurt)}</b></span>`
  if (m.nou) return zona('Buletin nou', 'Buletin nou', 'Buletinul care urmează să apară')
  if (m.arhiva) return zona('Arhiva', 'Arhiva', 'Arhiva buletinelor')
  if (!m.peEcran) return zona('Căutare', 'Căutare', 'Căutare în buletine')
  const b = m.peEcran
  if (m.acum) {
    return zona(`Buletinul nr. ${b.nr}`, `Buletinul nr. ${b.nr}`, `Numărul curent — ${dataLunga(b.data)}`)
  }
  return zona(dataLunga(b.data), dataScurta(b.data), `Numărul ${b.nr}`)
}

/**
 * PASTILA NAVIGARII — cele cinci segmente, in ordinea ceruta de user (17.09.2026): bulina · zona de
 * scris · sageata („buletin nou") · Arhiva · lupa. Segmentele stau lipite intr-un singur corp, ca sa
 * se citeasca drept UN obiect cu o pozitie, nu cinci destinatii deosebite.
 *
 * ⚠️ BULINA n-are text si duce INTOTDEAUNA la numarul curent, de oriunde ai fi — adica la prima
 * pagina, care chiar el este; ramane apasata (rosie, inerta) cand esti pe el. Numele ei se citeste
 * din `title` si `aria-label`.
 * ⚠️ SAGEATA E O FAPTA, NU O NAVIGARE: duce la ecranul buletinului nou. Numai pentru admini.
 */
function pastilaNumarului(ctx: Ctx, m: Meniu): string {
  const p = esc(ctx.prefix)
  const bulina = m.gol
    ? `<span class="btn punct gol" title="Arhiva e goală" aria-label="numărul curent"></span>`
    : m.acum
      ? `<button type="button" class="btn punct activ" aria-disabled="true" aria-current="page"`
        + ` title="Ești pe numărul curent" aria-label="numărul curent"></button>`
      : `<a class="btn punct" href="${p}/" title="Treci la numărul curent"`
        + ` aria-label="numărul curent"></a>`
  const sageata = !ctx.eAdmin
    ? ''
    : m.nou
      ? `<button type="button" class="btn viit activ" aria-disabled="true" aria-current="page"`
        + ` title="Ești pe buletinul nou" aria-label="buletin nou">${IC_INAINTE}</button>`
      : `<a class="btn viit" href="${p}/nou" title="Buletin nou — numărul care urmează"`
        + ` aria-label="Buletin nou — numărul care urmează">${IC_INAINTE}</a>`
  /*
   * ⚠️ CHEIA ARHIVEI, ca la Program si la A8: iconita nu mai duce dintr-o apasare la /arhiva, ci
   * COBOARA FASIA ANILOR de sub rand (`baraAnilor`). Drumul la arhiva a ramas intreg — trece
   * printr-un an.
   * ⚠️ PE PAGINA ARHIVEI cheia nu mai e cheie, ci semn al locului: fasia e coborata permanent, deci
   * segmentul se scrie INERT, iar JS-ul nu-i mai pune ascultatorul. Altfel omul ar putea strange
   * singurul drum ramas catre ceilalti ani.
   * ⚠️ Fara ani (pagini care n-au lista) ramane LINKUL de pana acum: butonul nu se ascunde niciodata.
   */
  const arhiva = !m.ani?.length
    ? `<a class="btn arh${m.arhiva ? ' activ' : ''}" href="${p}/arhiva"`
      + ` title="Arhiva pe ani și luni" aria-label="Arhiva buletinelor">${IC_ARHIVA}</a>`
    : `<button type="button" class="btn arh${m.arhiva ? ' activ' : ''}" id="ani-cheie"`
      + ` aria-expanded="${m.arhiva ? 'true' : 'false'}" aria-controls="bara-ani"`
      + (m.arhiva ? ' aria-disabled="true" aria-current="page"' : '')
      + ` title="${m.arhiva ? 'Ești în arhivă — alege anul din bara de dedesubt' : 'Arhiva buletinelor — alege anul'}"`
      + ` aria-label="Arhiva buletinelor — alege anul">${IC_ARHIVA}</button>`
  /* LUPA e o CHEIE, ca la Calendar: coboara bara cautarii de sub antet, nu duce nicaieri singura.
     Fara JavaScript ramane butonul care e — atunci bara se deschide de la server, pe /cauta. */
  const lupa = `<button type="button" class="btn cheie" id="cautare-cheie" aria-controls="bara-cautare"`
    + ` aria-expanded="${m.q === null || m.q === undefined ? 'false' : 'true'}" title="Caută în buletine"`
    + ` aria-label="Caută în buletine">${ICOANE.lupa}</button>`
  return `<span class="pastila">${bulina}${scrisulNumarului(m)}${sageata}${arhiva}${lupa}</span>`
}

/** Randul de unelte: pastila cat tot randul si, singura afara la dreapta, abonarea. */
function unelte(ctx: Ctx, m: Meniu): string {
  return pastilaNumarului(ctx, m) + butonAbonare(ABONAMENT)
}

/**
 * BARA ANILOR — sub randul de unelte, ascunsa pana se apasa cheia Arhivei, coborata din capul
 * locului pe pagina Arhivei. Aceeasi unealta ca `baraAnilor` din Program si ca fasia lunilor din
 * Calendar: aceeasi fasie derulabila, aceleasi sageti ‹ › scrise de JS numai daca e ceva de derulat,
 * acelasi chenar de pastila, ca aplicatiile sa se recunoasca intre ele.
 *
 * ⚠️ ANII VIN DIN ARHIVA, descrescator — nu se scrie niciun an in cod.
 * ⚠️ `hidden` il scrie SERVERUL, la fiecare pagina: fasia se strange singura dupa ce omul alege un an,
 * fara nicio linie de JS — alegerea e o navigare, iar pagina urmatoare se naste cu bara sus.
 */
function baraAnilor(ctx: Ctx, m: Meniu): string {
  if (!m.ani?.length) return ''
  const p = esc(ctx.prefix)
  const butoane = m.ani
    .map((a) => {
      const activ = m.arhiva && m.anDeschis === a ? ' activ' : ''
      return `<a class="an-buton${activ}" href="${p}/arhiva?an=${esc(a)}" data-an="${esc(a)}"`
        + `${activ ? ' aria-current="page"' : ''}>${esc(a)}</a>`
    })
    .join('')
  return `<div class="bara-ani" id="bara-ani"${m.arhiva ? '' : ' hidden'}><div class="fasie">`
    + `<nav class="ani" aria-label="Anii arhivei">${butoane}</nav></div></div>`
}

/**
 * BARA CAUTARII — sora fasiei anilor, sub randul de unelte, ascunsa pana se apasa lupa din pastila.
 *
 * ⚠️ E un FORMULAR adevarat, `method="get"`: cautarea merge si fara JavaScript, iar rezultatul are
 * adresa (`/cauta?q=…`), deci se poate da mai departe. JS-ul adauga doar coborarea barei si focusul.
 * ⚠️ Pe pagina rezultatelor bara se naste DESCHISA, cu intrebarea scrisa in camp — altfel omul n-ar
 * mai vedea ce a cautat. Textul din camp e cel din V1.
 */
function baraCautarii(ctx: Ctx, m: Meniu): string {
  const p = esc(ctx.prefix)
  const inchisa = m.q === null || m.q === undefined
  return `<div class="bara-cautare" id="bara-cautare"${inchisa ? ' hidden' : ''}>
      <form class="cauta" role="search" method="get" action="${p}/cauta">
        <input class="cauta-camp" type="search" name="q" value="${esc(m.q ?? '')}"
          placeholder="un cuvânt din buletin, sau numărul lui" aria-label="Caută în buletine" autocomplete="off">
        <button class="cauta-du" type="submit" title="Caută" aria-label="Caută">${ICOANE.lupa}</button>
      </form>
    </div>`
}

/**
 * CELE DOUA BARE care coboara din pastila — anii si cautarea — si care SE EXCLUD (regula
 * Calendarului): doua bare deschise una peste alta ar impinge pagina cu vreo 100 px si n-ar spune
 * nimic in plus, deci fiecare cheie o coboara pe a ei si o ridica pe cealalta.
 *
 * Anul deschis vine la MIJLOCUL fasiei, dar numai DUPA ce bara e la vedere (cat timp e ascunsa,
 * offsetLeft si clientWidth sunt 0 si fasia s-ar deschide derulata la cap), iar sagetile ‹ › se scriu
 * doar daca anii chiar nu incap.
 *
 * ⚠️ Fara accent grav in comentariile de aici: scripturile sunt template literals.
 */
const JS_BARE = `
(function(){
  var bCauta=document.getElementById("bara-cautare"),cCauta=document.getElementById("cautare-cheie");
  var bAni=document.getElementById("bara-ani"),cAni=document.getElementById("ani-cheie");
  var fasie=bAni?bAni.querySelector(".fasie"):null;

  function ridica(b,c){ if(!b||b.hidden) return; b.hidden=true; if(c) c.setAttribute("aria-expanded","false"); }

  function aseaza(){
    if(!fasie) return;
    var deschis=fasie.querySelector(".an-buton.activ");
    if(deschis) fasie.scrollLeft=deschis.offsetLeft-(fasie.clientWidth-deschis.offsetWidth)/2;
  }
  var capete=function(){};
  if(bAni&&fasie){
    var sageti=["\\u2039","\\u203a"].map(function(semn,i){
      var b=document.createElement("button");
      b.type="button"; b.className="sageata"; b.textContent=semn;
      b.setAttribute("aria-label", i?"anii următori":"anii dinainte");
      b.addEventListener("click",function(){
        fasie.scrollBy({left:(i?1:-1)*Math.max(120,fasie.clientWidth*0.6),behavior:"smooth"});
      });
      return b;
    });
    capete=function(){
      var incap=fasie.scrollWidth<=fasie.clientWidth+2;
      sageti[0].hidden=incap; sageti[1].hidden=incap;
      sageti[0].disabled=fasie.scrollLeft<2;
      sageti[1].disabled=fasie.scrollLeft>fasie.scrollWidth-fasie.clientWidth-2;
    };
    bAni.insertBefore(sageti[0],fasie);
    fasie.insertAdjacentElement("afterend",sageti[1]);
    fasie.addEventListener("scroll",capete,{passive:true});
    window.addEventListener("resize",capete);
    // pe pagina Arhivei bara vine coborata de la server: latimile sunt reale, deci se aseaza acum
    if(!bAni.hidden) aseaza();
    capete();
  }

  if(cCauta&&bCauta) cCauta.addEventListener("click",function(){
    var deschisa=!bCauta.hidden;
    bCauta.hidden=deschisa;
    cCauta.setAttribute("aria-expanded",deschisa?"false":"true");
    if(!deschisa){ ridica(bAni,cAni); var c=bCauta.querySelector("input"); if(c) c.focus(); }
  });

  // ⚠️ pe pagina Arhivei cheia e scrisa inerta: n-are ce inchide, fasia e coborata de-a binelea
  if(cAni&&bAni&&cAni.getAttribute("aria-disabled")!=="true") cAni.addEventListener("click",function(){
    var deschisa=!bAni.hidden;
    bAni.hidden=deschisa;
    cAni.setAttribute("aria-expanded",deschisa?"false":"true");
    if(!deschisa){ ridica(bCauta,cCauta); aseaza(); capete(); }
  });
})();`

/** Vestea de dupa abonare, sub antet — ruta exista, fereastra inca nu trimite nimic spre ea. */
function vesteaAbonarii(m: Meniu): string {
  if (m.veste === 'inscris') return `<p class="veste bine">Gata, te-am trecut pe listă.</p>`
  if (m.veste === 'scos') return `<p class="veste bine">Te-am scos de pe listă.</p>`
  if (m.veste === 'eroare') return `<p class="veste rau">Nu s-a putut. Încearcă din nou.</p>`
  return ''
}

/**
 * INTRERUPATORUL „Revers" de langa Tipărește: aprins, adresa brosurii capata `?revers=1`; stins, o
 * pierde. Alegerea ramane in localStorage (`buletin_revers`) — e a imprimantei omului, nu a numarului,
 * deci trebuie sa-l astepte si saptamana viitoare. Porneste STINS; fara JS butonul nu face nimic, iar
 * brosura iese cea obisnuita. ES5 dinadins, ca tot JS-ul de aici.
 */
const JS_REVERS = `
(function(){
  var CHEIE = "buletin_revers";
  var b = document.getElementById("b-revers"), t = document.getElementById("b-tipareste");
  if (!b || !t) return;
  var baza = t.getAttribute("href").replace(/\\?revers=1$/, "");
  function pune(pornit){
    b.setAttribute("aria-pressed", pornit ? "true" : "false");
    t.setAttribute("href", pornit ? baza + "?revers=1" : baza);
  }
  var pornit = false;
  try { pornit = localStorage.getItem(CHEIE) === "1"; } catch (e) {}
  pune(pornit);
  b.addEventListener("click", function(){
    pornit = !pornit;
    pune(pornit);
    try { localStorage.setItem(CHEIE, pornit ? "1" : "0"); } catch (e) {}
  });
})();
`

/** JS-ul paginilor: rasfoitul. Cele doua bare care coboara din pastila — anii si cautarea — sunt in
 *  `JS_BARE`, langa ele. Scris fara sageti si fara let/const, ca JS-ul carcasei — telefoanele vechi
 *  ale enoriasilor il citesc si pe acela. */
const JS_PAGINI = `
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
    // Fereastra de abonare e un <dialog>: se deschide peste pagina, deci locul ei aici nu conteaza,
    // numai sa fie scrisa o data. Barele, insa, trebuie sa stea CHIAR sub randul de unelte.
    subantet: `${baraAnilor(ctx, m)}\n    ${baraCautarii(ctx, m)}\n    ${fereastraBuletinului(ctx)}`,
    corp: `${vesteaAbonarii(m)}${corp}`,
    scripturi: JS_BARE + JS_REVERS + JS_PAGINI + JS_ABONARE,
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
 * BUTOANELE de sub coperta: **Descarcă** și **Tipărește** (cerere user, 17.09.2026: „butonul
 * răsfoiește… să se transforme în «Descarcă» cu iconiță de descărcare și să descarce fișierul. Tot
 * lângă să fie un buton de tip «Tipărește»").
 *
 * ⚠️ RĂSFOITUL N-A IEȘIT, a iesit BUTONUL lui: coperta de deasupra deschide mai departe fereastra cu
 * FlipBook (`data-rasfoit`), care e drumul obisnuit al omului prin numar. Butonul lui ar fi fost al
 * treilea intr-un rand unde primele doua sunt fapte limpezi.
 *
 * ⚠️ **Descarcă** duce la `/fisier/…?descarca=1`, nu doar la `download` din HTML: atributul merge
 * numai in browserele de birou si numai pe acelasi domeniu, iar pe iPhone ar fi deschis foaia in
 * locul descarcarii. Parametrul schimba `content-disposition` pe server, deci tine peste tot; `download`
 * ramane scris pe langa, pentru numele fisierului.
 * ⚠️ **Descarcă e FĂRĂ CUVÂNT** (user, 17.09.2026, 22:00: „fără text, doar dimensiunea fișierului și
 * iconița specifică — se înțelege ce face"): sageata in jos si marimea fisierului. Cuvantul a ramas
 * numai pentru cititorul de ecran (`aria-label`) si in `title`.
 * ⚠️ **Tipărește** duce la brosura (`/tipar/…`), nu la PDF-ul obisnuit — vezi `tipar.ts`. Se deschide
 * INLINE, in vizualizatorul browserului, de unde omul apasa tiparirea; o descarcare l-ar fi pus sa
 * caute fisierul prin dosare inainte sa ajunga la imprimanta.
 * ⚠️ **Revers**, in dreapta lui Tipărește — un INTRERUPATOR, nu o destinatie (user, 17.09.2026, 22:00:
 * „există imprimante care au nevoie de opțiunea specială ca interiorul să fie întors ca să iasă cu un
 * booklet… dacă apăs tipărește și am revers ON foaia a doua este întoarsă 180 de grade"). Aprins, pune
 * `?revers=1` pe adresa brosurii — versoul iese rotit cu 180° (`tipar.ts`). Alegerea tine de
 * IMPRIMANTA omului, nu de numar, deci se tine minte in localStorage (`JS_REVERS`) si porneste STINSA.
 *
 * Fara PDF (doua numere vechi au ramas doar cu poza), butoanele se sting in loc sa duca in gol.
 */
function butoaneleNumarului(ctx: Ctx, b: Buletin): string {
  if (!b.cheie_pdf) {
    return (
      `<span class="btn intreg gol" title="Numărul acesta a rămas în arhivă doar ca poză">` +
      `${IC_PDF} Fără PDF</span>`
    )
  }
  const marime = b.marime_pdf ? `<small>${(b.marime_pdf / 1048576).toFixed(1)} MB</small>` : ''
  const nume = b.cheie_pdf.slice(b.cheie_pdf.lastIndexOf('/') + 1)
  return (
    `<a class="btn intreg" id="b-descarca" href="${fisier(ctx, b.cheie_pdf)}?descarca=1"` +
    ` download="${esc(nume)}" title="Descarcă foaia numărului ${b.nr}" aria-label="Descarcă foaia numărului ${b.nr}">` +
    `${IC_DESCARCA}${marime}</a>` +
    `<a class="btn intreg" id="b-tipareste" href="${esc(ctx.prefix)}/tipar/${b.nr}-${b.data}.pdf"` +
    ` target="_blank" rel="noopener"` +
    ` title="Broșură pentru tipar: două pagini pe o coală A4, în ordinea îndoirii">` +
    `${IC_TIPAR} Tipărește</a>` +
    `<button type="button" class="btn intreg com-revers" id="b-revers" aria-pressed="false"` +
    ` title="Întoarce coala a doua cu 180°, pentru imprimantele care întorc pe latura scurtă">` +
    `Revers<span class="bec" aria-hidden="true"></span></button>`
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
export function paginaAcasa(ctx: Ctx, m: Meniu, b: Buletin | null, dinainte: BuletinScurt[]): string {
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
<nav class="btns hartii">${butoaneleNumarului(ctx, b)}</nav>${fereastraRasfoit(ctx, b)}
${
  dinainte.length
    ? `<h3 class="titlu-fasie">Numerele dinainte</h3>
<div class="raft fasie">${dinainte.map((x) => fisa(ctx, x)).join('')}</div>`
    : ''
}`,
  )
}

/**
 * Pagina unui numar din arhiva: aceeasi asezare ca prima pagina.
 * ⚠️ Sagetile „◀ numărul dinainte / numărul următor ▶" de jos AU IESIT (user, 17.09.2026, seara:
 * „jos de tot este o navigare — scoate-o"). Vecinii se mai cer doar ca sa se stie daca e numarul curent.
 */
export function paginaBuletin(ctx: Ctx, m: Meniu, b: Buletin): string {
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
<nav class="btns hartii">${butoaneleNumarului(ctx, b)}</nav>${fereastraRasfoit(ctx, b)}`,
  )
}

/* ─────────────────────────── BULETINUL NOU ─────────────────────────── */

const ziua = (d: string) => new Date(`${d}T00:00:00Z`)
const scrieZiua = (d: Date) => d.toISOString().slice(0, 10)
const plusZile = (d: string, zile: number) => scrieZiua(new Date(ziua(d).getTime() + zile * 86400000))

/**
 * DUMINICA NUMARULUI NOU — „data buletinului, adică următoarea duminică" (user, 17.09.2026).
 *
 * Buletinul parohiei e datat duminica dinaintea saptamanii pe care o vesteste (nr. 615 / 6.09 →
 * programul 7–13.09), deci ziua numarului care urmeaza e prima duminica de azi inainte.
 *
 * ⚠️ Doua praguri, nu unul: duminica se ia de la ZIUA DE AZI (daca azi e chiar duminica, e azi), dar
 * niciodata una deja aparuta — daca numarul curent poarta chiar ziua aceea, se trece la urmatoarea.
 * Fara al doilea prag, in dimineata in care se urca numarul de duminica, ecranul ar cere inca o data
 * numarul tocmai aparut.
 * ⚠️ Socoteala e pe UTC, ca toate datele aplicatiei: ele sunt zile calendaristice („2026-09-20"), nu
 * clipe, iar un fus ar muta ziua cu una intr-o parte.
 */
export function duminicaNoua(curent: string | null, azi: string): string {
  const pana = (7 - ziua(azi).getUTCDay()) % 7
  const d = plusZile(azi, pana)
  return curent && d <= curent ? plusZile(d, 7) : d
}

/** Numarul si ziua buletinului care urmeaza: unul peste cel curent, in duminica de mai sus. */
export function buletinulNou(
  curent: { nr: number; data: string } | null,
  azi: string,
): { nr: number | null; data: string } {
  return { nr: curent ? curent.nr + 1 : null, data: duminicaNoua(curent?.data ?? null, azi) }
}

/**
 * ECRANUL BULETINULUI NOU — tinta sagetii din pastila (user, 17.09.2026: „când apăsăm aici, intrăm
 * într-o pagină în care scriem numărul 616, dar cu roșu. Sub scriem data buletinului, adică
 * următoarea duminică, și deasupra scriem numărul următor cu verde").
 *
 * Capul paginii e ACELASI ca la orice numar — eticheta marunta, numarul mare, ziua —, numai ca
 * eticheta scrie „Numărul următor" si e VERDE (user, 17.09.2026: „textul cu verde de deasupra
 * vroiam să fie la fel ca la oricare buletin, un text mic unde scrie numărul curent. Aici vroiam să
 * scrie numărul următor. Doar culoarea vroiam să fie puțin mai evidențiată").
 *   eticheta verde — „Numărul următor", la masura celei care scrie „Numărul curent" pe prima pagina;
 *   numarul, mare  — cel NOU, scris rosu, ca sa se deosebeasca de numerele aparute;
 *   ziua           — duminica lui.
 * ⚠️ Numarul de dupa cel nou (617) NU se mai scrie: era un al doilea numar mare pe ecran, iar userul
 * l-a schimbat pe eticheta de mai sus. Nu-l readu.
 *
 * ⚠️ NUMARUL ROSU E CEL NOU, NU CEL DIN ARHIVA. Cand a cerut ecranul, userul lucra tocmai la
 * **616 / 20.09** (schita tiparita, 16.09.2026, seara), iar in arhiva cel mai nou e **615 / 6.09** —
 * deci „616 cu rosu" e numarul care URMEAZA sa apara, nu ultimul aparut. De aici si socoteala:
 * rosu = ultimul din arhiva + 1, verde = inca unul peste.
 * ⚠️ Numerele nu se scriu in cod: ies din arhiva, deci se misca singure cand intra un numar nou.
 * ⚠️ PAGINA NU COMPUNE INCA NIMIC: dedesubt sta un chenar gol, cat pagina intai a unui numar, locul
 * in care va intra cuprinsul („ce punem în pagină mai vedem" — user).
 */
export interface StareaCompunerii {
  /** câte semne încap în fiecare variantă — cifrele din `masuri.ts`, pentru socoteala din pagină */
  variante: Array<{ varianta: string; semne: number; zone: Array<{ cine: string; semne: number }> }>
  /** ce a răspuns ultima compunere, dacă s-a cerut una */
  raspuns?: {
    facut: boolean
    cheie?: string | null
    plangeri: string[]
    zone?: Array<{ cine: string; semne: number; scrise: number; ramase: number }>
  }
  /** ce scrisese omul, ca să nu se piardă la reîncărcare */
  scris?: Record<string, string>
  /** programul săptămânii tipărite — ce a spus aplicația `program` */
  calendar?: { titlu: string; slujbe: number } | null
}

/** Un câmp de formular, cu eticheta lui. */
const camp = (nume: string, eticheta: string, val: string, o: { lung?: boolean; ajutor?: string; tip?: string } = {}): string =>
  `<p class="camp${o.lung ? ' lung' : ''}">
  <label for="c-${nume}">${esc(eticheta)}</label>
  ${o.lung
    ? `<textarea id="c-${nume}" name="${nume}" rows="8" data-numara>${esc(val)}</textarea>`
    : `<input id="c-${nume}" name="${nume}" type="${o.tip ?? 'text'}" value="${esc(val)}">`}
  ${o.ajutor ? `<span class="ajutor">${o.ajutor}</span>` : ''}
</p>`

/** Blocul unui articol din formular: autorul (zona neagră), titlul, textul, sursa. */
function campuriArticol(prefix: string, titlu: string, scris: Record<string, string>, cuPoza: string): string {
  const v = (c: string): string => scris[`${prefix}_${c}`] ?? ''
  return `<fieldset class="articol" data-articol="${prefix}">
  <legend>${esc(titlu)}</legend>
  ${camp(`${prefix}_autor`, 'Autorul (scrisul alb din zona neagră)', v('autor'), { ajutor: 'Dacă nu se știe: „Fără autor".' })}
  <div class="doua">
    ${camp(`${prefix}_ani`, 'Anii vieții', v('ani'), { ajutor: 'ex. 1661-1729' })}
    ${camp(`${prefix}_pomenire`, 'Pomenirea', v('pomenire'), { ajutor: 'ex. † 16 august' })}
  </div>
  ${camp(`${prefix}_titlu`, 'Titlul', v('titlu'))}
  ${camp(`${prefix}_poza`, cuPoza, v('poza'), { ajutor: 'adresa pozei; gol = fără poză' })}
  ${camp(`${prefix}_text`, 'Textul', v('text'), { lung: true })}
  ${camp(`${prefix}_sursa`, 'Sursa', v('sursa'), { ajutor: 'ex. ziarullumina.ro' })}
  <p class="socoteala" data-pentru="${prefix}"></p>
</fieldset>`
}

/**
 * ECRANUL NUMĂRULUI CARE URMEAZĂ — capul lui și, din 17.09.2026, formularul din care se compune
 * foaia tipărită.
 *
 * Capul e cel de la orice număr, doar că eticheta măruntă scrie „Numărul următor" cu VERDE (user,
 * 17.09.2026), numărul mare e ROȘU (ultimul din arhivă + 1), iar sub el stă duminica lui.
 * ⚠️ Numărul de după cel nou (617) NU se scrie: a ieșit la cererea userului. Nu-l readu.
 * ⚠️ NUMĂRUL ROȘU E CEL NOU, NU CEL DIN ARHIVĂ: el numără de la buletinul la care LUCREAZĂ.
 * ⚠️ Numerele nu se scriu în cod: ies din arhivă, deci se mișcă singure când intră un număr nou.
 *
 * ⚠️ SOCOTEALA SE VEDE ÎN TIMP CE SCRII, nu după ce apeși. Sub fiecare text stă câte semne încap
 * și câte au mai rămas, socotite în pagină din aceleași cifre ca la server (`masuri.ts`, trimise
 * o dată, ca JSON). Un om care află abia la compunere că a scris cu 2 000 de semne prea mult a
 * pierdut o oră degeaba — iar textul buletinului se scrie o dată pe săptămână, seara.
 * ⚠️ Cifra din pagină e o PREVESTIRE, nu adevărul: adevărul îl spune curgerea la randare, iar
 * răspunsul compunerii îl arată. De aceea scrie „încap ~", cu tilda.
 */
export function paginaNou(
  ctx: Ctx,
  m: Meniu,
  curent: BuletinScurt | null,
  nou: { nr: number | null; data: string },
  stare: StareaCompunerii,
): string {
  const scris = stare.scris ?? {}
  const capul = `<div class="cap-numar cap-nou">
  <p class="eticheta urmator">Numărul următor</p>
  <h2>${nou.nr ? `Nr. ${nou.nr}` : 'Buletin nou'}</h2>
  <p class="cand">${dataCuZi(nou.data)}</p>
</div>`

  const veste = stare.raspuns
    ? stare.raspuns.facut
      ? `<p class="veste bine">Numărul e compus. <a href="${ctx.prefix}/fisier/${esc(stare.raspuns.cheie ?? '')}">Deschide PDF-ul</a>.</p>`
      : `<div class="veste rau"><p>Nu s-a compus:</p><ul>${stare.raspuns.plangeri.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`
    : ''

  const cati = Number(scris.secundari ?? '0')
  const secundare = [1, 2]
    .map((i) => `<div class="secundar" data-nr="${i}"${i > cati ? ' hidden' : ''}>${campuriArticol(`s${i}`, `Articolul secundar ${i}`, scris, 'Poza mică (adresă)')}</div>`)
    .join('')

  const formular = `<form method="post" action="${ctx.prefix}/nou" class="compunere">
  <div class="doua">
    ${camp('nr', 'Numărul', scris.nr ?? (nou.nr ? String(nou.nr) : ''), { tip: 'number' })}
    ${camp('data', 'Duminica numărului', scris.data ?? nou.data, { tip: 'date', ajutor: 'programul tipărit e al săptămânii care începe a doua zi' })}
  </div>
  ${camp('motto', 'Motto', scris.motto ?? '', { lung: true, ajutor: 'citatul de sub antet, pe cel mult două rânduri' })}
  ${camp('moto_autor', 'Cine a spus-o', scris.moto_autor ?? '')}
  ${campuriArticol('p', 'Articolul principal', scris, 'Poza mare (adresă)')}
  <p class="cati-secundari">
    <label for="c-secundari">Articole secundare</label>
    <select id="c-secundari" name="secundari">
      ${[0, 1, 2].map((i) => `<option value="${i}"${i === cati ? ' selected' : ''}>${i === 0 ? 'niciunul' : i === 1 ? 'unul' : 'două'}</option>`).join('')}
    </select>
  </p>
  ${secundare}
  <p class="total" data-total></p>
  <p class="butoane">
    <button type="submit" name="fapta" value="compune" class="btn mare">Compune numărul</button>
  </p>
</form>`

  const calendar = stare.calendar
    ? `<p class="marunt">Pe pagina a patra intră programul liturgic pentru <b>${esc(stare.calendar.titlu)}</b> — ${stare.calendar.slujbe} ${stare.calendar.slujbe === 1 ? 'slujbă' : 'de slujbe'}, cerute de la aplicația Programul.</p>`
    : `<p class="marunt rau">Programul săptămânii nu e încă validat, deci pagina a patra n-are ce tipări. Validează-l întâi în aplicația Programul.</p>`

  return sablon(
    ctx,
    m,
    'Buletin nou',
    `${capul}
${veste}
${calendar}
${formular}
<p class="marunt sub-nou">${
      curent
        ? `Ultimul apărut: <a href="${adresa(ctx, curent)}">nr. ${curent.nr}</a>, ${dataLunga(curent.data)}.`
        : ''
    }</p>
<script>window.XC_MASURI = ${JSON.stringify(stare.variante)};</script>
<script>${SOCOTESTE_IN_PAGINA}</script>`,
  )
}

/**
 * Socoteala care merge odată cu scrisul: alege varianta după câți secundari sunt și după poză,
 * apoi scrie sub fiecare text câte semne încap și câte au rămas.
 *
 * ES5 dinadins, ca tot ce trimitem în pagină (regula aplicației, 13.09.2026).
 */
const SOCOTESTE_IN_PAGINA = `
(function(){
  var masuri = window.XC_MASURI || [];
  var form = document.querySelector('form.compunere');
  if (!form || !masuri.length) return;
  function cati(){ var s = form.querySelector('[name=secundari]'); return s ? Number(s.value) : 0; }
  // trei variante, dupa cati secundari sunt: [0] un autor, [1] +1, [2] +2 — poza nu schimba socoteala,
  // coloana intai a paginii intai e a ei oricum (regula generala a userului)
  function varianta(){ return masuri[Math.min(cati(), masuri.length - 1)]; }
  function semne(t){ return t.replace(/\\s+/g, ' ').replace(/^ | $/g, '').length; }
  function arata(){
    var v = varianta(); if (!v) return;
    var n = cati(), total = 0;
    for (var i = 1; i <= 2; i++) {
      var bloc = form.querySelector('.secundar[data-nr="' + i + '"]');
      if (bloc) { if (i <= n) bloc.removeAttribute('hidden'); else bloc.setAttribute('hidden', ''); }
    }
    var zone = [['p', v.zone[0]]];
    for (var k = 1; k <= n && k < v.zone.length; k++) zone.push(['s' + k, v.zone[k]]);
    for (var z = 0; z < zone.length; z++) {
      var prefix = zone[z][0], masura = zone[z][1];
      var camp = form.querySelector('[name=' + prefix + '_text]');
      var unde = form.querySelector('.socoteala[data-pentru=' + prefix + ']');
      if (!camp || !unde || !masura) continue;
      var scrise = semne(camp.value); total += scrise;
      var ramase = masura.semne - scrise;
      unde.textContent = 'Încap ~' + masura.semne + ' de semne. Scrise: ' + scrise + '. ' +
        (ramase >= 0 ? 'Mai ai loc pentru ' + ramase + '.' : 'Ai trecut cu ' + (-ramase) + ' peste măsură.');
      unde.className = 'socoteala' + (ramase < 0 ? ' peste' : '');
      unde.setAttribute('data-pentru', prefix);
    }
    var t = form.querySelector('[data-total]');
    if (t) t.textContent = 'Cu totul: ' + total + ' din ~' + v.semne + ' de semne (' + v.varianta + ').';
  }
  form.addEventListener('input', arata);
  form.addEventListener('change', arata);
  arata();
})();`

/**
 * ARHIVA: **un singur an pe ecran**, ca la A2 — 619 de numere intr-un teanc nu se rasfoiesc. Anul
 * vine din adresa („?an=2019"), nu dintr-o stare din pagina: linkul se poate da mai departe si merge
 * butonul „înapoi" al browserului.
 *
 * ⚠️ PATRATELELE CU ANI AU IESIT DIN CORPUL PAGINII la 17.09.2026, odata cu fasia de sub antet (ca la
 * Program si la A8): anii se aleg acum dintr-un singur loc, iar doua randuri de ani, unul sub altul,
 * ar fi spus acelasi lucru de doua ori. De aceea, pe pagina asta, fasia se scrie COBORATA si cheia de
 * deasupra devine inerta.
 *
 * In anul deschis, numerele stau grupate PE LUNI, in rafturi de fise cu pagina intai — la un buletin
 * coperta spune mai mult decat orice titlu, fiindca titlul lui e chiar ce scrie pe ea.
 */
export function paginaArhiva(
  ctx: Ctx,
  m: Meniu,
  ales: string,
  buletine: BuletinScurt[],
  total: number,
): string {
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
