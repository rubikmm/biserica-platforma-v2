/**
 * MODULUL DE CHAT, partea din aplicație.
 *
 * O aplicație capătă chatul cu trei linii (vezi docs/architecture/chat-si-actiuni.md):
 *
 *   const chat = modulChat({ aplicatie: 'program' })
 *   const r = await chat.ruteaza(req, env, ctxExec, cale, ctxChat); if (r) return r
 *   pagina({ …, chat: await chat.bula(env, ctxChat) })
 *
 * Ce face aici: pune poarta (comutatorul din admin + drepturile omului), trece mesajele mai
 * departe către `chat-worker` prin Service Binding și servește hârtiile din media.
 *
 * De ce trece prin aplicație și nu direct la chat-worker: pagina stă pe originea aplicației, deci
 * sesiunea și CSRF-ul merg neschimbate. Un chat pe alt subdomeniu ar fi cerut CORS, cookie-uri
 * `SameSite` și încă o verificare — pentru nimic.
 */
import { ANTET_ACTOR, ANTET_PRIN, ANTET_SECRET, type Actor } from '@xc/actiuni'
import type { Principal } from '@xc/contracts'
import { bulaHtml, JS_CHAT, STIL_CHAT } from './bula.js'
import { configChat, poateVedea, type EnvComutator } from './comutator.js'

export * from './comutator.js'
export { IC_BULA, SALUT } from './bula.js'

export interface EnvChat extends EnvComutator {
  /** Creierul. Fără el, modulul e tăcut. */
  CHAT?: Fetcher
  /** Unde stau hârtiile pe care le întorc acțiunile. */
  MEDIA?: Fetcher
  SECRET_INTERN?: string
}

export interface ContextChat {
  /** Prefixul aplicației în preview (`/program`); gol pe subdomenii. */
  prefix: string
  principal: Principal | null
  numeleOmului?: string | null
  eAdmin: boolean
}

/** Ce primește carcasa: stilul, HTML-ul și scriptul bulei, gata de pus la locurile lor. */
export interface BucataChat {
  stil: string
  html: string
  js: string
}

/** Cheia din media: `<domeniu>/<cale>`, aceeași formă ca la R2. */
const CHEIE_BUNA = /^[a-z0-9-]+\/[a-zA-Z0-9._/-]{1,200}$/

function json(date: unknown, status = 200): Response {
  return new Response(JSON.stringify(date), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** Pentru cine n-are voie, modulul nu există. Nu spunem că e stins, nu spunem că e acolo. */
const inexistent = () => new Response('Not Found', { status: 404 })

export interface ModulChat {
  bula(env: EnvChat, ctx: ContextChat): Promise<BucataChat | undefined>
  ruteaza(
    req: Request,
    env: EnvChat,
    ctxExec: ExecutionContext,
    cale: string,
    ctx: ContextChat,
  ): Promise<Response | null>
}

export function modulChat(cfg: { aplicatie: string; titlu?: string }): ModulChat {
  /**
   * Poarta, într-un singur loc: același răspuns și pentru bulă, și pentru rute. Dacă s-ar
   * despărți, o stingere din admin ar ascunde bula lăsând rutele deschise.
   *
   * ⚠️ Chatul cere CONT chiar și la treapta „toți": discuția se ține pe `user_id`, iar un
   * vizitator n-are unul. Când (și dacă) se deschide spre toată lumea, aici e locul unde trebuie
   * adăugată o identitate de vizitator — și o limitare pe IP, fiindcă fiecare mesaj costă.
   */
  async function areVoie(env: EnvChat, ctx: ContextChat): Promise<boolean> {
    if (!env.CHAT || !ctx.principal) return false
    const c = await configChat(env)
    return poateVedea(c, cfg.aplicatie, { intrat: true, eAdmin: ctx.eAdmin })
  }

  function actorul(ctx: ContextChat): Actor {
    return { fel: 'utilizator', principal: ctx.principal as Principal }
  }

  function antete(env: EnvChat, req: Request): Record<string, string> {
    return {
      'content-type': 'application/json',
      [ANTET_SECRET]: env.SECRET_INTERN ?? '',
      [ANTET_PRIN]: `app-${cfg.aplicatie}`,
      'x-correlation-id': req.headers.get('x-correlation-id') ?? crypto.randomUUID(),
    }
  }

  return {
    async bula(env, ctx) {
      if (!(await areVoie(env, ctx))) return undefined
      return {
        stil: STIL_CHAT,
        html: bulaHtml({ prefix: ctx.prefix, titlu: cfg.titlu }),
        js: JS_CHAT,
      }
    },

    async ruteaza(req, env, _ctxExec, cale, ctx) {
      if (cale !== '/chat' && !cale.startsWith('/chat/')) return null
      if (!(await areVoie(env, ctx))) return inexistent()

      const chat = env.CHAT!
      const cap = { ...antete(env, req), [ANTET_ACTOR]: JSON.stringify(actorul(ctx)) }

      // Hârtia întoarsă de o acțiune. Nu stă pe internet: media n-are adresă publică, iar
      // aplicația o dă numai celui care are deja voie la chat.
      if (cale.startsWith('/chat/fisier/')) {
        if (!env.MEDIA) return inexistent()
        const cheie = decodeURIComponent(cale.slice('/chat/fisier/'.length))
        if (!CHEIE_BUNA.test(cheie)) return inexistent()
        const r = await env.MEDIA.fetch(
          `https://media.intern/fisier/${cheie.split('/').map(encodeURIComponent).join('/')}`,
        )
        if (!r.ok) return inexistent()
        return new Response(r.body, {
          status: 200,
          headers: {
            'content-type': r.headers.get('content-type') ?? 'application/octet-stream',
            'content-disposition': `inline; filename="${cheie.split('/').pop() ?? 'fisier'}"`,
            'cache-control': 'private, max-age=600',
          },
        })
      }

      if (req.method === 'GET' && cale === '/chat/discutie') {
        const id = new URL(req.url).searchParams.get('id') ?? ''
        const r = await chat.fetch(`https://chat.intern/discutie?id=${encodeURIComponent(id)}`, {
          headers: cap,
        })
        return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
      }

      if (req.method !== 'POST') return inexistent()

      const rute: Record<string, string> = {
        '/chat/mesaj': 'https://chat.intern/mesaj',
        '/chat/confirma': 'https://chat.intern/confirma',
        '/chat/sterge': 'https://chat.intern/sterge',
      }
      const catre = rute[cale]
      if (!catre) return inexistent()

      let corp: Record<string, unknown> = {}
      try {
        corp = (await req.json()) as Record<string, unknown>
      } catch {
        return json({ ok: false, mesaj: 'mesaj neînțeles' }, 400)
      }

      const r = await chat.fetch(catre, {
        method: 'POST',
        headers: cap,
        // Aplicația spune de unde vine întrebarea și cum îl cheamă pe om — chat-worker n-are
        // voie să țină nume, dar modelul se poartă altfel dacă știe cu cine vorbește.
        body: JSON.stringify({ ...corp, aplicatie: cfg.aplicatie, numeleOmului: ctx.numeleOmului ?? null }),
      })
      return new Response(r.body, {
        status: r.status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      })
    },
  }
}
