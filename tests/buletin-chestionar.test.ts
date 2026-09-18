/**
 * CHESTIONARUL BULETINULUI NOU (user, 18.09.2026, seara: „formularul de pe /nou devine un chestionar
 * standard în bula de chat, pornit de comanda «buletin nou»").
 *
 * Patru lucruri se pot strica TĂCUT, și de asta stau aici:
 *   1. **mașina de stări** — o întrebare sărită, ori una pusă la nesfârșit, nu dă nicio eroare: omul
 *      doar se trezește într-o buclă, iar numărul nu se mai face. Se probează CAP-COADĂ, cu 0, 1 și
 *      2 articole secundare;
 *   2. **textul omului, literă cu literă** — dacă s-ar curăța, s-ar îndrepta ori s-ar tăia pe drum,
 *      pe hârtie ar ieși alt articol decât cel lipit, și nimeni n-ar afla de unde;
 *   3. **compunerea fără argumente** — toată hotărârea („modelul nu cară textul prin context") stă
 *      pe ea: dacă `buletin.compune` ar cere iar câmpuri, modelul mic ar trebui să le scrie el;
 *   4. **poarta** — schița e a numărului parohiei: cine n-are `bulletin.write` n-are ce scrie în ea.
 */
import { describe, expect, it } from 'vitest'
import { modulActiuni, type Actor } from '../packages/actiuni/src/index.js'
import { EFECTE } from '../packages/actiuni/src/contract.js'
import { actiuniBuletin } from '../apps/buletin/src/actiuni.js'
import {
  CHEIE_CHESTIONAR,
  INTREBARI_STANDARD,
  aniiPropusi,
  autorPropus,
  catreCerere,
  cheiaSchitei,
  completeaza,
  eSchitaNeatinsa,
  intrebarile,
  masuraArticolului,
  normalizeazaChestionar,
  numeDeCautat,
  pozeleSchitei,
  rezumatulSchitei,
  schitaGoala,
  schitaImplicita,
  scrieRaspuns,
  sursaPropusa,
  titluriPropuse,
  urmatoareaIntrebare,
  type Schita,
} from '../apps/buletin/src/schita.js'
import { DE_PROBA, TEXT_IMPLICIT, umpleCuProba } from '../apps/buletin/src/umplere.js'
import { semne } from '../apps/buletin/src/masuri.js'
import { buletinulNou, rubricaChestionar } from '../apps/buletin/src/pagini.js'

/** Rândurile rubricii, ca în `index.ts` — aici ne trebuie doar cheile și etichetele. */
const RANDURI = (Object.keys(INTREBARI_STANDARD) as Array<keyof typeof INTREBARI_STANDARD>).map((cheie) => ({
  cheie, eticheta: cheie, spune: '',
}))

// ---------------------------------------------------------------------------
// Serviciile de probă
// ---------------------------------------------------------------------------

const ULTIMUL = {
  nr: 615, data: '2026-09-06', an: '2026', luna: '09',
  cheie_pdf: '2026/buletin-615-2026-09-06.pdf', cheie_poza: null, cheie_poza_mica: null,
  marime_pdf: 700000, pagini: 4, sursa: 'v1',
}

/** ⚠️ Numărul următor se socotește cu REGULA SERVERULUI, nu scris de mână: data lui atârnă de azi. */
const URMATOR = buletinulNou(ULTIMUL, new Date().toISOString().slice(0, 10)) as { nr: number; data: string }

/** Articolul pe care îl lipește omul: din el ies toate propunerile codului. */
const ARTICOL = [
  'DESPRE RUGĂCIUNE',
  'Rugăciunea este respirația sufletului și hrana lui cea de toate zilele.',
  'Sfântul Ioan Gură de Aur (347-407) ne învață că rugăciunea neîncetată e cu putință oricui.',
  'Sursa: ziarullumina.ro',
].join('\n')

function dbFals() {
  const raspunde = (sql: string) => {
    const s = sql.replace(/\s+/g, ' ')
    if (s.includes('FROM buletine ORDER BY data DESC')) return { first: ULTIMUL, results: [ULTIMUL] }
    return { first: null, results: [] }
  }
  return {
    prepare: (sql: string) => {
      const r = raspunde(sql)
      const legat = { bind: () => legat, async first() { return r.first }, async all() { return { results: r.results } } }
      return legat
    },
  } as unknown as D1Database
}

/** R2 care ține minte: schița se scrie și se citește de aici, ca în depozitul adevărat. */
function r2Fals(initial: Record<string, unknown> = {}) {
  const tinut = new Map<string, string>(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]))
  const obiect = (cheie: string) => ({
    key: cheie, size: 1234, httpEtag: '"abc123"',
    async json() { return JSON.parse(tinut.get(cheie) ?? 'null') },
    async text() { return tinut.get(cheie) ?? '' },
  })
  return {
    tinut,
    bucket: {
      async head(c: string) { return tinut.has(c) ? obiect(c) : null },
      async get(c: string) { return tinut.has(c) ? obiect(c) : null },
      async put(c: string, corp: unknown) { tinut.set(c, typeof corp === 'string' ? corp : JSON.stringify(corp)); return { httpEtag: '"pus"' } },
      async delete(c: string | string[]) { for (const x of Array.isArray(c) ? c : [c]) tinut.delete(x) },
      async list({ prefix }: { prefix: string }) { return { objects: [...tinut.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) } },
    } as unknown as R2Bucket,
  }
}

const ctxExec = { waitUntil: () => undefined, passThroughOnException: () => undefined } as unknown as ExecutionContext

/**
 * Mediul acțiunilor. `chestionar` scrie în KV textele schimbate din Setări; `pomenire` spune ce
 * răspunde calendarul la căutarea autorului.
 */
function mediu(o: { depozit?: Record<string, unknown>; chestionar?: unknown; pomenire?: string | null; faraCalendar?: boolean } = {}) {
  const r2 = r2Fals(o.depozit)
  const cautate: string[] = []
  const env = {
    MEDIU: 'staging',
    DB: dbFals(),
    FISIERE: r2.bucket,
    PROGRAM: {
      fetch: async () => new Response(JSON.stringify({ titlu: '21 – 27 septembrie 2026', slujbe: 6, detalii: 5, stare: 'validat', tabel: '', stil: '', de_la: '', pana_la: '', strans: 0 }), { headers: { 'content-type': 'application/json' } }),
    },
    ...(o.faraCalendar ? {} : {
      CALENDAR: {
        fetch: async (adresa: string) => {
          cautate.push(new URL(adresa).searchParams.get('q') ?? '')
          const zi = o.pomenire === undefined ? '2026-11-13' : o.pomenire
          return new Response(JSON.stringify({ zile: zi ? [{ data: zi }] : [] }), { headers: { 'content-type': 'application/json' } })
        },
      },
    }),
    CONFIG: { get: async (cheie: string) => (cheie === CHEIE_CHESTIONAR ? (o.chestionar ?? null) : null) },
    BROWSER: { fetch: async () => new Response('{}') },
  }
  return { env, tinut: r2.tinut, cautate }
}

const actiunea = (nume: string) => {
  const a = actiuniBuletin.find((x) => x.nume === nume)
  if (!a) throw new Error(`nu există acțiunea ${nume}`)
  return a
}

const ctxActiune = (env: unknown) => ({
  env,
  actor: { fel: 'utilizator' as const, principal: { userId: 'u1', email: 'p@example.com' } },
  correlationId: 'probă',
  ctxExec,
  prin: 'chat',
})

/** Un pas al chestionarului, prin acțiunea adevărată. */
const raspunde = (env: unknown, subiect: string, valoare?: string) =>
  actiunea('buletin.raspunde').executa({ subiect, ...(valoare === undefined ? {} : { valoare }) } as never, ctxActiune(env) as never) as Promise<{
    scris: string; masura: { semne: number; incap: number; ramase: number } | null
    articol: string; subiect: string; intrebare: string; instructiune: string; gata: boolean
  }>

const incepe = (env: unknown) =>
  actiunea('buletin.chestionar').executa({} as never, ctxActiune(env) as never) as Promise<{
    nr: number | null; data: string; program: string | null; completat: string[]
    articol: string; subiect: string; intrebare: string; instructiune: string; gata: boolean
  }>

// ---------------------------------------------------------------------------
// Efectul nou
// ---------------------------------------------------------------------------

describe('efectul `ciorna`', () => {
  /**
   * ⚠️ Fără el, `buletin.raspunde` ar fi `scrie` — adică Da/Nu la FIECARE răspuns al omului: opt
   * întrebări ar cere șaisprezece apăsări. Ce-l ține în frâu e că schița nu e o dată a parohiei.
   */
  it('e în contract, iar `buletin.raspunde` îl poartă', () => {
    expect(EFECTE).toContain('ciorna')
    expect(actiunea('buletin.raspunde').efect).toBe('ciorna')
    // confirmarea rămâne UNA, la compunere
    expect(actiunea('buletin.compune').efect).toBe('scrie')
    expect(actiunea('buletin.chestionar').efect).toBe('citeste')
  })

  /** Amândouă scriu în numărul parohiei: cine n-are cheia buletinului n-are ce căuta acolo. */
  it('chestionarul și răspunsul cer `bulletin.write`, ca și compunerea', () => {
    expect(actiunea('buletin.chestionar').permisiune).toBe('bulletin.write')
    expect(actiunea('buletin.raspunde').permisiune).toBe('bulletin.write')
  })
})

describe('poarta, prin registrul de acțiuni', () => {
  const OMUL: Actor = { fel: 'utilizator', principal: { userId: 'u1', email: 'om@exemplu.ro' } }
  const modul = modulActiuni<any>({ aplicatie: 'buletin', versiune: '0.9.0', actiuni: actiuniBuletin })
  const cuDrept = (are: boolean) => ({
    fetch: async () => new Response(JSON.stringify({ allowed: are, reason: 'probă', matchedScopes: [] }), { headers: { 'content-type': 'application/json' } }),
  })

  it('fără `bulletin.write`, răspunsul nu ajunge în schiță', async () => {
    const { env, tinut } = mediu()
    const r = await modul.executa(
      'buletin.raspunde',
      { subiect: 'motto', valoare: 'Un citat' },
      { ...env, AUTORIZARE: cuDrept(false) },
      ctxExec,
      { actor: OMUL, correlationId: 'probă', prin: 'chat' },
    )
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.cod).toBe('fara_drept')
    expect(tinut.has(cheiaSchitei(URMATOR))).toBe(false)
  })

  it('cu cheia buletinului, răspunsul se scrie', async () => {
    const { env, tinut } = mediu()
    const r = await modul.executa(
      'buletin.raspunde',
      { subiect: 'motto', valoare: 'Un citat' },
      { ...env, AUTORIZARE: cuDrept(true) },
      ctxExec,
      { actor: OMUL, correlationId: 'probă', prin: 'chat' },
    )
    expect(r.ok).toBe(true)
    expect(tinut.has(cheiaSchitei(URMATOR))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Euristicile — ce propune CODUL, ca modelul să n-aibă de gândit
// ---------------------------------------------------------------------------

describe('euristicile: ce scoate codul din textul lipit', () => {
  it('autorul: numele cu titlu bisericesc, cu legăturile mici din el', () => {
    expect(autorPropus(ARTICOL)).toBe('Sfântul Ioan Gură de Aur')
  })

  it('autorul: semnătura „de Cutare" de la sfârșit', () => {
    expect(autorPropus('Un text oarecare, scris pe câteva rânduri.\nde Părintele Teofil')).toBe('Părintele Teofil')
  })

  /** ⚠️ Ultimul rând scurt se încearcă ÎNAINTEA primului: primul e mai totdeauna titlul. */
  it('autorul: ultimul rând scurt bate primul rând scurt', () => {
    expect(autorPropus('DESPRE POST\nUn text care spune ceva despre post și rugăciune.\nIoan Ianolide')).toBe('Ioan Ianolide')
  })

  it('autorul: rândul „Sursa: …" nu e luat drept nume', () => {
    expect(autorPropus('Un text.\nSursa: ziarullumina.ro')).toBeNull()
  })

  it('autorul: când nu e nimic de propus, se spune limpede', () => {
    expect(autorPropus('')).toBeNull()
  })

  it('anii vieții: ies din text, iar trimiterile la Scriptură nu trec drept ani', () => {
    expect(aniiPropusi(ARTICOL)).toBe('347-407')
    expect(aniiPropusi('Matei 5-7 ne spune')).toBeNull()
    expect(aniiPropusi('fără cifre')).toBeNull()
  })

  it('titlurile: primul rând, rândul cu majuscule și prima propoziție tăiată', () => {
    const titluri = titluriPropuse(ARTICOL)
    expect(titluri[0]).toBe('DESPRE RUGĂCIUNE')
    expect(titluri.length).toBeGreaterThanOrEqual(2)
    expect(titluri.length).toBeLessThanOrEqual(3)
    // niciun candidat nu trece de măsura unui titlu de foaie
    for (const t of titluri) expect(t.length).toBeLessThanOrEqual(80)
  })

  it('sursa: „Sursa:", „din:" ori un domeniu scris în text', () => {
    expect(sursaPropusa(ARTICOL)).toBe('ziarullumina.ro')
    expect(sursaPropusa('Un text.\ndin: Cuvântul care zidește')).toBe('Cuvântul care zidește')
    expect(sursaPropusa('Preluat de pe doxologia.ro, cu îngăduință.')).toBe('doxologia.ro')
    expect(sursaPropusa('Sf. Ioan a zis.')).toBeNull()
  })

  /** ⚠️ Calendarul scrie „Sfântul Ierarh Ioan Gură de Aur": căutarea după tot numele n-ar nimeri. */
  it('numele de căutat în calendar: fără titlurile bisericești', () => {
    expect(numeDeCautat('SFÂNTUL IOAN GURĂ DE AUR')).toBe('IOAN GURĂ DE AUR')
    expect(numeDeCautat('Părintele Arsenie Papacioc')).toBe('Arsenie Papacioc')
  })
})

// ---------------------------------------------------------------------------
// Mașina de stări, fără rețea și fără depozit
// ---------------------------------------------------------------------------

describe('mașina de stări e deterministă', () => {
  const intrebari = intrebarile()
  const goala = (): Schita => schitaGoala({ nr: 616, data: '2026-09-20', motto: 'Un motto vechi.', motoAutor: 'Cineva' })

  it('aceeași schiță dă mereu aceeași întrebare', () => {
    const s = goala()
    expect(urmatoareaIntrebare(s, intrebari)).toEqual(urmatoareaIntrebare(s, intrebari))
  })

  it('începe cu motto-ul numărului trecut, arătat în întrebare', () => {
    const i = urmatoareaIntrebare(goala(), intrebari)
    expect(i.subiect).toBe('motto')
    expect(i.text).toContain('Un motto vechi.')
    expect(i.text).toContain('Cineva')
    expect(i.text).toContain('Rămâne așa')
  })

  /** Fără motto de la numărul trecut, întrebarea cu ghilimele goale n-ar avea sens. */
  it('fără motto de la numărul trecut, întreabă simplu', () => {
    const i = urmatoareaIntrebare(schitaGoala({ nr: 616, data: '2026-09-20' }), intrebari)
    expect(i.text).toBe('Care este motto-ul numărului?')
  })

  it('anii și pomenirea nu se întreabă când nu s-a fixat niciun autor', () => {
    let s = goala()
    s = scrieRaspuns(s, { subiect: 'pastreaza' }, intrebari).schita
    s = scrieRaspuns(s, { subiect: 'text', valoare: ARTICOL }, intrebari).schita
    expect(urmatoareaIntrebare(s, intrebari).subiect).toBe('autor')
    s = scrieRaspuns(s, { subiect: 'sari' }, intrebari).schita
    // autorul sărit → se trece direct la titlu: „a trăit între anii…" n-ar avea despre cine să fie
    expect(urmatoareaIntrebare(s, intrebari).subiect).toBe('titlu')
  })

  it('pomenirea se sare când calendarul n-a găsit nimic', () => {
    let s = goala()
    s = scrieRaspuns(s, { subiect: 'pastreaza' }, intrebari).schita
    s = scrieRaspuns(s, { subiect: 'text', valoare: ARTICOL }, intrebari).schita
    s = scrieRaspuns(s, { subiect: 'autor', valoare: 'Părintele Arsenie Papacioc' }, intrebari).schita
    s.principal.pomenireCautata = '' // căutat, nu e sfânt în calendar
    s = scrieRaspuns(s, { subiect: 'sari' }, intrebari).schita // anii
    expect(urmatoareaIntrebare(s, intrebari).subiect).toBe('titlu')
  })

  /** „Nu" ținut minte: altfel chestionarul ar întreba la nesfârșit același lucru. */
  it('un subiect sărit nu se mai întreabă', () => {
    let s = goala()
    s = scrieRaspuns(s, { subiect: 'sari' }, intrebari).schita
    expect(urmatoareaIntrebare(s, intrebari).subiect).toBe('text')
    expect(s.motto).toBe('Un motto vechi.')
  })

  it('„de_la_capat" golește schița, dar păstrează motto-ul numărului trecut', () => {
    let s = goala()
    s = scrieRaspuns(s, { subiect: 'pastreaza' }, intrebari).schita
    s = scrieRaspuns(s, { subiect: 'text', valoare: ARTICOL }, intrebari).schita
    s = scrieRaspuns(s, { subiect: 'de_la_capat' }, intrebari).schita
    expect(s.principal.text).toBeUndefined()
    expect(s.motto).toBe('Un motto vechi.')
    expect(urmatoareaIntrebare(s, intrebari).subiect).toBe('motto')
  })

  it('„sterge_secundar" scoate ultimul articol și redeschide întrebarea „mai adăugăm?"', () => {
    let s = goala()
    s.gata = ['motto', 'mai_adaugam']
    s.principal = { gata: ['text', 'autor', 'titlu', 'sursa'] }
    s.secundari = [{ gata: ['text', 'autor', 'titlu', 'sursa'] }]
    s = scrieRaspuns(s, { subiect: 'sterge_secundar' }, intrebari).schita
    expect(s.secundari).toHaveLength(0)
    expect(urmatoareaIntrebare(s, intrebari).subiect).toBe('mai_adaugam')
  })
})

// ---------------------------------------------------------------------------
// Cap-coadă, prin acțiunile adevărate
// ---------------------------------------------------------------------------

/** Un chestionar întreg pentru un articol, până la întrebarea „mai adăugăm?". */
async function unArticol(env: unknown, cine: string) {
  const dupaText = await raspunde(env, 'text', ARTICOL)
  expect(dupaText.articol, `${cine}: după text urmează autorul`).toBeTruthy()
  expect(dupaText.subiect).toBe('autor')
  expect(dupaText.intrebare).toContain('Sfântul Ioan Gură de Aur')

  const dupaAutor = await raspunde(env, 'pastreaza')
  expect(dupaAutor.subiect).toBe('ani')
  expect(dupaAutor.intrebare).toContain('347-407')

  const dupaAni = await raspunde(env, 'pastreaza')
  expect(dupaAni.subiect).toBe('pomenire')
  expect(dupaAni.intrebare).toContain('13 noiembrie')

  const dupaPomenire = await raspunde(env, 'pastreaza')
  expect(dupaPomenire.subiect).toBe('titlu')
  expect(dupaPomenire.intrebare).toContain('1. DESPRE RUGĂCIUNE')

  const dupaTitlu = await raspunde(env, 'titlu', '1')
  expect(dupaTitlu.scris).toContain('DESPRE RUGĂCIUNE')
  expect(dupaTitlu.subiect).toBe('sursa')
  expect(dupaTitlu.intrebare).toContain('ziarullumina.ro')

  return await raspunde(env, 'pastreaza')
}

describe('chestionarul, cap-coadă, prin acțiuni', () => {
  it('numărul fără niciun articol secundar', async () => {
    const { env, tinut, cautate } = mediu()

    const inceput = await incepe(env)
    expect(inceput.nr).toBe(URMATOR.nr)
    expect(inceput.data).toBe(URMATOR.data)
    expect(inceput.subiect).toBe('motto')
    expect(inceput.gata).toBe(false)
    // instrucțiunea îi spune modelului să nu adauge nimic de la el
    expect(inceput.instructiune).toContain('EXACT întrebarea')
    expect(inceput.instructiune).toContain('buletin.raspunde')

    const dupaMotto = await raspunde(env, 'pastreaza')
    expect(dupaMotto.subiect).toBe('text')
    expect(dupaMotto.articol).toBe('principal')

    const dupaSursa = await unArticol(env, 'principal')
    expect(dupaSursa.subiect).toBe('mai_adaugam')

    const gata = await raspunde(env, 'sari')
    expect(gata.gata).toBe(true)
    expect(gata.instructiune).toContain('buletin.compune')
    expect(gata.instructiune).toContain('FĂRĂ niciun argument')

    // ⚠️ numele căutat în calendar e cel fără titluri bisericești
    expect(cautate.some((q) => q.includes('IOAN') || q.includes('Ioan'))).toBe(true)

    // schița stă în depozit, sub cheia numărului — discuția se poate relua a doua zi
    const schita = JSON.parse(tinut.get(cheiaSchitei(URMATOR))!) as Schita
    expect(schita.principal.autor).toBe('Sfântul Ioan Gură de Aur')
    expect(schita.principal.ani).toBe('347-407')
    expect(schita.principal.pomenire).toBe('† 13 noiembrie')
    expect(schita.principal.titlu).toBe('DESPRE RUGĂCIUNE')
    expect(schita.principal.sursa).toBe('ziarullumina.ro')
    expect(schita.secundari).toHaveLength(0)
    expect(schita.pas?.subiect).toBe('gata')
  })

  it('numărul cu un articol secundar: întrebările 2–7 se reiau pentru el', async () => {
    const { env, tinut } = mediu()
    await incepe(env)
    await raspunde(env, 'pastreaza')
    await unArticol(env, 'principal')

    const daAdaugam = await raspunde(env, 'pastreaza')
    expect(daAdaugam.articol).toBe('s1')
    expect(daAdaugam.subiect).toBe('text')
    expect(daAdaugam.intrebare).toContain('articolului secundar 1')

    const dupaSursa = await unArticol(env, 's1')
    expect(dupaSursa.subiect).toBe('mai_adaugam')
    const gata = await raspunde(env, 'sari')
    expect(gata.gata).toBe(true)

    const schita = JSON.parse(tinut.get(cheiaSchitei(URMATOR))!) as Schita
    expect(schita.secundari).toHaveLength(1)
    expect(schita.secundari[0]!.titlu).toBe('DESPRE RUGĂCIUNE')
  })

  /** ⚠️ La doi secundari nu se mai întreabă „mai adăugăm?": foaia nu ține mai mult. */
  it('numărul cu doi secundari se încheie singur, fără să mai întrebe', async () => {
    const { env, tinut } = mediu()
    await incepe(env)
    await raspunde(env, 'pastreaza')
    await unArticol(env, 'principal')
    await raspunde(env, 'pastreaza')
    await unArticol(env, 's1')
    await raspunde(env, 'pastreaza')
    const gata = await unArticol(env, 's2')
    expect(gata.gata).toBe(true)
    expect(gata.subiect).toBe('gata')

    const schita = JSON.parse(tinut.get(cheiaSchitei(URMATOR))!) as Schita
    expect(schita.secundari).toHaveLength(2)
  })

  /**
   * ⚠️ TEXTUL RĂMÂNE LITERĂ CU LITERĂ. Rândurile goale dinăuntru despart paragrafele pe hârtie;
   * dacă s-ar „curăța", numărul tipărit ar arăta altfel decât ce a lipit omul.
   */
  it('textul se scrie neatins, cu paragrafele lui', async () => {
    const { env, tinut } = mediu()
    const cuParagrafe = 'Întâiul paragraf, cu diacritice: șțăîâ.\n\nAl doilea paragraf.\n\n*Un citat din Scriptură*'
    await incepe(env)
    await raspunde(env, 'pastreaza')
    await raspunde(env, 'text', cuParagrafe)
    const schita = JSON.parse(tinut.get(cheiaSchitei(URMATOR))!) as Schita
    expect(schita.principal.text).toBe(cuParagrafe)
  })

  /**
   * ⚠️ Măsura SE SPUNE, dar nu oprește nimic: omul tocmai a lipit textul, iar un refuz l-ar pune
   * să-l lipească din nou. Refuzul cu cifre rămâne la compunere, unde chiar se face hârtia.
   */
  it('textul peste măsură se primește, și se spune cu cât e peste', async () => {
    const { env } = mediu()
    await incepe(env)
    await raspunde(env, 'pastreaza')
    const r = await raspunde(env, 'text', 'a '.repeat(12000))
    expect(r.masura).not.toBeNull()
    expect(r.masura!.ramase).toBeLessThan(0)
    // și totuși s-a scris, și se merge mai departe
    expect(r.scris).toContain('de semne')
    expect(r.subiect).toBe('autor')
  })

  it('„unde am rămas?" spune pe scurt ce e completat, fără textele lungi', async () => {
    const { env } = mediu()
    await incepe(env)
    await raspunde(env, 'pastreaza')
    await raspunde(env, 'text', ARTICOL)
    const reluat = await incepe(env)
    expect(reluat.subiect).toBe('autor')
    const scrisDespre = reluat.completat.join(' | ')
    expect(scrisDespre).toContain('de semne')
    // ⚠️ textul NU se întoarce modelului: tot rostul schiței e să nu-l care prin context
    expect(scrisDespre).not.toContain('Rugăciunea este respirația sufletului')
  })

  it('fără calendar legat, pomenirea se sare fără să cadă nimic', async () => {
    const { env } = mediu({ faraCalendar: true })
    await incepe(env)
    await raspunde(env, 'pastreaza')
    await raspunde(env, 'text', ARTICOL)
    const dupaAutor = await raspunde(env, 'pastreaza')
    expect(dupaAutor.subiect).toBe('ani')
    const dupaAni = await raspunde(env, 'pastreaza')
    expect(dupaAni.subiect).toBe('titlu')
  })

  /** Un număr scris din listă („2") nu se scrie ca atare pe foaie: se traduce din candidați. */
  it('„2" la titluri alege al doilea candidat, nu scrie „2" pe foaie', async () => {
    const { env, tinut } = mediu()
    await incepe(env)
    await raspunde(env, 'pastreaza')
    await raspunde(env, 'text', ARTICOL)
    await raspunde(env, 'pastreaza')
    await raspunde(env, 'pastreaza')
    await raspunde(env, 'pastreaza')
    await raspunde(env, 'titlu', '2')
    const schita = JSON.parse(tinut.get(cheiaSchitei(URMATOR))!) as Schita
    expect(schita.principal.titlu).not.toBe('2')
    expect(schita.principal.titlu!.length).toBeGreaterThan(5)
  })

  it('poza se dă oricând, ca adresă, și nu e o întrebare a chestionarului', async () => {
    const { env, tinut } = mediu()
    await incepe(env)
    const r = await raspunde(env, 'poza', 'https://exemplu.ro/poza.jpg')
    // întrebarea de acum rămâne cea dinainte: poza n-a sărit peste nimic
    expect(r.subiect).toBe('motto')
    const schita = JSON.parse(tinut.get(cheiaSchitei(URMATOR))!) as Schita
    expect(schita.principal.poza).toBe('https://exemplu.ro/poza.jpg')
  })
})

// ---------------------------------------------------------------------------
// Întrebările din Setări
// ---------------------------------------------------------------------------

describe('întrebările se pot schimba din Setări', () => {
  it('un text scris de admin intră în locul celui standard, cu locurile completate', async () => {
    const { env } = mediu({ chestionar: { autor: 'Zic eu că autorul e {autor}. Așa rămâne?' } })
    await incepe(env)
    await raspunde(env, 'pastreaza')
    const dupaText = await raspunde(env, 'text', ARTICOL)
    expect(dupaText.intrebare).toBe('Zic eu că autorul e Sfântul Ioan Gură de Aur. Așa rămâne?')
  })

  it('un câmp gol înseamnă „ține textul standard", nu „întrebare goală"', () => {
    const c = normalizeazaChestionar({ autor: '   ', titlu: 'Alege un titlu: {titluri}' })
    expect(c.autor).toBeUndefined()
    expect(intrebarile(c).autor).toBe(INTREBARI_STANDARD.autor)
    expect(intrebarile(c).titlu).toBe('Alege un titlu: {titluri}')
  })

  it('cheile necunoscute și textele prea lungi nu trec', () => {
    const c = normalizeazaChestionar({ ceva: 'nu există', motto: 'x'.repeat(900) }) as Record<string, string>
    expect(c.ceva).toBeUndefined()
    expect(c.motto!.length).toBe(600)
  })

  /** Un text scris ca standardul nu se ține în KV: altfel o îndreptare din cod n-ar mai ajunge. */
  it('textul identic cu standardul nu se păstrează', () => {
    expect(normalizeazaChestionar({ motto: INTREBARI_STANDARD.motto }).motto).toBeUndefined()
  })

  it('locurile necunoscute rămân scrise, nu devin „undefined"', () => {
    expect(completeaza('a {x} b {autor}', { autor: 'Cutare' })).toBe('a {x} b Cutare')
  })

  /** Rubrica din Setări: cele opt câmpuri, cu jetonul CSRF AL PAGINII (nu unul făcut de ea). */
  it('rubrica are un câmp pentru fiecare întrebare și butonul de întoarcere la standard', () => {
    const h = rubricaChestionar({
      prefix: '/buletin',
      csrf: 'jeton-de-proba',
      intrebari: intrebarile({ autor: 'Altă întrebare despre {autor}' }),
      standard: INTREBARI_STANDARD,
      randuri: RANDURI,
      salvat: true,
    })
    expect(h).toContain('<form method="post" action="/buletin/setari/chestionar">')
    expect(h).toContain('name="csrf" value="jeton-de-proba"')
    for (const r of RANDURI) expect(h, r.cheie).toContain(`name="${r.cheie}"`)
    expect(h).toContain('Înapoi la textele standard')
    expect(h).toContain('Chestionarul s-a salvat.')
    // ce s-a schimbat față de textul din cod se vede, ca adminul să știe ce a atins
    expect(h).toContain('Altă întrebare despre {autor}')
    expect(h).toContain('schimbată')
  })
})

// ---------------------------------------------------------------------------
// Din schiță în foaie
// ---------------------------------------------------------------------------

describe('schița, în forma cerută de compunere', () => {
  const plina = (): Schita => ({
    nr: 616, data: '2026-09-20',
    motto: 'Un motto.', motoAutor: 'Cineva',
    principal: { autor: 'AUTOR', ani: '1-2', titlu: 'TITLU', text: 'Text.', sursa: 'undeva.ro', poza: 'https://exemplu.ro/mare.jpg' },
    secundari: [{ titlu: 'AL DOILEA', text: 'Alt text.', poza: 'https://exemplu.ro/mic.jpg' }],
    actualizat: '',
  })

  it('câmpurile trec unul în altul, iar poza devine da/nu', () => {
    const c = catreCerere(plina())
    expect(c).toMatchObject({
      motto: 'Un motto.', motoAutor: 'Cineva', nr: 616, data: '2026-09-20', floare: true,
    })
    expect(c.principal.autor).toBe('AUTOR')
    expect(c.principal.poza).toBe(true)
    expect(c.secundari).toHaveLength(1)
    expect(c.secundari![0]!.autor).toBe('')
  })

  /** ⚠️ Adresele pozelor NU se pierd: ele merg deoparte, cum le cere `compune`. */
  it('adresele pozelor ies deoparte, cu numele pe care le cere compunerea', () => {
    expect(pozeleSchitei(plina())).toEqual({ p: 'https://exemplu.ro/mare.jpg', s1: 'https://exemplu.ro/mic.jpg' })
  })

  it('o schiță goală dă un număr gol, nu unul stricat', () => {
    const c = catreCerere(schitaGoala({ nr: 616, data: '2026-09-20' }))
    expect(c.motto).toBe('')
    expect(c.principal.text).toBe('')
    expect(c.secundari).toEqual([])
  })
})

describe('compunerea fără argumente ia totul din schiță', () => {
  /**
   * ⚠️ AICI STĂ TOATĂ HOTĂRÂREA userului („modelul nu cară textul prin context"). Rezumatul e ce
   * citește omul în propunerea cu Da/Nu, deci trebuie să spună numărul adevărat ȘI titlul din
   * schiță — nu unul scris de model.
   */
  it('rezumatul propunerii spune numărul din arhivă și titlul din schiță', async () => {
    const { env } = mediu()
    await incepe(env)
    await raspunde(env, 'pastreaza')
    await raspunde(env, 'text', ARTICOL)
    await raspunde(env, 'pastreaza')
    await raspunde(env, 'pastreaza')
    await raspunde(env, 'pastreaza')
    await raspunde(env, 'titlu', '1')

    const rezumat = await actiunea('buletin.compune').rezuma!({} as never, ctxActiune(env) as never)
    expect(rezumat).toContain(`nr. ${URMATOR.nr}`)
    expect(rezumat).toContain('DESPRE RUGĂCIUNE')
    expect(rezumat).toContain('Sfântul Ioan Gură de Aur')
  })

  it('socoteala fără argumente socotește textul din schiță', async () => {
    const { env } = mediu()
    await incepe(env)
    await raspunde(env, 'pastreaza')
    await raspunde(env, 'text', ARTICOL)
    const r = (await actiunea('buletin.socoteala').executa({} as never, ctxActiune(env) as never)) as {
      nr: number; data: string; scrise_cu_tot: number; incape: boolean
    }
    expect(r.nr).toBe(URMATOR.nr)
    expect(r.data).toBe(URMATOR.data)
    expect(r.scrise_cu_tot).toBeGreaterThan(100)
    expect(r.incape).toBe(true)
  })

  /** Numărul cerut ANUME rămâne cu putere și pe drumul schiței. */
  it('nr. și data scrise anume nu se rescriu cu cele din arhivă', async () => {
    const { env } = mediu()
    await incepe(env)
    const rezumat = await actiunea('buletin.compune').rezuma!(
      { nr: 620, data: '2026-11-01' } as never,
      ctxActiune(env) as never,
    )
    expect(rezumat).toContain('nr. 620')
  })
})

// ---------------------------------------------------------------------------
// VARIANTA ZERO: schița implicită de la prima intrare pe `/nou`
// ---------------------------------------------------------------------------

/**
 * SCHIȚA IMPLICITĂ (user, 19.09.2026: „la prima accesare a /nou să se genereze varianta cu «text» la
 * conținut textul principal și restul câmpurilor implicite… ca să poți genera varianta 0 de buletin").
 *
 * Trei lucruri se pot strica TĂCUT, și de asta stau aici:
 *   1. **locurile n-au voie să treacă drept răspunsuri** — „NUME AUTOR" și „text" scrise pe hârtie ca
 *      atare ar da un număr cu patru semne pe pagina întâi, iar sub `compus/` s-ar păstra ca și cum
 *      le-ar fi scris omul (de acolo se ia motto-ul numărului următor);
 *   2. **chestionarul trebuie să meargă mai departe peste ele** — dacă locurile s-ar însemna ca
 *      hotărâte, bula n-ar mai avea ce întreba, și numărul zero ar rămâne numărul final;
 *   3. **compunerea de la sine** — se pornește NUMAI cât schița e neatinsă.
 */
describe('schița implicită — varianta zero', () => {
  const IMPLICITA = () => schitaImplicita({ nr: 616, data: '2026-09-20', motto: 'Un citat', motoAutor: 'Cineva' })

  it('pornește cu toate locurile ocupate, iar textul principal e chiar „text"', () => {
    const s = IMPLICITA()
    expect(s.principal.autor).toBe(DE_PROBA.autor)
    expect(s.principal.ani).toBe(DE_PROBA.ani)
    expect(s.principal.titlu).toBe(DE_PROBA.titlu)
    expect(s.principal.sursa).toBe(DE_PROBA.sursa)
    expect(s.principal.text).toBe(TEXT_IMPLICIT)
    expect(s.principal.text).toBe('text')
    expect(s.motto).toBe('Un citat')
    // ⚠️ pomenirea și poza rămân NESCRISE: ele lipsesc și din numere adevărate, iar o adresă de poză
    // închipuită ar lăsa un pătrat gol în foaie, fără nicio eroare nicăieri
    expect(s.principal.pomenire).toBeUndefined()
    expect(s.principal.poza).toBeUndefined()
  })

  it('locurile NU trec drept răspunsuri: peste granița compunerii ies goale', () => {
    const cerut = catreCerere(IMPLICITA())
    expect(cerut.principal.autor).toBe('')
    expect(cerut.principal.titlu).toBe('')
    expect(cerut.principal.text).toBe('')
    expect(cerut.principal.ani).toBeUndefined()
    expect(cerut.principal.sursa).toBeUndefined()
  })

  /** ⚠️ Chiar asta e „varianta 0": o foaie întreagă, nu una cu patru semne de text. */
  it('umplerea de probă o duce la o foaie ÎNTREAGĂ, cu lorem cât încape', () => {
    const { cerut, deProba } = umpleCuProba(catreCerere(IMPLICITA()), { slujbe: 6, detalii: 5 })
    expect(cerut.principal.text.startsWith('Lorem ipsum')).toBe(true)
    expect(semne(cerut.principal.text)).toBeGreaterThan(5000)
    expect(cerut.principal.autor).toBe(DE_PROBA.autor)
    expect(deProba.join('; ')).toContain('principal: textul')
  })

  it('chestionarul merge mai departe peste ea: începe tot de la motto', () => {
    const i = urmatoareaIntrebare(IMPLICITA(), intrebarile())
    expect(i.subiect).toBe('motto')
    expect((IMPLICITA().gata ?? []).length).toBe(0)
  })

  /** ⚠️ Altfel „da, îl folosim" la autor ar scrie „text" ca autor al numărului. */
  it('din locul textului nu se propune niciun autor', () => {
    expect(autorPropus(TEXT_IMPLICIT)).toBe(null)
    expect(autorPropus('  Text  ')).toBe(null)
  })

  it('„unde am rămas?" spune „încă nimic", nu locurile de probă', () => {
    const r = rezumatulSchitei(IMPLICITA()).join(' | ')
    expect(r).not.toContain('NUME AUTOR')
    expect(r).not.toContain('TITLU ARTICOL')
    expect(r).toContain('încă nimic')
  })

  it('măsura pornește de la zero semne scrise, nu de la patru', () => {
    expect(masuraArticolului(IMPLICITA(), 'principal').semne).toBe(0)
  })

  it('e „neatinsă" până la primul răspuns, apoi nu mai e', () => {
    const s = IMPLICITA()
    expect(eSchitaNeatinsa(s)).toBe(true)
    const dupa = scrieRaspuns(s, { subiect: 'motto', valoare: 'Alt citat' }, intrebarile()).schita
    expect(eSchitaNeatinsa(dupa)).toBe(false)
  })

  it('un răspuns scrie PESTE loc, nu pe lângă el', () => {
    let s = IMPLICITA()
    s = scrieRaspuns(s, { subiect: 'autor', valoare: 'SFÂNTUL VASILE CEL MARE' }, intrebarile()).schita
    s = scrieRaspuns(s, { subiect: 'text', valoare: ARTICOL }, intrebarile()).schita
    expect(s.principal.autor).toBe('SFÂNTUL VASILE CEL MARE')
    expect(s.principal.text).toBe(ARTICOL)
    expect(catreCerere(s).principal.autor).toBe('SFÂNTUL VASILE CEL MARE')
  })

  /** „Indicând exact ce vine": o valoare dată direct, la ce articol vrea omul, în orice ordine. */
  it('o valoare dată anume, la un articol anume, intră fără să treacă prin întrebări', () => {
    let s = IMPLICITA()
    s = scrieRaspuns(s, { subiect: 'titlu', valoare: 'DESPRE POST', articol: 's1' }, intrebarile()).schita
    expect(s.secundari.length).toBe(1)
    expect(s.secundari[0]!.titlu).toBe('DESPRE POST')
    // iar chestionarul rămâne unde era: la principal, la motto
    expect(urmatoareaIntrebare(s, intrebarile()).subiect).toBe('motto')
  })

  it('acțiunea `buletin.chestionar` scrie schița implicită în depozit, la prima chemare', async () => {
    const { env, tinut } = mediu()
    await incepe(env)
    const scrisa = JSON.parse(tinut.get(cheiaSchitei(URMATOR)) ?? 'null') as { principal: { text: string } }
    expect(scrisa.principal.text).toBe(TEXT_IMPLICIT)
  })
})
