import { describe, expect, it } from 'vitest'
import { bucataDeAcasa, paginaStare, paginaText, paginaToate, textScurt, type Rezumat, type Text } from '../apps/home/src/chinonic.js'

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

/**
 * LISTA MARE ȘI PAGINA DE STARE (user, 16.09.2026: „lista mare nu o mai fișa complet că se îngreunează
 * browser-ul — doar titlurile și autorul și OK-ul că are textul preluat și Sursa completată… iar
 * restul pe categorii… să scrie și din ce news sunt luate ca să investighez și eu").
 */
const rez: Rezumat = {
  slug: 'viata-sfintei-cuvioase-parascheva',
  titlu: 'Viața Sfintei Cuvioase Parascheva',
  autor: 'Sinaxar',
  citit_la: '2025-10-14',
  stare_text: 'gata',
  sursa_text: 'Proloagele, vol. I',
  sursa_nume: 'doxologia.ro',
  sursa_url: 'https://doxologia.ro/viata-sfintei-cuvioase-parascheva',
  sursa_fel: 'pagina',
  link_stare: 'viu',
  n_fragment: 900,
  n_text: 9600,
}

describe('lista mare e compactă', () => {
  it('⚠️ nu cară textele în pagină — numai titlu, autor și cele două bife', () => {
    const h = paginaToate([rez])
    expect(h).toContain('Viața Sfintei Cuvioase Parascheva')
    expect(h).toContain('Sinaxar')
    expect(h).toContain('✓ text')
    expect(h).toContain('✓ sursă')
    expect(h).not.toContain('ch-scurt') // bucata de text nu are ce cauta aici
    expect(h).not.toContain('Citește tot')
  })

  it('lipsurile se văd ca bife stinse, nu prin absență', () => {
    const h = paginaToate([{ ...rez, stare_text: 'fara-text', n_text: 0, sursa_text: '', sursa_nume: '', sursa_url: '' }])
    expect(h).toContain('— text')
    expect(h).toContain('— sursă')
  })
})

/**
 * FILTRUL PE ANI (user, 16.09.2026: „aici să avem o filtrare pe ani… totul ascuns în afară de ce e
 * selectat, la intrare prima opțiune selectată"). Ce se poate strica în tăcere: bara să rămână, dar
 * pagina să scrie mai departe TOATE rândurile — filtrul ar arăta ca și cum ar merge.
 */
describe('lista mare se filtrează pe ani', () => {
  const vechi: Rezumat = { ...rez, slug: 'cuvant-vechi', titlu: 'Cuvânt din 2019', citit_la: '2019-03-10' }
  const nou: Rezumat = { ...rez, slug: 'cuvant-nou', titlu: 'Cuvânt din 2026', citit_la: '2026-01-11' }

  it('la intrare e deschis anul cel mai nou, iar ceilalți ani sunt doar butoane', () => {
    const h = paginaToate([nou, rez, vechi])
    expect(h).toContain('Cuvânt din 2026')
    expect(h).not.toContain('Cuvânt din 2019') // ⚠️ ascuns, nu doar mutat mai jos
    expect(h).not.toContain('Viața Sfintei Cuvioase Parascheva')
    expect(h).toContain('?an=2019') // dar se poate ajunge la el dintr-o apăsare
    expect(h).toContain('?an=2025')
  })

  it('anul cerut din adresă e cel scris — și numai el', () => {
    const h = paginaToate([nou, rez, vechi], '2019')
    expect(h).toContain('Cuvânt din 2019')
    expect(h).not.toContain('Cuvânt din 2026')
    expect(h).toContain('aria-current="page"')
  })

  it('un an care nu există cade pe cel mai nou, nu pe o pagină goală', () => {
    expect(paginaToate([nou, vechi], '1999')).toContain('Cuvânt din 2026')
    expect(paginaToate([nou, vechi], null)).toContain('Cuvânt din 2026')
  })
})

describe('pagina de stare — locul de investigat', () => {
  const numere = new Map([['viata-sfintei-cuvioase-parascheva', { id: 617, nr: 534, trimis: '2025-10-14', texte: ['viata-sfintei-cuvioase-parascheva'] }]])
  const stricat: Rezumat = { ...rez, stare_text: 'fara-text', n_text: 0, autor: '', link_stare: 'mort' }

  it('fiecare categorie își numără textele și le dă rând scurt', () => {
    const h = paginaStare([stricat], numere, 'https://newsletter.sfantul-ilie.ro')
    expect(h).toContain('Fără textul întreg')
    expect(h).toContain('Fără autor')
    expect(h).toContain('Cu adresa sursei moartă')
    expect(h).toContain('adresa sursei nu mai există (404)')
  })

  /**
   * ⚠️ O SINGURĂ CATEGORIE O DATĂ (user, 16.09.2026: „totul ascuns în afară de ce e selectat, la
   * intrare prima opțiune selectată"). Numele categoriilor rămân — ele sunt butoanele filtrului —,
   * deci proba se uită la RÂNDURI, nu la titluri: altfel ar trece și cu pagina veche, întreagă.
   */
  it('se scrie numai categoria aleasă; restul rămân butoane cu numărul lor', () => {
    const altul: Rezumat = { ...rez, slug: 'cuvant-fara-autor', titlu: 'Cuvânt fără autor', autor: '' }
    const cuNumere = new Map([...numere, ['cuvant-fara-autor', { id: 700, nr: 600, trimis: '2026-02-01', texte: ['cuvant-fara-autor'] }]])
    const h = paginaStare([stricat, altul], cuNumere, '')
    expect(h).toContain('Viața Sfintei Cuvioase Parascheva') // e în prima categorie, „Fără textul întreg"
    expect(h).not.toContain('Cuvânt fără autor') // are text întreg — nu intră în categoria deschisă
    expect(h).toContain('?ce=fara-autor') // dar se ajunge la el dintr-o apăsare
  })

  it('categoria cerută din adresă e cea scrisă', () => {
    const altul: Rezumat = { ...rez, slug: 'cuvant-fara-autor', titlu: 'Cuvânt fără autor', autor: '' }
    const cuNumere = new Map([...numere, ['cuvant-fara-autor', { id: 700, nr: 600, trimis: '2026-02-01', texte: ['cuvant-fara-autor'] }]])
    const h = paginaStare([stricat, altul], cuNumere, '', 'fara-autor')
    expect(h).toContain('Cuvânt fără autor')
    expect(h).toContain('de căutat în pagina sursei')
  })

  /**
   * ⚠️ NUMAI TEXTELE LEGATE DE UN NUMĂR TRIMIS (user, 16.09.2026: „vreau să mă uit doar pe texte care
   * fac parte dintr-un anumit buletin online publicat și transmis… pune-le separat"). Un text fără
   * asociere iese din TOATE categoriile, nu doar capătă un rând mai stins.
   */
  it('textul fără număr de buletin iese din categorii și stă în a lui', () => {
    const orfan: Rezumat = { ...stricat, slug: 'text-fara-numar', titlu: 'Text fără număr' }
    const h = paginaStare([stricat, orfan], numere, '')
    expect(h).toContain('Viața Sfintei Cuvioase Parascheva')
    expect(h).not.toContain('Text fără număr') // scos din „Fără textul întreg", deși i s-ar potrivi
    expect(h).toContain('Fără număr de buletin')
    expect(paginaStare([stricat, orfan], numere, '', 'fara-numar')).toContain('Text fără număr')
  })

  it('⚠️ dacă Newsletterul tace, nimic nu se mută la „fără număr" — necunoașterea nu e lipsă', () => {
    const h = paginaStare([stricat], new Map(), '')
    expect(h).toContain('Viața Sfintei Cuvioase Parascheva')
    expect(h).not.toContain('Fără număr de buletin')
  })

  it('⚠️ scrie din ce număr de buletin vine, cu legătură spre el', () => {
    const h = paginaStare([stricat], numere, 'https://newsletter.sfantul-ilie.ro')
    expect(h).toContain('nr. 534')
    expect(h).toContain('https://newsletter.sfantul-ilie.ro/n/617')
  })

  it('fără asocieri (Newsletterul tace), pagina se scrie mai departe', () => {
    const h = paginaStare([stricat], new Map(), '')
    expect(h).toContain('număr necunoscut')
    expect(h).toContain('Fără textul întreg')
  })

  it('de pe fiecare rând se intră în fișă, ca să poată fi inspectat', () => {
    expect(paginaStare([stricat], numere, '')).toContain('/texte-citite-la-chinonic/viata-sfintei-cuvioase-parascheva')
  })

  it('un text întreg și cu autor nu apare în categoriile cu probleme', () => {
    const h = paginaStare([rez], numere, '')
    expect(h).toContain('Niciunul — categoria e goală.')
  })
})
