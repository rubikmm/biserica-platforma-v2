import { describe, expect, it } from 'vitest'
import {
  ABONAMENTE,
  abonamentul,
  butonAbonare,
  fereastraAbonare,
  ruteazaAbonare,
  type MediuAbonare,
} from '../packages/abonare/src/index.js'

/**
 * ABONAREA COMUNĂ (user, 15.09.2026: „ar trebui să fie la fel peste tot. Nu ar trebui să copiez
 * logica în mai multe locuri").
 *
 * Probele de aici păzesc cererile scrise cuvânt cu cuvânt de user, fiindcă toate sunt lucruri care
 * se pot strica în tăcere la o rescriere a ferestrei:
 *   - textul scurtat („completați câmpul:", fără partea cu adresa de mail);
 *   - bifa „Vreau să fac cont", pusă și ÎNCUIATĂ;
 *   - „termenii și condițiile" ca LINK, în filă nouă;
 *   - bifa termenilor FĂRĂ `required` — altfel browserul își scoate bula lui și oprește `submit`,
 *     iar rândul roșu cerut de user n-ar mai apuca să se scrie;
 *   - paza aceleiași bife la SERVER, unde ajunge și cine trimite formularul de mână.
 */
const ABONAMENT = abonamentul('calendar')

const FEREASTRA = fereastraAbonare({
  prefix: '/calendar',
  spre: 'https://calendar.sfantul-ilie.ro/2026-09',
  urlTermeni: 'https://sfantul-ilie.ro/termeni',
})

describe('fereastra de abonare — ce a cerut userul, literă cu literă', () => {
  it('textul e scurtat: fără „cu adresa de mail"', () => {
    expect(FEREASTRA).toContain('Pentru a vă abona, completați câmpul:')
    expect(FEREASTRA).not.toContain('cu adresa de mail')
  })

  it('„Vreau să fac cont" e bifată și încuiată', () => {
    expect(FEREASTRA).toMatch(/<input type="checkbox" id="b-cont" checked disabled>/)
  })

  it('termenii sunt link, în filă nouă', () => {
    expect(FEREASTRA).toContain('href="https://sfantul-ilie.ro/termeni" target="_blank" rel="noopener"')
    expect(FEREASTRA).toContain('>termenii și condițiile</a>')
  })

  it('bifa termenilor NU poartă `required` — validarea e a noastră, nu a browserului', () => {
    const bifa = /<input type="checkbox" name="termeni" id="b-termeni" value="1">/.exec(FEREASTRA)
    expect(bifa).not.toBeNull()
    expect(bifa![0]).not.toContain('required')
  })

  it('formularul chiar trimite, iar X-ul doar închide', () => {
    expect(FEREASTRA).toContain('method="post" action="/calendar/abonare"')
    expect(FEREASTRA).toContain('formmethod="dialog" formnovalidate')
  })

  /**
   * ⚠️ `ctx.spre` al aplicațiilor e o adresă ÎNTREAGĂ (`adresaPaginii`), nu o cale. Dacă traducerea
   * se pierde, `spreSigur` de pe server o refuză și omul se trezește aruncat pe rădăcina aplicației
   * în loc să se întoarcă în pagina din care a plecat.
   */
  it('întoarcerea se scrie ca o cale, nu ca adresă întreagă', () => {
    expect(FEREASTRA).toContain('<input type="hidden" name="spre" value="/2026-09">')
  })

  it('o întoarcere străină nu iese din casă', () => {
    const f = fereastraAbonare({ prefix: '/calendar', spre: 'https://alt-site.ro/rau', urlTermeni: '/termeni' })
    expect(f).toContain('name="spre" value="/rau"')
    expect(f).not.toContain('alt-site.ro')
  })

  it('cui e intrat i se scrie adresa contului, încuiată', () => {
    const f = fereastraAbonare({ prefix: '/calendar', spre: '/', urlTermeni: '/termeni', emailulContului: 'om@exemplu.ro' })
    expect(f).toContain('value="om@exemplu.ro"')
    expect(f).toContain('readonly')
  })
})

describe('registrul: cine are buton de abonare', () => {
  it('numai aplicațiile cu un serviciu de trimis', () => {
    expect(ABONAMENTE.map((a) => a.cod)).toEqual(['calendar', 'program', 'buletin', 'tipic'])
  })

  it('o aplicație din afara listei nu capătă buton din greșeală', () => {
    expect(() => abonamentul('biblioteca')).toThrow()
  })

  it('butonul spune ce primești', () => {
    expect(butonAbonare(ABONAMENT)).toContain('Primește calendarul pe email')
  })
})

// ---------------------------------------------------------------------------
// Drumul, la server
// ---------------------------------------------------------------------------

function mediu(urme: string[]): MediuAbonare {
  const fetcher = (cine: string) =>
    ({
      fetch: async (adresa: string) => {
        urme.push(`${cine}:${new URL(adresa).pathname}`)
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
      },
    }) as unknown as Fetcher
  return { IDENTITATE: fetcher('identitate'), COMUNICARE: fetcher('comunicare') }
}

function unelte(principal: { userId: string; email: string } | null) {
  return {
    abonament: ABONAMENT,
    prefix: '/calendar',
    cfg: { MEDIU: 'dev', DOMENIU_COOKIE: 'rubik' },
    cid: 'proba',
    principal,
    carcasa: (o: { titluPagina: string; corp: string }) => `<!--${o.titluPagina}-->${o.corp}`,
  }
}

function cerere(corp: Record<string, string>): Request {
  const date = new FormData()
  for (const [k, v] of Object.entries(corp)) date.set(k, v)
  return new Request('https://calendar.test/abonare', { method: 'POST', body: date })
}

describe('drumul abonării, la server', () => {
  it('⚠️ fără bifa termenilor nu se abonează nimeni — nici cine trimite formularul de mână', async () => {
    const urme: string[] = []
    const r = await ruteazaAbonare(
      cerere({ email: 'om@exemplu.ro', spre: '/calendar/' }),
      '/abonare',
      mediu(urme),
      unelte(null),
    )
    expect(r!.status).toBe(400)
    // nimic n-a plecat: nici cod de intrare, nici înscriere în audiență
    expect(urme).toEqual([])
    expect(await r!.text()).toContain('termenii și condițiile')
  })

  it('cine e deja intrat se abonează pe loc, cu adresa contului', async () => {
    const urme: string[] = []
    const r = await ruteazaAbonare(
      // adresa scrisă în câmp e ALTA decât a contului: se ia a contului, nu cea scrisă
      cerere({ email: 'altcineva@exemplu.ro', termeni: '1', spre: '/calendar/2026-09' }),
      '/abonare',
      mediu(urme),
      unelte({ userId: 'u1', email: 'om@exemplu.ro' }),
    )
    expect(urme).toEqual(['comunicare:/audiente/inscrie'])
    expect(r!.status).toBe(303)
    expect(r!.headers.get('location')).toBe('/calendar/2026-09?abonat=1')
  })

  it('cine nu e intrat primește codul și ecranul celor șase cifre', async () => {
    const urme: string[] = []
    const r = await ruteazaAbonare(
      cerere({ email: 'om@exemplu.ro', termeni: '1', spre: '/calendar/' }),
      '/abonare',
      mediu(urme),
      unelte(null),
    )
    expect(urme).toEqual(['identitate:/intrare'])
    const html = await r!.text()
    expect(html).toContain('Scrie codul din email')
    expect(html).toContain('action="/calendar/abonare/cod"')
    // se spune limpede ce se întâmplă la capăt: cont deschis ȘI abonare
    expect(html.replace(/\s+/g, ' ')).toContain('contul e deschis și ești abonat la Calendar')
  })

  it('o adresă strâmbă nu ajunge la identitate', async () => {
    const urme: string[] = []
    const r = await ruteazaAbonare(
      cerere({ email: 'nu-e-adresa', termeni: '1', spre: '/calendar/' }),
      '/abonare',
      mediu(urme),
      unelte(null),
    )
    expect(r!.status).toBe(400)
    expect(urme).toEqual([])
  })

  it('adresele străine de abonare nu sunt ale ei', async () => {
    expect(await ruteazaAbonare(cerere({}), '/2026-09', mediu([]), unelte(null))).toBeNull()
  })
})
