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
 *   - cel mai nou numar (si prima pagina)  → „Nr. curent";
 *   - un numar din arhiva                  → data lui („8 septembrie 2026");
 *   - pagina Arhivei                       → „Arhiva";
 *   - ecranul buletinului nou              → „Buletin nou";
 *   - pagina cautarii                      → „Căutare".
 *
 * ⚠️ Forma scurta se scrie ALATURI, nu in locul celei lungi, si se schimba din CSS la ecrane mici.
 * ⚠️ NU e un buton: nu duce nicaieri si nu se apasa (vezi `.acum` din `stil.ts`, fundal de hartie).
 */
function scrisulNumarului(m: Meniu): string {
  const zona = (lung: string, scurt: string, titlu: string) =>
    `<span class="acum" title="${esc(titlu)}"><b class="lung">${esc(lung)}</b><b class="scurt">${esc(scurt)}</b></span>`
  if (m.nou) return zona('Buletin nou', 'Nou', 'Adăugarea manuală a unui buletin')
  if (m.arhiva) return zona('Arhiva', 'Arhiva', 'Arhiva newsletterului')
  if (!m.peEcran) return zona('Căutare', 'Căutare', 'Căutare în newsletter')
  if (m.acum) return zona('Nr. curent', 'Curent', `Numărul curent — ${ziuaLunga(m.peEcran)}`)
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
  const arhiva = `<a class="btn arh${m.arhiva ? ' activ' : ''}" href="${p}/arhiva"`
    + ` title="Arhiva pe ani și luni" aria-label="Arhiva newsletterului">${IC_ARHIVA}</a>`
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
 * Cheia-lupa coboara si ridica bara de dedesubt. O singura bara, deci n-are pe cine sa ridice — dar
 * daca mai coboara vreuna din pastila (anii, ca la Program), aici se scrie excluderea lor, ca la
 * Calendar: doua bare deschise una peste alta ar impinge pagina si n-ar spune nimic in plus.
 *
 * ⚠️ Fara accent grav in comentariile de aici: scripturile sunt template literals.
 */
const JS_CAUTARE = `
(function(){
  var bara=document.getElementById("bara-cautare"),cheie=document.getElementById("cautare-cheie");
  if(!bara||!cheie) return;
  cheie.addEventListener("click",function(){
    var deschisa=!bara.hidden;
    bara.hidden=deschisa;
    cheie.setAttribute("aria-expanded",deschisa?"false":"true");
    if(!deschisa){var c=bara.querySelector("input"); if(c) c.focus();}
  });
})();`

/** `q` null = bara cautarii sta inchisa; sir (chiar gol) = e coborata de la server. */
function sablon(o: {
  ctx: Ctx
  titlu: string
  corp: string
  meniu: Meniu
  ultimul: Fisa | null
  q?: string | null
}): string {
  const q = o.q ?? null
  // cheia si bara ei nu se pot contrazice: aprinderea lupei iese din acelasi `q`, nu dintr-un steag
  // scris a doua oara de fiecare pagina
  const meniu: Meniu = { ...o.meniu, cauta: q !== null }
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
    unelte: unelte(o.ctx, meniu, o.ultimul),
    // Fereastra de abonare e un <dialog>: se deschide peste pagina, deci locul ei aici nu conteaza,
    // numai sa fie scrisa o data. Bara, insa, trebuie sa stea CHIAR sub randul de unelte.
    subantet: `${baraCautarii(o.ctx, q)}\n    ${fereastraNewsletterului(o.ctx)}`,
    corp: o.corp,
    scripturi: `${JS_CAUTARE}${JS_ABONARE}`,
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
    ultimul: null,
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
    ultimul: lista[lista.length - 1] ?? null,
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
  const ani = [...new Set(lista.map(anul))].sort((a, b) => a - b)
  if (!ani.length) return paginaGoala(ctx)
  const ales = an && ani.includes(an) ? an : ani[ani.length - 1]!

  // Anii, ca lunile si ca zilele: cel mai nou primul (user, 8 sept. 2026 — crescatori, anul de fata
  // ajungea ultimul, tocmai pe randul al doilea, unde nu-l cauta nimeni).
  const patratele = `<nav class="capitole">${ani
    .slice()
    .reverse()
    .map((a) => (a === ales ? `<b class="acum">${a}</b>` : `<a href="${esc(ctx.prefix)}/arhiva/${a}">${a}</a>`))
    .join('')}</nav>`

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
    ultimul: lista[lista.length - 1] ?? null,
    meniu: meniuLista({ arhiva: true }),
    corp: `${patratele}
<p class="cate">${aleAnului.length} ${aleAnului.length === 1 ? 'număr trimis' : 'numere trimise'} în ${ales} · ${lista.length} cu totul, din ${ani[0]} încoace</p>
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
    sablon({ ctx, titlu, corp, q, ultimul: ULTIMUL(lista), meniu: meniuLista() })

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
    ultimul,
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
    ultimul: ULTIMUL(lista),
    meniu: meniuLista(),
  })
}
