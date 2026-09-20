import { describe, expect, it } from 'vitest'
import {
  APLICATII_ADMINISTRABILE,
  Masca,
  NIVEL_MASCA_ADMIN,
  Principal,
  ROLURI,
  Rol,
  codulMastii,
  eMasca,
  nivelMasca,
  permisiunileMastii,
} from '../packages/contracts/src/index.js'
import authz from '../services/authorization-worker/src/index.js'
import identitate from '../services/identity-worker/src/index.js'

/**
 * MASCA DE ADMINISTRATOR E PE APLICAȚIE (user, 19.09.2026).
 *
 * Până azi platforma avea trei roluri (`user`, `admin`, `super-admin`), iar rândul „→ Administrator"
 * din meniul contului împrumuta rolul global `admin` — o treaptă care dădea peste tot, dar nu se
 * putea retrage de nicăieri. Modelul nou, hotărât de user:
 *   1. oricine e autentificat e UTILIZATOR;
 *   2. ADMINISTRATORUL UNEI APLICAȚII e un utilizator cu cheile ei (registrul din `admini.ts`);
 *   3. SUPER-ADMINUL e admin pe toate, fiindcă le are pe toate cheile;
 *   4. rolul global `admin` s-a stins, iar masca a devenit `admin:<cod>` — „administratorul ACESTEI
 *      aplicații".
 *
 * Probele de aici păzesc lanțul întreg, fiindcă fiecare verigă se poate strica TĂCUT:
 *   (1) rolul stins chiar nu mai trece nicăieri;
 *   (2) masca se validează față de REGISTRU, nu față de o formă de șir;
 *   (3) autorizarea dă sub mască exact cheile aplicației, nici una în plus;
 *   (4) identitatea nu inventează un rol `admin:…` în `roles`;
 *   (5) nicio aplicație din registru nu uită să-i spună carcasei codul ei.
 */

// ---------------------------------------------------------------------------
// (1) + (2) Contractele
// ---------------------------------------------------------------------------

describe('rolul global `admin` s-a stins', () => {
  it('rolurile sunt două, iar `admin` nu mai trece de schemă', () => {
    expect([...ROLURI]).toEqual(['user', 'super-admin'])
    expect(Rol.safeParse('admin').success).toBe(false)
    expect(Rol.safeParse('user').success).toBe(true)
    expect(Rol.safeParse('super-admin').success).toBe(true)
  })
})

describe('masca poartă codul aplicației', () => {
  it('`admin:<cod>` trece numai pentru aplicațiile din registru', () => {
    expect(Masca.safeParse('admin:calendar').success).toBe(true)
    expect(Masca.safeParse('admin:curatenie').success).toBe(true)
    // ⚠️ Un cod care nu e în registru NU e mască: altfel rândul ar duce la un panou fantomă.
    expect(Masca.safeParse('admin:inexistent').success).toBe(false)
    // Nici masca veche, fără cod, nu mai trece — chiar asta s-a stins azi.
    expect(Masca.safeParse('admin').success).toBe(false)
    expect(Masca.safeParse('admin:').success).toBe(false)
    expect(Masca.safeParse('user').success).toBe(true)
    expect(Masca.safeParse('anonim').success).toBe(true)
  })

  it('toate aplicațiile din registru au o mască validă', () => {
    for (const a of APLICATII_ADMINISTRABILE) {
      expect(eMasca(`admin:${a.cod}`), a.cod).toBe(true)
      expect(codulMastii(`admin:${a.cod}`), a.cod).toBe(a.cod)
    }
  })

  it('treapta e între utilizator și super-admin, ca validarea „numai în jos" să țină', () => {
    expect(nivelMasca('admin:calendar')).toBe(NIVEL_MASCA_ADMIN)
    expect(NIVEL_MASCA_ADMIN).toBe(2)
    expect(nivelMasca('user')).toBeLessThan(NIVEL_MASCA_ADMIN)
    expect(nivelMasca('anonim')).toBe(0)
  })

  it('principalul duce masca întreagă la autorizare', () => {
    const p = Principal.parse({ userId: 'u1', email: 'om@exemplu.ro', veziCa: 'admin:curatenie' })
    expect(p.veziCa).toBe('admin:curatenie')
    expect(Principal.safeParse({ userId: 'u1', email: 'om@exemplu.ro', veziCa: 'admin' }).success).toBe(false)
  })

  it('cheile măștii sunt ale utilizatorului plus ale aplicației, și atât', () => {
    const chei = permisiunileMastii('admin:curatenie')
    expect(chei).toContain('cleaning.manage')
    expect(chei).toContain('program.read')
    expect(chei).not.toContain('calendar.manage')
    expect(chei).not.toContain('roles.manage')
    expect(chei).not.toContain('audit.read')
  })
})

// ---------------------------------------------------------------------------
// (3) Autorizarea, la sursă
// ---------------------------------------------------------------------------

/**
 * Un D1 de hârtie cât îi trebuie lui `decide`. Ține minte ce s-a întrebat: sub mască NU trebuie să
 * se citească nimic din bază — nici rolurile adevărate, nici granturile personale. Dacă vreodată se
 * citesc, previzualizarea începe să mintă, iar proba prinde chiar citirea, nu doar răspunsul.
 */
function bazaAutorizarii(o: {
  roluri?: { role: string; scope: string }[]
  granturi?: { permission: string; scope: string }[]
  urme?: string[]
}) {
  const executa = (sqlBrut: string): Record<string, unknown>[] => {
    const s = sqlBrut.replace(/\s+/g, ' ').trim()
    o.urme?.push(s.slice(0, 60))
    if (s.startsWith('SELECT role, scope FROM role_assignments')) return o.roluri ?? []
    if (s.startsWith('SELECT permission, scope FROM permission_grants')) return o.granturi ?? []
    throw new Error(`interogare necunoscută în baza de probă: ${s}`)
  }
  const declaratie = (sql: string) => ({
    async all() {
      return { results: executa(sql) }
    },
    async first() {
      return executa(sql)[0] ?? null
    },
    async run() {
      return { meta: {} }
    },
  })
  return {
    prepare: (sql: string) => ({ ...declaratie(sql), bind: () => declaratie(sql) }),
  }
}

async function poate(
  db: unknown,
  principal: Record<string, unknown>,
  permission: string,
): Promise<boolean> {
  const raspuns = await authz.fetch(
    new Request('https://authz.intern/can', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ principal, permission, resourceScope: 'global', correlationId: 'probă' }),
    }),
    { DB: db, MEDIU: 'test' } as never,
  )
  return ((await raspuns.json()) as { allowed: boolean }).allowed
}

describe('autorizarea sub masca `admin:<cod>`', () => {
  const OM = { userId: 'u1', email: 'sef@exemplu.ro' }

  it('dă cheile aplicației mascate și nimic din alta', async () => {
    const db = bazaAutorizarii({ roluri: [{ role: 'super-admin', scope: 'global' }] })
    const caCuratenie = { ...OM, veziCa: 'admin:curatenie' }
    expect(await poate(db, caCuratenie, 'cleaning.manage')).toBe(true)
    expect(await poate(db, caCuratenie, 'calendar.manage')).toBe(false)
    expect(await poate(db, caCuratenie, 'roles.manage')).toBe(false)
    expect(await poate(db, caCuratenie, 'audit.read')).toBe(false)
    // Utilizatorul din spatele măștii citește programul, ca oricare altul.
    expect(await poate(db, caCuratenie, 'program.read')).toBe(true)
  })

  it('cheile însoțitoare vin odată cu numirea, deci și cu masca', async () => {
    const db = bazaAutorizarii({})
    const caProgram = { ...OM, veziCa: 'admin:program' }
    expect(await poate(db, caProgram, 'program.write')).toBe(true)
    expect(await poate(db, caProgram, 'program.publish')).toBe(true)
  })

  /** ⚠️ Chiar asta e rostul măștii: rolurile adevărate și granturile personale rămân afară. */
  it('nu se uită nici la rolurile adevărate, nici la granturile personale', async () => {
    const urme: string[] = []
    const db = bazaAutorizarii({
      roluri: [{ role: 'super-admin', scope: 'global' }],
      granturi: [{ permission: 'calendar.manage', scope: 'global' }],
      urme,
    })
    const caCuratenie = { ...OM, veziCa: 'admin:curatenie' }
    expect(await poate(db, caCuratenie, 'calendar.manage')).toBe(false)
    expect(await poate(db, caCuratenie, 'audit.read')).toBe(false)
    // …și nici n-a deschis baza ca să afle
    expect(urme).toEqual([])
  })

  it('fără mască, același om e super-admin și le poate pe toate', async () => {
    const db = bazaAutorizarii({ roluri: [{ role: 'super-admin', scope: 'global' }] })
    expect(await poate(db, OM, 'roles.manage')).toBe(true)
    expect(await poate(db, OM, 'cleaning.manage')).toBe(true)
  })

  /**
   * ⚠️ CEI CU ROLUL VECHI `admin` ÎN BAZĂ: rândul nu mai trece de `Rol.safeParse`, deci autorizarea
   * îl trece cu vederea, tăcut. Rămân, practic, utilizatori — cheile pe care le țineau se dau înapoi
   * ca numire pe aplicație, din Setările fiecăreia.
   */
  it('un rând `role = admin` rămas în bază nu mai dă nimic', async () => {
    const db = bazaAutorizarii({ roluri: [{ role: 'admin', scope: 'global' }] })
    expect(await poate(db, OM, 'calendar.manage')).toBe(false)
    expect(await poate(db, OM, 'cleaning.manage')).toBe(false)
    expect(await poate(db, OM, 'broadcast.manage')).toBe(false)
    // Îi rămâne numai ce n-a atârnat niciodată de rolul acela.
    expect(await poate(db, OM, 'program.read')).toBe(false)
  })

  it('masca „neautentificat" nu deschide nimic', async () => {
    const db = bazaAutorizarii({ roluri: [{ role: 'super-admin', scope: 'global' }] })
    expect(await poate(db, { ...OM, veziCa: 'anonim' }, 'program.read')).toBe(false)
  })

  it('o mască inventată e respinsă de schemă, nu tratată ca „fără mască"', async () => {
    const raspuns = await authz.fetch(
      new Request('https://authz.intern/can', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          principal: { ...OM, veziCa: 'admin:inexistent' },
          permission: 'roles.manage',
          resourceScope: 'global',
          correlationId: 'probă',
        }),
      }),
      { DB: bazaAutorizarii({ roluri: [{ role: 'super-admin', scope: 'global' }] }), MEDIU: 'test' } as never,
    )
    expect(raspuns.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// (4) Identitatea: ce vede aplicația de pe sesiunea mascată
// ---------------------------------------------------------------------------

const UTILIZATOR = {
  id: 'u1',
  email: 'sef@exemplu.ro',
  display_name: 'Șeful',
  first_name: null,
  last_name: null,
  phone: null,
  short_name: null,
  email_verified_at: null,
  disabled_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

/** Baza identității, cât îi trebuie lui `/sesiune`: o sesiune și omul ei. */
function bazaIdentitatii(veziCa: string | null) {
  const executa = (sqlBrut: string): Record<string, unknown>[] => {
    const s = sqlBrut.replace(/\s+/g, ' ').trim()
    if (s.startsWith('SELECT id, user_id, expires_at, revoked_at, vezi_ca FROM sessions')) {
      return [{ id: 's1', user_id: 'u1', expires_at: '2099-01-01T00:00:00.000Z', revoked_at: null, vezi_ca: veziCa }]
    }
    if (s.startsWith('SELECT * FROM users WHERE id = ?')) return [UTILIZATOR]
    throw new Error(`interogare necunoscută în baza de probă: ${s}`)
  }
  const declaratie = (sql: string) => ({
    async all() {
      return { results: executa(sql) }
    },
    async first() {
      return executa(sql)[0] ?? null
    },
    async run() {
      return { meta: {} }
    },
  })
  return { prepare: (sql: string) => ({ ...declaratie(sql), bind: () => declaratie(sql) }) }
}

function mediulIdentitatii(veziCa: string | null) {
  const raspunde = (date: unknown) =>
    new Response(JSON.stringify(date), { headers: { 'content-type': 'application/json' } })
  return {
    DB: bazaIdentitatii(veziCa),
    MEDIU: 'staging',
    ORIGINE_PUBLICA: 'https://cont.staging.sfantul-ilie.ro',
    DOMENIU_COOKIE: '.staging.sfantul-ilie.ro',
    // ⚠️ ALTĂ adresă decât a omului din probă: altfel i s-ar pune rolul de super-admin la loc și
    // proba n-ar mai spune nimic despre cazul pe care îl urmărim.
    EMAIL_SUPERADMIN: 'rubikmm@gmail.com',
    AUTORIZARE: { fetch: async () => raspunde({ roles: [{ role: 'super-admin', scope: 'global' }] }) },
    AUDIT: { fetch: async () => raspunde({ ok: true }) },
  }
}

const sesiuneaDe = async (veziCa: string | null) =>
  (await (
    await identitate.fetch(
      new Request('https://identitate.intern/sesiune', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'jeton-de-probă' }),
      }),
      mediulIdentitatii(veziCa) as never,
    )
  ).json()) as { roles: { role: string; scope: string }[]; veziCa: string | null; poateVedeaCa: boolean }

describe('identitatea, sub masca `admin:<cod>`', () => {
  /**
   * ⚠️ ROLUL EFECTIV E `user`, NU un rol inventat `admin:curatenie`. Cheile aplicației nu vin din
   * `roles`, ci de la autorizare, care le citește din `veziCa` — iar un ecran care s-ar uita la
   * `roles` ar crede altfel într-o treaptă care nu există nicăieri altundeva.
   */
  it('rolul efectiv e `user`, iar masca merge întreagă mai departe', async () => {
    const s = await sesiuneaDe('admin:curatenie')
    expect(s.roles).toEqual([{ role: 'user', scope: 'global' }])
    expect(s.veziCa).toBe('admin:curatenie')
    expect(s.poateVedeaCa).toBe(true)
  })

  it('fără mască, rolurile adevărate rămân neatinse', async () => {
    const s = await sesiuneaDe(null)
    expect(s.roles).toEqual([{ role: 'super-admin', scope: 'global' }])
    expect(s.veziCa).toBeNull()
  })

  /**
   * ⚠️ O MASCĂ VECHE, RĂMASĂ PE O SESIUNE DESCHISĂ ÎNAINTE DE 19.09.2026, se poartă ca „fără mască":
   * schema n-o mai cunoaște. Omul se vede iar cu ochii lui, nu cu ai unei trepte care nu mai există.
   */
  it('masca veche `admin` se stinge singură, fără migrație', async () => {
    const s = await sesiuneaDe('admin')
    expect(s.veziCa).toBeNull()
    expect(s.roles).toEqual([{ role: 'super-admin', scope: 'global' }])
  })
})

// ---------------------------------------------------------------------------
// (5) Structural: nicio aplicație nu uită să-i spună carcasei codul ei
// ---------------------------------------------------------------------------

describe('toate aplicațiile din registru dau carcasei codul lor', () => {
  /**
   * ⚠️ Rândul „→ Administrator" atârnă de `Cont.cod`. O aplicație care uită să-l dea NU se strică
   * zgomotos: totul merge, doar că super-adminul nu mai are de unde să intre în pielea adminului ei —
   * exact felul de defect pe care nu-l vede nimeni până pe producție.
   *
   * Se caută în obiectul `Cont` al fiecărei aplicații (îl recunoaștem după `urlSetari`, care stă tot
   * acolo și e dat de toate unsprezece).
   */
  it('fiecare are `cod:` lângă `urlSetari` în obiectul contului', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const radacina = new URL('../', import.meta.url).pathname

    const gasite = new Map<string, string[]>()
    const umbla = (dosar: string, cod: string) => {
      for (const nume of readdirSync(dosar)) {
        const cale = join(dosar, nume)
        if (statSync(cale).isDirectory()) {
          if (nume !== 'node_modules' && !nume.startsWith('.')) umbla(cale, cod)
          continue
        }
        if (!nume.endsWith('.ts')) continue
        const linii = readFileSync(cale, 'utf8').split('\n')
        linii.forEach((linie, i) => {
          if (!/\burlSetari:/.test(linie)) return
          // ghilimelele nu contează: fișierele platformei le folosesc pe amândouă
          const fereastra = linii.slice(Math.max(0, i - 12), i + 12).join('\n').replace(/"/g, "'")
          gasite.get(cod)!.push(new RegExp(`\\bcod: *'${cod}'`).test(fereastra) ? 'da' : `${cale.slice(radacina.length)}:${i + 1}`)
        })
      }
    }

    for (const a of APLICATII_ADMINISTRABILE) {
      gasite.set(a.cod, [])
      umbla(join(radacina, 'apps', a.cod, 'src'), a.cod)
    }

    const fara: string[] = []
    for (const [cod, rezultate] of gasite) {
      // fiecare aplicație trebuie să aibă măcar un obiect `Cont`…
      expect(rezultate.length, `${cod}: n-am găsit obiectul contului`).toBeGreaterThan(0)
      // …și toate cele găsite să poarte codul
      fara.push(...rezultate.filter((r) => r !== 'da'))
    }
    expect(fara).toEqual([])
    expect(gasite.size).toBe(11)
  })
})
