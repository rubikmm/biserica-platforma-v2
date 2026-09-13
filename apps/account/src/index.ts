import {
  asiguraCsrf,
  NUME_COOKIE_CSRF,
  NUME_COOKIE_SESIUNE,
  citesteCookie,
  construiesteCookie,
  cookieSters,
  sesiuneCurenta,
  verificaCsrf,
  verificaTokenCsrf,
} from '@xc/auth'
import {
  citesteConfig,
  navigatieDin,
  prefixSiCale,
  type Navigatie,
  type VariabileComune,
} from '@xc/config'
import { APLICATII_CU_MEMBRI, Masca, SESIUNE_ANONIMA, aplicatieCuMembri, type Asociere } from '@xc/contracts'
import { Logger, correlationId } from '@xc/observability'
import { dataVersiunii, html } from '@xc/ui'
import pkg from '../package.json'
import { paginaCod, paginaContNou, paginaIntrare, paginaMesaj, paginaProfil } from './pagini.js'

export interface Env {
  IDENTITATE: Fetcher
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  VERSIUNE?: { timestamp?: string }
}

function redirect(catre: string, antete: Record<string, string> = {}): Response {
  return new Response(null, { status: 303, headers: { location: catre, ...antete } })
}

async function apelIdentitate(env: Env, cale: string, corp: unknown, cid: string): Promise<Response> {
  return env.IDENTITATE.fetch(`https://identity.intern${cale}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-correlation-id': cid },
    body: JSON.stringify(corp),
  })
}

/** Asocierile omului cu aplicatiile platformei. Daca identitatea tace, pagina se deseneaza goala. */
async function asocierileMele(env: Env, userId: string, cid: string): Promise<Asociere[]> {
  try {
    const raspuns = await apelIdentitate(env, '/asocieri/ale-mele', { userId }, cid)
    if (!raspuns.ok) return []
    const date = (await raspuns.json()) as { asocieri?: Asociere[] }
    return date.asocieri ?? []
  } catch {
    return []
  }
}

/** Adresele aplicatiilor din registru, luate din `URL_*`-urile mediului. */
function adreseAplicatiilor(env: Env): Record<string, string> {
  const out: Record<string, string> = {}
  const brut = env as unknown as Record<string, unknown>
  for (const app of APLICATII_CU_MEMBRI) {
    const v = brut[app.cheieUrl]
    if (typeof v === 'string' && v) out[app.cheieUrl] = v
  }
  return out
}

/** Cere codul de intrare. Acelasi drum pentru „intra" si „cont nou" — difera doar numele purtat. */
async function cereCod(
  env: Env,
  req: Request,
  cid: string,
  email: string,
  nume: string | null,
): Promise<{ status: number; debugCod: string | null }> {
  const raspuns = await apelIdentitate(
    env,
    '/intrare',
    {
      email,
      ...(nume ? { displayName: nume } : {}),
      ip: req.headers.get('cf-connecting-ip') ?? 'necunoscut',
    },
    cid,
  )
  const date = (await raspuns.json().catch(() => ({}))) as { debugCod?: string | null }
  return { status: raspuns.status, debugCod: date.debugCod ?? null }
}

/**
 * Unde se intoarce omul de la comutatorul „vezi ca". Adresa vine din pagina de unde s-a apasat,
 * deci nu are voie sa fie crezuta pe nemestecat: o cale de pe gazda noastra trece, o adresa
 * intreaga trece numai daca originea e a platformei, si `//alt-site` (o cale doar la prima
 * vedere) e refuzata. Orice altceva cade pe radacina contului.
 */
function intoarcereSigura(brut: string | null, cfg: VariabileComune, nav: Navigatie): string | null {
  if (!brut || brut.startsWith('//')) return null
  if (brut.startsWith('/')) return brut
  let ceruta: URL
  try {
    ceruta = new URL(brut)
  } catch {
    return null
  }
  const alePlatformei = new Set(
    [cfg.ORIGINE_PUBLICA, ...Object.values(nav)]
      .filter((x) => x.startsWith('http'))
      .map((x) => {
        try {
          return new URL(x).origin
        } catch {
          return ''
        }
      }),
  )
  return alePlatformei.has(ceruta.origin) ? ceruta.toString() : null
}

/**
 * De unde a plecat omul sa se autentifice. Calatoreste prin tot fluxul — link → camp ascuns →
 * link — fiindca intre „scrie adresa" si „scrie codul" sunt doua formulare. Nu e crezuta pe
 * nemestecat: la final trece tot prin `intoarcereSigura`.
 */
function spreDinCerere(url: URL): string {
  return url.searchParams.get('spre') ?? ''
}

function spreDinFormular(formular: FormData): string {
  return String(formular.get('spre') ?? '')
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: 'app-account', correlationId: cid })
    const url = new URL(req.url)
    const { prefix, cale } = prefixSiCale(url, '/cont')
    const domeniu = cfg.DOMENIU_COOKIE
    const nav = navigatieDin(cfg)
    const ctx = { prefix, nav, versiune: pkg.version, modificata: dataVersiunii(env.VERSIUNE) }

    // Sesiunea se citeste o data, la intrare, si pentru paginile publice: sub masca
    // „neautentificat" pagina de intrare e tot ce vede omul, iar banda de acolo e singurul lui
    // drum de intoarcere. Fara asta, super-adminul mascat ar ramane inchis afara.
    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const spreAici = `${prefix}${cale === '/' ? '/' : cale}`
    const cine = {
      veziCa: sesiune.veziCa,
      poateVedeaCa: sesiune.poateVedeaCa,
      spre: spreAici,
    }

    // Bariera CSRF pentru orice metoda care schimba date.
    if (req.method === 'POST') {
      const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA], cfg.MEDIU === 'dev')
      if (problema) {
        log.warn('cerere respinsa de verificarea de origine', { problema })
        return html(
          paginaMesaj({ ctx, cine, titlu: 'Cerere respinsă', fel: 'rea', text: `Verificare de securitate: ${problema}.` }),
          403,
        )
      }
    }

    try {
      // ---------------------------------------------------------------- intrare
      if (cale === '/auth/login' && req.method === 'GET') {
        const csrf = asiguraCsrf(req, domeniu)
        return html(
          paginaIntrare({ ctx, cine, csrf: csrf.jeton, spre: spreDinCerere(url) }),
          200,
          csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {},
        )
      }

      if (cale === '/auth/login' && req.method === 'POST') {
        const formular = await req.formData()
        const problema = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problema) return html(paginaMesaj({ ctx, cine, titlu: 'Cerere respinsă', fel: 'rea', text: problema }), 403)

        const email = String(formular.get('email') ?? '').trim().toLowerCase()
        const spre = spreDinFormular(formular)
        const r = await cereCod(env, req, cid, email, null)

        if (r.status === 429) {
          const csrf = asiguraCsrf(req, domeniu)
          return html(
            paginaIntrare({ ctx, cine, csrf: csrf.jeton, email, spre, eroare: 'Prea multe cereri. Așteaptă câteva minute și reia.' }),
            429,
          )
        }
        if (r.status >= 400) {
          const csrf = asiguraCsrf(req, domeniu)
          return html(paginaIntrare({ ctx, cine, csrf: csrf.jeton, email, spre, eroare: 'Adresa nu pare validă.' }), 400)
        }
        return html(paginaCod({ ctx, cine, csrf: String(formular.get('csrf') ?? ''), email, spre, codDebug: r.debugCod }))
      }

      // ---------------------------------------------------------------- cont nou
      if (cale === '/auth/inregistrare' && req.method === 'GET') {
        const csrf = asiguraCsrf(req, domeniu)
        return html(
          paginaContNou({ ctx, cine, csrf: csrf.jeton, spre: spreDinCerere(url) }),
          200,
          csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {},
        )
      }

      if (cale === '/auth/inregistrare' && req.method === 'POST') {
        const formular = await req.formData()
        const problema = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problema) return html(paginaMesaj({ ctx, cine, titlu: 'Cerere respinsă', fel: 'rea', text: problema }), 403)

        const email = String(formular.get('email') ?? '').trim().toLowerCase()
        const nume = String(formular.get('nume') ?? '').trim()
        const spre = spreDinFormular(formular)

        if (!nume) {
          const csrf = asiguraCsrf(req, domeniu)
          return html(paginaContNou({ ctx, cine, csrf: csrf.jeton, email, spre, eroare: 'Spune-ne cum te cheamă.' }), 400)
        }

        const r = await cereCod(env, req, cid, email, nume)
        if (r.status === 429) {
          const csrf = asiguraCsrf(req, domeniu)
          return html(
            paginaContNou({ ctx, cine, csrf: csrf.jeton, email, nume, spre, eroare: 'Prea multe cereri. Așteaptă câteva minute și reia.' }),
            429,
          )
        }
        if (r.status >= 400) {
          const csrf = asiguraCsrf(req, domeniu)
          return html(paginaContNou({ ctx, cine, csrf: csrf.jeton, email, nume, spre, eroare: 'Adresa nu pare validă.' }), 400)
        }
        return html(
          paginaCod({ ctx, cine, csrf: String(formular.get('csrf') ?? ''), email, nume, spre, codDebug: r.debugCod }),
        )
      }

      // ------------------------------------------------- alt cod, pe aceeasi adresa
      if (cale === '/auth/cod-din-nou' && req.method === 'POST') {
        const formular = await req.formData()
        const problema = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problema) return html(paginaMesaj({ ctx, cine, titlu: 'Cerere respinsă', fel: 'rea', text: problema }), 403)

        const email = String(formular.get('email') ?? '').trim().toLowerCase()
        const nume = String(formular.get('nume') ?? '').trim() || null
        if (!email) return redirect(`${prefix}/auth/login`)

        const csrf = String(formular.get('csrf') ?? '')
        const spre = spreDinFormular(formular)
        const r = await cereCod(env, req, cid, email, nume)
        if (r.status === 429) {
          return html(
            paginaCod({ ctx, cine, csrf, email, nume, spre, eroare: 'S-au cerut prea multe coduri. Așteaptă câteva minute și reia.' }),
            429,
          )
        }
        return html(paginaCod({ ctx, cine, csrf, email, nume, spre, codDebug: r.debugCod }))
      }

      // ------------------------------------------------- cele sase cifre din email
      if (cale === '/auth/cod' && req.method === 'POST') {
        const formular = await req.formData()
        const problema = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problema) return html(paginaMesaj({ ctx, cine, titlu: 'Cerere respinsă', fel: 'rea', text: problema }), 403)

        const csrf = String(formular.get('csrf') ?? '')
        const email = String(formular.get('email') ?? '').trim().toLowerCase()
        const nume = String(formular.get('nume') ?? '').trim() || null
        const spre = spreDinFormular(formular)
        if (!email) return redirect(`${prefix}/auth/login`)

        // Cele sase casute se lipesc intr-un singur cod. Se accepta si un cod intreg scris
        // in prima casuta (fara JS, cine lipeste din scrisoare nimereste tot acolo).
        const cod = [1, 2, 3, 4, 5, 6]
          .map((i) => String(formular.get(`c${i}`) ?? ''))
          .join('')
          .replace(/\D/g, '')
          .slice(0, 6)

        if (cod.length < 6) {
          return html(paginaCod({ ctx, cine, csrf, email, nume, spre, eroare: 'Codul are șase cifre.' }), 400)
        }

        const raspuns = await apelIdentitate(
          env,
          '/confirma-cod',
          {
            email,
            cod,
            ip: req.headers.get('cf-connecting-ip') ?? 'necunoscut',
            userAgent: req.headers.get('user-agent') ?? '',
          },
          cid,
        )

        if (!raspuns.ok) {
          const date = (await raspuns.json().catch(() => ({}))) as { motiv?: string; ramase?: number | null }
          const text =
            date.motiv === 'cod gresit'
              ? typeof date.ramase === 'number' && date.ramase > 0
                ? `Codul nu e bun. Mai ai ${date.ramase} ${date.ramase === 1 ? 'încercare' : 'încercări'}.`
                : 'Codul nu e bun.'
              : date.motiv === 'cod expirat'
                ? 'Codul a expirat sau s-a greșit de prea multe ori. Cere altul.'
                : 'Codul nu mai e valabil. Cere altul.'
          return html(paginaCod({ ctx, cine, csrf, email, nume, spre, eroare: text }), 400)
        }

        const date = (await raspuns.json()) as { sessionToken: string; maxAge: number; contNou: boolean }
        const cookieSesiune = construiesteCookie(NUME_COOKIE_SESIUNE, date.sessionToken, {
          maxAge: date.maxAge,
          domeniu,
        })

        // Unde ajunge omul dupa cele sase cifre (user, 11.09.2026): inapoi in pagina din care a
        // plecat sa se autentifice; daca nu se stie de unde a venit, la HOME — „acolo unde pot să
        // aleg aplicația" —, nu in pagina contului. Contul nou isi pastreaza urarea.
        const inapoi =
          intoarcereSigura(spre, cfg, nav) ??
          (date.contNou ? `${prefix}/?bun-venit=1` : nav.home || '/')

        log.info('sesiune deschisa cu cod', { contNou: date.contNou })
        return redirect(inapoi, { 'set-cookie': cookieSesiune })
      }

      // ----------------------------------------------------------------- logout
      if (cale === '/auth/logout') {
        const jeton = citesteCookie(req, NUME_COOKIE_SESIUNE)
        if (jeton) await apelIdentitate(env, '/logout', { token: jeton }, cid)
        return redirect(`${prefix}/auth/login`, { 'set-cookie': cookieSters(NUME_COOKIE_SESIUNE, domeniu) })
      }

      // --------------------------------------------------------- profil + sesiuni
      /**
       * „Vezi ca": pune sau scoate masca de pe sesiune, apoi il duce pe om inapoi de unde a
       * apasat. Merge pe GET, desi schimba ceva, fiindca linkul vine din meniul altei aplicatii,
       * de pe alt subdomeniu: cookie-ul nostru e `SameSite=Lax`, deci pe un POST venit de acolo
       * n-ar ajunge deloc si comutarea n-ar avea de unde sti cine ești. Paza e `Sec-Fetch-Site`
       * — subdomeniile platformei sunt „same-site" si trec, un link de pe alt site e refuzat.
       * Chiar si trecut, raul ar fi marunt: masca merge doar in jos si se scoate cu un click.
       */
      if (cale === '/vezi-ca' && req.method === 'GET') {
        if (req.headers.get('sec-fetch-site') === 'cross-site') return redirect(`${prefix}/`)
        if (!sesiune.authenticated && !sesiune.veziCa) return redirect(`${prefix}/auth/login`)

        const jeton = citesteCookie(req, NUME_COOKIE_SESIUNE)
        if (!jeton) return redirect(`${prefix}/auth/login`)

        const ce = url.searchParams.get('ca') ?? ''
        const ceruta = Masca.safeParse(ce)
        if (ce !== 'real' && !ceruta.success) return redirect(`${prefix}/`)
        const masca = ce === 'real' ? null : ceruta.data

        const inapoi = intoarcereSigura(url.searchParams.get('spre'), cfg, nav) ?? `${prefix}/`
        const raspuns = await apelIdentitate(env, '/vezi-ca', { token: jeton, masca }, cid)

        if (!raspuns.ok) {
          const date = (await raspuns.json().catch(() => ({}))) as { motiv?: string }
          log.warn('masca refuzata', { motiv: date.motiv })
          return html(
            paginaMesaj({
              ctx,
              cine,
              titlu: 'Nu se poate',
              fel: 'rea',
              text: '„Vezi ca" e numai pentru super administratori, și numai spre un rol de sub al tău.',
            }),
            403,
          )
        }

        log.info('masca schimbata', { masca })
        return redirect(inapoi)
      }

      if (cale === '/auth/revoca-tot' && req.method === 'POST') {
        const formular = await req.formData()
        const problema = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problema) return html(paginaMesaj({ ctx, cine, titlu: 'Cerere respinsă', fel: 'rea', text: problema }), 403)
        if (!sesiune.authenticated || !sesiune.user) return redirect(`${prefix}/auth/login`)

        await apelIdentitate(env, '/revoca-toate', { userId: sesiune.user.id }, cid)
        return redirect(`${prefix}/auth/login`, { 'set-cookie': cookieSters(NUME_COOKIE_SESIUNE, domeniu) })
      }

      // Fisa omului, dintr-o singura apasare: numele afisat, prenumele, numele, numele scurt si
      // telefonul. Pana pe 14.09.2026 ruta se chema `/auth/nume` si salva un singur camp.
      if (cale === '/auth/date' && req.method === 'POST') {
        const formular = await req.formData()
        const problema = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problema) return html(paginaMesaj({ ctx, cine, titlu: 'Cerere respinsă', fel: 'rea', text: problema }), 403)
        if (!sesiune.authenticated || !sesiune.user) return redirect(`${prefix}/auth/login`)

        const camp = (n: string, max: number): string => String(formular.get(n) ?? '').trim().slice(0, max)
        const nume = camp('nume', 120)
        await apelIdentitate(
          env,
          '/utilizatori/date',
          {
            userId: sesiune.user.id,
            // Numele afisat nu se poate goli: fara el, antetul n-ar mai avea ce scrie.
            ...(nume ? { displayName: nume } : {}),
            firstName: camp('prenume', 80),
            lastName: camp('nume_familie', 80),
            shortName: camp('nume_scurt', 60),
            phone: camp('telefon', 40),
          },
          cid,
        )
        return redirect(`${prefix}/?salvat=1`)
      }

      // Comutatorul unei aplicatii. „Cer" scrie o CERERE — nu te face membru; primirea o face un
      // administrator al aplicatiei, din panoul ei. „Ies" lucreaza pe loc: plecarea nu cere voie.
      if ((cale === '/aplicatii/cer' || cale === '/aplicatii/ies') && req.method === 'POST') {
        const formular = await req.formData()
        const problema = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problema) return html(paginaMesaj({ ctx, cine, titlu: 'Cerere respinsă', fel: 'rea', text: problema }), 403)
        if (!sesiune.authenticated || !sesiune.user) return redirect(`${prefix}/auth/login`)

        const cod = String(formular.get('aplicatie') ?? '')
        if (!aplicatieCuMembri(cod)) {
          return html(paginaMesaj({ ctx, cine, titlu: 'Nu se poate', fel: 'rea', text: 'Aplicație necunoscută.' }), 400)
        }
        const cer = cale === '/aplicatii/cer'
        await apelIdentitate(
          env,
          cer ? '/asocieri/cere' : '/asocieri/scoate',
          cer
            ? { userId: sesiune.user.id, aplicatie: cod, cerutDe: sesiune.user.id }
            : { userId: sesiune.user.id, aplicatie: cod, deCatre: sesiune.user.id },
          cid,
        )
        return redirect(`${prefix}/?${cer ? 'cerut' : 'iesit'}=1`)
      }

      if (cale === '/' || cale === '/profil') {
        if (!sesiune.authenticated) return redirect(`${prefix}/auth/login`)
        const csrf = asiguraCsrf(req, domeniu)
        const mesaj = url.searchParams.has('bun-venit')
          ? 'Bine ai venit! Contul tău e deschis.'
          : url.searchParams.has('salvat')
            ? 'Datele au fost salvate.'
            : url.searchParams.has('cerut')
              ? 'Cererea a plecat. Un administrator al aplicației trebuie să te primească în echipă.'
              : url.searchParams.has('iesit')
                ? 'Gata — nu mai ești în echipă.'
                : undefined
        const asocieri = sesiune.user ? await asocierileMele(env, sesiune.user.id, cid) : []
        return html(
          paginaProfil({
            ctx,
            sesiune,
            csrf: csrf.jeton,
            spre: spreAici,
            asocieri,
            adrese: adreseAplicatiilor(env),
            ...(mesaj ? { mesaj } : {}),
          }),
          200,
          csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {},
        )
      }

      return html(paginaMesaj({ ctx, cine, titlu: 'Pagină inexistentă', fel: 'rea', text: 'Ruta nu există.' }), 404)
    } catch (e) {
      log.error('eroare neasteptata', { eroare: e instanceof Error ? e.message : String(e) })
      return html(paginaMesaj({ ctx, cine, titlu: 'Eroare', fel: 'rea', text: 'A apărut o eroare neașteptată.' }), 500)
    }
  },
}
