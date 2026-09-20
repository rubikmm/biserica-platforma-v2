/**
 * FOAIA TIPĂRITĂ — cele câteva hotărâri de formă care nu se văd decât pe hârtie, deci se strică
 * în tăcere: josul paginii a patra, golul de deasupra calendarului, mărimea capului „PROGRAMUL
 * LITURGIC" și adresa aldină din subsol. Probele astea nu măsoară randarea (aia se face cu
 * `apps/buletin/unelte/proba-foaie.mjs`), ci păzesc stilul de o „îndreptare" nevinovată.
 */
import { describe, expect, it } from 'vitest'
import { SUBSOL, curatDeMarcaje, foaieHtml, marcaj, sursaMarcata } from '../apps/buletin/src/foaie.js'
import { inaltimeaSemnaturii, inaltimeaTitlului, semne, type NumarCerut } from '../apps/buletin/src/masuri.js'

const cerut: NumarCerut = {
  motto: 'Un citat scurt, cât să încapă pe două rânduri de cursive în capul paginii întâi.',
  motoAutor: 'Părintele Arsenie Papacioc',
  nr: 616,
  data: '2026-09-20',
  principal: { autor: 'SFÂNTUL IERARH NICOLAE', titlu: 'UN TITLU', text: 'Un text scurt.', sursa: 'ziarullumina.ro' },
}

const foaia = (calendar: { tabel: string; stil: string } | null = { tabel: '<table class="program"></table>', stil: '' }): string =>
  foaieHtml({ cerut, dataScrisa: '20 septembrie 2026', calendar })

describe('josul paginii a patra', () => {
  /**
   * ⚠️ De ce contează: un tabel dintr-o cutie `position:absolute` pierde ULTIMUL rând în Chromium
   * (18.09.2026 — „calendarul este în continuare tăiat în partea de jos"): tabelul își socotește
   * înălțimea fără el, subsolul se lipește de rândul dinainte, iar banda de la piciorul duminicii
   * nu se mai desenează. Se repară doar scoțând josul din așezarea absolută.
   */
  it('nu e așezat absolut, ci împins la talpa paginii de o cutie flex', () => {
    const html = foaia()
    expect(html).toMatch(/\.jos \{ position: static;/)
    expect(html).not.toMatch(/\.jos \{ position: absolute/)
    expect(html).toMatch(/\.pagina\.ultima \{ display: flex; flex-direction: column; justify-content: flex-end; \}/)
  })

  it('ține floarea, capul calendarului, tabelul și subsolul, în ordinea asta', () => {
    const html = foaia()
    const jos = html.slice(html.indexOf('<div class="jos">'))
    const locuri = ['class="floare"', 'class="cap-calendar"', 'class="program"', 'class="subsol"'].map((s) => jos.indexOf(s))
    expect(locuri.every((i) => i > 0)).toBe(true)
    expect([...locuri].sort((a, b) => a - b)).toEqual(locuri)
  })
})

describe('zona neagră: autorul cu bară (user, 19.09.2026)', () => {
  const cuAutor = (autor: string): string =>
    foaieHtml({ cerut: { ...cerut, principal: { ...cerut.principal, autor } }, dataScrisa: '20 septembrie 2026', calendar: null })

  it('pune înaintea barei un rând mic deasupra numelui', () => {
    const html = cuAutor('SFÂNTUL CUVIOS MĂRTURISITOR / SOFIAN de la ANTIM')
    expect(html).toContain('<div class="deasupra">SFÂNTUL CUVIOS MĂRTURISITOR</div><div class="nume">SOFIAN de la ANTIM</div>')
    expect(html).toMatch(/\.zona-neagra \.deasupra \{ font-family: "Trajan", serif; font-size: 12pt;/)
  })

  it('lasă autorul fără bară exact ca până acum, pe un singur rând', () => {
    const html = cuAutor('SFÂNTUL IERARH NICOLAE')
    expect(html).toContain('<div class="nume">SFÂNTUL IERARH NICOLAE</div>')
    expect(html).not.toContain('class="deasupra"')
  })
})

describe('semnătura de sub titlu (user, 19.09.2026)', () => {
  const SEMNATURA = 'Text de: Părintele Mihail Stanciu, fost stareț al Mănăstirii Antim'
  const cuSemnatura = (semnatura?: string): string =>
    foaieHtml({
      cerut: { ...cerut, principal: { ...cerut.principal, ...(semnatura ? { semnatura } : {}) } },
      dataScrisa: '20 septembrie 2026',
      calendar: null,
    })

  /**
   * ⚠️ ORDINEA E TOT ROSTUL: semnătura stă ÎNTRE titlu și riglă, nu sub linie. Pusă după riglă, ar
   * arăta ca un început de text, iar rândul aldin n-ar mai fi al titlului.
   */
  it('scrie rândul între titlu și riglă, literă cu literă', () => {
    const html = cuSemnatura(SEMNATURA)
    expect(html).toContain(
      `<h2 class="titlu-articol">UN TITLU</h2><div class="semnatura">${SEMNATURA}</div><div class="rigla"></div>`,
    )
  })

  it('fără semnătură, foaia rămâne exact ca până acum', () => {
    const html = cuSemnatura()
    expect(html).not.toContain('class="semnatura"')
    expect(html).toContain('<h2 class="titlu-articol">UN TITLU</h2><div class="rigla"></div>')
  })

  it('o scrie cu corpul textului, aldin și centrat', () => {
    expect(cuSemnatura(SEMNATURA)).toMatch(
      /\.semnatura \{ font-family: "Caladea", serif; font-size: 15pt; font-weight: 700; line-height: 1\.3;/,
    )
  })

  /**
   * ⚠️ Rigla se desenează cu un selector pe FRATELE DE DINAINTE (`+`). Cu semnătura strecurată
   * între ea și titlu, singurul `.titlu-articol + .rigla` ar fi lăsat-o fără fir — adică linia de
   * sub titlu ar fi dispărut tăcut tocmai la articolele semnate.
   */
  it('păstrează firul riglei și când semnătura s-a așezat înaintea ei', () => {
    expect(cuSemnatura(SEMNATURA)).toContain('.titlu-articol + .rigla, .semnatura + .rigla { border-top: .5pt solid #000;')
  })
})

describe('măsurile cerute de user pe 18.09.2026', () => {
  // 4.9 mm de margine, ca de la cerneală la cerneală să iasă cei 0.5 cm ceruți (aerul de deasupra
  // majusculelor Trajan intră și el în gol) — vezi comentariul din stilul foii.
  it('lasă 0.5 cm între floare și „PROGRAMUL LITURGIC"', () => {
    expect(foaia()).toMatch(/\.floare \{ display: block; margin: 0 auto 4\.9mm;/)
  })

  it('scrie capul calendarului la 24 pt (18 → 20 → 24, două cereri în aceeași zi)', () => {
    expect(foaia()).toMatch(/\.cap-calendar \{ font-family: "Trajan", serif; font-size: 24pt;/)
  })

  it('scrie adresa parohiei aldin, iar rândul abonării nu', () => {
    const html = foaia()
    expect(html).toMatch(/\.subsol \.adresa \{ font-weight: 700; \}/)
    expect(html).toContain(`<div class="adresa">${SUBSOL[SUBSOL.length - 1]}</div>`)
    expect(html).toContain(`<div>${SUBSOL[0]}</div>`)
  })
})

/**
 * RÂNDUL DE PE URMĂ AL BUCĂȚII TĂIATE LA HOTARUL COLOANEI (user, 20.09.2026, 08:11: „la fiecare
 * pagină ciornă — colțul dreapta jos, adică col2, jos — nu mai este justify: propoziția nu se duce
 * până la capăt").
 *
 * ⚠️ De ce contează: CSS-ul nu întinde NICIODATĂ ultimul rând al unui bloc, iar curgerea noastră
 * taie paragraful la piciorul FIECĂREI coloane — acolo rândul de pe urmă e „ultimul" doar pentru
 * CSS, fraza merge mai departe în coloana următoare. Se vedea la coloana a doua fiindcă golul cade
 * în colțul foii, lângă chenar, dar era la piciorul fiecărei coloane.
 *
 * Măsurat în Chromium pe foaia de probă (20.09.2026, `unelte/proba-foaie.mjs --gol --secundari 2`):
 * înainte, ultimul rând al coloanei se oprea cu până la 91.17 px din 321.48 înainte de margine;
 * după, toate cele șase hotare de coloană ating marginea (gol 0.00 px), iar paragrafele care se
 * încheie cu adevărat — cele dinaintea rândului „Sursa:" — au rămas cu rândul scurt, cum se cuvine.
 *
 * Probele de aici sunt cele care se pot face fără randare: că regula CSS există, că marcajul se
 * pune într-un singur loc — ramura „a rămas coadă" a curgerii — și că foaia nu-l scrie niciodată
 * ea însăși pe vreun paragraf.
 */
describe('justify la piciorul coloanei (user, 20.09.2026)', () => {
  it('are o regulă numai a ei, peste justify-ul obișnuit al paragrafului', () => {
    const html = foaia()
    expect(html).toContain('p.t { margin: 0; text-align: justify; text-indent: 10mm; hyphens: none; }')
    expect(html).toContain('p.t.continua { text-align-last: justify; }')
  })

  /**
   * ⚠️ Rostul e „DOAR pe ramura cu coadă": un paragraf care chiar se încheie în coloană (cel dinaintea
   * rândului „Sursa:") trebuie să rămână cu rândul de pe urmă scurt — întins, ar arăta ca o greșeală
   * de cules. De aceea atribuirea trebuie să fie una singură și să stea în `if (coada)`.
   */
  it('pune marcajul doar pe bucata care a rămas cu coadă, și nicăieri altundeva', () => {
    const html = foaia()
    const curgerea = html.slice(html.indexOf('function curge()'), html.indexOf('</script>'))
    expect(curgerea.match(/className \+= ' continua'/g)).toHaveLength(1)
    expect(curgerea).toMatch(/if \(coada\) \{[\s\S]{0,400}?bucata\.className \+= ' continua';/)
    // coada plecată mai departe începe curată: dacă ea se încheie în coloana următoare, rămâne scurtă
    expect(curgerea).toMatch(/p\.className = 't';/)
  })

  it('nu iese din worker pe niciun paragraf: îl pune numai curgerea, în pagină', () => {
    const html = foaieHtml({
      cerut: { ...cerut, principal: { ...cerut.principal, text: 'Un paragraf scurt.\n\nȘi încă unul.' } },
      dataScrisa: '20 septembrie 2026',
      calendar: null,
    })
    expect(html).toContain('<p class="t prim">Un paragraf scurt.</p>')
    expect(html).toContain('<p class="t">Și încă unul.</p>')
    expect(html).not.toContain('class="t continua"')
    expect(html).not.toContain('class="t prim continua"')
  })
})

/**
 * MARCAJELE OMULUI (user, 19.09.2026, 18:01: „aș vrea atât în texte cât și în titluri să am italic
 * și bold: plain text: `_italic_` și `*bold*`… și la sursa și la textul mare conținut articol").
 *
 * O singură convenție peste toate câmpurile de text ale foii. Probele de aici păzesc două lucruri
 * deodată: că marcajul se pune unde trebuie ȘI că nu se pune unde nu trebuie — un `_` dintr-un URL
 * sau steluța înmulțirii sunt litere, nu porunci.
 */
describe('marcajele textului: _cursiv_ și *aldin*', () => {
  const cuText = (text: string): string =>
    foaieHtml({ cerut: { ...cerut, principal: { ...cerut.principal, text } }, dataScrisa: '20 septembrie 2026', calendar: null })
  const cuTitlu = (titlu: string): string =>
    foaieHtml({ cerut: { ...cerut, principal: { ...cerut.principal, titlu } }, dataScrisa: '20 septembrie 2026', calendar: null })

  it('face cursiv ce stă între liniuțe de jos', () => {
    expect(marcaj('a spus _cu blândețe_ atunci')).toBe('a spus <i>cu blândețe</i> atunci')
    expect(cuText('a spus _cu blândețe_ atunci')).toContain('a spus <i>cu blândețe</i> atunci')
  })

  it('face aldin ce stă între steluțe', () => {
    expect(marcaj('a spus *răspicat* atunci')).toBe('a spus <b>răspicat</b> atunci')
    expect(cuText('a spus *răspicat* atunci')).toContain('a spus <b>răspicat</b> atunci')
  })

  it('le ține pe amândouă, în orice ordine le-a scris omul', () => {
    expect(marcaj('_*amândouă*_')).toBe('<i><b>amândouă</b></i>')
    expect(marcaj('*_amândouă_*')).toBe('<b><i>amândouă</i></b>')
  })

  /** ⚠️ Rostul regulii prudente: semnele astea se scriu și fără să însemne ceva. */
  it('lasă în pace steluța înmulțirii, liniuțele dintr-un nume și cele dintr-un URL', () => {
    expect(marcaj('5 * 3 = 15')).toBe('5 * 3 = 15')
    expect(marcaj('nume_fisier_2')).toBe('nume_fisier_2')
    expect(marcaj('http://x.ro/a_b_c')).toBe('http://x.ro/a_b_c')
    // dublate, sunt ale omului: markdown-ul cu `**` și `__` nu e convenția foii
    expect(marcaj('**x**')).toBe('**x**')
    expect(marcaj('__x__')).toBe('__x__')
  })

  it('pune marcajele DUPĂ escapare, deci din text nu iese alt HTML', () => {
    expect(cuText('un <script>rău</script> și *bun*')).toContain('un &lt;script&gt;rău&lt;/script&gt; și <b>bun</b>')
  })

  it('marchează titlul și, doar atunci, încorporează Trajan Bold', () => {
    const html = cuTitlu('DESPRE *POST*')
    expect(html).toContain('<h2 class="titlu-articol">DESPRE <b>POST</b></h2>')
    // (sub vitest fișierele binare vin goale, deci se probează fața, nu octeții ei)
    expect(html).toMatch(/font-family: "Trajan"; src: url\(data:font\/otf;base64,[^)]*\) format\("opentype"\); font-weight: 700;/)
    expect(html).toMatch(/\.titlu-articol b \{ font-weight: 700; \}/)
    // fără titlu aldin, fontul Bold NU se încarcă degeaba: 216 KB de base64 în fiecare foaie
    expect(foaia()).not.toMatch(/format\("opentype"\); font-weight: 700;/)
  })

  it('marchează semnătura, mențiunea și motto-ul', () => {
    const html = foaieHtml({
      cerut: {
        ...cerut,
        motto: 'Un citat _plecat_ din inimă.',
        principal: { ...cerut.principal, semnatura: 'Text de: _Părintele Mihail_', nota: 'Mesajul *Patriarhului*' },
      },
      dataScrisa: '20 septembrie 2026',
      calendar: null,
    })
    expect(html).toContain('<div class="semnatura">Text de: <i>Părintele Mihail</i></div>')
    expect(html).toContain('<div class="nota">Mesajul <b>Patriarhului</b></div>')
    expect(html).toContain('<p class="motto">Un citat <i>plecat</i> din inimă.</p>')
    expect(html).toMatch(/\.semnatura i \{ font-style: italic; \}/)
  })

  /**
   * ⚠️ SOCOTEALA NU NUMĂRĂ MARCAJELE. Steluțele nu ajung pe hârtie, deci un titlu marcat trebuie să
   * coste exact cât același titlu nemarcat — altfel `*DESPRE* _POST_` ar părea cu patru litere mai
   * lung decât e și socoteala ar refuza text care încape.
   */
  it('nu le numără ca litere: măsurile ies aceleași cu și fără marcaje', () => {
    expect(curatDeMarcaje('*DESPRE* _POST_')).toBe('DESPRE POST')
    expect(curatDeMarcaje('nume_fisier_2')).toBe('nume_fisier_2')
    expect(inaltimeaTitlului('*DESPRE* _POST_', true)).toBe(inaltimeaTitlului('DESPRE POST', true))
    expect(inaltimeaTitlului('*DESPRE* _POST_', false)).toBe(inaltimeaTitlului('DESPRE POST', false))
    expect(inaltimeaSemnaturii('Text de: _Părintele Mihail_')).toBe(inaltimeaSemnaturii('Text de: Părintele Mihail'))
    expect(semne('a spus *răspicat* atunci')).toBe(semne('a spus răspicat atunci'))
  })
})

/**
 * BARA = RÂND NOU ÎN TITLU ȘI ÎN SEMNĂTURĂ (user, 19.09.2026, 18:07: „am vrut să scriu și la titlu
 * principal așa CHIPUL BLÂND/ AL DUHOVNICULUI și nu a mers… `/` să fie rând următor").
 *
 * Probele păzesc și marginea regulii: bara e literă în paragrafe („și/sau") și în sursă („x.ro/a/b"),
 * unde o rupere de rând ar strica un link. De asta nu e marcaj de text, ci funcție chemată anume.
 */
describe('bara care rupe rândul, în titlu și în semnătură', () => {
  const cuTitlu = (titlu: string): string =>
    foaieHtml({ cerut: { ...cerut, principal: { ...cerut.principal, titlu } }, dataScrisa: '20 septembrie 2026', calendar: null })

  it('rupe titlul la bară și nu lasă nici bara, nici aerul din jurul ei', () => {
    expect(cuTitlu('CHIPUL BLÂND/ AL DUHOVNICULUI'))
      .toContain('<h2 class="titlu-articol">CHIPUL BLÂND<br>AL DUHOVNICULUI</h2>')
    expect(cuTitlu('CHIPUL BLÂND / AL DUHOVNICULUI'))
      .toContain('<h2 class="titlu-articol">CHIPUL BLÂND<br>AL DUHOVNICULUI</h2>')
  })

  /** ⚠️ Marcajul se pune întâi, bara pe urmă: altfel steluța ar cădea peste `<br>`-ul deja scris. */
  it('merge împreună cu aldinul, pe aceeași bucată', () => {
    expect(cuTitlu('*CHIPUL BLÂND*/ AL DUHOVNICULUI'))
      .toContain('<h2 class="titlu-articol"><b>CHIPUL BLÂND</b><br>AL DUHOVNICULUI</h2>')
  })

  it('lasă neatins titlul fără bară', () => {
    expect(cuTitlu('UN TITLU')).toContain('<h2 class="titlu-articol">UN TITLU</h2>')
  })

  it('rupe și semnătura', () => {
    const html = foaieHtml({
      cerut: { ...cerut, principal: { ...cerut.principal, semnatura: 'Text de: Părintele Mihail / Mănăstirea Antim' } },
      dataScrisa: '20 septembrie 2026',
      calendar: null,
    })
    expect(html).toContain('<div class="semnatura">Text de: Părintele Mihail<br>Mănăstirea Antim</div>')
  })

  it('NU rupe textul articolului: acolo bara e literă', () => {
    const html = foaieHtml({
      cerut: { ...cerut, principal: { ...cerut.principal, text: 'despre post și/sau rugăciune' } },
      dataScrisa: '20 septembrie 2026',
      calendar: null,
    })
    expect(html).toContain('despre post și/sau rugăciune')
    expect(html).not.toContain('și<br>sau')
  })

  it('NU rupe sursa: un URL cu bare rămâne întreg', () => {
    expect(sursaMarcata('http://x.ro/a/b')).toBe('<b>http://x.ro/a/b</b>')
  })
})

/**
 * RÂNDUL „Sursa:" (user, 19.09.2026, 17:30: „să meargă și un link care e pus doar ca domeniu… sau o
 * carte în care folosim bold italic și scris normal… dar și combinație").
 *
 * Reperul e nr. 615, singurul număr vechi rămas pe disc: acolo „Sursa: " e scris normal (Calibri
 * regular), iar „ziarullumina.ro" aldin (Calibri-Bold) — deci domeniul rămâne aldin ca atunci.
 *
 * ⚠️ Din 19.09.2026, 18:01 marcajele sursei sunt cele ale întregii foi: titlul cărții se cere aldin
 * cursiv, deci se scrie `_*Așa*_`. Steluțele singure nu-l mai fac și cursiv.
 */
describe('marcajul rândului „Sursa:"', () => {
  const cuSursa = (s: string): string =>
    foaieHtml({ cerut: { ...cerut, principal: { ...cerut.principal, sursa: s } }, dataScrisa: '20 septembrie 2026', calendar: null })

  it('scrie aldin un domeniu pus singur, ca în nr. 615', () => {
    expect(sursaMarcata('doxologia.ro')).toBe('<b>doxologia.ro</b>')
    expect(cuSursa('doxologia.ro')).toContain('Sursa: <b>doxologia.ro</b>')
  })

  it('scrie titlul cărții aldin cursiv, iar editura, anul și pagina normal', () => {
    const scris = sursaMarcata('_*Cuvinte de folos*_, Editura Doxologia, 2020, p. 12')
    expect(scris).toBe('<i><b>Cuvinte de folos</b></i>, Editura Doxologia, 2020, p. 12')
    // ⚠️ „p. 12" și anul NU sunt domenii: un TLD deschis le-ar fi făcut aldine
    expect(scris).not.toContain('<b>p')
    expect(scris).not.toContain('<b>2020')
  })

  it('le ține pe amândouă în același rând: cartea aldin cursiv, domeniul aldin, restul normal', () => {
    expect(sursaMarcata('_*Cuvinte de folos*_, Iași, 2020; doxologia.ro'))
      .toBe('<i><b>Cuvinte de folos</b></i>, Iași, 2020; <b>doxologia.ro</b>')
    expect(cuSursa('_*Cuvinte de folos*_, Iași, 2020; doxologia.ro'))
      .toContain('Sursa: <i><b>Cuvinte de folos</b></i>, Iași, 2020; <b>doxologia.ro</b>')
  })

  /** Marcajele sursei sunt cele ale foii: steluțele singure o îngroașă, fără să o încline. */
  it('ascultă de aceeași convenție ca restul foii: *aldin*, _cursiv_', () => {
    expect(sursaMarcata('*Cuvinte de folos*, Iași')).toBe('<b>Cuvinte de folos</b>, Iași')
    expect(sursaMarcata('_Cuvinte de folos_, Iași')).toBe('<i>Cuvinte de folos</i>, Iași')
  })

  /** Fără regula asta, toate numerele deja compuse și-ar schimba fața la o recompunere. */
  it('lasă aldină ÎNTREAGĂ o sursă fără marcaje și fără domeniu, ca până acum', () => {
    expect(sursaMarcata('Părintele X, predică')).toBe('<b>Părintele X, predică</b>')
    expect(cuSursa('Părintele X, predică')).toContain('Sursa: <b>Părintele X, predică</b>')
  })

  it('nu se încrede în prescurtările unei trimiteri de carte („vol.II", „Ed.IBMBOR")', () => {
    expect(sursaMarcata('_*Omilii la Matei*_, vol.II, Ed.IBMBOR, p.45'))
      .toBe('<i><b>Omilii la Matei</b></i>, vol.II, Ed.IBMBOR, p.45')
  })

  it('prinde și un URL întreg, dar lasă punctul de la capăt în afara aldinei', () => {
    expect(sursaMarcata('vezi https://doxologia.ro/cuvinte-de-folos.'))
      .toBe('vezi <b>https://doxologia.ro/cuvinte-de-folos</b>.')
  })

  /** ⚠️ Liniuțele de jos dintr-un URL sunt ale adresei, nu marcaje: altfel linkul iese rupt. */
  it('nu taie un URL cu liniuțe de jos în el', () => {
    expect(sursaMarcata('http://x.ro/a_b_c')).toBe('<b>http://x.ro/a_b_c</b>')
  })

  /** Un domeniu marcat de om rămâne cum l-a vrut el: aldinul nu se pune de două ori. */
  it('nu mai aldinește domeniul care stă deja într-un marcaj', () => {
    expect(sursaMarcata('_doxologia.ro_')).toBe('<i>doxologia.ro</i>')
  })

  it('escapează înainte să pună marcajele, deci din sursă nu iese alt HTML', () => {
    expect(sursaMarcata('*<b>x</b>*')).toBe('<b>&lt;b&gt;x&lt;/b&gt;</b>')
  })
})
