import { z } from 'zod'
import {
  CerereInregistrare,
  CerereLogin,
  SESIUNE_ANONIMA,
  type AtribuireRol,
  type SesiuneCurenta,
  redacteaza,
} from '@xc/contracts'
import { citesteConfig, permiteLinkDebug } from '@xc/config'
import { Logger, correlationId } from '@xc/observability'
import { hashParola, verificaParola, consumaTimpDegeaba } from './parole.js'
import {
  DURATA_CHALLENGE_SEC,
  DURATA_SESIUNE_SEC,
  DURATA_VERIFICARE_EMAIL_SEC,
} from './jetoane.js'
import {
  catreUtilizator,
  consumaJeton,
  creeazaSesiune,
  creeazaUtilizator,
  emailuriDeDebug,
  emiteJeton,
  invalideazaJetoaneleAnterioare,
  marcheazaEmailVerificat,
  revocaSesiune,
  revocaToateSesiunile,
  sesiuneDupaJeton,
  utilizatorDupaEmail,
  utilizatorDupaId,
} from './depozit.js'
import {
  EmailFurnizorHttp,
  EmailSandbox,
  textConfirmareLogin,
  textVerificareEmail,
  type AdaptorEmail,
} from './email.js'
import {
  LIMITA_LOGIN_EMAIL,
  LIMITA_LOGIN_IP,
  eBlocat,
  inregistreazaIncercare,
  resetIncercari,
} from './rate-limit.js'

export interface Env {
  DB: D1Database
  AUTORIZARE: Fetcher
  AUDIT: Fetcher
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  ADAPTOR_EMAIL?: string
  EMAIL_API_URL?: string
  EMAIL_API_KEY?: string
  EMAIL_EXPEDITOR?: string
}

const SERVICIU = 'identity-worker'

function json(date: unknown, status = 200): Response {
  return new Response(JSON.stringify(date), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function alegeAdaptorEmail(env: Env): AdaptorEmail {
  if (env.ADAPTOR_EMAIL === 'http' && env.EMAIL_API_URL && env.EMAIL_API_KEY) {
    return new EmailFurnizorHttp(env.EMAIL_API_URL, env.EMAIL_API_KEY, env.EMAIL_EXPEDITOR ?? '')
  }
  return new EmailSandbox(env.DB)
}

async function scrieAudit(
  env: Env,
  log: Logger,
  intrare: {
    action: string
    target: string
    outcome: 'success' | 'failure' | 'denied'
    correlationId: string
    actorId?: string
    summary?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await env.AUDIT.fetch('https://audit.intern/scrie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: intrare.action,
        target: intrare.target,
        scope: 'global',
        actor: intrare.actorId ? { type: 'user', id: intrare.actorId } : { type: 'system' },
        outcome: intrare.outcome,
        correlationId: intrare.correlationId,
        summary: redacteaza(intrare.summary ?? {}),
      }),
    })
  } catch (e) {
    // Auditul indisponibil nu trebuie sa blocheze autentificarea, dar se vede in log.
    log.error('audit indisponibil', { eroare: e instanceof Error ? e.message : String(e) })
  }
}

async function atribuieRol(
  env: Env,
  userId: string,
  role: string,
  cid: string,
): Promise<void> {
  await env.AUTORIZARE.fetch('https://authz.intern/atribuie', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId, role, scope: 'global', correlationId: cid }),
  })
}

async function roluriUtilizator(env: Env, userId: string): Promise<AtribuireRol[]> {
  try {
    const raspuns = await env.AUTORIZARE.fetch('https://authz.intern/roluri', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (!raspuns.ok) return []
    const date = (await raspuns.json()) as { roles?: AtribuireRol[] }
    return date.roles ?? []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------

const CerereVerificare = z.object({
  token: z.string().min(1),
  ip: z.string().default('necunoscut'),
  userAgent: z.string().default(''),
})

const CerereJeton = z.object({ token: z.string().min(1) })

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: SERVICIU, correlationId: cid })
    const cale = new URL(req.url).pathname

    if (req.method !== 'POST') {
      return json({ eroare: 'doar POST' }, 405)
    }

    try {
      switch (cale) {
        // -------------------------------------------------------------------
        case '/inregistrare': {
          const date = CerereInregistrare.parse(await req.json())
          const hash = await hashParola(date.password)
          const rezultat = await creeazaUtilizator(
            env.DB,
            date.email,
            hash,
            date.displayName ?? null,
          )

          if (rezultat.fel === 'exista') {
            await scrieAudit(env, log, {
              action: 'identity.register',
              target: date.email,
              outcome: 'failure',
              correlationId: cid,
              summary: { motiv: 'email deja inregistrat' },
            })
            // Raspuns identic cu succesul: nu confirmam existenta unui cont.
            return json({ inregistrat: true, debugLink: null })
          }

          const utilizator = rezultat.utilizator
          const eSuperadmin =
            cfg.EMAIL_SUPERADMIN !== '' &&
            utilizator.email === cfg.EMAIL_SUPERADMIN.trim().toLowerCase()

          await atribuieRol(env, utilizator.id, eSuperadmin ? 'super-admin' : 'user', cid)

          const jeton = await emiteJeton(
            env.DB,
            'email_verification_tokens',
            utilizator.id,
            DURATA_VERIFICARE_EMAIL_SEC,
          )
          const link = `${cfg.ORIGINE_PUBLICA}/auth/confirma-email?jeton=${encodeURIComponent(jeton)}`
          const email = alegeAdaptorEmail(env)
          const trimitere = await email.trimite({
            catre: utilizator.email,
            subiect: 'Confirmă adresa de email',
            text: textVerificareEmail(link),
            link,
            correlationId: cid,
          })

          await scrieAudit(env, log, {
            action: 'identity.register',
            target: utilizator.id,
            outcome: 'success',
            correlationId: cid,
            actorId: utilizator.id,
            summary: {
              superadmin: eSuperadmin,
              emailLivrat: trimitere.livrat,
              adaptor: email.nume,
            },
          })

          log.info('utilizator creat', { superadmin: eSuperadmin })

          return json({
            inregistrat: true,
            superadmin: eSuperadmin,
            debugLink: permiteLinkDebug(cfg) ? link : null,
          })
        }

        // -------------------------------------------------------------------
        // Pasul 1 din login: parola. Nu creeaza sesiune — doar trimite linkul de confirmare.
        case '/login/pas1': {
          const brut = (await req.json()) as Record<string, unknown>
          const date = CerereLogin.parse(brut)
          const ip = typeof brut.ip === 'string' ? brut.ip : 'necunoscut'
          const userAgent = typeof brut.userAgent === 'string' ? brut.userAgent : ''

          if (
            (await eBlocat(env.DB, date.email, 'email', LIMITA_LOGIN_EMAIL)) ||
            (await eBlocat(env.DB, ip, 'ip', LIMITA_LOGIN_IP))
          ) {
            await scrieAudit(env, log, {
              action: 'identity.login.step1',
              target: date.email,
              outcome: 'denied',
              correlationId: cid,
              summary: { motiv: 'limita de incercari atinsa' },
            })
            return json({ challengeSent: true, debugLink: null, limitat: true }, 429)
          }

          await inregistreazaIncercare(env.DB, date.email, 'email')
          await inregistreazaIncercare(env.DB, ip, 'ip')

          const utilizator = await utilizatorDupaEmail(env.DB, date.email)

          if (!utilizator) {
            // Consumam acelasi timp ca la un cont real, ca durata sa nu tradeze existenta.
            await consumaTimpDegeaba()
            await scrieAudit(env, log, {
              action: 'identity.login.step1',
              target: date.email,
              outcome: 'failure',
              correlationId: cid,
              summary: { motiv: 'email inexistent' },
            })
            return json({ challengeSent: true, debugLink: null })
          }

          const parolaOk = await verificaParola(date.password, utilizator.password_hash)

          if (!parolaOk || utilizator.disabled_at) {
            await scrieAudit(env, log, {
              action: 'identity.login.step1',
              target: utilizator.id,
              outcome: 'failure',
              correlationId: cid,
              summary: { motiv: utilizator.disabled_at ? 'cont dezactivat' : 'parola gresita' },
            })
            return json({ challengeSent: true, debugLink: null })
          }

          await invalideazaJetoaneleAnterioare(env.DB, 'login_challenges', utilizator.id)
          const jeton = await emiteJeton(
            env.DB,
            'login_challenges',
            utilizator.id,
            DURATA_CHALLENGE_SEC,
          )
          const link = `${cfg.ORIGINE_PUBLICA}/auth/confirma?jeton=${encodeURIComponent(jeton)}`

          const email = alegeAdaptorEmail(env)
          const trimitere = await email.trimite({
            catre: utilizator.email,
            subiect: 'Confirmă autentificarea',
            text: textConfirmareLogin(link),
            link,
            correlationId: cid,
          })

          await scrieAudit(env, log, {
            action: 'identity.login.step1',
            target: utilizator.id,
            outcome: 'success',
            correlationId: cid,
            actorId: utilizator.id,
            summary: { emailLivrat: trimitere.livrat, adaptor: email.nume },
          })

          log.info('challenge emis', { userId: utilizator.id, adaptor: email.nume })

          return json({
            challengeSent: true,
            debugLink: permiteLinkDebug(cfg) ? link : null,
          })
        }

        // -------------------------------------------------------------------
        // Pasul 2: linkul din email. Abia aici se naste sesiunea.
        case '/login/verifica': {
          const date = CerereVerificare.parse(await req.json())
          const rezultat = await consumaJeton(env.DB, 'login_challenges', date.token)

          if (!rezultat.ok) {
            await scrieAudit(env, log, {
              action: 'identity.login.step2',
              target: 'jeton',
              outcome: 'failure',
              correlationId: cid,
              summary: { motiv: rezultat.motiv },
            })
            return json({ ok: false, motiv: rezultat.motiv }, 400)
          }

          const utilizator = await utilizatorDupaId(env.DB, rezultat.userId)
          if (!utilizator || utilizator.disabled_at) {
            return json({ ok: false, motiv: 'cont indisponibil' }, 400)
          }

          // Confirmarea autentificarii dovedeste si controlul adresei de email.
          if (!utilizator.email_verified_at) {
            await marcheazaEmailVerificat(env.DB, utilizator.id)
          }

          const sesiune = await creeazaSesiune(
            env.DB,
            utilizator.id,
            DURATA_SESIUNE_SEC,
            date.ip,
            date.userAgent,
          )

          await resetIncercari(env.DB, utilizator.email, 'email')

          await scrieAudit(env, log, {
            action: 'identity.login.step2',
            target: utilizator.id,
            outcome: 'success',
            correlationId: cid,
            actorId: utilizator.id,
            summary: { ip: date.ip },
          })

          log.info('sesiune creata', { userId: utilizator.id })

          return json({
            ok: true,
            sessionToken: sesiune.jeton,
            expiresAt: sesiune.expiraLa,
            maxAge: DURATA_SESIUNE_SEC,
          })
        }

        // -------------------------------------------------------------------
        case '/sesiune': {
          const date = CerereJeton.parse(await req.json())
          const sesiune = await sesiuneDupaJeton(env.DB, date.token)
          if (!sesiune) return json(SESIUNE_ANONIMA)

          const utilizator = await utilizatorDupaId(env.DB, sesiune.user_id)
          if (!utilizator || utilizator.disabled_at) return json(SESIUNE_ANONIMA)

          const raspuns: SesiuneCurenta = {
            authenticated: true,
            user: catreUtilizator(utilizator),
            roles: await roluriUtilizator(env, utilizator.id),
            sessionId: sesiune.id,
            expiresAt: sesiune.expires_at,
          }
          return json(raspuns)
        }

        // -------------------------------------------------------------------
        case '/logout': {
          const date = CerereJeton.parse(await req.json())
          const sesiune = await sesiuneDupaJeton(env.DB, date.token)
          await revocaSesiune(env.DB, date.token)
          if (sesiune) {
            await scrieAudit(env, log, {
              action: 'identity.logout',
              target: sesiune.user_id,
              outcome: 'success',
              correlationId: cid,
              actorId: sesiune.user_id,
            })
          }
          return json({ ok: true })
        }

        // -------------------------------------------------------------------
        case '/revoca-toate': {
          const date = z.object({ userId: z.string().min(1) }).parse(await req.json())
          const cate = await revocaToateSesiunile(env.DB, date.userId)
          await scrieAudit(env, log, {
            action: 'identity.sessions.revoke_all',
            target: date.userId,
            outcome: 'success',
            correlationId: cid,
            summary: { sesiuniRevocate: cate },
          })
          return json({ ok: true, revocate: cate })
        }

        // -------------------------------------------------------------------
        case '/confirma-email': {
          const date = CerereJeton.parse(await req.json())
          const rezultat = await consumaJeton(env.DB, 'email_verification_tokens', date.token)
          if (!rezultat.ok) return json({ ok: false, motiv: rezultat.motiv }, 400)
          await marcheazaEmailVerificat(env.DB, rezultat.userId)
          await scrieAudit(env, log, {
            action: 'identity.email.verified',
            target: rezultat.userId,
            outcome: 'success',
            correlationId: cid,
            actorId: rezultat.userId,
          })
          return json({ ok: true })
        }

        // -------------------------------------------------------------------
        // Doar in dev: ultimele linkuri „trimise" catre o adresa, ca fluxul sa fie testabil
        // fara furnizor de email configurat.
        case '/emailuri-debug': {
          if (!permiteLinkDebug(cfg)) return json({ eroare: 'indisponibil' }, 404)
          const date = z.object({ email: z.string() }).parse(await req.json())
          return json({ emailuri: await emailuriDeDebug(env.DB, date.email.toLowerCase()) })
        }

        default:
          return json({ eroare: 'ruta necunoscuta' }, 404)
      }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return json({ eroare: 'date invalide', detalii: e.issues.map((i) => i.message) }, 400)
      }
      log.error('eroare neasteptata', { eroare: e instanceof Error ? e.message : String(e) })
      return json({ eroare: 'eroare interna' }, 500)
    }
  },
}
