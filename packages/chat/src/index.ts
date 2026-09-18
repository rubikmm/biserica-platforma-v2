/**
 * MODULUL DE CHAT, partea din aplicație.
 *
 * O aplicație capătă chatul cu trei linii (vezi docs/architecture/chat-si-actiuni.md):
 *
 *   const chat = modulChat({ aplicatie: 'program' })
 *   const r = await chat.ruteaza(req, env, ctxExec, cale, ctxChat); if (r) return r
 *   pagina({ …, chat: await chat.bula(env, ctxChat) })
 *
 * Ce face aici: pune poarta (comutatorul din admin + drepturile omului), trece mesajele mai
 * departe către `chat-worker` prin Service Binding și servește hârtiile din media.
 *
 * De ce trece prin aplicație și nu direct la chat-worker: pagina stă pe originea aplicației, deci
 * sesiunea și CSRF-ul merg neschimbate. Un chat pe alt subdomeniu ar fi cerut CORS, cookie-uri
 * `SameSite` și încă o verificare — pentru nimic.
 */
import { ANTET_ACTOR, ANTET_PRIN, ANTET_SECRET, type Actor } from '@xc/actiuni'
import { verificaTokenCsrf } from '@xc/auth'
import type { Principal } from '@xc/contracts'
import { bulaHtml, JS_CHAT, STIL_CHAT } from './bula.js'
import {
  configAplicatie,
  configChat,
  normalizeazaAplicatie,
  poateVedea,
  scrieConfigAplicatie,
  type EnvComutator,
} from './comutator.js'
import {
  LIMITA_OCTETI,
  TAIERE_MESAJ_OM,
  cheiaFisierului,
  extrageTextDocx,
  extrageTextTxt,
  felulFisierului,
  type FelFisier,
} from './fisiere.js'
import { rubricaChat, type UnealtaDeBifat } from './setari.js'

export * from './comutator.js'
export * from './fisiere.js'
export * from './modele.js'
export * from './setari.js'
export { IC_BULA, SALUT } from './bula.js'

export interface EnvChat extends EnvComutator {
  /** Creierul. Fără el, modulul e tăcut. */
  CHAT?: Fetcher
  /** Unde stau hârtiile pe care le întorc acțiunile. */
  MEDIA?: Fetcher
  SECRET_INTERN?: string
}

export interface ContextChat {
  /** Prefixul aplicației în preview (`/program`); gol pe subdomenii. */
  prefix: string
  principal: Principal | null
  numeleOmului?: string | null
  eAdmin: boolean
}

/** Ce primește carcasa: stilul, HTML-ul și scriptul bulei, gata de pus la locurile lor. */
export interface BucataChat {
  stil: string
  html: string
  js: string
}

/** Cheia din media: `<domeniu>/<cale>`, aceeași formă ca la R2. */
const CHEIE_BUNA = /^[a-z0-9-]+\/[a-zA-Z0-9._/-]{1,200}$/

function json(date: unknown, status = 200): Response {
  return new Response(JSON.stringify(date), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** Pentru cine n-are voie, modulul nu există. Nu spunem că e stins, nu spunem că e acolo. */
const inexistent = () => new Response('Not Found', { status: 404 })

/**
 * ȚINE LUMINA APRINSĂ cât lucrează creierul (18.09.2026).
 *
 * Răspunsul la un mesaj poate ține minute, iar de pe 18.09 nu mai stă nimeni pe firul cererii:
 * aplicația întoarce îndată `{inLucru:true}`, iar munca se face într-o cerere de serviciu pe care o
 * păstrează `waitUntil` AL APLICAȚIEI.
 *
 * ⚠️ De ce aici și nu în chat-worker, cu `waitUntil` al lui: el e chemat prin Service Binding, iar o
 * cerere de serviciu trăiește cât cererea care a chemat-o. Dacă aplicația își întoarce răspunsul și
 * nu mai ține nimic aprins, munca poate fi tăiată la mijloc — adică exact boala pe care o dregem.
 *
 * `try` fiindcă la probe contextul de execuție e un obiect gol: atunci promisiunea curge cum poate,
 * iar cererea a plecat oricum.
 */
function tineAprins(ctxExec: ExecutionContext, lucrul: Promise<unknown>): void {
  const tacut = lucrul.then(
    () => undefined,
    () => undefined,
  )
  try {
    ctxExec.waitUntil(tacut)
  } catch {
    void tacut
  }
}

/**
 * UN FIȘIER URCAT, așa cum îl vede aplicația în cârligul ei.
 *
 * ⚠️ `cheie` e SCRISĂ DE SERVER (vezi `cheiaFisierului`) — n-a trecut niciodată prin browser. Octeții
 * vin odată cu ea (`continut`) fiindcă aplicația poate vrea să-i pună la ea acasă: buletinul mută poza
 * în depozitul lui, ca Browser Rendering s-o poată lua de pe o adresă publică.
 */
export interface FisierUrcat {
  nume: string
  fel: FelFisier
  /** Tipul cu care s-a pus în depozit — cel din lista albă, nu cel spus de browser. */
  tip: string
  octeti: number
  /** Cheia din media; `/chat/fisier/<cheie>` o servește celui care are voie la chat. */
  cheie: string
  /** Textul scos din .docx / .txt; gol la poze. */
  text: string
  continut: ArrayBuffer
  /** Ce a scris omul în câmp odată cu fișierul (poate fi gol). */
  mesajOmului: string
}

/** Ce poate răspunde aplicația când ia fișierul în primire. `null` = „nu e al meu, fă ce faci de obicei". */
export interface RaspunsLaFisier {
  /** Textul scris în domeniul aplicației (pentru urmă, nu se mai lipește în mesaj). */
  text?: string
  /** Mesajul care pleacă spre model în locul celui obișnuit. */
  mesaj?: string
  /** Adresa sub care a ajuns poza la aplicație, dacă a mutat-o la ea. */
  poza?: string
  /**
   * CE A ATINS aplicația, cu numele acțiunilor ei (`buletin.raspunde`).
   *
   * ⚠️ Pentru împrospătarea ecranului de dedesubt: cârligul scrie ÎNAINTE ca modelul să răspundă, iar
   * dacă modelul nu cheamă nicio unealtă (n-are de ce, treaba e făcută), pagina n-ar afla niciodată că
   * s-a schimbat ceva. Așa vestea pleacă îndată după urcare, cu aceleași nume ca la un răspuns.
   */
  unelte?: string[]
}

export interface ContextFisier {
  env: EnvChat
  ctxExec: ExecutionContext
  ctx: ContextChat
}

export interface ModulChat {
  bula(env: EnvChat, ctx: ContextChat): Promise<BucataChat | undefined>
  /**
   * Rubrica „Chat AI" pentru ecranul de Setări al aplicației. Se dă punctului de prindere `rubrici`
   * din `@xc/setari` și întoarce gol pentru cine nu e adminul aplicației.
   */
  rubricaSetari(env: EnvChat, ctx: ContextChat, o: { csrf: string }): Promise<string>
  ruteaza(
    req: Request,
    env: EnvChat,
    ctxExec: ExecutionContext,
    cale: string,
    ctx: ContextChat,
  ): Promise<Response | null>
}

export function modulChat(cfg: {
  aplicatie: string
  titlu?: string
  /**
   * CÂRLIGUL APLICAȚIEI la un fișier urcat (18.09.2026). Fără el, urcarea e generică: textul unui
   * .docx devine mesajul omului, iar poza devine un card. Cu el, aplicația ia fișierul în domeniul ei
   * — buletinul scrie textul direct în schiță și pune poza la articolul de acum, deci omul nu mai
   * lipește nimic a doua oară.
   *
   * ⚠️ Ce întoarce NU e un răspuns către om, ci mesajul cu care se merge mai departe la model: după
   * urcare bula trimite singură mesajul pe drumul obișnuit (`/chat/mesaj`), ca lanțul să fie unul.
   */
  laFisier?: (f: FisierUrcat, c: ContextFisier) => Promise<RaspunsLaFisier | null>
}): ModulChat {
  /**
   * Poarta, într-un singur loc: același răspuns și pentru bulă, și pentru rute. Dacă s-ar
   * despărți, o stingere din admin ar ascunde bula lăsând rutele deschise.
   *
   * ⚠️ Chatul cere CONT chiar și la treapta „toți": discuția se ține pe `user_id`, iar un
   * vizitator n-are unul. Când (și dacă) se deschide spre toată lumea, aici e locul unde trebuie
   * adăugată o identitate de vizitator — și o limitare pe IP, fiindcă fiecare mesaj costă.
   */
  async function areVoie(env: EnvChat, ctx: ContextChat): Promise<boolean> {
    if (!env.CHAT || !ctx.principal) return false
    const c = await configChat(env)
    return poateVedea(c, cfg.aplicatie, { intrat: true, eAdmin: ctx.eAdmin })
  }

  function actorul(ctx: ContextChat): Actor {
    return { fel: 'utilizator', principal: ctx.principal as Principal }
  }

  function antete(env: EnvChat, req?: Request): Record<string, string> {
    return {
      'content-type': 'application/json',
      [ANTET_SECRET]: env.SECRET_INTERN ?? '',
      [ANTET_PRIN]: `app-${cfg.aplicatie}`,
      'x-correlation-id': req?.headers.get('x-correlation-id') ?? crypto.randomUUID(),
    }
  }

  /**
   * Ce poate chema bula de aici, cerut de la creier — el ține manifestele aplicațiilor și tot el
   * știe pe care le vede bula asta.
   *
   * ⚠️ Tăcerea lui NU e listă goală, ci `null`: o listă goală ar arăta în Setări un ecran fără nicio
   * bifă, iar o salvare de acolo ar șterge alegerea de până atunci fără ca cineva să bage de seamă.
   */
  async function unelteleBulei(env: EnvChat, ctx: ContextChat): Promise<UnealtaDeBifat[] | null> {
    if (!env.CHAT || !ctx.principal) return null
    try {
      const r = await env.CHAT.fetch(
        `https://chat.intern/unelte?aplicatie=${encodeURIComponent(cfg.aplicatie)}`,
        { headers: { ...antete(env), [ANTET_ACTOR]: JSON.stringify(actorul(ctx)) } },
      )
      if (!r.ok) return null
      const date = (await r.json()) as { unelte?: UnealtaDeBifat[] }
      return Array.isArray(date.unelte) ? date.unelte : null
    } catch {
      return null
    }
  }

  /**
   * URCAREA, cap-coadă. Ordinea pașilor e cea din proiectul de chineză, și fiecare e acolo cu rost:
   * întâi antetul (un fișier de 40 MB se refuză fără să fie citit), apoi mărimea adevărată, apoi
   * lista albă, și abia la urmă octeții.
   */
  async function urca(
    req: Request,
    env: EnvChat,
    ctxExec: ExecutionContext,
    ctx: ContextChat,
  ): Promise<Response> {
    const preaMare = { ok: false, mesaj: 'Fișierul e prea mare — primesc cel mult 12 MB.' }
    // ⚠️ 65536 de îngăduință: `content-length` numără și învelișul multipart, nu doar fișierul.
    if (Number(req.headers.get('content-length') ?? 0) > LIMITA_OCTETI + 65536) return json(preaMare, 413)

    let formular: FormData
    try {
      formular = await req.formData()
    } catch {
      return json({ ok: false, mesaj: 'Nu am înțeles ce mi-ai trimis.' }, 400)
    }

    const camp = formular.get('fisier')
    const scrisDeOm = String(formular.get('text') ?? '').trim()
    if (!camp || typeof camp === 'string') return json({ ok: false, mesaj: 'Lipsește fișierul.' }, 400)
    const fisier = camp as File
    if (!fisier.size) return json({ ok: false, mesaj: 'Fișierul e gol.' }, 400)
    if (fisier.size > LIMITA_OCTETI) return json(preaMare, 413)

    const felul = felulFisierului(fisier.name ?? '', fisier.type ?? '')
    if (!felul) {
      return json({ ok: false, mesaj: 'Primesc documente Word (.docx), text (.txt) și poze (jpg, png, webp).' }, 415)
    }
    const nume = (fisier.name || `fisier.${felul.ext}`).replace(/[\r\n\t]/g, ' ').trim().slice(0, 120)

    const continut = await fisier.arrayBuffer()
    let text = ''
    if (felul.fel === 'docx' || felul.fel === 'txt') {
      try {
        text = felul.fel === 'docx' ? await extrageTextDocx(continut) : extrageTextTxt(continut)
      } catch (e) {
        return json({ ok: false, mesaj: `Nu am putut citi ${nume}: ${e instanceof Error ? e.message : String(e)}` }, 422)
      }
      if (!text) return json({ ok: false, mesaj: `${nume} nu are text în el.` }, 422)
    }

    // Octeții stau în media, ca orice hârtie a platformei; aplicația îi dă mai departe din
    // `/chat/fisier/<cheie>`, sub aceeași poartă ca restul chatului.
    if (!env.MEDIA) return json({ ok: false, mesaj: 'Nu am unde să pun fișierul: depozitul nu e legat.' }, 503)
    const cheie = cheiaFisierului({
      aplicatie: cfg.aplicatie,
      userId: ctx.principal?.userId ?? '',
      ext: felul.ext,
    })
    const pus = await env.MEDIA.fetch('https://media.intern/incarca', {
      method: 'POST',
      headers: {
        [ANTET_SECRET]: env.SECRET_INTERN ?? '',
        [ANTET_PRIN]: `app-${cfg.aplicatie}`,
        'content-type': felul.tip,
        'x-meta': JSON.stringify({ key: cheie, contentType: felul.tip }),
      },
      body: continut,
    })
    if (!pus.ok) return json({ ok: false, mesaj: 'Nu am putut păstra fișierul.' }, 502)

    /*
     * CÂRLIGUL APLICAȚIEI. ⚠️ O cădere a lui NU pierde fișierul: octeții sunt deja în depozit, iar
     * drumul generic (textul ca mesaj) duce treaba mai departe. Altfel o greșeală din buletin ar face
     * ca un articol lipit să dispară fără urmă — cel mai rău fel de eroare.
     */
    let alAplicatiei: RaspunsLaFisier | null = null
    if (cfg.laFisier) {
      try {
        alAplicatiei = await cfg.laFisier(
          { nume, fel: felul.fel, tip: felul.tip, octeti: fisier.size, cheie, text, continut, mesajOmului: scrisDeOm },
          { env, ctxExec, ctx },
        )
      } catch {
        alAplicatiei = null
      }
    }

    let mesaj = alAplicatiei?.mesaj ?? ''
    if (!mesaj) {
      mesaj = felul.ePoza
        ? `${scrisDeOm ? `${scrisDeOm}\n\n` : ''}Am urcat poza ${nume} (${cheie}).`
        : `${scrisDeOm ? `${scrisDeOm}\n\n` : ''}Textul din fișierul ${nume}:\n${text}`
    }
    /*
     * TĂIEREA SE FACE AICI, nu (doar) la creier: cardul din fir spune „s-a tăiat", iar vorba aceea
     * trebuie să fie adevărată. Dacă am fi lăsat tăierea numai în chat-worker, cardul ar fi spus
     * „întreg" peste un text ciuntit.
     */
    const taiat = mesaj.length > TAIERE_MESAJ_OM
    if (taiat) mesaj = mesaj.slice(0, TAIERE_MESAJ_OM)

    return json({
      ok: true,
      obiect: { cheie, titlu: nume, fel: felul.fel, octeti: fisier.size },
      text: mesaj,
      semne: text.length,
      taiat,
      poza: alAplicatiei?.poza ?? null,
      unelte: alAplicatiei?.unelte ?? [],
    })
  }

  return {
    async bula(env, ctx) {
      if (!(await areVoie(env, ctx))) return undefined
      return {
        stil: STIL_CHAT,
        html: bulaHtml({ prefix: ctx.prefix, titlu: cfg.titlu }),
        js: JS_CHAT,
      }
    },

    async rubricaSetari(env, ctx, o) {
      // Rubrica e a adminului APLICAȚIEI (`ctx.eAdmin`), nu a celui de platformă: cine ține
      // buletinul scrie îndrumările buletinului, fără să fie admin peste tot.
      if (!ctx.principal || !ctx.eAdmin) return ''
      const [global, ale, unelte] = await Promise.all([
        configChat(env),
        configAplicatie(env, cfg.aplicatie),
        unelteleBulei(env, ctx),
      ])
      return rubricaChat({
        prefix: ctx.prefix,
        csrf: o.csrf,
        aplicatie: cfg.aplicatie,
        cfg: ale,
        activ: global.activ,
        pornit: Boolean(global.aplicatii[cfg.aplicatie]),
        unelte,
      })
    },

    async ruteaza(req, env, ctxExec, cale, ctx) {
      if (cale !== '/chat' && !cale.startsWith('/chat/')) return null

      /*
       * SALVAREA DIN SETĂRI — ÎNAINTEA porții obișnuite, dinadins. Poarta de mai jos cere ca bula să
       * fie aprinsă la aplicația asta; dar îndrumările se scriu tocmai ca să fie gata ÎNAINTE de
       * aprindere, iar un admin căruia i s-a stins chatul trebuie să-și poată vedea și îndrepta ce a
       * scris. Paza aici e alta și e destulă: adminul aplicației + jetonul CSRF pereche cu cookie-ul.
       */
      if (cale === '/chat/setari') {
        if (req.method !== 'POST') return inexistent()
        if (!ctx.principal || !ctx.eAdmin) return inexistent()
        const inapoi = (f: string) =>
          new Response(null, { status: 303, headers: { location: `${ctx.prefix}/setari?f=${f}`, 'cache-control': 'no-store' } })
        if (!env.CONFIG) return inapoi('chat-rau')
        const formular = await req.formData()
        if (verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))) return inapoi('chat-rau')
        try {
          await scrieConfigAplicatie(
            env,
            cfg.aplicatie,
            normalizeazaAplicatie({
              indrumari: String(formular.get('indrumari') ?? ''),
              unelte: formular.getAll('u').map(String),
            }),
          )
        } catch {
          return inapoi('chat-rau')
        }
        return inapoi('chat-salvat')
      }

      if (!(await areVoie(env, ctx))) return inexistent()

      const chat = env.CHAT!
      const cap = { ...antete(env, req), [ANTET_ACTOR]: JSON.stringify(actorul(ctx)) }

      // Hârtia întoarsă de o acțiune. Nu stă pe internet: media n-are adresă publică, iar
      // aplicația o dă numai celui care are deja voie la chat.
      if (cale.startsWith('/chat/fisier/')) {
        if (!env.MEDIA) return inexistent()
        const cheie = decodeURIComponent(cale.slice('/chat/fisier/'.length))
        if (!CHEIE_BUNA.test(cheie)) return inexistent()
        const r = await env.MEDIA.fetch(
          `https://media.intern/fisier/${cheie.split('/').map(encodeURIComponent).join('/')}`,
        )
        if (!r.ok) return inexistent()
        return new Response(r.body, {
          status: 200,
          headers: {
            'content-type': r.headers.get('content-type') ?? 'application/octet-stream',
            'content-disposition': `inline; filename="${cheie.split('/').pop() ?? 'fisier'}"`,
            'cache-control': 'private, max-age=600',
          },
        })
      }

      // Istoricul discuției și STAREA lucrului: amândouă doar se citesc, amândouă merg mai departe
      // neschimbate. `/chat/stare` e ușa sondării — bula o întreabă la două-trei secunde cât
      // lucrează creierul, deci trebuie să fie ieftină și să nu ceară nimic în plus.
      if (req.method === 'GET' && (cale === '/chat/discutie' || cale === '/chat/stare')) {
        const id = new URL(req.url).searchParams.get('id') ?? ''
        const unde = cale === '/chat/stare' ? 'stare' : 'discutie'
        const r = await chat.fetch(`https://chat.intern/${unde}?id=${encodeURIComponent(id)}`, {
          headers: cap,
        })
        return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
      }

      if (req.method !== 'POST') return inexistent()

      /*
       * URCAREA UNUI FIȘIER (user, 18.09.2026, 22:20: „chatul trebuie să accepte fișiere Word (.docx)
       * sau .txt, poze și text ca și acum").
       *
       * Drumul, cap-coadă: multipart cu câmpul `fisier` (și, opțional, `text` — ce a scris omul odată
       * cu el) → limita, apoi lista albă → octeții în `media`, sub o cheie scrisă de server → cârligul
       * aplicației, dacă are unul → înapoi la bulă MESAJUL cu care merge mai departe. Bula îl trimite
       * singură pe `/chat/mesaj`, ca omul să nu mai apese încă o dată.
       *
       * ⚠️ OCTEȚII NU TREC PRIN MODEL, niciodată — nici poza, nici fișierul. Prin discuție trece doar
       * textul (la .docx/.txt) sau cheia (la poză), exact regula obiectelor din arhitectură.
       */
      if (cale === '/chat/urca') return await urca(req, env, ctxExec, ctx)

      const rute: Record<string, string> = {
        '/chat/mesaj': 'https://chat.intern/mesaj',
        '/chat/confirma': 'https://chat.intern/confirma',
        '/chat/sterge': 'https://chat.intern/sterge',
      }
      const catre = rute[cale]
      if (!catre) return inexistent()

      let corp: Record<string, unknown> = {}
      try {
        corp = (await req.json()) as Record<string, unknown>
      } catch {
        return json({ ok: false, mesaj: 'mesaj neînțeles' }, 400)
      }

      // Aplicația spune de unde vine întrebarea și cum îl cheamă pe om — chat-worker n-are
      // voie să țină nume, dar modelul se poartă altfel dacă știe cu cine vorbește.
      const dus = { ...corp, aplicatie: cfg.aplicatie, numeleOmului: ctx.numeleOmului ?? null }

      /*
       * MESAJUL, ÎN DOUĂ MIȘCĂRI (18.09.2026). Întâi scrierea mesajului omului, care ține o clipă și
       * întoarce `{conversatieId, inLucru:true}`; apoi lucrul adevărat, pornit aici și ținut aprins cu
       * `waitUntil`. Bula află răspunsul sondând `/chat/stare`.
       *
       * ⚠️ Răspunsul primei mișcări se citește AICI, ca să se afle discuția pe care lucrăm — de aceea
       * nu se mai trece corpul mai departe ca stream, ci se recompune. Un chat-worker care răspunde
       * altceva decât JSON (n-ar trebui) pleacă mai departe așa cum a venit.
       */
      if (cale === '/chat/mesaj') {
        const r = await chat.fetch(catre, { method: 'POST', headers: cap, body: JSON.stringify({ ...dus, asincron: true }) })
        const brut = await r.text()
        let date: Record<string, unknown> | null = null
        try {
          date = JSON.parse(brut) as Record<string, unknown>
        } catch {
          date = null
        }
        if (!date) {
          return new Response(brut, { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
        }
        if (r.ok && date.inLucru && typeof date.conversatieId === 'string') {
          tineAprins(
            ctxExec,
            chat.fetch('https://chat.intern/lucreaza', {
              method: 'POST',
              headers: cap,
              body: JSON.stringify({ ...dus, conversatieId: date.conversatieId, mesajId: date.mesajId ?? null }),
            }),
          )
        }
        return json(date, r.status)
      }

      const r = await chat.fetch(catre, {
        method: 'POST',
        headers: cap,
        body: JSON.stringify(dus),
      })
      return new Response(r.body, {
        status: r.status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      })
    },
  }
}
