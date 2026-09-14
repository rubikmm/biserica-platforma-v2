import { DurableObject } from 'cloudflare:workers'
import type { StareDirect } from '@xc/contracts'

/**
 * DIRECTUL — transmisiunea în direct prin Cloudflare Realtime SFU.
 *
 * ⚠️ **Aici NU curge sunet.** Workerul face doar semnalizarea: schimbă SDP-uri între emițător,
 * ascultători și SFU, și ține minte CINE emite. Sunetul merge emițător → SFU → ascultători, fără
 * să treacă pe aici. De aceea nici nu costă trafic și nici nu se încarcă workerul cu ascultători.
 *
 * Două CANALE, aceeași semnalizare:
 *   direct  slujba, publică, emisă de aparat doar cât e pe LIVE;
 *   mic     microfoanele bisericii, emise NEÎNTRERUPT de aparat, indiferent de stare; le aude
 *           doar un super-administrator (poarta e în `index.ts`, nu aici).
 *
 * Emițătorul e o MAȘINĂ (aparatul, cu `WHIP_SECRET`), deci stă sub `/intern`; semnalizarea
 * ascultătorului din browser e a paginii și stă sub `/api`.
 */

export interface EnvDirect {
  DIRECT: DurableObjectNamespace<Direct>
  SFU_APP_ID?: string
  SFU_APP_SECRET?: string
  WHIP_SECRET?: string
}

/** Cine emite acum pe un canal. O singură sursă pe canal — parohia are un singur aparat. */
export interface Emitator {
  sessionId: string
  trackName: string
  /** ISO — de când emite. */
  de: string
}

/** Un canal = o pistă în SFU + o cheie în obiectul durabil + adresa WHIP a mașinii. */
export interface Canal {
  /** Numele pistei în SFU. */
  pista: string
  /** Cheia sub care stă emițătorul curent. */
  cheie: string
}
export const DIRECT: Canal = { pista: 'direct', cheie: 'emitator' }
export const MIC: Canal = { pista: 'mic', cheie: 'microfon' }

const SFU = 'https://rtc.live.cloudflare.com/v1/apps'

// --- Obiectul durabil: cine emite, pe fiecare canal ------------------------------

export class Direct extends DurableObject {
  async citeste(cheie = 'emitator'): Promise<Emitator | null> {
    return (await this.ctx.storage.get<Emitator>(cheie)) ?? null
  }
  async pune(e: Emitator, cheie = 'emitator'): Promise<void> {
    await this.ctx.storage.put(cheie, e)
  }
  /** Șterge doar dacă e tot sesiunea dată — un emițător vechi nu-l închide pe cel nou. */
  async sterge(sessionId: string, cheie = 'emitator'): Promise<boolean> {
    const e = await this.citeste(cheie)
    if (!e || e.sessionId !== sessionId) return false
    await this.ctx.storage.delete(cheie)
    return true
  }
}

function starea(env: EnvDirect) {
  return env.DIRECT.get(env.DIRECT.idFromName('parohia'))
}

// --- Clientul SFU --------------------------------------------------------------

interface SDP {
  type: 'offer' | 'answer'
  sdp: string
}
interface RaspunsSFU {
  errorCode?: string
  errorDescription?: string
  sessionId?: string
  sessionDescription?: SDP
  tracks?: Array<{ trackName?: string; mid?: string; status?: string; errorCode?: string; errorDescription?: string }>
}

export function configurat(env: EnvDirect): boolean {
  return !!(env.SFU_APP_ID && env.SFU_APP_SECRET)
}

async function sfu(env: EnvDirect, cale: string, metoda: 'GET' | 'POST' | 'PUT', corp?: unknown): Promise<RaspunsSFU> {
  const r = await fetch(`${SFU}/${env.SFU_APP_ID}${cale}`, {
    method: metoda,
    headers: {
      authorization: `Bearer ${env.SFU_APP_SECRET}`,
      ...(corp !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: corp !== undefined ? JSON.stringify(corp) : undefined,
  })
  const text = await r.text()
  let j: RaspunsSFU
  try {
    j = JSON.parse(text) as RaspunsSFU
  } catch {
    j = { errorCode: String(r.status), errorDescription: text.slice(0, 300) }
  }
  if (!r.ok && !j.errorCode) j.errorCode = String(r.status)
  return j
}

const json = (o: unknown, status = 200, extra: Record<string, string> = {}) =>
  Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } })

/**
 * Ultima stare pe canal, ținută puțin: paginile întreabă des, iar SFU-ul n-are de ce să fie
 * întrebat de fiecare dată.
 */
const stareCache = new Map<string, { la: number; s: StareDirect }>()
const STARE_CACHE_MS = 1500

/**
 * Se transmite acum pe canal? Verifică ÎN SFU că pista chiar e activă — emițătorul poate muri
 * fără să anunțe, iar SFU-ul curăță pista abia după vreo 30 s fără pachete. Fără verificarea asta,
 * pagina ar spune „în direct" peste liniște.
 */
export async function stareCanal(env: EnvDirect, canal: Canal): Promise<StareDirect> {
  if (!configurat(env)) return { direct: false, configurat: false }
  const c = stareCache.get(canal.cheie)
  if (c && Date.now() - c.la < STARE_CACHE_MS) return c.s
  const e = await starea(env).citeste(canal.cheie)
  let s: StareDirect
  if (!e) s = { direct: false, configurat: true }
  else {
    const r = await sfu(env, `/sessions/${e.sessionId}`, 'GET')
    const pista = r.tracks?.find((t) => t.trackName === e.trackName)
    s = {
      direct: !r.errorCode && pista?.status === 'active',
      configurat: true,
      de: e.de,
      sfu: r.errorCode ?? pista?.status ?? 'lipsa',
    }
  }
  stareCache.set(canal.cheie, { la: Date.now(), s })
  return s
}

/** Se transmite slujba acum? (canalul public) */
export const stareDirect = (env: EnvDirect) => stareCanal(env, DIRECT)

/** WHIP: emițătorul (ffmpeg) trimite oferta SDP; noi o dăm SFU-ului ca pistă locală. */
export async function whipIntra(request: Request, env: EnvDirect, canal: Canal, locatie: string): Promise<Response> {
  if (!configurat(env) || !env.WHIP_SECRET) return new Response('SFU neconfigurat', { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${env.WHIP_SECRET}`) {
    return new Response('neautorizat', { status: 401 })
  }
  const oferta = await request.text()
  if (!oferta.startsWith('v=0')) return new Response('astept SDP', { status: 400 })
  const mid = oferta.match(/^a=mid:(\S+)$/m)?.[1] ?? '0'

  const s = await sfu(env, '/sessions/new', 'POST')
  if (!s.sessionId) return new Response(`SFU sessions/new: ${s.errorDescription ?? s.errorCode}`, { status: 502 })

  const t = await sfu(env, `/sessions/${s.sessionId}/tracks/new`, 'POST', {
    sessionDescription: { type: 'offer', sdp: oferta },
    tracks: [{ location: 'local', mid, trackName: canal.pista }],
  })
  const prima = t.tracks?.[0]
  const eroare = t.errorCode
    ? `${t.errorCode} ${t.errorDescription ?? ''}`
    : prima?.errorCode
      ? `${prima.errorCode} ${prima.errorDescription ?? ''}`
      : !t.sessionDescription?.sdp
        ? 'SFU nu a intors raspuns SDP'
        : null
  if (eroare) return new Response(`SFU tracks/new: ${eroare}`, { status: 502 })

  await starea(env).pune({ sessionId: s.sessionId, trackName: canal.pista, de: new Date().toISOString() }, canal.cheie)
  stareCache.delete(canal.cheie)

  return new Response(t.sessionDescription?.sdp ?? '', {
    status: 201,
    headers: {
      'content-type': 'application/sdp',
      location: `${locatie}/${s.sessionId}`,
      'cache-control': 'no-store',
    },
  })
}

/** Emițătorul a închis. Întoarce `null` dacă nu e ruta lui. */
export async function whipIese(sessionId: string, env: EnvDirect, canal: Canal): Promise<Response> {
  const sters = await starea(env).sterge(sessionId, canal.cheie)
  if (sters) stareCache.delete(canal.cheie)
  return json({ ok: true, sters })
}

/** Ascultătorul: sesiune nouă în SFU care TRAGE pista emițătorului; SFU face oferta. */
export async function ascultaIntra(env: EnvDirect, canal: Canal): Promise<Response> {
  if (!configurat(env)) return json({ motiv: 'neconfigurat' }, 503)
  const e = await starea(env).citeste(canal.cheie)
  if (!e) return json({ motiv: 'nu se transmite' }, 404)

  const s = await sfu(env, '/sessions/new', 'POST')
  if (!s.sessionId) return json({ motiv: `SFU sessions/new: ${s.errorDescription ?? s.errorCode}` }, 502)

  const t = await sfu(env, `/sessions/${s.sessionId}/tracks/new`, 'POST', {
    tracks: [{ location: 'remote', sessionId: e.sessionId, trackName: e.trackName }],
  })
  const eroarePista = t.tracks?.[0]?.errorCode
  if (t.errorCode || eroarePista || !t.sessionDescription) {
    return json(
      {
        motiv: `SFU tracks/new: ${t.errorCode ?? eroarePista} ${t.errorDescription ?? t.tracks?.[0]?.errorDescription ?? ''}`,
      },
      409,
    )
  }
  return json({ sessionId: s.sessionId, offer: t.sessionDescription, de: e.de })
}

export async function ascultaRaspuns(request: Request, sessionId: string, env: EnvDirect): Promise<Response> {
  if (!configurat(env)) return json({ motiv: 'neconfigurat' }, 503)
  const corp = (await request.json().catch(() => null)) as { answer?: SDP } | null
  if (!corp?.answer?.sdp) return json({ motiv: 'astept {answer:{type,sdp}}' }, 400)
  const r = await sfu(env, `/sessions/${sessionId}/renegotiate`, 'PUT', {
    sessionDescription: { type: 'answer', sdp: corp.answer.sdp },
  })
  if (r.errorCode) return json({ motiv: `SFU renegotiate: ${r.errorCode} ${r.errorDescription ?? ''}` }, 502)
  return json({ ok: true })
}

/** Identificatorul de sesiune dintr-o cale, curățat: numai litere, cifre, `-` și `_`. */
export const sidDin = (p: string, prefix: string): string | undefined =>
  p.startsWith(prefix) ? p.slice(prefix.length).match(/^([A-Za-z0-9_-]+)$/)?.[1] : undefined
