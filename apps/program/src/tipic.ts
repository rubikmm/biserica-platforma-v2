/**
 * Ce cere programul de la tipic (A9): pomenirile zilei, GRUPATE PE CARTI, pentru foaia
 * „Sfinții zilei". Nu se tine nimic din ele aici — cartile sunt ale tipicului.
 *
 * Ordinea de pe foaie, ceruta de user (11.09.2026): „Calendarul și apoi Mineiul și Tipicul, doar
 * sfinți care nu au fost menționați mai sus". Deci calendarul deschide lista, iar din fiecare
 * carte de dedesubt se taie ce s-a spus deja.
 *
 * De ce merita: Mineiul trece toata ceata zilei si adauga cinci pana la zece nume (masurat pe
 * patru duminici); in schimb n-are sfintii romani canonizati dupa editie — Ioan de la Prislop,
 * Antim Ivireanul, Dumitru Staniloae sunt numai in calendar. Anuarul, verificat pe tot anul 2026,
 * adauga UN SINGUR nume (Sf. Mc. Lup din Tesalonic, 27 octombrie): titlul lui e practic titlul
 * calendarului oficial, amandoua de la aceeasi editura.
 */

export interface PomenireMinei {
  nume: string
  pomenire: string
  stih: string[]
  viata: string
}

export interface SursaSfinti {
  cod: string
  /** Numele cartii, gata de scris pe foaie: volumul, editia si creditul culegatorului. */
  carte: string
  pomeniri: PomenireMinei[]
}

interface RaspunsSurse {
  surse?: Array<{
    cod?: string
    titlu?: string
    pomeniri?: PomenireMinei[]
    carte?: { sursa?: string; editura?: string; credit?: string } | null
  }>
}

/** Volumul si anul editiei, apoi creditul — conditia sursei la lunile luate de pe sit. */
function numeleCartii(c: NonNullable<RaspunsSurse['surse']>[number]['carte']): string {
  if (!c?.sursa) return ''
  const an = c.editura?.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? ''
  const cap = an && !c.sursa.includes(an) ? `${c.sursa}, ${an}` : c.sursa
  return c.credit ? `${cap} · ${c.credit}` : cap
}

/**
 * Pomenirile zilei, pe carti; lista goala daca tipicul tace. Foaia merge si fara ele — atunci
 * ramane doar lista calendarului, fara capete de grup.
 */
export async function sfintiiDinCarti(tipic: Fetcher, data: string): Promise<SursaSfinti[]> {
  try {
    const r = await tipic.fetch(`https://tipic.intern/v1/sfinti/${data}`)
    if (!r.ok) return []
    const j = (await r.json()) as RaspunsSurse
    return (j.surse ?? [])
      .filter((s) => (s.pomeniri ?? []).length > 0)
      .map((s) => ({ cod: s.cod ?? '', carte: numeleCartii(s.carte), pomeniri: s.pomeniri ?? [] }))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// „Doar sfinți care nu au fost menționați mai sus" (user, 11.09.2026)
// ---------------------------------------------------------------------------

/**
 * Titlurile si vorbele de legatura: tot ce NU e numele cuiva. Se scot inainte de potrivire, ca sa
 * ramana numai numele proprii — altfel „Sfantul Mucenic" ar potrivi orice mucenic cu oricare altul.
 * Numele dumnezeiesti intra si ele aici: nu deosebesc o pomenire de alta.
 */
const TITLURI = new Set([
  'sf', 'sfantul', 'sfanta', 'sfantului', 'sfintei', 'sfintii', 'sfintilor', 'sfinte', 'sfinti',
  'sfintit', 'sfintitul', 'sfintitului', 'sfintita', 'sfintiti', 'preasfantul', 'preasfanta',
  'mc', 'mucenic', 'mucenicul', 'mucenici', 'mucenicii', 'mucenicilor', 'mucenita', 'mucenitei',
  'mucenite', 'martir', 'martirul', 'marele', 'marelui', 'mare', 'mari', 'noul', 'nou', 'noua',
  'cuv', 'cuvios', 'cuviosul', 'cuviosii', 'cuvioasa', 'cuvioasei', 'preacuvios', 'preacuviosul',
  'ier', 'ierarh', 'ierarhul', 'ierarhi', 'ierarhii', 'apostol', 'apostolul', 'apostoli', 'apostolii',
  'episcop', 'episcopul', 'episcopului', 'episcopii', 'arhiepiscop', 'arhiepiscopul', 'arhiepiscopii',
  'mitropolit', 'mitropolitul', 'patriarh', 'patriarhul', 'preot', 'preotul', 'diacon', 'diaconul',
  'diaconii', 'arhid', 'arhidiacon', 'arhidiaconul', 'egumen', 'egumenul', 'staret', 'staretul',
  'parintele', 'parintii', 'parintelui', 'parinti', 'fericitul', 'fericita', 'binecredinciosul',
  'drept', 'dreptul', 'dreptii', 'imparat', 'imparatul', 'imparati', 'imparateasa',
  'marturisitor', 'marturisitorul', 'marturisitori', 'evanghelist', 'evanghelistul', 'proroc', 'prorocul',
  'pomenirea', 'pomenire', 'pomenirii', 'praznuirea', 'praznic', 'praznicului',
  'adormirea', 'nasterea', 'aducerea', 'aflarea', 'punerea', 'taierea', 'odovania', 'moastelor',
  'domnului', 'domnul', 'dumnezeu', 'dumnezeul', 'dumnezeului', 'dumnezeiescului', 'dumnezeiesti',
  'hristos', 'hristoase', 'iisus', 'mantuitorului', 'maicii', 'fecioara', 'nascatoarei', 'duhului',
  'celui', 'cel', 'cea', 'cei', 'cele', 'celor', 'dintru', 'intre', 'nostru', 'nostri', 'noastre',
  'care', 'ce', 'din', 'de', 'la', 'si', 'in', 'intru', 'cu', 'lui', 'lor', 'ei', 'sa', 'sau',
  'tot', 'toti', 'aceasta', 'acesta', 'zi', 'ziua', 'luna', 'anul', 'pace', 'savarsit', 'impreuna',
])

/** Litere fara diacritice, fara semne, litere mici. */
function normal(cuvant: string): string {
  const fara = cuvant.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return fara.replace(/[^a-zA-Z]/g, '').toLowerCase()
}

/**
 * Numele proprii dintr-un rand: cuvintele scrise cu litera MARE, fara titluri. Litera mare e
 * semnul dupa care se cunoaste numele si in calendar („Sf. Mc. Corneliu Sutașul"), si in Minei
 * („pomenirea Sfântului Sfințitului Mucenic Cornelie sutașul") — restul e rang si legatura.
 */
function numeleDin(text: string): string[] {
  const gasite: string[] = []
  for (const cuvant of text.split(/[\s,;:()"„”]+/)) {
    if (!/^[A-ZĂÂÎȘȚ]/.test(cuvant)) continue
    const n = normal(cuvant)
    if (n.length < 3 || TITLURI.has(n)) continue
    gasite.push(n)
  }
  return gasite
}

/** Toate cuvintele unui rand, nu doar cele cu litera mare — pentru lista a ce s-a spus deja. */
function cuvinteleDin(text: string): string[] {
  return text
    .split(/[\s,;:()"„”]+/)
    .map(normal)
    .filter((n) => n.length >= 3 && !TITLURI.has(n))
}

/** Distanta de editare, oprita devreme: ne trebuie doar „sub prag sau nu". */
function distanta(a: string, b: string, prag: number): number {
  if (Math.abs(a.length - b.length) > prag) return prag + 1
  let rand = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const nou = [i]
    let minim = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      nou[j] = Math.min(nou[j - 1]! + 1, rand[j]! + 1, rand[j - 1]! + cost)
      minim = Math.min(minim, nou[j]!)
    }
    if (minim > prag) return prag + 1
    rand = nou
  }
  return rand[b.length]!
}

/**
 * Acelasi nume, scris de doua carti: „Cornelie"/„Corneliu", „Macrovie"/„Macrobie", „Ili"/„Ilie",
 * „Joachim"/„Ioachim". Prima litera trebuie sa fie aceeasi — fara ea, doua nume scurte si straine
 * ar trece drept unul —, cu o singura ingaduinta: I si J sunt aceeasi litera in numele vechi.
 */
function acelasiNume(a: string, b: string): boolean {
  if (a === b) return true
  const i = (c: string) => (c === 'j' ? 'i' : c)
  if (i(a[0]!) !== i(b[0]!)) return false
  const prag = a.length <= 6 ? 1 : 2
  return distanta(a, b, prag) <= prag
}

/**
 * Pomenirile pe care o carte le ADAUGA fata de ce s-a spus mai sus.
 *
 * Regula, aleasa ca sa greseasca mai degraba pastrand decat taind: o pomenire cade doar daca
 * TOATE numele proprii din ea au fost deja scrise. Cu un singur nume in plus, pomenirea ramane —
 * altfel s-ar pierde sfinti pe care lista de deasupra nu-i are. Pomenirea fara niciun nume propriu
 * („cei cincisprezece Mucenici care s-au înecat în mare") ramane si ea: nu se poate dovedi ca e o
 * repetare.
 */
export function pomeniriNoi(pomeniri: PomenireMinei[], spuseDeja: string[]): PomenireMinei[] {
  const cunoscute = spuseDeja.flatMap(cuvinteleDin)
  if (!cunoscute.length) return pomeniri
  return pomeniri.filter((p) => {
    // Randul fara niciun nume propriu („Sfânta și Marea Marți", „Odovania praznicului…") se
    // potriveste pe cuvintele lui de continut: altfel n-ar avea cu ce fi recunoscut ca repetare.
    const nume = numeleDin(p.nume)
    const de_potrivit = nume.length ? nume : cuvinteleDin(p.nume)
    if (!de_potrivit.length) return true
    return !de_potrivit.every((n) => cunoscute.some((c) => acelasiNume(n, c)))
  })
}
