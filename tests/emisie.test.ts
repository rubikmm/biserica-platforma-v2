import { describe, expect, it } from 'vitest'
import { PERMISIUNI_IMPLICITE, STRUCTURA_CANONICA, type BibliotecaRadio, type SelectieRadio } from '../packages/contracts/src/index.js'
import { ceSeAude, ordineNaturala, pieseDin, playlist, toateDirectoarele } from '../packages/comanda/src/ceas.js'
import { corpPanou, jsPanou } from '../packages/comanda/src/panou.js'
import { jsPlayer } from '../packages/comanda/src/player.js'
import { jsBiblioteca } from '../apps/radio/src/biblioteca-pagina.js'
import { jsMic } from '../apps/radio/src/mic.js'
import { caleCurata, eAudio } from '../apps/radio/src/cai.js'

/**
 * EMISIA — `live` și `radio`, cele două aplicații în care s-a împărțit `transmisiuni` din V1.
 *
 * Probele de aici păzesc lucrurile care, dacă se rup, se rup TĂCUT — adică se văd abia când cineva
 * ascultă, nu când rulează typecheck-ul:
 *   - ceasul radioului (ce piesă, ce secundă): dacă socoteala alunecă, pagina arată o melodie și
 *     boxele bisericii cântă alta;
 *   - căile din bibliotecă: bucketul ține și arhiva de slujbe, iar o cale scăpată ar lăsa un
 *     formular să șteargă înregistrările parohiei;
 *   - scripturile paginilor: un accent grav rătăcit trece de `tsc` și cade abia la publicare, iar
 *     o adresă absolută în ele ar lega pagina de celălalt subdomeniu, peste originea ei.
 */

const PIESE = (durate: number[]): BibliotecaRadio => ({
  generat_la: '',
  semnatura: 'x',
  fisiere: durate.map((d, i) => ({ cale: `DIVERSE/Album/${String(i + 1).padStart(2, '0')}.mp3`, durata: d })),
})

const SEL = (s: Partial<SelectieRadio>): SelectieRadio => ({
  versiune: 1,
  pornit: true,
  director: 'DIVERSE/Album',
  fisier_start: null,
  de: new Date().toISOString(),
  cine: null,
  ...s,
})

describe('ceasul radioului', () => {
  const b = PIESE([100, 100, 100])
  const T0 = Date.UTC(2026, 8, 14, 10, 0, 0)

  it('oprit înseamnă liniște, nu „prima piesă"', () => {
    const a = ceSeAude(b, SEL({ pornit: false, de: new Date(T0).toISOString() }), T0 + 50_000)
    expect(a.pornit).toBe(false)
    expect(a.cale).toBeNull()
  })

  it('socotește piesa și secunda din clipa de pornire', () => {
    const s = SEL({ de: new Date(T0).toISOString() })
    expect(ceSeAude(b, s, T0 + 50_000).cale).toBe('DIVERSE/Album/01.mp3')
    expect(ceSeAude(b, s, T0 + 50_000).secunda).toBeCloseTo(50, 5)
    // 150 s de la pornire = a doua piesă, la secunda 50
    expect(ceSeAude(b, s, T0 + 150_000).cale).toBe('DIVERSE/Album/02.mp3')
    expect(ceSeAude(b, s, T0 + 150_000).secunda).toBeCloseTo(50, 5)
    expect(ceSeAude(b, s, T0 + 150_000).index).toBe(1)
  })

  it('se învârte la nesfârșit — după ultima piesă o ia de la prima', () => {
    const s = SEL({ de: new Date(T0).toISOString() })
    // 350 s, cu un total de 300 s: suntem la 50 s în prima piesă, a doua rotire
    const a = ceSeAude(b, s, T0 + 350_000)
    expect(a.cale).toBe('DIVERSE/Album/01.mp3')
    expect(a.secunda).toBeCloseTo(50, 5)
  })

  it('spune ce urmează, ca pagina să încarce din timp și să nu fie pauză', () => {
    const s = SEL({ de: new Date(T0).toISOString() })
    expect(ceSeAude(b, s, T0 + 50_000).urmatoarea).toBe('DIVERSE/Album/02.mp3')
    // la ultima piesă, „ce urmează" e prima — altfel playerul s-ar opri la capătul listei
    expect(ceSeAude(b, s, T0 + 250_000).urmatoarea).toBe('DIVERSE/Album/01.mp3')
  })

  it('pornește de la piesa aleasă, rotind lista (ca pe aparatul din V1)', () => {
    const s = SEL({ de: new Date(T0).toISOString(), fisier_start: 'DIVERSE/Album/03.mp3' })
    expect(playlist(b, s).map((f) => f.cale)).toEqual([
      'DIVERSE/Album/03.mp3',
      'DIVERSE/Album/01.mp3',
      'DIVERSE/Album/02.mp3',
    ])
    expect(ceSeAude(b, s, T0 + 10_000).cale).toBe('DIVERSE/Album/03.mp3')
  })

  it('biblioteca goală sau directorul fără muzică nu pornește nimic', () => {
    expect(ceSeAude({ generat_la: '', semnatura: '', fisiere: [] }, SEL({}), T0).cale).toBeNull()
    expect(ceSeAude(b, SEL({ director: 'DIVERSE/Gol' }), T0).cale).toBeNull()
  })

  /*
   * O piesă cu durata 0 (nemăsurată încă) ar face ca socoteala să nu avanseze niciodată peste ea.
   * De aceea e scoasă din listă, nu redată cu durată zero.
   */
  it('piesele nemăsurate (durata 0) nu intră în selecție', () => {
    const cu0: BibliotecaRadio = {
      ...b,
      fisiere: [...b.fisiere, { cale: 'DIVERSE/Album/04.mp3', durata: 0 }],
    }
    expect(pieseDin(cu0, 'DIVERSE/Album').map((f) => f.cale)).not.toContain('DIVERSE/Album/04.mp3')
  })

  it('un ceas stricat nu aruncă — se socotește de la începutul selecției', () => {
    const a = ceSeAude(b, SEL({ de: 'nu e o dată' }), T0)
    expect(a.cale).toBe('DIVERSE/Album/01.mp3')
    expect(a.secunda).toBe(0)
  })
})

describe('ordinea și arborele bibliotecii', () => {
  it('ordonează după (părinte, nume), fără să țină cont de majuscule', () => {
    const cai = ['B/02.mp3', 'A/10.mp3', 'A/02.mp3', 'b/01.mp3']
    expect([...cai].sort(ordineNaturala)).toEqual(['A/02.mp3', 'A/10.mp3', 'b/01.mp3', 'B/02.mp3'])
  })

  it('structura canonică există mereu, chiar dacă n-are niciun fișier', () => {
    const d = toateDirectoarele({ generat_la: '', semnatura: '', fisiere: [] })
    for (const c of STRUCTURA_CANONICA) expect(d).toContain(c)
  })

  it('directoarele se deduc și din căile fișierelor, pe toate nivelurile', () => {
    const d = toateDirectoarele(PIESE([1]))
    expect(d).toContain('DIVERSE')
    expect(d).toContain('DIVERSE/Album')
  })
})

describe('căile din bibliotecă — poarta dinspre formular spre depozit', () => {
  it('primește o cale obișnuită și taie slash-urile de la capăt', () => {
    expect(caleCurata('DIVERSE/Album/01.mp3')).toBe('DIVERSE/Album/01.mp3')
    expect(caleCurata('DIVERSE/Album/')).toBe('DIVERSE/Album')
  })

  it('REFUZĂ ieșirea din bibliotecă — nu o „repară"', () => {
    for (const rea of ['../remote/slujba.mp3', 'DIVERSE/../../predici/2016.mp3', '/etc/passwd', '..', '.']) {
      expect(caleCurata(rea)).toBeNull()
    }
  })

  it('refuză componentele ascunse și calea goală', () => {
    expect(caleCurata('.ascuns/piesa.mp3')).toBeNull()
    expect(caleCurata('')).toBeNull()
    expect(caleCurata(null)).toBeNull()
  })

  it('normalizează backslash-urile venite de pe Windows, dar tot verifică rezultatul', () => {
    expect(caleCurata('DIVERSE\\Album\\01.mp3')).toBe('DIVERSE/Album/01.mp3')
    expect(caleCurata('DIVERSE\\..\\..\\remote')).toBeNull()
  })

  it('primește doar fișiere audio', () => {
    expect(eAudio('a/b.mp3')).toBe(true)
    expect(eAudio('a/b.WAV')).toBe(true)
    expect(eAudio('a/b.exe')).toBe(false)
    expect(eAudio('a/b.mp3.exe')).toBe(false)
  })
})

/*
 * ⚠️ Paza care a lipsit în V1 și a costat o publicare căzută (13.09.2026): un accent grav într-un
 * comentariu din JS-ul paginii trece de `tsc` și se sparge abia în esbuild, la deploy. Toate
 * scripturile de mai jos sunt template literals în TypeScript, deci regula e aceeași pentru toate.
 */
const SCRIPTURI: Array<[string, string]> = [
  ['player', jsPlayer('')],
  ['panou', jsPanou('')],
  ['bibliotecă', jsBiblioteca('')],
  ['microfon', jsMic('')],
]

describe('scripturile paginilor', () => {
  for (const [nume, js] of SCRIPTURI) {
    it(`${nume}: niciun accent grav (ar cădea la publicare, nu la typecheck)`, () => {
      expect(js).not.toContain('`')
    })

    /*
     * Cele două aplicații stau pe subdomenii diferite. Dacă un script ar cere ceva direct de la
     * celălalt subdomeniu, ar avea nevoie de CORS, de cookie-uri între origini și s-ar rupe tăcut
     * la prima schimbare de adresă. Regula: pagina vorbește NUMAI cu originea ei, iar aplicația
     * care o servește cere mai departe, prin Service Binding.
     */
    it(`${nume}: nu cere nimic de la altă origine`, () => {
      expect(js).not.toMatch(/fetch\(\s*["']https?:\/\//)
      expect(js).not.toContain('sfantul-ilie.ro')
    })
  }

  it('scripturile respectă montajul: prin gateway, adresele pornesc de la prefix', () => {
    expect(jsPlayer('/live')).toContain('const P = "/live"')
    expect(jsPanou('/radio')).toContain('const P = "/radio"')
  })
})

describe('panoul — același în amândouă aplicațiile', () => {
  const html = corpPanou({ live: '/live/', radio: '/radio/', biblioteca: '/radio/biblioteca' })

  it('are comutatorul cerut: LIVE și STOP', () => {
    expect(html).toContain('data-mod="live"')
    expect(html).toContain('data-mod="stop"')
    expect(html).toContain('>LIVE<')
    expect(html).toContain('>STOP<')
  })

  /*
   * OPRIT (liniște de tot) a rămas la super-admin, ca în V1: „radioul vreau să meargă permanent…
   * opritul manual nu are sens decât pentru mine ca super-admin". Butonul se randează ascuns, iar
   * scriptul îl arată doar când starea spune `super_admin`.
   */
  it('ascunde OPRIT la randare — îl aprinde doar scriptul, pentru super-admin', () => {
    expect(html).toMatch(/data-mod="oprit"[^>]*hidden/)
    expect(jsPanou('')).toContain('b.hidden = !S.super_admin')
  })

  it('arată informațiile transmisiunii, nu doar butonul', () => {
    for (const camp of ['acum-titlu', 'acum-sub', 'acum-rec', 'acum-ascultatori', 'acum-program', 'tehnic-lista']) {
      expect(html).toContain(camp)
    }
  })

  it('poartă playerul cu el — se aude ce comanzi, din aceeași pagină', () => {
    expect(html).toContain('id="audio"')
    expect(html).toContain('id="audio-radio"')
  })
})

describe('dreptul de a comanda emisia', () => {
  it('administratorul parohiei poate comanda (în V1 `/control` cerea chiar rolul admin)', () => {
    expect(PERMISIUNI_IMPLICITE.admin).toContain('broadcast.manage')
    expect(PERMISIUNI_IMPLICITE['super-admin']).toContain('broadcast.manage')
  })

  it('un utilizator obișnuit nu poate — ascultă, dar nu comandă', () => {
    expect(PERMISIUNI_IMPLICITE.user).not.toContain('broadcast.manage')
  })
})
