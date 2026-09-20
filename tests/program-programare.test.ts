/**
 * SĂPTĂMÂNA PROGRAMATĂ — „Validează și programează" / „Validează și publică" la programul liturgic.
 *
 * Cererea userului (20.09.2026, la o oră după ce mecanismul intrase la buletin): „La programul
 * liturgic aceeași poveste cu Validare și publicare / Validare și programare, la fel ca la Buletinul
 * bisericii."
 *
 * ⚠️ PRAGUL E ALTUL DECÂT PARE. Al buletinului e ziua numărului (o duminică); al săptămânii e
 * DUMINICA DINAINTEA EI — fiindcă buletinul de duminica D tipărește pe pagina a patra programul
 * săptămânii care începe luni D+1. Cele două hârtii se dau enoriașilor în aceeași clipă, la ieșirea
 * de la Liturghie, deci pragurile lor trebuie să fie ACEEAȘI CLIPĂ. Prima probă de mai jos ține
 * legătura asta, nu formula fiecăruia.
 *
 * ⚠️ REPREZENTAREA. Nu s-a adăugat nicio stare nouă (CHECK-ul de pe `saptamani.stare` ar fi cerut
 * refacerea tabelului peste datele parohiei). O săptămână e PROGRAMATĂ când `stare = 'propus'` ȘI
 * `programat_la IS NOT NULL`. De aici, lucrurile care se pot strica tăcut, fiecare cu proba lui:
 *
 *   1. **pragul**, vara și iarna — el hotărăște ce se scrie în `programat_la`;
 *   2. **marginea**: fix la 12:00:00 se PUBLICĂ, nu se programează;
 *   3. **„e deja propus"**: refuzul vechi al retragerii, care pe o săptămână programată ar fi lăsat-o
 *      să apară singură duminică, după ce omul tocmai ceruse să n-o facă;
 *   4. **ceasul**: să treacă ce trebuie, când trebuie, și să fie IDEMPOTENT — bate de 288 de ori pe zi;
 *   5. **`validat_la`**: clipa ANUNȚATĂ, nu clipa la care s-a nimerit să bată cronul;
 *   6. **anunțul**: `validated` pleacă de la ceas, nu de la programare — altfel enoriașii ar primi
 *      programul săptămânii viitoare miercuri;
 *   7. **vizibilitatea**: `programat_la` și `programat_de` n-au voie să iasă pe ușa mașinilor.
 */
import { describe, expect, it, vi } from 'vitest'
import { pragPublicarii as pragBuletin } from '../apps/buletin/src/ceas.js'
import program from '../apps/program/src/index.js'
import { ACTIUNI } from '../apps/program/src/actiuni.js'
import { candApareSaptamana, duminicaDinainte, pragSaptamanii, seProgrameaza } from '../apps/program/src/ceas.js'
import { arhivaIntreaga, eProgramata, programateleScadente, saptamanaDin, treciLaValidat, valideazaSaptamana, VEDE_TOT } from '../apps/program/src/depozit.js'
import { paginaSaptamana, type Ctx, type Meniu } from '../apps/program/src/pagini.js'
import { STARI_SAPTAMANA } from '../packages/contracts/src/index.js'
import {
  dbFals,
  evenimentele,
  saptamanaDeProba,
  SLUJBE,
  type Orice,
  type Rand,
  type RandSlujbaProba as RandSlujba,
} from './program-fals.js'

// ---------------------------------------------------------------------------
// 1. PRAGUL — duminica DINAINTEA săptămânii, ora 12:00 a Bucureștiului
// ---------------------------------------------------------------------------

describe('pragul săptămânii: duminica dinaintea ei, la 12:00', () => {
  it('ziua pragului e `luni − 1`, nu lunea și nici duminica săptămânii', () => {
    expect(duminicaDinainte('2026-09-28')).toBe('2026-09-27')
    expect(duminicaDinainte('2026-01-01')).toBe('2025-12-31')
  })

  /**
   * ⚠️ INIMA LUCRĂRII. Săptămâna 28.09–04.10 se tipărește în buletinul de duminică, 27.09, iar cele
   * două se dau odată. Dacă cineva mută pragul săptămânii pe lunea ei (ori pe duminica ei de la
   * capăt), programul ar apărea pe site cu o zi — sau cu șase — după foaia pe care o ține omul în
   * mână, fără nicio eroare nicăieri. Proba leagă cele două socoteli, nu le repetă.
   */
  it('e ACEEAȘI CLIPĂ cu pragul buletinului care o tipărește', () => {
    for (const luni of ['2026-09-28', '2026-06-08', '2026-12-07', '2027-01-04']) {
      expect(pragSaptamanii(luni).getTime(), luni).toBe(pragBuletin(duminicaDinainte(luni)).getTime())
    }
  })

  /** ⚠️ CIFRELE ÎN UTC DINADINS: un decalaj scris fix ar cădea la una dintre jumătățile anului. */
  it('ora de vară (EEST, +3): 09:00Z · ora de iarnă (EET, +2): 10:00Z', () => {
    expect(pragSaptamanii('2026-09-28').toISOString()).toBe('2026-09-27T09:00:00.000Z')
    expect(pragSaptamanii('2026-06-08').toISOString()).toBe('2026-06-07T09:00:00.000Z')
    expect(pragSaptamanii('2026-12-07').toISOString()).toBe('2026-12-06T10:00:00.000Z')
    expect(pragSaptamanii('2026-01-05').toISOString()).toBe('2026-01-04T10:00:00.000Z')
  })

  /** Duminicile în care se mută ceasul: la prânz fusul e deja cel nou (mutarea e la 03:00/04:00). */
  it('săptămânile de după schimbarea fusului cad unde trebuie', () => {
    expect(pragSaptamanii('2026-03-30').toISOString()).toBe('2026-03-29T09:00:00.000Z')
    expect(pragSaptamanii('2026-10-26').toISOString()).toBe('2026-10-25T10:00:00.000Z')
    expect(pragSaptamanii('2026-10-19').toISOString()).toBe('2026-10-18T09:00:00.000Z')
  })

  it('„apare duminică, …, la ora 12:00" se scrie dintr-un singur loc', () => {
    expect(candApareSaptamana('2026-09-28')).toBe('duminică, 27 septembrie 2026, la ora 12:00')
  })
})

const LUNI = '2026-09-28'
const PRAGUL = '2026-09-27T09:00:00.000Z'
/** Marți, 22 septembrie: se programează. */
const MARTI = '2026-09-22T10:00:00.000Z'

describe('marginea: înainte se programează, de la 12:00:00 se publică', () => {
  it('cu o săptămână înainte — se programează', () => {
    expect(seProgrameaza(LUNI, new Date(MARTI))).toBe(true)
  })

  it('cu o milisecundă înainte de 12:00 — încă se programează', () => {
    expect(seProgrameaza(LUNI, new Date(Date.parse(PRAGUL) - 1))).toBe(true)
  })

  /** ⚠️ FIX LA 12:00:00 SE PUBLICĂ: pragul e clipa apariției, nu cea de dinaintea ei. */
  it('fix la 12:00:00 — se publică', () => {
    expect(seProgrameaza(LUNI, new Date(PRAGUL))).toBe(false)
  })

  it('duminică după-amiază — se publică', () => {
    expect(seProgrameaza(LUNI, new Date('2026-09-27T15:00:00.000Z'))).toBe(false)
  })

  it('lunea săptămânii, deci după ce a început — tot se publică', () => {
    expect(seProgrameaza(LUNI, new Date('2026-09-28T06:00:00.000Z'))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Săptămânile de probă (ele și D1-ul fals stau în `tests/program-fals.ts`, ca să le folosească și
// proba vizibilității — un singur fals care citește SQL-ul, nu două care se despart în tăcere)
// ---------------------------------------------------------------------------

/** Scrisă, nevalidată, fără ceas — starea de pornire a oricărei săptămâni. */
const PROPUSA = saptamanaDeProba(LUNI)
/** PROGRAMATĂ marți: `stare` tot „propus", dar cu clipa apariției pe ea. */
const PROGRAMATA = saptamanaDeProba(LUNI, { programat_la: PRAGUL, programat_de: 'u1' })
/** Validată de mână, săptămâna trecută. */
const VALIDATA = saptamanaDeProba('2026-09-21', { stare: 'validat', validat_de: 'u1', validat_la: '2026-09-20T09:02:00.000Z' })

// ---------------------------------------------------------------------------
// Mediul: cât atinge programarea
// ---------------------------------------------------------------------------

const OMUL = {
  authenticated: true,
  user: { id: 'u1', email: 'parintele@example.com', displayName: 'Părintele', firstName: null, lastName: null, phone: null, shortName: null, emailVerifiedAt: null, disabledAt: null, createdAt: '2026-01-01T00:00:00.000Z' },
  roles: [{ role: 'user', scope: 'global' }],
  sessionId: 's1', expiresAt: null, veziCa: null, poateVedeaCa: false,
}
const NIMENI = { authenticated: false, user: null, roles: [], sessionId: null, expiresAt: null, veziCa: null, poateVedeaCa: false }

const trimise: unknown[] = []

function mediu(o: { saptamani?: Rand[]; slujbe?: RandSlujba[]; admin?: boolean } = {}) {
  const admin = o.admin !== false
  const { stare, db } = dbFals({ saptamani: o.saptamani ?? [PROPUSA], slujbe: o.slujbe ?? SLUJBE(LUNI) })
  const env = {
    MEDIU: 'staging',
    ORIGINE_PUBLICA: 'https://program.staging.sfantul-ilie.ro',
    DOMENIU_COOKIE: '.staging.sfantul-ilie.ro',
    EMAIL_SUPERADMIN: 'rubikmm@gmail.com',
    SECRET_INTERN: 'secret',
    DB: db,
    EVENIMENTE: { send: async (m: unknown) => { trimise.push(m) } },
    // calendarul răspunde cu o versiune, dar fără zile: programarea trebuie s-o scrie în
    // `versiune_calendar`, la fel ca validarea
    CALENDAR: { fetch: async () => new Response(JSON.stringify({ versiune_calendar: '2026.9', zile: [] }), { headers: { 'content-type': 'application/json' } }) },
    TIPIC: { fetch: async () => new Response('{}') },
    BROWSER: { fetch: async () => new Response('{}') },
    MEDIA: { fetch: async () => new Response('{}') },
    AUDIT: { fetch: async () => new Response('{}') },
    COMUNICARE: { fetch: async () => new Response(JSON.stringify({ membri: [] }), { headers: { 'content-type': 'application/json' } }) },
    IDENTITATE: { fetch: async () => new Response(JSON.stringify(admin ? OMUL : NIMENI), { headers: { 'content-type': 'application/json' } }) },
    AUTORIZARE: { fetch: async () => new Response(JSON.stringify({ allowed: admin, reason: 'probă', matchedScopes: [] }), { headers: { 'content-type': 'application/json' } }) },
    CONFIG: { get: async () => null },
  }
  return { env, stare }
}

const amanate: Array<Promise<unknown>> = []
const ctxExec = {
  waitUntil: (p: Promise<unknown>) => { amanate.push(p) },
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext
const amanatele = async (): Promise<void> => { await Promise.all(amanate.splice(0)) }

/** Ceasul serverului, fixat. ⚠️ Numai `Date`: promisiunile trebuie să curgă mai departe. */
async function laCeasul<T>(cand: string, ce: () => Promise<T> | T): Promise<T> {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(cand))
  try {
    return await ce()
  } finally {
    vi.useRealTimers()
  }
}

const actiunea = (nume: string) => {
  const a = ACTIUNI.find((x) => x.nume === nume)
  if (!a) throw new Error(`nu există acțiunea ${nume}`)
  return a
}
const ctxActiune = (env: unknown) => ({
  env,
  actor: { fel: 'utilizator' as const, principal: { userId: 'u1', email: 'parintele@example.com' } },
  correlationId: 'probă',
  ctxExec,
  prin: 'chat',
})

const valideaza = (env: unknown, saptamana = LUNI) =>
  actiunea('program.valideaza_saptamana').executa({ saptamana } as never, ctxActiune(env) as never)
const rezumaValidarea = (env: unknown, saptamana = LUNI) =>
  actiunea('program.valideaza_saptamana').rezuma!({ saptamana } as never, ctxActiune(env) as never)
const retrage = (env: unknown, saptamana = LUNI) =>
  actiunea('program.retrage_validarea').executa({ saptamana } as never, ctxActiune(env) as never)
const rezumaRetragerea = (env: unknown, saptamana = LUNI) =>
  actiunea('program.retrage_validarea').rezuma!({ saptamana } as never, ctxActiune(env) as never)

/** Ceasul WORKERULUI, bătut o dată — chiar handlerul pe care-l cheamă Cron Triggers. */
const bateCeasul = (env: unknown) =>
  program.scheduled!({ cron: '*/5 * * * *', scheduledTime: Date.now(), noRetry: () => undefined } as never, env as never, ctxExec)

// ---------------------------------------------------------------------------
// 2. VALIDAREA — aceeași apăsare, două urmări
// ---------------------------------------------------------------------------

describe('„validează săptămâna": ce se întâmplă hotărăște CEASUL, nu omul', () => {
  it('marți — se PROGRAMEAZĂ: rândul rămâne „propus", cu clipa apariției pe el', async () => {
    const { env, stare } = mediu()
    await laCeasul(MARTI, async () => { await valideaza(env); await amanatele() })
    expect(stare.saptamani[0]).toMatchObject({
      stare: 'propus',
      programat_la: PRAGUL,
      programat_de: 'u1',
      validat_de: null,
      validat_la: null,
      versiune_calendar: '2026.9',
    })
    expect(eProgramata(stare.saptamani[0] as never)).toBe(true)
  })

  it('marți — în istoric se scrie „programat", nu „validat"', async () => {
    const { env, stare } = mediu()
    await laCeasul(MARTI, async () => { await valideaza(env); await amanatele() })
    expect(stare.istoric.map((r) => r.ce)).toEqual(['programat'])
    expect(JSON.parse(String(stare.istoric[0]!.detalii))).toMatchObject({ programat_la: PRAGUL })
  })

  /**
   * ⚠️ ANUNȚUL NU PLEACĂ ACUM. Programarea scrie `changed`; `validated` — cel la care ascultă
   * automatizările care duc programul mai departe — pleacă abia de la ceas, duminică. Altfel
   * enoriașii ar fi primit programul săptămânii viitoare marți, adică exact ce înlătură programarea.
   */
  it('marți — în outbox intră `changed`, NU `validated`', async () => {
    const { env, stare } = mediu()
    await laCeasul(MARTI, async () => { await valideaza(env); await amanatele() })
    expect(evenimentele(stare).map((e) => e.type)).toEqual(['program.week.changed.v1'])
  })

  it('fix duminică la 12:00 — se VALIDEAZĂ pe loc, cu anunț cu tot', async () => {
    const { env, stare } = mediu()
    await laCeasul(PRAGUL, async () => { await valideaza(env); await amanatele() })
    expect(stare.saptamani[0]).toMatchObject({ stare: 'validat', validat_de: 'u1', validat_la: PRAGUL, programat_la: null, programat_de: null })
    expect(evenimentele(stare).map((e) => e.type)).toEqual(['program.week.validated.v1'])
    expect(stare.istoric.map((r) => r.ce)).toEqual(['validat'])
  })

  it('duminică după-amiază — validat, cu clipa apăsării', async () => {
    const { env, stare } = mediu()
    await laCeasul('2026-09-27T15:30:00.000Z', async () => { await valideaza(env); await amanatele() })
    expect(stare.saptamani[0]).toMatchObject({ stare: 'validat', validat_la: '2026-09-27T15:30:00.000Z' })
  })

  it('cu o milisecundă înainte de 12:00 tot programează', async () => {
    const { env, stare } = mediu()
    await laCeasul('2026-09-27T08:59:59.999Z', async () => { await valideaza(env); await amanatele() })
    expect(stare.saptamani[0]).toMatchObject({ stare: 'propus', programat_la: PRAGUL })
  })

  /** Iarna pragul e cu o oră mai târziu în UTC: la 09:30Z încă se programează. */
  it('iarna pragul e la 10:00Z, nu la 09:00Z', async () => {
    const iarna = saptamanaDeProba('2026-12-07')
    const a = mediu({ saptamani: [iarna], slujbe: SLUJBE('2026-12-07') })
    await laCeasul('2026-12-06T09:30:00.000Z', async () => { await valideaza(a.env, '2026-12-07'); await amanatele() })
    expect(a.stare.saptamani[0]).toMatchObject({ stare: 'propus', programat_la: '2026-12-06T10:00:00.000Z' })

    const b = mediu({ saptamani: [saptamanaDeProba('2026-12-07')], slujbe: SLUJBE('2026-12-07') })
    await laCeasul('2026-12-06T10:00:00.000Z', async () => { await valideaza(b.env, '2026-12-07'); await amanatele() })
    expect(b.stare.saptamani[0]).toMatchObject({ stare: 'validat' })
  })
})

describe('ce spune acțiunea înainte de a face (`rezuma`) — omul confirmă din vorbele ei', () => {
  it('înainte de duminică: „Validez și programez… — apare duminică, …, odată cu buletinul"', async () => {
    const { env } = mediu()
    const text = await laCeasul(MARTI, () => rezumaValidarea(env))
    expect(text).toContain('Validez și programez săptămâna')
    expect(text).toContain('apare duminică, 27 septembrie 2026, la ora 12:00, odată cu buletinul')
    expect(text).not.toContain('Validez și public')
  })

  it('de la 12:00: „Validez și public săptămâna … (N slujbe)"', async () => {
    const { env } = mediu()
    const text = await laCeasul(PRAGUL, () => rezumaValidarea(env))
    expect(text).toContain('Validez și public săptămâna')
    expect(text).toContain('(2 slujbe)')
    expect(text).not.toContain('programez')
  })

  it('pe una deja programată: refuz, cu ziua în care apare', async () => {
    const { env } = mediu({ saptamani: [PROGRAMATA] })
    await expect(laCeasul(MARTI, () => rezumaValidarea(env))).rejects.toThrow('e deja programată pentru duminică, 27 septembrie 2026, la ora 12:00')
  })

  it('pe una deja validată: refuzul de până acum', async () => {
    const { env } = mediu({ saptamani: [VALIDATA], slujbe: SLUJBE('2026-09-21') })
    await expect(laCeasul(MARTI, () => rezumaValidarea(env, '2026-09-21'))).rejects.toThrow('e deja validată')
  })

  /** ⚠️ Refuzul trebuie să fie și în `executa`, nu doar în `rezuma`: o acțiune poate fi chemată direct. */
  it('refuzurile stau și în `executa`, nu doar în vorbe', async () => {
    const { env, stare } = mediu({ saptamani: [PROGRAMATA] })
    await expect(laCeasul(MARTI, () => valideaza(env))).rejects.toThrow('e deja programată')
    expect(stare.istoric).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 3. CEASUL WORKERULUI — cine validează săptămâna programată
// ---------------------------------------------------------------------------

describe('ceasul workerului (`scheduled`) — programarea adevărată', () => {
  const cuProgramata = () => mediu({ saptamani: [PROGRAMATA, VALIDATA] })

  it('ÎNAINTE de prag nu trece nimic', async () => {
    const { env, stare } = cuProgramata()
    await laCeasul(MARTI, async () => { await bateCeasul(env); await amanatele() })
    expect(stare.saptamani[0]).toMatchObject({ stare: 'propus', programat_la: PRAGUL })
    expect(stare.istoric).toHaveLength(0)
  })

  it('cu o milisecundă înainte de 12:00 tot nu trece', async () => {
    const { env, stare } = cuProgramata()
    await laCeasul('2026-09-27T08:59:59.999Z', async () => { await bateCeasul(env); await amanatele() })
    expect(stare.saptamani[0]!.stare).toBe('propus')
  })

  it('FIX la 12:00 trece — și validarea rămâne a omului care a apăsat', async () => {
    const { env, stare } = cuProgramata()
    await laCeasul(PRAGUL, async () => { await bateCeasul(env); await amanatele() })
    expect(stare.saptamani[0]).toMatchObject({
      stare: 'validat',
      validat_de: 'u1',
      validat_la: PRAGUL,
      programat_la: null,
      programat_de: null,
    })
  })

  /**
   * ⚠️ `validat_la` E CLIPA ANUNȚATĂ, nu clipa trecerii. Cronul bate din cinci în cinci minute, deci
   * de obicei ajunge mai târziu de 12:00 — dar în bază trebuie să rămână ora pe care ecranul a
   * scris-o pe buton. Altfel „apare la 12:00" ar fi devenit, tăcut, „a apărut la 12:03".
   */
  it('trecută mai târziu, păstrează clipa anunțată în `validat_la`', async () => {
    const { env, stare } = cuProgramata()
    await laCeasul('2026-09-27T09:04:37.000Z', async () => { await bateCeasul(env); await amanatele() })
    expect(stare.saptamani[0]).toMatchObject({ stare: 'validat', validat_la: PRAGUL })
  })

  it('DE AICI pleacă anunțul: `program.week.validated.v1`, în numele celui care a programat', async () => {
    const { env, stare } = cuProgramata()
    await laCeasul(PRAGUL, async () => { await bateCeasul(env); await amanatele() })
    const ev = evenimentele(stare)
    expect(ev.map((e) => e.type)).toEqual(['program.week.validated.v1'])
    expect(ev[0]!.actor).toMatchObject({ type: 'user', id: 'u1' })
    expect(ev[0]!.payload).toMatchObject({ luni: LUNI, stare: 'validat', slujbe: 2 })
  })

  it('golește și outbox-ul în aceeași bătaie — altfel anunțul ar mai aștepta cinci minute', async () => {
    const { env, stare } = cuProgramata()
    await laCeasul(PRAGUL, async () => { await bateCeasul(env); await amanatele() })
    expect(stare.outbox.every((r) => r.published_at !== null)).toBe(true)
    expect(trimise.length).toBeGreaterThan(0)
  })

  /**
   * ⚠️ IDEMPOTENT. Cronul bate de 288 de ori pe zi: a doua bătaie nu mai are ce găsi, nu scrie nimic
   * în D1 și nu mai pune niciun rând în istoric. Fără asta, registrul ar fi primit sute de intrări
   * „săptămâna a fost validată" pentru aceeași săptămână, și tot atâtea anunțuri.
   */
  it('bătut de trei ori, face treaba o singură dată', async () => {
    const { env, stare } = cuProgramata()
    await laCeasul(PRAGUL, async () => {
      await bateCeasul(env); await amanatele()
      await bateCeasul(env); await bateCeasul(env); await amanatele()
    })
    expect(stare.istoric.filter((r) => r.ce === 'validat')).toHaveLength(1)
    expect(evenimentele(stare)).toHaveLength(1)
  })

  it('nu atinge săptămânile deja validate și nici pe cele propuse fără ceas', async () => {
    const { env, stare } = mediu({ saptamani: [PROGRAMATA, VALIDATA, saptamanaDeProba('2026-10-05')] })
    await laCeasul(PRAGUL, async () => { await bateCeasul(env); await amanatele() })
    expect(stare.saptamani.find((r) => r.luni === '2026-09-21')).toMatchObject({ stare: 'validat', validat_la: '2026-09-20T09:02:00.000Z' })
    expect(stare.saptamani.find((r) => r.luni === '2026-10-05')).toMatchObject({ stare: 'propus', validat_la: null })
    expect(stare.istoric).toHaveLength(1)
  })

  it('trece fiecare săptămână la clipa EI, nu pe toate odată', async () => {
    const urmatoarea = saptamanaDeProba('2026-10-05', { programat_la: '2026-10-04T09:00:00.000Z', programat_de: 'u1' })
    const { env, stare } = mediu({ saptamani: [PROGRAMATA, urmatoarea] })
    await laCeasul(PRAGUL, async () => { await bateCeasul(env); await amanatele() })
    expect(stare.saptamani.find((r) => r.luni === LUNI)!.stare).toBe('validat')
    expect(stare.saptamani.find((r) => r.luni === '2026-10-05')!.stare).toBe('propus')
  })

  it('două scadente deodată: fiecare cu rândul ei de istoric și cu anunțul ei', async () => {
    const veche = saptamanaDeProba('2026-09-21', { programat_la: '2026-09-20T09:00:00.000Z', programat_de: 'u2' })
    const { env, stare } = mediu({ saptamani: [veche, PROGRAMATA] })
    await laCeasul(PRAGUL, async () => { await bateCeasul(env); await amanatele() })
    expect(stare.saptamani.every((r) => r.stare === 'validat')).toBe(true)
    expect(stare.saptamani.find((r) => r.luni === '2026-09-21')).toMatchObject({ validat_de: 'u2', validat_la: '2026-09-20T09:00:00.000Z' })
    expect(stare.istoric.filter((r) => r.ce === 'validat')).toHaveLength(2)
    expect(evenimentele(stare)).toHaveLength(2)
  })

  /**
   * ⚠️ RĂSPUNSUL trecerii poartă clipa ANUNȚATĂ, nu pe a cronului: din el se scrie rândul de jurnal
   * „săptămâni programate, trecute la validat", singurul loc în care omul poate vedea pe urmă CE a
   * apărut și CÂND trebuia să apară.
   */
  it('trecerea întoarce săptămânile cu clipa anunțată pe ele, pentru jurnal', async () => {
    const { env } = cuProgramata()
    const db = (env as { DB: D1Database }).DB
    const acum = new Date('2026-09-27T09:04:37.000Z')
    expect((await programateleScadente(db, new Date(MARTI))).map((s) => s.luni)).toEqual([])
    const trecute = await treciLaValidat(db, acum, 'ceas')
    expect(trecute).toHaveLength(1)
    expect(trecute[0]).toMatchObject({ luni: LUNI, stare: 'validat', validat_de: 'u1', validat_la: PRAGUL, programat_la: null })
    expect(await treciLaValidat(db, acum, 'ceas')).toEqual([])
  })

  /**
   * ⚠️ VALIDAREA DE MÂNĂ STINGE CEASUL. Azi drumul e închis mai sus (acțiunea refuză o săptămână
   * deja programată), dar `valideazaSaptamana` e funcția de domeniu, chemabilă și de mâine, din alt
   * loc. Dacă ea ar lăsa `programat_la` scris pe un rând deja validat, ar rămâne pe el două povești
   * despre aceeași săptămână — iar cine ar slăbi vreodată condiția `stare = 'propus'` din cron ar
   * primi un al doilea anunț, la enoriași, pentru un program deja trimis.
   */
  it('validată de mână, săptămâna programată își pierde ceasul', async () => {
    const { env, stare } = mediu({ saptamani: [PROGRAMATA] })
    const db = (env as { DB: D1Database }).DB
    await laCeasul(MARTI, () => valideazaSaptamana(db, LUNI, { userId: 'u2', correlationId: 'probă' }))
    expect(stare.saptamani[0]).toMatchObject({ stare: 'validat', validat_de: 'u2', programat_la: null, programat_de: null })
    expect(await programateleScadente(db, new Date(PRAGUL))).toEqual([])
  })

  it('o zi obișnuită, fără nimic programat: ceasul nu scrie nimic', async () => {
    const { env, stare } = mediu({ saptamani: [PROPUSA, VALIDATA] })
    await laCeasul(MARTI, async () => { await bateCeasul(env); await amanatele() })
    expect(stare.istoric).toHaveLength(0)
    expect(stare.outbox).toHaveLength(0)
  })

  /**
   * ⚠️ DACĂ TRECEREA CADE, OUTBOX-UL TOT SE GOLEȘTE. Golirea e nervul aplicației și era în `scheduled`
   * de la început; trecerea s-a așezat înaintea ei. Cazul care se întâmplă cu adevărat: workerul urcat
   * ÎNAINTEA migrației `0003` — interogarea cade cu „no such column", iar fără plasa asta ar fi oprit
   * toate evenimentele programului, nu doar programarea.
   */
  it('trecerea căzută (migrația nerulată) nu oprește golirea outbox-ului', async () => {
    const { env, stare } = mediu({ saptamani: [PROPUSA] })
    stare.outbox.push({ id: 'e1', type: 'program.week.changed.v1', envelope_json: '{"type":"program.week.changed.v1"}', created_at: MARTI, published_at: null, attempts: 0 })
    const db = (env as { DB: D1Database }).DB
    const adevarat = db.prepare.bind(db)
    ;(env as { DB: D1Database }).DB = {
      ...db,
      prepare: (sql: string) =>
        sql.includes('programat_la') ? { bind: () => ({ all: async () => { throw new Error('no such column: programat_la') } }) } : adevarat(sql),
    } as unknown as D1Database
    await laCeasul(MARTI, async () => { await bateCeasul(env); await amanatele() })
    expect(stare.outbox[0]!.published_at).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 4. RETRAGEREA — pe o săptămână programată înseamnă „anulează programarea"
// ---------------------------------------------------------------------------

describe('„retrage validarea" pe o săptămână PROGRAMATĂ anulează programarea', () => {
  it('spune limpede ce face, înainte s-o facă', async () => {
    const { env } = mediu({ saptamani: [PROGRAMATA] })
    const text = await laCeasul(MARTI, () => rezumaRetragerea(env))
    expect(text).toContain('Anulez programarea săptămânii')
    expect(text).toContain('rămâne „propus", nu mai apare singură duminică')
  })

  it('șterge ceasul, lasă starea „propus" și scrie în istoric de unde a venit', async () => {
    const { env, stare } = mediu({ saptamani: [PROGRAMATA] })
    await laCeasul(MARTI, async () => { await retrage(env); await amanatele() })
    expect(stare.saptamani[0]).toMatchObject({ stare: 'propus', programat_la: null, programat_de: null })
    expect(stare.istoric.map((r) => r.ce)).toEqual(['retras'])
    expect(JSON.parse(String(stare.istoric[0]!.detalii))).toMatchObject({ din: 'programat', programat_la: PRAGUL })
    expect(evenimentele(stare).map((e) => e.type)).toEqual(['program.week.changed.v1'])
  })

  /** ⚠️ ȘI, MAI ALES: după anulare ceasul nu mai are ce trece duminică. */
  it('după anulare, duminică la 12:00 nu se mai întâmplă nimic', async () => {
    const { env, stare } = mediu({ saptamani: [PROGRAMATA] })
    await laCeasul(MARTI, async () => { await retrage(env); await amanatele() })
    await laCeasul(PRAGUL, async () => { await bateCeasul(env); await amanatele() })
    expect(stare.saptamani[0]!.stare).toBe('propus')
    expect(stare.istoric.filter((r) => r.ce === 'validat')).toHaveLength(0)
  })

  /**
   * ⚠️ AICI ERA CAPCANA. O săptămână programată are `stare = 'propus'` scris pe ea, deci vechiul
   * „e deja «propus» — se poate modifica așa cum e" ar fi refuzat-o — iar duminică s-ar fi validat
   * singură, după ce omul tocmai ceruse să n-o facă. Refuzul rămâne, dar numai unde e adevărat.
   */
  it('pe una „propus" FĂRĂ ceas, refuzul de până acum e neschimbat', async () => {
    const { env } = mediu({ saptamani: [PROPUSA] })
    await expect(laCeasul(MARTI, () => rezumaRetragerea(env))).rejects.toThrow('e deja „propus"')
  })

  it('pe una validată, retragerea merge ca până acum', async () => {
    const { env, stare } = mediu({ saptamani: [VALIDATA], slujbe: SLUJBE('2026-09-21') })
    await laCeasul(MARTI, async () => { await retrage(env, '2026-09-21'); await amanatele() })
    expect(stare.saptamani[0]).toMatchObject({ stare: 'propus', validat_de: null, validat_la: null, programat_la: null })
  })
})

// ---------------------------------------------------------------------------
// 5. MODIFICĂRILE pe o săptămână programată — permise, și NU strică programarea
// ---------------------------------------------------------------------------

/**
 * Hotărârea de pe 20.09.2026: cronul validează CE E ÎN BAZĂ la prag, nu ce era când s-a apăsat.
 * Deci o slujbă adăugată joi intră firesc în programul care apare duminică — nu se blochează nimic
 * și nu se cere o nouă apăsare. O programare care ar cădea la prima îndreptare ar fi fost mai rea
 * decât niciuna: omul n-ar fi aflat, și programul n-ar fi apărut.
 */
describe('o săptămână programată rămâne de lucru până duminică', () => {
  const adauga = (env: unknown) =>
    actiunea('program.adauga_slujba').executa(
      { zi: '2026-09-30', ora: '18:00', slujba: 'vecernia' } as never,
      ctxActiune(env) as never,
    )

  it('o slujbă adăugată nu șterge ceasul săptămânii', async () => {
    const { env, stare } = mediu({ saptamani: [PROGRAMATA] })
    await laCeasul(MARTI, async () => { await adauga(env); await amanatele() })
    expect(stare.saptamani[0]).toMatchObject({ stare: 'propus', programat_la: PRAGUL, programat_de: 'u1' })
    expect(stare.slujbe).toHaveLength(3)
  })

  it('iar duminică apare programul ÎNDREPTAT, cu slujba cea nouă cu tot', async () => {
    const { env, stare } = mediu({ saptamani: [PROGRAMATA] })
    await laCeasul(MARTI, async () => { await adauga(env); await amanatele() })
    await laCeasul(PRAGUL, async () => { await bateCeasul(env); await amanatele() })
    expect(stare.saptamani[0]!.stare).toBe('validat')
    expect(evenimentele(stare).find((e) => e.type === 'program.week.validated.v1')!.payload).toMatchObject({ slujbe: 3 })
  })
})

// ---------------------------------------------------------------------------
// 6. VIZIBILITATEA — ceasul launtric nu iese din casă
// ---------------------------------------------------------------------------

describe('pentru lume, o săptămână programată e „propus" — și atât', () => {
  it('contractul n-a căpătat nicio stare nouă', () => {
    expect([...STARI_SAPTAMANA]).toEqual(['propus', 'validat', 'modificat_dupa_validare'])
  })

  it('forma din contract (`saptamanaDin`) nu poartă `programat_la`', () => {
    const s = saptamanaDin(PROGRAMATA, [])
    expect(s.stare).toBe('propus')
    expect(Object.keys(s)).not.toContain('programat_la')
    expect(Object.keys(s)).not.toContain('programat_de')
    expect(JSON.stringify(s)).not.toContain('programat')
  })

  /**
   * ⚠️ `/v1/arhiva.json` e ușă deschisă de mașini, și dă rândurile brute. Cu `SELECT *`, cele două
   * coloane noi ar fi plecat în lume de la sine — ceasul unei săptămâni încă nevalidate și user-id-ul
   * celui care a apăsat. De aceea interogarea scrie coloanele pe nume, iar proba asta o ține așa.
   */
  it('arhiva publică nu scoate nici ceasul, nici pe cine a apăsat', async () => {
    const { env } = mediu({ saptamani: [PROGRAMATA, VALIDATA] })
    const a = await arhivaIntreaga((env as { DB: D1Database }).DB, VEDE_TOT)
    expect(a.saptamani).toHaveLength(2)
    for (const s of a.saptamani) {
      expect(Object.keys(s)).not.toContain('programat_la')
      expect(Object.keys(s)).not.toContain('programat_de')
    }
    expect(JSON.stringify(a.saptamani)).not.toContain('programat')
  })

  it('`eProgramata` citește COLOANA, nu ceasul: fără `programat_la` răspunde „nu"', () => {
    expect(eProgramata(PROPUSA)).toBe(false)
    expect(eProgramata(PROGRAMATA)).toBe(true)
    // o săptămână validată nu mai e programată, oricât ar scrie pe ea
    expect(eProgramata({ ...PROGRAMATA, stare: 'validat' })).toBe(false)
    expect(eProgramata(null)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 7. ETICHETA VERDE — scrisă numai pentru adminul programului
// ---------------------------------------------------------------------------

const CTX: Ctx = {
  prefix: '/program',
  nav: { home: '/', cont: '/cont', admin: '/admin' } as Ctx['nav'],
  utilizator: 'Părintele',
  eAdmin: true,
  versiune: '0.10.0',
  modificata: '20.09.2026',
}

const paginaCu = (programata: boolean) =>
  paginaSaptamana({
    ctx: CTX,
    luni: LUNI,
    titlu: '28 septembrie – 4 octombrie 2026',
    stare: 'propus',
    slujbe: [],
    vocabular: new Map(),
    cal: null,
    dinCalendar: false,
    azi: '2026-09-22',
    meniu: { luni: LUNI, foaie: null, azi: '2026-09-22' } as Meniu,
    programata,
  })

describe('eticheta de stare, pe pagina săptămânii', () => {
  it('programată: verde, cu ziua în care apare — în LOCUL lui „propus", nu lângă el', () => {
    const h = paginaCu(true)
    expect(h).toContain('<span class="stare programat">Programată — apare duminică, 27 septembrie 2026, la ora 12:00</span>')
    expect(h).not.toContain('<span class="stare propus">')
  })

  it('neprogramată (ori privitorul nu e admin): scrie „propus", ca până acum', () => {
    const h = paginaCu(false)
    expect(h).toContain('<span class="stare propus">propus</span>')
    expect(h).not.toContain('Programată — apare')
  })

  it('verdele e cel sobru al platformei, și are pereche pe tema întunecată', () => {
    const h = paginaCu(true)
    expect(h).toContain('.stare.programat { --verde:#0A6B41')
    expect(h).toContain(':root[data-tema="dark"] .stare.programat { --verde:#5FBF8D }')
  })
})

describe('pagina săptămânii, cerută de la worker', () => {
  const cere = (env: unknown, cale = '/') =>
    program.fetch(
      new Request(`https://program.staging.sfantul-ilie.ro${cale}`, { headers: { cookie: 'xc_sesiune=jeton-de-proba' } }),
      env as never,
      ctxExec,
    )

  it('adminul vede eticheta verde pe săptămâna programată', async () => {
    const { env } = mediu({ saptamani: [PROGRAMATA], admin: true })
    const h = await laCeasul(MARTI, async () => await (await cere(env, `/saptamana/${LUNI}`)).text())
    expect(h).toContain('Programată — apare duminică, 27 septembrie 2026, la ora 12:00')
  })

  /**
   * ⚠️ PENTRU ENORIAȘ SĂPTĂMÂNA NICI NU EXISTĂ — schimbat la 20.09.2026, 23:55 („Public arătăm doar
   * ce e curent"). Până atunci i se arăta programul cu eticheta „propus"; acum pagina lui e cea care
   * spune că nu s-a publicat nimic încă, și atât. Nu „apare duminică", fiindcă programul parohiei nu
   * se anunță înainte de a fi al parohiei, și nici măcar conținutul, fiindcă se mai poate schimba
   * până în ultima clipă. Amănuntele sunt în `program-vizibilitate.test.ts`.
   */
  it('omul de rând nu vede săptămâna programată deloc — 404, fără program și fără „propus"', async () => {
    const { env } = mediu({ saptamani: [PROGRAMATA], admin: false })
    const r = await laCeasul(MARTI, () => cere(env, `/saptamana/${LUNI}`))
    const h = await r.text()
    expect(r.status).toBe(404)
    expect(h).toContain('Programul nu e publicat încă')
    expect(h).not.toContain('class="stare propus"')
    expect(h).not.toContain('Programată — apare')
  })
})
