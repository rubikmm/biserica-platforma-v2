/**
 * ÎNTRERUPĂTORUL — „e pornit chatul, unde, și pentru cine?"
 *
 * Starea stă în KV (`xc-config-*`, cheia `modul:chat`), fiindcă se citește la DESENAREA fiecărei
 * pagini: KV răspunde de la muchie în milisecunde, iar o bază ar pune o cerere în plus pe fiecare
 * afișare. Se scrie dintr-un singur loc: pagina „Module" din `apps/admin`.
 *
 * ⚠️ Stingerea din admin oprește ȘI rutele, nu doar bula. Altfel ar rămâne o ușă deschisă pentru
 * cine știe adresa — iar un chat stins care totuși răspunde la `/chat/mesaj` costă bani la fel.
 */

export const CHEIE_CONFIG = 'modul:chat'

export type CineVede = 'admini' | 'conturi' | 'toti'

/**
 * DE UNDE VINE RĂSPUNSUL. Despărțit de „activ" dinadins (user, 11.09.2026: „doar grafica,
 * afișarea, panoul de control de activare-dezactivare și, abia apoi, cu AI Gateway"):
 *
 * - `claude`     — Claude (Anthropic), prin SDK-ul oficial; modelul din varsa `MODEL_CLAUDE`
 *                  (implicit claude-opus-4-8 — alegerea userului, 11.09.2026: „prefer să folosim
 *                  Claude 4.8… putem să folosim ceva mai bun"). Cere `ANTHROPIC_API_KEY` la chat-worker.
 * - `fara`       — bula, panoul și discuția merg, dar nimeni nu întreabă niciun model. Chatul
 *                  spune limpede că nu e legat încă. **Zero bani cheltuiți.** Implicit.
 * - `workers-ai` — Workers AI (Cloudflare), ținut ca rezervă.
 *
 * ⚠️ AMÂNDOUĂ trec prin AI Gateway, mereu (user, 11.09.2026: „vreau tot prin AI Gateway… nu ocoli
 * această cale"). Nu e o opțiune, e drumul; fără poartă configurată nu se cheamă niciun model.
 *
 * Implicit: `claude` — modulul pornit înseamnă modul care răspunde, cu cel mai bun creier.
 */
export type Creier = 'claude' | 'fara' | 'workers-ai'

export interface ConfigChat {
  activ: boolean
  /** Pe ce aplicații se arată. O aplicație nescrisă aici e stinsă. */
  aplicatii: Record<string, boolean>
  cineVede: CineVede
  creier: Creier
}

/**
 * STINS peste tot. Un modul nou nu se aprinde singur nicăieri: fiecare aplicație se deschide
 * anume, din admin. (Și: fiecare mesaj costă bani la fiecare apăsare.)
 */
export const CONFIG_STINS: ConfigChat = { activ: false, aplicatii: {}, cineVede: 'admini', creier: 'claude' }

export interface EnvComutator {
  CONFIG?: KVNamespace
}

/** Un minut în memoria izolatului: destul cât să nu întrebăm KV la fiecare pagină, prea puțin ca
 *  o aprindere din admin să se lase așteptată. */
let tinut: { la: number; c: ConfigChat } | null = null
const VIATA = 60_000

export async function configChat(env: EnvComutator): Promise<ConfigChat> {
  const acum = Date.now()
  if (tinut && acum - tinut.la < VIATA) return tinut.c
  if (!env.CONFIG) return CONFIG_STINS
  try {
    const scris = await env.CONFIG.get(CHEIE_CONFIG, 'json')
    const c = normalizeaza(scris)
    tinut = { la: acum, c }
    return c
  } catch {
    // KV care tace nu aprinde nimic.
    return tinut?.c ?? CONFIG_STINS
  }
}

export async function scrieConfigChat(env: EnvComutator, c: ConfigChat): Promise<void> {
  if (!env.CONFIG) throw new Error('nu e legat KV-ul de configurare')
  await env.CONFIG.put(CHEIE_CONFIG, JSON.stringify(c))
  tinut = { la: Date.now(), c }
}

export function normalizeaza(brut: unknown): ConfigChat {
  const o = (brut ?? {}) as Partial<ConfigChat>
  const aplicatii: Record<string, boolean> = {}
  for (const [nume, pornit] of Object.entries(o.aplicatii ?? {})) aplicatii[nume] = Boolean(pornit)
  const cineVede: CineVede =
    o.cineVede === 'toti' || o.cineVede === 'conturi' || o.cineVede === 'admini' ? o.cineVede : 'admini'
  // Implicit CONECTAT, pe Claude (user, 11.09.2026: „lasă conectat", apoi „prefer Claude 4.8").
  // `fara` se cere anume, din panou, cand vrei interfata fara niciun model si fara niciun ban.
  // `gateway` (valoare veche, scrisa de un panou mai vechi) inseamna Workers AI — poarta e
  // oricum drumul tuturor. De aceea se citeste ca text, nu ca `Creier`.
  const scris = String((o as { creier?: unknown }).creier ?? '')
  const creier: Creier = scris === 'fara' ? 'fara' : scris === 'workers-ai' || scris === 'gateway' ? 'workers-ai' : 'claude'
  return { activ: Boolean(o.activ), aplicatii, cineVede, creier }
}

/**
 * Are omul ăsta chat în pagina asta? Trei condiții, toate necesare: modulul pornit, aplicația
 * deschisă, omul în treapta cerută.
 */
export function poateVedea(
  c: ConfigChat,
  aplicatie: string,
  cine: { intrat: boolean; eAdmin: boolean },
): boolean {
  if (!c.activ) return false
  if (!c.aplicatii[aplicatie]) return false
  if (c.cineVede === 'admini') return cine.eAdmin
  if (c.cineVede === 'conturi') return cine.intrat
  return true
}
