/**
 * Legătura cu PROGRAMUL: următoarea slujbă.
 *
 * `/v1/stare` spune și care e următoarea slujbă (și dacă se transmite). O cere de la aplicația
 * programului prin **Service Binding**, nu prin internet — „ce ține de altă aplicație se cere, nu
 * se copiază", iar în V2 cererea merge pe fir intern, ca la Biblia.
 *
 * Regula platformei „ultima versiune bună": dacă programul nu răspunde, rămâne ce știam; dacă n-am
 * știut niciodată, `null`. Un răspuns bun cu `null` (nicio slujbă în 21 de zile) e un RĂSPUNS, nu
 * un eșec — de aceea se ține minte ca atare.
 */

export interface EnvProgram {
  PROGRAM?: Fetcher
}

/** Slujba, așa cum o dă programul; o dăm mai departe neschimbată. */
export interface Slujba {
  id: string
  data: string
  ora: string
  nume: string
  transmisie: boolean
  [k: string]: unknown
}

const TINE_MS = 60_000
const ASTEAPTA_MS = 3_000

let cache: { la: number; slujba: Slujba | null } | null = null
let inZbor: Promise<Slujba | null> | null = null

export async function urmatoareaSlujba(env: EnvProgram): Promise<Slujba | null> {
  if (cache && Date.now() - cache.la < TINE_MS) return cache.slujba
  if (!inZbor) {
    inZbor = cere(env)
      .then((r) => {
        cache = { la: Date.now(), slujba: r.ok ? r.slujba : (cache?.slujba ?? null) }
        return cache.slujba
      })
      .finally(() => {
        inZbor = null
      })
  }
  return inZbor
}

async function cere(env: EnvProgram): Promise<{ ok: true; slujba: Slujba | null } | { ok: false }> {
  if (!env.PROGRAM) return { ok: false }
  try {
    const r = await env.PROGRAM.fetch('https://program.intern/v1/urmatoarea', {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(ASTEAPTA_MS),
    })
    if (!r.ok) {
      console.log('[program] /v1/urmatoarea:', r.status)
      return { ok: false }
    }
    const j = (await r.json()) as { urmatoarea?: Slujba | null }
    const s = j.urmatoarea
    return { ok: true, slujba: s && typeof s.data === 'string' && typeof s.ora === 'string' ? s : null }
  } catch (e) {
    console.log('[program] /v1/urmatoarea:', String(e))
    return { ok: false }
  }
}
