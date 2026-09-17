import { describe, expect, it } from 'vitest'
import { prefixSiCale } from '../packages/config/src/index.js'
import { type Buletin, type BuletinScurt, plat } from '../apps/buletin/src/depozit.js'
import { PDFDocument } from 'pdf-lib'
import { brosura, cheiaBrosurii, numeBrosura, ordineaBrosurii } from '../apps/buletin/src/tipar.js'
import {
  type Ctx as CtxBuletin,
  buletinulNou,
  duminicaNoua,
  paginaAcasa as paginaAcasaB,
  paginaArhiva as paginaArhivaB,
  paginaBuletin as paginaBuletinB,
  paginaCautare as paginaCautareB,
  paginaNou as paginaNouB,
} from '../apps/buletin/src/pagini.js'
import {
  ANII,
  type Ctx,
  anul,
  luna,
  nenumerotate,
  numerotate,
  paginaAltele,
  paginaArhiva,
  paginaCautare,
  paginaGoala,
  paginaNou,
  paginaNumar,
  scurtat,
  titluNumar,
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

/**
 * MENIUL BULETINULUI, refacut la 17.09.2026 dupa chipul Calendarului si al Programului (user: „să
 * aranjăm meniul principal cum am făcut la Calendar și Programul liturgic"): o pastila cat tot
 * randul — bulina · zona de scris · sageata · Arhiva · lupa — si, singura afara la dreapta, abonarea.
 */
describe('buletin · meniul din antet', () => {
  const numar = (nr: number, data: string): BuletinScurt => ({
    nr,
    data,
    an: data.slice(0, 4),
    luna: data.slice(5, 7),
    cheie_pdf: `2026/buletin-${nr}.pdf`,
    cheie_poza_mica: `2026/buletin-${nr}-mic.jpg`,
    pagini: 4,
  })
  const intreg = (nr: number, data: string): Buletin => ({
    ...numar(nr, data),
    cheie_poza: `2026/buletin-${nr}.jpg`,
    marime_pdf: 1048576,
    sursa: 'arhiva',
  })
  const ctxB = (eAdmin: boolean): CtxBuletin => ({
    prefix: '/buletin',
    nav: { home: 'https://website.sfantul-ilie.ro', cont: '/cont', admin: '/admin' } as CtxBuletin['nav'],
    utilizator: eAdmin ? 'Părintele' : null,
    eAdmin,
    versiune: '0.3.7',
    modificata: '17.09.2026',
  })
  const ANI = ['2026', '2025', '2024']
  const acum = intreg(615, '2026-09-06')
  /** Randul de unelte, de la pastila pana la abonare — care sta AFARA, indata dupa ea. */
  const pastilaDin = (h: string) => h.slice(h.indexOf('<span class="pastila">'), h.indexOf('id="b-abonare"'))

  it('pastila tine cele cinci segmente, in ordinea ceruta', () => {
    const h = paginaAcasaB(ctxB(true), { ani: ANI, peEcran: acum, acum: true }, acum, [])
    const pastila = pastilaDin(h)
    const locuri = ['punct', 'acum', 'viit', 'arh', 'cheie'].map((c) => pastila.indexOf(c))
    expect(locuri.every((i) => i >= 0)).toBe(true)
    expect([...locuri].sort((a, b) => a - b)).toEqual(locuri)
  })

  it('abonarea a iesit din pastila si a ramas singura la dreapta', () => {
    const h = paginaAcasaB(ctxB(false), { ani: ANI, peEcran: acum, acum: true }, acum, [])
    const pastila = pastilaDin(h)
    expect(pastila).not.toContain('b-abonare')
    expect(pastila).toContain('class="btn cheie"')
    expect(h).toContain('id="b-abonare"')
    // randul vechi din V1 — liniuta despartitoare si butoanele mici — a cazut cu totul
    expect(h).not.toContain('class="desparte"')
    expect(h).not.toContain('id="cauta-buton"')
  })

  it('pe numarul curent bulina ramane apasata, iar scrisul spune chiar numarul lui', () => {
    const h = paginaAcasaB(ctxB(false), { ani: ANI, peEcran: acum, acum: true }, acum, [])
    expect(h).toContain('class="btn punct activ"')
    expect(h).toContain('<b class="lung">Buletinul nr. 615</b>')
    expect(h).toContain('<b class="scurt">Buletinul nr. 615</b>')
  })

  /** Butoanele de sub copertă (user, 17.09.2026): Descarcă și Tipărește; răsfoitul a rămas pe copertă. */
  it('sub copertă stau Descarcă și Tipărește, nu butonul de răsfoit', () => {
    const h = paginaAcasaB(ctxB(false), { ani: ANI, peEcran: acum, acum: true }, acum, [])
    expect(h).toContain('id="b-descarca"')
    expect(h).toContain('href="/buletin/fisier/2026/buletin-615.pdf?descarca=1"')
    expect(h).toContain('download="buletin-615.pdf"')
    expect(h).toContain('id="b-tipareste"')
    expect(h).toContain('href="/buletin/tipar/615-2026-09-06.pdf"')
    // răsfoitul rămâne: coperta îl deschide, fereastra lui e în pagină
    expect(h).not.toContain('id="b-rasfoit"')
    expect(h).toContain('data-rasfoit')
    expect(h).toContain('id="d-rasfoit"')
  })

  it('Descarcă e fără cuvânt — doar iconița și mărimea; cuvântul rămâne cititorului de ecran', () => {
    const h = paginaAcasaB(ctxB(false), { ani: ANI, peEcran: acum, acum: true }, acum, [])
    const buton = /<a class="btn intreg" id="b-descarca"[^>]*>([\s\S]*?)<\/a>/.exec(h)
    expect(buton).not.toBeNull()
    expect(buton![1]).not.toContain('Descarcă')
    expect(buton![1]).toContain('<svg')
    expect(buton![1]).toContain('MB</small>')
    expect(buton![0]).toContain('aria-label="Descarcă foaia numărului 615"')
  })

  it('reversul e al doilea segment al pastilei lui Tipărește: doar iconiță, întrerupător, pornește stins', () => {
    const h = paginaAcasaB(ctxB(false), { ani: ANI, peEcran: acum, acum: true }, acum, [])
    const pastila = /<span class="pastila tipar">([\s\S]*?)<\/span>/.exec(h)
    expect(pastila).not.toBeNull()
    const tipareste = pastila![1].indexOf('id="b-tipareste"')
    const revers = pastila![1].indexOf('id="b-revers"')
    expect(tipareste).toBeGreaterThan(-1)
    expect(revers).toBeGreaterThan(tipareste)
    const buton = /<button[^>]*id="b-revers"[^>]*>([\s\S]*?)<\/button>/.exec(h)
    expect(buton![0]).toContain('aria-pressed="false"')
    expect(buton![1]).not.toContain('Revers') // cuvântul e doar în aria-label/title
    expect(buton![1]).toContain('<svg')
    expect(h).toContain('buletin_revers')
    expect(h).toContain('?revers=1')
  })

  it('un numar fara PDF nu capata butoane care duc in gol', () => {
    const faraPdf: Buletin = { ...intreg(600, '2026-01-04'), cheie_pdf: null }
    const h = paginaAcasaB(ctxB(false), { ani: ANI, peEcran: faraPdf, acum: true }, faraPdf, [])
    expect(h).toContain('Fără PDF')
    expect(h).not.toContain('id="b-tipareste"')
    expect(h).not.toContain('id="b-descarca"')
    expect(h).not.toContain('id="b-revers"')
  })

  it('pe un numar mai vechi scrie data lui, iar bulina duce la cel curent', () => {
    const vechi = intreg(610, '2026-08-02')
    const h = paginaBuletinB(ctxB(false), { ani: ANI, peEcran: vechi }, vechi)
    expect(h).toContain('2 august 2026')
    expect(h).toContain('2 aug. 2026')
    expect(h).toContain('href="/buletin/" title="Treci la numărul curent"')
    // navigarea de jos („◀ numărul dinainte / numărul următor ▶") a iesit (17.09.2026): inapoi prin Arhiva
    expect(h).not.toContain('numărul dinainte')
    expect(h).not.toContain('numărul următor')
  })

  it('prima pagina nu mai scrie jos randul „Arhiva întreagă — N numere"', () => {
    const h = paginaAcasaB(ctxB(false), { ani: ANI, peEcran: acum, acum: true }, acum, [])
    expect(h).not.toContain('Arhiva întreagă')
    expect(h).not.toContain('din 2012 până azi')
  })

  it('sageata e a adminilor si duce la buletinul nou; restul pastilei e a tuturor', () => {
    const alOmului = paginaAcasaB(ctxB(false), { ani: ANI, peEcran: acum, acum: true }, acum, [])
    expect(alOmului).not.toContain('/buletin/nou')
    expect(alOmului).toContain('id="ani-cheie"')
    expect(alOmului).toContain('id="cautare-cheie"')
    const alPreotului = paginaAcasaB(ctxB(true), { ani: ANI, peEcran: acum, acum: true }, acum, [])
    expect(alPreotului).toContain('href="/buletin/nou"')
  })

  it('bara anilor sta ascunsa pana se apasa cheia Arhivei, si coborata in arhiva', () => {
    const acasa = paginaAcasaB(ctxB(false), { ani: ANI, peEcran: acum, acum: true }, acum, [])
    expect(acasa).toContain('id="bara-ani" hidden')
    const arhiva = paginaArhivaB(ctxB(false), { ani: ANI, arhiva: true, anDeschis: '2025' }, '2025', [])
    expect(arhiva).toContain('id="bara-ani"')
    expect(arhiva).not.toContain('id="bara-ani" hidden')
    // pe pagina Arhivei cheia e inerta: fasia e singurul drum catre ceilalti ani
    expect(arhiva).toContain('aria-disabled="true" aria-current="page"')
    expect(arhiva).toContain('<a class="an-buton activ" href="/buletin/arhiva?an=2025"')
    // patratelele cu ani au iesit din corpul paginii — anii se aleg dintr-un singur loc
    expect(arhiva).not.toContain('class="capitole"')
  })

  it('bara cautarii sta ascunsa pana se apasa lupa, si coborata pe pagina rezultatelor', () => {
    expect(paginaAcasaB(ctxB(false), { ani: ANI, peEcran: acum, acum: true }, acum, []))
      .toContain('id="bara-cautare" hidden')
    const rezultate = paginaCautareB(ctxB(false), { ani: ANI, q: 'craciun' }, 'craciun', [])
    expect(rezultate).toContain('id="bara-cautare"')
    expect(rezultate).not.toContain('id="bara-cautare" hidden')
    expect(rezultate).toContain('Căutare')
  })

  it('arhiva goala nu strica randul: bulina se stinge, nu dispare', () => {
    const h = paginaAcasaB(ctxB(false), { gol: true }, null, [], 0)
    expect(h).toContain('class="btn punct gol"')
    // fara ani n-are ce cobori: segmentul ramane LINKUL cinstit, nu o cheie moarta
    expect(h).toContain('href="/buletin/arhiva"')
    expect(h).not.toContain('id="bara-ani"')
  })
})

/**
 * BULETINUL NOU (user, 17.09.2026): „scriem numărul 616, dar cu roșu. Sub scriem data buletinului,
 * adică următoarea duminică, și deasupra scriem numărul următor cu verde."
 */
describe('buletin · numarul care urmeaza', () => {
  it('ziua e prima duminica de azi inainte', () => {
    // 17.09.2026 e joi
    expect(duminicaNoua('2026-09-06', '2026-09-17')).toBe('2026-09-20')
    expect(duminicaNoua('2026-09-06', '2026-09-19')).toBe('2026-09-20')
  })

  it('daca azi E duminica si numarul zilei n-a aparut inca, tot azi e ziua lui', () => {
    expect(duminicaNoua('2026-09-13', '2026-09-20')).toBe('2026-09-20')
  })

  it('⚠️ o duminica deja aparuta nu se cere a doua oara', () => {
    // numarul de azi e urcat: ecranul trece la duminica urmatoare, nu repeta numarul aparut
    expect(duminicaNoua('2026-09-20', '2026-09-20')).toBe('2026-09-27')
  })

  it('numarul nou e cel de dupa ultimul din arhiva; fara arhiva nu se inventeaza niciunul', () => {
    expect(buletinulNou({ nr: 615, data: '2026-09-06' }, '2026-09-17')).toEqual({ nr: 616, data: '2026-09-20' })
    expect(buletinulNou(null, '2026-09-17')).toEqual({ nr: null, data: '2026-09-20' })
  })

  it('pagina are capul unui numar obisnuit: eticheta verde „Numărul următor", numarul si ziua', () => {
    const b: BuletinScurt = {
      nr: 615, data: '2026-09-06', an: '2026', luna: '09',
      cheie_pdf: null, cheie_poza_mica: null, pagini: 4,
    }
    const ctx: CtxBuletin = {
      prefix: '/buletin',
      nav: { home: '', cont: '/cont', admin: '/admin' } as CtxBuletin['nav'],
      utilizator: 'Părintele',
      eAdmin: true,
      versiune: '0.3.7',
      modificata: '17.09.2026',
    }
    const h = paginaNouB(ctx, { nou: true, ani: ['2026'] }, b, buletinulNou(b, '2026-09-17'), STARE_PROBA)
    // ⚠️ ROSU e numarul NOU (616 — cel la care se lucra chiar atunci), nu ultimul din arhiva (615)
    // capul e cel de la orice numar; se schimba doar eticheta (verde, „Numărul următor")
    expect(h).toContain('<p class="eticheta urmator">Numărul următor</p>')
    expect(h).toContain('<h2>Nr. 616</h2>')
    // ⚠️ al doilea numar mare (617) a iesit — userul l-a schimbat pe eticheta de deasupra
    expect(h).not.toContain('617')
    expect(h).toContain('duminică, 20 septembrie 2026')
    // ultimul aparut ramane scris marunt, cu legatura spre el
    expect(h).toContain('nr. 615</a>, 6 septembrie 2026')
    // sageata ramane aprinsa, iar scrisul din pastila spune unde esti
    expect(h).toContain('class="btn viit activ"')
    expect(h).toContain('<b class="lung">Buletin nou</b>')
  })

  /**
   * ⚠️ CHENARUL GOL A IEȘIT la 17.09.2026: pagina compune acum numărul, deci locul lui l-a luat
   * formularul (cerere user: API-ul + ecranul). Probele de mai jos țin forma cerută — motto, număr
   * și dată ca start, articolul principal, cel mult DOI secundari — și socoteala care merge odată
   * cu scrisul, fiindcă ea e miezul cererii („trebuie calculată lungimea textului care intră").
   */
  it('pagina numarului nou are formularul de compunere, cu socoteala lui', () => {
    const b: BuletinScurt = {
      nr: 615, data: '2026-09-06', an: '2026', luna: '09',
      cheie_pdf: null, cheie_poza_mica: null, pagini: 4,
    }
    const h = paginaNouB(CTX_PROBA, { nou: true, ani: ['2026'] }, b, buletinulNou(b, '2026-09-17'), STARE_PROBA)
    expect(h).not.toContain('<div class="chenar-nou" aria-hidden="true"></div>')
    expect(h).toContain('<form method="post" action="/buletin/nou" class="compunere">')
    // startul numarului: motto (+ cine l-a spus); NUMARUL SI DATA NU SE EDITEAZA (user, 17.09.2026,
    // seara) — stau scrise in capul paginii si ies din arhiva, nu din formular
    for (const c of ['motto', 'moto_autor']) expect(h).toContain(`name="${c}"`)
    expect(h).not.toContain('name="nr"')
    expect(h).not.toContain('name="data"')
    expect(h).toContain('Nr. 616')
    // articolul principal: zona neagra (autor, ani, pomenire), titlul, poza, textul, sursa
    for (const c of ['p_autor', 'p_ani', 'p_pomenire', 'p_titlu', 'p_poza', 'p_text', 'p_sursa']) {
      expect(h).toContain(`name="${c}"`)
    }
    // cel mult DOI secundari — al treilea nu există nicăieri în pagină
    expect(h).toContain('name="s1_text"')
    expect(h).toContain('name="s2_text"')
    expect(h).not.toContain('name="s3_text"')
    // socoteala se face in pagina, din aceleasi cifre ca la server
    expect(h).toContain('window.XC_MASURI = ')
    expect(h).toContain('class="socoteala" data-pentru="p"')
    // pagina a patra spune ce program tipareste
    expect(h).toContain('21 – 27 septembrie 2026')
  })

  /**
   * ⚠️ Din 17.09.2026, seara, programul NEVALIDAT nu mai opreste compunerea (user: „să se folosească
   * fără probleme programul propus dacă nu este validat — doar trebuie atrasă atenția la început
   * PROPUS"). Deci: cu `stare: 'propus'` pagina scrie PROPUS INAINTE de formular; `null` inseamna
   * altceva — programul n-a raspuns deloc.
   */
  it('spune PROPUS la inceput cand programul saptamanii nu e validat, si tot compune', () => {
    const b: BuletinScurt = {
      nr: 615, data: '2026-09-06', an: '2026', luna: '09',
      cheie_pdf: null, cheie_poza_mica: null, pagini: 4,
    }
    const h = paginaNouB(CTX_PROBA, { nou: true }, b, buletinulNou(b, '2026-09-17'), {
      ...STARE_PROBA,
      calendar: { titlu: '21 – 27 septembrie 2026', slujbe: 6, stare: 'propus' },
    })
    expect(h).toContain('<b>PROPUS.</b>')
    expect(h).toContain('nu e încă validat')
    // atentia sta INAINTEA formularului, nu dupa el
    expect(h.indexOf('<b>PROPUS.</b>')).toBeLessThan(h.indexOf('<form method="post"'))
    expect(h).toContain('<form method="post" action="/buletin/nou" class="compunere">')
    // iar pe randul programului se vede tot
    expect(h).toContain('<b>(PROPUS)</b>')
  })

  it('cu programul validat nu scrie PROPUS nicaieri', () => {
    const b: BuletinScurt = {
      nr: 615, data: '2026-09-06', an: '2026', luna: '09',
      cheie_pdf: null, cheie_poza_mica: null, pagini: 4,
    }
    const h = paginaNouB(CTX_PROBA, { nou: true }, b, buletinulNou(b, '2026-09-17'), {
      ...STARE_PROBA,
      calendar: { titlu: '21 – 27 septembrie 2026', slujbe: 6, stare: 'validat' },
    })
    expect(h).not.toContain('<b>PROPUS.</b>')
    expect(h).not.toContain('(PROPUS)')
  })

  it('cand programul n-a raspuns deloc, o spune, fara sa pretinda ca e nevalidat', () => {
    const b: BuletinScurt = {
      nr: 615, data: '2026-09-06', an: '2026', luna: '09',
      cheie_pdf: null, cheie_poza_mica: null, pagini: 4,
    }
    const h = paginaNouB(CTX_PROBA, { nou: true }, b, buletinulNou(b, '2026-09-17'), { ...STARE_PROBA, calendar: null })
    expect(h).toContain('n-a răspuns')
    expect(h).not.toContain('<b>PROPUS.</b>')
    expect(h).not.toContain('(PROPUS)')
  })

  it('motto-ul vine precompletat cu cel al numarului trecut, iar ce a scris omul bate precompletarea', () => {
    const b: BuletinScurt = {
      nr: 615, data: '2026-09-06', an: '2026', luna: '09',
      cheie_pdf: null, cheie_poza_mica: null, pagini: 4,
    }
    const motto = { motto: '„Maica Domnului ne iubește mult.”', motoAutor: 'Părintele Arsenie Papacioc' }
    const gol = paginaNouB(CTX_PROBA, { nou: true }, b, buletinulNou(b, '2026-09-17'), { ...STARE_PROBA, motto })
    expect(gol).toContain('„Maica Domnului ne iubește mult.”</textarea>')
    expect(gol).toContain('value="Părintele Arsenie Papacioc"')
    expect(gol).toContain('precompletat cu motto-ul numărului trecut')
    const scris = paginaNouB(CTX_PROBA, { nou: true }, b, buletinulNou(b, '2026-09-17'), {
      ...STARE_PROBA, motto, scris: { motto: 'Alt citat', moto_autor: 'Altcineva' },
    })
    expect(scris).toContain('Alt citat</textarea>')
    expect(scris).not.toContain('Maica Domnului')
  })

  it('atentiile compunerii (program propus, text de proba) se scriu inaintea rezultatului', () => {
    const b: BuletinScurt = {
      nr: 615, data: '2026-09-06', an: '2026', luna: '09',
      cheie_pdf: null, cheie_poza_mica: null, pagini: 4,
    }
    const h = paginaNouB(CTX_PROBA, { nou: true }, b, buletinulNou(b, '2026-09-17'), {
      ...STARE_PROBA,
      raspuns: { facut: true, cheie: '2026/buletin-616-2026-09-20.pdf', plangeri: [], atentie: ['text de probă la: principal: textul (8 900 de semne)'] },
    })
    expect(h).toContain('text de probă la: principal')
    expect(h.indexOf('text de probă la')).toBeLessThan(h.indexOf('Numărul e compus'))
  })

  it('arata plangerile compunerii, cu cifre, si nu pretinde ca s-a facut', () => {
    const b: BuletinScurt = {
      nr: 615, data: '2026-09-06', an: '2026', luna: '09',
      cheie_pdf: null, cheie_poza_mica: null, pagini: 4,
    }
    const h = paginaNouB(CTX_PROBA, { nou: true }, b, buletinulNou(b, '2026-09-17'), {
      ...STARE_PROBA,
      raspuns: { facut: false, plangeri: ['principal: 1200 de semne peste măsură (încap 9000, sunt 10200)'] },
      scris: { motto: 'Un citat care nu trebuie să se piardă', p_text: 'text' },
    })
    expect(h).toContain('Nu s-a compus')
    expect(h).toContain('1200 de semne peste măsură')
    expect(h).not.toContain('Numărul e compus')
    // ce scrisese omul nu se pierde cand raspunsul e „nu incape"
    expect(h).toContain('Un citat care nu trebuie să se piardă')
  })
})

const CTX_PROBA: CtxBuletin = {
  prefix: '/buletin',
  nav: { home: '', cont: '/cont', admin: '/admin' } as CtxBuletin['nav'],
  utilizator: 'Părintele',
  eAdmin: true,
  versiune: '0.3.7',
  modificata: '17.09.2026',
}

/** Cifrele socotelii, ca cele date de `variante()` — proba nu cheamă programul. */
const STARE_PROBA = {
  variante: [
    { varianta: 'un singur autor, cu poză mare', semne: 9028, zone: [{ cine: 'principal', semne: 9028 }] },
    { varianta: 'un singur autor, fără poză', semne: 9974, zone: [{ cine: 'principal', semne: 9974 }] },
    { varianta: 'autor principal + 1 secundar', semne: 8206, zone: [{ cine: 'principal', semne: 6100 }, { cine: 'secundar 1', semne: 2106 }] },
    { varianta: 'autor principal + 2 secundari', semne: 7385, zone: [{ cine: 'principal', semne: 3200 }, { cine: 'secundar 1', semne: 2092 }, { cine: 'secundar 2', semne: 2093 }] },
  ],
  calendar: { titlu: '21 – 27 septembrie 2026', slujbe: 6 },
}

/**
 * BROȘURA DE TIPAR (user, 17.09.2026: „un buton de tip «Tipărește»… ar trebui să tipărească
 * «booklet»"; „A4 imprimanta / booklet și îndoit, în final e un A5 îndoit").
 *
 * Se probează ORDINEA, fiindcă ea e tot ce poate ieși prost fără să se vadă pe ecran: o coală
 * așezată greșit se descoperă abia după ce s-au tipărit 60 de exemplare.
 */
describe('buletin · ordinea paginilor în broșură', () => {
  it('patru pagini intră pe o coală: fața [4|1], versoul [2|3]', () => {
    expect(ordineaBrosurii(4)).toEqual([
      [4, 1],
      [2, 3],
    ])
  })

  it('opt pagini intră pe două coli, în ordinea îndoirii', () => {
    expect(ordineaBrosurii(8)).toEqual([
      [8, 1],
      [2, 7],
      [6, 3],
      [4, 5],
    ])
  })

  it('⚠️ ce nu e multiplu de patru se completează cu pagini albe (0), nu se taie', () => {
    // șase pagini → tot două coli; locurile 7 și 8 rămân albe
    expect(ordineaBrosurii(6)).toEqual([
      [0, 1],
      [2, 0],
      [6, 3],
      [4, 5],
    ])
    // un număr de două pagini rămâne o coală, cu două fețe albe
    expect(ordineaBrosurii(2)).toEqual([
      [0, 1],
      [2, 0],
    ])
  })

  it('numele și cheia poartă felul colii, ca a3 și a4 să nu se calce', () => {
    expect(numeBrosura('2026/buletin-615-2026-09-06.pdf', 'a4')).toBe('buletin-615-2026-09-06-brosura-a4.pdf')
    expect(cheiaBrosurii('2026/buletin-615-2026-09-06.pdf', 'a3')).toBe(
      'tipar/2026/buletin-615-2026-09-06-brosura-a3.pdf',
    )
  })

  it('reversul are cheia lui în depozit, ca să nu se calce cu broșura obișnuită', () => {
    expect(numeBrosura('2026/buletin-615-2026-09-06.pdf', 'a4', true)).toBe(
      'buletin-615-2026-09-06-brosura-a4-revers.pdf',
    )
    expect(cheiaBrosurii('2026/buletin-615-2026-09-06.pdf', 'a4', true)).toBe(
      'tipar/2026/buletin-615-2026-09-06-brosura-a4-revers.pdf',
    )
    expect(cheiaBrosurii('2026/buletin-615-2026-09-06.pdf', 'a4', false)).toBe(
      'tipar/2026/buletin-615-2026-09-06-brosura-a4.pdf',
    )
  })

  /** Un PDF de probă cu `n` pagini A4; fiecare are ceva desenat — pdf-lib nu lipește pagini fără conținut. */
  async function foaieDeProba(n: number): Promise<ArrayBuffer> {
    const sursa = await PDFDocument.create()
    for (let i = 0; i < n; i++) sursa.addPage([595, 842]).drawRectangle({ x: 50, y: 50, width: 100, height: 100 })
    return (await sursa.save()).buffer as ArrayBuffer
  }

  /** Reversul (user, 17.09.2026): „foaia a doua este întoarsă 180 de grade" — versoul, nu fața. */
  it('cu revers, versoul iese rotit cu 180°, fața rămâne dreaptă', async () => {
    const octeti = await foaieDeProba(4)

    const drept = await PDFDocument.load(await brosura(octeti, 'a4'))
    expect(drept.getPageCount()).toBe(2)
    expect(drept.getPage(0).getRotation().angle).toBe(0)
    expect(drept.getPage(1).getRotation().angle).toBe(0)

    const intors = await PDFDocument.load(await brosura(octeti, 'a4', true))
    expect(intors.getPageCount()).toBe(2)
    expect(intors.getPage(0).getRotation().angle).toBe(0)
    expect(intors.getPage(1).getRotation().angle).toBe(180)
  })

  it('la două coli, cu revers, se întorc amândouă versourile', async () => {
    const octeti = await foaieDeProba(8)
    const intors = await PDFDocument.load(await brosura(octeti, 'a4', true))
    expect(intors.getPages().map((p) => p.getRotation().angle)).toEqual([0, 180, 0, 180])
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

  /**
   * ⚠️ Din 15.09.2026 nu mai scrie generic „Nr. curent", ci CHIAR numarul (user: „când sunt pe
   * buletinul curent, scrie «Buletinul nr. 500»"), si nici nu se mai prescurteaza pe telefon.
   */
  it('pe cel mai nou numar scrie chiar numarul lui, iar bulina ramane apasata', () => {
    const h = paginaNumar(ctx(false), lista, 2, '<p>x</p>')
    expect(h).toContain('<b class="lung">Buletinul nr. 3</b>')
    expect(h).toContain('<b class="scurt">Buletinul nr. 3</b>')
    expect(h).not.toContain('Nr. curent<')
    expect(h).toContain('class="btn punct activ"')
    // bulina apasata nu mai e link: e inerta, ca la Program
    expect(h).not.toContain('href="/newsletter/n/3" title="Treci la numărul curent"')
  })

  it('un numar fara numar in subiect ramane pe „Nr. curent"', () => {
    const anunt = [fisa(9, '2026-09-20 10:00:00', 'Schimbare de program')]
    anunt[0].nr = null
    const h = paginaNumar(ctx(false), anunt, 0, '<p>x</p>')
    expect(h).toContain('Nr. curent')
    expect(h).not.toContain('nr. null')
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
    expect(alOmului).toContain('id="ani-cheie"')
    expect(alOmului).toContain('id="cautare-cheie"')
  })

  it('sageata „◀ numărul dinainte" a iesit din rand — inapoi se merge prin Arhiva', () => {
    const h = paginaNumar(ctx(true), lista, 1, '<p>x</p>')
    expect(h).not.toContain('numărul dinainte')
    expect(h).toContain('id="bara-ani"')
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
    // fara ani n-are ce cobori: segmentul ramane LINKUL cinstit, nu o cheie moarta
    expect(h).toContain('href="/newsletter/arhiva"')
    expect(h).not.toContain('id="bara-ani"')
  })
})

/*
 * TITLUL NUMARULUI din pagina (user, 16.09.2026: „modifică-l așa: Buletinul Online nr. 571 / 15
 * septembrie 2026 și scrie mai mic ca să intre pe un rând și pe mobil… eventual prescurtează luna").
 */
describe('newsletter · titlul numarului', () => {
  it('„Parohiei" cade, restul subiectului ramane neatins', () => {
    expect(titluNumar('Buletinul Parohiei Online nr. 571 / 15 septembrie 2026').lung)
      .toBe('Buletinul Online nr. 571 / 15 septembrie 2026')
  })

  it('forma scurta prescurteaza luna, ca titlul sa intre pe un rand', () => {
    expect(titluNumar('Buletinul Parohiei Online nr. 571 / 15 septembrie 2026').scurt)
      .toBe('Buletinul Online nr. 571 / 15 sept. 2026')
  })

  it('un subiect care nu incepe cu numele foii ramane intreg', () => {
    const t = titluNumar('Schimbare de program')
    expect(t.lung).toBe('Schimbare de program')
    expect(t.scurt).toBe('Schimbare de program')
  })

  it('se taie NUMAI „Parohiei" de dupa „Buletinul", nu oriunde', () => {
    expect(titluNumar('Anunț: hramul Parohiei noastre').lung).toBe('Anunț: hramul Parohiei noastre')
  })

  it('amandoua formele se scriu in pagina, iar CSS-ul alege', () => {
    const lista = [{ id: 1, nr: 571, subiect: 'Buletinul Parohiei Online nr. 571 / 15 septembrie 2026', trimis: '2026-09-15 17:19:04', rezumat: '' }]
    const h = paginaNumar({
      prefix: '', nav: {} as never, utilizator: null, eAdmin: false, versiune: '0', modificata: '0',
    }, lista, 0, '<p>x</p>')
    expect(h).toContain('<span class="lung">Buletinul Online nr. 571 / 15 septembrie 2026</span>')
    expect(h).toContain('<span class="scurt">Buletinul Online nr. 571 / 15 sept. 2026</span>')
    // ⚠️ subiectul din depozit NU se atinge: acolo e arhiva, nu afisajul
    expect(lista[0]!.subiect).toBe('Buletinul Parohiei Online nr. 571 / 15 septembrie 2026')
  })
})

/*
 * BARA CU ANII, coborata din cheia Arhivei (user, 15.09.2026: „când apăs pe History, să apară o bară
 * cu anii, la fel cum este la Program"). Se poarta ca sora ei de la Program: ascunsa pe paginile
 * obisnuite, coborata permanent pe /arhiva, unde cheia devine inerta.
 */
describe('newsletter · bara cu anii', () => {
  const fisa = (id: number, trimis: string) =>
    ({ id, nr: id, subiect: `Buletinul Parohiei nr. ${id}`, trimis, rezumat: '' })
  const lista = [fisa(1, '2024-03-02 10:00:00'), fisa(2, '2025-07-11 10:00:00'), fisa(3, '2026-09-13 10:00:00')]
  const ctx = (): Ctx => ({
    prefix: '/newsletter',
    nav: { home: 'https://website.sfantul-ilie.ro', cont: '/cont', admin: '/admin' } as Ctx['nav'],
    utilizator: null,
    eAdmin: false,
    versiune: '0.3.0',
    modificata: '15.09.2026',
  })

  it('anii ies din arhiva, descrescator — nu se scriu in cod', () => {
    expect(ANII(lista)).toEqual([2026, 2025, 2024])
  })

  it('pe o pagina obisnuita bara e ascunsa, iar cheia o poate cobori', () => {
    const h = paginaNumar(ctx(), lista, 2, '<p>x</p>')
    expect(h).toContain('id="bara-ani" hidden')
    expect(h).toContain('id="ani-cheie"')
    expect(h).toContain('aria-expanded="false" aria-controls="bara-ani"')
    expect(h).toContain('href="/newsletter/arhiva/2026"')
    expect(h).toContain('href="/newsletter/arhiva/2024"')
  })

  it('pe pagina Arhivei bara vine coborata, iar cheia e inerta', () => {
    const h = paginaArhiva(ctx(), lista, 2025)
    expect(h).toContain('id="bara-ani"')
    expect(h).not.toContain('id="bara-ani" hidden')
    expect(h).toContain('aria-disabled="true"')
    expect(h).toContain('aria-expanded="true" aria-controls="bara-ani"')
    // anul deschis e marcat rosu in fasie, ca luna deschisa din bara Calendarului
    expect(h).toContain('class="an-buton activ" href="/newsletter/arhiva/2025"')
  })

  it('patratelele cu ani au iesit din corpul paginii — anii se aleg dintr-un singur loc', () => {
    const h = paginaArhiva(ctx(), lista, 2025)
    expect(h).not.toContain('class="capitole"')
  })

  it('un an cerut care nu exista cade pe cel mai nou, nu pe cel mai vechi', () => {
    const h = paginaArhiva(ctx(), lista, 1999)
    expect(h).toContain('class="an-buton activ" href="/newsletter/arhiva/2026"')
  })
})

/*
 * „ALTELE" — trimiterile fără număr (user, 16.09.2026: „mută toate newsletterele trimise, în afară
 * de cele numerotate… să rămână listate în ARHIVĂ doar numerele").
 */
describe('newsletter · Altele', () => {
  const nr = (id: number, n: number | null, trimis: string, subiect: string) =>
    ({ id, nr: n, subiect, trimis, rezumat: '' })
  const lista = [
    nr(1, 300, '2024-03-02 10:00:00', 'Buletinul Parohiei Online nr. 300 / 2 martie 2024'),
    nr(2, null, '2024-07-11 10:00:00', 'Actualizare program liturgic'),
    nr(3, 301, '2026-09-13 10:00:00', 'Buletinul Parohiei Online nr. 301 / 13 septembrie 2026'),
    nr(4, null, '2026-09-14 10:00:00', 'Astă seară nu este Vecernie'),
  ]
  const ctx = (): Ctx => ({
    prefix: '/newsletter',
    nav: {} as Ctx['nav'],
    utilizator: null,
    eAdmin: false,
    versiune: '0.5.0',
    modificata: '16.09.2026',
  })

  it('despartirea se face dupa numar, nu dupa subiect', () => {
    expect(numerotate(lista).map((f) => f.id)).toEqual([1, 3])
    expect(nenumerotate(lista).map((f) => f.id)).toEqual([2, 4])
  })

  it('in ARHIVA raman listate doar numerele', () => {
    const h = paginaArhiva(ctx(), lista, 2026)
    // ⚠️ se cauta in LISTA paginii, nu in toata pagina: bulina din antet duce oricum la cel mai nou
    // trimis, numerotat sau nu — aia e alta treaba decat ce se insira aici
    const listaPaginii = h.slice(h.indexOf('<ul class="numere">'), h.lastIndexOf('</ul>'))
    expect(listaPaginii).toContain('/newsletter/n/3')
    expect(listaPaginii).not.toContain('/newsletter/n/4')
    // socoteala e tot a numerelor, altfel ar spune altceva decat lista de dedesubt
    expect(h).toContain('1 număr trimis în 2026 · 2 cu totul')
  })

  it('segmentul „Altele" sta la CAPATUL fasiei, dupa cel mai vechi an', () => {
    const h = paginaArhiva(ctx(), lista, 2026)
    const iUltimulAn = h.lastIndexOf('/newsletter/arhiva/2024')
    const iAltele = h.indexOf('/newsletter/arhiva/altele')
    expect(iUltimulAn).toBeGreaterThan(0)
    expect(iAltele).toBeGreaterThan(iUltimulAn)
  })

  it('pagina „Altele" le arata pe toate cele fara numar, pe ani', () => {
    const h = paginaAltele(ctx(), lista)
    expect(h).toContain('/newsletter/n/2')
    expect(h).toContain('/newsletter/n/4')
    expect(h).not.toContain('/newsletter/n/1')
    expect(h).toContain('2 trimiteri fără număr')
    expect(h).toContain('<h2 class="anul">2026</h2>')
    expect(h).toContain('<h2 class="anul">2024</h2>')
    // segmentul ei ramane marcat, iar niciun an nu e marcat in acelasi timp
    expect(h).toContain('class="an-buton altele activ"')
    expect(h).not.toContain('class="an-buton activ"')
  })

  it('un an fara numere nu deschide o pagina goala — nu intra in fasie', () => {
    const doarAnunt = [nr(9, null, '2015-01-01 10:00:00', 'Anunț')]
    expect(ANII(doarAnunt)).toEqual([])
  })
})
