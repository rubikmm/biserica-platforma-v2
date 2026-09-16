import { describe, expect, it } from 'vitest'
import { bucataDeAcasa, paginaText, textScurt, type Text } from '../apps/home/src/chinonic.js'

/**
 * FORMA FIȘEI de la „Texte citite la chinonic" (user, 16.09.2026): „titlu + autor (Sinaxar sau fără
 * autor ca excepție) + text scurt + citește tot (desfășurare) + Sursa: [carte] + site (cu url-ul pus
 * efectiv) — dacă e 404 acel url să nu se pună, așa știu că nu mai era valabil linkul".
 *
 * Probele de aici păzesc tocmai regulile care se pot strica în tăcere: un link scris peste o adresă
 * moartă arată în cod la fel de bine ca unul bun, iar „Citește tot" pus la un text care n-a fost adus
 * duce omul la un fragment.
 */

const deBaza: Text = {
  slug: 'viata-sfintei-cuvioase-parascheva',
  titlu: 'Viața Sfintei Cuvioase Parascheva',
  autor: 'Sinaxar',
  citit_la: '2025-10-14',
  fragment: '<p>Această cuvioasă maică a noastră Parascheva s-a născut într-un sat…</p>',
  text_intreg: `<p>${'Această cuvioasă maică a noastră Parascheva s-a născut într-un sat din Tracia. '.repeat(12)}</p>`,
  stare_text: 'gata',
  sursa_text: 'Proloagele, vol. I, Editura Bunavestire',
  sursa_nume: 'doxologia.ro',
  sursa_url: 'https://doxologia.ro/vietile-sfintilor/sinaxar/viata-sfintei-cuvioase-parascheva',
  sursa_fel: 'pagina',
  poza: '',
  link_stare: 'viu',
}

const lista = (t: Text) => bucataDeAcasa([t], 448)

describe('cele cinci lucruri ale unei fișe', () => {
  it('titlul, autorul, bucata scurtă, „Citește tot" și sursa — toate, în ordine', () => {
    const h = lista(deBaza)
    expect(h).toContain('Viața Sfintei Cuvioase Parascheva')
    expect(h).toContain('Sinaxar')
    expect(h).toContain('ch-scurt')
    expect(h).toContain('Citește tot')
    expect(h).toContain('Sursa:')
    expect(h.indexOf('ch-titlu')).toBeLessThan(h.indexOf('ch-autor'))
    expect(h.indexOf('ch-autor')).toBeLessThan(h.indexOf('ch-scurt'))
    expect(h.indexOf('ch-scurt')).toBeLessThan(h.indexOf('ch-sursa'))
  })

  it('autorul lipsă se scrie „Fără autor", nu se lasă gol', () => {
    expect(lista({ ...deBaza, autor: '' })).toContain('Fără autor')
  })

  it('bucata scurtă e text curat, tăiat la cuvânt — nu HTML și nu cuvinte rupte', () => {
    const s = textScurt(deBaza)
    expect(s).not.toContain('<p>')
    expect(s.length).toBeLessThan(420)
    expect(s).toMatch(/[.!?…]$/) // se opreste curat: ori la capat de propozitie, ori cu „…"
    expect(s).not.toMatch(/[.!?]…$/) // dar nu amandoua deodata
    // taietura cade intre cuvinte: ultimul cuvant al bucatii e intreg si in text
    const ultimul = s.replace(/…$/, '').split(' ').at(-1) ?? ''
    expect(textScurt({ ...deBaza, text_intreg: deBaza.text_intreg })).toContain(ultimul)
  })
})

describe('⚠️ legătura spre sursă se scrie numai cât timp adresa trăiește', () => {
  it('adresă vie → legătura e pusă efectiv', () => {
    const h = lista(deBaza)
    expect(h).toContain(`href="${deBaza.sursa_url}"`)
    expect(h).toContain('doxologia.ro')
  })

  it('404 → numele rămâne, adresa NU se mai pune', () => {
    const h = lista({ ...deBaza, link_stare: 'mort' })
    expect(h).not.toContain(deBaza.sursa_url)
    expect(h).toContain('doxologia.ro') // numele se scrie mai departe, pentru cinstirea sursei
    expect(h).toContain('Proloagele, vol. I, Editura Bunavestire')
  })

  it('adresa care n-a răspuns deloc se poartă ca una moartă', () => {
    expect(lista({ ...deBaza, link_stare: 'picat' })).not.toContain(deBaza.sursa_url)
  })

  it('cartea se scrie și când nu există niciun site', () => {
    const h = lista({ ...deBaza, sursa_nume: '', sursa_url: '', link_stare: '' })
    expect(h).toContain('Proloagele, vol. I, Editura Bunavestire')
    expect(h).not.toContain('ch-drum')
  })
})

describe('⚠️ „Citește tot" e marcajul textului întreg', () => {
  it('textul adus și trecut prin probă → se poate citi tot', () => {
    expect(lista(deBaza)).toContain('Citește tot')
  })

  it('text neadus → se spune limpede că e doar bucata din buletin', () => {
    const h = lista({ ...deBaza, stare_text: 'fara-text', text_intreg: '' })
    expect(h).not.toContain('Citește tot')
    expect(h).toContain('Doar bucata citită la strană')
  })

  it('text „nesigur" nu trece drept întreg — proba e a userului', () => {
    const h = lista({ ...deBaza, stare_text: 'nesigur' })
    expect(h).not.toContain('Citește tot')
  })

  it('bucata scurtă vine din fragment când textul întreg lipsește', () => {
    const t = { ...deBaza, stare_text: 'fara-text', text_intreg: '' }
    expect(textScurt(t)).toContain('Această cuvioasă maică')
  })
})

describe('pagina unui text', () => {
  it('titlu, autor sub el, apoi textul întreg', () => {
    const h = paginaText(deBaza, '')
    expect(h.indexOf('titlu-lista')).toBeLessThan(h.indexOf('ch-autorul'))
    expect(h.indexOf('ch-autorul')).toBeLessThan(h.indexOf('ch-text'))
    expect(h).not.toContain('ch-fragment')
  })

  it('fără textul întreg, fișa spune că e doar bucata citită', () => {
    const h = paginaText({ ...deBaza, stare_text: 'eroare', text_intreg: '' }, '')
    expect(h).toContain('ch-fragment')
    expect(h).toContain('Textul întreg încă n-a fost adus')
  })
})
