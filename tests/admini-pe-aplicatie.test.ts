import { describe, expect, it } from 'vitest'
import {
  APLICATII_ADMINISTRABILE,
  APLICATII_CU_MEMBRI,
  CHEI_PERMISIUNI,
  PERMISIUNI_IMPLICITE,
  aplicatiaAdministrabila,
  cheileAdminului,
} from '../packages/contracts/src/index.js'
import { eAdminulAplicatiei } from '../packages/authorization/src/index.js'
import { ruteazaSetari, type MediuSetari } from '../packages/setari/src/index.js'
import admin from '../apps/admin/src/index.js'

/**
 * ADMINII PE APLICAȚIE (user, 18.09.2026: „să aibă toate capacitatea de a avea setat administratori
 * — eu îi setez la fiecare aplicație în parte ca administrator (deci nu doar super-admin)"; și, în
 * aceeași rundă: „este vorba fix de rolul pe care simulez acum din meniul de Cont… Intră ca
 * administrator", „dar este vorba de acei admini ai aplicației — nu admini generali ca mine").
 *
 * Ce păzesc probele astea, fiindcă toate se pot strica TĂCUT:
 *   - un administrator de aplicație NU capătă nimic în celelalte aplicații (asta e chiar cererea);
 *   - adminul global și super-adminul nu pierd nimic (cheile vin cu rolul);
 *   - masca „vezi ca" NU împrumută granturi punctuale: altfel previzualizarea ar minți;
 *   - registrul și cheile rămân împerecheate (o cheie scoasă din contracte ar lăsa un nume de
 *     aplicație care nu deschide nimic, iar tabelul din Administrare ar arăta o coloană moartă).
 */

// ---------------------------------------------------------------------------
// Registrul
// ---------------------------------------------------------------------------

describe('registrul aplicațiilor administrabile', () => {
  it('fiecare aplicație are cheile ei în lista platformei', () => {
    for (const a of APLICATII_ADMINISTRABILE) {
      for (const cheie of cheileAdminului(a.cod)) {
        expect(CHEI_PERMISIUNI, `${a.cod} → ${cheie}`).toContain(cheie)
      }
    }
  })

  /** Altfel părintele ar pierde în tăcere o aplicație pe care o ținea prin rol. */
  it('toate cheile de admin vin cu rolul global de administrator', () => {
    for (const a of APLICATII_ADMINISTRABILE) {
      for (const cheie of cheileAdminului(a.cod)) {
        expect(PERMISIUNI_IMPLICITE.admin, `${a.cod} → ${cheie}`).toContain(cheie)
        expect(PERMISIUNI_IMPLICITE['super-admin'], `${a.cod} → ${cheie}`).toContain(cheie)
      }
    }
  })

  it('niciuna dintre ele nu vine cu rolul de utilizator simplu', () => {
    for (const a of APLICATII_ADMINISTRABILE) {
      for (const cheie of cheileAdminului(a.cod)) {
        expect(PERMISIUNI_IMPLICITE.user, `${a.cod} → ${cheie}`).not.toContain(cheie)
      }
    }
  })

  /** Toate cele unsprezece aplicații de om au un rând: asta a fost cererea („la toate aplicațiile"). */
  it('aplicațiile platformei sunt toate în registru', () => {
    const coduri = APLICATII_ADMINISTRABILE.map((a) => a.cod)
    for (const cod of [
      'program',
      'calendar',
      'buletin',
      'newsletter',
      'curatenie',
      'biblioteca',
      'tipic',
      'biblia',
      'live',
      'radio',
      'home',
    ]) {
      expect(coduri, cod).toContain(cod)
    }
  })

  /**
   * ⚠️ Eticheta „Admin" din panoul Curățeniei acordă o cheie scrisă în `APLICATII_CU_MEMBRI`. Dacă
   * s-ar despărți de registru, panoul ar numi un drept, iar tabelul din Administrare ar arăta altul.
   */
  it('eticheta de admin a unei aplicații cu echipă dă chiar cheia din registru', () => {
    for (const app of APLICATII_CU_MEMBRI) {
      if (!app.etichetaAdmin) continue
      expect(app.etichetaAdmin.permisiune, app.cod).toBe(aplicatiaAdministrabila(app.cod)?.cheieAdmin)
    }
  })

  /** LIVE și Radio împart dinadins o cheie: panoul e unul și comandă un singur aparat. */
  it('LIVE și Radio au aceeași cheie', () => {
    expect(aplicatiaAdministrabila('live')?.cheieAdmin).toBe('broadcast.manage')
    expect(aplicatiaAdministrabila('radio')?.cheieAdmin).toBe('broadcast.manage')
  })
})

// ---------------------------------------------------------------------------
// Decizia: cine e adminul aplicației
// ---------------------------------------------------------------------------

/** Autorizarea, ca la adevărat: rolurile EFECTIVE ale sesiunii + granturile punctuale. */
function autorizare(roluri: string[], granturi: string[] = [], masca?: string) {
  const cereri: string[] = []
  return {
    cereri,
    serviciu: {
      fetch: async (_adresa: string, init?: RequestInit) => {
        const c = JSON.parse(String(init?.body ?? '{}')) as { permission?: string }
        const cheie = c.permission ?? ''
        cereri.push(cheie)
        // sub mască se uită atât rolurile adevărate, cât și granturile — ca în authorization-worker
        const dinRol = masca
          ? (PERMISIUNI_IMPLICITE[masca as keyof typeof PERMISIUNI_IMPLICITE] ?? []).includes(cheie as never)
          : roluri.some((r) =>
              (PERMISIUNI_IMPLICITE[r as keyof typeof PERMISIUNI_IMPLICITE] ?? []).includes(cheie as never),
            )
        const allowed = dinRol || (!masca && granturi.includes(cheie))
        return new Response(JSON.stringify({ allowed, reason: 'probă', matchedScopes: [] }), {
          headers: { 'content-type': 'application/json' },
        })
      },
    } as unknown as { fetch: typeof fetch },
  }
}

const OM = { userId: 'u1', email: 'om@example.com' }

describe('`eAdminulAplicatiei` — cine ține aplicația', () => {
  it('omul numit la Program e admin acolo, și numai acolo', async () => {
    const a = autorizare(['user'], ['program.write', 'program.publish'])
    expect(await eAdminulAplicatiei(a.serviciu, 'p', OM, 'program')).toBe(true)
    expect(await eAdminulAplicatiei(a.serviciu, 'p', OM, 'calendar')).toBe(false)
    expect(await eAdminulAplicatiei(a.serviciu, 'p', OM, 'buletin')).toBe(false)
    expect(await eAdminulAplicatiei(a.serviciu, 'p', OM, 'curatenie')).toBe(false)
    // întreabă chiar cheia aplicației, nu rolul
    expect(a.cereri).toContain('program.write')
  })

  it('adminul global le ține pe toate, ca până acum', async () => {
    const a = autorizare(['admin'])
    for (const app of APLICATII_ADMINISTRABILE) {
      expect(await eAdminulAplicatiei(a.serviciu, 'p', OM, app.cod), app.cod).toBe(true)
    }
  })

  it('utilizatorul simplu nu ține nimic', async () => {
    const a = autorizare(['user'])
    for (const app of APLICATII_ADMINISTRABILE) {
      expect(await eAdminulAplicatiei(a.serviciu, 'p', OM, app.cod), app.cod).toBe(false)
    }
  })

  /**
   * ⚠️ Masca „vezi ca administrator" arată tot — și asta e chiar lucrul pe care userul îl simulează
   * din meniul Contului. Masca „vezi ca utilizator" nu arată nimic, NICI dacă omul are granturi.
   */
  it('masca „administrator" deschide toate aplicațiile, masca „utilizator" niciuna', async () => {
    const caAdmin = autorizare(['super-admin'], [], 'admin')
    const caOm = autorizare(['super-admin'], ['program.write'], 'user')
    expect(await eAdminulAplicatiei(caAdmin.serviciu, 'p', OM, 'program')).toBe(true)
    expect(await eAdminulAplicatiei(caAdmin.serviciu, 'p', OM, 'tipic')).toBe(true)
    expect(await eAdminulAplicatiei(caOm.serviciu, 'p', OM, 'program')).toBe(false)
  })

  it('fără om intrat sau fără serviciu, răspunsul e NU', async () => {
    const a = autorizare(['admin'])
    expect(await eAdminulAplicatiei(a.serviciu, 'p', null, 'program')).toBe(false)
    expect(await eAdminulAplicatiei(undefined, 'p', OM, 'program')).toBe(false)
  })

  it('un cod de aplicație necunoscut nu deschide nimic', async () => {
    const a = autorizare(['super-admin'])
    expect(await eAdminulAplicatiei(a.serviciu, 'p', OM, 'aplicatie-inexistenta')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Numirea, din Setările aplicației
// ---------------------------------------------------------------------------

/**
 * Serviciile de probă pentru Setări. `cheiOmului` = ce are cel care APASĂ; `urme` adună drumurile
 * batute, ca sa se vada daca s-a scris cu adevarat la autorizare.
 */
function mediu(urme: string[], cheiOmului: string[] = []): MediuSetari {
  const fetcher = (cine: string, raspuns: (cale: string, corp: unknown) => unknown) =>
    ({
      fetch: async (adresa: string, init?: RequestInit) => {
        const cale = new URL(adresa).pathname
        const corp = JSON.parse(String(init?.body ?? '{}'))
        urme.push(`${cine}:${cale}:${JSON.stringify(corp)}`)
        return new Response(JSON.stringify(raspuns(cale, corp)), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    }) as unknown as Fetcher
  return {
    IDENTITATE: fetcher('identitate', (c) =>
      c === '/utilizatori/lista'
        ? {
            utilizatori: [
              { userId: 'u1', email: 'om@example.com', displayName: 'Omul Care Apasă', disabledAt: null },
              { userId: 'u2', email: 'maria@example.com', displayName: 'Maria M', disabledAt: null },
              { userId: 'u3', email: 'inchis@example.com', displayName: 'Cont Închis', disabledAt: '2026-09-01' },
            ],
          }
        : { asocieri: [] },
    ),
    COMUNICARE: fetcher('comunicare', (c) =>
      c === '/preferinte/citeste' ? { optedOut: false } : c === '/audiente/membri' ? { membri: [] } : { ok: true },
    ),
    AUTORIZARE: fetcher('autorizare', (c, corp) => {
      if (c === '/can') {
        const cheie = (corp as { permission?: string }).permission ?? ''
        return { allowed: cheiOmului.includes(cheie), reason: 'probă', matchedScopes: [] }
      }
      if (c === '/cine-are') return { prinGrant: ['u1'], prinRol: [] }
      return { ok: true }
    }),
    AUDIT: fetcher('audit', () => ({ ok: true })),
  }
}

function unelte(cod = 'program') {
  return {
    cod,
    nume: 'Programul',
    prefix: `/${cod}`,
    cfg: { MEDIU: 'dev', DOMENIU_COOKIE: 'rubik' },
    cid: 'proba',
    principal: OM,
    urlCont: 'https://cont.test',
    urlTermeni: 'https://sfantul-ilie.ro/termeni',
    carcasa: (o: { titluPagina: string; corp: string }) => `<!--${o.titluPagina}-->${o.corp}`,
  }
}

/** POST cu jetonul CSRF pereche cu cookie-ul, ca să treacă bariera și să ajungă la poarta cheii. */
function postCuJeton(cale: string, corp: Record<string, string>): Request {
  const jeton = 'j'.repeat(43)
  const date = new FormData()
  for (const [k, v] of Object.entries(corp)) date.set(k, v)
  date.set('csrf', jeton)
  return new Request(`https://program.test${cale}`, {
    method: 'POST',
    body: date,
    headers: { cookie: `xc_csrf=${jeton}` },
  })
}

describe('numirea unui administrator din Setările aplicației', () => {
  it('rubrica se vede la cine ține aplicația', async () => {
    const urme: string[] = []
    const r = await ruteazaSetari(
      new Request('https://program.test/setari'),
      '/setari',
      mediu(urme, ['program.write']),
      unelte(),
    )
    const text = await r!.text()
    expect(text).toContain('Administratorii aplicației')
    expect(text).toContain('Numește administrator')
    // se cer și oamenii platformei, ca să fie din ce alege
    expect(urme.some((u) => u.startsWith('identitate:/utilizatori/lista'))).toBe(true)
    // cine e deja admin nu mai apare în lista de numit; cine are contul închis, nici el
    expect(text).toContain('maria@example.com')
    expect(text).not.toContain('inchis@example.com')
  })

  it('cine nu ține aplicația nu vede rubrica și nu întreabă degeaba serviciile', async () => {
    const urme: string[] = []
    const r = await ruteazaSetari(new Request('https://program.test/setari'), '/setari', mediu(urme), unelte())
    const text = await r!.text()
    expect(text).not.toContain('Administratorii aplicației')
    expect(urme.some((u) => u.startsWith('identitate:/utilizatori/lista'))).toBe(false)
    expect(urme.some((u) => u.startsWith('autorizare:/cine-are'))).toBe(false)
  })

  it('numirea acordă TOATE cheile aplicației, nu doar una', async () => {
    const urme: string[] = []
    await ruteazaSetari(
      postCuJeton('/setari/admin-numeste', { userId: 'u2' }),
      '/setari/admin-numeste',
      mediu(urme, ['program.write']),
      unelte(),
    )
    const acordate = urme.filter((u) => u.startsWith('autorizare:/acorda'))
    expect(acordate).toHaveLength(2)
    expect(acordate.join(' ')).toContain('program.write')
    expect(acordate.join(' ')).toContain('program.publish')
    expect(acordate.join(' ')).toContain('"userId":"u2"')
    // fapta se scrie în jurnalul platformei
    expect(urme.some((u) => u.includes('program.admin.grant'))).toBe(true)
  })

  /**
   * ⚠️ Poarta se cere AICI, nu pe credit de la pagina care a desenat butonul: cine trimite
   * formularul de mână ajunge tot pe drumul ăsta. Fără ea, orice enoriaș s-ar face singur admin.
   */
  it('fără cheia aplicației, numirea nu scrie nimic', async () => {
    const urme: string[] = []
    const r = await ruteazaSetari(
      postCuJeton('/setari/admin-numeste', { userId: 'u2' }),
      '/setari/admin-numeste',
      mediu(urme),
      unelte(),
    )
    expect(r!.status).toBe(303)
    expect(r!.headers.get('location')).toContain('fara-drept-admin')
    expect(urme.some((u) => u.startsWith('autorizare:/acorda'))).toBe(false)
    // refuzul se scrie în jurnal: o încercare de a-și lua drepturi trebuie să se vadă
    expect(urme.some((u) => u.includes('program.admin.grant') && u.includes('fara program.write'))).toBe(true)
  })

  it('scoaterea retrage tot ce a dat numirea', async () => {
    const urme: string[] = []
    await ruteazaSetari(
      postCuJeton('/setari/admin-scoate', { userId: 'u2' }),
      '/setari/admin-scoate',
      mediu(urme, ['program.write']),
      unelte(),
    )
    const retrase = urme.filter((u) => u.startsWith('autorizare:/retrage'))
    expect(retrase).toHaveLength(2)
    expect(urme.some((u) => u.includes('program.admin.revoke'))).toBe(true)
  })

  /** Fără jetonul CSRF nu trece nicio faptă — aceeași pază ca la celelalte fapte din Setări. */
  it('fără jetonul CSRF nu se numește nimeni', async () => {
    const urme: string[] = []
    const date = new FormData()
    date.set('userId', 'u2')
    const r = await ruteazaSetari(
      new Request('https://program.test/setari/admin-numeste', { method: 'POST', body: date }),
      '/setari/admin-numeste',
      mediu(urme, ['program.write']),
      unelte(),
    )
    expect(r!.status).toBe(403)
    expect(urme.some((u) => u.startsWith('autorizare:/acorda'))).toBe(false)
  })

  /** Aplicația care nu e în registru (Contul) n-are rubrică și n-are rute de numire. */
  it('o aplicație fără rând în registru nu capătă rubrica', async () => {
    const urme: string[] = []
    const r = await ruteazaSetari(
      new Request('https://cont.test/setari'),
      '/setari',
      mediu(urme, ['program.write']),
      unelte('cont'),
    )
    expect(await r!.text()).not.toContain('Administratorii aplicației')
  })
})

// ---------------------------------------------------------------------------
// Tabelul din Administrare
// ---------------------------------------------------------------------------

/**
 * TABELUL (user, 18.09.2026: „un tabel cu oamenii și aplicațiile și bulina la intersecție").
 *
 * ⚠️ Bulina are două feluri, fiindcă dreptul vine pe două drumuri: plină = numit la aplicația aceea
 * (se poate scoate de acolo), conturată = din rolul lui pe platformă. Dacă cineva le unește vreodată
 * într-un singur semn, tabelul începe să mintă tăcut despre ce se poate retrage și de unde.
 */
function mediuAdmin(o: {
  chei?: string[]
  harta?: Record<string, { prinGrant: string[]; prinRol: string[] }>
  roluri?: Record<string, { role: string; scope: string }[]>
}) {
  const chei = o.chei ?? ['roles.manage']
  return {
    MEDIU: 'staging',
    ORIGINE_PUBLICA: 'https://admin.staging.sfantul-ilie.ro',
    DOMENIU_COOKIE: '.staging.sfantul-ilie.ro',
    EMAIL_SUPERADMIN: 'rubikmm@gmail.com',
    IDENTITATE: {
      fetch: async (adresa: string) => {
        const cale = new URL(adresa).pathname
        if (cale === '/sesiune') {
          return new Response(
            JSON.stringify({
              authenticated: true,
              user: { id: 'u1', email: 'rubikmm@gmail.com', displayName: 'Părintele', firstName: null, lastName: null, phone: null, shortName: null, emailVerifiedAt: null, disabledAt: null, createdAt: '2026-01-01T00:00:00.000Z' },
              roles: [{ role: 'super-admin', scope: 'global' }],
              sessionId: 's1',
              expiresAt: null,
              veziCa: null,
              poateVedeaCa: true,
            }),
            { headers: { 'content-type': 'application/json' } },
          )
        }
        return new Response(
          JSON.stringify({
            utilizatori: [
              { userId: 'u1', email: 'rubikmm@gmail.com', displayName: 'Părintele', disabledAt: null },
              { userId: 'u2', email: 'maria@example.com', displayName: 'Maria M', disabledAt: null },
              { userId: 'u3', email: 'gheorghe@example.com', displayName: 'Gheorghe G', disabledAt: null },
              { userId: 'u4', email: 'nimeni@example.com', displayName: 'Nimeni N', disabledAt: null },
            ],
          }),
          { headers: { 'content-type': 'application/json' } },
        )
      },
    },
    AUTORIZARE: {
      fetch: async (adresa: string, init?: RequestInit) => {
        const cale = new URL(adresa).pathname
        const corp = JSON.parse(String(init?.body ?? '{}')) as { permission?: string }
        if (cale === '/can') {
          return new Response(
            JSON.stringify({ allowed: chei.includes(corp.permission ?? ''), reason: 'probă', matchedScopes: [] }),
            { headers: { 'content-type': 'application/json' } },
          )
        }
        if (cale === '/harta-admini') {
          return new Response(JSON.stringify({ harta: o.harta ?? {} }), { headers: { 'content-type': 'application/json' } })
        }
        if (cale === '/roluri-multi') {
          return new Response(JSON.stringify({ roluri: o.roluri ?? {} }), { headers: { 'content-type': 'application/json' } })
        }
        return new Response('{}', { headers: { 'content-type': 'application/json' } })
      },
    },
    AUDIT: { fetch: async () => new Response(JSON.stringify({ intrari: [] }), { headers: { 'content-type': 'application/json' } }) },
    AUTOMATIZARE: { fetch: async () => new Response(JSON.stringify({ actiuni: [] }), { headers: { 'content-type': 'application/json' } }) },
    COMUNICARE: { fetch: async () => new Response(JSON.stringify({ livrari: [] }), { headers: { 'content-type': 'application/json' } }) },
  }
}

const tabelul = (env: unknown) =>
  admin.fetch(
    new Request('https://admin.staging.sfantul-ilie.ro/admini', { headers: { cookie: 'xc_sesiune=jeton-de-proba' } }),
    env as never,
  )

describe('tabelul adminilor pe aplicații, din Administrare', () => {
  it('bulina plină la aplicația unde e numit, nimic la celelalte', async () => {
    const env = mediuAdmin({
      harta: {
        'program.write': { prinGrant: ['u2'], prinRol: ['u1'] },
        'cleaning.manage': { prinGrant: ['u3'], prinRol: ['u1'] },
      },
      roluri: { u1: [{ role: 'super-admin', scope: 'global' }] },
    })
    const raspuns = await tabelul(env)
    expect(raspuns.status).toBe(200)
    const text = await raspuns.text()
    expect(text).toContain('Administratori pe aplicații')
    // cei trei cu drepturi sunt în tabel, al patrulea nu are ce căuta acolo
    expect(text).toContain('Maria M')
    expect(text).toContain('Gheorghe G')
    expect(text).not.toContain('Nimeni N')
    // bulinele: Maria e NUMITĂ la Program (plină), părintele o are din rol (conturată)
    expect(text).toContain('Maria M e numit administrator la Programul liturgic')
    expect(text).toContain('Părintele are Programul liturgic din rolul lui pe platformă')
    expect(text).toContain('Maria M nu e administrator la Curățenia bisericii')
    expect(text).toContain('bul plina')
    expect(text).toContain('bul din-rol')
    // numele aplicațiilor duc în Setările lor — de acolo se numesc adminii
    expect(text).toContain('/setari"')
  })

  it('e al super-adminului: fără `roles.manage`, 403', async () => {
    const raspuns = await tabelul(mediuAdmin({ chei: ['communication.create'] }))
    expect(raspuns.status).toBe(403)
    expect(await raspuns.text()).toContain('roles.manage')
  })

  it('tabelul gol se spune pe față, nu se desenează un tabel fără rânduri', async () => {
    const text = await (await tabelul(mediuAdmin({ harta: {} }))).text()
    expect(text).toContain('Nimeni nu e administrator nicăieri încă')
    expect(text).not.toContain('<table class="matrice"')
  })

  /** Autorizarea care tace nu trebuie să dea un tabel curat, care ar însemna „nimeni nu e admin". */
  it('dacă autorizarea nu răspunde, pagina o spune și dă 502', async () => {
    const env = mediuAdmin({})
    const stricat = {
      ...env,
      AUTORIZARE: {
        fetch: async (adresa: string, init?: RequestInit) => {
          const cale = new URL(adresa).pathname
          if (cale === '/harta-admini') return new Response('nu', { status: 500 })
          return env.AUTORIZARE.fetch(adresa, init)
        },
      },
    }
    const raspuns = await tabelul(stricat)
    expect(raspuns.status).toBe(502)
    expect(await raspuns.text()).toContain('Autorizarea nu a răspuns')
  })
})
