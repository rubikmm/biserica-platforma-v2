/**
 * Paginile Tipicului. Afisarea, markup-ul si textele sunt cele din V1 (`biserica-tipic`,
 * 2 sept. 2026) — „să respecți mesajele și grafica din V1" (user, 10.09.2026).
 *
 * Asezarea paginii, in ordinea ceruta de user (1 sept. 2026): intai Pericopele, apoi Rânduiala
 * desfasurata (Anuarul), apoi rânduiala scurta (ROEA) ca rezumat, si abia la coada Mineiul —
 * randuielile spun CE se face si se citesc dintr-o privire, Mineiul e lung.
 *
 * Ce s-a schimbat fata de V1, si de ce:
 *  - titlul zilei se face din ziua STRUCTURATA a calendarului (`denumire` + `sfinti`), nu din
 *    `titlu_html`: in V2 calendarul da campurile desfacute, deci nu mai e nimic de despicat;
 *  - pagina e DESCHISA (V1 cerea cont): „totul la liber, deocamdată" (user, 10.09.2026);
 *  - cardurile care duc la PDF-ul cartii apar doar cand cartea e incarcata (deocamdata niciuna).
 */
import type { Navigatie } from '@xc/config'
import type { CarteTipic, RanduialaZi, TipiconalZi, ZiLiturgica, ZiMinei } from '@xc/contracts'
import { ICOANE, LUNI, ZILE_SAPTAMANA, dataLunga, esc, pagina, ziuaSaptamanii } from '@xc/ui'
import type { Pericopa } from './calendar.js'
import { LOCAL } from './stil.js'

/** Plicul abonarii si sageata inainte — aceleasi desene ca la Program si la Calendar. */
const IC_PLIC = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>`
const IC_INAINTE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12h14"/><path d="m12.5 6 6 6-6 6"/></svg>`

export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
  eAdmin: boolean
  versiune: string
  modificata: string
  veziCa?: string | null
  poateVedeaCa?: boolean
  spre?: string
}

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
    nume: 'TIPICUL',
    titlu: 'Tipicul',
    acasa: `${ctx.prefix}/`,
    urlPlatforma: ctx.nav.home || '/',
    local: LOCAL,
    cont: contDin(ctx),
    versiune: ctx.versiune,
    modificata: ctx.modificata,
  }
}

// ---------------------------------------------------------------------------
// Bucatile paginii
// ---------------------------------------------------------------------------

/**
 * Textul unei zile tine adesea cat o pagina intreaga de carte. Il taiem la 12 randuri si punem
 * sub el o linie cu butonul „mai mult" la mijloc (user, 1 sept. 2026). Butonul NU deschide
 * dintr-odata tot: DUBLEAZA de fiecare data cate randuri se vad (12, 24, 48...). Cand s-a vazut
 * tot, desfacerea e definitiva: apare linia SFÂRȘIT, iar butonul dispare (user, 2 sept. 2026).
 *
 * Taierea o pune scriptul, nu sablonul: daca scriptul nu ruleaza, textul se vede intreg.
 */
function taiat(continut: string, clasa: string): string {
  return `<div class="tipic ${clasa}" data-lung>
  ${continut}
  </div>
  <p class="sfarsit" hidden><span>SFÂRȘIT</span></p>
  <p class="mai-mult" hidden><button type="button" class="btn-mai">mai mult</button></p>`
}

/**
 * O parte a paginii: titlul cu sageata in dreapta, si sub el continutul. Partile pornesc
 * INCHISE (user, 2 sept. 2026), de aceea SURSA se scrie chiar in bara titlului, marunt.
 */
function parte(titlu: string, sursa: string, continut: string): string {
  return `<details class="parte">
  <summary><h3><span class="cap"><span>${titlu}</span><small class="sursa"><span class="et">Sursa:</span> ${esc(sursa)}</small></span></h3></summary>
  ${continut}
</details>`
}

/** Numele cartii asa cum se scrie in bara partii: volumul si anul editiei, apoi creditul. */
function numeleCartii(c: CarteTipic | null | undefined, implicit = 'Sursa nu e înregistrată'): string {
  if (!c) return implicit
  const an = c.editura.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? ''
  const cap = an && !c.sursa.includes(an) ? `${c.sursa}, ${an}` : c.sursa
  return c.credit ? `${cap} · ${c.credit}` : cap
}

/**
 * Textul tipicului ROEA e un sir de propozitii intr-un singur bloc, greu de urmarit. Slujbele
 * mari incep rand nou cand deschid o propozitie; numele scurt de dinaintea „:" se ingroasa ca
 * eticheta. Atentie: \b din JS e ASCII — dupa un cuvant terminat in diacritice nu exista word
 * boundary, deci acolo delimitatorul e explicit.
 */
const RAND_NOU = new RegExp(
  '(?<=[.…]) +(?=(?:Vecerni[ea]\\b|Utreni[ea]\\b|Liturghi[ea]\\b|Axion|Ceasurile\\b|' +
    'Pavecernița\\b|Miezonoptica\\b|Seara\\b|Se combină |Combină |Urmează |' +
    '\\d{1,2} *-? *(?:LUNEA|LUNI|MARȚEA|MARȚI|MIERCUREA|MIERCURI|JOIA|JOI|' +
    'VINEREA|VINERI|SÂMBĂTA|SÂMBĂTĂ|DUMINICA|DUMINICĂ)(?=[ ,.])))',
)

function randuialaScurta(tipic: string): string {
  return tipic
    .split(RAND_NOU)
    .map((bucata) => {
      const s = esc(bucata.trim())
      const doua = s.indexOf(':')
      return doua > 0 && doua <= 40 ? `<p><b>${s.slice(0, doua)}</b>${s.slice(doua)}</p>` : `<p>${s}</p>`
    })
    .join('\n  ')
}

/** Incipitele care poarta virgula in ele s-ar taia la jumatate de regula generala. */
const INCIPITE_CU_VIRGULA = [
  'Doamne, strigat-am',
  'Învrednicește-ne, Doamne',
  'Născătoare de Dumnezeu, Fecioară',
  'Mare ești, Doamne',
  'Cel ce a înviat din morți, Hristos',
  'Slavă Ție, Doamne',
  'Bucură-te, ceea ce ești plină de har',
  'Cuvine-se cu adevărat',
]
/** Restul se recunosc dupa punctele de suspensie cu care se incheie. */
const INCIPIT = new RegExp(`(?:${INCIPITE_CU_VIRGULA.join('|')})\\.\\.\\.|[^.,;:()]{2,60}\\.\\.\\.`, 'gu')

function cursiv(s: string): string {
  return s.replace(INCIPIT, (m) => {
    // Incipitul incepe cu majuscula la inceput de cuvant; ce sta inaintea ei e vorba de legatura
    // a tipicului („se cântă", „apoi"), care ramane dreapta. Majuscula din mijlocul cuvantului nu
    // deschide nimic: „pogorându-Se..." ramane intreg.
    const i = m.search(/(?<=^|[\s(])\p{Lu}/u)
    const taie = i < 0 ? (m.match(/^\s*/) ?? [''])[0]!.length : i
    return `${m.slice(0, taie)}<i>${m.slice(taie)}</i>`
  })
}

/**
 * Alineatele Anuarului se tin de cartea tiparita: capul de alineat — slujba careia ii apartine
 * („La Vecernia mare (sâmbătă seara), …") — ingrosat si rosu, iar CURSIVUL pe ce se canta sau se
 * citeste („Slavă...", „Doamne, strigat-am...").
 */
function paragrafAnuar(p: string): string {
  const m = p.match(/^(La [^,:]{2,45})([,:][\s\S]*)$/u)
  return m ? `<p><b>${esc(m[1]!)}</b>${cursiv(esc(m[2]!))}</p>` : `<p>${cursiv(esc(p))}</p>`
}

/**
 * O bucata din Minei, cu haina pe care i-o da cartea: numele slujbei („LA UTRENIE"), indicatia
 * tipiconala (marunta, aplecata si rosie, ca in carte), textul cantat si sinaxarul, cules mai
 * mic decat cantarile. Ce e cules centrat in carte se aseaza centrat si aici — asezarea vine
 * masurata din tipar, nu ghicita.
 */
function bucataMinei(b: ZiMinei['bucati'][number]): string {
  const t = esc(b.text)
  const c = b.centrat ? ' centrat' : ''
  if (b.fel === 'sectiune') return `<p class="slujba${c}">${t}</p>`
  if (b.fel === 'rubrica') return `<p class="tipiconal${c}">${t}</p>`
  if (b.fel === 'sinaxar') return `<p class="sinaxar${c}">${t}</p>`
  return `<p>${t}</p>`
}

/** O sectiune de pericopa: titlul cu referintele, apoi textul adus de la Biblia prin calendar. */
function sectiunePericopa(titlu: string, texte: Array<Pericopa | null>, deschis = false): string {
  const gasite = texte.filter((t): t is Pericopa => !!t)
  if (!gasite.length) return ''
  const blocuri: string[] = []
  for (const t of gasite) {
    for (const b of t.bucati) {
      if (b.versete && b.versete.length) {
        // la trecerile peste capitol (Evrei 12, 28-13, 8) se arata unde incepe capitolul nou
        let capCurent = b.versete[0]!.capitol
        blocuri.push(
          `<p><small>${esc(b.referinta)}</small></p>` +
            b.versete
              .map((v) => {
                const semn = v.capitol && v.capitol !== capCurent ? `<p><small>capitolul ${v.capitol}</small></p>` : ''
                if (v.capitol) capCurent = v.capitol
                return `${semn}<p class="vers"><b>${v.numar}</b>${esc(v.text)}</p>`
              })
              .join(''),
        )
      } else {
        blocuri.push(`<p><small>${esc(b.referinta)}</small> — textul nu a putut fi încărcat de la Biblia; încearcă mai târziu.</p>`)
      }
    }
  }
  const refs = gasite.map((t) => esc(t.referinta)).join(' · ')
  return `<details${deschis ? ' open' : ''}>
  <summary><b>${esc(titlu)}</b> — ${refs}</summary>
  ${blocuri.join('<hr>')}
</details>`
}

/**
 * Titlul zilei, sub data. La DUMINICI se aseaza pe trei randuri, ca la Calendar (user, 1 sept.
 * 2026): numele duminicii sus, rosu — rosul e AL DUMINICII —, sfintii sub el, iar pericopele si
 * glasul jos, marunt. In celelalte zile ramane un singur rand cu sfintii, colorati dupa rang.
 */
function culoareRang(rang: string): string {
  if (rang === 'praznic_imparatesc' || rang === 'cruce_rosie') return 'c-rosu'
  if (rang === 'cruce_albastra') return 'c-albastru'
  return ''
}

function sfintiiScrisi(zi: ZiLiturgica): string {
  return zi.sfinti
    .map((s) => {
      const clasa = culoareRang(s.rang)
      const semn = s.semn ? `<span class="cr">${esc(s.semn)}</span> ` : ''
      return clasa ? `<span class="${clasa}">${semn}${esc(s.nume)}</span>` : `${semn}${esc(s.nume)}`
    })
    .join('; ')
}

function capulZilei(zi: ZiLiturgica | null, titluAnuar: string): string {
  if (!zi) return titluAnuar ? `<p class="praznic">${esc(titluAnuar)}</p>` : ''
  const sfinti = sfintiiScrisi(zi)
  const marunt: string[] = []
  if (zi.pericope.apostol) marunt.push(`Ap. ${esc(zi.pericope.apostol)}`)
  if (zi.pericope.evanghelie) marunt.push(`Ev. ${esc(zi.pericope.evanghelie)}`)
  if (zi.glas) marunt.push(`<span class="glas">glas ${zi.glas}</span>${zi.evanghelia_invierii ? `, voscr. ${zi.evanghelia_invierii}` : ''}`)
  const jos = marunt.length ? `\n  <p class="pericope">${marunt.join(' · ')}</p>` : ''
  if (zi.denumire) {
    return `<p class="titlu-zi">${esc(zi.denumire)}</p>${sfinti ? `\n  <p class="sfinti">${sfinti}</p>` : ''}${jos}`
  }
  return sfinti ? `<p class="praznic">${sfinti}</p>${jos}` : titluAnuar ? `<p class="praznic">${esc(titluAnuar)}</p>${jos}` : jos
}

// ---------------------------------------------------------------------------
// Randul de unelte din antet
// ---------------------------------------------------------------------------

/**
 * PASTILA NAVIGARII (user, 13.09.2026: „meniul principal să semene ca la Program și Calendar").
 * Un singur corp, cu chenarul si rotunjirea pe PASTILA, nu pe segmente — ca la amandoua celelalte
 * aplicatii, ca sa se citeasca drept UN obiect cu o pozitie, nu doua destinatii deosebite.
 *
 * Inauntru, doua segmente: BULINA zilei de azi (fara text, ca bulina saptamanii de la Program si
 * cea a lunii de la Calendar) si „MÂINE", care ia prisosul de latime fiindca e singurul cu scris.
 * E chiar pastila `larga` a Programului — cea a omului fara drepturi, tot cu doua segmente.
 *
 * ⚠️ „Ieri" NU exista (user, 13.09.2026: „și ieri nu are sens"): tipicul se citeste inaintea
 * slujbei, nu dupa ea. Orice alta zi se alege din calendarul de la capatul randului.
 *
 * Treptele sunt socotite fata de ZIUA DE AZI, nu fata de ziua deschisa — ca la Program, unde cele
 * trei trepte sunt tot destinatii fixe. Pe o zi venita din calendar niciun segment nu e marcat.
 *
 * Segmentul pe care CHIAR esti nu duce nicaieri, dar ramane apasabil (`<button aria-disabled>`):
 * asa primeste focusul si se vede unde te afli.
 */
function navigarea(ctx: Ctx, o: { data: string; azi: string; maine: string }): string {
  const p = esc(ctx.prefix)
  const bulina =
    o.data === o.azi
      ? `<button type="button" class="btn punct activ" aria-disabled="true" aria-current="page" title="Ești pe ziua de azi" aria-label="ziua de azi"></button>`
      : `<a class="btn punct" href="${p}/${o.azi}" title="Treci la ziua de azi" aria-label="ziua de azi"></a>`
  // Cuvantul SI sageata se scriu amandoua in pagina; care se vede alege CSS-ul dupa latime, ca la
  // Program — asa nu apuca sa se vada infatisarea nepotrivita, cum s-ar intampla cu JS.
  const scris = `<span class="cuv">Mâine</span><span class="sgt">${IC_INAINTE}</span>`
  const maine =
    o.data === o.maine
      ? `<button type="button" class="btn viit activ" aria-disabled="true" aria-current="page" title="Ești pe ziua de mâine" aria-label="ziua de mâine">${scris}</button>`
      : `<a class="btn viit" href="${p}/${o.maine}" title="Treci la ziua de mâine" aria-label="ziua de mâine">${scris}</a>`
  return `<span class="pastila larga">${bulina}${maine}</span>`
}

/**
 * ABONAREA, in doua bucati: butonul din rand si fereastra care se deschide din el.
 *
 * ⚠️ Amandoua sunt luate de la Program, prin Calendar, CUVANT CU CUVANT (user, 13.09.2026: „vom
 * avea abonare pe aceleași principii"), cu tot cu campul de adresa si cele doua bife. Ca acolo,
 * fereastra e deocamdata numai infatisare: pana nu se leaga de rute, din pagina nu se aboneaza
 * nimeni. Cand se va lega, adresa scrisa slujeste doar la facerea contului — abonarea ramane pe
 * adresa contului, cum cere structura platformei.
 *
 * ⚠️ BUTONUL E AL TUTUROR, SI AL ADMINILOR (regula Calendarului si a Programului, user 12.09.2026:
 * „și ei se comportă ca un utilizator care poate vor să fie anunțați"). Daca se schimba intr-un
 * loc, se schimba in toate trei.
 */
function butonAbonare(_ctx: Ctx): string {
  return `<button type="button" class="btn mic abon" id="b-abonare" title="Primește tipicul pe email">${IC_PLIC}<span class="cuv">Abonare</span></button>`
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
    <label class="bifa"><input type="checkbox" name="anunturi"> Vreau să primesc anunțuri.</label>
    <div class="modal-jos"><button value="abonare" class="btn-plin">Abonare</button></div>
  </form>
</dialog>`
}

/**
 * Butonul deschide fereastra. Inchiderea n-are nevoie de JS: formularul dinauntru e
 * `method="dialog"`, deci si „Abonare", si X-ul o inchid singure (si Escape, de la browser).
 * ⚠️ `body.cu-fereastra` opreste derularea paginii de sub fereastra si se scoate la `close`, ca sa
 * acopere si Escape, si butoanele dinauntru (asa s-a reparat la Calendar si Program, 12.09.2026).
 */
const JS_ABONARE = `
(function(){
  var b = document.getElementById("b-abonare");
  var d = document.getElementById("d-abonare");
  if (!b || !d || !d.showModal) return;
  b.addEventListener("click", function(){ document.body.classList.add("cu-fereastra"); d.showModal(); });
  d.addEventListener("close", function(){ document.body.classList.remove("cu-fereastra"); });
})();
`

/**
 * Randul din antet, in doua grupuri, ca la Program si la Calendar (user, 13.09.2026: „meniul
 * principal să semene ca la Program și Calendar… să fie abonare și calendar"). La stanga pastila
 * navigarii, care ia spatiul ramas, si indata dupa ea ABONAREA — acolo sta si acolo, si acolo. La
 * dreapta, lipit de margine, dupa bara verticala: CALENDARUL, care deschide alegerea zilei.
 *
 * Butonul calendarului si-a pastrat icoana si lucrul; ce s-a schimbat e locul si masura lui — pana
 * pe 13.09.2026 randul era „Astăzi · Mâine · calendar", trei butoane deopotriva de late.
 */
function unelte(ctx: Ctx, o: { data: string; azi: string; maine: string }): string {
  return `${navigarea(ctx, o)}${butonAbonare(ctx)}
      <span class="unelte-dr"><span class="desparte" aria-hidden="true"></span>
      <button class="btn mic cal-buton" id="btn-cal" type="button" aria-expanded="false" aria-controls="cal"
              aria-label="Calendar" title="Alege ziua din calendar">${ICOANE.calendar}</button></span>`
}

// ---------------------------------------------------------------------------
// Pagina unei zile
// ---------------------------------------------------------------------------

export interface ContinutZi {
  data: string
  zi: ZiLiturgica | null
  randuiala: RanduialaZi | null
  tipiconal: TipiconalZi | null
  minei: ZiMinei | null
  carti: { randuiala: CarteTipic | null; tipiconal: CarteTipic | null; minei: CarteTipic | null }
  pericope: { voscreasna: Pericopa | null; utrenie: Pericopa[]; apostol: Pericopa[]; evanghelie: Pericopa[] }
  /** Zilele care se pot alege din calendarul din antet. */
  zileCuRanduiala: string[]
  azi: string
  maine: string
}

export function paginaZilei(ctx: Ctx, o: ContinutZi): string {
  const cand = `${ZILE_SAPTAMANA[ziuaSaptamanii(o.data)]}, ${dataLunga(o.data)}`
  const praznic = capulZilei(o.zi, o.tipiconal?.titlu ?? '')

  const peric = [
    o.randuiala?.voscreasna ? sectiunePericopa(`Voscreasna ${o.randuiala.voscreasna}`, [o.pericope.voscreasna]) : '',
    sectiunePericopa('Evanghelia Utreniei', o.pericope.utrenie),
    sectiunePericopa('Apostolul', o.pericope.apostol),
    sectiunePericopa('Evanghelia', o.pericope.evanghelie),
  ].join('')

  // „Tipiconal", nu „Rânduiala" (user, 1 sept. 2026): asa se numeste si cartea din care vine —
  // Anuarul liturgic si TIPICONAL —, iar „Rânduiala" ramane a ROEA.
  const detaliat = o.tipiconal
    ? parte('Tipiconal', numeleCartii(o.carti.tipiconal), taiat(o.tipiconal.paragrafe.map(paragrafAnuar).join('\n  '), 'anuar'))
    : ''
  // Fara Anuar, randuiala scurta ramane singura: atunci nu e „pe scurt", e Rânduiala.
  const scurt = o.randuiala
    ? parte(detaliat ? 'Rânduiala (pe scurt)' : 'Rânduiala', numeleCartii(o.carti.randuiala), taiat(randuialaScurta(o.randuiala.tipic), 'roea'))
    : ''
  // Capitolul poarta numele CARTII si ZIUA din ea: „Mineiul: 22 noiembrie" (user, 1 sept. 2026).
  // Cartea nu tine de an, deci ziua se scrie fara an — asa cum se cauta si in carte.
  const slujba = o.minei
    ? parte(`Mineiul: ${o.minei.zi} ${LUNI[o.minei.luna - 1] ?? ''}`, numeleCartii(o.carti.minei), taiat(o.minei.bucati.map(bucataMinei).join('\n  '), 'minei'))
    : ''

  const corp =
    o.randuiala || o.tipiconal || o.minei
      ? `<h2>${esc(cand)}</h2>${praznic ? `\n  ${praznic}` : ''}${peric ? `\n  ${peric}` : ''}${detaliat ? `\n  ${detaliat}` : ''}${scurt ? `\n  ${scurt}` : ''}${slujba ? `\n  ${slujba}` : ''}`
      : `<h2>${esc(cand)}</h2>
  <p>Nu există rânduială proprie pentru această zi în cărțile tipicului.
  Se slujește după rânduiala obișnuită a zilei săptămânii.</p>
  <p class="indemn">Alege din calendar o zi cu rânduială proprie.</p>`

  return pagina({
    ...comune(ctx),
    titluPagina: `Tipicul — ${o.data}`,
    indexabil: true,
    unelte: unelte(ctx, { data: o.data, azi: o.azi, maine: o.maine }),
    subantet: `${fereastraAbonare(ctx)}<div id="cal" hidden></div>`,
    corp,
    scripturi: `${scriptulPaginii(o.zileCuRanduiala, o.data, ctx.prefix)}${JS_ABONARE}`,
  })
}

export function paginaMesaj(ctx: Ctx, titlu: string, mesaj: string): string {
  return pagina({
    ...comune(ctx),
    titluPagina: titlu,
    corp: `<h2>${esc(titlu)}</h2>\n<p>${esc(mesaj)}</p>`,
  })
}

// ---------------------------------------------------------------------------
// Scriptul paginii: calendarul de selectie si taierea textelor lungi (ca in V1)
// ---------------------------------------------------------------------------

function scriptulPaginii(zile: string[], activa: string, prefix: string): string {
  return `(function(){
  // calendarul: numai zilele cu randuiala se pot alege; schimbarea lunii NU reincarca pagina
  var ZILE=${JSON.stringify(zile)};
  var ACTIVA=${JSON.stringify(activa)};
  var PREFIX=${JSON.stringify(prefix)};
  var LUNI=${JSON.stringify(LUNI)};
  var SET={}; ZILE.forEach(function(x){SET[x]=1});
  var luna=ACTIVA.slice(0,7);

  function deseneaza(){
    var an=+luna.slice(0,4), m=+luna.slice(5,7);
    var nrZile=new Date(Date.UTC(an,m,0)).getUTCDate();
    var decalaj=(new Date(Date.UTC(an,m-1,1)).getUTCDay()+6)%7;
    var cate=ZILE.filter(function(x){return x.slice(0,7)===luna}).length;
    var h='<nav><button type="button" id="cal-inapoi">&larr;</button>'
      +'<span>'+LUNI[m-1]+' '+an+' · '+cate+(cate===1?' zi':' zile')+'</span>'
      +'<button type="button" id="cal-inainte">&rarr;</button></nav>'
      +'<table class="cal"><thead><tr><th>L</th><th>Ma</th><th>Mi</th><th>J</th><th>V</th><th>S</th><th>D</th></tr></thead><tbody><tr>';
    for(var i=0;i<decalaj;i++) h+='<td></td>';
    for(var zi=1;zi<=nrZile;zi++){
      var dz=an+'-'+String(m).padStart(2,'0')+'-'+String(zi).padStart(2,'0');
      if((decalaj+zi-1)%7===0 && zi>1) h+='</tr><tr>';
      h+= SET[dz]
        ? '<td><a href="'+PREFIX+'/'+dz+'"'+(dz===ACTIVA?' class="acum"':'')+'><b>'+zi+'</b></a></td>'
        : '<td><span aria-disabled="true">'+zi+'</span></td>';
    }
    h+='</tr></tbody></table>';
    cal.innerHTML=h;
    document.getElementById('cal-inapoi').onclick=function(){muta(-1)};
    document.getElementById('cal-inainte').onclick=function(){muta(1)};
  }
  function muta(pas){
    var an=+luna.slice(0,4), m=+luna.slice(5,7)+pas;
    if(m<1){m=12;an--} if(m>12){m=1;an++}
    luna=an+'-'+String(m).padStart(2,'0');
    deseneaza();
  }

  var cal=document.getElementById('cal'), btn=document.getElementById('btn-cal');
  if(btn) btn.addEventListener('click',function(){
    var deschis=cal.hidden;
    cal.hidden=!deschis;
    btn.setAttribute('aria-expanded',String(deschis));
    if(deschis) deseneaza();
  });

  /**
   * Textele lungi se taie la 12 randuri. „Mai mult" DUBLEAZA de fiecare data cate randuri se
   * vad, pana incape tot textul — si atunci se opreste: apare linia SFÂRȘIT si butonul dispare,
   * fara cale de intoarcere (user, 2 sept. 2026).
   */
  var PORNIRE=12;
  Array.prototype.forEach.call(document.querySelectorAll('[data-lung]'),function(bloc){
    var sf=bloc.nextElementSibling;
    if(!sf||!sf.classList.contains('sfarsit')) return;
    var p=sf.nextElementSibling;
    if(!p||!p.classList.contains('mai-mult')) return;
    var randuri=PORNIRE;
    function taie(){ bloc.classList.add('taiat'); bloc.style.maxHeight=(randuri*1.6)+'em'; }
    function desfa(){ bloc.classList.remove('taiat'); bloc.style.maxHeight=''; }
    function incape(){ return bloc.scrollHeight<=bloc.clientHeight+4 }
    function masoara(){
      taie();
      if(incape()){ desfa(); return; }
      p.hidden=false;
      p.firstElementChild.addEventListener('click',function(){
        randuri*=2; bloc.style.maxHeight=(randuri*1.6)+'em';
        if(incape()){ desfa(); sf.hidden=false; p.hidden=true; }
      });
    }
    // Partile pornesc INCHISE, iar inauntrul unui <details> inchis blocul n-are inaltime:
    // masuratoarea ar iesi „incape tot" si butonul ar ramane ascuns pe veci. De aceea se masoara
    // abia la prima deschidere a partii.
    var pa=bloc.closest('details.parte');
    if(pa && !pa.open) pa.addEventListener('toggle',function(){ if(pa.open) masoara(); },{once:true});
    else masoara();
  });
})();`
}
