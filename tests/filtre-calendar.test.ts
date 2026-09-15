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

/**
 * Ce scrie în MENIUL crucii, pe pagina unei luni: rândurile apăsabile (`<a>`) și cele palite.
 *
 * ⚠️ Din 15.09.2026 filtrele nu mai sunt trei butoane în rând, ci **o singură cruce la dreapta cu un
 * meniu sub ea** (user: „fă o singură cruce la dreapta, pe care, atunci când apeși, să apară un mic
 * meniu"), ca să încapă data din pastilă — vezi `meniulFiltrelor`. Treptele n-au fost atinse.
 */
function bara(c: Ctx) {
  const html = paginaLuna({ ctx: c, an: 2026, luna: 9, randuri: [], calculat: false, azi: '2026-09-13' })
  return {
    apasabile: [...html.matchAll(/<a class="f-rand f-(\w+)"/g)].map((m) => m[1]),
    palite: [...html.matchAll(/<span class="f-rand f-(\w+) gol"/g)].map((m) => m[1]),
  }
}

/** Numele scrise în meniu, în ordinea lor. Userul le-a dictat cuvânt cu cuvânt (15.09.2026). */
function numeleDinMeniu(c: Ctx): string[] {
  const html = paginaLuna({ ctx: c, an: 2026, luna: 9, randuri: [], calculat: false, azi: '2026-09-13' })
  return [...html.matchAll(/<span class="f-text"><b>([^<]+)<\/b>/g)].map((m) => m[1]!)
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

  it('utilizatorul are cele două rânduri apăsabile', () => {
    expect(bara(UTILIZATOR).apasabile).toEqual(['rosie', 'neagra'])
  })

  /**
   * ⚠️ CINE N-ARE NICIUN FILTRU APĂSABIL VEDE CRUCEA STINSĂ, FĂRĂ MENIU (user, 15.09.2026: „să se
   * afișeze disabled, doar să nu mai afișeze nimic atunci când apeși pe ea… să nu reacționeze nici
   * la apăsare și să nu afișeze butoanele de sub ea din meniul ei").
   *
   * Proba păzește mai ales că NU e un `<details>`: unul „dezactivat" nu există în HTML, s-ar deschide
   * oricum la apăsare, iar oprirea ar fi căzut pe JS — deci ar fi mers doar cu JS.
   */
  it('neautentificatul vede crucea stinsă, fără meniu sub ea', () => {
    const html = paginaLuna({ ctx: ANONIM, an: 2026, luna: 9, randuri: [], calculat: false, azi: '2026-09-13' })
    expect(html).toContain('class="btn mic sarb sarb-cheie gol" aria-disabled="true"')
    expect(html).not.toContain('<details class="filtre"')
    // ⚠️ se caută MARCAJUL, nu cuvântul: „filtre-meniu" e și în stil, pe orice pagină
    expect(html).not.toContain('<div class="filtre-meniu"')
    // nici măcar rândurile palite: meniul nu există deloc
    expect(bara(ANONIM)).toEqual({ apasabile: [], palite: [] })
  })

  /**
   * ⚠️ O SINGURĂ CRUCE ÎN RÂND, cu meniu (user, 15.09.2026). Pricina e spațiul: cele trei butoane
   * mâncau rândul și data din pastilă nu mai încăpea pe telefon. Dacă proba asta pică fiindcă au
   * reapărut trei butoane, s-a întors și înghesuiala — măsoară rândul înainte s-o ștergi.
   */
  it('în rând e o singură cruce, iar meniul e un <details> (merge și fără JS)', () => {
    const html = paginaLuna({ ctx: ADMIN, an: 2026, luna: 9, randuri: [], calculat: false, azi: '2026-09-13' })
    expect([...html.matchAll(/class="btn mic sarb sarb-cheie/g)]).toHaveLength(1)
    expect(html).toContain('<details class="filtre" id="filtre">')
    // rândurile sunt legături adevărate, nu butoane care cer JavaScript
    expect(html).toContain('<a class="f-rand f-rosie" role="menuitem" href="/calendar/2026-09?filtru=rosie">')
  })

  it('meniul scrie exact ce a dictat userul', () => {
    expect(numeleDinMeniu(ADMIN)).toEqual([
      'Sfinți cu cruce roșie',
      'Sfinți cu cruce neagră',
      'Sfinți cu evlavie',
    ])
    // la cine n-are evlavia, rândul ei lipsește cu totul — celelalte două rămân scrise
    expect(numeleDinMeniu(UTILIZATOR)).toEqual(['Sfinți cu cruce roșie', 'Sfinți cu cruce neagră'])
  })

  /** Crucea închisă trebuie să spună că lista de sub ea e tăiată — altfel filtrul pus e nevăzut. */
  it('crucia din rând se aprinde când un filtru e pus', () => {
    const cu = paginaLuna({ ctx: ADMIN, an: 2026, luna: 9, randuri: [], calculat: false, azi: '2026-09-13', cruce: 'evlavie' })
    expect(cu).toContain('sarb-cheie activ sarb-evlavie')
    const fara = paginaLuna({ ctx: ADMIN, an: 2026, luna: 9, randuri: [], calculat: false, azi: '2026-09-13' })
    expect(fara).not.toContain('sarb-cheie activ')
  })

  it('„Sfinți cu evlavie" NU se scrie în meniu decât la admin — nici palit (user, 15.09.2026)', () => {
    expect(poateVedeaFiltrul(ANONIM, 'evlavie')).toBe(false)
    expect(poateVedeaFiltrul(UTILIZATOR, 'evlavie')).toBe(false)
    expect(poateVedeaFiltrul(ADMIN, 'evlavie')).toBe(true)
    // în meniu: nicăieri, nici ca legătură, nici ca rând palit
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
