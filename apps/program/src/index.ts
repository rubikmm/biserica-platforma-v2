/**
 * A2 · Programul liturgic — pe platforma V2.
 *
 * Rute:
 *   /v1/…, /health            API-ul contractului, deschis (jos, `api`)
 *   /                         saptamana curenta                       ┐ pagini de om, DESCHISE:
 *   /saptamana/<data>         saptamana care contine data: programul  │ programul scris (importat
 *                             scris, iar daca nu e — PROPUNEREA ei    │ din V1) sau propunerea
 *   /arhiva                   toate saptamanile, un an pe ecran       ┘ automata, aceeasi afisare
 *   /abonare · /dezabonare    POST: audienta `program-abonati` a comunicarii (cere cont)
 *
 * Scrierea si validarea manuala (/admin) au fost scoase la cererea userului (10.09.2026:
 * „nu vreau să fac nimic manual").
 */
import { SCOPE_GLOBAL, SESIUNE_ANONIMA, type IntrareVocabular, type Slujba } from '@xc/contracts'
import { eAdminulAplicatiei } from '@xc/authorization'
import { principalDin, sesiuneCurenta, verificaCsrf } from '@xc/auth'
import { adresaPaginii, citesteConfig, navigatieDin, prefixSiCale } from '@xc/config'
import { golesteOutbox } from '@xc/events'
import { Logger, correlationId } from '@xc/observability'
import { adaugaZile, aziBucuresti, dataCeruta, dataVersiunii, eDataValida, eroareApi, html, intervalLizibil, json, jsonCuEtag, luneaSaptamanii, oraBucuresti, zileIntre } from '@xc/ui'
import pkg from '../package.json'
import {
  acoperire,
  aniiArhivei,
  saptamana,
  saptamanaDin,
  saptamanileAnului,
  saptamaniInterval,
  slujbaDin,
  slujbeInterval,
  slujbeleSaptamanii,
  urmatoareaSlujba,
  vecinele,
  vocabularul,
  arhivaIntreaga,
  cautaInVocabular,
  slujbaCurenta,
  slujbeTrecuteDupaNume,
  tiparele,
  urmatoareaDupaNume,
  type RandSaptamana,
} from './depozit.js'
import { hartieDinCache, jpgDin, jpgPozaDin, pdfDin, titluSaptamanii } from './foaie.js'
import { modulActiuni } from '@xc/actiuni'
import { modulChat } from '@xc/chat'
import { ACTIUNI } from './actiuni.js'
import { htmlFoaiaSaptamanii, htmlPozaSaptamanii, htmlSfintiiZilei, materiaSaptamanii, saptamanaOriPropunere, tabelulSaptamanii, textSaptamanii } from './hartii.js'
import { listaPrimeiPagini } from './site.js'
import { ruteazaSetari } from '@xc/setari'
import { abonamentul, ruteazaAbonare } from '@xc/abonare'
import { LATIME_POZA, type Ctx, type Meniu, paginaArhiva, paginaCarcasa, paginaMesaj, paginaSaptamana } from './pagini.js'

export interface Env {
  DB: D1Database
  IDENTITATE: Fetcher
  AUTORIZARE: Fetcher
  AUDIT: Fetcher
  CALENDAR: Fetcher
  TIPIC: Fetcher
  COMUNICARE: Fetcher
  BROWSER: Fetcher
  /** Locul in care se aseaza hartiile care circula (obiectele). */
  MEDIA: Fetcher
  /** Creierul modulului de Chat; lipsa lui inseamna doar ca bula nu se aprinde. */
  CHAT?: Fetcher
  /** Comutatoarele modulelor, scrise din panoul de admin. */
  CONFIG?: KVNamespace
  EVENIMENTE: Queue
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  /** Secretul dintre workerii nostri; fara el `/_actiuni` nu exista. */
  SECRET_INTERN?: string
  /** Data publicarii, pentru subsol — binding-ul `version_metadata`. */
  VERSIUNE?: { timestamp?: string }
}

/**
 * Lista de verbe a programului, publicata la `/_actiuni` (vezi `actiuni.ts` si
 * docs/architecture/chat-si-actiuni.md). Se construieste o data pe izolat.
 */
/** Modulul de Chat: rutele `/chat/*` si bula. Se aprinde din `apps/admin`, per aplicatie. */
const CHAT = modulChat({ aplicatie: 'program', titlu: 'Întreabă' })

const MODUL = modulActiuni<Env>({ aplicatie: 'program', versiune: pkg.version, actiuni: ACTIUNI })

const SERVICIU = 'app-program'
/** Audienta abonatilor — numele ei sta in registrul `ABONAMENTE` din `@xc/abonare`, nu aici. */
const ABONAMENT = abonamentul('program')
const CACHE_PAGINI = 'public, max-age=300'

function redirect(catre: string, antete: Record<string, string> = {}): Response {
  return new Response(null, { status: 303, headers: { location: catre, ...antete } })
}
async function scrieAudit(env: Env, i: { action: string; target: string; outcome: 'success' | 'failure' | 'denied'; correlationId: string; actorId?: string; summary?: Record<string, unknown> }): Promise<void> {
  try {
    await env.AUDIT.fetch('https://audit.intern/scrie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: i.action, target: i.target, scope: SCOPE_GLOBAL, actor: i.actorId ? { type: 'user', id: i.actorId } : { type: 'system' }, outcome: i.outcome, correlationId: i.correlationId, summary: i.summary ?? {} }),
    })
  } catch {
    // auditul indisponibil nu blocheaza operatia
  }
}
async function comunicare<T = unknown>(env: Env, cale: string, corp: unknown): Promise<T | null> {
  try {
    const r = await env.COMUNICARE.fetch(`https://comunicare.intern${cale}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corp) })
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}
// `eAbonat` (intrebarea „e omul pe lista?", pusa la fiecare pagina) a iesit odata cu butonul de abonare
// din antet (user, 10.09.2026: „abonează-te iese de tot momentan"). Rutele de mai jos raman intacte.

const eAdresaDeMasina = (cale: string) => /^\/(v1|intern|\.well-known|health)(\/|$)/.test(cale)

// Navigarea nu mai are „vecini": cele trei trepte (saptamana trecuta, cea de azi, cea urmatoare) se
// socotesc in pagina, din ziua de azi — „este o navigare, dar nu este un istoric" (user, 10.09.2026).
// Antetul are nevoie doar de lunea saptamanii de pe ecran, ca sa stie pe care treapta se afla.

async function vocabularHarta(env: Env): Promise<{ lista: IntrareVocabular[]; harta: Map<string, IntrareVocabular> }> {
  const lista = await vocabularul(env.DB)
  return { lista, harta: new Map(lista.map((v) => [v.cod_nume, v])) }
}

/** Slujbele unei saptamani + starea ei; daca nu e scrisa, propunerea in aceeasi forma. */
export default {
  async fetch(req: Request, env: Env, ctxExec: ExecutionContext): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: SERVICIU, correlationId: cid })
    const url = new URL(req.url)
    const { prefix, cale } = prefixSiCale(url, '/program')
    const nav = navigatieDin(cfg)
    const azi = aziBucuresti()
    /** Singura deosebire ramasa fata de public: in dev paginile nu se cacheaza (vezi `cachePagina`). */
    const eDev = env.MEDIU === 'dev'

    // Actiunile interne: raspund DOAR prin Service Binding, cu secretul platformei. De pe
    // internet calea nu exista (404), deci nu se amesteca nici cu paginile, nici cu `/v1`.
    const raspunsActiuni = await MODUL.ruteaza(req, env, ctxExec, cale)
    if (raspunsActiuni) return raspunsActiuni

    if (eAdresaDeMasina(cale)) {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, HEAD, OPTIONS', 'access-control-allow-headers': 'if-none-match, content-type' } })
      if (req.method !== 'GET' && req.method !== 'HEAD') return eroareApi(405, 'metoda_nepermisa', 'Sub /v1 merg doar GET, HEAD și OPTIONS.')
      try {
        return await api(req, env, ctxExec, cale, url, azi, prefix)
      } catch (e) {
        log.error('eroare api', { eroare: e instanceof Error ? e.message : String(e) })
        return eroareApi(500, 'eroare_interna', 'A apărut o eroare neașteptată.')
      }
    }

    // Meniul paginilor care nu tin de o saptamana anume (arhiva, adresele gresite): `luni: null`, deci
    // navigarea le arata pe toate trei ca destinatii, niciuna marcata.
    const meniuAzi = (rest: Partial<Meniu> = {}): Meniu => ({ luni: null, foaie: null, azi, ...rest })

    if (req.method === 'POST') {
      const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA], cfg.MEDIU === 'dev')
      if (problema) {
        const ctxMinim: Ctx = { prefix, nav, utilizator: null, eAdmin: false, versiune: pkg.version, modificata: dataVersiunii(env.VERSIUNE) }
        return html(paginaMesaj(ctxMinim, 'Verificare de securitate', problema, 'rea', meniuAzi()), 403)
      }
    }
    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const principal = principalDin(sesiune)
    const eSuperAdminReal = sesiune.roles.some((r) => r.role === 'super-admin')
    /**
     * ⚠️ DOUA LUCRURI DEOSEBITE, din 18.09.2026:
     *  - `eAdminPlatforma` — din el iese DOAR randul „Administrare" din meniul contului (panoul
     *    platformei), unde un administrator de Program n-are ce face.
     *  - `eAdminProgram` — administratorul ACESTEI aplicatii, venit de la autorizare pe cheia ei
     *    (`program.write`). Pe el atarna tot ce e al Programului: arhiva, hartiile, sfintii zilei.
     * Pana atunci amandoua erau acelasi rol, deci nimeni nu putea fi admin numai la Program (cerere
     * user, 18.09.2026: „sa aiba toate capacitatea de a avea setat administratori… nu doar super-admin").
     *
     * ⚠️ Din 19.09.2026 randul „Administrare" e NUMAI al super-adminului (user: „un admin nu vede
     * altceva decat Setari") — deci `eAdminPlatforma` e chiar `eSuperAdminReal`. Rolul global
     * `admin` nu mai aprinde nimic aici; masca doar coboara, deci sub ea randul dispare oricum.
     */
    const eAdminPlatforma = eSuperAdminReal
    const eAdminProgram = await eAdminulAplicatiei(env.AUTORIZARE, cid, principal, 'program')
    const utilizatorReal = sesiune.user?.displayName ?? sesiune.user?.email ?? null
    // Cine esti si ce poti vine DOAR din sesiune — la fel pe local si pe public. Rolurile sosesc
    // deja trecute prin masca „vezi ca", asa ca aici nu mai e nimic de deosebit (user, 11.09.2026:
    // „să nu fie nicio diferență între testare și public"; modul de proba local a fost scos atunci).
    const ctx: Ctx = {
      prefix,
      nav,
      utilizator: utilizatorReal,
      // adresa contului, pentru fereastra de abonare: acolo se scrie in camp si se incuie, fiindca
      // abonarea platformei sta pe adresa contului, nu pe una scrisa de mana
      emailulContului: sesiune.user?.email ?? null,
      eAdmin: eAdminProgram,
      eAdminPlatforma,
      eSuperAdmin: eSuperAdminReal,
      versiune: pkg.version,
      modificata: dataVersiunii(env.VERSIUNE),
      veziCa: sesiune.veziCa,
      poateVedeaCa: sesiune.poateVedeaCa,
      spre: adresaPaginii(cfg, url),
    }

    // Modulul de Chat. Poarta (comutatorul din admin + drepturile omului) e in `@xc/chat`, intr-un
    // singur loc si pentru rute, si pentru bula: altfel o stingere din admin ar ascunde bula
    // lasand rutele deschise.
    const ctxChat = { prefix, principal, numeleOmului: ctx.utilizator, eAdmin: ctx.eAdmin }
    const raspunsChat = await CHAT.ruteaza(req, env, ctxExec, cale, ctxChat)
    if (raspunsChat) return raspunsChat
    ctx.chat = await CHAT.bula(env, ctxChat)

    try {
      const { harta } = await vocabularHarta(env)
      // In dev nu se tine cache: la o schimbare de afisare, pagina veche mai statea cinci minute in
      // browser si parea ca n-am facut nimic (patit pe 10.09.2026). Pe staging si in productie ramane cum era.
      // Sub masca „vezi ca" pagina e personala chiar cand n-are niciun nume pe ea (masca
      // „neautentificat"): cu `public, max-age=300` browserul o servea din propriul cache si dupa
      // ce masca fusese scoasa, deci butonul benzii de jos parea ca nu face nimic (user, 11.09.2026).
      const cachePagina = { 'cache-control': ctx.utilizator || ctx.veziCa ? 'private, no-store' : eDev ? 'no-store' : CACHE_PAGINI }

      // ---------------------------------------------------------- saptamana
      const mSapt = /^\/saptamana\/([^/]+)$/.exec(cale)
      if ((cale === '/' || mSapt) && req.method === 'GET') {
        const cerut = mSapt ? dataCeruta(mSapt[1]!, azi) : azi
        if (!cerut) return html(paginaMesaj(ctx, 'Dată greșită', 'Adresa e /saptamana/AAAA-LL-ZZ.', 'rea', meniuAzi()), 404)
        const luni = luneaSaptamanii(cerut)
        // ⚠️ Anii arhivei se cer O DATA CU saptamana, nu dupa ea: fasia care coboara din cheia
        // Arhivei (15.09.2026, 18:28) sta in antetul ORICAREI pagini, nu doar pe /arhiva. E o
        // intrebare numai a adminilor — cheia e a lor — si merge in paralel cu saptamana, ca pagina
        // sa nu astepte cu o interogare mai mult decat pana acum.
        const [s, ani] = await Promise.all([
          saptamanaOriPropunere(env, luni, harta),
          ctx.eAdmin ? aniiArhivei(env.DB) : Promise.resolve([] as number[]),
        ])
        // foaia A4 de pe usa exista doar pentru saptamanile validate; din propunere iese ciorna ei
        const foaie = s.rand ? (s.rand.stare === 'validat' ? `/v1/foaie/${luni}` : null) : `/v1/propunere/${luni}`
        return html(
          paginaSaptamana({
            ctx,
            luni,
            titlu: s.rand?.titlu || titluSaptamanii(luni),
            stare: s.rand?.stare ?? 'propunere',
            slujbe: s.slujbe,
            vocabular: harta,
            cal: s.cal,
            dinCalendar: s.dinCalendar,
            azi,
            // `?din=arhiva` — pus de linkurile din pagina arhivei; de el atarna butonul „Înapoi la
            // arhivă" si marcajul ramas pe segmentul Arhivei (user, 11.09.2026, 16:24)
            meniu: { luni, foaie, azi, ani, dinArhiva: url.searchParams.get('din') === 'arhiva' },
            nelamuriri: s.propunere?.nelamuriri,
          }),
          200,
          cachePagina,
        )
      }

      // ------------------------------------------------------------- arhiva
      if (cale === '/arhiva' && req.method === 'GET') {
        const ani = await aniiArhivei(env.DB)
        const cerut = Number(url.searchParams.get('an') ?? '')
        const an = ani.includes(cerut) ? cerut : (ani[0] ?? Number(azi.slice(0, 4)))
        const saptamani = await saptamanileAnului(env.DB, an)
        // ⚠️ `acoperire` NU se mai cere aici (15.09.2026, 19:22): ea slujea numai randului „N saptamani,
        // din AAAA pana azi", scos atunci din pagina. O interogare mai putin la fiecare deschidere.
        // PDF si JPG stinse: pe Arhiva nu e nicio saptamana in context (`meniuAzi` le lasa `foaie: null`)
        return html(paginaArhiva({ ctx, an, ani, saptamani, meniu: meniuAzi() }), 200, cachePagina)
      }

      /*
       * ABONAREA — drumul intreg sta in `@xc/abonare`, acelasi pentru toata platforma (user,
       * 15.09.2026). Programul da doar ce e al lui: randul din registru (audienta), carcasa in care
       * se scriu paginile si jurnalul. Intoarce `null` cand adresa nu e a abonarii.
       */
      const raspunsAbonare = await ruteazaAbonare(req, cale, env, {
        abonament: ABONAMENT,
        prefix,
        cfg,
        cid,
        principal,
        carcasa: (p) => paginaCarcasa(ctx, p),
        audit: (i) => scrieAudit(env, { ...i, correlationId: cid }),
      })
      if (raspunsAbonare) return raspunsAbonare

      // SETARILE — tot un singur loc, `@xc/setari` (user, 15.09.2026).
      const raspunsSetari = await ruteazaSetari(req, cale, env, {
        cod: 'program',
        nume: 'Programul',
        prefix,
        cfg,
        cid,
        principal,
        veziCa: ctx.veziCa,
        urlCont: nav.cont,
        urlTermeni: `${nav.home || ''}/termeni`,
        carcasa: (p) => paginaCarcasa(ctx, p),
        // Rubrica „Chat AI" — îndrumările și uneltele PROGRAMULUI, scrise de adminul lui
        // (user, 18.09.2026). Bucata vine din modul, la fel pentru toate aplicațiile.
        rubrici: ({ csrf }) => CHAT.rubricaSetari(env, ctxChat, { csrf }),
      })
      if (raspunsSetari) return raspunsSetari

      // ca in V1: titlul si cele doua linkuri, sub antetul intreg
      return html(paginaMesaj(ctx, 'Nu există pagina', '', 'info', meniuAzi()), 404)
    } catch (e) {
      log.error('eroare neasteptata', { eroare: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined })
      return html(paginaMesaj(ctx, 'Eroare', 'A apărut o eroare neașteptată.', 'rea', meniuAzi()), 500)
    }
  },

  async scheduled(_ev: ScheduledController, env: Env): Promise<void> {
    const rezultat = await golesteOutbox(env.DB, env.EVENIMENTE)
    if (rezultat.publicate > 0 || rezultat.esuate > 0) new Logger({ service: SERVICIU, correlationId: 'cron' }).info('outbox golit', rezultat)
  },
}

// ---------------------------------------------------------------------------
// API-ul `/v1`
// ---------------------------------------------------------------------------

const ANTETE_APP = { 'x-app': 'program' }

async function api(req: Request, env: Env, ctxExec: ExecutionContext, cale: string, url: URL, azi: string, prefix: string): Promise<Response> {
  const cache = { 'cache-control': 'public, max-age=300', ...ANTETE_APP }
  const { lista, harta } = await vocabularHarta(env)

  if (cale === '/health') {
    const ac = await acoperire(env.DB)
    return json({ ok: true, app: 'program', cod: 'A2', stare: ac.saptamani ? 'cu date' : 'fara date', date: ac, mediu: env.MEDIU, versiune: pkg.version, publicat: env.VERSIUNE?.timestamp ?? null, ora: new Date().toISOString() }, 200, { 'cache-control': 'no-store' })
  }

  if (cale === '/v1' || cale === '/v1/') {
    const ac = await acoperire(env.DB)
    return jsonCuEtag(req, {
      app: 'program',
      acoperire: ac,
      adrese: [
        { adresa: '/v1/saptamana/<data> · /v1/saptamana/azi', ce_da: 'slujbele săptămânii care conține data, cu starea ei' },
        { adresa: '/v1/zi/<data> · azi · maine', ce_da: 'slujbele unei zile' },
        { adresa: '/v1/azi', ce_da: 'slujbele de azi, cele care mai urmează, și următoarea' },
        { adresa: '/v1/urmatoarea', ce_da: 'următoarea slujbă, cel mult 21 de zile' },
        { adresa: '/v1/curenta', ce_da: 'slujba în curs acum (a început de cel mult trei ore), pentru live și radio' },
        { adresa: '/v1/saptamana/<data>.txt', ce_da: 'programul săptămânii ca text simplu, de citit sau de lipit' },
        { adresa: '/v1/cauta?slujba=', ce_da: 'când se face o slujbă, după nume: următoarea, ultimele dăți, obiceiul' },
        { adresa: '/v1/paternuri', ce_da: 'tiparele ultimilor doi ani: cât de des, în ce zile, la ce ore se face fiecare slujbă' },
        { adresa: '/v1/arhiva.json', ce_da: 'tot istoricul: săptămânile și slujbele, din 2014 până azi (mare)' },
        { adresa: '/v1/interval?de_la=&pana_la=', ce_da: 'slujbele și starea săptămânilor atinse (cel mult 366 de zile)' },
        { adresa: '/v1/saptamani?an=', ce_da: 'săptămânile din bază, cea mai nouă prima' },
        { adresa: '/v1/slujbe/vocabular', ce_da: 'cele 29 de nume, cu cod_nume, categorie, activ' },
        { adresa: '/v1/foaie/<data>.pdf|.jpg|.html', ce_da: 'foaia A4 de pe ușă — numai săptămâni validate' },
        { adresa: '/v1/propunere/<data>.pdf|.jpg|.html', ce_da: 'aceeași foaie, din propunerea săptămânii' },
        { adresa: '/v1/tabel-tipar?data=&strans=0|1|2', ce_da: 'tabelul săptămânii ca bucată de pagină (buletinul, pagina a patra): validat dacă e, altfel ce e disponibil — `stare` spune „validat" sau „propus"; `amprenta` și `modificat_la` spun dacă s-a schimbat de la ultima tipărire' },
        { adresa: '/v1/bucata-site?data=', ce_da: 'lista săptămânii în formatul primei pagini a site-ului parohiei (temporar, până trece apexul pe V2)' },
        { adresa: '/v1/poza/saptamana/<data>.jpg|.html?coloane=1|2', ce_da: 'poza paginii: programul singur (coloane=1) sau programul și calendarul, în două coloane (implicit)' },
        { adresa: '/v1/sfintii-zilei/<data>.pdf|.html', ce_da: 'sfinții zilei, din datele calendarului' },
      ],
      reguli: ['ora e de perete, Europe/București', 'cod_nume nu e niciodată null', 'foaia de pe ușă se tipărește numai din săptămâni validate; tabelul pentru buletin poate ieși din propunere, dar atunci spune stare=propus'],
    }, cache)
  }

  if (cale === '/v1/slujbe/vocabular') return jsonCuEtag(req, { vocabular: lista }, { 'cache-control': 'public, max-age=3600', ...ANTETE_APP })

  // Saptamana ca TEXT — aceeasi functie ca actiunea `program.text_saptamanii`.
  const mText = /^\/v1\/saptamana\/([^/]+)\.txt$/.exec(cale)
  if (mText) {
    const data = dataCeruta(mText[1]!, azi)
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / viitoare).')
    const luni = luneaSaptamanii(data)
    const rand = await saptamana(env.DB, luni)
    if (!rand) return eroareApi(404, 'saptamana_inexistenta', 'Săptămâna nu e în bază.', { de_la: luni, pana_la: adaugaZile(luni, 6) })
    const text = textSaptamanii(saptamanaDin(rand, await slujbeleSaptamanii(env.DB, luni)))
    return new Response(text, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', ...cache, ...ANTETE_APP } })
  }

  const mSapt = /^\/v1\/saptamana\/([^/]+)$/.exec(cale)
  if (mSapt) {
    const data = dataCeruta(mSapt[1]!, azi)
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / maine / viitoare).')
    const luni = luneaSaptamanii(data)
    const rand = await saptamana(env.DB, luni)
    if (!rand) return eroareApi(404, 'saptamana_inexistenta', 'Săptămâna nu e în bază.', { de_la: luni, pana_la: adaugaZile(luni, 6), vecine: await vecinele(env.DB, luni) })
    return jsonCuEtag(req, saptamanaDin(rand, await slujbeleSaptamanii(env.DB, luni)), cache)
  }

  const mZi = /^\/v1\/zi\/([^/]+)$/.exec(cale)
  if (mZi) {
    const data = dataCeruta(mZi[1]!, azi)
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / maine).')
    const luni = luneaSaptamanii(data)
    const rand = await saptamana(env.DB, luni)
    const slujbe = (await slujbeInterval(env.DB, data, data)).map(slujbaDin)
    return jsonCuEtag(req, { data, saptamana: { de_la: luni, pana_la: adaugaZile(luni, 6) }, stare: rand?.stare ?? null, slujbe }, cache)
  }

  // Slujba in curs, pentru live si radio — aceeasi functie ca actiunea `program.slujba_curenta`.
  if (cale === '/v1/curenta') {
    const ora = oraBucuresti()
    const r = await slujbaCurenta(env.DB, azi, ora)
    return jsonCuEtag(req, { acum: { data: azi, ora }, slujba: r ? slujbaDin(r) : null }, { 'cache-control': 'public, max-age=60', ...ANTETE_APP })
  }

  // Cand se face o slujba, dupa nume — aceeasi cautare ca `program.cauta_slujba`.
  if (cale === '/v1/cauta') {
    const nume = (url.searchParams.get('slujba') ?? '').trim()
    if (nume.length < 3) return eroareApi(400, 'cautare_scurta', 'Cer ?slujba= cu cel puțin 3 litere.')
    const potriviri = cautaInVocabular(lista, nume).slice(0, 3)
    if (!potriviri.length) return eroareApi(404, 'slujba_necunoscuta', `Nu cunosc nicio slujbă numită „${nume}".`)
    const tipare = await tiparele(env.DB, azi)
    const gasite = await Promise.all(
      potriviri.map(async (v) => ({
        slujba: { cod_nume: v.cod_nume, nume: v.nume },
        urmatoarea: await urmatoareaDupaNume(env.DB, v.cod_nume, azi).then((r) => (r ? slujbaDin(r) : null)),
        trecute: (await slujbeTrecuteDupaNume(env.DB, v.cod_nume, azi, 8)).map(slujbaDin),
        obicei: tipare.find((t) => t.cod_nume === v.cod_nume) ?? null,
      })),
    )
    return jsonCuEtag(req, { cautat: nume, gasite }, cache)
  }

  if (cale === '/v1/paternuri') {
    return jsonCuEtag(req, { azi, tipare: await tiparele(env.DB, azi) }, { 'cache-control': 'public, max-age=3600', ...ANTETE_APP })
  }

  if (cale === '/v1/arhiva.json') {
    const a = await arhivaIntreaga(env.DB)
    return jsonCuEtag(req, { facuta: azi, numar_saptamani: a.saptamani.length, numar_slujbe: a.slujbe.length, ...a }, { 'cache-control': 'public, max-age=3600', ...ANTETE_APP })
  }

  if (cale === '/v1/azi' || cale === '/v1/urmatoarea') {
    const ora = oraBucuresti()
    const urmatoareaRand = await urmatoareaSlujba(env.DB, azi, ora)
    const urmatoarea = urmatoareaRand ? slujbaDin(urmatoareaRand) : null
    if (cale === '/v1/urmatoarea') return jsonCuEtag(req, { acum: { data: azi, ora }, urmatoarea }, { 'cache-control': 'public, max-age=60', ...ANTETE_APP })
    const aleZilei = (await slujbeInterval(env.DB, azi, azi)).map(slujbaDin)
    return jsonCuEtag(req, { data: azi, ora, slujbe: aleZilei, urmeaza: aleZilei.filter((s) => s.ora >= ora), urmatoarea }, { 'cache-control': 'public, max-age=60', ...ANTETE_APP })
  }

  if (cale === '/v1/interval') {
    const deLa = url.searchParams.get('de_la') ?? ''
    const panaLa = url.searchParams.get('pana_la') ?? ''
    if (!eDataValida(deLa) || !eDataValida(panaLa)) return eroareApi(400, 'data_invalida', 'Cer de_la și pana_la ca AAAA-LL-ZZ.')
    if (deLa > panaLa) return eroareApi(400, 'interval_invers', 'de_la e după pana_la.')
    if (zileIntre(deLa, panaLa) >= 366) return eroareApi(400, 'interval_prea_lung', 'Cel mult 366 de zile odată.')
    const slujbe = (await slujbeInterval(env.DB, deLa, panaLa)).map(slujbaDin)
    const saptamani = (await saptamaniInterval(env.DB, deLa, panaLa)).map((s: RandSaptamana) => ({ de_la: s.luni, pana_la: s.duminica, stare: s.stare, validat_de: s.validat_de, validat_la: s.validat_la }))
    return jsonCuEtag(req, { de_la: deLa, pana_la: panaLa, saptamani, slujbe }, cache)
  }

  /*
   * Tabelul săptămânii ca bucată de pagină, pentru cine îl așază în hârtia lui — azi buletinul,
   * pe pagina a patra („rândat exact ca la tipar Program liturgic", user 17.09.2026).
   * Programul rămâne proprietarul formei: aici se cere, nu se copiază acolo.
   */
  if (cale === '/v1/tabel-tipar') {
    const data = dataCeruta(url.searchParams.get('data') ?? 'azi', azi)
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / viitoare).')
    // `strans=1` fără sfinții duminicii, `strans=2` și fără pericopă — când buletinul n-are loc
    const strans = Math.min(2, Math.max(0, Number(url.searchParams.get('strans') ?? '0') || 0)) as 0 | 1 | 2
    const t = await tabelulSaptamanii(env, data, harta, strans)
    if (!t.ok) return eroareApi(t.cod === 'saptamana_inexistenta' ? 404 : 409, t.cod, t.mesaj, t.detalii as Record<string, unknown> | undefined)
    return jsonCuEtag(req, t, cache)
  }

  /*
   * BUCATA PRIMEI PAGINI A SITE-ULUI PAROHIEI — TEMPORARĂ (user, 18.09.2026: „legătura cu site-ul
   * actual este o legătură temporară"). WordPress-ul de pe apex o cere de aici și o tipărește în
   * locul listei pe care preotul o tasta a doua oară în ACF. Se șterge odată cu trecerea apexului
   * pe V2, împreună cu `site.ts`.
   *
   * ⚠️ `stare` spune dacă săptămâna e validată sau doar propusă; cine o pune într-o pagină publică
   * fără loc de scris „PROPUS" ar trebui să ia numai `validat` (vezi bucata de PHP din `docs/`).
   */
  if (cale === '/v1/bucata-site') {
    const data = dataCeruta(url.searchParams.get('data') ?? 'azi', azi)
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / viitoare).')
    const { o, stare } = await materiaSaptamanii(env, data, harta)
    return jsonCuEtag(
      req,
      { ok: true, bucata: listaPrimeiPagini(o), titlu: o.titlu, de_la: o.luni, pana_la: o.duminica, slujbe: o.slujbe.length, stare },
      cache,
    )
  }

  if (cale === '/v1/saptamani') {
    const anText = url.searchParams.get('an')
    if (anText && !/^\d{4}$/.test(anText)) return eroareApi(400, 'an_invalid', 'Anul se scrie AAAA.')
    return jsonCuEtag(req, { saptamani: await saptamanileAnului(env.DB, anText ? Number(anText) : undefined) }, cache)
  }

  // ------------------------------------------------------------------ hartii
  const mFoaie = /^\/v1\/(foaie|propunere)\/([^/]+)\.(pdf|jpg|html)$/.exec(cale)
  if (mFoaie) {
    const fel = mFoaie[1] as 'foaie' | 'propunere'
    const data = dataCeruta(mFoaie[2]!, azi)
    const format = mFoaie[3] as 'pdf' | 'jpg' | 'html'
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / viitoare).')
    // Aceeasi foaie si pentru actiunea `program.foaia_saptamanii` — vezi `hartii.ts`.
    const f = await htmlFoaiaSaptamanii(env, data, fel, harta)
    if (!f.ok) return eroareApi(f.cod === 'saptamana_inexistenta' ? 404 : 409, f.cod, f.mesaj, f.detalii)
    if (format === 'html') return new Response(f.corp, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', ...ANTETE_APP } })
    try {
      return await hartieDinCache(req, ctxExec, f.corp, format, f.nume, () => (format === 'pdf' ? pdfDin(env.BROWSER, f.corp) : jpgDin(env.BROWSER, f.corp)))
    } catch (e) {
      return eroareApi(503, 'pdf_indisponibil', 'Tiparul nu e disponibil acum; încearcă peste un minut sau ia varianta .html.', { detaliu: e instanceof Error ? e.message.slice(0, 200) : '' })
    }
  }

  /*
   * POZA SAPTAMANII — pagina fotografiata, asa cum se vede pe ecran (cerere user, 11.09.2026). Se face
   * la cerere, prin Browser Rendering, si sta in cache-ul de muchie cu cheia pe amprenta HTML-ului —
   * deci se reface singura cand se schimba programul sau calendarul, si n-are nimic de intretinut.
   *
   * ⚠️ DOUA VARIANTE, cerute cu `?coloane=` (user, 11.09.2026: „să descarce varianta care se vede"):
   *   - `coloane=2` (si implicit, ca pana acum) — programul la stanga, calendarul la dreapta, adica
   *     prima pagina a aplicatiei;
   *   - `coloane=1` — doar programul, intr-o coloana, adica orice alta saptamana.
   * Implicitul a ramas cel vechi dinadins: adresa fara intrebare inseamna acelasi lucru ca inainte de
   * 11.09, deci nicio legatura veche nu-si schimba intelesul sub picioare.
   *
   * Cele doua nu se incurca in cache: cheia e adresa PLUS amprenta HTML-ului, iar HTML-urile difera.
   * Numele fisierului le desparte si pe disc — `program-<luni>` fata de `program-calendar-<luni>`.
   *
   * Sursa e aceeasi ca a paginii (`saptamanaOriPropunere`): saptamana scrisa, iar daca nu e — propunerea
   * ei. De aceea poza NU cere saptamana „validata", cum cere foaia A4 de pe usa: ea arata pagina, iar
   * pagina se vede oricum. Ce nu e gata isi poarta eticheta („propunere"), ca pe ecran.
   *
   * Varianta `.html` e pentru probe: Browser Rendering nu merge in container (lipsesc bibliotecile
   * Chrome), deci local poza se compara cu pagina asa.
   */
  const mPoza = /^\/v1\/poza\/saptamana\/([^/]+)\.(jpg|html)$/.exec(cale)
  if (mPoza) {
    const data = dataCeruta(mPoza[1]!, azi)
    const format = mPoza[2] as 'jpg' | 'html'
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / maine / viitoare).')
    const cuCalendar = url.searchParams.get('coloane') !== '1'
    // Ctx-ul pozei: fara om si fara drepturi. In poza nu se apasa nimic, deci butoanele adminului
    // nici nu apuca sa se scrie. Asezarea sta in `hartii.ts`, langa celelalte hartii.
    const ctxPoza: Ctx = {
      prefix,
      nav: navigatieDin(citesteConfig(env)),
      utilizator: null,
      eAdmin: false,
      versiune: pkg.version,
      modificata: dataVersiunii(env.VERSIUNE),
    }
    const poza = await htmlPozaSaptamanii(env, data, {
      ctx: ctxPoza,
      azi,
      cuCalendar,
      tema: url.searchParams.get('tema') === 'dark' ? 'dark' : 'light',
      vocabular: harta,
    })
    if (format === 'html') return new Response(poza.corp, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', ...ANTETE_APP } })
    try {
      return await hartieDinCache(req, ctxExec, poza.corp, 'jpg', poza.nume, () => jpgPozaDin(env.BROWSER, poza.corp, LATIME_POZA))
    } catch (e) {
      return eroareApi(503, 'poza_indisponibila', 'Poza nu se poate face acum; încearcă peste un minut sau ia varianta .html.', { detaliu: e instanceof Error ? e.message.slice(0, 200) : '' })
    }
  }

  const mSfinti = /^\/v1\/sfintii-zilei\/([^/]+)\.(pdf|html)$/.exec(cale)
  if (mSfinti) {
    const data = dataCeruta(mSfinti[1]!, azi)
    const format = mSfinti[2] as 'pdf' | 'html'
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / maine).')
    // Cum se aduna foaia (calendarul, apoi cartile tipicului, fara repetari) sta in `hartii.ts`:
    // un singur loc si pentru ruta asta, si pentru actiunea `program.foaia_sfintilor`.
    const foaie = await htmlSfintiiZilei(env, data, url.searchParams.get('sinaxar') === '1')
    if (!foaie) return eroareApi(502, 'calendar_indisponibil', 'Calendarul nu răspunde acum.')
    if (format === 'html') return new Response(foaie.corp, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600', ...ANTETE_APP } })
    try {
      return await hartieDinCache(req, ctxExec, foaie.corp, 'pdf', foaie.nume, () => pdfDin(env.BROWSER, foaie.corp))
    } catch (e) {
      return eroareApi(503, 'pdf_indisponibil', 'Tiparul nu e disponibil acum; încearcă peste un minut sau ia varianta .html.', { detaliu: e instanceof Error ? e.message.slice(0, 200) : '' })
    }
  }

  return eroareApi(404, 'adresa_inexistenta', 'Adresa nu există. Indexul e la /v1.')
}

export { titluSaptamanii, intervalLizibil }
