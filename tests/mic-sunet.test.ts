import { describe, expect, it, vi } from 'vitest'
import { corpMic, jsMic } from '../apps/live/src/mic.js'
import { asteaptaSchimbarea, secundeDeAsteptare } from '../apps/live/src/asteptare.js'
import {
  ISTORIC_ZILE,
  MAX_PUNCTE,
  ORE_IMPLICIT,
  PREFIX_SUNET,
  PUNCTE_PE_ORA,
  type PunctSunet,
  adaugaPunct,
  cheiDeSters,
  cheiaOrei,
  cheileDin,
  compuneIstoric,
  dupaOra,
  limitaVechimii,
  oreCerute,
  punctDin,
  rareste,
} from '../apps/live/src/sunet-istoric.js'

/**
 * ISTORICUL SUNETULUI și GRAFICUL de pe `/mic` (18.09.2026).
 *
 * Ca la `rotire.test.ts`: aici se probează SOCOTEALA scoasă din obiectul durabil. O greșeală în
 * chei nu cade la typecheck — se vede peste zile, prin faptul că graficul e gol, că arată ore care
 * nu sunt, sau (mai rău) că mătura a luat și alte chei ale aparatului decât punctele ei.
 */

const ORA = 60 * 60 * 1000
const ZI = 24 * ORA
const T0 = Date.UTC(2026, 8, 18, 20, 35, 12)
const ISO = (t: number) => new Date(t).toISOString()

const punct = (t: number, nivel: number, varf: number | null = nivel + 10): PunctSunet => ({ la: ISO(t), nivel, varf })

describe('cheile orare ale istoricului', () => {
  it('cheia poartă ora în ea, în UTC, tăiată la oră', () => {
    expect(cheiaOrei(T0)).toBe('sunet:2026-09-18T20')
    expect(cheiaOrei(ISO(T0))).toBe('sunet:2026-09-18T20')
    // aceeași oră, orice minut: un singur sertar
    expect(cheiaOrei(T0 + 20 * 1000)).toBe(cheiaOrei(T0))
    expect(cheiaOrei(T0 + ORA)).toBe('sunet:2026-09-18T21')
  })

  /*
   * ⚠️ Pe ordinea ASTA se sprijină și citirea pe interval, și mătura: dacă cineva schimbă formatul
   * cheii (ora la urmă, ziua fără zerouri), `start`/`end` nu mai taie nimic și graficul iese gol.
   */
  it('ordinea alfabetică a cheilor e ordinea cronologică', () => {
    const chei = [cheiaOrei(T0 + 2 * ORA), cheiaOrei(T0 - 30 * ZI), cheiaOrei(T0)]
    expect([...chei].sort()).toEqual([cheiaOrei(T0 - 30 * ZI), cheiaOrei(T0), cheiaOrei(T0 + 2 * ORA)])
  })

  it('toate cheile încep cu prefixul lor, ca mătura să nu prindă altceva', () => {
    expect(cheiaOrei(T0).startsWith(PREFIX_SUNET)).toBe(true)
  })
})

describe('ce chei intră într-un interval', () => {
  it('de la ora în care cade începutul, până la ora sfârșitului', () => {
    expect(cheileDin(T0 - 2 * ORA, T0)).toEqual([
      'sunet:2026-09-18T18',
      'sunet:2026-09-18T19',
      'sunet:2026-09-18T20',
    ])
  })

  it('o fereastră care stă într-o singură oră citește o singură cheie', () => {
    expect(cheileDin(T0 - 60 * 1000, T0)).toEqual(['sunet:2026-09-18T20'])
  })

  it('cele trei ferestre ale paginii: 6 h, 24 h, 7 zile', () => {
    expect(cheileDin(T0 - 6 * ORA, T0)).toHaveLength(7)
    expect(cheileDin(T0 - 24 * ORA, T0)).toHaveLength(25)
    expect(cheileDin(T0 - 168 * ORA, T0)).toHaveLength(169)
  })

  it('marginea de sus a citirii e prima oră care NU mai intră (`end` e exclusiv)', () => {
    const chei = cheileDin(T0 - 2 * ORA, T0)
    expect(dupaOra(T0)).toBe('sunet:2026-09-18T21')
    expect(chei[chei.length - 1]! < dupaOra(T0)).toBe(true)
  })

  it('un interval întors pe dos nu citește nimic', () => {
    expect(cheileDin(T0, T0 - ORA)).toEqual([])
    expect(cheileDin(Number.NaN, T0)).toEqual([])
  })
})

describe('mătura celor 7 zile', () => {
  it('șterge ce e mai vechi, păstrează ora de acum 7 zile fix', () => {
    const chei = [
      cheiaOrei(T0),
      cheiaOrei(T0 - ZI),
      cheiaOrei(T0 - ISTORIC_ZILE * ZI),
      cheiaOrei(T0 - ISTORIC_ZILE * ZI - ORA),
      cheiaOrei(T0 - 30 * ZI),
    ]
    expect(cheiDeSters(chei, T0)).toEqual([cheiaOrei(T0 - ISTORIC_ZILE * ZI - ORA), cheiaOrei(T0 - 30 * ZI)])
  })

  /*
   * ⚠️ Proba care păzește starea emisiei: în același obiect durabil stau `comanda`, `stare`,
   * `rotire`, `alarme`. O mătură care le-ar prinde ar șterge ce transmite parohia, nu niște puncte.
   */
  it('nu atinge celelalte chei ale aparatului', () => {
    const altele = ['comanda', 'stare', 'rotire', 'alarme', 'intarziata', 'ultimul_sunet', 'decizie_preluata']
    expect(cheiDeSters(altele, T0)).toEqual([])
    expect(altele.every((c) => !c.startsWith(PREFIX_SUNET))).toBe(true)
  })

  it('marginea vechimii e o cheie, deci se poate da lui `list` ca `end`', () => {
    expect(limitaVechimii(T0)).toBe(cheiaOrei(T0 - ISTORIC_ZILE * ZI))
    expect(limitaVechimii(T0).startsWith(PREFIX_SUNET)).toBe(true)
  })
})

describe('punctul scris la fiecare telemetrie', () => {
  it('ia nivelul și vârful, rotunjite la o zecimală', () => {
    const p = punctDin(T0, { nivel: -38.246, varf: -21.04, prag: -60, ultimul_peste_prag: null, fereastra_s: 20 })
    expect(p).toEqual({ la: ISO(T0), nivel: -38.2, varf: -21 })
  })

  it('fără nivel măsurat nu e punct — o linie trasă prin „nemăsurat" ar minți', () => {
    expect(punctDin(T0, { nivel: null, varf: -21, prag: -60, ultimul_peste_prag: null, fereastra_s: 20 })).toBeNull()
    expect(punctDin(T0, null)).toBeNull()
  })

  it('vârful lipsă nu strică punctul', () => {
    expect(punctDin(T0, { nivel: -67.5, varf: null, prag: -60, ultimul_peste_prag: null, fereastra_s: 20 })).toEqual({
      la: ISO(T0),
      nivel: -67.5,
      varf: null,
    })
  })

  /*
   * ⚠️ 128 KB e limita unei valori de storage. La 20 s încap fix 180 de puncte într-o oră; dacă un
   * daemon ar bate mai des, cheia ar crește la nesfârșit și ar începe să cadă scrierea telemetriei.
   */
  it('o oră ține cel mult 180 de puncte, și le păstrează pe cele mai noi', () => {
    let puncte: PunctSunet[] = []
    for (let i = 0; i < PUNCTE_PE_ORA + 40; i++) puncte = adaugaPunct(puncte, punct(T0 + i * 1000, -60 - i))
    expect(puncte).toHaveLength(PUNCTE_PE_ORA)
    expect(puncte[puncte.length - 1]!.la).toBe(ISO(T0 + (PUNCTE_PE_ORA + 39) * 1000))
    expect(puncte[0]!.la).toBe(ISO(T0 + 40 * 1000))
  })

  it('pornește de la nimic, fără să ceară cheia dinainte', () => {
    expect(adaugaPunct(undefined, punct(T0, -60))).toHaveLength(1)
  })
})

describe('fereastra cerută de pagină', () => {
  it('trece numai 6, 24 și 168', () => {
    expect(oreCerute('6')).toBe(6)
    expect(oreCerute('24')).toBe(24)
    expect(oreCerute('168')).toBe(168)
  })

  /* Fără lista închisă, „?ore=100000" ar pune obiectul durabil să citească tot ce are. */
  it('orice altceva cade pe cele 24 implicite', () => {
    for (const x of [null, undefined, '', 'o zi', '7', '100000', '-24', '24.5']) expect(oreCerute(x)).toBe(ORE_IMPLICIT)
  })
})

describe('rarefierea pentru ferestrele lungi', () => {
  it('sub prag nu atinge nimic, iar pasul rămâne al telemetriei', () => {
    const p = [punct(T0, -60), punct(T0 + 20000, -58)]
    expect(rareste(p, 100)).toEqual({ pas_s: 20, puncte: p })
  })

  /* ⚠️ MAXIMUL, nu media: pagina e un monitor de prag — o medie ar îneca tocmai vârful. */
  it('strânge câte n puncte într-unul, cu cel mai tare dintre ele', () => {
    const p = [punct(T0, -70, -65), punct(T0 + 20000, -20, -12), punct(T0 + 40000, -68, -60), punct(T0 + 60000, -69, -61)]
    const r = rareste(p, 2)
    expect(r.pas_s).toBe(40)
    expect(r.puncte).toEqual([
      { la: ISO(T0 + 20000), nivel: -20, varf: -12 },
      { la: ISO(T0 + 40000), nivel: -68, varf: -60 },
    ])
  })

  it('cele 7 zile nu trec niciodată peste cât poate desena pagina', () => {
    const p: PunctSunet[] = []
    for (let i = 0; i < 30240; i++) p.push(punct(T0 + i * 20000, -65))
    const r = rareste(p)
    expect(r.puncte.length).toBeLessThanOrEqual(MAX_PUNCTE)
    expect(r.pas_s).toBeGreaterThan(20)
  })

  /*
   * Golurile se păstrează fiindcă se strânge după NUMĂR de puncte, nu după felii de timp: o pană de
   * telemetrie nu naște bucăți goale, ci lasă două puncte vecine depărtate — și așa rupe pagina linia.
   */
  it('o pană de telemetrie rămâne pană, nu se umple', () => {
    const p = [punct(T0, -65), punct(T0 + 20000, -65), punct(T0 + 3 * ORA, -65), punct(T0 + 3 * ORA + 20000, -65)]
    const r = rareste(p, 2)
    const t = r.puncte.map((q) => Date.parse(q.la))
    expect(Math.max(...t.slice(1).map((x, i) => x - t[i]!))).toBeGreaterThan(2 * ORA)
  })
})

/*
 * RUTA `GET /mic/sunet`. Obiectul durabil nu se poate porni în Node, dar tot ce hotărăște ce iese pe
 * rută e aici: marginile citirii (`start`/`end`) și compunerea. Storage-ul e o magazie de jucărie
 * care taie lexicografic, exact ca `list`.
 */
describe('ruta compune graficul din cheile orare', () => {
  const magazie = (chei: Record<string, PunctSunet[]>) => ({
    citite: [] as string[],
    list(o: { start: string; end: string }) {
      const m = new Map<string, PunctSunet[]>()
      for (const k of Object.keys(chei).sort()) {
        if (k >= o.start && k < o.end) {
          this.citite.push(k)
          m.set(k, chei[k]!)
        }
      }
      return m
    },
  })

  /** Același drum ca `istoricSunet` din `aparat.ts`. */
  const ruta = (m: ReturnType<typeof magazie>, acum: number, ore: number, prag: number | null) => {
    const deLa = acum - ore * ORA
    const chei = cheileDin(deLa, acum)
    const bucati = m.list({ start: chei[0] ?? cheiaOrei(deLa), end: dupaOra(acum) })
    return compuneIstoric(bucati.values(), { deLa, panaLa: acum, prag })
  }

  const CHEI = {
    comanda: [] as unknown as PunctSunet[],
    'sunet:2026-09-18T18': [punct(T0 - 2 * ORA, -67)],
    'sunet:2026-09-18T19': [punct(T0 - 90 * 60 * 1000, -69), punct(T0 - ORA, -66), punct(T0 - ORA + 20000, -40, -18)],
    'sunet:2026-09-18T20': [punct(T0, -38, -21)],
    'sunet:2026-09-11T03': [punct(T0 - 7 * ZI, -70)],
  }

  it('citește doar orele din fereastră — nici mai vechi, nici alte chei ale aparatului', () => {
    const m = magazie(CHEI)
    const r = ruta(m, T0, 6, -60)
    expect(m.citite).toEqual(['sunet:2026-09-18T18', 'sunet:2026-09-18T19', 'sunet:2026-09-18T20'])
    expect(m.citite).not.toContain('comanda')
    expect(r.puncte).toHaveLength(5)
  })

  /*
   * ⚠️ O cheie orară se citește ÎNTREAGĂ, dar fereastra cerută taie în mijlocul ei: la o oră cerută
   * la 20:35, ora 19 vine cu tot cu punctele de la 19:05. Fără tăietura asta, graficul ar începe cu
   * până la o oră mai devreme decât scrie pe butonul apăsat.
   */
  it('taie în mijlocul primei ore citite, cu marginea de jos cuprinsă', () => {
    const r = ruta(magazie(CHEI), T0, 1, -60)
    expect(r.puncte.map((p) => p.la)).toEqual([ISO(T0 - ORA), ISO(T0 - ORA + 20000), ISO(T0)])
    expect(r.de_la).toBe(ISO(T0 - ORA))
    expect(r.pana_la).toBe(ISO(T0))
  })

  it('duce pragul aparatului și pasul dintre puncte, pentru linia punctată și pentru goluri', () => {
    const r = ruta(magazie(CHEI), T0, 6, -60)
    expect(r.prag).toBe(-60)
    expect(r.pas_s).toBe(20)
  })

  it('un aparat care nu măsoară dă un grafic gol, nu o eroare', () => {
    const r = ruta(magazie({}), T0, 24, null)
    expect(r).toMatchObject({ prag: null, puncte: [] })
  })

  it('punctele stricate (fără nivel, cu ora de necitit) se aruncă, restul rămâne', () => {
    const stricate = [
      { la: 'ieri', nivel: -40, varf: null },
      { la: ISO(T0), nivel: null, varf: -20 },
      punct(T0, -38, -21),
    ] as unknown as PunctSunet[]
    const r = compuneIstoric([stricate], { deLa: T0 - ORA, panaLa: T0, prag: -60 })
    expect(r.puncte).toEqual([{ la: ISO(T0), nivel: -38, varf: -21 }])
  })
})

/*
 * PAGINA. Scriptul e un text trimis browserului, deci `tsc` nu-l vede — o bucată ștearsă din greșeală
 * ar tăcea fără să pice nimic. Probele de mai jos păzesc ce trebuie să fie pe pagină.
 */
describe('graficul de pe pagina microfonului', () => {
  const corp = corpMic()
  const js = jsMic('')

  it('are locul lui, sub rândul „Sunet", cu cele trei ferestre', () => {
    expect(corp).toContain('id="graf-svg"')
    expect(corp.indexOf('id="c-sunet"')).toBeLessThan(corp.indexOf('id="graf"'))
    for (const o of ['data-ore="6"', 'data-ore="24"', 'data-ore="168"']) expect(corp).toContain(o)
    expect(corp).toContain('7 zile')
  })

  /* Două serii nu se deosebesc niciodată numai prin culoare — legenda e mereu pe pagină. */
  it('are legendă scrisă, nu doar culori', () => {
    expect(corp).toContain('Nivel (RMS)')
    expect(corp).toContain('Vârf')
    expect(corp).toContain('Peste prag')
  })

  it('cere istoricul de la ruta lui, cu fereastra aleasă, și îl reîmprospătează la 60 s', () => {
    expect(js).toContain('"/mic/sunet?ore=" + ore')
    expect(js).toContain('setInterval(citesteGrafic, 60000)')
    expect(js).toContain('localStorage.setItem("mic-ore"')
  })

  it('desenează singur, fără bibliotecă, și pe ceasul Bucureștiului', () => {
    expect(js).toContain('createElementNS')
    expect(js).toContain('"Europe/Bucharest"')
    expect(js).not.toContain('<script')
  })

  it('are linia pragului cu eticheta ei, zonele peste prag și golurile nelegate', () => {
    expect(js).toContain('"prag " + dBg(prag)')
    expect(js).toContain('class: "graf-peste"')
    expect(js).toContain('t - cur[cur.length - 1].t > rupt')
  })

  /*
   * ⚠️ Culorile se iau din variabilele temei, nu se scriu în SVG: altfel desenul ar rămâne de zi pe
   * pagina de noapte. Marcajele poartă culoarea, textele poartă culori de TEXT.
   */
  it('nu scrie culori fixe în desen', () => {
    expect(js).not.toMatch(/#[0-9a-fA-F]{6}/)
    expect(js).not.toContain('fill: "#')
  })
})

/*
 * AȘTEPTAREA LUNGĂ. Proba care ar fi prins cele 2–23 de HTTP 500 pe zi de pe
 * `/intern/aparat/comanda`: toate cădeau la CAPĂTUL celor 25 s, într-o citire de storage pornită
 * dintr-un `setTimeout` parcat — obiectul durabil fusese între timp mutat sau repornit.
 */
describe('așteptarea comenzii nu mai citește nimic la capăt', () => {
  /** Oglinda lui `asteaptaComanda` din `aparat.ts`: o singură citire, la INTRARE. */
  const asteaptaComanda = async (citeste: () => Promise<string>, versiune: string, cine: Set<(c: string) => void>) => {
    const c = await citeste()
    if (c !== versiune) return c
    return asteaptaSchimbarea(c, 25, cine)
  }

  it('la expirare întoarce comanda de la intrare, chiar dacă storage-ul a căzut între timp', async () => {
    vi.useFakeTimers()
    try {
      let citiri = 0
      const citeste = async () => {
        citiri++
        if (citiri > 1) throw new Error('Durable Object reset because its code was updated')
        return 'comanda-7'
      }
      const cine = new Set<(c: string) => void>()
      const p = asteaptaComanda(citeste, 'comanda-7', cine)
      await vi.advanceTimersByTimeAsync(100)
      expect(cine.size).toBe(1)
      await vi.advanceTimersByTimeAsync(25_000)
      await expect(p).resolves.toBe('comanda-7')
      expect(citiri).toBe(1)
      expect(cine.size).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('trezită de o comandă nouă, o întoarce pe ea — și stinge ceasul, ca să nu rămână agățat', async () => {
    vi.useFakeTimers()
    try {
      const cine = new Set<(c: string) => void>()
      const p = asteaptaSchimbarea('comanda-7', 25, cine)
      await vi.advanceTimersByTimeAsync(100)
      for (const t of [...cine]) t('comanda-8')
      await expect(p).resolves.toBe('comanda-8')
      expect(cine.size).toBe(0)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('o versiune schimbată între timp iese pe loc, fără nicio așteptare', async () => {
    const cine = new Set<(c: string) => void>()
    await expect(asteaptaComanda(async () => 'comanda-8', 'comanda-7', cine)).resolves.toBe('comanda-8')
    expect(cine.size).toBe(0)
  })

  it('cât așteptăm: cel mult 30 s, cel puțin o secundă, orice s-ar cere', () => {
    expect(secundeDeAsteptare(25)).toBe(25)
    expect(secundeDeAsteptare(600)).toBe(30)
    expect(secundeDeAsteptare(0)).toBe(1)
    expect(secundeDeAsteptare(-5)).toBe(1)
    expect(secundeDeAsteptare(Number.NaN)).toBe(1)
  })
})
