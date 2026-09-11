/**
 * CHAT-WORKER — creierul modulului de chat.
 *
 * Serviciu intern: nu are adresă publică și nu vorbește niciodată direct cu browserul. Aplicația
 * în care stă bula primește mesajul pe originea ei (deci cu sesiunea și CSRF-ul ei) și îl trece
 * mai departe prin Service Binding.
 *
 * Ce face: ține discuția (D1), adună listele de acțiuni ale aplicațiilor, întreabă modelul, execută
 * acțiunile de CITIRE și se oprește la cele care SCHIMBĂ ceva — acelea devin propuneri pe care
 * le confirmă omul.
 *
 * Ce NU face: nu ține cunoștințe despre parohie (le cere), nu ocolește drepturile (acțiunile trec
 * prin autorizarea centrală, cu principalul omului), nu trimite nimic pe email singur.
 */
import {
  ANTET_ACTOR,
  ANTET_SECRET,
  cereActiune,
  manifestulLui,
  numeUnealta,
  unelteDinManifest,
  type Actor,
  type Manifest,
  type UnealtaDescrisa,
} from '@xc/actiuni'
import { Obiect } from '@xc/contracts'
import { aziBucuresti, ZILE_SAPTAMANA, ziuaSaptamanii } from '@xc/ui'
import { egaleInTimpConstant } from '@xc/auth'
import { Logger, correlationId } from '@xc/observability'
import { intreabaModelul, instructiuni, type EnvCreier, type MesajModel } from './creier.js'
import {
  conversatia,
  inchidePropunerea,
  mesajeleDin,
  propunereaDe,
  scrieMesaj,
  scriePropunere,
  stergeConversatia,
} from './depozit.js'

export interface Env extends EnvCreier {
  DB: D1Database
  /** Aplicațiile ale căror acțiuni sunt de față. Se adaugă pe măsură ce se portează. */
  PROGRAM?: Fetcher
  CALENDAR?: Fetcher
  TIPIC?: Fetcher
  AUDIT?: Fetcher
  SECRET_INTERN?: string
  MEDIU: string
}

const SERVICIU = 'chat-worker'

/** Ziua de azi, la Bucuresti, scrisa si in cifre si in cuvinte — modelul are nevoie de amandoua. */
function ziuaDeAzi(): { data: string; zi: string } {
  return { data: aziBucuresti(), zi: ZILE_SAPTAMANA[ziuaSaptamanii(aziBucuresti())] ?? '' }
}
/** Câte ocoluri model → unealtă → model într-un singur mesaj. Peste asta, se oprește și spune. */
const PASI_MAXIM = 3
/** Cât din răspunsul unei acțiuni intră în context. Un an de program n-are ce căuta acolo. */
const TAIERE_REZULTAT = 2500

function json(date: unknown, status = 200): Response {
  return new Response(JSON.stringify(date), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function aplicatiileLegate(env: Env): Array<{ nume: string; fetcher: Fetcher }> {
  const toate: Array<[string, Fetcher | undefined]> = [
    ['program', env.PROGRAM],
    ['calendar', env.CALENDAR],
    ['tipic', env.TIPIC],
  ]
  return toate.filter((p): p is [string, Fetcher] => Boolean(p[1])).map(([nume, fetcher]) => ({ nume, fetcher }))
}

interface UndeStaActiunea {
  /** Numele canonic, cu punct: cu el se cere actiunea si cu el intra in audit. */
  nume: string
  aplicatie: string
  fetcher: Fetcher
  efect: 'citeste' | 'scrie'
  descriere: string
}

/**
 * Listele tuturor aplicațiilor, puse cap la cap. O aplicație care tace nu oprește chatul: se
 * lucrează cu ce răspunde (manifestele sunt ținute un minut în memoria izolatului).
 */
async function adunaUneltele(
  env: Env,
  o: { secret: string; correlationId: string },
): Promise<{ unelte: UnealtaDescrisa[]; harta: Map<string, UndeStaActiunea> }> {
  const harta = new Map<string, UndeStaActiunea>()
  const unelte: UnealtaDescrisa[] = []

  const manifeste = await Promise.all(
    aplicatiileLegate(env).map(async (a) => ({
      a,
      m: await manifestulLui(a.fetcher, a.nume, { secret: o.secret, correlationId: o.correlationId, prin: 'chat' }),
    })),
  )

  for (const { a, m } of manifeste) {
    if (!m) continue
    for (const descriere of (m as Manifest).actiuni) {
      harta.set(numeUnealta(descriere.nume), {
        nume: descriere.nume,
        aplicatie: a.nume,
        fetcher: a.fetcher,
        efect: descriere.efect,
        descriere: descriere.descriere,
      })
    }
    unelte.push(...unelteDinManifest(m as Manifest))
  }
  return { unelte, harta }
}

/** Ce se scrie modelului despre ce a întors o acțiune. Hârtia nu se descrie, se anunță. */
function rezumaRezultat(date: unknown): { text: string; obiect: Obiect | null } {
  const eObiect = Obiect.safeParse(date)
  if (eObiect.success) {
    const o = eObiect.data
    return {
      text: `Hârtia „${o.titlu}" e gata (${o.fel.toUpperCase()}, ${Math.round(o.octeti / 1024)} KB). Omul o vede ca pe un card sub răspuns.`,
      obiect: o,
    }
  }
  const text = JSON.stringify(date)
  return {
    text: text.length > TAIERE_REZULTAT ? `${text.slice(0, TAIERE_REZULTAT)}… (tăiat)` : text,
    obiect: null,
  }
}

interface RaspunsChat {
  conversatieId: string
  text: string
  obiecte: Obiect[]
  propunere: { id: string; rezumat: string } | null
}

async function poarta(req: Request, env: Env): Promise<{ actor: Actor; cid: string } | Response> {
  const secret = env.SECRET_INTERN
  const primit = req.headers.get(ANTET_SECRET)
  if (!secret || !primit || !egaleInTimpConstant(primit, secret)) {
    return new Response('Not Found', { status: 404 })
  }
  const brut = req.headers.get(ANTET_ACTOR)
  if (!brut) return json({ ok: false, mesaj: 'lipsește cine scrie' }, 400)
  try {
    const actor = JSON.parse(brut) as Actor
    if (actor.fel !== 'utilizator' || !actor.principal?.userId) {
      return json({ ok: false, mesaj: 'chatul e al unei persoane, nu al unui serviciu' }, 403)
    }
    return { actor, cid: req.headers.get('x-correlation-id') ?? crypto.randomUUID() }
  } catch {
    return json({ ok: false, mesaj: 'nu se înțelege cine scrie' }, 400)
  }
}

export default {
  async fetch(req: Request, env: Env, ctxExec: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    const cale = url.pathname

    if (cale === '/health') return json({ ok: true, serviciu: SERVICIU })

    const intrare = await poarta(req, env)
    if (intrare instanceof Response) return intrare
    const { actor, cid } = intrare
    const userId = actor.fel === 'utilizator' ? actor.principal.userId : ''
    const log = new Logger({ service: SERVICIU, correlationId: cid })
    const secret = env.SECRET_INTERN!

    try {
      // -------------------------------------------------------------- istoricul
      if (req.method === 'GET' && cale === '/discutie') {
        const id = url.searchParams.get('id')
        if (!id) return json({ mesaje: [] })
        const c = await conversatia(env.DB, userId, '', id)
        const mesaje = await mesajeleDin(env.DB, c.id)
        return json({
          conversatieId: c.id,
          mesaje: mesaje
            .filter((m) => m.rol !== 'unealta')
            .map((m) => ({ rol: m.rol, text: m.text, date: JSON.parse(m.date_json || '{}') })),
        })
      }

      if (req.method !== 'POST') return json({ ok: false, mesaj: 'doar POST' }, 405)

      // -------------------------------------------------------------- ștergerea
      if (cale === '/sterge') {
        const { conversatieId } = (await req.json()) as { conversatieId?: string }
        const sters = conversatieId ? await stergeConversatia(env.DB, conversatieId, userId) : false
        return json({ ok: sters })
      }

      // -------------------------------------------------------------- confirmarea
      if (cale === '/confirma') {
        const { propunereId, raspuns } = (await req.json()) as { propunereId?: string; raspuns?: string }
        if (!propunereId) return json({ ok: false, mesaj: 'care propunere?' }, 400)
        const gasita = await propunereaDe(env.DB, propunereId, userId)
        if (!gasita) return json({ ok: false, mesaj: 'propunerea nu există' }, 404)
        if (gasita.motiv === 'expirata') {
          return json({ ok: false, text: 'Propunerea a expirat. Cere-mi din nou, ca să lucrez pe date proaspete.' })
        }
        if (gasita.motiv === 'raspunsa') {
          return json({ ok: false, text: 'La propunerea asta s-a răspuns deja.' })
        }
        const p = gasita.p

        if (raspuns !== 'da') {
          await inchidePropunerea(env.DB, p.id, 'refuzata')
          await scrieMesaj(env.DB, { conversatie_id: p.conversatie_id, rol: 'agent', text: 'Am lăsat-o baltă.' })
          return json({ ok: true, text: 'Am lăsat-o baltă.' })
        }

        // Drepturile se verifică ACUM, din nou, la aplicație: între propunere și „Da" se poate
        // schimba rolul omului, iar noi n-am ținut minte nicio decizie de autorizare.
        const unde = aplicatiileLegate(env).find((a) => a.nume === p.aplicatie)
        if (!unde) return json({ ok: false, text: 'Aplicația nu mai e de față.' }, 503)
        const r = await cereActiune(unde.fetcher, p.actiune, JSON.parse(p.argumente_json), actor, {
          secret,
          correlationId: cid,
          prin: 'chat',
        })
        await inchidePropunerea(env.DB, p.id, r.ok ? 'facuta' : 'refuzata')
        const text = r.ok ? `Gata: ${p.rezumat}` : `N-am putut: ${r.mesaj}`
        await scrieMesaj(env.DB, { conversatie_id: p.conversatie_id, rol: 'agent', text })
        return json({ ok: r.ok, text })
      }

      // -------------------------------------------------------------- mesajul
      if (cale !== '/mesaj') return json({ ok: false, mesaj: 'rută necunoscută' }, 404)

      const cerere = (await req.json()) as {
        text?: string
        aplicatie?: string
        conversatieId?: string
        numeleOmului?: string | null
      }
      const textOm = (cerere.text ?? '').trim().slice(0, 2000)
      if (!textOm) return json({ ok: false, mesaj: 'mesaj gol' }, 400)

      const c = await conversatia(env.DB, userId, cerere.aplicatie ?? '', cerere.conversatieId)
      await scrieMesaj(env.DB, { conversatie_id: c.id, rol: 'om', text: textOm })

      const { unelte, harta } = await adunaUneltele(env, { secret, correlationId: cid })
      const istoric = await mesajeleDin(env.DB, c.id)

      const mesaje: MesajModel[] = [
        { rol: 'sistem', text: instructiuni(cerere.aplicatie ?? '', cerere.numeleOmului ?? null, ziuaDeAzi()) },
        ...istoric.map((m) => ({
          rol: m.rol === 'om' ? ('om' as const) : m.rol === 'agent' ? ('agent' as const) : ('unealta' as const),
          text: m.text,
        })),
      ]

      const obiecte: Obiect[] = []
      let propunere: RaspunsChat['propunere'] = null
      let textFinal = ''

      for (let pas = 0; pas < PASI_MAXIM; pas++) {
        const r = await intreabaModelul(env, mesaje, unelte)
        textFinal = r.text || textFinal

        if (!r.cereri.length) break

        for (const cerut of r.cereri) {
          // Numele traduse (cu `__`) sunt cele trimise modelului, dar unele modele raspund
          // totusi cu numele canonic — se cauta si asa, ca sa nu cada cererea degeaba.
          const unde = harta.get(cerut.nume) ?? harta.get(numeUnealta(cerut.nume))
          if (!unde) {
            mesaje.push({ rol: 'unealta', text: `Nu există unealta ${cerut.nume}.`, numeUnealta: cerut.nume })
            continue
          }

          // ⚠️ AICI se oprește totul pentru acțiunile care schimbă date: se propune, nu se face.
          if (unde.efect === 'scrie') {
            const p = await scriePropunere(env.DB, {
              conversatie_id: c.id,
              aplicatie: unde.aplicatie,
              actiune: unde.nume,
              argumente: cerut.argumente,
              rezumat: `${unde.descriere.split('.')[0]} (${unde.nume})`,
            })
            propunere = { id: p.id, rezumat: p.rezumat }
            textFinal = textFinal || 'Am pregătit acțiunea. O fac dacă îmi confirmi.'
            break
          }

          const rez = await cereActiune(unde.fetcher, unde.nume, cerut.argumente, actor, {
            secret,
            correlationId: cid,
            prin: 'chat',
          })
          if (!rez.ok) {
            mesaje.push({
              rol: 'unealta',
              text: `Nu a mers (${rez.cod}): ${rez.mesaj}`,
              numeUnealta: cerut.nume,
            })
            continue
          }
          const rezumat = rezumaRezultat(rez.date)
          if (rezumat.obiect) obiecte.push(rezumat.obiect)
          mesaje.push({ rol: 'unealta', text: rezumat.text, numeUnealta: cerut.nume })
        }

        if (propunere) break
      }

      if (!textFinal) {
        textFinal = 'N-am reușit să duc asta la capăt. Încearcă să-mi spui altfel?'
        log.warn('raspuns gol de la model', { conversatie: c.id })
      }

      await scrieMesaj(env.DB, {
        conversatie_id: c.id,
        rol: 'agent',
        text: textFinal,
        date: { obiecte, propunere },
      })

      const raspuns: RaspunsChat = { conversatieId: c.id, text: textFinal, obiecte, propunere }
      return json(raspuns)
    } catch (e) {
      log.error('chat cazut', { eroare: e instanceof Error ? e.message : String(e) })
      return json({ ok: false, text: 'S-a împiedicat ceva la mine. Mai încearcă o dată.' }, 500)
    }
  },
}
