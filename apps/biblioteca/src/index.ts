/**
 * Biblioteca parohiei (A12 din V1) — pe platforma V2.
 *
 * Catalogul bibliotecii de la Hanul Colței: ce carti exista si in cate exemplare. **E un catalog,
 * nu o biblioteca de texte** — cartile se imprumuta fizic, de la pangar. Textele sfinte sunt alte
 * aplicatii (Biblia, Tipicul) si nu se copiaza aici.
 *
 * Rute:
 *   /health                                    starea depozitului si a bazei
 *   /v1                                        indexul adreselor de masina
 *   /v1/carti · /v1/autori · /v1/edituri       catalogul, pentru masini
 *   /v1/cauta?q=                               cautarea, pentru masini
 *   /v1/eu                                     ce am eu la biblioteca (cere sesiune)
 *   /                                          catalogul: cifrele, primii autori si edituri
 *   /carte/<slug> · /autor/<slug> · /editura/<slug>
 *   /autori · /edituri                         o litera pe ecran, aleasa din bara de sus
 *   /cauta?q=                                  cautarea, pentru om
 *   /coperta/[mica|mare/]<slug>.jpg            copertile, in trei marimi
 *   /pdf/<slug>.pdf                            cartea intreaga, unde editura o da gratuit
 *   /despre-imbogatire                         de unde vin copertele si descrierile
 *   /eu · POST /eu/cere · /eu/renunta · /eu/acces        raftul omului
 *   /pangar · POST /pangar/fa · /pangar/acces · /pangar/scrisori
 *   /propuneri (+ sub-rute)                    unealta de imbogatire, la pangar
 *
 * **Catalogul e deschis** — „totul la liber, deocamdata" (user, 10.09.2026). In V1 poarta cadea
 * dupa `/v1`, deci si fisa unei carti cerea cont; aici cere cont doar ce e AL OMULUI.
 *
 * Ce tine aplicatia si ce cere: catalogul si fisele stau in depozitul propriu
 * (`xc-biblioteca-*`, R2), cererile de carti in baza proprie (D1) — cu `user_id`, niciodata nume
 * sau email. Cine e omul se afla de la identitate, la afisare; scrisorile pleaca prin posta
 * platformei; drepturile le hotaraste autorizarea centrala.
 */
import { asiguraCsrf, principalDin, sesiuneCurenta, verificaCsrf, verificaTokenCsrf } from "@xc/auth"
import { ClientAutorizare } from "@xc/authorization"
import { adresaPaginii, citesteConfig, navigatieDin, prefixSiCale } from "@xc/config"
import { SCOPE_GLOBAL, SESIUNE_ANONIMA } from "@xc/contracts"
import { Logger, correlationId } from "@xc/observability"
import { dataVersiunii, eroareApi, esc, html, json } from "@xc/ui"
import pkg from "../package.json"
import { MUTATE, autoriiCartii, catalog, cauta, slugEditura, titlulDin } from "./depozit.js"
import {
  accesulMeu, aleMele, anuleaza, ceasulDeNoapte, cere, cereAcces, cereriAcces, cerere, daCartea,
  dupaStari, elibereaza, inchideAcces, istoricul, ocupate, pregateste, primeste, respinge,
} from "./imprumut.js"
import { FARA_AUTOR, autorii } from "./nume.js"
import {
  type Ctx, type RandScrisoare, NUMAI_PANGAR, acasa, despreImbogatire, fisaCarte, listaCarti,
  listaPeLitere, pagina, paginaEu, paginaMesaj, paginaPangar, paginaScrisori,
} from "./pagini.js"
import { corpPropuneri, raspundePropuneri } from "./propuneri.js"
import { type Posta } from "./scrisori.js"

export interface Env {
  CATALOG: R2Bucket
  DB: D1Database
  IDENTITATE: Fetcher
  AUTORIZARE: Fetcher
  COMUNICARE: Fetcher
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  /** Data publicarii, pentru subsol — binding-ul `version_metadata`. */
  VERSIUNE?: { timestamp?: string }
}

const SERVICIU = "app-biblioteca"
/** Catalogul se schimba de cateva ori pe an: raspunsurile de masina se tin o zi. */
const CACHE_API = "public, max-age=86400"
const CACHE_PAGINI = "public, max-age=300"
/** Copertile si PDF-urile nu se schimba niciodata sub aceeasi adresa. */
const CACHE_POZE = "public, max-age=604800, immutable"

const eAdresaDeMasina = (cale: string) => /^\/(v1|health)(\/|$)/.test(cale)

/** 303, ca reincarcarea paginii de dupa un POST sa nu retrimita formularul. */
function duTe(spre: string, cookie?: string): Response {
  const h: Record<string, string> = { location: spre }
  if (cookie) h["set-cookie"] = cookie
  return new Response(null, { status: 303, headers: h })
}

export default {
  async fetch(req: Request, env: Env, _ctxExec: ExecutionContext): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: SERVICIU, correlationId: cid })
    const url = new URL(req.url)
    const nav = navigatieDin(cfg)
    const { prefix, cale } = prefixSiCale(url, "/biblioteca")
    const q = url.searchParams.get("q") ?? ""

    // ---------------------------------------------------------------- masini
    if (eAdresaDeMasina(cale)) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        return eroareApi(405, "metoda_nepermisa", "Sub /v1 merg doar GET și HEAD.")
      }
      try {
        return await api(req, env, cale, q, cid)
      } catch (e) {
        log.error("eroare api", { eroare: e instanceof Error ? e.message : String(e) })
        return eroareApi(500, "eroare_interna", "A apărut o eroare neașteptată.")
      }
    }

    // ---------------------------------------------------------------- oameni
    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const principal = principalDin(sesiune)
    const authz = new ClientAutorizare(env.AUTORIZARE, cid)
    // Drepturile le hotaraste autorizarea, nu rolul citit local — si le hotaraste sub masca
    // „vezi ca", daca omul poarta una, fiindca `principal` o duce cu el.
    const [poateImprumuta, ePangar] = principal
      ? await Promise.all([
          authz.can(principal, "library.borrow", SCOPE_GLOBAL).then((d) => d.allowed),
          authz.can(principal, "library.manage", SCOPE_GLOBAL).then((d) => d.allowed),
        ])
      : [false, false]

    // Jetonul CSRF traieste patru ore intr-un cookie propriu; fiecare formular al paginii il
    // scrie, iar POST-ul il cere inapoi. Cookie-ul se pune la primul raspuns HTML care are nevoie.
    const csrf = asiguraCsrf(req, cfg.DOMENIU_COOKIE)
    const cuCookie = (antete: Record<string, string>) =>
      csrf.setCookie ? { ...antete, "set-cookie": csrf.setCookie } : antete

    const ctx: Ctx = {
      prefix,
      nav,
      csrf: csrf.jeton,
      utilizator: sesiune.user?.displayName ?? sesiune.user?.email ?? null,
      userId: sesiune.user?.id ?? null,
      poateImprumuta,
      ePangar,
      eAdmin: sesiune.roles.some((r) => r.role === "admin" || r.role === "super-admin"),
      versiune: pkg.version,
      modificata: dataVersiunii(env.VERSIUNE),
      veziCa: sesiune.veziCa,
      poateVedeaCa: sesiune.poateVedeaCa,
      spre: adresaPaginii(cfg, url),
    }

    if (req.method === "POST") {
      const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA], cfg.MEDIU === "dev")
      if (problema) return html(paginaMesaj(ctx, "Verificare de securitate", problema), 403)
    }

    // Pagina e personala cand are un nume pe ea sau cand se poarta o masca: altfel browserul o
    // serveste din cache-ul lui si dupa ce masca a fost scoasa (patit la calendar, 11.09.2026).
    const cachePagina = cuCookie({ "cache-control": ctx.utilizator || ctx.veziCa ? "private, no-store" : CACHE_PAGINI })
    const alMeu = cuCookie({ "cache-control": "private, no-store" })
    const spreCont = (unde: string) =>
      duTe(`${nav.cont}/intra?spre=${encodeURIComponent(`${cfg.ORIGINE_PUBLICA}${prefix}${unde}`)}`)

    try {
      const c = await catalog(env.CATALOG)
      const posta: Posta = { COMUNICARE: env.COMUNICARE, IDENTITATE: env.IDENTITATE, ORIGINE_PUBLICA: cfg.ORIGINE_PUBLICA }

      // --- Unealta de imbogatire: la pangar, nu pe gazda de proba ---
      // In V1 `/propuneri` traia numai in modul de proba local, fiindca acolo nu exista
      // autorizare. V2 n-are mod de proba (local = staging), deci poarta e permisiunea.
      if (cale.startsWith("/propuneri")) {
        if (!ctx.userId) return spreCont("/propuneri")
        if (!ePangar) return html(paginaMesaj(ctx, "Numai pentru pangar", "Unealta de îmbogățire e a bibliotecarului."), 403)
        if (cale === "/propuneri") {
          return html(pagina(ctx, "Propuneri de îmbogățire", corpPropuneri(`${prefix}/propuneri`)), 200, cachePagina)
        }
        return raspundePropuneri(req, env.CATALOG, cale)
      }

      // --- Paginile publice: catalogul e deschis ---
      if (cale === "/cauta") {
        const r = cauta(c, q)
        return html(
          pagina(
            ctx,
            `Căutare: ${q}`,
            `
          <h2>Căutare: „${esc(q)}"</h2>
          <p><small>${r.length} ${r.length === 1 ? "rezultat" : "rezultate"}</small></p>
          ${listaCarti(ctx, c, r)}`,
            q,
          ),
          200,
          cachePagina,
        )
      }

      // Fisa unei carti: `/carte/{slug}`, cu prefix — ca /autor/ si /editura/ (decizie user,
      // 30 aug 2026). Radacina ramane a aplicatiei, nu a datelor.
      const mk = cale.match(/^\/carte\/([a-z0-9-]+)$/)
      if (mk) {
        const k = c.carti.find((x) => x.slug === mk[1])
        // Adresa unei carti nu se schimba cat timp randul e aceeasi carte. Cand la un numar de
        // inventar ajunge ALTA carte, adresa dinainte duce la ce e acum acolo, nu in gol.
        if (!k) {
          const acum = MUTATE[mk[1]!]
          if (acum) return Response.redirect(new URL(`${prefix}/carte/${acum}`, url).toString(), 301)
          return html(paginaMesaj(ctx, "Cartea nu există", "Nu găsim nicio carte la adresa aceasta."), 404)
        }
        const luate = await ocupate(env.DB, k.slug)
        const meleAcum = ctx.userId ? await aleMele(env.DB, ctx.userId) : []
        return html(
          fisaCarte(ctx, c, k, k.bucati - luate, meleAcum.find((x) => x.carte_slug === k.slug) ?? null, url.searchParams.get("r")),
          200,
          cachePagina,
        )
      }

      // Cartile fara autor: un „autor" care nu e om, dar tine la un loc 351 de titluri care
      // altfel nu se vedeau de nicaieri (cerere user, 31 aug 2026).
      if (cale === `/autor/${FARA_AUTOR.slug}`) {
        const r = c.carti.filter((x) => autorii(x.autor).length === 0)
        return html(
          pagina(
            ctx,
            FARA_AUTOR.nume,
            `<h2>${FARA_AUTOR.nume}</h2>
          <p><small>${r.length} ${r.length === 1 ? "titlu" : "titluri"} la care tabelul
          bibliotecii n-are trecut niciun autor.</small></p>${listaCarti(ctx, c, r)}`,
          ),
          200,
          cachePagina,
        )
      }

      const ma = cale.match(/^\/autor\/([a-z0-9-]+)$/)
      if (ma) {
        const a = c.autoriDupaSlug.get(ma[1]!)
        // Adresele de dinainte de unirea autorilor duc la noua pagina, nu in gol.
        if (!a) {
          const acum = c.aliasAutori.get(ma[1]!)
          if (acum) return Response.redirect(new URL(`${prefix}/autor/${acum}`, url).toString(), 301)
          return html(paginaMesaj(ctx, "Autorul nu există", "Nu găsim niciun autor la adresa aceasta."), 404)
        }
        const r = c.carti.filter((x) => autoriiCartii(c, x).some((y) => y.slug === a.slug))
        return html(
          pagina(
            ctx,
            a.nume,
            `<h2>${esc(a.nume)}</h2>
          <p><small>${r.length} ${r.length === 1 ? "titlu" : "titluri"}</small></p>${listaCarti(ctx, c, r)}`,
          ),
          200,
          cachePagina,
        )
      }

      const me = cale.match(/^\/editura\/([a-z0-9-]+)$/)
      if (me) {
        const e = c.editurileDupaSlug.get(me[1]!)
        if (!e) return html(paginaMesaj(ctx, "Editura nu există", "Nu găsim nicio editură la adresa aceasta."), 404)
        // Dupa SLUG, nu dupa numele scris identic: „AXA" si „Axa" sunt aceeasi editura.
        const r = c.carti.filter((x) => x.editura && slugEditura(x.editura) === e.slug)
        return html(
          pagina(
            ctx,
            e.nume,
            `<h2>Editura ${esc(e.nume)}</h2>
          <p><small>${r.length} ${r.length === 1 ? "titlu" : "titluri"}</small></p>${listaCarti(ctx, c, r)}`,
          ),
          200,
          cachePagina,
        )
      }

      if (cale === "/autori") {
        return html(
          pagina(
            ctx,
            "Autori",
            `<h2>Autori <small>(${c.totalAutori} în tot catalogul)</small></h2>
          ${listaPeLitere(ctx, c.autori, "autor", url.searchParams.get("l"))}`,
          ),
          200,
          cachePagina,
        )
      }
      if (cale === "/edituri") {
        return html(
          pagina(
            ctx,
            "Edituri",
            `<h2>Edituri <small>(${c.totalEdituri} în tot catalogul)</small></h2>
          ${listaPeLitere(ctx, c.edituri, "editura", url.searchParams.get("l"))}`,
          ),
          200,
          cachePagina,
        )
      }

      // Copertile stau la noi, in acelasi depozit. Nu trimitem cititorul la magazin dupa poze:
      // linkul de acolo se poate schimba oricand, iar browserul lui ar da de stire magazinului ce
      // carti se uita. Trei marimi: de fisa (480 px), mica (160 px, la inceputul randului in
      // liste) si mare (originalul, pentru lupa) — cea mare se aduce numai cand omul o cere.
      const mc = cale.match(/^\/coperta\/(?:(mica|mare)\/)?([a-z0-9-]+)\.jpg$/)
      if (mc) {
        const undeSta = mc[1] === "mica" ? "coperti-mici" : mc[1] === "mare" ? "coperti-mari" : "coperti"
        const o = await env.CATALOG.get(`${undeSta}/${mc[2]}.jpg`)
        if (!o) return new Response("Nu există.", { status: 404 })
        return new Response(o.body, {
          headers: { "content-type": "image/jpeg", "cache-control": CACHE_POZE, etag: o.httpEtag },
        })
      }

      // Cartea intreaga in PDF, acolo unde editura o da singura si gratuit (Predania — cerere
      // user, 7 sept. 2026). Sta in acelasi depozit, sub `pdfuri/`, si se da de aici, nu de la
      // ei: linkul lor se poate schimba, iar noi stim ce am salvat.
      const mp = cale.match(/^\/pdf\/([a-z0-9-]+)\.pdf$/)
      if (mp) {
        const o = await env.CATALOG.get(`pdfuri/${mp[1]}.pdf`)
        if (!o) return new Response("Nu există.", { status: 404 })
        return new Response(o.body, {
          headers: {
            "content-type": "application/pdf",
            "content-disposition": `inline; filename="${mp[1]}.pdf"`,
            "cache-control": CACHE_POZE,
            etag: o.httpEtag,
          },
        })
      }

      if (cale === "/despre-imbogatire") return html(despreImbogatire(ctx, c), 200, cachePagina)

      if (cale === "/" || cale === "") return html(acasa(ctx, c), 200, cachePagina)

      // --- De aici incolo, numai ce e AL OMULUI ---
      if (!ctx.userId) return spreCont(cale)

      if (cale === "/eu") {
        const [mele, vechi] = await Promise.all([aleMele(env.DB, ctx.userId), istoricul(env.DB, ctx.userId)])
        const acces = ctx.poateImprumuta ? null : await accesulMeu(env.DB, ctx.userId)
        return html(paginaEu(ctx, c, mele, vechi, acces, url.searchParams.get("r")), 200, alMeu)
      }

      if (cale === "/eu/cere" && req.method === "POST") {
        const f = await req.formData()
        const problema = verificaTokenCsrf(req, String(f.get("csrf") ?? ""))
        if (problema) return html(paginaMesaj(ctx, "Verificare de securitate", problema), 403)
        const slug = String(f.get("slug") ?? "")
        const k = c.carti.find((x) => x.slug === slug)
        if (!k) return duTe(`${prefix}/`)
        if (!ctx.poateImprumuta) return duTe(`${prefix}/carte/${slug}?r=fara_drept`)
        const r = await cere(env.DB, posta, ctx.userId, k.slug, k.titlu, k.bucati)
        return duTe(`${prefix}/carte/${slug}?r=${r.ok ? "ceruta" : r.cod}`)
      }

      if (cale === "/eu/renunta" && req.method === "POST") {
        const f = await req.formData()
        const problema = verificaTokenCsrf(req, String(f.get("csrf") ?? ""))
        if (problema) return html(paginaMesaj(ctx, "Verificare de securitate", problema), 403)
        const x = await cerere(env.DB, Number(f.get("id")))
        if (!x) return duTe(`${prefix}/eu?r=fara_cerere`)
        const r = await anuleaza(env.DB, posta, x, ctx.userId, titlulDin(c, x.carte_slug))
        return duTe(`${prefix}/eu?r=${r.ok ? "anulata" : r.cod}`)
      }

      // Cererea dreptului de imprumut: biblioteca nu da dreptul, doar duce cererea la pangar.
      if (cale === "/eu/acces" && req.method === "POST") {
        const f = await req.formData()
        const problema = verificaTokenCsrf(req, String(f.get("csrf") ?? ""))
        if (problema) return html(paginaMesaj(ctx, "Verificare de securitate", problema), 403)
        if (ctx.poateImprumuta) return duTe(`${prefix}/eu?r=acces_ai`)
        const r = await cereAcces(env.DB, ctx.userId)
        return duTe(`${prefix}/eu?r=${r.ok ? "acces_cerut" : r.cod}`)
      }

      // --- Ecranul pangarului ---
      if (cale === "/pangar") {
        if (!ePangar) return html(pagina(ctx, "Pangar", NUMAI_PANGAR), 403)
        const [toate, acces] = await Promise.all([
          dupaStari(env.DB, ["ceruta", "pregatita", "imprumutata"]),
          cereriAcces(env.DB),
        ])
        return html(paginaPangar(ctx, c, toate, acces), 200, alMeu)
      }

      if (cale === "/pangar/fa" && req.method === "POST") {
        if (!ePangar) return html(pagina(ctx, "Pangar", NUMAI_PANGAR), 403)
        const f = await req.formData()
        const problema = verificaTokenCsrf(req, String(f.get("csrf") ?? ""))
        if (problema) return html(paginaMesaj(ctx, "Verificare de securitate", problema), 403)
        const x = await cerere(env.DB, Number(f.get("id")))
        if (!x) return duTe(`${prefix}/pangar`)
        const titlu = titlulDin(c, x.carte_slug)
        switch (String(f.get("fapta"))) {
          case "pregateste":
            await pregateste(env.DB, posta, x, titlu)
            break
          case "da":
            await daCartea(env.DB, posta, x, titlu)
            break
          case "primeste":
            await primeste(env.DB, posta, x, titlu)
            break
          case "respinge":
            await respinge(env.DB, posta, x, titlu)
            break
          case "elibereaza":
            await elibereaza(env.DB, posta, x, titlu)
            break
        }
        return duTe(`${prefix}/pangar`)
      }

      if (cale === "/pangar/acces" && req.method === "POST") {
        if (!ePangar) return html(pagina(ctx, "Pangar", NUMAI_PANGAR), 403)
        const f = await req.formData()
        const problema = verificaTokenCsrf(req, String(f.get("csrf") ?? ""))
        if (problema) return html(paginaMesaj(ctx, "Verificare de securitate", problema), 403)
        await inchideAcces(env.DB, Number(f.get("id")), String(f.get("fapta")) === "activat" ? "activat" : "refuzat")
        return duTe(`${prefix}/pangar`)
      }

      if (cale === "/pangar/scrisori") {
        if (!ePangar) return html(pagina(ctx, "Pangar", NUMAI_PANGAR), 403)
        const r = await env.DB.prepare(`SELECT * FROM scrisori ORDER BY id DESC LIMIT 100`).all<RandScrisoare>()
        return html(paginaScrisori(ctx, r.results ?? []), 200, alMeu)
      }

      return html(paginaMesaj(ctx, "Pagina nu există", "Adresa aceasta nu duce nicăieri în bibliotecă."), 404)
    } catch (e) {
      log.error("eroare pagina", { eroare: e instanceof Error ? e.message : String(e) })
      return html(paginaMesaj(ctx, "A apărut o eroare", "Încearcă din nou peste puțin."), 500)
    }
  },

  /**
   * Ceasul de noapte: stinge rezervarile neridicate si da semn celor intarziati.
   * Rulare la 6:00 UTC (9:00 vara la Bucuresti) — vezi `triggers` din wrangler.jsonc.
   */
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const log = new Logger({ service: SERVICIU, correlationId: "ceas" })
    const c = await catalog(env.CATALOG)
    const titluri = new Map(c.carti.map((x) => [x.slug, x.titlu]))
    const posta: Posta = {
      COMUNICARE: env.COMUNICARE,
      IDENTITATE: env.IDENTITATE,
      ORIGINE_PUBLICA: env.ORIGINE_PUBLICA,
    }
    const r = await ceasulDeNoapte(env.DB, posta, (slug) => titluri.get(slug) ?? slug)
    log.info("ceasul de noapte", { expirate: r.expirate, anuntate: r.anuntate })
  },
} satisfies ExportedHandler<Env>

/**
 * Adresele de masina. Sub `/v1` totul e GET si PUBLIC — ca in V1 —, afara de `/v1/eu`, care e al
 * omului si cere sesiune.
 */
async function api(req: Request, env: Env, cale: string, q: string, cid: string): Promise<Response> {
  const c = await catalog(env.CATALOG)

  if (cale === "/health") {
    return json({
      ok: true,
      app: "biblioteca",
      titluri: c.total,
      exemplare: c.carti.reduce((s, x) => s + x.bucati, 0),
      autori: c.totalAutori,
      edituri: c.totalEdituri,
      fise: c.imb.total,
      ora: new Date().toISOString(),
    })
  }

  if (cale === "/v1") {
    return json(
      {
        aplicatie: "biblioteca",
        adrese: {
          "/v1/carti": "cele 1349 de titluri, cu autorul, editura, anul și exemplarele",
          "/v1/autori": "autorii, uniți și scriși la fel",
          "/v1/edituri": "editurile, unite după slug",
          "/v1/cauta?q=": "căutarea în titluri, autori și edituri",
          "/v1/eu": "ce ai tu la bibliotecă (cere sesiune)",
        },
      },
      200,
      { "cache-control": CACHE_API },
    )
  }

  if (cale === "/v1/carti") return json({ total: c.total, carti: c.carti }, 200, { "cache-control": CACHE_API })
  if (cale === "/v1/autori") return json({ total: c.totalAutori, autori: c.autori }, 200, { "cache-control": CACHE_API })
  if (cale === "/v1/edituri") return json({ total: c.totalEdituri, edituri: c.edituri }, 200, { "cache-control": CACHE_API })
  if (cale === "/v1/cauta") return json({ q, rezultate: cauta(c, q) }, 200, { "cache-control": CACHE_API })

  // Ce e al omului nu se cacheaza si nu se da fara sesiune.
  if (cale === "/v1/eu") {
    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const userId = sesiune.user?.id
    if (!userId) return eroareApi(401, "fara_sesiune", "Adresa cere contul omului.")
    const mele = await aleMele(env.DB, userId)
    return json(
      {
        active: mele.length,
        imprumutate: mele.filter((x) => x.stare === "imprumutata").length,
        intarziate: mele.filter((x) => x.stare === "imprumutata" && x.scadenta && x.scadenta < new Date().toISOString().slice(0, 10)).length,
        carti: mele.map((x) => ({
          titlu: titlulDin(c, x.carte_slug),
          slug: x.carte_slug,
          stare: x.stare,
          termen: x.stare === "imprumutata" ? x.scadenta : x.asteapta_pana,
        })),
      },
      200,
      { "cache-control": "private, no-store" },
    )
  }

  return eroareApi(404, "adresa_inexistenta", "Adresa nu există.")
}
