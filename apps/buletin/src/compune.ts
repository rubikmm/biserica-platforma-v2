/**
 * COMPUNEREA UNUI NUMĂR — de la ce s-a scris la PDF-ul de tipar.
 *
 * Trei pași, în ordinea asta și din motive care nu se schimbă:
 *   1. **socoteala** (`masuri.ts`) — încape textul? Dacă nu, se răspunde cu cifre, nu se compune
 *      pe jumătate. E aritmetică, deci costă nimic și se poate cere și singură.
 *   2. **calendarul** — se CERE de la aplicația `program` (`/v1/tabel-tipar`, Service Binding
 *      `PROGRAM`), nu se desenează aici. Programul e proprietarul formei.
 *   3. **randarea** — HTML autonom → PDF prin Browser Rendering, apoi în depozit.
 *
 * ⚠️ CURGEREA SPUNE ADEVĂRUL, SOCOTEALA DOAR ÎL PREVESTEȘTE. Scriptul din pagină numără semnele
 * care au intrat cu adevărat și le scrie în `data-raport`; dacă a rămas text pe dinafară, numărul
 * NU se dă drept bun, oricât de bine ar fi ieșit socoteala. Ordinea asta — întâi socoteala, la
 * urmă proba randării — e singura care nu minte nici pe repede, nici pe încet.
 */
import { ANTET_SECRET } from '@xc/actiuni'
import { dataLunga, pdfCuRaportSiCoperta } from '@xc/ui'
import { type Buletin, capulTextului, mottoDinText } from './depozit.js'
import { foaieHtml, textCurat } from './foaie.js'
import { type NumarCerut, type Socoteala, SECUNDARI_MAXIM, SEMNE_PE_RAND, semne, socoteste } from './masuri.js'
import { cheiaSchitei } from './schita.js'
import { cheiaBrosurii } from './tipar.js'
import { umpleCuProba } from './umplere.js'

export interface EnvCompunere {
  BROWSER: Fetcher
  PROGRAM: Fetcher
  FISIERE: R2Bucket
  /**
   * SECRETUL PLATFORMEI — cu el se deschide UȘA INTERNĂ a programului (20.09.2026).
   *
   * ⚠️ Fără el, `/v1/tabel-tipar` răspunde cu ochii LUMII: o săptămână nepublicată (propusă ori
   * programată) nu există, deci vine 404 `nepublicat` — adică tocmai săptămâna pe care buletinul o
   * compune, cu o săptămână înainte. Nu e o podoabă: fără antet, `/nou` nu mai poate compune deloc.
   */
  SECRET_INTERN?: string
}

export interface Calendar {
  tabel: string
  stil: string
  titlu: string
  de_la: string
  pana_la: string
  slujbe: number
  detalii: number
  /** treapta la care a fost strâns: 0 întreg, 1 fără sfinți, 2 și fără pericopă */
  strans: Strans
  /**
   * `validat` = săptămâna confirmată de parohie; `propus` = ce era disponibil, neconfirmat.
   * ⚠️ Din 17.09.2026, seara, programul PROPUS se folosește „fără probleme" (user) — dar cu
   * atenția atrasă LA ÎNCEPUT, la vedere: un număr compus pe o propunere nu tace despre asta.
   */
  stare: 'validat' | 'propus'
  /**
   * AMPRENTA PROGRAMULUI — aceeași la orice treaptă de strângere, fiindcă se ia pe tabelul întreg
   * (vezi `tabelulSaptamanii` în program). Se păstrează lângă numărul compus, ca ecranul `/nou` să
   * poată spune „programul s-a schimbat de la ultima compunere".
   * ⚠️ `undefined` la un program mai vechi decât 19.09.2026 (înainte să existe câmpul) — atunci nu
   * se compară nimic, nu se strigă „s-a schimbat" în gol.
   */
  amprenta?: string
  /** ultima atingere a săptămânii, ISO 8601; `null` când săptămâna nu e în baza programului */
  modificat_la?: string | null
  /**
   * CE SE VEDE DINCOLO DE `stare` — semnele ușii interne (`SemneleSaptamanii`, în program).
   *
   * ⚠️ `stare` ȘI `publica` NU SUNT ACELAȘI LUCRU: `stare: 'validat'` e GESTUL OMULUI (validată,
   * fie și programată pentru duminică), `publica` e ce vede deja lumea. Buletinul se uită la
   * `stare` — un program programat de paroh nu mai e o presupunere —, iar celelalte două le
   * păstrează lângă număr, ca să se știe mai târziu ce era programul în clipa validării.
   * ⚠️ `undefined` la un program mai vechi de 20.09.2026 (înainte să existe ușa internă).
   */
  publica?: boolean
  /** validată înainte de vreme, își așteaptă pragul de duminică */
  programata?: boolean
  /** clipa în care apare (ori a apărut) săptămâna, ISO 8601; `null` = niciuna */
  apare?: string | null
}

/**
 * PROGRAMUL CU CARE S-A TIPĂRIT UN NUMĂR — se scrie lângă cerere, în `compus/…json`.
 *
 * ⚠️ De ce se păstrează (user, 19.09.2026: „să verifice dacă buletinul a suferit vreo modificare…
 * se poate și cu un flag pentru dată"): programul se citește proaspăt la FIECARE compunere, dar
 * foaia rămasă pe ecran poate fi de dinaintea unei schimbări — mai ales când compunerea de după
 * schimbare s-a oprit la socoteală și n-a scris nimic. Fără amprenta asta, nimic din `/nou` nu
 * deosebește o foaie la zi de una rămasă în urmă.
 */
export interface ProgramulFolosit {
  amprenta?: string
  modificat_la?: string | null
  stare?: 'validat' | 'propus'
  /**
   * SEMNELE UȘII INTERNE, păstrate lângă număr din 21.09.2026 (user, 20.09.2026, 23:33: „Buletinul
   * preia la momentul validării ce program era validat"). Lângă numărul VALIDAT ele spun ce era
   * programul chiar atunci: validat și deja public, ori validat și încă programat pentru duminică.
   * ⚠️ Toate trei `undefined` la cererile păstrate înainte de ușa internă — atunci nu se știe, și
   * nu se inventează.
   */
  publica?: boolean
  programata?: boolean
  apare?: string | null
}

/** Cererea păstrată lângă PDF: numărul ca date și programul cu care s-a tipărit. */
export interface CerereaPastrata extends NumarCerut {
  program?: ProgramulFolosit
}

/** Programul unui calendar primit, în forma în care se păstrează. */
export const programulFolosit = (c: Calendar | null | undefined): ProgramulFolosit | undefined =>
  c
    ? {
        amprenta: c.amprenta,
        modificat_la: c.modificat_la ?? null,
        stare: c.stare,
        // ⚠️ Scrise numai când chiar s-au primit: un `publica: false` pus din necunoaștere ar minți
        // despre o săptămână care era de mult afară.
        ...(c.publica === undefined ? {} : { publica: c.publica }),
        ...(c.programata === undefined ? {} : { programata: c.programata }),
        ...(c.apare === undefined ? {} : { apare: c.apare }),
      }
    : undefined

/**
 * S-A SCHIMBAT PROGRAMUL DE LA ULTIMA COMPUNERE?
 *
 * ⚠️ Se răspunde NUMAI când amândouă amprentele se știu. Lipsa uneia (număr compus înainte de
 * 19.09.2026, ori program care n-a răspuns acum) NU e o schimbare: un semn roșu pus din
 * necunoaștere ar învăța omul să nu se mai uite la el.
 */
export function programulSaSchimbat(
  folosit: ProgramulFolosit | null | undefined,
  acum: Pick<Calendar, 'amprenta' | 'modificat_la'> | null | undefined,
): { modificat_la: string | null } | null {
  const a = folosit?.amprenta
  const b = acum?.amprenta
  if (!a || !b || a === b) return null
  return { modificat_la: acum?.modificat_la ?? null }
}

/**
 * Tabelul săptămânii, de la program.
 *
 * ⚠️ Data cerută e a numărului (duminica de pe foaie), dar programul are nevoie de o zi DIN
 * săptămâna tipărită, iar aceea e cea care URMEAZĂ: numărul 615, datat 6 septembrie, poartă
 * programul pentru 7–13 septembrie (regulă veche a parohiei). De aceea se cere ziua de a doua zi,
 * nu ziua numărului — greșeala se vede abia pe hârtie, cu o săptămână veche tipărită în 300 de
 * exemplare.
 */
export type Strans = 0 | 1 | 2

/** Cum se spune omului fiecare treaptă a calendarului strâns. */
export const NUMELE_TREPTEI: Record<Strans, string> = {
  0: 'programul întreg',
  1: 'programul fără sfinții duminicii',
  2: 'programul fără sfinții duminicii și fără pericopă (apostol, evanghelie, glas)',
}

/**
 * CE SE CEDEAZĂ DE PE FOAIE CÂND TEXTUL NU ÎNCAPE — și în ce ordine (user, 19.09.2026, 16:31:
 * „Ar trebui să dispară floricica și dacă nici așa nu intră să dispară sfinții din calendar").
 *
 * Ordinea nu e a noastră, e a lui, și e cumulativă: floarea e podoabă, sfinții duminicii se
 * citesc și în calendar, pericopa e „în extremis". Abia după toate trei se refuză numărul.
 */
export interface Cedare {
  /** se mai pune floarea de deasupra calendarului? */
  floare: boolean
  /** cât de strâns e cerut tabelul de la program */
  strans: Strans
}

export const CEDARILE: readonly Cedare[] = [
  { floare: true, strans: 0 },
  { floare: false, strans: 0 },
  { floare: false, strans: 1 },
  { floare: false, strans: 2 },
] as const

/** Ce s-a cedat, în vorbele omului; `null` când foaia a ieșit întreagă. */
export function vorbaCedarii(c: Cedare): string | null {
  const ce: string[] = []
  if (!c.floare) ce.push('fără floare')
  if (c.strans === 1) ce.push('calendar fără sfinții duminicii')
  if (c.strans === 2) ce.push('calendar fără sfinții duminicii și fără pericopă (apostol, evanghelie, glas)')
  return ce.length ? ce.join(', ') : null
}

/**
 * CE SE MAI CEDEAZĂ DUPĂ O RANDARE CARE A LĂSAT TEXT PE DINAFARĂ — ales din ARITMETICĂ, nu din
 * încă trei randări.
 *
 * ⚠️ De ce nu se coboară treaptă cu treaptă (19.09.2026): o randare ține vreo minut prin Browser
 * Rendering, iar `POST /nou/compune` și „Da"-ul din bulă nu stau patru minute. Din prima randare
 * știm deficitul în semne (`peDinafara`), iar socoteala știe cât ELIBEREAZĂ fiecare treaptă (tot
 * în semne, din `semneCuTot`). Deci se alege dintr-o dată treapta cea mai mică ce acoperă
 * deficitul, cu o rezervă de un rând, și se randează O SINGURĂ dată în plus.
 *
 * Dacă nicio treaptă nu acoperă deficitul, se ia cea mai largă care eliberează totuși ceva: omul
 * a cerut ca foaia să se strângă ÎNAINTE de refuz, iar cifra cu care refuzăm trebuie să fie cea
 * rămasă cu adevărat, nu una dinaintea strângerii. `null` = nu mai e nimic de cedat, se refuză.
 */
export function cedareaDeIncercat(o: {
  /** treapta la care s-a randat acum (indice în `CEDARILE`) */
  dela: number
  /** semnele rămase pe dinafară la randarea făcută */
  peDinafara: number
  /** câte semne eliberează fiecare treaptă față de cea randată (aceeași lungime ca `CEDARILE`) */
  elibereaza: readonly number[]
  /** cât se cere peste deficit, ca să nu se piardă totul pentru un cuvânt — un rând */
  rezerva?: number
}): number | null {
  const nevoie = o.peDinafara + (o.rezerva ?? SEMNE_PE_RAND)
  const mai = CEDARILE.map((_, i) => i).filter((i) => i > o.dela && (o.elibereaza[i] ?? 0) > 0)
  if (!mai.length) return null
  return mai.find((i) => (o.elibereaza[i] ?? 0) >= nevoie) ?? mai[mai.length - 1]!
}

export async function calendarulNumarului(env: EnvCompunere, dataNumarului: string, strans: Strans = 0): Promise<Calendar | { eroare: string; cod: string }> {
  const aDouaZi = new Date(`${dataNumarului}T12:00:00Z`)
  aDouaZi.setUTCDate(aDouaZi.getUTCDate() + 1)
  const cerut = aDouaZi.toISOString().slice(0, 10)
  /*
   * ⚠️ PROASPĂT LA FIECARE CERERE, SPUS RĂSPICAT (user, 19.09.2026: „am modificat programul și nu
   * mi-l citește"). Legătura de serviciu nu trece azi prin niciun cache, iar tabelul iese din D1 la
   * fiecare cerere — dar răspunsul programului poartă `cache-control: public, max-age=300` și chiar
   * E ȚINUT la muchie pe ruta lui publică (probat pe 19.09.2026: aceeași adresă dădea răspunsul
   * dinainte, iar cu o întrebare în plus pe ea venea cel nou). Ziua în care drumul ăsta ar ajunge să
   * treacă pe hostname în loc de binding, foaia ar purta cinci minute programul vechi, fără ca nimic
   * să dea vreo eroare. Cererea spune deci ea însăși că nu primește nimic ținut.
   *
   * ⚠️ Numai ANTETE, nu `cf: { cacheTtl }`: `cf` nu are ce căuta pe o legătură de serviciu, iar de
   * aruncat aici ar însemna un `/nou` care nu se mai deschide deloc — tocmai ecranul pe care-l reparăm.
   */
  /*
   * ⚠️ ANTETUL INTERN, DE LA 21.09.2026 — fără el buletinul nu mai poate compune săptămâna viitoare.
   * Programul arată de pe 20.09.2026 „doar ce e curent": o săptămână încă PROPUSĂ (ori validată, dar
   * programată pentru duminică) nu există pentru lume, deci ruta dă 404 `nepublicat`. Or buletinul se
   * compune tocmai cu o săptămână înainte, și are nevoie de tabel CÂT E ÎNCĂ PROPUS, ca să-și
   * socotească spațiul (user, 20.09.2026, 23:55: „Trebuie să putem să lucrăm și la buletin cu un
   * program în pagină, altfel nu putem calcula spațiul").
   * ⚠️ Antetul se pune DOAR dacă secretul există: unul gol ar fi la fel de închis, dar ar ascunde
   * cauza într-un 404 care pare al programului.
   */
  const antete: Record<string, string> = { 'cache-control': 'no-cache', pragma: 'no-cache' }
  if (env.SECRET_INTERN) antete[ANTET_SECRET] = env.SECRET_INTERN
  /*
   * ⚠️ LEGĂTURA CĂZUTĂ SE ÎNTOARCE CA EROARE, NU CA ARUNCARE (21.09.2026). Până aici, o legătură de
   * serviciu care arunca (program oprit, rețea) trecea prin `calendarulNumarului` netulburată și
   * dărâma tot ecranul `/nou` cu 500 — tocmai ecranul de pe care omul ar fi trebuit să afle că
   * programul tace. Acum răspunsul are aceeași formă ca la orice alt refuz al programului, iar cei
   * de deasupra (pagina, compunerea, validarea) hotărăsc fiecare ce face cu el.
   */
  let r: Response
  try {
    r = await env.PROGRAM.fetch(`https://xc-program/v1/tabel-tipar?data=${cerut}&strans=${strans}`, { headers: antete })
  } catch (e) {
    return {
      cod: 'program_mut',
      eroare: `programul n-a răspuns deloc pentru săptămâna care începe ${cerut} (${e instanceof Error ? e.message : String(e)})`,
    }
  }
  if (!r.ok) {
    const corp = (await r.json().catch(() => ({}))) as { cod?: string; mesaj?: string; de_la?: string; pana_la?: string }
    /*
     * ⚠️ 404 `nepublicat` ÎNSEAMNĂ UȘA ÎNCHISĂ, nu „program indisponibil". Cererea noastră poartă
     * antetul intern; dacă programul tot răspunde cu ochii lumii, secretul lipsește ori nu e același
     * la cele două aplicații. Spus generic, omul ar fi căutat o săptămână în aplicația Programul, unde
     * totul e la locul lui.
     */
    if (corp.cod === 'nepublicat') {
      const cand = corp.de_la ? `${corp.de_la}–${corp.pana_la ?? ''}` : cerut
      return {
        cod: 'nepublicat',
        eroare:
          `programul a refuzat ușa internă (secret) pentru săptămâna ${cand}: fără antetul intern se ` +
          'vede doar ce e deja public, iar săptămâna asta nu e încă. Verifică `SECRET_INTERN` — ' +
          'aceeași valoare la buletin și la program, pe fiecare mediu.',
      }
    }
    return {
      cod: corp.cod ?? 'program_indisponibil',
      eroare: corp.mesaj ?? `programul a răspuns ${r.status} pentru săptămâna care începe ${cerut}`,
    }
  }
  return (await r.json()) as Calendar
}

export interface Compus {
  ok: boolean
  socoteala: Socoteala
  /** ce a intrat cu adevărat, măsurat la randare */
  raport?: { intrate: number; peDinafara: number; coloaneFolosite: number }
  pdf?: ArrayBuffer
  /** pagina întâi ca poză, din aceeași randare — coperta de pe ecran și, la validare, a arhivei */
  coperta?: ArrayBuffer
  cheie?: string
  calendar?: Calendar | null
  /** ce oprește compunerea — cu cifre */
  plangeri: string[]
  /**
   * CE S-A CEDAT ca să încapă textul — „fără floare", „calendar fără sfinții duminicii", „și fără
   * pericopă". `null` când foaia a ieșit întreagă. Se spune și în `atentie`, la vedere.
   */
  cedat: string | null
  /** câte randări au fost (cel mult două: prima, și una după ce s-a strâns foaia) */
  randari: number
  /**
   * ce NU oprește compunerea, dar trebuie spus la vedere: programul e PROPUS (nevalidat), sau o
   * parte a numărului e text de probă. Se scriu la începutul răspunsului, nu la coadă.
   */
  atentie: string[]
  /** numărul așa cum s-a compus — cu umplerea de probă, unde omul n-a scris */
  cerut: NumarCerut
}

export interface OptiuniCompunere {
  cerut: NumarCerut
  /** pozele, ca data-URI: `p` cea mare, `s1`/`s2` cele mici */
  poze?: Record<string, string>
  /** fără calendar, pentru o probă rapidă */
  faraCalendar?: boolean
  /** compune chiar dacă socoteala se plânge — pentru previzualizare, niciodată pentru tipar */
  chiarDacaNuIncape?: boolean
  /** numai HTML-ul, fără browser (probele și previzualizarea în pagină) */
  doarHtml?: boolean
}

/**
 * Plângerile de formă — ce nu se poate compune deloc.
 *
 * ⚠️ Un articol GOL nu mai e plângere (user, 17.09.2026, seara): autorul, titlul, textul și sursa
 * lipsă se umplu cu text de probă, la vedere (`umplere.ts`). Rămân plângeri doar numărul, data și
 * mai mult de doi secundari — la ele nu există „de probă".
 */
export function plangeriDeForma(cerut: NumarCerut): string[] {
  const p: string[] = []
  if ((cerut.secundari ?? []).length > SECUNDARI_MAXIM) p.push(`cel mult ${SECUNDARI_MAXIM} articole secundare`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cerut.data ?? '')) p.push('data se scrie AAAA-LL-ZZ')
  if (!Number.isInteger(cerut.nr) || cerut.nr <= 0) p.push('numărul e un întreg pozitiv')
  return p
}

/** Ce se spune la vedere despre un calendar propus — aceleași cuvinte în pagină și în API. */
export const atentiePropus = (c: Pick<Calendar, 'titlu'>): string =>
  `PROPUS — programul săptămânii ${c.titlu} nu e validat: s-a folosit ce era disponibil (propunerea). ` +
  'Validează-l în aplicația Programul înainte de tipar.'

export async function compune(env: EnvCompunere, o: OptiuniCompunere): Promise<Compus> {
  const deForma = plangeriDeForma(o.cerut)

  /*
   * ÎNTÂI CALENDARUL ÎNTREG (treapta 0), fiindcă pe el se face UMPLEREA DE PROBĂ: ce n-a scris omul
   * se umple cu text de probă cât încape „cu programul complet, nu micșorat" (user, 17.09.2026).
   * Strângerea calendarului e numai pentru text ADEVĂRAT prea lung, nu pentru probă.
   */
  let c0: Calendar | null = null
  let eroareCalendar: string | null = null
  if (!o.faraCalendar) {
    const r = await calendarulNumarului(env, o.cerut.data, 0)
    if ('eroare' in r) eroareCalendar = `calendarul: ${r.eroare}`
    else c0 = r
  }
  const { cerut, deProba } = umpleCuProba(o.cerut, c0 ? { slujbe: c0.slujbe, detalii: c0.detalii } : undefined)

  /*
   * Calendarele, unul pe treaptă, cerute cel mult o dată. Sunt IEFTINE (legătură de serviciu, D1,
   * milisecunde) — spre deosebire de randare, care ține un minut. De aceea aritmetica de mai jos
   * are voie să le ceară pe toate ca să afle cât eliberează fiecare treaptă.
   */
  const stiute = new Map<Strans, Calendar | null>([[0, c0]])
  const potStrange = !o.faraCalendar && !eroareCalendar
  const calendarul = async (strans: Strans): Promise<Calendar | null> => {
    if (!potStrange) return null
    if (stiute.has(strans)) return stiute.get(strans) ?? null
    const r = await calendarulNumarului(env, cerut.data, strans)
    // ⚠️ O treaptă care nu vine NU strică numărul: rămâne cea de dinainte, doar că nu se poate ceda
    // atât. Un `eroareCalendar` pus aici ar refuza o foaie care se compunea foarte bine cu treapta 0.
    stiute.set(strans, 'eroare' in r ? null : r)
    return stiute.get(strans) ?? null
  }
  const socotealaCedarii = (c: Calendar | null, cedare: Cedare): Socoteala =>
    socoteste({
      ...cerut,
      floare: !!cerut.floare && cedare.floare,
      calendar: c ? { slujbe: c.slujbe, detalii: c.detalii } : undefined,
    })

  /*
   * FOAIA SE STRÂNGE TREAPTĂ CU TREAPTĂ, numai cât e nevoie (user, 17.09.2026, apoi 19.09.2026):
   * întâi întreagă; dacă textul nu încape, cade FLOAREA; pe urmă sfinții duminicii din calendar;
   * „în extremis", și pericopa. Se oprește la prima treaptă la care socoteala tace. Dacă nici la
   * ultima nu încape, vina e a textului — și se răspunde cu cifrele de acolo, ca omul să știe cât
   * să taie.
   */
  let nivel = 0
  let calendar: Calendar | null = null
  let socoteala: Socoteala | null = null
  let plangeri: string[] = []
  const trepte = potStrange ? CEDARILE : [CEDARILE[0]!]
  for (let i = 0; i < trepte.length; i++) {
    const c = await calendarul(trepte[i]!.strans)
    /*
     * ⚠️ O TREAPTĂ AL CĂREI TABEL N-A VENIT SE SARE, nu se socotește. Socotită cu `calendar:
     * undefined` ar părea că s-a eliberat o pagină întreagă — socoteala ar tăcea, iar foaia ar ieși
     * cu pagina a patra FĂRĂ PROGRAM, adică fix lucrul pentru care se tipărește. Treapta 0 e mereu
     * aici (altfel `potStrange` ar fi fals), deci rămâne ultima așezare bună.
     */
    if (potStrange && !c) break
    const s = socotealaCedarii(c, trepte[i]!)
    nivel = i
    calendar = c
    socoteala = s
    plangeri = [...deForma, ...(eroareCalendar ? [eroareCalendar] : []), ...s.plangeri]
    if (eroareCalendar || s.incape) break
  }
  if (!socoteala) throw new Error('socoteala n-a rulat')
  if (calendar && calendar.strans > 0) {
    plangeri = plangeri.filter((p) => !p.startsWith('calendarul singur'))
  }

  // ce se spune LA ÎNCEPUT, chiar dacă numărul iese: programul propus, textul de probă, ce s-a cedat
  const atentiaFoii = (): string[] => {
    const a: string[] = []
    if (calendar?.stare === 'propus') a.push(atentiePropus(calendar))
    if (deProba.length) a.push(`text de probă la: ${deProba.join('; ')}`)
    const cedat = vorbaCedarii(CEDARILE[nivel]!)
    if (cedat) a.push(`ca să încapă textul, foaia s-a strâns: ${cedat}.`)
    return a
  }

  if (plangeri.length && !o.chiarDacaNuIncape) {
    return { ok: false, socoteala, calendar, plangeri, atentie: atentiaFoii(), cerut, cedat: vorbaCedarii(CEDARILE[nivel]!), randari: 0 }
  }

  const foaia = (c: Calendar | null, s: Socoteala): string =>
    foaieHtml({
      cerut,
      poze: o.poze,
      calendar: c ? { tabel: c.tabel, stil: c.stil } : null,
      floare: s.floare,
      dataScrisa: dataLunga(cerut.data),
    })

  if (o.doarHtml) {
    return {
      ok: plangeri.length === 0, socoteala, calendar, plangeri, atentie: atentiaFoii(), cerut,
      cedat: vorbaCedarii(CEDARILE[nivel]!), randari: 0, cheie: undefined, pdf: undefined, raport: undefined,
    }
  }

  let randari = 0
  let { pdf, raport, coperta } = await randeaza(env, foaia(calendar, socoteala))
  randari++

  /*
   * ⚠️ CURGEREA SPUNE ADEVĂRUL, ȘI EA ARE DREPTUL SĂ CEARĂ O CEDARE (19.09.2026). Până aici,
   * treptele se încercau DOAR din socoteală: când socoteala zicea „încape" iar randarea găsea text
   * pe dinafară, numărul era refuzat pe loc, cu floarea și cu sfinții încă pe foaie — deși userul
   * ceruse ca ei să cadă ÎNAINTE de refuz. De aceea deficitul randării intră acum în aceeași
   * scară, o singură dată: se alege prin aritmetică treapta care-l acoperă, se randează încă o
   * dată, și abia dacă nici atunci nu încape se refuză, cu cifra NOUĂ.
   */
  if (raport && raport.peDinafara > 0 && potStrange && !o.chiarDacaNuIncape) {
    const elibereaza: number[] = []
    for (let i = 0; i < CEDARILE.length; i++) {
      if (i <= nivel) { elibereaza.push(0); continue }
      const c = await calendarul(CEDARILE[i]!.strans)
      // tabelul care n-a venit nu eliberează nimic — vezi mai sus de ce nu se socotește fără el
      elibereaza.push(c ? Math.max(0, socotealaCedarii(c, CEDARILE[i]!).semneCuTot - socoteala.semneCuTot) : 0)
    }
    const ales = cedareaDeIncercat({ dela: nivel, peDinafara: raport.peDinafara, elibereaza })
    if (ales !== null) {
      const c = await calendarul(CEDARILE[ales]!.strans)
      const s = socotealaCedarii(c, CEDARILE[ales]!)
      nivel = ales
      calendar = c
      socoteala = s
      ;({ pdf, raport, coperta } = await randeaza(env, foaia(c, s)))
      randari++
    }
  }

  const cedat = vorbaCedarii(CEDARILE[nivel]!)
  if (raport && raport.peDinafara > 0) {
    plangeri.push(
      `la randare au rămas ${raport.peDinafara} de semne pe dinafară — socoteala zicea că încap, ` +
      `dar hârtia zice altfel; scurtează cu cel puțin atât` +
      (cedat ? ` (foaia s-a strâns deja: ${cedat})` : ''),
    )
  }

  return {
    ok: plangeri.length === 0,
    socoteala,
    raport,
    pdf,
    coperta,
    calendar,
    plangeri,
    atentie: atentiaFoii(),
    cerut,
    cedat,
    randari,
    cheie: cheiaNumarului(cerut),
  }
}

/** Cheia din depozit: aceeași formă ca la numerele venite din V1. */
export const cheiaNumarului = (cerut: Pick<NumarCerut, 'nr' | 'data'>): string =>
  `${cerut.data.slice(0, 4)}/buletin-${cerut.nr}-${cerut.data}.pdf`

/**
 * Cheia COPERTEI — pagina întâi ca poză, sub același nume ca la numerele aduse din V1
 * (`2026/buletin-613-2026-08-09.jpg`), ca arhiva să nu aibă două feluri de nume.
 *
 * ⚠️ Una singură, nu două: în V1 erau `…jpg` (1400) și `…-mic.jpg` (460), tăiate la import cu o
 * unealtă care nu există în Worker. Aici poza iese din aceeași sesiune de browser ca PDF-ul, la o
 * singură măsură (~1590 px), iar rândul din arhivă o pune în amândouă coloanele. Raftul o arată mai
 * mică decât e — un fișier ceva mai greu la un număr pe săptămână, nu la toate cele 619.
 */
export const cheiaCopertei = (cerut: Pick<NumarCerut, 'nr' | 'data'>): string =>
  `${cerut.data.slice(0, 4)}/buletin-${cerut.nr}-${cerut.data}.jpg`

/**
 * CEREREA PĂSTRATĂ LÂNGĂ PDF — numărul ca date (motto, articole), nu doar ca foaie.
 *
 * De ce: numerele vechi sunt fișiere, iar din ele nu se mai poate lua nimic ca atare. Ce se compune
 * de aici înainte se păstrează și ca JSON, sub `compus/`, ca următorul număr să pornească de la el
 * (motto-ul „de la numărul trecut", user 17.09.2026) și ca „un AI simplu care înlocuiește un text"
 * să aibă ce înlocui. Se păstrează CE A SCRIS OMUL, nu umplerea de probă — aceea se reface oricând.
 */
export const cheiaCererii = (cerut: Pick<NumarCerut, 'nr' | 'data'>): string =>
  `compus/${cerut.data.slice(0, 4)}/buletin-${cerut.nr}-${cerut.data}.json`

/**
 * ȘTERGE CIORNA — RESETARE COMPLET LA ZERO (user, 20.09.2026: „dar să am posibilitatea să șterg
 * ciorna — resetare complet la zero — și atunci reapare posibilitatea de a invalida acel număr").
 *
 * Iese TOT ce ține de numărul în lucru: schița (răspunsurile din chat), foaia compusă, coperta,
 * cererea păstrată de sub `compus/` și cele patru broșuri de tipar. După ea, `/nou` se deschide pe o
 * masă goală — iar pe numărul curent reapare „Retrage", fiindcă nu mai e nicio ciornă începută care
 * s-ar putea pierde.
 *
 * ⚠️ NU SE ATINGE NIMIC AL UNUI NUMĂR APĂRUT. Chemătorul dă `eInArhiva`, care întreabă BAZA dacă
 * există un rând (nr, data). Dacă există, nu e ciornă — e un număr al parohiei — și nu se șterge
 * nimic. Cheia se cântărește întreagă, nu doar numărul: arhiva parohiei are cifre filate de două
 * ori, cu zile deosebite.
 * ⚠️ `schita/arhiva/…` RĂMÂNE NEATINS: acolo stă schița numerelor DEJA publicate, singurul drum prin
 * care retragerea le aduce înapoi întregi, cu adresele pozelor cu tot.
 * ⚠️ POZELE URCATE (`poze/<nr>-<data>/…`) NU SE ȘTERG. Ele sunt fișierele OMULUI, urcate de el în
 * bulă; dacă le-ar lua resetarea, „o iau de la capăt" ar fi însemnat și „urcă pozele din nou",
 * ceea ce nu s-a cerut.
 */
export async function stergeCiornaIntreaga(
  env: { FISIERE: R2Bucket },
  n: { nr: number; data: string },
  eInArhiva: boolean,
): Promise<{ sters: boolean; motiv?: string }> {
  if (eInArhiva) {
    return { sters: false, motiv: 'numărul are deja rând în arhivă — nu e ciornă, deci nu se șterge de aici' }
  }
  const foaia = cheiaNumarului(n)
  await env.FISIERE.delete([
    cheiaSchitei(n),
    foaia,
    cheiaCopertei(n),
    cheiaCererii(n),
    cheiaBrosurii(foaia, 'a4', false),
    cheiaBrosurii(foaia, 'a4', true),
    cheiaBrosurii(foaia, 'a3', false),
    cheiaBrosurii(foaia, 'a3', true),
  ]).catch(() => undefined)
  return { sters: true }
}

/**
 * CIORNA din depozit — numărul compus, dar încă nevalidat: în bază nu e niciun rând, iar fișierele
 * stau deja sub cheile lui știute. Se întoarce în forma unui rând de arhivă, ca paginile, broșura și
 * validarea să nu aibă nevoie de trei drumuri deosebite. `null` dacă n-a fost compus.
 *
 * ⚠️ A stat în `index.ts` până pe 20.09.2026, când validarea a urcat în `actiuni.ts` (odată cu
 * programarea). Locul ei e aici, lângă cheile din care se face: `cheiaNumarului`, `cheiaCopertei`.
 * ⚠️ `sursa: 'ciorna'` nu e o sursă din bază — e semnul că rândul n-a ieșit din bază. Cine cerne
 * după `sursa === 'site'` (retragerea) nu se încurcă în el.
 */
export async function ciornaDinDepozit(
  env: { FISIERE: R2Bucket },
  nr: number,
  data: string,
  pagini: number,
): Promise<Buletin | null> {
  const cheie = cheiaNumarului({ nr, data })
  const foaia = await env.FISIERE.head(cheie)
  if (!foaia) return null
  const coperta = await env.FISIERE.head(cheiaCopertei({ nr, data }))
  return {
    nr,
    data,
    an: data.slice(0, 4),
    luna: data.slice(5, 7),
    cheie_pdf: cheie,
    cheie_poza: coperta ? coperta.key : null,
    cheie_poza_mica: coperta ? coperta.key : null,
    marime_pdf: foaia.size,
    pagini,
    sursa: 'ciorna',
    publicat_la: null,
  }
}

/** Ce rămâne în depozit după o compunere, gata de pus în pagină. */
export interface NumarulPus {
  cheie: string
  /** Coperta, dacă randarea a dat una; `null` înseamnă că numărul n-are poză ACUM. */
  cheiePoza: string | null
  /** Amprenta randării, pentru `?v=`: desparte foaia de acum de cea dinainte în cache-ul browserului. */
  versiune: string
  marime: number
}

/**
 * AMPRENTA FOII, pentru `?v=` — etag-ul PDF-ului ȘI amprenta programului tipărit în el.
 *
 * Etag-ul R2 e suma de control a fișierului, deci se schimbă oricum la orice randare. Amprenta
 * programului intră totuși în adresă dinadins: ea face schimbarea VIZIBILĂ în legătură (`?v=` sare
 * în ochi când se compară două foi) și leagă adresa de întrebarea care a pornit toată treaba —
 * „e programul din foaia asta cel de acum?". Fără niciuna din ele rămâne ceasul, ca adresa să nu
 * iasă goală.
 */
export const amprentaFoii = (etag: string | null | undefined, amprentaProgramului?: string | null): string =>
  [(etag ?? '').replace(/[^\w-]/g, ''), (amprentaProgramului ?? '').replace(/[^\w-]/g, '').slice(0, 10)]
    .filter(Boolean)
    .join('-') || String(Date.now())

/**
 * TOT CE SE ÎNTÂMPLĂ DUPĂ O RANDARE REUȘITĂ, într-un singur loc.
 *
 * ⚠️ SCRIS AICI FIINDCĂ ERA ÎN DOUĂ (18.09.2026, pățit): ruta formularului punea PDF-ul, coperta,
 * cererea și arunca broșurile vechi; acțiunea `buletin.compune` — cea prin care lucrează CHATUL —
 * punea numai PDF-ul. Deci un număr compus din bulă se recompunea pe tăcute: pagina arăta coperta
 * dinainte (ori niciuna), iar „Tipărește" dădea broșura foii vechi. Nimic nu dădea vreo eroare.
 * De acum, amândouă drumurile trec pe aici.
 *
 * ⚠️ Coperta se ȘTERGE când randarea n-a dat una: o poză veche lăsată sub aceeași cheie ar arăta un
 * număr care nu mai există.
 */
export async function pastreazaNumarul(
  env: Pick<EnvCompunere, 'FISIERE'>,
  o: {
    /** Ce a scris omul — se păstrează ca date, fără umplerea de probă. */
    cerut: NumarCerut
    /** Numărul așa cum a intrat pe hârtie (cu umplerea), pentru numărătoarea semnelor. */
    peHartie?: NumarCerut
    pdf: ArrayBuffer
    coperta?: ArrayBuffer | null
    /** Programul care a intrat pe pagina a patra — se păstrează lângă cerere, pentru `/nou`. */
    program?: ProgramulFolosit
  },
  ctxExec?: Pick<ExecutionContext, 'waitUntil'>,
): Promise<NumarulPus> {
  const cheie = cheiaNumarului(o.cerut)
  const pus = await env.FISIERE.put(cheie, o.pdf, {
    httpMetadata: { contentType: 'application/pdf' },
    customMetadata: {
      nr: String(o.cerut.nr),
      data: o.cerut.data,
      semne: String(semne(textCurat(o.peHartie ?? o.cerut))),
    },
  })

  // Coperta, din ACEEAȘI randare: ea se vede pe ecran înainte de validare și merge mai departe în
  // arhivă, la validare (fără ea, rândul ar rămâne cu locul pozei desenat).
  const cheiePoza = cheiaCopertei(o.cerut)
  if (o.coperta) {
    await env.FISIERE.put(cheiePoza, o.coperta, { httpMetadata: { contentType: 'image/jpeg' } })
  } else {
    await env.FISIERE.delete(cheiePoza).catch(() => undefined)
  }

  // Cererea, ca date, lângă PDF: de aici pornește numărul următor (motto-ul), de aici se umple
  // ecranul `/nou` după reîncărcare și de aici se află cu ce PROGRAM s-a tipărit foaia asta.
  await pastreazaCererea(env, o.cerut, o.program)

  /*
   * ⚠️ BROȘURILE VECHI ALE NUMĂRULUI SE ARUNCĂ. Se țin în depozit sub o cheie scoasă din cheia
   * PDF-ului, iar la recompunere PDF-ul se schimbă sub același nume: fără ștergerea asta,
   * „Tipărește" ar da mai departe broșura foii dinainte, așezată din pagini vechi.
   */
  const brosurile = env.FISIERE.delete([
    cheiaBrosurii(cheie, 'a4', false), cheiaBrosurii(cheie, 'a4', true),
    cheiaBrosurii(cheie, 'a3', false), cheiaBrosurii(cheie, 'a3', true),
  ]).catch(() => undefined)
  if (ctxExec) ctxExec.waitUntil(brosurile)
  else await brosurile

  return {
    cheie,
    cheiePoza: o.coperta ? cheiePoza : null,
    versiune: amprentaFoii(pus?.httpEtag, o.program?.amprenta),
    marime: o.pdf.byteLength,
  }
}

export async function pastreazaCererea(
  env: Pick<EnvCompunere, 'FISIERE'>,
  cerut: NumarCerut,
  program?: ProgramulFolosit,
): Promise<string> {
  const cheie = cheiaCererii(cerut)
  const deScris: CerereaPastrata = program ? { ...cerut, program } : { ...cerut }
  await env.FISIERE.put(cheie, JSON.stringify(deScris), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: { nr: String(cerut.nr), data: cerut.data },
  })
  return cheie
}

/** Cererea păstrată a unui număr; `null` dacă n-a fost compus aici (numerele aduse din V1). */
export async function citesteCererea(
  env: Pick<EnvCompunere, 'FISIERE'>,
  n: Pick<NumarCerut, 'nr' | 'data'>,
): Promise<CerereaPastrata | null> {
  const obiect = await env.FISIERE.get(cheiaCererii(n))
  if (!obiect) return null
  return await obiect.json<CerereaPastrata>().catch(() => null)
}

/**
 * MOTTO-UL NUMĂRULUI TRECUT, cu care se precompletează numărul nou (user, 17.09.2026: „Motto —
 * trebuie să fie precompletat motto-ul trecut, de la numărul trecut").
 *
 * Două izvoare, în ordinea asta: (1) cel mai nou număr COMPUS aici, a cărui cerere e păstrată sub
 * `compus/` — dacă e cel puțin la fel de nou ca arhiva; (2) altfel textul scos din PDF-ul celui
 * mai nou număr din arhivă, unde motto-ul stă între parohie și pastilă (`mottoDinText`). Dacă
 * niciunul nu dă nimic, `null`: câmpul rămâne gol, nu se inventează un citat.
 */
export async function mottoDinainte(
  env: { FISIERE: R2Bucket; DB: D1Database },
  curent: { nr: number; data: string } | null,
): Promise<{ motto: string; motoAutor?: string } | null> {
  const lista = await env.FISIERE.list({ prefix: 'compus/' })
  const compuse = lista.objects
    .map((o) => ({ cheie: o.key, m: /buletin-(\d+)-(\d{4}-\d{2}-\d{2})\.json$/.exec(o.key) }))
    .filter((x): x is { cheie: string; m: RegExpExecArray } => !!x.m)
    .map((x) => ({ cheie: x.cheie, nr: Number(x.m[1]), data: x.m[2]! }))
    .sort((a, b) => (a.data === b.data ? b.nr - a.nr : a.data < b.data ? 1 : -1))
  const celMaiNou = compuse[0]
  if (celMaiNou && (!curent || celMaiNou.data >= curent.data)) {
    const obiect = await env.FISIERE.get(celMaiNou.cheie)
    const c = obiect ? await obiect.json<Partial<NumarCerut>>().catch(() => null) : null
    if (c?.motto?.trim()) return { motto: c.motto.trim(), motoAutor: c.motoAutor?.trim() || undefined }
  }
  if (!curent) return null
  return mottoDinText(await capulTextului(env.DB, curent.nr, curent.data))
}

/**
 * Randarea, cu raportul curgerii.
 *
 * ⚠️ Browser Rendering așteaptă `data-potrivit` înainte să tipărească — marcajul `data-potrivire`
 * din foaie e semnul după care `@xc/ui` știe să aștepte, iar scriptul foii îl ridică după ce a
 * terminat de curs. Fără el s-ar tipări pagina goală, înainte ca textul să fi ajuns în coloane.
 */
async function randeaza(env: EnvCompunere, html: string): Promise<{ pdf: ArrayBuffer; raport?: Compus['raport']; coperta?: ArrayBuffer }> {
  return await pdfCuRaportSiCoperta<Compus['raport']>(env.BROWSER, html)
}

/** Textul numărului, pentru căutarea din arhivă. */
export { textCurat, semne }
