import { correlationId } from '@xc/observability'

export interface Env {
  CONT: Fetcher
  CALENDAR: Fetcher
  ADMIN: Fetcher
  MEDIU: string
}

/**
 * Maparea cale -> aplicatie pentru preview. Ordinea conteaza: prima potrivire castiga,
 * iar `/` cade pe aplicatia de cont.
 */
function alegeAplicatia(env: Env, cale: string): Fetcher {
  if (cale === '/calendar' || cale.startsWith('/calendar/')) return env.CALENDAR
  if (cale === '/admin' || cale.startsWith('/admin/')) return env.ADMIN
  return env.CONT
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const tinta = alegeAplicatia(env, url.pathname)
    const cid = correlationId(req)

    // Trimitem cererea mai departe neschimbata (inclusiv cookie-urile), cu corelarea propagata.
    const antete = new Headers(req.headers)
    antete.set('x-correlation-id', cid)

    const cerere = new Request(req.url, {
      method: req.method,
      headers: antete,
      body: req.method === 'GET' || req.method === 'HEAD' ? null : req.body,
      redirect: 'manual',
    })

    return tinta.fetch(cerere)
  },
}
