/**
 * Hartiile programului: foaia A4 de pe usa bisericii (identica cu Wordul parohiei: chenar, cruce,
 * Trajan Pro 3, masurile tabelului), poza ei pentru WhatsApp si foaia „Sfintii zilei". HTML-ul e
 * autonom (fonturile si imaginile inglobate); PDF-ul/JPG-ul le face Browser Rendering.
 */
import puppeteer, { type Browser } from '@cloudflare/puppeteer'
import type { IntrareVocabular, Slujba } from '@xc/contracts'
import { LUNI, ZILE_SAPTAMANA, esc, dataLunga, intervalLizibil, adaugaZile, ziuaSaptamanii } from '@xc/ui'
import trajanOtf from '../resurse/TrajanPro3-Regular.otf'
import caladeaRegular from '../resurse/Caladea-Regular.ttf'
import caladeaBold from '../resurse/Caladea-Bold.ttf'
import caladeaItalic from '../resurse/Caladea-Italic.ttf'
import carlitoRegular from '../resurse/Carlito-Regular.ttf'
import carlitoBold from '../resurse/Carlito-Bold.ttf'
import chenarPng from '../resurse/chenar.png'
import crucePng from '../resurse/cruce.png'
import { type CalendarSaptamana, type ZiPeProgram, faraSarbatoareaDeMaine, numeMari, numeZi, probaMare, randurileDuminicii, ziRosie } from './calendar.js'

export const PAROHIA = 'Biserica Sfântul Ilie – Hanul Colței'
export const SITE = 'sfantul-ilie.ro'
export const PAROH = 'Gabriel Grigorescu'
export const NOTA =
  'Dacă doriți programul slujbelor cu modificările de ultimă oră, cuvântul de la chinonic și alte informații utile vă rugăm să vă abonați la Buletinul Online pe <b>sfantul-ilie.ro</b>.'

// ---------------------------------------------------------------------------
// Resursele, ca data-URI (codificate o singura data)
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

function fonturi(): string {
  return `
@font-face { font-family: "Trajan"; src: url(${dataUri('trajan', trajanOtf, 'font/otf')}) format("opentype"); }
@font-face { font-family: "Caladea"; src: url(${dataUri('cal-r', caladeaRegular, 'font/ttf')}) format("truetype"); font-weight: 400; }
@font-face { font-family: "Caladea"; src: url(${dataUri('cal-b', caladeaBold, 'font/ttf')}) format("truetype"); font-weight: 700; }
@font-face { font-family: "Caladea"; src: url(${dataUri('cal-i', caladeaItalic, 'font/ttf')}) format("truetype"); font-style: italic; }
@font-face { font-family: "Carlito"; src: url(${dataUri('car-r', carlitoRegular, 'font/ttf')}) format("truetype"); font-weight: 400; }
@font-face { font-family: "Carlito"; src: url(${dataUri('car-b', carlitoBold, 'font/ttf')}) format("truetype"); font-weight: 700; }`
}

// ---------------------------------------------------------------------------
// Randurile „→" de sub o slujba
// ---------------------------------------------------------------------------

export const PERICOPA = /^(Ap\.|Ev\.|Apostol|Evanghelia)/

export interface RandDetaliu {
  text: string
  pericopa: boolean
  rosu: boolean
  bold: boolean
  sfant: boolean
}

/**
 * Randurile unei slujbe, cu regulile de afisare: pericopa fara sageata; primul rand al slujbei de
 * dimineata bold (si rosu daca incepe cu „Duminica"); orice rand potrivit de `probaMare` bold+rosu;
 * sfintii marunti ai duminicii pot cadea daca foaia nu incape. Slujba de seara pierde randurile
 * care repeta sarbatoarea de maine — afara de duminica seara, unde maine e pe alta foaie.
 */
export function randurileSlujbei(
  s: Slujba,
  categorie: IntrareVocabular['categorie'] | undefined,
  zi: ZiPeProgram | undefined,
  maine: ZiPeProgram | undefined,
  dinCalendar: boolean,
  granita: string,
): RandDetaliu[] {
  let detalii = [...s.detalii]
  const eDimineata = categorie === 'dimineata'
  if (eDimineata && dinCalendar && zi && !zi.aproximativ && zi.zi_saptamana === 'duminica') {
    for (const r of randurileDuminicii(zi)) if (!detalii.includes(r)) detalii.push(r)
  }
  if (!eDimineata && s.data !== granita && maine) detalii = faraSarbatoareaDeMaine(detalii, numeZi(maine))
  const mari = [...(zi ? numeMari(zi) : []), ...(!eDimineata && maine ? numeMari(maine) : [])]
  const proba = probaMare(mari)
  let primul = true
  const iesire: RandDetaliu[] = []
  for (const text of detalii) {
    const pericopa = PERICOPA.test(text)
    const duminica = /^Duminica\b/.test(text)
    const mare = proba(text)
    const bold = (eDimineata && primul && !pericopa) || duminica || mare
    const rosu = duminica || mare
    const sfant = eDimineata && !pericopa && !duminica && !mare && !primul && zi?.zi_saptamana === 'duminica'
    iesire.push({ text, pericopa, rosu, bold, sfant })
    if (!pericopa) primul = false
  }
  return iesire
}

// ---------------------------------------------------------------------------
// Foaia A4
// ---------------------------------------------------------------------------

const ZILE_SCURT = ['Du', 'Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ']

/** „luni" → „Luni": zilele din vocabularul comun sunt cu litera mica, foaia le vrea cu majuscula. */
const cuMajuscula = (t: string): string => (t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}` : t)

interface ZiFoaie {
  data: string
  eticheta: string
  dataText: string
  rosie: boolean
  dimineata: Slujba[]
  seara: Slujba[]
  semnatura: string
  goala: boolean
}

export interface OptiuniFoaie {
  luni: string
  duminica: string
  titlu: string
  slujbe: Slujba[]
  vocabular: Map<string, IntrareVocabular>
  calendar: CalendarSaptamana | null
  /** Randurile duminicii vin din calendar (saptamanile scrise in V2), nu din `detalii`. */
  dinCalendar: boolean
  ciorna?: boolean
}

export function foaieHtml(o: OptiuniFoaie): string {
  const zile: ZiFoaie[] = []
  for (let i = 0; i < 7; i++) {
    const data = adaugaZile(o.luni, i)
    const zs = ziuaSaptamanii(data)
    const zi = o.calendar?.zile.get(data)
    const ale = o.slujbe.filter((s) => s.data === data)
    const dimineata = ale.filter((s) => o.vocabular.get(s.cod_nume)?.categorie === 'dimineata')
    const seara = ale.filter((s) => o.vocabular.get(s.cod_nume)?.categorie !== 'dimineata')
    const [, l, z] = data.split('-').map(Number) as [number, number, number]
    zile.push({
      data,
      // numele zilei se scrie cu majuscula, ca in foaia V1 („Luni", nu „luni") — vocabularul comun il
      // tine cu litera mica (semnalat de user, 10.09.2026, la comparatia PDF-urilor)
      eticheta: cuMajuscula(ZILE_SAPTAMANA[zs] ?? ''),
      dataText: `${z} ${LUNI[l - 1] ?? ''}`,
      rosie: zs === 0 || (zi ? ziRosie(zi) : false),
      dimineata,
      seara,
      semnatura: ale.map((s) => `${s.ora}¦${s.nume}¦${s.detalii.join('|')}`).join('¦¦'),
      goala: ale.length === 0,
    })
  }

  // zilele consecutive cu program identic se unesc (duminica nu se uneste niciodata)
  const grupe: ZiFoaie[][] = []
  for (const z of zile) {
    const ultima = grupe[grupe.length - 1]
    if (ultima && !z.goala && ziuaSaptamanii(z.data) !== 0 && ziuaSaptamanii(ultima[0]!.data) !== 0 && ultima[0]!.semnatura === z.semnatura && !ultima[0]!.goala) ultima.push(z)
    else grupe.push([z])
  }

  const randSlujba = (s: Slujba, zi: ZiPeProgram | undefined, maine: ZiPeProgram | undefined, dimineata: boolean): string => {
    const randuri = randurileSlujbei(s, dimineata ? 'dimineata' : 'seara', zi, maine, o.dinCalendar, o.duminica)
    const det = randuri
      .map((r) => `<div class="det${r.pericopa ? ' per' : ''}${r.rosu ? ' rosu' : ''}${r.bold ? ' bold' : ''}${r.sfant ? ' sfant' : ''}">${esc(r.text)}</div>`)
      .join('')
    return `<div class="nume${dimineata ? ' dimineata' : ''}">${esc(s.nume)}</div>${det}`
  }

  /*
   * Liniile tabelului, ca in foaia V1 (semnalat de user, 10.09.2026 — „sunt niște detalii de cum sunt
   * liniile tabelului"). Regula, luata din Wordul parohiei:
   *   - ziua e o CASETA: intre slujbele aceleiasi zile nu se trage nicio linie;
   *   - la piciorul zilei linia e PUNCTATA cand slujbele se tin lant peste noapte (Vecernia de seara si
   *     Liturghia de a doua zi dimineata) — asa se vede ca sunt legate — si PLINA in rest;
   *   - zilele fara slujbe nu se scriu una cate una: sirul lor rupt se arata printr-o singura banda gri.
   */
  const corp: string[] = []
  let ruptura = false
  for (let gi = 0; gi < grupe.length; gi++) {
    const g = grupe[gi]!
    const prima = g[0]!
    const ultima = g[g.length - 1]!
    const zi = o.calendar?.zile.get(prima.data)
    const maine = o.calendar?.zile.get(adaugaZile(ultima.data, 1))
    const eDuminica = ziuaSaptamanii(prima.data) === 0
    const eticheta = g.length > 1 ? `${ZILE_SCURT[ziuaSaptamanii(prima.data)]} – ${ZILE_SCURT[ziuaSaptamanii(ultima.data)]}` : prima.eticheta
    const dataText = g.length > 1 ? `${prima.dataText.split(' ')[0]} – ${ultima.dataText}` : prima.dataText
    if (prima.goala) {
      ruptura = true
      continue
    }
    // o singura banda intre doua zile cu slujbe, oricate zile goale ar fi intre ele (V1: `tr.gol`)
    if (ruptura && corp.length) corp.push(`<tr class="lipsa"><td colspan="3"></td></tr>`)
    ruptura = false
    // ziua urmatoare incepe cu slujba de dimineata, iar asta se termina cu una de seara? => lant
    const urmatoarea = grupe[gi + 1]?.[0]
    const seLeaga = !!urmatoarea && !urmatoarea.goala && adaugaZile(ultima.data, 1) === urmatoarea.data
      && prima.seara.length > 0 && urmatoarea.dimineata.length > 0
    const randuri: string[] = []
    const jumatati: Array<{ slujbe: Slujba[]; dimineata: boolean }> = [
      { slujbe: prima.dimineata, dimineata: true },
      { slujbe: prima.seara, dimineata: false },
    ]
    const nrRanduri = jumatati.reduce((n, j) => n + Math.max(1, j.slujbe.length), 0)
    let primulRand = true
    for (const j of jumatati) {
      if (!j.slujbe.length) {
        randuri.push(`<tr class="banda${j.dimineata ? ' sus' : ' jos'}${eDuminica ? ' dum' : ''}">${primulRand ? `<td class="zi${prima.rosie ? ' rosie' : ''}${eDuminica ? ' dum' : ''}" rowspan="${nrRanduri}"><div class="numezi">${esc(eticheta)}</div><div class="datazi">${esc(dataText)}</div></td>` : ''}<td class="ora goala"></td><td class="slujba goala"></td></tr>`)
        primulRand = false
        continue
      }
      j.slujbe.forEach((s) => {
        // in interiorul zilei nu se trage nicio linie: dimineata si seara stau in aceeasi caseta alba (V1)
        randuri.push(`<tr class="${j.dimineata ? 'dim' : 'sea'}${eDuminica ? ' dum' : ''}">${primulRand ? `<td class="zi${prima.rosie ? ' rosie' : ''}${eDuminica ? ' dum' : ''}" rowspan="${nrRanduri}"><div class="numezi">${esc(eticheta)}</div><div class="datazi">${esc(dataText)}</div></td>` : ''}<td class="ora">${esc(s.ora)}</td><td class="slujba">${randSlujba(s, zi, maine, j.dimineata)}</td></tr>`)
        primulRand = false
      })
    }
    // piciorul zilei: punctat daca se leaga de dimineata urmatoare, plin altfel
    const ultimulRand = randuri.length - 1
    if (ultimulRand >= 0) randuri[ultimulRand] = randuri[ultimulRand]!.replace('<tr class="', `<tr class="${seLeaga ? 'jos-lipit' : 'jos-plin'} `)
    corp.push(randuri.join(''))
  }

  const tabel = o.slujbe.length
    ? `<table class="program"><colgroup><col class="c-zi"><col class="c-ora"><col class="c-slujba"></colgroup><tbody>${corp.join('')}</tbody></table>`
    : `<p class="gol">Săptămână fără slujbe înregistrate.</p>`

  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>Programul liturgic · ${esc(o.titlu)}</title>
<style>
${fonturi()}
@page { size: A4; margin: 0; }
:root { --f: 1; --rosu: #c00000; --gri: #7f7f7f; --gri-deschis: #f2f2f2; --gri-banda: #d9d9d9; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: "Caladea", Cambria, Georgia, serif; color: #000; }
.pagina { position: relative; width: 210mm; height: 297mm; padding: 17.5mm; box-sizing: border-box; overflow: hidden; }
.chenar { position: absolute; left: 7mm; top: 7mm; width: 196mm; height: 283mm; z-index: 0; }
.continut { position: relative; z-index: 1; text-align: center; }
.cruce { width: calc(42mm * var(--f)); display: block; margin: 0 auto 2mm; }
.titlu { font-family: "Trajan", serif; font-size: calc(38pt * var(--f)); line-height: 1; margin: 0; font-weight: 400; }
.parohia { font-family: "Trajan", serif; font-size: calc(10pt * var(--f)); white-space: pre; margin: 2mm 0 0; }
/* Caseta cu intervalul atarna de o linie pe toata latimea: colturile de sus drepte, cele de jos
   rotunjite, chenar subtire de jur imprejur (fara cel de sus, il tine linia) si umbra DURA, deplasata
   pe diagonala, ca in Wordul parohiei — nu o umbra difuza (masurile din V1). */
.linie { border-top: .75pt solid #333; margin: 5mm 0 0; font-size: 0; line-height: 0; height: 0; }
.caseta { display: inline-block; background: #e6e6e6; border: .5pt solid #333; border-top: 0;
          border-radius: 0 0 2mm 2mm; box-shadow: .8mm .8mm 0 #999;
          padding: 1.6mm 9mm; font-size: calc(14pt * var(--f)); font-weight: 700; line-height: 1.2;
          margin-bottom: 4mm; }
/* Tabelul n-are chenar la stanga si nici jos: bara groasa din stanga o poarta celulele zilei (si se
   opreste la duminica, unde coltul ramane deschis), iar linia de jos o pune ultimul rand, doar peste
   coloanele orei si slujbei. Sus e subtire, dreapta groasa cat stanga (V1, dupa Wordul parohiei). */
table.program { width: 175mm; margin: 0 auto; border-collapse: collapse; table-layout: fixed; border-top: .5pt solid #000; border-right: 3pt solid #000; }
col.c-zi { width: 32.5mm; } col.c-ora { width: 20mm; } col.c-slujba { width: 122.5mm; }
/* Fara linie intre randuri: ziua e o caseta, iar liniile se pun doar la piciorul ei (jos-plin /
   jos-lipit, mai jos) — ca in foaia V1. Continutul sta SUS in celula: ora trebuie sa fie in dreptul
   numelui slujbei, nu la mijlocul detaliilor. */
td { vertical-align: top; padding: calc(1mm * var(--f)) calc(2mm * var(--f)); text-align: left; }
td.zi { text-align: center; vertical-align: middle; background: #fff; border-left: 3pt solid #000; border-right: .5pt solid #000; border-bottom: .5pt solid #000; }
td.zi .numezi { font-size: calc(18pt * var(--f)); font-weight: 700; line-height: 1.1; }
td.zi.rosie .numezi { color: var(--rosu); }
td.zi .datazi { font-style: italic; font-size: calc(11pt * var(--f)); color: var(--gri); }
td.ora { background: var(--gri-deschis); font-size: calc(14pt * var(--f)); font-weight: 700; text-align: center; border-right: .5pt solid #000; }
td.slujba .nume { font-size: calc(18pt * var(--f)); font-weight: 700; line-height: 1.15; }
td.slujba .nume.dimineata { color: var(--rosu); }
.det { font-size: calc(13pt * var(--f)); line-height: 1.2; padding-left: 1.2em; text-indent: -1.2em; }
.det::before { content: "→ "; }
.det.per { font-family: "Carlito", Calibri, sans-serif; padding-left: 0; text-indent: 0; text-align: justify; }
.det.per::before { content: ""; }
.det.bold { font-weight: 700; }
.det.rosu { color: var(--rosu); font-weight: 700; }
/* jumatatea de zi fara slujba: o banda de 5 mm, NETAIATA — linia dintre ora si slujba se opreste aici
   (V1). Ramane doar linia groasa dinspre slujba de care se lipeste. */
tr.banda td.goala { height: calc(5mm * var(--f) * var(--f)); background: var(--gri-deschis); padding: 0; }
tr.banda td.ora.goala { border-right: 0; }
tr.banda.sus td.slujba.goala { border-bottom: 1.5pt solid #000; }
tr.banda.jos td.slujba.goala { border-top: 1.5pt solid #000; }
/* piciorul zilei: punctat cand slujbele se tin lant peste noapte, plin in rest (V1) */
tr.jos-lipit > td.ora, tr.jos-lipit > td.slujba { border-bottom: .5pt dashed #000; }
tr.jos-plin > td.ora, tr.jos-plin > td.slujba { border-bottom: .5pt solid #000; }
/* Sirul rupt de zile fara slujbe: o singura banda, gri mai inchis, cu o linie subtire sus si jos.
   Chenarele groase din stanga si din dreapta se INTRERUP aici — asa se vede ca s-a rupt sirul zilelor
   (preferinta userului in V1, peste Word); hidden bate orice alta bordura la border-collapse. */
tr.lipsa td { height: calc(5mm * var(--f) * var(--f)); background: var(--gri-banda); padding: 0;
              border: 0; border-left: hidden; border-right: hidden;
              border-top: .5pt solid #000; border-bottom: .5pt solid #000; }
/* duminica: linia groasa doar peste celula zilei — pe coloanele orei si slujbei ramane legatura
   punctata cu sambata seara, ca in V1 */
/* Duminica: celula zilei n-are nici bara groasa la stanga, nici linie jos — coltul din stanga-jos al
   tabelului ramane DESCHIS (V1). Deasupra ei, linia groasa o desparte de sambata. */
tr.dum td.zi { vertical-align: top; border-left: 0; border-bottom: 0; border-top: 1.5pt solid #000; }
.semnatura { text-align: right; font-size: calc(18pt * var(--f)); margin: 5mm 0 0; line-height: 1.15; }
.semnatura b { display: block; }
.nota { position: absolute; left: 17.5mm; right: 17.5mm; bottom: 17.5mm; font-family: "Carlito", Calibri, sans-serif; font-size: 14pt; text-align: left; line-height: 1.25; }
.nota .et { display: block; font-size: 16pt; font-weight: 700; color: var(--gri); }
.gol { font-style: italic; color: var(--gri); }
${o.ciorna ? '' : ''}
</style></head>
<body><div class="pagina" data-potrivire>
  <img class="chenar" src="${dataUri('chenar', chenarPng, 'image/png')}" alt="">
  <div class="continut">
    <img class="cruce" src="${dataUri('cruce', crucePng, 'image/png')}" alt="">
    <h1 class="titlu">programul liturgic</h1>
    <p class="parohia">S F Â N T U L   I L I E   -   H A N U L   C O L Ț E I</p>
    <div class="linie"></div>
    <div class="caseta">${esc(o.titlu)}</div>
    ${tabel}
    <div class="semnatura">Pr. Paroh<b>${esc(PAROH)}</b></div>
  </div>
  <div class="nota"><span class="et">Notă:</span>${NOTA}</div>
</div>
<script>${POTRIVESTE}</script>
</body></html>`
}

/**
 * Potrivirea pe o singura pagina, in ordinea: prescurtari punctuale, apoi cad cel mult 3 sfinti
 * marunti ai duminicii, apoi scade factorul de marime, apoi inca o runda de prescurtari.
 */
const POTRIVESTE = `
(function(){
  var pag = document.querySelector('.pagina'); if (!pag) return;
  var semn = document.querySelector('.semnatura'), nota = document.querySelector('.nota');
  function incape(){ return semn.getBoundingClientRect().bottom <= nota.getBoundingClientRect().top - 6; }
  var PRESC = [[/(^|[^A-Za-zăâîșțĂÂÎȘȚ])(Sfântul|Sfânta|Sfântului|Sfintei|Sfinții|Sfintele|Sfinților)(?=[^A-Za-zăâîșțĂÂÎȘȚ]|$)/g,'$1Sf.'],
    [/(^|[^A-Za-zăâîșțĂÂÎȘȚ])(Mucenic|Mucenici|Mucenița|Mucenicul|Mucenicii|Mucenicilor)(?=[^A-Za-zăâîșțĂÂÎȘȚ]|$)/g,'$1Mc.'],
    [/(^|[^A-Za-zăâîșțĂÂÎȘȚ])(Cuvios|Cuvioși|Cuviosul|Cuvioasa|Cuvioasă|Cuvioșii)(?=[^A-Za-zăâîșțĂÂÎȘȚ]|$)/g,'$1Cuv.'],
    [/(^|[^A-Za-zăâîșțĂÂÎȘȚ])(Ierarh|Ierarhul|Ierarhi|Ierarhii)(?=[^A-Za-zăâîșțĂÂÎȘȚ]|$)/g,'$1Ier.'],
    [/(^|[^A-Za-zăâîșțĂÂÎȘȚ])(Apostol|Apostolul|Apostoli|Apostolii)(?=[^A-Za-zăâîșțĂÂÎȘȚ]|$)/g,'$1Ap.'],
    [/(^|[^A-Za-zăâîșțĂÂÎȘȚ])episcopul(?=[^A-Za-zăâîșțĂÂÎȘȚ]|$)/g,'$1ep.'],
    [/(^|[^A-Za-zăâîșțĂÂÎȘȚ])arhiepiscopul(?=[^A-Za-zăâîșțĂÂÎȘȚ]|$)/g,'$1arhiep.'],
    [/(^|[^A-Za-zăâîșțĂÂÎȘȚ])mitropolitul(?=[^A-Za-zăâîșțĂÂÎȘȚ]|$)/g,'$1mitrop.']];
  function prescurta(){
    var det = Array.prototype.slice.call(document.querySelectorAll('.det'));
    for (var i = 0; i < det.length && !incape(); i++) {
      for (var p = 0; p < PRESC.length && !incape(); p++) { var t = det[i].textContent; var n = t.replace(PRESC[p][0], PRESC[p][1]); if (n !== t) det[i].textContent = n; }
    }
  }
  function gata(){ document.documentElement.setAttribute('data-potrivit','da'); }
  function ruleaza(){
    if (incape()) return gata();
    prescurta();
    var sfinti = Array.prototype.slice.call(document.querySelectorAll('.det.sfant')).reverse();
    for (var k = 0; k < 3 && k < sfinti.length && !incape(); k++) sfinti[k].parentNode.removeChild(sfinti[k]);
    var f = 1.0;
    while (!incape() && f > 0.62) { f = Math.round((f - 0.02) * 100) / 100; pag.style.setProperty('--f', String(f)); }
    prescurta();
    gata();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ruleaza); else ruleaza();
})();`

// ---------------------------------------------------------------------------
// Sfintii zilei
// ---------------------------------------------------------------------------

export function sfintiiHtml(o: { data: string; zi: ZiPeProgram; sinaxar: string | null; cuSinaxar: boolean }): string {
  const cand = `${ZILE_SAPTAMANA[ziuaSaptamanii(o.data)]}, ${dataLunga(o.data)}`
  // Titlul e NUMELE zilei (duminica, praznicul), ca in V1 — nu `titlu_html`, care tine la un loc si
  // sfintii, si pericopele, si glasul: puse acolo, se repetau imediat dedesubt, in lista si pe randul
  // marunt (semnalat de user, 10.09.2026, la comparatia cu foile V1).
  const titlu = o.zi.denumire ? `<h1>${esc(o.zi.denumire)}</h1>` : ''
  const sfinti = o.zi.sfinti.map((s) => `<li class="${s.rang === 'praznic_imparatesc' || s.rang === 'cruce_rosie' ? 'rosu' : s.rang === 'cruce_albastra' ? 'albastru' : ''}">${esc(`${s.semn ? `${s.semn} ` : ''}${s.nume}`)}</li>`).join('')
  const rand: string[] = []
  if (o.zi.pericope.apostol) rand.push(`Ap. ${esc(o.zi.pericope.apostol)}`)
  if (o.zi.pericope.evanghelie) rand.push(`Ev. ${esc(o.zi.pericope.evanghelie)}`)
  if (o.zi.glas) rand.push(`glas ${o.zi.glas}${o.zi.evanghelia_invierii ? `, voscr. ${o.zi.evanghelia_invierii}` : ''}`)
  if (o.zi.post.este) rand.push(`post${o.zi.post.dezlegare !== 'niciuna' ? ` · ${o.zi.post.dezlegare.replaceAll('_', ' ')}` : ''}`)
  for (const n of o.zi.note) rand.push(esc(n))
  const sinaxar = o.cuSinaxar ? `<main class="text">${o.sinaxar ?? '<p><em>Sinaxarul acestei zile nu e disponibil în Calendar.</em></p>'}</main>` : ''
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>Sfinții zilei · ${esc(cand)}</title>
<style>
${fonturi()}
@page { size: A4; margin: 18mm 18mm 20mm; }
body { font-family: "Caladea", Cambria, Georgia, serif; color: #000; margin: 0; }
.parohia { font-family: "Trajan", serif; font-size: 10pt; color: #7f7f7f; margin: 0; }
.cand { color: #7f7f7f; font-style: italic; margin: 0 0 6mm; }
h1 { font-size: 20pt; line-height: 1.3; margin: 0 0 5mm; }
ul { padding-left: 1.2em; margin: 0 0 6mm; } li { font-size: 15pt; line-height: 1.5; }
li.rosu { color: #c00000; } li.albastru { color: #1c58bb; }
.rand { font-family: "Carlito", Calibri, sans-serif; font-size: 12pt; color: #333; }
.text { margin-top: 8mm; font-size: 12pt; line-height: 1.45; } .text h3 { font-size: 13pt; margin: 6mm 0 2mm; } .text h4 { color:#7f7f7f; margin: 4mm 0 1mm; }
.subsol { position: fixed; bottom: 6mm; left: 18mm; right: 18mm; display: flex; justify-content: space-between; font-family: "Carlito", sans-serif; font-size: 9pt; color: #7f7f7f; }
</style></head><body>
<p class="parohia">${esc(PAROHIA)} · Sfinții zilei</p>
<p class="cand">${esc(cand)}</p>
${titlu}
<ul>${sfinti}</ul>
<p class="rand">${rand.join(' · ')}</p>
${sinaxar}
<div class="subsol"><span>${esc(PAROHIA)}</span><span>${SITE}</span></div>
</body></html>`
}

// ---------------------------------------------------------------------------
// Browser Rendering
// ---------------------------------------------------------------------------

async function cuBrowser<T>(legatura: Fetcher, fn: (browser: Browser) => Promise<T>): Promise<T> {
  let browser: Browser | null = null
  let ultimaEroare: unknown
  for (let incercare = 0; incercare < 3; incercare++) {
    try {
      const sesiuni = await puppeteer.sessions(legatura as never).catch(() => [])
      const libera = sesiuni.find((s) => !s.connectionId)
      browser = libera ? await puppeteer.connect(legatura as never, libera.sessionId) : await puppeteer.launch(legatura as never, { keep_alive: 20000 })
      const rezultat = await fn(browser)
      browser.disconnect()
      return rezultat
    } catch (e) {
      ultimaEroare = e
      try {
        browser?.disconnect()
      } catch {
        // nimic
      }
      const mesaj = e instanceof Error ? e.message : String(e)
      if (!/429|rate limit|limit/i.test(mesaj) || incercare === 2) throw e
      await new Promise((r) => setTimeout(r, 3000 * (incercare + 1)))
    }
  }
  throw ultimaEroare
}

async function incarca(browser: Browser, html: string) {
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'load', timeout: 20000 })
  if (html.includes('data-potrivire')) {
    // Expresia se evalueaza in browser, nu in worker — de aceea e sir, nu functie.
    await page.waitForFunction("document.documentElement.getAttribute('data-potrivit') === 'da'", { timeout: 8000 }).catch(() => undefined)
  }
  return page
}

export async function pdfDin(legatura: Fetcher, html: string): Promise<ArrayBuffer> {
  return cuBrowser(legatura, async (browser) => {
    const page = await incarca(browser, html)
    const pdf = await page.pdf({ format: 'a4', printBackground: true, preferCSSPageSize: true, timeout: 20000 })
    await page.close()
    return new Uint8Array(pdf).buffer as ArrayBuffer
  })
}

export async function jpgDin(legatura: Fetcher, html: string): Promise<ArrayBuffer> {
  return cuBrowser(legatura, async (browser) => {
    const page = await incarca(browser, html)
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 })
    const el = await page.$('.pagina')
    const poza = el ? await el.screenshot({ type: 'jpeg', quality: 90 }) : await page.screenshot({ type: 'jpeg', quality: 90 })
    await page.close()
    return new Uint8Array(poza).buffer as ArrayBuffer
  })
}

/** Amprenta HTML-ului: cheia din cache a hartiei; orice schimbare de date sau asezare da alt fisier. */
export async function amprenta(html: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(html))
  return [...new Uint8Array(h)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Hartia din Cache API sau proaspat facuta. Cheia = adresa + amprenta HTML-ului, deci un fisier
 * vechi nu e servit niciodata pentru date noi; expira singur.
 */
export async function hartieDinCache(
  req: Request,
  ctx: ExecutionContext,
  html: string,
  fel: 'pdf' | 'jpg',
  numeFisier: string,
  fabrica: () => Promise<ArrayBuffer>,
): Promise<Response> {
  const amp = await amprenta(html)
  const url = new URL(req.url)
  const cheie = new Request(`${url.origin}${url.pathname}?v=${amp}`, { method: 'GET' })
  const cache = caches.default
  const gasit = await cache.match(cheie)
  const tip = fel === 'pdf' ? 'application/pdf' : 'image/jpeg'
  const antete = {
    'content-type': tip,
    'content-disposition': `inline; filename="${numeFisier}.${fel}"`,
    'cache-control': 'public, max-age=3600',
    'access-control-allow-origin': '*',
    etag: `"${amp}"`,
  }
  if (gasit) return new Response(gasit.body, { status: 200, headers: antete })
  const octeti = await fabrica()
  const raspuns = new Response(octeti, { status: 200, headers: { ...antete, 'cache-control': 'public, max-age=2592000' } })
  ctx.waitUntil(cache.put(cheie, raspuns.clone()))
  return new Response(octeti, { status: 200, headers: antete })
}

export function titluSaptamanii(luni: string): string {
  return intervalLizibil(luni, adaugaZile(luni, 6))
}
