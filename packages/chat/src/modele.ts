/**
 * MODELELE DINTRE CARE SE ALEGE ÎN PANOUL DE MODULE (user, 11.09.2026, 20:56: „o selecție de
 * modele - cele free și cele cu plată").
 *
 * Două grupuri, două feluri de plată — amândouă prin AI Gateway (`xc-chat`), amândouă pe factura
 * Cloudflare:
 * - **gratuite** — Workers AI: 10.000 de neuroni pe zi fără plată, apoi cu plată la Cloudflare;
 *   pe poartă rămân pe facturarea obișnuită a contului (`workers_ai_billing_mode: postpaid`);
 * - **cu plată** — Anthropic, prin Unified Billing: se plătesc din creditele AI Gateway.
 *
 * Lista e ținută de mână, dinadins: cele gratuite sunt doar cele cu apelare de unelte din contul
 * parohiei, cu scorul MĂSURAT la proba din 11.09.2026 (cinci întrebări omenești, aceleași unelte);
 * cele cu plată poartă prețul de listă al furnizorului, orientativ, per milion de tokeni.
 */

export type GrupModel = 'gratuit' | 'platit'
export type FelCreier = 'claude' | 'workers-ai'

export interface ModelDeAles {
  id: string
  nume: string
  grup: GrupModel
  fel: FelCreier
  /** Ce află omul înainte să aleagă: scorul măsurat sau prețul. */
  nota: string
}

export const MODELE: readonly ModelDeAles[] = [
  // ------------------------------------------------------------- cu plată (Anthropic)
  { id: 'claude-opus-4-8', nume: 'Claude Opus 4.8', grup: 'platit', fel: 'claude', nota: '$5 intrare / $25 ieșire per 1M tokeni — alegerea de pornire' },
  { id: 'claude-opus-5', nume: 'Claude Opus 5', grup: 'platit', fel: 'claude', nota: '$5 / $25 — cel mai nou din familia Opus' },
  { id: 'claude-sonnet-5', nume: 'Claude Sonnet 5', grup: 'platit', fel: 'claude', nota: '$2 / $10 — mai ieftin, foarte bun la unelte' },
  { id: 'claude-sonnet-4-6', nume: 'Claude Sonnet 4.6', grup: 'platit', fel: 'claude', nota: '$3 / $15' },
  { id: 'claude-haiku-4-5', nume: 'Claude Haiku 4.5', grup: 'platit', fel: 'claude', nota: '$1 / $5 — cel mai ieftin și mai rapid' },
  // ------------------------------------------------------------- gratuite (Workers AI)
  { id: '@cf/openai/gpt-oss-120b', nume: 'gpt-oss-120b', grup: 'gratuit', fel: 'workers-ai', nota: '5/5 la proba uneltelor — cel mai bun dintre cele gratuite' },
  { id: '@cf/meta/llama-4-scout-17b-16e-instruct', nume: 'Llama 4 Scout 17B', grup: 'gratuit', fel: 'workers-ai', nota: '3/5 la proba uneltelor' },
  { id: '@cf/zai-org/glm-5.3', nume: 'GLM 5.3', grup: 'gratuit', fel: 'workers-ai', nota: '3/5 la proba uneltelor' },
  { id: '@cf/zai-org/glm-5.3-flash', nume: 'GLM 5.3 Flash', grup: 'gratuit', fel: 'workers-ai', nota: '3/5 la proba uneltelor, mai rapid' },
  { id: '@cf/deepseek-ai/deepseek-v4-flash-0731', nume: 'DeepSeek V4 Flash', grup: 'gratuit', fel: 'workers-ai', nota: '3/5 la proba uneltelor' },
  { id: '@cf/qwen/qwen3-30b-a3b-fp8', nume: 'Qwen3 30B', grup: 'gratuit', fel: 'workers-ai', nota: '2/5 la proba uneltelor' },
  { id: '@cf/openai/gpt-oss-20b', nume: 'gpt-oss-20b', grup: 'gratuit', fel: 'workers-ai', nota: 'neprobat; fratele mic al lui 120b' },
  { id: '@cf/moonshotai/kimi-k2.6', nume: 'Kimi K2.6', grup: 'gratuit', fel: 'workers-ai', nota: 'neprobat' },
  { id: '@cf/google/gemma-4-26b-a4b-it', nume: 'Gemma 4 26B', grup: 'gratuit', fel: 'workers-ai', nota: 'neprobat' },
]

export const MODEL_IMPLICIT = 'claude-opus-4-8'

/** Modelul din listă, sau `null` dacă id-ul nu e al nostru (o valoare scrisă de mână, veche). */
export function modelDupaId(id: string | undefined | null): ModelDeAles | null {
  if (!id) return null
  return MODELE.find((m) => m.id === id) ?? null
}

/** Drumul pe care merge un id, chiar dacă nu e în listă: `@cf/…` e Workers AI, restul e Claude. */
export function felDupaId(id: string): FelCreier {
  return id.startsWith('@cf/') ? 'workers-ai' : 'claude'
}
