/**
 * D1 DE PROBĂ PENTRU PROGRAM — unul care CHIAR citește clauzele din SQL. (Nu e o probă: fișierul n-are
 * `.test.ts`, deci `vitest.config.ts` nu-l ia drept suită.)
 *
 * ⚠️ DE CE NU UN FALS CARE „ȘTIE" CE FACE INTEROGAREA. Lecția de la buletin (20.09.2026): un fals
 * care-și pune singur condițiile trece verde și peste ȘTERGEREA lor din SQL — adică exact peste
 * greșeala care ar face săptămâna să apară cu o săptămână mai devreme, ori niciodată. Aici SELECT-ul,
 * WHERE-ul și SET-ul se CITESC din interogare și se aplică pe rânduri; o clauză scoasă din
 * `treciLaValidat` ori din `cerne()` cade pe loc, într-una din probe.
 * ⚠️ Iar unde se leagă un CEAS, falsul cere o clipă ISO întreagă: cu alt argument nimerit acolo,
 * comparația ar ieși din întâmplare falsă, proba ar trece, și s-ar vedea abia în duminica în care
 * programul NU apare.
 * ⚠️ CE NU ȘTIE, CADE CU ZGOMOT (`throw`), niciodată în tăcere cu un rezultat gol: un fals care
 * răspunde „n-am găsit nimic" la o interogare pe care n-o înțelege ar fi trecut verde tocmai proba
 * care spune „lumea nu vede săptămâna propusă".
 *
 * Îl folosesc `program-programare.test.ts` (ceasul) și `program-vizibilitate.test.ts` (cernerea).
 */
import type { RandSaptamana } from '../apps/program/src/depozit.js'

export type Rand = RandSaptamana
export type RandSlujbaProba = {
  id: string; luni: string; data: string; ora: string; nume: string; cod_nume: string
  slujitor: string | null; loc: string; detalii: string; observatii: string | null
  curatenie: number; transmisie: number; ordine: number; creat: string; modificat: string
}

export type Orice = Record<string, unknown>

const CLIPA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export const VOCABULAR = [
  { cod_nume: 'utrenia_liturghie', nume: 'Utrenia și Sfânta Liturghie', categorie: 'dimineata', ordine: 1, activ: 1 },
  { cod_nume: 'maslu', nume: 'Sfântul Maslu', categorie: 'alte', ordine: 22, activ: 1 },
  { cod_nume: 'vecernia', nume: 'Vecernia', categorie: 'seara', ordine: 8, activ: 1 },
]

export const saptamanaDeProba = (luni: string, peste: Partial<Rand> = {}): Rand => ({
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

export const slujbaDeProba = (luni: string, data: string, ora: string, cod: string, nume: string, i: number): RandSlujbaProba => ({
  id: `${data}-${cod}`, luni, data, ora, nume, cod_nume: cod,
  slujitor: null, loc: 'biserica', detalii: '[]', observatii: null,
  curatenie: 1, transmisie: 1, ordine: i,
  creat: '2026-09-20T08:00:00.000Z', modificat: '2026-09-20T08:00:00.000Z',
})

/** Cele două slujbe obișnuite ale unei săptămâni: liturghia de luni și maslul de miercuri. */
export const SLUJBE = (luni: string): RandSlujbaProba[] => [
  slujbaDeProba(luni, luni, '07:00', 'utrenia_liturghie', 'Utrenia și Sfânta Liturghie', 0),
  slujbaDeProba(luni, `${luni.slice(0, 8)}${String(Number(luni.slice(8)) + 2).padStart(2, '0')}`, '17:00', 'maslu', 'Sfântul Maslu', 1),
]

/** Evenimentele puse în outbox, desfăcute. */
export const evenimentele = (stare: { outbox: Orice[] }) =>
  stare.outbox.map((r) => JSON.parse(String(r.envelope_json)) as { type: string; actor: { type: string; id?: string }; payload: Orice })

// ---------------------------------------------------------------------------
// Cititul SQL-ului
// ---------------------------------------------------------------------------

/** `?` fără număr capătă numărul lui, în ordinea în care apare — ca în D1. */
export function numeroteaza(sql: string): string {
  if (/\?\d/.test(sql) && /\?(?!\d)/.test(sql)) throw new Error(`interogare cu semne de întrebare amestecate (cu și fără număr): ${sql}`)
  let i = 0
  return sql.replace(/\?(?!\d)/g, () => `?${++i}`)
}

/** Valoarea unui simbol din SQL: `?N`, `NULL`, `'literal'`, `COALESCE(?N, col)` sau o COLOANĂ. */
export function valoarea(tok: string, legat: unknown[], rand: Orice): unknown {
  const t = tok.trim()
  if (t === 'NULL') return null
  let m = /^\?(\d+)$/.exec(t)
  if (m) return legat[Number(m[1]) - 1]
  m = /^'(.*)'$/.exec(t)
  if (m) return m[1]
  m = /^COALESCE\(\s*\?(\d+)\s*,\s*(\w+)\s*\)$/i.exec(t)
  if (m) return legat[Number(m[1]) - 1] ?? rand[m[2]!]
  if (/^[\w.]+$/.test(t)) return rand[coloana(t)]
  throw new Error(`nu știu să citesc „${t}" din SQL`)
}

/** `s.stare` → `stare`: falsul ține un singur tabel pe nume, aliasul e doar zgomot. */
const coloana = (c: string): string => c.slice(c.indexOf('.') + 1)

/** Taie o listă la virgulele din afara parantezelor (`COALESCE(?, x)` rămâne întreg). */
export function bucati(s: string): string[] {
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

/**
 * Taie un WHERE la `AND`-urile din AFARA parantezelor.
 * ⚠️ Nu `split(/\s+AND\s+/)`: din 20.09.2026 cernerea slujbelor e un subselect, iar un `AND` ajuns
 * vreodată înăuntrul lui ar fi rupt condiția în două jumătăți fără înțeles, tăcut.
 */
export function conditii(s: string): string[] {
  const out: string[] = []
  let adanc = 0
  let curent = ''
  const rest = s.trim()
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i]!
    if (ch === '(') adanc++
    if (ch === ')') adanc--
    if (adanc === 0 && /^\s+AND\s+/i.test(rest.slice(i))) {
      out.push(curent)
      const m = /^\s+AND\s+/i.exec(rest.slice(i))!
      i += m[0].length - 1
      curent = ''
      continue
    }
    curent += ch
  }
  if (curent.trim()) out.push(curent)
  return out.map((x) => x.trim()).filter(Boolean)
}

type Tabele = Record<string, Orice[]>

/**
 * O condiție de WHERE, aplicată pe un rând. Ce nu e aici cade cu zgomot, nu în tăcere.
 * `tabele` slujește subselectului cernerii (`luni IN (SELECT luni FROM saptamani WHERE …)`).
 */
export function conditia(c: string, legat: unknown[], tabele: Tabele = {}): (r: Orice) => boolean {
  let s = c.trim()
  // parantezele din jurul unei condiții întregi („(data > ?1 OR (data = ?1 AND ora >= ?2))")
  while (/^\(.*\)$/.test(s) && echilibrata(s.slice(1, -1))) s = s.slice(1, -1).trim()

  // ⚠️ CERNEREA VIZIBILITĂȚII: `col IN (SELECT col2 FROM tabel WHERE …)`. Subselectul se RULEAZĂ,
  // nu se presupune — altfel o clauză schimbată în `cerneSlujbe` ar fi trecut neobservată.
  let m = /^([\w.]+)\s+IN\s+\(\s*SELECT\s+([\w.]+)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?\s*\)$/i.exec(s)
  if (m) {
    const [, col, colIn, tabel, unde] = m as unknown as [string, string, string, string, string | undefined]
    const randuri = tabele[tabel]
    if (!randuri) throw new Error(`subselect pe tabelul necunoscut „${tabel}": ${s}`)
    const cond = unde ? conditii(unde).map((x) => conditia(x, legat, tabele)) : []
    const multime = new Set(randuri.filter((x) => cond.every((f) => f(x))).map((x) => x[coloana(colIn)]))
    return (r) => multime.has(r[coloana(col)])
  }

  // OR (o singură treaptă: atât scrie programul)
  const ramuri = conditiiSau(s)
  if (ramuri.length > 1) {
    const f = ramuri.map((x) => conditia(x, legat, tabele))
    return (r) => f.some((g) => g(r))
  }
  const ale = conditii(s)
  if (ale.length > 1) {
    const f = ale.map((x) => conditia(x, legat, tabele))
    return (r) => f.every((g) => g(r))
  }

  m = /^([\w.]+)\s+IS\s+NOT\s+NULL$/i.exec(s)
  if (m) return (r) => r[coloana(m![1]!)] !== null && r[coloana(m![1]!)] !== undefined
  m = /^([\w.]+)\s+IS\s+NULL$/i.exec(s)
  if (m) return (r) => r[coloana(m![1]!)] === null || r[coloana(m![1]!)] === undefined
  m = /^([\w.]+)\s+LIKE\s+(.+)$/i.exec(s)
  if (m) {
    const [, col, tok] = m as unknown as [string, string, string]
    return (r) => {
      const b = valoarea(tok, legat, r)
      if (typeof b !== 'string' || typeof r[coloana(col)] !== 'string') return false
      const rx = new RegExp(`^${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`)
      return rx.test(r[coloana(col)] as string)
    }
  }
  m = /^([\w.]+)\s*(<=|>=|=|<|>)\s*(.+)$/.exec(s)
  if (m) {
    const [, col, op, tok] = m as unknown as [string, string, string, string]
    return (r) => {
      const a = r[coloana(col)]
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

const echilibrata = (s: string): boolean => {
  let a = 0
  for (const ch of s) {
    if (ch === '(') a++
    if (ch === ')') a--
    if (a < 0) return false
  }
  return a === 0
}

/** Taie la `OR`-urile din afara parantezelor. */
function conditiiSau(s: string): string[] {
  const out: string[] = []
  let adanc = 0
  let curent = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!
    if (ch === '(') adanc++
    if (ch === ')') adanc--
    if (adanc === 0 && /^\s+OR\s+/i.test(s.slice(i))) {
      out.push(curent)
      i += /^\s+OR\s+/i.exec(s.slice(i))![0].length - 1
      curent = ''
      continue
    }
    curent += ch
  }
  if (curent.trim()) out.push(curent)
  return out.map((x) => x.trim()).filter(Boolean)
}

// ---------------------------------------------------------------------------
// Baza
// ---------------------------------------------------------------------------

export function dbFals(inceput: { saptamani?: Rand[]; slujbe?: RandSlujbaProba[] } = {}) {
  const stare = {
    saptamani: (inceput.saptamani ?? []).map((s) => ({ ...s })) as unknown as Orice[],
    slujbe: (inceput.slujbe ?? []).map((s) => ({ ...s })) as unknown as Orice[],
    vocabular: VOCABULAR.map((v) => ({ ...v })) as unknown as Orice[],
    istoric: [] as Orice[],
    outbox: [] as Orice[],
  }
  const tabele = (): Tabele => ({ saptamani: stare.saptamani, slujbe: stare.slujbe, vocabular: stare.vocabular })

  const prepare = (sqlBrut: string) => {
    const s = numeroteaza(sqlBrut.replace(/\s+/g, ' ').trim())
    let legat: unknown[] = []

    /** Clipa legată la un ceas, cerută întreagă — vezi lămurirea de sus. */
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

    /**
     * SELECT-ul obișnuit pe un tabel: coloanele cerute, WHERE-ul citit clauză cu clauză, ORDER BY
     * (una ori mai multe coloane, ASC/DESC) și LIMIT. Întoarce `null` dacă interogarea nu e de felul
     * ăsta — atunci ramurile anume de mai jos își spun cuvântul, iar la urmă se aruncă.
     */
    const selectul = (): Orice[] | null => {
      const m = /^SELECT (.+?) FROM (\w+)(?: (\w+))?(?: WHERE (.+?))?(?: ORDER BY (.+?))?(?: LIMIT (.+?))?$/i.exec(s)
      if (!m) return null
      const [, coloane, tabel, , unde, ordine, limita] = m as unknown as [string, string, string, string | undefined, string | undefined, string | undefined, string | undefined]
      const randuri = tabele()[tabel]
      if (!randuri) return null
      if (/\bJOIN\b|\bGROUP BY\b|\bCOUNT\(|\bMIN\(|\bMAX\(|\bDISTINCT\b|\bUNION\b|\bsubstr\(/i.test(s)) return null

      if (unde) {
        const cuCeas = /programat_la <= \?(\d+)/.exec(unde)
        if (cuCeas) ceasul(Number(cuCeas[1]) - 1)
      }
      const cond = unde ? conditii(unde).map((c) => conditia(c, legat, tabele())) : []
      let rez = copii(randuri.filter((r) => cond.every((f) => f(r))))
      if (ordine) {
        const chei = bucati(ordine).map((x) => {
          const [col, dir] = x.split(/\s+/)
          return { col: coloana(col!), jos: (dir ?? '').toUpperCase() === 'DESC' }
        })
        rez = rez.sort((a, b) => {
          for (const k of chei) {
            const va = String(a[k.col] ?? '')
            const vb = String(b[k.col] ?? '')
            if (va !== vb) return (va < vb ? -1 : 1) * (k.jos ? -1 : 1)
          }
          return 0
        })
      }
      if (limita) {
        const n = Number(valoarea(limita.trim(), legat, {}))
        if (Number.isFinite(n)) rez = rez.slice(0, n)
      }
      if (coloane.trim() !== '*') {
        const cerute = bucati(coloane).map((c) => coloana(c.trim()))
        rez = rez.map((r) => Object.fromEntries(cerute.map((c) => [c, r[c] ?? null])))
      }
      return rez
    }

    const eu = {
      bind: (...a: unknown[]) => { legat = a; return eu },

      async first() {
        if (s.startsWith('SELECT COUNT(*) AS n FROM slujbe WHERE luni = ?1')) {
          return { n: stare.slujbe.filter((r) => r.luni === legat[0]).length }
        }
        if (s.startsWith('SELECT MAX(m) AS modificat FROM')) {
          const clipe = [...stare.saptamani, ...stare.slujbe]
            .filter((r) => r.luni === legat[0])
            .map((r) => String(r.modificat))
            .sort()
          return { modificat: clipe.length ? clipe[clipe.length - 1] : null }
        }
        if (s.startsWith('SELECT (SELECT min(luni)')) {
          const luni = stare.saptamani.map((r) => String(r.luni)).sort()
          const dum = stare.saptamani.map((r) => String(r.duminica)).sort()
          return {
            de_la: luni[0] ?? null,
            pana_la: dum[dum.length - 1] ?? null,
            saptamani: stare.saptamani.length,
            slujbe: stare.slujbe.length,
          }
        }
        const r = selectul()
        if (r) return copie(r[0])
        throw new Error(`first() nu știe: ${s}`)
      },

      async all() {
        if (s.startsWith('SELECT * FROM vocabular') || s.startsWith('SELECT cod_nume, nume FROM vocabular')) {
          return { results: copii(stare.vocabular) }
        }
        if (s.startsWith('SELECT id FROM slujbe WHERE id = ?1')) {
          const baza = String(legat[0])
          return { results: copii(stare.slujbe.filter((r) => r.id === baza || String(r.id).startsWith(`${baza}-`))) }
        }
        // ARHIVA cu anii: `SELECT DISTINCT substr(luni,1,4) AS an FROM saptamani [WHERE …] ORDER BY an DESC`
        let m = /^SELECT DISTINCT substr\(luni, 1, 4\) AS an FROM saptamani (?:WHERE (.+?) )?ORDER BY an DESC$/i.exec(s)
        if (m) {
          const cond = m[1] ? conditii(m[1]).map((c) => conditia(c, legat, tabele())) : []
          const ani = [...new Set(stare.saptamani.filter((r) => cond.every((f) => f(r))).map((r) => String(r.luni).slice(0, 4)))]
          return { results: ani.sort().reverse().map((an) => ({ an })) }
        }
        // REZUMATUL ANULUI: săptămânile cu numărul lor de slujbe (LEFT JOIN + GROUP BY)
        m = /^SELECT s\.luni, s\.duminica, s\.titlu, s\.stare, s\.sursa, COUNT\(l\.id\) AS nr_slujbe FROM saptamani s LEFT JOIN slujbe l ON l\.luni = s\.luni (?:WHERE (.+?) )?GROUP BY s\.luni ORDER BY s\.luni DESC$/i.exec(s)
        if (m) {
          const cond = m[1] ? conditii(m[1]).map((c) => conditia(c, legat, tabele())) : []
          return {
            results: stare.saptamani
              .filter((r) => cond.every((f) => f(r)))
              .map((r) => ({
                luni: r.luni, duminica: r.duminica, titlu: r.titlu, stare: r.stare, sursa: r.sursa,
                nr_slujbe: stare.slujbe.filter((x) => x.luni === r.luni).length,
              }))
              .sort((a, b) => String(b.luni).localeCompare(String(a.luni))),
          }
        }
        // TIPARELE: prima apariție viitoare a fiecărui nume
        m = /^SELECT cod_nume, MIN\(data\) AS data FROM slujbe (?:WHERE (.+?) )?GROUP BY cod_nume$/i.exec(s)
        if (m) {
          const cond = m[1] ? conditii(m[1]).map((c) => conditia(c, legat, tabele())) : []
          const pe = new Map<string, string>()
          for (const r of stare.slujbe.filter((r) => cond.every((f) => f(r)))) {
            const cod = String(r.cod_nume)
            const d = String(r.data)
            if (!pe.has(cod) || d < pe.get(cod)!) pe.set(cod, d)
          }
          return { results: [...pe.entries()].map(([cod_nume, data]) => ({ cod_nume, data })) }
        }
        if (s.startsWith('SELECT id, envelope_json, attempts FROM outbox')) {
          return { results: copii(stare.outbox.filter((r) => r.published_at === null)) }
        }
        const r = selectul()
        if (r) return { results: r }
        throw new Error(`all() nu știe: ${s}`)
      },

      async run() {
        if (s.startsWith('UPDATE saptamani SET ')) {
          const [pusul = '', unde = ''] = s.slice('UPDATE saptamani SET '.length).split(' WHERE ')
          const seteaza = bucati(pusul).map((p) => {
            const [col, ...rest] = p.split('=')
            return { col: col!.trim(), tok: rest.join('=').trim() }
          })
          const cond = conditii(unde).map((c) => conditia(c, legat, tabele()))
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
        if (s.startsWith('INSERT INTO saptamani')) {
          const [luni, duminica, titlu, creat, modificat] = legat
          stare.saptamani.push(saptamanaDeProba(String(luni), {
            duminica: String(duminica), titlu: String(titlu), sursa: 'manual',
            creat: String(creat), modificat: String(modificat),
          }) as unknown as Orice)
          return { meta: { changes: 1 } }
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
        if (s.startsWith('DELETE FROM slujbe WHERE luni = ?1')) {
          const inainte = stare.slujbe.length
          stare.slujbe = stare.slujbe.filter((r) => r.luni !== legat[0])
          return { meta: { changes: inainte - stare.slujbe.length } }
        }
        if (s.startsWith('UPDATE slujbe SET ')) {
          const [pusul = '', unde = ''] = s.slice('UPDATE slujbe SET '.length).split(' WHERE ')
          const seteaza = bucati(pusul).map((p) => {
            const [col, ...rest] = p.split('=')
            return { col: col!.trim(), tok: rest.join('=').trim() }
          })
          const cond = conditii(unde).map((c) => conditia(c, legat, tabele()))
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
