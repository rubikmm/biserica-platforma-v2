import { describe, expect, it } from 'vitest'
import { ruteazaSetari, type MediuSetari } from '../packages/setari/src/index.js'
import { CHEI_PERMISIUNI, PERMISIUNI_IMPLICITE } from '../packages/contracts/src/permisiuni.js'
import { pagina } from '../packages/ui/src/index.js'
import { rubricaSablon } from '../apps/newsletter/src/pagini.js'

/**
 * SETĂRILE APLICAȚIEI (user, 15.09.2026: „să afișăm un alt buton, în afară de Administrare, numit
 * Setări… Fiecare nivel va vedea mai multe lucruri").
 *
 * Probele de aici păzesc cele trei trepte cerute și, mai ales, lucrurile care se pot strica TĂCUT
 * la o rescriere: poarta cheii la scoaterea unui abonat (dacă se ia pe credit de la pagina care a
 * desenat butonul, oricine poate goli lista trimițând formularul de mână) și hotărârea din aceeași
 * zi ca `audit.read` să nu mai vină cu rolul de administrator.
 */

// ---------------------------------------------------------------------------
// Cheile
// ---------------------------------------------------------------------------

describe('cheile, după hotărârile din 15.09.2026', () => {
  /**
   * ⚠️ Cererea userului: zona de loguri e a SUPER-ADMINULUI. Cât timp `audit.read` venea din oficiu
   * și cu rolul de administrator, ea n-ar fi închis nimic.
   */
  it('`audit.read` e numai a super-adminului', () => {
    expect(PERMISIUNI_IMPLICITE['super-admin']).toContain('audit.read')
    expect(PERMISIUNI_IMPLICITE.user).not.toContain('audit.read')
  })

  /**
   * ⚠️ Din 19.09.2026 `audience.manage` nu mai vine din niciun rol în afară de super-admin: rolul
   * global `admin` s-a stins, iar cheia se dă omului la aplicația lui. De aceea proba nu mai
   * întreabă un rol, ci masca de administrator al unei aplicații — drumul pe care ajunge azi.
   */
  it('cheia abonaților nu vine cu rolul de utilizator; o are super-adminul', () => {
    expect(CHEI_PERMISIUNI).toContain('audience.manage')
    expect(PERMISIUNI_IMPLICITE['super-admin']).toContain('audience.manage')
    expect(PERMISIUNI_IMPLICITE.user).not.toContain('audience.manage')
  })
})

// ---------------------------------------------------------------------------
// Rândul din meniul contului
// ---------------------------------------------------------------------------

function meniu(cont: Record<string, unknown>): string {
  return pagina({ nume: 'PROBA', titlu: 'Probă', corp: '', cont })
}

describe('rândul „Setări" din meniul contului', () => {
  it('apare la cine e intrat, între Profil și Administrare', () => {
    const h = meniu({ intrat: true, nume: 'Om', admin: true, urlCont: '/cont', urlAdmin: '/admin', urlSetari: '/tipic/setari' })
    expect(h).toContain('<a href="/tipic/setari">Setări</a>')
    expect(h.indexOf('Profil')).toBeLessThan(h.indexOf('Setări'))
    expect(h.indexOf('Setări')).toBeLessThan(h.indexOf('Administrare'))
  })

  /** Treptele se văd în PAGINĂ, nu în meniu: enoriașul are și el ce găsi acolo. */
  it('îl vede și cine nu e administrator', () => {
    const h = meniu({ intrat: true, nume: 'Om', admin: false, urlCont: '/cont', urlSetari: '/tipic/setari' })
    expect(h).toContain('>Setări</a>')
    expect(h).not.toContain('>Administrare</a>')
  })

  it('nu apare la cine nu e intrat — pagina cere oricum cont', () => {
    const h = meniu({ intrat: false, nume: 'Cont', urlCont: '/cont', urlSetari: '/tipic/setari' })
    expect(h).not.toContain('>Setări</a>')
  })

  /** Aplicația care nu dă adresa (Contul însuși, unde Profilul E pagina) nu capătă rândul. */
  it('fără `urlSetari` meniul rămâne cum era', () => {
    const h = meniu({ intrat: true, nume: 'Om', admin: true, urlCont: '/cont', urlAdmin: '/admin' })
    expect(h).not.toContain('>Setări</a>')
    expect(h).toContain('>Administrare</a>')
  })
})

// ---------------------------------------------------------------------------
// Drumul, la server
// ---------------------------------------------------------------------------

/** Serviciile de probă: scriu unde s-a bătut și răspund ce li se cere. */
function mediu(urme: string[], o: { poate?: boolean; membri?: unknown[] } = {}): MediuSetari {
  const fetcher = (cine: string, raspuns: (cale: string) => unknown) =>
    ({
      fetch: async (adresa: string) => {
        const cale = new URL(adresa).pathname
        urme.push(`${cine}:${cale}`)
        return new Response(JSON.stringify(raspuns(cale)), { status: 200, headers: { 'content-type': 'application/json' } })
      },
    }) as unknown as Fetcher
  return {
    IDENTITATE: fetcher('identitate', () => ({ asocieri: [] })),
    COMUNICARE: fetcher('comunicare', (c) =>
      c === '/audiente/membri' ? { membri: o.membri ?? [] } : c === '/preferinte/citeste' ? { optedOut: false } : { ok: true },
    ),
    AUTORIZARE: fetcher('autorizare', () => ({ allowed: o.poate ?? false, reason: 'probă', matchedScopes: [] })),
    AUDIT: fetcher('audit', () => ({ intrari: [] })),
  }
}

function unelte(principal: { userId: string; email: string } | null) {
  return {
    cod: 'calendar',
    nume: 'Calendar',
    prefix: '/calendar',
    cfg: { MEDIU: 'dev', DOMENIU_COOKIE: 'rubik' },
    cid: 'proba',
    principal,
    urlCont: 'https://cont.test',
    urlTermeni: 'https://sfantul-ilie.ro/termeni',
    carcasa: (o: { titluPagina: string; corp: string }) => `<!--${o.titluPagina}-->${o.corp}`,
  }
}

function post(cale: string, corp: Record<string, string>): Request {
  const date = new FormData()
  for (const [k, v] of Object.entries(corp)) date.set(k, v)
  return new Request(`https://calendar.test${cale}`, { method: 'POST', body: date })
}

/** Acelasi POST, dar cu jetonul CSRF pereche cu cookie-ul — ca sa treacă de bariera și să ajungă
 *  la poarta cheii, care e ce vrem de fapt să probăm. */
function postCuJeton(cale: string, corp: Record<string, string>): Request {
  const jeton = 'jeton-de-proba'
  const r = post(cale, { ...corp, csrf: jeton })
  return new Request(r, { headers: { ...Object.fromEntries(r.headers), cookie: `xc_csrf=${jeton}` } })
}

const OM = { userId: 'u1', email: 'om@exemplu.ro' }

describe('poarta paginii', () => {
  it('o adresă străină nu e a Setărilor', async () => {
    expect(await ruteazaSetari(new Request('https://calendar.test/2026-09'), '/2026-09', mediu([]), unelte(OM))).toBeNull()
  })

  it('fără cont, omul e trimis la intrare, cu întoarcere exact aici', async () => {
    const r = await ruteazaSetari(new Request('https://calendar.test/setari'), '/setari', mediu([]), unelte(null))
    expect(r!.status).toBe(303)
    expect(r!.headers.get('location')).toBe('https://cont.test/auth/login?spre=%2Fcalendar%2Fsetari')
  })

  /** Pagina poartă numele omului și lista lui: nu se dă niciodată cache-ului. */
  it('pagina nu se ține în cache', async () => {
    const r = await ruteazaSetari(new Request('https://calendar.test/setari'), '/setari', mediu([]), unelte(OM))
    expect(r!.headers.get('cache-control')).toBe('private, no-store')
  })
})

describe('treptele — fiecare nivel vede mai mult', () => {
  it('utilizatorul simplu își vede abonarea, și nimic peste ea', async () => {
    const urme: string[] = []
    const r = await ruteazaSetari(new Request('https://calendar.test/setari'), '/setari', mediu(urme, { poate: false }), unelte(OM))
    const h = await r!.text()
    expect(h).toContain('Abonarea mea')
    expect(h).not.toContain('Abonații aplicației')
    expect(h).not.toContain('Jurnalul aplicației')
    // ⚠️ fără cheie nu se face nici drumul: lista întreagă nu se cere degeaba
    expect(urme.filter((u) => u === 'comunicare:/audiente/membri')).toHaveLength(1)
    expect(urme).not.toContain('audit:/citeste')
  })

  it('cine are cheile vede și lista, și jurnalul', async () => {
    const urme: string[] = []
    const r = await ruteazaSetari(
      new Request('https://calendar.test/setari'),
      '/setari',
      mediu(urme, { poate: true, membri: [{ user_id: 'u9', channel: 'email', adresa: 'altul@exemplu.ro', created_at: '2026-09-01T10:00:00Z' }] }),
      unelte(OM),
    )
    const h = await r!.text()
    expect(h).toContain('Abonații aplicației')
    expect(h).toContain('altul@exemplu.ro')
    expect(h).toContain('Jurnalul aplicației')
    expect(urme).toContain('audit:/citeste')
  })

  /**
   * ⚠️ Rubrica e a PLATFORMEI, nu a aplicației — și trebuie s-o scrie pe ea, altfel omul oprește
   * tot e-mailul crezând că oprește numai calendarul.
   */
  it('comutatorul de e-mail spune că e al întregii platforme', async () => {
    const r = await ruteazaSetari(new Request('https://calendar.test/setari'), '/setari', mediu([]), unelte(OM))
    expect((await r!.text()).replace(/\s+/g, ' ')).toContain('a <b>întregii platforme</b>, nu doar a acestei aplicații')
  })
})

describe('faptele', () => {
  /** Toate schimbă ceva pe contul unui om intrat: jetonul CSRF se cere la fiecare. */
  it('fără jetonul CSRF nu trece nicio faptă', async () => {
    const urme: string[] = []
    const r = await ruteazaSetari(post('/setari/dezabonare', {}), '/setari/dezabonare', mediu(urme), unelte(OM))
    expect(r!.status).toBe(403)
    expect(urme).toEqual([])
  })

  /**
   * ⚠️ PROBA CARE CONTEAZĂ. Butonul „Scoate" se desenează numai celui cu cheia — dar paza nu stă în
   * desen: cine trimite formularul de mână ajunge tot aici. Fără `audience.manage`, comunicarea nu
   * trebuie atinsă deloc.
   */
  it('fără `audience.manage` nu se scoate niciun abonat', async () => {
    const urme: string[] = []
    const r = await ruteazaSetari(
      postCuJeton('/setari/abonat-scoate', { userId: 'u9' }),
      '/setari/abonat-scoate',
      mediu(urme, { poate: false }),
      unelte(OM),
    )
    // a trecut de CSRF (altfel n-am fi probat nimic), a întrebat autorizarea, și s-a oprit acolo
    expect(urme).toContain('autorizare:/can')
    expect(urme).not.toContain('comunicare:/audiente/scoate')
    expect(r!.headers.get('location')).toBe('/calendar/setari?f=fara-drept')
    // refuzul se scrie în jurnal: cineva a încercat
    expect(urme).toContain('audit:/scrie')
  })

  it('cu cheia, abonatul chiar iese din listă', async () => {
    const urme: string[] = []
    const r = await ruteazaSetari(
      postCuJeton('/setari/abonat-scoate', { userId: 'u9' }),
      '/setari/abonat-scoate',
      mediu(urme, { poate: true }),
      unelte(OM),
    )
    expect(urme).toContain('comunicare:/audiente/scoate')
    expect(r!.headers.get('location')).toBe('/calendar/setari?f=scos')
  })

  /** Consimțământul nu e o podoabă a interfeței: se cere și pe drumul scurt din Setări. */
  it('reabonarea din Setări cere tot bifa termenilor', async () => {
    const urme: string[] = []
    const r = await ruteazaSetari(
      postCuJeton('/setari/abonare', {}),
      '/setari/abonare',
      mediu(urme),
      unelte(OM),
    )
    expect(urme).not.toContain('comunicare:/audiente/inscrie')
    expect(r!.headers.get('location')).toBe('/calendar/setari?f=fara-termeni')
  })

  it('pe GET, adresele faptelor nu fac nimic — duc înapoi la pagină', async () => {
    const urme: string[] = []
    const r = await ruteazaSetari(new Request('https://calendar.test/setari/dezabonare'), '/setari/dezabonare', mediu(urme), unelte(OM))
    expect(r!.status).toBe(303)
    expect(r!.headers.get('location')).toBe('/calendar/setari')
    expect(urme).toEqual([])
  })
})

describe('aplicațiile fără serviciu de trimis', () => {
  /**
   * Butonul apare peste tot (hotărâre a userului, 15.09.2026), deci pagina trebuie să aibă ce
   * arăta și acolo unde nu e nicio audiență — și s-o spună pe față, nu să lase o rubrică goală.
   */
  it('spun limpede că n-au la ce te abona', async () => {
    const r = await ruteazaSetari(
      new Request('https://radio.test/setari'),
      '/setari',
      mediu([]),
      { ...unelte(OM), cod: 'radio', nume: 'Radioul', prefix: '/radio' },
    )
    const h = await r!.text()
    expect(h).toContain('nu trimite nimic pe e-mail')
    expect(h).toContain('E-mailul de la platformă')
  })
})

/*
 * RUBRICILE APLICAȚIEI — punctul de prindere cerut de newsletter (user, 16.09.2026: antetul și
 * subsolul buletinului, arătate în Setări). Ce se păzește aici: că bucata aplicației chiar ajunge în
 * pagină, că primește treptele deja socotite (ca să nu întrebe a doua oară autorizarea) și că
 * aplicațiile care NU dau nimic rămân exact cum erau.
 */
describe('rubricile aplicației în Setări', () => {
  it('bucata aplicației ajunge în pagină, înaintea lui „Înapoi"', async () => {
    const r = await ruteazaSetari(new Request('https://calendar.test/setari'), '/setari', mediu([]), {
      ...unelte(OM),
      rubrici: () => '<section class="set-grup"><h2>Bucata mea</h2></section>',
    })
    const h = await r!.text()
    expect(h).toContain('<h2>Bucata mea</h2>')
    expect(h.indexOf('Bucata mea')).toBeLessThan(h.indexOf('Înapoi în'))
  })

  it('primește treptele gata socotite, nu le întreabă singură', async () => {
    // ⚠️ TREI trepte din 18.09.2026: `eAdminApp` (administratorul APLICAȚIEI, cheia ei din registru)
    // s-a adăugat lângă `eAdmin` (cheia abonaților, a platformei) și `eSuper`. Rubricile care țin de
    // treaba aplicației — șablonul newsletterului — atârnă de a treia, nu de prima.
    let vazut: { eAdmin: boolean; eSuper: boolean; eAdminApp: boolean; csrf: string } | null = null
    await ruteazaSetari(new Request('https://calendar.test/setari'), '/setari', mediu([], { poate: true }), {
      ...unelte(OM),
      rubrici: (t) => {
        vazut = t
        return ''
      },
    })
    expect(vazut).toMatchObject({ eAdmin: true, eSuper: true, eAdminApp: true })
  })

  /*
   * ⚠️ JETONUL PAGINII, nu altul (18.09.2026, odată cu rubrica „Chat AI"): rubricile cu formular
   * trebuie să primească exact jetonul pentru care pleacă și cookie-ul, altfel prima salvare ar fi
   * respinsă ca „token nepotrivit" — și omul ar da vina pe ce a scris, nu pe noi.
   */
  it('rubricile primesc jetonul CSRF AL PAGINII', async () => {
    let jetonulRubricii = ''
    const r = await ruteazaSetari(new Request('https://calendar.test/setari'), '/setari', mediu([], { poate: true }), {
      ...unelte(OM),
      rubrici: ({ csrf }) => {
        jetonulRubricii = csrf
        return `<form><input name="csrf" value="${csrf}"></form>`
      },
    })
    const h = await r!.text()
    expect(jetonulRubricii).not.toBe('')
    // același jeton în formularul comun al paginii și în bucata aplicației
    expect(h.split(jetonulRubricii).length).toBeGreaterThan(2)
  })

  it('aplicația care nu dă nimic are pagina neschimbată', async () => {
    const fara = await ruteazaSetari(new Request('https://calendar.test/setari'), '/setari', mediu([]), unelte(OM))
    const gol = await ruteazaSetari(new Request('https://calendar.test/setari'), '/setari', mediu([]), {
      ...unelte(OM),
      rubrici: () => '',
    })
    // ⚠️ jetonul CSRF se naște altul la fiecare cerere — se scoate, altfel proba compară zgomot
    const curat = (h: string) => h.replace(/value="[^"]*"/g, 'value="…"').replace(/\s+/g, ' ')
    expect(curat(await fara!.text())).toBe(curat(await gol!.text()))
  })

  it('rubrica newsletterului arată amândouă bucățile, și spune că nu ating arhiva', () => {
    const h = rubricaSablon({ antet: '<tr><td>antetul</td></tr>', subsol: '<tr><td>subsolul</td></tr>' }, true)
    expect(h).toContain('Antetul și subsolul buletinului')
    expect(h).toContain('antetul')
    expect(h).toContain('subsolul')
    expect(h).toContain('Nu ating arhiva')
    // se arată și cum se vede (în carcasa .email), și cum e scrisă
    expect(h).toContain('class="email sab-proba"')
    expect(h).toContain('<pre>')
  })

  it('bucata lipsă din depozit se spune pe față, nu se tace', () => {
    const h = rubricaSablon({ antet: null, subsol: '<tr><td>x</td></tr>' }, true)
    expect(h).toContain('Nu e încă în depozit')
  })

  it('⚠️ rubrica e numai a adminilor: bucățile astea intră în ce pleacă pe e-mail', () => {
    expect(rubricaSablon({ antet: '<tr><td>x</td></tr>', subsol: null }, false)).toBe('')
  })
})
