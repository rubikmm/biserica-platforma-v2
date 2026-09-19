/**
 * HARTA BULETINULUI — potrivitorul determinist, cel care trebuie să meargă FĂRĂ AI.
 *
 * Cererea utilizatorului (19.09.2026, 11:27): „Cu o hartă așa simplă ar trebui să pot lucra și fără
 * AI." Probele de aici sunt chiar măsura vorbei aceleia: fiecare mesaj de mai jos se rezolvă fără
 * niciun apel de model, fără rețea și fără depozit — `potriveste` e o funcție pură.
 *
 * Ce se poate strica TĂCUT, și de asta stă fiecare probă aici:
 *   1. **ordinea treptelor** — dacă „schimbă titlul secundarului 1 în X", spus la mijlocul
 *      chestionarului, ar fi luat drept RĂSPUNS la întrebarea de atunci, textul omului s-ar scrie în
 *      cu totul alt câmp decât a cerut el. Nicio eroare nicăieri, doar o foaie greșită;
 *   2. **confirmarea** — regula e că se confirmă orice instrucțiune LIBERĂ și nu se confirmă
 *      răspunsul la întrebarea pusă. Stricată, fie plictisește cu Da/Nu la fiecare cuvânt, fie
 *      schimbă foaia pe furiș;
 *   3. **`de_la_capat`** — singura acțiune care ȘTERGE. Dacă și-ar pierde confirmarea, un „de la
 *      capăt" scris din greșeală ar goli tot ce s-a strâns;
 *   4. **butoanele** — ele trimit mesaje obișnuite („s1", „s1 titlu"). Dacă potrivitorul nu le-ar mai
 *      recunoaște, drumul fără AI s-ar rupe exact la mijloc, iar „s1" s-ar scrie ca răspuns.
 */
import { describe, expect, it } from 'vitest'
import {
  CUPRINS,
  HARTA_BULETIN,
  type StareHarta,
  actiunileCaOptiuni,
  potriveste,
  traduFapta,
} from '../apps/buletin/src/harta.js'

/** Starea obișnuită: chestionarul a rămas la o întrebare anume. */
const la = (subiect: string, articol: 'principal' | 's1' | 's2' = 'principal', candidati?: string[]): StareHarta => ({
  intrebare: { subiect, articol, ...(candidati ? { candidati } : {}) },
  secundari: articol === 's2' ? 2 : articol === 's1' ? 1 : 0,
})

/** Nicio întrebare pendinte: schița e completă. */
const gata: StareHarta = { intrebare: null, secundari: 0 }

// ---------------------------------------------------------------------------

describe('răspunsurile la întrebarea pendinte — fără confirmare, fiindcă întrebarea a pus-o chatul', () => {
  it('„da" la autor păstrează ce a propus codul; „nu" sare peste', () => {
    const da = potriveste('da', la('autor'))
    expect(da).toMatchObject({ nivel: 'sigur', subiect: 'principal', actiune: 'autor', raspuns: true, confirma: false })

    // ⚠️ traducerea: „da" devine `pastreaza`, FĂRĂ `articol` — așa `buletin.raspunde` vede un răspuns
    // la întrebarea de acum, nu o instrucțiune punctuală (vezi `eRaspunsLaIntrebare`).
    expect(traduFapta({ subiect: 'principal', actiune: 'autor', valoare: 'da', articol: 'principal', raspuns: true }))
      .toMatchObject({ apel: { actiune: 'buletin.raspunde', argumente: { subiect: 'pastreaza' } }, confirma: false })

    const nu = potriveste('nu', la('ani'))
    expect(nu).toMatchObject({ nivel: 'sigur', actiune: 'ani', valoare: 'nu', raspuns: true })
    expect(traduFapta({ subiect: 'principal', actiune: 'ani', valoare: 'nu', raspuns: true }))
      .toMatchObject({ apel: { argumente: { subiect: 'sari' } } })
  })

  it('o cifră la întrebarea titlurilor e titlul ales, iar „da" e chiar primul', () => {
    const cifra = potriveste('2', la('titlu', 's1', ['DESPRE POST', 'POSTUL MARE', 'CUM POSTIM']))
    expect(cifra).toMatchObject({ nivel: 'sigur', subiect: 's1', actiune: 'titlu', valoare: '2', confirma: false })

    // „da" la titluri = titlul 1: `pastreaza` scrie candidatul dintâi (vezi `scrieRaspuns`)
    const da = potriveste('da', la('titlu', 's1', ['DESPRE POST', 'POSTUL MARE']))
    expect(da).toMatchObject({ nivel: 'sigur', valoare: 'da', raspuns: true })
    expect(traduFapta({ subiect: 's1', actiune: 'titlu', valoare: 'da', articol: 's1', raspuns: true }))
      .toMatchObject({ apel: { argumente: { subiect: 'pastreaza' } }, confirma: false })
  })

  it('orice altceva, la o întrebare pendinte, e chiar valoarea ei', () => {
    const p = potriveste('Sfântul Vasile cel Mare', la('autor', 's1'))
    expect(p).toMatchObject({
      nivel: 'sigur', subiect: 's1', actiune: 'autor', valoare: 'Sfântul Vasile cel Mare', confirma: false, raspuns: true,
    })
    expect(traduFapta({ subiect: 's1', actiune: 'autor', valoare: 'Sfântul Vasile cel Mare', articol: 's1', raspuns: true }))
      .toMatchObject({ apel: { argumente: { subiect: 'autor', valoare: 'Sfântul Vasile cel Mare' } } })
  })
})

/**
 * REFUZUL VARIANTELOR — proba faptei din 19.09.2026, 11:03: chatul a propus trei titluri, omul a
 * scris „Niciunul", iar titlul numărului a ieșit pe hârtie chiar „Niciunul".
 *
 * Ce se poate strica tăcut aici: nimic nu dă eroare. Un refuz necitit se scrie liniștit în câmp și
 * se vede abia în PDF — de aceea fiecare formă a lui stă scrisă mai jos, una câte una.
 */
describe('„niciunul" la variantele propuse înseamnă NU, nu valoarea câmpului', () => {
  const titluri = ['DESPRE POST', 'POSTUL MARE', 'CUM POSTIM']

  const FORME = [
    'nu', 'Niciunul', 'niciuna', 'Nici unul', 'NICIUNUL!', 'nu-mi place', 'Nu îmi place niciunul',
    'altul', 'Alta', 'altceva', 'nu am', 'nu știu', 'Nu ştiu.',
  ]

  it('fiecare formă de refuz, la întrebarea titlului, se prinde DETERMINIST ca „sari"', () => {
    for (const forma of FORME) {
      const p = potriveste(forma, la('titlu', 's1', titluri))
      expect(p, forma).toMatchObject({
        nivel: 'sigur', subiect: 's1', actiune: 'titlu', valoare: 'nu', raspuns: true, confirma: false,
      })
      // și traducerea: `sari`, niciodată `titlu` cu vorba omului în el
      expect(traduFapta({ subiect: 's1', actiune: 'titlu', valoare: 'nu', raspuns: true }), forma)
        .toMatchObject({ apel: { actiune: 'buletin.raspunde', argumente: { subiect: 'sari' } }, confirma: false })
    }
  })

  it('la „sari" pe titlu, omul află că poate scrie el titlul oricând', () => {
    const f = traduFapta({ subiect: 's1', actiune: 'titlu', valoare: 'nu', raspuns: true })
    expect(f?.rezumat).toContain('titlu: …')
  })

  it('și celelalte întrebări cu variante iau refuzul drept „sari"', () => {
    for (const camp of ['autor', 'ani', 'pomenire', 'sursa']) {
      const p = potriveste('niciunul', la(camp, 'principal'))
      expect(p, camp).toMatchObject({ nivel: 'sigur', actiune: camp, valoare: 'nu', raspuns: true })
    }
  })

  /**
   * ⚠️ AL DOILEA DRUM: modelul (nivel 2) întoarce `{actiune, valoare}` cu vorba omului, fără să
   * știe că e un refuz. Traducerea îl oprește și acolo — altfel harta ar fi curată, iar foaia tot
   * greșită.
   */
  it('nici pe drumul modelului o vorbă de refuz nu ajunge valoare de titlu', () => {
    expect(traduFapta({ subiect: 's1', actiune: 'titlu', valoare: 'Niciunul' }))
      .toMatchObject({ apel: { actiune: 'buletin.raspunde', argumente: { subiect: 'sari' } }, confirma: false })
    expect(traduFapta({ subiect: 'principal', actiune: 'autor', valoare: 'nu știu', raspuns: true }))
      .toMatchObject({ apel: { argumente: { subiect: 'sari' } } })
  })

  /**
   * ⚠️ EXCEPȚIA, la fel de importantă: „titlu: Niciunul" e o instrucțiune, nu un refuz — omul a
   * numit câmpul și a spus ce pune în el. Fără `numit`, păzitorul de mai sus i-ar fi luat dreptul
   * de a-și intitula articolul cum vrea.
   */
  it('„titlu: Niciunul" rămâne chiar titlul „Niciunul"', () => {
    const p = potriveste('s1 titlu: Niciunul', la('titlu', 's1', titluri))
    expect(p).toMatchObject({
      nivel: 'sigur', subiect: 's1', actiune: 'titlu', valoare: 'Niciunul', articol: 's1', numit: true, confirma: true,
    })
    const f = traduFapta({ subiect: 's1', actiune: 'titlu', valoare: 'Niciunul', articol: 's1', numit: true })
    expect(f?.apel?.argumente).toEqual({ subiect: 'titlu', valoare: 'Niciunul', articol: 's1' })
    expect(f?.rezumat).toBe('Titlul secundarului 1 → „Niciunul"')
  })

  it('o cifră rămâne titlul ales, nu un refuz', () => {
    expect(potriveste('2', la('titlu', 's1', titluri)))
      .toMatchObject({ nivel: 'sigur', subiect: 's1', actiune: 'titlu', valoare: '2', raspuns: true })
  })

  /** Un titlu adevărat care doar SEAMĂNĂ cu un refuz nu se pierde: lista e închisă, nu un tipar larg. */
  it('un titlu care începe cu „nu" se scrie ca titlu', () => {
    const p = potriveste('NU JUDECA', la('titlu', 'principal', titluri))
    expect(p).toMatchObject({ nivel: 'sigur', actiune: 'titlu', valoare: 'NU JUDECA', raspuns: true })
  })
})

describe('sintaxa strictă — instrucțiune liberă, deci CU confirmare și cu interpretarea scrisă', () => {
  it('`motto: …` scrie motto-ul numărului', () => {
    const p = potriveste('motto: Rugăciunea este respirația sufletului', la('text'))
    expect(p).toMatchObject({ nivel: 'sigur', subiect: 'motto', actiune: 'schimba', confirma: true })
    const f = traduFapta({ subiect: 'motto', actiune: 'schimba', valoare: 'Rugăciunea este respirația sufletului' })
    expect(f?.apel).toEqual({ actiune: 'buletin.raspunde', argumente: { subiect: 'motto', valoare: 'Rugăciunea este respirația sufletului' } })
    expect(f?.rezumat).toContain('Motto-ul numărului →')
  })

  it('`s1 titlu: …` nimerește articolul spus anume, nu cel al chestionarului', () => {
    const p = potriveste('s1 titlu: DESPRE POST', la('text', 'principal'))
    expect(p).toMatchObject({ nivel: 'sigur', subiect: 's1', actiune: 'titlu', valoare: 'DESPRE POST', articol: 's1', confirma: true })
    const f = traduFapta({ subiect: 's1', actiune: 'titlu', valoare: 'DESPRE POST', articol: 's1' })
    // ⚠️ interpretarea scrisă negru pe alb: asta citește omul pe butonul Da/Nu
    expect(f?.rezumat).toBe('Titlul secundarului 1 → „DESPRE POST"')
    expect(f?.apel?.argumente).toEqual({ subiect: 'titlu', valoare: 'DESPRE POST', articol: 's1' })
  })

  it('o acțiune fără subiect scris merge la articolul întrebării de acum', () => {
    const p = potriveste('sursa: ziarullumina.ro', la('titlu', 's2'))
    expect(p).toMatchObject({ nivel: 'sigur', subiect: 's2', actiune: 'sursa', valoare: 'ziarullumina.ro' })
  })
})

describe('comenzile scurte', () => {
  it('compune / socoteală / unde am rămas / de la capăt', () => {
    expect(potriveste('compune', la('text'))).toMatchObject({ nivel: 'sigur', subiect: 'numar', actiune: 'compune', confirma: true })
    expect(potriveste('socoteala', gata)).toMatchObject({ subiect: 'numar', actiune: 'socoteste', confirma: false })
    expect(potriveste('unde am rămas?', la('text'))).toMatchObject({ subiect: 'numar', actiune: 'continua', confirma: false })
    expect(potriveste('compune buletinul', gata)).toMatchObject({ subiect: 'numar', actiune: 'compune' })
  })

  it('⚠️ „de la capăt" cere confirmare MEREU — e singura acțiune care șterge', () => {
    const p = potriveste('ia-o de la capăt', la('text'))
    expect(p).toMatchObject({ nivel: 'sigur', subiect: 'numar', actiune: 'de_la_capat', confirma: true })
    const f = traduFapta({ subiect: 'numar', actiune: 'de_la_capat' })
    expect(f?.confirma).toBe(true)
    expect(f?.rezumat).toContain('DE LA CAPĂT')
    expect(f?.apel?.argumente).toEqual({ subiect: 'de_la_capat' })
  })

  it('ștergerea unui secundar spune care', () => {
    expect(potriveste('scoate secundarul 2', gata)).toMatchObject({ nivel: 'sigur', subiect: 's2', actiune: 'sterge', confirma: true })
    expect(potriveste('șterge secundarul', { intrebare: null, secundari: 1 })).toMatchObject({ subiect: 's1', actiune: 'sterge' })
  })
})

describe('cuvinte-cheie: unic, ambiguu, necunoscut', () => {
  it('UN subiect și O acțiune, cu valoarea scoasă din frază — chiar la mijlocul chestionarului', () => {
    const p = potriveste('schimbă titlul secundarului 1 în DESPRE POST', la('text', 'principal'))
    expect(p).toMatchObject({ nivel: 'sigur', subiect: 's1', actiune: 'titlu', valoare: 'DESPRE POST', confirma: true })
  })

  it('două subiecte → „e vorba de X sau de Y?"', () => {
    const p = potriveste('schimbă ceva la motto și la program', gata)
    expect(p).toMatchObject({ nivel: 'nesigur', ce: 'subiect' })
    expect((p as { intre: Array<{ id: string }> }).intre.map((x) => x.id).sort()).toEqual(['motto', 'program'])
  })

  it('un subiect fără acțiune → „nu știu ce să fac cu el", cu acțiunile lui', () => {
    const p = potriveste('vreau să schimb ceva la motto', gata)
    expect(p).toMatchObject({ nivel: 'nesigur', ce: 'actiune', subiect: 'motto' })
    expect((p as { intre: Array<{ id: string }> }).intre.map((x) => x.id)).toEqual(['schimba', 'autor', 'pastreaza'])
  })

  it('⚠️ un text lung nu se caută pe cuvinte: e o valoare, nu o instrucțiune', () => {
    // un motto dictat lung poartă în el și „text", și „titlu", și „program" — potrivirea pe cuvinte
    // l-ar fi trimis în alt câmp, fără nicio eroare nicăieri
    const lung =
      'Rugăciunea este respirația sufletului, iar textul ei nu are titlu și nu ține de niciun program al lumii. ' +
      'Sfinții au spus-o mereu, în toate veacurile, cu aceleași cuvinte simple pe care le auzim și azi în biserică. '.repeat(4)
    expect(lung.length).toBeGreaterThan(400)
    const p = potriveste(lung, la('motto'))
    expect(p).toMatchObject({ nivel: 'sigur', subiect: 'motto', actiune: 'schimba', confirma: false, raspuns: true })
    expect((p as { valoare: string }).valoare).toBe(lung.trim())
  })

  it('nimic din cuprins → necunoscut (dar numai când nu se aștepta un răspuns)', () => {
    expect(potriveste('cât e ceasul?', gata)).toEqual({ nivel: 'necunoscut' })
    expect(potriveste('', gata)).toEqual({ nivel: 'necunoscut' })
  })

  it('„meniu" și „?" cer chiar cuprinsul', () => {
    expect(potriveste('meniu', la('text'))).toEqual({ nivel: 'meniu' })
    expect(potriveste('?', gata)).toEqual({ nivel: 'meniu' })
  })
})

/**
 * SEMNĂTURA DE SUB TITLU (user, 19.09.2026: „adăugăm ca semnătură sub titluri"). Câmpul e nou, dar
 * cuvântul nu: până atunci „semnătura" era un sinonim al AUTORULUI (scrisul alb din zona neagră).
 * Probele de aici păzesc chiar mutarea aceea — și împiedicarea de care se lovește orice vorbă lungă
 * a hărții: „sub TITLU" și „TEXT de" poartă în ele numele altor două acțiuni.
 */
describe('semnătura de sub titlu', () => {
  const VALOARE = 'Text de: Părintele Mihail Stanciu, fost stareț al Mănăstirii Antim'

  it('`semnatura la principal: …` scrie chiar câmpul nou, nu autorul', () => {
    const p = potriveste(`semnatura la principal: ${VALOARE}`, la('text'))
    expect(p).toMatchObject({ nivel: 'sigur', subiect: 'principal', actiune: 'semnatura', valoare: VALOARE, confirma: true })

    const f = traduFapta({ subiect: 'principal', actiune: 'semnatura', valoare: VALOARE, articol: 'principal' })
    expect(f?.apel).toEqual({
      actiune: 'buletin.raspunde',
      argumente: { subiect: 'semnatura', valoare: VALOARE, articol: 'principal' },
    })
    expect(f?.rezumat).toContain('Semnătura de sub titlul articolului principal →')
  })

  /**
   * ⚠️ Fără regula „cea mai anume o înghite pe cea largă", mesajul ar fi aprins și `titlu` (din „sub
   * titlu"), și `text` (din „text de") — iar potrivirea ar fi întrebat „care din ele?" la fiecare
   * semnătură, adică drumul fără AI s-ar fi rupt exact la câmpul cel nou.
   */
  it('„sub titlu" nu aprinde și titlul, „text de" nu aprinde și textul', () => {
    expect(potriveste('s1 sub titlu: Text de: Ion Popescu', gata))
      .toMatchObject({ nivel: 'sigur', subiect: 's1', actiune: 'semnatura', valoare: 'Text de: Ion Popescu' })
  })

  it('autorul rămâne al lui: „s1 autor: …" nu e semnătura', () => {
    expect(potriveste('s1 autor: SFÂNTUL IERARH NICOLAE', gata))
      .toMatchObject({ nivel: 'sigur', subiect: 's1', actiune: 'autor', valoare: 'SFÂNTUL IERARH NICOLAE' })
  })

  it('e o acțiune a fiecărui articol, oferită și pe butoanele nivelului 2', () => {
    for (const care of ['principal', 's1', 's2']) {
      expect(actiunileCaOptiuni(care).map((a) => a.id)).toContain('semnatura')
    }
  })
})

describe('drumul fără AI: meniu → subiect → acțiune → valoare', () => {
  it('⚠️ numele gol al unui subiect e o apăsare de buton, nu un răspuns la întrebare', () => {
    const p = potriveste('s1', la('text', 'principal'))
    expect(p).toMatchObject({ nivel: 'nesigur', ce: 'actiune', subiect: 's1' })
    expect((p as { intre: Array<{ id: string }> }).intre.map((x) => x.id)).toContain('titlu')
  })

  it('⚠️ apăsarea de buton poartă semnul `dinMeniu`: treapta a 2-a e meniu, nu eroare', () => {
    // butonul meniului trimite chiar id-ul subiectului
    expect(potriveste('principal', gata)).toMatchObject({ nivel: 'nesigur', ce: 'actiune', subiect: 'principal', dinMeniu: true })
    // și scris de mână, gol, e tot o apăsare — chiar la mijlocul chestionarului
    expect(potriveste('motto', la('text', 'principal'))).toMatchObject({ ce: 'actiune', subiect: 'motto', dinMeniu: true })
  })

  it('⚠️ nedumerirea chatului NU e meniu: „vreau să schimb ceva la motto" n-are `dinMeniu`', () => {
    // aici chatul chiar nu știe ce vrea omul — textul rămâne „Nu știu ce să fac…", fără „Înapoi"
    expect(potriveste('vreau să schimb ceva la motto', gata)).not.toHaveProperty('dinMeniu')
    // nici ezitarea dintre două SUBIECTE (nivelul 1) nu vine din meniu
    expect(potriveste('schimbă ceva la motto și la program', gata)).not.toHaveProperty('dinMeniu')
  })

  it('drumul înapoi: „înapoi", „meniul", „ce subiecte ai" cer tot cuprinsul', () => {
    expect(potriveste('inapoi', la('text'))).toEqual({ nivel: 'meniu' })
    expect(potriveste('Înapoi la meniu.', gata)).toEqual({ nivel: 'meniu' })
    expect(potriveste('meniul', gata)).toEqual({ nivel: 'meniu' })
    expect(potriveste('Arată-mi meniul', gata)).toEqual({ nivel: 'meniu' })
    expect(potriveste('arată meniul', gata)).toEqual({ nivel: 'meniu' })
    expect(potriveste('ce subiecte ai?', gata)).toEqual({ nivel: 'meniu' })
  })

  it('un subiect cu o singură acțiune se rezolvă din prima („program")', () => {
    expect(potriveste('program', gata)).toMatchObject({ nivel: 'sigur', subiect: 'program', actiune: 'stare', confirma: false })
  })

  it('butonul de nivel 2 cere valoarea, iar valoarea scrisă apoi se confirmă', () => {
    const cerere = potriveste('s1 titlu', la('text'))
    expect(cerere).toEqual({ nivel: 'valoare', subiect: 's1', actiune: 'titlu', articol: 's1' })

    const valoarea = potriveste('DESPRE POST', {
      ...la('text'),
      asteapta: { subiect: 's1', actiune: 'titlu', articol: 's1' },
    })
    expect(valoarea).toMatchObject({ nivel: 'sigur', subiect: 's1', actiune: 'titlu', valoare: 'DESPRE POST', confirma: true })
  })

  it('„nu" la cererea valorii lasă baltă, nu scrie „nu" în foaie', () => {
    const p = potriveste('nu', { ...gata, asteapta: { subiect: 's1', actiune: 'titlu' } })
    expect(p).toEqual({ nivel: 'necunoscut' })
  })
})

describe('ce nu se face de aici', () => {
  it('programul se schimbă în Program, poza se dă din clemă, validarea o apasă omul', () => {
    const program = traduFapta({ subiect: 'program', actiune: 'schimba', valoare: 'mută Vecernia' })
    expect(program?.apel).toBeNull()
    expect(program?.raspuns).toContain('Program')

    const poza = traduFapta({ subiect: 'principal', actiune: 'poza' })
    expect(poza?.apel).toBeNull()

    const valideaza = traduFapta({ subiect: 'numar', actiune: 'valideaza' })
    expect(valideaza?.apel).toBeNull()
    expect(valideaza?.raspuns).toContain('Validează')
  })
})

describe('harta, ca date', () => {
  it('cuprinsul are cele șase subiecte, fiecare cu acțiuni unice, iar potrivitorul e acțiunea ascunsă', () => {
    expect(CUPRINS.map((s) => s.id)).toEqual(['motto', 'principal', 's1', 's2', 'numar', 'program'])
    expect(HARTA_BULETIN.potrivitor).toBe('buletin.harta')
    for (const s of CUPRINS) {
      const ids = s.actiuni.map((a) => a.id)
      expect(new Set(ids).size, `acțiuni dublate la ${s.id}`).toBe(ids.length)
      expect(s.cuvinte.length).toBeGreaterThan(0)
    }
    // butoanele nivelului 2 nu oferă niciodată ce nu se face de aici
    expect(actiunileCaOptiuni('numar').map((a) => a.id)).not.toContain('valideaza')
    expect(actiunileCaOptiuni('program').map((a) => a.id)).toEqual(['stare'])
  })
})
