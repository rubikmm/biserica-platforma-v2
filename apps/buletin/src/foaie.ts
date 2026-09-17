/**
 * FOAIA TIPĂRITĂ A BULETINULUI — cele patru pagini A4, ca HTML autonom (fonturile și imaginile
 * înglobate). PDF-ul îl face Browser Rendering, ca la foaia programului.
 *
 * Forma e a Word-ului parohiei, măsurată pe numerele din arhivă (vezi `masuri.ts`):
 *
 *   pagina 1 | antet fix (cruce, „BULETINUL PAROHIEI", parohia) peste toată lățimea,
 *            | apoi motto-ul și pastila „Nr. … / …" — ele sunt START-ul numărului;
 *            | dedesubt două coloane: în stânga poza mare și zona neagră cu autorul,
 *            | în dreapta titlul articolului principal și începutul textului.
 *   pagini 2-3 | patru coloane de text curat.
 *   pagina 4 | textul se termină sus, apoi „PROGRAMUL LITURGIC" cu tabelul cerut de la program
 *            | și subsolul fix al parohiei.
 *
 * ⚠️ CURGEREA O FACEM NOI, ÎN PAGINĂ (scriptul `CURGE`), nu CSS-ul. Chromium știe să spargă un
 * `column-count` peste pagini, dar noi avem cutii de înălțimi DIFERITE (coloana întâi a paginii
 * întâi e aproape plină de poză, cele de pe pagina a patra sunt scurtate de calendar) și piese
 * ancorate. Cu regiuni proprii avem două lucruri pe care CSS-ul nu le dă: așezarea e aceeași la
 * fiecare randare, și **știm câte semne au intrat cu adevărat** — cifra cu care răspunde API-ul.
 *
 * ⚠️ Scriptul e ES5 DINADINS, ca la program: rulează într-un Chromium pe care nu-l alegem noi.
 */
import { esc } from '@xc/ui'
import { type ArticolCerut, type NumarCerut, PAGINI } from './masuri.js'
// Trajan Pro 3: Regular e fontul Adobe original (v1.012, cu kerning); Bold vine din familia trimisă de
// user pe 17.09.2026 (abonament Adobe, liber din Adobe Fonts). Până atunci aveam doar un Regular extras
// dintr-un PDF, fără kerning, iar aldinul titlurilor era sintetic (text-stroke).
import trajanOtf from '../resurse/TrajanPro3-Regular.otf'
import trajanBoldOtf from '../resurse/TrajanPro3-Bold.otf'
import caladeaRegular from '../resurse/Caladea-Regular.ttf'
import caladeaBold from '../resurse/Caladea-Bold.ttf'
import caladeaItalic from '../resurse/Caladea-Italic.ttf'
import carlitoRegular from '../resurse/Carlito-Regular.ttf'
import carlitoBold from '../resurse/Carlito-Bold.ttf'
import chenarPng from '../resurse/chenar.png'
import crucePng from '../resurse/cruce.png'
// Floarea de deasupra calendarului — trimisă de user pe 17.09.2026 („Elementul de la final înainte de
// program"). Cade prima când textul n-are loc (`socoteste().floare`).
import floarePng from '../resurse/floare.png'

/** Textul fix din subsolul paginii a patra — al parohiei, nu al nostru: nu se schimbă din API. */
export const SUBSOL = [
  'Pentru versiunea digitală și extinsă a buletinului, abonați-vă pe sfantul-ilie.ro.',
  'Strada Doamnei, nr. 18, Sector 3, București',
]

export const PAROHIA = 'S F Â N T U L   I L I E   -   H A N U L   C O L Ț E I'
export const TITLU_CALENDAR = 'PROGRAMUL LITURGIC'

// ---------------------------------------------------------------------------
// Resursele, ca data-URI (codificate o singură dată pe izolat)
// ---------------------------------------------------------------------------

const memo = new Map<string, string>()
function dataUri(cheie: string, octeti: ArrayBuffer, tip: string): string {
  const gata = memo.get(cheie)
  if (gata) return gata
  const b = new Uint8Array(octeti)
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  const uri = `data:${tip};base64,${btoa(s)}`
  memo.set(cheie, uri)
  return uri
}

const fonturi = (): string => `
@font-face { font-family: "Trajan"; src: url(${dataUri('trajan', trajanOtf, 'font/otf')}) format("opentype"); font-weight: 400; }
@font-face { font-family: "Trajan"; src: url(${dataUri('trajan-b', trajanBoldOtf, 'font/otf')}) format("opentype"); font-weight: 700; }
@font-face { font-family: "Caladea"; src: url(${dataUri('cal-r', caladeaRegular, 'font/ttf')}) format("truetype"); font-weight: 400; }
@font-face { font-family: "Caladea"; src: url(${dataUri('cal-b', caladeaBold, 'font/ttf')}) format("truetype"); font-weight: 700; }
@font-face { font-family: "Caladea"; src: url(${dataUri('cal-i', caladeaItalic, 'font/ttf')}) format("truetype"); font-style: italic; }
@font-face { font-family: "Carlito"; src: url(${dataUri('car-r', carlitoRegular, 'font/ttf')}) format("truetype"); font-weight: 400; }
@font-face { font-family: "Carlito"; src: url(${dataUri('car-b', carlitoBold, 'font/ttf')}) format("truetype"); font-weight: 700; }`

// ---------------------------------------------------------------------------
// Stilul foii
// ---------------------------------------------------------------------------

/**
 * Măsurile din CSS sunt cele din `masuri.ts`, scrise în milimetri fiindcă așa le înțelege hârtia:
 * coloana 241.1 pt = 85.06 mm, șanțul 21.12 pt = 7.45 mm, marginea din stânga 42.6 pt = 15.03 mm.
 */
const STIL = `
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: "Caladea", Cambria, Georgia, serif; color: #000; font-size: 15pt; line-height: 1.104; }
.pagina { position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; }
/* Ultima pagina nu e :last-child (dupa ea vin #rest si scriptul), de aceea e insemnata cu clasa. */
.pagina.ultima { page-break-after: auto; }
.chenar { position: absolute; left: 7.3mm; top: 5.9mm; width: 195.4mm; height: 285.2mm; z-index: 0; }

/* Cele două coloane, așezate la măsură, nu într-un flow: curgerea o face scriptul. */
.col { position: absolute; width: 85.06mm; z-index: 1; overflow: hidden; }
.col.a { left: 15.03mm; }
.col.b { left: 107.54mm; }
/* Banda de text: primul rând începe la ~48 pt de sus, ultimul se termină pe la 793 pt — măsurat pe
   arhivă. Înălțimea e un MULTIPLU ÎNTREG de rând (45 × 16.56 pt = 262.93 mm), ca ultimul rând să
   nu cadă pe jumătate afară din cutie. */
.col { top: 16.6mm; height: 263.5mm; }

/* Capul paginii întâi stă peste amândouă coloanele, deci le scurtează pe amândouă. */
.cap { position: absolute; left: 15.03mm; right: 15.03mm; top: 13mm; z-index: 1; text-align: center; }
.cruce { width: 36.5mm; display: block; margin: 0 auto 1mm; }
/* Titlul foii: MAJUSCULE, Trajan Pro 3 Regular, FARA aldin (user, 17.09.2026 seara: „scoate bold";
   numele foii urmeaza sa se schimbe). Parohia, sub el, putin mai mare ca la programul liturgic. */
.titlu-foaie { font-family: "Trajan", serif; font-size: 35pt; line-height: 1; margin: 0; font-weight: 400;
               text-transform: uppercase; letter-spacing: .4pt; }
.parohia { font-family: "Trajan", serif; font-size: 11pt; white-space: pre; margin: 1.6mm 0 0; }
.motto { font-style: italic; font-size: 14pt; line-height: 1.32; margin: 2.6mm 0 0; }
.motto-autor { font-family: "Carlito", Calibri, sans-serif; font-size: 13.5pt; color: #7e7e7e; margin: .6mm 0 0; }
/* Pastila numărului atârnă de o linie pe toată lățimea — ca la foaia programului, aceeași mână. */
.linie { border-top: .75pt solid #333; margin: 3mm 0 0; height: 0; font-size: 0; line-height: 0; }
.numar { display: inline-block; background: #e6e6e6; border: .5pt solid #333; border-top: 0;
         border-radius: 0 0 1.6mm 1.6mm; box-shadow: .6mm .6mm 0 #999;
         font-family: "Carlito", Calibri, sans-serif; font-size: 11pt; line-height: 1.25;
         padding: .9mm 6mm; }
.numar b { font-weight: 700; }

/* Piesele articolului */
/* REGULA COLOANEI INTAI (user, 17.09.2026): pe pagina intai, coloana din stanga tine DOAR poza si zona
   neagra — niciodata text. Poza umple tot ce ramane deasupra zonei negre; fara poza, locul ei ramane
   desenat (chenar punctat), ca sa se vada pe ciorna ce lipseste. */
.pagina[data-pagina="1"] .col.a { display: flex; flex-direction: column; }
.poza { display: block; width: 100%; margin: 0; }
.poza.mare { flex: 1 1 auto; min-height: 0; object-fit: cover; border: .6pt solid #000; box-sizing: border-box; }
.poza-loc { flex: 1 1 auto; min-height: 0; border: .6pt dashed #888; box-sizing: border-box;
            display: flex; align-items: center; justify-content: center;
            font-family: "Carlito", Calibri, sans-serif; font-size: 11pt; color: #888; }
.pagina[data-pagina="1"] .col.a .zona-neagra { flex: 0 0 auto; margin-bottom: 0; }
.poza.mica { margin-bottom: 1.5mm; }
.zona-neagra { background: #000; color: #fff; text-align: center; padding: 2.4mm 2mm 2.8mm; margin: 0 0 3mm; }
.zona-neagra .nume { font-family: "Trajan", serif; font-size: 17pt; line-height: 1.24; }
.zona-neagra .ani { font-family: "Trajan", serif; font-size: 11.5pt; margin-top: 1mm; }
.zona-neagra .pomenire { font-family: "Trajan", serif; font-size: 12pt; margin-top: .8mm; }
.zona-neagra.mica { padding: 2mm 2mm 2.2mm; }
.zona-neagra.mica .nume { font-size: 13pt; }
/* Titlul articolului: Trajan Pro 3 Bold adevărat la secundari (din 17.09.2026 seara; înainte era Regular
   îngroșat sintetic cu text-stroke); cel al primului text, pe pagina intai, e Regular — user, 17.09.2026
   seara: „scoate bold de la titlul primului text". */
.titlu-articol { font-family: "Trajan", serif; font-size: 17pt; line-height: 1.22; text-align: center;
                 margin: 0 0 1.4mm; font-weight: 700; }
.titlu-articol + .rigla { border-top: .5pt solid #000; margin: 0 0 1.6mm; height: 0; }
p.t { margin: 0; text-align: justify; text-indent: 10mm; hyphens: none; }
.sursa { font-family: "Carlito", Calibri, sans-serif; font-size: 10.5pt; border-top: .5pt solid #000;
         margin-top: 1.4mm; padding-top: .8mm; text-align: left; }
.sursa b { font-weight: 700; }
.sursa .nota { text-align: justify; margin-bottom: .4mm; }

/* Pagina a patra: calendarul peste toată lățimea, sub coloane, și subsolul fix. */
.jos { position: absolute; left: 15.03mm; right: 15.03mm; bottom: 11mm; z-index: 1; text-align: center; }
.floare { display: block; margin: 0 auto 1mm; width: 44mm; }
/* „PROGRAMUL LITURGIC": Trajan Pro 3 Regular, ca titlul foii — nu Caladea aldin (user, 17.09.2026 seara). */
.cap-calendar { font-family: "Trajan", serif; font-size: 18pt; margin: 0 0 1.8mm; font-weight: 400; letter-spacing: .3pt; }
/* Titlul principalului, pe pagina întâi, stă mai jos de pastila numărului — măsurat pe nr. 615:
   trei rânduri de aer între linie și titlu. Titlul e mai mare decât la secundari (pe hârtie ~21 pt)
   și, spre deosebire de ei, NU e aldin (user, 17.09.2026 seara). */
.pagina[data-pagina="1"] .col.b > .titlu-articol:first-child { margin-top: 9mm; font-size: 21pt; line-height: 1.3; margin-bottom: 2.4mm;
                                                               font-weight: 400; }
.subsol { font-family: "Carlito", Calibri, sans-serif; font-size: 10.5pt; line-height: 1.3; margin-top: 2mm; }

/* Ce n-a încăput rămâne aici, nevăzut, și se numără în raport. */
#rest { position: absolute; left: -9999mm; top: 0; width: 85.06mm; }
`

// ---------------------------------------------------------------------------
// Blocurile unui articol, în ordinea în care curg
// ---------------------------------------------------------------------------

/**
 * Singurul marcaj din text: `*cursiv*` → cursive (citatele din Scriptură stau în cursive pe foaie).
 * Se aplică DUPĂ escapare, deci în pagină nu ajunge niciodată alt HTML decât al nostru.
 */
const cursiv = (escapat: string): string => escapat.replace(/\*([^*\n]{1,400})\*/g, '<i>$1</i>')

const paragrafe = (text: string): string[] =>
  text.split(/\n\s*\n|\r\n\r\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)

/** Zona neagră cu numele autorului — la principal sub poză, la secundar în capul articolului. */
function zonaNeagra(a: ArticolCerut, mica: boolean): string {
  const randuri = [`<div class="nume">${esc(a.autor)}</div>`]
  if (a.ani) randuri.push(`<div class="ani">${esc(a.ani)}</div>`)
  if (a.pomenire) randuri.push(`<div class="pomenire">${esc(a.pomenire)}</div>`)
  return `<div class="zona-neagra${mica ? ' mica' : ''}">${randuri.join('')}</div>`
}

const titluArticol = (a: ArticolCerut): string =>
  `<h2 class="titlu-articol">${esc(a.titlu)}</h2><div class="rigla"></div>`

/** Rândul sursei; deasupra lui, dacă e, mențiunea (de unde e luat textul, în cuvinte). */
const sursa = (a: ArticolCerut): string =>
  a.sursa
    ? `<div class="sursa">${a.nota ? `<div class="nota">${esc(a.nota)}</div>` : ''}Sursa: <b>${esc(a.sursa)}</b></div>`
    : ''

/**
 * Bucățile care curg prin coloane, în ordine. Poza mare și zona neagră a principalului NU sunt
 * aici: ele stau ancorate în coloana întâi a paginii întâi, unde le-a pus dintotdeauna foaia.
 */
function bucati(cerut: NumarCerut, poze: Record<string, string>): string[] {
  const b: string[] = []
  const articol = (a: ArticolCerut, principal: boolean, i: number): void => {
    if (!principal) {
      if (a.poza && poze[`s${i}`]) b.push(`<img class="poza mica" src="${poze[`s${i}`]}" alt="">`)
      b.push(zonaNeagra(a, true))
    }
    b.push(titluArticol(a))
    paragrafe(a.text).forEach((p, k) => b.push(`<p class="t${k === 0 ? ' prim' : ''}">${cursiv(esc(p))}</p>`))
    if (a.sursa) b.push(sursa(a))
  }
  articol(cerut.principal, true, 0)
  ;(cerut.secundari ?? []).forEach((a, i) => articol(a, false, i + 1))
  return b
}

// ---------------------------------------------------------------------------
// Curgerea, făcută în pagină
// ---------------------------------------------------------------------------

/**
 * Mută bucățile din `#rest` în coloane, una câte una; un paragraf care nu intră întreg se taie la
 * cuvânt (căutare binară pe cuvinte) și coada lui trece în coloana următoare.
 *
 * ⚠️ Un titlu sau o zonă neagră NU se lasă singure la piciorul coloanei (văduvă de cap): dacă după
 * ele n-ar mai încăpea măcar două rânduri de text, coloana se închide și capul trece mai departe.
 * Fără regula asta, un secundar începe cu numele autorului pe pagina 3 și cu textul pe pagina 4.
 *
 * La sfârșit scrie în `data-raport` ce a intrat și ce a rămas pe dinafară, și ridică
 * `data-potrivit` — semnul după care `hartieDinCache` știe că pagina e gata de tipărit.
 */
const CURGE = `
(function(){
  var rest = document.getElementById('rest');
  // coloana intai a paginii intai NU primeste text: e a pozei si a zonei negre (regula userului)
  var coloane = [].slice.call(document.querySelectorAll('.col')).filter(function(c){ return c.getAttribute('data-cutie') !== '1a'; });
  if (!rest || !coloane.length) return gata({});
  var MM = 96 / 25.4;

  /*
   * Întâi se măsoară piesele ancorate și se scurtează coloanele pe care le acoperă. Capul paginii
   * întâi și josul paginii a patra stau peste toată lățimea, deci taie din AMÂNDOUĂ coloanele
   * paginii lor — nu doar din cea de sub ele.
   */
  /*
   * Golul de deasupra calendarului (user, 17.09.2026: „minim cum e acum și dublu în mod normal"):
   * de obicei 6 mm; daca textul nu incape, se strange la 3 mm si se curge inca o data.
   */
  var GOL_NORMAL = 6, GOL_MINIM = 3;
  function scurteaza(golCalendarMm){
    var cap = document.querySelector('.pagina[data-pagina="1"] .cap');
    if (cap) {
      var sub = cap.offsetTop + cap.offsetHeight + 3 * MM;
      [].forEach.call(document.querySelectorAll('.pagina[data-pagina="1"] .col'), function(c){
        var jos = c.offsetTop + c.offsetHeight;
        c.style.top = sub + 'px';
        c.style.height = Math.max(0, jos - sub) + 'px';
      });
    }
    var jos = document.querySelector('.jos');
    if (jos) {
      var sus = jos.offsetTop - golCalendarMm * MM;
      [].forEach.call(jos.parentNode.querySelectorAll('.col'), function(c){
        c.style.height = Math.max(0, sus - c.offsetTop) + 'px';
      });
    }
  }
  /*
   * ⚠️ Cat e ocupat se masoara pe ULTIMUL copil, nu cu scrollHeight: acela nu coboara niciodata
   * sub clientHeight, deci intr-o coloana goala ar spune ca nu mai e loc deloc. Coloana e
   * position:absolute, deci copiii se masoara fata de ea.
   */
  var RAND_PX = 16.56 * 96 / 72;
  /*
   * ⚠️ Cu getBoundingClientRect, nu cu offsetTop/offsetHeight: acelea se rotunjesc la pixel
   * intreg, iar peste 45 de randuri sfertul de pixel adunat ajunge un rand — si randul al
   * patruzeci-si-saselea iese TAIAT pe hartie, ceea ce se vede abia dupa tiparire.
   */
  function ocupat(col){
    var u = col.lastElementChild;
    if (!u) return 0;
    return u.getBoundingClientRect().bottom - col.getBoundingClientRect().top;
  }
  function incape(col){ return ocupat(col) <= col.clientHeight - 0.5; }
  function randuriLibere(col){ return (col.clientHeight - ocupat(col)) / RAND_PX; }
  function taie(col, p){
    // p e deja în coloană și dă pe dinafară: caut cel mai lung început care încape
    var vorbe = p.textContent.split(' ');
    var jos = 0, sus = vorbe.length, bun = 0;
    while (jos <= sus) {
      var mij = (jos + sus) >> 1;
      p.textContent = vorbe.slice(0, mij).join(' ');
      if (incape(col)) { bun = mij; jos = mij + 1; } else { sus = mij - 1; }
    }
    p.textContent = vorbe.slice(0, bun).join(' ');
    return vorbe.slice(bun).join(' ');
  }
  function curge(){
    var i = 0, intrate = 0, peDinafara = 0;
    while (rest.firstChild && i < coloane.length) {
      var col = coloane[i], bucata = rest.firstChild;
      var eCap = bucata.className && /titlu-articol|zona-neagra|poza/.test(bucata.className);
      if (eCap && randuriLibere(col) < 4.2) { i++; continue; }
      col.appendChild(bucata);
      if (incape(col)) { intrate += (bucata.textContent || '').length; continue; }
      if (bucata.tagName !== 'P') { col.removeChild(bucata); rest.insertBefore(bucata, rest.firstChild); i++; continue; }
      var coada = taie(col, bucata);
      intrate += (bucata.textContent || '').length;
      if (coada) {
        var p = document.createElement('p');
        p.className = 't';
        p.style.textIndent = '0';
        p.textContent = coada;
        rest.insertBefore(p, rest.firstChild);
      }
      i++;
    }
    for (var k = 0; k < rest.childNodes.length; k++) peDinafara += (rest.childNodes[k].textContent || '').length;
    return { intrate: intrate, peDinafara: peDinafara, coloaneFolosite: Math.min(i + 1, coloane.length) };
  }
  // intai cu golul normal deasupra calendarului; daca n-a incaput, se ia de la capat cu golul minim
  var deLaCapat = rest.innerHTML;
  scurteaza(GOL_NORMAL);
  var raport = curge();
  raport.golCalendarMm = GOL_NORMAL;
  if (raport.peDinafara > 0) {
    for (var c = 0; c < coloane.length; c++) coloane[c].innerHTML = '';
    rest.innerHTML = deLaCapat;
    scurteaza(GOL_MINIM);
    raport = curge();
    raport.golCalendarMm = GOL_MINIM;
  }
  while (rest.firstChild) rest.removeChild(rest.firstChild);
  gata(raport);
  function gata(raport){
    document.documentElement.setAttribute('data-raport', JSON.stringify(raport));
    document.documentElement.setAttribute('data-potrivit', 'da');
  }
})();`

// ---------------------------------------------------------------------------
// Foaia
// ---------------------------------------------------------------------------

export interface OptiuniFoaie {
  cerut: NumarCerut
  /** data-URI-urile pozelor: `p` pentru poza mare, `s1`/`s2` pentru cele mici */
  poze?: Record<string, string>
  /** tabelul programului, cerut de la aplicația `program` — HTML + stilul lui */
  calendar?: { tabel: string; stil: string } | null
  /** floarea decorativă de deasupra calendarului — se pune dacă nu e `false` */
  floare?: boolean
  /** ziua în litere, pentru pastila numărului: „6 septembrie 2026" */
  dataScrisa: string
}

export function foaieHtml(o: OptiuniFoaie): string {
  const { cerut } = o
  const poze = o.poze ?? {}
  const pagini: string[] = []
  const chenar = `<img class="chenar" src="${dataUri('chenar', chenarPng, 'image/png')}" alt="">`

  for (let p = 1; p <= PAGINI; p++) {
    const capul = p === 1
      ? `<div class="cap">
      <img class="cruce" src="${dataUri('cruce', crucePng, 'image/png')}" alt="">
      <h1 class="titlu-foaie">BULETINUL PAROHIEI</h1>
      <p class="parohia">${PAROHIA}</p>
      <p class="motto">${esc(cerut.motto)}</p>
      ${cerut.motoAutor ? `<p class="motto-autor">– ${esc(cerut.motoAutor)}</p>` : ''}
      <div class="linie"></div>
      <div class="numar"><b>Nr. ${cerut.nr}</b> / ${esc(o.dataScrisa)}</div>
    </div>`
      : ''

    // Ancorele paginii întâi: poza mare (sau locul ei) și zona neagră a principalului — și nimic altceva.
    const ancore = p === 1
      ? `${poze.p ? `<img class="poza mare" src="${poze.p}" alt="">` : `<div class="poza-loc">poza</div>`}${zonaNeagra(cerut.principal, false)}`
      : ''

    const josul = p === PAGINI
      ? `<div class="jos">
      ${o.floare !== false ? `<img class="floare" src="${dataUri('floare', floarePng, 'image/png')}" alt="">` : ''}
      ${o.calendar ? `<h2 class="cap-calendar">${TITLU_CALENDAR}</h2>${o.calendar.tabel}` : ''}
      <div class="subsol">${SUBSOL.map((r) => `<div>${esc(r)}</div>`).join('')}</div>
    </div>`
      : ''

    // `data-potrivire`: semnul după care Browser Rendering (`@xc/ui`) așteaptă sfârșitul curgerii
    // înainte să tipărească. Fără el ar ieși pagina goală.
    pagini.push(`<div class="pagina${p === PAGINI ? ' ultima' : ''}" data-potrivire data-pagina="${p}">${chenar}${capul}
    <div class="col a" data-cutie="${p}a">${ancore}</div>
    <div class="col b" data-cutie="${p}b"></div>
    ${josul}</div>`)
  }

  return `<!doctype html><html lang="ro"><head><meta charset="utf-8">
<title>Buletinul parohiei · nr. ${cerut.nr} / ${esc(o.dataScrisa)}</title>
<style>${fonturi()}${STIL}${o.calendar?.stil ?? ''}
${masuriDeSus(o)}</style></head>
<body>${pagini.join('\n')}
<div id="rest">${bucati(cerut, poze).join('')}</div>
<script>${CURGE}</script>
</body></html>`
}

/**
 * Scurtările de coloană care atârnă de conținut: capul paginii întâi și josul paginii a patra
 * mănâncă din coloanele lor. Se scriu ca stil, după ce știm ce e în ele — înălțimile se măsoară
 * în pagină, dar pornirea trebuie să fie deja aproape, altfel prima curgere iese strâmbă.
 */
function masuriDeSus(o: OptiuniFoaie): string {
  // capul paginii întâi: antet + motto (două rânduri) + pastila numărului
  const randuriMotto = Math.max(1, Math.ceil(o.cerut.motto.length / 78))
  const capMm = 58 + (randuriMotto - 2) * 6
  // josul paginii a patra: floarea + „PROGRAMUL LITURGIC" + tabelul + subsolul. Îl măsoară
  // scriptul; aici dăm o pornire ca să nu curgă textul peste el.
  return `
.pagina[data-pagina="1"] .col { top: ${capMm}mm; height: ${268.7 + 15.52 - capMm}mm; }
`
}

/** Aceleași bucăți, dar ca text curat — pentru arhivă și căutare. */
export const textCurat = (cerut: NumarCerut): string =>
  [cerut.principal, ...(cerut.secundari ?? [])]
    .map((a) => `${a.autor}\n${a.titlu}\n${a.text}${a.sursa ? `\nSursa: ${a.sursa}` : ''}`)
    .join('\n\n')
