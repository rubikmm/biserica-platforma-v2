import { correlationId } from '@xc/observability'

export interface Env {
  HOME: Fetcher
  CONT: Fetcher
  CALENDAR: Fetcher
  TIPIC: Fetcher
  /** Se leaga pe masura ce aplicatiile sunt gata; in dev, un binding fara worker pornit opreste totul. */
  PROGRAM?: Fetcher
  CURATENIE?: Fetcher
  BIBLIA?: Fetcher
  BIBLIOTECA?: Fetcher
  BULETIN?: Fetcher
  NEWSLETTER?: Fetcher
  LIVE?: Fetcher
  RADIO?: Fetcher
  ADMIN: Fetcher
  MEDIU: string
}

/**
 * Maparea cale -> aplicatie pentru preview. In staging si productie fiecare aplicatie are
 * subdomeniul ei; aici, unde containerul are un singur port, fiecare sta sub calea ei, iar
 * radacina e home-ul platformei — la fel ca pe `staging.sfantul-ilie.ro`.
 */
function alegeAplicatia(env: Env, cale: string): Fetcher | null {
  if (cale === '/cont' || cale.startsWith('/cont/')) return env.CONT
  if (cale === '/calendar' || cale.startsWith('/calendar/')) return env.CALENDAR
  if (cale === '/program' || cale.startsWith('/program/')) return env.PROGRAM ?? null
  if (cale === '/tipic' || cale.startsWith('/tipic/')) return env.TIPIC ?? null
  if (cale === '/curatenie' || cale.startsWith('/curatenie/')) return env.CURATENIE ?? null
  if (cale === '/biblia' || cale.startsWith('/biblia/')) return env.BIBLIA ?? null
  if (cale === '/biblioteca' || cale.startsWith('/biblioteca/')) return env.BIBLIOTECA ?? null
  if (cale === '/buletin' || cale.startsWith('/buletin/')) return env.BULETIN ?? null
  if (cale === '/newsletter' || cale.startsWith('/newsletter/')) return env.NEWSLETTER ?? null
  if (cale === '/live' || cale.startsWith('/live/')) return env.LIVE ?? null
  if (cale === '/radio' || cale.startsWith('/radio/')) return env.RADIO ?? null
  if (cale === '/admin' || cale.startsWith('/admin/')) return env.ADMIN
  return env.HOME
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const tinta = alegeAplicatia(env, url.pathname)
    if (!tinta) {
      return new Response('Aplicația nu e pornită în această sesiune de preview.', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }
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
