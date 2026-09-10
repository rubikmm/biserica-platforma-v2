import { z } from 'zod'
import {
  CerereIntrare,
  SESIUNE_ANONIMA,
  NumeAfisat,
  type AtribuireRol,
  type SesiuneCurenta,
  redacteaza,
} from '@xc/contracts'
import { citesteConfig, permiteLinkDebug } from '@xc/config'
import { toate } from '@xc/db'
import { Logger, correlationId } from '@xc/observability'
import { DURATA_LINK_SEC, DURATA_SESIUNE_SEC } from './jetoane.js'
import {
  actualizeazaNume,
  catreUtilizator,
  consumaLinkDeIntrare,
  creeazaSesiune,
  creeazaUtilizatorConfirmat,
  emailuriDeDebug,
  emiteLinkDeIntrare,
  revocaSesiune,
  revocaToateSesiunile,
  sesiuneDupaJeton,
  utilizatorDupaEmail,
  utilizatorDupaId,
} from './depozit.js'
import {
  EmailCloudflare,
  EmailSandbox,
  scrisoareaDeIntrare,
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
  /** Binding-ul `send_email` — lipseste in dev, unde scrisorile nu pleaca. */
  POSTA?: SendEmail
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  ADAPTOR_EMAIL?: string
  POSTA_DE_LA?: string
  POSTA_NUME?: string
}

const SERVICIU = 'identity-worker'

function json(date: unknown, status = 200): Response {
  return new Response(JSON.stringify(date), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/**
 * Drumul scrisorii. `cloudflare` cere binding-ul `POSTA`; fara el (dev) cadem pe sandbox
 * si spunem asta in log — nu tacut, ca sa nu se creada ca a plecat ceva.
 */
function alegeAdaptorEmail(env: Env, log: Logger): AdaptorEmail {
  if (env.ADAPTOR_EMAIL === 'cloudflare') {
    if (env.POSTA && typeof env.POSTA.send === 'function') {
      return new EmailCloudflare(
        env.DB,
        env.POSTA,
        env.POSTA_DE_LA ?? 'no-reply@posta.sfantul-ilie.ro',
        env.POSTA_NUME ?? 'Biserica Sfântul Ilie – Hanul Colței',
      )
    }
    log.warn('ADAPTOR_EMAIL=cloudflare, dar binding-ul POSTA lipseste; folosesc sandbox')
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
    // Auditul indisponibil nu trebuie sa blocheze intrarea, dar se vede in log.
    log.error('audit indisponibil', { eroare: e instanceof Error ? e.message : String(e) })
  }
}

async function atribuieRol(env: Env, userId: string, role: string, cid: string): Promise<void> {
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

const CerereConsum = z.object({
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
        // Intrarea (si nasterea contului, daca adresa nu are unul): trimite linkul.
        // Raspunsul e identic indiferent daca adresa are cont sau nu.
        case '/intrare': {
          const brut = (await req.json()) as Record<string, unknown>
          const date = CerereIntrare.parse(brut)
          const ip = typeof brut.ip === 'string' ? brut.ip : 'necunoscut'

          if (
            (await eBlocat(env.DB, date.email, 'email', LIMITA_LOGIN_EMAIL)) ||
            (await eBlocat(env.DB, ip, 'ip', LIMITA_LOGIN_IP))
          ) {
            await scrieAudit(env, log, {
              action: 'identity.link.requested',
              target: date.email,
              outcome: 'denied',
              correlationId: cid,
              summary: { motiv: 'limita de incercari atinsa' },
            })
            return json({ challengeSent: true, debugLink: null, limitat: true }, 429)
          }

          await inregistreazaIncercare(env.DB, date.email, 'email')
          await inregistreazaIncercare(env.DB, ip, 'ip')

          const existent = await utilizatorDupaEmail(env.DB, date.email)

          if (existent?.disabled_at) {
            // Cont inchis: nu trimitem nimic, dar nici nu spunem asta browserului.
            await scrieAudit(env, log, {
              action: 'identity.link.requested',
              target: existent.id,
              outcome: 'failure',
              correlationId: cid,
              summary: { motiv: 'cont dezactivat' },
            })
            return json({ challengeSent: true, debugLink: null })
          }

          const jeton = await emiteLinkDeIntrare(
            env.DB,
            date.email,
            existent?.id ?? null,
            date.displayName ?? null,
            DURATA_LINK_SEC,
          )
          const link = `${cfg.ORIGINE_PUBLICA}/auth/confirma?jeton=${encodeURIComponent(jeton)}`
          const contNou = !existent
          const scrisoare = scrisoareaDeIntrare(link, contNou)

          const email = alegeAdaptorEmail(env, log)
          const trimitere = await email.trimite({
            catre: date.email,
            subiect: contNou ? 'Deschide-ți contul' : 'Intră în platforma parohiei',
            text: scrisoare.text,
            html: scrisoare.html,
            link,
            correlationId: cid,
          })

          await scrieAudit(env, log, {
            action: 'identity.link.requested',
            target: existent?.id ?? date.email,
            outcome: trimitere.livrat || email.nume === 'sandbox' ? 'success' : 'failure',
            correlationId: cid,
            ...(existent ? { actorId: existent.id } : {}),
            summary: { contNou, adaptor: email.nume, livrat: trimitere.livrat, detaliu: trimitere.detaliu },
          })

          log.info('link de intrare emis', { contNou, adaptor: email.nume, livrat: trimitere.livrat })

          return json({
            challengeSent: true,
            debugLink: permiteLinkDebug(cfg) ? link : null,
          })
        }

        // -------------------------------------------------------------------
        // Linkul deschis: aici se naste sesiunea (si contul, la prima confirmare).
        case '/confirma': {
          const date = CerereConsum.parse(await req.json())
          const rezultat = await consumaLinkDeIntrare(env.DB, date.token)

          if (!rezultat.ok) {
            await scrieAudit(env, log, {
              action: 'identity.link.confirmed',
              target: 'jeton',
              outcome: 'failure',
              correlationId: cid,
              summary: { motiv: rezultat.motiv },
            })
            return json({ ok: false, motiv: rezultat.motiv }, 400)
          }

          let utilizator = rezultat.userId ? await utilizatorDupaId(env.DB, rezultat.userId) : null
          let contNou = false

          if (!utilizator) {
            const creare = await creeazaUtilizatorConfirmat(
              env.DB,
              rezultat.email,
              rezultat.displayName,
            )
            utilizator = creare.utilizator
            contNou = creare.fel === 'creat'

            if (contNou) {
              const eSuperadmin =
                cfg.EMAIL_SUPERADMIN !== '' &&
                utilizator.email === cfg.EMAIL_SUPERADMIN.trim().toLowerCase()
              await atribuieRol(env, utilizator.id, eSuperadmin ? 'super-admin' : 'user', cid)

              await scrieAudit(env, log, {
                action: 'identity.register',
                target: utilizator.id,
                outcome: 'success',
                correlationId: cid,
                actorId: utilizator.id,
                summary: { superadmin: eSuperadmin },
              })
              log.info('cont creat la prima confirmare', { superadmin: eSuperadmin })
            }
          } else if (rezultat.displayName && !utilizator.display_name) {
            // Omul a completat un nume la un cont care nu avea: il pastram.
            await actualizeazaNume(env.DB, utilizator.id, rezultat.displayName)
          }

          if (utilizator.disabled_at) {
            return json({ ok: false, motiv: 'cont indisponibil' }, 400)
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
            action: 'identity.link.confirmed',
            target: utilizator.id,
            outcome: 'success',
            correlationId: cid,
            actorId: utilizator.id,
            summary: { ip: date.ip, contNou },
          })

          log.info('sesiune creata', { userId: utilizator.id, contNou })

          return json({
            ok: true,
            contNou,
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
        case '/nume': {
          const date = z
            .object({ userId: z.string().min(1), displayName: NumeAfisat })
            .parse(await req.json())
          await actualizeazaNume(env.DB, date.userId, date.displayName)
          return json({ ok: true })
        }

        // -------------------------------------------------------------------
        // Contul unei adrese, pentru o alta aplicatie a platformei (legatura de serviciu,
        // niciodata din browser). Daca adresa n-are cont, i se face unul — e drumul prin care
        // listele de persoane din V1 (ex. voluntarii de la curatenie) isi gasesc locul UNIC,
        // aici, nu in bazele aplicatiilor. Omul intra apoi ca oricine: email -> link.
        case '/utilizatori/asigura': {
          const date = z
            .object({ email: CerereIntrare.shape.email, displayName: NumeAfisat.optional(), sursa: z.string().min(1).default('import') })
            .parse(await req.json())
          const existent = await utilizatorDupaEmail(env.DB, date.email)
          if (existent) {
            if (date.displayName && !existent.display_name) await actualizeazaNume(env.DB, existent.id, date.displayName)
            return json({ userId: existent.id, creat: false })
          }
          const creare = await creeazaUtilizatorConfirmat(env.DB, date.email, date.displayName ?? null)
          if (creare.fel === 'creat') {
            await atribuieRol(env, creare.utilizator.id, 'user', cid)
            await scrieAudit(env, log, {
              action: 'identity.import',
              target: creare.utilizator.id,
              outcome: 'success',
              correlationId: cid,
              summary: { sursa: date.sursa },
            })
          }
          return json({ userId: creare.utilizator.id, creat: creare.fel === 'creat' })
        }

        // -------------------------------------------------------------------
        // Cine sunt acesti utilizatori: id, email, nume afisat. Pentru aplicatiile care tin doar
        // `user_id` si au nevoie de nume la afisare sau de adresa la trimitere.
        case '/utilizatori/dupa-id': {
          const date = z.object({ ids: z.array(z.string().min(1)).max(500) }).parse(await req.json())
          if (!date.ids.length) return json({ utilizatori: [] })
          const semne = date.ids.map(() => '?').join(', ')
          const randuri = await toate<{ id: string; email: string; display_name: string | null; disabled_at: string | null }>(
            env.DB,
            `SELECT id, email, display_name, disabled_at FROM users WHERE id IN (${semne})`,
            date.ids,
          )
          return json({
            utilizatori: randuri.map((r) => ({ id: r.id, email: r.email, displayName: r.display_name, disabledAt: r.disabled_at })),
          })
        }

        // -------------------------------------------------------------------
        // Doar in dev: ultimele linkuri „trimise" catre o adresa.
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
