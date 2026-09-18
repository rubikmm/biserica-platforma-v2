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
