import { describe, expect, it } from 'vitest'
import { paginaCautare, paginaLuna, type Ctx } from '../apps/calendar/src/pagini.js'

/**
 * LUPA DIN PASTILA CALENDARULUI (user, 15.09.2026: „să avem o iconiță lupă de căutare înainte de
 * cruce").
 *
 * Proba păzește patru lucruri care se pot strica singure, fiecare din alt motiv:
 *   - LOCUL: lupa stă între cheia lunilor și cruce. Ordinea segmentelor pastilei a fost rescrisă de
 *     user de vreo trei ori într-o zi (15.09.2026), deci e genul de lucru care se mută din greșeală;
 *   - DREPTUL: lupa NU atârnă de rol, spre deosebire de cruce (13.09.2026). Căutarea e tot citit, iar
 *     cititul e la liber — dacă cineva „aliniază" lupa la treptele crucii, neautentificatul o pierde;
 *   - FORMULARUL: căutarea e un `<form method="get">` adevărat, deci merge și fără JavaScript, iar
 *     rezultatul are adresă. Legat de JS, ar fi mers doar cu JS și n-ar fi putut fi dat mai departe;
 *   - PRAGUL: sub trei litere nu se caută (același prag ca la `/v1/cauta`), iar omul află de ce.
 */
const NAV = { home: '/', cont: '/cont', admin: '/admin' } as unknown as Ctx['nav']

function ctx(utilizator: string | null, eAdmin: boolean): Ctx {
  return { prefix: '/calendar', nav: NAV, utilizator, eAdmin, versiune: '0', modificata: '', anCurent: 2026 }
}

const ANONIM = ctx(null, false)
const ADMIN = ctx('rubikmm@gmail.com', true)

const luna = (c: Ctx) => paginaLuna({ ctx: c, an: 2026, luna: 9, randuri: [], calculat: false, azi: '2026-09-13' })
const cautare = (q: string, preScurt = false) =>
  paginaCautare({ ctx: ANONIM, q, an: 2026, randuri: [], azi: '2026-09-13', preScurt })

describe('lupa de căutare din pastilă', () => {
  it('stă după cheia lunilor și ÎNAINTE de cruce', () => {
    const html = luna(ADMIN)
    const calendar = html.indexOf('id="luni-cheie"')
    const lupa = html.indexOf('id="cautare-cheie"')
    const cruce = html.indexOf('class="filtre" id="filtre"')
    expect(calendar).toBeGreaterThan(-1)
    expect(lupa).toBeGreaterThan(calendar)
    expect(cruce).toBeGreaterThan(lupa)
  })

  /**
   * ⚠️ Crucea îi lipsește neautentificatului (e stinsă, fără meniu); lupa nu. Sunt două lucruri
   * deosebite: una TAIE lista după însemnul zilei, cealaltă doar o caută.
   */
  it('o vede oricine, și neautentificatul', () => {
    expect(luna(ANONIM)).toContain('id="cautare-cheie"')
  })

  it('coboară o bară, nu duce nicăieri singură', () => {
    const html = luna(ANONIM)
    expect(html).toContain('aria-controls="bara-cautare"')
    // bara e ascunsă până se apasă lupa
    expect(html).toMatch(/<div class="bara-cautare" id="bara-cautare" hidden>/)
  })

  it('cele două bare de sub antet se exclud', () => {
    const html = luna(ANONIM)
    expect(html).toContain('ridica(baraCauta, cheieCauta)')
    expect(html).toContain('ridica(bara, cheie)')
  })
})

describe('căutarea însăși', () => {
  it('e un formular GET adevărat, deci merge și fără JavaScript', () => {
    const html = luna(ANONIM)
    expect(html).toContain('method="get" action="/calendar/cauta"')
    expect(html).toContain('name="q"')
    // anul călătorește cu întrebarea: se caută în anul paginii de pe care pleci
    expect(html).toContain('<input type="hidden" name="an" value="2026">')
  })

  it('pe pagina rezultatelor bara vine deschisă, cu întrebarea în câmp', () => {
    const html = cautare('Nicolae')
    expect(html).toContain('<div class="bara-cautare" id="bara-cautare">')
    expect(html).toContain('value="Nicolae"')
  })

  it('sub trei litere nu se caută, și se spune de ce', () => {
    expect(cautare('Ni', true)).toContain('Scrie cel puțin trei litere.')
  })

  it('fără niciun rezultat spune unde a căutat, nu doar că n-a găsit', () => {
    const html = cautare('Zzz')
    expect(html).toContain('Nimic în 2026 pentru „Zzz”')
  })

  /** Întrebarea omului ajunge în pagină în trei locuri — niciunul fără `esc`. */
  it('întrebarea se scrie escapată', () => {
    const html = cautare('<script>x</script>')
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  /** Lista de rezultate e conținutul calendarului tăiat după o întrebare: nu se dă la indexat. */
  it('nu se dă la indexat', () => {
    expect(cautare('Nicolae')).toContain('noindex')
  })
})
