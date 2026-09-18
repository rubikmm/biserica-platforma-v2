/**
 * CHATUL, PE APLICAȚIE — îndrumări și unelte deosebite pentru fiecare bulă.
 *
 * Cerere a userului din 18.09.2026, 12:53: „vreau mai întâi să avem instrucțiuni diferite per
 * aplicație — să activăm din Administrare / Super-Admin aplicațiile care primesc chat — și din
 * Setări aplicație pe un tab Chat AI să avem câmpurile specifice aplicației. Vreau să răspundă
 * repede la toate cererile — nu să încerce nu știu ce minuni. Dacă nu e ceva ce se potrivește cu ce
 * are voie să facă să răspundă că nu poate face asta." Și, un minut mai târziu: „trebuie să
 * construim ceva care merge cu modelul free pus acum".
 *
 * Ce se poate strica TĂCUT, și de asta stă fiecare probă aici:
 *   1. **amestecul înapoi** — dacă îndrumările s-ar citi iar din cheia comună, bula Buletinului ar
 *      primi obiceiurile Programului: nimeni n-ar vedea o eroare, doar răspunsuri mai proaste și
 *      context plătit degeaba;
 *   2. **ștergerea în tăcere** — dacă ecranul de Setări s-ar desena cu zero bife când creierul tace,
 *      o salvare de acolo ar șterge uneltele alese, fără niciun semn;
 *   3. **poarta salvării** — ruta de salvare stă ÎNAINTEA porții obișnuite (ca să meargă și cu chatul
 *      stins), deci paza ei e singura: adminul aplicației + jetonul CSRF;
 *   4. **„nu pot face asta aici"** — regula care oprește modelul mic din improvizat trebuie să fie în
 *      instrucțiuni MEREU, și când aplicația n-are nicio unealtă.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  cheiaAplicatiei,
  configAplicatie,
  modulChat,
  normalizeazaAplicatie,
  rubricaChat,
  scrieConfigAplicatie,
  uitaConfigChat,
  type ConfigChat,
  type UnealtaDeBifat,
} from '../packages/chat/src/index.js'
import { instructiuni } from '../services/chat-worker/src/creier.js'

// ---------------------------------------------------------------------------
// Mediul de probă
// ---------------------------------------------------------------------------

const GLOBAL: ConfigChat = {
  activ: true,
  aplicatii: { program: true, buletin: true },
  cineVede: 'admini',
  model: '@cf/zai-org/glm-5.3-flash',
  creier: 'workers-ai',
  // moștenirea: îndrumările vechi, comune, pline de obiceiurile Programului
  indrumari: 'Liturghia de duminică e la 08:00.',
  unelte: ['program.adauga_slujba', 'program.valideaza_saptamana', 'buletin.compune'],
}

/** KV care ține minte pe chei, nu un obiect pentru toate: aici tocmai cheile sunt miezul probei. */
function kvFals(inceput: Record<string, unknown> = {}) {
  const date = new Map<string, string>(Object.entries(inceput).map(([k, v]) => [k, JSON.stringify(v)]))
  return {
    kv: {
      async get(cheie: string, fel?: string) {
        const scris = date.get(cheie)
        if (scris === undefined) return null
        return fel === 'json' ? JSON.parse(scris) : scris
      },
      async put(cheie: string, valoare: string) {
        date.set(cheie, valoare)
      },
    } as unknown as KVNamespace,
    date,
  }
}

const UNELTELE_BULETINULUI: UnealtaDeBifat[] = [
  { nume: 'buletin.compune', aplicatie: 'buletin', efect: 'scrie', descriere: 'Compune foaia tipărită.' },
  { nume: 'buletin.socoteala', aplicatie: 'buletin', efect: 'citeste', descriere: 'Cât text încape.' },
]

/**
 * Mediul modulului: KV-ul comutatoarelor și un creier care răspunde la `/unelte`.
 * `creierMut` = chat-worker care nu răspunde (proba ștergerii în tăcere).
 */
function mediu(o: { chei?: Record<string, unknown>; creierMut?: boolean; faraChat?: boolean } = {}) {
  const { kv, date } = kvFals(o.chei ?? { 'modul:chat': GLOBAL })
  const cerute: string[] = []
  const env = {
    MEDIU: 'staging',
    SECRET_INTERN: 'secret',
    CONFIG: kv,
    ...(o.faraChat
      ? {}
      : {
          CHAT: {
            fetch: async (adresa: string) => {
              cerute.push(adresa)
              if (o.creierMut) return new Response('nu acum', { status: 503 })
              return new Response(JSON.stringify({ unelte: UNELTELE_BULETINULUI }), {
                headers: { 'content-type': 'application/json' },
              })
            },
          } as unknown as Fetcher,
        }),
  }
  return { env, date, cerute }
}

const OMUL = { userId: 'u1', email: 'parintele@example.com', roles: [] as unknown[] } as never

const ctx = (o: { eAdmin?: boolean; faraPrincipal?: boolean } = {}) => ({
  prefix: '',
  principal: o.faraPrincipal ? null : OMUL,
  numeleOmului: 'Părintele',
  eAdmin: o.eAdmin ?? true,
})

const CHAT_BULETIN = modulChat({ aplicatie: 'buletin', titlu: 'Scrie buletinul' })

/** POST-ul formularului din Setări, cu jetonul pereche cu cookie-ul. */
function salvarea(corp: Record<string, string | string[]>, o: { jeton?: string; cookie?: string } = {}) {
  const jeton = o.jeton ?? 'jeton-bun'
  const date = new URLSearchParams()
  date.set('csrf', jeton)
  for (const [k, v] of Object.entries(corp)) {
    for (const unul of Array.isArray(v) ? v : [v]) date.append(k, unul)
  }
  return new Request('https://buletin.test/chat/setari', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: `xc_csrf=${o.cookie ?? jeton}`,
    },
    body: date.toString(),
  })
}

// ⚠️ Comutatoarele se țin un minut în memoria modulului — fără uitarea asta o probă ar citi
// configurația probei dinainte.
beforeEach(() => uitaConfigChat())

// ---------------------------------------------------------------------------

describe('îndrumările și uneltele stau la aplicație', () => {
  it('rândul aplicației se citește din cheia ei, nu din cea comună', async () => {
    const { env } = mediu({
      chei: {
        'modul:chat': GLOBAL,
        [cheiaAplicatiei('buletin')]: { indrumari: 'Motto-ul se scrie fără ghilimele.', unelte: ['buletin.compune'] },
      },
    })
    const ale = await configAplicatie(env, 'buletin')
    expect(ale.indrumari).toBe('Motto-ul se scrie fără ghilimele.')
    expect(ale.unelte).toEqual(['buletin.compune'])
    // ⚠️ miezul: obiceiurile Programului NU ajung la Buletin
    expect(ale.indrumari).not.toContain('Liturghia')
  })

  it('aplicația fără rândul ei ia moștenirea, dar numai uneltele care sunt ALE EI', async () => {
    const { env } = mediu()
    const buletin = await configAplicatie(env, 'buletin')
    expect(buletin.indrumari).toBe(GLOBAL.indrumari)
    expect(buletin.unelte).toEqual(['buletin.compune'])
    uitaConfigChat()
    const program = await configAplicatie(env, 'program')
    expect(program.unelte).toEqual(['program.adauga_slujba', 'program.valideaza_saptamana'])
  })

  it('scrisul unei aplicații nu atinge cheia alteia, nici pe cea comună', async () => {
    const { env, date } = mediu()
    await scrieConfigAplicatie(env, 'buletin', { indrumari: 'Scurt.', unelte: ['buletin.socoteala'] })
    expect(JSON.parse(date.get(cheiaAplicatiei('buletin'))!)).toEqual({ indrumari: 'Scurt.', unelte: ['buletin.socoteala'] })
    expect(date.has(cheiaAplicatiei('program'))).toBe(false)
    expect(JSON.parse(date.get('modul:chat')!)).toEqual(GLOBAL)
  })

  it('un nume de unealtă strâmb nu intră în listă', () => {
    const c = normalizeazaAplicatie({ indrumari: '  două rânduri  ', unelte: ['buletin.compune', 'fără-punct', 'Buletin.Mare', ''] })
    expect(c.unelte).toEqual(['buletin.compune'])
    expect(c.indrumari).toBe('două rânduri')
  })
})

describe('salvarea din Setări → Chat AI', () => {
  it('adminul aplicației scrie îndrumările și bifele, și e trimis înapoi cu vestea', async () => {
    const { env, date } = mediu()
    const r = await CHAT_BULETIN.ruteaza(
      salvarea({ indrumari: 'Nu inventa autori.', u: ['buletin.compune', 'buletin.socoteala'] }),
      env,
      {} as ExecutionContext,
      '/chat/setari',
      ctx(),
    )
    expect(r!.status).toBe(303)
    expect(r!.headers.get('location')).toBe('/setari?f=chat-salvat')
    expect(JSON.parse(date.get(cheiaAplicatiei('buletin'))!)).toEqual({
      indrumari: 'Nu inventa autori.',
      unelte: ['buletin.compune', 'buletin.socoteala'],
    })
  })

  it('MERGE ȘI CU CHATUL STINS la aplicația asta — îndrumările se scriu înainte de aprindere', async () => {
    const { env, date } = mediu({ chei: { 'modul:chat': { ...GLOBAL, activ: false, aplicatii: {} } } })
    const r = await CHAT_BULETIN.ruteaza(
      salvarea({ indrumari: 'Gata dinainte.' }),
      env,
      {} as ExecutionContext,
      '/chat/setari',
      ctx(),
    )
    expect(r!.headers.get('location')).toBe('/setari?f=chat-salvat')
    expect(date.has(cheiaAplicatiei('buletin'))).toBe(true)
  })

  it('cine nu e adminul aplicației nu află nici măcar că adresa există', async () => {
    const { env, date } = mediu()
    const r = await CHAT_BULETIN.ruteaza(
      salvarea({ indrumari: 'Eu scriu aici.' }),
      env,
      {} as ExecutionContext,
      '/chat/setari',
      ctx({ eAdmin: false }),
    )
    expect(r!.status).toBe(404)
    expect(date.has(cheiaAplicatiei('buletin'))).toBe(false)
  })

  it('jetonul CSRF nepotrivit nu scrie nimic', async () => {
    const { env, date } = mediu()
    const r = await CHAT_BULETIN.ruteaza(
      salvarea({ indrumari: 'Furat.' }, { jeton: 'al-meu', cookie: 'al-tau' }),
      env,
      {} as ExecutionContext,
      '/chat/setari',
      ctx(),
    )
    expect(r!.headers.get('location')).toBe('/setari?f=chat-rau')
    expect(date.has(cheiaAplicatiei('buletin'))).toBe(false)
  })
})

describe('rubrica din Setări', () => {
  it('nu se arată cui nu e adminul aplicației', async () => {
    const { env } = mediu()
    expect(await CHAT_BULETIN.rubricaSetari(env, ctx({ eAdmin: false }), { csrf: 'j' })).toBe('')
  })

  it('arată uneltele cu bifă, cu numele lor canonice, și marchează ce schimbă date', async () => {
    const { env, cerute } = mediu({
      chei: {
        'modul:chat': GLOBAL,
        [cheiaAplicatiei('buletin')]: { indrumari: 'Scurt.', unelte: ['buletin.socoteala'] },
      },
    })
    const h = await CHAT_BULETIN.rubricaSetari(env, ctx(), { csrf: 'jetonul-paginii' })
    expect(cerute[0]).toContain('/unelte?aplicatie=buletin')
    expect(h).toContain('value="jetonul-paginii"')
    expect(h).toContain('action="/chat/setari"')
    expect(h).toContain('Scurt.')
    // bifată cea aleasă, nebifată cealaltă
    expect(h).toMatch(/value="buletin\.socoteala"\s+checked/)
    expect(h).toMatch(/value="buletin\.compune"\s*>/)
    // `buletin.compune` schimbă date: se spune pe față, lângă nume
    expect(h).toContain('schimbă date')
  })

  it('lista goală înseamnă „toate", și ecranul o arată așa — nu cu zero bife', async () => {
    const { env } = mediu({
      chei: { 'modul:chat': GLOBAL, [cheiaAplicatiei('buletin')]: { indrumari: '', unelte: [] } },
    })
    const h = await CHAT_BULETIN.rubricaSetari(env, ctx(), { csrf: 'j' })
    expect(h.match(/checked/g) ?? []).toHaveLength(UNELTELE_BULETINULUI.length)
  })

  it('CREIERUL MUT nu șterge alegerea: bifele lipsesc, dar ce era ales pleacă înapoi neatins', async () => {
    const { env } = mediu({
      creierMut: true,
      chei: { 'modul:chat': GLOBAL, [cheiaAplicatiei('buletin')]: { indrumari: 'x', unelte: ['buletin.compune'] } },
    })
    const h = await CHAT_BULETIN.rubricaSetari(env, ctx(), { csrf: 'j' })
    expect(h).toContain('<input type="hidden" name="u" value="buletin.compune">')
    expect(h).not.toContain('type="checkbox"')
  })

  it('spune limpede când chatul nu e aprins la aplicația asta', async () => {
    const { env } = mediu({ chei: { 'modul:chat': { ...GLOBAL, aplicatii: { program: true } } } })
    const h = await CHAT_BULETIN.rubricaSetari(env, ctx(), { csrf: 'j' })
    expect(h).toContain('Administrare → Module')
    expect(h).toContain('se păstrează')
  })

  it('aplicația fără unelte nu minte: spune că bula poate doar sta de vorbă', () => {
    const h = rubricaChat({
      prefix: '',
      csrf: 'j',
      aplicatie: 'home',
      cfg: { indrumari: '', unelte: [] },
      activ: true,
      pornit: true,
      unelte: [],
    })
    expect(h).toContain('nicio unealtă')
    expect(h).not.toContain('type="checkbox"')
  })
})

describe('instrucțiunile modelului', () => {
  const azi = { data: '18 septembrie 2026', zi: 'vineri' }

  it('spune ce POATE face și că pentru orice altceva răspunde că nu poate — aici', () => {
    const text = instructiuni('buletin', 'Părintele', azi, [], '', ['buletin.compune', 'buletin.socoteala'])
    expect(text).toContain('AICI POȚI FACE DOAR ATÂT: buletin.compune, buletin.socoteala')
    expect(text).toContain('asta nu pot face aici')
    expect(text).toContain('nu căuta ocoluri')
  })

  it('fără nicio unealtă spune tot că nu poate, nu tace', () => {
    const text = instructiuni('home', null, azi, [], '', [])
    expect(text).toContain('NU AI NICIO UNEALTĂ')
    expect(text).toContain('nu poți face aici')
  })

  it('NU mai poartă harta de unelte a Programului în mesajele altei aplicații', () => {
    const text = instructiuni('buletin', null, azi, [], '', ['buletin.compune'])
    for (const alAltuia of ['slujbele_zilei', 'slujba_urmatoare', 'calendar.ziua', 'tipic.sfintii_zilei']) {
      expect(text).not.toContain(alAltuia)
    }
  })

  it('îndrumările aplicației intră în instrucțiuni', () => {
    const text = instructiuni('buletin', null, azi, [], 'Motto-ul se scrie fără ghilimele.', ['buletin.compune'])
    expect(text).toContain('Motto-ul se scrie fără ghilimele.')
  })
})
