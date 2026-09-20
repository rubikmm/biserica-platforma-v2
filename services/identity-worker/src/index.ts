import { z } from 'zod'
import {
  CerereConfirmareCod,
  CerereIntrare,
  DateUtilizator,
  Masca,
  StareAsociere,
  NIVEL_ROL,
  SCOPE_GLOBAL,
  SESIUNE_ANONIMA,
  NumeAfisat,
  nivelMasca,
  treaptaCeaMaiInalta,
  type AtribuireRol,
  type SesiuneCurenta,
  redacteaza,
} from '@xc/contracts'
import { citesteConfig, permiteSecretDebug } from '@xc/config'
import type { RezultatConsum } from './depozit.js'
import { toate } from '@xc/db'
import { Logger, correlationId } from '@xc/observability'
import { DURATA_COD_SEC, DURATA_SESIUNE_SEC } from './jetoane.js'
import {
  accepta,
  actualizeazaDate,
  actualizeazaNume,
  asocierileMele,
  catreUtilizator,
  cereAsociere,
  confirmaCodDeIntrare,
  creeazaSesiune,
  creeazaUtilizatorConfirmat,
  emailuriDeDebug,
  emiteCodDeIntrare,
  matura,
  membriiAplicatiei,
  puneEtichete,
  puneMasca,
  revocaSesiune,
  revocaToateSesiunile,
  scoateAsocierea,
  sesiuneDupaJeton,
  utilizatorDupaEmail,
  utilizatorDupaId,
  utilizatoriCuAsociere,
  type RandUtilizator,
} from './depozit.js'
import {
  EmailCloudflare,
  EmailSandbox,
  scrisoareaCodului,
  type AdaptorEmail,
} from './email.js'
import {
  LIMITA_LOGIN_EMAIL,
  LIMITA_LOGIN_IP,
  curataIncercariVechi,
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

/**
 * Ce se poate scrie fara sa strice nimic: doar campurile GOALE pe fisa de acum. Importul aduce
 * datele din vechile liste ale aplicatiilor, dar ce si-a scris omul singur pe contul lui e mai
 * proaspat si mai adevarat decat orice lista veche — deci nu se calca peste el.
 */
function doarGolurile(
  existent: RandUtilizator,
  venite: Omit<DateUtilizator, 'displayName'>,
): Omit<DateUtilizator, 'displayName'> {
  const gol = (v: string | null | undefined): boolean => v === null || v === undefined || v.trim() === ''
  const out: Omit<DateUtilizator, 'displayName'> = {}
  if (venite.firstName && gol(existent.first_name)) out.firstName = venite.firstName
  if (venite.lastName && gol(existent.last_name)) out.lastName = venite.lastName
  if (venite.phone && gol(existent.phone)) out.phone = venite.phone
  if (venite.shortName && gol(existent.short_name)) out.shortName = venite.shortName
  return out
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

const CerereConsum = CerereConfirmareCod.extend({
  ip: z.string().default('necunoscut'),
  userAgent: z.string().default(''),
})

const CerereJeton = z.object({ token: z.string().min(1) })

const CerereMasca = z.object({
  token: z.string().min(1),
  /** `null` = scoate masca si revino la tine. */
  masca: Masca.nullable(),
})

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
        // Intrarea (si nasterea contului, daca adresa nu are unul): trimite CODUL.
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
              action: 'identity.cod.requested',
              target: date.email,
              outcome: 'denied',
              correlationId: cid,
              summary: { motiv: 'limita de incercari atinsa' },
            })
            return json({ challengeSent: true, debugCod: null, limitat: true }, 429)
          }

          await inregistreazaIncercare(env.DB, date.email, 'email')
          await inregistreazaIncercare(env.DB, ip, 'ip')

          const existent = await utilizatorDupaEmail(env.DB, date.email)

          if (existent?.disabled_at) {
            // Cont inchis: nu trimitem nimic, dar nici nu spunem asta browserului.
            await scrieAudit(env, log, {
              action: 'identity.cod.requested',
              target: existent.id,
              outcome: 'failure',
              correlationId: cid,
              summary: { motiv: 'cont dezactivat' },
            })
            return json({ challengeSent: true, debugCod: null })
          }

          const cod = await emiteCodDeIntrare(
            env.DB,
            date.email,
            existent?.id ?? null,
            date.displayName ?? null,
            DURATA_COD_SEC,
          )
          const contNou = !existent
          const scrisoare = scrisoareaCodului(date.email, cod, contNou)

          const email = alegeAdaptorEmail(env, log)
          const trimitere = await email.trimite({
            catre: date.email,
            subiect: scrisoare.subiect,
            text: scrisoare.text,
            html: scrisoare.html,
            secret: cod,
            correlationId: cid,
          })

          await scrieAudit(env, log, {
            action: 'identity.cod.requested',
            target: existent?.id ?? date.email,
            outcome: trimitere.livrat || email.nume === 'sandbox' ? 'success' : 'failure',
            correlationId: cid,
            ...(existent ? { actorId: existent.id } : {}),
            summary: { contNou, adaptor: email.nume, livrat: trimitere.livrat, detaliu: trimitere.detaliu },
          })

          log.info('cod de intrare emis', { contNou, adaptor: email.nume, livrat: trimitere.livrat })

          return json({
            challengeSent: true,
            debugCod: permiteSecretDebug(cfg) ? cod : null,
          })
        }

        // -------------------------------------------------------------------
        // Codul scris: aici se naste sesiunea (si contul, la prima confirmare).
        case '/confirma-cod': {
          const date = CerereConsum.parse(await req.json())
          // ⚠️ TEMPORAR, DOAR IN DEV — codul de casa (user, 11.09.2026: „sa faci 123456 valabil
          // mereu pentru contul meu"). Merge numai pe adresa super-adminului si numai cat timp
          // `permiteSecretDebug` e adevarat, adica `MEDIU === 'dev'`; pe staging si in productie
          // blocul e inert, ca si cutia care arata codul in pagina. DE STERS cand nu mai trebuie.
          const codDeCasa =
            permiteSecretDebug(cfg) &&
            date.cod === '123456' &&
            cfg.EMAIL_SUPERADMIN !== '' &&
            date.email === cfg.EMAIL_SUPERADMIN.trim().toLowerCase()
          const rezultat: RezultatConsum = codDeCasa
            ? { ok: true, email: date.email, userId: null, displayName: null }
            : await confirmaCodDeIntrare(env.DB, date.email, date.cod)

          if (!rezultat.ok) {
            await inregistreazaIncercare(env.DB, date.email, 'email')
            await scrieAudit(env, log, {
              action: 'identity.cod.confirmed',
              target: date.email,
              outcome: 'failure',
              correlationId: cid,
              summary: { motiv: rezultat.motiv },
            })
            return json({ ok: false, motiv: rezultat.motiv, ramase: rezultat.ramase ?? null }, 400)
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
            action: 'identity.cod.confirmed',
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
        // Cine e pe sesiune — cu rolurile EFECTIVE. Daca sesiunea poarta o masca „vezi ca",
        // aplicatia primeste masca in loc de rolurile adevarate si nu trebuie sa stie nimic
        // despre mascarada ca sa se poarte corect.
        case '/sesiune': {
          const date = CerereJeton.parse(await req.json())
          const sesiune = await sesiuneDupaJeton(env.DB, date.token)
          if (!sesiune) return json(SESIUNE_ANONIMA)

          const utilizator = await utilizatorDupaId(env.DB, sesiune.user_id)
          if (!utilizator || utilizator.disabled_at) return json(SESIUNE_ANONIMA)

          // ⚠️ O masca pe care schema n-o mai cunoaste se poarta ca „fara masca". Asa ies singure din
          // joc mastile vechi `admin` ramase pe sesiuni deschise inainte de 19.09.2026: omul se vede
          // iar cu ochii lui, nu cu ai unei trepte care nu mai exista.
          const masca = Masca.safeParse(sesiune.vezi_ca)
          const veziCa = masca.success ? masca.data : null
          let roluriReale = await roluriUtilizator(env, utilizator.id)
          // ⚠️ SUPER-ADMINUL E PERMANENT (user, 14.09.2026: „pe mine chiar dacă mă scoate cineva
          // — mă pot adăuga singur"). Garantia sta pe ADRESA din `EMAIL_SUPERADMIN`, nu pe un rand
          // din baza: daca rolul lipseste sau a fost revocat, se pune la loc aici, la prima
          // citire de sesiune. Pana acum rolul se dadea o SINGURA data, la nasterea contului —
          // deci o revocare l-ar fi inchis afara pentru totdeauna.
          if (
            cfg.EMAIL_SUPERADMIN !== '' &&
            utilizator.email === cfg.EMAIL_SUPERADMIN.trim().toLowerCase() &&
            !roluriReale.some((r) => r.role === 'super-admin' && r.scope === SCOPE_GLOBAL)
          ) {
            await atribuieRol(env, utilizator.id, 'super-admin', cid)
            await scrieAudit(env, log, {
              action: 'identity.superadmin.restored',
              target: utilizator.id,
              outcome: 'success',
              correlationId: cid,
              summary: { motiv: 'rolul lipsea pe adresa permanenta' },
            })
            log.warn('rolul de super-admin lipsea pe adresa permanenta; l-am pus la loc')
            roluriReale = await roluriUtilizator(env, utilizator.id)
          }
          // Grupul „Vezi ca" din meniu: pentru super-admin, si — ca sa existe drum de
          // intoarcere — pentru oricine poarta deja o masca.
          const poateVedeaCa =
            veziCa !== null || treaptaCeaMaiInalta(roluriReale) >= NIVEL_ROL['super-admin']

          // Masca „neautentificat": de aici incolo platforma se poarta ca si cum n-ar
          // cunoaste pe nimeni. Singurul semn ramas e banda de jos, care il si scoate.
          if (veziCa === 'anonim') {
            return json({ ...SESIUNE_ANONIMA, veziCa, poateVedeaCa })
          }

          /*
           * ⚠️ SUB MASCA, ROLUL EFECTIV E `user` — si atat (19.09.2026). Masca nu mai imprumuta un rol
           * (`admin` global nu mai exista), ci o PRIVIRE: `admin:<cod>` inseamna „utilizator care tine
           * cheile aplicatiei <cod>", iar cheile le da autorizarea, din `veziCa`. Daca am pune aici un
           * rol inventat `admin:calendar`, orice ecran care se uita la `roles` ar crede intr-o treapta
           * care nu exista nicaieri altundeva.
           */
          const raspuns: SesiuneCurenta = {
            authenticated: true,
            user: catreUtilizator(utilizator),
            roles: veziCa ? [{ role: 'user', scope: SCOPE_GLOBAL }] : roluriReale,
            sessionId: sesiune.id,
            expiresAt: sesiune.expires_at,
            veziCa,
            poateVedeaCa,
          }
          return json(raspuns)
        }

        // -------------------------------------------------------------------
        // „Vezi ca": pune sau scoate masca de pe sesiune. Rolul se citeste ADEVARAT, din
        // atribuiri — altfel un super-admin coborat la `user` n-ar mai putea nici sa revina,
        // nici sa se mascheze mai jos. Masca merge doar SUB treapta ta, niciodata peste.
        case '/vezi-ca': {
          const date = CerereMasca.parse(await req.json())
          const sesiune = await sesiuneDupaJeton(env.DB, date.token)
          if (!sesiune) return json({ ok: false, motiv: 'fara sesiune' }, 401)

          const treapta = treaptaCeaMaiInalta(await roluriUtilizator(env, sesiune.user_id))
          const refuz =
            treapta < NIVEL_ROL['super-admin']
              ? 'numai super administratorii'
              : date.masca && nivelMasca(date.masca) >= treapta
                ? 'masca trebuie sa fie sub treapta ta'
                : null

          if (refuz) {
            await scrieAudit(env, log, {
              action: 'identity.vezi_ca.denied',
              target: date.masca ?? 'real',
              outcome: 'denied',
              correlationId: cid,
              actorId: sesiune.user_id,
              summary: { motiv: refuz },
            })
            return json({ ok: false, motiv: refuz }, 403)
          }

          const pusa = await puneMasca(env.DB, date.token, date.masca)
          if (!pusa) return json({ ok: false, motiv: 'fara sesiune' }, 401)

          await scrieAudit(env, log, {
            action: date.masca ? 'identity.vezi_ca.set' : 'identity.vezi_ca.cleared',
            target: date.masca ?? 'real',
            outcome: 'success',
            correlationId: cid,
            actorId: sesiune.user_id,
          })
          log.info('masca schimbata', { masca: date.masca })
          return json({ ok: true, masca: date.masca })
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
            .object({
              email: CerereIntrare.shape.email,
              displayName: NumeAfisat.optional(),
              sursa: z.string().min(1).default('import'),
            })
            .and(DateUtilizator.omit({ displayName: true }))
            .parse(await req.json())
          // Restul fisei (prenume, nume, telefon, nume scurt) se scrie doar peste locurile GOALE:
          // importul nu are voie sa strice ce si-a scris omul singur pe contul lui.
          const restul = { firstName: date.firstName, lastName: date.lastName, phone: date.phone, shortName: date.shortName }
          const existent = await utilizatorDupaEmail(env.DB, date.email)
          if (existent) {
            if (date.displayName && !existent.display_name) await actualizeazaNume(env.DB, existent.id, date.displayName)
            await actualizeazaDate(env.DB, existent.id, doarGolurile(existent, restul))
            return json({ userId: existent.id, creat: false })
          }
          const creare = await creeazaUtilizatorConfirmat(env.DB, date.email, date.displayName ?? null)
          await actualizeazaDate(env.DB, creare.utilizator.id, restul)
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
          const randuri = await toate<{
            id: string
            email: string
            display_name: string | null
            first_name: string | null
            last_name: string | null
            phone: string | null
            short_name: string | null
            disabled_at: string | null
          }>(
            env.DB,
            `SELECT id, email, display_name, first_name, last_name, phone, short_name, disabled_at
               FROM users WHERE id IN (${semne})`,
            date.ids,
          )
          return json({
            utilizatori: randuri.map((r) => ({
              id: r.id,
              email: r.email,
              displayName: r.display_name,
              firstName: r.first_name,
              lastName: r.last_name,
              phone: r.phone,
              shortName: r.short_name,
              disabledAt: r.disabled_at,
            })),
          })
        }

        // -------------------------------------------------------------------
        // Fisa omului: prenume, nume, telefon, nume scurt. Se cheama si de pe pagina contului
        // (omul isi scrie datele), si din panoul unei aplicatii (adminul indreapta un telefon).
        case '/utilizatori/date': {
          const date = z
            .object({ userId: z.string().min(1) })
            .and(DateUtilizator)
            .parse(await req.json())
          const { userId, ...campuri } = date
          await actualizeazaDate(env.DB, userId, campuri)
          return json({ ok: true })
        }

        // -------------------------------------------------------------------
        // Toti oamenii platformei, cu starea asocierii lor cu aplicatia ceruta. De aici isi ia
        // panoul unei aplicatii „lista celor neasociati" (randurile cu `stare: null`).
        // Fara `aplicatie` (sau cu una goala) e pur si simplu lista oamenilor platformei, cu
        // `stare: null` peste tot — asa o cere ecranul de numiri din Administrare.
        case '/utilizatori/lista': {
          const date = z.object({ aplicatie: z.string().default('') }).parse(await req.json())
          return json({ utilizatori: await utilizatoriCuAsociere(env.DB, date.aplicatie) })
        }

        // -------------------------------------------------------------------
        // Asocierile: apartenenta omului la o aplicatie a platformei (14.09.2026).
        // ⚠️ Cine are voie sa accepte pe cineva se hotaraste SUS, in aplicatie (un admin al ei);
        // aici doar se scrie ce s-a hotarat, ca la orice legatura de serviciu.
        case '/asocieri/ale-mele': {
          const date = z.object({ userId: z.string().min(1) }).parse(await req.json())
          return json({ asocieri: await asocierileMele(env.DB, date.userId) })
        }

        case '/asocieri/membri': {
          const date = z
            .object({ aplicatie: z.string().min(1), stare: StareAsociere.optional() })
            .parse(await req.json())
          return json({ membri: await membriiAplicatiei(env.DB, date.aplicatie, date.stare) })
        }

        case '/asocieri/cere': {
          const date = z
            .object({ userId: z.string().min(1), aplicatie: z.string().min(1), cerutDe: z.string().min(1) })
            .parse(await req.json())
          const stare = await cereAsociere(env.DB, date.userId, date.aplicatie, date.cerutDe)
          await scrieAudit(env, log, {
            action: 'identity.association.request',
            target: date.userId,
            outcome: 'success',
            correlationId: cid,
            actorId: date.cerutDe,
            summary: { aplicatie: date.aplicatie, stare },
          })
          return json({ ok: true, stare })
        }

        case '/asocieri/accepta': {
          const date = z
            .object({
              userId: z.string().min(1),
              aplicatie: z.string().min(1),
              acceptatDe: z.string().min(1),
              etichete: z.array(z.string()).default([]),
            })
            .parse(await req.json())
          await accepta(env.DB, date.userId, date.aplicatie, date.acceptatDe, date.etichete)
          await scrieAudit(env, log, {
            action: 'identity.association.accept',
            target: date.userId,
            outcome: 'success',
            correlationId: cid,
            actorId: date.acceptatDe,
            summary: { aplicatie: date.aplicatie, etichete: date.etichete },
          })
          return json({ ok: true })
        }

        case '/asocieri/scoate': {
          const date = z
            .object({ userId: z.string().min(1), aplicatie: z.string().min(1), deCatre: z.string().min(1) })
            .parse(await req.json())
          await scoateAsocierea(env.DB, date.userId, date.aplicatie)
          await scrieAudit(env, log, {
            action: 'identity.association.remove',
            target: date.userId,
            outcome: 'success',
            correlationId: cid,
            actorId: date.deCatre,
            summary: { aplicatie: date.aplicatie },
          })
          return json({ ok: true })
        }

        case '/asocieri/etichete': {
          const date = z
            .object({
              userId: z.string().min(1),
              aplicatie: z.string().min(1),
              etichete: z.array(z.string()),
            })
            .parse(await req.json())
          await puneEtichete(env.DB, date.userId, date.aplicatie, date.etichete)
          return json({ ok: true })
        }

        // -------------------------------------------------------------------
        // Doar in dev: ultimele coduri „trimise" catre o adresa.
        case '/emailuri-debug': {
          if (!permiteSecretDebug(cfg)) return json({ eroare: 'indisponibil' }, 404)
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

  /**
   * Ceasul de noapte, la 3 dimineata: scoate sesiunile si codurile trecute.
   *
   * Readus pe 15.09.2026 — V1 il avea (`biserica-cont`, acelasi ceas), iar la trecerea pe V2 s-a
   * pierdut, asa ca vreme de o saptamana nimic n-a maturat. Nu e o poarta si nu tine nimic in
   * picioare: ce a expirat e refuzat oricum la citire. De aceea o greseala aici nu se vede in
   * pagini — se vede doar in mărimea tabelelor, si de aceea socoteala se scrie in log.
   */
  async scheduled(_c: ScheduledController, env: Env): Promise<void> {
    const log = new Logger({ service: SERVICIU, correlationId: 'ceas' })
    try {
      const socoteala = await matura(env.DB)
      await curataIncercariVechi(env.DB)
      log.info('maturare', { ...socoteala })
    } catch (e) {
      log.error('maturarea a cazut', { eroare: e instanceof Error ? e.message : String(e) })
    }
  },
}
