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
import { citesteConfig, navigatieDin, prefixSiCale } from '@xc/config'
import { SESIUNE_ANONIMA } from '@xc/contracts'
import { Logger, correlationId } from '@xc/observability'
import { dataVersiunii, html } from '@xc/ui'
import pkg from '../package.json'
import {
  paginaAsteptareLink,
  paginaContNou,
  paginaIntrare,
  paginaMesaj,
  paginaProfil,
} from './pagini.js'

export interface Env {
  IDENTITATE: Fetcher
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  VERSIUNE?: { timestamp?: string }
}

const DURATA_CSRF_SEC = 60 * 60 * 4

function jetonCsrfNou(): string {
  const octeti = crypto.getRandomValues(new Uint8Array(24))
  let binar = ''
  for (const octet of octeti) binar += String.fromCharCode(octet)
  return btoa(binar).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function asiguraCsrf(req: Request, domeniu: string): { jeton: string; setCookie?: string } {
  const existent = citesteCookie(req, NUME_COOKIE_CSRF)
  if (existent) return { jeton: existent }
  const jeton = jetonCsrfNou()
  return {
    jeton,
    setCookie: construiesteCookie(NUME_COOKIE_CSRF, jeton, { maxAge: DURATA_CSRF_SEC, domeniu }),
  }
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

/** Cere linkul de intrare. Acelasi drum pentru „intra" si „cont nou" — difera doar numele purtat. */
async function cereLink(
  env: Env,
  req: Request,
  cid: string,
  email: string,
  nume: string | null,
): Promise<{ status: number; debugLink: string | null }> {
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
  const date = (await raspuns.json().catch(() => ({}))) as { debugLink?: string | null }
  return { status: raspuns.status, debugLink: date.debugLink ?? null }
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

    // Bariera CSRF pentru orice metoda care schimba date.
    if (req.method === 'POST') {
      const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA])
      if (problema) {
        log.warn('cerere respinsa de verificarea de origine', { problema })
        return html(
          paginaMesaj({ ctx,titlu: 'Cerere respinsă', fel: 'rea', text: `Verificare de securitate: ${problema}.` }),
          403,
        )
      }
    }

    try {
      // ---------------------------------------------------------------- intrare
      if (cale === '/auth/login' && req.method === 'GET') {
        const csrf = asiguraCsrf(req, domeniu)
        return html(
          paginaIntrare({ ctx,csrf: csrf.jeton }),
          200,
          csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {},
        )
      }

      if (cale === '/auth/login' && req.method === 'POST') {
        const formular = await req.formData()
        const problema = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problema) return html(paginaMesaj({ ctx,titlu: 'Cerere respinsă', fel: 'rea', text: problema }), 403)

        const email = String(formular.get('email') ?? '').trim().toLowerCase()
        const r = await cereLink(env, req, cid, email, null)

        if (r.status === 429) {
          const csrf = asiguraCsrf(req, domeniu)
          return html(
            paginaIntrare({ ctx,csrf: csrf.jeton, email, eroare: 'Prea multe cereri. Așteaptă câteva minute și reia.' }),
            429,
          )
        }
        if (r.status >= 400) {
          const csrf = asiguraCsrf(req, domeniu)
          return html(paginaIntrare({ ctx,csrf: csrf.jeton, email, eroare: 'Adresa nu pare validă.' }), 400)
        }
        return html(paginaAsteptareLink({ ctx,email, linkDebug: r.debugLink }))
      }

      // ---------------------------------------------------------------- cont nou
      if (cale === '/auth/inregistrare' && req.method === 'GET') {
        const csrf = asiguraCsrf(req, domeniu)
        return html(
          paginaContNou({ ctx,csrf: csrf.jeton }),
          200,
          csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {},
        )
      }

      if (cale === '/auth/inregistrare' && req.method === 'POST') {
        const formular = await req.formData()
        const problema = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problema) return html(paginaMesaj({ ctx,titlu: 'Cerere respinsă', fel: 'rea', text: problema }), 403)

        const email = String(formular.get('email') ?? '').trim().toLowerCase()
        const nume = String(formular.get('nume') ?? '').trim()

        if (!nume) {
          const csrf = asiguraCsrf(req, domeniu)
          return html(paginaContNou({ ctx,csrf: csrf.jeton, email, eroare: 'Spune-ne cum te cheamă.' }), 400)
        }

        const r = await cereLink(env, req, cid, email, nume)
        if (r.status === 429) {
          const csrf = asiguraCsrf(req, domeniu)
          return html(
            paginaContNou({ ctx,csrf: csrf.jeton, email, nume, eroare: 'Prea multe cereri. Așteaptă câteva minute și reia.' }),
            429,
          )
        }
        if (r.status >= 400) {
          const csrf = asiguraCsrf(req, domeniu)
          return html(paginaContNou({ ctx,csrf: csrf.jeton, email, nume, eroare: 'Adresa nu pare validă.' }), 400)
        }
        return html(paginaAsteptareLink({ ctx,email, linkDebug: r.debugLink }))
      }

      // ------------------------------------------------- linkul din email
      if (cale === '/auth/confirma' && req.method === 'GET') {
        const jeton = url.searchParams.get('jeton')
        if (!jeton) {
          return html(
            paginaMesaj({ ctx,titlu: 'Link incomplet', fel: 'rea', text: 'Linkul nu conține jetonul de confirmare.' }),
            400,
          )
        }

        const raspuns = await apelIdentitate(
          env,
          '/confirma',
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
            paginaMesaj({ ctx,
              titlu: 'Link neutilizabil',
              fel: 'rea',
              text:
                date.motiv === 'jeton expirat'
                  ? 'Linkul a expirat. Cere altul — durează câteva secunde.'
                  : 'Linkul a fost deja folosit sau nu mai e valabil. Cere altul.',
            }),
            400,
          )
        }

        const date = (await raspuns.json()) as { sessionToken: string; maxAge: number; contNou: boolean }
        const cookieSesiune = construiesteCookie(NUME_COOKIE_SESIUNE, date.sessionToken, {
          maxAge: date.maxAge,
          domeniu,
        })

        log.info('sesiune deschisa prin link', { contNou: date.contNou })
        return redirect(date.contNou ? '/?bun-venit=1' : '/', { 'set-cookie': cookieSesiune })
      }

      // ----------------------------------------------------------------- logout
      if (cale === '/auth/logout') {
        const jeton = citesteCookie(req, NUME_COOKIE_SESIUNE)
        if (jeton) await apelIdentitate(env, '/logout', { token: jeton }, cid)
        return redirect(`${prefix}/auth/login`, { 'set-cookie': cookieSters(NUME_COOKIE_SESIUNE, domeniu) })
      }

      // --------------------------------------------------------- profil + sesiuni
      const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)

      if (cale === '/auth/revoca-tot' && req.method === 'POST') {
        const formular = await req.formData()
        const problema = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problema) return html(paginaMesaj({ ctx,titlu: 'Cerere respinsă', fel: 'rea', text: problema }), 403)
        if (!sesiune.authenticated || !sesiune.user) return redirect(`${prefix}/auth/login`)

        await apelIdentitate(env, '/revoca-toate', { userId: sesiune.user.id }, cid)
        return redirect(`${prefix}/auth/login`, { 'set-cookie': cookieSters(NUME_COOKIE_SESIUNE, domeniu) })
      }

      if (cale === '/auth/nume' && req.method === 'POST') {
        const formular = await req.formData()
        const problema = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problema) return html(paginaMesaj({ ctx,titlu: 'Cerere respinsă', fel: 'rea', text: problema }), 403)
        if (!sesiune.authenticated || !sesiune.user) return redirect(`${prefix}/auth/login`)

        const nume = String(formular.get('nume') ?? '').trim().slice(0, 120)
        if (nume) await apelIdentitate(env, '/nume', { userId: sesiune.user.id, displayName: nume }, cid)
        return redirect(`${prefix}/?salvat=1`)
      }

      if (cale === '/' || cale === '/profil') {
        if (!sesiune.authenticated) return redirect(`${prefix}/auth/login`)
        const csrf = asiguraCsrf(req, domeniu)
        const mesaj = url.searchParams.has('bun-venit')
          ? 'Bine ai venit! Contul tău e deschis.'
          : url.searchParams.has('salvat')
            ? 'Numele a fost salvat.'
            : undefined
        return html(
          paginaProfil({ ctx, sesiune, csrf: csrf.jeton, ...(mesaj ? { mesaj } : {}) }),
          200,
          csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {},
        )
      }

      return html(paginaMesaj({ ctx,titlu: 'Pagină inexistentă', fel: 'rea', text: 'Ruta nu există.' }), 404)
    } catch (e) {
      log.error('eroare neasteptata', { eroare: e instanceof Error ? e.message : String(e) })
      return html(paginaMesaj({ ctx,titlu: 'Eroare', fel: 'rea', text: 'A apărut o eroare neașteptată.' }), 500)
    }
  },
}
