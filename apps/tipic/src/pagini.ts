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
import { LUNI, LUNI_SCURT, ZILE_SAPTAMANA, adaugaZile, dataLunga, esc, pagina, ziuaSaptamanii } from '@xc/ui'
import { type Pericopa, eRangRosu } from './calendar.js'
import { CARTI_PDF } from './carti-pdf.js'
import { JS_ABONARE, abonamentul, butonAbonare, fereastraAbonare } from '@xc/abonare'
import { LOCAL } from './stil.js'

/* Plicul abonarii a plecat in `@xc/abonare`, odata cu butonul lui: acolo e acelasi desen pentru
   toate aplicatiile, deci nu se mai poate schimba intr-un loc si in celelalte nu. */
/* Cheia calendarului din pastila — ACEEASI icoana ca la Calendar (`apps/calendar/src/pagini.ts`),
   masura ei cu tot: pastila Tipicului e copiata de acolo, deci si cheia trebuie sa cada la fel. */
const IC_CALENDAR = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>`
/* Sageata segmentului „Mâine" — se vede in locul cuvantului pe ecranele inguste (vezi `stil.ts`).
   E aceeasi sageata a platformei ca la Buletin si Newsletter, masura ei cu tot. */
const IC_INAINTE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12h14"/><path d="m12.5 6 6 6-6 6"/></svg>`

export interface Ctx {
  prefix: string
  nav: Navigatie
  utilizator: string | null
  /** Adresa contului — fereastra de abonare o scrie in camp si o incuie; `null` la neautentificat. */
  emailulContului?: string | null
  /**
   * Administratorul TIPICULUI. ⚠️ Din 18.09.2026 vine din cheia aplicatiei (`typicon.manage`), nu din
   * rolul global: un om poate fi admin numai aici.
   */
  eAdmin: boolean
  /** Rolul global — DOAR randul „Administrare" din meniul contului atarna de el. */
  eAdminPlatforma?: boolean
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
    // ⚠️ Panoul PLATFORMEI — rolul global, nu adminul Tipicului (18.09.2026).
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
  if (eRangRosu(rang)) return 'c-rosu'
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

/** Foaie cu colțul îndoit și „PDF" scris pe ea, pusă singură lângă numele cărții (ca în V1). */
const ICOANA_PDF = `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><text x="12" y="17.8" font-size="6.2" font-family="ui-sans-serif,system-ui" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none">PDF</text></svg>`

/**
 * Trimiterea la cartea din care vine rânduiala: foaia PDF în stânga, apoi două rânduri — numele
 * cărții și pagina zilei. Stă la dreapta, sub text.
 *
 * ⚠️ Cartea se deschide în FILĂ NOUĂ (user, 2 sept. 2026): PDF-urile au zeci de MB și se citesc în
 * vizorul browserului, deci pagina zilei trebuie să rămână deschisă în spate — altfel întoarcerea
 * înseamnă reîncărcarea ei și pierderea locului.
 */
function trimitereaLaCarte(adresa: string, nume: string, rand2: string): string {
  return `<p class="la-carte"><a class="carte" href="${esc(adresa)}" target="_blank" rel="noopener"
     title="Deschide cartea în PDF (filă nouă)">
    <span class="insigna">${ICOANA_PDF}</span>
    <span class="ce"><b>${esc(nume)}</b><span class="pag">${esc(rand2)}</span></span>
  </a></p>`
}

/**
 * Cardul unei părți, când cartea ei chiar e în depozit. Trimitem la PAGINA ZILEI din carte
 * (`#page=N`): numerotarea PDF-ului o urmează pe a cărții. Fără pagini scrise, cardul duce la
 * cartea întreagă — așa e la ROEA, unde rânduiala zilei nu ocupă pagini știute.
 *
 * Lunile Mineiului culese de pe sit n-au PDF (nici pagini): acolo cardul nu se scrie deloc.
 */
function cardulCartii(carte: CarteTipic | null | undefined, pagini: number[], nume: string): string {
  const pdf = carte ? CARTI_PDF[carte.cod] : undefined
  if (!pdf) return ''
  const prima = pagini[0]
  const ultima = pagini[pagini.length - 1]
  const rand2 = prima === undefined ? 'Cartea întreagă' : prima === ultima ? `Pag. ${prima}` : `Pag. ${prima}–${ultima}`
  const adresa = prima === undefined ? pdf.adresa : `${pdf.adresa}#page=${prima}`
  return trimitereaLaCarte(adresa, pdf.nume ?? nume, rand2)
}

// ---------------------------------------------------------------------------
// Randul de unelte din antet
// ---------------------------------------------------------------------------

/**
 * SCRISUL DIN PASTILA — unde esti, in cuvinte. Copiat de la Calendar (`scrisulLocului`), cu
 * deosebirea ca acolo pagina e a unei LUNI, iar aici e a unei ZILE: data se scrie intotdeauna cu
 * zi, si e a zilei DESCHISE, nu a zilei de azi.
 *
 * ⚠️ Forma scurta se scrie ALATURI, nu in locul celei lungi, si se schimba din CSS la ecrane mici:
 * randul de unelte trebuie sa ramana pe O SINGURA LINIE, iar „22 noiembrie 2026" n-ar mai fi incaput
 * pe un telefon de 390 px. Scurtarile sunt cele ale platformei (`LUNI_SCURT`): „22 noiem. 2026".
 */
function scrisulLocului(data: string): string {
  const [an, luna, zi] = data.split('-').map(Number) as [number, number, number]
  return `<span class="acum"><b class="lung">${esc(dataLunga(data))}</b>`
    + `<b class="scurt">${zi} ${esc(LUNI_SCURT[luna - 1] ?? '')} ${an}</b></span>`
}

/**
 * PASTILA LOCULUI (user, 18.09.2026: „după bulina cu AZI să avem un text care spune unde ne aflăm —
 * de fapt totul să fie ca la Calendar, fără funcția de filtrare cruci").
 *
 * Patru segmente: BULINA zilei de azi · DATA zilei deschise, cat tot spatiul ramas · „MÂINE" ·
 * CHEIA calendarului, care coboara bara de sub antet. Ordinea de la Calendar (bulina · scris ·
 * cheie) sta neatinsa; „Mâine" se aseaza INTRE scris si cheie.
 *
 * ⚠️ „MÂINE" S-A INTORS (user, 18.09.2026: „Mâine e bun"). In dimineata aceleiasi zile iesise,
 * odata cu mutarea pastilei dupa Calendar; s-a vazut insa ca ziua urmatoare e singura la care se
 * sare des — tipicul se citeste inaintea slujbei — si nu merita de fiecare data coborata grila.
 * ⚠️ „Ieri" tot NU exista (user, 13.09.2026: „și ieri nu are sens"). Orice alta zi se alege din
 * grila lunii, care le are pe toate.
 *
 * ⚠️ „Mâine" NU ia prisosul de latime: prisosul ramane al scrisului `.acum`, ca la Calendar.
 * Segmentul poarta si cuvantul (`.cuv`), si sageata (`.sgt`), amandoua scrise in pagina; care se
 * vede alege CSS-ul dupa latime, ca sa nu apuce sa se vada infatisarea nepotrivita, cum s-ar
 * intampla cu JS. Treapta e socotita fata de ZIUA DE AZI, nu fata de ziua deschisa: pe o zi venita
 * din grila niciun segment nu e marcat.
 *
 * ⚠️ NU se adauga aici lupa si crucea de la Calendar: cautarea si filtrul crucii sunt ale
 * calendarului (user: „fără funcția de filtrare cruci"). Pastila are patru segmente, nu sase.
 *
 * ⚠️ „AZI" E O BULINA, nu un cuvant (regula veche a platformei): punctul se deseneaza din CSS
 * (`.azi-buton::before`), deci butonul ramane gol de text — numele lui se citeste din `title` si
 * `aria-label`. Segmentul pe care CHIAR esti nu duce nicaieri, dar ramane apasabil
 * (`<button aria-disabled>`): asa primeste focusul si se vede unde te afli.
 */
function pastilaLocului(ctx: Ctx, o: { data: string; azi: string; maine: string }): string {
  const p = esc(ctx.prefix)
  const butonAzi =
    o.data === o.azi
      ? `<button type="button" class="azi-buton activ" aria-disabled="true" aria-current="page" title="Astăzi" aria-label="Astăzi"></button>`
      : `<a class="azi-buton" href="${p}/${o.azi}" title="Astăzi" aria-label="Astăzi"></a>`
  const scris = `<span class="cuv">Mâine</span><span class="sgt">${IC_INAINTE}</span>`
  const butonMaine =
    o.data === o.maine
      ? `<button type="button" class="maine-buton activ" aria-disabled="true" aria-current="page" title="Ești pe ziua de mâine" aria-label="ziua de mâine">${scris}</button>`
      : `<a class="maine-buton" href="${p}/${o.maine}" title="Treci la ziua de mâine" aria-label="ziua de mâine">${scris}</a>`
  const cheia = `<button type="button" class="cal-cheie" id="cal-cheie" aria-expanded="false"`
    + ` aria-controls="bara-cal" title="Alege altă zi" aria-label="Alege altă zi">${IC_CALENDAR}</button>`
  return `<span class="pastila">${butonAzi}${scrisulLocului(o.data)}${butonMaine}${cheia}</span>`
}

/**
 * GRILA UNEI LUNI — zilele ei, sapte pe rand, de luni pana duminica.
 *
 * Se scrie PE SERVER, si la prima incarcare a paginii, si la schimbarea lunii (atunci o cere JS-ul
 * de la `/v1/luna/<AAAA-LL>` si o pune in locul celei vechi): un singur loc unde se hotaraste cum
 * arata o zi, deci grila nu se poate desparti in doua infatisari.
 *
 * ⚠️ CULORILE (user, 18.09.2026: „Calendarul să fie afișat scrisul zilelor cu negru — doar
 * duminicile roșii și sărbătorile cu roșu"): numarul zilei e --ink, duminicile si sarbatorile sunt
 * --rosu. Duminicile se stiu din data; sarbatorile vin de la Calendar (vezi `sarbatorileLunii`).
 * Amandoua variabilele se intorc singure pe tema intunecata.
 *
 * ⚠️ Zilele fara randuiala proprie raman INERTE (`<span aria-disabled>`), in aceleasi culori dar
 * palite: culoarea spune ce fel de zi e, opacitatea spune daca are unde duce.
 */
export function grilaLunii(o: {
  prefix: string
  /** Luna desenata, `AAAA-LL`. */
  luna: string
  /** Ziua deschisa in pagina — poarta marcajul `.acum`; poate fi din alta luna. */
  activa: string
  azi: string
  /** Zilele cu randuiala proprie (toate, nu doar ale lunii). */
  zile: string[]
  /** Zilele rosii ale lunii, de la Calendar. */
  sarbatori: string[]
}): string {
  const p = esc(o.prefix)
  const an = Number(o.luna.slice(0, 4))
  const l = Number(o.luna.slice(5, 7))
  const cuRanduiala = new Set(o.zile)
  const rosii = new Set(o.sarbatori)
  const nrZile = new Date(Date.UTC(an, l, 0)).getUTCDate()
  // saptamana incepe LUNI (cum era si in calendarul de pana acum): duminica pica la capat
  const decalaj = (new Date(Date.UTC(an, l - 1, 1)).getUTCDay() + 6) % 7
  const alta = (pas: number) => {
    const d = new Date(Date.UTC(an, l - 1 + pas, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }

  const celule: string[] = []
  for (let i = 0; i < decalaj; i++) celule.push('<td></td>')
  for (let zi = 1; zi <= nrZile; zi++) {
    const d = `${o.luna}-${String(zi).padStart(2, '0')}`
    const clase = ['zi']
    if (ziuaSaptamanii(d) === 0 || rosii.has(d)) clase.push('c-rosu')
    if (d === o.activa) clase.push('acum')
    if (d === o.azi) clase.push('e-azi')
    const c = clase.join(' ')
    celule.push(
      cuRanduiala.has(d)
        ? `<td><a class="${c}" href="${p}/${d}"${d === o.activa ? ' aria-current="page"' : ''}><b>${zi}</b></a></td>`
        : `<td><span class="${c} gol" aria-disabled="true"><b>${zi}</b></span></td>`,
    )
  }
  const randuri: string[] = []
  for (let i = 0; i < celule.length; i += 7) randuri.push(`<tr>${celule.slice(i, i + 7).join('')}</tr>`)

  const capete = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'].map((z) => `<th>${z}</th>`).join('')
  return `<div class="cal-luna" id="cal-luna">
      <nav class="cal-nav">
        <button type="button" class="cal-sageata" data-luna="${alta(-1)}" title="Luna dinainte" aria-label="Luna dinainte">&larr;</button>
        <span class="cal-titlu">${esc(LUNI[l - 1] ?? '')} ${an}</span>
        <button type="button" class="cal-sageata" data-luna="${alta(1)}" title="Luna următoare" aria-label="Luna următoare">&rarr;</button>
      </nav>
      <table class="cal"><thead><tr>${capete}</tr></thead><tbody>${randuri.join('')}</tbody></table>
    </div>`
}

/**
 * BARA CALENDARULUI — sora barei lunilor de la Calendar: sta sub randul de unelte, porneste
 * ASCUNSA (`hidden` scris de server, deci si fara JS pagina e intreaga) si coboara din cheia
 * pastilei. Are chenarul si rotunjirea pastilei, ca sa se recunoasca de unde a iesit.
 *
 * ⚠️ Nu mai e un POP-UP desenat de JS peste pagina, cum era pana pe 18.09.2026: luna deschisa vine
 * gata scrisa de la server, deci prima deschidere nu mai asteapta nimic.
 */
function baraCalendarului(o: Parameters<typeof grilaLunii>[0]): string {
  return `<div class="bara-cal" id="bara-cal" hidden>${grilaLunii(o)}</div>`
}

/**
 * ABONAREA — butonul, fereastra si tot drumul de dupa ea stau in `@xc/abonare`, pachetul comun
 * (user, 15.09.2026: „ar trebui să fie la fel peste tot. Nu ar trebui să copiez logica în mai multe
 * locuri"). Al tipicului a ramas numai randul din registru: audienta `tipic-abonati`.
 *
 * ⚠️ PANA LA 15.09.2026 BUTONUL ERA GOL PE DINAUNTRU: fereastra fusese adusa de la Program cuvant
 * cu cuvant (user, 13.09.2026: „vom avea abonare pe aceleași principii"), dar tipicul n-avea nici
 * ruta `POST /abonare`, nici legatura `COMUNICARE` — deci, spre deosebire de Calendar, Program si
 * Buletin, aici nu era nici macar o ruta intreaga dedesubt. Acum are si una, si alta.
 *
 * ⚠️ BUTONUL E AL TUTUROR, SI AL ADMINILOR (regula Calendarului si a Programului, user 12.09.2026:
 * „și ei se comportă ca un utilizator care poate vor să fie anunțați"). Regula sta acum in pachet.
 *
 * ⚠️ A doua bifa a ferestrei vechi spunea aici „Vreau să primesc anunțuri", nu „Sunt de acord cu
 * termenii și condițiile" ca la celelalte trei — o scapare din copiere. Odata cu fereastra comuna,
 * s-a indreptat: bifa termenilor e aceeasi peste tot, si fara ea abonarea nu pleaca.
 */
const ABONAMENT = abonamentul('tipic')

/** Fereastra, cu adresa contului completata cand omul e intrat, si cu termenii platformei. */
function fereastraTipicului(ctx: Ctx): string {
  return fereastraAbonare({
    prefix: ctx.prefix,
    spre: ctx.spre ?? `${ctx.prefix}/`,
    urlTermeni: `${ctx.nav.home || ''}/termeni`,
    emailulContului: ctx.emailulContului ?? null,
  })
}

/**
 * Carcasa goala a tipicului — antet, subsol, stil — cu un corp dat de altcineva. O cere
 * `@xc/abonare`, ca ecranul celor sase cifre sa fie IN tipic, nu intr-o pagina straina a contului.
 */
export function paginaCarcasa(ctx: Ctx, o: { titluPagina: string; corp: string; scripturi?: string }): string {
  return pagina({
    ...comune(ctx),
    titluPagina: o.titluPagina,
    ...(o.scripturi ? { scripturi: o.scripturi } : {}),
    corp: o.corp,
  })
}

/**
 * Randul din antet, ca la Calendar (user, 18.09.2026: „totul să fie ca la Calendar"): pastila
 * locului, care ia tot spatiul ramas, si langa ea ABONAREA.
 *
 * ⚠️ GRUPUL DIN DREAPTA A CAZUT. Pana pe 18.09.2026 calendarul era un buton lipit de marginea din
 * dreapta, dupa o bara verticala (`.desparte`); acum cheia lui e IN pastila, ca la Calendar, deci
 * n-a mai ramas nimic in grupul acela — nici butonul, nici bara care il despartea.
 *
 * ⚠️ Abonarea ramane AFARA din pastila, cum a fost mereu: o vad toti, si adminii.
 *
 * Ziua de maine se socoteste AICI, din ziua de azi: e o zi mai incolo, nimic de cerut de la nimeni,
 * deci nu are ce cauta in `ContinutZi` — pagina nu se schimba dupa ea, ci dupa `data` si `azi`.
 */
function unelte(ctx: Ctx, o: { data: string; azi: string }): string {
  return `${pastilaLocului(ctx, { ...o, maine: adaugaZile(o.azi, 1) })}${butonAbonare(ABONAMENT)}`
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
  /** Zilele rosii ale lunii deschise (praznice si cruci rosii), de la Calendar. */
  sarbatori: string[]
  azi: string
}

export function paginaZilei(ctx: Ctx, o: ContinutZi): string {
  // ⚠️ Capul paginii e cel din V1 (user, 13.09.2026): DATA scrisă cifre și numele zilei AȘA CUM ÎL
  // SCRIE CARTEA (`DUMINICĂ`, `LUNI`) — nu ziua săptămânii calculată de noi și nu data lungă. Când
  // nicio carte n-are ziua, rămâne numele calculat, ca pagina să nu aibă capul ciuntit.
  const numeleZilei = o.randuiala?.zi || o.tipiconal?.zi || ZILE_SAPTAMANA[ziuaSaptamanii(o.data)] || ''
  const cand = numeleZilei ? `${o.data} — ${numeleZilei}` : o.data
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
    ? parte(
        'Tipiconal',
        numeleCartii(o.carti.tipiconal),
        taiat(o.tipiconal.paragrafe.map(paragrafAnuar).join('\n  '), 'anuar') +
          cardulCartii(o.carti.tipiconal, o.tipiconal.pagini, numeleCartii(o.carti.tipiconal)),
      )
    : ''
  // Fara Anuar, randuiala scurta ramane singura: atunci nu e „pe scurt", e Rânduiala.
  const scurt = o.randuiala
    ? parte(
        detaliat ? 'Rânduiala (pe scurt)' : 'Rânduiala',
        numeleCartii(o.carti.randuiala),
        taiat(randuialaScurta(o.randuiala.tipic), 'roea') + cardulCartii(o.carti.randuiala, [], numeleCartii(o.carti.randuiala)),
      )
    : ''
  // Capitolul poarta numele CARTII si ZIUA din ea: „Mineiul: 22 noiembrie" (user, 1 sept. 2026).
  // Cartea nu tine de an, deci ziua se scrie fara an — asa cum se cauta si in carte.
  const numeMinei = o.minei ? `Mineiul: ${o.minei.zi} ${LUNI[o.minei.luna - 1] ?? ''}` : ''
  const slujba = o.minei
    ? parte(
        numeMinei,
        numeleCartii(o.carti.minei),
        taiat(o.minei.bucati.map(bucataMinei).join('\n  '), 'minei') + cardulCartii(o.carti.minei, o.minei.pagini, numeMinei),
      )
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
    unelte: unelte(ctx, { data: o.data, azi: o.azi }),
    subantet: `${baraCalendarului({
      prefix: ctx.prefix,
      luna: o.data.slice(0, 7),
      activa: o.data,
      azi: o.azi,
      zile: o.zileCuRanduiala,
      sarbatori: o.sarbatori,
    })}\n    ${fereastraTipicului(ctx)}`,
    corp,
    scripturi: `${scriptulPaginii(ctx.prefix, o.data)}${JS_ABONARE}`,
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

function scriptulPaginii(prefix: string, activa: string): string {
  return `(function(){
  var PREFIX=${JSON.stringify(prefix)};
  var ACTIVA=${JSON.stringify(activa)};

  /* BARA CALENDARULUI — coborata si ridicata din cheia pastilei, ca bara lunilor de la Calendar.
     Luna deschisa e DEJA scrisa in ea de server, deci prima apasare nu asteapta nimic. */
  var bara=document.getElementById('bara-cal'), cheie=document.getElementById('cal-cheie');
  if(bara&&cheie) cheie.addEventListener('click',function(){
    var deschisa=!bara.hidden;
    bara.hidden=deschisa;
    cheie.setAttribute('aria-expanded',deschisa?'false':'true');
  });

  /* Sagetile ← → aduc luna vecina de la server (o singura adresa, /v1/luna/<AAAA-LL>), ca sa nu
     fie doua feluri de grila: una scrisa in TypeScript si alta in sirul asta. Ascultarea sta pe
     BARA, nu pe butoane: butoanele se schimba la fiecare luna adusa, bara nu. */
  if(bara) bara.addEventListener('click',function(ev){
    var t=ev.target;
    var b=t&&t.closest?t.closest('.cal-sageata'):null;
    if(!b) return;
    var luna=b.getAttribute('data-luna');
    if(!luna) return;
    bara.setAttribute('aria-busy','true');
    fetch(PREFIX+'/v1/luna/'+luna+'?zi='+ACTIVA,{headers:{accept:'text/html'}})
      .then(function(r){ if(!r.ok) throw 0; return r.text() })
      .then(function(t){ bara.innerHTML=t })
      .catch(function(){})
      .then(function(){ bara.removeAttribute('aria-busy') });
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
