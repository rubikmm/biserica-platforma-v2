/**
 * Curățenia bisericii (A6 din V1) — pe platforma V2.
 *
 * Programarea voluntarilor la duminici, pe poziții, plus rapoartele care ies din ea: alerta „mai e
 * nevoie de voluntari", raportul de sâmbătă și cel de la începutul lunii.
 *
 * Rute:
 *   /health                     starea bazei
 *   /                           programarea: lista de nume (pickerul) ori calendarul
 *   POST /alege                 numele ales din listă („modul simplu")
 *   /iesi                       uită numele ales (contul platformei rămâne, e al lui)
 *   /faq                        întrebări frecvente (public)
 *   POST /api                   ocuparea / eliberarea unui slot, vacanța pe o lună
 *   /admin                      panoul: voluntari, rapoarte, jurnal          (cleaning.manage)
 *   /admin/faq                  întrebările administratorilor               (cleaning.manage)
 *   /admin/curatare-arhiva      subțierea arhivei de rapoarte               (cleaning.manage)
 *   /cron                       pornirea ceasului cu mâna, pentru probe     (cleaning.manage)
 *
 * ⚠️ Trei lucruri care se încalcă ușor:
 *
 *  1. **Voluntarii sunt ai aplicației** — nume, e-mail și telefon stau în baza ei, iar omul se
 *     recunoaște alegându-și numele din listă, fără cont. E o abatere de la „datele stau într-un
 *     loc, autentificarea la fel", CERUTĂ ANUME de utilizator (13.09.2026): „pickerul rămâne, ca
 *     mod simplu". I s-a spus limpede ce aduce; a ales-o știind. Nu o „repara" înapoi.
 *  2. **Emailul nu pleacă de aici** — rapoartele se dau poștei platformei (`xc-communication`).
 *  3. **Dreptul de administrare e central** (`cleaning.manage`). `is_admin` din tabel a rămas doar
 *     etichetă a echipei: cine e „Admin" pe cartelă și primește rapoartele din oficiu.
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
import { citestePostAdmin, paginaAdmin } from "./admin/index.js"
import { paginaFaqAdmin } from "./admin/faq.js"
import { paginaCuratareArhiva } from "./admin/cleanup.js"
import { numeleDuminicilor } from "./calendar.js"
import { ruleazaCeasul } from "./cron.js"
import { numar, voluntarDupaId } from "./depozit.js"
import { citestePost, duTe, text } from "./html.js"
import { puneVoluntarul, uitaVoluntarul, voluntarulCurent } from "./identitate.js"
import type { MediuRaport } from "./newsletter.js"
import { type Ctx, pagina, paginaMesaj } from "./pagina.js"
import { paginaFaq } from "./pagini/faq.js"
import { paginaIndex } from "./pagini/index.js"
import { acum, ymdDin, zileInLuna } from "./timp.js"
import { lunaCurenta } from "./calendar.js"

export interface Env {
  DB: D1Database
  IDENTITATE: Fetcher
  AUTORIZARE: Fetcher
  COMUNICARE: Fetcher
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
      const voluntari = await numar(env.DB, `SELECT COUNT(*) FROM volunteers WHERE is_active = 1`)
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

    const numeCont = sesiune.user?.displayName ?? null
    const userId = sesiune.user?.id ?? null
    const voluntar = await voluntarulCurent(env.DB, req, userId, numeCont).catch(() => null)

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
      voluntar: voluntar ? `${voluntar.first_name} ${(voluntar.last_name ?? "").slice(0, 1).toUpperCase()}.`.trim() : null,
      eAdmin,
      versiune: pkg.version,
      modificata: dataVersiunii(env.VERSIUNE),
      veziCa: sesiune.veziCa,
      poateVedeaCa: sesiune.poateVedeaCa,
      spre: adresaPaginii(cfg, url),
    }

    const antete = cuCookie(FARA_STOC)

    try {
      if (req.method === "POST") {
        const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA], cfg.MEDIU === "dev")
        if (problema) return html(paginaMesaj(ctx, "Verificare de securitate", problema), 403, antete)
      }

      // ------------------------------------------------------- numele ales
      if (cale === "/alege" && req.method === "POST") {
        const post = await citestePost(req)
        const problema = verificaTokenCsrf(req, post.csrf ?? "")
        if (problema) return html(paginaMesaj(ctx, "Verificare de securitate", problema), 403, antete)
        const v = await voluntarDupaId(env.DB, parseInt(post.volunteer_id ?? "0", 10) || 0)
        if (!v || v.is_active !== 1) return duTe(`${prefix}/?alege=1`)
        const unde = post.goto_vacation ? `${prefix}/#vacation` : `${prefix}/`
        return duTe(unde, puneVoluntarul(v.id, cfg.DOMENIU_COOKIE))
      }

      /*
       * „Ieși" uită numai NUMELE ales din listă. Sesiunea platformei nu se atinge: ea e a contului,
       * iar ieșirea din el se face din meniul contului, ca în toate aplicațiile. Numele rămâne
       * ținut minte pentru semnul „tu" de pe listă (al doilea cookie), ca în V1.
       */
      if (cale === "/iesi") {
        return duTe(`${prefix}/`, [uitaVoluntarul(cfg.DOMENIU_COOKIE)])
      }

      if (cale === "/faq") return html(paginaFaq(ctx), 200, antete)

      // ------------------------------------------------------- apăsarea unui slot
      if (cale === "/api") {
        if (req.method !== "POST") return json({ ok: false, error: "Metodă invalidă." }, 405)
        const post = await citestePost(req)
        const problema = verificaTokenCsrf(req, post.csrf ?? "")
        if (problema) return json({ ok: false, error: problema }, 403)
        const cine: CineApasa = { voluntar, eAdmin, numeCont }
        return api(env, cine, post)
      }

      // ------------------------------------------------------- panoul
      if (cale === "/admin" || cale.startsWith("/admin/")) {
        if (!eAdmin) {
          if (!userId) return duTe(spreCont(ctx, cfg.ORIGINE_PUBLICA, cale))
          return html(
            paginaMesaj(ctx, "Numai pentru administratori", "Panoul curățeniei cere permisiunea „cleaning.manage”."),
            403,
            antete,
          )
        }
        if (cale === "/admin/faq") return html(paginaFaqAdmin(ctx), 200, antete)

        if (cale === "/admin/curatare-arhiva") {
          return paginaCuratareArhiva(ctx, env.DB, req, antete)
        }

        if (cale === "/admin") {
          const postDat = req.method === "POST" ? await citestePostAdmin(req) : null
          if (postDat) {
            const problema = verificaTokenCsrf(req, postDat.post.csrf ?? "")
            if (problema) return html(paginaMesaj(ctx, "Verificare de securitate", problema), 403, antete)
          }
          const mediu = { DB: env.DB, posta: await postaDin(env, cfg.ORIGINE_PUBLICA, prefix) }
          return paginaAdmin(ctx, mediu, req, url, postDat)
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
        return text(await ruleazaCeasul(env.DB, posta, url.searchParams.has("acum")))
      }

      // ------------------------------------------------------- programarea
      if (cale === "/" || cale === "") {
        // Numele duminicilor pentru cele trei luni care se pot vedea deodată (arhiva cerută, luna
        // curentă, luna viitoare) — o singură întrebare la calendar.
        const nume = await numeleDuminicilor(env.CALENDAR ?? null, ...intervalulPaginii(url))
        return html(await paginaIndex(ctx, env.DB, req, url, voluntar, nume), 200, antete)
      }

      return html(paginaMesaj(ctx, "Pagina nu există", "Adresa aceasta nu duce nicăieri la curățenie."), 404, antete)
    } catch (e) {
      log.error("eroare pagina", { eroare: e instanceof Error ? e.message : String(e) })
      return html(paginaMesaj(ctx, "A apărut o eroare", "Încearcă din nou peste puțin."), 500, antete)
    }
  },

  /**
   * Ceasul rapoartelor, din oră în oră. El hotărăște singur, pe ora Bucureștiului, dacă e vremea
   * alertei, a raportului săptămânal ori a celui lunar — vezi `cron.ts`.
   */
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const log = new Logger({ service: SERVICIU, correlationId: "ceas" })
    const posta = await postaDin(env, env.ORIGINE_PUBLICA, "")
    const raport = await ruleazaCeasul(env.DB, posta, false)
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
