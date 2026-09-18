import { describe, expect, it } from 'vitest'
import type { BibliotecaRadio, StareDirect } from '../packages/contracts/src/index.js'
import { jsPanou } from '../packages/comanda/src/panou.js'
import { corpMic, jsMic, stareMic } from '../apps/live/src/mic.js'
import {
  CINE_CEAS,
  FARA_OM_MS,
  FARA_SUNET_MS,
  ISTORIE_MAX,
  albumeDin,
  alegeAlbum,
  capatAlbumului,
  contorulDeStart,
  durataAlbumului,
  eRotireaPornita,
  eScadentaRotirea,
  scadentaRotirii,
  sunetCurat,
  ultimulSunetNou,
  urmatoareaRotire,
} from '../apps/live/src/rotire.js'

/**
 * ROTIREA ALBUMELOR — ceasul care schimbă albumul când nu mai comandă nimeni.
 *
 * Probele de aici păzesc socoteala PURĂ, scoasă dinadins din obiectul durabil: alarma, comanda și
 * ceasul radioului se pot încerca doar cu un worker pornit, dar „când e scadentă rotirea" și „ce
 * album urmează" se pot proba în Node, iar ele sunt tocmai lucrurile care se strică tăcut. O greșeală
 * aici nu cade la typecheck: se vede abia peste o zi, în biserică, prin faptul că muzica se schimbă
 * când n-ar trebui — sau nu se schimbă deloc.
 */

/** O bibliotecă cu mai multe albume, fiecare cu piesele lui. */
const BIBLIOTECA = (albume: Record<string, number[]>): BibliotecaRadio => ({
  generat_la: '',
  semnatura: 'x',
  fisiere: Object.entries(albume).flatMap(([dir, durate]) =>
    durate.map((d, i) => ({ cale: `${dir}/${String(i + 1).padStart(2, '0')}.mp3`, durata: d })),
  ),
})

const B = BIBLIOTECA({
  'DIVERSE/Album A': [100, 100, 100],
  'DIVERSE/Album B': [60, 60],
  'DIVERSE/Album C': [200],
  '02. Triod/02. Postul Mare/Cântări': [50],
})

const T0 = Date.UTC(2026, 8, 18, 10, 0, 0)
const ISO = (t: number) => new Date(t).toISOString()
const ORA = 60 * 60 * 1000
const MIN = 60 * 1000

describe('albumele dintre care alege ceasul', () => {
  it('ia numai directoarele cu muzică CHIAR în ele', () => {
    expect(albumeDin(B)).toEqual([
      '02. Triod/02. Postul Mare/Cântări',
      'DIVERSE/Album A',
      'DIVERSE/Album B',
      'DIVERSE/Album C',
    ])
  })

  /*
   * ⚠️ Capcana care ar face rotirea să nu mai vină niciodată: `pieseDin` numără RECURSIV, deci
   * `DIVERSE` ar trece drept „album" cu toate piesele bibliotecii în el, iar „capătul albumului" ar
   * fi la capătul întregii muzici a parohiei.
   */
  it('nu ia directoarele-părinte drept albume', () => {
    expect(albumeDin(B)).not.toContain('DIVERSE')
    expect(albumeDin(B)).not.toContain('02. Triod')
    expect(albumeDin(B)).not.toContain('02. Triod/02. Postul Mare')
  })

  it('nu ia directoarele goale — nici pe cele canonice, care există mereu', () => {
    const a = albumeDin(BIBLIOTECA({ 'DIVERSE/Singur': [10] }))
    expect(a).toEqual(['DIVERSE/Singur'])
  })

  it('piesele nemăsurate (durata 0) nu fac un director să fie album', () => {
    expect(albumeDin(BIBLIOTECA({ 'DIVERSE/Nemăsurat': [0, 0] }))).toEqual([])
  })

  it('socotește cât ține un album', () => {
    expect(durataAlbumului(B, 'DIVERSE/Album A')).toBe(300)
    expect(durataAlbumului(B, null)).toBe(0)
  })
})

describe('alegerea albumului următor', () => {
  const albume = ['A', 'B', 'C', 'D', 'E']

  it('nu alege niciodată albumul care cântă acum', () => {
    for (let i = 0; i < albume.length; i++) {
      expect(alegeAlbum(albume, 'C', [], () => i / albume.length)).not.toBe('C')
    }
  })

  it('ocolește și ultimele alese, cât are din ce alege', () => {
    const istorie = ['A', 'B', 'D']
    for (let i = 0; i < 10; i++) {
      expect(alegeAlbum(albume, 'C', istorie, () => i / 10)).toBe('E')
    }
  })

  /*
   * Cu puține directoare, istoria ar bloca rotirea de tot. Regula cerută: atunci se uită istoria și
   * se ocolește DOAR cel curent — mai bine un album auzit alaltăieri decât același la nesfârșit.
   */
  it('cu bibliotecă mică renunță la istorie, dar tot nu repetă curentul', () => {
    const mici = ['A', 'B']
    expect(alegeAlbum(mici, 'A', ['B'], () => 0)).toBe('B')
    expect(alegeAlbum(mici, 'A', ['B'], () => 0.99)).toBe('B')
  })

  it('cu un singur album (sau niciunul) nu face nimic', () => {
    expect(alegeAlbum(['A'], 'A')).toBeNull()
    expect(alegeAlbum([], null)).toBeNull()
  })

  it('un aleator la marginea de sus nu cade în afara listei', () => {
    expect(alegeAlbum(albume, 'A', [], () => 1)).toBe('E')
    expect(alegeAlbum(albume, 'A', [], () => 0)).toBe('B')
  })

  it('istoria ține ultimele câteva, nu toate', () => {
    expect(ISTORIE_MAX).toBe(3)
  })
})

describe('când e scadentă rotirea — fără sunet, ca înainte de microfon', () => {
  it('sub o zi de la comanda omului, nu se rotește nimic', () => {
    expect(eScadentaRotirea(T0 + FARA_OM_MS - 1000, ISO(T0))).toBe(false)
    expect(eScadentaRotirea(T0 + 3600_000, ISO(T0))).toBe(false)
  })

  it('peste o zi, se rotește', () => {
    expect(eScadentaRotirea(T0 + FARA_OM_MS, ISO(T0))).toBe(true)
    expect(eScadentaRotirea(T0 + 3 * FARA_OM_MS, ISO(T0))).toBe(true)
  })

  /*
   * ⚠️ Fără nicio comandă de om știută (obiect durabil proaspăt), radioul se socotește NEPĂZIT, deci
   * rotirea e scadentă pe loc (user, 18.09.2026: „să fie deja peste 24h"). Un radio despre care nu
   * ținem minte nicio apăsare n-a fost atins de nimeni cât ține memoria noastră.
   */
  it('fără nicio comandă de om știută, se socotește nepăzit — rotește pe loc', () => {
    expect(eScadentaRotirea(T0, null)).toBe(true)
    expect(eScadentaRotirea(T0, 'nu e o dată')).toBe(true)
    expect(scadentaRotirii({ acum: T0, ultimaOm: null })).toMatchObject({ comanda: T0, la: T0, motiv: 'comanda' })
  })

  /*
   * ⚠️ SEMĂNATUL CONTORULUI, la prima atingere a obiectului durabil. E cifra din care iese tot restul:
   * o zi ÎN URMĂ, nu `acum`. Cu `acum` (cum era până la 18.09.2026), o aplicație abia publicată ar
   * mai fi lăsat parohia o zi întreagă pe același album, și nimeni n-ar fi știut dacă rotirea merge.
   */
  it('primul contor se seamănă cu o zi în urmă, deci scadența e imediată', () => {
    expect(contorulDeStart(T0)).toBe(ISO(T0 - FARA_OM_MS))
    expect(eScadentaRotirea(T0, contorulDeStart(T0))).toBe(true)
    expect(scadentaRotirii({ acum: T0, ultimaOm: contorulDeStart(T0) }).la).toBe(T0)
    // …și nici sunetul de acum o clipă n-o amână: ziua fără comandă a trecut, iar cele două sunt un SAU
    expect(eScadentaRotirea(T0, contorulDeStart(T0), ISO(T0 - MIN))).toBe(true)
  })

  /*
   * ⚠️ Aparatul fără microfon (versiune veche de daemon) e cazul de pornire, nu unul de margine: cât
   * nu vine nicio măsurătoare, singurul ceas rămâne ziua fără comandă — nici mai devreme, nici mai
   * târziu decât înainte de 18.09.2026.
   */
  it('fără date de sunet, rămâne DOAR ceasul de o zi', () => {
    expect(eScadentaRotirea(T0 + 2 * ORA, ISO(T0), null)).toBe(false)
    expect(eScadentaRotirea(T0 + FARA_OM_MS, ISO(T0), null)).toBe(true)
    expect(scadentaRotirii({ acum: T0, ultimaOm: ISO(T0) })).toMatchObject({
      liniste: null,
      comanda: T0 + FARA_OM_MS,
      la: T0 + FARA_OM_MS,
      motiv: 'comanda',
    })
  })
})

/*
 * CEASUL LINIȘTII (18.09.2026, alegerea utilizatorului: „amândouă"). Microfonul aude și boxele,
 * deci „liniște" nu e zero, ci ce a hotărât aparatul cu pragul lui: noi primim doar clipa ultimei
 * activități. Regula: o oră de liniște pornește rotirea — dar socotită de la cea mai RECENTĂ dintre
 * ultima activitate și ultima comandă de om, ca o apăsare să ceară din nou o oră întreagă.
 */
describe('ceasul liniștii — al doilea ceas al rotirii', () => {
  it('o oră de liniște după o comandă mai veche: se rotește', () => {
    expect(eScadentaRotirea(T0, ISO(T0 - 2 * ORA), ISO(T0 - ORA))).toBe(true)
    // cu un minut mai puțin de liniște, încă nu
    expect(eScadentaRotirea(T0, ISO(T0 - 2 * ORA), ISO(T0 - ORA + MIN))).toBe(false)
  })

  /*
   * ⚠️ Capcana pe care o păzește proba asta: liniștea de dinaintea comenzii nu se pune la socoteală.
   * Altfel Părintele ar apăsa ceva în biserica goală și ar vedea albumul schimbându-se peste câteva
   * minute — „dar tocmai am ales eu muzica".
   */
  it('o comandă de om proaspătă cere din nou o oră întreagă de liniște', () => {
    const om = T0 - 30 * MIN
    expect(eScadentaRotirea(T0, ISO(om), ISO(T0 - ORA))).toBe(false)
    expect(scadentaRotirii({ acum: T0, ultimaOm: ISO(om), ultimulSunet: ISO(T0 - ORA) })).toMatchObject({
      liniste: om + FARA_SUNET_MS,
      comanda: om + FARA_OM_MS,
      la: om + FARA_SUNET_MS,
      motiv: 'liniste',
    })
    // la capătul orei de la comandă, tot fără să se mai fi auzit nimic, se rotește
    expect(eScadentaRotirea(om + FARA_SUNET_MS, ISO(om), ISO(T0 - ORA))).toBe(true)
  })

  /*
   * Cele două ceasuri sunt un SAU, nu un ȘI: o biserică în care se aude lume toată ziua (parastase,
   * repetiții, aspirator) n-ar tăcea niciodată o oră — și totuși, după 24 h fără nicio comandă,
   * albumul tot trebuie schimbat. Asta era regula dinainte și rămâne.
   */
  it('cu sunet proaspăt dar comanda veche de o zi, câștigă ceasul de 24 h', () => {
    const om = T0 - 30 * ORA
    expect(eScadentaRotirea(T0, ISO(om), ISO(T0 - 10 * MIN))).toBe(true)
    expect(scadentaRotirii({ acum: T0, ultimaOm: ISO(om), ultimulSunet: ISO(T0 - 10 * MIN) })).toMatchObject({
      la: om + FARA_OM_MS,
      motiv: 'comanda',
    })
  })

  it('sunetul de dinaintea comenzii nu coboară niciodată scadența sub o oră de la ea', () => {
    const om = T0
    const s = scadentaRotirii({ acum: T0, ultimaOm: ISO(om), ultimulSunet: ISO(T0 - 10 * ORA) })
    expect(s.liniste).toBe(om + FARA_SUNET_MS)
    expect(s.la).toBe(om + FARA_SUNET_MS)
  })
})

/*
 * ⚠️ PORNIREA se uită la sunet, MERSUL nu. Odată ce cântă un album pus de ceas, se sare la capătul
 * fiecăruia până la o comandă de OM — altfel un „bună ziua" auzit la ora trei ar îngheța rotirea pe
 * albumul de atunci, iar a doua zi tot el ar cânta.
 */
describe('rotirea pornită nu se mai uită la sunet', () => {
  const pornita = { acum: T0, ultimaOm: ISO(T0 - 2 * ORA), ultimulSunet: ISO(T0 - MIN) }

  it('cu albumul ales de ceas, rămâne pornită deși tocmai s-a auzit lume', () => {
    expect(eRotireaPornita({ ...pornita, aleasaDeCeas: true })).toBe(true)
    expect(eRotireaPornita({ ...pornita, aleasaDeCeas: false })).toBe(false)
  })

  it('alarma stă atunci pe capătul albumului, nu pe vreo scadență de pornire', () => {
    const baza = { ...pornita, pornit: true, de: ISO(T0 - 100_000), totalS: 300 }
    expect(urmatoareaRotire({ ...baza, aleasaDeCeas: true })).toBe(T0 - 100_000 + 300_000)
    // fără albumul ceasului, aceleași date dau scadența liniștii (o oră de la ce s-a auzit)
    expect(urmatoareaRotire({ ...baza, aleasaDeCeas: false })).toBe(T0 - MIN + FARA_SUNET_MS)
  })

  it('o comandă de om o oprește — ea, nu liniștea', () => {
    // după apăsare, `ultima_om` e chiar acum: niciun ceas nu mai e scadent
    expect(eRotireaPornita({ acum: T0, ultimaOm: ISO(T0), ultimulSunet: ISO(T0 - 5 * ORA), aleasaDeCeas: false })).toBe(
      false,
    )
  })
})

/*
 * `ultimul_sunet` e ținut de worker, nu de aparat: aparatul îl pierde la repornire, iar ceasul lui
 * poate merge înapoi (NTP prins târziu). Dacă l-am lăsa să coboare, o repornire de daemon ar arăta
 * ca o liniște abia începută și ar amâna rotirea — sau, mai rău, ar rescrie trecutul.
 */
describe('ultimul sunet urcă monoton', () => {
  it('o valoare mai nouă îl mută înainte', () => {
    expect(ultimulSunetNou(ISO(T0), ISO(T0 + MIN))).toBe(ISO(T0 + MIN))
    expect(ultimulSunetNou(null, ISO(T0))).toBe(ISO(T0))
  })

  it('un `null` de la un aparat care nu măsoară NU-l șterge', () => {
    expect(ultimulSunetNou(ISO(T0), null)).toBe(ISO(T0))
    expect(ultimulSunetNou(ISO(T0), undefined)).toBe(ISO(T0))
  })

  it('o valoare mai veche (aparat repornit, ceas dat înapoi) nu-l coboară', () => {
    expect(ultimulSunetNou(ISO(T0), ISO(T0 - 5 * ORA))).toBe(ISO(T0))
    expect(ultimulSunetNou(ISO(T0), 'nu e o dată')).toBe(ISO(T0))
  })
})

/*
 * Măsurătoarea vine din telemetrie, adică din afară. Nimic din ce e stricat n-are voie să strice
 * telemetria întreagă (starea aparatului, deciziile lui luate fără internet): câmpul se ignoră.
 */
describe('curățarea câmpului `sunet` din telemetrie', () => {
  it('trece o măsurătoare bună întreagă', () => {
    expect(
      sunetCurat({ nivel: -38.2, varf: -21, prag: -30, ultimul_peste_prag: '2026-09-18T15:40:12Z', fereastra_s: 20 }),
    ).toEqual({
      nivel: -38.2,
      varf: -21,
      prag: -30,
      ultimul_peste_prag: '2026-09-18T15:40:12.000Z',
      fereastra_s: 20,
    })
  })

  it('lipsa măsurătorii e „nu măsoară", nu o eroare', () => {
    expect(sunetCurat(null)).toBeNull()
    expect(sunetCurat(undefined)).toBeNull()
    expect(sunetCurat({})).toBeNull()
    expect(sunetCurat('tare')).toBeNull()
  })

  it('numerele care nu sunt numere și datele care nu sunt date cad, restul rămâne', () => {
    const s = sunetCurat({
      nivel: Number.NaN,
      varf: '-21',
      prag: -30,
      ultimul_peste_prag: 'acum',
      fereastra_s: Number.POSITIVE_INFINITY,
    })
    expect(s).toEqual({ nivel: null, varf: null, prag: -30, ultimul_peste_prag: null, fereastra_s: null })
  })

  it('o clipă bună se normalizează la ISO, ca să se poată compara ca text', () => {
    expect(sunetCurat({ ultimul_peste_prag: '2026-09-18T18:40:12+03:00' })?.ultimul_peste_prag).toBe(
      '2026-09-18T15:40:12.000Z',
    )
  })
})

describe('capătul albumului', () => {
  it('e la o durată întreagă de la pornirea ceasului', () => {
    expect(capatAlbumului(T0, 300, T0)).toBe(T0 + 300_000)
    expect(capatAlbumului(T0, 300, T0 + 10_000)).toBe(T0 + 300_000)
  })

  it('albumul curge în buclă: capătul e următoarea rotire, nu prima', () => {
    expect(capatAlbumului(T0, 300, T0 + 305_000)).toBe(T0 + 600_000)
    expect(capatAlbumului(T0, 300, T0 + 12 * 300_000 + 1)).toBe(T0 + 13 * 300_000)
  })

  it('un ceas stricat nu aruncă — capătul e la o durată de acum', () => {
    expect(capatAlbumului(Number.NaN, 300, T0)).toBe(T0 + 300_000)
  })
})

describe('următoarea alarmă', () => {
  const baza = { acum: T0, ultimaOm: ISO(T0), pornit: true, de: ISO(T0), totalS: 300 }

  /*
   * Cele două reguli, pe scurt: după o comandă de om se așteaptă o zi; după o săritură a ceasului,
   * capătul albumului abia pornit. Restul (întoarcerea din LIVE) iese din aceleași două.
   */
  it('după o comandă de om: la o zi de la ea', () => {
    expect(urmatoareaRotire(baza)).toBe(T0 + FARA_OM_MS)
  })

  it('după o săritură a ceasului: la capătul albumului', () => {
    const dupaSaritura = { ...baza, acum: T0 + FARA_OM_MS, ultimaOm: ISO(T0), de: ISO(T0 + FARA_OM_MS) }
    expect(urmatoareaRotire(dupaSaritura)).toBe(T0 + FARA_OM_MS + 300_000)
  })

  it('cât mai e până la ziua omului, alarma stă pe ea — nu pe capătul albumului', () => {
    expect(urmatoareaRotire({ ...baza, acum: T0 + 3600_000 })).toBe(T0 + FARA_OM_MS)
  })

  /*
   * Întoarcerea la radio după o slujbă: contorul omului n-a fost atins, deci dacă ziua trecuse cât
   * ținea slujba, rotirea reîncepe de la capătul albumului ăstuia — nu peste încă o zi.
   */
  it('la întoarcerea din LIVE cu ziua trecută: capătul albumului de acum', () => {
    const intors = T0 + FARA_OM_MS + 7200_000
    expect(urmatoareaRotire({ ...baza, acum: intors, de: ISO(intors) })).toBe(intors + 300_000)
  })

  it('OPRIT sau LIVE: nicio alarmă, ceasul se stinge', () => {
    expect(urmatoareaRotire({ ...baza, pornit: false })).toBeNull()
    expect(urmatoareaRotire({ ...baza, pornit: false, acum: T0 + 5 * FARA_OM_MS })).toBeNull()
  })

  it('o selecție fără muzică nu programează nimic', () => {
    expect(urmatoareaRotire({ ...baza, totalS: 0 })).toBeNull()
  })

  /*
   * ⚠️ Cu contorul semănat (o zi în urmă), rotirea e SCADENTĂ chiar în clipa programării, iar
   * `urmatoareaRotire` o amână atunci la capătul albumului — regula de la întoarcerea din LIVE, unde
   * albumul chiar a pornit acum. La PRIMA atingere a obiectului durabil regula asta n-ar fi bună
   * (albumul curge în buclă de zile, capătul lui ar veni la o oră neștiută), de aceea
   * `programeazaRotirea` pune acolo alarma pe `acum` — v. `aparat.ts`, semănatul contorului.
   */
  it('cu contorul semănat, scadența a trecut deja: aici alarma cade pe capătul albumului', () => {
    expect(urmatoareaRotire({ ...baza, ultimaOm: contorulDeStart(T0) })).toBe(T0 + 300_000)
    expect(urmatoareaRotire({ ...baza, ultimaOm: null })).toBe(T0 + 300_000)
  })

  /*
   * ⚠️ Alarma nu se reprogramează la fiecare telemetrie (ar fi o scriere la 20 s degeaba): ne trezim
   * când credeam, recitim `ultimul_sunet` și, dacă s-a mai auzit ceva, ne culcăm la loc până la noua
   * oră de liniște. Așa alarma URMĂREȘTE liniștea, cu cel mult o oră în urmă, fără scrieri în plus.
   */
  it('cu sunet, alarma e la cea mai apropiată scadență — și se amână la fiecare trezire degeaba', () => {
    const om = T0 - 2 * ORA
    expect(urmatoareaRotire({ ...baza, ultimaOm: ISO(om), ultimulSunet: ISO(T0 - 10 * MIN) })).toBe(
      T0 - 10 * MIN + FARA_SUNET_MS,
    )
    // trezire la ora aceea, dar între timp s-a auzit iar: scadența se mută, nu se sare
    const trezire = T0 - 10 * MIN + FARA_SUNET_MS
    expect(
      urmatoareaRotire({ ...baza, acum: trezire, ultimaOm: ISO(om), ultimulSunet: ISO(trezire - 5 * MIN) }),
    ).toBe(trezire - 5 * MIN + FARA_SUNET_MS)
  })
})

/*
 * `cine` e text liber în `SelectieRadio` (numele omului din panou, „aparatul (program: …)"), deci
 * ceasul are nevoie de o valoare FIXĂ, pe care n-o poate purta nimeni altcineva: după ea spune
 * panoul „ales de ceas". Dacă cineva o schimbă, rândul din panou tace — de aceea e probată.
 */
describe('semnătura ceasului în selecție', () => {
  it('rotirea semnează cu o valoare fixă, nu cu un nume de om', () => {
    expect(CINE_CEAS).toBe('ceas')
  })
})

/*
 * RÂNDUL DIN PANOU. Scriptul panoului e un text trimis browserului, deci nu-l putem chema aici —
 * dar tocmai fiindcă nu-l vede `tsc`, o formulare ștearsă din greșeală ar tăcea fără să pice nimic.
 * Probele de mai jos păzesc ce SPUNE rândul: ora singură cât e vorba de liniște (cel mult o oră de
 * acum), ziua și ora cât e vorba de comandă (poate fi și mâine), și pricina, nu doar ceasul.
 */
describe('rândul din panou spune și pricina, nu doar ora', () => {
  const js = jsPanou('')

  it('pentru liniște: ora, cu pricina ei', () => {
    expect(js).toContain('"Albumul se schimbă la " + cand(ro.urmatoarea) + " dacă rămâne liniște."')
    expect(js).toContain('ro.motiv === "liniste"')
  })

  it('pentru ziua fără comandă: ziua și ora', () => {
    expect(js).toContain('"Albumul se schimbă " + candZi(ro.urmatoarea) + " dacă nu se dă nicio comandă."')
  })

  it('cât rotirea e pornită, rămâne ce era: doar capătul albumului', () => {
    expect(js).toContain('"Schimbă albumul la " + cand(ro.urmatoarea) + "."')
    expect(js).toContain('"Album ales de ceas, la " + cand(ro.ales_la) + "."')
  })
})

/*
 * `/mic/stare` — pagina microfonului bate la 3 s și de acolo își ia și monitorul de sunet. Ce se
 * adaugă e ADĂUGAT: starea canalului din SFU rămâne neatinsă, altfel pagina nu s-ar mai lega.
 */
describe('starea microfonului poartă și sunetul', () => {
  const canal: StareDirect = { direct: true, configurat: true, de: ISO(T0), sfu: 'active' }

  it('adaugă măsurătoarea și ultima activitate, fără să schimbe restul răspunsului', () => {
    const s = stareMic(canal, {
      sunet: { nivel: -38.2, varf: -21, prag: -30, ultimul_peste_prag: ISO(T0), fereastra_s: 20 },
      ultimul_sunet: ISO(T0),
    })
    expect(s).toMatchObject(canal)
    expect(s.sunet?.nivel).toBe(-38.2)
    expect(s.ultimul_sunet).toBe(ISO(T0))
  })

  it('aparatul care nu măsoară nu strică pagina — câmpurile sunt acolo, goale', () => {
    const s = stareMic({ direct: false, configurat: true }, { sunet: null, ultimul_sunet: null })
    expect(s).toMatchObject({ direct: false, configurat: true })
    expect(s.sunet).toBeNull()
    expect(s.ultimul_sunet).toBeNull()
  })

  /*
   * Monitorul e altceva decât cifrele de ascultare: acelea (legătură, debit, jitter) au înțeles doar
   * cât curge sunetul spre browser, de-aia `#cifre` stă `hidden` până la play. Nivelul măsurat pe
   * aparat trebuie citit de cine DOAR deschide pagina — dacă rândul ar aluneca înapoi în `#cifre`,
   * omul ar vedea o pagină goală și n-ar ști dacă în biserică se aude ceva.
   */
  it('rândul de sunet stă în afara listei ascunse, ca să se vadă și fără play', () => {
    const corp = corpMic()
    expect(corp).toContain('id="c-sunet"')

    const listaAscunsa = corp.slice(corp.indexOf('id="cifre"'))
    expect(listaAscunsa).toContain('hidden')
    expect(listaAscunsa).not.toContain('c-sunet')

    // …și e deasupra ei, într-un `dl` al lui, fără `hidden`.
    const alLui = corp.slice(corp.indexOf('<dl', corp.indexOf('<audio')), corp.indexOf('</dl>'))
    expect(alLui).toContain('c-sunet')
    expect(alLui).not.toContain('hidden')
    expect(alLui).toContain('mic-cifre')
    expect(corp.indexOf('c-sunet')).toBeLessThan(corp.indexOf('id="cifre"'))
  })

  it('scrie ceva lizibil și când nu e nimic de arătat', () => {
    const js = jsMic('')
    expect(js).toContain('aparatul nu măsoară')
    expect(js).toContain('ultima activitate ')
    expect(js).toContain('niciodată')
  })
})
