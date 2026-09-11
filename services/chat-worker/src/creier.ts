/**
 * CREIERUL — singura bucată din modul care știe cu cine vorbim.
 *
 * Restul chatului lucrează cu `MesajModel` / `RaspunsModel` și nu bănuiește ce e dincolo de ușa
 * asta. Două drumuri, alese din panoul de Module (`creier`):
 *
 * - **Claude** (Anthropic Claude Opus 4.8) — alegerea utilizatorului, 11.09.2026, seara: „prefer să
 *   folosim Claude 4.8… nu trebuie să ne ducem mai sus, dar parcă nici mai jos". Modelul: varsa
 *   `MODEL_CLAUDE`, efortul: `EFORT_CLAUDE`.
 * - **Workers AI** (Cloudflare, gpt-oss-120b) — drumul de la început, ținut ca rezervă. `MODEL_CHAT`.
 *
 * ⚠️ AMÂNDOUĂ TREC PRIN AI GATEWAY, FĂRĂ OCOL ȘI FĂRĂ SDK-uri (user, 19:52–19:56: „vreau tot prin
 * AI Gateway… nu ocoli această cale… nu facem nimic prin SDK propriu… o singură factură foarte
 * clară"). Claude se cheamă cu cereri simple către poarta `xc-chat`, cu **Unified Billing**: nicio
 * cheie Anthropic, doar tokenul Cloudflare (`cf-aig-authorization`) — Cloudflare plătește furnizorul,
 * parohia plătește Cloudflare. Fără poartă configurată nu se cheamă niciun model.
 *
 * Schimbarea furnizorului e o alegere din panou, nu o rescriere — pentru asta există fișierul.
 */

export interface EnvCreier {
  AI: {
    run: (
      model: string,
      intrare: Record<string, unknown>,
      optiuni?: Record<string, unknown>,
    ) => Promise<unknown>
  }
  MODEL_CHAT?: string
  /**
   * Numele porții AI (Cloudflare AI Gateway). Cand e scrisa SI comutatorul cere `gateway`,
   * cererile trec pe acolo: loguri, cache si plafoane de cost, fara schimbare de cod.
   */
  AI_GATEWAY?: string
  /**
   * Tokenul Cloudflare cu „AI Gateway – Read/Edit”, pentru Unified Billing: poarta plateste
   * furnizorul din creditele contului, deci NU se trimite nicio cheie Anthropic. Secret, niciodata
   * in fisier — local `.dev.vars`, pe staging `wrangler secret put AI_GATEWAY_TOKEN`.
   */
  AI_GATEWAY_TOKEN?: string
  /** Contul Cloudflare — intra in adresa portii pentru Anthropic. Nu e secret. */
  CLOUDFLARE_ACCOUNT_ID?: string
  MODEL_CLAUDE?: string
  EFORT_CLAUDE?: string
}

/** Un bloc de continut Anthropic (text, tool_use, thinking…). Se pastreaza asa cum vine. */
export interface BlocClaude {
  type: string
  [cheie: string]: unknown
}
interface MesajParamClaude {
  role: 'user' | 'assistant'
  content: string | BlocClaude[]
}
interface RaspunsClaude {
  content: BlocClaude[]
  stop_reason: string | null
}
const VERSIUNE_ANTHROPIC = '2023-06-01'

export type FelCreier = 'claude' | 'workers-ai'

/**
 * ⚠️ TOTUL TRECE PRIN AI GATEWAY — fara ocol (user, 11.09.2026, 19:52: „vreau tot prin AI Gateway…
 * nu ocoli această cale"). Poarta da loguri, cache si plafoane de cost intr-un singur loc, pentru
 * ambele drumuri. De aceea NU exista aici o adresa directa spre api.anthropic.com: cand poarta nu
 * e configurata, modelul nu se cheama deloc, si omul afla de ce.
 */
function adresaPortiiAnthropic(env: EnvCreier): string | null {
  if (!env.AI_GATEWAY || !env.CLOUDFLARE_ACCOUNT_ID) return null
  return `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.AI_GATEWAY}/anthropic`
}

const FARA_POARTA: RaspunsModel = {
  text: 'Poarta AI nu e configurată (AI_GATEWAY / CLOUDFLARE_ACCOUNT_ID la chat-worker), iar modelul nu se cheamă pe alt drum.',
  cereri: [],
  taiat: false,
}

/**
 * Implicitul Workers AI, ales pe MĂSURĂTORI (11.09.2026): cinci întrebări omenești, aceleași unelte —
 * gpt-oss-120b 5/5, llama-4-scout / glm-5.3 / glm-5.3-flash / deepseek-v4-flash 3/5, qwen3-30b 2/5.
 * Greșeala tipică a celorlalte: confundă „slujbele zilei" cu „slujbele săptămânii".
 */
export const MODEL_IMPLICIT = '@cf/openai/gpt-oss-120b'

/** Claude 4.8 — cerut anume de utilizator. Opus 5 e o schimbare de varsă, nu de cod. */
export const MODEL_CLAUDE_IMPLICIT = 'claude-opus-4-8'

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
  /**
   * Numai la `rol: 'agent'`, pe drumul Claude: blocurile de conținut ale turei, EXACT cum au venit
   * (text, tool_use, gândire). Se pun înapoi neschimbate — gândirea trebuie să însoțească apelul
   * de unealtă căruia i-a dat naștere, altfel API-ul respinge tura.
   */
  brut?: BlocClaude[]
}

export interface UnealtaModel {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface CerereUnealta {
  nume: string
  argumente: Record<string, unknown>
  /** Id-ul dat de model apelului; se dă înapoi la răspuns (`tool_call_id` / `tool_use_id`). */
  id?: string
}

export interface RaspunsModel {
  text: string
  cereri: CerereUnealta[]
  /** Modelul a fost oprit de `max_tokens` inainte sa termine. */
  taiat: boolean
  /** Drumul Claude: blocurile turei, de pus înapoi în istoric (vezi `MesajModel.brut`). */
  brut?: BlocClaude[]
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
  /** Cunoștințele de fundal ale aplicațiilor (acțiunile cu `fundal: true`), gata scrise. */
  fundal: string[] = [],
  /** Îndrumările scrise de administrator în panou — obiceiuri, ton, ce să nu facă. */
  indrumari = '',
  /** Numele uneltelor pe care le are de fapt (după îngustarea din panou). */
  unelteDisponibile: string[] = [],
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
    '7. Când omul cere o SCHIMBARE (o oră, o slujbă în plus sau în minus, o validare), CHEAMĂ',
    '   IMEDIAT unealta de scriere potrivită, cu argumentele cerute. NU cere confirmarea în text',
    '   („vrei să…?", „confirmă") și nu spune că nu poți: chemarea uneltei NU execută nimic —',
    '   ea pregătește o propunere, iar omul o confirmă apăsând un buton care apare sub răspuns.',
    '   După ce unealta răspunde că propunerea e pregătită, spune-i într-o frază ce urmează și că',
    '   așteaptă apăsarea lui. Când o unealtă răspunde „Nu se poate", spune-i motivul, în vorbele tale.',
    '   NU pune întrebări de lămurire înainte de a chema unealta: cheam-o cu ce ai (ziua se poate da',
    '   și ca „luni", „marți"; numele slujbei se poate lăsa gol) — dacă lipsește ceva, unealta îți',
    '   spune exact ce, și abia atunci întrebi omul.',
    '8. Cum alegi unealta: o ZI anume → slujbele_zilei; o SĂPTĂMÂNĂ → slujbele_saptamanii; „următoarea"',
    '   sau „acum" → slujba_urmatoare / slujba_curenta; „când se face X" (o slujbă după nume) →',
    '   cauta_slujba; „ce sărbătoare / ce zi e" → calendar.ziua; „cine sunt sfinții" → tipic.sfintii_zilei;',
    '   „foaia / PDF / poză" → foaia_* / poza_paginii. Fiecare unealtă are exemple cu argumentele',
    '   gata scrise — potrivește fraza omului cu cel mai apropiat exemplu și copiază-i forma.',
    ...(unelteDisponibile.length
      ? [
          `9. AICI POȚI FACE DOAR ATÂT: ${unelteDisponibile.join(', ')}. Pentru orice altceva (rapoarte,`,
          '   liste, întrebări despre arhivă, alte aplicații) spune într-o frază că nu e de aici și ce',
          '   POȚI face — nu încerca să răspunzi din memorie și nu inventa o unealtă.',
        ]
      : []),
    ...(indrumari.trim()
      ? [
          '',
          'ÎNDRUMĂRI DE LA ADMINISTRATORUL PAROHIEI — au întâietate față de obiceiurile de mai jos, nu față',
          'de regulile de mai sus:',
          indrumari.trim(),
        ]
      : []),
    ...(fundal.length
      ? [
          '',
          'CE ȘTII DINAINTE — cunoștințe de fundal ale aplicațiilor, împrospătate periodic. Pentru',
          'întrebări despre obiceiuri („când se face de regulă X?") răspunde de aici; pentru date',
          'exacte (o zi anume, următoarea programată) cheamă tot unealta. Obiceiul NU e programare:',
          'dacă „urmatoarea" lipsește, spune că nu e încă pusă în program și că DE OBICEI se face',
          'atunci — nu spune „va fi" despre ceva neprogramat.',
          ...fundal,
        ]
      : []),
  ]
    .filter(Boolean)
    .join('\n')
}

// ===========================================================================
// Drumul CLAUDE
// ===========================================================================

/**
 * Istoricul nostru, în forma API-ului Anthropic. Regulile care contează:
 * - instrucțiunile („sistem") ies din listă și merg în `system`;
 * - tura asistentului se pune înapoi cu blocurile ei BRUTE când le avem (gândire + tool_use), iar
 *   când nu (istoricul din baza de date, sau o tură venită de pe drumul Workers AI) se reface din
 *   text și apeluri;
 * - răspunsurile uneltelor care se țin lanț intră într-un SINGUR mesaj `user`, cu câte un
 *   `tool_result` fiecare — despărțite, modelul se dezvață să ceară mai multe unelte deodată;
 * - primul mesaj trebuie să fie al omului; un mesaj gol nu se trimite.
 */
export function spreClaude(mesaje: MesajModel[]): { system: string; messages: MesajParamClaude[] } {
  const system = mesaje.filter((m) => m.rol === 'sistem').map((m) => m.text).join('\n\n')
  const messages: MesajParamClaude[] = []
  let rezultateInAsteptare: BlocClaude[] = []

  const varsaRezultatele = () => {
    if (rezultateInAsteptare.length) {
      messages.push({ role: 'user', content: rezultateInAsteptare })
      rezultateInAsteptare = []
    }
  }

  for (const m of mesaje) {
    if (m.rol === 'sistem') continue

    if (m.rol === 'unealta') {
      if (!m.idApel) continue
      rezultateInAsteptare.push({ type: 'tool_result', tool_use_id: m.idApel, content: m.text || '(gol)' })
      continue
    }
    varsaRezultatele()

    if (m.rol === 'om') {
      if (m.text.trim()) messages.push({ role: 'user', content: m.text })
      continue
    }

    // agent
    if (!messages.length) continue // o tură a asistentului nu poate deschide discuția
    if (m.brut?.length) {
      messages.push({ role: 'assistant', content: m.brut })
      continue
    }
    const blocuri: BlocClaude[] = []
    if (m.text.trim()) blocuri.push({ type: 'text', text: m.text })
    for (const [i, a] of (m.apeluri ?? []).entries()) {
      blocuri.push({ type: 'tool_use', id: a.id ?? `apel-${messages.length}-${i}`, name: a.nume, input: a.argumente ?? {} })
    }
    if (blocuri.length) messages.push({ role: 'assistant', content: blocuri })
  }
  varsaRezultatele()
  return { system, messages }
}

/** Uneltele noastre, în forma Anthropic. `$schema` din zod nu are ce căuta în `input_schema`. */
function unelteClaude(unelte: UnealtaModel[]): Array<{ name: string; description: string; input_schema: Record<string, unknown> }> {
  return unelte.map((u) => {
    const { $schema: _s, ...schema } = u.parameters as Record<string, unknown> & { $schema?: unknown }
    return { name: u.name, description: u.description, input_schema: { ...schema, type: 'object' } }
  })
}

/** Răspunsul lui Claude, în forma noastră. Gândirea nu ajunge la om; blocurile se păstrează brute. */
export function desfaceClaude(raspuns: RaspunsClaude): RaspunsModel {
  const text = raspuns.content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
    .trim()
  const cereri: CerereUnealta[] = raspuns.content
    .filter((b) => b.type === 'tool_use' && typeof b.name === 'string')
    .map((b) => ({
      nume: b.name as string,
      argumente: (b.input && typeof b.input === 'object' ? b.input : {}) as Record<string, unknown>,
      ...(typeof b.id === 'string' ? { id: b.id } : {}),
    }))
  return {
    text: raspuns.stop_reason === 'refusal' ? 'Nu pot răspunde la asta.' : text,
    cereri,
    taiat: raspuns.stop_reason === 'max_tokens',
    brut: raspuns.content,
  }
}

/**
 * Cererea către poartă, fără SDK. Forma e cea a Messages API (`/v1/messages`), iar poarta o duce
 * mai departe la Anthropic. Cu Unified Billing nu se trimite `x-api-key` — trimiterea ei ar face
 * cererea să cadă —, doar `cf-aig-authorization` cu tokenul Cloudflare.
 */
async function intreabaClaude(
  env: EnvCreier,
  mesaje: MesajModel[],
  unelte: UnealtaModel[],
  o: { faraApeluri?: boolean; model?: string },
): Promise<RaspunsModel> {
  const poarta = adresaPortiiAnthropic(env)
  if (!poarta) return FARA_POARTA
  if (!env.AI_GATEWAY_TOKEN) {
    return { text: 'Poarta AI n-are tokenul Cloudflare (AI_GATEWAY_TOKEN la chat-worker), deci nu poate plăti modelul.', cereri: [], taiat: false }
  }
  const { system, messages } = spreClaude(mesaje)
  const tools = unelteClaude(unelte)
  const efort = env.EFORT_CLAUDE || 'medium'

  const corp = {
    // Modelul ales din panou bate varsa; varsa e doar plasa de siguranță.
    model: o.model || env.MODEL_CLAUDE || MODEL_CLAUDE_IMPLICIT,
    // Gândirea se plătește din bugetul ăsta; un plafon mic ar tăia-o la mijloc, ca la gpt-oss.
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: efort },
    system,
    messages,
    // Când istoricul are tool_use, uneltele trebuie declarate chiar dacă nu mai vrem apeluri —
    // API-ul le cere. `tool_choice: none` spune „vorbește, nu chema".
    ...(tools.length ? { tools, ...(o.faraApeluri ? { tool_choice: { type: 'none' } } : {}) } : {}),
  }

  let r: Response
  try {
    r = await fetch(`${poarta}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': VERSIUNE_ANTHROPIC,
        'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_TOKEN}`,
      },
      body: JSON.stringify(corp),
    })
  } catch {
    return { text: 'Nu ajung la poarta AI acum. Mai încearcă peste puțin.', cereri: [], taiat: false }
  }

  if (!r.ok) {
    // De la cel mai anume la cel mai larg: fiecare are alt înțeles pentru om.
    const detaliu = await r.text().catch(() => '')
    let mesaj = ''
    try {
      const j = JSON.parse(detaliu) as { error?: { message?: string }; errors?: Array<{ message?: string }> }
      mesaj = j.error?.message ?? j.errors?.[0]?.message ?? ''
    } catch {
      mesaj = detaliu.slice(0, 200)
    }
    if (r.status === 401 || r.status === 403) {
      return { text: `Poarta AI nu primește tokenul (${r.status}): ${mesaj || 'de verificat AI_GATEWAY_TOKEN și drepturile lui'}.`, cereri: [], taiat: false }
    }
    if (r.status === 402) {
      return { text: `Creditele AI Gateway s-au terminat sau nu sunt pornite (${mesaj || '402'}).`, cereri: [], taiat: false }
    }
    if (r.status === 429) {
      return { text: 'Modelul e ocupat chiar acum. Mai încearcă peste un minut.', cereri: [], taiat: false }
    }
    throw new Error(`poarta AI a răspuns ${r.status}: ${mesaj || 'fără detalii'}`)
  }

  return desfaceClaude((await r.json()) as RaspunsClaude)
}

// ===========================================================================
// Drumul WORKERS AI
// ===========================================================================

/**
 * gpt-oss vorbeste in „canale" (Harmony): `analysis` e gandirea, `final` e raspunsul. Workers AI
 * le desparte de obicei (`reasoning` / `content`), dar cand modelul e oprit de `max_tokens` in
 * mijlocul gandirii, marcajul `<|channel|>analysis…` poate ajunge in `content` — si asa a ajuns la
 * om o pagina de bolboroseala (11.09.2026, seara). Aici se pastreaza doar canalul `final`; daca nu
 * e, tot ce vine dupa un marcaj de canal se arunca.
 */
export function curataCanalele(text: string): string {
  if (!text.includes('<|')) return text
  const final = text.lastIndexOf('<|channel|>final')
  if (final >= 0) {
    const dupa = text.slice(final)
    const mesaj = dupa.indexOf('<|message|>')
    return (mesaj >= 0 ? dupa.slice(mesaj + '<|message|>'.length) : '').replace(/<\|[a-z_]+\|>/g, '').trim()
  }
  const canal = text.indexOf('<|channel|>')
  const curat = (canal >= 0 ? text.slice(0, canal) : text).replace(/<\|[a-z_]+\|>/g, '').trim()
  return curat
}

/** Ce a răspuns modelul Workers AI, indiferent de forma în care a răspuns. */
export function desface(brut: unknown): RaspunsModel {
  const r = (brut ?? {}) as Record<string, unknown>
  const alegere = (r.choices as Array<{ finish_reason?: string }> | undefined)?.[0]
  const taiat = alegere?.finish_reason === 'length'

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

  return { text: curataCanalele(text), cereri, taiat }
}

async function intreabaWorkersAi(
  env: EnvCreier,
  mesaje: MesajModel[],
  unelte: UnealtaModel[],
  o: { faraApeluri?: boolean; model?: string },
): Promise<RaspunsModel> {
  const model = o.model || env.MODEL_CHAT || MODEL_IMPLICIT
  // Si Workers AI trece prin poarta, mereu — fara ea nu se cheama nimic (vezi mai sus).
  if (!env.AI_GATEWAY) return FARA_POARTA
  const poarta = { gateway: { id: env.AI_GATEWAY } }
  const uneltele = o.faraApeluri ? [] : unelte

  const cerere = (maxTokens: number): Record<string, unknown> => ({
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
    ...(uneltele.length
      ? {
          tools: uneltele.map((u) => ({
            type: 'function',
            function: { name: u.name, description: u.description, parameters: u.parameters },
          })),
        }
      : {}),
    // Modelul GANDESTE din bugetul asta (gpt-oss: canalul de analiza). 800 ajungeau pentru o
    // intrebare; cu fundal + zece unelte + romana, gandirea singura trecea de atat si raspunsul
    // iesea taiat (11.09.2026). Cand e oprit in mijloc fara sa fi cerut nicio unealta, se mai
    // incearca o data, cu bugetul dublat.
    max_tokens: maxTokens,
    temperature: 0.2,
  })

  let r = desface(await env.AI.run(model, cerere(2500), poarta))
  if (r.taiat && !r.cereri.length) r = desface(await env.AI.run(model, cerere(6000), poarta))
  return r
}

// ===========================================================================
// Ușa
// ===========================================================================

export async function intreabaModelul(
  env: EnvCreier,
  mesaje: MesajModel[],
  unelte: UnealtaModel[],
  prin: FelCreier = 'claude',
  /** `model`: id-ul ales din panoul de Module; fără el, varsa workerului. */
  o: { faraApeluri?: boolean; model?: string } = {},
): Promise<RaspunsModel> {
  if (prin === 'claude') return intreabaClaude(env, mesaje, unelte, o)
  return intreabaWorkersAi(env, mesaje, unelte, o)
}
