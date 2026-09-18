import { describe, expect, it } from 'vitest'
import tipic from '../apps/tipic/src/index.js'
import { type ContinutZi, type Ctx, paginaZilei } from '../apps/tipic/src/pagini.js'

/**
 * ANTETUL TIPICULUI, refăcut după Calendar (user, 18.09.2026: „după bulina cu AZI să avem un text
 * care spune unde ne aflăm — de fapt totul să fie ca la Calendar, fără funcția de filtrare cruci;
 * și Calendarul să fie afișat scrisul zilelor cu negru — doar duminicile roșii și sărbătorile cu
 * roșu").
 *
 * Probele păzesc patru lucruri care se pot strica tăcut la orice rescriere a antetului:
 *   - PASTILA are patru segmente, în ordinea: bulina · data zilei deschise · „Mâine" · cheia
 *     calendarului. „Mâine" s-a întors pe 18.09.2026 („Mâine e bun") și n-are voie să cadă pe furiș
 *     la următoarea rescriere a antetului;
 *   - BARA calendarului pornește ASCUNSĂ din server (`hidden` scris în HTML), nu dintr-o linie de
 *     JS: fără asta, cine intră cu JavaScript oprit ar vedea grila desfăcută sub antet la fiecare
 *     pagină, iar cine intră cu el pornit ar apuca s-o vadă clipind;
 *   - CULORILE grilei — negru de rând, roșu la duminici ȘI la sărbători. Duminicile se știu din
 *     dată; sărbătorile vin de la Calendar și se pierd ușor (o cerere picată, un câmp redenumit);
 *   - drumul lunilor vecine: un singur capăt, `/v1/luna/<AAAA-LL>`, și O SINGURĂ întrebare pusă
 *     Calendarului pentru o lună întreagă. Dacă ajung 30, se vede aici, nu în factura de la CPU.
 */
const NAV = { home: '/', cont: '/cont', admin: '/admin' } as unknown as Ctx['nav']
const CTX: Ctx = { prefix: '/tipic', nav: NAV, utilizator: null, eAdmin: false, versiune: '0.4.0', modificata: '' }

/** Noiembrie 2026: 1 și 22 sunt duminici, 21 e sâmbătă (Intrarea în Biserică — praznic), 30 e luni. */
const ZILE = ['2026-11-01', '2026-11-08', '2026-11-21', '2026-11-22', '2026-11-30']
const SARBATORI = ['2026-11-21']

function pagina(o: Partial<ContinutZi> = {}): string {
  return paginaZilei(CTX, {
    data: '2026-11-22',
    zi: null,
    randuiala: null,
    tipiconal: null,
    minei: null,
    carti: { randuiala: null, tipiconal: null, minei: null },
    pericope: { voscreasna: null, utrenie: [], apostol: [], evanghelie: [] },
    zileCuRanduiala: ZILE,
    sarbatori: SARBATORI,
    azi: '2026-09-18',
    ...o,
  })
}

/** Celula unei zile din grilă, cu clasele ei — ce se vede pe ecran stă în `class`. */
function celula(html: string, data: string): string {
  const m = new RegExp(`<(a|span) class="([^"]*)"[^>]*(?:href="/tipic/${data}"|)[^>]*><b>(\\d+)</b>`, 'g')
  for (const g of html.matchAll(m)) {
    const zi = Number(g[3])
    if (`2026-11-${String(zi).padStart(2, '0')}` === data) return g[0]!
  }
  return ''
}

describe('pastila locului — antetul Tipicului', () => {
  it('are bulina lui „azi", data zilei deschise și cheia calendarului', () => {
    const h = pagina()
    // bulina: goală de text, cu numele în title/aria-label, și duce la ziua de azi
    expect(h).toContain('<a class="azi-buton" href="/tipic/2026-09-18" title="Astăzi" aria-label="Astăzi">')
    // scrisul locului: data ZILEI DESCHISE, lungă și scurtă, ca la Calendar
    expect(h).toContain('<span class="acum"><b class="lung">22 noiembrie 2026</b><b class="scurt">22 noiem. 2026</b></span>')
    // cheia: coboară bara de sub antet, nu duce nicăieri singură
    expect(h).toContain('id="cal-cheie" aria-expanded="false" aria-controls="bara-cal"')
  })

  it('bulina se aprinde numai când ziua deschisă e chiar azi', () => {
    expect(pagina({ azi: '2026-11-22' })).toContain('<button type="button" class="azi-buton activ" aria-disabled="true"')
    expect(pagina()).not.toContain('azi-buton activ')
  })

  /**
   * ⚠️ „Mâine" S-A ÎNTORS (user, 18.09.2026: „Mâine e bun"), după ce în dimineața aceleiași zile
   * ieșise odată cu mutarea pastilei după Calendar. Ziua de mâine se socotește din ZIUA DE AZI, nu
   * din ziua deschisă: e o treaptă fixă, ca bulina de lângă ea.
   *
   * Butonul calendarului de la marginea din dreapta (`#btn-cal`) și bara verticală dinaintea lui
   * rămân căzute: cheia stă în pastilă, iar „Mâine" a venit înapoi ÎN pastilă, nu lângă ea.
   */
  it('are „Mâine", cu link spre ziua de mâine, între scris și cheie', () => {
    const h = pagina()
    // azi e 18.09.2026, deci mâine e 19.09 — nu ziua de după cea deschisă (22.11)
    expect(h).toContain('<a class="maine-buton" href="/tipic/2026-09-19" title="Treci la ziua de mâine" aria-label="ziua de mâine">')
    // cuvântul ȘI săgeata, amândouă scrise în pagină: alegerea o face CSS-ul, după lățime
    expect(h).toContain('<span class="cuv">Mâine</span><span class="sgt">')
    // locul lui în pastilă: după scris, înaintea cheii
    expect(h).toMatch(/<\/span><a class="maine-buton"[^>]*>.*?<\/a><button type="button" class="cal-cheie"/)
    // butonul de calendar din dreapta rămâne căzut
    expect(h).not.toContain('id="btn-cal"')
    expect(h).not.toContain('class="desparte"')
    expect(h).not.toContain('unelte-dr')
  })

  it('„Mâine" e marcat activ numai când ziua deschisă chiar e mâine', () => {
    // azi 21.11 → mâine 22.11, adică exact ziua deschisă: treapta nu mai duce nicăieri
    const h = pagina({ azi: '2026-11-21' })
    expect(h).toContain('<button type="button" class="maine-buton activ" aria-disabled="true" aria-current="page" title="Ești pe ziua de mâine" aria-label="ziua de mâine">')
    expect(h).not.toContain('href="/tipic/2026-11-22" title="Treci la ziua de mâine"')
    // pe o zi venită din grilă (azi 18.09, deschisă 22.11) nicio treaptă nu e marcată
    expect(pagina()).not.toContain('maine-buton activ')
  })

  /** Fără lupă și fără cruce: căutarea și filtrul crucii rămân ale Calendarului. */
  it('pastila are PATRU segmente, nu șase ca la Calendar', () => {
    const h = pagina()
    expect(h).not.toContain('cauta-cheie')
    expect(h).not.toContain('sarb-cheie')
    // abonarea rămâne afară din pastilă, cum a fost mereu — o văd toți
    expect(h).toContain('id="b-abonare"')
  })
})

describe('bara calendarului, de sub antet', () => {
  it('se naște ASCUNSĂ, din server — nu dintr-o linie de JS', () => {
    expect(pagina()).toContain('<div class="bara-cal" id="bara-cal" hidden>')
  })

  it('poartă grila lunii deschise, scrisă tot de server', () => {
    const h = pagina()
    expect(h).toContain('<div class="cal-luna" id="cal-luna">')
    expect(h).toContain('<span class="cal-titlu">noiembrie 2026</span>')
    // săgețile duc la lunile vecine, prin numele lor, nu prin socoteli făcute în JS
    expect(h).toContain('data-luna="2026-10"')
    expect(h).toContain('data-luna="2026-12"')
  })

  it('ziua deschisă poartă marcajul `.acum`', () => {
    expect(celula(pagina(), '2026-11-22')).toContain('acum')
  })

  it('zilele fără rânduială proprie rămân inerte', () => {
    const c = celula(pagina(), '2026-11-03')
    expect(c).toContain('<span')
    expect(c).toContain('gol')
    expect(pagina()).toContain('aria-disabled="true"><b>3</b>')
  })
})

describe('culorile grilei (user, 18.09.2026)', () => {
  it('duminicile sunt roșii', () => {
    for (const d of ['2026-11-01', '2026-11-08', '2026-11-22']) {
      expect(celula(pagina(), d)).toContain('c-rosu')
    }
  })

  it('sărbătoarea adusă de la Calendar e roșie, deși nu e duminică', () => {
    expect(celula(pagina(), '2026-11-21')).toContain('c-rosu')
    // fără răspunsul Calendarului, ziua aceea rămâne neagră — duminicile nu, ele se știu din dată
    expect(celula(pagina({ sarbatori: [] }), '2026-11-21')).not.toContain('c-rosu')
    expect(celula(pagina({ sarbatori: [] }), '2026-11-22')).toContain('c-rosu')
  })

  it('o zi obișnuită NU e roșie', () => {
    for (const d of ['2026-11-30', '2026-11-03']) {
      expect(celula(pagina(), d)).not.toContain('c-rosu')
    }
  })
})

// ---------------------------------------------------------------------------
// Capătul lunilor vecine
// ---------------------------------------------------------------------------

/** Mediul de probă: o bază care dă zilele cu rânduială și un Calendar care numără întrebările. */
function mediu(zileRosii: string[] = ['2026-12-25']) {
  const cereri: string[] = []
  const env = {
    MEDIU: 'dev',
    ORIGINE_PUBLICA: 'https://rubik:8474',
    DOMENIU_COOKIE: '',
    EMAIL_SUPERADMIN: '',
    DB: {
      prepare: () => ({
        bind: () => ({ all: async () => ({ results: [...ZILE, '2026-12-06', '2026-12-25'].map((data) => ({ data })) }) }),
      }),
    },
    CALENDAR: {
      fetch: async (adresa: string) => {
        cereri.push(adresa)
        const zile = zileRosii.map((data) => ({ data, rang: 'praznic_imparatesc' }))
        return new Response(JSON.stringify({ zile }), { headers: { 'content-type': 'application/json' } })
      },
    },
    IDENTITATE: { fetch: async () => { throw new Error('identitatea n-are ce căuta la /v1') } },
    AUTORIZARE: { fetch: async () => { throw new Error('autorizarea n-are ce căuta la /v1') } },
  }
  return { env, cereri }
}

const cere = (cale: string) => new Request(`https://rubik:8474${cale}`)

describe('GET /v1/luna/<AAAA-LL> — grila lunilor vecine', () => {
  it('răspunde cu grila scrisă gata, nu cu JSON de desenat în browser', async () => {
    const { env } = mediu()
    const r = await tipic.fetch(cere('/tipic/v1/luna/2026-12?zi=2026-11-22'), env as never, {} as never)
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toContain('text/html')
    const h = await r.text()
    expect(h).toContain('<div class="cal-luna" id="cal-luna">')
    expect(h).toContain('<span class="cal-titlu">decembrie 2026</span>')
    // aceleași culori ca în pagina întreagă: duminica roșie, praznicul roșu, restul negru
    expect(h).toMatch(/class="zi c-rosu" href="\/tipic\/2026-12-06"><b>6<\/b>/)
    expect(h).toMatch(/class="zi c-rosu" href="\/tipic\/2026-12-25"><b>25<\/b>/)
    expect(h).toMatch(/class="zi gol"[^>]*><b>29<\/b>/)
  })

  /**
   * ⚠️ O SINGURĂ întrebare pentru o lună întreagă (`/v1/interval`), nu una pe zi: treizeci de
   * cereri prin Service Binding la fiecare apăsare de săgeată s-ar plăti la fiecare deschidere a
   * barei, iar boala nu s-ar vedea nicăieri în afară de facturi.
   */
  it('cere sărbătorile de la Calendar O SINGURĂ dată pe lună', async () => {
    const { env, cereri } = mediu()
    await tipic.fetch(cere('/tipic/v1/luna/2026-12'), env as never, {} as never)
    expect(cereri).toHaveLength(1)
    expect(cereri[0]).toBe('https://calendar.intern/v1/interval?de_la=2026-12-01&pana_la=2026-12-31')
  })

  /** Calendarul tăcut nu darâmă bara: rămân duminicile, care se știu din dată. */
  it('dacă Calendarul tace, grila se scrie oricum', async () => {
    const { env } = mediu()
    env.CALENDAR.fetch = async () => new Response('nu', { status: 500 })
    const r = await tipic.fetch(cere('/tipic/v1/luna/2026-12'), env as never, {} as never)
    expect(r.status).toBe(200)
    const h = await r.text()
    expect(h).toContain('<div class="cal-luna" id="cal-luna">')
    expect(h).toMatch(/class="zi" href="\/tipic\/2026-12-25"><b>25<\/b>/)
    // duminica rămâne roșie chiar și atunci: ea se știe din dată, nu de la nimeni
    expect(h).toMatch(/class="zi c-rosu" href="\/tipic\/2026-12-06"><b>6<\/b>/)
  })

  it('o lună scrisă greșit e refuzată, nu desenată', async () => {
    const { env } = mediu()
    expect((await tipic.fetch(cere('/tipic/v1/luna/2026-13'), env as never, {} as never)).status).toBe(400)
    expect((await tipic.fetch(cere('/tipic/v1/luna/noiembrie'), env as never, {} as never)).status).toBe(404)
  })
})
