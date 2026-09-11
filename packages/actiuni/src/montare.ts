import { z } from 'zod'
import { SCOPE_GLOBAL, type Scope } from '@xc/contracts'
import { ClientAutorizare } from '@xc/authorization'
import { egaleInTimpConstant } from '@xc/auth'
import { Logger } from '@xc/observability'
import {
  ANTET_ACTOR,
  ANTET_PREVIZUALIZARE,
  ANTET_PRIN,
  ANTET_SECRET,
  CALE_ACTIUNI,
  type Actiune,
  type Actor,
  type CodEroare,
  type Previzualizare,
  type Registru,
} from './contract.js'
import { manifest, type Manifest } from './manifest.js'

/**
 * MONTAREA — cele doua rute pe care le capata o aplicatie care isi publica actiunile:
 *
 *   GET  /_actiuni          manifestul
 *   POST /_actiuni/<nume>   executia
 *
 * ⚠️ NU SE SERVESC DE PE INTERNET. Calea incepe cu `_` (intern, prin conventie) si, mai important,
 * se cere antetul cu secretul platformei. Fara el raspunsul e 404, nu 403: pentru cine vine de
 * afara, calea pur si simplu nu exista — nu confirmam ca ar fi ceva de ghicit acolo.
 */

export interface EnvActiuni {
  /** Secretul dintre workerii nostri. Fara el modulul e inchis cu totul. */
  SECRET_INTERN?: string
  AUTORIZARE?: Fetcher
  AUDIT?: Fetcher
  MEDIU?: string
}

/** Forma unei nepotriviri de schema. Actiunile sunt tinute in registru ca `Actiune<any, any>`,
 *  deci `safeParse` intoarce probleme netipizate — le numim aici, o data. */
interface Problema {
  path: PropertyKey[]
  message: string
}

const ActorPrimit = z.union([
  z.object({
    fel: z.literal('utilizator'),
    principal: z.object({
      userId: z.string().min(1),
      email: z.string().optional(),
      veziCa: z.string().optional(),
    }),
  }),
  z.object({ fel: z.literal('serviciu'), nume: z.string().min(1) }),
])

function json(date: unknown, status = 200): Response {
  return new Response(JSON.stringify(date), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function gresit(cod: CodEroare, mesaj: string, status: number): Response {
  return json({ ok: false, cod, mesaj }, status)
}

/** De pe internet calea nu exista. */
function inexistent(): Response {
  return new Response('Not Found', { status: 404 })
}

function numeleActorului(a: Actor): string {
  return a.fel === 'utilizator' ? a.principal.userId : `serviciu:${a.nume}`
}

async function scrieAudit(
  env: EnvActiuni,
  i: {
    actiune: string
    actor: Actor
    rezultat: 'success' | 'failure' | 'denied'
    prin: string
    correlationId: string
    detalii?: Record<string, unknown>
  },
): Promise<void> {
  if (!env.AUDIT) return
  try {
    await env.AUDIT.fetch('https://audit.intern/scrie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: `actiune.${i.actiune}`,
        target: i.actiune,
        scope: SCOPE_GLOBAL,
        actor:
          i.actor.fel === 'utilizator'
            ? { type: 'user', id: i.actor.principal.userId }
            : { type: 'system', id: i.actor.nume },
        outcome: i.rezultat,
        correlationId: i.correlationId,
        summary: { prin: i.prin, ...(i.detalii ?? {}) },
      }),
    })
  } catch {
    // Auditul care cade nu rastoarna actiunea; pierderea se vede in logul serviciului.
  }
}

export interface ModulActiuni<E> {
  manifest(): Manifest
  /**
   * `cale` vine deja fara prefixul gateway-ului (aplicatia are `prefixSiCale`). Intoarce `null`
   * cand calea nu e a lui — aplicatia isi vede mai departe de rutare.
   */
  ruteaza(req: Request, env: E, ctxExec: ExecutionContext, cale: string): Promise<Response | null>
  /** Executie directa, din acelasi worker (fara HTTP). Folosita de chat cand actiunea e locala. */
  executa(
    nume: string,
    argumente: unknown,
    env: E,
    ctxExec: ExecutionContext,
    o: { actor: Actor; correlationId: string; prin: string },
  ): Promise<{ ok: true; date: unknown } | { ok: false; cod: CodEroare; mesaj: string }>
}

export function modulActiuni<E extends EnvActiuni>(cfg: {
  aplicatie: string
  versiune: string
  actiuni: Registru<E>
}): ModulActiuni<E> {
  const dupaNume = new Map<string, Actiune<any, any, E>>(cfg.actiuni.map((a) => [a.nume, a]))

  async function ruleaza(
    a: Actiune<any, any, E>,
    argumenteBrute: unknown,
    env: E,
    ctxExec: ExecutionContext,
    o: { actor: Actor; correlationId: string; prin: string; previzualizare?: boolean },
  ): Promise<{ ok: true; date: unknown } | { ok: false; cod: CodEroare; mesaj: string }> {
    const log = new Logger({ service: `actiuni-${cfg.aplicatie}`, correlationId: o.correlationId })

    const parsat = a.intrare.safeParse(argumenteBrute ?? {})
    if (!parsat.success) {
      const unde = (parsat.error.issues as Problema[])
        .map((i) => `${i.path.join('.') || 'argument'}: ${i.message}`)
        .join('; ')
      return { ok: false, cod: 'argumente_invalide', mesaj: unde }
    }
    const argumente = parsat.data

    if (a.permisiune) {
      if (o.actor.fel === 'serviciu' && !a.permiteServicii) {
        return {
          ok: false,
          cod: 'nepermis_serviciilor',
          mesaj: 'acțiunea cere un drept al unei persoane, nu poate fi cerută de un serviciu',
        }
      }
      if (o.actor.fel === 'utilizator') {
        if (!env.AUTORIZARE) {
          return { ok: false, cod: 'indisponibil', mesaj: 'serviciul de politici lipsește' }
        }
        const scope: Scope =
          typeof a.scope === 'function' ? a.scope(argumente) : (a.scope ?? SCOPE_GLOBAL)
        const decizie = await new ClientAutorizare(env.AUTORIZARE, o.correlationId).can(
          o.actor.principal,
          a.permisiune,
          scope,
        )
        if (!decizie.allowed) {
          ctxExec.waitUntil(
            scrieAudit(env, {
              actiune: a.nume,
              actor: o.actor,
              rezultat: 'denied',
              prin: o.prin,
              correlationId: o.correlationId,
              detalii: { motiv: decizie.reason },
            }),
          )
          return { ok: false, cod: 'fara_drept', mesaj: decizie.reason }
        }
      }
    }

    const ctx = { env, actor: o.actor, correlationId: o.correlationId, ctxExec, prin: o.prin }

    // Previzualizarea: argumentele sunt bune si dreptul e verificat — se spune ce AR urma, atat.
    // O cerere fara sens („nu gasesc slujba") cade aici, cu motivul ei, si nu se propune nimic.
    if (o.previzualizare) {
      try {
        const rezumat = a.rezuma ? await a.rezuma(argumente, ctx) : a.descriere.split('.')[0] ?? a.nume
        const p: Previzualizare = { previzualizare: true, rezumat }
        return { ok: true, date: p }
      } catch (e) {
        return { ok: false, cod: 'argumente_invalide', mesaj: e instanceof Error ? e.message : String(e) }
      }
    }

    try {
      const date = await a.executa(argumente, ctx)

      // Contractul se verifica si la iesire. In dev o nepotrivire opreste cererea (asa se prinde
      // devreme o schema ramasa in urma); in public trece cu avertisment — un raspuns bun nu se
      // arunca pentru o schema stramta.
      const iesit = a.iesire.safeParse(date)
      if (!iesit.success) {
        log.warn('iesire care nu se potriveste cu schema', {
          actiune: a.nume,
          probleme: (iesit.error.issues as Problema[]).slice(0, 3).map((i) => i.message),
        })
        if (env.MEDIU === 'dev') {
          return { ok: false, cod: 'eroare_interna', mesaj: 'ieșirea nu se potrivește cu schema' }
        }
      }

      if (a.efect === 'scrie') {
        ctxExec.waitUntil(
          scrieAudit(env, {
            actiune: a.nume,
            actor: o.actor,
            rezultat: 'success',
            prin: o.prin,
            correlationId: o.correlationId,
            detalii: { argumente },
          }),
        )
      }
      return { ok: true, date: iesit.success ? iesit.data : date }
    } catch (e) {
      const mesaj = e instanceof Error ? e.message : String(e)
      log.error('actiune cazuta', { actiune: a.nume, eroare: mesaj })
      if (a.efect === 'scrie') {
        ctxExec.waitUntil(
          scrieAudit(env, {
            actiune: a.nume,
            actor: o.actor,
            rezultat: 'failure',
            prin: o.prin,
            correlationId: o.correlationId,
            detalii: { eroare: mesaj },
          }),
        )
      }
      // Motivul se da mai departe: mesajele sunt ale noastre, in romana, iar omul (si modelul)
      // trebuie sa afle DE CE n-a mers, nu doar ca n-a mers.
      return { ok: false, cod: 'eroare_interna', mesaj: mesaj || 'acțiunea nu a putut fi dusă la capăt' }
    }
  }

  return {
    manifest: () => manifest(cfg.aplicatie, cfg.versiune, cfg.actiuni),

    executa: (nume, argumente, env, ctxExec, o) => {
      const a = dupaNume.get(nume)
      if (!a) return Promise.resolve({ ok: false as const, cod: 'necunoscuta' as const, mesaj: `acțiune necunoscută: ${nume}` })
      return ruleaza(a, argumente, env, ctxExec, o)
    },

    async ruteaza(req, env, ctxExec, cale) {
      if (cale !== CALE_ACTIUNI && !cale.startsWith(`${CALE_ACTIUNI}/`)) return null

      // Garda. Un secret nescris in mediu inchide modulul cu totul — mai bine tacut inchis decat
      // tacut deschis.
      const secret = env.SECRET_INTERN
      const primit = req.headers.get(ANTET_SECRET)
      if (!secret || !primit || !egaleInTimpConstant(primit, secret)) return inexistent()

      const correlationId = req.headers.get('x-correlation-id') ?? crypto.randomUUID()
      const prin = req.headers.get(ANTET_PRIN) ?? 'necunoscut'

      if (cale === CALE_ACTIUNI) {
        if (req.method !== 'GET') return gresit('necunoscuta', 'aici se face doar GET', 405)
        return json(manifest(cfg.aplicatie, cfg.versiune, cfg.actiuni))
      }

      if (req.method !== 'POST') return gresit('necunoscuta', 'o acțiune se cere cu POST', 405)

      const nume = decodeURIComponent(cale.slice(`${CALE_ACTIUNI}/`.length))
      const a = dupaNume.get(nume)
      if (!a) return gresit('necunoscuta', `acțiune necunoscută: ${nume}`, 404)

      const actorBrut = req.headers.get(ANTET_ACTOR)
      const actorParsat = ActorPrimit.safeParse(actorBrut ? JSON.parse(actorBrut) : null)
      if (!actorParsat.success) {
        return gresit('fara_drept', 'lipsește cine cere acțiunea', 400)
      }

      let argumente: unknown = {}
      try {
        argumente = await req.json()
      } catch {
        argumente = {}
      }

      const r = await ruleaza(a, argumente, env, ctxExec, {
        actor: actorParsat.data as Actor,
        correlationId,
        prin,
        previzualizare: req.headers.get(ANTET_PREVIZUALIZARE) === '1',
      })
      if (r.ok) return json(r)
      const status =
        r.cod === 'necunoscuta' ? 404
        : r.cod === 'argumente_invalide' ? 400
        : r.cod === 'fara_drept' || r.cod === 'nepermis_serviciilor' ? 403
        : r.cod === 'indisponibil' ? 503
        : 500
      return json(r, status)
    },
  }
}

/** Numele actorului, pentru loguri si mesaje. */
export { numeleActorului }
