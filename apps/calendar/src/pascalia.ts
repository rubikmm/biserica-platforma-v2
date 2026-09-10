/**
 * Pascalia: tot ce se poate socoti mecanic despre un an — Pastele si zilele mobile, perioadele,
 * randuiala mesei, sambetele mortilor, numele si numarul duminicilor, glasul si voscreasna.
 *
 * Numai aritmetica: nu citeste nici baza, nici fisiere. Vocabularul e EXACT cel al calendarului
 * oficial („Post", „Dezlegare la pește", „Perioada Triodului"…), ca rezultatul sa se poata pune
 * fata in fata cu el, zi cu zi (`/v1/atelier/pascalia`). Regulile de aici nu sunt copiate din
 * carti: sunt scoase din calendarele oficiale 2025 si 2026 si probate pe toate cele 730 de zile.
 */

// ---------------------------------------------------------------------------
// Aritmetica pe date
// ---------------------------------------------------------------------------

function zi(data: string): Date {
  return new Date(`${data}T00:00:00Z`)
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}
export function plus(data: string, zile: number): string {
  const d = zi(data)
  d.setUTCDate(d.getUTCDate() + zile)
  return iso(d)
}
export function diferenta(deLa: string, panaLa: string): number {
  return Math.round((zi(panaLa).getTime() - zi(deLa).getTime()) / 86400000)
}
export function ziuaSaptamanii(data: string): number {
  return zi(data).getUTCDay()
}
export function lunaZi(data: string): string {
  return data.slice(5)
}
export function anul(data: string): number {
  return Number(data.slice(0, 4))
}
export function eBisect(an: number): boolean {
  return (an % 4 === 0 && an % 100 !== 0) || an % 400 === 0
}
export function zileleAnului(an: number): string[] {
  const iesire: string[] = []
  let d = `${an}-01-01`
  while (anul(d) === an) {
    iesire.push(d)
    d = plus(d, 1)
  }
  return iesire
}

// ---------------------------------------------------------------------------
// Pastele si reperele
// ---------------------------------------------------------------------------

/** Pastele ortodox: computul lui Meeus pe calendarul iulian, adus in gregorian (+13 zile, 1900–2099). */
export function pastele(an: number): string {
  if (an < 1900 || an > 2099) throw new Error(`Pascalia acopera 1900–2099, nu ${an}`)
  const a = an % 4
  const b = an % 7
  const c = an % 19
  const d = (19 * c + 15) % 30
  const e = (2 * a + 4 * b - d + 34) % 7
  const luna = Math.floor((d + e + 114) / 31)
  const ziua = ((d + e + 114) % 31) + 1
  const iulian = `${an}-${String(luna).padStart(2, '0')}-${String(ziua).padStart(2, '0')}`
  return plus(iulian, 13)
}

export interface Repere {
  an: number
  pastele: string
  rusaliile: string
  rusaliileTrecute: string
  inceputulTriodului: string
  inceputulPostuluiMare: string
  floriile: string
  inaltarea: string
  mosiiDeIarna: string
  mosiiDeVara: string
  mosiiDeToamna: string
  postulSfPetru: [string, string] | null
  postulAdormirii: [string, string]
  postulNasterii: [string, string]
}

const MEMO = new Map<number, Repere>()

function primaSambataDeLa(data: string): string {
  let d = data
  while (ziuaSaptamanii(d) !== 6) d = plus(d, 1)
  return d
}

/** Ajunul unui post fix intra in post daca pica miercuri sau vineri. */
function cuAjunul(inceput: string): string {
  const ajun = plus(inceput, -1)
  const zs = ziuaSaptamanii(ajun)
  return zs === 3 || zs === 5 ? ajun : inceput
}

export function reperele(an: number): Repere {
  const gata = MEMO.get(an)
  if (gata) return gata
  const P = pastele(an)
  const petru: [string, string] | null =
    diferenta(plus(P, 57), `${an}-06-28`) >= 0 ? [plus(P, 57), `${an}-06-28`] : null
  const r: Repere = {
    an,
    pastele: P,
    rusaliile: plus(P, 49),
    rusaliileTrecute: plus(pastele(an - 1), 49),
    inceputulTriodului: plus(P, -70),
    inceputulPostuluiMare: plus(P, -48),
    floriile: plus(P, -7),
    inaltarea: plus(P, 39),
    mosiiDeIarna: plus(P, -57),
    mosiiDeVara: plus(P, 48),
    mosiiDeToamna: primaSambataDeLa(`${an}-11-01`),
    postulSfPetru: petru,
    postulAdormirii: [cuAjunul(`${an}-08-01`), `${an}-08-14`],
    postulNasterii: [cuAjunul(`${an}-11-15`), `${an}-12-24`],
  }
  MEMO.set(an, r)
  return r
}

/** Zile fata de Pastele anului din data. */
export function offsetPasti(data: string): number {
  return diferenta(pastele(anul(data)), data)
}

function inInterval(data: string, i: [string, string] | null): boolean {
  return !!i && data >= i[0] && data <= i[1]
}

// ---------------------------------------------------------------------------
// Perioada si randuiala mesei — in vocabularul calendarului oficial
// ---------------------------------------------------------------------------

export const PERIOADA_OFICIALA = {
  triod: 'Perioada Triodului',
  postulMare: 'Postul Sfintelor Paști',
  luminata: 'Săptămâna luminată',
  petru: 'Postul Sfinților Petru și Pavel',
  adormirii: 'Postul Adormirii Maicii Domnului',
  nasterii: 'Postul Nașterii Domnului',
} as const

export function perioadaOficiala(data: string): string {
  const off = offsetPasti(data)
  const r = reperele(anul(data))
  if (off >= -70 && off <= -49) return PERIOADA_OFICIALA.triod
  if (off >= -48 && off <= -1) return PERIOADA_OFICIALA.postulMare
  if (off >= 0 && off <= 7) return PERIOADA_OFICIALA.luminata
  if (inInterval(data, r.postulSfPetru)) return PERIOADA_OFICIALA.petru
  if (inInterval(data, r.postulAdormirii)) return PERIOADA_OFICIALA.adormirii
  if (inInterval(data, r.postulNasterii)) return PERIOADA_OFICIALA.nasterii
  return ''
}

/** Ce tine de ciclul FIX al datei si schimba randuiala mesei: semnul si titlul sfantului. */
export interface CiclulFix {
  cruce_text?: string
  titlu?: string
}

const POST = 'Post'
const PESTE = 'Dezlegare la pește'
const HARTI = 'Harți'
const BRANZA = 'Dezlegare la brânză, lapte, ouă și pește'

function ePraznic(fix?: CiclulFix): boolean {
  return /^\(†\)/.test((fix?.cruce_text ?? '').trim()) || /^\(†\)/.test((fix?.titlu ?? '').trim())
}
function areCruce(fix?: CiclulFix): boolean {
  return /†/.test(fix?.cruce_text ?? '')
}

export function randuialaMesei(data: string, fix?: CiclulFix): string {
  const off = offsetPasti(data)
  const zs = ziuaSaptamanii(data)
  const mmdd = lunaZi(data)
  const miercuriVineri = zs === 3 || zs === 5
  const sambataDuminica = zs === 0 || zs === 6
  const luniMartiJoi = zs === 1 || zs === 2 || zs === 4
  const perioada = perioadaOficiala(data)

  if (perioada === PERIOADA_OFICIALA.postulMare) {
    if (mmdd === '03-25' || off === -7) return PESTE
    return POST
  }
  if (perioada === PERIOADA_OFICIALA.luminata) return miercuriVineri ? HARTI : ''
  if (perioada === PERIOADA_OFICIALA.triod) {
    if (!miercuriVineri) return ''
    if (off <= -63) return HARTI
    if (off <= -56) return POST
    return BRANZA
  }
  if (perioada === PERIOADA_OFICIALA.petru) {
    if (ePraznic(fix) || sambataDuminica) return PESTE
    if (luniMartiJoi && (areCruce(fix) || /^Sf\. Ap\./.test(fix?.titlu ?? ''))) return PESTE
    return POST
  }
  if (perioada === PERIOADA_OFICIALA.adormirii) return mmdd === '08-06' ? PESTE : POST
  if (perioada === PERIOADA_OFICIALA.nasterii) {
    if (ePraznic(fix)) return PESTE
    // miercurea si vinerea nu dezleaga decat praznicul imparatesc (9 dec. 2026, miercuri: „Post")
    if (miercuriVineri) return POST
    const fereastra = mmdd >= '11-21' && mmdd <= '12-19'
    if (fereastra && (sambataDuminica || (luniMartiJoi && areCruce(fix)))) return PESTE
    if (mmdd === '12-09') return PESTE
    return POST
  }
  // peste an
  if (mmdd === '01-05' || mmdd === '08-29' || mmdd === '09-14') return POST
  if (!miercuriVineri) return ''
  if (mmdd >= '12-25' || mmdd <= '01-04') return HARTI
  if (off >= 50 && off <= 56) return HARTI
  if (off >= 8 && off <= 48) return PESTE
  if (mmdd === '01-07' || ePraznic(fix)) return PESTE
  return POST
}

export function sambataMortilor(data: string): string {
  const r = reperele(anul(data))
  if (data === r.mosiiDeIarna) return 'Sâmbăta celor adormiți - Moșii de iarnă'
  if (data === r.mosiiDeVara) return 'Sâmbăta celor adormiți - Moșii de vară'
  if (data === r.mosiiDeToamna) return 'Sâmbăta celor adormiți - Moșii de toamnă'
  return ''
}

const ZILE_LIBERE_FIXE = new Set(['01-01', '01-02', '01-06', '01-07', '01-24', '05-01', '06-01', '08-15', '11-30', '12-01', '12-25', '12-26'])
const ZILE_LIBERE_MOBILE = new Set([-2, 0, 1, 49, 50])

export function ziLibera(data: string): boolean {
  return ZILE_LIBERE_FIXE.has(lunaZi(data)) || ZILE_LIBERE_MOBILE.has(offsetPasti(data))
}

// ---------------------------------------------------------------------------
// Ce scrie calendarul in paranteza titlului, si praznicele/insemnarile mobile
// ---------------------------------------------------------------------------

const IN_PARANTEZA: Record<number, string> = {
  [-70]: 'Începutul Triodului',
  [-50]: 'Sâmbăta Sfinților Cuvioși',
  [-48]: 'Începutul Postului Sfintelor Paști. Zi aliturgică. Canonul Mare',
  [-47]: 'Zi aliturgică. Canonul Mare',
  [-46]: 'Canonul Mare',
  [-45]: 'Canonul Mare',
  [-43]: 'Sâmbăta Sf. Mare Mc. Teodor. Pomenirea celor adormiți',
  [-36]: 'Pomenirea celor adormiți',
  [-29]: 'Pomenirea celor adormiți',
  [-22]: 'Pomenirea celor adormiți',
  [-15]: 'Pomenirea celor adormiți',
  [-8]: 'Sâmbăta lui Lazăr. Pomenirea celor adormiți',
  [-7]: 'Dezlegare la pește',
  [-6]: 'Denie',
  [-5]: 'Denie',
  [-4]: 'Denie',
  [-3]: 'Denia celor 12 Evanghelii',
  [-2]: 'Zi aliturgică. Denia Prohodului Domnului',
  [56]: 'Lăsatul secului pentru Postul Sf. Ap. Petru și Pavel',
}

export function inParanteza(data: string): string[] {
  const off = offsetPasti(data)
  const r = reperele(anul(data))
  const iesire: string[] = []
  const m = sambataMortilor(data)
  if (m) iesire.push(m)
  if (IN_PARANTEZA[off]) iesire.push(IN_PARANTEZA[off]!)
  if (r.postulSfPetru && data === r.postulSfPetru[0]) iesire.push('Începutul Postului Sf. Ap. Petru și Pavel')
  const fixe: Array<[[string, string], string]> = [
    [r.postulAdormirii, 'Postul Adormirii Maicii Domnului'],
    [r.postulNasterii, 'Postul Nașterii Domnului'],
  ]
  for (const [[inceput], nume] of fixe) {
    if (data === plus(inceput, -1)) iesire.push(`Lăsatul secului pentru ${nume}`)
    if (data === inceput) iesire.push(`Începutul ${nume.replace(/^Postul/, 'Postului')}`)
  }
  return iesire
}

/** Praznicul imparatesc mobil care TINE LOCUL titlului. */
export function praznicul(off: number): string | null {
  switch (off) {
    case -7:
      return '(†) Intrarea Domnului în Ierusalim'
    case 0:
      return '(†) Învierea Domnului nostru Iisus Hristos (Sfintele Paști)'
    case 1:
    case 2:
      return '(†) Sfintele Paști'
    case 39:
      return '(†) Înălțarea Domnului (Ziua Eroilor)'
    case 49:
      return '(†) Pogorârea Sfântului Duh (Cincizecimea sau Rusaliile)'
    case 50:
      return '(†) Sfânta Treime'
    default:
      return null
  }
}

/** Insemnarea mobila pusa INAINTEA sfintilor zilei. */
export function insemnareaMobila(off: number): string | null {
  const patimi = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă']
  if (off >= -6 && off <= -1) return `Sfânta și Marea ${patimi[off + 6]}`
  switch (off) {
    case 5:
      return '†) Izvorul Tămăduirii; † Cinstirea Sfintei Icoane a Maicii Domnului Siriaca de la Mănăstirea Ghighiu'
    case 24:
      return 'Înjumătățirea Cincizecimii'
    case 31:
      return 'Odovania Înjumătățirii Cincizecimii'
    case 38:
      return 'Odovania praznicului Învierii Domnului'
    case 47:
      return 'Odovania praznicului Înălțării Domnului'
    case 55:
      return 'Odovania praznicului Pogorârii Sfântului Duh'
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Duminicile: nume, numar, glas, voscreasna
// ---------------------------------------------------------------------------

export interface Duminica {
  nr: number | null
  nume: string
  nesigur: boolean
}

const DUMINICI_TRIOD: Record<number, string> = {
  [-70]: 'Duminica a 33-a după Rusalii (a Vameșului și a Fariseului)',
  [-63]: 'Duminica a 34-a după Rusalii (a Întoarcerii Fiului risipitor)',
  [-56]: 'Duminica Înfricoșătoarei Judecăți (a Lăsatului sec de carne)',
  [-49]: 'Duminica Izgonirii lui Adam din Rai (a Lăsatului sec de brânză)',
  [-42]: 'Duminica întâi din Post (a Ortodoxiei)',
  [-35]: 'Duminica a 2-a din Post (a Sf. Ier. Grigorie Palama)',
  [-28]: 'Duminica a 3-a din Post (a Sfintei Cruci)',
  [-21]: 'Duminica a 4-a din Post (a Sf. Cuv. Ioan Scărarul)',
  [-14]: 'Duminica a 5-a din Post (a Sf. Cuv. Maria Egipteanca)',
  [-7]: 'Duminica a 6-a din Post (a Floriilor)',
}

/** Penticostarul: glasul si voscreasna sunt randuite pe praznic, nu pe numaratoare. */
const DUMINICI_PENTICOSTAR: Record<number, { nume: string; glas: number | null; voscr: number | null }> = {
  [7]: { nume: 'Duminica a 2-a după Paști (a Sf. Apostol Toma)', glas: 1, voscr: 1 },
  [14]: { nume: 'Duminica a 3-a după Paști (a Mironosițelor)', glas: 2, voscr: 4 },
  [21]: { nume: 'Duminica a 4-a după Paști (Vindecarea slăbănogului de la Vitezda)', glas: 3, voscr: 5 },
  [28]: { nume: 'Duminica a 5-a după Paști (a Samarinencei)', glas: 4, voscr: 7 },
  [35]: { nume: 'Duminica a 6-a după Paști (Vindecarea orbului din naștere)', glas: 5, voscr: 8 },
  [42]: { nume: 'Duminica a 7-a după Paști (a Sf. Părinți de la Sinodul I Ecumenic)', glas: 6, voscr: 10 },
  [49]: { nume: 'Duminica a 8-a după Paști', glas: null, voscr: null },
  [56]: { nume: 'Duminica întâi după Rusalii (a Tuturor Sfinților)', glas: 8, voscr: 1 },
}

/** Ferestre fixe: duminica dintr-o fereastra are numele ei, oricare i-ar fi numarul. */
const FERESTRE: Array<[string, string, string]> = [
  ['09-07', '09-13', 'Duminica dinaintea Înălțării Sfintei Cruci'],
  ['09-15', '09-21', 'Duminica după Înălțarea Sfintei Cruci'],
  ['12-18', '12-24', 'Duminica dinaintea Nașterii Domnului (a Sf. Părinți după trup ai Domnului)'],
  ['12-26', '12-31', 'Duminica după Nașterea Domnului (a Sfinților Iosif Logodnicul, David Prorocul și Iacob, rudenia Domnului)'],
  ['01-01', '01-05', 'Duminica dinaintea Botezului Domnului'],
  ['01-07', '01-13', 'Duminica după Botezul Domnului'],
]

/** Praznicele imparatesti fixe care, cazute duminica, tin locul numelui si al glasului. */
const PRAZNICE_FIXE_DUMINICA = new Set(['01-06', '09-14', '12-25'])

function ordinal(n: number): string {
  return n === 1 ? 'întâi' : `a ${n}-a`
}

/**
 * Lantul numerelor tiparite dupa Inaltarea Sfintei Cruci — numarul e al Evangheliei randuite, nu
 * o numaratoare. Citit din 2025+2026: intre doua ancore fixe stau sirurile de mai jos; cand zona
 * are alt numar de locuri decat sirul, tot sirul se insemneaza `nesigur`.
 */
const LANT_TOAMNA: Array<{ pana: string; nume?: string; sir?: Array<[number, string]> }> = [
  { pana: '09-13', nume: 'Duminica dinaintea Înălțării Sfintei Cruci' },
  { pana: '09-21', nume: 'Duminica după Înălțarea Sfintei Cruci' },
  { pana: '10-10', sir: [[18, ''], [19, '']] },
  { pana: '10-17', nume: 'Duminica a 21-a după Rusalii (a Sfinților Părinți de la Sinodul al VII-lea Ecumenic)' },
  { pana: '11-24', sir: [[20, ''], [23, ''], [22, ''], [24, ''], [25, ''], [26, '']] },
  { pana: '12-01', sir: [[30, '']] },
  { pana: '12-10', sir: [[27, '']] },
  { pana: '12-17', nume: 'Duminica a 28-a după Rusalii (a Sf. Strămoși după trup ai Domnului)' },
  { pana: '12-24', nume: 'Duminica dinaintea Nașterii Domnului (a Sf. Părinți după trup ai Domnului)' },
  { pana: '12-31', nume: 'Duminica după Nașterea Domnului (a Sfinților Iosif Logodnicul, David Prorocul și Iacob, rudenia Domnului)' },
]
const LANT_IARNA: Array<{ pana: string; nume?: string; sir?: Array<[number, string]> }> = [
  { pana: '01-05', nume: 'Duminica dinaintea Botezului Domnului' },
  { pana: '01-13', nume: 'Duminica după Botezul Domnului' },
  // pana la Triod: [29, 32 (a lui Zaheu), 17 (a Cananeencei)]; Zaheu e MEREU ultima dinaintea Vamesului
  { pana: 'triod', sir: [[29, ''], [32, ' (a lui Zaheu)'], [17, ' (a Cananeencei)']] },
]

function numeDupaRusalii(nr: number, sufix = ''): string {
  return `Duminica ${ordinal(nr)} după Rusalii${sufix}`
}

/**
 * Toate duminicile anului, cu nume si numar. Se calculeaza o data pe an: numerele din lantul
 * toamnei si al iernii depind de cate duminici incap intre ancore.
 */
export function duminicileAnului(an: number): Map<string, Duminica> {
  const r = reperele(an)
  const iesire = new Map<string, Duminica>()
  const duminici = zileleAnului(an).filter((d) => ziuaSaptamanii(d) === 0)

  // Zonele lantului, umplute in ordinea datei.
  const zone = new Map<string, string[]>()
  const cheiaZonei = (d: string): string | null => {
    const mmdd = lunaZi(d)
    if (mmdd >= '09-07') {
      for (const z of LANT_TOAMNA) if (mmdd <= z.pana) return `t:${z.pana}`
      return null
    }
    // iarna: pana la inceputul Triodului
    if (d < r.inceputulTriodului) {
      for (const z of LANT_IARNA) {
        if (z.pana === 'triod') return 'i:triod'
        if (mmdd <= z.pana) return `i:${z.pana}`
      }
    }
    return null
  }
  for (const d of duminici) {
    const k = cheiaZonei(d)
    if (!k) continue
    const lista = zone.get(k) ?? []
    lista.push(d)
    zone.set(k, lista)
  }
  const dinZona = (d: string, k: string): Duminica | null => {
    const [fel, pana] = k.split(':') as [string, string]
    const lant = fel === 't' ? LANT_TOAMNA : LANT_IARNA
    const zona = lant.find((z) => z.pana === pana)
    if (!zona) return null
    const lista = zone.get(k) ?? []
    if (zona.nume) {
      const nr = /a (\d+)-a/.exec(zona.nume)
      return { nr: nr ? Number(nr[1]) : null, nume: zona.nume, nesigur: lista.length !== 1 }
    }
    const sir = zona.sir ?? []
    const poz = lista.indexOf(d)
    if (pana === 'triod') {
      // Sirul [29, 32 (Zaheu), 17 (Cananeenca)] se ia in ordine, cate locuri sunt (2025: trei,
      // 2026: doua). Peste trei locuri numaratoarea e presupusa.
      const n = lista.length
      const gasit = sir[poz]
      if (!gasit) return { nr: null, nume: 'Duminică după Rusalii', nesigur: true }
      return { nr: gasit[0], nume: numeDupaRusalii(gasit[0], gasit[1]), nesigur: n > 3 }
    }
    const gasit = sir[poz]
    const nesigur = lista.length !== sir.length
    if (!gasit) return { nr: null, nume: 'Duminică după Rusalii', nesigur: true }
    return { nr: gasit[0], nume: numeDupaRusalii(gasit[0], gasit[1]), nesigur }
  }

  for (const d of duminici) {
    const off = diferenta(r.pastele, d)
    const mmdd = lunaZi(d)
    if (DUMINICI_TRIOD[off]) {
      const nr = /a (\d+)-a după Rusalii/.exec(DUMINICI_TRIOD[off]!)
      iesire.set(d, { nr: nr ? Number(nr[1]) : null, nume: DUMINICI_TRIOD[off]!, nesigur: false })
      continue
    }
    if (off === 0) {
      iesire.set(d, { nr: null, nume: '', nesigur: false })
      continue
    }
    const pent = DUMINICI_PENTICOSTAR[off]
    if (pent) {
      iesire.set(d, { nr: off === 56 ? 1 : null, nume: pent.nume, nesigur: false })
      continue
    }
    if (PRAZNICE_FIXE_DUMINICA.has(mmdd)) {
      iesire.set(d, { nr: null, nume: '', nesigur: false })
      continue
    }
    const k = cheiaZonei(d)
    if (k) {
      const din = dinZona(d, k)
      if (din) {
        iesire.set(d, din)
        continue
      }
    }
    // Vara: a k-a dupa Rusalii, cu numele de pe drum.
    const rusalii = d >= r.rusaliile ? r.rusaliile : r.rusaliileTrecute
    const kSapt = Math.round(diferenta(rusalii, d) / 7)
    let sufix = ''
    if (kSapt === 2) sufix = ' (a Sfinților Români)'
    else if (kSapt === 3 && an >= 2026) sufix = ' (a Sfinților Athoniți)'
    else if (mmdd >= '07-13' && mmdd <= '07-19') sufix = ' (a Sf. Părinți de la Sinodul al IV-lea Ecumenic)'
    iesire.set(d, { nr: kSapt, nume: numeDupaRusalii(kSapt, sufix), nesigur: false })
  }
  return iesire
}

const MEMO_DUMINICI = new Map<number, Map<string, Duminica>>()
export function duminica(data: string): Duminica | null {
  if (ziuaSaptamanii(data) !== 0) return null
  const an = anul(data)
  let m = MEMO_DUMINICI.get(an)
  if (!m) {
    m = duminicileAnului(an)
    MEMO_DUMINICI.set(an, m)
  }
  return m.get(data) ?? null
}

/**
 * Glasul si voscreasna unei duminici. O singura formula: k = saptamani de la Rusaliile din urma;
 * glas ((k+6) mod 8)+1, voscreasna ((k-1) mod 11)+1. Numaratoarea NU se intrerupe prin Triod si
 * Postul Mare. Tace la Florii, Pasti, Rusalii, in Penticostar (unde e randuita pe praznic) si la
 * praznicele imparatesti fixe cazute duminica.
 */
export function glasSiVoscreasna(data: string): { glas: number | null; voscr: number | null } {
  if (ziuaSaptamanii(data) !== 0) return { glas: null, voscr: null }
  const r = reperele(anul(data))
  const off = diferenta(r.pastele, data)
  if (off === -7 || off === 0 || off === 49) return { glas: null, voscr: null }
  const pent = DUMINICI_PENTICOSTAR[off]
  if (pent && off < 56) return { glas: pent.glas, voscr: pent.voscr }
  if (PRAZNICE_FIXE_DUMINICA.has(lunaZi(data))) return { glas: null, voscr: null }
  const rusalii = data >= r.rusaliile ? r.rusaliile : r.rusaliileTrecute
  const k = Math.round(diferenta(rusalii, data) / 7)
  return { glas: ((k + 6) % 8) + 1, voscr: ((k - 1) % 11) + 1 }
}

/** Glasul saptamanii pentru orice zi: al duminicii dinainte (glasul se schimba sambata seara). */
export function glasulSaptamanii(data: string): number | null {
  const zs = ziuaSaptamanii(data)
  const dum = plus(data, -zs)
  return glasSiVoscreasna(dum).glas
}

// ---------------------------------------------------------------------------
// Reperele anului pentru contract (`GET /v1/an/<an>/repere`)
// ---------------------------------------------------------------------------

export function repereContract(an: number) {
  const r = reperele(an)
  const P = r.pastele
  const repere: Record<string, string> = {
    duminica_vamesului: plus(P, -70),
    duminica_fiului_risipitor: plus(P, -63),
    mosii_de_iarna: r.mosiiDeIarna,
    lasatul_secului_de_carne: plus(P, -56),
    lasatul_secului_de_branza: plus(P, -49),
    inceputul_postului_mare: r.inceputulPostuluiMare,
    duminica_ortodoxiei: plus(P, -42),
    sambata_lui_lazar: plus(P, -8),
    floriile: r.floriile,
    joia_mare: plus(P, -3),
    vinerea_mare: plus(P, -2),
    pastele: P,
    izvorul_tamaduirii: plus(P, 5),
    duminica_tomii: plus(P, 7),
    injumatatirea_cincizecimii: plus(P, 24),
    inaltarea: r.inaltarea,
    mosii_de_vara: r.mosiiDeVara,
    rusaliile: r.rusaliile,
    sfanta_treime: plus(P, 50),
    duminica_tuturor_sfintilor: plus(P, 56),
    mosii_de_toamna: r.mosiiDeToamna,
  }
  const posturi = [
    { cod: 'postul_mare', nume: 'Postul Sfintelor Paști', de_la: r.inceputulPostuluiMare, pana_la: plus(P, -1) },
    ...(r.postulSfPetru
      ? [{ cod: 'postul_sfintilor_apostoli', nume: 'Postul Sfinților Apostoli Petru și Pavel', de_la: r.postulSfPetru[0], pana_la: r.postulSfPetru[1] }]
      : []),
    { cod: 'postul_adormirii', nume: 'Postul Adormirii Maicii Domnului', de_la: r.postulAdormirii[0], pana_la: r.postulAdormirii[1] },
    { cod: 'postul_nasterii', nume: 'Postul Nașterii Domnului', de_la: r.postulNasterii[0], pana_la: r.postulNasterii[1] },
  ]
  return { an, pasti: P, repere, posturi }
}
