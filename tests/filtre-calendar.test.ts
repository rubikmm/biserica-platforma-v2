import { describe, expect, it } from 'vitest'
import { paginaLuna, poateFiltra, poateVedeaFiltrul, type Ctx } from '../apps/calendar/src/pagini.js'

/**
 * TREPTELE FILTRELOR DIN BARA CALENDARULUI (user, 13.09.2026, 01:26: „sunt felul cum afectează rolul
 * userului a ce vede în app"): neautentificatul niciunul, utilizatorul cele două cruci ale
 * calendarului oficial, adminul și „Sfinți cu evlavie", lista parohiei.
 *
 * Proba păzește trei lucruri deodată, fiindcă toate se pot strica singure:
 *   - treapta însăși (cine ce poate FILTRA) — neatinsă de la 13.09.2026;
 *   - forma butonului fără drept — palit (`.gol`), NU lipsă (regula userului: „se ascund și strică
 *     interfața"). Un `display:none` strecurat aici ar trece neobservat la citirea codului;
 *   - ⚠️ ȘI SINGURA ABATERE DE LA EA, cerută pe 15.09.2026: a treia cruce („Sfinți cu evlavie") NU
 *     se mai scrie palită celor fără drept — nu se scrie deloc. Userul a spus-o pe trepte:
 *     neautentificatul „să nu vadă ultima cruce deloc", utilizatorul „să nu vadă ultima cruce dar să
 *     poată apăsa celelalte două", adminul „să vadă toate 3 crucile și să le poată apăsa".
 *     Primele două cruci rămân cum erau: palite la neautentificat, apăsabile la restul.
 */
const NAV = { home: '/', cont: '/cont', admin: '/admin' } as unknown as Ctx['nav']

function ctx(utilizator: string | null, eAdmin: boolean): Ctx {
  return { prefix: '/calendar', nav: NAV, utilizator, eAdmin, versiune: '0', modificata: '', anCurent: 2026 }
}

const ANONIM = ctx(null, false)
const UTILIZATOR = ctx('enoriaș@exemplu.ro', false)
const ADMIN = ctx('rubikmm@gmail.com', true)

/** Câte cruci sunt apăsabile (`<a>`) și câte palite, în bara paginii de lună. */
function bara(c: Ctx) {
  const html = paginaLuna({ ctx: c, an: 2026, luna: 9, randuri: [], calculat: false, azi: '2026-09-13' })
  return {
    apasabile: [...html.matchAll(/<a class="btn mic sarb sarb-(\w+)"/g)].map((m) => m[1]),
    palite: [...html.matchAll(/<span class="btn mic sarb sarb-(\w+) gol"/g)].map((m) => m[1]),
  }
}

describe('filtrele calendarului — treptele rolului', () => {
  it('neautentificatul n-are niciun filtru', () => {
    expect(poateFiltra(ANONIM, 'rosie')).toBe(false)
    expect(poateFiltra(ANONIM, 'neagra')).toBe(false)
    expect(poateFiltra(ANONIM, 'evlavie')).toBe(false)
  })

  it('utilizatorul are cele două cruci, nu și evlavia', () => {
    expect(poateFiltra(UTILIZATOR, 'rosie')).toBe(true)
    expect(poateFiltra(UTILIZATOR, 'neagra')).toBe(true)
    expect(poateFiltra(UTILIZATOR, 'evlavie')).toBe(false)
  })

  it('adminul le are pe toate trei', () => {
    for (const fel of ['rosie', 'neagra', 'evlavie'] as const) expect(poateFiltra(ADMIN, fel)).toBe(true)
  })

  it('primele două cruci se sting, nu se ascund', () => {
    expect(bara(ANONIM).palite).toEqual(['rosie', 'neagra'])
    expect(bara(UTILIZATOR).apasabile).toEqual(['rosie', 'neagra'])
  })

  it('a treia cruce NU se vede decât la admin — nici palită (user, 15.09.2026)', () => {
    expect(poateVedeaFiltrul(ANONIM, 'evlavie')).toBe(false)
    expect(poateVedeaFiltrul(UTILIZATOR, 'evlavie')).toBe(false)
    expect(poateVedeaFiltrul(ADMIN, 'evlavie')).toBe(true)
    // în pagină: nicăieri, nici ca link, nici ca buton palit
    expect(bara(ANONIM)).toEqual({ apasabile: [], palite: ['rosie', 'neagra'] })
    expect(bara(UTILIZATOR)).toEqual({ apasabile: ['rosie', 'neagra'], palite: [] })
    expect(bara(ADMIN)).toEqual({ apasabile: ['rosie', 'neagra', 'evlavie'], palite: [] })
  })

  it('primele două cruci rămân văzute de oricine — abaterea e numai a evlaviei', () => {
    for (const c of [ANONIM, UTILIZATOR, ADMIN]) {
      expect(poateVedeaFiltrul(c, 'rosie')).toBe(true)
      expect(poateVedeaFiltrul(c, 'neagra')).toBe(true)
    }
  })

  /**
   * ⚠️ Ascunderea butonului NU e o poartă. Proba asta păzește tocmai asta: `poateFiltra` — cel care
   * taie și `?filtru=evlavie` scris de mână — rămâne `false` pentru cine n-are dreptul, oricât s-ar
   * schimba ce se vede în bară.
   */
  it('ascunsul butonului nu slăbește poarta filtrului', () => {
    expect(poateFiltra(ANONIM, 'evlavie')).toBe(false)
    expect(poateFiltra(UTILIZATOR, 'evlavie')).toBe(false)
  })
})
