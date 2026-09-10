/**
 * Anul calculat: cand calendarul oficial n-a aparut inca, ziua se compune din ciclul FIX al datei
 * (sfintii, crucile, subtitlurile — luate din aceeasi zi calendaristica a unui an de referinta din
 * baza) si din ciclul MOBIL (Pascalia). Ce nu se poate socoti ramane GOL, nu inventat; ce e nesigur
 * se insemneaza ca atare.
 */
import {
  duminica as duminicaLui,
  glasSiVoscreasna,
  inParanteza,
  insemnareaMobila,
  offsetPasti,
  pastele,
  perioadaOficiala,
  plus,
  praznicul,
  randuialaMesei,
  sambataMortilor,
  ziLibera,
  zileleAnului,
  ziuaSaptamanii,
  lunaZi,
  anul,
} from './pascalia.js'
import { type Segment, htmlDinSegmente, textDinSegmente, canonizeazaReferinta } from './titluri.js'
import { type RandZi, desfaRandul } from './traducere.js'

export type Referinte = Map<number, Map<string, RandZi>>

const OFFSETURI_MOBILE = new Set([-7, 0, 1, 2, 39, 49, 50])
const INSEMNARI_MOBILE = /^(Sfânta și Marea|Izvorul Tămăduirii|Cinstirea Sfintei Icoane a Maicii Domnului Siriaca|Înjumătățirea Cincizecimii|Odovania (Înjumătățirii|praznicului (Învierii|Înălțării|Pogorârii)))/
const ODOVANII_MOBILE = /Învierii|Înălțării|Pogorârii|Înjumătățirii/
const PARANTEZE_MOBILE = /\s*\((Sâmbăta (lui Lazăr|Sf\. Mare Mc\. Teodor|Sfinților Cuvioși)[^)]*)\)/g

function zileiIiTineLoculMobilul(r: RandZi): boolean {
  return OFFSETURI_MOBILE.has(offsetPasti(r.data))
}

/** Randul de referinta pentru o data fixa: acelasi LL-ZZ, din anul cel mai nou care nu era acoperit de un praznic mobil. */
function referintaFixa(mmdd: string, referinte: Referinte): { rand: RandZi; an: number } | null {
  const ani = [...referinte.keys()].sort((a, b) => b - a)
  for (const an of ani) {
    const r = referinte.get(an)?.get(mmdd)
    if (r && !zileiIiTineLoculMobilul(r)) return { rand: r, an }
  }
  return null
}

/** Crucea DECLARATA a datei fixe, cautata prin toti anii de referinta (culoarea unei date fixe e a sfintilor ei). */
function cruceaDeclarata(mmdd: string, referinte: Referinte): { cruce: string; cruce_text: string } | null {
  const ani = [...referinte.keys()].sort((a, b) => b - a)
  for (const an of ani) {
    const r = referinte.get(an)?.get(mmdd)
    if (!r || zileiIiTineLoculMobilul(r)) continue
    const off = offsetPasti(r.data)
    if (insemnareaMobila(off)) continue // crucea era a insemnarii mobile, nu a datei
    if (r.cruce && r.cruce !== 'duminica') return { cruce: r.cruce, cruce_text: r.cruce_text }
  }
  return null
}

/** Randul din anul de referinta aflat la acelasi offset fata de Pasti. */
function referintaMobila(off: number, referinte: Referinte): RandZi | null {
  const ani = [...referinte.keys()].sort((a, b) => b - a)
  for (const an of ani) {
    const d = plus(pastele(an), off)
    if (anul(d) !== an) continue
    const r = referinte.get(an)?.get(lunaZi(d))
    if (r) return r
  }
  return null
}

function acelasiText(a: string, b: string): boolean {
  return canonizeazaReferinta(a) === canonizeazaReferinta(b)
}

/**
 * Pericopele zilei compuse, in trei trepte: (a) citirea DATEI, aceeasi in toti anii de referinta
 * (praznicele fixe); (b) citirea de RAND, de la acelasi offset fata de Pasti (fara zilele in care
 * un praznic fix a acoperit randul); (c) „aproape" — cea mai apropiata zi cu aceeasi zi a saptamanii
 * din anul de referinta cel mai nou, cel mult ±3 zile, insemnata nesigura.
 */
function pericopele(
  d: string,
  off: number,
  referinte: Referinte,
  nesigur: string[],
): { evanghelia: string; apostolul: string } {
  const mmdd = lunaZi(d)
  const ani = [...referinte.keys()].sort((a, b) => b - a)
  // (a) citirea datei
  const peData = ani.map((an) => referinte.get(an)?.get(mmdd)).filter((r): r is RandZi => !!r && !!r.evanghelia && !zileiIiTineLoculMobilul(r))
  if (peData.length >= 2 && peData.every((r) => acelasiText(r.evanghelia, peData[0]!.evanghelia))) {
    return { evanghelia: peData[0]!.evanghelia, apostolul: peData[0]!.apostolul }
  }
  // (b) citirea de rand
  for (const an of ani) {
    const dRef = plus(pastele(an), off)
    if (anul(dRef) !== an) continue
    const r = referinte.get(an)?.get(lunaZi(dRef))
    if (!r) continue
    if (r.cruce === 'rosie') continue // praznic fix a acoperit randul in anul acela
    if (r.evanghelia || r.apostolul) return { evanghelia: r.evanghelia, apostolul: r.apostolul }
    // gol stiut (aliturgicele Postului): ramane gol
    if (off >= -48 && off <= -1) return { evanghelia: '', apostolul: '' }
  }
  // (c) aproape
  const zs = ziuaSaptamanii(d)
  const anNou = ani[0]
  if (anNou !== undefined) {
    for (const pas of [7, -7, 14, -14]) {
      // aceeasi zi a saptamanii = multiplu de 7 zile
      const dRef = plus(`${anNou}-${mmdd === '02-29' ? '02-28' : mmdd}`, pas)
      if (anul(dRef) !== anNou || ziuaSaptamanii(dRef) !== zs) continue
      if (Math.abs(pas) > 3) continue
      const r = referinte.get(anNou)?.get(lunaZi(dRef))
      if (r?.evanghelia) {
        nesigur.push('pericopele sunt ale unei zile apropiate din anul de referință')
        return { evanghelia: r.evanghelia, apostolul: r.apostolul }
      }
    }
    // cea mai apropiata zi cu aceeasi zi a saptamanii, in ±3 zile, nu exista (multiplii de 7) — luam aceeasi data
    for (const delta of [0, 1, -1, 2, -2, 3, -3]) {
      const dRef = plus(`${anNou}-${mmdd === '02-29' ? '02-28' : mmdd}`, delta)
      if (anul(dRef) !== anNou || ziuaSaptamanii(dRef) !== zs) continue
      const r = referinte.get(anNou)?.get(lunaZi(dRef))
      if (r?.evanghelia && r.cruce !== 'rosie') {
        nesigur.push('pericopele sunt ale unei zile apropiate din anul de referință')
        return { evanghelia: r.evanghelia, apostolul: r.apostolul }
      }
    }
  }
  return { evanghelia: '', apostolul: '' }
}

export function notaAnului(an: number, referinta: number[]): string {
  const ani = referinta.length ? referinta.join(' și ') : 'niciun an'
  return (
    `Calendarul oficial pentru ${an} nu a fost încă publicat. Ziua e compusă mecanic: sfinții de pe dată și ` +
    `crucile lor din calendarul oficial ${ani}; Paștele, perioadele, posturile, dezlegările, duminicile, glasul și ` +
    `voscreasna din Pascalie, probată zi cu zi pe anii cu calendar oficial. Nunțile, parastasele, faza lunii și ` +
    `sinaxarul rămân goale — nu se ghicesc. Zilele însemnate „nesigur" au numărul duminicii sau pericopele ` +
    `presupuse; hotărârea e a calendarului oficial, când apare.`
  )
}

export interface AnCompus {
  zile: RandZi[]
  referinta: number[]
  nesigure: Array<{ data: string; de_ce: string[] }>
}

export function compuneAnul(an: number, referinte: Referinte, doarLuna?: number): AnCompus {
  const referinta = [...referinte.keys()].sort((a, b) => b - a)
  const acum = new Date().toISOString()
  const nota = notaAnului(an, referinta)
  const zile: RandZi[] = []
  const nesigure: AnCompus['nesigure'] = []

  for (const d of zileleAnului(an)) {
    const [, luna, ziN] = d.split('-').map(Number) as [number, number, number]
    if (doarLuna && luna !== doarLuna) continue
    const off = offsetPasti(d)
    const zs = ziuaSaptamanii(d)
    const mmdd = lunaZi(d)
    const nesigur: string[] = []

    const praznic = praznicul(off)
    const insemnare = insemnareaMobila(off)
    const fixa = referintaFixa(mmdd, referinte)
    if (!fixa && !praznic) nesigur.push('nicio zi de referință pentru această dată')

    const segmente: Segment[] = []
    let subtitlu = ''
    let paranteza: string[] = [...inParanteza(d)]

    if (praznic) {
      segmente.push({ text: praznic, culoare: 'rosu' })
    } else {
      if (insemnare) {
        const refMobila = referintaMobila(off, referinte)
        const culoareaMobilei = refMobila && /rosie/.test(refMobila.cruce) ? 'rosu' : null
        for (const parte of insemnare.split(';')) {
          const t = parte.trim()
          segmente.push({ text: t, culoare: /†/.test(t) ? culoareaMobilei : null })
        }
      }
      if (fixa) {
        const des = desfaRandul(fixa.rand)
        subtitlu = fixa.rand.subtitlu
        // odovaniile praznicelor FIXE si inainte-praznuirile se intorc in fruntea titlului
        for (const e of des.etichete) {
          if (e.fel === 'perioada' && /^(Odovania|Înainte-prăznuirea)/.test(e.text) && !ODOVANII_MOBILE.test(e.text)) {
            segmente.push({ text: e.text, culoare: null })
          }
        }
        const refEraDuminica = fixa.rand.zi_saptamana === 0
        for (const s of des.sfinti) {
          if (INSEMNARI_MOBILE.test(s.nume)) continue
          const nume = s.nume.replace(PARANTEZE_MOBILE, '').replace(/\s+/g, ' ').trim()
          if (!nume) continue
          // rosul unei duminici era al zilei, nu al sfintilor: raman rosii doar cei scrisi (†)
          let culoare = s.culoare
          if (refEraDuminica && culoare === 'rosu' && s.semn !== '(†)') culoare = null
          if (!s.semn && culoare === 'rosu') culoare = null
          segmente.push({ text: s.semn ? `${s.semn} ${nume}` : nume, culoare })
        }
        // slujbele de pe date fixe calatoresc
        for (const e of des.etichete) {
          if (e.fel === 'slujba' && /^(Tedeum|Slujb[aă] la cumpăna dintre ani)$/.test(e.text)) paranteza.push(e.text)
        }
      }
    }

    // duminica: numele, glasul, voscreasna
    let denumire: string | null = null
    if (zs === 0) {
      const dum = duminicaLui(d)
      if (dum?.nume) {
        denumire = dum.nume
        segmente.push({ text: dum.nume, culoare: 'rosu' })
        if (dum.nesigur) nesigur.push('numărul duminicii e presupus')
      }
      const gv = glasSiVoscreasna(d)
      if (gv.glas) segmente.push({ text: `glas ${gv.glas}${gv.voscr ? `, voscr. ${gv.voscr}` : ''}`, culoare: null })
    }
    // Odovania Intampinarii atarna de inceputul Triodului
    if (mmdd === '02-09' || (mmdd >= '02-02' && mmdd <= '02-09' && segmente.some((s) => /Odovania praznicului Întâmpinării/.test(s.text)))) {
      nesigur.push('Odovania Întâmpinării Domnului depinde de începutul Triodului')
    }

    paranteza = [...new Set(paranteza)]
    if (paranteza.length) {
      // paranteza sta la ultimul sfant (nu la numele duminicii si nu la glas), ca la sursa
      const text = `(${paranteza.join('. ')})`
      const gazda = [...segmente].reverse().find((s) => !/^(Duminica\b|glas\s)/.test(s.text))
      if (gazda) gazda.text = `${gazda.text} ${text}`
      else segmente.push({ text, culoare: null })
    }

    // crucea
    let cruce = ''
    let cruce_text = ''
    if (praznic) {
      cruce = 'rosie'
      cruce_text = '(†) Roșie'
    } else {
      const declarata = cruceaDeclarata(mmdd, referinte)
      const vreunSemn = segmente.some((s) => /†/.test(s.text))
      if (declarata && vreunSemn) {
        cruce = declarata.cruce
        cruce_text = declarata.cruce_text
      } else if (insemnare && /†/.test(insemnare)) {
        const refMobila = referintaMobila(off, referinte)
        if (refMobila && refMobila.cruce && refMobila.cruce !== 'duminica') {
          cruce = refMobila.cruce
          cruce_text = refMobila.cruce_text
        }
      }
    }

    const titlu = textDinSegmente(segmente)
    const titlu_html = htmlDinSegmente(segmente, zs === 0)
    const per = pericopele(d, off, referinte, nesigur)
    if (denumire === null && zs === 0 && !praznic) nesigur.push('duminică fără nume calculat')

    const rand: RandZi = {
      data: d,
      an,
      luna,
      zi: ziN,
      zi_saptamana: zs,
      titlu,
      titlu_html,
      subtitlu,
      cruce,
      cruce_text,
      zi_libera: ziLibera(d) ? 1 : 0,
      post: randuialaMesei(d, { cruce_text, titlu }),
      perioada: perioadaOficiala(d),
      sambata_mortilor: sambataMortilor(d),
      nunti: 0,
      parastase: 0,
      faza_lunii: '',
      evanghelia: per.evanghelia,
      apostolul: per.apostolul,
      sursa_id: null,
      sursa_link: '',
      preluat_la: acum,
      calculat: true,
      nota,
      nesigur: [...new Set(nesigur)],
    }
    zile.push(rand)
    if (rand.nesigur!.length) nesigure.push({ data: d, de_ce: rand.nesigur! })
  }
  return { zile, referinta, nesigure }
}
