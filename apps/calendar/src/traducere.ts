/**
 * Traducerea unui rand al calendarului oficial in vocabularul platformei: `zi_liturgica`.
 * Se face la citire, nu la preluare — o regula schimbata se vede imediat, fara re-import.
 */
import type { Dezlegare, Perioada, Rang, Semn, ZiLiturgica, ZiSaptamana } from '@xc/contracts'
import { ZILE_SAPTAMANII } from '@xc/contracts'
import { glasulSaptamanii, offsetPasti } from './pascalia.js'
import {
  type Culoare,
  type Desfacere,
  type Eticheta,
  desfaTitlul,
  etichetelePeCampuri,
  htmlDinSegmente,
  pericopaDin,
  canonizeazaReferinta,
  textDinSegmente,
} from './titluri.js'

/** Randul tabelei `zile` (sau unul compus pentru anii calculati). */
export interface RandZi {
  data: string
  an: number
  luna: number
  zi: number
  zi_saptamana: number
  titlu: string
  titlu_html: string
  subtitlu: string
  cruce: string
  cruce_text: string
  zi_libera: number
  post: string
  perioada: string
  sambata_mortilor: string
  nunti: number
  parastase: number
  faza_lunii: string
  evanghelia: string
  apostolul: string
  sursa_id: number | null
  sursa_link: string
  preluat_la: string
  /** Doar pe zilele compuse din Pascalie. */
  calculat?: boolean
  nota?: string
  nesigur?: string[]
}

export const ORDINE_RANG: Record<Rang, number> = {
  praznic_imparatesc: 6,
  cruce_rosie: 5,
  cruce_albastra: 4,
  cruce_neagra: 3,
  cruce_nedeclarata: 2,
  simplu: 1,
}
const ORDINE_SEMN: Record<string, number> = { '(†)': 3, '†)': 2, '†': 1 }

export function rangulZilei(cruce: string, cruceText: string): Rang | null {
  if (cruce === 'rosie') return /^\(†\)/.test(cruceText) ? 'praznic_imparatesc' : 'cruce_rosie'
  if (cruce === 'albastra') return 'cruce_albastra'
  if (cruce === 'neagra') return 'cruce_neagra'
  return null
}

/**
 * Rangul unui sfant: fara semn = simplu; `(†)` = praznic; albastrul bate rosul; altfel culoarea
 * ZILEI; iar cand ziua nu declara culoarea (duminica), `cruce_nedeclarata` — nu se ghiceste.
 */
export function rangulSfantului(semn: Semn, culoare: Culoare, rangZi: Rang | null): Rang {
  if (!semn) return 'simplu'
  if (semn === '(†)') return 'praznic_imparatesc'
  if (culoare === 'albastru') return 'cruce_albastra'
  if (rangZi === 'cruce_neagra') return 'cruce_neagra'
  if (rangZi === 'cruce_albastra') return 'cruce_albastra'
  if (rangZi === 'cruce_rosie' || rangZi === 'praznic_imparatesc') return 'cruce_rosie'
  return 'cruce_nedeclarata'
}

export function perioadaContract(perioadaSursa: string, off: number): Perioada {
  switch (perioadaSursa) {
    case 'Perioada Triodului':
      return 'triod'
    case 'Postul Sfintelor Paști':
      return off >= -6 && off <= -1 ? 'saptamana_patimilor' : 'postul_mare'
    case 'Săptămâna luminată':
      return 'saptamana_luminata'
    case 'Postul Sfinților Petru și Pavel':
      return 'postul_sfintilor_apostoli'
    case 'Postul Adormirii Maicii Domnului':
      return 'postul_adormirii'
    case 'Postul Nașterii Domnului':
      return 'postul_nasterii'
    default:
      return off >= 8 && off <= 56 ? 'penticostar' : 'peste_an'
  }
}

export function postContract(postSursa: string): { este: boolean; dezlegare: Dezlegare; nota: string | null } {
  const p = postSursa.trim()
  if (!p) return { este: false, dezlegare: 'niciuna', nota: null }
  if (/^harți$/i.test(p)) return { este: false, dezlegare: 'harti', nota: null }
  if (/^post$/i.test(p)) return { este: true, dezlegare: 'niciuna', nota: null }
  if (/ajun/i.test(p)) return { este: true, dezlegare: 'ajunare', nota: null }
  if (/brânză|lapte|ouă/i.test(p)) return { este: true, dezlegare: 'dezlegare_branza_lapte_oua_peste', nota: null }
  if (/pește/i.test(p)) return { este: true, dezlegare: 'dezlegare_peste', nota: null }
  if (/ulei|untdelemn|vin/i.test(p)) return { este: true, dezlegare: 'dezlegare_untdelemn_vin', nota: null }
  return { este: true, dezlegare: 'niciuna', nota: p }
}

/** Desfacerea unui rand, cu etichetele din titlu si din campuri. Pentru pagini si pentru contract. */
export interface RandDesfacut extends Desfacere {
  etichete: Eticheta[]
  titluCurat: string
  titluHtmlCurat: string
  eDuminica: boolean
  off: number
}

export function desfaRandul(r: RandZi): RandDesfacut {
  const d = desfaTitlul(r.titlu_html || r.titlu)
  const eDuminica = r.zi_saptamana === 0
  return {
    ...d,
    etichete: etichetelePeCampuri(d.etichete, r),
    titluCurat: textDinSegmente(d.segmente),
    titluHtmlCurat: htmlDinSegmente(d.segmente, eDuminica),
    eDuminica,
    off: offsetPasti(r.data),
  }
}

export function ziLiturgica(r: RandZi, versiune: string): ZiLiturgica {
  const d = desfaRandul(r)
  const rangDeclarat = rangulZilei(r.cruce, r.cruce_text)
  const sfinti = d.sfinti.map((s) => ({
    nume: s.nume,
    rang: rangulSfantului(s.semn, s.culoare, rangDeclarat),
    semn: s.semn,
  }))
  let rang: Rang = rangDeclarat ?? 'simplu'
  if (!rangDeclarat) {
    for (const s of sfinti) if (ORDINE_RANG[s.rang] > ORDINE_RANG[rang]) rang = s.rang
  }
  const semnZilei = /^\(†\)/.test(r.cruce_text) ? '(†)' : /^†\)/.test(r.cruce_text) ? '†)' : /^†/.test(r.cruce_text) ? '†' : null
  let semn: Semn = semnZilei
  if (!semn) {
    for (const s of sfinti) {
      if (s.semn && (!semn || (ORDINE_SEMN[s.semn] ?? 0) > (ORDINE_SEMN[semn] ?? 0))) semn = s.semn
    }
  }

  const post = postContract(r.post)
  const note: string[] = []
  for (const e of d.etichete) if (e.fel === 'slujba' || e.fel === 'morti') note.push(e.text)
  for (const n of d.note) note.push(n)
  if (post.nota) note.push(post.nota)

  const apostol = pericopaDin(d.citiri, 'Ap') ?? (r.apostolul ? canonizeazaReferinta(r.apostolul) : null) ?? null
  const evanghelie = pericopaDin(d.citiri, 'Ev') ?? (r.evanghelia ? canonizeazaReferinta(r.evanghelia) : null) ?? null

  const glas = d.eDuminica ? d.glas : glasulSaptamanii(r.data)

  return {
    data: r.data,
    zi_saptamana: ZILE_SAPTAMANII[r.zi_saptamana] as ZiSaptamana,
    denumire: d.denumire,
    sfinti,
    rang,
    semn,
    perioada: perioadaContract(r.perioada, d.off),
    glas: glas ?? null,
    evanghelia_invierii: d.eDuminica ? d.voscr : null,
    post: { este: post.este, dezlegare: post.dezlegare },
    canonic: {
      nunti: r.calculat ? null : r.nunti === 1,
      parastase: r.calculat ? null : r.parastase === 1,
      aliturgica: d.etichete.some((e) => e.fel === 'aliturgica'),
    },
    pericope: { apostol: apostol || null, evanghelie: evanghelie || null },
    local: [],
    zi_libera: r.zi_libera === 1,
    note,
    titlu: r.titlu,
    titlu_html: d.titluHtmlCurat,
    versiune_calendar: versiune,
    sursa: r.calculat
      ? { fel: 'calculat', id: null, link: null, preluat_la: r.preluat_la, nota: r.nota ?? '' }
      : { fel: 'patriarhia', id: r.sursa_id, link: r.sursa_link || null, preluat_la: r.preluat_la },
  }
}

/** Culoarea de afisat a unui sfant, dupa rang (nu dupa semn). */
export function clasaRang(rang: Rang): string {
  if (rang === 'praznic_imparatesc' || rang === 'cruce_rosie') return 'c-rosu'
  if (rang === 'cruce_albastra') return 'c-albastru'
  return ''
}
