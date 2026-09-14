import type { StareDirect, StareEmisie, StarePanou } from '@xc/contracts'

/**
 * DIRECTUL, văzut de aici — creierul stă în cealaltă aplicație.
 *
 * ⚠️ Radioul NU hotărăște niciodată singur asupra directului. Când cineva apasă în panou (chiar și
 * în panoul servit de aici), comanda pleacă la `live`, care ține starea și aparatul din biserică.
 * Aici rămâne doar muzica și ceasul ei. Dacă vreodată codul ăsta ajunge să pornească sau să
 * oprească directul pe cont propriu, cele două aplicații vor începe să se contrazică.
 *
 * Vorbim prin Service Binding; adresele `/_intern/…` ale lui `live` nu se servesc de pe internet.
 */

export interface EnvLiveDeparte {
  LIVE?: Fetcher
}

const ANTET = { 'x-xc-intern': '1', 'content-type': 'application/json' }
const BAZA = 'https://live.intern'

/** Când `live` tace, spunem cinstit că nu știm — nu inventăm „nu se transmite". */
const DIRECT_NECUNOSCUT: StareDirect = { direct: false, configurat: false }

export async function cereLive(env: EnvLiveDeparte, cale: string, init?: RequestInit): Promise<Response | null> {
  if (!env.LIVE) return null
  try {
    return await env.LIVE.fetch(`${BAZA}${cale}`, { ...init, headers: { ...ANTET, ...(init?.headers ?? {}) } })
  } catch (e) {
    console.log('[live]', cale, String(e))
    return null
  }
}

async function jsonDe<T>(env: EnvLiveDeparte, cale: string, init: RequestInit | undefined, implicit: T): Promise<T> {
  const r = await cereLive(env, cale, init)
  if (!r || !r.ok) {
    if (r) console.log('[live]', cale, r.status)
    return implicit
  }
  return (await r.json()) as T
}

/** Ce transmite parohia acum — răspunsul întreg, pentru playerul din paginile noastre. */
export function emisia(env: EnvLiveDeparte, radioGol: StareEmisie): Promise<StareEmisie> {
  return jsonDe<StareEmisie>(env, '/_intern/emisie', undefined, radioGol)
}

/** Starea panoului — aceeași formă ca dincolo, fiindcă e același panou. */
export function starePanouDeparte(
  env: EnvLiveDeparte,
  potComanda: boolean,
  eSuperAdmin: boolean,
  implicit: StarePanou,
): Promise<StarePanou> {
  return jsonDe<StarePanou>(
    env,
    '/_intern/stare-panou',
    { method: 'POST', body: JSON.stringify({ potComanda, eSuperAdmin }) },
    implicit,
  )
}

/** Starea canalului microfonului în SFU. */
export function stareMic(env: EnvLiveDeparte): Promise<StareDirect> {
  return jsonDe<StareDirect>(env, '/_intern/mic/stare', undefined, DIRECT_NECUNOSCUT)
}
