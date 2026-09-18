/**
 * CIORNA NUMĂRULUI — ce se vede pe `/nou` după ce s-a compus foaia (user, 18.09.2026: „să-l afișezi
 * direct în pagină ca și cum e un buletin gata de validat… toate butoanele de tipar și download și
 * flip3D + un buton de validare"; „validarea = publicarea").
 *
 * Probele astea păzesc două lucruri care se strică în tăcere:
 *   1. **butoanele** — dacă unul dintre ele iese din pagină la o refacere a ecranului, nimeni nu vede
 *      nimic în cod, fiindcă pagina rămâne frumoasă și fără el;
 *   2. **amprenta randării** (`?v=`) — pe ea stă TOATĂ îndreptarea cache-ului. Fără ea, omul care
 *      recompune același număr vede foaia dinainte și crede că schimbarea nu s-a făcut. E o
 *      întrebare într-o adresă: nu se vede pe ecran nici când lipsește, nici când e greșită.
 */
import { describe, expect, it } from 'vitest'
import { type Ctx, buletinulNou, fisier, paginaNou } from '../apps/buletin/src/pagini.js'
import { cheiaCopertei, cheiaNumarului } from '../apps/buletin/src/compune.js'

const CTX: Ctx = {
  prefix: '/buletin',
  nav: { home: '', cont: '/cont', admin: '/admin' } as Ctx['nav'],
  utilizator: 'Părintele',
  eAdmin: true,
  versiune: '0.6.3',
  modificata: '18.09.2026',
}

const VARIANTE = [
  { varianta: 'un singur autor, cu poză mare', semne: 9028, zone: [{ cine: 'principal', semne: 9028 }] },
]

const ULTIMUL = { nr: 615, data: '2026-09-06', an: '2026', luna: '09', cheie_pdf: null, cheie_poza_mica: null, pagini: 4 }
const NOU = buletinulNou(ULTIMUL, '2026-09-17')

/** Ecranul `/nou` după o compunere izbutită. */
const dupaCompunere = (v: string | null = 'abc123') =>
  paginaNou(CTX, { nou: true, ani: ['2026'] }, NOU, {
    variante: VARIANTE,
    calendar: { titlu: '21 – 27 septembrie 2026', slujbe: 6 },
    raspuns: {
      facut: true,
      cheie: '2026/buletin-616-2026-09-20.pdf',
      cheiePoza: '2026/buletin-616-2026-09-20.jpg',
      versiune: v,
      marime: 731717,
      plangeri: [],
    },
  })

describe('cheile numărului compus', () => {
  it('poartă aceleași nume ca numerele aduse din V1', () => {
    expect(cheiaNumarului({ nr: 616, data: '2026-09-20' })).toBe('2026/buletin-616-2026-09-20.pdf')
    expect(cheiaCopertei({ nr: 616, data: '2026-09-20' })).toBe('2026/buletin-616-2026-09-20.jpg')
  })
})

describe('amprenta randării în adresele fișierelor', () => {
  it('se pune doar unde e cerută — arhiva rămâne cu adrese curate', () => {
    expect(fisier(CTX, '2026/x.pdf')).toBe('/buletin/fisier/2026/x.pdf')
    expect(fisier(CTX, '2026/x.pdf', 'abc123')).toBe('/buletin/fisier/2026/x.pdf?v=abc123')
  })

  it('intră în TOATE adresele ciornei: coperta, foaia, descărcarea, broșura și răsfoitul', () => {
    const h = dupaCompunere()
    const ciorna = h.slice(h.indexOf('<section class="ciorna">'))
    // coperta (poza) și legătura ei către foaie
    expect(ciorna).toContain('src="/buletin/fisier/2026/buletin-616-2026-09-20.jpg?v=abc123"')
    expect(ciorna).toContain('href="/buletin/fisier/2026/buletin-616-2026-09-20.pdf?v=abc123"')
    // descărcarea: amprenta ÎNAINTEA lui `descarca`, legate cu `&` — nu cu un al doilea `?`
    expect(ciorna).toContain('href="/buletin/fisier/2026/buletin-616-2026-09-20.pdf?v=abc123&descarca=1"')
    // broșura de tipar și PDF-ul răsfoitului
    expect(ciorna).toContain('href="/buletin/tipar/616-2026-09-20.pdf?v=abc123"')
    expect(ciorna).toContain('data-pdf="/buletin/fisier/2026/buletin-616-2026-09-20.pdf?v=abc123"')
  })

  it('fără amprentă (nu s-a putut afla) adresele rămân întregi, nu stricate', () => {
    const h = dupaCompunere(null)
    const ciorna = h.slice(h.indexOf('<section class="ciorna">'), h.indexOf('</section>'))
    expect(ciorna).toContain('href="/buletin/fisier/2026/buletin-616-2026-09-20.pdf?descarca=1"')
    expect(ciorna).toContain('href="/buletin/tipar/616-2026-09-20.pdf"')
    expect(ciorna).not.toContain('?v=')
  })
})

describe('numărul compus, arătat în pagină ca unul gata de validat', () => {
  it('ține coperta, cele trei butoane ale foii și răsfoitul', () => {
    const h = dupaCompunere()
    expect(h).toContain('<section class="ciorna">')
    // coperta, ca la un număr din arhivă — apăsată, deschide răsfoitul
    expect(h).toContain('<a class="coperta" data-rasfoit')
    // descărcare · tipărește (+ reversul lui) · răsfoiește (flip3D), cerute toate trei
    expect(h).toContain('id="b-descarca"')
    expect(h).toContain('id="b-tipareste"')
    expect(h).toContain('id="b-revers"')
    expect(h).toContain('<button type="button" class="btn intreg" data-rasfoit')
    expect(h).toContain('Răsfoiește')
    // fereastra răsfoitului chiar există în pagină (fără ea butoanele ar apăsa în gol)
    expect(h).toContain('id="d-rasfoit"')
    // mărimea foii, scrisă pe butonul de descărcare, ca la numerele din arhivă
    expect(h).toContain('<small>0.7 MB</small>')
  })

  it('are butonul de validare, care publică numărul — cu numărul și ziua lui în formular', () => {
    const h = dupaCompunere()
    expect(h).toContain('<form method="post" action="/buletin/nou" class="valideaza">')
    expect(h).toContain('<input type="hidden" name="fapta" value="valideaza">')
    expect(h).toContain('<input type="hidden" name="nr" value="616">')
    expect(h).toContain('<input type="hidden" name="data" value="2026-09-20">')
    expect(h).toContain('Validează și publică nr. 616')
    // se spune limpede ce face apăsarea: validarea = publicarea (user, 18.09.2026)
    expect(h).toContain('numărul intră în arhivă și devine numărul curent')
  })

  it('stă ÎNAINTEA formularului de scris: întâi se vede foaia, apoi se umblă la text', () => {
    const h = dupaCompunere()
    expect(h.indexOf('<section class="ciorna">')).toBeLessThan(h.indexOf('class="compunere"'))
  })

  it('nu se arată deloc până nu s-a compus ceva', () => {
    const h = paginaNou(CTX, { nou: true }, NOU, {
      variante: VARIANTE,
      calendar: { titlu: '21 – 27 septembrie 2026', slujbe: 6 },
    })
    expect(h).not.toContain('class="ciorna"')
    // `fapta` există oricum în pagină — butonul „Compune numărul" e tot ea; ce nu trebuie să fie
    // acolo e VALIDAREA: nu se publică un număr care n-a fost compus
    expect(h).not.toContain('value="valideaza"')
  })
})
