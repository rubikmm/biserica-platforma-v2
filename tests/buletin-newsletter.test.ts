import { describe, expect, it } from 'vitest'
import { plat } from '../apps/buletin/src/depozit.js'
import { anul, luna, scurtat } from '../apps/newsletter/src/pagini.js'

/**
 * BULETINUL (A3) si NEWSLETTERUL (A8), portate din V1 pe 13.09.2026.
 *
 * Se probeaza partile care pot da rezultate gresite fara sa se vada nimic pe ecran: potrivirea
 * cautarii in buletine (unde o singura litera in plus muta fragmentul aratat) si citirea datei
 * si a subiectului unui numar de newsletter.
 */

describe('buletin · potrivirea cautarii (`plat`)', () => {
  it('scoate diacriticele si coboara literele, ca „craciun" sa gaseasca „Crăciun"', () => {
    expect(plat('Crăciun')).toBe('craciun')
    expect(plat('ÎNVIEREA')).toBe('invierea')
    expect(plat('Sfântul Ilie')).toBe('sfantul ilie')
  })

  it('⚠️ PASTREAZA LUNGIMEA, litera cu litera', () => {
    // Pe asta sta cautarea: pozitia gasita in `text_plat` se foloseste ca sa se taie fragmentul
    // din `text`, cu diacriticele lui. Daca o litera s-ar preface in doua (sau in niciuna),
    // fragmentul aratat ar incepe cu cateva semne mai incolo decat cuvantul gasit.
    for (const s of ['Crăciun', 'Adormirea Maicii Domnului', 'ȘTIRI · „citate" – liniuțe', 'Sfântul Ștefan']) {
      expect(plat(s)).toHaveLength(s.length)
    }
  })

  it('aduce ghilimelele si liniutele tipografice la forma simpla, tot pe o litera', () => {
    expect(plat('„da"')).toBe('"da"')
    expect(plat('a–b')).toBe('a-b')
    expect(plat('n’are')).toBe("n'are")
  })

  it('lasa cifrele si semnele in pace', () => {
    expect(plat('Nr. 615 / 2026-09-06')).toBe('nr. 615 / 2026-09-06')
  })
})

describe('newsletter · fisa unui numar', () => {
  const fisa = (trimis: string, subiect = 'x') => ({ id: 1, nr: null, subiect, trimis, rezumat: '' })

  it('anul si luna se citesc din data trimiterii, nu din ceas', () => {
    expect(anul(fisa('2024-10-23 14:00:00'))).toBe(2024)
    expect(luna(fisa('2024-10-23 14:00:00'))).toBe(10)
    // luna e 1..12, nu 0..11 ca in Date
    expect(luna(fisa('2017-01-08 19:30:00'))).toBe(1)
  })

  it('numele intreg al foii cade din subiect, in liste', () => {
    expect(scurtat('Buletinul Parohiei nr. 505')).toBe('Nr. 505')
    expect(scurtat('Buletinul Parohiei (online) vestiri de Crăciun')).toBe('Vestiri de Crăciun')
  })

  it('un subiect care nu incepe cu numele foii ramane neatins', () => {
    expect(scurtat('Schimbare de program')).toBe('Schimbare de program')
  })

  it('daca din subiect n-ar mai ramane nimic, se tine cel intreg', () => {
    expect(scurtat('Buletinul Parohiei')).toBe('Buletinul Parohiei')
  })
})
