import { describe, expect, it } from 'vitest'
// @ts-expect-error — modul JS al importului, fără typings; probele îl folosesc ca atare
import { autorulDinCap, autorulScris, desparte, eNume, eSinaxar } from '../infrastructure/import/chinonic/titlu-autor.mjs'

/**
 * TITLUL ȘI AUTORUL textelor citite la chinonic (user, 16.09.2026: „Titlul este incomplet și o parte
 * s-a dus la autor… Toate trebuie să aibă titlu și autor").
 *
 * În buletin titlul e rupt pe rânduri de lățimea coloanei, nu de înțeles, iar autorul e scris imediat
 * după el — uneori pe același rând îngroșat, alteori pe primul rând al textului. Despărțirea lor e
 * ghicită după formă, deci se poate strica în tăcere: un titlu ciuntit și un nume care nu e nume
 * arată la fel de bine în cod și la fel de rău pe pagină.
 *
 * Fiecare probă de aici e un articol adevărat din arhivă, care a ieșit prost înainte de îndreptare.
 */

describe('un rând e numele autorului', () => {
  it('numele cu titlu de cinste', () => {
    expect(eNume('Sfântul Nicolae Velimirovici')).toBe(true)
    expect(eNume('Protos. Arsenie Muscalu')).toBe(true)
    expect(eNume('ÎPS Athanasie de Limasol')).toBe(true)
    expect(eNume('Arhim. Varnava Iankos')).toBe(true)
  })

  it('numele fără titlu de cinste, scris tot cu majuscule', () => {
    expect(eNume('Stephen Freeman')).toBe(true)
    expect(eNume('Doxologia')).toBe(true)
  })

  it('urmarea unui titlu NU e nume, oricât ar semăna', () => {
    // scrise cu literă mică la început: „…ci în chipul vieţii / trece prin omul cel launtric"
    expect(eNume('trece prin omul cel launtric')).toBe(false)
    expect(eNume('care au mărturisit în cetatea Sevastiei')).toBe(false)
    // cifre înăuntru: o dată, nu un om
    expect(eNume('Partea I (ASCOR IAȘI, 16 noiembrie 2018)')).toBe(false)
    // ⚠️ două puncte în mijloc: rândul spune ceva despre text. Așa ajungea „Sursa: Fișier PDF" autor
    expect(eNume('Sursa: Fișier PDF')).toBe(false)
  })
})

describe('despărțirea capului în titlu și autor', () => {
  it('titlul rupt pe două rânduri rămâne întreg, iar numele de sub el e autorul', () => {
    // fișa semnalată de user: titlul se oprea la „Paști –", restul plecase la autor
    expect(desparte([
      'Predică la duminica a VI-a după Paști –',
      'Despre vindecarea minunată a orbului din naștere',
      'Sfântul Nicolae Velimirovici',
    ])).toEqual({
      titlu: 'Predică la duminica a VI-a după Paști – Despre vindecarea minunată a orbului din naștere',
      autor: 'Sfântul Nicolae Velimirovici',
    })
  })

  it('titlul care se termină în două puncte își ia urmarea', () => {
    expect(desparte([
      'Predică la Duminica a 6-a după Rusalii:',
      'Vindecarea slăbănogului din Capernaum (Matei 9, 1-8)',
      'Părintele Petroniu Tănase',
    ])).toEqual({
      titlu: 'Predică la Duminica a 6-a după Rusalii: Vindecarea slăbănogului din Capernaum (Matei 9, 1-8)',
      autor: 'Părintele Petroniu Tănase',
    })
  })

  it('o propoziție nouă se leagă cu linie, o urmare a frazei doar cu spațiu', () => {
    expect(desparte(['Cuvânt în cea de-a XXXII-a Duminică după Cincizecime', 'Despre Zaheu', 'Sfântul Ignatie Briancianinov']).titlu)
      .toBe('Cuvânt în cea de-a XXXII-a Duminică după Cincizecime – Despre Zaheu')
    // ⚠️ „la" cere urmarea, nu o linie: ieșea „…Dumitru Stăniloae la – Duminica samarinencei"
    expect(desparte(['Predica părintelui Dumitru Stăniloae la', 'Duminica samarinencei']).titlu)
      .toBe('Predica părintelui Dumitru Stăniloae la Duminica samarinencei')
  })

  it('citatul rupt în două nu se sparge', () => {
    expect(desparte([
      '„N-o să fie nimic mai mult și nimic mai puțin decât',
      'ceea ce va îngădui Dumnezeu”',
      'Mitropolitul Athanasie de Limassol',
    ])).toEqual({
      titlu: '„N-o să fie nimic mai mult și nimic mai puțin decât ceea ce va îngădui Dumnezeu”',
      autor: 'Mitropolitul Athanasie de Limassol',
    })
  })

  it('după virgulă urmează titlul, nu autorul — chiar dacă rândul pare un nume', () => {
    // „Ocrotitorul Bucureștilor" e scris tot cu majuscule, dar virgula de dinainte îl cere titlului
    expect(desparte(['Viaţa Sfântului Cuvios Dimitrie cel Nou,', 'Ocrotitorul Bucureștilor']))
      .toEqual({ titlu: 'Viaţa Sfântului Cuvios Dimitrie cel Nou, Ocrotitorul Bucureștilor', autor: '' })
  })

  it('un titlu lung, pe cinci rânduri, rămâne întreg și fără autor', () => {
    expect(desparte([
      'Cuvânt de învătătură',
      'al celui între sfinți părintelui nostru Ioan Gură de Aur,',
      'arhiepiscopul Constantinopolului,',
      'în sfânta și luminata zi',
      'a slăvitei și mântuitoarei Învieri',
      'a lui Hristos, Dumnezeul nostru',
    ])).toEqual({
      titlu: 'Cuvânt de învătătură al celui între sfinți părintelui nostru Ioan Gură de Aur,'
        + ' arhiepiscopul Constantinopolului, în sfânta și luminata zi a slăvitei și mântuitoarei'
        + ' Învieri a lui Hristos, Dumnezeul nostru',
      autor: '',
    })
  })

  it('autorul din mijlocul capului își ia și lămuririle de sub el', () => {
    expect(desparte([
      'Conferința',
      '„Calea vieții duhovnicești – de la minte la inimă”',
      'Protos. Arsenie Muscalu',
      '(duhovnicul Mănăstirii „Sf. Eufrosina")',
    ])).toEqual({
      titlu: 'Conferința – „Calea vieții duhovnicești – de la minte la inimă”',
      autor: 'Protos. Arsenie Muscalu (duhovnicul Mănăstirii „Sf. Eufrosina")',
    })
  })
})

describe('autorul luat din capul textului', () => {
  const lung = 'Anul îţi va merge bine nu când tu vei sta beat în ziua cea dintâi a lui, ci când, atât'
    + ' în ziua cea dintâi, cât şi în cea de pe urmă, şi în fiecare zi, vei face fapte plăcute lui'
    + ' Dumnezeu, fiindcă ziua se face bună nu de la fire, ci de la sârguinţa noastră.'

  it('numele de pe primul rând al textului trece la autor și iese din text', () => {
    expect(autorulDinCap('', ['Sfântul Ioan Gură de Aur', lung]))
      .toEqual({ autor: 'Sfântul Ioan Gură de Aur', paragrafe: [lung] })
  })

  it('lămurirea numelui vine odată cu el', () => {
    const r = autorulDinCap('', ['Părintele Partenie', 'Starețul Mănăstirii Sfântul Pavel', lung])
    expect(r.autor).toBe('Părintele Partenie, Starețul Mănăstirii Sfântul Pavel')
    expect(r.paragrafe).toEqual([lung])
  })

  it('autorul găsit deja în titlu are întâietate — textul nu se atinge', () => {
    expect(autorulDinCap('Sfântul Teofan Zăvorâtul', ['Părintele Petroniu', lung]))
      .toEqual({ autor: 'Sfântul Teofan Zăvorâtul', paragrafe: ['Părintele Petroniu', lung] })
  })

  it('⚠️ numele NU se scoate când e tot ce avem — fișa ar rămâne goală', () => {
    // la vreo 25 de articole buletinul n-avea decât poza, linkul și numele autorului
    expect(autorulDinCap('', ['Sfântul Ioan Gură de Aur', 'Cuvânt scurt.']))
      .toEqual({ autor: '', paragrafe: ['Sfântul Ioan Gură de Aur', 'Cuvânt scurt.'] })
  })

  it('un text care începe cu proză rămâne neatins', () => {
    expect(autorulDinCap('', ['Iubiţi creştini,', lung]))
      .toEqual({ autor: '', paragrafe: ['Iubiţi creştini,', lung] })
  })
})

/**
 * SINAXARUL NU ARE AUTOR, ARE UN FEL (user, 16.09.2026: „titlu + autor (Sinaxar sau fără autor ca
 * excepție)"). Vieţile sfinţilor chiar n-au un scriitor al lor; „Fără autor" la ele se citeşte ca o
 * scăpare. Regula ghiceşte după forma titlului, deci se poate strica în tăcere — de aceea probele.
 */
describe('sinaxarele își iau autorul din felul lor', () => {
  it('viețile sfinților sunt sinaxare', () => {
    expect(eSinaxar('Viața Sfântului Cuvios Ioan de la Prislop (secolele XV-XVI)')).toBe(true)
    expect(eSinaxar('Viaţa Sfintei Cuvioase Parascheva')).toBe(true)
    expect(eSinaxar('SINAXAR - 14 Septembrie')).toBe(true)
    expect(eSinaxar('Pomenirea Sfântului Noului Mucenic Ioan Valahul (Românul)')).toBe(true)
    expect(eSinaxar('Icoana Maicii Domnului Prodromița')).toBe(true)
    expect(eSinaxar('Moaştele Sfântului Visarion')).toBe(true)
    expect(eSinaxar('Sfântul Mare Mucenic Nichita')).toBe(true)
  })

  it('⚠️ un text SCRIS de cineva nu e sinaxar, oricât de sfânt ar fi în titlu', () => {
    // aici autorul chiar lipseşte şi e de căutat la sursă — „Sinaxar" ar fi o minciună
    expect(eSinaxar('Cuvânt la Sfântul Mare Mucenic Gheorghe')).toBe(false)
    expect(eSinaxar('Predică la Botezul Domnului')).toBe(false)
    expect(eSinaxar('TÂLCUIRE LA PILDA LUCRĂTORILOR CELOR RĂI')).toBe(false)
    expect(eSinaxar('Despre sensul suferintei')).toBe(false)
    expect(eSinaxar('Sfântul Nicolae Velimirovici despre iubirea vrăjmașilor')).toBe(false)
  })

  it('numele găsit are întâietate — „Sinaxar" se pune numai unde n-are nimeni', () => {
    expect(autorulScris('Sfântul Nicolae Velimirovici', 'Viața Sfintei Maria Egipteanca'))
      .toBe('Sfântul Nicolae Velimirovici')
    expect(autorulScris('', 'Viața Sfintei Maria Egipteanca')).toBe('Sinaxar')
    expect(autorulScris('', 'Predică la Duminica înmulțirii pâinilor')).toBe('')
  })
})
