import { describe, expect, it } from 'vitest'
import { prefixSiCale } from '../packages/config/src/index.js'
import { plat } from '../apps/buletin/src/depozit.js'
import {
  type Ctx,
  anul,
  luna,
  paginaCautare,
  paginaGoala,
  paginaNou,
  paginaNumar,
  scurtat,
} from '../apps/newsletter/src/pagini.js'

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

/**
 * ⚠️ Capcana care a scos paginile numerelor din functiune pe staging (reclamata de user,
 * 13.09.2026, seara): buletinul e singura aplicatie cu o ruta proprie care poarta chiar numele ei,
 * `/buletin/<nr>-<data>` (adresa din V1). Pe subdomeniu, `prefixSiCale` lua acel `/buletin` drept
 * prefixul gateway-ului de preview, taia calea si nu se mai potrivea nicio ruta.
 * De aceea montajul se ia din MEDIU: `/buletin` numai in dev, gol in rest.
 */
describe('buletin · adresa unui numar nu se taie singura', () => {
  it('pe subdomeniu (montaj gol) calea ramane intreaga', () => {
    const u = new URL('https://buletin.staging.sfantul-ilie.ro/buletin/615-2026-09-06')
    expect(prefixSiCale(u, '')).toEqual({ prefix: '', cale: '/buletin/615-2026-09-06' })
  })

  it('prin gateway (dev) se taie DOAR prefixul de montaj, o singura data', () => {
    const u = new URL('https://rubik:8474/buletin/buletin/615-2026-09-06')
    expect(prefixSiCale(u, '/buletin')).toEqual({ prefix: '/buletin', cale: '/buletin/615-2026-09-06' })
  })

  it('radacina aplicatiei ramane „/" in amandoua', () => {
    expect(prefixSiCale(new URL('https://buletin.staging.sfantul-ilie.ro/'), '').cale).toBe('/')
    expect(prefixSiCale(new URL('https://rubik:8474/buletin'), '/buletin').cale).toBe('/')
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

/*
 * MENIUL NEWSLETTERULUI, refacut la 15.09.2026 dupa chipul Calendarului si al Programului. Probele
 * de aici pazesc tocmai ce s-a cerut in cuvinte, fiindca nimic din toate astea nu se vede din `tsc`:
 * ordinea segmentelor din pastila, scrisul „Nr. curent", sageata care e o FAPTA (nu o navigare) si
 * numai a adminilor, si abonarea, care de azi e a newsletterului.
 */
describe('newsletter · meniul din antet', () => {
  const fisa = (id: number, trimis: string, subiect = `Buletinul Parohiei nr. ${id}`) =>
    ({ id, nr: id, subiect, trimis, rezumat: '' })
  // cel mai vechi primul, cel mai nou ultimul — ordinea din `lista.json`
  const lista = [fisa(1, '2026-09-01 10:00:00'), fisa(2, '2026-09-08 10:00:00'), fisa(3, '2026-09-13 10:00:00')]
  const ctx = (eAdmin: boolean): Ctx => ({
    prefix: '/newsletter',
    nav: { home: 'https://website.sfantul-ilie.ro', cont: '/cont', admin: '/admin' } as Ctx['nav'],
    utilizator: eAdmin ? 'Părintele' : null,
    eAdmin,
    versiune: '0.2.0',
    modificata: '15.09.2026',
  })
  /** Ordinea in care apar clasele segmentelor in HTML — pastila se citeste de la stanga la dreapta. */
  const ordinea = (h: string) =>
    ['punct', 'acum', 'viit', 'arh', 'cheie'].filter((c) => h.includes(`class="btn ${c}`) || h.includes(`class="${c}"`))

  it('pastila tine cele cinci segmente, in ordinea ceruta', () => {
    const h = paginaNumar(ctx(true), lista, 2, '<p>x</p>')
    const pastila = h.slice(h.indexOf('<span class="pastila">'), h.indexOf('</span></span>'))
    const locuri = ['punct', 'acum', 'viit', 'arh', 'cheie'].map((c) => pastila.indexOf(c))
    expect(locuri.every((i) => i >= 0)).toBe(true)
    expect([...locuri].sort((a, b) => a - b)).toEqual(locuri)
    expect(ordinea(pastila).length).toBeGreaterThan(0)
  })

  it('pe cel mai nou numar scrie „Nr. curent", iar bulina ramane apasata', () => {
    const h = paginaNumar(ctx(false), lista, 2, '<p>x</p>')
    expect(h).toContain('Nr. curent')
    expect(h).toContain('class="btn punct activ"')
    // bulina apasata nu mai e link: e inerta, ca la Program
    expect(h).not.toContain('href="/newsletter/n/3" title="Treci la numărul curent"')
  })

  it('pe un numar mai vechi scrie data lui, iar bulina duce la cel curent', () => {
    const h = paginaNumar(ctx(false), lista, 0, '<p>x</p>')
    expect(h).toContain('1 septembrie 2026')
    expect(h).toContain('1 sept. 2026')
    expect(h).toContain('href="/newsletter/n/3"')
  })

  it('sageata e o FAPTA, nu o navigare: duce la adaugarea manuala', () => {
    const h = paginaNumar(ctx(true), lista, 0, '<p>x</p>')
    expect(h).toContain('href="/newsletter/nou"')
    expect(h).toContain('Buletin nou — adăugare manuală')
    // ⚠️ pasul inainte prin sirul numerelor A IESIT odata cu ea
    expect(h).not.toContain('href="/newsletter/n/2"')
  })

  it('sageata e numai a adminilor; restul pastilei e a tuturor', () => {
    const alOmului = paginaNumar(ctx(false), lista, 0, '<p>x</p>')
    expect(alOmului).not.toContain('/newsletter/nou')
    expect(alOmului).toContain('href="/newsletter/arhiva"')
    expect(alOmului).toContain('id="cautare-cheie"')
  })

  it('sageata „◀ numărul dinainte" a iesit din rand — inapoi se merge prin Arhiva', () => {
    const h = paginaNumar(ctx(true), lista, 1, '<p>x</p>')
    expect(h).not.toContain('numărul dinainte')
    expect(h).toContain('href="/newsletter/arhiva"')
  })

  it('abonarea e in rand si o vad TOTI, si adminii', () => {
    for (const eAdmin of [false, true]) {
      const h = paginaNumar(ctx(eAdmin), lista, 2, '<p>x</p>')
      expect(h).toContain('id="b-abonare"')
      expect(h).toContain('Primește newsletterul pe email')
      expect(h).toContain('id="d-abonare"')
    }
  })

  it('pe ecranul buletinului nou, sageata ramane aprinsa si scrisul spune unde esti', () => {
    const h = paginaNou(ctx(true), lista)
    expect(h).toContain('class="btn viit activ"')
    expect(h).toContain('Buletin nou')
    // ⚠️ nu scrie inca nimic in depozit, si o spune omului
    expect(h).toContain('nu scrie în depozit și nu trimite nimic')
  })

  it('bara cautarii sta ascunsa pana se apasa lupa, si coborata pe pagina rezultatelor', () => {
    expect(paginaNumar(ctx(false), lista, 2, '<p>x</p>')).toContain('id="bara-cautare" hidden')
    const rezultate = paginaCautare(ctx(false), lista, 'cr', lista.slice(0, 1), null)
    expect(rezultate).toContain('id="bara-cautare"')
    expect(rezultate).not.toContain('id="bara-cautare" hidden')
    expect(rezultate).toContain('aria-expanded="true"')
  })

  it('arhiva goala nu strica randul: bulina se stinge, nu dispare', () => {
    const h = paginaGoala(ctx(false))
    expect(h).toContain('class="btn punct gol"')
    expect(h).toContain('id="b-abonare"')
  })
})
