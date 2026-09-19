/**
 * CHAT-WORKER — creierul modulului de chat.
 *
 * Serviciu intern: nu are adresă publică și nu vorbește niciodată direct cu browserul. Aplicația
 * în care stă bula primește mesajul pe originea ei (deci cu sesiunea și CSRF-ul ei) și îl trece
 * mai departe prin Service Binding.
 *
 * Ce face: ține discuția (D1), adună listele de acțiuni ale aplicațiilor, întreabă modelul, execută
 * acțiunile de CITIRE și se oprește la cele care SCHIMBĂ ceva — acelea devin propuneri pe care
 * le confirmă omul.
 *
 * Ce NU face: nu ține cunoștințe despre parohie (le cere), nu ocolește drepturile (acțiunile trec
 * prin autorizarea centrală, cu principalul omului), nu trimite nimic pe email singur.
 */
import {
  ANTET_ACTOR,
  ANTET_SECRET,
  cereActiune,
  manifestulLui,
  previzualizeaza,
  numeUnealta,
  unelteDinManifest,
  type Actor,
  type Efect,
  type Manifest,
  type UnealtaDescrisa,
} from '@xc/actiuni'
import { Obiect } from '@xc/contracts'
import { aziBucuresti, ZILE_SAPTAMANA, ziuaSaptamanii } from '@xc/ui'
import { egaleInTimpConstant } from '@xc/auth'
import { Logger, correlationId } from '@xc/observability'
import { TAIERE_MESAJ_OM, configAplicatie, configChat, type ConfigAplicatie, type ConfigChat } from '@xc/chat'
import { intreabaModelul, instructiuni, type EnvCreier, type MesajModel } from './creier.js'
import {
  citesteStatistica,
  cheiaStatisticii,
  noteazaDrumul,
  peHarta,
  statisticaGoala,
  type Asteptare,
  type OptiuneBula,
} from './harta.js'
import {
  conversatia,
  conversatiaDe,
  inchidePropunerea,
  lucrulDin,
  mesajeleDin,
  propunereaDe,
  scrieLucrul,
  scrieMesaj,
  scriePropunere,
  starilePropunerilor,
  stergeConversatia,
  type MesajScris,
  type Propunere,
} from './depozit.js'

export interface Env extends EnvCreier {
  DB: D1Database
  /** Aplicațiile ale căror acțiuni sunt de față. Se adaugă pe măsură ce se portează. */
  PROGRAM?: Fetcher
  CALENDAR?: Fetcher
  TIPIC?: Fetcher
  /** Buletinul, din 18.09.2026: bula lui de pe `/nou` compune foaia tiparita. */
  BULETIN?: Fetcher
  AUDIT?: Fetcher
  SECRET_INTERN?: string
  /** Comutatoarele modulelor: de aici afla si cu ce creier raspunde (sau daca raspunde fara unul). */
  CONFIG?: KVNamespace
  MEDIU: string
}

const SERVICIU = 'chat-worker'

/** Ziua de azi, la Bucuresti, scrisa si in cifre si in cuvinte — modelul are nevoie de amandoua. */
function ziuaDeAzi(): { data: string; zi: string } {
  return { data: aziBucuresti(), zi: ZILE_SAPTAMANA[ziuaSaptamanii(aziBucuresti())] ?? '' }
}
/** Câte ocoluri model → unealtă → model într-un singur mesaj. Peste asta, se oprește și spune. */
const PASI_MAXIM = 3
/** Cât din răspunsul unei acțiuni intră în context. Un an de program n-are ce căuta acolo. */
const TAIERE_REZULTAT = 2500

/**
 * De la câte semne un argument de unealtă se ÎNSEMNEAZĂ ca fiind lung (19.09.2026).
 *
 * Nu e o limită și nu respinge nimic — e un semn lăsat în date. Când un model mic scrie mii de semne
 * ca argument, el rescrie ceva ce omul a dat deja; asta ține minute și se poate opri la mijloc. Cifra
 * din `apeluri` arată unde lipsește un cârlig al aplicației (`laText`, `laFisier`).
 */
const PRAG_ARGUMENT_LUNG = 3000

/**
 * BUGETUL DE TIMP AL UNUI MESAJ (18.09.2026).
 *
 * Un mesaj măsurat pe viu a ținut 2 min 49 s: trei ocoluri model → unealtă → model, plus apelul
 * final „fără unelte", plus reîncercarea cu buget dublat a Workers AI — până la șase apeluri de
 * model. Omul nu așteaptă atât fără să creadă că s-a rupt ceva.
 *
 * Deci bucla are un CEAS, nu doar o numărătoare de pași: când s-a scurs bugetul, se oprește și
 * spune ce a apucat. Nu e un plafon de calitate, e unul de răbdare — modelul mic mai bine răspunde
 * scurt decât perfect peste trei minute.
 */
const BUGET_MS = 90_000

/*
 * Cât se ia din mesajul omului: `TAIERE_MESAJ_OM`, din `@xc/chat`. Era 2000 — destul pentru o
 * întrebare, PREA PUȚIN pentru munca de la buletin: articolul de pe pagina întâi are vreo 9000 de
 * semne, iar cine îl lipea în bulă vedea cum se taie la mijloc, fără niciun semn. 12000 acoperă
 * articolul cu tot cu titlu și autor (user, 18.09.2026).
 *
 * ⚠️ Cifra stă în `@xc/chat` fiindcă o știu DOUĂ locuri: aici, la scrierea mesajului, și ruta de
 * urcare a fișierelor, care spune în card dacă textul s-a tăiat. Scrisă în amândouă, s-ar fi depărtat.
 */

/** Cand `creier` e `fara`: interfata merge intreaga, dar nimeni nu intreaba niciun model. */
const FARA_CREIER =
  'Deocamdată sunt doar interfața: nu sunt legat la niciun model, deci nu pot răspunde la ' +
  'întrebări. Se aprinde din panoul de administrare, la Module.'

function json(date: unknown, status = 200): Response {
  return new Response(JSON.stringify(date), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/**
 * CE APLICAȚII VEDE BULA FIECĂREI APLICAȚII (18.09.2026).
 *
 * Pana atunci lista era una singura pentru toata platforma: orice bula vedea uneltele TUTUROR
 * aplicatiilor legate, si primea in instructiuni cunostintele de fundal ale tuturor. Cu o singura
 * aplicatie care avea bula (programul) nu se vedea. Cand s-a adaugat si buletinul (bula de pe
 * `/nou`), s-ar fi intamplat doua lucruri deodata, amandoua nedorite: bula programului ar fi capatat
 * uneltele buletinului, iar **regulile si masurile buletinului ar fi intrat in fiecare mesaj al
 * programului** — context platit la fiecare apasare, despre o treaba care nu e a lui.
 *
 * Deci fiecare bula vede numai ce-i trebuie. Programul isi pastreaza calendarul si tipicul (de acolo
 * isi ia numele zilelor si randuiala); buletinul n-are nevoie de ele — calendarul paginii a patra il
 * cere `buletin.compune` singur, pe dinauntru, de la program.
 *
 * ⚠️ O aplicatie care nu e in tabel vede tot (cum era pana acum): un chat montat maine nu trebuie sa
 * ramana mut pana isi scrie cineva randul aici.
 */
export const CE_VEDE_BULA: Record<string, readonly string[]> = {
  program: ['program', 'calendar', 'tipic'],
  // ⚠️ Buletinul vede ȘI calendarul (18.09.2026): foaia se scrie despre sfântul zilei, iar pomenirea
  // lui se caută în calendar. Fără el, bula buletinului n-avea de unde ști cine se prăznuiește
  // duminica ce vine — și un model mic, întrebat fără unealtă, ghicește.
  buletin: ['buletin', 'calendar'],
}

/** Exportata pentru probe: regula de mai sus se strica in tacere (un chat mut nu da nicio eroare). */
export function aplicatiileLegate(env: Env, pentruAplicatia?: string): Array<{ nume: string; fetcher: Fetcher }> {
  const toate: Array<[string, Fetcher | undefined]> = [
    ['program', env.PROGRAM],
    ['calendar', env.CALENDAR],
    ['tipic', env.TIPIC],
    ['buletin', env.BULETIN],
  ]
  const ingaduite = pentruAplicatia ? CE_VEDE_BULA[pentruAplicatia] : undefined
  return toate
    .filter((p): p is [string, Fetcher] => Boolean(p[1]))
    .filter(([nume]) => !ingaduite || ingaduite.includes(nume))
    .map(([nume, fetcher]) => ({ nume, fetcher }))
}

interface UndeStaActiunea {
  /** Numele canonic, cu punct: cu el se cere actiunea si cu el intra in audit. */
  nume: string
  aplicatie: string
  fetcher: Fetcher
  /**
   * ⚠️ Tipul vine din `@xc/actiuni` (`Efect`), nu scris de mână cu două variante: lista efectelor
   * crește (`ciorna`, din 18.09.2026 — scriere într-o ciornă a aplicației, fără Da/Nu), iar
   * chat-worker trebuie să compileze și înainte, și după ce se adaugă unul.
   *
   * Regula de purtare de aici e scrisă pe DOS: se oprește și se propune NUMAI la `scrie`; orice
   * alt efect se execută pe loc, ca o citire. Așa un efect nou nu rămâne blocat până își amintește
   * cineva să-i scrie rândul aici.
   */
  efect: Efect
  descriere: string
  /** Ce se propune dupa ce s-a facut (vezi `Actiune.urmare`). */
  urmare: { actiune: string; argumente: Record<string, string> } | null
}

/**
 * Listele tuturor aplicațiilor, puse cap la cap. O aplicație care tace nu oprește chatul: se
 * lucrează cu ce răspunde (manifestele sunt ținute un minut în memoria izolatului).
 */
/**
 * Cunoștințele de fundal, ținute o oră în memoria izolatului: se plătesc la fiecare mesaj (intră
 * în context), deci nu se recalculează la fiecare mesaj. Tiparele programului nu se schimbă de
 * pe o replică pe alta.
 */
const FUNDAL = new Map<string, { la: number; text: string }>()
const VIATA_FUNDAL = 60 * 60_000
/** Cât din rezultatul unei acțiuni de fundal intră în context. Mai mult de atât e semn că nu e „fundal". */
const TAIERE_FUNDAL = 8000

async function adunaUneltele(
  env: Env,
  o: {
    secret: string
    correlationId: string
    permise: string[]
    pentruAplicatia?: string
    /** Fără cunoștințele de fundal: ecranul de Setări vrea doar NUMELE uneltelor, nu și ce știu ele. */
    faraFundal?: boolean
  },
): Promise<{ unelte: UnealtaDescrisa[]; harta: Map<string, UndeStaActiunea>; fundal: string[] }> {
  // Lista din panou ingusteaza ce vede modelul; goala = tot ce publica aplicatiile.
  const permis = (nume: string) => !o.permise.length || o.permise.includes(nume)
  const harta = new Map<string, UndeStaActiunea>()
  const unelte: UnealtaDescrisa[] = []
  const fundal: string[] = []
  const deAdus: Array<Promise<void>> = []

  const manifeste = await Promise.all(
    // ⚠️ Numai aplicatiile pe care le vede bula CARE A INTREBAT (`CE_VEDE_BULA`): altfel fundalul
    // unei aplicatii s-ar plati in mesajele alteia.
    aplicatiileLegate(env, o.pentruAplicatia).map(async (a) => ({
      a,
      m: await manifestulLui(a.fetcher, a.nume, { secret: o.secret, correlationId: o.correlationId, prin: 'chat' }),
    })),
  )

  for (const { a, m } of manifeste) {
    if (!m) continue
    for (const descriere of (m as Manifest).actiuni) {
      // ⚠️ `ascunsa` iese și de aici, nu doar din lista trimisă modelului: altfel potrivitorul hărții
      // ar apărea ca o bifă în Setări → „Chat AI", ca și cum ar fi o unealtă de ales.
      if (descriere.fundal || descriere.ascunsa || !permis(descriere.nume)) continue
      harta.set(numeUnealta(descriere.nume), {
        nume: descriere.nume,
        aplicatie: a.nume,
        fetcher: a.fetcher,
        efect: descriere.efect,
        descriere: descriere.descriere,
        urmare: descriere.urmare ?? null,
      })
    }
    unelte.push(...unelteDinManifest({ ...(m as Manifest), actiuni: (m as Manifest).actiuni.filter((a) => permis(a.nume)) }))

    // Fundalul: actiunile marcate asa se cheama ACUM, ca serviciu, si rezultatul lor intra in
    // instructiuni. Cine tace nu opreste nimic — se raspunde cu ce e.
    for (const descriere of (m as Manifest).actiuni) {
      if (!descriere.fundal || o.faraFundal) continue
      const cheie = `${a.nume}:${descriere.nume}`
      const tinut = FUNDAL.get(cheie)
      if (tinut && Date.now() - tinut.la < VIATA_FUNDAL) {
        fundal.push(tinut.text)
        continue
      }
      deAdus.push(
        cereActiune(a.fetcher, descriere.nume, {}, { fel: 'serviciu', nume: 'chat' }, {
          secret: o.secret,
          correlationId: o.correlationId,
          prin: 'chat',
        }).then((r) => {
          if (!r.ok) return
          // O actiune de fundal care isi scrie singura `text` stie mai bine decat noi cum se citeste.
          const corp = (r.date as { text?: unknown })?.text
          const scris = typeof corp === 'string' ? corp : JSON.stringify(r.date)
          const text = `${descriere.nume} — ${descriere.descriere}\n${scris.slice(0, TAIERE_FUNDAL)}`
          FUNDAL.set(cheie, { la: Date.now(), text })
          fundal.push(text)
        }),
      )
    }
  }
  await Promise.all(deAdus)
  return { unelte, harta, fundal }
}

/** Ce se scrie modelului despre ce a întors o acțiune. Hârtia nu se descrie, se anunță. */
function rezumaRezultat(date: unknown): { text: string; obiect: Obiect | null } {
  const eObiect = Obiect.safeParse(date)
  if (eObiect.success) {
    const o = eObiect.data
    return {
      text: `Hârtia „${o.titlu}" e gata (${o.fel.toUpperCase()}, ${Math.round(o.octeti / 1024)} KB). Omul o vede ca pe un card sub răspuns.`,
      obiect: o,
    }
  }
  const text = JSON.stringify(date)
  return {
    text: text.length > TAIERE_REZULTAT ? `${text.slice(0, TAIERE_REZULTAT)}… (tăiat)` : text,
    obiect: null,
  }
}

interface RaspunsChat {
  conversatieId: string
  text: string
  obiecte: Obiect[]
  propunere: { id: string; rezumat: string } | null
  /**
   * BUTOANELE DE ALES (19.09.2026, fluxul pe hartă): „e vorba de X sau de Y?", „nu știu ce să fac cu
   * X: [acțiunile]". Apăsarea trimite `text` ca mesaj obișnuit — de aceea meniul E drumul fără AI.
   */
  optiuni?: OptiuneBula[]
  /** Uneltele chemate pentru raspunsul asta, in ordine. Pentru probe si pentru curiosi. */
  unelte: string[]
  /**
   * O propunere care A FOST, dar nu se mai poate apăsa (a expirat ori s-a răspuns la ea). Se trimite
   * la refacerea firului din istoric, ca bula să spună „a expirat, cere din nou" în loc să deseneze
   * butoane moarte.
   */
  propunereTrecuta?: { rezumat: string; stare: Propunere['stare'] }
}

/**
 * Răspunsul, refăcut din rândul lui din bază. Îl folosesc sondarea (`/stare`) și paza de lucru
 * dublat: după ce mesajul agentului e scris, el ESTE răspunsul — nu se mai cheamă nimic.
 */
function raspunsulDin(
  m: MesajScris,
  conversatieId: string,
  stari?: Map<string, Propunere['stare']>,
): RaspunsChat {
  let d: {
    obiecte?: Obiect[]
    propunere?: { id: string; rezumat: string } | null
    optiuni?: OptiuneBula[]
    apeluri?: Array<{ nume?: unknown }>
    harta?: { drum?: string; asteapta?: Asteptare | null }
  } = {}
  try {
    d = JSON.parse(m.date_json || '{}') as typeof d
  } catch {
    d = {}
  }
  const p = d.propunere ?? null
  const stare = p ? (stari?.get(p.id) ?? 'asteapta') : 'asteapta'
  return {
    conversatieId,
    text: m.text,
    obiecte: Array.isArray(d.obiecte) ? d.obiecte : [],
    propunere: p && stare === 'asteapta' ? p : null,
    ...(Array.isArray(d.optiuni) && d.optiuni.length ? { optiuni: d.optiuni } : {}),
    /*
     * ⚠️ UNELTELE SE SCOT DIN `apeluri`, nu se lasă goale (18.09.2026). Răspunsul venit prin sondare
     * trece pe aici, iar bula dă mai departe `unelte` paginii de dedesubt: ecranul „buletin nou" își
     * reface blocul schiței numai când vede `buletin.raspunde` acolo. Cu lista goală, drumul asincron
     * — adică singurul de azi — n-ar fi împrospătat niciodată nimic, și fără nicio eroare.
     */
    unelte: Array.isArray(d.apeluri)
      ? d.apeluri.map((a) => String(a?.nume ?? '')).filter(Boolean)
      : [],
    ...(p && stare !== 'asteapta' ? { propunereTrecuta: { rezumat: p.rezumat, stare } } : {}),
  }
}

/**
 * CE VALOARE AȘTEPTAM — scrisă lângă răspunsul dinainte (fluxul pe hartă).
 *
 * ⚠️ Fără ea, drumul fără AI s-ar rupe la ultimul pas: omul apasă „titlul" pe un buton de nivel 2,
 * chatul îl întreabă „Ce titlu pui la secundarul 1?", iar răspunsul lui („DESPRE POST") n-ar mai avea
 * niciun subiect — ar cădea în „nu înțeleg". Se ține în `date_json` al mesajului agentului, rând care
 * există oricum: nici coloană nouă, nici tabel nou.
 */
function asteptareaDin(dateJson: string | null | undefined): Asteptare | null {
  try {
    const d = JSON.parse(dateJson || '{}') as { harta?: { asteapta?: Asteptare | null } }
    const a = d.harta?.asteapta
    return a && typeof a.subiect === 'string' && typeof a.actiune === 'string' ? a : null
  } catch {
    return null
  }
}

async function poarta(req: Request, env: Env): Promise<{ actor: Actor; cid: string } | Response> {
  const secret = env.SECRET_INTERN
  const primit = req.headers.get(ANTET_SECRET)
  if (!secret || !primit || !egaleInTimpConstant(primit, secret)) {
    return new Response('Not Found', { status: 404 })
  }
  const brut = req.headers.get(ANTET_ACTOR)
  if (!brut) return json({ ok: false, mesaj: 'lipsește cine scrie' }, 400)
  try {
    const actor = JSON.parse(brut) as Actor
    if (actor.fel !== 'utilizator' || !actor.principal?.userId) {
      return json({ ok: false, mesaj: 'chatul e al unei persoane, nu al unui serviciu' }, 403)
    }
    return { actor, cid: req.headers.get('x-correlation-id') ?? crypto.randomUUID() }
  } catch {
    return json({ ok: false, mesaj: 'nu se înțelege cine scrie' }, 400)
  }
}

/**
 * LUCRUL LA UN MESAJ — de la instrucțiuni până la răspunsul scris în bază.
 *
 * Stă într-o funcție a lui, nu în rută, fiindcă se cheamă din două locuri: `/mesaj` (drumul de
 * odinioară, care așteaptă răspunsul) și `/lucreaza` (drumul de-acum: bula a primit deja
 * `{inLucru:true}` și sondează, iar asta se învârte în `waitUntil` al aplicației).
 *
 * Mesajul omului e DEJA scris în discuție când intrăm aici — de aceea istoricul e destul și nu se
 * mai dă textul separat.
 */
async function lucreaza(
  env: Env,
  o: {
    actor: Actor
    cid: string
    secret: string
    aplicatie: string
    numeleOmului: string | null
    conversatieId: string
    /** Mesajul omului: lângă el se scrie etapa („caut în program…"), ca s-o vadă sondarea. */
    mesajId: string | null
    log: Logger
  },
): Promise<RaspunsChat> {
  const pornit = Date.now()
  const pana = pornit + BUGET_MS
  const deLa = new Date(pornit).toISOString()
  /** Ce face acum, pentru omul care se uită la „scrie…". O scriere mică în D1, nu ține nimic pe loc. */
  const spune = async (etapa: string) => {
    if (!o.mesajId) return
    await scrieLucrul(env.DB, o.mesajId, { etapa, de_la: deLa }).catch(() => undefined)
  }

  // ⚠️ Deodată, nu una după alta (18.09.2026): comutatorul, rândul aplicației și istoricul nu
  // depind unul de altul, iar înșirate pe rând adăugau sute de milisecunde înainte de primul
  // apel de model — la fiecare mesaj.
  const [comutator, aleAplicatiei, istoric] = await Promise.all([
    configChat(env) as Promise<ConfigChat>,
    configAplicatie(env, o.aplicatie) as Promise<ConfigAplicatie>,
    mesajeleDin(env.DB, o.conversatieId),
  ])

  // PAZA DE LUCRU DUBLAT: dacă după mesajul omului există deja un răspuns al agentului, treaba s-a
  // făcut (o cerere repetată, o sondare care a pornit de două ori). Nu se mai cheamă modelul —
  // altfel o apăsare dublă ar plăti de două ori și ar scrie două răspunsuri.
  const ultim = istoric[istoric.length - 1]
  if (ultim && ultim.rol === 'agent') {
    const stari = await starilePropunerilor(env.DB, o.conversatieId)
    return raspunsulDin(ultim, o.conversatieId, stari)
  }

  // Comutatorul poate fi stins ÎNTRE mesaj și lucru (sunt două cereri deosebite, din 18.09.2026):
  // atunci se spune limpede, nu se ghicește un creier.
  if (comutator.creier === 'fara') {
    await scrieMesaj(env.DB, { conversatie_id: o.conversatieId, rol: 'agent', text: FARA_CREIER })
    return { conversatieId: o.conversatieId, text: FARA_CREIER, obiecte: [], propunere: null, unelte: [] }
  }

  /*
   * ================= FLUXUL PE HARTĂ (19.09.2026) =================
   *
   * O aplicație care își declară CUPRINSUL în manifest (`harta`) nu mai trece pe drumul cu unelte:
   * mesajul se potrivește întâi determinist, la ea acasă, iar modelul face cel mult două clasificări
   * mici (subiectul, apoi acțiunea). Promptul vechi — regulile și uneltele — nu se mai trimite deloc,
   * și nici cunoștințele de fundal nu se mai cer: aici nu se alege nimic din ele.
   *
   * ⚠️ Aplicațiile fără hartă (program, tipic) nu simt nimic: codul de mai jos rămâne al lor.
   */
  const aleiNoastre = aplicatiileLegate(env, o.aplicatie).find((a) => a.nume === o.aplicatie)
  const manifestulNostru = aleiNoastre
    ? await manifestulLui(aleiNoastre.fetcher, aleiNoastre.nume, { secret: o.secret, correlationId: o.cid, prin: 'chat' })
    : null
  if (aleiNoastre && manifestulNostru?.harta) {
    const efecte = new Map((manifestulNostru as Manifest).actiuni.map((a) => [a.nume, a.efect as string]))
    // ce valoare i-am cerut omului la mesajul dinainte (după un buton de nivel 2)
    const alAgentului = [...istoric].reverse().find((m) => m.rol === 'agent')
    const r = await peHarta({
      env,
      harta: manifestulNostru.harta,
      aplicatie: o.aplicatie,
      fetcher: aleiNoastre.fetcher,
      actor: o.actor,
      secret: o.secret,
      cid: o.cid,
      creier: comutator.creier,
      model: comutator.model,
      indrumari: aleAplicatiei.indrumari,
      pana,
      mesaj: istoric[istoric.length - 1]?.text ?? '',
      asteapta: alAgentului ? asteptareaDin(alAgentului.date_json) : null,
      conversatieId: o.conversatieId,
      log: o.log,
      spune,
      propune: async (p) => {
        const scrisa = await scriePropunere(env.DB, {
          conversatie_id: o.conversatieId,
          aplicatie: o.aplicatie,
          actiune: p.actiune,
          argumente: p.argumente,
          rezumat: p.rezumat,
        })
        return { id: scrisa.id, rezumat: scrisa.rezumat }
      },
      previzualizeaza: async (actiune, argumente) => {
        const prev = await previzualizeaza(aleiNoastre.fetcher, actiune, argumente, o.actor, {
          secret: o.secret,
          correlationId: o.cid,
          prin: 'chat',
        })
        return prev.ok ? { ok: true as const, rezumat: prev.date.rezumat } : { ok: false as const, mesaj: prev.mesaj }
      },
      efectul: (actiune) => efecte.get(actiune),
    })

    // MĂSURA „FĂRĂ AI": pe ce drum s-a rezolvat mesajul — în log ȘI în contorul din KV.
    o.log.info('mesaj pe harta', { aplicatie: o.aplicatie, drum: r.drum, conversatie: o.conversatieId })
    await noteazaDrumul(env.CONFIG, o.aplicatie, r.drum)

    await scrieMesaj(env.DB, {
      conversatie_id: o.conversatieId,
      rol: 'agent',
      text: r.text,
      date: {
        obiecte: [],
        propunere: r.propunere,
        ...(r.optiuni.length ? { optiuni: r.optiuni } : {}),
        model: comutator.model,
        apeluri: r.apeluri,
        harta: { drum: r.drum, asteapta: r.asteapta },
      },
    })
    return {
      conversatieId: o.conversatieId,
      text: r.text,
      obiecte: [],
      propunere: r.propunere,
      ...(r.optiuni.length ? { optiuni: r.optiuni } : {}),
      unelte: r.unelte,
    }
  }

  const { unelte, harta, fundal } = await adunaUneltele(env, {
    secret: o.secret,
    correlationId: o.cid,
    permise: aleAplicatiei.unelte,
    pentruAplicatia: o.aplicatie,
  })

  const mesaje: MesajModel[] = [
    { rol: 'sistem', text: instructiuni(o.aplicatie, o.numeleOmului, ziuaDeAzi(), fundal, aleAplicatiei.indrumari, unelte.map((x) => x.name)) },
    ...istoric.map((m) => ({
      rol: m.rol === 'om' ? ('om' as const) : m.rol === 'agent' ? ('agent' as const) : ('unealta' as const),
      text: m.text,
    })),
  ]

  const obiecte: Obiect[] = []
  const unelteChemate: string[] = []
  /** Numele CANONICE ale uneltelor chemate, o dată fiecare — doar ca să i le putem spune omului. */
  const apucate = new Set<string>()
  /** Pentru referinta si antrenament: fiecare apel cu argumentele lui si cum a iesit. */
  const apeluri: Array<{ nume: string; argumente: unknown; rezultat: string; semneArgument?: number }> = []
  /**
   * ÎNSEMNAREA UNUI APEL — cu `semneArgument` când modelul a cărat un text prin context (19.09.2026).
   *
   * ⚠️ NU SE RESPINGE NIMIC: un argument lung e valid, iar refuzul l-ar pune pe om să lipească din
   * nou. Se scrie doar cifra, ca data viitoare boala să se vadă în date, nu să se ghicească dintr-o
   * discuție care s-a oprit din senin. Ea E semnul că un cârlig (`laText`, `laFisier`) lipsește undeva.
   */
  const noteaza = (nume: string, argumente: Record<string, unknown>, rezultat: string) => {
    let celMaiLung = 0
    for (const v of Object.values(argumente ?? {})) {
      if (typeof v === 'string' && v.length > celMaiLung) celMaiLung = v.length
    }
    if (celMaiLung > PRAG_ARGUMENT_LUNG) {
      o.log.warn('argument lung catre unealta', { unealta: nume, semne: celMaiLung })
    }
    apeluri.push({ nume, argumente, rezultat, ...(celMaiLung > PRAG_ARGUMENT_LUNG ? { semneArgument: celMaiLung } : {}) })
  }
  let propunere: RaspunsChat['propunere'] = null
  let textFinal = ''
  let bugetulSaScurs = false

  for (let pas = 0; pas < PASI_MAXIM; pas++) {
    if (Date.now() >= pana) {
      bugetulSaScurs = true
      break
    }
    await spune(pas === 0 ? 'mă gândesc…' : 'mă gândesc mai departe…')
    const r = await intreabaModelul(env, mesaje, unelte, comutator.creier, { model: comutator.model, pana })
    /*
     * ⚠️ APELUL A TRECUT DE CEAS (19.09.2026). Până acum un singur apel lung nu era tăiat de nimic —
     * bugetul se cântărea doar aici, între pași — și cererea murea cu tot cu lucrul ei, fără să scrie
     * un rând. Acum ieșim pe ușa obișnuită a bugetului scurs, care SPUNE omului ce a apucat.
     */
    if (r.expirat) {
      bugetulSaScurs = true
      break
    }
    textFinal = r.text || textFinal

    if (!r.cereri.length) break

    // Apelurile cerute intra in istoric ca mesaj al agentului: raspunsurile uneltelor trebuie
    // sa atarne de ele, altfel modelul primeste rezultate fara intrebare si tace.
    mesaje.push({ rol: 'agent', text: r.text, apeluri: r.cereri, brut: r.brut })

    for (const cerut of r.cereri) {
      unelteChemate.push(cerut.nume)
      // Numele traduse (cu `__`) sunt cele trimise modelului, dar unele modele raspund
      // totusi cu numele canonic — se cauta si asa, ca sa nu cada cererea degeaba.
      const unde = harta.get(cerut.nume) ?? harta.get(numeUnealta(cerut.nume))
      if (!unde) {
        noteaza(cerut.nume, cerut.argumente, 'necunoscuta')
        mesaje.push({ rol: 'unealta', text: `Nu există unealta ${cerut.nume}.`, numeUnealta: cerut.nume, idApel: cerut.id })
        continue
      }
      apucate.add(unde.nume)
      await spune(`caut în ${unde.aplicatie}… (${unde.nume})`)

      // ⚠️ AICI se oprește totul pentru acțiunile care schimbă date: se propune, nu se face.
      // Intai PREVIZUALIZAREA: argumentele se valideaza, dreptul se verifica, iar aplicatia
      // spune in vorbe ce ar urma („ora 08:00 → 07:00"). Omul confirma ceva concret si deja
      // verificat; daca cererea n-are sens, afla de ce, si nu se propune nimic.
      //
      // ⚠️ NUMAI `scrie` se oprește. Un efect nou (`ciorna`, 18.09.2026 — scriere într-o ciornă a
      // aplicației, fără Da/Nu) se execută pe loc, ca o citire: ciorna nu e hotărâre, e o foaie pe
      // masă, iar omul o vede și o validează în ecranul aplicației.
      if (unde.efect === 'scrie') {
        const prev = await previzualizeaza(unde.fetcher, unde.nume, cerut.argumente, o.actor, {
          secret: o.secret,
          correlationId: o.cid,
          prin: 'chat',
        })
        noteaza(unde.nume, cerut.argumente, prev.ok ? 'propusa' : `previzualizare: ${prev.cod}`)
        if (!prev.ok) {
          mesaje.push({
            rol: 'unealta',
            text: `Nu se poate (${prev.cod}): ${prev.mesaj}`,
            numeUnealta: cerut.nume,
            idApel: cerut.id,
          })
          continue
        }
        const p = await scriePropunere(env.DB, {
          conversatie_id: o.conversatieId,
          aplicatie: unde.aplicatie,
          actiune: unde.nume,
          argumente: cerut.argumente,
          rezumat: prev.date.rezumat,
        })
        propunere = { id: p.id, rezumat: p.rezumat }
        mesaje.push({
          rol: 'unealta',
          text: `Propunere pregătită, așteaptă confirmarea omului: ${prev.date.rezumat}`,
          numeUnealta: cerut.nume,
          idApel: cerut.id,
        })
        break
      }

      const rez = await cereActiune(unde.fetcher, unde.nume, cerut.argumente, o.actor, {
        secret: o.secret,
        correlationId: o.cid,
        prin: 'chat',
      })
      noteaza(unde.nume, cerut.argumente, rez.ok ? 'ok' : rez.cod)
      if (!rez.ok) {
        mesaje.push({
          rol: 'unealta',
          text: `Nu a mers (${rez.cod}): ${rez.mesaj}`,
          numeUnealta: cerut.nume,
          idApel: cerut.id,
        })
        continue
      }
      const rezumat = rezumaRezultat(rez.date)
      if (rezumat.obiect) obiecte.push(rezumat.obiect)
      mesaje.push({ rol: 'unealta', text: rezumat.text, numeUnealta: cerut.nume, idApel: cerut.id })
    }

    if (propunere) {
      // Un ultim rand de la model, ca sa spuna omului ce a pregatit — fara unelte, ca sa nu
      // mai ceara altceva pana nu s-a raspuns la asta. ⚠️ Cu bugetul scurs NU se mai cheama:
      // propunerea e deja pregatita, iar o fraza de politete nu merita inca un minut de asteptare.
      if (Date.now() < pana) {
        await spune('compun răspunsul…')
        const ultimRand = await intreabaModelul(env, mesaje, unelte, comutator.creier, { faraApeluri: true, model: comutator.model, pana })
        textFinal = ultimRand.text || textFinal || 'Am pregătit schimbarea. O fac dacă îmi confirmi.'
      } else {
        textFinal = textFinal || 'Am pregătit schimbarea. O fac dacă îmi confirmi.'
      }
      break
    }
  }

  if (bugetulSaScurs) {
    // Ce a apucat, spus pe față: mai bine „am căutat în program, dar nu am terminat" decât un
    // răspuns pe jumătate dat ca întreg.
    const ceAmCautat = apucate.size ? ` Am apucat să caut cu: ${[...apucate].join(', ')}.` : ''
    textFinal = textFinal
      ? `${textFinal}\n\n(M-am oprit aici — mi s-a scurs timpul pe care mi-l dau pentru un mesaj.)`
      : `Nu am terminat în timpul pe care mi-l dau pentru un mesaj (${Math.round(BUGET_MS / 1000)} de secunde).${ceAmCautat} Cere-mi un singur lucru, mai pe scurt, și mă descurc.`
    o.log.warn('buget de timp scurs', { conversatie: o.conversatieId, unelte: unelteChemate.length })
  }

  if (!textFinal) {
    textFinal = 'N-am reușit să duc asta la capăt. Încearcă să-mi spui altfel?'
    o.log.warn('raspuns gol de la model', { conversatie: o.conversatieId })
  }

  await scrieMesaj(env.DB, {
    conversatie_id: o.conversatieId,
    rol: 'agent',
    text: textFinal,
    // Ce se pastreaza langa raspuns: hartiile si propunerea (pentru redeschiderea panoului),
    // plus modelul si apelurile lui (pentru referinta si antrenament — user, 11.09.2026).
    date: { obiecte, propunere, model: comutator.model, apeluri },
  })

  return { conversatieId: o.conversatieId, text: textFinal, obiecte, propunere, unelte: unelteChemate }
}

export default {
  async fetch(req: Request, env: Env, ctxExec: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    const cale = url.pathname

    if (cale === '/health') return json({ ok: true, serviciu: SERVICIU })

    const intrare = await poarta(req, env)
    if (intrare instanceof Response) return intrare
    const { actor, cid } = intrare
    const userId = actor.fel === 'utilizator' ? actor.principal.userId : ''
    const log = new Logger({ service: SERVICIU, correlationId: cid })
    const secret = env.SECRET_INTERN!
    /** Discutia in lucru, ca o eroare sa se poata scrie in ea (toate se pastreaza, si erorile). */
    let discutiaInLucru: string | null = null

    try {
      // -------------------------------------------------------------- istoricul
      if (req.method === 'GET' && cale === '/discutie') {
        const id = url.searchParams.get('id')
        // ⚠️ `conversatiaDe`, nu `conversatia`: la CITIT nu se deschide nicio discuție nouă. Altfel
        // fiecare reîncărcare de pagină cu o discuție veche în localStorage scria un rând gol.
        const c = id ? await conversatiaDe(env.DB, id, userId) : null
        if (!c) return json({ mesaje: [] })
        const [mesaje, stari] = await Promise.all([mesajeleDin(env.DB, c.id), starilePropunerilor(env.DB, c.id)])
        const deVazut = mesaje.filter((m) => m.rol !== 'unealta')
        /*
         * ⚠️ FIRUL REFĂCUT POARTĂ ȘI PROPUNEREA (18.09.2026). Până acum bula desena din istoric doar
         * textul și hârtiile, deci butoanele Da/Nu se pierdeau la strângerea panoului — omul rămânea
         * cu o propunere pregătită pe care nu mai avea cum s-o confirme. Se trimite numai ce se poate
         * încă apăsa (`asteapta`, neexpirată); ce a trecut pleacă drept `propunereTrecuta`, ca bula
         * să spună limpede „a expirat" în loc să deseneze butoane moarte.
         */
        return json({
          conversatieId: c.id,
          mesaje: deVazut.map((m) => {
            const r = raspunsulDin(m, c.id, stari)
            return {
              rol: m.rol,
              text: m.text,
              date: {
                obiecte: r.obiecte,
                propunere: r.propunere,
                // butoanele fluxului pe hartă: firul refăcut trebuie să le poarte, ca omul să poată
                // apăsa mai departe după ce a strâns panoul (aceeași socoteală ca la propunere)
                ...(r.optiuni?.length ? { optiuni: r.optiuni } : {}),
                ...(r.propunereTrecuta ? { propunereTrecuta: r.propunereTrecuta } : {}),
              },
            }
          }),
          // Panoul redeschis în timp ce creierul lucrează: bula reia sondarea de unde a rămas, în loc
          // să arate un fir care se termină cu întrebarea omului și nimic după ea.
          inLucru: (() => {
            const ultimul = deVazut[deVazut.length - 1]
            if (!ultimul || ultimul.rol !== 'om') return null
            const lucru = lucrulDin(ultimul.date_json)
            return lucru ? { etapa: lucru.etapa, deLa: lucru.de_la } : null
          })(),
        })
      }

      /*
       * SONDAREA (18.09.2026) — ce se întreabă la două-trei secunde, cât lucrează creierul.
       *
       * Răspunsul nu mai vine pe cererea care l-a cerut (vezi `/mesaj` cu `asincron`), deci bula are
       * nevoie de o ușă mică și ieftină: ori „încă lucrez, iată la ce sunt", ori răspunsul întreg.
       * Miezul: „gata" NU e un steag pe care-l scrie cineva, ci un FAPT — există un mesaj al agentului
       * după ultimul mesaj al omului. Așa nu se poate pierde nicio stare dacă lucrul cade la mijloc.
       */
      if (req.method === 'GET' && cale === '/stare') {
        /*
         * MĂSURA „FĂRĂ AI" (19.09.2026) — `?statistica=<aplicatie>`, pe aceeași ușă ieftină.
         *
         * Utilizatorul vrea să analizeze dacă poate lucra fără AI: cifra e câte mesaje s-au rezolvat
         * determinist și câte au cerut modelul. Contorul îl scrie codul (`noteazaDrumul`), la fiecare
         * mesaj pe hartă; aici doar se citește. Nu ține nimic personal — numai numărători.
         */
        const pentruStatistica = url.searchParams.get('statistica') ?? ''
        if (pentruStatistica) {
          if (!env.CONFIG) return json(statisticaGoala(pentruStatistica))
          const brut = await env.CONFIG.get(cheiaStatisticii(pentruStatistica), 'json').catch(() => null)
          return json(citesteStatistica(pentruStatistica, brut))
        }
        const id = url.searchParams.get('id') ?? ''
        const c = await conversatiaDe(env.DB, id, userId)
        if (!c) return json({ gata: false, lipseste: true, etapa: '' }, 404)
        const mesaje = await mesajeleDin(env.DB, c.id, 6)
        let iOm = -1
        for (let i = mesaje.length - 1; i >= 0; i--) {
          if (mesaje[i]!.rol === 'om') {
            iOm = i
            break
          }
        }
        const alAgentului = mesaje.slice(iOm + 1).filter((m) => m.rol === 'agent').pop()
        /*
         * ⚠️ ȘI STAREA UNEI PROPUNERI ANUME (19.09.2026), când se cere cu `?propunere=`.
         *
         * De ce: „Da, fă-o" execută acțiunea SINCRON, pe cererea bulei (`/confirma`), iar o acțiune
         * grea — `buletin.compune` randează PDF-ul într-un browser adevărat — ține un minut și mai
         * bine. Conexiunea aceea se poate rupe pe drum (pățit pe 18.09.2026, la `/mesaj`: 2 min 49 s,
         * conexiunea căzută, răspunsul scris totuși în bază), și atunci bula rămânea cu butoanele
         * stinse și fără niciun cuvânt, la nesfârșit — „tot aștept și nu răspunde" (user, 19.09.2026).
         *
         * Aici, „gata" nu se mai poate socoti din mesajul agentului: după o propunere, ULTIMUL mesaj
         * e chiar cel care o poartă, deci `gata` e adevărat din prima clipă. Semnul că s-a isprăvit e
         * altul, și e un FAPT, nu un steag: propunerea nu mai așteaptă.
         */
        const cerutaPropunere = url.searchParams.get('propunere') ?? ''
        const stari = alAgentului || cerutaPropunere ? await starilePropunerilor(env.DB, c.id) : undefined
        const starePropunere = cerutaPropunere
          ? { propunereStare: stari?.get(cerutaPropunere) ?? 'asteapta' }
          : {}
        if (alAgentului) {
          return json({ gata: true, raspuns: raspunsulDin(alAgentului, c.id, stari), ...starePropunere })
        }
        const lucru = iOm >= 0 ? lucrulDin(mesaje[iOm]!.date_json) : null
        return json({ gata: false, etapa: lucru?.etapa ?? '', deLa: lucru?.de_la ?? null, ...starePropunere })
      }

      /*
       * CE POATE FACE BULA UNEI APLICAȚII — pentru rubrica „Chat AI" din Setările ei (18.09.2026).
       * Ecranul acela arată unelte cu bifă, nu scrise de mână, iar singurul care știe ce publică
       * fiecare aplicație (și pe care le vede bula care întreabă) e creierul de aici.
       *
       * ⚠️ Lista e ÎNTREAGĂ, neîngustată de bifele de acum: altfel, odată salvate trei unelte, în
       * ecran ar mai fi rămas trei — și nu s-ar mai fi putut adăuga niciodată a patra.
       */
      if (req.method === 'GET' && cale === '/unelte') {
        const pentru = url.searchParams.get('aplicatie') ?? ''
        const { harta } = await adunaUneltele(env, {
          secret,
          correlationId: cid,
          permise: [],
          pentruAplicatia: pentru || undefined,
          faraFundal: true,
        })
        const unelte = [...harta.values()]
          .map((u) => ({ nume: u.nume, aplicatie: u.aplicatie, efect: u.efect, descriere: u.descriere }))
          .sort((a, b) => a.nume.localeCompare(b.nume, 'ro'))
        return json({ unelte })
      }

      if (req.method !== 'POST') return json({ ok: false, mesaj: 'doar POST' }, 405)

      // -------------------------------------------------------------- ștergerea
      if (cale === '/sterge') {
        const { conversatieId } = (await req.json()) as { conversatieId?: string }
        const sters = conversatieId ? await stergeConversatia(env.DB, conversatieId, userId) : false
        return json({ ok: sters })
      }

      // -------------------------------------------------------------- confirmarea
      if (cale === '/confirma') {
        const { propunereId, raspuns } = (await req.json()) as { propunereId?: string; raspuns?: string }
        if (!propunereId) return json({ ok: false, mesaj: 'care propunere?' }, 400)
        const gasita = await propunereaDe(env.DB, propunereId, userId)
        if (!gasita) return json({ ok: false, mesaj: 'propunerea nu există' }, 404)
        if (gasita.motiv === 'expirata') {
          return json({ ok: false, text: 'Propunerea a expirat. Cere-mi din nou, ca să lucrez pe date proaspete.' })
        }
        if (gasita.motiv === 'raspunsa') {
          return json({ ok: false, text: 'La propunerea asta s-a răspuns deja.' })
        }
        const p = gasita.p

        if (raspuns !== 'da') {
          await inchidePropunerea(env.DB, p.id, 'refuzata')
          await scrieMesaj(env.DB, { conversatie_id: p.conversatie_id, rol: 'agent', text: 'Am lăsat-o baltă.' })
          return json({ ok: true, text: 'Am lăsat-o baltă.' })
        }

        // Drepturile se verifică ACUM, din nou, la aplicație: între propunere și „Da" se poate
        // schimba rolul omului, iar noi n-am ținut minte nicio decizie de autorizare.
        const unde = aplicatiileLegate(env).find((a) => a.nume === p.aplicatie)
        if (!unde) return json({ ok: false, text: 'Aplicația nu mai e de față.' }, 503)
        const r = await cereActiune(unde.fetcher, p.actiune, JSON.parse(p.argumente_json), actor, {
          secret,
          correlationId: cid,
          prin: 'chat',
        })
        /*
         * ⚠️ „GATA." SE SPUNE DOAR PESTE O FAPTĂ FĂCUTĂ (user, 19.09.2026, 12:35: „am dat compune …
         * nicio modificare"). `r.ok` spune că ACȚIUNEA a mers, nu că lumea s-a schimbat: o acțiune
         * poate refuza cuminte, fără să arunce (`buletin.compune` cu „au rămas 64 de semne pe
         * dinafară" întoarce `facut:false` și cod 200). Până aici, omul citea peste refuzul ăsta
         * „Gata. Compun buletinul nr. 616 …", iar foaia rămânea cea de ieri, fără un cuvânt.
         * Raportul faptei vine acum în plic, de la aplicație (`raportul`, în `@xc/actiuni`).
         */
        const raport = r.ok ? r.raport : undefined
        const facut = r.ok && (raport?.facut ?? true)
        await inchidePropunerea(env.DB, p.id, facut ? 'facuta' : 'refuzata')
        // Rezumatul era la viitor („Schimb…", „o scriu întâi"); după execuție se spune la trecut.
        const laTrecut = p.rezumat
          .replace(/^(Schimb|Adaug|Scot|Scriu|Validez)\b/, (v) => ({ Schimb: 'Am schimbat', Adaug: 'Am adăugat', Scot: 'Am scos', Scriu: 'Am scris', Validez: 'Am validat' })[v] ?? v)
          .replace(/\s*Săptămâna nu e scrisă încă — o scriu întâi din propunere\.|\s*Nu e scrisă încă — o scriu întâi din propunere\./, ' Săptămâna a fost scrisă din propunere.')
        let text = !r.ok
          ? `N-am putut: ${r.mesaj}`
          : facut
            ? `Gata. ${laTrecut}`
            : `N-am făcut-o. ${raport?.text || 'Aplicația n-a spus de ce.'}`

        // URMAREA (user, 11.09.2026, 21:48): dupa fiecare schimbare confirmata, chatul intreaba —
        // deterministic, nu la voia modelului — daca valideaza saptamana. Se previzualizeaza intai
        // (daca e deja validata, previzualizarea cade si nu se intreaba nimic) si se propune cu Da/Nu.
        let urmare: RaspunsChat['propunere'] = null
        if (facut) {
          // ⚠️ Aceeasi vedere ca la mesaj (`CE_VEDE_BULA` + bifele APLICATIEI), altfel urmarea s-ar
          // căuta printre uneltele altei aplicatii — si `buletin.compune` n-are urmare, dar
          // programul are. Si: o unealta debifata din Setari nu trebuie sa vina pe usa din dos.
          const { harta } = await adunaUneltele(env, {
            secret,
            correlationId: cid,
            permise: (await configAplicatie(env, p.aplicatie)).unelte,
            pentruAplicatia: p.aplicatie,
          })
          const facuta = harta.get(numeUnealta(p.actiune))
          const tinta = facuta?.urmare ? harta.get(numeUnealta(facuta.urmare.actiune)) : undefined
          if (facuta?.urmare && tinta) {
            const argumenteFacute = JSON.parse(p.argumente_json) as Record<string, unknown>
            const argumente: Record<string, unknown> = {}
            for (const [al, din] of Object.entries(facuta.urmare.argumente)) argumente[al] = argumenteFacute[din]
            const prev = await previzualizeaza(tinta.fetcher, tinta.nume, argumente, actor, { secret, correlationId: cid, prin: 'chat' })
            if (prev.ok) {
              const p2 = await scriePropunere(env.DB, {
                conversatie_id: p.conversatie_id,
                aplicatie: tinta.aplicatie,
                actiune: tinta.nume,
                argumente,
                rezumat: prev.date.rezumat,
              })
              urmare = { id: p2.id, rezumat: p2.rezumat }
              text += ' Programul săptămânii e acum „propus". Îl validez?'
            }
          }
        }

        await scrieMesaj(env.DB, { conversatie_id: p.conversatie_id, rol: 'agent', text, date: { propunere: urmare } })
        // ⚠️ `ok:false` la un refuz cuminte: bula scrie rândul cu roșu (`mesaj('rea', …)`), iar roșul e,
        // peste tot la noi, al lucrului nefăcut. Și `reincarca` se ține tot de faptă: n-are ce
        // împrospăta un ecran peste care nu s-a schimbat nimic.
        return json({ ok: facut, text, propunere: urmare, reincarca: facut })
      }

      /*
       * MESAJUL — DOUĂ DRUMURI (18.09.2026).
       *
       * `asincron: true` (drumul bulei de azi): se scrie mesajul omului, se însemnează „în lucru" și
       * se răspunde ÎNDATĂ cu `{conversatieId, mesajId, inLucru:true}`. Lucrul îl pornește aplicația,
       * pe `/lucreaza`, în `waitUntil` al cererii ei — deci nicio conexiune nu mai stă deschisă minute
       * întregi, iar bula întreabă din când în când `/stare`.
       *
       * Fără `asincron`: drumul de odinioară, care așteaptă răspunsul întreg. Rămâne fiindcă e limpede
       * de probat și fiindcă o chemare de serviciu poate vrea răspunsul pe loc.
       *
       * ⚠️ PĂȚIT PE 18.09.2026: un mesaj a ținut 2 min 49 s, conexiunea a căzut pe drum, iar bula a
       * spus „Nu am putut trimite mesajul" — deși răspunsul se scria în D1 și apărea „de nicăieri" la
       * reîncărcarea paginii. Aceea a fost cauza, nu modelul.
       */
      if (cale === '/mesaj') {
        const cerere = (await req.json()) as {
          text?: string
          aplicatie?: string
          conversatieId?: string
          numeleOmului?: string | null
          asincron?: boolean
        }
        const textOm = (cerere.text ?? '').trim().slice(0, TAIERE_MESAJ_OM)
        if (!textOm) return json({ ok: false, mesaj: 'mesaj gol' }, 400)

        const c = await conversatia(env.DB, userId, cerere.aplicatie ?? '', cerere.conversatieId)
        discutiaInLucru = c.id
        const alOmului = await scrieMesaj(env.DB, { conversatie_id: c.id, rol: 'om', text: textOm })

        // Cu ce creier raspundem — scris in panoul de admin, citit de aici. `fara` inseamna ca
        // interfata merge intreaga, dar nimeni nu intreaba niciun model (si nu costa nimic).
        // Se răspunde pe loc și pe drumul asincron: n-are rost sondat ceva ce se știe de-acum.
        const comutator: ConfigChat = await configChat(env)
        if (comutator.creier === 'fara') {
          await scrieMesaj(env.DB, { conversatie_id: c.id, rol: 'agent', text: FARA_CREIER })
          return json({ conversatieId: c.id, text: FARA_CREIER, obiecte: [], propunere: null, unelte: [] } satisfies RaspunsChat)
        }

        if (cerere.asincron) {
          await scrieLucrul(env.DB, alOmului.id, { etapa: 'mă gândesc…', de_la: alOmului.creat_la })
          return json({ conversatieId: c.id, mesajId: alOmului.id, inLucru: true })
        }

        return json(
          await lucreaza(env, {
            actor,
            cid,
            secret,
            aplicatie: cerere.aplicatie ?? '',
            numeleOmului: cerere.numeleOmului ?? null,
            conversatieId: c.id,
            mesajId: alOmului.id,
            log,
          }),
        )
      }

      /*
       * LUCRUL PORNIT DEOSEBIT — chemat de aplicație îndată după `/mesaj` cu `asincron`, și ținut în
       * viață de `waitUntil` al cererii ACELEIA.
       *
       * ⚠️ De ce nu-l pornește chat-worker singur, cu `ctxExec.waitUntil` al lui: el e chemat prin
       * Service Binding, iar o cerere de serviciu trăiește cât cererea care a chemat-o. Dacă aplicația
       * își întoarce răspunsul și nu mai ține nimic aprins, munca de aici se poate opri la mijloc —
       * exact lucrul de care ne ferim. Așa se vede limpede cine ține lumina: aplicația.
       *
       * Paza: discuția trebuie să fie A OMULUI care cere (`conversatiaDe`), iar lucrul dublat se
       * oprește în `lucreaza` — dacă răspunsul e deja scris, modelul nu se mai cheamă a doua oară.
       */
      if (cale === '/lucreaza') {
        const cerere = (await req.json()) as {
          conversatieId?: string
          mesajId?: string
          aplicatie?: string
          numeleOmului?: string | null
        }
        const c = await conversatiaDe(env.DB, cerere.conversatieId ?? '', userId)
        if (!c) return json({ ok: false, mesaj: 'discuția nu există' }, 404)
        discutiaInLucru = c.id
        return json(
          await lucreaza(env, {
            actor,
            cid,
            secret,
            aplicatie: cerere.aplicatie ?? c.aplicatie ?? '',
            numeleOmului: cerere.numeleOmului ?? null,
            conversatieId: c.id,
            mesajId: cerere.mesajId ?? null,
            log,
          }),
        )
      }

      return json({ ok: false, mesaj: 'rută necunoscută' }, 404)
    } catch (e) {
      const detaliu = e instanceof Error ? e.message : String(e)
      log.error('chat cazut', { eroare: detaliu })
      const text = 'S-a împiedicat ceva la mine. Mai încearcă o dată.'
      // Si erorile se pastreaza in discutie (user, 11.09.2026: „le-aș salva pe toate - chiar și
      // erorile") — la export se vede exact unde si de ce a cazut.
      if (discutiaInLucru) {
        await scrieMesaj(env.DB, { conversatie_id: discutiaInLucru, rol: 'agent', text, date: { eroare: detaliu } }).catch(() => undefined)
      }
      return json({ ok: false, conversatieId: discutiaInLucru, text }, 500)
    }
  },
}
