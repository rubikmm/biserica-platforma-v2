import { describe, expect, it } from 'vitest'
import { paginaLuna, poateFiltra, type Ctx } from '../apps/calendar/src/pagini.js'

/**
 * TREPTELE FILTRELOR DIN BARA CALENDARULUI (user, 13.09.2026, 01:26: „sunt felul cum afectează rolul
 * userului a ce vede în app"): neautentificatul niciunul, utilizatorul cele două cruci ale
 * calendarului oficial, adminul și „Sfinți cu evlavie", lista parohiei.
 *
 * Proba păzește două lucruri deodată, fiindcă amândouă se pot strica singure:
 *   - treapta însăși (cine ce poate filtra);
 *   - forma butonului fără drept — palit (`.gol`), NU lipsă (regula userului: „se ascund și strică
 *     interfața"). Un `display:none` strecurat aici ar trece neobservat la citirea codului.
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

  it('crucile fără drept se sting, nu se ascund — rândul are mereu toate trei', () => {
    expect(bara(ANONIM)).toEqual({ apasabile: [], palite: ['rosie', 'neagra', 'evlavie'] })
    expect(bara(UTILIZATOR)).toEqual({ apasabile: ['rosie', 'neagra'], palite: ['evlavie'] })
    expect(bara(ADMIN)).toEqual({ apasabile: ['rosie', 'neagra', 'evlavie'], palite: [] })
  })
})
