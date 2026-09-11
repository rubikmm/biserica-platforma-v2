/**
 * CREIERUL — singura bucată din modul care știe cu cine vorbim.
 *
 * Restul chatului lucrează cu `MesajModel` / `RaspunsModel` și nu bănuiește ce e dincolo de ușa
 * asta. Azi e Workers AI (alegerea utilizatorului, 11.09.2026, pentru cost). Modelele deschise
 * sunt vizibil mai slabe la ales și înlănțuit unelte decât Claude; dacă se vede că greșește ce
 * funcție cheamă, se schimbă AICI, într-un singur loc — nu în modul.
 *
 * Numele modelului stă în varsa `MODEL_CHAT`, deci se poate proba altul fără publicare de cod.
 */

export interface EnvCreier {
  AI: { run: (model: string, intrare: Record<string, unknown>) => Promise<unknown> }
  MODEL_CHAT?: string
}

/**
 * Implicitul, ales pe MĂSURĂTORI, nu pe reputație (11.09.2026). Cinci întrebări omenești, aceleași
 * unelte, aceeași instrucțiune, șase modele din contul parohiei — câte a nimerit fiecare:
 *
 *   @cf/openai/gpt-oss-120b                    5/5   ← implicitul
 *   @cf/meta/llama-4-scout-17b-16e-instruct    3/5
 *   @cf/zai-org/glm-5.3                        3/5
 *   @cf/zai-org/glm-5.3-flash                  3/5
 *   @cf/deepseek-ai/deepseek-v4-flash-0731     3/5
 *   @cf/qwen/qwen3-30b-a3b-fp8                 2/5
 *
 * Greșeala tipică a celorlalte: confundă „slujbele zilei" cu „slujbele săptămânii" și cheamă
 * „următoarea slujbă" când li se cere o foaie. gpt-oss-120b a fost singurul care a și socotit
 * data duminicii, nu doar a ales unealta.
 */
export const MODEL_IMPLICIT = '@cf/openai/gpt-oss-120b'

export type RolMesaj = 'sistem' | 'om' | 'agent' | 'unealta'

export interface MesajModel {
  rol: RolMesaj
  text: string
  /** Numai la `rol: 'unealta'`: care unealtă a răspuns. */
  numeUnealta?: string
  /**
   * ⚠️ Numai la `rol: 'unealta'`: id-ul apelului la care răspunde.
   *
   * Fără el, modelul primește un rezultat care nu se leagă de nicio cerere de-a lui și TACE —
   * răspunsul vine gol, iar chatul spunea „N-am reușit să duc asta la capăt" (pățit 11.09.2026,
   * la a doua rundă model→unealtă→model).
   */
  idApel?: string
  /** Numai la `rol: 'agent'`: apelurile pe care le-a cerut, puse înapoi în istoric ca atare. */
  apeluri?: CerereUnealta[]
}

export interface UnealtaModel {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface CerereUnealta {
  nume: string
  argumente: Record<string, unknown>
  /** Id-ul dat de model apelului; se dă înapoi la răspuns (`tool_call_id`). */
  id?: string
}

export interface RaspunsModel {
  text: string
  cereri: CerereUnealta[]
}

const ROLURI: Record<RolMesaj, string> = {
  sistem: 'system',
  om: 'user',
  agent: 'assistant',
  unealta: 'tool',
}

/**
 * Ce i se spune modelului despre el însuși. Trei lucruri contează aici, în ordinea asta:
 * să nu inventeze, să folosească uneltele pentru orice fapt despre parohie, și să scrie scurt.
 * Un chat de parohie care „își amintește" ora unei slujbe e mai rău decât unul care spune „nu știu".
 */
export function instructiuni(
  aplicatie: string,
  numeleOmului: string | null,
  azi: { data: string; zi: string },
): string {
  return [
    'Ești asistentul platformei parohiei „Sfântul Ilie — Hanul Colței".',
    // ⚠️ Fara ziua de azi, „duminica" si „maine" n-au de unde fi socotite, iar modelul fie
    // ghiceste o data, fie trimite cuvantul mai departe la intamplare (masurat 11.09.2026).
    `Azi e ${azi.zi}, ${azi.data}.`,
    numeleOmului ? `Vorbești cu ${numeleOmului}.` : 'Vorbești cu un vizitator al platformei.',
    aplicatie ? `Omul e acum în aplicația „${aplicatie}".` : '',
    '',
    'REGULI:',
    '1. Orice fapt despre parohie — ore de slujbă, zile de sărbătoare, sfinții zilei, rânduiala —',
    '   îl afli NUMAI cerându-l prin unelte. Nu răspunde din ce crezi că știi și nu ghici.',
    '2. Dacă unealta nu dă răspuns sau nu există una potrivită, spune simplu că nu știi și',
    '   arată unde se poate uita omul. Nu improviza.',
    '3. Răspunde scurt, în românește curat, cu diacritice. Fără liste lungi când ajunge o frază.',
    '4. Când o unealtă întoarce o hârtie (PDF, poză), nu descrie fișierul: spune ce e și că e gata',
    '   de descărcat — omul o vede ca pe un card, sub răspunsul tău.',
    '5. Uneltele marcate „SCHIMBĂ date" nu se execută pe loc: le ceri, iar omul confirmă apăsând',
    '   un buton. Nu spune niciodată că ai făcut ceva înainte să primești confirmarea.',
    '6. Datele se scriu omenește („duminică, 13 septembrie"), nu 2026-09-13.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Ce a răspuns modelul, indiferent de forma în care a răspuns. */
function desface(brut: unknown): RaspunsModel {
  const r = (brut ?? {}) as Record<string, unknown>

  // Textul: `response` e forma Workers AI; unele modele îl dau ca obiect cu `response.text`,
  // altele în stil OpenAI (`choices[0].message.content`).
  let text = ''
  const raspuns = r.response
  if (typeof raspuns === 'string') text = raspuns
  else if (raspuns && typeof raspuns === 'object') {
    const o = raspuns as Record<string, unknown>
    if (typeof o.text === 'string') text = o.text
    else if (typeof o.content === 'string') text = o.content
  }
  if (!text) {
    const alegeri = r.choices as Array<{ message?: { content?: unknown } }> | undefined
    const c = alegeri?.[0]?.message?.content
    if (typeof c === 'string') text = c
  }

  // Cererile de unealtă: `tool_calls` la nivelul de sus (Workers AI) sau în mesaj (OpenAI).
  const brutCereri =
    (r.tool_calls as unknown[]) ??
    ((r.choices as Array<{ message?: { tool_calls?: unknown[] } }> | undefined)?.[0]?.message
      ?.tool_calls as unknown[]) ??
    []

  const cereri: CerereUnealta[] = []
  for (const c of brutCereri) {
    const o = (c ?? {}) as Record<string, unknown>
    const f = (o.function ?? o) as Record<string, unknown>
    const nume = typeof f.name === 'string' ? f.name : ''
    if (!nume) continue
    let argumente: Record<string, unknown> = {}
    const a = f.arguments ?? f.parameters ?? {}
    if (typeof a === 'string') {
      try {
        argumente = JSON.parse(a) as Record<string, unknown>
      } catch {
        argumente = {}
      }
    } else if (a && typeof a === 'object') {
      argumente = a as Record<string, unknown>
    }
    const id = typeof o.id === 'string' ? o.id : undefined
    cereri.push({ nume, argumente, ...(id ? { id } : {}) })
  }

  return { text: text.trim(), cereri }
}

export async function intreabaModelul(
  env: EnvCreier,
  mesaje: MesajModel[],
  unelte: UnealtaModel[],
): Promise<RaspunsModel> {
  const model = env.MODEL_CHAT || MODEL_IMPLICIT

  const brut = await env.AI.run(model, {
    messages: mesaje.map((m) => ({
      role: ROLURI[m.rol],
      content: m.text,
      ...(m.numeUnealta ? { name: m.numeUnealta } : {}),
      // Perechea cerere–răspuns, așa cum o așteaptă API-ul: mesajul `assistant` își poartă
      // apelurile, iar fiecare `tool` spune la care apel răspunde. Fără ele, a doua rundă
      // se pierde și modelul tace.
      ...(m.idApel ? { tool_call_id: m.idApel } : {}),
      ...(m.apeluri?.length
        ? {
            tool_calls: m.apeluri.map((a, i) => ({
              id: a.id ?? `apel-${i}`,
              type: 'function',
              function: { name: a.nume, arguments: JSON.stringify(a.argumente ?? {}) },
            })),
          }
        : {}),
    })),
    ...(unelte.length
      ? {
          tools: unelte.map((u) => ({
            type: 'function',
            function: { name: u.name, description: u.description, parameters: u.parameters },
          })),
        }
      : {}),
    max_tokens: 800,
    temperature: 0.2,
  })

  return desface(brut)
}
