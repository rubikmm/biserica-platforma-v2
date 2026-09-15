import { describe, expect, it } from 'vitest'
import { paginaLuna, type Ctx } from '../apps/calendar/src/pagini.js'

/**
 * DERULAREA LA ZIUA DE AZI — proba care păzește o CURSĂ, nu o funcție.
 *
 * ⚠️ Cursa (găsită de user, 15.09.2026, întâi pe telefon, apoi confirmată și pe desktop): la prima
 * venire în pagină ziua rămânea lipită de antet, nu la mijloc; abia a doua apăsare pe „Astăzi" o
 * centra. Se băteau trei lucruri:
 *   1. cu ancora #azi în adresă, browserul își face singur saltul la ea, sub antet
 *      (scroll-padding-top), și saltul lui venea DUPĂ centrarea noastră;
 *   2. carcasa are scroll-behavior:smooth, deci saltul acela e o animație care înghite o centrare
 *      pornită în timpul ei;
 *   3. măsurarea se făcea înainte ca pagina să se așeze (fonturi, poze).
 *
 * Nu se poate proba cu adevărat fără un browser — dar se pot păzi cele trei leacuri, fiindcă toate
 * trei arată a cod „de prisos" la o citire grăbită și oricare ar reface boala dacă e scos:
 *   - așezarea de la intrare e INSTANTANEE (o săritură instantanee taie animația browserului);
 *   - se repetă după `load`, nu o singură dată la început;
 *   - linul e stins cât ținem noi cârma (clasa `fara-lin`).
 */
const NAV = { home: '/', cont: '/cont', admin: '/admin' } as unknown as Ctx['nav']
const CTX: Ctx = { prefix: '/calendar', nav: NAV, utilizator: null, eAdmin: false, versiune: '0', modificata: '', anCurent: 2026 }

const pagina = (laAzi?: boolean) =>
  paginaLuna({ ctx: CTX, an: 2026, luna: 9, randuri: [], calculat: false, azi: '2026-09-13', ...(laAzi ? { laAzi } : {}) })

describe('derularea la ziua de azi', () => {
  it('așezarea de la intrare e instantanee, nu lină', () => {
    expect(pagina()).toContain("behavior: lin ? 'smooth' : 'instant'")
  })

  it('se repetă după `load`, nu doar la început', () => {
    const html = pagina()
    expect(html).toContain("window.addEventListener('load', asazaAzi)")
    // ⚠️ dacă pagina e deja încărcată când rulează scriptul, `load` nu mai vine niciodată
    expect(html).toContain("document.readyState === 'complete'")
  })

  it('stinge derularea lină cât ține cârma, și o dă înapoi', () => {
    const html = pagina()
    expect(html).toContain("radacina.classList.add('fara-lin')")
    expect(html).toContain("radacina.classList.remove('fara-lin')")
    // clasa trebuie să și facă ceva: regula stă în stilul aplicației
    expect(html).toContain('html.fara-lin { scroll-behavior:auto }')
  })

  /**
   * ⚠️ Semnul „am intrat acum în aplicație" e clasa de pe corp, pusă de server NUMAI la adresa fără
   * lună. Pe o lună aleasă de om, o săritură nesolicitată ar fi o răpire.
   */
  it('derularea de la intrare se cere numai la adresa fără lună', () => {
    expect(pagina(true)).toContain('<body class="la-azi">')
    expect(pagina()).not.toContain('la-azi"')
  })

  it('apăsarea butonului rămâne lină — acolo pagina e deja așezată', () => {
    expect(pagina()).toContain('laAzi(true)')
  })
})
