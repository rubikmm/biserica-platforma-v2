import { describe, expect, it } from 'vitest'
import { pagina } from '../packages/ui/src/index.js'

/**
 * Carcasa, partea care ține de masca „vezi ca". De la 11.09.2026 banda roșie de jos nu mai există
 * (user: „să dispară banner-ul de jos"), deci tot ce spune că masca e pusă — și tot ce o scoate —
 * stă în meniul de cont. Probele de aici păzesc exact drumul de întoarcere: dacă se rupe, un
 * super-admin mascat rămâne închis afară și trebuie să scrie de mână /cont/vezi-ca?ca=real.
 */
/** Doar corpul paginii: în `<head>` stau stilul și comentariile lui, în care cuvintele căutate aici
 *  („Vezi ca", `cont-acum`) apar oricum, fără să însemne că se și vede ceva pe ecran. */
function randeaza(cont: Record<string, unknown>): string {
  const html = pagina({ nume: 'PROGRAMUL', titlu: 'Programul liturgic', corp: '<p>ceva</p>', cont })
  return html.slice(html.indexOf('</head>'))
}

const SUPER_ADMIN = { intrat: true, nume: 'rubikmm@gmail.com', admin: true, urlCont: '/cont', urlAdmin: '/admin', poateVedeaCa: true, spre: '/program/' }

describe('carcasă — masca „vezi ca"', () => {
  it('nu mai desenează banda de jos, sub nicio mască', () => {
    for (const masca of [null, 'user', 'admin', 'anonim']) {
      expect(randeaza({ ...SUPER_ADMIN, veziCa: masca })).not.toContain('banda-vezica')
    }
  })

  // ⚠️ De la 12.09.2026 cele trei rânduri se numesc „→ Utilizator" / „→ Administrator" /
  // „→ Neautentificat" (user: „în loc de «vezi ca…» să fie o săgeată"). Doar numele s-a schimbat.
  it('super-adminul nemascat are cele trei comutatoare, niciunul aprins', () => {
    const html = randeaza({ ...SUPER_ADMIN, veziCa: null })
    expect(html).toContain('→ Utilizator')
    expect(html).toContain('→ Administrator')
    expect(html).toContain('→ Neautentificat')
    expect(html).not.toContain('cont-acum')
    expect(html).not.toContain('Revino la super admin')
  })

  it('masca purtată e scrisă roșu și, apăsată din nou, scoate masca', () => {
    const html = randeaza({ ...SUPER_ADMIN, veziCa: 'user' })
    expect(html).toContain('<a class="cont-acum" href="/cont/vezi-ca?ca=real&spre=%2Fprogram%2F"')
    // rândul aprins rămâne „→ Utilizator", nu se schimbă în „Te uiți ca…" (user, 11.09.2026)
    expect(html).toMatch(/class="cont-acum"[^>]*>→ Utilizator</)
    expect(html).not.toContain('Revino la super admin')
  })

  it('numele din antet e roșu cât timp masca e pusă, și numai atunci', () => {
    expect(randeaza({ ...SUPER_ADMIN, veziCa: 'admin' })).toContain('<summary class="cont mascat">')
    expect(randeaza({ ...SUPER_ADMIN, veziCa: null })).toContain('<summary class="cont">')
  })

  it('sub masca „neautentificat" meniul rămâne, ca să existe drum de întoarcere', () => {
    const html = randeaza({ intrat: false, nume: 'Cont', urlCont: '/cont', poateVedeaCa: true, veziCa: 'anonim', spre: '/program/' })
    expect(html).toContain('cont-meniu')
    expect(html).toMatch(/class="cont-acum"[^>]*>→ Neautentificat</)
    expect(html).toContain('/cont/vezi-ca?ca=real')
    // nimic din contul adevărat nu se vede: nici profilul, nici ieșirea, nici administrarea
    expect(html).not.toContain('Profil')
    expect(html).not.toContain('Ieșire')
  })

  it('enoriașul neintrat vede doar linkul de intrare', () => {
    const html = randeaza({ intrat: false, nume: 'Cont', urlCont: '/cont', poateVedeaCa: false, veziCa: null, spre: '/program/' })
    expect(html).toContain('/cont/auth/login')
    expect(html).not.toContain('Vezi ca')
    // `cont-meniu` singur apare și în JS-ul comun al carcasei; aici ne uităm la meniul desenat
    expect(html).not.toContain('<details class="cont-meniu">')
  })
})
