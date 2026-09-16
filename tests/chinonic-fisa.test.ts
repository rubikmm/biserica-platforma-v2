import { describe, expect, it } from 'vitest'
import {
  CALE_BULETIN,
  CALE_STARE_BULETIN,
  bucataDeAcasa,
  caleaLui,
  dinBuletin,
  eBun,
  paginaBuletin,
  paginaStare,
  paginaText,
  paginaToate,
  type Rezumat,
  type Text,
} from '../apps/home/src/chinonic.js'

/**
 * TEXTELE CITITE LA CHINONIC — cele trei pagini și ce face fiecare (forma cerută de user, 16.09.2026,
 * seara): pe UȘĂ două categorii cu titlu și autor, în LISTĂ numai cele bune (pe ani), iar tot ce e de
 * lămurit într-o pagină de PROBLEME, cu filtru pe feluri de lipsă.
 *
 * Probele de aici păzesc tocmai regulile care se pot strica în tăcere: un link scris peste o adresă
 * moartă arată în cod la fel de bine ca unul bun, iar o listă care ar scrie și textele nebune s-ar
 * citi ca o treabă terminată.
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
/** Textul cuiva, adus, probat și cu sursa vie — cazul limpede de „bun". */
const bun: Rezumat = { ...rez, autor: 'Sfântul Ioan Gură de Aur' }
/** Același text, dar fără textul întreg adus — are ce căuta numai în pagina de probleme. */
const stricat: Rezumat = { ...bun, slug: 'cuvant-stricat', titlu: 'Cuvânt stricat', stare_text: 'fara-text', n_text: 0 }

/**
 * ⚠️⚠️ UȘA WEBSITE-ULUI: DOUĂ CATEGORII, TITLU ȘI AUTOR (user, 16.09.2026: „sub lista de aplicații să
 * afișezi cele două categorii articole-chinonic și articole-buletin doar titlul și autorul cu link —
 * 10 elemente + vezi toate"). Ce se poate strica în tăcere: să se întoarcă fișa bogată de dinainte
 * (bucată de text, „Citește tot", sursa), care îngreuna ușa, ori să urce pe ea texte nebune.
 */
describe('ușa Website-ului: două categorii, doar titlu și autor', () => {
  const pdf: Rezumat = {
    ...bun,
    slug: 'cuvant-din-pdf',
    titlu: 'Cuvânt din PDF-ul parohiei',
    sursa_fel: 'pdf',
    sursa_text: 'Fișier PDF',
    sursa_nume: '',
    sursa_url: 'https://newsletter.sfantul-ilie.ro/media/uploads/2022/01/Pr-Petroniu.pdf',
  }

  it('scrie amândouă categoriile, fiecare cu „Vezi toate" spre lista ei', () => {
    const h = bucataDeAcasa([bun], [pdf])
    expect(h).toContain('Texte citite la chinonic')
    expect(h).toContain('Texte din buletinul parohiei')
    expect(h).toContain('Viața Sfintei Cuvioase Parascheva')
    expect(h).toContain('Sfântul Ioan Gură de Aur')
    expect(h).toContain('Cuvânt din PDF-ul parohiei')
    expect(h).toContain(`href="${CALE_BULETIN}"`)
  })

  it('⚠️ pe ușă nu se scrie nici textul, nici sursa, nici „Citește tot"', () => {
    const h = bucataDeAcasa([bun], [pdf])
    expect(h).not.toContain('Citește tot')
    expect(h).not.toContain('Sursa:')
    expect(h).not.toContain('doxologia.ro')
    expect(h).not.toContain('ch-scurt')
  })

  it('⚠️ pe ușă urcă numai cele bune', () => {
    const h = bucataDeAcasa([bun, stricat], [])
    expect(h).toContain('Viața Sfintei Cuvioase Parascheva')
    expect(h).not.toContain('Cuvânt stricat')
    expect(h).toContain('Vezi toate — 1 text')
  })

  it('cel mult zece rânduri, oricâte ar fi', () => {
    const multe = Array.from({ length: 25 }, (_, i) => ({ ...bun, slug: `t-${i}`, titlu: `Text ${i}` }))
    const h = bucataDeAcasa(multe, [])
    expect((h.match(/class="ch-rand"/g) ?? []).length).toBe(10)
    expect(h).toContain('Vezi toate — 25 texte')
  })

  it('o categorie fără nimic bun nu se scrie deloc', () => {
    const h = bucataDeAcasa([bun], [{ ...stricat, sursa_fel: 'pdf', sursa_url: 'https://newsletter.sfantul-ilie.ro/media/uploads/x.pdf' }])
    expect(h).toContain('Texte citite la chinonic')
    expect(h).not.toContain('Texte din buletinul parohiei')
  })

  it('când nu e nimic de arătat, ușa rămâne cum era', () => {
    expect(bucataDeAcasa([], [])).toBe('')
  })
})

describe('pagina unui text', () => {
  it('titlu, autor sub el, apoi textul întreg, apoi sursa', () => {
    const h = paginaText(deBaza, '')
    expect(h.indexOf('titlu-lista')).toBeLessThan(h.indexOf('ch-autorul'))
    expect(h.indexOf('ch-autorul')).toBeLessThan(h.indexOf('ch-text'))
    expect(h.indexOf('ch-text')).toBeLessThan(h.indexOf('ch-sursa'))
    expect(h).not.toContain('ch-fragment')
  })

  it('fără textul întreg, fișa spune că e doar bucata citită', () => {
    const h = paginaText({ ...deBaza, stare_text: 'eroare', text_intreg: '' }, '')
    expect(h).toContain('ch-fragment')
    expect(h).toContain('Textul întreg încă n-a fost adus')
  })

  it('text „nesigur" nu trece drept întreg — proba e a userului', () => {
    expect(paginaText({ ...deBaza, stare_text: 'nesigur' }, '')).toContain('ch-fragment')
  })

  it('autorul lipsă se scrie „Fără autor", nu se lasă gol', () => {
    expect(paginaText({ ...deBaza, autor: '' }, '')).toContain('Fără autor')
  })
})

/**
 * ⚠️ Sursa cu două părți (mențiune + site) e a textelor CUIVA — cuvinte, predici, tâlcuiri. Viețile
 * de sfinți au regula lor, mai jos: la ele scrie doar „Sinaxar".
 */
const alCuiva: Text = {
  ...deBaza,
  slug: 'despre-rugaciunea-neincetata',
  titlu: 'Despre rugăciunea neîncetată',
  autor: 'Sfântul Ioan Gură de Aur',
}

describe('⚠️ legătura spre sursă se scrie numai cât timp adresa trăiește', () => {
  it('adresă vie → legătura e pusă efectiv', () => {
    const h = paginaText(alCuiva, '')
    expect(h).toContain(`href="${alCuiva.sursa_url}"`)
    expect(h).toContain('doxologia.ro')
  })

  it('404 → numele rămâne, adresa NU se mai pune', () => {
    const h = paginaText({ ...alCuiva, link_stare: 'mort' }, '')
    expect(h).not.toContain(alCuiva.sursa_url)
    expect(h).toContain('doxologia.ro') // numele se scrie mai departe, pentru cinstirea sursei
    expect(h).toContain('Proloagele, vol. I, Editura Bunavestire')
  })

  it('adresa care n-a răspuns deloc se poartă ca una moartă', () => {
    expect(paginaText({ ...alCuiva, link_stare: 'picat' }, '')).not.toContain(alCuiva.sursa_url)
  })

  it('cartea se scrie și când nu există niciun site', () => {
    const h = paginaText({ ...alCuiva, sursa_nume: '', sursa_url: '', link_stare: '' }, '')
    expect(h).toContain('Proloagele, vol. I, Editura Bunavestire')
    expect(h).not.toContain('ch-drum')
  })
})

/**
 * ⚠️⚠️ VIEȚILE DE SFINȚI: SURSA E SINAXARUL, ATÂT (user, 16.09.2026: „viețile de sfinți — să le
 * validezi, lasă doar Sinaxar la sursă și atât — mută-le la valide"). Ce se poate strica în tăcere:
 * să rămână site-ul lângă „Sinaxar", ori o viață cu adresa moartă să fie mai departe numărată ca
 * problemă, deși sursa ei n-a fost niciodată site-ul.
 */
describe('viețile de sfinți au o singură sursă', () => {
  it('la sursă scrie doar „Sinaxar" — fără carte, fără site, fără legătură', () => {
    const h = paginaText({ ...deBaza, link_stare: 'viu' }, '')
    expect(h).toContain('<span>Sursa:</span> Sinaxar')
    expect(h).not.toContain('doxologia.ro')
    expect(h).not.toContain('Proloagele')
    expect(h).not.toContain('ch-drum')
  })

  it('o adresă moartă nu mai e o problemă a lor', () => {
    const sinaxarMort: Rezumat = { ...rez, link_stare: 'mort' }
    const h = paginaStare([sinaxarMort], new Map(), '', 'link-mort')
    expect(h).toContain('Niciunul — categoria e goală.')
    // dar la un text al cuiva, aceeași adresă moartă rămâne de investigat
    const alCuivaMort: Rezumat = { ...bun, link_stare: 'mort' }
    expect(paginaStare([alCuivaMort], new Map(), '', 'link-mort')).toContain('Viața Sfintei Cuvioase Parascheva')
  })

  it('la ele proba fragmentului nu se cere, deci rămân bune', () => {
    expect(eBun({ ...rez, n_fragment: 12 })).toBe(true)
    expect(eBun({ ...rez, link_stare: 'mort' })).toBe(true)
  })
})

/**
 * ⚠️⚠️ LISTA ÎNTREAGĂ ARATĂ NUMAI CELE BUNE (user, 16.09.2026: „la vezi toate să se vadă direct cele
 * bune — filtru pe ani / și cu link către pagina cu probleme"). Ce se poate strica în tăcere: să se
 * scrie și textele nebune (lista ar minți despre ce e gata), ori să dispară legătura spre problemele
 * rămase (munca ar deveni invizibilă).
 */
describe('lista întreagă: numai cele bune', () => {
  it('scrie textele bune și NU le scrie pe cele cu probleme', () => {
    const h = paginaToate([bun, stricat])
    expect(h).toContain('Viața Sfintei Cuvioase Parascheva')
    expect(h).not.toContain('Cuvânt stricat')
    expect(h).toContain('1 text bun')
  })

  it('⚠️ spune câte au rămas de lămurit și duce la pagina lor', () => {
    const h = paginaToate([bun, stricat])
    expect(h).toContain('Cele cu probleme — 1 de lămurit')
    expect(h).toContain('/texte-citite-la-chinonic/stare')
  })

  it('⚠️ nu cară textele în pagină — un rând e titlu, autor, ziua citirii', () => {
    const h = paginaToate([bun])
    expect(h).toContain('14 octombrie 2025')
    expect(h).not.toContain('ch-scurt')
    expect(h).not.toContain('Citește tot')
    expect(h).not.toContain('✓ text')
  })

  it('de la chinonic se trece la textele din buletin și înapoi', () => {
    expect(paginaToate([bun])).toContain('Texte din buletinul parohiei →')
    expect(paginaBuletin([bun])).toContain('← Textele citite la chinonic')
  })
})

/**
 * FILTRUL PE ANI (user, 16.09.2026: „aici să avem o filtrare pe ani… totul ascuns în afară de ce e
 * selectat, la intrare prima opțiune selectată"). Ce se poate strica în tăcere: bara să rămână, dar
 * pagina să scrie mai departe TOATE rândurile — filtrul ar arăta ca și cum ar merge.
 */
describe('lista se filtrează pe ani', () => {
  const vechi: Rezumat = { ...bun, slug: 'cuvant-vechi', titlu: 'Cuvânt din 2019', citit_la: '2019-03-10' }
  const nou: Rezumat = { ...bun, slug: 'cuvant-nou', titlu: 'Cuvânt din 2026', citit_la: '2026-01-11' }

  it('la intrare e deschis anul cel mai nou, iar ceilalți ani sunt doar butoane', () => {
    const h = paginaToate([nou, bun, vechi])
    expect(h).toContain('Cuvânt din 2026')
    expect(h).not.toContain('Cuvânt din 2019') // ⚠️ ascuns, nu doar mutat mai jos
    expect(h).not.toContain('Viața Sfintei Cuvioase Parascheva')
    expect(h).toContain('?an=2019') // dar se poate ajunge la el dintr-o apăsare
    expect(h).toContain('?an=2025')
  })

  it('anul cerut din adresă e cel scris — și numai el', () => {
    const h = paginaToate([nou, bun, vechi], '2019')
    expect(h).toContain('Cuvânt din 2019')
    expect(h).not.toContain('Cuvânt din 2026')
    expect(h).toContain('aria-current="page"')
  })

  it('un an care nu există cade pe cel mai nou, nu pe o pagină goală', () => {
    expect(paginaToate([nou, vechi], '1999')).toContain('Cuvânt din 2026')
    expect(paginaToate([nou, vechi], null)).toContain('Cuvânt din 2026')
  })

  it('⚠️ anii barei sunt anii CELOR BUNE: un an în care nu e nimic bun nu se scrie', () => {
    const doarStricat: Rezumat = { ...stricat, citit_la: '2018-05-05' }
    const h = paginaToate([bun, doarStricat])
    expect(h).not.toContain('?an=2018')
  })
})

describe('pagina de probleme — locul de investigat', () => {
  const numere = new Map([['viata-sfintei-cuvioase-parascheva', { id: 617, nr: 534, trimis: '2025-10-14', texte: ['viata-sfintei-cuvioase-parascheva'] }]])
  const faraNimic: Rezumat = { ...rez, stare_text: 'fara-text', n_text: 0, autor: '', link_stare: 'mort' }

  it('fiecare categorie își numără textele și le dă rând scurt', () => {
    const h = paginaStare([faraNimic], numere, 'https://newsletter.sfantul-ilie.ro')
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
    const h = paginaStare([faraNimic, altul], cuNumere, '')
    expect(h).toContain('Viața Sfintei Cuvioase Parascheva') // e în prima categorie, „Fără textul întreg"
    expect(h).not.toContain('Cuvânt fără autor') // are text întreg — nu intră în categoria deschisă
    expect(h).toContain('?ce=fara-autor') // dar se ajunge la el dintr-o apăsare
  })

  it('categoria cerută din adresă e cea scrisă', () => {
    const altul: Rezumat = { ...rez, slug: 'cuvant-fara-autor', titlu: 'Cuvânt fără autor', autor: '' }
    const cuNumere = new Map([...numere, ['cuvant-fara-autor', { id: 700, nr: 600, trimis: '2026-02-01', texte: ['cuvant-fara-autor'] }]])
    const h = paginaStare([faraNimic, altul], cuNumere, '', 'fara-autor')
    expect(h).toContain('Cuvânt fără autor')
    expect(h).toContain('de căutat în pagina sursei')
  })

  /**
   * ⚠️ FELURILE SURSEI SE NUMĂRĂ ÎN CAP (user, 16.09.2026, spunând cum arată datele: „sursa în general
   * este website, dar ocazional mai este PDF sau tot ocazional este fără link, doar o mențiune carte;
   * există foarte rare situațiile fără sursă"). Așa se vede dintr-o privire dacă o cifră a plecat de
   * unde trebuia să stea.
   */
  it('scrie câte texte au site, PDF, numai mențiune ori nimic', () => {
    const doarCarte: Rezumat = { ...bun, slug: 'doar-carte', titlu: 'Text din carte', sursa_text: 'Filocalia, vol. IV', sursa_nume: '', sursa_url: '' }
    const h = paginaStare([bun, doarCarte], new Map(), '')
    expect(h).toContain('1 de pe un site')
    expect(h).toContain('1 numai cu mențiunea')
  })

  it('⚠️ „doar mențiune" e o categorie a lui: sursa e scrisă, dar nu duce nicăieri', () => {
    const doarCarte: Rezumat = { ...bun, slug: 'doar-carte', titlu: 'Text din carte', sursa_text: 'Filocalia, vol. IV', sursa_nume: '', sursa_url: '' }
    const h = paginaStare([doarCarte], new Map(), '', 'doar-mentiune')
    expect(h).toContain('Text din carte')
    expect(h).toContain('Filocalia, vol. IV')
    // nu e o greșeală, deci nu se numără la „fără sursă"
    expect(paginaStare([doarCarte], new Map(), '', 'fara-sursa')).toContain('Niciunul — categoria e goală.')
  })

  /**
   * ⚠️⚠️ „FĂRĂ BUCATA DIN BULETIN" E UN DEFECT DE CITIRE, nu o lipsă a buletinului (user, 16.09.2026:
   * „toate au text scurt — chiar dacă structural nu pare că e, vizual se vede mereu, 10-12 rânduri de
   * text după autor"). Categoria trebuie să prindă rândul și când textul întreg A FOST adus: acolo se
   * vede că extragerea n-a citit corpul articolului, deși el era în pagină.
   */
  it('bucata prea scurtă se vede și când textul întreg a fost adus', () => {
    const h = paginaStare([{ ...bun, n_fragment: 34 }], new Map(), '', 'fisa-goala')
    expect(h).toContain('Viața Sfintei Cuvioase Parascheva')
    expect(h).toContain('numai 34 semne din buletin')
  })

  /**
   * ⚠️ NUMAI TEXTELE LEGATE DE UN NUMĂR TRIMIS (user, 16.09.2026: „vreau să mă uit doar pe texte care
   * fac parte dintr-un anumit buletin online publicat și transmis… pune-le separat"). Un text fără
   * asociere iese din TOATE categoriile, nu doar capătă un rând mai stins.
   */
  it('textul fără număr de buletin iese din categorii și stă în a lui', () => {
    const orfan: Rezumat = { ...faraNimic, slug: 'text-fara-numar', titlu: 'Text fără număr' }
    const h = paginaStare([faraNimic, orfan], numere, '')
    expect(h).toContain('Viața Sfintei Cuvioase Parascheva')
    expect(h).not.toContain('Text fără număr') // scos din „Fără textul întreg", deși i s-ar potrivi
    expect(h).toContain('Fără număr de buletin')
    expect(paginaStare([faraNimic, orfan], numere, '', 'fara-numar')).toContain('Text fără număr')
  })

  it('⚠️ dacă Newsletterul tace, nimic nu se mută la „fără număr" — necunoașterea nu e lipsă', () => {
    const h = paginaStare([faraNimic], new Map(), '')
    expect(h).toContain('Viața Sfintei Cuvioase Parascheva')
    expect(h).not.toContain('Fără număr de buletin')
  })

  it('⚠️ scrie din ce număr de buletin vine, cu legătură spre el', () => {
    const h = paginaStare([faraNimic], numere, 'https://newsletter.sfantul-ilie.ro')
    expect(h).toContain('nr. 534')
    expect(h).toContain('https://newsletter.sfantul-ilie.ro/n/617')
  })

  it('fără asocieri (Newsletterul tace), pagina se scrie mai departe', () => {
    const h = paginaStare([faraNimic], new Map(), '')
    expect(h).toContain('număr necunoscut')
    expect(h).toContain('Fără textul întreg')
  })

  it('de pe fiecare rând se intră în fișă, ca să poată fi inspectat', () => {
    expect(paginaStare([faraNimic], numere, '')).toContain('/texte-citite-la-chinonic/viata-sfintei-cuvioase-parascheva')
  })

  it('un text întreg și cu autor nu apare în categoriile cu probleme', () => {
    expect(paginaStare([rez], numere, '')).toContain('Niciunul — categoria e goală.')
  })

  /**
   * ⚠️⚠️ FIECARE GRĂMADĂ ARE PROBLEMELE EI, LA ADRESA EI (16.09.2026, odată cu trecerea listelor pe
   * „numai cele bune"): dacă lista textelor din buletinul parohiei arată numai ce e bun, restul
   * trebuie să aibă unde fi văzut — altfel grămada de lucru a userului devine invizibilă.
   */
  it('pagina de probleme a textelor din buletin duce la fișele și la lista LOR', () => {
    const pdf: Rezumat = {
      ...stricat,
      slug: 'cuvant-din-pdf',
      titlu: 'Cuvânt din PDF-ul parohiei',
      sursa_fel: 'pdf',
      sursa_text: 'Fișier PDF',
      sursa_nume: '',
      sursa_url: 'https://newsletter.sfantul-ilie.ro/media/uploads/2022/01/Pr-Petroniu.pdf',
    }
    const h = paginaStare([pdf], new Map(), '', null, null, 'buletin')
    expect(h).toContain('Texte din buletinul parohiei — ce e de lămurit')
    expect(h).toContain(`${CALE_BULETIN}/cuvant-din-pdf`)
    expect(h).toContain(`href="${CALE_STARE_BULETIN}?ce=`)
    expect(h).not.toContain('/texte-citite-la-chinonic')
  })
})

/**
 * TEXTELE DIN BULETINUL PAROHIEI, mutate în secțiunea lor (user, 16.09.2026: „elimină toate textele
 * preluate din buletinul parohiei, fișier PDF care se află în newsletter… le poți muta la
 * `texte-din-buletin`"). Din newsletter ne interesează numai articolele de după program și buletin.
 *
 * Ce se poate strica în tăcere: despărțirea să se facă doar pe hârtie, iar rândurile mutate să ducă
 * mai departe la vechea adresă — legături care arată bine și cad la 404, ori, mai rău, care aduc
 * materialele parohiei înapoi în lista de citit.
 */
describe('textele din fișierele parohiei stau deoparte', () => {
  const pdfParohie: Rezumat = {
    ...bun,
    slug: 'cuvant-din-pdf',
    titlu: 'Cuvânt din PDF-ul parohiei',
    autor: 'Părintele Petroniu Tănase',
    sursa_fel: 'pdf',
    sursa_text: 'Fișier PDF',
    sursa_nume: '',
    sursa_url: 'https://newsletter.sfantul-ilie.ro/media/uploads/2022/01/Pr-Petroniu-Sfanta-Treime.pdf',
  }

  it('se cunosc după PDF-ul urcat în arhiva newsletterului', () => {
    expect(dinBuletin(pdfParohie)).toBe(true)
    expect(dinBuletin(rez)).toBe(false)
    // ⚠️ un PDF al altcuiva NU e al buletinului parohiei: felul singur nu e semn, gazda e
    expect(dinBuletin({ ...pdfParohie, sursa_url: 'https://arhiva-oarecare.ro/predici/petroniu.pdf' })).toBe(false)
  })

  it('⚠️ fișa lor are o singură casă, în secțiunea nouă', () => {
    expect(caleaLui(pdfParohie)).toBe(CALE_BULETIN)
    expect(caleaLui(rez)).toBe('/texte-citite-la-chinonic')
    expect(paginaBuletin([pdfParohie])).toContain(`${CALE_BULETIN}/cuvant-din-pdf`)
  })

  it('⚠️ rândul mutat nu mai duce la vechea adresă, oriunde ar fi scris', () => {
    // chiar dacă un asemenea rând ajunge din greșeală în lista chinonicului, legătura lui duce acasă
    expect(paginaToate([pdfParohie])).toContain(`${CALE_BULETIN}/cuvant-din-pdf`)
    expect(paginaToate([pdfParohie])).not.toContain('/texte-citite-la-chinonic/cuvant-din-pdf')
  })

  it('fișa lor trimite înapoi la textele din buletin, nu la chinonic', () => {
    const h = paginaText({ ...deBaza, ...pdfParohie, fragment: deBaza.fragment, text_intreg: deBaza.text_intreg }, '')
    expect(h).toContain('← Toate textele din buletinul parohiei')
    expect(h).toContain(CALE_BULETIN)
  })

  it('pagina lor spune de unde vin și se întoarce la chinonic', () => {
    const h = paginaBuletin([pdfParohie])
    expect(h).toContain('Texte din buletinul parohiei')
    expect(h).toContain('fișierele PDF ale parohiei')
    expect(h).toContain('← Textele citite la chinonic')
  })

  it('se filtrează pe ani, ca lista chinonicului', () => {
    const vechi: Rezumat = { ...pdfParohie, slug: 'pdf-vechi', titlu: 'PDF din 2019', citit_la: '2019-03-10' }
    const h = paginaBuletin([pdfParohie, vechi])
    expect(h).toContain('Cuvânt din PDF-ul parohiei')
    expect(h).not.toContain('PDF din 2019')
    expect(h).toContain(`${CALE_BULETIN}?an=2019`)
  })
})

/**
 * ⚠️⚠️ CATEGORIA CELOR BUNE (user, 16.09.2026: „fă o categorie cu tot ce este bun, dar ai grijă să pui
 * doar ce este chiar bun acolo"). Probele de aici sunt tocmai despre „chiar": fiecare lipsă în parte
 * trebuie să țină un text AFARĂ. De când ELE sunt și ce se scrie pe ușă și în lista întreagă, o
 * judecată prea largă nu mai ascunde doar lucrul rămas — pune text nebun pe fața parohiei.
 */
describe('categoria celor bune', () => {
  const bune = (r: Rezumat[]) => paginaStare(r, new Map(), '', 'bune')

  it('titlu, autor, text întreg probat, mai lung decât bucata, sursă vie → intră', () => {
    expect(bune([bun])).toContain('Viața Sfintei Cuvioase Parascheva')
    expect(bune([bun])).toContain('9600 semne')
    expect(eBun(bun)).toBe(true)
  })

  it('⚠️ „nesigur" nu e bun: textul e în bază, dar n-a trecut proba', () => {
    expect(eBun({ ...bun, stare_text: 'nesigur' })).toBe(false)
    expect(bune([{ ...bun, stare_text: 'nesigur' }])).toContain('Niciunul — categoria e goală.')
  })

  it('⚠️ textul adus, dar nu mai lung decât bucata din buletin, nu e bun', () => {
    expect(eBun({ ...bun, n_text: 700, n_fragment: 900 })).toBe(false)
  })

  it('⚠️ bucată prea scurtă ca să fi fost probat → afară; la sinaxar proba nu se cere', () => {
    expect(eBun({ ...bun, n_fragment: 12 })).toBe(false)
    expect(eBun({ ...rez, n_fragment: 12 })).toBe(true)
  })

  it('⚠️ adresa moartă îl ține afară; viața de sfânt rămâne, sursa ei e Sinaxarul', () => {
    expect(eBun({ ...bun, link_stare: 'mort' })).toBe(false)
    expect(bune([{ ...rez, link_stare: 'mort' }])).toContain('sursa: Sinaxar')
  })

  it('fără autor ori fără titlu nu e bun, oricât de întreg ar fi textul', () => {
    expect(eBun({ ...bun, autor: '' })).toBe(false)
    expect(eBun({ ...bun, titlu: '' })).toBe(false)
  })

  it('⚠️ stă la urmă în cuprins: la intrare se deschide tot ce e de făcut, nu ce e gata', () => {
    const h = paginaStare([bun], new Map(), '')
    expect(h).toContain('Fără textul întreg')       // categoria deschisă la intrare
    expect(h).toContain('Bune — nimic de făcut')    // dar numărul ei se vede din cuprins
    expect(h).toContain('chiar bune')
    expect(h.indexOf('Fără textul întreg')).toBeLessThan(h.indexOf('Bune — nimic de făcut'))
  })
})
