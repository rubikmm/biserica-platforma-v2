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
import { arhivaIntreaga, eProgramata, programateleScadente, saptamanaDin, treciLaValidat, valideazaSaptamana, type RandSaptamana } from '../apps/program/src/depozit.js'
import { paginaSaptamana, type Ctx, type Meniu } from '../apps/program/src/pagini.js'
import { STARI_SAPTAMANA } from '../packages/contracts/src/index.js'

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
// Săptămânile de probă
// ---------------------------------------------------------------------------

type Rand = RandSaptamana
type RandSlujba = {
  id: string; luni: string; data: string; ora: string; nume: string; cod_nume: string
  slujitor: string | null; loc: string; detalii: string; observatii: string | null
  curatenie: number; transmisie: number; ordine: number; creat: string; modificat: string
}

const saptamanaDeProba = (luni: string, peste: Partial<Rand> = {}): Rand => ({
  luni,
  duminica: new Date(Date.parse(`${luni}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10),
  stare: 'propus',
  titlu: '',
  sursa: 'propunere',
  sursa_id: null,
  sursa_link: null,
  versiune_calendar: null,
  validat_de: null,
  validat_la: null,
  programat_la: null,
  programat_de: null,
  creat: '2026-09-20T08:00:00.000Z',
  modificat: '2026-09-20T08:00:00.000Z',
  ...peste,
})

/** Scrisă, nevalidată, fără ceas — starea de pornire a oricărei săptămâni. */
const PROPUSA = saptamanaDeProba(LUNI)
/** PROGRAMATĂ marți: `stare` tot „propus", dar cu clipa apariției pe ea. */
const PROGRAMATA = saptamanaDeProba(LUNI, { programat_la: PRAGUL, programat_de: 'u1' })
/** Validată de mână, săptămâna trecută. */
const VALIDATA = saptamanaDeProba('2026-09-21', { stare: 'validat', validat_de: 'u1', validat_la: '2026-09-20T09:02:00.000Z' })

const slujbaDeProba = (luni: string, data: string, ora: string, cod: string, nume: string, i: number): RandSlujba => ({
  id: `${data}-${cod}`, luni, data, ora, nume, cod_nume: cod,
  slujitor: null, loc: 'biserica', detalii: '[]', observatii: null,
  curatenie: 1, transmisie: 1, ordine: i,
  creat: '2026-09-20T08:00:00.000Z', modificat: '2026-09-20T08:00:00.000Z',
})

const SLUJBE = (luni: string): RandSlujba[] => [
  slujbaDeProba(luni, luni, '07:00', 'utrenia_liturghie', 'Utrenia și Sfânta Liturghie', 0),
  slujbaDeProba(luni, `${luni.slice(0, 8)}${String(Number(luni.slice(8)) + 2).padStart(2, '0')}`, '17:00', 'maslu', 'Sfântul Maslu', 1),
]

const VOCABULAR = [
  { cod_nume: 'utrenia_liturghie', nume: 'Utrenia și Sfânta Liturghie', categorie: 'dimineata', ordine: 1, activ: 1 },
  { cod_nume: 'maslu', nume: 'Sfântul Maslu', categorie: 'alte', ordine: 22, activ: 1 },
  { cod_nume: 'vecernia', nume: 'Vecernia', categorie: 'seara', ordine: 8, activ: 1 },
]

// ---------------------------------------------------------------------------
// D1 de probă — unul care CHIAR citește clauzele din SQL
// ---------------------------------------------------------------------------

/**
 * ⚠️ DE CE NU UN FALS CARE „ȘTIE" CE FACE INTEROGAREA. Lecția zilei, învățată la buletin cu câteva
 * ore înainte: un fals care-și pune singur condițiile trece verde și peste ștergerea lor din SQL —
 * adică exact peste greșeala care ar face săptămâna să apară cu o săptămână mai devreme, ori
 * niciodată. Aici SET-ul și WHERE-ul se CITESC din interogare și se aplică pe rânduri; o clauză
 * scoasă din `treciLaValidat` cade pe loc, într-una din probele de mai jos.
 * ⚠️ Iar unde se leagă un CEAS, falsul cere o clipă ISO întreagă: cu alt argument nimerit acolo,
 * comparația ar ieși din întâmplare falsă, proba ar trece, și s-ar vedea abia în duminica în care
 * programul NU apare.
 */
const CLIPA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

type Orice = Record<string, unknown>

/** `?` fără număr capătă numărul lui, în ordinea în care apare — ca în D1. */
function numeroteaza(sql: string): string {
  if (/\?\d/.test(sql) && /\?(?!\d)/.test(sql)) throw new Error(`interogare cu semne de întrebare amestecate (cu și fără număr): ${sql}`)
  let i = 0
  return sql.replace(/\?(?!\d)/g, () => `?${++i}`)
}

/** Valoarea unui simbol din SQL: `?N`, `NULL`, `'literal'`, `COALESCE(?N, col)` sau o COLOANĂ. */
function valoarea(tok: string, legat: unknown[], rand: Orice): unknown {
  const t = tok.trim()
  if (t === 'NULL') return null
  let m = /^\?(\d+)$/.exec(t)
  if (m) return legat[Number(m[1]) - 1]
  m = /^'(.*)'$/.exec(t)
  if (m) return m[1]
  m = /^COALESCE\(\s*\?(\d+)\s*,\s*(\w+)\s*\)$/i.exec(t)
  if (m) return legat[Number(m[1]) - 1] ?? rand[m[2]!]
  if (/^\w+$/.test(t)) return rand[t]
  throw new Error(`nu știu să citesc „${t}" din SQL`)
}

/** O condiție de WHERE, aplicată pe un rând. Ce nu e aici cade cu zgomot, nu în tăcere. */
function conditia(c: string, legat: unknown[]): (r: Orice) => boolean {
  const s = c.trim()
  let m = /^(\w+)\s+IS\s+NOT\s+NULL$/i.exec(s)
  if (m) return (r) => r[m![1]!] !== null && r[m![1]!] !== undefined
  m = /^(\w+)\s+IS\s+NULL$/i.exec(s)
  if (m) return (r) => r[m![1]!] === null || r[m![1]!] === undefined
  m = /^(\w+)\s*(<=|>=|=|<|>)\s*(.+)$/.exec(s)
  if (m) {
    const [, col, op, tok] = m as unknown as [string, string, string, string]
    return (r) => {
      const a = r[col]
      const b = valoarea(tok, legat, r)
      if (a === null || a === undefined || b === null || b === undefined) return op === '=' ? a === b : false
      switch (op) {
        case '=': return a === b
        case '<=': return (a as string) <= (b as string)
        case '>=': return (a as string) >= (b as string)
        case '<': return (a as string) < (b as string)
        default: return (a as string) > (b as string)
      }
    }
  }
  throw new Error(`condiție necunoscută în WHERE: „${s}"`)
}

/** Taie o listă la virgulele din afara parantezelor (`COALESCE(?, x)` rămâne întreg). */
function bucati(s: string): string[] {
  const out: string[] = []
  let adanc = 0
  let curent = ''
  for (const ch of s) {
    if (ch === '(') adanc++
    if (ch === ')') adanc--
    if (ch === ',' && adanc === 0) { out.push(curent); curent = '' } else curent += ch
  }
  if (curent.trim()) out.push(curent)
  return out.map((x) => x.trim()).filter(Boolean)
}

function dbFals(inceput: { saptamani?: Rand[]; slujbe?: RandSlujba[] } = {}) {
  const stare = {
    saptamani: (inceput.saptamani ?? []).map((s) => ({ ...s })) as unknown as Orice[],
    slujbe: (inceput.slujbe ?? []).map((s) => ({ ...s })) as unknown as Orice[],
    vocabular: VOCABULAR.map((v) => ({ ...v })) as unknown as Orice[],
    istoric: [] as Orice[],
    outbox: [] as Orice[],
  }

  const prepare = (sqlBrut: string) => {
    const s = numeroteaza(sqlBrut.replace(/\s+/g, ' ').trim())
    let legat: unknown[] = []

    /** Clipa legată la un ceas, cerută întreagă — vezi lămurirea de mai sus. */
    const ceasul = (i: number): string => {
      const x = legat[i]
      if (typeof x !== 'string' || !CLIPA.test(x)) {
        throw new Error(`ceasul se leagă la ?${i + 1}, dar acolo e ${JSON.stringify(x)} — în: ${s}`)
      }
      return x
    }

    /**
     * ⚠️ D1 ÎNTOARCE COPII, nu rândurile din tabel. Falsul trebuie să facă la fel: prima lui variantă
     * dădea chiar obiectele din `stare`, iar un `UPDATE` de după le schimba SUB cel care le citise
     * deja. Așa trecea verde un `treciLaValidat` care întorcea `validat_la: null` — clipa anunțată
     * se pierdea din răspuns, adică tocmai din ce scrie workerul în jurnal când o săptămână apare.
     */
    const copii = (r: Orice[]): Orice[] => r.map((x) => ({ ...x }))
    const copie = (r: Orice | undefined): Orice | null => (r ? { ...r } : null)

    const eu = {
      bind: (...a: unknown[]) => { legat = a; return eu },

      async first() {
        if (s.startsWith('SELECT * FROM saptamani WHERE luni = ?1')) {
          return copie(stare.saptamani.find((r) => r.luni === legat[0]))
        }
        if (s.startsWith('SELECT COUNT(*) AS n FROM slujbe WHERE luni = ?1')) {
          return { n: stare.slujbe.filter((r) => r.luni === legat[0]).length }
        }
        if (s.startsWith('SELECT * FROM slujbe WHERE id = ?1')) {
          return copie(stare.slujbe.find((r) => r.id === legat[0]))
        }
        throw new Error(`first() nu știe: ${s}`)
      },

      async all() {
        if (s.startsWith('SELECT * FROM vocabular')) return { results: copii(stare.vocabular) }
        if (s.startsWith('SELECT * FROM slujbe WHERE luni = ?1')) {
          return { results: copii(stare.slujbe.filter((r) => r.luni === legat[0])) }
        }
        if (s.startsWith('SELECT id FROM slujbe WHERE id = ?1')) {
          const baza = String(legat[0])
          return { results: copii(stare.slujbe.filter((r) => r.id === baza || String(r.id).startsWith(`${baza}-`))) }
        }
        // ⚠️ INTEROGAREA CEASULUI: se citește din SQL, clauză cu clauză
        if (s.startsWith('SELECT * FROM saptamani WHERE')) {
          const unde = s.slice(s.indexOf(' WHERE ') + 7).replace(/ ORDER BY .*$/, '')
          const cond = unde.split(/\s+AND\s+/i).map((c) => conditia(c, legat))
          const cuCeas = /programat_la <= \?(\d+)/.exec(unde)
          if (cuCeas) ceasul(Number(cuCeas[1]) - 1)
          return { results: copii(stare.saptamani.filter((r) => cond.every((f) => f(r)))).sort((a, b) => String(a.luni).localeCompare(String(b.luni))) }
        }
        // arhiva publică: COLOANELE CERUTE, nimic pe deasupra
        if (/^SELECT [\w, ]+ FROM saptamani ORDER BY luni$/.test(s)) {
          const coloane = bucati(s.slice('SELECT '.length, s.indexOf(' FROM ')))
          return {
            results: [...stare.saptamani]
              .sort((a, b) => String(a.luni).localeCompare(String(b.luni)))
              .map((r) => Object.fromEntries(coloane.map((c) => [c, r[c] ?? null]))),
          }
        }
        if (s.startsWith('SELECT DISTINCT substr(luni, 1, 4) AS an FROM saptamani')) {
          return { results: [...new Set(stare.saptamani.map((r) => String(r.luni).slice(0, 4)))].sort().reverse().map((an) => ({ an })) }
        }
        if (s.startsWith('SELECT * FROM slujbe WHERE data')) return { results: [] }
        if (s.startsWith('SELECT * FROM slujbe ORDER BY')) return { results: copii(stare.slujbe) }
        if (s.startsWith('SELECT id, envelope_json, attempts FROM outbox')) {
          return { results: copii(stare.outbox.filter((r) => r.published_at === null)) }
        }
        throw new Error(`all() nu știe: ${s}`)
      },

      async run() {
        if (s.startsWith('UPDATE saptamani SET ')) {
          const [pusul = '', unde = ''] = s.slice('UPDATE saptamani SET '.length).split(' WHERE ')
          const seteaza = bucati(pusul).map((p) => {
            const [col, ...rest] = p.split('=')
            return { col: col!.trim(), tok: rest.join('=').trim() }
          })
          const cond = unde.split(/\s+AND\s+/i).map((c) => conditia(c, legat))
          const cuCeas = /programat_la <= \?(\d+)/.exec(unde)
          if (cuCeas) ceasul(Number(cuCeas[1]) - 1)
          let cate = 0
          for (const r of stare.saptamani) {
            if (!cond.every((f) => f(r))) continue
            // ⚠️ valorile se socotesc TOATE pe rândul dinainte: `validat_de = programat_de` și
            // `programat_de = NULL` stau în aceeași interogare, iar SQL-ul nu le face pe rând.
            const noi = seteaza.map((x) => [x.col, valoarea(x.tok, legat, r)] as const)
            for (const [col, val] of noi) r[col] = val
            cate++
          }
          return { meta: { changes: cate } }
        }
        if (s.startsWith('INSERT INTO istoric')) {
          const [moment, user_id, ce, luni, slujba_id, detalii] = legat
          stare.istoric.push({ moment, user_id, ce, luni, slujba_id, detalii })
          return { meta: { changes: 1 } }
        }
        if (s.startsWith('INSERT INTO outbox')) {
          const [id, type, envelope_json, created_at] = legat
          stare.outbox.push({ id, type, envelope_json, created_at, published_at: null, attempts: 0 })
          return { meta: { changes: 1 } }
        }
        if (s.startsWith('UPDATE outbox SET published_at')) {
          const r = stare.outbox.find((x) => x.id === legat[1])
          if (r) r.published_at = legat[0]
          return { meta: { changes: r ? 1 : 0 } }
        }
        if (s.startsWith('INSERT INTO slujbe')) {
          const [id, luni, data, ora, nume, cod_nume, slujitor, loc, detalii, observatii, curatenie, transmisie, ordine, creat, modificat] = legat
          stare.slujbe.push({ id, luni, data, ora, nume, cod_nume, slujitor, loc, detalii, observatii, curatenie, transmisie, ordine, creat, modificat })
          return { meta: { changes: 1 } }
        }
        if (s.startsWith('DELETE FROM slujbe WHERE id = ?1')) {
          const inainte = stare.slujbe.length
          stare.slujbe = stare.slujbe.filter((r) => r.id !== legat[0])
          return { meta: { changes: inainte - stare.slujbe.length } }
        }
        if (s.startsWith('UPDATE slujbe SET ')) {
          const [pusul = '', unde = ''] = s.slice('UPDATE slujbe SET '.length).split(' WHERE ')
          const seteaza = bucati(pusul).map((p) => {
            const [col, ...rest] = p.split('=')
            return { col: col!.trim(), tok: rest.join('=').trim() }
          })
          const cond = unde.split(/\s+AND\s+/i).map((c) => conditia(c, legat))
          let cate = 0
          for (const r of stare.slujbe) {
            if (!cond.every((f) => f(r))) continue
            for (const x of seteaza) r[x.col] = valoarea(x.tok, legat, r)
            cate++
          }
          return { meta: { changes: cate } }
        }
        throw new Error(`run() nu știe: ${s}`)
      },
    }
    return eu
  }

  const db = {
    prepare,
    async batch(declaratii: Array<{ run: () => Promise<unknown> }>) {
      const out = []
      for (const d of declaratii) out.push(await d.run())
      return out
    },
  }
  return { stare, db: db as unknown as D1Database }
}

/** Evenimentele puse în outbox, desfăcute. */
const evenimentele = (stare: { outbox: Orice[] }) =>
  stare.outbox.map((r) => JSON.parse(String(r.envelope_json)) as { type: string; actor: { type: string; id?: string }; payload: Orice })

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
    const a = await arhivaIntreaga((env as { DB: D1Database }).DB)
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
   * ⚠️ PENTRU ENORIAȘ NU S-A ÎNTÂMPLAT NIMIC, și așa trebuie: programul chiar n-a fost validat. Dacă
   * pagina i-ar spune „apare duminică", ar afla de pe site un program pe care parohia încă îl poate
   * schimba până în ultima clipă.
   */
  it('omul de rând vede „propus", fără niciun cuvânt despre duminică', async () => {
    const { env } = mediu({ saptamani: [PROGRAMATA], admin: false })
    const h = await laCeasul(MARTI, async () => await (await cere(env, `/saptamana/${LUNI}`)).text())
    expect(h).toContain('class="stare propus"')
    expect(h).not.toContain('Programată — apare')
  })
})
