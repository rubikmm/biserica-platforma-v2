import { describe, expect, it } from 'vitest'
import { paginaArhiva, paginaMesaj, type Ctx, type Meniu } from '../apps/program/src/pagini.js'

/**
 * FÂȘIA ANILOR pe paginile Arhivei — probă care păzește o REGULĂ DE DRUM, nu o funcție.
 *
 * ⚠️ Cererea userului (15.09.2026, 18:56): „scoate din pagină anii atunci când ne aflăm în arhivă și
 * să faci bara cu ani, care apare sub antet, permanent vizibilă cât mă aflu pe o pagină arhivă".
 * Cele două jumătăți SE ȚIN UNA DE ALTA: rândul de ani din corpul paginii (`nav.capitole`) a fost
 * scos, deci fâșia de sub antet a rămas SINGURUL drum dintre ani. Dacă cineva îi pune la loc
 * `hidden`, ori face cheia Arhivei să o poată strânge, ori o ascunde de omul fără drepturi de admin
 * (adresa /arhiva n-a fost niciodată încuiată, iar pagina de mesaj o dă ca link tuturor), omul rămâne
 * închis într-un singur an, fără să se vadă vreo eroare nicăieri. De aceea sunt probate aici.
 */
const NAV = { home: '/', cont: '/cont', admin: '/admin' } as unknown as Ctx['nav']
const ctxCu = (eAdmin: boolean): Ctx =>
  ({ prefix: '/program', nav: NAV, utilizator: eAdmin ? 'Admin' : null, eAdmin, versiune: '0', modificata: '' })

const MENIU: Meniu = { luni: null, foaie: null, azi: '2026-09-15' }
const ANI = [2026, 2025, 2024]

const arhiva = (eAdmin: boolean) =>
  paginaArhiva({ ctx: ctxCu(eAdmin), an: 2025, ani: ANI, saptamani: [], meniu: MENIU })

/** cheia Arhivei din pastilă, așa cum e scrisă în pagină (sau `''` dacă pagina n-o are deloc) */
const cheia = (html: string) => /<button[^>]*id="ani-cheie"[^>]*>/.exec(html)?.[0] ?? ''

describe('fâșia anilor pe pagina Arhivei', () => {
  it('se scrie COBORÂTĂ (fără hidden) și cu anul de pe ecran însemnat', () => {
    const html = arhiva(true)
    expect(html).toContain('<div class="bara-ani" id="bara-ani"><div class="fasie">')
    expect(html).not.toContain('id="bara-ani" hidden')
    expect(html).toContain('class="an-buton activ"')
  })

  it('cheia Arhivei e INERTĂ acolo: n-are ce strânge, deci nu se dă drept apăsabilă', () => {
    const c = cheia(arhiva(true))
    expect(c).toContain('aria-expanded="true"')
    expect(c).toContain('aria-disabled="true"')
    // JS-ul nu-i pune ascultătorul de apăsare tocmai după semnul acesta
    expect(arhiva(true)).toContain('if (cheie && cheie.getAttribute("aria-disabled") !== "true")')
  })

  it('rândul de ani din CORPUL paginii a fost scos', () => {
    expect(arhiva(true)).not.toContain('class="capitole"')
  })

  // user, 19:22: „scoate textul acesta de la Arhiva" — numărătoarea de sub titlu. Nu o readuce.
  it('sub titlu nu mai stă numărătoarea săptămânilor', () => {
    expect(arhiva(true)).not.toContain('până azi')
  })

  it('omul fără drepturi de admin o primește și el: altfel rămâne închis într-un singur an', () => {
    const html = arhiva(false)
    expect(html).toContain('<div class="bara-ani" id="bara-ani"><div class="fasie">')
    // cheia rămâne a adminilor — bara stă singură sub rândul de unelte, iar JS-ul o duce și așa
    expect(cheia(html)).toBe('')
    expect(html).toContain('if (!bara || !fasie) return;')
  })
})

describe('fâșia anilor pe celelalte pagini', () => {
  const html = () => paginaMesaj(ctxCu(true), 'Dată greșită', 'Adresa e /saptamana/AAAA-LL-ZZ.', 'rea', { ...MENIU, ani: ANI })

  it('pornește ascunsă, iar cheia rămâne cheie', () => {
    expect(html()).toContain('id="bara-ani" hidden')
    const c = cheia(html())
    expect(c).toContain('aria-expanded="false"')
    expect(c).not.toContain('aria-disabled')
  })
})
