/**
 * Paginile calendarului. Markup-ul, clasele si textele sunt cele din V1 (cerere user,
 * 10.09.2026: „să respecți mesajele și grafica din V1"); ce s-a schimbat tine de structura
 * platformei, nu de infatisare: abonarea merge prin serviciul de comunicare, iar adresele
 * poarta prefixul aplicatiei (in preview toate stau pe acelasi host).
 */
import type { ZiLiturgica } from '@xc/contracts'
import type { Navigatie } from '@xc/config'
import { LUNI, STIL_COMUN, ZILE_SAPTAMANA, esc, momentLizibil, pagina } from '@xc/ui'
import { JS_ABONARE, STIL_ABONARE, abonamentul, butonAbonare, fereastraAbonare } from '@xc/abonare'
import type { PericopaCuText } from './biblia.js'
import type { Import, Versiune } from './depozit.js'
import { LOCAL } from './stil.js'
import { type RandDesfacut, type RandZi } from './traducere.js'

export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
  /** Adresa contului — fereastra de abonare o scrie in camp si o incuie; `null` la neautentificat. */
  emailulContului?: string | null
  /**
   * Administratorul CALENDARULUI. ⚠️ Din 18.09.2026 vine din cheia aplicatiei (`calendar.manage`),
   * nu din rolul global: un om poate fi admin numai aici. Tot ce vedea pana acum „adminul" in
   * Calendar (filtrul evlaviei, uneltele) atarna de el si mai departe.
   */
  eAdmin: boolean
  /** Rolul global — DOAR randul „Administrare" din meniul contului atarna de el. */
  eAdminPlatforma?: boolean
  versiune: string
  modificata: string
  /** Anul curent la Bucuresti: sirul lunilor nu iese din el (afara de ianuarie anul viitor). */
  anCurent: number
  /** „Vezi ca" — vin din sesiune, gata calculate de identitate; doar pentru meniu si banda. */
  veziCa?: string | null
  poateVedeaCa?: boolean
  spre?: string
}

export const NOTA_GENERAT = 'Calendar generat automat'
const ZILE_SCURT = ['Du', 'Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ']

/**
 * Iconitele listelor de sarbatori (12.09.2026, user: „în loc de butonul de info să fie două butoane
 * cu Sărbătorile… pune niște iconițe acolo"). Meniul „Informații utile" a iesit cu totul: cele doua
 * liste care statau in el au urcat in rand, fiecare cu butonul ei.
 *
 * Crucea e aceeasi pentru amandoua — ce le deosebeste e CULOAREA, cum le deosebeste si calendarul
 * tiparit; culoarea vine din clasa butonului (`.sarb-rosie` / `.sarb-neagra`), nu din desen, ca sa
 * asculte de tema de noapte. Pe telefon ramane doar iconita, fara cuvinte, si atunci culoarea e
 * singurul semn — de aceea numele intreg sta oricum in `title` si in `aria-label`.
 */
const IC_CRUCE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3.5v17"/><path d="M6.5 9h11"/></svg>`

/** Cheia care coboara sirul lunilor: o fila de calendar (user, 15.09.2026: „un buton - ico calendar"). */
const IC_CALENDAR = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>`

/** Cheia cautarii: lupa (user, 15.09.2026: „o iconiță lupă de căutare înainte de cruce"). */
const IC_LUPA = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 21 21"/></svg>`

// ---------------------------------------------------------------------------
// Bucatile antetului
// ---------------------------------------------------------------------------

function contDin(ctx: Ctx) {
  return {
    intrat: !!ctx.utilizator,
    nume: ctx.utilizator ?? 'Cont',
    // ⚠️ Randul „Administrare" duce la panoul PLATFORMEI, deci atarna de rolul global, nu de adminul
    // Calendarului (18.09.2026): acolo un admin de aplicatie n-are ce face.
    admin: ctx.eAdminPlatforma ?? false,
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
 * BARA DE SUS E UN SET DE FILTRE (user, 12.09.2026, 11:12: „tot ce este în bara de sus, cu excepția
 * butonului de azi, este ca un filtru"). Doua filtre, care lucreaza impreuna peste aceeasi lista:
 *
 *   - LUNILE, in pastila: alegi luna, se arata luna aceea. „Toate lunile" o deselecteaza si atunci
 *     lista se intinde peste anul intreg.
 *   - FELUL CRUCII, cele doua butoane: rosie lasa in lista doar sfintii cu cruce rosie SI duminicile,
 *     neagra doar sfintii cu cruce neagra. Sunt RECIPROC EXCLUSIVE („aceste două filtre se exclud
 *     reciproc") si se sting apasand inca o data pe cel aprins.
 *
 * Ele se pastreaza unul pe altul: schimbi luna, filtrul crucii ramane pus; schimbi felul crucii,
 * luna ramane. De aceea adresele se scriu una din alta si nu se mai duce nicaieri „la o pagina de
 * sarbatori" — sunt stari ale aceleiasi liste. Ce se vede pe unde:
 *
 *   `/<an>-<luna>`                  luna intreaga
 *   `/<an>-<luna>?filtru=rosie`     luna, numai zilele rosii si duminicile
 *   `/sarbatori/cruce-rosie/<an>`  anul intreg, numai zilele rosii („toate lunile")
 *
 * ⚠️ ABONAREA se cheama „Abonare" („butonul după navigare să se numească Abonare"), sta indata dupa
 * navigare si NU se scrie la administratori — ca la Program, unde butonul e tot al omului fara
 * drepturi. Ea NU e un filtru; e singurul lucru din bara care face altceva, si de aceea sta despartita
 * de ele prin bara verticala. Butonul deschide fereastra (user: „la click pe Abonare să apară un
 * pop-up la fel") — vezi `fereastraAbonare`.
 *
 * Rândul filtrului pus se scrie marcat (`.activ`, rosu); apasat inca o data, il stinge.
 *
 * ⚠️ FILTRELE ATARNA DE ROL (user, 13.09.2026, 01:26: „sunt felul cum afectează rolul userului a ce
 * vede în app" — regula noua, ceruta anume): neautentificatul n-are niciun filtru, utilizatorul le
 * are pe primele doua (rosie, neagra), adminul pe toate trei. Vezi `poateFiltra`. Rândurile fara
 * drept se STING, nu se ascund (regula userului din 11–12.09.2026: „se ascund și strică interfața") —
 * raman la locul lor, palite, cu pricina scrisa sub nume.
 *
 * ⚠️ „SFINȚI CU EVLAVIE" FACE EXCEPTIE DE LA REGULA ASTA, DIN 15.09.2026 (user, cele trei trepte
 * scrise anume: neautentificatul „să nu vadă ultima cruce deloc", utilizatorul „să nu vadă ultima
 * cruce dar să poată apăsa celelalte două", adminul „să vadă toate 3 crucile și să le poată apăsa").
 * Deci rândul lui NU se scrie palit celor fara drept — nu se scrie deloc. Vezi `poateVedeaFiltrul`.
 * (Adminul si super-adminul sunt aceeasi treapta aici: `ctx.eAdmin` le tine pe amandoua.)
 */
function unelte(o: {
  ctx: Ctx
  /** anul si luna paginii, pentru scrisul din pastila si pentru marcajul lunii deschise */
  an: number
  /** `0` = nicio luna nu e a paginii (listele de an) */
  luna: number
  azi: string
  /** filtrul de fel pus acum, daca e vreunul */
  felActiv?: FelFiltru
  /** luna peste care lucreaza filtrele, „<an>-<luna>"; lipseste cand lista tine anul intreg */
  lunaFiltru?: string
}): string {
  /*
   * ⚠️ RANDUL TINE INTOTDEAUNA TOATA LATIMEA (user, 15.09.2026: „bara de sus din antet, meniul să fie
   * 100% mereu"). Doua bucati, si atat: PASTILA, care ia tot ce ramane, si ABONAREA, cu masura ei
   * fixa, lipita de marginea din dreapta.
   *
   * ⚠️ CRUCEA A INTRAT ÎN PASTILĂ, după cheia calendarului (user, 15.09.2026: „mută butonul cu cruce
   * după calendar… toată pastila asta fă-o sută la sută cu butoanele de dimensiuni fixe… dar zona cu
   * data curentă, luna și anul să fie maximă"). Nu mai e un buton de sine stătător la capătul
   * rândului: e al patrulea segment al pastilei, fără chenar propriu — altfel ar fi fost iar „buton
   * în alt buton", reclamația de acum o oră.
   */
  return `${pastilaLocului(o.ctx, o.an, o.luna, o.azi, meniulFiltrelor(o))}${butonAbonare(ABONAMENT)}`
}

/**
 * FILTRELE — O SINGURĂ CRUCE, LA DREAPTA, CU UN MENIU SUB EA (user, 15.09.2026: „fă o singură cruce
 * la dreapta, pe care, atunci când apeși, să apară un mic meniu").
 *
 * ⚠️ PRICINA E SPAȚIUL, nu gustul: userul a cerut-o ca să încapă DATA din pastilă, mai ales pe
 * telefon („neapărat să se vadă scrisul de după azi… cu data curentă sau cu luna selectată"). Trei
 * cruci una lângă alta mâncau ~120 px din rând; una singură lasă ~80 px datei. Dacă vreodată se
 * întorc cele trei butoane în rând, se întoarce și înghesuiala — și atunci data cade prima.
 *
 * ⚠️ ACUM FILTRELE AU CUVINTE, și asta răstoarnă regula din 12.09.2026 („pe desktop, iconițele cu
 * cruci lasă-le fără text"). Atunci numele nu încăpeau în rând, deci rămânea culoarea crucii ca
 * singur semn; într-un meniu încap, iar userul le-a scris el însuși, pe rânduri: „sfinți cu cruce
 * roșie / sfinți cu cruce neagră / sfinți cu evlavie". Culoarea crucii a rămas lângă nume, nu în
 * locul lui. De aceea `meniu` e alt câmp decât `nume`: numele lung („Sărbători cu cruce roșie")
 * rămâne al PAGINILOR, unde lista chiar e de zile, nu de sfinți.
 *
 * ⚠️ E `<details>`, NU un panou deschis din JS: așa meniul se deschide și fără JavaScript, iar
 * filtrele rămân niște legături adevărate pentru oricine. JS-ul adaugă doar bunele purtări —
 * închiderea la Escape și la o apăsare în afara lui (`JS_FILTRE`).
 *
 * Meniul nu se scrie deloc dacă omul n-are niciun rând de văzut.
 */
function meniulFiltrelor(o: { ctx: Ctx; felActiv?: FelFiltru; lunaFiltru?: string }): string {
  const p = esc(o.ctx.prefix)
  const an = o.ctx.anCurent
  // Cu o luna in brate, filtrul se pune pe ea; fara luna (lista anului) se trece la lista de an a
  // celuilalt fel. Stins, drumul inapoi e luna neatinsa — ori, daca nu suntem pe nicio luna, nimic.
  const cuFel = (fel: FelFiltru) => (o.lunaFiltru ? `${p}/${o.lunaFiltru}?filtru=${fel}` : `${p}/sarbatori/${FILTRE[fel].slug}/${an}`)
  const faraFel = o.lunaFiltru ? `${p}/${o.lunaFiltru}` : ''

  const feluri = (['rosie', 'neagra', 'evlavie'] as FelFiltru[]).filter((f) => poateVedeaFiltrul(o.ctx, f))
  const apasabile = feluri.filter((f) => poateFiltra(o.ctx, f))

  /*
   * ⚠️ CINE N-ARE NICIUN FILTRU APĂSABIL PRIMEȘTE CRUCEA STINSĂ, FĂRĂ MENIU (user, 15.09.2026, după
   * ce s-a răzgândit de două ori în cincisprezece minute — asta e forma pe care a ales-o):
   * „să se afișeze disabled, doar să nu mai afișeze nimic atunci când apeși pe ea… să nu reacționeze
   * nici la apăsare și să nu afișeze butoanele de sub ea din meniul ei".
   *
   * Azi asta înseamnă neautentificatul, dar regula e scrisă pe DREPT, nu pe treaptă: un meniu care
   * s-ar deschide numai ca să arate trei rânduri moarte nu spune nimic în plus față de o cruce
   * stinsă — și cere o apăsare în plus ca s-o afle.
   *
   * ⚠️ NU e un `<details>`: e un `<span>`. Un `<details>` „dezactivat" nu există în HTML — s-ar fi
   * deschis oricum la apăsare, iar oprirea ar fi căzut pe JS, deci ar fi mers doar cu JS. Așa,
   * crucea chiar nu reacționează, cu sau fără JavaScript. Pricina stă în `title`.
   */
  if (!apasabile.length) {
    const pricina = FILTRE[feluri[0] ?? 'rosie'].cere
    const spune = `Sărbătorile — ${pricina}`
    return `<span class="btn mic sarb sarb-cheie gol" aria-disabled="true"`
      + ` title="${esc(spune)}" aria-label="${esc(spune)}">${IC_CRUCE}</span>`
  }

  const rand = (fel: FelFiltru) => {
    const f = FILTRE[fel]
    const nume = esc(f.meniu)
    const clasa = `f-rand f-${fel}`
    const pus = o.felActiv === fel
    // fara dreptul lui, randul se scrie palit: se vede ca exista, iar pricina sta scrisa sub nume —
    // ca omul sa stie ce-i lipseste, nu doar ca nu merge
    if (!poateFiltra(o.ctx, fel)) {
      return `<span class="${clasa} gol" role="menuitem" aria-disabled="true">${IC_CRUCE}`
        + `<span class="f-text"><b>${nume}</b><small>${esc(f.cere)}</small></span></span>`
    }
    const unde = pus ? faraFel : cuFel(fel)
    // pus, dar fara drum inapoi (lista anului, fara luna): randul ramane marcat si neapasabil
    if (pus && !unde) {
      return `<span class="${clasa} activ" role="menuitem" aria-current="page">${IC_CRUCE}`
        + `<span class="f-text"><b>${nume}</b></span></span>`
    }
    const spune = pus ? '<small>apasă ca să scoți filtrul</small>' : ''
    return `<a class="${clasa}${pus ? ' activ' : ''}" role="menuitem" href="${unde}"${pus ? ' aria-current="page"' : ''}>`
      + `${IC_CRUCE}<span class="f-text"><b>${nume}</b>${spune}</span></a>`
  }

  // Crucea din rand imprumuta CULOAREA filtrului pus, ca sa se vada dintr-o privire ca lista e taiata
  // — altfel meniul inchis n-ar spune nimic despre starea paginii.
  const activ = o.felActiv && poateFiltra(o.ctx, o.felActiv) ? o.felActiv : null
  const numeButon = activ ? `Sărbătorile — ${FILTRE[activ].meniu.toLowerCase()}` : 'Sărbătorile'
  // ⚠️ Fara `role="button"` pe <summary>: browserul ii da singur rolul de deschizator ȘI starea
  // „deschis/inchis"; scris de mana, rolul o stinge, iar cititorul de ecran nu mai spune daca meniul
  // e deschis. Semantica nativa e mai bogata decat una pusa peste ea.
  return `<details class="filtre" id="filtre">
      <summary class="btn mic sarb sarb-cheie${activ ? ` activ sarb-${activ}` : ''}"
        title="${esc(numeButon)}" aria-label="${esc(numeButon)}">${IC_CRUCE}</summary>
      <div class="filtre-meniu" role="menu" aria-label="Sărbătorile">${feluri.map(rand).join('')}</div>
    </details>`
}

/**
 * Bunele purtări ale meniului de filtre: se închide la Escape și la o apăsare în afara lui.
 * Deschiderea nu e aici — o face `<details>` singur, deci merge și fără JavaScript.
 */
const JS_FILTRE = `
(function () {
  var d = document.getElementById('filtre');
  if (!d) return;
  document.addEventListener('click', function (ev) {
    if (d.open && !d.contains(ev.target)) d.open = false;
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && d.open) { d.open = false; d.querySelector('summary').focus(); }
  });
})();
`

/**
 * ABONAREA — butonul, fereastra si tot drumul de dupa ea stau acum in `@xc/abonare`, pachetul comun
 * (user, 15.09.2026: „ar trebui să fie la fel peste tot. Nu ar trebui să copiez logica în mai multe
 * locuri"). Pana atunci fereastra era copiata aici, la Program, la Buletin si la Tipic, identica
 * litera cu litera, si nu trimitea nimic nicaieri.
 *
 * ⚠️ Ce a ramas al calendarului: **rândul din registru**, atat. Adica audienta in care se scrie
 * omul — singurul lucru deosebit de la o aplicatie la alta.
 *
 * ⚠️ BUTONUL E AL TUTUROR, SI AL ADMINILOR (user, 12.09.2026, 13:39: „să lăsăm totuși iconița de
 * abonare și la admini. Că și ei se comportă ca un utilizator care poate vor să fie anunțați. Aici nu
 * e vorba doar despre mine, care sunt super admin"). Regula sta acum in pachet, langa buton.
 */
const ABONAMENT = abonamentul('calendar')

/** Fereastra, cu adresa contului completata cand omul e intrat, si cu termenii platformei. */
function fereastraCalendarului(ctx: Ctx): string {
  return fereastraAbonare({
    prefix: ctx.prefix,
    spre: ctx.spre ?? `${ctx.prefix}/`,
    urlTermeni: `${ctx.nav.home || ''}/termeni`,
    emailulContului: ctx.emailulContului ?? null,
  })
}

/**
 * Scriptul NAVIGARII — merge pe TOATE paginile care au pastila in antet (luna, ziua, sarbatorile),
 * nu doar pe pagina lunii ca pana la 12.09.2026. Face trei lucruri:
 *
 *   - aduce luna deschisa la mijlocul pastilei, daca pastila se deruleaza;
 *   - pune sagetile ‹ › pentru cine n-are deget (mouse fara roata orizontala). ⚠️ Ele se scriu DOAR
 *     daca lunile chiar nu incap: pe desktop, in pastila lata cat randul, incap toate, iar doua
 *     sageti moarte ar fi doua segmente in plus care ar strica tocmai forma ceruta;
 *   - leaga bulina de ziua de azi, acolo unde ziua e in pagina (lista lunii). Pe celelalte pagini
 *     bulina ramane un link adevarat catre luna de azi, cu ancora #azi.
 */
const JS_NAV = `
(function () {
  var bara = document.getElementById('bara-luni');
  var cheie = document.getElementById('luni-cheie');
  var fasie = document.querySelector('.fasie');

  // ——— luna deschisa la mijlocul fasiei
  // ⚠️ Se masoara DUPA ce bara e la vedere: cat timp e \`hidden\`, offsetLeft si clientWidth sunt 0,
  // iar sirul s-ar deschide derulat la cap (se vedea IAN in loc de luna curenta). De aceea asezarea
  // se cheama la fiecare coborare a barei, nu o data la incarcare.
  function aseaza() {
    if (!fasie) return;
    var lunaDeschisa = fasie.querySelector('.luna-buton.activa');
    if (lunaDeschisa) {
      fasie.scrollLeft = lunaDeschisa.offsetLeft - (fasie.clientWidth - lunaDeschisa.offsetWidth) / 2;
    }
  }

  /* ⚠️ BARA LUNILOR E A DOUA, SI PORNESTE ASCUNSA (user, 15.09.2026: „bara scrolată cu lunile…
     aș vrea să se mute într-o bară secundară, inițial ascunsă sub zona de antet"). Cheia din pastila
     o coboara si o ridica. NU trebuie inchisa la alegerea unei luni: alegerea e o NAVIGARE, iar
     pagina urmatoare se scrie oricum cu bara ascunsa. */
  /* ⚠️ BARELE CARE COBOARĂ DIN PASTILĂ SUNT DOUĂ, ȘI SE EXCLUD: lunile și căutarea. Două bare
     deschise una peste alta ar împinge lista cu vreo 100 px în jos și n-ar spune nimic în plus —
     fiecare cheie o coboară pe a ei și o ridică pe cealaltă. */
  var baraCauta = document.getElementById('bara-cautare');
  var cheieCauta = document.getElementById('cautare-cheie');

  function ridica(b, c) {
    if (!b || b.hidden) return;
    b.hidden = true;
    if (c) c.setAttribute('aria-expanded', 'false');
  }

  // pe pagina rezultatelor bara căutării vine coborâtă de la server, deci cheia e deja „deschisă"
  if (baraCauta && cheieCauta && !baraCauta.hidden) cheieCauta.setAttribute('aria-expanded', 'true');

  if (bara && cheie) {
    cheie.addEventListener('click', function () {
      var deschisa = !bara.hidden;
      bara.hidden = deschisa;
      cheie.setAttribute('aria-expanded', deschisa ? 'false' : 'true');
      if (!deschisa) { ridica(baraCauta, cheieCauta); aseaza(); if (typeof capete === 'function') capete(); }
    });
  }

  /* Căutarea: aceeași purtare ca la lunile de mai sus, plus cursorul dus în câmp — cine apasă lupa
     vrea să scrie, nu să mai apese o dată. Pe pagina rezultatelor bara vine deschisă de la server,
     iar textul se selectează, ca a doua căutare să se scrie peste prima. */
  if (baraCauta && cheieCauta) {
    cheieCauta.addEventListener('click', function () {
      var deschisa = !baraCauta.hidden;
      baraCauta.hidden = deschisa;
      cheieCauta.setAttribute('aria-expanded', deschisa ? 'false' : 'true');
      if (!deschisa) {
        ridica(bara, cheie);
        var camp = baraCauta.querySelector('.cauta-camp');
        if (camp) { camp.focus(); camp.select(); }
      }
    });
  }

  if (fasie) {
    var sageti = ['‹', '›'].map(function (semn, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sageata';
      b.textContent = semn;
      b.setAttribute('aria-label', i ? 'lunile următoare' : 'lunile dinainte');
      b.addEventListener('click', function () {
        fasie.scrollBy({ left: (i ? 1 : -1) * Math.max(150, fasie.clientWidth * 0.6), behavior: 'smooth' });
      });
      return b;
    });
    var capete = function () {
      var incap = fasie.scrollWidth <= fasie.clientWidth + 2;
      sageti[0].hidden = incap;
      sageti[1].hidden = incap;
      sageti[0].disabled = fasie.scrollLeft < 2;
      sageti[1].disabled = fasie.scrollLeft > fasie.scrollWidth - fasie.clientWidth - 2;
    };
    fasie.parentNode.insertBefore(sageti[0], fasie);
    fasie.parentNode.appendChild(sageti[1]);
    fasie.addEventListener('scroll', capete, { passive: true });
    window.addEventListener('resize', capete);
    capete();
  }

  // ——— ziua de azi se aseaza la MIJLOCUL ecranului, nu sub antet
  var randAzi = document.getElementById('azi');
  function laAzi(lin) {
    if (!randAzi) return;
    randAzi.scrollIntoView({ block: 'center', behavior: lin ? 'smooth' : 'instant' });
  }

  /* ⚠️ LA INTRAREA IN PAGINA, AȘEZAREA SE FACE DE MAI MULTE ORI, ȘI FĂRĂ LIN — altfel ziua iese
     LIPITĂ DE ANTET, nu la mijloc (user, 15.09.2026: „inițial se duce în pagina care trebuie și îmi
     scrolează până la nivelul zilei - sunt top cu ea… dacă apăs a doua oară, mă poziționează pe
     mijlocul paginii"). ⚠️ Nu e o boală a telefonului — userul a găsit-o pe mobil, dar a confirmat-o
     îndată și pe desktop: e o CURSĂ, și cursele nu țin de lățimea ecranului.
     Trei pricini se adunau, toate numai la PRIMA venire în pagină:

       1. cu ancora #azi în adresă, BROWSERUL își face singur saltul la ea, iar el o duce sub antet
          (scroll-padding-top:130px), nu la mijloc — și saltul lui venea DUPĂ centrarea noastră;
       2. carcasa are scroll-behavior:smooth pe radacina, deci saltul acela e o animație în curs;
          o centrare pornită în timpul ei e înghițită de ea;
       3. setTimeout(…, 0) măsura pagina înainte să se așeze (fonturi, poze) — pe telefon, unde
          rândurile se rup altfel, greșeala se vedea cel mai tare.

     De aceea: se stinge linul cât ținem noi cârma, se așază pe loc, apoi încă o dată după ce
     browserul a desenat un cadru, și încă o dată după load (poze și fonturi gata). O săritură
     INSTANTANEE taie orice animație pornită de browser — de-aia nu e „smooth" aici.
     Apăsarea butonului, în schimb, rămâne LINĂ: acolo pagina e deja așezată și omul vede mișcarea. */
  function asazaAzi() {
    if (!randAzi) return;
    var radacina = document.documentElement;
    radacina.classList.add('fara-lin');
    laAzi();
    requestAnimationFrame(function () {
      laAzi();
      radacina.classList.remove('fara-lin');
    });
  }
  /* Semnul intrării: ancora #azi (venit de pe butonul „Astăzi" al altei luni) ori clasa la-azi,
     scrisă de server NUMAI la adresa fără lună — nu și când omul a ales el o lună din șir, unde o
     săritură nesolicitată ar fi o răpire. */
  if (randAzi && (location.hash === '#azi' || document.body.classList.contains('la-azi'))) {
    asazaAzi();
    if (document.readyState === 'complete') requestAnimationFrame(asazaAzi);
    else window.addEventListener('load', asazaAzi);
  }

  var butonAzi = document.querySelector('.azi-buton');
  if (butonAzi && randAzi) {
    butonAzi.addEventListener('click', function (ev) {
      ev.preventDefault();
      if (location.hash !== '#azi') history.replaceState(history.state, '', '#azi');
      laAzi(true);
    });
  }
  window.addEventListener('hashchange', function () { if (location.hash === '#azi') laAzi(true); });
})();
`

/** Scriptul paginii de lună: navigarea, meniul filtrelor, abonarea și fereastra cu textele zilei. */
function script(prefix: string): string {
  return JS_NAV + JS_FILTRE + `
(function () {
  var PREFIX = ${JSON.stringify(prefix)};

  // ——— fereastra cu textele zilei
  var fereastra = document.getElementById('fereastra');
  if (!fereastra || !fereastra.showModal) return;
  var cuprins = fereastra.querySelector('.cuprins-fereastra');
  var stiute = {};
  var curent = '';

  function scrie(t, parte) {
    var eSinaxar = parte === 'sinaxar';
    var titlu = (!eSinaxar && t.sinaxar)
      ? '<a href="' + PREFIX + '/zi/' + t.data + '/sinaxar" data-fereastra="sinaxar" data-zi="' + t.data + '">' + t.titlu + '</a>'
      : t.titlu;
    var corp = '<p class="fel-fereastra">' + (eSinaxar ? 'Sinaxar' : 'Lectura zilei') + '</p>'
      + '<h2 class="titlu-fereastra">' + titlu + '</h2>'
      + '<p class="cand-fereastra">' + t.cand + '</p>';
    if (eSinaxar) {
      corp += t.sinaxar || '<p class="gol">Ziua aceasta n-are sinaxar în calendarul oficial.</p>';
    } else {
      corp += t['apostolul-evanghelia'] ||
        '<p class="gol">Ziua aceasta n-are Apostol și Evanghelie în calendarul oficial.</p>';
    }
    cuprins.innerHTML = corp;
    cuprins.scrollTop = 0;
  }

  function deschide(zi, parte) {
    curent = zi + '/' + parte;
    if (!fereastra.open) fereastra.showModal();
    if (stiute[zi]) { scrie(stiute[zi], parte); return; }
    cuprins.innerHTML = '<p class="gol">se încarcă…</p>';
    var cerut = curent;
    fetch(PREFIX + '/v1/texte/' + zi)
      .then(function (r) { return r.json(); })
      .then(function (t) {
        stiute[zi] = t;
        if (fereastra.open && curent === cerut) scrie(t, parte);
      })
      .catch(function () {
        if (curent === cerut) cuprins.innerHTML = '<p class="gol">Textele nu s-au putut încărca.</p>';
      });
  }

  function inchide() {
    curent = '';
    if (fereastra.open) fereastra.close();
  }

  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target && ev.target.closest ? ev.target.closest('a[data-fereastra]') : null;
    if (!a) return;
    ev.preventDefault();
    var zi = a.getAttribute('data-zi');
    var parte = a.getAttribute('data-fereastra');
    history.pushState({ fereastra: true, zi: zi, parte: parte }, '', a.getAttribute('href'));
    deschide(zi, parte);
  });

  fereastra.addEventListener('click', function (ev) { if (ev.target === fereastra) fereastra.close(); });
  fereastra.querySelector('.inchide').addEventListener('click', function () { fereastra.close(); });
  fereastra.addEventListener('close', function () {
    curent = '';
    if (history.state && history.state.fereastra) history.back();
  });
  window.addEventListener('popstate', function (ev) {
    var s = ev.state;
    if (s && s.fereastra) deschide(s.zi, s.parte);
    else inchide();
  });
})();
` + JS_ABONARE
}

// ---------------------------------------------------------------------------
// Ziua, in lista
// ---------------------------------------------------------------------------

function clasaEtichetei(e: { fel: string; text: string }): string {
  return e.fel === 'post' ? `post-${slug(e.text)}` : e.fel
}

export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replaceAll('ș', 's').replaceAll('ț', 't')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function semnele(d: RandDesfacut, alege?: (e: { fel: string }) => boolean): string {
  return d.etichete
    .filter((e) => !alege || alege(e))
    .map((e) => `<span class="semn ${clasaEtichetei(e)}">${esc(e.text)}</span>`)
    .join('')
}
const E_POST = (e: { fel: string }) => e.fel === 'post'
const E_LIBERA = (e: { fel: string }) => e.fel === 'libera'

/** Titlul zilei: la duminici, numele duminicii; altfel titlul intreg, cu marcajul sursei. */
function capulZilei(d: RandDesfacut): string {
  if (!d.eDuminica) return d.titluHtmlCurat
  return d.denumire ? esc(d.denumire) : d.titluHtmlCurat
}

/**
 * CE RANGURI DE SFANT TINE FIECARE FEL DE CRUCE.
 *
 * ⚠️ Regula e a calendarului tiparit, spusa de utilizator la 12.09.2026, 12:56 („sfinții cu albastru
 * au cruce în față / este neagră - de ce nu apar?"): **fiecare sfant cu semn are o cruce, iar culoarea
 * ei e rosie numai la zilele cu tinere; in rest e neagra.** Albastrul NU e un fel de cruce — e
 * culoarea cu care Patriarhia scrie sfintii romani. Crucea lor e tot neagra.
 *
 * De aceea la „cruce neagră" intra si `cruce_albastra` (sfintii romani cu semn: 113 in 2026, toti cu
 * cruce, si niciunul nu aparea in lista pana acum), si `cruce_nedeclarata` (sfant cu semn intr-o zi
 * care nu-si declara culoarea — de pilda o duminica). Lista anului creste de la 18 zile la 116, si
 * asta e masura adevarata a lucrului.
 *
 * ⚠️ `cruce_albastra` vine din `rangulSfantului`, unde culoarea BATE insemnul: un sfant scris albastru
 * primeste rangul asta chiar daca semnul lui spune altceva. Rangul nu mai poate raspunde atunci la
 * „ce culoare are crucea?", si de aceea alegerea se face aici, nu acolo. Daca vreodata se desparte
 * culoarea (roman/local) de insemn in `Rang`, locul asta se simplifica.
 */
const RANGURILE: Record<FelFiltru, readonly string[]> = {
  rosie: ['cruce_rosie', 'praznic_imparatesc'],
  neagra: ['cruce_neagra', 'cruce_albastra', 'cruce_nedeclarata'],
  // „evlavie" nu se uita la rang deloc — se uita la NUME (`eCuEvlavie`)
  evlavie: [],
}

/** Sfantul acesta intra in filtrul cerut? Doua masuri deosebite: rangul, ori lista parohiei. */
function tineDeFiltru(s: { nume: string; rang: string }, fel: FelFiltru): boolean {
  return fel === 'evlavie' ? eCuEvlavie(s.nume) : RANGURILE[fel].includes(s.rang)
}

/**
 * TITLUL UNEI ZILE DINTR-O LISTA FILTRATA — numai sfintii care poarta crucea ceruta.
 *
 * ⚠️ Fara asta, lista scria titlul INTREG al zilei, cu toti sfintii ei, si in „cruce neagră" se
 * vedeau si nume albastre (reclamatia userului, 12.09.2026, 11:22: „sunt incluși aici și cei cu cruce
 * albastră"). De pilda 20 ianuarie: ziua e a Sf. Cuv. Eftimie cel Mare (cruce neagra), dar titlul ei
 * cuprinde si „Sf. Mc. In, Pin și Rim", scrisi albastru de Patriarhie. Ziua e pe drept in lista —
 * numele celorlalti nu erau.
 *
 * ⚠️ Albastrul acela vine din `titlu_html`-ul sursei, nu din rangul structurat: sfintii aceia au
 * `rang: "simplu"`. De aceea alegerea se face pe RANGUL sfantului (`zi.sfinti`), nu pe culoarea din
 * HTML — singura care spune adevarul despre insemn.
 *
 * Duminicile isi pastreaza numele lor (intra in lista rosie fara sa aiba sfinti rosii), iar daca
 * pentru o zi nu iese niciun sfant cu rangul cerut, se scrie titlul intreg: mai bine prea mult decat
 * un rand gol.
 */
function capulFiltrat(zi: ZiLiturgica, d: RandDesfacut, fel: FelFiltru): { titlu: string; dinSfinti: boolean } {
  // la rosu, duminica intra ca duminica: numele ei e capul zilei, iar sfintii se scriu oricum dedesubt
  if (fel === 'rosie' && d.eDuminica) return { titlu: capulZilei(d), dinSfinti: false }
  const alesi = zi.sfinti.filter((s) => tineDeFiltru(s, fel))
  if (!alesi.length) return { titlu: capulZilei(d), dinSfinti: false }
  // ⚠️ CULOAREA VINE DIN RANGUL SFANTULUI, aceeasi regula ca la sfintii de sub titlul duminicii
  // (`sfintiiZilei`): rosu la cruce rosie si la praznice, albastru la sfintii romani. Cand capul zilei
  // se scrie din sfinti, marcajul de culoare al sursei se pierde — asa au ajuns sarbatorile cu cruce
  // rosie sa fie scrise cu cerneala in lista lor (user, 12.09.2026, 13:04: „nu sunt notate cu roșu,
  // cum sunt duminicile"). Rosul ramane al crucii rosii, sfant cu sfant.
  const titlu = alesi
    .map((s) => {
      const text = esc(`${s.semn ? `${s.semn} ` : ''}${s.nume}`)
      // in lista evlaviei culoarea e a filtrului, nu a rangului: acolo sfintii sunt aproape toti fara
      // cruce in calendarul oficial, deci rangul n-ar avea ce spune
      const clasa = fel === 'evlavie'
        ? 'c-evlavie'
        : s.rang === 'cruce_albastra' ? 'c-albastru' : RANGURILE.rosie.includes(s.rang) ? 'c-rosu' : ''
      return clasa ? `<span class="${clasa}">${text}</span>` : text
    })
    .join('; ')
  return { titlu, dinSfinti: true }
}

/**
 * Sub titlu, la duminici: sfintii zilei. Rosul e al crucii rosii, sfant cu sfant, si numai
 * cand sursa o SPUNE (V1, 9 sept. 2026). Albastrul sfintilor locali bate rosul.
 */
function sfintiiZilei(zi: ZiLiturgica, d: RandDesfacut): string {
  if (!d.eDuminica || !d.denumire || !zi.sfinti.length) return ''
  return zi.sfinti
    .map((s) => {
      const clasa = s.rang === 'cruce_albastra' ? 'c-albastru' : s.rang === 'praznic_imparatesc' || s.rang === 'cruce_rosie' ? 'c-rosu' : ''
      const text = esc(`${s.semn ? `${s.semn} ` : ''}${s.nume}`)
      return clasa ? `<span class="${clasa}">${text}</span>` : text
    })
    .join('; ')
}

/** Randul marunt: pericopele intregi (si ale sfintilor), apoi glasul si voscreasna. */
function pericopele(zi: ZiLiturgica, d: RandDesfacut): string {
  const citiri = d.citiri.length ? d.citiri : [zi.pericope.apostol ? `Ap. ${zi.pericope.apostol}` : '', zi.pericope.evanghelie ? `Ev. ${zi.pericope.evanghelie}` : ''].filter(Boolean)
  return citiri.map((s) => esc(s)).join(' · ')
}

function glasulZilei(zi: ZiLiturgica, d: RandDesfacut): string {
  if (!d.eDuminica || !zi.glas) return ''
  return `<b class="glas">${esc(`glas ${zi.glas}${zi.evanghelia_invierii ? `, voscr. ${zi.evanghelia_invierii}` : ''}`)}</b>`
}

/** `fel` — cand randul se scrie intr-o lista filtrata: atunci titlul tine numai sfintii felului. */
export function randZi(ctx: Ctx, r: RandZi, d: RandDesfacut, zi: ZiLiturgica, eAzi: boolean, fel?: FelFiltru): string {
  const p = esc(ctx.prefix)
  const clase = ['zi']
  if (r.zi_saptamana === 0) clase.push('duminica')
  if (eAzi) clase.push('azi')
  if (r.cruce) clase.push(`cruce-${r.cruce}`)

  const pericope = pericopele(zi, d)
  const glas = glasulZilei(zi, d)
  const cap = fel ? capulFiltrat(zi, d, fel) : { titlu: capulZilei(d), dinSfinti: false }
  const titlu = cap.titlu
  // ⚠️ Cand capul zilei s-a facut DIN sfinti, randul de dedesubt nu se mai scrie: altfel duminica
  // filtrata isi spunea de doua ori sfintii — sus cei ai felului, jos toti.
  const sfinti = cap.dinSfinti ? '' : sfintiiZilei(zi, d)
  // ⚠️ Intr-o lista de cruci NEGRE, titlul unei duminici nu se mai scrie rosu: rosul ar spune
  // „sarbatoare cu ținere", adica taman ce lista aceasta nu cuprinde.
  if (fel === 'neagra') clase.push('fara-rosu')
  // anii privegherilor se scriu numai in lista evlaviei, unde sunt insasi pricina pentru care ziua e acolo
  const anii = fel === 'evlavie' ? privegherileZilei(zi) : []
  const semne = semnele(d, (e) => !E_POST(e) && !E_LIBERA(e))
  const randuialaMesei = semnele(d, E_POST) + semnele(d, E_LIBERA)

  const areSinaxar = !r.calculat
  const spreSinaxar = (continut: string) =>
    areSinaxar ? `<a href="${p}/zi/${r.data}/sinaxar" data-fereastra="sinaxar" data-zi="${r.data}">${continut}</a>` : continut
  const areTexte = Boolean(zi.pericope.apostol || zi.pericope.evanghelie || d.citiri.length)
  const spreTexte = areTexte
    ? `<a href="${p}/zi/${r.data}/apostolul-evanghelia" data-fereastra="apostolul-evanghelia" data-zi="${r.data}">${pericope}</a>`
    : pericope

  return `<article class="${clase.join(' ')}"${eAzi ? ' id="azi"' : ''}>
  <a class="cand" href="${p}/zi/${r.data}" title="${esc(ZILE_SAPTAMANA[r.zi_saptamana] ?? '')}, ${r.zi} ${esc(LUNI[r.luna - 1] ?? '')}">
    <span class="nr">${r.zi}</span>
    <span class="zs">${esc(ZILE_SCURT[r.zi_saptamana] ?? '')}</span>
  </a>
  <div class="ce">
    ${randuialaMesei ? `<div class="randuiala-mesei">${randuialaMesei}</div>` : ''}
    <p class="titlu-zi">${spreSinaxar(titlu)}</p>
    ${sfinti ? `<p class="sfinti">${spreSinaxar(sfinti)}</p>` : ''}
    ${anii.length ? `<p class="privegheri"><b>Privegheri:</b> ${anii.join(', ')}</p>` : ''}
    ${r.subtitlu ? `<p class="subtitlu">${esc(r.subtitlu)}</p>` : ''}
    ${semne ? `<p class="semne">${semne}</p>` : ''}
    ${pericope || glas ? `<p class="pericope">${[pericope ? spreTexte : '', glas].filter(Boolean).join(' · ')}</p>` : ''}
  </div>
</article>
`
}

// ---------------------------------------------------------------------------
// Pagina unei luni
// ---------------------------------------------------------------------------

function adresaLunii(prefix: string, an: number, luna: number): string {
  return `${prefix}/${an}-${String(luna).padStart(2, '0')}`
}

/**
 * SCRISUL DIN PASTILA — unde ești, în cuvinte (user, 15.09.2026: „să se scrie mai întâi data curentă,
 * adică atunci când intru pe site, să scrie 15 septembrie 2026… la selecție… să scrie luna selectată,
 * de exemplu, octombrie 2026, fără zi").
 *
 * Trei feluri, după ce arată pagina:
 *   - luna de AZI          → data întreagă, cu zi: „15 septembrie 2026";
 *   - altă lună            → numai luna: „octombrie 2026";
 *   - lista unui an întreg → anul: „2026" (acolo nicio lună nu e a paginii, `luna: 0`).
 *
 * ⚠️ Forma scurtă („15 sep. 2026") se scrie ALĂTURI, nu în locul celei lungi, și se schimbă din CSS
 * la ecrane mici: rândul de unelte trebuie să rămână pe O SINGURĂ LINIE (regula userului,
 * 12.09.2026), iar data scrisă întreg n-ar mai fi încăput pe un telefon de 390 px.
 */
function scrisulLocului(ctx: Ctx, an: number, luna: number, azi: string): string {
  const [anAzi, lunaAzi, ziAzi] = azi.split('-').map(Number) as [number, number, number]
  if (!luna) return `<span class="acum">${an}</span>`
  const numeLunii = LUNI[luna - 1] ?? ''
  if (an === anAzi && luna === lunaAzi) {
    return `<span class="acum"><b class="lung">${ziAzi} ${esc(numeLunii)} ${an}</b>`
      + `<b class="scurt">${ziAzi} ${esc(numeLunii.slice(0, 3))}. ${an}</b></span>`
  }
  return `<span class="acum"><b class="lung">${esc(numeLunii)} ${an}</b>`
    + `<b class="scurt">${esc(numeLunii.slice(0, 3))}. ${an}</b></span>`
}

/**
 * PASTILA, din 15.09.2026: bulina lui „azi", scrisul locului și cheia care coboară șirul lunilor.
 *
 * ⚠️ ȘIRUL LUNILOR NU MAI E AICI. Până acum pastila ținea și cele treisprezece luni, derulate
 * stânga-dreapta pe același rând cu butoanele; userul l-a mutat într-o bară a lui, sub antet,
 * ascunsă până se cere („aș vrea să se mute într-o bară secundară, inițial ascunsă sub zona de
 * antet"). Vezi `baraLunilor`. Câștigul: rândul de sus nu mai e înghesuit, iar data de azi —
 * lucrul după care se uită omul întâi — stă scrisă, nu ghicită dintr-un segment roșu.
 *
 * ⚠️ „AZI" E O BULINA, nu un cuvant (user, 12.09.2026: „AZI să fie o bulină ca la Program"). Punctul
 * se deseneaza din CSS (`.azi-buton::before`), deci butonul ramane gol de text: numele lui se citeste
 * din `title` si `aria-label`, ca la bulina saptamanii din Program.
 *
 * ⚠️ Bulina NU duce filtrul crucii cu ea: ea inseamna „arata-mi ziua de azi", iar ziua de azi poate
 * sa nu fie in lista filtrata. Ancora `#azi` o face sa deruleze la ziua curenta chiar si cand esti
 * deja pe luna ei.
 *
 * Clasa `azi-buton` e si manerul de care se leaga JS-ul; daca o schimbi, schimb-o si in `JS_NAV`.
 *
 * `luna: 0` inseamna „nicio luna nu e a paginii" — asa o cheama listele de sarbatori.
 */
function pastilaLocului(ctx: Ctx, an: number, luna: number, azi: string, filtre: string): string {
  const p = esc(ctx.prefix)
  const [anAzi, lunaAzi] = azi.split('-').map(Number) as [number, number]
  // bulina se face rosie numai cand pagina arata chiar luna de azi — rosul spune locul, nu butonul
  const peLunaAzi = an === anAzi && luna === lunaAzi
  const butonAzi = `<a class="azi-buton${peLunaAzi ? ' activ' : ''}" href="${adresaLunii(p, anAzi, lunaAzi)}#azi"`
    // ⚠️ Butonul se cheama „Astăzi", si atat (user, 12.09.2026, 14:17: „textul buton Azi să fie chiar
    // «Astăzi» - nu mergi la luna…"). Un nume, nu o poruncă: bulina spune CE e, nu ce face cu tine.
    + ` title="Astăzi" aria-label="Astăzi"></a>`
  const cheia = `<button type="button" class="luni-cheie" id="luni-cheie" aria-expanded="false"`
    + ` aria-controls="bara-luni" title="Alege altă lună" aria-label="Alege altă lună">${IC_CALENDAR}</button>`
  /*
   * ⚠️ LUPA STĂ ÎNAINTEA CRUCII (user, 15.09.2026: „să avem o iconiță lupă de căutare înainte de
   * cruce"), deci al patrulea segment din cinci. E o CHEIE, ca aceea a lunilor: coboară o bară de sub
   * antet, nu duce nicăieri singură — căutarea se scrie acolo și pleacă spre `/cauta`.
   *
   * ⚠️ Nu atârnă de rol. Filtrele atârnă (13.09.2026), fiindcă taie lista după însemnul zilei;
   * căutarea nu taie nimic, e tot citit, iar cititul e la liber (regula userului).
   */
  const lupa = `<button type="button" class="cauta-cheie" id="cautare-cheie" aria-expanded="false"`
    + ` aria-controls="bara-cautare" title="Caută în calendar" aria-label="Caută în calendar">${IC_LUPA}</button>`
  // Ordinea cerută (user, 15.09.2026): bulina · DATA, cât tot spațiul rămas · calendarul · lupa · crucea.
  return `<span class="pastila">${butonAzi}${scrisulLocului(ctx, an, luna, azi)}${cheia}${lupa}${filtre}</span>`
}

/**
 * BARA A DOUA — șirul lunilor, sub rândul de unelte, ascuns până se apasă cheia din pastilă.
 *
 * NUMAI anul curent, plus ianuarie anul viitor (cerere user, 10.09.2026: „nu mai afișa alți ani în
 * afară de anul curent și luna ianuarie anul viitor").
 *
 * ⚠️ Se derulează stânga-dreapta (`.fasie`), și pe telefon, și oriunde lunile nu încap („pe mobil tot
 * așa să se poată muta stânga dreapta"). Săgețile ‹ › le scrie JS-ul, și numai dacă e ceva de derulat.
 *
 * ⚠️ LUNILE SUNT UN FILTRU si PASTREAZA filtrul crucii (user, 12.09.2026): daca te uiti la zilele cu
 * cruce rosie si alegi alta luna, ramai pe rosu.
 *
 * ⚠️ `hidden` e scris de SERVER, la fiecare pagină: așa „la selecție bara cu lunile dispare" fără
 * nicio linie de JS — alegerea unei luni e o navigare, iar pagina următoare se naște cu bara sus.
 */
function baraLunilor(ctx: Ctx, an: number, luna: number, fel?: FelFiltru): string {
  const p = esc(ctx.prefix)
  const anCurent = ctx.anCurent
  const cuFiltru = (adresa: string) => (fel ? `${adresa}?filtru=${fel}` : adresa)
  const butoane = LUNI.map((nume, i) => {
    const l = i + 1
    const activa = an === anCurent && l === luna ? ' activa' : ''
    return `<a class="luna-buton${activa}" href="${cuFiltru(adresaLunii(p, anCurent, l))}" data-l="${l}"${activa ? ' aria-current="page"' : ''}>${esc(nume.slice(0, 3))}</a>`
  })
  const ianuarieViitor = an === anCurent + 1 && luna === 1 ? ' activa' : ''
  butoane.push(`<a class="luna-buton${ianuarieViitor}" href="${cuFiltru(adresaLunii(p, anCurent + 1, 1))}" title="ianuarie ${anCurent + 1}"${ianuarieViitor ? ' aria-current="page"' : ''}>Ian ${anCurent + 1}</a>`)
  return `<div class="bara-luni" id="bara-luni" hidden><div class="fasie"><nav class="luni" aria-label="Lunile anului">${butoane.join('')}</nav></div></div>`
}

/**
 * BARA CĂUTĂRII — sora barei lunilor, sub același rând, ascunsă până se apasă lupa.
 *
 * ⚠️ E un FORMULAR adevărat, `method="get"`, nu un câmp legat de JS: căutarea merge și fără
 * JavaScript, iar rezultatul are adresă (`/cauta?q=…&an=…`), deci se poate da mai departe și se poate
 * pune la semne de carte — ca listele de sărbători. JS-ul adaugă doar coborârea barei și focusul.
 *
 * ⚠️ ANUL CĂLĂTOREȘTE CU CĂUTAREA, ascuns în formular: se caută în anul paginii de pe care pleci, nu
 * într-un an ales pe la spate. Ruta îl coboară singură pe cel mai apropiat an preluat, dacă acela nu e.
 *
 * ⚠️ Pe pagina rezultatelor bara se naște DESCHISĂ, cu întrebarea scrisă în câmp — altfel omul n-ar
 * mai vedea ce a căutat și ar trebui să deschidă lupa ca să afle.
 */
function baraCautarii(ctx: Ctx, an: number, o?: { q: string; deschisa: boolean }): string {
  const p = esc(ctx.prefix)
  return `<div class="bara-cautare" id="bara-cautare"${o?.deschisa ? '' : ' hidden'}>
      <form class="cauta" role="search" method="get" action="${p}/cauta">
        <input type="hidden" name="an" value="${an}">
        <input class="cauta-camp" type="search" name="q" value="${esc(o?.q ?? '')}" minlength="3"
          placeholder="Caută un sfânt sau o sărbătoare" aria-label="Caută în calendar" autocomplete="off">
        <button class="cauta-du" type="submit" title="Caută" aria-label="Caută">${IC_LUPA}</button>
      </form>
    </div>`
}

/** Ce se scrie sub rândul de unelte: barele care coboară din pastilă și fereastra de abonare (închisă, deci nevăzută). */
function subantetul(ctx: Ctx, an: number, luna: number, fel?: FelFiltru, cautare?: { q: string; deschisa: boolean }): string {
  return `${baraLunilor(ctx, an, luna, fel)}\n    ${baraCautarii(ctx, an, cautare)}\n    ${fereastraCalendarului(ctx)}`
}

function comune(ctx: Ctx) {
  return {
    nume: 'CALENDAR',
    titlu: 'Calendar',
    acasa: `${ctx.prefix}/`,
    urlPlatforma: ctx.nav.home || '/',
    local: LOCAL,
    cont: contDin(ctx),
    versiune: ctx.versiune,
    modificata: ctx.modificata,
  }
}

/**
 * FILTRUL CRUCII, aplicat peste zilele unei liste (user, 12.09.2026, 11:12):
 *
 *   - ROSIE lasa zilele cu cruce rosie **si duminicile** („rămân doar Sfinții cu cruce roșie și
 *     duminicile din acea lună") — duminica e sarbatoare chiar cand nu poarta insemnul;
 *   - NEAGRA lasa zilele care au macar un sfant cu cruce neagra („rămân doar acei sfinți").
 *
 * ⚠️ HOTARATOR E SFANTUL, NU ZIUA (12.09.2026, 12:56). Prima varianta intreba doar ce fel de cruce
 * poarta ZIUA (`r.cruce`), si atunci 13 septembrie — duminica in care se prazuieste Sf. Cuv. Ioan de
 * la Prislop, cu cruce — nu intra nicaieri la negru: ziua e „duminica", nu „neagra". Asa ramaneau pe
 * dinafara toti sfintii romani, pana la unul. Felul zilei a ramas doar ca plasa, pentru zilele in care
 * insemnul e al zilei si sfantul nu-l poarta.
 */
export function trecePrinFiltru(r: RandZi, zi: ZiLiturgica, fel: FelFiltru): boolean {
  if (zi.sfinti.some((s) => tineDeFiltru(s, fel))) return true
  // plasa felului zilei nu e si a evlaviei: acolo lista e a numelor, si atat
  if (fel === 'evlavie') return false
  return fel === 'rosie' ? r.cruce === 'rosie' || r.zi_saptamana === 0 : r.cruce === 'neagra'
}

/**
 * „TOATE LUNILE" — butonul care DESELECTEAZA luna (user, 12.09.2026, 11:13: „doar butonul cu toate
 * lunile, care deselectează luna calendarului și afișează toate sărbătorile cu roșu de peste anul în
 * curs"). Se scrie numai cand un filtru de cruce e pus: fara filtru, „toate lunile" ar insemna tot
 * calendarul, o listă de 365 de zile pe care nimeni n-a cerut-o.
 *
 * Pe lista anului butonul e deja apasat, deci se scrie marcat si neapasabil. A luat locul grilei de
 * douasprezece luni de pe vechea pagina de sarbatori: lunile se aleg acum din pastila de sus, ca
 * peste tot.
 */
function butonToateLunile(ctx: Ctx, fel: FelFiltru, an: number, peTotAnul: boolean): string {
  const p = esc(ctx.prefix)
  if (peTotAnul) {
    return `<p class="rand-filtru"><b class="btn toate-lunile activ" aria-current="page">Toate lunile</b></p>`
  }
  return `<p class="rand-filtru"><a class="btn toate-lunile" href="${p}/sarbatori/${FILTRE[fel].slug}/${an}"`
    + ` title="Scoate luna din filtru — ${esc(FILTRE[fel].nume.toLowerCase())} din tot anul">Toate lunile</a></p>`
}

export function paginaLuna(o: {
  ctx: Ctx
  an: number
  luna: number
  randuri: Array<{ r: RandZi; d: RandDesfacut; zi: ZiLiturgica }>
  calculat: boolean
  azi: string
  /** filtrul de fel pus acum; lipseste cand se vede luna intreaga */
  cruce?: FelFiltru
  mesajAbonare?: string
  /**
   * ⚠️ „Intrarea in aplicatie" — adresa FARA luna (`/`). Numai atunci pagina se deruleaza singura la
   * ziua de azi (user, 15.09.2026); cand omul a ales el o luna din sir, saritura n-ar fi ceruta.
   */
  laAzi?: boolean
}): string {
  const alese = o.cruce ? o.randuri.filter(({ r, zi }) => trecePrinFiltru(r, zi, o.cruce as FelFiltru)) : o.randuri
  const corp = alese.map(({ r, d, zi }) => randZi(o.ctx, r, d, zi, r.data === o.azi, o.cruce)).join('')
  const numeLuna = `${LUNI[o.luna - 1] ?? ''} ${o.an}`
  const felul = o.cruce ? FILTRE[o.cruce] : null
  const lunaSir = `${o.an}-${String(o.luna).padStart(2, '0')}`
  return pagina({
    ...comune(o.ctx),
    titluPagina: felul ? `${felul.nume} · ${numeLuna}` : `Calendar ${numeLuna}`,
    // paginile filtrate nu se dau la indexat: e acelasi continut, ciuntit
    indexabil: !o.cruce,
    metaExtra: `<meta name="description" content="Calendarul creștin ortodox — ${LUNI[o.luna - 1]} ${o.an}, zi de zi. Copie a calendarului oficial al Patriarhiei Române.">`,
    unelte: unelte({
      ctx: o.ctx,
      an: o.an,
      luna: o.luna,
      azi: o.azi,
      ...(o.cruce ? { felActiv: o.cruce } : {}),
      lunaFiltru: lunaSir,
    }),
    subantet: subantetul(o.ctx, o.an, o.luna, o.cruce),
    ...(o.laAzi ? { clasaCorp: 'la-azi' } : {}),
    scripturi: script(o.ctx.prefix),
    corp: `${o.mesajAbonare ? `<p class="an-calculat">${esc(o.mesajAbonare)}</p>` : ''}
${o.calculat ? `<p class="an-calculat">${esc(NOTA_GENERAT)}</p>` : ''}
${o.cruce ? butonToateLunile(o.ctx, o.cruce, o.an, false) : ''}
<h2 class="luna">${esc(numeLuna)}${felul ? ` · <span class="fel-filtru f-${o.cruce}">${esc(felul.eticheta)}</span>` : ''}</h2>
<div class="zile">
${corp}</div>
${corp ? '' : `<p class="gol">${esc(numeLuna)} n-are ${esc(felul?.pustiu ?? '')}.</p>`}

<dialog class="fereastra" id="fereastra" aria-label="textele zilei">
  <div class="bara-fereastra"><button type="button" class="inchide" aria-label="Închide">×</button></div>
  <div class="cuprins-fereastra"></div>
</dialog>`,
  })
}

// ---------------------------------------------------------------------------
// Pagina unei zile (si partile ei)
// ---------------------------------------------------------------------------

export type Parte = 'sinaxar' | 'apostolul-evanghelia'

export interface TexteZilei {
  sinaxar: string | null
  apostol: PericopaCuText | null
  evanghelie: PericopaCuText | null
  voscreasna: { nr: number; text: PericopaCuText } | null
  inPlus: PericopaCuText[]
}

/** O pericopa adusa de noi: referinta mare, textul dedesubt — ca la cele din calendarul V1. */
function pericopaHtml(prefix: 'Ap.' | 'Ev.', p: PericopaCuText | null, refCadere?: string | null): string {
  if (!p) return refCadere ? `<h2>${esc(`${prefix} ${refCadere}`)}</h2><p class="gol">Textul acestei pericope nu a putut fi adus din Biblia platformei.</p>` : ''
  return p.bucati
    .map((b, i) => {
      const titlu = i === 0 ? `<h2>${esc(`${prefix} ${p.referinta}`)}</h2>` : ''
      const ref = p.bucati.length > 1 ? `<p class="ref"><a href="${esc(b.adresa)}" target="_blank" rel="noopener">${esc(b.referinta)}</a></p>` : ''
      if (!b.versete) return `${titlu}${ref}<p class="gol">Textul acestei pericope nu a putut fi adus din Biblia platformei.</p>`
      return `${titlu}${ref}<p>${esc(b.versete.map((v) => v.text).join(' '))}</p>`
    })
    .join('')
}

/** Sectiunile pericopelor, in ordinea ceruta de user (V1, 27 aug. 2026). */
function sectiunilePericopelor(zi: ZiLiturgica, t: TexteZilei): Array<[string, string]> {
  const sectiuni: Array<[string, string]> = []
  if (t.voscreasna) sectiuni.push([`Voscreasna Învierii · a ${t.voscreasna.nr}-a · Utrenie`, pericopaHtml('Ev.', t.voscreasna.text)])
  sectiuni.push(['Apostolul', pericopaHtml('Ap.', t.apostol, zi.pericope.apostol)])
  sectiuni.push(['Sfânta Evanghelie', pericopaHtml('Ev.', t.evanghelie, zi.pericope.evanghelie)])
  if (t.inPlus.length) sectiuni.push(['Din Evangheliar', t.inPlus.map((p) => pericopaHtml('Ev.', p)).join('')])
  return sectiuni
}

function sectiunile(zi: ZiLiturgica, t: TexteZilei, parte?: Parte): Array<[string, string]> {
  if (parte === 'sinaxar') return [['', t.sinaxar ?? '']]
  if (parte === 'apostolul-evanghelia') return sectiunilePericopelor(zi, t)
  return [...sectiunilePericopelor(zi, t), ['Sinaxar', t.sinaxar ?? '']]
}

export function cuprinsul(sectiuni: Array<[string, string]>): string {
  return sectiuni
    .filter(([, html]) => html)
    .map(([nume, html]) => `<section class="text">${nume ? `<h3>${esc(nume)}</h3>` : ''}${html}</section>`)
    .join('\n')
}

export function paginaZi(o: { ctx: Ctx; r: RandZi; d: RandDesfacut; zi: ZiLiturgica; texte: TexteZilei; parte?: Parte; ieri: string; maine: string; azi: string }): string {
  const p = esc(o.ctx.prefix)
  const luna = `${p}/${o.r.an}-${String(o.r.luna).padStart(2, '0')}`
  const numeParte = o.parte === 'sinaxar' ? 'Sinaxar' : o.parte ? 'Lectura zilei' : ''
  const cuprins = cuprinsul(sectiunile(o.zi, o.texte, o.parte))
  const semne = semnele(o.d)
  const pericope = pericopele(o.zi, o.d)
  const glas = glasulZilei(o.zi, o.d)
  const sfinti = sfintiiZilei(o.zi, o.d)
  const numeZi = (o.d.denumire || o.zi.titlu).slice(0, 70)

  return pagina({
    ...comune(o.ctx),
    titluPagina: `${numeParte ? `${numeParte} · ` : ''}${numeZi} · ${o.r.zi} ${LUNI[o.r.luna - 1]} ${o.r.an}`,
    indexabil: true,
    // navigarea sta pe TOATE paginile, cu luna zilei marcata — in ea esti
    // filtrele lucreaza peste luna ZILEI deschise: de pe ziua de 13 septembrie, „cruce roșie" duce la
    // septembrie filtrat, nu la un an intreg
    unelte: unelte({ ctx: o.ctx, an: o.r.an, luna: o.r.luna, azi: o.azi, lunaFiltru: `${o.r.an}-${String(o.r.luna).padStart(2, '0')}` }),
    subantet: subantetul(o.ctx, o.r.an, o.r.luna),
    scripturi: JS_NAV + JS_FILTRE + JS_ABONARE,
    clasaCorp: `pagina-zi ${o.r.zi_saptamana === 0 ? 'duminica' : ''} ${o.r.cruce ? `cruce-${o.r.cruce}` : ''}`,
    corp: `<div class="cap">
  <p class="eyebrow"><a href="${luna}">${esc(LUNI[o.r.luna - 1] ?? '')} ${o.r.an}</a>${numeParte ? ` · ${esc(numeParte)}` : ''}</p>
  <h1 class="data-mare">${o.r.zi} ${esc(LUNI[o.r.luna - 1] ?? '')}</h1>
  <p class="zs-mare">${esc(ZILE_SAPTAMANA[o.r.zi_saptamana] ?? '')}${o.r.faza_lunii ? ` · ${esc(o.r.faza_lunii)}` : ''}</p>
  <p class="titlu-zi titlu-mare">${capulZilei(o.d)}</p>
  ${sfinti ? `<p class="sfinti">${sfinti}</p>` : ''}
  ${o.r.subtitlu ? `<p class="subtitlu">${esc(o.r.subtitlu)}</p>` : ''}
  ${o.parte ? '' : `${semne ? `<p class="semne">${semne}</p>` : ''}
  ${o.r.calculat ? '' : `<p class="randuiala">
    ${o.zi.canonic.nunti ? 'Se fac nunți' : 'Nu se fac nunți'} ·
    ${o.zi.canonic.parastase ? 'se fac parastase' : 'nu se fac parastase'}
  </p>`}`}
  ${(pericope || glas) && o.parte !== 'sinaxar' ? `<p class="pericope">${[pericope, glas].filter(Boolean).join(' · ')}</p>` : ''}
</div>

${cuprins || (o.r.calculat ? `<p class="gol">${esc(NOTA_GENERAT)} — textele vin odată cu calendarul oficial al anului.</p>` : '<p class="gol">Textele acestei zile nu se găsesc.</p>')}

<nav class="vecini">
${o.parte
  ? `<a href="${p}/zi/${o.r.data}">← toată ziua</a>
  <a href="${luna}">${esc(LUNI[o.r.luna - 1] ?? '')}</a>`
  : `<a href="${p}/zi/${o.ieri}">← ziua dinainte</a>
  <a href="${luna}">${esc(LUNI[o.r.luna - 1] ?? '')}</a>
  <a href="${p}/zi/${o.maine}">ziua următoare →</a>`}
</nav>`,
  })
}

// ---------------------------------------------------------------------------
// „Informații utile" · sărbătorile
// ---------------------------------------------------------------------------

/**
 * Felurile de filtru din bara de sus. Primele doua vin din INSEMNUL calendarului oficial; al treilea,
 * „evlavie", e al parohiei — o lista de nume, tinuta de noi (vezi `SFINTI_CU_EVLAVIE`).
 * Numele tipului a fost `FelCruce` pana la 12.09.2026, cand a intrat al treilea, care nu e o cruce.
 */
export type FelFiltru = 'rosie' | 'neagra' | 'evlavie'

/**
 * `scurt` intra in propozitii („nicio zi însemnată cu cruce roșie"); `eticheta` sta singura, langa
 * numele lunii, si de aceea poarta cuvantul cu ea (user, 12.09.2026, 13:28: „când sunt pe cruce roșie,
 * acolo să scrie «cruce roșie», nu «Roșie»"); `slug` e bucata din adresa listei de an;
 * plin; `slug` e bucata din adresa listei de an; `pustiu` incheie propozitia „Septembrie 2026 n-are…".
 */
export const FILTRE: Record<FelFiltru, { nume: string; meniu: string; scurt: string; eticheta: string; slug: string; lamurire: string; pustiu: string; cere: string }> = {
  rosie: {
    nume: 'Sărbători cu cruce roșie',
    meniu: 'Sfinți cu cruce roșie',
    scurt: 'roșie',
    eticheta: 'cruce roșie',
    slug: 'cruce-rosie',
    lamurire: 'Praznicele împărătești și sfinții cu ținere — zilele pe care calendarul oficial le însemnează cu cruce roșie.',
    pustiu: 'nicio zi însemnată cu cruce roșie',
    cere: 'intră în cont ca să filtrezi',
  },
  neagra: {
    nume: 'Sărbători cu cruce neagră',
    meniu: 'Sfinți cu cruce neagră',
    scurt: 'neagră',
    eticheta: 'cruce neagră',
    slug: 'cruce-neagra',
    lamurire: 'Sfinții însemnați cu cruce neagră: se prăznuiesc, dar ziua nu e cu ținere.',
    pustiu: 'nicio zi însemnată cu cruce neagră',
    cere: 'intră în cont ca să filtrezi',
  },
  evlavie: {
    nume: 'Sfinți cu evlavie',
    meniu: 'Sfinți cu evlavie',
    scurt: 'evlavie',
    eticheta: 'sfinți cu evlavie',
    slug: 'evlavie',
    lamurire: 'Sfinții la care ține parohia — lista e a noastră, nu a însemnului din calendarul oficial: cei mai mulți dintre ei sunt scriși acolo fără cruce.',
    pustiu: 'niciun sfânt din cei cu evlavie',
    cere: 'numai pentru administratori',
  },
}

/**
 * CINE POATE FILTRA — treptele cerute de user pe 13.09.2026, 01:26 („sunt felul cum afectează rolul
 * userului a ce vede în app"): neautentificatul niciun filtru, utilizatorul cele doua cruci ale
 * calendarului oficial, adminul si lista parohiei („Sfinți cu evlavie").
 *
 * ⚠️ Se hotaraste din `ctx`, nu din vreo cheie noua de permisiune, si de aceea nu cere republicarea
 * lui `xc-authz-staging`. Amandoua campurile vin din sesiunea EFECTIVA, asa cum o da identitatea:
 * sub masca „vezi ca" rolurile adevarate nu se vad nicaieri, iar masca „neautentificat" intoarce
 * chiar `SESIUNE_ANONIMA`. Deci filtrele coboara singure cu masca, fara nimic in plus aici.
 *
 * ⚠️ Ce NU se inchide: cititul. Lunile, zilele si textele raman la liber pentru oricine — se inchide
 * numai unealta care taie lista, nu continutul ei.
 */
export function poateFiltra(ctx: Ctx, fel: FelFiltru): boolean {
  return fel === 'evlavie' ? ctx.eAdmin : !!ctx.utilizator
}

/**
 * CINE VEDE BUTONUL — altceva decat cine-l poate APASA, din 15.09.2026.
 *
 * Regula casei a fost si ramane „butoanele fara drept se sting, nu se ascund": randul are aceeasi
 * forma la toata lumea, iar cine n-are dreptul il vede palit si afla din `title` ce-i lipseste.
 * ⚠️ „Sfinții cu evlavie" e SINGURA abatere, ceruta anume de user (15.09.2026): lista e a parohiei
 * si tine de treaba celui care pregateste slujbele, deci pentru ceilalti nu e o usa incuiata, e o
 * usa care nu-i priveste. Nu o pune la loc printre cele palite fara sa intrebi.
 *
 * ⚠️ Ascunderea butonului NU e o poarta: poarta adevarata ramane `poateFiltra`, care taie si
 * `?filtru=evlavie` scris de mana, si `/sarbatori/evlavie/<an>`. Aici se hotaraste doar ce se vede.
 */
export function poateVedeaFiltrul(ctx: Ctx, fel: FelFiltru): boolean {
  return fel === 'evlavie' ? ctx.eAdmin : true
}

/**
 * SFINTII CU EVLAVIE — lista parohiei (user, 12.09.2026, 13:31: „mai pune un buton… Sfinți cu evlavie.
 * În care adaugi, pentru început, pe Sfântul Porfirie și pe Sfântul Siluan").
 *
 * ⚠️ Filtrul asta nu se sprijina pe nimic din calendarul oficial: amandoi sfintii de mai jos sunt
 * scrisi acolo cu rang `simplu`, fara cruce, deci nu apar in niciunul din celelalte doua. De aceea
 * lista e a noastra, si de aceea se potriveste pe NUME.
 *
 * ⚠️ Potrivirea se face pe numele CURATAT (fara diacritice, cu cratime — vezi `slug`), ca sa nu atarne
 * de felul in care isi scrie Patriarhia numele de la an la an. Cheia trebuie sa fie indeajuns de lunga
 * cat sa nu prinda pe altcineva: „porfirie" singur ar fi prins si pe episcopul Gazei (26 februarie) si
 * pe Sf. Mc. Onisifor si Porfirie (9 noiembrie), care sunt alti sfinti.
 *
 * ⚠️ **CAND SE ADAUGA UN NUME NOU**, cauta-l intai cu `/v1/cauta?q=` si ia cheia din numele gasit
 * acolo; altfel lista se umple de nume care nu prind nimic. Deocamdata lista traieste in cod, deci
 * fiecare adaugare cere o publicare — daca ajunge sa se schimbe des, locul ei firesc e in D1, cu un
 * rand in pagina de administrare.
 */
export const SFINTI_CU_EVLAVIE: ReadonlyArray<{ cheie: string; data: string; privegheri: readonly number[] }> = [
  // ⚠️ Lista vine din ARHIVA PROGRAMULUI (user, 12.09.2026, 14:17: „pune toți sfinții la care am făcut
  // priveghere"): 40 de slujbe numite „Priveghere" intre 2017 si 2025, la 18 sarbatori. Cheile sunt
  // luate din numele CU CARE SCRIE CALENDARUL ziua, nu din cum le zicem noi, si au fost probate una
  // cate una: fiecare prinde exact ziua ei.
  //
  // ⚠️ ANII sunt cei in care s-a privegheat, si se scriu in pagina, sub numele zilei (user, 14:20).
  // La Anul Nou sunt trecuti si 2014 si 2015, desi acolo slujba e scrisa „Te Deum, Utrenia și Sfânta
  // Liturghie" (22:30), fara cuvantul priveghere: ca randuiala e tot o priveghere, iar din 2018
  // aceeasi slujba e scrisa „PRIVEGHERE". Daca vrei numai ce se cheama asa in arhiva, scoate-i.
  { cheie: 'taierea-imprejur', data: '01-01', privegheri: [2014, 2015, 2018, 2019, 2021] },
  { cheie: 'antipa-de-la-calapodesti', data: '01-10', privegheri: [2022] },
  { cheie: 'antonie-cel-mare', data: '01-17', privegheri: [2019] },
  { cheie: 'intampinarea-domnului', data: '02-02', privegheri: [2021] },
  { cheie: 'efrem-cel-nou', data: '05-05', privegheri: [2018] },
  { cheie: 'ioan-rusul', data: '05-27', privegheri: [2023, 2024, 2025] },
  { cheie: 'grigorie-dascalul', data: '06-22', privegheri: [2018] },
  { cheie: 'paisie-aghioritul', data: '07-12', privegheri: [2021] },
  { cheie: 'proroc-ilie-tesviteanul', data: '07-20', privegheri: [2017, 2018, 2019, 2021, 2022, 2023, 2024] },
  { cheie: 'alexandru-ioan-si-pavel', data: '08-30', privegheri: [2021, 2022, 2023] },
  { cheie: 'nasterea-maicii-domnului', data: '09-08', privegheri: [2021] },
  { cheie: 'siluan-athonitul', data: '09-24', privegheri: [2018, 2019, 2021, 2024, 2025] },
  { cheie: 'acoperamantul-maicii-domnului', data: '10-01', privegheri: [2018, 2019, 2022] },
  // ⚠️ prinde DOUA zile, si pe drept: 27 octombrie si 13 iulie (aducerea moastelor la Bucuresti).
  // Privegherile au fost la 27 octombrie.
  { cheie: 'dimitrie-cel-nou', data: '10-27', privegheri: [2018, 2020] },
  { cheie: 'soborul-sf-arhangheli', data: '11-08', privegheri: [2021] },
  { cheie: 'nectarie-de-la-eghina', data: '11-09', privegheri: [2019] },
  { cheie: 'mare-mc-ecaterina', data: '11-25', privegheri: [2021, 2024] },
  // pus la cererea userului (13:31), inainte sa vina lista privegherilor: la el nu s-a privegheat
  { cheie: 'porfirie-cavsocalivitul', data: '12-02', privegheri: [] },
  { cheie: 'spiridon-episcopul-trimitundei', data: '12-12', privegheri: [2018, 2019, 2023] },
]

/**
 * Anii in care s-a privegheat la sfintii zilei — se scriu sub numele zilei, in lista evlaviei
 * (user, 12.09.2026, 14:20: „chiar să scrii așa: **Privegheri:** anii, cu virgulă, unul după altul").
 * Daca ziua are doi sfinti de pe lista, anii se string laolalta si se aseaza in ordine.
 */
function privegherileZilei(zi: ZiLiturgica): number[] {
  // ⚠️ Anii se leaga de ZIUA in care s-a privegheat, nu doar de sfant: Sf. Cuv. Dimitrie cel Nou se
  // pomeneste si pe 13 iulie (aducerea moastelor), dar privegherile au fost pe 27 octombrie. Ziua de
  // iulie ramane in lista — sfantul e acelasi —, insa fara ani, ca sa nu spuna ce n-a fost.
  const ziLuna = zi.data.slice(5)
  const ani = new Set<number>()
  for (const s of zi.sfinti) {
    const curat = slug(s.nume)
    for (const e of SFINTI_CU_EVLAVIE) {
      if (e.data === ziLuna && curat.includes(e.cheie)) for (const an of e.privegheri) ani.add(an)
    }
  }
  return [...ani].sort((a, b) => a - b)
}

/** Sfantul acesta e pe lista parohiei? Se intreaba pe numele curatat. */
export function eCuEvlavie(nume: string): boolean {
  const curat = slug(nume)
  return SFINTI_CU_EVLAVIE.some((s) => curat.includes(s.cheie))
}

/**
 * LISTA UNUI FEL DE CRUCE PESTE ANUL INTREG — starea „toate lunile" a filtrului. Se ajunge aici
 * deselectand luna; pe luna, filtrul se vede in `paginaLuna`.
 *
 * ⚠️ Grila de douasprezece luni de aici a IESIT (user, 12.09.2026, 11:13: „nu mai are acea filtrare în
 * partea de sus, ci doar butonul cu toate lunile"). Lunile se aleg din pastila de sus, ca peste tot;
 * in locul grilei a ramas butonul „Toate lunile", marcat, fiindca aici chiar esti pe toate.
 */
export function paginaSarbatori(o: {
  ctx: Ctx
  fel: FelFiltru
  an: number
  randuri: Array<{ r: RandZi; d: RandDesfacut; zi: ZiLiturgica }>
  calculat: boolean
  azi: string
}): string {
  const p = esc(o.ctx.prefix)
  const unde = String(o.an)
  // de cand felurile sunt trei, jos se scriu amandoua celelalte, nu „celalalt" — dar numai cele pe
  // care omul le poate folosi (13.09.2026): o legatura catre un filtru inchis ar duce la un ocol
  const celelalte = (['rosie', 'neagra', 'evlavie'] as FelFiltru[]).filter((f) => f !== o.fel && poateFiltra(o.ctx, f))
  const peLuni = LUNI.map((numeLunii, i) => {
    const grup = o.randuri.filter((x) => x.r.luna === i + 1)
    if (!grup.length) return ''
    return `<h2 class="luna">${esc(numeLunii)}</h2>
<div class="zile">
${grup.map((x) => randZi(o.ctx, x.r, x.d, x.zi, x.r.data === o.azi, o.fel)).join('')}</div>`
  })
    .filter(Boolean)
    .join('\n')

  return pagina({
    ...comune(o.ctx),
    titluPagina: `${FILTRE[o.fel].nume} · ${unde}`,
    indexabil: true,
    metaExtra: `<meta name="description" content="${esc(FILTRE[o.fel].nume)} în ${esc(unde)}, din calendarul creștin ortodox al Patriarhiei Române.">`,
    // ⚠️ Navigarea se scrie si aici (user, 12.09.2026: „să nu se mai ascundă când intru pe sărbători
    // cruce neagră roșie") — randul are aceeasi forma pe toate paginile, ca la Program. Fara luna
    // marcata (`0`) si fara `luna` in unelte: aici filtrul tine anul intreg, nicio luna nu e aleasa,
    // iar lunile din pastila duc la luna aceea CU filtrul pus.
    unelte: unelte({ ctx: o.ctx, an: o.an, luna: 0, azi: o.azi, felActiv: o.fel }),
    subantet: subantetul(o.ctx, o.an, 0, o.fel),
    scripturi: JS_NAV + JS_FILTRE + JS_ABONARE,
    clasaCorp: 'sarbatori',
    corp: `<div class="cap">
  <p class="inainte-de-titlu"><a class="btn inapoi" href="${p}/${o.an}">← Înapoi</a></p>
  <h1 class="titlu-lista">${esc(FILTRE[o.fel].nume)}</h1>
  <p class="cate">${o.randuri.length} ${o.randuri.length === 1 ? 'zi' : 'zile'} în ${esc(unde)}</p>
  <p class="sursa">${esc(FILTRE[o.fel].lamurire)}</p>
</div>
${butonToateLunile(o.ctx, o.fel, o.an, true)}
${o.calculat ? `<p class="an-calculat">${esc(NOTA_GENERAT)}</p>` : ''}
${peLuni || `<p class="gol">Anul ${o.an} n-are ${esc(FILTRE[o.fel].pustiu)}.</p>`}

<nav class="vecini">
  <a href="${p}/${o.an}">← Înapoi</a>
  ${celelalte.map((f) => `<a href="${p}/sarbatori/${FILTRE[f].slug}/${o.an}">${esc(FILTRE[f].nume)} →</a>`).join('\n  ')}
</nav>`,
  })
}

// ---------------------------------------------------------------------------
// Cautarea
// ---------------------------------------------------------------------------

/**
 * PAGINA CĂUTĂRII — ce a găsit lupa din pastilă (user, 15.09.2026: „să avem o iconiță lupă de căutare
 * înainte de cruce").
 *
 * ⚠️ Se caută în TITLURILE zilelor, fără diacritice și fără majuscule (`cauta` din depozit, aceeași
 * funcție pe care o folosesc și `/v1/cauta`, și Asistentul) — nu în sinaxar și nu în pericope. Deci
 * „Nicolae" găsește ziua lui, dar un cuvânt din viața sfântului nu.
 *
 * ⚠️ SE CAUTĂ ÎNTR-UN SINGUR AN, cel scris în adresă. Peste toți anii preluați, același sfânt ar ieși
 * de câte ori se repetă în ani, iar lista ar fi o înșiruire de duplicate mutate cu o zi. Anul se vede
 * scris pe pagină, ca omul să știe unde a căutat.
 *
 * Zilele se scriu ca peste tot (`randZi`), grupate pe luni, ca la lista de sărbători.
 */
export function paginaCautare(o: {
  ctx: Ctx
  /** ce s-a cerut, curățat de spații */
  q: string
  an: number
  randuri: Array<{ r: RandZi; d: RandDesfacut; zi: ZiLiturgica }>
  azi: string
  /** `true` cand intrebarea are sub trei litere — atunci nu s-a cautat deloc */
  preScurt: boolean
}): string {
  const p = esc(o.ctx.prefix)
  const peLuni = LUNI.map((numeLunii, i) => {
    const grup = o.randuri.filter((x) => x.r.luna === i + 1)
    if (!grup.length) return ''
    return `<h2 class="luna">${esc(numeLunii)}</h2>
<div class="zile">
${grup.map((x) => randZi(o.ctx, x.r, x.d, x.zi, x.r.data === o.azi)).join('')}</div>`
  })
    .filter(Boolean)
    .join('\n')

  // ⚠️ `cauta` taie la 100 de randuri; cand lista vine plina, spunem ca e taiata, nu pretindem ca atat
  // s-a gasit
  const cate = o.randuri.length >= 100
    ? 'primele 100 de zile'
    : `${o.randuri.length} ${o.randuri.length === 1 ? 'zi' : 'zile'}`
  const vestea = o.preScurt
    ? '<p class="gol">Scrie cel puțin trei litere.</p>'
    : peLuni || `<p class="gol">Nimic în ${o.an} pentru „${esc(o.q)}”. Se caută în titlul zilei — numele sfântului sau al sărbătorii.</p>`

  return pagina({
    ...comune(o.ctx),
    titluPagina: o.q ? `Căutare: ${o.q}` : 'Căutare',
    // o listă de rezultate n-are ce căuta la indexat: e conținutul calendarului, tăiat după o întrebare
    indexabil: false,
    unelte: unelte({ ctx: o.ctx, an: o.an, luna: 0, azi: o.azi }),
    // bara vine COBORÂTĂ, cu întrebarea în câmp: aici e locul unde omul o schimbă și caută din nou
    subantet: subantetul(o.ctx, o.an, 0, undefined, { q: o.q, deschisa: true }),
    scripturi: JS_NAV + JS_FILTRE + JS_ABONARE,
    clasaCorp: 'sarbatori',
    corp: `<div class="cap">
  <p class="inainte-de-titlu"><a class="btn inapoi" href="${p}/${o.an}">← Înapoi</a></p>
  <h1 class="titlu-lista">Căutare${o.q ? ` · ${esc(o.q)}` : ''}</h1>
  ${o.randuri.length ? `<p class="cate">${esc(cate)} în ${o.an}</p>` : ''}
  <p class="sursa">Se caută în titlul zilelor din ${o.an}, fără diacritice și fără majuscule.</p>
</div>
${vestea}

<nav class="vecini">
  <a href="${p}/${o.an}">← Înapoi</a>
</nav>`,
  })
}

// ---------------------------------------------------------------------------
// Mesaje si administrare
// ---------------------------------------------------------------------------

/**
 * Carcasa goală a calendarului — antet, subsol, stil — cu un corp dat de altcineva. O cere
 * `@xc/abonare`, ca ecranul celor șase cifre să fie ÎN calendar (user, 15.09.2026: „în pagină să
 * fie dus în zona de autentificare"), nu într-o pagină străină a contului. Rândul de unelte lipsește
 * dinadins: cât scrii codul n-ai ce filtra și n-ai de ce să te abonezi a doua oară.
 */
export function paginaCarcasa(ctx: Ctx, o: { titluPagina: string; corp: string; scripturi?: string }): string {
  return pagina({
    ...comune(ctx),
    titluPagina: o.titluPagina,
    ...(o.scripturi ? { scripturi: o.scripturi } : {}),
    corp: o.corp,
  })
}

export function paginaMesaj(ctx: Ctx, titlu: string, mesaj: string): string {
  const p = esc(ctx.prefix)
  return pagina({
    ...comune(ctx),
    titluPagina: titlu,
    corp: `<div class="cap">
  <h1 class="titlu-lista">${esc(titlu)}</h1>
  <p class="sursa">${esc(mesaj)}</p>
</div>
<nav class="vecini"><a href="${p}/">← Calendarul</a></nav>`,
  })
}

export function paginaAdmin(o: {
  ctx: Ctx
  importuri: Import[]
  versiuni: Versiune[]
  corecturi: Array<{ data: string; camp: string; valoare_veche: string | null; valoare_noua: string | null; motiv: string; autor: string | null; moment: string }>
  abonati: Array<{ user_id: string; adresa: string; created_at: string }>
  versiuneCalendar: string
  aniCalculati: number[]
  csrf: string
  mesaj?: string
  eroare?: string
}): string {
  const p = esc(o.ctx.prefix)
  const anUrmator = (o.importuri.length ? Math.max(...o.importuri.map((i) => i.an)) : o.ctx.anCurent) + 1
  const tabel = (cap: string[], randuri: string[][]) =>
    randuri.length
      ? `<table><thead><tr>${cap.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${randuri
          .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`
      : '<p class="gol">Nimic încă.</p>'

  return pagina({
    ...comune(o.ctx),
    titluPagina: 'Administrare',
    corp: `<div class="cap">
  <h1 class="titlu-lista">Administrare</h1>
  <p class="sursa">Versiunea calendarului: <b>${esc(o.versiuneCalendar)}</b>. Anii calculați din Pascalie: ${o.aniCalculati.join(', ') || '—'}.</p>
</div>
${o.mesaj ? `<p class="an-calculat">${esc(o.mesaj)}</p>` : ''}
${o.eroare ? `<p class="an-calculat" style="border-color:var(--rosu);color:var(--rosu)">${esc(o.eroare)}</p>` : ''}

<h2 class="luna">Anii preluați de la Patriarhie</h2>
${tabel(['An', 'Zile', 'Preluat de la sursă', 'Importat'], o.importuri.map((i) => [String(i.an), String(i.zile), esc(momentLizibil(i.preluat_la)), esc(momentLizibil(i.importat_la))]))}
<form method="post" action="${p}/admin/preia">
  <input type="hidden" name="csrf" value="${esc(o.csrf)}">
  <input name="an" type="number" min="2024" max="2099" value="${anUrmator}" style="width:8rem" aria-label="anul de preluat">
  <button type="submit">Preia anul</button>
</form>
<p class="sursa">Preluarea e idempotentă: anul se rescrie complet. Anul următor apare la sursă abia în decembrie.</p>

<h2 class="luna">Corectură scrisă de mână</h2>
<p class="sursa">Peste sursă, cu valoarea veche păstrată. Se deschide o versiune nouă și se anunță consumatorii.</p>
<form method="post" action="${p}/admin/corecteaza" style="display:block">
  <input type="hidden" name="csrf" value="${esc(o.csrf)}">
  <label for="data">Ziua</label><input id="data" name="data" type="date" required>
  <label for="camp">Câmpul</label>
  <select id="camp" name="camp">${['titlu', 'titlu_html', 'subtitlu', 'cruce', 'cruce_text', 'post', 'perioada', 'evanghelia', 'apostolul', 'zi_libera', 'nunti', 'parastase'].map((c) => `<option>${c}</option>`).join('')}</select>
  <label for="valoare">Valoarea nouă</label><input id="valoare" name="valoare" type="text" maxlength="2000" style="width:100%">
  <label for="motiv">Motivul</label><input id="motiv" name="motiv" type="text" required maxlength="300" style="width:100%">
  <button type="submit">Scrie corectura</button>
</form>
${tabel(['Zi', 'Câmp', 'Din', 'În', 'Motiv'], o.corecturi.map((c) => [c.data, esc(c.camp), esc(c.valoare_veche ?? ''), esc(c.valoare_noua ?? ''), esc(c.motiv)]))}

<h2 class="luna">Versiuni</h2>
${tabel(['Când', 'Interval', 'Motiv'], o.versiuni.slice(0, 30).map((v) => [esc(momentLizibil(v.moment)), `${v.de_la}${v.de_la !== v.pana_la ? ` – ${v.pana_la}` : ''}`, esc(v.motiv)]))}

<h2 class="luna">Abonați</h2>
<p class="sursa">Audiența „calendar-abonati" a serviciului de comunicare; adresele sunt cele ale conturilor.</p>
${tabel(['Adresa contului', 'De când'], o.abonati.map((a) => [esc(a.adresa), esc(momentLizibil(a.created_at))]))}`,
  })
}

/** Textele zilei pentru fereastra din lista — aceeasi forma ca in V1. */
export function texteFereastra(o: { r: RandZi; d: RandDesfacut; zi: ZiLiturgica; texte: TexteZilei }): Record<string, string> {
  return {
    data: o.r.data,
    cand: `${ZILE_SAPTAMANA[o.r.zi_saptamana] ?? ''}, ${o.r.zi} ${LUNI[o.r.luna - 1] ?? ''} ${o.r.an}`,
    titlu: capulZilei(o.d),
    sfinti: sfintiiZilei(o.zi, o.d),
    sinaxar: cuprinsul(sectiunile(o.zi, o.texte, 'sinaxar')),
    'apostolul-evanghelia': cuprinsul(sectiunile(o.zi, o.texte, 'apostolul-evanghelia')),
  }
}

/**
 * POZA SĂPTĂMÂNII — pagina din care iese PNG-ul cerut de `/v1/poza/saptamana/<zi>`: antetul cu
 * intervalul și cele șapte zile, una sub alta, exact în forma din lista lunii (`randZi`).
 *
 * În V1 pozele se făceau dinainte, cu un script, pentru tot anul, și stăteau în R2 (limita de atunci:
 * un an întreg dura zece minute de Browser Rendering). Aici se fac la cerere și rămân în cache-ul de
 * muchie, cu cheia pe amprenta HTML-ului: prima cerere așteaptă câteva secunde, restul vin din cache,
 * iar când calendarul se corectează, poza se reface singură.
 *
 * Pagina e autonomă (stilul înăuntru) și n-are antet, unelte, șirul lunilor sau subsol — nimic din ce
 * e buton, fiindcă într-o poză nu se apasă nimic.
 */
export function pozaSaptamaniiHtml(o: {
  ctx: Ctx
  eticheta: string
  randuri: Array<{ r: RandZi; d: RandDesfacut; zi: ZiLiturgica }>
  azi: string
}): string {
  // Ziua de azi NU se marcheaza in poza (user, 10.09.2026): poza pleaca pe WhatsApp si se uita la ea
  // si peste trei zile — un semn „azi" ar minti. Pe pagina, unde se vede acum, marcajul ramane.
  const zile = o.randuri.map(({ r, d, zi }) => randZi(o.ctx, r, d, zi, false)).join("")
  return `<!doctype html><html lang="ro" data-tema="light"><head><meta charset="utf-8"><title>Calendarul săptămânii ${esc(o.eticheta)}</title>
<style>${STIL_COMUN}${LOCAL}
/* Poza iese pe FUNDAL DESCHIS (user, 11.09.2026: „toate generările de imagini să fie cu fundal
   deschis, deci nu dark. M-am răzgândit"). Pe 10.09 o ceruse închisă, ca să nu bată albul la ochi pe
   telefon — dacă vine vorba iar, asta a fost pricina. Tema se scrie pe html (data-tema="light"), nu se
   lasă la voia telefonului: altfel aceeași săptămână ar ieși altfel de la un om la altul. Culorile sunt
   ale temei de zi a platformei, deci roșul sărbătorilor și albastrul sfinților locali rămân aceleași
   cu ce se vede pe site ziua. */
body { margin: 0; background: var(--paper); color: var(--ink); }
/* Lata cat un telefon (user, 10.09.2026: „la 50% din cat e acum") — poza se trimite pe WhatsApp si se
   citeste tot pe telefon; la doi pixeli pe punct iese oricum de 900 px adevarati. */
.poza { width: 450px; box-sizing: border-box; padding: 20px 18px 22px; background: var(--paper); }
.poza .cap { text-align: center; margin: 0 0 14px; }
/* Numele aplicatiei, mare, ca in antetul paginilor; sub el parohia, apoi saptamana (user) */
.poza .cap .nume { font: 400 32px/1.05 "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;
                   letter-spacing: .04em; margin: 0; }
.poza .cap .parohia { font: 600 10px/1.4 ui-sans-serif, system-ui; letter-spacing: .16em;
                      text-transform: uppercase; color: #7f7f7f; margin: 5px 0 0; }
.poza .cap h1 { font-size: 20px; font-weight: 400; margin: 12px 0 0; letter-spacing: -.01em; }
.poza .cap .rand { border-top: 1px solid var(--rule); margin: 12px 0 0; }
/* in poza nimic nu se apasa: fereastra textelor si sagetile de deschidere n-au ce cauta */
.poza .zi .deschide, .poza .zi .fereastra, .poza .zi details summary::-webkit-details-marker { display: none; }
.poza .zi { break-inside: avoid; }
</style></head><body>
<div class="poza">
  <header class="cap">
    <p class="nume">CALENDAR</p>
    <p class="parohia">Biserica Sfântul Ilie – Hanul Colței</p>
    <h1>${esc(o.eticheta)}</h1>
    <div class="rand"></div>
  </header>
  <div class="zile">${zile}</div>
</div>
</body></html>`
}
