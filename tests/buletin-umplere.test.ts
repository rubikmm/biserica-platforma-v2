/**
 * UMPLEREA DE PROBĂ a buletinului (user, 17.09.2026, seara): ce n-a scris omul se umple cu text de
 * probă, la vedere, exact cât încape — un secundar o pătrime din tot textul, doi secundari jumătate,
 * la programul întreg. Și motto-ul numărului trecut, citit din textul PDF-ului din arhivă.
 */
import { describe, expect, it } from 'vitest'
import { DE_PROBA, LOREM, LOREM_FATA_DE_ROMANA, TEXT_IMPLICIT, eArticolGol, eDeProba, loremDe, umpleCuProba } from '../apps/buletin/src/umplere.js'
import { type ArticolCerut, type NumarCerut, SEMNE_PE_RAND, semne, socoteste } from '../apps/buletin/src/masuri.js'
import { mottoDinText } from '../apps/buletin/src/depozit.js'

const gol = (): ArticolCerut => ({ autor: '', titlu: '', text: '' })
const scris = (text: string, restul: Partial<ArticolCerut> = {}): ArticolCerut => ({
  autor: 'SFÂNTA CUVIOASĂ PARASCHEVA', titlu: 'UN TITLU', text, sursa: 'doxologia.ro', poza: true, ...restul,
})
const CALENDAR = { slujbe: 6, detalii: 5 }
const numar = (r: Partial<NumarCerut> = {}): NumarCerut => ({
  motto: 'Un citat', nr: 616, data: '2026-09-20', principal: gol(), floare: true, ...r,
})

describe('lorem ipsum, la măsură', () => {
  it('nu trece niciodată peste măsură, se taie la cuvânt și se încheie cu punct', () => {
    for (const cat of [1, 5, 40, 137, 500, 2106, 9028]) {
      const t = loremDe(cat)
      expect(semne(t)).toBeLessThanOrEqual(cat)
      if (cat >= 12) {
        expect(semne(t)).toBeGreaterThan(cat - 40)
        expect(t).toMatch(/[.!?]$/)
        expect(t).not.toMatch(/\s$/)
      }
    }
    expect(loremDe(0)).toBe('')
    expect(loremDe(-5)).toBe('')
  })

  it('e lorem ipsum adevărat, pe paragrafe, ca să curgă ca un text', () => {
    const t = loremDe(3000)
    expect(t.startsWith('Lorem ipsum dolor sit amet')).toBe(true)
    expect(t).toContain('\n\n')
    expect(LOREM.length).toBeGreaterThan(400)
  })
})

describe('umplerea unui număr gol', () => {
  it('pune de probă tot ce lipsește: autorul cu anii lui, titlul, sursa și textul', () => {
    const { cerut, deProba } = umpleCuProba(numar(), CALENDAR)
    expect(cerut.principal.autor).toBe(DE_PROBA.autor)
    expect(cerut.principal.ani).toBe(DE_PROBA.ani)
    expect(cerut.principal.titlu).toBe(DE_PROBA.titlu)
    expect(cerut.principal.sursa).toBe(DE_PROBA.sursa)
    expect(cerut.principal.text.startsWith('Lorem ipsum')).toBe(true)
    expect(deProba.join(' ')).toMatch(/autorul/)
    expect(deProba.join(' ')).toMatch(/textul \(\d+ de semne\)/)
  })

  it('textul de probă intră fix: cât spune socoteala, mai puțin lățimea în plus a lorem-ului', () => {
    const { cerut, socoteala } = umpleCuProba(numar(), CALENDAR)
    expect(socoteala.incape).toBe(true)
    const p = socoteala.zone.find((z) => z.cine === 'principal')!
    expect(p.ramase).toBeGreaterThanOrEqual(0)
    // la măsura socotelii cu programul ÎNTREG, nu cu vreunul strâns — ori 0,975 din ea (lorem-ul e
    // mai lat decât româna, probat pe randare), fără să lipsească mai mult de un rând
    const goala = socoteste({ ...numar(), principal: { ...cerut.principal, text: '' }, calendar: CALENDAR })
    const tinta = Math.floor(goala.zone[0]!.semne * LOREM_FATA_DE_ROMANA)
    expect(semne(cerut.principal.text)).toBeLessThanOrEqual(tinta)
    expect(semne(cerut.principal.text)).toBeGreaterThan(tinta - SEMNE_PE_RAND)
  })

  it('nu atinge ce a scris omul — umple numai câmpurile goale', () => {
    const { cerut, deProba } = umpleCuProba(numar({ principal: scris('Un text scurt.', { ani: undefined }) }), CALENDAR)
    expect(cerut.principal.text).toBe('Un text scurt.')
    expect(cerut.principal.autor).toBe('SFÂNTA CUVIOASĂ PARASCHEVA')
    expect(cerut.principal.sursa).toBe('doxologia.ro')
    // un autor adevărat fără ani NU primește „1999-1999"
    expect(cerut.principal.ani).toBeUndefined()
    expect(deProba).toEqual([])
  })

  it('anii de probă vin numai cu autorul de probă', () => {
    const { cerut } = umpleCuProba(numar({ principal: { autor: '', titlu: 'TITLU', text: 'text' } }), CALENDAR)
    expect(cerut.principal.autor).toBe(DE_PROBA.autor)
    expect(cerut.principal.ani).toBe(DE_PROBA.ani)
  })
})

describe('împărțeala cu secundari de probă (regula userului: 1/4, 1/4 + 1/4 = 1/2)', () => {
  it('un secundar gol ia o pătrime din tot textul, principalul restul', () => {
    const { cerut, socoteala } = umpleCuProba(numar({ secundari: [gol()] }), CALENDAR)
    expect(socoteala.incape).toBe(true)
    const tot = semne(cerut.principal.text) + semne(cerut.secundari![0]!.text)
    const parte = semne(cerut.secundari![0]!.text) / tot
    expect(parte).toBeGreaterThan(0.22)
    expect(parte).toBeLessThan(0.28)
    expect(cerut.secundari![0]!.autor).toBe(DE_PROBA.autor)
    expect(cerut.secundari![0]!.titlu).toBe(DE_PROBA.titlu)
    expect(cerut.secundari![0]!.sursa).toBe(DE_PROBA.sursa)
  })

  it('doi secundari goi iau împreună jumătate', () => {
    const { cerut, socoteala } = umpleCuProba(numar({ secundari: [gol(), gol()] }), CALENDAR)
    expect(socoteala.incape).toBe(true)
    const s1 = semne(cerut.secundari![0]!.text)
    const s2 = semne(cerut.secundari![1]!.text)
    const tot = semne(cerut.principal.text) + s1 + s2
    expect((s1 + s2) / tot).toBeGreaterThan(0.46)
    expect((s1 + s2) / tot).toBeLessThan(0.54)
    // cei doi sunt la fel de mari (fiecare o pătrime)
    expect(Math.abs(s1 - s2)).toBeLessThan(SEMNE_PE_RAND * 2)
  })

  it('un secundar scris mai lung decât pătrimea își ține lungimea; principalul de probă ia ce rămâne', () => {
    const lung = 'a'.repeat(3000)
    const { cerut, socoteala } = umpleCuProba(numar({ secundari: [scris(lung, { poza: false })] }), CALENDAR)
    expect(cerut.secundari![0]!.text).toBe(lung)
    expect(socoteala.incape).toBe(true)
    expect(semne(cerut.principal.text)).toBeGreaterThan(1000)
  })
})

describe('articolul gol', () => {
  it('e gol când n-are nici autor, nici titlu, nici text', () => {
    expect(eArticolGol(gol())).toBe(true)
    expect(eArticolGol({ autor: '', titlu: '', text: '  ' })).toBe(true)
    expect(eArticolGol({ autor: '', titlu: 'X', text: '' })).toBe(false)
    expect(eArticolGol(undefined)).toBe(true)
  })
})

describe('motto-ul numărului trecut, din textul PDF-ului', () => {
  // capul textului lui 615, exact cum stă în baza arhivei (cu sedilele Word-ului)
  const TEXT_615 =
    'BULETINUL PAROHIEI SFÂNTUL ILIE - HANUL COL Ț EI „Maica Domnului ne iubeşte mult. Ea vede în noi preţul ' +
    'morţii lui Iisus Hristos. Maica Domnului ne doreşte lucruri mai mari decât ne dorim noi înşine.” – Părintele ' +
    'Arsenie Papacioc Nr. 615 / 6 septembrie 2026 RUGĂTOARE ISIHASTE SFINTEL E NAZARIA, OLIMPIADA Ș I ELISABETA'

  it('găsește citatul și pe cel citat, cu diacriticele aduse la virgulă', () => {
    const m = mottoDinText(TEXT_615)!
    expect(m.motto).toBe('„Maica Domnului ne iubește mult. Ea vede în noi prețul morții lui Iisus Hristos. Maica Domnului ne dorește lucruri mai mari decât ne dorim noi înșine.”')
    expect(m.motoAutor).toBe('Părintele Arsenie Papacioc')
  })

  it('merge și fără cel citat, și tace când forma nu se potrivește', () => {
    expect(mottoDinText('SFÂNTUL ILIE „Un citat fără autor, dar destul de lung.” Nr. 600 / 1 ianuarie 2025')).toEqual({
      motto: '„Un citat fără autor, dar destul de lung.”',
      motoAutor: undefined,
    })
    expect(mottoDinText('un text fără ghilimele Nr. 3')).toBeNull()
    expect(mottoDinText(null)).toBeNull()
    expect(mottoDinText('')).toBeNull()
  })
})

/**
 * LOCUL TEXTULUI, „text" (user, 19.09.2026). Schița implicită pornește cu el în câmp, ca omul să
 * vadă de unde se pleacă — dar la compunere el NU e un text de patru semne: e un câmp nescris.
 *
 * ⚠️ De asta stă aici, nu doar în probele schiței: dacă regula s-ar pierde tocmai în `umplere.ts`,
 * numărul zero ar ieși pe hârtie cu un singur cuvânt pe pagina întâi și cu trei sferturi de coloană
 * albe — și nimic n-ar da vreo eroare.
 */
describe('locurile schiței implicite se umplu ca niște câmpuri goale', () => {
  const cuLocuri = (): ArticolCerut => ({
    autor: DE_PROBA.autor, ani: DE_PROBA.ani, titlu: DE_PROBA.titlu, sursa: DE_PROBA.sursa, text: TEXT_IMPLICIT,
  })

  it('„text" e un articol gol, oricum ar fi scris', () => {
    expect(eArticolGol(cuLocuri())).toBe(true)
    expect(eArticolGol({ ...gol(), text: '  Text  ' })).toBe(true)
    expect(eArticolGol({ ...gol(), text: 'Un articol adevărat despre rugăciune.' })).toBe(false)
  })

  it('un număr numai cu locuri se umple la fel ca unul gol de tot', () => {
    const cuProba = umpleCuProba(numar({ principal: cuLocuri() }), CALENDAR)
    const golDeTot = umpleCuProba(numar({ principal: gol() }), CALENDAR)
    expect(cuProba.cerut.principal.text.startsWith('Lorem ipsum')).toBe(true)
    expect(semne(cuProba.cerut.principal.text)).toBe(semne(golDeTot.cerut.principal.text))
    expect(cuProba.cerut.principal.autor).toBe(DE_PROBA.autor)
    expect(cuProba.cerut.principal.titlu).toBe(DE_PROBA.titlu)
    expect(cuProba.cerut.principal.sursa).toBe(DE_PROBA.sursa)
    // și se SPUNE că e probă, ca `atentie` să nu tacă despre un număr întreg de lorem
    expect(cuProba.deProba.join('; ')).toContain('principal: textul')
  })

  it('un text adevărat nu se atinge, oricât de scurt', () => {
    const scurt = 'Trei cuvinte aici.'
    const { cerut, deProba } = umpleCuProba(numar({ principal: { ...gol(), text: scurt } }), CALENDAR)
    expect(cerut.principal.text).toBe(scurt)
    expect(deProba.join('; ')).not.toContain('principal: textul')
  })

  it('`eDeProba` nu confundă un răspuns adevărat cu un loc', () => {
    expect(eDeProba(undefined)).toBe(true)
    expect(eDeProba('   ')).toBe(true)
    expect(eDeProba(DE_PROBA.autor)).toBe(true)
    expect(eDeProba(TEXT_IMPLICIT)).toBe(true)
    expect(eDeProba('SFÂNTUL IOAN GURĂ DE AUR')).toBe(false)
    expect(eDeProba('347-407')).toBe(false)
    expect(eDeProba('ziarullumina.ro')).toBe(false)
    // ⚠️ „textul" nu e „text": potrivirea e pe cuvântul întreg, nu pe început
    expect(eDeProba('textul articolului')).toBe(false)
  })
})
