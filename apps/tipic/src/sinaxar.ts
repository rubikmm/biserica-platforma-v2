/**
 * Sfinții zilei, așa cum îi numără MINEIUL — mai mulți decât cei din calendarul oficial, fiindcă
 * acolo trece toată ceata zilei, nu doar pomenirile mari. Verificat pe patru duminici (10.09.2026):
 * Mineiul dă între cinci și zece nume în plus. Invers, el NU are sfinții români canonizați după
 * ediție (Ioan de la Prislop, Antim Ivireanul, Dumitru Stăniloae) — aceia sunt numai în calendar.
 * De aceea API-ul ăsta nu înlocuiește lista calendarului, ci stă lângă ea, cu sursa lui la vedere.
 *
 * Cum e cules sinaxarul în carte, și de aici regula de desfacere:
 *   [rubrica] „Într-această lună în 13 zile, Pomenirea …"   ← începe o pomenire
 *   [rubrica] „Stih: Israil Cel nou legea cea veche împlinește,"
 *   [sinaxar] „Și prin înnoiri mormântul tău Cuvinte cinstește."  ← al doilea rând al stihului
 *   [sinaxar] „Acesta a fost pe vremea Sfinților Apostoli…"       ← viața
 *
 * Stihul e un DISTIH: rândul al doilea e cules la fel ca viața, deci nu se cunoaște după haină.
 * Se cunoaște după LOC și după lungime: un rând scurt care vine imediat după „Stih:" (sau după
 * alt rând de stih) încheie stihul; primul rând lung deschide viața și de acolo încolo totul e
 * viață. Regula e verificată pe cele patru duminici de control.
 */
import type { ZiMinei } from '@xc/contracts'

/** Peste atâtea semne un rând nu mai poate fi al doilea rând al unui distih. */
const STIH_MAX = 170

// Editia IBMO 2005 (noiembrie) scrie „În ziua a douăzeci și doua,", nu „Într-această lună în 22 zile,".
const INCEPUT_POMENIRE = /^(Într[u]?[ -]?aceast[ăa] lun[ăa]|[ÎI]n aceast[ăa] lun[ăa]|[ÎI]n ziua a [^,]{3,40},|Tot [îi]n aceast[ăa] zi|Într[u]? aceast[ăa] zi)/i
const ESTE_STIH = /^(Alte?\s+)?Stih(uri)?\b/i
/** Încheierea sinaxarului, a tuturor și a nimănui: nu se pune la niciun sfânt. */
const INCHEIERE = /^Cu ale lor sfinte rug[ăa]ciuni/i
/**
 * Pomenirile fără formula de început, culese ca rând de sine stătător la coada zilei
 * („Cuviosul Părintele nostru Petru cel din Agreia, în pace s-a săvârșit.").
 */
const POMENIRE_SCURTA = /^(Cuvio[sș]|Sf[âa]nt|Sfin[țt]|Preacuvio[sș]|Fericit|Ierarh|Mucenic)/i

/**
 * Formula cu data se taie („Într-această lună în 13 zile,", „Tot în această zi,") — pe foaie se
 * citește numele, nu adresa lui în carte. Cuvântul „Pomenirea" RĂMÂNE: cartea scrie numele la
 * genitiv după el („pomenirea Sfântului Mucenic Cornelie"), deci scos, numele ar rămâne șchiop.
 * Litera dintâi se face mare, fiindcă în carte ea era la mijloc de rând.
 */
function numeCurat(pomenire: string): string {
  const t = pomenire
    .replace(/^Într[u]?[ -]?aceast[ăa] lun[ăa][^,]*,\s*/i, '')
    .replace(/^[ÎI]n aceast[ăa] lun[ăa][^,]*,\s*/i, '')
    .replace(/^Tot [îi]n aceast[ăa] zi,?\s*/i, '')
    .replace(/^Într[u]? aceast[ăa] zi,?\s*/i, '')
    .replace(/^[ÎI]n ziua a [^,]{3,40},\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return t ? t[0]!.toLocaleUpperCase('ro-RO') + t.slice(1) : t
}

export interface Pomenire {
  /** Numele, fără formula de început: „Sfinții Mucenici Cronid, Leontie, Serapion, Straton și Seleuc." */
  nume: string
  /** Rândul întreg, cum e tipărit. */
  pomenire: string
  /** Stihul (distihul) pomenirii, rând cu rând; poate lipsi. */
  stih: string[]
  /** Viața pe scurt, dacă o dă cartea. */
  viata: string
}

/**
 * Pomenirile zilei din sinaxarul Mineiului. Ziua fără sinaxar (praznicele mari, unde slujba nu-l
 * are) întoarce listă goală — nu e o eroare.
 */
export function pomeniriDinMinei(zi: ZiMinei): Pomenire[] {
  const b = zi.bucati
  const inceput = b.findIndex((x) => x.fel === 'sectiune' && /SINAXAR/i.test(x.text))
  if (inceput < 0) return []
  let sfarsit = b.findIndex((x, i) => i > inceput && x.fel === 'sectiune')
  if (sfarsit < 0) sfarsit = b.length

  const pomeniri: Pomenire[] = []
  let acum: Pomenire | null = null
  /** Cât timp stăm încă în stih: primul rând lung îl închide și deschide viața. */
  let inStih = false

  for (const bucata of b.slice(inceput + 1, sfarsit)) {
    const text = bucata.text.trim()
    if (!text) continue
    if (INCHEIERE.test(text)) break

    if (bucata.fel === 'rubrica') {
      if (ESTE_STIH.test(text)) {
        // „Stih: …" — primul rând al distihului; „Alte Stihuri, la cei 49 de Mucenici." e doar anunț.
        const rand = text.replace(/^(Alte?\s+)?Stih(uri)?\b\s*:?\s*/i, '').trim()
        if (acum && rand) acum.stih.push(rand)
        inStih = true
        continue
      }
      if (INCEPUT_POMENIRE.test(text) || POMENIRE_SCURTA.test(text)) {
        acum = { nume: numeCurat(text), pomenire: text, stih: [], viata: '' }
        pomeniri.push(acum)
        inStih = false
        continue
      }
      // altă indicație tipiconală în mijlocul sinaxarului: nu e nici pomenire, nici stih
      continue
    }

    if (!acum) continue
    if (inStih && text.length <= STIH_MAX) {
      acum.stih.push(text)
      continue
    }
    inStih = false
    acum.viata = acum.viata ? `${acum.viata}\n\n${text}` : text
  }

  return pomeniri
}
