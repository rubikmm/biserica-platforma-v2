import type { AcumRadio, BibliotecaRadio, FisierRadio, SelectieRadio } from '@xc/contracts'
import { STRUCTURA_CANONICA } from '@xc/contracts'

/**
 * CEASUL radioului — socoteala pură: ce piesă se aude și de la ce secundă.
 *
 * Nu atinge nici depozitul, nici obiectele durabile, nici rețeaua. E scrisă o singură dată și
 * rulează în TREI locuri: în `radio` (care răspunde la `/v1/acum`), în `live` (care arată radioul
 * în starea emisiei) și — portată literal — pe aparatul din biserică, ca boxele să cânte exact
 * aceeași secundă ca paginile. Dacă socoteala s-ar face altfel într-un loc, boxele și telefoanele
 * s-ar certa între ele; de aceea stă aici, nu în fiecare aplicație.
 */

/** Ordinea naturală: aceeași ca pe aparat — (părinte, nume), fără majuscule. */
export function ordineNaturala(a: string, b: string): number {
  const pa = a.slice(0, a.lastIndexOf('/')).toLowerCase()
  const pb = b.slice(0, b.lastIndexOf('/')).toLowerCase()
  if (pa !== pb) return pa < pb ? -1 : 1
  const na = a.slice(a.lastIndexOf('/') + 1).toLowerCase()
  const nb = b.slice(b.lastIndexOf('/') + 1).toLowerCase()
  return na === nb ? 0 : na < nb ? -1 : 1
}

/** Amprenta indicelui — pagina își dă seama după ea că s-a schimbat ceva și cere cuprinsul iar. */
export async function semnaturaDin(fisiere: readonly FisierRadio[]): Promise<string> {
  const text = fisiere.map((f) => `${f.cale}|${f.durata}`).join('\n')
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(h)]
    .slice(0, 8)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
}

/** Piesele unui director, recursiv, în ordinea naturală (cea din indice). */
export function pieseDin(b: BibliotecaRadio, director: string | null): FisierRadio[] {
  if (!director) return []
  const prefix = `${director}/`
  return b.fisiere.filter((f) => f.cale.startsWith(prefix) && f.durata > 0)
}

/** Lista rotită să înceapă cu `fisier_start` — exact ca playlistul de pe aparatul din V1. */
export function playlist(b: BibliotecaRadio, s: SelectieRadio): FisierRadio[] {
  const piese = pieseDin(b, s.director)
  if (piese.length === 0) return []
  const i = s.fisier_start ? piese.findIndex((f) => f.cale === s.fisier_start) : 0
  const off = i < 0 ? 0 : i
  return piese.slice(off).concat(piese.slice(0, off))
}

const GOL = (s: SelectieRadio): AcumRadio => ({
  pornit: s.pornit,
  versiune: s.versiune,
  director: s.director,
  cale: null,
  secunda: 0,
  durata: 0,
  index: 0,
  total: 0,
  urmatoarea: null,
  urmatoareaDurata: 0,
  cine: s.cine,
})

/**
 * Ce se aude la momentul `acum` (implicit: chiar acum).
 *
 * Selecția curge în buclă de la `s.de`: adunăm duratele până trecem de secunda scursă. De aceea
 * duratele trebuie să fie EXACTE — o eroare de câteva procente pe piesă se adună și, după o oră,
 * ceasul arată cu totul altă melodie decât se aude.
 */
export function ceSeAude(b: BibliotecaRadio, s: SelectieRadio, acum: number = Date.now()): AcumRadio {
  const gol = GOL(s)
  if (!s.pornit) return gol
  const lista = playlist(b, s)
  if (lista.length === 0) return gol
  const total = lista.reduce((t, f) => t + f.durata, 0)
  if (total <= 0) return gol

  const de = Date.parse(s.de)
  const scurs = Number.isFinite(de) ? Math.max(0, (acum - de) / 1000) % total : 0
  let cumul = 0
  let i = 0
  for (const piesa of lista) {
    if (scurs < cumul + piesa.durata) {
      // Lista are cel puțin un element (`total > 0`), deci rotirea cade mereu pe ceva.
      const urm = lista[(i + 1) % lista.length] ?? piesa
      return {
        ...gol,
        cale: piesa.cale,
        secunda: scurs - cumul,
        durata: piesa.durata,
        index: i,
        total: lista.length,
        urmatoarea: urm.cale,
        urmatoareaDurata: urm.durata,
      }
    }
    cumul += piesa.durata
    i++
  }
  // Rotunjirile pot lăsa scursul chiar pe granița de sus; atunci suntem la capătul ultimei piese.
  const ultima = lista[lista.length - 1]
  const prima = lista[0]
  if (!ultima || !prima) return gol
  return {
    ...gol,
    cale: ultima.cale,
    secunda: ultima.durata,
    durata: ultima.durata,
    index: lista.length - 1,
    total: lista.length,
    urmatoarea: prima.cale,
    urmatoareaDurata: prima.durata,
  }
}

/** Toate directoarele: cele cu fișiere + cele goale (canonice sau făcute din pagină). */
export function toateDirectoarele(b: BibliotecaRadio): string[] {
  const d = new Set<string>(b.directoare ?? [])
  for (const c of STRUCTURA_CANONICA) d.add(c)
  for (const f of b.fisiere) {
    const parti = f.cale.split('/')
    parti.pop()
    let cale = ''
    for (const p of parti) {
      cale = cale ? `${cale}/${p}` : p
      d.add(cale)
    }
  }
  return [...d].sort((x, y) => (x.toLowerCase() < y.toLowerCase() ? -1 : 1))
}

export const BIBLIOTECA_GOALA: BibliotecaRadio = { generat_la: '', semnatura: '', fisiere: [] }
