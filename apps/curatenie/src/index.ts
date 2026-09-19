/**
 * Curățenia bisericii (A6 din V1) — pe platforma V2.
 *
 * Programarea voluntarilor la duminici, pe poziții, plus rapoartele care ies din ea: alerta „mai e
 * nevoie de voluntari", raportul de sâmbătă și cel de la începutul lunii.
 *
 * Rute:
 *   /health                     starea bazei
 *   /                           programarea: calendarul duminicilor
 *   /faq                        întrebări frecvente (public)
 *   POST /alege                 numele ales din listă, fără cont („fantoma")
 *   POST /iesi                  uită numele ales (contul platformei nu se atinge)
 *   POST /api                   ocuparea / eliberarea unui slot, vacanța pe o lună
 *   /setari                     setările omului ȘI panoul: echipa, rapoarte, jurnal (`@xc/setari`)
 *   GET  /admin                 redirect la `/setari` (favoritele vechi), cu tot cu `?tab=`
 *   POST /admin                 scrierile panoului; se întorc la `/setari?tab=…`  (cleaning.manage)
 *   /admin/faq                  întrebările administratorilor                (cleaning.manage)
 *   /admin/curatare-arhiva      subțierea arhivei de rapoarte                (cleaning.manage)
 *   /cron                       pornirea ceasului cu mâna, pentru probe      (cleaning.manage)
 *
 * ⚠️ Patru lucruri care se încalcă ușor:
 *
 *  1. **Voluntarii sunt CONTURI ale platformei** (user, 14.09.2026). Aplicația nu mai ține nume,
 *     e-mail sau telefon: le cere de la identitate (`oameni.ts`).
 *  2. **FANTOMA e o excepție îngustă, nu o a doua autentificare** (user, 19.09.2026: „păstrăm
 *     intrarea fantomă doar cu numele… dacă vrea acces în platformă trebuie să intre pe Cont
 *     normal"). Omul neintrat își alege numele din listă, cookie-ul îl ține minte un an, și atât
 *     poate: **rezervări în calendar**. Poarta stă în `api.ts` (`CineApasa.fantoma`), nu în
 *     pagină. Cine a intrat cu CONTUL nu vede pickerul, iar cookie-ul rămas i se șterge.
 *  3. **Emailul nu pleacă de aici** — rapoartele se dau poștei platformei (`xc-communication`).
 *  4. **Apartenența la echipă se CERE, nu se ia**: omul apasă comutatorul „Curățenia" pe contul
 *     lui, iar un administrator al curățeniei îl primește din panou. Eticheta „Admin" NU mai e un
 *     desen — aprinderea ei acordă chiar `cleaning.manage`, deci un admin e numit numai de alt
 *     admin al curățeniei sau de un super-admin.
 *
 * ⚠️ Și un al patrulea, de ținut minte la cutover: **A6 din V1 e VIU și trimite singur** (alerta de
 * vineri, raportul de sâmbătă, cel lunar). Cât timp pe producție rutează V1, aici trimiterea merge
 * doar în nisipul comunicării — altfel cei 29 de voluntari ar primi câte două scrisori.
 */
import { asiguraCsrf, principalDin, sesiuneCurenta, verificaCsrf, verificaTokenCsrf } from "@xc/auth"
import { ClientAutorizare } from "@xc/authorization"
import { adresaPaginii, citesteConfig, navigatieDin, prefixSiCale } from "@xc/config"
import { SCOPE_GLOBAL, SESIUNE_ANONIMA } from "@xc/contracts"
import { Logger, correlationId } from "@xc/observability"
import { dataVersiunii, html, json } from "@xc/ui"
import pkg from "../package.json"
import { api, type CineApasa } from "./api.js"
import { citestePostAdmin, corpulPanoului, scriePanou, STIL_ADMIN, type MediuAdmin } from "./admin/index.js"
import { paginaFaqAdmin } from "./admin/faq.js"
import { paginaCuratareArhiva } from "./admin/cleanup.js"
import { numeleDuminicilor } from "./calendar.js"
import { ruleazaCeasul } from "./cron.js"
import { numar, numeScurt, voluntarDupaId } from "./depozit.js"
import { citestePost, duTe, text } from "./html.js"
import { idFantomaDinCookie, puneFantoma, uitaFantoma, voluntarulCurent, voluntarulFantoma } from "./identitate.js"
import { cuOameni, incarcaOamenii } from "./oameni.js"
import type { MediuRaport } from "./newsletter.js"
import { type Ctx, pagina, paginaMesaj } from "./pagina.js"
import { ruteazaSetari } from "@xc/setari"
import { paginaFaq } from "./pagini/faq.js"
import { paginaIndex } from "./pagini/index.js"
import { acum, ymdDin, zileInLuna } from "./timp.js"
import { lunaCurenta } from "./calendar.js"

export interface Env {
  DB: D1Database
  IDENTITATE: Fetcher
  AUTORIZARE: Fetcher
  COMUNICARE: Fetcher
  /** Venit pe 15.09.2026, odata cu zona de loguri din Setari. */
  AUDIT: Fetcher
  CALENDAR: Fetcher
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  /** Data publicarii, pentru subsol — binding-ul `version_metadata`. */
  VERSIUNE?: { timestamp?: string }
}

const SERVICIU = "app-curatenie"

/**
 * Paginile aplicației NU se cachează. Calendarul se schimbă de la o apăsare la alta (cineva își ia
 * un slot chiar acum), iar pe deasupra fiecare pagină are pe ea numele celui care se uită.
 */
const FARA_STOC = { "cache-control": "private, no-store" }

export default {
  async fetch(req: Request, env: Env, _ctxExec: ExecutionContext): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: SERVICIU, correlationId: cid })
    const url = new URL(req.url)
    const nav = navigatieDin(cfg)
    /*
     * ⚠️ Montajul se ia din MEDIU, nu din cale (lecția buletinului, 13.09.2026): prin gateway-ul de
     * preview aplicația stă sub `/curatenie`, dar pe subdomeniu stă la rădăcină, iar `prefixSiCale`
     * n-ar putea deosebi prefixul de o rută adevărată care începe cu același cuvânt. Curățenia n-are
     * astăzi nicio rută `/curatenie/…`, dar dacă apare vreodată, ea nu se mai taie singură.
     */
    let { prefix, cale } = prefixSiCale(url, env.MEDIU === "dev" ? "/curatenie" : "")

    // Adresele vechi ale V1, pe care le trimite încoace redirectul de pe cPanel după cutover.
    if (cale === "/faq.php") return Response.redirect(new URL(`${prefix}/faq`, url).toString(), 301)
    if (cale === "/api.php") cale = "/api"
    if (cale === "/admin/" || cale === "/admin/index.php") cale = "/admin"
    if (cale === "/admin/faq.php") cale = "/admin/faq"

    if (cale === "/health") {
      const voluntari = await numar(env.DB, `SELECT COUNT(*) FROM volunteers`)
      const programari = await numar(env.DB, `SELECT COUNT(*) FROM assignments`)
      return json({ ok: true, app: "curatenie", voluntari, programari, ora: new Date().toISOString() })
    }

    // ---------------------------------------------------------------- cine e
    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const principal = principalDin(sesiune)
    const authz = new ClientAutorizare(env.AUTORIZARE, cid)
    // Dreptul îl hotărăște autorizarea, și îl hotărăște SUB MASCĂ, dacă omul poartă una: `principal`
    // o duce cu el, deci „vezi ca utilizator" stinge panoul, cum se cuvine.
    const eAdmin = principal ? (await authz.can(principal, "cleaning.manage", SCOPE_GLOBAL)).allowed : false
    /*
     * ⚠️ Rolul GLOBAL, numai pentru randul „Administrare" din meniul contului (18.09.2026). Pana atunci
     * randul se scria pentru `eAdmin`, adica pentru cheia Curateniei — deci un administrator al
     * curateniei vedea o legatura spre panoul PLATFORMEI, care il intampina cu 403. Regula de acum, la
     * fel in toate aplicatiile: panoul platformei e al rolului global, panoul aplicatiei e al cheii ei.
     *
     * ⚠️ Din 19.09.2026 randul e NUMAI al super-adminului (user: „un admin nu vede altceva decat
     * Setari"). Masca doar coboara, deci sub orice masca randul dispare.
     */
    const eAdminPlatforma = sesiune.roles.some((r) => r.role === "super-admin")

    const numeCont = sesiune.user?.displayName ?? null
    const userId = sesiune.user?.id ?? null
    /*
     * Cartea oamenilor, cerută o dată pe cerere de la identitate, și legată de baza aplicației
     * pentru tot restul drumului (vezi `oameni.ts`). De aici încolo `db` e învelișul: rândurile
     * locale au doar `user_id`, iar numele li se lipesc din carte.
     */
    const db = cuOameni(env.DB, await incarcaOamenii(env))
    const voluntar = await voluntarulCurent(db, userId).catch(() => null)

    /*
     * FANTOMA — numele ales din listă, fără cont (user, 19.09.2026). Două reguli, amândouă aici:
     *  - cine a intrat cu CONTUL nu are fantomă, oricâte cookie-uri ar căra cu el;
     *  - cookie-ul care nu mai duce nicăieri (rândul șters, omul scos din echipă) se șterge, ca
     *    să nu rămână un nume mort în browser pentru încă un an.
     */
    const cookieFantoma = idFantomaDinCookie(req)
    const fantoma = userId ? null : await voluntarulFantoma(db, req).catch(() => null)
    const stergeFantoma = cookieFantoma !== null && fantoma === null

    // Jetonul CSRF trăiește patru ore într-un cookie propriu; fiecare formular al paginii îl scrie,
    // iar POST-ul îl cere înapoi.
    const csrf = asiguraCsrf(req, cfg.DOMENIU_COOKIE)
    const cuCookie = (antete: Record<string, string>) =>
      csrf.setCookie ? { ...antete, "set-cookie": csrf.setCookie } : antete

    const ctx: Ctx = {
      prefix,
      nav,
      csrf: csrf.jeton,
      utilizator: numeCont ?? sesiune.user?.email ?? null,
      userId,
      fantoma: fantoma ? numeScurt(fantoma) : null,
      eAdmin,
      eAdminPlatforma,
      versiune: pkg.version,
      modificata: dataVersiunii(env.VERSIUNE),
      veziCa: sesiune.veziCa,
      poateVedeaCa: sesiune.poateVedeaCa,
      spre: adresaPaginii(cfg, url),
    }

    const antete = cuCookie(FARA_STOC)

    /*
     * Răspunsul se face înăuntru, dar iese pe AICI, printr-o singură ușă: cookie-ul fantomei care
     * nu mai duce nicăieri trebuie șters de pe ORICE pagină, iar `html()` primește un singur antet
     * (`Record<string, string>`), deci al doilea `set-cookie` se adaugă pe răspunsul gata făcut.
     */
    const raspuns = await ruteaza()
    if (stergeFantoma) raspuns.headers.append("set-cookie", uitaFantoma(cfg.DOMENIU_COOKIE))
    return raspuns

    /**
     * Ce-i trebuie panoului din mediu, în afară de bază. Se face abia când panoul chiar se desenează
     * ori scrie ceva: poșta cere numele duminicilor de la calendar, iar paginile celorlalți n-au ce
     * face cu ele.
     */
    async function mediulPanoului(): Promise<MediuAdmin> {
      return {
        DB: db,
        posta: await postaDin(env, cfg.ORIGINE_PUBLICA, prefix),
        IDENTITATE: env.IDENTITATE,
        AUTORIZARE: env.AUTORIZARE,
        /** Cine apasă — se scrie pe asocierile pe care le primește sau le stinge. */
        actor: userId,
        cid,
      }
    }

    async function ruteaza(): Promise<Response> {
    try {
      if (req.method === "POST") {
        const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA], cfg.MEDIU === "dev")
        if (problema) return html(paginaMesaj(ctx, "Verificare de securitate", problema), 403, antete)
      }

      // ------------------------------------------------------- numele ales („fantoma")
      /*
       * ⚠️ Alegerea e o SCRIERE, deci merge pe POST cu jeton CSRF, ca orice faptă a aplicației —
       * altfel o poză `<img src="/alege?...">` de pe alt site ar putea pune un nume în browserul
       * cuiva. Adresele vechi cerute cu GET rămân redirect, nu 404: `?alege=1` a stat la favorite.
       */
      if (cale === "/alege" && req.method === "POST") {
        const post = await citestePost(req)
        const problema = verificaTokenCsrf(req, post.csrf ?? "")
        if (problema) return html(paginaMesaj(ctx, "Verificare de securitate", problema), 403, antete)
        // Cine a intrat cu contul nu-și alege un nume: ar fi al doilea „eu" pe aceeași pagină.
        if (userId) return duTe(`${prefix}/`)
        const v = await voluntarDupaId(db, parseInt(post.volunteer_id ?? "0", 10) || 0)
        if (!v || v.is_active !== 1 || v.is_volunteer !== 1) return duTe(`${prefix}/`)
        return duTe(`${prefix}/`, [puneFantoma(Number(v.id), cfg.DOMENIU_COOKIE)])
      }

      /*
       * „Nu ești tu?" — uită numai NUMELE ales. Sesiunea platformei nu se atinge: ea e a contului,
       * iar ieșirea din el se face din meniul contului, ca în toate aplicațiile V2.
       */
      if (cale === "/iesi" && req.method === "POST") {
        return duTe(`${prefix}/`, [uitaFantoma(cfg.DOMENIU_COOKIE)])
      }

      if (cale === "/alege" || cale === "/iesi") return duTe(`${prefix}/`)

      /*
       * SETARILE — un singur loc, `@xc/setari` (user, 15.09.2026). Curatenia e singura aplicatie
       * unde apare si rubrica APARTENENTEI: ea e singurul rand din `APLICATII_CU_MEMBRI`, deci omul
       * isi vede aici cererea de intrare in echipa si poate iesi din ea fara sa ceara voie.
       *
       * ⚠️ Si tot aici e PANOUL, de pe 19.09.2026 (user: „administrarea devine setări"): pagina
       * asta e singurul loc unde omul cauta ce tine de el in curatenie, oricare i-ar fi treapta.
       */
      const raspunsSetari = await ruteazaSetari(req, cale, env, {
        cod: "curatenie",
        nume: "Curățenia",
        prefix,
        cfg,
        cid,
        principal,
        veziCa: ctx.veziCa,
        urlCont: nav.cont,
        urlTermeni: `${nav.home || ""}/termeni`,
        // Carcasa poarta si stilul PANOULUI, pentru cine are cheia: filele lui au CSS-ul lor
        // (`STIL_ADMIN`), iar cartelele si tabelele cer latimea mare.
        carcasa: (p) =>
          pagina(ctx, {
            titluPagina: p.titluPagina,
            corp: p.corp,
            ...(p.scripturi ? { scripturi: p.scripturi } : {}),
            ...(eAdmin ? { local: STIL_ADMIN, lat: true } : {}),
          }),
        /*
         * PANOUL, ca rubrica a aplicatiei: dupa cele ale platformei (apartenenta, e-mailul,
         * administratorii numiti), fiindca acelea sunt ale oricui, iar el e al celui cu cheia.
         *
         * ⚠️ Jetonul CSRF e AL PAGINII SETARILOR, nu cel din `ctx`: `@xc/setari` isi face unul la
         * randare, si cookie-ul care pleaca odata cu pagina e al aceluia. Cu jetonul din `ctx`,
         * prima apasare din panou ar fi respinsa ca „token nepotrivit".
         */
        rubrici: async ({ eAdminApp, csrf }) =>
          eAdminApp ? corpulPanoului({ ...ctx, csrf }, await mediulPanoului(), url) : "",
      })
      if (raspunsSetari) return raspunsSetari

      if (cale === "/faq") return html(paginaFaq(ctx), 200, antete)

      // ------------------------------------------------------- apăsarea unui slot
      if (cale === "/api") {
        if (req.method !== "POST") return json({ ok: false, error: "Metodă invalidă." }, 405)
        const post = await citestePost(req)
        const problema = verificaTokenCsrf(req, post.csrf ?? "")
        if (problema) return json({ ok: false, error: problema }, 403)
        /*
         * ⚠️ Fantoma intră în `api` pe același loc ca un voluntar adevărat (`voluntar`), fiindcă
         * rezervarea e aceeași faptă — dar poartă steagul cu ea, iar `api.ts` îi taie tot restul.
         * Fără steag, numele ales din listă ar valora cât o sesiune.
         */
        const cine: CineApasa = {
          voluntar: voluntar ?? fantoma,
          eAdmin,
          numeCont,
          userId,
          fantoma: fantoma !== null,
        }
        return api(env, db, cine, post)
      }

      // ------------------------------------------------------- panoul
      /*
       * ⚠️ PANOUL NU MAI ARE PAGINA LUI (user, 19.09.2026). Ce a rămas sub `/admin`: ruta de
       * SCRIERE (acolo trimit formularele lui, oriunde s-ar vedea), cele două pagini cu viața lor
       * și un redirect spre Setări, ca favoritele și legăturile vechi să nu cadă.
       */
      if (cale === "/admin" || cale.startsWith("/admin/")) {
        if (!eAdmin) {
          /*
           * Neintrat: la intrarea platformei, cu întoarcere în Setări — acolo e panoul acum.
           *
           * ⚠️ DAR NU ȘI SUB MASCĂ (tiparul din `apps/radio`, user 14.09.2026: „când selectez un
           * mod… să rămână în pagina în care sunt"). Masca „neautentificat" lasă sesiunea fără om,
           * deci `userId` e gol pentru un super-admin care doar se uită cu alți ochi — trimis la
           * cont, ar fi aruncat tocmai din aplicația pe care o încerca. Drumul spre intrare rămâne
           * întreg pentru omul care chiar nu e intrat (fără mască).
           */
          if (!userId && !ctx.veziCa) return duTe(spreCont(ctx, cfg.ORIGINE_PUBLICA, "/setari"))
          // Intrat, dar fără cheie: Setările îi arată ce e al lui, fără o pagină de refuz. Refuzul
          // rămâne întreg pe SCRIERE: cine trimite formularul de mână se lovește de el.
          if (req.method !== "POST") return duTe(`${prefix}/setari`)
          return html(
            paginaMesaj(ctx, "Numai pentru administratori", "Panoul curățeniei cere permisiunea „cleaning.manage”."),
            403,
            antete,
          )
        }
        if (cale === "/admin/faq") return html(paginaFaqAdmin(ctx), 200, antete)

        if (cale === "/admin/curatare-arhiva") {
          return paginaCuratareArhiva(ctx, db, req, antete)
        }

        if (cale === "/admin") {
          if (req.method !== "POST") {
            // Aceeași filă, în pagina în care se vede acum panoul.
            const tab = url.searchParams.get("tab")
            return duTe(`${prefix}/setari${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`)
          }
          const postDat = await citestePostAdmin(req)
          const problema = verificaTokenCsrf(req, postDat.post.csrf ?? "")
          if (problema) return html(paginaMesaj(ctx, "Verificare de securitate", problema), 403, antete)
          return scriePanou(ctx, await mediulPanoului(), req, url, postDat)
        }

        return html(paginaMesaj(ctx, "Pagina nu există", "Adresa aceasta nu duce nicăieri în panou."), 404, antete)
      }

      /*
       * Ceasul pornit cu mâna — ce făcea `/cron/newsletter.php?key=…` în V1, dar fără cheie: poarta
       * e permisiunea `cleaning.manage`, ca la panou. Fără drept nu se pornește nimic; altfel oricine
       * ar putea face să plece rapoartele când vrea.
       */
      if (cale === "/cron") {
        if (!eAdmin) return text("Acces interzis.\n", 403)
        const posta = await postaDin(env, cfg.ORIGINE_PUBLICA, prefix)
        return text(await ruleazaCeasul(db, posta, url.searchParams.has("acum")))
      }

      // ------------------------------------------------------- programarea
      /*
       * `?intra=1` deschidea panoul de intrare din pagină, scos pe 19.09.2026: ușa spre platformă e
       * una singură, meniul contului. Adresa a stat la favorite, deci duce chiar unde ducea butonul.
       */
      if ((cale === "/" || cale === "") && url.searchParams.has("intra")) {
        return duTe(spreCont(ctx, cfg.ORIGINE_PUBLICA, "/"))
      }

      if (cale === "/" || cale === "") {
        // Numele duminicilor pentru cele trei luni care se pot vedea deodată (arhiva cerută, luna
        // curentă, luna viitoare) — o singură întrebare la calendar.
        const nume = await numeleDuminicilor(env.CALENDAR ?? null, ...intervalulPaginii(url))
        return html(await paginaIndex(ctx, db, req, url, voluntar, fantoma, nume), 200, antete)
      }

      return html(paginaMesaj(ctx, "Pagina nu există", "Adresa aceasta nu duce nicăieri la curățenie."), 404, antete)
    } catch (e) {
      log.error("eroare pagina", { eroare: e instanceof Error ? e.message : String(e) })
      return html(paginaMesaj(ctx, "A apărut o eroare", "Încearcă din nou peste puțin."), 500, antete)
    }
    }
  },

  /**
   * Ceasul rapoartelor, din oră în oră. El hotărăște singur, pe ora Bucureștiului, dacă e vremea
   * alertei, a raportului săptămânal ori a celui lunar — vezi `cron.ts`.
   */
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const log = new Logger({ service: SERVICIU, correlationId: "ceas" })
    const posta = await postaDin(env, env.ORIGINE_PUBLICA, "")
    // Și ceasul are nevoie de cartea oamenilor: rapoartele scriu nume și pleacă pe adresele lor.
    const db = cuOameni(env.DB, await incarcaOamenii(env))
    const raport = await ruleazaCeasul(db, posta, false)
    log.info("ceasul rapoartelor", { raport: raport.trim() })
  },
} satisfies ExportedHandler<Env>

/** Luna de după cea dată. */
function urmatoarea(y: number, m: number): [number, number] {
  return m === 12 ? [y + 1, 1] : [y, m + 1]
}

/**
 * Poșta platformei, adresa publică a aplicației (linkul „Deschideți calendarul") și numele
 * duminicilor, cerute de la calendar pentru luna de acum și cea viitoare — atât arată un raport:
 * cel săptămânal o duminică, cel lunar luna care vine.
 */
async function postaDin(env: Env, origine: string, prefix: string): Promise<MediuRaport> {
  const mo = acum()
  const [uy, um] = urmatoarea(mo.y, mo.m)
  return {
    COMUNICARE: env.COMUNICARE ?? null,
    acasa: `${origine}${prefix}/`,
    nume: await numeleDuminicilor(env.CALENDAR ?? null, ymdDin(mo.y, mo.m, 1), ymdDin(uy, um, zileInLuna(uy, um))),
  }
}

/**
 * Intervalul pe care îl arată pagina de programare: de la începutul celei mai vechi luni de pe ecran
 * (arhiva cerută, ori luna curentă) până la sfârșitul lunii viitoare. Numele duminicilor se cer o
 * dată, pe tot intervalul — `/v1/interval` primește cel mult 366 de zile odată, iar arhiva poate fi
 * mai veche de un an, deci se taie la 12 luni în urmă.
 */
function intervalulPaginii(url: URL): [string, string] {
  const mo = acum()
  const [cy, cm] = lunaCurenta(mo)
  const [uy, um] = urmatoarea(cy, cm)
  const panaLa = ymdDin(uy, um, zileInLuna(uy, um))

  const y = parseInt(url.searchParams.get("y") ?? "", 10)
  const m = parseInt(url.searchParams.get("m") ?? "", 10)
  const cerutaEValida = Number.isInteger(y) && y >= 2000 && y <= 2100 && Number.isInteger(m) && m >= 1 && m <= 12
  const inceputLunaCurenta = ymdDin(cy, cm, 1)
  const inceputCeruta = cerutaEValida ? ymdDin(y, m, 1) : inceputLunaCurenta
  const deLa = inceputCeruta < inceputLunaCurenta ? inceputCeruta : inceputLunaCurenta
  // Cel mult un an în urmă, ca întrebarea să rămână în limita calendarului.
  const celMaiDeparte = ymdDin(cy - 1, cm, 1)
  return [deLa < celMaiDeparte ? celMaiDeparte : deLa, panaLa]
}

/** Unde trimitem omul când pagina cere contul platformei. */
function spreCont(ctx: Ctx, origine: string, unde: string): string {
  return `${ctx.nav.cont}/intra?spre=${encodeURIComponent(`${origine}${ctx.prefix}${unde}`)}`
}
