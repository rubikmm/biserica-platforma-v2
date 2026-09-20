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
import { egaleInTimpConstant, principalDin, sesiuneCurenta, verificaCsrf } from '@xc/auth'
import { adresaPaginii, citesteConfig, navigatieDin, prefixSiCale } from '@xc/config'
import { golesteOutbox } from '@xc/events'
import { Logger, correlationId } from '@xc/observability'
import { adaugaZile, aziBucuresti, dataCeruta, dataVersiunii, eDataValida, eroareApi, html, intervalLizibil, json, jsonCuEtag, luneaSaptamanii, oraBucuresti, zileIntre } from '@xc/ui'
import pkg from '../package.json'
import {
  acoperire,
  aniiArhivei,
  saptamana,
  saptamanaCurenta,
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
  eProgramata,
  treciLaValidat,
  slujbaCurenta,
  slujbeTrecuteDupaNume,
  tiparele,
  urmatoareaDupaNume,
  vedereaLui,
  LUMEA,
  VEDE_TOT,
  type RandSaptamana,
  type Vedere,
} from './depozit.js'
import { hartieDinCache, jpgDin, jpgPozaDin, pdfDin, titluSaptamanii } from './foaie.js'
import { ANTET_SECRET, modulActiuni } from '@xc/actiuni'
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

/**
 * Ce i se spune ENORIAȘULUI despre o săptămână nepublicată: că nu e publicată, și atât. Nu „propus",
 * nu „apare duminică la 12:00 dacă părintele apucă" — programul parohiei nu se anunță înainte de a fi
 * al parohiei. Ziua și ora se pot scrie fiindcă sunt REGULA casei, nu o făgăduință despre săptămâna
 * asta anume (aceeași clipă în care se dă și buletinul, la ieșirea de la Liturghie).
 */
const NEPUBLICAT = 'Programul nu e publicat încă.'
const SPUNE_NEPUBLICAT = 'Programul săptămânii apare duminică, la ora 12:00.'

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

/**
 * UȘA INTERNĂ (20.09.2026) — cererea vine de la alt worker al platformei, nu de pe internet.
 *
 * Cu ea, `/v1/*` se citește cu `VEDE_TOT`: buletinul are nevoie de programul săptămânii pe pagina a
 * patra CÂT E ÎNCĂ PROPUS, ca să-și socotească spațiul (user, 20.09.2026, 23:55: „Trebuie să putem
 * să lucrăm și la buletin cu un program în pagină, altfel nu putem calcula spațiul. Deci aș pune
 * refuz, dar întârzierea lucrului la buletin ar fi nejustificată"). Răspunsul spune limpede ce e:
 * `stare`, `publica`, `programata`, `apare` — vezi `SemneleSaptamanii`.
 *
 * ⚠️ ACELAȘI ANTET ȘI ACEEAȘI COMPARAȚIE ca la `/_actiuni` (`packages/actiuni/src/montare.ts`):
 * `x-xc-intern` cu `env.SECRET_INTERN`, în timp constant. Un secret nescris în mediu ÎNCHIDE ușa —
 * mai bine tăcut închisă decât tăcut deschisă.
 * ⚠️ Cererea internă nu vine niciodată prin cache-ul de muchie (merge pe Service Binding), dar
 * răspunsul ei tot se scrie `no-store`: o dată cachează cineva un răspuns cu ochii adminului sub o
 * adresă publică și săptămâna nepublicată ajunge afară pentru cinci minute.
 */
function eIntern(req: Request, env: Env): boolean {
  const secret = env.SECRET_INTERN
  const primit = req.headers.get(ANTET_SECRET)
  return !!secret && !!primit && egaleInTimpConstant(primit, secret)
}

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

    /**
     * LUNEA SĂPTĂMÂNII CURENTE — ultima PUBLICATĂ, nu cea calendaristică (20.09.2026). Se află o
     * singură dată, în `try`-ul de mai jos, și se dă tuturor antetelor: din ea ies bulina, zona de
     * scris („Săptămâna curentă") și săgeata. `null` cât n-o știm — paginile de dinainte de
     * interogare (verificarea CSRF, eroarea neașteptată) cad atunci pe săptămâna calendaristică, ca
     * până acum: un antet aproximativ e mai bun decât încă o interogare pe drumul erorii.
     */
    let lunaCurenta: string | null = null
    // Meniul paginilor care nu tin de o saptamana anume (arhiva, adresele gresite): `luni: null`, deci
    // navigarea le arata pe toate trei ca destinatii, niciuna marcata.
    const meniuAzi = (rest: Partial<Meniu> = {}): Meniu => ({ luni: null, foaie: null, azi, ...(lunaCurenta ? { curenta: lunaCurenta } : {}), ...rest })

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
      const [{ harta }, curenta] = await Promise.all([vocabularHarta(env), saptamanaCurenta(env.DB, azi)])
      lunaCurenta = curenta?.luni ?? null
      /** Adminul programului vede și săptămânile nepublicate; restul lumii, numai ce e `validat`. */
      const vedere: Vedere = vedereaLui(ctx.eAdmin)
      // In dev nu se tine cache: la o schimbare de afisare, pagina veche mai statea cinci minute in
      // browser si parea ca n-am facut nimic (patit pe 10.09.2026). Pe staging si in productie ramane cum era.
      // Sub masca „vezi ca" pagina e personala chiar cand n-are niciun nume pe ea (masca
      // „neautentificat"): cu `public, max-age=300` browserul o servea din propriul cache si dupa
      // ce masca fusese scoasa, deci butonul benzii de jos parea ca nu face nimic (user, 11.09.2026).
      const cachePagina = { 'cache-control': ctx.utilizator || ctx.veziCa ? 'private, no-store' : eDev ? 'no-store' : CACHE_PAGINI }

      // ---------------------------------------------------------- saptamana
      const mSapt = /^\/saptamana\/([^/]+)$/.exec(cale)
      if ((cale === '/' || mSapt) && req.method === 'GET') {
        /**
         * ⚠️ PE `/` SĂPTĂMÂNA E CEA CURENTĂ, adică ULTIMA PUBLICATĂ — nu cea în care cade ziua de
         * azi (user, 20.09.2026, 23:33). Duminică la 12:00, după ce ceasul a trecut săptămâna
         * următoare, EA se deschide aici, și la admin, și la enoriaș. Fără nimic publicat: adminul
         * capătă săptămâna calendaristică cu propunerea ei (ca până acum, că doar de acolo o
         * validează), iar lumea o pagină care spune cinstit că nu e nimic.
         */
        let luni: string
        if (mSapt) {
          const cerut = dataCeruta(mSapt[1]!, azi)
          if (!cerut) return html(paginaMesaj(ctx, 'Dată greșită', 'Adresa e /saptamana/AAAA-LL-ZZ.', 'rea', meniuAzi()), 404)
          luni = luneaSaptamanii(cerut)
          // săptămâna cerută anume: lumii i se dă numai dacă e publicată — altfel nu există, la fel
          // ca o adresă greșită. Adminul o deschide ca până acum, cu eticheta ei.
          if (!ctx.eAdmin && !(await saptamana(env.DB, luni, LUMEA))) {
            return html(paginaMesaj(ctx, NEPUBLICAT, SPUNE_NEPUBLICAT, 'info', meniuAzi()), 404)
          }
        } else if (lunaCurenta) {
          luni = lunaCurenta
        } else if (ctx.eAdmin) {
          luni = luneaSaptamanii(azi)
        } else {
          return html(paginaMesaj(ctx, NEPUBLICAT, SPUNE_NEPUBLICAT, 'info', meniuAzi()), 200, cachePagina)
        }
        // ⚠️ Anii arhivei se cer O DATA CU saptamana, nu dupa ea: fasia care coboara din cheia
        // Arhivei (15.09.2026, 18:28) sta in antetul ORICAREI pagini, nu doar pe /arhiva. E o
        // intrebare numai a adminilor — cheia e a lor — si merge in paralel cu saptamana, ca pagina
        // sa nu astepte cu o interogare mai mult decat pana acum.
        const [s, ani] = await Promise.all([
          saptamanaOriPropunere(env, luni, harta, vedere),
          ctx.eAdmin ? aniiArhivei(env.DB, vedere) : Promise.resolve([] as number[]),
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
            meniu: { luni, foaie, azi, ani, curenta: lunaCurenta ?? undefined, dinArhiva: url.searchParams.get('din') === 'arhiva' },
            // Programarea se SPUNE numai adminului programului (20.09.2026). Pentru restul lumii
            // săptămâna rămâne „propus", fiindcă asta scrie pe ea în bază — programul n-a fost
            // validat încă, doar și-a primit ceasul. Pagina adminului e oricum `private, no-store`.
            programata: ctx.eAdmin && eProgramata(s.rand),
            nelamuriri: s.propunere?.nelamuriri,
          }),
          200,
          cachePagina,
        )
      }

      // ------------------------------------------------------------- arhiva
      if (cale === '/arhiva' && req.method === 'GET') {
        // Arhiva lumii are numai săptămâni PUBLICATE (cele vechi sunt oricum toate validate); a
        // adminului, tot ce e în bază. Aceeași cernere, același loc — `vedere`.
        const ani = await aniiArhivei(env.DB, vedere)
        const cerut = Number(url.searchParams.get('an') ?? '')
        const an = ani.includes(cerut) ? cerut : (ani[0] ?? Number(azi.slice(0, 4)))
        const saptamani = await saptamanileAnului(env.DB, vedere, an)
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

  /**
   * CEASUL WORKERULUI (cronul din `wrangler.jsonc`, din cinci în cinci minute) — două treburi.
   *
   * 1. SĂPTĂMÂNILE PROGRAMATE cărora le-a venit clipa trec pe `validat` (20.09.2026). Trecerea scrie
   *    și `program.week.validated.v1` în outbox — anunțul parohiei —, deci golirea vine DUPĂ ea, în
   *    aceeași bătaie: altfel anunțul ar fi așteptat degeaba încă cinci minute.
   * 2. OUTBOX-ul, ca până acum.
   *
   * ⚠️ IDEMPOTENT: `treciLaValidat` nu găsește nimic a doua oară (vezi `depozit.ts`), deci cele 288
   * de bătăi zilnice nu scriu nimic în zilele obișnuite și nu umplu istoricul cu duplicate.
   *
   * ⚠️ TREABA ÎNTÂI NU ARE VOIE S-O ÎNECE PE A DOUA. Golirea outbox-ului e nervul aplicației și era
   * aici de la început; trecerea săptămânilor s-a așezat ÎNAINTEA ei. Dacă migrația `0003` n-a apucat
   * să fie rulată pe mediul acela (ordinea e migrația, apoi workerul — dar se încurcă ușor),
   * interogarea de aici cade cu „no such column: programat_la" și, lăsată să curgă, ar fi oprit TOATE
   * evenimentele programului, nu doar programarea. Se scrie în jurnal ca eroare și se merge mai
   * departe: raza greșelii rămâne cât lucrul cel nou.
   */
  async scheduled(_ev: ScheduledController, env: Env): Promise<void> {
    const log = new Logger({ service: SERVICIU, correlationId: 'ceas' })
    try {
      const trecute = await treciLaValidat(env.DB, new Date(), 'ceas')
      if (trecute.length) log.info('saptamani programate, trecute la validat', { saptamani: trecute.map((s) => s.luni), validat_la: trecute.map((s) => s.validat_la) })
    } catch (e) {
      log.error('trecerea saptamanilor programate a cazut', { eroare: e instanceof Error ? e.message : String(e) })
    }
    const rezultat = await golesteOutbox(env.DB, env.EVENIMENTE)
    if (rezultat.publicate > 0 || rezultat.esuate > 0) log.info('outbox golit', rezultat)
  },
}

// ---------------------------------------------------------------------------
// API-ul `/v1`
// ---------------------------------------------------------------------------

const ANTETE_APP = { 'x-app': 'program' }

async function api(req: Request, env: Env, ctxExec: ExecutionContext, cale: string, url: URL, azi: string, prefix: string): Promise<Response> {
  /**
   * CU CE OCHI CITEȘTE `/v1` (20.09.2026): ale LUMII, afară de cererile care poartă antetul intern.
   * O singură hotărâre, la intrarea în API — nu una pe rută.
   * ⚠️ `no-store` la ușa internă: un răspuns cu ochii adminului n-are voie să ajungă în niciun cache
   * de sub adresa publică.
   */
  const intern = eIntern(req, env)
  const vedere: Vedere = intern ? VEDE_TOT : LUMEA
  const cu = (spec: string) => ({ 'cache-control': intern ? 'private, no-store' : spec, ...ANTETE_APP })
  const cache = cu('public, max-age=300')
  /** 404-ul săptămânii nepublicate — o singură formă, pe care buletinul și WordPress-ul o cunosc. */
  const nepublicat = (luni: string) =>
    json({ ok: false, cod: 'nepublicat', mesaj: NEPUBLICAT, de_la: luni, pana_la: adaugaZile(luni, 6) }, 404, cu('public, max-age=60'))
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
      reguli: [
        'ora e de perete, Europe/București',
        'cod_nume nu e niciodată null',
        'public se văd numai săptămânile PUBLICATE (validate); una propusă ori programată nu există aici, iar `/v1/tabel-tipar` și `/v1/bucata-site` răspund 404 cod=nepublicat',
        '„săptămâna curentă" (data=azi) e ULTIMA PUBLICATĂ, nu săptămâna calendaristică: duminică de la 12:00 e deja cea care începe a doua zi',
        'răspunsurile publice stau 5 minute în cache, deci o săptămână apărută la 12:00 poate fi văzută cu până la 5 minute mai târziu',
        'foaia de pe ușă se tipărește numai din săptămâni validate; tabelul pentru buletin poate ieși din propunere, dar atunci spune stare=propus',
      ],
    }, cache)
  }

  if (cale === '/v1/slujbe/vocabular') return jsonCuEtag(req, { vocabular: lista }, { 'cache-control': 'public, max-age=3600', ...ANTETE_APP })

  // Saptamana ca TEXT — aceeasi functie ca actiunea `program.text_saptamanii`.
  const mText = /^\/v1\/saptamana\/([^/]+)\.txt$/.exec(cale)
  if (mText) {
    const data = dataCeruta(mText[1]!, azi)
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / viitoare).')
    const luni = luneaSaptamanii(data)
    const rand = await saptamana(env.DB, luni, vedere)
    if (!rand) return eroareApi(404, 'saptamana_inexistenta', 'Săptămâna nu e în bază.', { de_la: luni, pana_la: adaugaZile(luni, 6) })
    const text = textSaptamanii(saptamanaDin(rand, await slujbeleSaptamanii(env.DB, luni, vedere)))
    return new Response(text, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', ...cache, ...ANTETE_APP } })
  }

  const mSapt = /^\/v1\/saptamana\/([^/]+)$/.exec(cale)
  if (mSapt) {
    const data = dataCeruta(mSapt[1]!, azi)
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / maine / viitoare).')
    const luni = luneaSaptamanii(data)
    const rand = await saptamana(env.DB, luni, vedere)
    if (!rand) return eroareApi(404, 'saptamana_inexistenta', 'Săptămâna nu e în bază.', { de_la: luni, pana_la: adaugaZile(luni, 6), vecine: await vecinele(env.DB, luni, vedere) })
    return jsonCuEtag(req, saptamanaDin(rand, await slujbeleSaptamanii(env.DB, luni, vedere)), cache)
  }

  const mZi = /^\/v1\/zi\/([^/]+)$/.exec(cale)
  if (mZi) {
    const data = dataCeruta(mZi[1]!, azi)
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / maine).')
    const luni = luneaSaptamanii(data)
    const rand = await saptamana(env.DB, luni, vedere)
    const slujbe = (await slujbeInterval(env.DB, data, data, vedere)).map(slujbaDin)
    return jsonCuEtag(req, { data, saptamana: { de_la: luni, pana_la: adaugaZile(luni, 6) }, stare: rand?.stare ?? null, slujbe }, cache)
  }

  // Slujba in curs, pentru live si radio — aceeasi functie ca actiunea `program.slujba_curenta`.
  if (cale === '/v1/curenta') {
    const ora = oraBucuresti()
    const r = await slujbaCurenta(env.DB, azi, ora, vedere)
    return jsonCuEtag(req, { acum: { data: azi, ora }, slujba: r ? slujbaDin(r) : null }, cu('public, max-age=60'))
  }

  // Cand se face o slujba, dupa nume — aceeasi cautare ca `program.cauta_slujba`.
  if (cale === '/v1/cauta') {
    const nume = (url.searchParams.get('slujba') ?? '').trim()
    if (nume.length < 3) return eroareApi(400, 'cautare_scurta', 'Cer ?slujba= cu cel puțin 3 litere.')
    const potriviri = cautaInVocabular(lista, nume).slice(0, 3)
    if (!potriviri.length) return eroareApi(404, 'slujba_necunoscuta', `Nu cunosc nicio slujbă numită „${nume}".`)
    const tipare = await tiparele(env.DB, azi, vedere)
    const gasite = await Promise.all(
      potriviri.map(async (v) => ({
        slujba: { cod_nume: v.cod_nume, nume: v.nume },
        urmatoarea: await urmatoareaDupaNume(env.DB, v.cod_nume, azi, vedere).then((r) => (r ? slujbaDin(r) : null)),
        trecute: (await slujbeTrecuteDupaNume(env.DB, v.cod_nume, azi, vedere, 8)).map(slujbaDin),
        obicei: tipare.find((t) => t.cod_nume === v.cod_nume) ?? null,
      })),
    )
    return jsonCuEtag(req, { cautat: nume, gasite }, cache)
  }

  if (cale === '/v1/paternuri') {
    return jsonCuEtag(req, { azi, tipare: await tiparele(env.DB, azi, vedere) }, cu('public, max-age=3600'))
  }

  if (cale === '/v1/arhiva.json') {
    const a = await arhivaIntreaga(env.DB, vedere)
    return jsonCuEtag(req, { facuta: azi, numar_saptamani: a.saptamani.length, numar_slujbe: a.slujbe.length, ...a }, cu('public, max-age=3600'))
  }

  if (cale === '/v1/azi' || cale === '/v1/urmatoarea') {
    const ora = oraBucuresti()
    // ⚠️ AICI ATÂRNĂ LIVE-UL: `apps/live/src/program.ts` cere `/v1/urmatoarea` pe Service Binding,
    // FĂRĂ antet intern — deci cu ochii lumii, deci transmisiunea pornește numai din săptămâni
    // publicate (user, 20.09.2026, confirmat anume). Forma răspunsului n-a fost atinsă.
    const urmatoareaRand = await urmatoareaSlujba(env.DB, azi, ora, vedere)
    const urmatoarea = urmatoareaRand ? slujbaDin(urmatoareaRand) : null
    if (cale === '/v1/urmatoarea') return jsonCuEtag(req, { acum: { data: azi, ora }, urmatoarea }, cu('public, max-age=60'))
    const aleZilei = (await slujbeInterval(env.DB, azi, azi, vedere)).map(slujbaDin)
    return jsonCuEtag(req, { data: azi, ora, slujbe: aleZilei, urmeaza: aleZilei.filter((s) => s.ora >= ora), urmatoarea }, cu('public, max-age=60'))
  }

  if (cale === '/v1/interval') {
    const deLa = url.searchParams.get('de_la') ?? ''
    const panaLa = url.searchParams.get('pana_la') ?? ''
    if (!eDataValida(deLa) || !eDataValida(panaLa)) return eroareApi(400, 'data_invalida', 'Cer de_la și pana_la ca AAAA-LL-ZZ.')
    if (deLa > panaLa) return eroareApi(400, 'interval_invers', 'de_la e după pana_la.')
    if (zileIntre(deLa, panaLa) >= 366) return eroareApi(400, 'interval_prea_lung', 'Cel mult 366 de zile odată.')
    const slujbe = (await slujbeInterval(env.DB, deLa, panaLa, vedere)).map(slujbaDin)
    const saptamani = (await saptamaniInterval(env.DB, deLa, panaLa, vedere)).map((s: RandSaptamana) => ({ de_la: s.luni, pana_la: s.duminica, stare: s.stare, validat_de: s.validat_de, validat_la: s.validat_la }))
    return jsonCuEtag(req, { de_la: deLa, pana_la: panaLa, saptamani, slujbe }, cache)
  }

  /*
   * Tabelul săptămânii ca bucată de pagină, pentru cine îl așază în hârtia lui — azi buletinul,
   * pe pagina a patra („rândat exact ca la tipar Program liturgic", user 17.09.2026).
   * Programul rămâne proprietarul formei: aici se cere, nu se copiază acolo.
   */
  /**
   * ZIUA CERUTĂ, CU OCHII LUMII, pentru cele două rute care pun programul în pagina altuia.
   *
   * ⚠️ `data=azi` (ori lipsa lui) NU înseamnă „săptămâna în care cade ziua de azi", ci SĂPTĂMÂNA
   * CURENTĂ — ultima publicată. Toată regula 1 a userului stă în deosebirea asta: duminică la 12:05,
   * `azi` e încă în săptămâna care se încheie, dar programul curent e al săptămânii care începe
   * mâine — cea tocmai apărută, cea tipărită în buletinul pe care omul tocmai l-a primit.
   * O dată anume rămâne o dată anume, și se dă numai dacă săptămâna ei e publicată.
   */
  const ziuaPublica = async (brut: string, data: string): Promise<{ data: string } | Response> => {
    if (vedere.vedeTot) return { data }
    if (brut === 'azi') {
      const c = await saptamanaCurenta(env.DB, azi)
      return c ? { data: c.luni } : nepublicat(luneaSaptamanii(data))
    }
    const luni = luneaSaptamanii(data)
    return (await saptamana(env.DB, luni, LUMEA)) ? { data } : nepublicat(luni)
  }

  if (cale === '/v1/tabel-tipar') {
    const brut = url.searchParams.get('data') ?? 'azi'
    const data = dataCeruta(brut, azi)
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / viitoare).')
    const zi = await ziuaPublica(brut, data)
    if (zi instanceof Response) return zi
    // `strans=1` fără sfinții duminicii, `strans=2` și fără pericopă — când buletinul n-are loc
    const strans = Math.min(2, Math.max(0, Number(url.searchParams.get('strans') ?? '0') || 0)) as 0 | 1 | 2
    const t = await tabelulSaptamanii(env, zi.data, vedere, harta, strans)
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
   * ⚠️ DE LA 20.09.2026, fără antetul intern, altceva decât `validat` nici nu mai iese pe aici —
   * WordPress-ul primește 404 și rămâne, cum face de la început, cu ultima copie bună.
   */
  if (cale === '/v1/bucata-site') {
    const brut = url.searchParams.get('data') ?? 'azi'
    const data = dataCeruta(brut, azi)
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / viitoare).')
    const zi = await ziuaPublica(brut, data)
    if (zi instanceof Response) return zi
    const { o, ...semne } = await materiaSaptamanii(env, zi.data, vedere, harta)
    return jsonCuEtag(
      req,
      { ok: true, bucata: listaPrimeiPagini(o), titlu: o.titlu, de_la: o.luni, pana_la: o.duminica, slujbe: o.slujbe.length, ...semne },
      cache,
    )
  }

  if (cale === '/v1/saptamani') {
    const anText = url.searchParams.get('an')
    if (anText && !/^\d{4}$/.test(anText)) return eroareApi(400, 'an_invalid', 'Anul se scrie AAAA.')
    return jsonCuEtag(req, { saptamani: await saptamanileAnului(env.DB, vedere, anText ? Number(anText) : undefined) }, cache)
  }

  // ------------------------------------------------------------------ hartii
  const mFoaie = /^\/v1\/(foaie|propunere)\/([^/]+)\.(pdf|jpg|html)$/.exec(cale)
  if (mFoaie) {
    const fel = mFoaie[1] as 'foaie' | 'propunere'
    const data = dataCeruta(mFoaie[2]!, azi)
    const format = mFoaie[3] as 'pdf' | 'jpg' | 'html'
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / viitoare).')
    // Aceeasi foaie si pentru actiunea `program.foaia_saptamanii` — vezi `hartii.ts`.
    // ⚠️ `VEDE_TOT`, și fără antet: HÂRTIILE au rămas cum erau (20.09.2026). Butonul de descărcare
    // din antet e al adminului, dar el cere adresele astea din BROWSER, fără secretul platformei —
    // cernute, adminul n-ar mai fi putut lua nici propunerea, nici poza săptămânii pe care tocmai o
    // are pe ecran. `/v1/foaie` se apără singură (cere `validat`); `/v1/propunere` dă o socoteală
    // făcută din istoric, nu rândurile nepublicate ale parohiei. `/v1/poza` rămâne singura care
    // arată rândurile din bază — vezi NOTES, „Vizibilitatea și săptămâna curentă".
    const f = await htmlFoaiaSaptamanii(env, data, fel, VEDE_TOT, harta)
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
      // ca hârtiile de mai sus: poza e unealta adminului, cerută din browser, fără secret
      vedere: VEDE_TOT,
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
