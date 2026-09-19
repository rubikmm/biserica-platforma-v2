/**
 * FOAIA TIPĂRITĂ — cele câteva hotărâri de formă care nu se văd decât pe hârtie, deci se strică
 * în tăcere: josul paginii a patra, golul de deasupra calendarului, mărimea capului „PROGRAMUL
 * LITURGIC" și adresa aldină din subsol. Probele astea nu măsoară randarea (aia se face cu
 * `apps/buletin/unelte/proba-foaie.mjs`), ci păzesc stilul de o „îndreptare" nevinovată.
 */
import { describe, expect, it } from 'vitest'
import { SUBSOL, foaieHtml } from '../apps/buletin/src/foaie.js'
import type { NumarCerut } from '../apps/buletin/src/masuri.js'

const cerut: NumarCerut = {
  motto: 'Un citat scurt, cât să încapă pe două rânduri de cursive în capul paginii întâi.',
  motoAutor: 'Părintele Arsenie Papacioc',
  nr: 616,
  data: '2026-09-20',
  principal: { autor: 'SFÂNTUL IERARH NICOLAE', titlu: 'UN TITLU', text: 'Un text scurt.', sursa: 'ziarullumina.ro' },
}

const foaia = (calendar: { tabel: string; stil: string } | null = { tabel: '<table class="program"></table>', stil: '' }): string =>
  foaieHtml({ cerut, dataScrisa: '20 septembrie 2026', calendar })

describe('josul paginii a patra', () => {
  /**
   * ⚠️ De ce contează: un tabel dintr-o cutie `position:absolute` pierde ULTIMUL rând în Chromium
   * (18.09.2026 — „calendarul este în continuare tăiat în partea de jos"): tabelul își socotește
   * înălțimea fără el, subsolul se lipește de rândul dinainte, iar banda de la piciorul duminicii
   * nu se mai desenează. Se repară doar scoțând josul din așezarea absolută.
   */
  it('nu e așezat absolut, ci împins la talpa paginii de o cutie flex', () => {
    const html = foaia()
    expect(html).toMatch(/\.jos \{ position: static;/)
    expect(html).not.toMatch(/\.jos \{ position: absolute/)
    expect(html).toMatch(/\.pagina\.ultima \{ display: flex; flex-direction: column; justify-content: flex-end; \}/)
  })

  it('ține floarea, capul calendarului, tabelul și subsolul, în ordinea asta', () => {
    const html = foaia()
    const jos = html.slice(html.indexOf('<div class="jos">'))
    const locuri = ['class="floare"', 'class="cap-calendar"', 'class="program"', 'class="subsol"'].map((s) => jos.indexOf(s))
    expect(locuri.every((i) => i > 0)).toBe(true)
    expect([...locuri].sort((a, b) => a - b)).toEqual(locuri)
  })
})

describe('zona neagră: autorul cu bară (user, 19.09.2026)', () => {
  const cuAutor = (autor: string): string =>
    foaieHtml({ cerut: { ...cerut, principal: { ...cerut.principal, autor } }, dataScrisa: '20 septembrie 2026', calendar: null })

  it('pune înaintea barei un rând mic deasupra numelui', () => {
    const html = cuAutor('SFÂNTUL CUVIOS MĂRTURISITOR / SOFIAN de la ANTIM')
    expect(html).toContain('<div class="deasupra">SFÂNTUL CUVIOS MĂRTURISITOR</div><div class="nume">SOFIAN de la ANTIM</div>')
    expect(html).toMatch(/\.zona-neagra \.deasupra \{ font-family: "Trajan", serif; font-size: 12pt;/)
  })

  it('lasă autorul fără bară exact ca până acum, pe un singur rând', () => {
    const html = cuAutor('SFÂNTUL IERARH NICOLAE')
    expect(html).toContain('<div class="nume">SFÂNTUL IERARH NICOLAE</div>')
    expect(html).not.toContain('class="deasupra"')
  })
})

describe('semnătura de sub titlu (user, 19.09.2026)', () => {
  const SEMNATURA = 'Text de: Părintele Mihail Stanciu, fost stareț al Mănăstirii Antim'
  const cuSemnatura = (semnatura?: string): string =>
    foaieHtml({
      cerut: { ...cerut, principal: { ...cerut.principal, ...(semnatura ? { semnatura } : {}) } },
      dataScrisa: '20 septembrie 2026',
      calendar: null,
    })

  /**
   * ⚠️ ORDINEA E TOT ROSTUL: semnătura stă ÎNTRE titlu și riglă, nu sub linie. Pusă după riglă, ar
   * arăta ca un început de text, iar rândul aldin n-ar mai fi al titlului.
   */
  it('scrie rândul între titlu și riglă, literă cu literă', () => {
    const html = cuSemnatura(SEMNATURA)
    expect(html).toContain(
      `<h2 class="titlu-articol">UN TITLU</h2><div class="semnatura">${SEMNATURA}</div><div class="rigla"></div>`,
    )
  })

  it('fără semnătură, foaia rămâne exact ca până acum', () => {
    const html = cuSemnatura()
    expect(html).not.toContain('class="semnatura"')
    expect(html).toContain('<h2 class="titlu-articol">UN TITLU</h2><div class="rigla"></div>')
  })

  it('o scrie cu corpul textului, aldin și centrat', () => {
    expect(cuSemnatura(SEMNATURA)).toMatch(
      /\.semnatura \{ font-family: "Caladea", serif; font-size: 15pt; font-weight: 700; line-height: 1\.3;/,
    )
  })

  /**
   * ⚠️ Rigla se desenează cu un selector pe FRATELE DE DINAINTE (`+`). Cu semnătura strecurată
   * între ea și titlu, singurul `.titlu-articol + .rigla` ar fi lăsat-o fără fir — adică linia de
   * sub titlu ar fi dispărut tăcut tocmai la articolele semnate.
   */
  it('păstrează firul riglei și când semnătura s-a așezat înaintea ei', () => {
    expect(cuSemnatura(SEMNATURA)).toContain('.titlu-articol + .rigla, .semnatura + .rigla { border-top: .5pt solid #000;')
  })
})

describe('măsurile cerute de user pe 18.09.2026', () => {
  // 4.9 mm de margine, ca de la cerneală la cerneală să iasă cei 0.5 cm ceruți (aerul de deasupra
  // majusculelor Trajan intră și el în gol) — vezi comentariul din stilul foii.
  it('lasă 0.5 cm între floare și „PROGRAMUL LITURGIC"', () => {
    expect(foaia()).toMatch(/\.floare \{ display: block; margin: 0 auto 4\.9mm;/)
  })

  it('scrie capul calendarului la 24 pt (18 → 20 → 24, două cereri în aceeași zi)', () => {
    expect(foaia()).toMatch(/\.cap-calendar \{ font-family: "Trajan", serif; font-size: 24pt;/)
  })

  it('scrie adresa parohiei aldin, iar rândul abonării nu', () => {
    const html = foaia()
    expect(html).toMatch(/\.subsol \.adresa \{ font-weight: 700; \}/)
    expect(html).toContain(`<div class="adresa">${SUBSOL[SUBSOL.length - 1]}</div>`)
    expect(html).toContain(`<div>${SUBSOL[0]}</div>`)
  })
})
