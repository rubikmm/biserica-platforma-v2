/**
 * MĂSURILE FOII TIPĂRITE și SOCOTEALA LUNGIMII — cât text încape într-un număr.
 *
 * Buletinul parohiei e o foaie A4 de patru pagini, făcută până acum în Word. Numerele de aici nu
 * sunt alese de noi: **s-au măsurat pe arhivă** (numerele 610–615, cu `pdftotext -bbox-layout`),
 * iar `.tmp`-ul acelei măsurători e descris în NOTES.md. De aceea nu se rotunjesc „ca să fie
 * frumoase": 241.1 pt e lățimea coloanei din foaia parohiei, nu o alegere.
 *
 * ⚠️ DE CE E NEVOIE DE SOCOTEALĂ (cerere user, 17.09.2026: „trebuie calculată lungimea textului
 * care intră în toate variantele"): cel care scrie numărul — om sau model de limbaj — trebuie să
 * știe ÎNAINTE cât text să pregătească. Un articol cu 2 000 de semne peste măsură nu se poate
 * îndrepta la tipar: ori se taie, ori se strică pagina. Aici se răspunde la întrebarea „câte semne
 * am voie", iar `compune` se plânge cu aceleași cifre dacă s-a trecut peste.
 *
 * ⚠️ SOCOTEALA E ARITMETICĂ, NU RANDARE. Nu cheamă browserul: un model care întreabă „cât scriu?"
 * trebuie să primească răspunsul în milisecunde, nu în cinci secunde. Adevărul la milimetru îl dă
 * tot randarea (curgerea din `foaie.ts` numără ce a intrat cu adevărat și raportează), dar
 * socoteala stă pe măsurători reale, deci greșește puțin și în siguranță.
 */

// ---------------------------------------------------------------------------
// Măsurile hârtiei, în puncte tipografice (1 pt = 1/72")
// ---------------------------------------------------------------------------

/** A4, cum o scrie Word-ul parohiei. */
export const PAGINA = { latime: 595.32, inaltime: 841.92 } as const

/** Cele patru pagini ale foii — numărul nu se schimbă: broșura se pliază din patru. */
export const PAGINI = 4

/** Două coloane pe fiecare pagină, deci opt cutii de text într-un număr. */
export const COLOANE_PE_PAGINA = 2

export const BANDA = {
  /** marginea din stânga până la prima coloană */
  stanga: 42.6,
  /** lățimea unei coloane (măsurată: 240.93–241.22 pe 24 de coloane) */
  coloana: 241.1,
  /** șanțul dintre coloane */
  sant: 21.12,
  /** primul rând de text începe aici (vârful cutiei lui) */
  sus: 47,
  /** ultimul rând de text se termină aici — banda ține un număr ÎNTREG de rânduri */
  jos: 792.2,
} as const

/**
 * Corpul de literă al textului curent: Cambria ~15 pt în Word-ul parohiei, Caladea la noi
 * (metric-compatibil cu Cambria).
 *
 * ⚠️ 15, nu 12. Înălțimea rândului (16.5 pt) ademenește spre „12 pt cu interlinie 1.38" — și
 * foaia iese atunci cu 45 de semne pe rând în loc de 37, adică un număr întreg de text în plus
 * față de ce încape cu adevărat. Mărimea s-a citit din PDF-ul numărului 615 (`pdftohtml -xml`:
 * 23 px la scara 1.5) și s-a probat numărând semnele pe randare, nu ghicind din interlinie.
 */
export const CORP_TEXT = 15

/** Înălțimea unui rând de text — măsurată 16.5–16.56 pe arhivă, deci interlinie 1.104. */
export const RAND = 16.56

/**
 * Câte semne intră pe un rând PLIN de coloană.
 *
 * ⚠️ Nu e „lățimea coloanei împărțită la lățimea literei": textul e justificat, deci spațiile se
 * lărgesc și rândul poartă mai puține semne decât ar încăpea înghesuit. Media măsurată pe 915 de
 * rânduri pline din numerele 610–615: **36.67** (mediana 37, între 22 și 49 după cuvinte).
 * Media e cea bună pentru o socoteală pe sute de rânduri.
 */
export const SEMNE_PE_RAND = 36.67

/** Câte rânduri de text încap într-o coloană întreagă, fără nimic deasupra sau dedesubt. */
export const RANDURI_PE_COLOANA = Math.floor((BANDA.jos - BANDA.sus) / RAND)

// ---------------------------------------------------------------------------
// Blocurile care nu sunt text curent — ce mănâncă din coloană
// ---------------------------------------------------------------------------

/**
 * Înălțimile, în RÂNDURI de text, ale pieselor fixe. Se socotesc în rânduri (nu în puncte) fiindcă
 * întrebarea la care răspundem e „câte rânduri mi-au mai rămas", iar rândul e moneda paginii.
 */
export const INALTIMI = {
  /** antetul paginii întâi: crucea + „BULETINUL PAROHIEI" + parohia */
  antet: 6.4,
  /** motto-ul, pe două rânduri de cursive, cu numele celui citat dedesubt */
  motto: 3.6,
  /** linia cu pastila „Nr. 615 / 6 septembrie 2026" */
  numar: 3.2,
  /** poza mare a articolului principal: o coloană întreagă pe înălțime de 448 pt */
  pozaMare: 27,
  /** poza mică a unui articol secundar */
  pozaMica: 11,
  /** zona neagră cu numele autorului — trei rânduri de scris alb plus aerul din jur */
  zonaNeagra: 6,
  /** zona neagră a unui secundar, în coloană (nume pe cel mult două rânduri) */
  zonaNeagraMica: 4.6,
  /** titlul articolului, majuscule mari, de obicei pe două rânduri, cu linia de sub el */
  titlu: 4.4,
  /** rândul „Sursa: …", cu linia de deasupra */
  sursa: 2.4,
  /** capul „PROGRAMUL LITURGIC" de pe pagina a patra */
  titluCalendar: 2.6,
  /** floarea decorativă de deasupra calendarului — cade prima când nu e loc */
  floare: 2.2,
  /** subsolul fix al paginii a patra: abonarea și adresa parohiei */
  subsol: 2.6,
} as const

/**
 * Înălțimea calendarului, în rânduri de text, după cât are de spus săptămâna.
 *
 * Tabelul e cel al programului, randat „ca la tipar". Un rând de tabel (o slujbă) ține cât două
 * rânduri de text, iar fiecare detaliu de sub slujbă („→ Adormirea Maicii Domnului", pericopa)
 * încă vreo trei sferturi. Măsurat pe arhivă: o săptămână obișnuită, cu program în fiecare zi,
 * cere 16–19 rânduri; una cu trei slujbe, 7–8.
 */
export function inaltimeaCalendarului(o: { slujbe: number; detalii: number; zileFaraProgram?: number }): number {
  const slujbe = Math.max(0, o.slujbe)
  const detalii = Math.max(0, o.detalii)
  // 2.05 rânduri pentru rândul de tabel (numele slujbei e 18 pt), 0.78 pentru un detaliu de 13 pt,
  // 0.35 pentru banda gri care arată un șir rupt de zile, plus bordurile tabelului.
  return slujbe * 2.05 + detalii * 0.78 + Math.min(o.zileFaraProgram ?? 0, 3) * 0.35 + 0.8
}

// ---------------------------------------------------------------------------
// Ce se cere compus — forma pe care o înțeleg și socoteala, și compunerea
// ---------------------------------------------------------------------------

/** Un articol, așa cum îl dă cel care scrie numărul. */
export interface ArticolCerut {
  /** numele autorului sau al sfântului — scrisul alb din zona neagră */
  autor: string
  /** anii vieții, sub nume, dacă se știu: „1661-1729" */
  ani?: string
  /** ziua de pomenire, ultimul rând al zonei negre: „† 16 august" */
  pomenire?: string
  titlu: string
  text: string
  sursa?: string
  /** mențiunea de deasupra sursei: „Mesajul Patriarhului Daniel la proclamarea locală…" */
  nota?: string
  /** are poză? La principal e poza mare de pe pagina întâi; la secundar, una mică. */
  poza?: boolean
}

export interface NumarCerut {
  motto: string
  motoAutor?: string
  nr: number
  data: string
  principal: ArticolCerut
  /** cel mult doi (cerere user: „încă unul sau doi secundari maxim") */
  secundari?: ArticolCerut[]
  /** înălțimea calendarului de pe pagina a patra, în rânduri */
  calendar?: { slujbe: number; detalii: number; zileFaraProgram?: number }
  /** floarea de deasupra calendarului se pune dacă încape (cerere user: „ne putem lipsi de ea") */
  floare?: boolean
}

/** Numărul maxim de articole secundare — hotărât de user, nu de hârtie. */
export const SECUNDARI_MAXIM = 2

// ---------------------------------------------------------------------------
// Socoteala
// ---------------------------------------------------------------------------

export interface ZonaSocotita {
  /** „principal", „secundar 1", „secundar 2" */
  cine: string
  /** rânduri de text rămase pentru el */
  randuri: number
  /** câte semne încap, socotite din rânduri */
  semne: number
  /** câte semne are textul dat (0 dacă n-a fost dat niciunul) */
  scrise: number
  /** semne rămase (negativ = s-a trecut peste) */
  ramase: number
}

export interface Socoteala {
  /** rândurile de text din tot numărul, după ce s-au scăzut toate piesele fixe */
  randuriCuTot: number
  /** semnele care încap în tot numărul */
  semneCuTot: number
  /** cât s-a scris cu totul */
  scriseCuTot: number
  zone: ZonaSocotita[]
  /** floarea decorativă mai încape? */
  floare: boolean
  /** ce nu e în regulă, în cuvintele celui care scrie */
  plangeri: string[]
  incape: boolean
}

/** Semnele unui text, numărate cum le numără hârtia: fără spațiile de prisos. */
export const semne = (text: string): number => text.replace(/\s+/g, ' ').trim().length

/** Rândurile pe care le ține un text, la lățimea coloanei. */
export const randuriPentru = (semneText: number): number => Math.ceil(semneText / SEMNE_PE_RAND)

/**
 * Câte rânduri de text are un număr și cum se împart între articole.
 *
 * Mersul paginilor, măsurat pe arhivă:
 *   pagina 1, coloana 1 — poza mare și zona neagră a principalului; ce prisosește e text;
 *   pagina 1, coloana 2 — antetul, motto-ul și numărul mănâncă din capul PAGINII (nu al coloanei),
 *                         apoi vine titlul principalului și începe textul;
 *   paginile 2 și 3     — patru coloane pline;
 *   pagina 4            — două coloane scurtate de calendar, care stă pe toată lățimea, jos.
 *
 * ⚠️ Antetul, motto-ul și numărul taie din AMÂNDOUĂ coloanele paginii întâi, fiindcă stau peste
 * toată lățimea. Greșeala ușor de făcut e să le scazi doar din coloana a doua.
 */
export function socoteste(cerut: NumarCerut): Socoteala {
  const plangeri: string[] = []
  const secundari = cerut.secundari ?? []
  if (secundari.length > SECUNDARI_MAXIM) {
    plangeri.push(`un număr ține cel mult ${SECUNDARI_MAXIM} articole secundare, iar aici sunt ${secundari.length}`)
  }

  // --- pagina întâi -------------------------------------------------------
  const capulPaginii = INALTIMI.antet + INALTIMI.motto + INALTIMI.numar
  const inaltePagina1 = RANDURI_PE_COLOANA - capulPaginii
  /*
   * ⚠️ REGULA COLOANEI ÎNTÂI (user, 17.09.2026: „trebuie să fie doar imaginea și zona neagră pe
   * acea coloană — asta e regula generală"): coloana din stânga a paginii întâi nu primește text
   * NICIODATĂ. Poza umple tot ce rămâne deasupra zonei negre, iar fără poză locul ei rămâne gol,
   * desenat. Deci de acolo nu vine niciun rând de text — nici cu poză, nici fără.
   */
  const p1c1 = 0
  const p1c2 = inaltePagina1 - INALTIMI.titlu

  // --- paginile din mijloc ------------------------------------------------
  const mijloc = RANDURI_PE_COLOANA * COLOANE_PE_PAGINA * 2

  // --- pagina a patra -----------------------------------------------------
  const inaltimeCalendar = cerut.calendar ? inaltimeaCalendarului(cerut.calendar) : 0
  const subPagina4 = INALTIMI.titluCalendar + inaltimeCalendar + INALTIMI.subsol
  const floareIncape = !!cerut.floare && RANDURI_PE_COLOANA - subPagina4 - INALTIMI.floare > 6
  const p4 = (RANDURI_PE_COLOANA - subPagina4 - (floareIncape ? INALTIMI.floare : 0)) * COLOANE_PE_PAGINA
  if (p4 < 0) {
    plangeri.push('calendarul singur trece de pagina a patra; cere-i programului varianta strânsă')
  }

  const randuriDePagina = Math.max(0, p1c1) + Math.max(0, p1c2) + mijloc + Math.max(0, p4)

  // --- cât mănâncă capetele articolelor -----------------------------------
  // Principalul și-a plătit deja titlul și zona neagră mai sus; secundarii și le plătesc aici.
  const costSecundar = (a: ArticolCerut): number =>
    INALTIMI.zonaNeagraMica + INALTIMI.titlu + (a.poza ? INALTIMI.pozaMica : 0) + (a.sursa ? INALTIMI.sursa : 0)
  const costPrincipal = cerut.principal.sursa ? INALTIMI.sursa : 0
  const capete = costPrincipal + secundari.reduce((n, a) => n + costSecundar(a), 0)

  /*
   * ⚠️ Rândurile pe care le raportăm sunt cele rămase pentru TEXT, nu cele ale paginilor: capul
   * fiecărui articol (zona neagră, titlul, sursa, poza mică) mănâncă din ele. Altfel un număr cu
   * doi secundari ar raporta aceeași capacitate ca unul cu niciunul, deși pe hârtie s-au dus vreo
   * 500 de semne pe capete.
   */
  const deImpartit = Math.max(0, randuriDePagina - capete)

  /*
   * Împărțeala între articole: principalul ia ce rămâne după secundari, fiindcă el e cel care
   * poartă numărul. Un secundar primește o pătrime din foaie, dar nu mai mult decât cere.
   * ⚠️ Nu se împarte egal: în foaia parohiei principalul ține trei pagini, iar secundarul una.
   */
  const zone: ZonaSocotita[] = []
  let rest = deImpartit
  secundari.forEach((a, i) => {
    const scrise = semne(a.text)
    const cuvine = Math.min(rest, Math.max(randuriPentru(scrise), Math.floor(deImpartit / 4)))
    rest -= cuvine
    zone.push({
      cine: `secundar ${i + 1}`,
      randuri: cuvine,
      semne: Math.floor(cuvine * SEMNE_PE_RAND),
      scrise,
      ramase: Math.floor(cuvine * SEMNE_PE_RAND) - scrise,
    })
  })
  const scrisePrincipal = semne(cerut.principal.text)
  zone.unshift({
    cine: 'principal',
    randuri: rest,
    semne: Math.floor(rest * SEMNE_PE_RAND),
    scrise: scrisePrincipal,
    ramase: Math.floor(rest * SEMNE_PE_RAND) - scrisePrincipal,
  })

  for (const z of zone) {
    if (z.ramase < 0) plangeri.push(`${z.cine}: ${-z.ramase} de semne peste măsură (încap ${z.semne}, sunt ${z.scrise})`)
  }

  const semneCuTot = Math.floor(deImpartit * SEMNE_PE_RAND)
  const scriseCuTot = zone.reduce((n, z) => n + z.scrise, 0)

  return {
    randuriCuTot: Math.round(deImpartit * 10) / 10,
    semneCuTot,
    scriseCuTot,
    zone,
    floare: floareIncape,
    plangeri,
    incape: plangeri.length === 0,
  }
}

/**
 * Socoteala goală: câte semne încap în fiecare variantă, fără să fi scris încă nimic.
 * Asta se dă modelului de limbaj înainte să compună — „ai atâtea semne, scrie pe măsură".
 */
export function variante(calendar?: NumarCerut['calendar']): Array<{ varianta: string; semne: number; zone: Array<{ cine: string; semne: number }> }> {
  const gol = (poza: boolean): ArticolCerut => ({ autor: '', titlu: '', text: '', sursa: '-', poza })
  const feluri: Array<[string, number, boolean]> = [
    // principalul are mereu poza mare (sau locul ei gol) — coloana întâi e a ei, nu a textului
    ['un singur autor', 0, true],
    ['autor principal + 1 secundar', 1, true],
    ['autor principal + 2 secundari', 2, true],
  ]
  return feluri.map(([varianta, cati, poza]) => {
    const s = socoteste({
      motto: '', nr: 0, data: '2026-01-01', floare: true, calendar,
      principal: { ...gol(poza) },
      secundari: Array.from({ length: cati }, () => gol(true)),
    })
    return {
      varianta,
      semne: s.semneCuTot,
      zone: s.zone.map((z) => ({ cine: z.cine, semne: z.semne })),
    }
  })
}
