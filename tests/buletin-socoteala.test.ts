/**
 * SOCOTEALA LUNGIMII pentru foaia tipărită a buletinului.
 *
 * Cifrele din `masuri.ts` sunt măsurate pe numerele apărute (610–615), iar probele astea le țin
 * legate de realitatea aceea: un număr adevărat are între 8 000 și 10 500 de semne cu tot cu
 * antet și calendar, deci socoteala trebuie să se învârtă acolo. Dacă cineva schimbă corpul de
 * literă, lățimea coloanei sau înălțimea rândului „ca să încapă mai mult", probele astea cad —
 * și trebuie să cadă: hârtia n-a crescut.
 */
import { describe, expect, it } from 'vitest'
import {
  CORP_TEXT,
  INALTIMI,
  RANDURI_PE_COLOANA,
  SECUNDARI_MAXIM,
  SEMNE_PE_RAND,
  inaltimeaCalendarului,
  inaltimeaSemnaturii,
  inaltimeaTitlului,
  liniileTitlului,
  randuriPentru,
  semne,
  socoteste,
  variante,
  type ArticolCerut,
  type NumarCerut,
} from '../apps/buletin/src/masuri.js'
import { textCurat } from '../apps/buletin/src/foaie.js'

const text = (n: number): string => 'a'.repeat(n)

const articol = (semneText: number, restul: Partial<ArticolCerut> = {}): ArticolCerut => ({
  autor: 'SFÂNTUL IERARH NICOLAE',
  titlu: 'UN TITLU',
  text: text(semneText),
  sursa: 'ziarullumina.ro',
  poza: true,
  ...restul,
})

const numar = (r: Partial<NumarCerut> = {}): NumarCerut => ({
  motto: 'Un citat scurt, cât să încapă pe două rânduri de cursive în capul paginii întâi.',
  motoAutor: 'Părintele Arsenie Papacioc',
  nr: 616,
  data: '2026-09-20',
  principal: articol(6000),
  calendar: { slujbe: 6, detalii: 5 },
  floare: true,
  ...r,
})

describe('măsurile foii', () => {
  it('ține corpul de literă și rândul la ce s-a măsurat pe arhivă', () => {
    // 15 pt, nu 12: vezi comentariul din `masuri.ts` — greșeala costă un articol întreg.
    expect(CORP_TEXT).toBe(15)
    expect(SEMNE_PE_RAND).toBeGreaterThan(35)
    expect(SEMNE_PE_RAND).toBeLessThan(38)
    expect(RANDURI_PE_COLOANA).toBe(45)
  })

  it('socotește un rând pentru fiecare bucată de text cât un rând', () => {
    expect(randuriPentru(0)).toBe(0)
    expect(randuriPentru(1)).toBe(1)
    expect(randuriPentru(Math.floor(SEMNE_PE_RAND))).toBe(1)
    expect(randuriPentru(Math.ceil(SEMNE_PE_RAND) + 1)).toBe(2)
  })

  it('numără semnele fără spațiile de prisos', () => {
    expect(semne('  două   cuvinte  ')).toBe(len('două cuvinte'))
    expect(semne('rând\n\nalt rând')).toBe(len('rând alt rând'))
  })

  it('calendarul crește cu slujbele și cu detaliile lor', () => {
    const mic = inaltimeaCalendarului({ slujbe: 3, detalii: 1 })
    const mare = inaltimeaCalendarului({ slujbe: 9, detalii: 8 })
    expect(mare).toBeGreaterThan(mic)
    // o săptămână obișnuită (6 slujbe, 5 detalii) stă între 15 și 20 de rânduri — ca pe hârtie
    const obisnuit = inaltimeaCalendarului({ slujbe: 6, detalii: 5 })
    expect(obisnuit).toBeGreaterThan(15)
    expect(obisnuit).toBeLessThan(20)
  })
})

describe('socoteala unui număr', () => {
  it('dă o capacitate de mărimea unui număr adevărat', () => {
    const s = socoteste(numar())
    // numerele 610–615 au 8 970–10 485 de semne cu tot cu antet, titluri și calendar
    expect(s.semneCuTot).toBeGreaterThan(7000)
    expect(s.semneCuTot).toBeLessThan(11000)
  })

  it('se plânge, cu cifre, când textul trece peste măsură', () => {
    const s = socoteste(numar({ principal: articol(30000) }))
    expect(s.incape).toBe(false)
    expect(s.plangeri.join(' ')).toMatch(/peste măsură/)
    expect(s.zone[0]!.ramase).toBeLessThan(0)
  })

  it('nu taie nimic singură — spune doar cât a rămas', () => {
    const s = socoteste(numar({ principal: articol(500) }))
    expect(s.incape).toBe(true)
    expect(s.zone[0]!.ramase).toBeGreaterThan(0)
    expect(s.zone[0]!.scrise).toBe(500)
  })

  it('coloana întâi a paginii întâi nu dă text, nici cu poză, nici fără (regula generală)', () => {
    const cu = socoteste(numar({ principal: articol(100, { poza: true }) }))
    const fara = socoteste(numar({ principal: articol(100, { poza: false }) }))
    expect(fara.semneCuTot).toBe(cu.semneCuTot)
    // pagina întâi dă o singură coloană de text, scurtată de cap și de titlu
    const p1 = RANDURI_PE_COLOANA - INALTIMI.antet - INALTIMI.motto - INALTIMI.numar - INALTIMI.titlu
    const restul = RANDURI_PE_COLOANA * 4 // paginile 2 și 3
    expect(cu.randuriCuTot).toBeLessThan(p1 + restul + RANDURI_PE_COLOANA * 2)
    expect(cu.randuriCuTot).toBeGreaterThan(p1 + restul)
  })

  it('fiecare articol secundar își plătește capul: zona neagră, titlul și sursa', () => {
    const unul = socoteste(numar({ secundari: [articol(1000, { poza: false })] }))
    const doi = socoteste(numar({ secundari: [articol(1000, { poza: false }), articol(1000, { poza: false })] }))
    expect(doi.semneCuTot).toBeLessThan(unul.semneCuTot)
    expect(unul.zone.map((z) => z.cine)).toEqual(['principal', 'secundar 1'])
    expect(doi.zone).toHaveLength(3)
  })

  /**
   * SEMNĂTURA DE SUB TITLU SE PLĂTEȘTE DIN COLOANĂ (user, 19.09.2026). Ea se strecoară între titlu
   * și riglă, deci împinge textul în jos. Nesocotită, foaia ar promite aceleași semne ca înainte și
   * ar da pe dinafară exact cu rândul pe care l-a adăugat omul.
   */
  it('semnătura de sub titlu mănâncă din rândurile de text, la principal și la secundari', () => {
    const semnatura = 'Text de: Părintele Mihail Stanciu, fost stareț al Mănăstirii Antim'
    expect(inaltimeaSemnaturii(undefined)).toBe(0)
    expect(inaltimeaSemnaturii('')).toBe(0)
    // un rând de semnătură costă mai mult de un rând de text: pasul ei e 1.3, plus aerul de sub ea
    expect(inaltimeaSemnaturii('Text de: Ion Popescu')).toBeGreaterThan(1)
    // peste o lățime de coloană trece pe al doilea rând și costă pe măsură
    expect(inaltimeaSemnaturii(semnatura)).toBeGreaterThan(inaltimeaSemnaturii('Text de: Ion Popescu'))

    const fara = socoteste(numar({ principal: articol(500) }))
    const cu = socoteste(numar({ principal: articol(500, { semnatura }) }))
    expect(cu.semneCuTot).toBeLessThan(fara.semneCuTot)

    const faraS = socoteste(numar({ secundari: [articol(800, { poza: false })] }))
    const cuS = socoteste(numar({ secundari: [articol(800, { poza: false, semnatura })] }))
    expect(cuS.semneCuTot).toBeLessThan(faraS.semneCuTot)
  })

  /**
   * BARA CERE UN RÂND, chiar dacă bucățile ar fi încăput pe unul singur (user, 19.09.2026, 18:07).
   * „CHIPUL BLÂND / AL DUHOVNICULUI" intră pe un rând de Trajan 21 pt, dar pe hârtie stă pe două —
   * iar socoteala trebuie să plătească rândul al doilea, altfel promite text care nu mai încape.
   */
  it('numără rândurile cerute cu bara, în titlu și în semnătură', () => {
    expect(liniileTitlului('CHIPUL BLÂND', 21)).toBe(1)
    expect(liniileTitlului('CHIPUL BLÂND / AL DUHOVNICULUI', 21)).toBe(2)
    expect(liniileTitlului('CHIPUL BLÂND/ AL DUHOVNICULUI', 21)).toBe(2)
    expect(liniileTitlului('CHIPUL BLÂND / AL DUHOVNICULUI', 17)).toBe(2)
    // aceeași vorbă fără bară încape pe un rând: bara e cea care cere al doilea
    expect(liniileTitlului('CHIPUL BLÂND AL', 21)).toBe(1)
    expect(liniileTitlului('CHIPUL BLÂND / AL', 21)).toBe(2)
    expect(inaltimeaTitlului('CHIPUL BLÂND / AL', true))
      .toBeGreaterThan(inaltimeaTitlului('CHIPUL BLÂND AL', true))
    expect(inaltimeaSemnaturii('Text de: Ion / Mănăstirea Antim'))
      .toBeGreaterThan(inaltimeaSemnaturii('Text de: Ion Mănăstirea Antim'))
  })

  /** Textul pus în arhivă e pentru CĂUTARE: marcajele l-ar rupe („*răspicat*" ≠ „răspicat"). */
  it('trimite în arhivă textul fără marcaje', () => {
    const curat = textCurat(numar({
      principal: { autor: 'SFÂNTUL IERARH NICOLAE', titlu: '*a* _b_', text: 'a spus *răspicat* și _blând_' },
    }))
    expect(curat).toContain('a b')
    expect(curat).toContain('a spus răspicat și blând')
    expect(curat).not.toContain('*')
  })

  it('refuză mai mult de doi secundari', () => {
    const s = socoteste(numar({ secundari: [articol(10), articol(10), articol(10)] }))
    expect(s.incape).toBe(false)
    expect(s.plangeri.join(' ')).toMatch(new RegExp(`cel mult ${SECUNDARI_MAXIM}`))
  })

  it('un calendar mare strânge textul de pe pagina a patra', () => {
    const scurt = socoteste(numar({ calendar: { slujbe: 3, detalii: 1 } }))
    const lung = socoteste(numar({ calendar: { slujbe: 12, detalii: 14 } }))
    expect(lung.semneCuTot).toBeLessThan(scurt.semneCuTot)
  })

  it('floarea decorativă cade prima când pagina a patra se umple', () => {
    expect(socoteste(numar({ calendar: { slujbe: 3, detalii: 1 } })).floare).toBe(true)
    expect(socoteste(numar({ calendar: { slujbe: 16, detalii: 20 } })).floare).toBe(false)
  })

  it('principalul ia ce rămâne, nu o parte egală', () => {
    const s = socoteste(numar({ secundari: [articol(800, { poza: false })] }))
    const principal = s.zone.find((z) => z.cine === 'principal')!
    const secundar = s.zone.find((z) => z.cine === 'secundar 1')!
    expect(principal.semne).toBeGreaterThan(secundar.semne * 2)
  })
})

describe('variantele, așa cum le vede un model care scrie numărul', () => {
  it('le dă pe toate trei, cu cifre descrescătoare', () => {
    const v = variante({ slujbe: 6, detalii: 5 })
    // ⚠️ nu există „fără poză": coloana întâi a paginii întâi e a pozei (sau a locului ei gol)
    // și a zonei negre, niciodată a textului — regula generală a userului, 17.09.2026
    expect(v.map((x) => x.varianta)).toEqual([
      'un singur autor',
      'autor principal + 1 secundar',
      'autor principal + 2 secundari',
    ])
    for (const x of v) expect(x.semne).toBeGreaterThan(3000)
    expect(v[1]!.semne).toBeLessThan(v[0]!.semne)
    expect(v[2]!.semne).toBeLessThan(v[1]!.semne)
  })

  it('spune, pentru fiecare variantă, cât are fiecare articol', () => {
    const cuDoi = variante({ slujbe: 6, detalii: 5 })[2]!
    expect(cuDoi.zone.map((z) => z.cine)).toEqual(['principal', 'secundar 1', 'secundar 2'])
    for (const z of cuDoi.zone) expect(z.semne).toBeGreaterThan(0)
  })
})

function len(s: string): number {
  return s.length
}
