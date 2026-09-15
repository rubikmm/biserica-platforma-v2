/**
 * Paginile newsletterului: un numar intreg (si pe prima pagina), arhiva pe ani si luni, cautarea.
 *
 * Afisarea, markup-ul si textele sunt cele din V1 (`biserica-newsletter`, v0.6.5) — „să respecți
 * mesajele și grafica din V1" (user, 10.09.2026). Carcasa vine din `@xc/ui`.
 *
 * ⚠️ MENIUL DIN ANTET, REFACUT LA 15.09.2026 DUPA CHIPUL CALENDARULUI SI AL PROGRAMULUI (user:
 * „preia logica de meniu principal din antet de la Calendar și Program și refă meniul. Și aici avem
 * Abonare și bulină prima și să scrie și Nr. curent și săgeată pentru buletin nou … și arhiva").
 * Randul de unelte are acum O PASTILA cat tot randul si, singura afara la dreapta, ABONAREA:
 *
 *   PASTILA, in ordinea ceruta:
 *     1. BULINA numarului curent, prima — duce mereu la cel mai nou numar trimis;
 *     2. ZONA DE SCRIS, care ia tot prisosul: „Nr. curent" pe el, data numarului pe celelalte,
 *        „Arhiva" / „Căutare" / „Buletin nou" pe paginile care nu tin de un numar anume;
 *     3. SAGEATA-DREAPTA — BULETINUL NOU, adica adaugarea manuala a unui numar (vezi mai jos);
 *     4. ARHIVA, pe ani si luni;
 *     5. LUPA, cheie care coboara bara cautarii (ca la Calendar).
 *
 * ⚠️ SAGEATA NU E O NAVIGARE, E O FAPTA (user, 15.09.2026, intrebat anume): duce la ecranul de
 * ADAUGARE MANUALA a unui buletin nou — „actualizare program sau altceva". Pana acum era pasul
 * inainte prin sirul numerelor; nu o citi asa. Fiind o fapta de admin, se scrie NUMAI pentru admini,
 * ca Arhiva Programului — enoriasul ramane cu bulina, scrisul, Arhiva si lupa.
 * ⚠️ ECRANUL DE ADAUGARE NU COMPUNE INCA NIMIC (hotarat cu userul: se face in runda urmatoare). A8 e
 * arhiva: nu scrie in depozit si nu trimite. `/nou` e deocamdata pagina care spune ce urmeaza.
 *
 * ⚠️ SAGEATA „◀ numărul dinainte" A IESIT din rand, odata cu asezarea veche (cele doua sageti cu
 * bulina intre ele, tiparul lui A2 din 8 sept. 2026). E aceeasi socoteala ca la Program, unde inapoi
 * nu se mai merge dintr-un pas: drumul indarat trece prin Arhiva, care insira oricum toate numerele
 * pe ani si pe luni (ales de user, 15.09.2026). Daca se cere inapoi, se pune un al saselea segment —
 * dar atunci se REFACE socoteala latimilor de pe telefon (vezi `stil.ts`), nu se adauga peste.
 */
import type { Navigatie } from '@xc/config'
import { ICOANE, LUNI, LUNI_SCURT, esc, pagina } from '@xc/ui'
import { JS_ABONARE, abonamentul, butonAbonare, fereastraAbonare } from '@xc/abonare'
import type { Fisa } from './depozit.js'
import { LOCAL } from './stil.js'

export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
  /** adresa contului — fereastra de abonare o scrie in camp si o incuie; `null` la neautentificat */
  emailulContului?: string | null
  eAdmin: boolean
  versiune: string
  modificata: string
  veziCa?: string | null
  poateVedeaCa?: boolean
  spre?: string
}

/** Ce-i trebuie meniului ca sa se aseze pe o pagina anume. */
export interface Meniu {
  /** pagina deschisa e „Buletin nou" (sageata ramane aprinsa) */
  nou?: boolean
  /** numarul de pe ecran, pentru zona de scris; `null` pe paginile care nu tin de unul (arhiva, cautarea) */
  peEcran?: Fisa | null
  /** numarul de pe ecran e chiar cel mai nou — bulina ramane apasata si scrisul spune „Nr. curent" */
  acum?: boolean
  /** pagina deschisa e Arhiva (butonul ei ramane aprins) */
  arhiva?: boolean
  /** bara cautarii e coborata (cheia-lupa ramane aprinsa) */
  cauta?: boolean
  /**
   * ANII ARHIVEI, descrescator — sirul care coboara din cheia Arhivei (user, 15.09.2026: „când apăs
   * pe History, să apară o bară cu anii, la fel cum este la Program"). Il umple `sablon` din lista,
   * deci nu se scrie la mana. ⚠️ GOL INSEAMNA „fara bara": atunci segmentul Arhivei ramane LINKUL
   * de pana acum, catre /arhiva — o cheie care ar cobori o fasie goala n-ar face nimic la apasare.
   */
  ani?: number[]
  /** anul deschis in arhiva, marcat rosu in fasie (ca luna deschisa din bara Calendarului) */
  anDeschis?: number
}

const IC_ARHIVA = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>`
/* Sageata sta SINGURA in buton, fara niciun invelis — lectia platita la Program pe 15.09.2026: un
   invelis e copil flexibil, deci cutia lui e o linie de scris, iar desenul ramane pe linia de baza
   si iese cu vreo doi pixeli mai sus decat vecinii. */
const IC_INAINTE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12h14"/><path d="m12.5 6 6 6-6 6"/></svg>`

export const anul = (f: Fisa) => +f.trimis.slice(0, 4)
export const luna = (f: Fisa) => +f.trimis.slice(5, 7) // 1..12
const ziua = (f: Fisa) => +f.trimis.slice(8, 10)
const zilaScurt = (f: Fisa) => `${ziua(f)} ${LUNI_SCURT[luna(f) - 1] ?? ''}`

/** Numele intreg al foii se repeta in 9 subiecte din 10; in liste, unde deasupra scrie
 *  oricum luna si anul, plicteste. Pe pagina numarului subiectul ramane intreg. */
export const scurtat = (subiect: string) => {
  const s = subiect.replace(/^Buletinul Parohiei\s*(?:\(online\)|online)?\s*/i, '')
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : subiect
}

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

/**
 * Carcasa goala a newsletterului — antet, subsol, stil — cu un corp dat de altcineva. O cere
 * `@xc/setari` (15.09.2026). Fara randul de unelte: pe pagina de Setari n-ai ce rasfoi.
 */
export function paginaCarcasa(ctx: Ctx, o: { titluPagina: string; corp: string; scripturi?: string }): string {
  return pagina({
    nume: 'NEWSLETTER',
    titlu: 'Newsletter',
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

/** Data unui numar, intreg si scurt — scrisul din pastila pe numerele care nu sunt cel curent. */
const ziuaLunga = (f: Fisa) => `${ziua(f)} ${LUNI[luna(f) - 1] ?? ''} ${anul(f)}`
const ziuaScurta = (f: Fisa) => `${ziua(f)} ${LUNI_SCURT[luna(f) - 1] ?? ''} ${anul(f)}`

/**
 * ZONA DE SCRIS din pastila — pe ce numar esti, in cuvinte (user, 15.09.2026: „să scrie și Nr.
 * curent"). Ca la Calendar si la Program, ea ia tot spatiul ramas, iar butoanele de langa stau la
 * masura lor fixa: scrisul e lucrul dupa care se uita omul intai, deci nu se strange el primul.
 *
 * Cinci feluri, dupa ce arata pagina:
 *   - cel mai nou numar (si prima pagina)  → „Buletinul nr. 571";
 *   - un numar din arhiva                  → data lui („8 septembrie 2026");
 *   - pagina Arhivei                       → „Arhiva";
 *   - ecranul buletinului nou              → „Buletin nou";
 *   - pagina cautarii                      → „Căutare".
 *
 * ⚠️ PE MOBIL NU SE MAI PRESCURTEAZA CE INCAPE (user, 15.09.2026: „când apăs săgeată, să nu scrie
 * doar «nou»; se scrie «Buletin nou», că e loc. La fel și când sunt pe buletinul curent, scrie
 * «Buletinul nr. 500»"). Deci „Buletin nou" ramane intreg la orice latime, iar numarul curent nu mai
 * scrie generic „Nr. curent"/„Curent", ci CHIAR numarul lui. Zona are ~120 px la un telefon de 390
 * (masurat), destul pentru amandoua — vezi socoteala din `stil.ts` inainte sa mai adaugi ceva in rand.
 * ⚠️ Forma scurta se scrie ALATURI, nu in locul celei lungi, si se schimba din CSS la ecrane mici;
 * cand cele doua sunt la fel, scrisul pur si simplu nu se schimba.
 * ⚠️ Un numar FARA numar in subiect (anunturile n-au) ramane pe „Nr. curent": „Buletinul nr. null"
 * n-ar fi scris nimic.
 * ⚠️ NU e un buton: nu duce nicaieri si nu se apasa (vezi `.acum` din `stil.ts`, fundal de hartie).
 */
function scrisulNumarului(m: Meniu): string {
  const zona = (lung: string, scurt: string, titlu: string) =>
    `<span class="acum" title="${esc(titlu)}"><b class="lung">${esc(lung)}</b><b class="scurt">${esc(scurt)}</b></span>`
  if (m.nou) return zona('Buletin nou', 'Buletin nou', 'Adăugarea manuală a unui buletin')
  if (m.arhiva) return zona('Arhiva', 'Arhiva', 'Arhiva newsletterului')
  if (!m.peEcran) return zona('Căutare', 'Căutare', 'Căutare în newsletter')
  if (m.acum) {
    const nr = m.peEcran.nr
    const titlu = `Numărul curent — ${ziuaLunga(m.peEcran)}`
    return nr ? zona(`Buletinul nr. ${nr}`, `Buletinul nr. ${nr}`, titlu) : zona('Nr. curent', 'Nr. curent', titlu)
  }
  return zona(ziuaLunga(m.peEcran), ziuaScurta(m.peEcran), m.peEcran.subiect)
}

/**
 * PASTILA NAVIGARII — cele cinci segmente, in ordinea ceruta de user (15.09.2026): bulina · zona de
 * scris · sageata („buletin nou") · Arhiva · lupa. Segmentele stau lipite intr-un singur corp, ca sa
 * se citeasca drept UN obiect cu o pozitie, nu cinci destinatii deosebite.
 *
 * ⚠️ BULINA n-are text si duce INTOTDEAUNA la cel mai nou numar trimis, de oriunde ai fi; ramane
 * apasata (rosie, inerta) cand chiar pe el esti. Numele ei se citeste din `title` si `aria-label`.
 *
 * ⚠️ SAGEATA E O FAPTA, NU O NAVIGARE: duce la ecranul de adaugare manuala a unui buletin nou
 * („actualizare program sau altceva" — user, 15.09.2026). Se scrie NUMAI pentru admini, ca Arhiva
 * Programului: adaugarea nu e a oricui, iar un segment mort in pastila enoriasului n-ar spune nimic.
 * Pe ecranul ei ramane aprinsa (`.activ`), ca omul sa vada unde se afla.
 */
function pastilaNumarului(ctx: Ctx, m: Meniu, ultimul: Fisa | null): string {
  const p = esc(ctx.prefix)
  const bulina = !ultimul
    ? `<span class="btn punct gol" title="Arhiva e goală" aria-label="numărul curent"></span>`
    : m.acum
      ? `<button type="button" class="btn punct activ" aria-disabled="true" aria-current="page"`
        + ` title="Ești pe numărul curent" aria-label="numărul curent"></button>`
      : `<a class="btn punct" href="${p}/n/${ultimul.id}" title="Treci la numărul curent"`
        + ` aria-label="numărul curent"></a>`
  const sageata = !ctx.eAdmin
    ? ''
    : m.nou
      ? `<button type="button" class="btn viit activ" aria-disabled="true" aria-current="page"`
        + ` title="Ești pe adăugarea unui buletin nou" aria-label="buletin nou">${IC_INAINTE}</button>`
      : `<a class="btn viit" href="${p}/nou" title="Buletin nou — adăugare manuală"`
        + ` aria-label="Buletin nou — adăugare manuală">${IC_INAINTE}</a>`
  /*
   * ⚠️ CHEIA ARHIVEI, din 15.09.2026 (user: „când apăs pe History, să apară o bară cu anii, la fel
   * cum este la Program"): iconita nu mai duce dintr-o apasare la /arhiva, ci COBOARA FASIA ANILOR
   * de sub rand (`baraAnilor`), exact ca la Program si ca sirul lunilor din Calendar. Drumul la
   * arhiva a ramas intreg — trece printr-un an.
   * ⚠️ PE PAGINA ARHIVEI cheia nu mai e cheie, ci semn al locului: fasia e coborata permanent, asa ca
   * segmentul se scrie INERT si cu `aria-expanded="true"`, iar JS-ul nu-i mai pune ascultatorul.
   * Altfel omul ar putea strange singurul drum ramas catre ceilalti ani (randul din pagina s-a scos).
   * ⚠️ Fara ani (pagini care n-au lista) ramane LINKUL de pana acum: butonul nu se ascunde niciodata.
   */
  const arhiva = !m.ani?.length
    ? `<a class="btn arh${m.arhiva ? ' activ' : ''}" href="${p}/arhiva"`
      + ` title="Arhiva pe ani și luni" aria-label="Arhiva newsletterului">${IC_ARHIVA}</a>`
    : `<button type="button" class="btn arh${m.arhiva ? ' activ' : ''}" id="ani-cheie"`
      + ` aria-expanded="${m.arhiva ? 'true' : 'false'}" aria-controls="bara-ani"`
      + (m.arhiva ? ' aria-disabled="true" aria-current="page"' : '')
      + ` title="${m.arhiva ? 'Ești în arhivă — alege anul din bara de dedesubt' : 'Arhiva newsletterului — alege anul'}"`
      + ` aria-label="Arhiva newsletterului — alege anul">${IC_ARHIVA}</button>`
  /* LUPA e o CHEIE, ca la Calendar: coboara bara cautarii de sub antet, nu duce nicaieri singura.
     Fara JavaScript ramane butonul care e — atunci bara se deschide de la server, pe /cauta. */
  const lupa = `<button type="button" class="btn cheie" id="cautare-cheie" aria-controls="bara-cautare"`
    + ` aria-expanded="${m.cauta ? 'true' : 'false'}" title="Caută în newsletter"`
    + ` aria-label="Caută în newsletter">${ICOANE.lupa}</button>`
  return `<span class="pastila">${bulina}${scrisulNumarului(m)}${sageata}${arhiva}${lupa}</span>`
}

/**
 * ABONAREA — butonul si tot drumul de dupa el stau in `@xc/abonare`, ca peste tot (user, 15.09.2026:
 * „nu ar trebui să copiez logica în mai multe locuri"). Al newsletterului e numai randul din registru,
 * adica audienta `newsletter-abonati`.
 *
 * ⚠️ IL VAD TOTI, SI ADMINII (regula de la Calendar, Program si Tipic — 12.09.2026).
 * ⚠️ Newsletterul NU TRIMITE INCA nimic: butonul inscrie oameni intr-o audienta care asteapta. Vezi
 * lamurirea din `@xc/abonare`, la randul lui din `ABONAMENTE`.
 */
const ABONAMENT = abonamentul('newsletter')

/** Randul de unelte: pastila cat tot randul si, singura afara la dreapta, abonarea. */
function unelte(ctx: Ctx, m: Meniu, ultimul: Fisa | null): string {
  return pastilaNumarului(ctx, m, ultimul) + butonAbonare(ABONAMENT)
}

/** Meniul paginilor care nu sunt un numar anume (arhiva, cautarea, buletinul nou): niciun numar in
 *  context, deci zona de scris isi spune numele paginii. */
export const meniuLista = (rest: Partial<Meniu> = {}): Meniu => ({ peEcran: null, ...rest })

/** Cel mai nou numar — tinta bulinei din mijlocul navigarii. */
export const ULTIMUL = (lista: Fisa[]): Fisa | null => lista[lista.length - 1] ?? null

/**
 * BARA ANILOR — sub randul de unelte, ascunsa pana se apasa cheia Arhivei (user, 15.09.2026: „când
 * apăs pe History, să apară o bară cu anii, la fel cum este la Program").
 *
 * E aceeasi unealta ca `baraAnilor` din Program si ca `baraLunilor` din Calendar: aceeasi fasie
 * derulabila stanga-dreapta, aceleasi sageti ‹ › scrise de JS numai daca e ceva de derulat, acelasi
 * chenar de pastila, ca aplicatiile sa se recunoasca intre ele.
 *
 * ⚠️ ANII VIN DIN ARHIVA, descrescator — cel de care e nevoie mereu, primul. Nu se scrie niciun an in
 * cod: cand mai vine un an de numere, el apare singur in fasie.
 * ⚠️ `hidden` il scrie SERVERUL, la fiecare pagina: asa fasia se strange singura dupa ce omul alege
 * un an, fara nicio linie de JS — alegerea e o navigare, iar pagina urmatoare se naste cu bara sus.
 * ⚠️ PE PAGINA ARHIVEI NU SE SCRIE `hidden` (ca la Program): acolo fasia a luat locul patratelelor cu
 * ani din corpul paginii, scoase in aceeasi runda, deci e singurul drum catre ceilalti ani.
 */
function baraAnilor(ctx: Ctx, m: Meniu): string {
  if (!m.ani?.length) return ''
  const p = esc(ctx.prefix)
  const butoane = m.ani
    .map((a) => {
      const activ = m.arhiva && m.anDeschis === a ? ' activ' : ''
      return `<a class="an-buton${activ}" href="${p}/arhiva/${a}" data-an="${a}"`
        + `${activ ? ' aria-current="page"' : ''}>${a}</a>`
    })
    .join('')
  return `<div class="bara-ani" id="bara-ani"${m.arhiva ? '' : ' hidden'}><div class="fasie">`
    + `<nav class="ani" aria-label="Anii arhivei">${butoane}</nav></div></div>`
}

/**
 * BARA CAUTARII — sora barei lunilor din Calendar, sub randul de unelte, ascunsa pana se apasa lupa
 * din pastila. Chenarul si rotunjirea sunt ale pastilei de deasupra, ca sirul sa se citeasca drept o
 * prelungire a ei, nu un obiect strain.
 *
 * ⚠️ E un FORMULAR adevarat, `method="get"`: cautarea merge si fara JavaScript, iar rezultatul are
 * adresa (`/cauta?q=…`), deci se poate da mai departe si se poate pune la semne de carte. JS-ul
 * adauga doar coborarea barei si focusul.
 * ⚠️ Pe pagina rezultatelor bara se naste DESCHISA, cu intrebarea scrisa in camp — altfel omul n-ar
 * mai vedea ce a cautat si ar trebui sa deschida lupa ca sa afle.
 */
function baraCautarii(ctx: Ctx, q: string | null): string {
  const p = esc(ctx.prefix)
  return `<div class="bara-cautare" id="bara-cautare"${q === null ? ' hidden' : ''}>
      <form class="cauta" role="search" method="get" action="${p}/cauta">
        <input class="cauta-camp" type="search" name="q" value="${esc(q ?? '')}"
          placeholder="Caută un cuvânt din newsletter" aria-label="Caută în newsletter" autocomplete="off">
        <button class="cauta-du" type="submit" title="Caută" aria-label="Caută">${ICOANE.lupa}</button>
      </form>
    </div>`
}

/**
 * CELE DOUA BARE care coboara din pastila — anii si cautarea — si care SE EXCLUD (regula Calendarului,
 * 15.09.2026): doua bare deschise una peste alta ar impinge pagina cu vreo 100 px si n-ar spune nimic
 * in plus, deci fiecare cheie o coboara pe a ei si o ridica pe cealalta.
 *
 * Fasia anilor se poarta ca sora ei din Program: anul deschis vine la MIJLOC, dar numai DUPA ce bara
 * e la vedere (cat timp e ascunsa, offsetLeft si clientWidth sunt 0 si fasia s-ar deschide derulata
 * la cap), iar sagetile ‹ › se scriu doar daca anii chiar nu incap.
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
    bAni.appendChild(sageti[1]);
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

/** Anii in care au plecat numere, descrescator — cel de care e nevoie mereu, primul. */
export const ANII = (lista: Fisa[]): number[] => [...new Set(lista.map(anul))].sort((a, b) => b - a)

/** `q` null = bara cautarii sta inchisa; sir (chiar gol) = e coborata de la server. */
function sablon(o: {
  ctx: Ctx
  titlu: string
  corp: string
  meniu: Meniu
  /** arhiva intreaga: din ea ies bulina (ultimul numar) si anii din fasie — nu se scriu la mana */
  lista: Fisa[]
  q?: string | null
}): string {
  const q = o.q ?? null
  // Cheia si bara ei nu se pot contrazice: aprinderea lupei iese din acelasi `q`, iar anii din aceeasi
  // lista — nu dintr-un steag scris a doua oara de fiecare pagina.
  const meniu: Meniu = { ...o.meniu, cauta: q !== null, ani: ANII(o.lista) }
  const ultimul = ULTIMUL(o.lista)
  return pagina({
    nume: 'NEWSLETTER',
    titlu: 'Newsletter',
    titluPagina: o.titlu,
    acasa: `${o.ctx.prefix}/`,
    urlPlatforma: o.ctx.nav.home || '/',
    local: LOCAL,
    cont: contDin(o.ctx),
    versiune: o.ctx.versiune,
    modificata: o.ctx.modificata,
    indexabil: true,
    unelte: unelte(o.ctx, meniu, ultimul),
    // Fereastra de abonare e un <dialog>: se deschide peste pagina, deci locul ei aici nu conteaza,
    // numai sa fie scrisa o data. Barele, insa, trebuie sa stea CHIAR sub randul de unelte.
    subantet: `${baraAnilor(o.ctx, meniu)}\n    ${baraCautarii(o.ctx, q)}\n    ${fereastraNewsletterului(o.ctx)}`,
    corp: o.corp,
    scripturi: `${JS_BARE}${JS_ABONARE}`,
  })
}

/** Fereastra de abonare, cu adresa contului completata cand omul e intrat, si cu termenii platformei. */
function fereastraNewsletterului(ctx: Ctx): string {
  return fereastraAbonare({
    prefix: ctx.prefix,
    spre: ctx.spre ?? `${ctx.prefix}/`,
    urlTermeni: `${ctx.nav.home || ''}/termeni`,
    emailulContului: ctx.emailulContului ?? null,
  })
}

export function paginaGoala(ctx: Ctx): string {
  return sablon({
    ctx,
    titlu: 'Newsletter',
    lista: [],
    meniu: meniuLista(),
    corp: `<p class="gol">Arhiva e goală — nu s-a urcat încă niciun număr.</p>`,
  })
}

/**
 * Un numar, intreg. Asta e si prima pagina: acolo se deschide cel mai nou (user, 8 sept. 2026:
 * „pe home să fie doar randarea preview complet a unui News cu navigarea din antet"). Sub newsletter
 * nu mai sta nimic — mersul inainte e in antet, care ramane sus oricat ai derula, iar indarat se
 * merge prin Arhiva (vezi lamurirea meniului, in capul fisierului).
 */
export function paginaNumar(ctx: Ctx, lista: Fisa[], i: number, corp: string | null): string {
  const f = lista[i]!
  return sablon({
    ctx,
    titlu: f.subiect,
    lista,
    meniu: { peEcran: f, acum: i === lista.length - 1 },
    corp: `<h2>${esc(f.subiect)}</h2>
${corp ? `<div class="email">${corp}</div>` : `<p class="gol">Numărul acesta nu se găsește în depozit.</p>`}`,
  })
}

/** Un rand din lista unei luni: ziua la stanga, subiectul dupa ea. */
const rand = (ctx: Ctx, f: Fisa): string =>
  `<li><span class="cand">${esc(zilaScurt(f))}</span><a href="${esc(ctx.prefix)}/n/${f.id}">${esc(scurtat(f.subiect))}</a></li>`

/** Arhiva: patratele cu anii, iar dedesubt anul ales, spart pe luni. */
export function paginaArhiva(ctx: Ctx, lista: Fisa[], an: number | null): string {
  // ⚠️ PATRATELELE CU ANI AU IESIT DIN CORPUL PAGINII la 15.09.2026, odata cu bara de sub antet
  // („când apăs pe History, să apară o bară cu anii, la fel cum este la Program"). Anii se aleg acum
  // dintr-un singur loc, fasia; doua randuri de ani, unul sub altul, ar fi spus acelasi lucru de doua
  // ori. De aceea, pe pagina asta, fasia se scrie COBORATA si cheia de deasupra devine inerta.
  const ani = ANII(lista) // descrescator: cel mai nou primul
  if (!ani.length) return paginaGoala(ctx)
  const ales = an && ani.includes(an) ? an : ani[0]!

  // Anul, de la luna cea mai noua spre cea mai veche: cine intra in arhiva cauta mai degraba ce a
  // fost duminica trecuta decat ce a fost in ianuarie.
  const aleAnului = lista.filter((f) => anul(f) === ales)
  const peLuni = new Map<number, Fisa[]>()
  for (const f of aleAnului) {
    const l = luna(f)
    if (!peLuni.has(l)) peLuni.set(l, [])
    peLuni.get(l)!.push(f)
  }

  const corp = [...peLuni.keys()]
    .sort((a, b) => b - a)
    .map(
      (l) =>
        `<h2 class="luna">${LUNI[l - 1] ?? ''}</h2>
<ul class="numere">${peLuni
          .get(l)!
          .slice()
          .reverse()
          .map((f) => rand(ctx, f))
          .join('')}</ul>`,
    )
    .join('')

  return sablon({
    ctx,
    titlu: `Arhiva ${ales}`,
    lista,
    meniu: meniuLista({ arhiva: true, anDeschis: ales }),
    corp: `<p class="cate">${aleAnului.length} ${aleAnului.length === 1 ? 'număr trimis' : 'numere trimise'} în ${ales} · ${lista.length} cu totul, din ${ani[ani.length - 1]} încoace</p>
${corp}`,
  })
}

/** Pagina cautarii: cate un rand pe numar, cu ziua si anul in fata. */
export function paginaCautare(
  ctx: Ctx,
  lista: Fisa[],
  intrebare: string,
  gasite: Fisa[] | null,
  necaz: 'gol' | 'scurt' | null,
): string {
  const cuMeniu = (titlu: string, corp: string, q: string) =>
    sablon({ ctx, titlu, corp, q, lista, meniu: meniuLista() })

  if (necaz === 'gol') {
    return cuMeniu(
      'Căutare',
      `<p class="gol">Scrie un cuvânt și îl caut în toate cele ${lista.length} de numere — în subiect și în text.</p>`,
      '',
    )
  }
  if (necaz === 'scurt') {
    return cuMeniu('Căutare', `<p class="gol">Un cuvânt de o literă nu spune destul. Încearcă unul mai lung.</p>`, intrebare)
  }

  const lista_ = gasite ?? []
  const corp = lista_.length
    ? `<p class="cate">${lista_.length} ${lista_.length === 1 ? 'număr' : 'numere'} pentru „${esc(intrebare)}"</p>
<ul class="numere cu-an">${lista_
        .slice(0, 200)
        .map(
          (f) =>
            `<li><span class="cand">${esc(zilaScurt(f))} ${anul(f)}</span><a href="${esc(ctx.prefix)}/n/${f.id}">${esc(scurtat(f.subiect))}</a></li>`,
        )
        .join('')}</ul>${
        lista_.length > 200 ? `<p class="cate">Se arată primele 200. Caută mai strâmt ca să le vezi pe toate.</p>` : ''
      }`
    : `<p class="gol">Nimic pentru „${esc(intrebare)}". Încearcă un singur cuvânt, sau altul.</p>`

  return cuMeniu(`„${intrebare}"`, corp, intrebare)
}

/**
 * BULETIN NOU — ecranul adaugarii manuale, deschis din sageata pastilei (user, 15.09.2026: „săgeată
 * pentru buletin nou (adăugare manuală - actualizare program sau altceva)").
 *
 * ⚠️ DEOCAMDATA NU SCRIE NIMIC IN DEPOZIT, si o spune pe fata. Compunerea — felul buletinului,
 * textul, urcarea in R2 si intrarea in `lista.json` si in `cauta.json` — s-a hotarat cu userul
 * pentru runda urmatoare. Pagina exista de pe acum ca sageata din antet sa nu cada intr-un „Nu
 * există": un buton care duce in 404 e mai rau decat unul care spune cinstit unde s-a ajuns.
 *
 * ⚠️ Poarta e `ctx.eAdmin`, ca Arhiva Programului — fara cheie noua de permisiune, care ar fi cerut
 * si republicarea lui `xc-authz`. Cand ecranul chiar va scrie in depozit, aici se pune cheia.
 */
export function paginaNou(ctx: Ctx, lista: Fisa[]): string {
  const ultimul = ULTIMUL(lista)
  const cate = `${lista.length} ${lista.length === 1 ? 'număr trimis' : 'numere trimise'}`
  return sablon({
    ctx,
    titlu: 'Buletin nou',
    lista,
    meniu: meniuLista({ nou: true }),
    corp: `<h2>Buletin nou</h2>
<p class="gol">Aici se adaugă manual un buletin — o actualizare de program sau altceva.</p>
<p class="cate">Ecranul de compunere se face în runda următoare. Până atunci newsletterul rămâne ce a
fost de la aducerea lui în V2: <b>arhiva</b>, ${cate} — nu scrie în depozit și nu trimite nimic.</p>
${ultimul
      ? `<p class="cate">Ultimul număr: <a href="${esc(ctx.prefix)}/n/${ultimul.id}">${esc(scurtat(ultimul.subiect))}</a>, ${esc(ziuaLunga(ultimul))}.</p>`
      : ''}`,
  })
}

/** Pagina scurta de mesaj (nu există, eroare) — cu antetul intreg. */
export function paginaMesaj(ctx: Ctx, lista: Fisa[], titlu: string, corp: string): string {
  return sablon({
    ctx,
    titlu,
    corp: `<h2>${esc(titlu)}</h2>\n${corp}`,
    lista,
    meniu: meniuLista(),
  })
}
