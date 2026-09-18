import { describe, expect, it } from 'vitest'
import type { IntrareVocabular, Slujba } from '@xc/contracts'
import { listaPrimeiPagini } from '../apps/program/src/site.js'
import type { OptiuniFoaie } from '../apps/program/src/foaie.js'

/**
 * BUCATA PRIMEI PAGINI A SITE-ULUI (`/v1/bucata-site`) — probă de FORMĂ STRĂINĂ.
 *
 * ⚠️ Forma de aici nu e a noastră: e HTML-ul pe care îl scotea tema WordPress a parohiei
 * (`content-single-program.php`), copiat rând cu rând ca prima pagină să arate exact ca înainte,
 * doar cu datele luate din aplicație în loc de tastate a doua oară. Nimeni de aici nu vede pagina
 * aceea, deci o „curățenie" a HTML-ului (scoaterea lui `class="rosu"`, altă clasă în locul lui
 * `program-detalii`, `<br>` devenit `<br/>`) ar strica-o în tăcere, la ei pe site.
 * De aceea semnele sunt prinse aici, cu tot cu motivul lor.
 *
 * Bucata e TEMPORARĂ (user, 18.09.2026): la trecerea apexului pe V2 se șterge, cu probă cu tot.
 */
const VOCABULAR = new Map<string, IntrareVocabular>([
  ['utrenia_liturghie', { cod_nume: 'utrenia_liturghie', nume: 'Utrenia și Sfânta Liturghie', categorie: 'dimineata', ordine: 1, activ: true }],
  ['vecernia_litia', { cod_nume: 'vecernia_litia', nume: 'Vecernia și Litia', categorie: 'seara', ordine: 9, activ: true }],
  ['maslu', { cod_nume: 'maslu', nume: 'Sfântul Maslu', categorie: 'alte', ordine: 22, activ: true }],
])

const slujba = (data: string, ora: string, cod: string, detalii: string[] = []): Slujba => ({
  id: `${data}-${cod}`,
  data,
  ora,
  nume: VOCABULAR.get(cod)?.nume ?? cod,
  cod_nume: cod,
  slujitor: null,
  loc: 'biserica',
  observatii: detalii[0] ?? null,
  detalii,
  curatenie: false,
  transmisie: false,
})

const optiuni = (slujbe: Slujba[]): OptiuniFoaie => ({
  luni: '2026-09-14',
  duminica: '2026-09-20',
  titlu: 'Programul săptămânii 14 – 20 septembrie 2026',
  slujbe,
  vocabular: VOCABULAR,
  calendar: null,
  dinCalendar: false,
})

describe('bucata primei pagini a site-ului', () => {
  const html = listaPrimeiPagini(
    optiuni([
      slujba('2026-09-14', '07:00', 'utrenia_liturghie', ['Înălțarea Sfintei Cruci']),
      slujba('2026-09-19', '18:00', 'vecernia_litia'),
      slujba('2026-09-20', '08:00', 'utrenia_liturghie', [
        'Ap. Galateni 2, 16-20; Ev. Marcu 8, 34-38; 9, 1; glas 7, voscr. 5',
        'Duminica după Înălțarea Sfintei Cruci',
      ]),
    ]),
  )

  it('scrie ziua ca în temă: numele cu majusculă, data fără an, `<br>` simplu', () => {
    expect(html).toContain('<strong>Luni</strong>: 14 septembrie<br>')
    expect(html).toContain('<strong>Sâmbătă</strong>: 19 septembrie<br>')
    expect(html).toContain('<strong>Duminică</strong>: 20 septembrie<br>')
  })

  it('slujba începe cu „⁞ ora – " și numele stă în `<strong>`', () => {
    expect(html).toContain('⁞ 07:00 – <strong class="rosu">Utrenia și Sfânta Liturghie</strong>')
  })

  it('`class="rosu"` numai la slujba de dimineață — așa o punea tema', () => {
    expect(html).toContain('<strong class="rosu">Utrenia și Sfânta Liturghie</strong>')
    expect(html).toContain('<strong>Vecernia și Litia</strong>')
    expect(html).not.toContain('<strong class="rosu">Vecernia și Litia</strong>')
  })

  it('detaliile stau în `div.program-detalii`, fiecare `<em>→ …</em><br/>`', () => {
    expect(html).toContain('<div class="program-detalii"><em>→ Înălțarea Sfintei Cruci</em><br/></div>')
    expect(html).toContain('<em>→ Ap. Galateni 2, 16-20; Ev. Marcu 8, 34-38; 9, 1; glas 7, voscr. 5</em><br/>')
    expect(html).toContain('<em>→ Duminica după Înălțarea Sfintei Cruci</em><br/>')
  })

  it('slujba fără detalii păstrează cutia goală, ca în temă (CSS-ul ei ține marginea)', () => {
    expect(html).toContain('<strong>Vecernia și Litia</strong><br/>\n<div class="program-detalii"></div>')
  })

  it('zilele fără slujbe nu se scriu deloc: în săptămâna asta sunt trei `<li>`', () => {
    expect(html.match(/<li>/g)).toHaveLength(3)
    expect(html).not.toContain('Marți')
    expect(html.startsWith('<ul>')).toBe(true)
    expect(html.endsWith('</ul>')).toBe(true)
  })

  it('slujbele aceleiași zile ies în ordinea orei', () => {
    const doua = listaPrimeiPagini(
      optiuni([slujba('2026-09-16', '18:00', 'vecernia_litia'), slujba('2026-09-16', '09:00', 'maslu')]),
    )
    expect(doua.indexOf('09:00')).toBeLessThan(doua.indexOf('18:00'))
  })

  it('textul venit din bază se scapă — pagina parohiei nu primește HTML de la noi', () => {
    const cu = listaPrimeiPagini(optiuni([slujba('2026-09-15', '07:00', 'utrenia_liturghie', ['Sf. <b>Ilie</b> & ai lui'])]))
    expect(cu).toContain('→ Sf. &lt;b&gt;Ilie&lt;/b&gt; &amp; ai lui')
  })

  it('săptămâna fără slujbe nu scoate o listă goală', () => {
    expect(listaPrimeiPagini(optiuni([]))).toBe('<p class="gol">Săptămână fără slujbe înregistrate.</p>')
  })
})
