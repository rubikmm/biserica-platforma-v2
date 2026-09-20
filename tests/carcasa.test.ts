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

/**
 * ⚠️ `cod` e codul aplicației din registru (`program` aici). De el atârnă rândul „→ Administrator":
 * din 19.09.2026 masca de administrator e a APLICAȚIEI, deci carcasa trebuie să știe unde e.
 */
const SUPER_ADMIN = { intrat: true, nume: 'rubikmm@gmail.com', admin: true, urlCont: '/cont', urlAdmin: '/admin', cod: 'program', poateVedeaCa: true, spre: '/program/' }

describe('carcasă — masca „vezi ca"', () => {
  it('nu mai desenează banda de jos, sub nicio mască', () => {
    for (const masca of [null, 'user', 'admin:program', 'anonim']) {
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

  /**
   * ⚠️ Rândul de mijloc poartă CODUL APLICAȚIEI CURENTE (19.09.2026): „→ Administrator" din Program
   * cere `ca=admin:program`, nu un „admin" pe toată platforma — acela nu mai există.
   */
  it('rândul „→ Administrator" cere masca aplicației curente', () => {
    expect(randeaza({ ...SUPER_ADMIN, veziCa: null })).toContain('href="/cont/vezi-ca?ca=admin:program&spre=%2Fprogram%2F">→ Administrator<')
    expect(randeaza({ ...SUPER_ADMIN, cod: 'calendar', veziCa: null })).toContain('ca=admin:calendar')
  })

  /**
   * ⚠️ Fără `cod` (Contul, Administrarea — nu sunt aplicații administrabile) rândul LIPSEȘTE, dar
   * celelalte două rămân: altfel super-adminul din Cont ar rămâne fără drum de întoarcere.
   */
  it('fără cod de aplicație, rândul „→ Administrator" nu se scrie', () => {
    const html = randeaza({ ...SUPER_ADMIN, cod: undefined, veziCa: null })
    expect(html).not.toContain('→ Administrator')
    expect(html).not.toContain('ca=admin')
    expect(html).toContain('→ Utilizator')
    expect(html).toContain('→ Neautentificat')
  })

  it('un cod care nu e în registru se poartă ca și cum n-ar fi', () => {
    expect(randeaza({ ...SUPER_ADMIN, cod: 'aplicatie-inexistenta', veziCa: null })).not.toContain('→ Administrator')
  })

  /**
   * Masca de admin a ALTEI aplicații: rândul de aici rămâne apăsabil (schimbă masca), nu aprins —
   * altfel omul ar trebui să iasă din mască și s-o pună la loc ca să treacă dintr-o aplicație în alta.
   */
  it('masca altei aplicații lasă rândul de aici apăsabil, nu aprins', () => {
    const html = randeaza({ ...SUPER_ADMIN, veziCa: 'admin:curatenie' })
    expect(html).toContain('href="/cont/vezi-ca?ca=admin:program&spre=%2Fprogram%2F">→ Administrator<')
    expect(html).not.toMatch(/class="cont-acum"[^>]*>→ Administrator</)
  })

  it('masca aplicației curente e aprinsă și, apăsată din nou, se scoate', () => {
    const html = randeaza({ ...SUPER_ADMIN, veziCa: 'admin:program' })
    expect(html).toMatch(/class="cont-acum"[^>]*>→ Administrator</)
    expect(html).toContain('/cont/vezi-ca?ca=real&spre=%2Fprogram%2F')
    expect(html).toContain('Te uiți ca administrator al aplicației „Programul liturgic&quot;')
  })

  it('masca purtată e scrisă roșu și, apăsată din nou, scoate masca', () => {
    const html = randeaza({ ...SUPER_ADMIN, veziCa: 'user' })
    expect(html).toContain('<a class="cont-acum" href="/cont/vezi-ca?ca=real&spre=%2Fprogram%2F"')
    // rândul aprins rămâne „→ Utilizator", nu se schimbă în „Te uiți ca…" (user, 11.09.2026)
    expect(html).toMatch(/class="cont-acum"[^>]*>→ Utilizator</)
    expect(html).not.toContain('Revino la super admin')
  })

  it('numele din antet e roșu cât timp masca e pusă, și numai atunci', () => {
    expect(randeaza({ ...SUPER_ADMIN, veziCa: 'admin:program' })).toContain('<summary class="cont mascat">')
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

/**
 * REGULA FERESTRELOR (user, 13.09.2026): „popupul de abonare sau preview 3d-flip la buletin să
 * blocheze scrollul din spate … să fie o regulă generală când faci un pop-up".
 *
 * Pana atunci fiecare aplicatie si-o scria singura, si o scria GRESIT: `body.cu-fereastra{overflow:
 * hidden}`. Carcasa are `html{overflow-y:scroll}`, deci derularea e a radacinii, iar overflow-ul de
 * pe body nu se mai propaga la fereastra — clasa se punea, si pagina se derula mai departe.
 * Acum regula sta o singura data, in carcasa, pe <html>, si o capata ORICE <dialog> deschis cu
 * showModal(), fara ca aplicatia sa stie ceva. Probele de aici pazesc si locul, si generalitatea.
 */
describe('carcasă — ferestrele opresc derularea din spate', () => {
  const cap = pagina({ nume: 'PROGRAMUL', titlu: 'Programul liturgic', corp: '<p>ceva</p>' })

  it('regula de stil stă pe <html>, niciodată doar pe body', () => {
    expect(cap).toContain('html.cu-fereastra, html.cu-fereastra body { overflow:hidden')
    expect(cap).not.toContain('body.cu-fereastra {')
  })

  it('carcasa îmbracă showModal, deci orice fereastră nouă capătă regula fără s-o ceară', () => {
    expect(cap).toContain('HTMLDialogElement')
    expect(cap).toContain('D.prototype.showModal = function')
    // eliberarea vine din „close", ca sa acopere si Escape, si <form method="dialog">
    expect(cap).toMatch(/addEventListener\('close'/)
    // si o poarta pentru ferestrele care nu sunt <dialog> (panoul chatului)
    expect(cap).toContain('window.xcFereastra')
  })

  // Se prind amândouă felurile de blocare scrise de mână: clasa pe body (abonarea, răsfoitul) și
  // `overflow` pus direct pe corp (lupa copertei din bibliotecă). Amândouă erau degeaba.
  it('nicio aplicație nu-și mai scrie regula pe cont propriu', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const radacina = new URL('../', import.meta.url).pathname
    const vinovate: string[] = []
    const CARCASA = join(radacina, 'packages/ui/src/index.ts') // singurul loc unde regula ARE voie
    const umbla = (dosar: string) => {
      for (const nume of readdirSync(dosar)) {
        const cale = join(dosar, nume)
        if (statSync(cale).isDirectory()) { if (nume !== 'node_modules' && !nume.startsWith('.')) umbla(cale) }
        else if (nume.endsWith('.ts') && cale !== CARCASA
          && /body\.cu-fereastra|classList\.(add|remove)\((["'])cu-fereastra|body\.style\.overflow/.test(readFileSync(cale, 'utf8'))) {
          vinovate.push(cale.slice(radacina.length))
        }
      }
    }
    for (const dosar of ['apps', 'packages']) umbla(join(radacina, dosar))
    expect(vinovate).toEqual([])
  })
})
