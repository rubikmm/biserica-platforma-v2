import {
  NUME_COOKIE_CSRF,
  NUME_COOKIE_SESIUNE,
  citesteCookie,
  construiesteCookie,
  cookieSters,
  sesiuneCurenta,
  verificaCsrf,
  verificaTokenCsrf,
} from '@xc/auth'
import { citesteConfig } from '@xc/config'
import { SESIUNE_ANONIMA } from '@xc/contracts'
import { Logger, correlationId } from '@xc/observability'
import { html } from '@xc/ui'
import {
  paginaAsteptareConfirmare,
  paginaInregistrare,
  paginaLogin,
  paginaMesaj,
  paginaProfil,
} from './pagini.js'

export interface Env {
  IDENTITATE: Fetcher
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
}

const DURATA_CSRF_SEC = 60 * 60 * 4

function jetonCsrfNou(): string {
  const octeti = crypto.getRandomValues(new Uint8Array(24))
  let binar = ''
  for (const octet of octeti) binar += String.fromCharCode(octet)
  return btoa(binar).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

/** Cookie-ul CSRF e citibil din JS-ul paginii? Nu — il punem noi in formular, deci ramane HttpOnly. */
function asiguraCsrf(req: Request, domeniu: string): { jeton: string; setCookie?: string } {
  const existent = citesteCookie(req, NUME_COOKIE_CSRF)
  if (existent) return { jeton: existent }
  const jeton = jetonCsrfNou()
  return {
    jeton,
    setCookie: construiesteCookie(NUME_COOKIE_CSRF, jeton, {
      maxAge: DURATA_CSRF_SEC,
      domeniu,
    }),
  }
}

function redirect(catre: string, antete: Record<string, string> = {}): Response {
  return new Response(null, { status: 303, headers: { location: catre, ...antete } })
}

async function apelIdentitate(
  env: Env,
  cale: string,
  corp: unknown,
  cid: string,
): Promise<Response> {
  return env.IDENTITATE.fetch(`https://identity.intern${cale}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-correlation-id': cid },
    body: JSON.stringify(corp),
  })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: 'app-account', correlationId: cid })
    const url = new URL(req.url)
    const cale = url.pathname
    const domeniu = cfg.DOMENIU_COOKIE

    // Bariera CSRF pentru orice metoda care schimba date.
    if (req.method === 'POST') {
      const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA])
      if (problema) {
        log.warn('cerere respinsa de verificarea de origine', { problema })
        return html(
          paginaMesaj({ titlu: 'Cerere respinsă', fel: 'rea', text: `Verificare de securitate: ${problema}.` }),
          403,
        )
      }
    }

    try {
      // ---------------------------------------------------------------- login
      if (cale === '/auth/login' && req.method === 'GET') {
        const csrf = asiguraCsrf(req, domeniu)
        return html(
          paginaLogin({ csrf: csrf.jeton }),
          200,
          csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {},
        )
      }

      if (cale === '/auth/login' && req.method === 'POST') {
        const formular = await req.formData()
        const problema = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problema) return html(paginaMesaj({ titlu: 'Cerere respinsă', fel: 'rea', text: problema }), 403)

        const email = String(formular.get('email') ?? '').trim().toLowerCase()
        const parola = String(formular.get('parola') ?? '')

        const raspuns = await apelIdentitate(
          env,
          '/login/pas1',
          {
            email,
            password: parola,
            ip: req.headers.get('cf-connecting-ip') ?? 'necunoscut',
            userAgent: req.headers.get('user-agent') ?? '',
          },
          cid,
        )

        if (raspuns.status === 429) {
          const csrf = asiguraCsrf(req, domeniu)
          return html(
            paginaLogin({
              csrf: csrf.jeton,
              email,
              eroare: 'Prea multe încercări. Așteaptă câteva minute și reia.',
            }),
            429,
          )
        }

        if (!raspuns.ok) {
          const csrf = asiguraCsrf(req, domeniu)
          return html(
            paginaLogin({ csrf: csrf.jeton, email, eroare: 'Datele nu par valide.' }),
            400,
          )
        }

        const date = (await raspuns.json()) as { debugLink?: string | null }
        return html(paginaAsteptareConfirmare({ email, linkDebug: date.debugLink ?? null }))
      }

      // ------------------------------------------------- pasul 2: linkul din email
      if (cale === '/auth/confirma' && req.method === 'GET') {
        const jeton = url.searchParams.get('jeton')
        if (!jeton) {
          return html(
            paginaMesaj({ titlu: 'Link incomplet', fel: 'rea', text: 'Linkul nu conține jetonul de confirmare.' }),
            400,
          )
        }

        const raspuns = await apelIdentitate(
          env,
          '/login/verifica',
          {
            token: jeton,
            ip: req.headers.get('cf-connecting-ip') ?? 'necunoscut',
            userAgent: req.headers.get('user-agent') ?? '',
          },
          cid,
        )

        if (!raspuns.ok) {
          const date = (await raspuns.json().catch(() => ({}))) as { motiv?: string }
          return html(
            paginaMesaj({
              titlu: 'Link neutilizabil',
              fel: 'rea',
              text:
                date.motiv === 'jeton expirat'
                  ? 'Linkul a expirat. Reia autentificarea ca să primești altul.'
                  : 'Linkul a fost deja folosit sau nu mai e valabil. Reia autentificarea.',
            }),
            400,
          )
        }

        const date = (await raspuns.json()) as { sessionToken: string; maxAge: number }
        const cookieSesiune = construiesteCookie(NUME_COOKIE_SESIUNE, date.sessionToken, {
          maxAge: date.maxAge,
          domeniu,
        })

        log.info('sesiune deschisa prin link')
        return redirect('/', { 'set-cookie': cookieSesiune })
      }

      // ------------------------------------------------------------ inregistrare
      if (cale === '/auth/inregistrare' && req.method === 'GET') {
        const csrf = asiguraCsrf(req, domeniu)
        return html(
          paginaInregistrare({ csrf: csrf.jeton }),
          200,
          csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {},
        )
      }

      if (cale === '/auth/inregistrare' && req.method === 'POST') {
        const formular = await req.formData()
        const problema = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problema) return html(paginaMesaj({ titlu: 'Cerere respinsă', fel: 'rea', text: problema }), 403)

        const email = String(formular.get('email') ?? '').trim().toLowerCase()
        const parola = String(formular.get('parola') ?? '')
        const nume = String(formular.get('nume') ?? '').trim()

        if (parola.length < 12) {
          const csrf = asiguraCsrf(req, domeniu)
          return html(
            paginaInregistrare({
              csrf: csrf.jeton,
              email,
              eroare: 'Parola trebuie să aibă cel puțin 12 caractere.',
            }),
            400,
          )
        }

        const raspuns = await apelIdentitate(
          env,
          '/inregistrare',
          { email, password: parola, ...(nume ? { displayName: nume } : {}) },
          cid,
        )

        if (!raspuns.ok) {
          const detalii = (await raspuns.json().catch(() => ({}))) as { detalii?: string[] }
          const csrf = asiguraCsrf(req, domeniu)
          return html(
            paginaInregistrare({
              csrf: csrf.jeton,
              email,
              eroare: detalii.detalii?.[0] ?? 'Datele nu par valide.',
            }),
            400,
          )
        }

        // Contul e creat; autentificarea trece prin acelasi flux ca oricare alta.
        const date = (await raspuns.json()) as { debugLink?: string | null }
        return html(
          paginaAsteptareConfirmare({ email, linkDebug: date.debugLink ?? null }),
        )
      }

      if (cale === '/auth/confirma-email' && req.method === 'GET') {
        const jeton = url.searchParams.get('jeton')
        if (!jeton) return html(paginaMesaj({ titlu: 'Link incomplet', fel: 'rea', text: 'Jeton lipsă.' }), 400)

        const raspuns = await apelIdentitate(env, '/confirma-email', { token: jeton }, cid)
        if (!raspuns.ok) {
          return html(
            paginaMesaj({ titlu: 'Link neutilizabil', fel: 'rea', text: 'Linkul a expirat sau a fost deja folosit.' }),
            400,
          )
        }
        return html(
          paginaMesaj({ titlu: 'Adresă confirmată', fel: 'buna', text: 'Emailul tău e confirmat. Te poți autentifica.' }),
        )
      }

      // ----------------------------------------------------------------- logout
      if (cale === '/auth/logout') {
        const jeton = citesteCookie(req, NUME_COOKIE_SESIUNE)
        if (jeton) await apelIdentitate(env, '/logout', { token: jeton }, cid)
        return redirect('/auth/login', { 'set-cookie': cookieSters(NUME_COOKIE_SESIUNE, domeniu) })
      }

      // --------------------------------------------------------- profil + sesiuni
      const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)

      if (cale === '/auth/revoca-tot' && req.method === 'POST') {
        const formular = await req.formData()
        const problema = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problema) return html(paginaMesaj({ titlu: 'Cerere respinsă', fel: 'rea', text: problema }), 403)
        if (!sesiune.authenticated || !sesiune.user) return redirect('/auth/login')

        await apelIdentitate(env, '/revoca-toate', { userId: sesiune.user.id }, cid)
        return redirect('/auth/login', { 'set-cookie': cookieSters(NUME_COOKIE_SESIUNE, domeniu) })
      }

      if (cale === '/' || cale === '/profil') {
        if (!sesiune.authenticated) return redirect('/auth/login')
        const csrf = asiguraCsrf(req, domeniu)
        return html(
          paginaProfil({ sesiune, csrf: csrf.jeton }),
          200,
          csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {},
        )
      }

      return html(paginaMesaj({ titlu: 'Pagină inexistentă', fel: 'rea', text: 'Ruta nu există.' }), 404)
    } catch (e) {
      log.error('eroare neasteptata', { eroare: e instanceof Error ? e.message : String(e) })
      return html(
        paginaMesaj({ titlu: 'Eroare', fel: 'rea', text: 'A apărut o eroare neașteptată.' }),
        500,
      )
    }
  },
}
