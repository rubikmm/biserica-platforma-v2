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

import { felDupaId, MODEL_IMPLICIT } from './modele.js'

export const CHEIE_CONFIG = 'modul:chat'

/**
 * Cheia ÎNDRUMĂRILOR UNEI APLICAȚII: `modul:chat:buletin` (user, 18.09.2026, 12:53 — „vreau mai
 * întâi să avem instrucțiuni diferite per aplicație… din Setări aplicație pe un tab Chat AI").
 *
 * ⚠️ CHEI SEPARATE, nu un câmp în `modul:chat`. Fiecare aplicație își scrie rândul ei din ecranul
 * ei de Setări, deci ar scrie toate în aceeași cheie: un citește-schimbă-scrie din două aplicații
 * deodată ar pierde în tăcere ce a scris cealaltă. Așa, fiecare scrie numai la ea.
 */
export const cheiaAplicatiei = (aplicatie: string) => `${CHEIE_CONFIG}:${aplicatie}`

export type CineVede = 'admini' | 'conturi' | 'toti'

/**
 * UNDE E MONTATĂ BULA, în cod. Se scrie AICI, lângă modul, nu în ecranul de administrare: bifa din
 * Module nu montează nimic, doar aprinde ce e deja montat (trei linii în `src/index.ts`-ul
 * aplicației). Când lista stătea în `apps/admin`, ecranul oferea spre bifat aplicații în care bula
 * n-avea cum să apară — bifa se salva, și nu se întâmpla nimic.
 *
 * Se adaugă un rând când o aplicație nouă cheamă `modulChat`.
 */
export const APLICATII_CU_BULA: readonly { cod: string; unde: string }[] = [
  { cod: 'program', unde: 'pe toate paginile' },
  { cod: 'buletin', unde: 'numai pe /nou' },
]

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
  /** Id-ul modelului ales din panou (vezi `MODELE`); gol = fără model. */
  model: string
  /** Dedus din `model`: pe ce drum merge cererea. Ținut aici ca chat-worker să nu mai deducă. */
  creier: Creier
  /**
   * ÎNDRUMĂRILE, cum erau până pe 18.09.2026: UNELE PENTRU TOATE APLICAȚIILE (user, 11.09.2026,
   * 21:04: „un câmp de instrucțiuni pe care să-l pot scrie eu și modelul când începe să lucreze
   * să-l încarce").
   *
   * ⚠️ NU SE MAI SCRIU DE NICĂIERI. Au rămas aici ca MOȘTENIRE: o aplicație care n-are încă rândul
   * ei (`modul:chat:<aplicatie>`) le primește pe acestea, ca să nu rămână bula mută în ziua mutării.
   * Locul lor de azi e ecranul de Setări al fiecărei aplicații (vezi `ConfigAplicatie`) — fiindcă
   * obiceiurile Programului n-au ce căuta în fiecare mesaj al Buletinului, nici plătite, nici citite.
   */
  indrumari: string
  /**
   * UNELTELE, tot moștenire, cu aceeași socoteală ca la `indrumari`. Numele canonic
   * (`program.modifica_slujba`); goală = toate. Azi se aleg pe aplicație, cu bifă, din Setările ei.
   */
  unelte: string[]
}

/**
 * ÎNDRUMĂRILE ȘI UNELTELE UNEI SINGURE APLICAȚII — ce scrie administratorul ei la Setări → „Chat AI".
 *
 * Despărțirea asta e hotărârea userului din 18.09.2026 (12:53): aplicațiile care primesc chat se
 * aprind din Administrare (super-admin), iar CE ȘTIE și CE POATE face bula fiecăreia se scrie în
 * aplicația ei. Tot atunci, la 12:54: „trebuie să construim ceva care merge cu modelul free pus
 * acum" — de aceea lista de unelte e cu bifă, nu scrisă de mână: cu cât vede mai puține, cu atât
 * un model mic nimerește mai bine.
 */
export interface ConfigAplicatie {
  /** Text liber, intră în instrucțiuni la fiecare mesaj, sub regulile fixe. */
  indrumari: string
  /** Numele canonice bifate (`buletin.compune`). Goală = tot ce publică aplicațiile pe care le vede. */
  unelte: string[]
}

export const APLICATIE_FARA_INDRUMARI: ConfigAplicatie = { indrumari: '', unelte: [] }

/**
 * STINS peste tot. Un modul nou nu se aprinde singur nicăieri: fiecare aplicație se deschide
 * anume, din admin. (Și: fiecare mesaj costă bani la fiecare apăsare.)
 */
export const CONFIG_STINS: ConfigChat = { activ: false, aplicatii: {}, cineVede: 'admini', model: MODEL_IMPLICIT, creier: 'claude', indrumari: '', unelte: [] }

export interface EnvComutator {
  CONFIG?: KVNamespace
  MEDIU?: string
}

/** Un minut în memoria izolatului: destul cât să nu întrebăm KV la fiecare pagină, prea puțin ca
 *  o aprindere din admin să se lase așteptată. */
let tinut: { la: number; c: ConfigChat } | null = null
const VIATA = 60_000

export async function configChat(env: EnvComutator): Promise<ConfigChat> {
  const acum = Date.now()
  // In dev se reciteste la 3 s: probele schimba modelul si indrumarile des, si vor sa le vada acum.
  const viata = env.MEDIU === 'dev' ? 3_000 : VIATA
  if (tinut && acum - tinut.la < viata) return tinut.c
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

/**
 * Uită ce s-a ținut minte din configurație.
 *
 * ⚠️ E pentru PROBE: cache-ul de mai sus stă la nivel de MODUL, deci o probă care schimbă
 * comutatoarele ar vedea în tăcere ce a citit proba dinainte — și ar trece (ori ar cădea) pe o cauză
 * greșită. În funcționare nu e nevoie de el: `scrieConfigChat` pune valoarea nouă la loc chiar aici.
 */
export function uitaConfigChat(): void {
  tinut = null
  tinuteApp.clear()
}

export async function scrieConfigChat(env: EnvComutator, c: ConfigChat): Promise<void> {
  if (!env.CONFIG) throw new Error('nu e legat KV-ul de configurare')
  await env.CONFIG.put(CHEIE_CONFIG, JSON.stringify(c))
  tinut = { la: Date.now(), c }
}

/** Ținute la fel ca cea globală, dar una pentru fiecare aplicație. */
const tinuteApp = new Map<string, { la: number; c: ConfigAplicatie }>()

/**
 * Îndrumările și uneltele aplicației. Când aplicația n-are încă rândul ei, se întorc cele vechi,
 * comune — dar numai uneltele CARE SUNT ALE EI, ca lista program-ului să nu ajungă la buletin.
 *
 * ⚠️ Lipsa rândului nu e o eroare și nu se scrie nimic pe furiș: un chat nou-aprins merge cu
 * îndrumări goale (regulile fixe sunt destule), iar administratorul îl scrie când are ce spune.
 */
export async function configAplicatie(env: EnvComutator, aplicatie: string): Promise<ConfigAplicatie> {
  const acum = Date.now()
  const viata = env.MEDIU === 'dev' ? 3_000 : VIATA
  const tinuta = tinuteApp.get(aplicatie)
  if (tinuta && acum - tinuta.la < viata) return tinuta.c
  if (!env.CONFIG) return APLICATIE_FARA_INDRUMARI
  try {
    const scris = await env.CONFIG.get(cheiaAplicatiei(aplicatie), 'json')
    const c = scris ? normalizeazaAplicatie(scris) : mostenireaPentru(await configChat(env), aplicatie)
    tinuteApp.set(aplicatie, { la: acum, c })
    return c
  } catch {
    return tinuta?.c ?? APLICATIE_FARA_INDRUMARI
  }
}

export async function scrieConfigAplicatie(
  env: EnvComutator,
  aplicatie: string,
  c: ConfigAplicatie,
): Promise<void> {
  if (!env.CONFIG) throw new Error('nu e legat KV-ul de configurare')
  await env.CONFIG.put(cheiaAplicatiei(aplicatie), JSON.stringify(c))
  tinuteApp.set(aplicatie, { la: Date.now(), c })
}

/** Ce primește o aplicație fără rând al ei: îndrumările comune și doar uneltele ei din lista veche. */
function mostenireaPentru(global: ConfigChat, aplicatie: string): ConfigAplicatie {
  return {
    indrumari: global.indrumari,
    unelte: global.unelte.filter((u) => u.startsWith(`${aplicatie}.`)),
  }
}

export function normalizeazaAplicatie(brut: unknown): ConfigAplicatie {
  const o = (brut ?? {}) as Partial<ConfigAplicatie>
  const indrumari = typeof o.indrumari === 'string' ? o.indrumari.trim().slice(0, 8000) : ''
  const brutUnelte = (o as { unelte?: unknown }).unelte
  const unelte = (Array.isArray(brutUnelte) ? brutUnelte.map(String) : typeof brutUnelte === 'string' ? brutUnelte.split(/[\n,;]+/) : [])
    .map((u) => u.trim())
    .filter((u) => /^[a-z0-9_]+\.[a-z0-9_]+$/.test(u))
  return { indrumari, unelte: [...new Set(unelte)] }
}

export function normalizeaza(brut: unknown): ConfigChat {
  const o = (brut ?? {}) as Partial<ConfigChat>
  const aplicatii: Record<string, boolean> = {}
  for (const [nume, pornit] of Object.entries(o.aplicatii ?? {})) aplicatii[nume] = Boolean(pornit)
  const cineVede: CineVede =
    o.cineVede === 'toti' || o.cineVede === 'conturi' || o.cineVede === 'admini' ? o.cineVede : 'admini'
  // Implicit CONECTAT, pe Claude (user, 11.09.2026: „lasă conectat", apoi „prefer Claude 4.8").
  // `fara` se cere anume, din panou, cand vrei interfata fara niciun model si fara niciun ban.
  // Modelul, din panou. O configurare mai veche avea doar `creier` (claude / workers-ai /
  // gateway / fara) — se traduce in modelul implicit al drumului aceluia, ca sa nu se piarda nimic.
  const scrisCreier = String((o as { creier?: unknown }).creier ?? '')
  const scrisModel = typeof o.model === 'string' ? o.model.trim() : ''
  let model: string
  if (o.model !== undefined) model = scrisModel
  else if (scrisCreier === 'fara') model = ''
  else if (scrisCreier === 'workers-ai' || scrisCreier === 'gateway') model = '@cf/openai/gpt-oss-120b'
  else model = MODEL_IMPLICIT
  const creier: Creier = model === '' ? 'fara' : felDupaId(model)
  const indrumari = typeof o.indrumari === 'string' ? o.indrumari.trim().slice(0, 8000) : ''
  // Din panou vine text cu un nume pe rand; din KV, lista. Se primesc amandoua.
  const brutUnelte = (o as { unelte?: unknown }).unelte
  const unelte = (Array.isArray(brutUnelte) ? brutUnelte.map(String) : typeof brutUnelte === 'string' ? brutUnelte.split(/[\n,;]+/) : [])
    .map((u) => u.trim())
    .filter((u) => /^[a-z0-9_]+\.[a-z0-9_]+$/.test(u))
  return { activ: Boolean(o.activ), aplicatii, cineVede, model, creier, indrumari, unelte: [...new Set(unelte)] }
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
