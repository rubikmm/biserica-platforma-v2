/**
 * Paginile calendarului. Markup-ul, clasele si textele sunt cele din V1 (cerere user,
 * 10.09.2026: „să respecți mesajele și grafica din V1"); ce s-a schimbat tine de structura
 * platformei, nu de infatisare: abonarea merge prin serviciul de comunicare, iar adresele
 * poarta prefixul aplicatiei (in preview toate stau pe acelasi host).
 */
import type { ZiLiturgica } from '@xc/contracts'
import type { Navigatie } from '@xc/config'
import { LUNI, STIL_COMUN, ZILE_SAPTAMANA, esc, momentLizibil, pagina } from '@xc/ui'
import type { PericopaCuText } from './biblia.js'
import type { Import, Versiune } from './depozit.js'
import { LOCAL } from './stil.js'
import { type RandDesfacut, type RandZi } from './traducere.js'

export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
  eAdmin: boolean
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

/** Plicul abonarii — acelasi desen ca la Program, ca butonul sa se recunoasca de la o aplicatie la alta. */
const IC_PLIC = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>`

// ---------------------------------------------------------------------------
// Bucatile antetului
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
 * Butonul filtrului pus se scrie marcat (`.activ`, rosu); apasat inca o data, il stinge.
 */
function unelte(o: {
  ctx: Ctx
  navigarea?: string
  /** filtrul de fel pus acum, daca e vreunul */
  felActiv?: FelFiltru
  /** luna peste care lucreaza filtrele, „<an>-<luna>"; lipseste cand lista tine anul intreg */
  luna?: string
}): string {
  const p = esc(o.ctx.prefix)
  const an = o.ctx.anCurent
  // Cu o luna in brate, filtrul se pune pe ea; fara luna (lista anului) se trece la lista de an a
  // celuilalt fel. Stins, drumul inapoi e luna neatinsa — ori, daca nu suntem pe nicio luna, luna de azi.
  const cuFel = (fel: FelFiltru) => (o.luna ? `${p}/${o.luna}?filtru=${fel}` : `${p}/sarbatori/${FILTRE[fel].slug}/${an}`)
  const faraFel = o.luna ? `${p}/${o.luna}` : ''
  /**
   * ⚠️ BUTOANELE FILTRELOR N-AU CUVINTE, NICI PE DESKTOP (user, 12.09.2026, 13:34: „pe desktop,
   * iconițele cu cruci lasă-le fără text… să fie ca pe mobil"). Le deosebeste CULOAREA crucii, ca in
   * calendarul tiparit, iar numele intreg sta in `title` si in `aria-label` — deci cine se uita cu
   * degetul pe ecran ori cu cititorul de ecran il afla. Asa incap trei butoane si navigarii ii ramane
   * spatiu adevarat: cu cuvinte, cele trei ar fi cerut ~470 px din 680 si pastila ar fi ramas cu 40.
   */
  const buton = (fel: FelFiltru) => {
    const nume = FILTRE[fel].nume
    const clasa = `btn mic sarb sarb-${fel}`
    const pus = o.felActiv === fel
    const unde = pus ? faraFel : cuFel(fel)
    const spune = pus ? `Scoate filtrul: ${nume.toLowerCase()}` : nume
    // stins, dar fara drum inapoi (lista anului, fara luna): butonul ramane marcat si neapasabil
    if (pus && !unde) {
      return `<span class="${clasa} activ" aria-current="page" title="${esc(nume)}" aria-label="${esc(nume)}">${IC_CRUCE}</span>`
    }
    return `<a class="${clasa}${pus ? ' activ' : ''}" href="${unde}"${pus ? ' aria-current="page"' : ''}`
      + ` title="${esc(spune)}" aria-label="${esc(nume)}">${IC_CRUCE}</a>`
  }
  return `${o.navigarea ?? ''}${butonAbonare(o.ctx)}
    <span class="desparte" aria-hidden="true"></span>
    ${buton('rosie')}
    ${buton('neagra')}
    ${buton('evlavie')}`
}

/**
 * ABONAREA, in doua bucati: butonul din rand si fereastra care se deschide din el.
 *
 * ⚠️ Amandoua sunt luate de la Program (user, 12.09.2026: „la click pe Abonare să apară un pop-up la
 * fel"), cu tot cu campul de adresa si cele doua bife — utilizatorul a ales anume varianta aceasta,
 * stiind ce aduce cu ea: pana cand fereastra se leaga de rute, abonarea calendarului NU MAI MERGE din
 * pagina. Ca la Program, unde fereastra e si acum doar infatisare.
 *
 * ⚠️ Ce ramane intreg dedesubt: rutele `POST /abonare` · `/dezabonare` si audienta
 * `calendar-abonati` a comunicarii. Cand fereastra se leaga, formularul capata `method="post"` si
 * `action` catre ele, iar adresa scrisa aici slujeste doar la facerea contului (identitatea o tine,
 * nu calendarul) — abonarea ramane pe adresa contului, cum cere structura platformei.
 *
 * ⚠️ BUTONUL E AL TUTUROR, SI AL ADMINILOR (user, 12.09.2026, 13:39: „să lăsăm totuși iconița de
 * abonare și la admini. Că și ei se comportă ca un utilizator care poate vor să fie anunțați. Aici nu
 * e vorba doar despre mine, care sunt super admin"). Dimineata ceruse invers, si asa fusese facut, ca
 * la Program; acum regula e limpede si e a amandurora: dreptul de a administra nu-l scoate pe om din
 * randul celor care vor sa primeasca vestea. Nu-l ascunde iar. (`ctx` ramane in semnatura: butonul
 * atarna oricum de om, iar de aici se va lega si starea „esti abonat" cand fereastra prinde rute.)
 */
function butonAbonare(_ctx: Ctx): string {
  return `<button type="button" class="btn mic abon" id="b-abonare"`
    + ` title="Primește calendarul pe email">${IC_PLIC}<span class="cuv">Abonare</span></button>`
}

function fereastraAbonare(_ctx: Ctx): string {
  return `<dialog class="modal" id="d-abonare" aria-labelledby="t-abonare">
  <form method="dialog" class="modal-cutie">
    <div class="modal-cap">
      <h2 id="t-abonare">Abonare</h2>
      <button value="inchide" class="modal-x" aria-label="Închide fereastra">&times;</button>
    </div>
    <p class="modal-spune">Pentru a vă abona, completați câmpul cu adresa de mail.</p>
    <label class="camp"><span>Adresa de e-mail</span>
      <input type="email" name="email" autocomplete="email" placeholder="nume@exemplu.ro"></label>
    <label class="bifa"><input type="checkbox" name="cont"> Vreau să fac cont.</label>
    <label class="bifa"><input type="checkbox" name="termeni"> Sunt de acord cu termenii și condițiile.</label>
    <div class="modal-jos"><button value="abonare" class="btn-plin">Abonare</button></div>
  </form>
</dialog>`
}

/**
 * Butonul deschide fereastra. Inchiderea n-are nevoie de JS: formularul dinauntru e `method="dialog"`,
 * deci si „Abonare", si X-ul o inchid singure (si Escape, de la browser). Acelasi script ca la Program.
 */
const JS_ABONARE = `
(function(){
  var b = document.getElementById("b-abonare");
  var d = document.getElementById("d-abonare");
  if (!b || !d || !d.showModal) return;
  // ⚠️ Cat timp fereastra e deschisa, pagina din spate NU se deruleaza (user, 12.09.2026, 13:42), iar
  // la inchidere isi capata derularea inapoi. <dialog> face pagina inertă, dar rotita mouse-ului tot
  // misca fundalul, si atunci omul se trezeste in alta parte a lunii cand inchide. Clasa e aceeasi cu
  // a ferestrei textelor zilei (body.cu-fereastra), deci regula de stil e scrisa o singura data.
  // Inchiderea o prindem din evenimentul „close": asa acopera si Escape, si butoanele dinauntru
  // (formularul e method="dialog"), fara sa le ascultam pe fiecare.
  b.addEventListener("click", function(){ d.showModal(); document.body.classList.add("cu-fereastra"); });
  d.addEventListener("close", function(){ document.body.classList.remove("cu-fereastra"); });
})();
`

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
  var fasie = document.querySelector('.fasie');
  if (fasie) {
    var lunaDeschisa = fasie.querySelector('.luna-buton.activa');
    if (lunaDeschisa) {
      fasie.scrollLeft = lunaDeschisa.offsetLeft - (fasie.clientWidth - lunaDeschisa.offsetWidth) / 2;
    }
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

  // ——— ziua de azi se aseaza la mijlocul ecranului, nu sub antet
  var randAzi = document.getElementById('azi');
  function laAzi() { if (randAzi) randAzi.scrollIntoView({ block: 'center' }); }
  if (randAzi && location.hash === '#azi') setTimeout(laAzi, 0);
  var butonAzi = document.querySelector('.azi-buton');
  if (butonAzi && randAzi) {
    butonAzi.addEventListener('click', function (ev) {
      ev.preventDefault();
      if (location.hash !== '#azi') history.replaceState(history.state, '', '#azi');
      laAzi();
    });
  }
  window.addEventListener('hashchange', function () { if (location.hash === '#azi') laAzi(); });
})();
`

/** Scriptul paginii de lună: navigarea, abonarea și fereastra cu textele zilei (din V1). */
function script(prefix: string): string {
  return JS_NAV + `
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
    document.body.classList.add('cu-fereastra');
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
    document.body.classList.remove('cu-fereastra');
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
    document.body.classList.remove('cu-fereastra');
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
 * NAVIGAREA — o PASTILA, ca la Program (user, 12.09.2026: „să fie o pastilă ca la Program și lunile
 * să fie text în capsulă"). Un singur corp cu chenar si colturi rotunjite, in care segmentele stau
 * lipite si despartite de o linie de 1 px: bulina lui „azi" la cap, apoi lunile, text simplu, fara
 * chenar al lor. Luna deschisa e segmentul rosu. Pana atunci fiecare luna era o pastiluta de sine
 * statatoare, cu chenar si spatiu intre ele.
 *
 * NUMAI anul curent, plus ianuarie anul viitor (cerere user, 10.09.2026: „nu mai afișa alți ani în
 * afară de anul curent și luna ianuarie anul viitor").
 *
 * ⚠️ Pastila se DERULEAZA stanga-dreapta (`.fasie` inauntru), si pe telefon, si oriunde lunile nu
 * incap („pe mobil tot așa să se poată muta stânga dreapta"). Sagetile ‹ › le scrie JS-ul, si numai
 * daca e ceva de derulat. Bulina sta in afara fasiei: ea nu se deruleaza niciodata.
 *
 * ⚠️ LUNILE SUNT UN FILTRU si PASTREAZA filtrul crucii (user, 12.09.2026): daca te uiti la zilele cu
 * cruce rosie si alegi alta luna, ramai pe rosu. Bulina lui „azi", in schimb, NU duce filtrul cu ea —
 * ea inseamna „arata-mi ziua de azi", iar ziua de azi poate sa nu fie in lista filtrata.
 *
 * ⚠️ „AZI" E O BULINA, nu un cuvant (user, 12.09.2026: „AZI să fie o bulină ca la Program"). Punctul
 * se deseneaza din CSS (`.azi-buton::before`), deci butonul ramane gol de text: numele lui se citeste
 * din `title` si `aria-label`, ca la bulina saptamanii din Program. Rosul i-a ramas — el spune ca
 * tinta e ziua de azi, iar un punct fara culoare n-ar zice nimic.
 *
 * Clasa `azi-buton` e si manerul de care se leaga JS-ul (derularea la ziua de azi); daca o schimbi,
 * schimb-o si in `JS_NAV`.
 *
 * `luna: 0` inseamna „nicio luna nu e a paginii" — asa o cheama listele de sarbatori, unde marcajul
 * rosu ar minti: acolo nu esti intr-o luna a calendarului, ci intr-o lista peste tot anul.
 */
function sirulLunilor(ctx: Ctx, an: number, luna: number, azi: string, fel?: FelFiltru): string {
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
  const [anAzi, lunaAzi] = azi.split('-').map(Number) as [number, number]
  // bulina se face rosie numai cand pagina arata chiar luna de azi — rosul spune locul, nu butonul
  const peLunaAzi = an === anAzi && luna === lunaAzi
  const butonAzi = `<a class="azi-buton${peLunaAzi ? ' activ' : ''}" href="${adresaLunii(p, anAzi, lunaAzi)}#azi"`
    // ⚠️ Butonul se cheama „Astăzi", si atat (user, 12.09.2026, 14:17: „textul buton Azi să fie chiar
    // «Astăzi» - nu mergi la luna…"). Un nume, nu o poruncă: bulina spune CE e, nu ce face cu tine.
    + ` title="Astăzi" aria-label="Astăzi"></a>`
  return `<span class="pastila">${butonAzi}<div class="fasie"><nav class="luni">${butoane.join('')}</nav></div></span>`
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
      navigarea: sirulLunilor(o.ctx, o.an, o.luna, o.azi, o.cruce),
      ...(o.cruce ? { felActiv: o.cruce } : {}),
      luna: lunaSir,
    }),
    subantet: fereastraAbonare(o.ctx),
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
    unelte: unelte({ ctx: o.ctx, navigarea: sirulLunilor(o.ctx, o.r.an, o.r.luna, o.azi), luna: `${o.r.an}-${String(o.r.luna).padStart(2, '0')}` }),
    subantet: fereastraAbonare(o.ctx),
    scripturi: JS_NAV + JS_ABONARE,
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
export const FILTRE: Record<FelFiltru, { nume: string; scurt: string; eticheta: string; slug: string; lamurire: string; pustiu: string }> = {
  rosie: {
    nume: 'Sărbători cu cruce roșie',
    scurt: 'roșie',
    eticheta: 'cruce roșie',
    slug: 'cruce-rosie',
    lamurire: 'Praznicele împărătești și sfinții cu ținere — zilele pe care calendarul oficial le însemnează cu cruce roșie.',
    pustiu: 'nicio zi însemnată cu cruce roșie',
  },
  neagra: {
    nume: 'Sărbători cu cruce neagră',
    scurt: 'neagră',
    eticheta: 'cruce neagră',
    slug: 'cruce-neagra',
    lamurire: 'Sfinții însemnați cu cruce neagră: se prăznuiesc, dar ziua nu e cu ținere.',
    pustiu: 'nicio zi însemnată cu cruce neagră',
  },
  evlavie: {
    nume: 'Sfinți cu evlavie',
    scurt: 'evlavie',
    eticheta: 'sfinți cu evlavie',
    slug: 'evlavie',
    lamurire: 'Sfinții la care ține parohia — lista e a noastră, nu a însemnului din calendarul oficial: cei mai mulți dintre ei sunt scriși acolo fără cruce.',
    pustiu: 'niciun sfânt din cei cu evlavie',
  },
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
  // de cand felurile sunt trei, jos se scriu amandoua celelalte, nu „celalalt"
  const celelalte = (['rosie', 'neagra', 'evlavie'] as FelFiltru[]).filter((f) => f !== o.fel)
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
    unelte: unelte({ ctx: o.ctx, navigarea: sirulLunilor(o.ctx, o.an, 0, o.azi, o.fel), felActiv: o.fel }),
    subantet: fereastraAbonare(o.ctx),
    scripturi: JS_NAV + JS_ABONARE,
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
// Mesaje si administrare
// ---------------------------------------------------------------------------

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
