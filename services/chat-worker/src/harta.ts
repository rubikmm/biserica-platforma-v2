/**
 * FLUXUL PE HARTĂ — două nivele, o confirmare, și cât mai puțin model cu putință.
 *
 * Cererea utilizatorului (19.09.2026, 11:27): „Cred că trebuie să avem altă abordare cu AI-ul free.
 * Aș vrea să aibă un cuprins pe care să facă match — cu subiecte. Dacă nu înțelege subiectul spune
 * asta. Apoi nivelul 2 să înțeleagă acțiunea — dacă nu o poate alege să zică asta și apoi
 * confirmarea. La ambele nivele să întrebe dacă nu e sigur. Cu o hartă așa simplă ar trebui să pot
 * lucra și fără AI."
 *
 * Ce e altfel față de bucla de până acum (`PASI_MAXIM` ocoluri model → unealtă → model):
 *   - modelul NU mai primește unelte și nu mai alege ce să cheme. Face cel mult DOUĂ clasificări
 *     scurte, cu JSON strict: „despre ce subiect e vorba?" și „ce acțiune a subiectului?";
 *   - drumul obișnuit nu-l atinge deloc: potrivitorul aplicației (determinist) rezolvă răspunsurile
 *     la întrebarea pendinte, sintaxa strictă și comenzile scurte;
 *   - ce nu se înțelege se SPUNE, cu butoane: „e vorba de X sau de Y?", „nu știu ce să fac cu X".
 *     Butoanele trimit un mesaj obișnuit, deci meniul E drumul fără AI: `meniu` → subiect → acțiune.
 *
 * ⚠️ NIMIC NU SE EXECUTĂ ALTFEL. Faptele trec tot prin acțiunile EXISTENTE ale aplicației
 * (`buletin.raspunde`, `buletin.compune`…), cu aceeași previzualizare și aceeași propunere Da/Nu.
 * Harta hotărăște CE se cheamă, nu CUM se scrie.
 *
 * ⚠️ APLICAȚIILE FĂRĂ HARTĂ nu trec pe aici (program, tipic): ele rămân pe drumul cu unelte.
 */
import { z } from 'zod'
import {
  cereActiune,
  numeUnealta,
  type Actor,
  type HartaAplicatie,
  type SubiectHarta,
} from '@xc/actiuni'
import type { Logger } from '@xc/observability'
import { intreabaModelul, type EnvCreier, type FelCreier, type MesajModel } from './creier.js'

// ---------------------------------------------------------------------------
// Ce întoarce potrivitorul aplicației
// ---------------------------------------------------------------------------

const Optiune = z.object({ id: z.string(), nume: z.string() })

const Potrivire = z.object({
  nivel: z.enum(['sigur', 'valoare', 'nesigur', 'meniu', 'necunoscut']),
  subiect: z.string().optional(),
  actiune: z.string().optional(),
  valoare: z.string().optional(),
  articol: z.string().optional(),
  confirma: z.boolean().optional(),
  raspuns: z.boolean().optional(),
  ce: z.enum(['subiect', 'actiune']).optional(),
  intre: z.array(Optiune).optional(),
  /** Omul a apăsat un buton al meniului (doar numele subiectului) — vezi `butoane`. */
  dinMeniu: z.boolean().optional(),
})

const Fapta = z.object({
  subiect: z.string(),
  actiune: z.string(),
  apel: z.object({ actiune: z.string(), argumente: z.record(z.string(), z.unknown()) }).nullable(),
  rezumat: z.string(),
  confirma: z.boolean(),
  raspuns: z.string().optional(),
})

const RaspunsPotrivitor = z.object({
  cuprins: z.array(z.object({
    id: z.string(),
    nume: z.string(),
    cuvinte: z.array(z.string()),
    actiuni: z.array(z.object({
      id: z.string(),
      nume: z.string(),
      cere: z.enum(['nimic', 'text', 'fisier']),
      confirma: z.boolean(),
      ascunsa: z.boolean(),
    })),
  })),
  intrebare: z.object({
    subiect: z.string(),
    articol: z.string(),
    text: z.string(),
    candidati: z.array(z.string()),
  }).nullable(),
  secundari: z.number().optional(),
  potrivire: Potrivire.nullable(),
  fapta: Fapta.nullable(),
})

export type RaspunsPotrivitor = z.infer<typeof RaspunsPotrivitor>
export type Fapta = z.infer<typeof Fapta>

/** Ce valoare s-a cerut omului la mesajul dinainte (după un buton de nivel 2). */
export interface Asteptare {
  subiect: string
  actiune: string
  articol?: string
}

/** Pe ce drum s-a rezolvat mesajul — cifra cu care se măsoară „aș putea lucra fără AI?". */
export type Drum = 'determinist' | 'model-n1' | 'model-n2' | 'nesigur' | 'necunoscut'
export const DRUMURI: readonly Drum[] = ['determinist', 'model-n1', 'model-n2', 'nesigur', 'necunoscut']

/** Un buton al bulei: se apasă, și pleacă `text` ca mesaj obișnuit. */
export interface OptiuneBula {
  eticheta: string
  text: string
}

export interface RezultatHarta {
  text: string
  /** Butoanele de ales, când nu s-a putut alege singur. */
  optiuni: OptiuneBula[]
  /** Propunerea Da/Nu, când fapta cere confirmare. */
  propunere: { id: string; rezumat: string } | null
  /** Ce valoare se așteaptă la mesajul următor (se păstrează lângă răspuns). */
  asteapta: Asteptare | null
  drum: Drum
  /** Numele acțiunilor atinse — pentru împrospătarea ecranului de dedesubt. */
  unelte: string[]
  /** Pentru referință: ce s-a chemat și cum a ieșit. */
  apeluri: Array<{ nume: string; argumente: unknown; rezultat: string }>
}

// ---------------------------------------------------------------------------
// Prompturile — mici, cu JSON strict, fără unelte
// ---------------------------------------------------------------------------

const CAP =
  'Ești clasificatorul unui chat de parohie. NU răspunzi omului, NU explici, NU faci nimic: ' +
  'alegi dintr-o listă și răspunzi cu un singur JSON.'

/** Cuprinsul, scris pentru model: un rând pe subiect, cu cuvintele după care se recunoaște. */
function cuprinsulScris(cuprins: RaspunsPotrivitor['cuprins']): string {
  return cuprins
    .map((s) => `- ${s.id} — ${s.nume} (se recunoaște după: ${s.cuvinte.join(', ')})`)
    .join('\n')
}

/** Acțiunile unui subiect, scrise pentru model. Cele ascunse nu se oferă. */
function actiunileScrise(s: RaspunsPotrivitor['cuprins'][number]): string {
  return s.actiuni
    .filter((a) => !a.ascunsa)
    .map((a) => `- ${a.id} — ${a.nume} (cere: ${a.cere === 'nimic' ? 'nimic' : a.cere})`)
    .join('\n')
}

/** ÎNTREBAREA PENDINTE, scrisă la fel în amândouă prompturile — ea dă contextul lipsă. */
function pendintaScrisa(i: RaspunsPotrivitor['intrebare']): string {
  if (!i) return 'ACUM NU AȘTEPT NICIUN RĂSPUNS: chestionarul e încheiat.'
  return (
    `ÎNTREBAREA PE CARE TOCMAI I-AM PUS-O OMULUI: „${i.text}"\n` +
    `Ea e despre: ${i.articol} (câmpul „${i.subiect}").` +
    (i.candidati.length ? `\nVariantele numerotate din ea: ${i.candidati.map((c, n) => `${n + 1}. ${c}`).join(' ')}` : '')
  )
}

const indrumarileScrise = (indrumari: string): string =>
  indrumari.trim() ? `\nÎNDRUMĂRI DE LA ADMINISTRATORUL PAROHIEI (nu schimbă formatul răspunsului):\n${indrumari.trim()}\n` : ''

/** PROMPTUL DE NIVEL 1 — un singur lucru de aflat: despre ce SUBIECT e vorba. */
export function promptNivel1(o: {
  despre?: string
  cuprins: RaspunsPotrivitor['cuprins']
  intrebare: RaspunsPotrivitor['intrebare']
  indrumari: string
  mesaj: string
}): string {
  return [
    CAP,
    '',
    `Aici e vorba despre ${o.despre ?? 'o lucrare a parohiei'}.`,
    '',
    'CUPRINS — subiectele dintre care alegi:',
    cuprinsulScris(o.cuprins),
    '',
    pendintaScrisa(o.intrebare),
    'Dacă mesajul pare a fi RĂSPUNSUL la întrebarea de mai sus și nu numește el alt subiect, alege',
    'subiectul întrebării. Dacă omul numește anume alt subiect, alege-l pe acela.',
    o.indrumari.trim() ? indrumarileScrise(o.indrumari) : '',
    'MESAJUL OMULUI:',
    '"""',
    o.mesaj,
    '"""',
    '',
    'Răspunde NUMAI cu un JSON, pe un singur rând, fără explicații și fără blocuri de cod:',
    '{"subiect":"<id din cuprins>"}',
    '{"subiect":"nesigur","intre":["<id>","<id>"]}   — când ezită între două subiecte',
    '{"subiect":"necunoscut"}                        — când nu e despre niciunul dintre ele',
  ]
    .filter((r) => r !== '')
    .join('\n')
}

/** PROMPTUL DE NIVEL 2 — subiectul e ales; se caută ACȚIUNEA și, dacă cere, valoarea. */
export function promptNivel2(o: {
  subiect: RaspunsPotrivitor['cuprins'][number]
  intrebare: RaspunsPotrivitor['intrebare']
  indrumari: string
  mesaj: string
}): string {
  return [
    CAP,
    '',
    `SUBIECTUL E DEJA ALES: „${o.subiect.nume}" (${o.subiect.id}). Alegi acum o singură ACȚIUNE a lui.`,
    '',
    `ACȚIUNILE LUI „${o.subiect.nume}":`,
    actiunileScrise(o.subiect),
    '',
    pendintaScrisa(o.intrebare),
    '',
    'REGULI:',
    '1. `valoare` e EXACT ce a scris omul pentru câmpul acela — literă cu literă, fără ghilimelele',
    '   de prisos, fără să rescrii, fără să scurtezi. La acțiunile care cer „nimic", las-o goală.',
    '2. `sigur` e false când ai ezitat între două acțiuni ori ai ghicit. Un „nu sunt sigur" cinstit',
    '   e bun: omul alege singur, pe buton. Un răspuns ghicit strică foaia.',
    '3. Nu inventa acțiuni din afara listei.',
    o.indrumari.trim() ? indrumarileScrise(o.indrumari) : '',
    'MESAJUL OMULUI:',
    '"""',
    o.mesaj,
    '"""',
    '',
    'Răspunde NUMAI cu un JSON, pe un singur rând, fără explicații și fără blocuri de cod:',
    '{"actiune":"<id din listă>","valoare":"<text sau gol>","sigur":true}',
    '{"actiune":"nu_pot_alege"}   — când niciuna nu se potrivește limpede',
  ]
    .filter((r) => r !== '')
    .join('\n')
}

// ---------------------------------------------------------------------------
// Citirea JSON-ului de la un model mic
// ---------------------------------------------------------------------------

const Nivel1 = z.object({
  subiect: z.string(),
  intre: z.array(z.string()).optional(),
})
const Nivel2 = z.object({
  actiune: z.string(),
  valoare: z.string().optional(),
  articol: z.string().optional(),
  sigur: z.boolean().optional(),
})

/**
 * JSON-UL DINTR-UN RĂSPUNS CARE POATE AVEA ȘI ALTCEVA ÎN EL. Un model mic pune blocuri de cod, o
 * frază de politețe înainte, uneori amândouă. `null` la orice nu se poate citi — și `null` se
 * tratează ca „nesigur", NU ca eroare: omul primește butoane, nu un mesaj despre JSON stricat.
 */
export function jsonulDin(text: string): unknown {
  const t = (text ?? '').trim()
  if (!t) return null
  const fara = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const i = fara.indexOf('{')
  const j = fara.lastIndexOf('}')
  if (i < 0 || j <= i) return null
  try {
    return JSON.parse(fara.slice(i, j + 1))
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Măsura „fără AI": contorul din KV
// ---------------------------------------------------------------------------

export const cheiaStatisticii = (aplicatie: string): string => `harta:statistica:${aplicatie}`

export interface Statistica {
  aplicatie: string
  total: number
  drumuri: Record<Drum, number>
  de_la: string
  pana_la: string
}

export function statisticaGoala(aplicatie: string): Statistica {
  const drumuri = Object.fromEntries(DRUMURI.map((d) => [d, 0])) as Record<Drum, number>
  const acum = new Date().toISOString()
  return { aplicatie, total: 0, drumuri, de_la: acum, pana_la: acum }
}

export function citesteStatistica(aplicatie: string, brut: unknown): Statistica {
  const goala = statisticaGoala(aplicatie)
  const o = (brut ?? {}) as Partial<Statistica>
  const scrise = (o.drumuri ?? {}) as Record<string, unknown>
  for (const d of DRUMURI) {
    const n = Number(scrise[d])
    goala.drumuri[d] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  }
  goala.total = DRUMURI.reduce((s, d) => s + goala.drumuri[d], 0)
  if (typeof o.de_la === 'string') goala.de_la = o.de_la
  if (typeof o.pana_la === 'string') goala.pana_la = o.pana_la
  return goala
}

/**
 * ÎNSEMNAREA DRUMULUI — în log ȘI într-un contor mic în KV (user, 19.09.2026: vrea să analizeze dacă
 * poate lucra fără AI; asta e cifra lui).
 *
 * ⚠️ O cădere aici NU răstoarnă răspunsul: contorul e o măsură, nu o dată a parohiei. Citește-schimbă-
 * scrie fără blocare — la un chat de parohie, cu un om odată, pierderea unei unități nu schimbă nimic,
 * iar o încuietoare ar costa mai mult decât valorează cifra.
 */
export async function noteazaDrumul(
  kv: KVNamespace | undefined,
  aplicatie: string,
  drum: Drum,
): Promise<void> {
  if (!kv) return
  try {
    const cheie = cheiaStatisticii(aplicatie)
    const s = citesteStatistica(aplicatie, await kv.get(cheie, 'json'))
    s.drumuri[drum] = (s.drumuri[drum] ?? 0) + 1
    s.total += 1
    s.pana_la = new Date().toISOString()
    await kv.put(cheie, JSON.stringify(s))
  } catch {
    // o măsură pierdută nu strică un răspuns bun
  }
}

// ---------------------------------------------------------------------------
// Fluxul
// ---------------------------------------------------------------------------

/**
 * CONVENȚIA FLUXULUI PE HARTĂ — ce câmpuri ale unui rezultat se citesc omului.
 *
 * ⚠️ Chat-worker nu cunoaște câmpurile buletinului și nu trebuie să le cunoască. Se uită după trei
 * nume generice, în ordinea asta, și le spune pe cele găsite. O acțiune care vrea să fie citită
 * omenește își scrie `text`; una care spune ce a schimbat, `scris`; iar `intrebare` e ce urmează.
 * (Aceeași socoteală ca la acțiunile de fundal: cine își scrie singur textul știe mai bine.)
 */
const CAMPURI_DE_SPUS = ['text', 'scris'] as const
const CAMP_INTREBARE = 'intrebare'

function ceSeSpuneDin(date: unknown): { spus: string; intrebare: string } {
  const o = (date ?? {}) as Record<string, unknown>
  let spus = ''
  for (const c of CAMPURI_DE_SPUS) {
    if (typeof o[c] === 'string' && (o[c] as string).trim()) {
      spus = (o[c] as string).trim()
      break
    }
  }
  const i = o[CAMP_INTREBARE]
  return { spus, intrebare: typeof i === 'string' ? i.trim() : '' }
}

export interface PorniHarta {
  env: EnvCreier & { CONFIG?: KVNamespace }
  harta: HartaAplicatie
  aplicatie: string
  fetcher: Fetcher
  actor: Actor
  secret: string
  cid: string
  /** `fara` e îngăduit dinadins: atunci merge doar potrivitorul determinist, și e în regulă. */
  creier: FelCreier | 'fara'
  model: string
  indrumari: string
  /** `Date.now()` până când se mai poate lucra. */
  pana: number
  mesaj: string
  asteapta: Asteptare | null
  conversatieId: string
  log: Logger
  spune: (etapa: string) => Promise<void>
  /** Scrie propunerea Da/Nu; întoarce id-ul și rezumatul ei. */
  propune: (p: { actiune: string; argumente: unknown; rezumat: string }) => Promise<{ id: string; rezumat: string }>
  /** Previzualizarea unei acțiuni de SCRIERE (ea are rezumatul ei, scris de aplicație). */
  previzualizeaza: (actiune: string, argumente: unknown) => Promise<{ ok: true; rezumat: string } | { ok: false; mesaj: string }>
  /** Efectul unei acțiuni, din manifest: `scrie` se propune, restul se execută. */
  efectul: (actiune: string) => string | undefined
}

/** Butoanele nivelului 1: subiectele cuprinsului. Textul trimis e chiar id-ul — îl știe potrivitorul. */
const butoaneleSubiectelor = (cuprins: RaspunsPotrivitor['cuprins'], doar?: string[]): OptiuneBula[] =>
  cuprins
    .filter((s) => !doar || doar.includes(s.id))
    .map((s) => ({ eticheta: s.nume, text: s.id }))

/** Butoanele nivelului 2: acțiunile subiectului. „s1 titlu" se potrivește determinist înapoi. */
const butoaneleActiunilor = (
  s: RaspunsPotrivitor['cuprins'][number],
  doar?: string[],
): OptiuneBula[] =>
  s.actiuni
    .filter((a) => !a.ascunsa && (!doar || doar.includes(a.id)))
    .map((a) => ({ eticheta: a.nume, text: `${s.id} ${a.id}` }))

const gol = (): Omit<RezultatHarta, 'text' | 'drum'> => ({
  optiuni: [],
  propunere: null,
  asteapta: null,
  unelte: [],
  apeluri: [],
})

/**
 * UN MESAJ, DUS PÂNĂ LA CAPĂT PE HARTĂ.
 *
 * Ordinea, și de ce fiecare treaptă e acolo:
 *   1. potrivitorul DETERMINIST al aplicației — el rezolvă drumul de toate zilele, fără niciun ban;
 *   2. modelul, NIVEL 1 (subiectul) — doar dacă potrivitorul n-a fost sigur;
 *   3. modelul, NIVEL 2 (acțiunea subiectului ales);
 *   4. confirmarea (Da/Nu, cu interpretarea scrisă) sau execuția, prin acțiunile EXISTENTE.
 */
export async function peHarta(o: PorniHarta): Promise<RezultatHarta> {
  const cere = (argumente: unknown) =>
    cereActiune<RaspunsPotrivitor>(o.fetcher, o.harta.potrivitor, argumente, o.actor, {
      secret: o.secret,
      correlationId: o.cid,
      prin: 'chat',
    })

  const dintai = await cere({ mesaj: o.mesaj, ...(o.asteapta ? { asteapta: o.asteapta } : {}) })
  if (!dintai.ok) {
    o.log.warn('potrivitorul hartii n-a raspuns', { aplicatie: o.aplicatie, cod: dintai.cod })
    return {
      ...gol(),
      text: 'Nu ajung acum la buletin ca să văd unde am rămas. Mai încearcă peste puțin.',
      drum: 'necunoscut',
    }
  }
  const citit = RaspunsPotrivitor.safeParse(dintai.date)
  if (!citit.success) {
    o.log.warn('potrivitorul hartii a raspuns altceva', { aplicatie: o.aplicatie })
    return { ...gol(), text: 'Nu am înțeles ce mi-a răspuns buletinul. Mai încearcă o dată.', drum: 'necunoscut' }
  }
  const h = citit.data

  // 1 ------------------------------------------------------------ determinist
  const p = h.potrivire
  if (p?.nivel === 'meniu') return meniul(h, o)
  if (p?.nivel === 'valoare' && p.subiect && p.actiune) return cerValoarea(h, p.subiect, p.actiune, p.articol)
  if (p?.nivel === 'nesigur') return butoane(h, p, 'determinist')
  if (p?.nivel === 'sigur' && h.fapta) return await duLaCapat(o, h, h.fapta, 'determinist')

  // 2 ------------------------------------------------------- modelul, nivel 1
  if (o.creier === 'fara' || Date.now() >= o.pana) return nuInteleg(h)
  await o.spune('caut subiectul…')
  const n1 = await clasifica(o, promptNivel1({
    despre: o.harta.despre,
    cuprins: h.cuprins,
    intrebare: h.intrebare,
    indrumari: o.indrumari,
    mesaj: o.mesaj,
  }), Nivel1)

  /*
   * ⚠️ JSON STRICAT ≠ „NU ÎNȚELEG". Când modelul n-a răspuns citibil, vina nu e a omului: i se arată
   * cuprinsul, dar drumul se însemnează `nesigur`, nu `necunoscut`. Altfel cifra cu care se
   * cântărește „pot lucra fără AI?" ar da vina pe mesaje bune pentru un model care s-a bâlbâit.
   */
  if (!n1) return { ...nuInteleg(h), text: 'Nu sunt sigur despre ce e vorba. Alege tu:', drum: 'nesigur' }
  if (n1.subiect === 'necunoscut') return nuInteleg(h)
  if (n1.subiect === 'nesigur') {
    const intre = (n1.intre ?? []).filter((id) => h.cuprins.some((s) => s.id === id))
    if (intre.length < 2) return nuInteleg(h)
    return {
      ...gol(),
      text: `Nu sunt sigur despre ce e vorba. E vorba de ${numele(h, intre).join(' sau de ')}?`,
      optiuni: butoaneleSubiectelor(h.cuprins, intre),
      drum: 'nesigur',
    }
  }
  const subiect = h.cuprins.find((s) => s.id === n1.subiect)
  if (!subiect) return nuInteleg(h)

  // un subiect cu o singură acțiune de oferit nu mai are ce întreba la nivelul 2
  const deOferit = subiect.actiuni.filter((a) => !a.ascunsa)
  if (deOferit.length === 1) {
    return await hotaraste(o, h, { subiect: subiect.id, actiune: deOferit[0]!.id }, 'model-n1')
  }

  // 3 ------------------------------------------------------- modelul, nivel 2
  if (Date.now() >= o.pana) return butoane(h, { ce: 'actiune', subiect: subiect.id, intre: [] }, 'nesigur')
  await o.spune('caut ce am de făcut…')
  const n2 = await clasifica(o, promptNivel2({
    subiect,
    intrebare: h.intrebare,
    indrumari: o.indrumari,
    mesaj: o.mesaj,
  }), Nivel2)

  const aleasa = n2 && n2.actiune !== 'nu_pot_alege' ? deOferit.find((a) => a.id === n2.actiune) : undefined
  if (!n2 || !aleasa || n2.sigur === false) {
    return {
      ...gol(),
      text: aleasa
        ? `Nu sunt sigur ce vrei să fac cu ${subiect.nume.toLowerCase()}. Alege:`
        : `Știu că e vorba de ${subiect.nume.toLowerCase()}, dar nu știu ce să fac. Alege:`,
      optiuni: butoaneleActiunilor(subiect),
      drum: 'nesigur',
    }
  }
  return await hotaraste(
    o,
    h,
    {
      subiect: subiect.id,
      actiune: aleasa.id,
      ...(n2.valoare ? { valoare: n2.valoare } : {}),
      ...(n2.articol ? { articol: n2.articol } : {}),
    },
    'model-n2',
  )
}

/** O clasificare: un apel de model, fără unelte, cu JSON strict. `null` = n-a ieșit nimic citibil. */
async function clasifica<T extends z.ZodType>(o: PorniHarta, prompt: string, forma: T): Promise<z.infer<T> | null> {
  const mesaje: MesajModel[] = [
    { rol: 'sistem', text: prompt },
    // ⚠️ Un mesaj al omului TREBUIE să deschidă discuția (așa cere API-ul Anthropic), iar conținutul
    // adevărat stă deja în prompt: aici e doar apăsarea pe declanșator.
    { rol: 'om', text: 'Alege acum și răspunde cu JSON-ul.' },
  ]
  if (o.creier === 'fara') return null
  const r = await intreabaModelul(o.env, mesaje, [], o.creier, {
    model: o.model,
    pana: o.pana,
    faraApeluri: true,
  })
  if (r.expirat) return null
  const brut = jsonulDin(r.text)
  if (brut === null) {
    // ⚠️ JSON STRICAT = „nesigur", nu eroare. Omul primește butoane, nu o plângere despre JSON.
    o.log.warn('clasificare fara JSON', { aplicatie: o.aplicatie, text: (r.text ?? '').slice(0, 120) })
    return null
  }
  const citit = forma.safeParse(brut)
  if (!citit.success) {
    o.log.warn('clasificare cu JSON nepotrivit', { aplicatie: o.aplicatie })
    return null
  }
  return citit.data
}

/** Numele omenești ale unor subiecte. */
const numele = (h: RaspunsPotrivitor, ids: string[]): string[] =>
  ids.map((id) => h.cuprins.find((s) => s.id === id)?.nume.toLowerCase() ?? id)

/** „Nu înțeleg despre ce e vorba" — cu cuprinsul, ca omul să vadă ce SE poate. */
function nuInteleg(h: RaspunsPotrivitor): RezultatHarta {
  return {
    ...gol(),
    text: 'Nu înțeleg despre ce e vorba. Aici pot lucra la:',
    optiuni: butoaneleSubiectelor(h.cuprins),
    drum: 'necunoscut',
  }
}

/** Cuprinsul, cerut anume („meniu", „?"). */
function meniul(h: RaspunsPotrivitor, o: PorniHarta): RezultatHarta {
  const dupa = h.intrebare ? `\n\nAcum te întrebam: „${h.intrebare.text}"` : ''
  return {
    ...gol(),
    text: `Iată ce pot face la ${o.harta.despre ?? 'lucrarea asta'}. Alege un subiect:${dupa}`,
    optiuni: butoaneleSubiectelor(h.cuprins),
    drum: 'determinist',
  }
}

/** Drumul înapoi de la treapta a doua: trimite „meniu", pe care potrivitorul îl știe deja. */
const INAPOI: OptiuneBula = { eticheta: '← Înapoi la meniu', text: 'meniu' }

/** Butoanele, la nivelul 1 (subiecte) sau la nivelul 2 (acțiunile unui subiect). */
function butoane(
  h: RaspunsPotrivitor,
  p: {
    ce?: 'subiect' | 'actiune'
    subiect?: string
    intre?: Array<{ id: string; nume: string }>
    dinMeniu?: boolean
  },
  drum: Drum,
): RezultatHarta {
  if (p.ce === 'actiune' && p.subiect) {
    const s = h.cuprins.find((x) => x.id === p.subiect)
    if (!s) return nuInteleg(h)
    /*
     * ⚠️ TREI VORBE DEOSEBITE, fiindcă sunt trei lucruri deosebite:
     *   - „Articolul principal. Ce vrei să faci?" — omul a apăsat un buton al MENIULUI (`dinMeniu`):
     *     asta nu e o nedumerire a chatului, e pagina a doua a cuprinsului, deci sună a meniu și
     *     poartă și drumul înapoi (user, 19.09.2026: a cerut meniul crezând că nu există, fiindcă
     *     treapta asta îi suna a eroare și n-avea cale de întoarcere);
     *   - „nu știu CE SĂ FAC cu motto-ul" — n-am nimerit nicio acțiune, se arată toate;
     *   - „nu știu CE VREI la motto" — am nimerit două și nu pot alege, se arată doar acelea.
     */
    const cate = s.actiuni.filter((a) => !a.ascunsa).length
    const ids = (p.intre ?? []).map((x) => x.id)
    const doar = ids.length > 1 && ids.length < cate ? ids : undefined
    const text = p.dinMeniu
      ? `${s.nume}. Ce vrei să faci?`
      : doar
        ? `Nu știu ce vrei la ${s.nume.toLowerCase()}. Alege:`
        : `Nu știu ce să fac cu ${s.nume.toLowerCase()}. Alege:`
    return {
      ...gol(),
      text,
      // ⚠️ „Înapoi" se adaugă DUPĂ filtrul `ascunsa`: el nu e o acțiune a hărții, e ieșirea din meniu.
      optiuni: p.dinMeniu ? [...butoaneleActiunilor(s, doar), INAPOI] : butoaneleActiunilor(s, doar),
      drum,
    }
  }
  const ids = (p.intre ?? []).map((x) => x.id)
  if (ids.length < 2) return nuInteleg(h)
  return {
    ...gol(),
    text: `E vorba de ${numele(h, ids).join(' sau de ')}?`,
    optiuni: butoaneleSubiectelor(h.cuprins, ids),
    drum,
  }
}

/** „Știu ce vrei, dar nu cu ce": se cere valoarea și se ține minte ce se așteaptă. */
function cerValoarea(
  h: RaspunsPotrivitor,
  subiect: string,
  actiune: string,
  articol?: string,
): RezultatHarta {
  const s = h.cuprins.find((x) => x.id === subiect)
  const a = s?.actiuni.find((x) => x.id === actiune)
  return {
    ...gol(),
    text: `${a ? `${a.nume[0]!.toUpperCase()}${a.nume.slice(1)}` : actiune} la ${s?.nume.toLowerCase() ?? subiect}: scrie-l acum, ` +
      'literă cu literă. (Sau scrie „nu" ca să lăsăm.)',
    asteapta: { subiect, actiune, ...(articol ? { articol } : {}) },
    drum: 'determinist',
  }
}

/** O alegere venită de la model: se cere aplicației traducerea, apoi se duce la capăt. */
async function hotaraste(
  o: PorniHarta,
  h: RaspunsPotrivitor,
  alegere: { subiect: string; actiune: string; valoare?: string; articol?: string },
  drum: Drum,
): Promise<RezultatHarta> {
  const r = await cereActiune<RaspunsPotrivitor>(o.fetcher, o.harta.potrivitor, { alegere }, o.actor, {
    secret: o.secret,
    correlationId: o.cid,
    prin: 'chat',
  })
  const citit = r.ok ? RaspunsPotrivitor.safeParse(r.date) : null
  const fapta = citit?.success ? citit.data.fapta : null
  if (!fapta) {
    // Modelul a ales o acțiune care nu se poate traduce (îi lipsește valoarea, ori n-are rost aici).
    const s = h.cuprins.find((x) => x.id === alegere.subiect)
    if (s) {
      const a = s.actiuni.find((x) => x.id === alegere.actiune)
      if (a && a.cere === 'text') {
        return cerValoarea(citit?.success ? citit.data : h, s.id, a.id, alegere.articol)
      }
    }
    return { ...gol(), text: 'Nu am putut duce asta la capăt. Spune-mi altfel?', drum: 'nesigur' }
  }
  return await duLaCapat(o, citit?.success ? citit.data : h, fapta, drum)
}

/**
 * CONFIRMAREA SAU EXECUȚIA — capătul drumului.
 *
 * ⚠️ REGULA CONFIRMĂRII (hotărâtă pe 19.09.2026): butonul Da/Nu se cere la orice instrucțiune dată
 * LIBER de om, cu interpretarea scrisă negru pe alb („Titlul secundarului 1 → „X""). NU se cere când
 * omul răspunde la întrebarea pe care chatul tocmai i-a pus-o (subiectul și acțiunea sunt date de
 * întrebare, el dă doar valoarea) și nici la citiri. Cine hotărăște e harta aplicației (`confirma`),
 * nu codul de aici — aici doar se face ce scrie în ea.
 */
async function duLaCapat(o: PorniHarta, h: RaspunsPotrivitor, fapta: Fapta, drum: Drum): Promise<RezultatHarta> {
  // acțiune care nu se face de aici: se spune unde se face, și atât
  if (!fapta.apel) {
    return { ...gol(), text: fapta.raspuns ?? fapta.rezumat, drum }
  }

  const efect = o.efectul(fapta.apel.actiune)

  // ---------------------------------------------------------- confirmarea
  if (fapta.confirma) {
    /*
     * ⚠️ O ACȚIUNE DE SCRIERE ÎȘI ARE REZUMATUL EI, scris de aplicație la previzualizare („Compun
     * buletinul nr. 620 din duminică…"): acela se pune pe buton, fiindcă spune numărul adevărat, luat
     * din arhivă. Pentru restul (ciornă, citire amânată) purtăm rezumatul hărții — el e interpretarea
     * cerută de om, scrisă negru pe alb.
     */
    let rezumat = fapta.rezumat
    if (efect === 'scrie') {
      await o.spune('pregătesc propunerea…')
      const prev = await o.previzualizeaza(fapta.apel.actiune, fapta.apel.argumente)
      if (!prev.ok) return { ...gol(), text: `Nu se poate: ${prev.mesaj}`, drum }
      rezumat = prev.rezumat
    }
    const p = await o.propune({ actiune: fapta.apel.actiune, argumente: fapta.apel.argumente, rezumat })
    return {
      ...gol(),
      text: `${rezumat}\nConfirmi?`,
      propunere: p,
      drum,
    }
  }

  // ---------------------------------------------------------- execuția
  await o.spune(`lucrez… (${fapta.apel.actiune})`)
  const rez = await cereActiune(o.fetcher, fapta.apel.actiune, fapta.apel.argumente, o.actor, {
    secret: o.secret,
    correlationId: o.cid,
    prin: 'chat',
  })
  const apeluri = [{ nume: fapta.apel.actiune, argumente: fapta.apel.argumente, rezultat: rez.ok ? 'ok' : rez.cod }]
  if (!rez.ok) {
    return { ...gol(), text: `Nu a mers: ${rez.mesaj}`, unelte: [fapta.apel.actiune], apeluri, drum }
  }

  /*
   * CE SE CITEȘTE OMULUI: ce a spus aplicația că a făcut, apoi întrebarea următoare. Rezumatul
   * hărții rămâne plasa de siguranță — la o acțiune care doar reia chestionarul („unde am rămas"),
   * un „Reiau chestionarul" pus înaintea întrebării n-ar fi decât un rând de prisos.
   */
  const { spus, intrebare } = ceSeSpuneDin(rez.date)
  const randuri: string[] = []
  if (spus) randuri.push(spus)
  if (intrebare) randuri.push(intrebare)
  if (!randuri.length) randuri.push(fapta.rezumat)
  return {
    ...gol(),
    text: randuri.filter(Boolean).join('\n\n'),
    unelte: [fapta.apel.actiune],
    apeluri,
    drum,
  }
}

/** Numele uneltei, ca în restul chat-workerului — pentru căutarea efectului în manifest. */
export { numeUnealta }
export type { SubiectHarta }
