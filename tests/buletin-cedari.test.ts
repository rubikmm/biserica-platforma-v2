/**
 * CE CEDEAZĂ FOAIA CÂND TEXTUL NU ÎNCAPE — și în ce ordine (user, 19.09.2026, 16:31: „Ar trebui să
 * dispară floricica și dacă nici așa nu intră să dispară sfinții din calendar").
 *
 * ⚠️ PROBA DEFECTULUI (nr. 616, 19.09.2026): treptele se încercau DOAR din socoteală. Când
 * socoteala zicea „încape" iar randarea găsea 64 de semne pe dinafară, numărul era refuzat pe loc —
 * cu floarea și cu sfinții duminicii încă pe pagina a patra, adică fără să se fi cedat nimic din ce
 * ceruse omul să cedeze. Aici se probează drumul celălalt: deficitul randării intră în aceeași
 * scară a cedărilor.
 *
 * ⚠️ ȘI CÂT COSTĂ, nu doar dacă merge: o randare ține vreun minut prin Browser Rendering, iar
 * `POST /nou/compune` și „Da"-ul din bulă nu stau patru minute. De aceea treapta se alege din
 * ARITMETICĂ (cât eliberează fiecare, în semne) și se randează CEL MULT DE DOUĂ ORI — proba
 * numără randările la fiecare caz.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Hârtia jucată: fiecare randare își spune HTML-ul, iar deficitul iese din ce s-a cedat în el. */
const randari: string[] = []
/** Câte semne dă pe dinafară foaia ÎNTREAGĂ (cu floare, program întreg) — se pune la fiecare probă. */
let deficitulFoiiIntregi = 0

/**
 * Cât eliberează fiecare cedare pe hârtia jucată — chiar cifrele geometriei din `masuri.ts`:
 * floarea 2.9 rânduri × 2 coloane ≈ 212 semne; `strans=1` scoate 4 detalii (3.12 rânduri × 2) ≈
 * încă 230; `strans=2` încă 3 detalii. Cumulat: 212 / 442 / 613.
 */
const ELIBERAT = { floare: 212, strans: [0, 230, 401] }

/*
 * ⚠️ Se joacă pe CALEA FIȘIERULUI, nu pe „@xc/ui": numele pachetului nu se poate rezolva din
 * `tests/` (legătura pnpm stă în `apps/buletin/node_modules`), iar un `vi.mock` care nu se rezolvă
 * nu se aplică și nici nu se plânge — proba ar chema browserul adevărat.
 */
vi.mock('../packages/ui/src/index.js', async (adevarat) => ({
  ...(await adevarat<typeof import('../packages/ui/src/index.js')>()),
  pdfCuRaportSiCoperta: async (_browser: unknown, html: string) => {
    randari.push(html)
    const cuFloare = html.includes('class="floare"')
    const strans = Number(/data-strans="(\d)"/.exec(html)?.[1] ?? 0)
    const eliberat = (cuFloare ? 0 : ELIBERAT.floare) + ELIBERAT.strans[strans]!
    const peDinafara = Math.max(0, deficitulFoiiIntregi - eliberat)
    return {
      pdf: new ArrayBuffer(8),
      coperta: new ArrayBuffer(4),
      raport: { intrate: 8000 - peDinafara, peDinafara, coloaneFolosite: 7 },
    }
  },
}))

const { CEDARILE, cedareaDeIncercat, compune, vorbaCedarii } = await import('../apps/buletin/src/compune.js')
const { INALTIMI, SEMNE_PE_RAND, inaltimeaTitlului, liniileTitlului, socoteste } = await import('../apps/buletin/src/masuri.js')
type NumarCerut = import('../apps/buletin/src/masuri.js').NumarCerut

/** Săptămâna jucată: cu cât se strânge tabelul, cu atât are mai puține detalii de spus. */
const SAPTAMANA: Record<number, { slujbe: number; detalii: number }> = {
  0: { slujbe: 7, detalii: 9 },
  1: { slujbe: 7, detalii: 5 },
  2: { slujbe: 7, detalii: 2 },
}

let cereriDeProgram: number[] = []
/** Treptele pe care programul refuză să le dea — pentru proba de mai jos. */
let trepteMute: number[] = []

const ENV = {
  BROWSER: {},
  FISIERE: {},
  PROGRAM: {
    fetch: async (adresa: string) => {
      const strans = Number(new URL(adresa).searchParams.get('strans') ?? 0)
      cereriDeProgram.push(strans)
      if (trepteMute.includes(strans)) {
        return new Response(JSON.stringify({ cod: 'program_indisponibil', mesaj: 'nu dau varianta asta' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(
        JSON.stringify({
          // marcajul `data-strans` e al probei: din el își dă seama hârtia jucată ce program a primit
          tabel: `<table class="program" data-strans="${strans}"></table>`,
          stil: '',
          titlu: '20 – 26 septembrie 2026',
          de_la: '2026-09-21',
          pana_la: '2026-09-27',
          strans,
          stare: 'validat',
          amprenta: 'abc123',
          modificat_la: '2026-09-19T10:00:00Z',
          ...SAPTAMANA[strans],
        }),
        { headers: { 'content-type': 'application/json' } },
      )
    },
  },
} as never

const CERUT: NumarCerut = {
  motto: 'Maica Domnului ne iubește mult.',
  motoAutor: 'Părintele Arsenie Papacioc',
  nr: 616,
  data: '2026-09-20',
  floare: true,
  principal: {
    autor: 'SFÂNTUL SOFIAN',
    titlu: 'UN TITLU',
    text: 'Cuvânt pe scurt. '.repeat(300),
    sursa: 'ziarullumina.ro',
  },
}

const compuneCu = async (peDinafara: number) => {
  deficitulFoiiIntregi = peDinafara
  return await compune(ENV, { cerut: CERUT })
}

beforeEach(() => {
  randari.length = 0
  cereriDeProgram = []
  trepteMute = []
})

describe('foaia întreagă, când textul încape', () => {
  it('randează o singură dată, cu floare, și nu cedează nimic', async () => {
    const r = await compuneCu(0)
    expect(r.ok).toBe(true)
    expect(r.cedat).toBeNull()
    expect(r.randari).toBe(1)
    expect(randari).toHaveLength(1)
    expect(randari[0]).toContain('class="floare"')
    expect(r.calendar?.strans).toBe(0)
    expect(r.atentie.join(' ')).not.toContain('s-a strâns')
  })
})

describe('prima cedare: floarea', () => {
  /** Chiar cazul nr. 616: socoteala zicea „încape", hârtia a lăsat 64 de semne pe dinafară. */
  it('la 64 de semne pe dinafară scoate floarea, și atât — programul rămâne întreg', async () => {
    const r = await compuneCu(64)
    expect(r.ok).toBe(true)
    expect(r.randari).toBe(2)
    expect(randari[0]).toContain('class="floare"')
    expect(randari[1]).not.toContain('class="floare"')
    expect(r.calendar?.strans).toBe(0)
    expect(r.cedat).toBe('fără floare')
    expect(r.raport?.peDinafara).toBe(0)
  })

  it('spune la vedere ce s-a cedat, în `atentie`', async () => {
    const r = await compuneCu(64)
    expect(r.atentie.join(' ')).toContain('fără floare')
    expect(r.atentie.join(' ')).toContain('ca să încapă textul')
  })
})

describe('a doua cedare: sfinții duminicii', () => {
  it('la un deficit pe care floarea singură nu-l acoperă, cere și `strans=1`', async () => {
    const r = await compuneCu(300)
    expect(r.ok).toBe(true)
    expect(r.randari).toBe(2)
    expect(r.calendar?.strans).toBe(1)
    expect(randari[1]).not.toContain('class="floare"')
    expect(randari[1]).toContain('data-strans="1"')
    expect(r.cedat).toBe('fără floare, calendar fără sfinții duminicii')
  })

  /**
   * ⚠️ Nu se sare la treapta cea mai largă „ca să fie sigur": pericopa e „în extremis", iar o foaie
   * strânsă mai mult decât trebuie e tot o pierdere, doar că tăcută.
   */
  it('nu strânge mai mult decât cere deficitul', async () => {
    const r = await compuneCu(300)
    expect(r.calendar?.strans).not.toBe(2)
    expect(r.cedat).not.toContain('pericopă')
  })
})

describe('a treia cedare și refuzul', () => {
  it('la un deficit pe care nimic nu-l acoperă cedează tot, apoi refuză cu cifra NOUĂ', async () => {
    const r = await compuneCu(700)
    expect(r.randari).toBe(2)
    expect(r.ok).toBe(false)
    expect(r.calendar?.strans).toBe(2)
    expect(r.cedat).toContain('și fără pericopă')
    // 700 − 613 eliberate = 87: cifra cu care se refuză e cea de DUPĂ strângere, nu cea dinainte
    expect(r.raport?.peDinafara).toBe(87)
    expect(r.plangeri.join(' ')).toContain('87 de semne')
    expect(r.plangeri.join(' ')).toContain('foaia s-a strâns deja')
  })

  it('nu randează niciodată de mai mult de două ori', async () => {
    for (const deficit of [0, 64, 300, 700, 5000]) {
      randari.length = 0
      await compuneCu(deficit)
      expect(randari.length).toBeLessThanOrEqual(2)
    }
  })
})

/**
 * ⚠️ PROBA CAPCANEI: o treaptă al cărei tabel nu vine NU e spațiu liber. Socotită cu `calendar:
 * undefined`, ea pare că a eliberat o pagină întreagă — socoteala ar tăcea, iar foaia ar ieși cu
 * pagina a patra fără NICIUN program, adică fără lucrul pentru care se tipărește numărul.
 */
describe('o treaptă pe care programul n-o dă', () => {
  it('nu trece drept pagină liberă: se cedează doar cât se poate, și se refuză cu cifra rămasă', async () => {
    trepteMute = [1, 2]
    const r = await compuneCu(300)
    expect(r.randari).toBe(2)
    expect(r.cedat).toBe('fără floare')
    expect(r.calendar?.strans).toBe(0)
    // programul ÎNTREG rămâne pe pagina a patra, nu dispare
    expect(randari[1]).toContain('class="program"')
    expect(r.ok).toBe(false)
    expect(r.raport?.peDinafara).toBe(300 - 212)
  })

  it('nici socoteala nu se lasă păcălită: numărul care încape se compune cu programul întreg', async () => {
    trepteMute = [1, 2]
    const r = await compuneCu(0)
    expect(r.ok).toBe(true)
    expect(r.calendar?.strans).toBe(0)
    expect(randari[0]).toContain('class="program"')
  })

  /**
   * Aceeași capcană, dar pe drumul socotelii: un text de 9 500 de semne nu încape nici întreg
   * (8 498), nici fără floare (8 710) — iar treapta următoare nu vine. Socotită fără tabel, ea ar
   * da 10 337 de semne, adică socoteala ar zice „încape" și s-ar randa o foaie fără program.
   */
  it('nu socotește o treaptă lipsă ca și cum pagina a patra ar fi goală', async () => {
    trepteMute = [1, 2]
    deficitulFoiiIntregi = 0
    const r = await compune(ENV, {
      cerut: { ...CERUT, principal: { ...CERUT.principal, text: 'cuvânt '.repeat(1358) } },
    })
    expect(r.ok).toBe(false)
    expect(r.randari).toBe(0)
    expect(randari).toHaveLength(0)
    expect(r.plangeri.join(' ')).toContain('peste măsură')
    expect(r.cedat).toBe('fără floare')
  })
})

describe('aritmetica treptelor, singură', () => {
  /** Cât eliberează fiecare cedare, în semne — cifrele socotelii pentru săptămâna jucată. */
  const elibereaza = [0, 212, 442, 613]

  it('ia treapta cea mai mică ce acoperă deficitul, cu rezerva de un rând', () => {
    expect(cedareaDeIncercat({ dela: 0, peDinafara: 64, elibereaza })).toBe(1)
    expect(cedareaDeIncercat({ dela: 0, peDinafara: 300, elibereaza })).toBe(2)
    expect(cedareaDeIncercat({ dela: 0, peDinafara: 500, elibereaza })).toBe(3)
  })

  it('rezerva chiar contează: un deficit fix cât eliberează treapta cere treapta următoare', () => {
    expect(cedareaDeIncercat({ dela: 0, peDinafara: 212, elibereaza })).toBe(2)
    expect(cedareaDeIncercat({ dela: 0, peDinafara: 212 - Math.ceil(SEMNE_PE_RAND), elibereaza })).toBe(1)
  })

  it('când nicio treaptă nu acoperă, o ia pe cea mai largă — cedarea se face ÎNAINTE de refuz', () => {
    expect(cedareaDeIncercat({ dela: 0, peDinafara: 9000, elibereaza })).toBe(3)
  })

  it('pornește de la treapta pe care a cerut-o deja socoteala', () => {
    expect(cedareaDeIncercat({ dela: 2, peDinafara: 100, elibereaza })).toBe(3)
    expect(cedareaDeIncercat({ dela: 3, peDinafara: 100, elibereaza })).toBeNull()
  })

  it('sare peste o treaptă care nu eliberează nimic (programul nu i-a dat varianta)', () => {
    expect(cedareaDeIncercat({ dela: 0, peDinafara: 300, elibereaza: [0, 212, 0, 613] })).toBe(3)
  })

  it('spune ce s-a cedat, în cuvintele omului', () => {
    expect(vorbaCedarii(CEDARILE[0]!)).toBeNull()
    expect(vorbaCedarii(CEDARILE[1]!)).toBe('fără floare')
    expect(vorbaCedarii(CEDARILE[2]!)).toContain('calendar fără sfinții duminicii')
    expect(vorbaCedarii(CEDARILE[3]!)).toContain('și fără pericopă')
  })

  it('ordinea cedărilor e cea cerută: floarea întâi, pericopa la urmă', () => {
    expect(CEDARILE.map((c) => [c.floare, c.strans])).toEqual([
      [true, 0], [false, 0], [false, 1], [false, 2],
    ])
  })
})

// ---------------------------------------------------------------------------
// De ce mințea socoteala: titlul
// ---------------------------------------------------------------------------

/**
 * ⚠️ Titlul NU se măsoară ca textul curent. Textul e Caladea 15 pt justificat, cu 36.67 de semne pe
 * rând măsurate pe arhivă; titlul e Trajan, majuscule, 21 pt la principal — iar majusculele
 * inscripționale sunt foarte neegale („I" 0.44 em, „W" 1.10). De aceea lățimile vin din fontul din
 * repo, nu dintr-o medie.
 */
describe('înălțimea titlului, din lățimile adevărate ale Trajanului', () => {
  it('numără rândurile titlului cum le rupe pagina, pe cuvinte', () => {
    expect(liniileTitlului('NICIUNUL', 21)).toBe(1)
    // 28 de semne la 21 pt = 412 pt de literă într-o coloană de 241.1 — chiar titlul nr. 616
    expect(liniileTitlului('CHIPUL BLÂND AL DUHOVNICULUI', 21)).toBe(2)
    expect(liniileTitlului('CHIPUL BLÂND AL DUHOVNICULUI', 17)).toBe(2)
  })

  it('un titlu de două rânduri costă mai mult decât cei 4.4 din arhivă — cam 40 de semne', () => {
    const scurt = inaltimeaTitlului('NICIUNUL', true)
    const lung = inaltimeaTitlului('CHIPUL BLÂND AL DUHOVNICULUI', true)
    expect(scurt).toBe(INALTIMI.titlu)
    expect(lung).toBeGreaterThan(scurt)
    const semnePierdute = (lung - scurt) * SEMNE_PE_RAND
    expect(semnePierdute).toBeGreaterThan(30)
    expect(semnePierdute).toBeLessThan(60)
  })

  /**
   * ⚠️ Cifra nouă are voie să CREASCĂ măsura titlului, nu să o micșoreze: geometria zice 3.9
   * rânduri la un titlu de un rând, iar 4.4 e ce s-a măsurat pe arhivă. Coborând la „exact",
   * socoteala ar promite câteva sute de semne pe care hârtia nu le dă — fix greșeala pe care o
   * reparăm, doar în celălalt sens.
   */
  it('nu coboară niciodată sub măsura de pe arhivă', () => {
    for (const t of ['', 'X', 'UN TITLU', 'TITLU ARTICOL', 'SMERENIA']) {
      expect(inaltimeaTitlului(t, true)).toBeGreaterThanOrEqual(INALTIMI.titlu)
      expect(inaltimeaTitlului(t, false)).toBeGreaterThanOrEqual(INALTIMI.titlu)
    }
  })

  it('socoteala dă mai puține semne când titlul principalului trece pe al doilea rând', () => {
    const cu = (titlu: string) =>
      socoteste({ ...CERUT, principal: { ...CERUT.principal, titlu }, calendar: SAPTAMANA[0] })
    expect(cu('CHIPUL BLÂND AL DUHOVNICULUI').semneCuTot).toBeLessThan(cu('NICIUNUL').semneCuTot)
  })
})
