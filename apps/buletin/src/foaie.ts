/**
 * FOAIA TIPĂRITĂ A BULETINULUI — cele patru pagini A4, ca HTML autonom (fonturile și imaginile
 * înglobate). PDF-ul îl face Browser Rendering, ca la foaia programului.
 *
 * Forma e a Word-ului parohiei, măsurată pe numerele din arhivă (vezi `masuri.ts`):
 *
 *   pagina 1 | antet fix (cruce, „BULETINUL BISERICII", parohia) peste toată lățimea,
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
import { curatDeMarcaje, marcaj } from './marcaje.js'
// Trajan Pro 3 Regular: fontul Adobe original (v1.012, cu kerning), din familia trimisă de user pe
// 17.09.2026 (abonament Adobe, liber din Adobe Fonts). Până atunci aveam un Regular extras dintr-un PDF,
// fără kerning.
// ⚠️ BOLD-ul s-a întors pe 19.09.2026, dar NUMAI LA CERERE: titlul rămâne Regular implicit (userul a
// scos aldinul din titluri pe 17.09.2026, 22:38), iar Trajan Bold se încorporează doar când un titlu
// are `*între steluțe*`. Altfel ar fi 216 KB de base64 degeaba în fiecare foaie — de aceea `fonturi()`
// primește un martor, nu scrie fața aldină din oficiu.
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

/**
 * Textul fix din subsolul paginii a patra — al parohiei, nu al nostru: nu se schimbă din API.
 * ⚠️ Rândul de pe urmă e ADRESA și se scrie ALDIN (user, 18.09.2026) — vezi `.subsol .adresa`.
 */
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

/**
 * Fețele încorporate în foaie. `trajanAldin` se cere doar când un titlu are marcaj de aldin: fontul
 * Bold e 162 KB pe disc, adică ~216 KB de base64 în HTML-ul fiecărei foi.
 */
const fonturi = (trajanAldin: boolean): string => `
@font-face { font-family: "Trajan"; src: url(${dataUri('trajan', trajanOtf, 'font/otf')}) format("opentype"); font-weight: 400; }${trajanAldin ? `
@font-face { font-family: "Trajan"; src: url(${dataUri('trajan-b', trajanBoldOtf, 'font/otf')}) format("opentype"); font-weight: 700; }` : ''}
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
/* Crucea (36.5 x 17.8 mm) NU e centrata pe pagina: stalpul ei cade pe stalpul L-ului din „BULETINUL"
   (user, 17.09.2026, 22:37: „crucea trebuie sa fie mai la stanga, sa pice fix pe linia de la L").
   De aceea sta absolut, ancorata de span.l din jurul L-ului: left = stalpul literei (masurat pe
   randare), top = inaltimea crucii + 2 mm aer (era 1 mm; „dubleaza distanta"). Titlul primeste
   padding-top cat crucea, ca sa ramana loc pentru ea in capul paginii. */
.l { position: relative; }
/* Aerul cruce → titlu = aerul rama → cruce, 3.7 mm (user, 23:07: „la fel ca distanta dintre cruce si rama");
   masurat la 200 dpi: rama se termina la 75 px, crucea incepe la 104 (29 px = 3.7 mm), deci de la
   talpa crucii la capul literelor tot 29 px. Top = inaltimea crucii (17.8 mm) + 3.2 mm pana la em-box. */
.cruce { position: absolute; width: 36.5mm; left: 2.45mm; top: -21mm; transform: translateX(-50%); }
/* Titlul foii: MAJUSCULE, Trajan Pro 3 Regular, FARA aldin (user, 17.09.2026 seara: „scoate bold").
   „BULETINUL BISERICII" din 17.09.2026, 22:37 (era „BULETINUL PAROHIEI"). Parohia, sub el, putin mai
   mare ca la programul liturgic. */
.titlu-foaie { font-family: "Trajan", serif; font-size: 35pt; line-height: 1; margin: 0; font-weight: 400;
               padding-top: 21.2mm; text-transform: uppercase; letter-spacing: .4pt; }
.parohia { font-family: "Trajan", serif; font-size: 11pt; white-space: pre; margin: 1.6mm 0 0; }
/* Motto-ul: RANDURILE LUI la jumatate de departare (user, 23:07: „distanta dintre randuri trebuia sa se
   injumatateasca — cred ca am scris eu gresit"): golul dintre randuri era 2.2 mm la line-height 1.32,
   la 1.1 e ~1.1 mm. Departarea fata de parohie ramane cea dinainte (2.6 mm) — cererea de la 22:37
   („la jumatate distanta") era despre randuri, nu despre golul de sub titlu. */
.motto { font-style: italic; font-size: 14pt; line-height: 1.1; margin: 2.6mm 0 0; }
/* Motto-ul e cursiv cu totul, deci _liniutele_ din el nu se vad; *stelutele* il ingroasa. */
.motto b, .motto-autor b { font-weight: 700; }
.motto i, .motto-autor i { font-style: italic; }
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
/* Poza principala are chenar negru gros: 1.2 mm (user, 22:38: „margine neagra 3 sau 4 px", apoi 23:07:
   „mai groasa"). In nr. 615 din Word chenarul are 1.0 mm (8 px la 200 dpi), asta e putin peste. */
.poza.mare { flex: 1 1 auto; min-height: 0; object-fit: cover; border: 1.2mm solid #000; box-sizing: border-box; }
.poza-loc { flex: 1 1 auto; min-height: 0; border: .6pt dashed #888; box-sizing: border-box;
            display: flex; align-items: center; justify-content: center;
            font-family: "Carlito", Calibri, sans-serif; font-size: 11pt; color: #888; }
.pagina[data-pagina="1"] .col.a .zona-neagra { flex: 0 0 auto; margin-bottom: 0; }
.poza.mica { margin-bottom: 1.5mm; }
.zona-neagra { background: #000; color: #fff; text-align: center; padding: 2.4mm 2mm 2.8mm; margin: 0 0 3mm; }
/* Rândul mic de deasupra numelui: cinstirea („SFÂNTUL CUVIOS MĂRTURISITOR"), despărțită de nume cu o
   bară — user, 19.09.2026: „pe un rând mai mic SFÂNTUL CUVIOS MĂRTURISITOR / SOFIAN de la ANTIM".
   Tot Trajan, cât anii și pomenirea, cu un fir de aer sub el. */
.zona-neagra .deasupra { font-family: "Trajan", serif; font-size: 12pt; line-height: 1.2; margin-bottom: .8mm; }
.zona-neagra .nume { font-family: "Trajan", serif; font-size: 17pt; line-height: 1.24; }
.zona-neagra .ani { font-family: "Trajan", serif; font-size: 11.5pt; margin-top: 1mm; }
.zona-neagra .pomenire { font-family: "Trajan", serif; font-size: 12pt; margin-top: .8mm; }
.zona-neagra.mica { padding: 2mm 2mm 2.2mm; }
.zona-neagra.mica .nume { font-size: 13pt; }
.zona-neagra.mica .deasupra { font-size: 10pt; }
/* Titlul articolului: Trajan Pro 3 Regular, FARA aldin DIN OFICIU, la toate — principal si secundari
   (user, 17.09.2026, 22:38: „titlurile celorlalte articole secundare sa nu fie bold si sa Trajan";
   mai devreme, 22:15, scosese aldinul de la primul text).
   Din 19.09.2026 titlul primeste si el marcajele omului: *intre stelute* = aldin, iar atunci foaia
   incorporeaza Trajan Bold cel adevarat (resurse/TrajanPro3-Bold.otf, vezi fonturi()). Implicit
   titlul ramane Regular — aldinul e o cerere, nu o regula.
   ⚠️ _intre liniute de jos_ in titlu iese OBLIC SINTETIC: Trajan Pro 3 n-are cursiv, deci Chromium
   inclina el literele. E asumat; daca nu place, se scoate cursivul din titluri. */
.titlu-articol { font-family: "Trajan", serif; font-size: 17pt; line-height: 1.22; text-align: center;
                 margin: 0 0 1.4mm; font-weight: 400; }
.titlu-articol b { font-weight: 700; }
.titlu-articol i { font-style: italic; }
/* Intre articole, cel putin 1 cm (user, 17.09.2026, 22:39): il poarta prima bucata a fiecarui secundar,
   dar nu si cand ea deschide o coloana — acolo golul il da hotarul paginii. */
.incepe-articol { margin-top: 10mm; }
.col > .incepe-articol:first-child { margin-top: 0; }
/* Semnatura de sub titlu (user, 19.09.2026: „adaugam ca semnatura sub titluri"): corpul textului,
   aldin si centrat, intre titlu si rigla — „Text de: Parintele Mihail Stanciu, fost staret al
   Manastirii Antim". Scrisa de om cu totul, cuvant cu cuvant: „Text de:" nu se adauga din cod. */
.semnatura { font-family: "Caladea", serif; font-size: 15pt; font-weight: 700; line-height: 1.3;
             text-align: center; margin: 0 0 1.4mm; }
/* Semnatura e aldina cu totul, deci *stelutele* din ea nu se vad; _liniutele de jos_ o inclina. */
.semnatura b { font-weight: 700; }
.semnatura i { font-style: italic; }
/* ⚠️ Rigla isi tine firul si cand semnatura s-a asezat intre ea si titlu: selectorul e pe FRATELE
   DE DINAINTE, deci fara al doilea caz linia ar fi disparut tocmai la articolele semnate. */
.titlu-articol + .rigla, .semnatura + .rigla { border-top: .5pt solid #000; margin: 0 0 1.6mm; height: 0; }
p.t { margin: 0; text-align: justify; text-indent: 10mm; hyphens: none; }
/* Marcajele din corpul textului — Caladea are si fata aldina, si cea cursiva, incorporate mai sus. */
p.t b { font-weight: 700; }
p.t i { font-style: italic; }
/* Sursa si mentiunea de deasupra ei: 13 pt, ca in nr. 615 din Word (Calibri 13.3 pt, pas 16.4 pt) — erau
   10.5 pt, „text scris prea mic" (user, 23:07). */
.sursa { font-family: "Carlito", Calibri, sans-serif; font-size: 13pt; line-height: 1.26; border-top: .5pt solid #000;
         margin-top: 1.4mm; padding-top: .8mm; text-align: left; }
/* Marcajele omului in sursa si in mentiune (regulile prind si .nota, e coborata din .sursa):
   *intre stelute* = aldin, _intre liniute de jos_ = cursiv, amandoua = aldin cursiv (user, 19.09.2026).
   ⚠️ Carlito n-are fata aldin-cursiva: pe combinatie Chromium ingroasa el cursivul.
   ⚠️ Stilul e un template literal: fara accente grave in comentariile astea, inchid sirul. */
.sursa b { font-weight: 700; }
.sursa i { font-style: italic; }
.sursa .nota { text-align: justify; margin-bottom: .4mm; }

/* Pagina a patra: calendarul peste toată lățimea, sub coloane, și subsolul fix.
   ⚠️ JOSUL NU E ABSOLUT, ȘI NU POATE FI (18.09.2026, „calendarul e tăiat în partea de jos"): un tabel
   dintr-o cutie position:absolute pierde ULTIMUL rând în Chromium — tabelul își socotește înălțimea
   fără el, subsolul se lipește de rândul dinainte, iar banda de la piciorul duminicii nu se mai
   desenează deloc (se vedea ca un tabel retezat, fără linia de jos). Nu ține de rowspan, de conținut,
   de table-layout sau de fonturi: se face din așezarea absolută singură (repro minim în jurnal,
   18.09.2026). De aceea pagina a patra e o cutie flex cu justify-content: flex-end, iar josul stă
   ÎN FLUX, împins la talpă — restul pieselor paginii sunt absolute, deci nu simt schimbarea. */
.pagina.ultima { display: flex; flex-direction: column; justify-content: flex-end; }
.jos { position: static; margin: 0 15.03mm 11mm; z-index: 1; text-align: center; }
/* Golul floare → „PROGRAMUL LITURGIC": 0.5 cm (user, 18.09.2026; era 1 mm). Marginea e 4.9, nu 5:
   peste ea mai vine aerul de deasupra majusculelor Trajan, iar cei 5 mm se măsoară de la cerneală la
   cerneală, cum îi măsoară rigla pe hârtie — 4.91 mm pe randarea de la 600 dpi (mai aproape de 5 nu se
   poate: poza se lipește de rețeaua de pixeli, iar următorul pas o duce la 5.17). */
.floare { display: block; margin: 0 auto 4.9mm; width: 44mm; }
/* „PROGRAMUL LITURGIC": Trajan Pro 3 Regular, ca titlul foii — nu Caladea aldin (user, 17.09.2026 seara).
   24 pt din 18.09.2026, a doua cerere („+4pt mai mare") — era 20, iar înainte 18. */
.cap-calendar { font-family: "Trajan", serif; font-size: 24pt; margin: 0 0 1.8mm; font-weight: 400; letter-spacing: .3pt; }
/* Titlul principalului, pe pagina întâi, stă mai jos de pastila numărului — măsurat pe nr. 615:
   trei rânduri de aer între linie și titlu. Titlul e mai mare decât la secundari (pe hârtie ~21 pt)
   și, spre deosebire de ei, NU e aldin (user, 17.09.2026 seara). */
.pagina[data-pagina="1"] .col.b > .titlu-articol:first-child { margin-top: 9mm; font-size: 21pt; line-height: 1.3; margin-bottom: 2.4mm;
                                                               font-weight: 400; }
/* Subsolul fix: tot 13 pt, ca sursa (in Word e cu un fir mai mic decat ea, ~12.7 pt).
   Adresa parohiei, randul de pe urma, e ALDINA (user, 18.09.2026). */
.subsol { font-family: "Carlito", Calibri, sans-serif; font-size: 13pt; line-height: 1.26; margin-top: 2mm; }
.subsol .adresa { font-weight: 700; }

/* Ce n-a încăput rămâne aici, nevăzut, și se numără în raport. */
#rest { position: absolute; left: -9999mm; top: 0; width: 85.06mm; }
`

// ---------------------------------------------------------------------------
// Blocurile unui articol, în ordinea în care curg
// ---------------------------------------------------------------------------

/**
 * MARCAJELE OMULUI — o singură convenție peste toate câmpurile de text ale foii (user, 19.09.2026,
 * 18:01): `_cursiv_`, `*aldin*`, amândouă = aldin cursiv. Regulile și motivele lor stau în
 * `marcaje.ts`; de aici se văd, fiindcă asta e ușa pe care le caută restul codului și probele.
 * Se aplică DUPĂ escapare, deci în pagină nu ajunge niciodată alt HTML decât al nostru.
 */
export { curatDeMarcaje, marcaj }

/** Titlul, gata marcat — se cere de două ori: o dată pentru foaie, o dată ca să știm de Trajan Bold. */
const titluMarcat = (titlu: string): string => marcaj(esc(titlu))

const paragrafe = (text: string): string[] =>
  text.split(/\n\s*\n|\r\n\r\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)

/**
 * Autorul scris cu bară se rupe în două rânduri: ce stă ÎNAINTEA barei e cinstirea și merge pe un
 * rând mai mic, deasupra numelui (user, 19.09.2026: „pe un rând mai mic SFÂNTUL CUVIOS MĂRTURISITOR
 * / SOFIAN de la ANTIM"). Desparte NUMAI prima bară — cu spații în jur, ca să nu se rupă un nume
 * care are „/" lipit — sau primul rând nou, dacă valoarea a venit cu „\n". Fără separator, autorul
 * rămâne întreg în `.nume`, exact ca până acum.
 */
export function despartAutor(autor: string): { deasupra: string; nume: string } {
  const m = /^([^]*?)(?: \/ |\r?\n)([^]*)$/.exec((autor ?? '').trim())
  const deasupra = m ? m[1]!.trim() : ''
  const nume = m ? m[2]!.trim() : ''
  return deasupra && nume ? { deasupra, nume } : { deasupra: '', nume: autor }
}

/** Zona neagră cu numele autorului — la principal sub poză, la secundar în capul articolului. */
function zonaNeagra(a: ArticolCerut, mica: boolean, incepeArticol = false): string {
  const { deasupra, nume } = despartAutor(a.autor)
  const randuri = deasupra ? [`<div class="deasupra">${esc(deasupra)}</div>`] : []
  randuri.push(`<div class="nume">${esc(nume)}</div>`)
  if (a.ani) randuri.push(`<div class="ani">${esc(a.ani)}</div>`)
  if (a.pomenire) randuri.push(`<div class="pomenire">${esc(a.pomenire)}</div>`)
  return `<div class="zona-neagra${mica ? ' mica' : ''}${incepeArticol ? ' incepe-articol' : ''}">${randuri.join('')}</div>`
}

/**
 * Titlul, rigla de sub el și — dacă e — semnătura, strecurată ÎNTRE ele (user, 19.09.2026:
 * „adăugăm ca semnătură sub titluri"). Ordinea din HTML e și ordinea în care curg prin coloane,
 * deci rigla rămâne fratele DE DUPĂ semnătură — de asta stilul o prinde și așa.
 */
const titluArticol = (a: ArticolCerut): string =>
  `<h2 class="titlu-articol">${titluMarcat(a.titlu)}</h2>` +
  (a.semnatura ? `<div class="semnatura">${marcaj(esc(a.semnatura))}</div>` : '') +
  '<div class="rigla"></div>'

/*
 * MARCAJUL SURSEI (user, 19.09.2026, 17:30: „să meargă și un link care e pus doar ca domeniu
 * (ex.: doxologia.ro) sau o carte în care folosim bold italic și scris normal (ex. Vezi buletinele
 * trecute) dar și combinație").
 *
 * ⚠️ Lista TLD-urilor e ÎNCHISĂ, nu un `[a-z]{2,}` oarecare, și e aceeași cu `TLD_CUNOSCUT` din
 * `schita.ts`: tot ea hotărăște ce e domeniu și când sursa se PROPUNE din text. Într-o trimitere de
 * carte stau „p.12", „vol.II", „Ed.IBMBOR" — cu un TLD deschis, toate trei ar ieși aldine. Un
 * `http(s)://` scris pe față trece oricum, cu orice terminație.
 */
const TLD_SURSA = 'ro|com|org|net|md|eu|info|gr|ru|it|fr|de|uk|tv'
const DOMENIU_SURSA = new RegExp(
  `\\bhttps?:\\/\\/\\S+|\\b(?:www\\.)?[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:${TLD_SURSA})\\b(?:\\/\\S*)?`,
  'gi',
)
/**
 * CUM SE SCRIE SURSA pe foaie. Trei feluri de scris pe același rând:
 *
 *   - marcajele obișnuite ale foii (`marcaj`): `_cursiv_`, `*aldin*`, `_*ambele*_` — cu ele se
 *     scrie titlul cărții, care se cere aldin cursiv: „_*Cuvinte de folos*_";
 *   - un domeniu ori un URL de sine stătător → **aldin**, cum a fost dintotdeauna (nr. 615:
 *     „Sursa: " scris normal, „ziarullumina.ro" aldin);
 *   - restul (autor, editură, oraș, an, pagină) → **scris normal**.
 *
 * ⚠️ O sursă FĂRĂ marcaje și FĂRĂ domeniu rămâne ALDINĂ ÎNTREAGĂ, ca până acum — altfel toate
 * numerele deja compuse („Părintele X, predică") și-ar schimba fața la o recompunere.
 *
 * ⚠️ ORDINEA: întâi marcajele, apoi domeniul — și domeniul NUMAI pe bucățile din afara marcajelor.
 * Invers, `\S+` din URL ar înghiți tagurile puse de noi, iar un domeniu scris chiar de om între
 * steluțe („*doxologia.ro*") ar ieși cu aldinul pus de două ori.
 */
export function sursaMarcata(text: string): string {
  const escapat = esc(text)
  const cuMarcaje = marcaj(escapat)
  let marcat = cuMarcaje !== escapat
  // bucățile sunt ori un tag pus de `marcaj`, ori scris curat: alt `<` nu există, textul e escapat
  let adancime = 0
  const scris = cuMarcaje.replace(/<\/?[bi]>|[^<]+/g, (bucata) => {
    if (bucata[0] === '<') {
      adancime += bucata[1] === '/' ? -1 : 1
      return bucata
    }
    if (adancime > 0) return bucata // aici a hotărât omul cum se scrie; nu mai punem noi aldin
    return bucata.replace(DOMENIU_SURSA, (gasit) => {
      marcat = true
      // punctul sau virgula de după adresă nu fac parte din ea, deci rămân în afara aldinei
      const coada = /[.,;:]+$/.exec(gasit)?.[0] ?? ''
      return `<b>${coada ? gasit.slice(0, -coada.length) : gasit}</b>${coada}`
    })
  })
  return marcat ? scris : `<b>${escapat}</b>`
}

/** Rândul sursei; deasupra lui, dacă e, mențiunea (de unde e luat textul, în cuvinte). */
const sursa = (a: ArticolCerut): string =>
  a.sursa
    ? `<div class="sursa">${a.nota ? `<div class="nota">${marcaj(esc(a.nota))}</div>` : ''}Sursa: ${sursaMarcata(a.sursa)}</div>`
    : ''

/**
 * Bucățile care curg prin coloane, în ordine. Poza mare și zona neagră a principalului NU sunt
 * aici: ele stau ancorate în coloana întâi a paginii întâi, unde le-a pus dintotdeauna foaia.
 */
function bucati(cerut: NumarCerut, poze: Record<string, string>): string[] {
  const b: string[] = []
  const articol = (a: ArticolCerut, principal: boolean, i: number): void => {
    if (!principal) {
      // prima bucată a secundarului poartă aerul de 1 cm de după articolul dinainte
      if (a.poza && poze[`s${i}`]) b.push(`<img class="poza mica incepe-articol" src="${poze[`s${i}`]}" alt="">`)
      b.push(zonaNeagra(a, true, !(a.poza && poze[`s${i}`])))
    }
    b.push(titluArticol(a))
    paragrafe(a.text).forEach((p, k) => b.push(`<p class="t${k === 0 ? ' prim' : ''}">${marcaj(esc(p))}</p>`))
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
  /*
   * ⚠️ NIMIC NU SE MASOARA INAINTE SA FIE TOTUL INCARCAT (18.09.2026, nr. 616 compus pe live:
   * textul coloanelor de pe pagina a patra intra peste floare si peste capul calendarului).
   * Scriptul ruleaza la parsare, cand pozele din data-URI (floarea are 13.7 mm) si fonturile din
   * @font-face inca nu sunt decodate: josul paginii iese mai scund decat va fi, coloanele raman
   * prea lungi, iar cand sosesc floarea si Caladea, josul creste IN SUS, sub text. Pe local nu s-a
   * vazut — chromium-ul de acolo le are gata la parsare — de aceea a scapat la probe. Deci: intai
   * load (pozele), apoi fonturile cerute pe nume si document.fonts.ready, si abia apoi curgerea.
   * Browser Rendering asteapta oricum data-potrivit dupa load (hartie.ts), deci hartia nu iese
   * inainte de curgere.
   */
  function dupaIncarcare(fn){
    function fonturi(){
      if (!document.fonts || !document.fonts.load) return fn();
      // '700 16px Trajan' e cerut si cand fata aldina nu e incorporata: promisiunea se implineste
      // goala (nu e nicio fata de incarcat), iar .catch de mai jos prinde orice alta nazbatie.
      var fete = ['400 16px Caladea', '700 16px Caladea', 'italic 400 16px Caladea', '400 16px Carlito', '700 16px Carlito', '400 16px Trajan', '700 16px Trajan'];
      Promise.all(fete.map(function(f){ return document.fonts.load(f).catch(function(){}); }))
        .then(function(){ return document.fonts.ready; })
        .then(fn, fn);
    }
    if (document.readyState === 'complete') fonturi();
    else window.addEventListener('load', fonturi);
  }
  dupaIncarcare(function(){
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
  /*
   * ⚠️ TAIEREA PASTREAZA MARCAJELE OMULUI (19.09.2026). Pana aici se taia pe textContent, si asta
   * STERGEA tagurile <b>/<i> din paragraful taiat SI din coada lui — adica scrisul aldin sau cursiv
   * disparea tocmai la hotarul de coloana, o data la fiecare coloana, fara ca cineva sa stie de ce.
   * Acum se taie pe innerHTML: tagurile noastre n-au spatii in ele, deci despartirea pe spatii nu
   * rupe niciodata un tag in doua. Ce a ramas deschis la capatul bucatii se inchide acolo si se
   * redeschide in coada, ca amandoua sa fie HTML intreg — altfel parserul le-ar drege cum vrea el,
   * iar masuratoarea din mijlocul cautarii binare ar minti.
   */
  function ramase(html){
    var st = [], re = /<(\\/?)([bi])>/g, m;
    while ((m = re.exec(html))) { if (m[1]) st.pop(); else st.push(m[2]); }
    return st;
  }
  function inchide(html){
    var st = ramase(html), s = html;
    for (var i = st.length - 1; i >= 0; i--) s += '</' + st[i] + '>';
    return s;
  }
  function redeschide(html, cap){
    var st = ramase(cap), s = html;
    for (var i = st.length - 1; i >= 0; i--) s = '<' + st[i] + '>' + s;
    return s;
  }
  function taie(col, p){
    // p e deja în coloană și dă pe dinafară: caut cel mai lung început care încape
    var vorbe = p.innerHTML.split(' ');
    var jos = 0, sus = vorbe.length, bun = 0;
    while (jos <= sus) {
      var mij = (jos + sus) >> 1;
      p.innerHTML = inchide(vorbe.slice(0, mij).join(' '));
      if (incape(col)) { bun = mij; jos = mij + 1; } else { sus = mij - 1; }
    }
    var cap = vorbe.slice(0, bun).join(' ');
    p.innerHTML = inchide(cap);
    return redeschide(vorbe.slice(bun).join(' '), cap);
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
        // HTML, nu text: coada poarta mai departe marcajele (totul e deja escapat de foaie)
        p.innerHTML = coada;
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
  });
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
  // Trajan Bold se încorporează DOAR dacă un titlu îl cere: e singurul loc în care se scrie Trajan
  // aldin (zona neagră rămâne brută, restul foii e Caladea sau Carlito).
  const trajanAldin = [cerut.principal, ...(cerut.secundari ?? [])]
    .some((a) => titluMarcat(a.titlu).includes('<b>'))

  for (let p = 1; p <= PAGINI; p++) {
    const capul = p === 1
      ? `<div class="cap">
      <h1 class="titlu-foaie">BULETINU<span class="l">L<img class="cruce" src="${dataUri('cruce', crucePng, 'image/png')}" alt=""></span> BISERICII</h1>
      <p class="parohia">${PAROHIA}</p>
      <p class="motto">${marcaj(esc(cerut.motto))}</p>
      ${cerut.motoAutor ? `<p class="motto-autor">– ${marcaj(esc(cerut.motoAutor))}</p>` : ''}
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
      <div class="subsol">${SUBSOL.map((r, i) => `<div${i === SUBSOL.length - 1 ? ' class="adresa"' : ''}>${esc(r)}</div>`).join('')}</div>
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
<style>${fonturi(trajanAldin)}${STIL}${o.calendar?.stil ?? ''}
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
  // ⚠️ Marcajele nu se tipăresc, deci nu se numără nici aici: `_x_` ocupă cât `x`.
  const randuriMotto = Math.max(1, Math.ceil(curatDeMarcaje(o.cerut.motto).length / 78))
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
