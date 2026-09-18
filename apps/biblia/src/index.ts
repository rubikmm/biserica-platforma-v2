/**
 * A10 · Biblia — pe platforma V2.
 *
 * Vechiul si Noul Testament, pe carti, capitole si versete; editia sinodala, preluata de pe
 * bibliaortodoxa.ro. Bibliotecă de citit: nu decide nimic, nu anunta nimic.
 *
 * Rute:
 *   /health                                                starea depozitului
 *   /v1                                                    indexul adreselor de masina
 *   /v1/carti                                              cele 80 de carti, cu partea si capitolele
 *   /v1/pasaj?ref=<referinta>                              versetele unei referinte scrise de om
 *   /v1/cauta?q=[&carte=&max=]                             cautarea in text, pentru masini
 *   /v1/<slug>/<capitol>[/<verset>[-<pana>]]               adresa STABILA a versetului
 *   /                                                      meniul pe carti (file: NT, VT)
 *   /carte/<slug>[/<capitol>]                              capitolul de citit, cu ancore #v<numar>
 *   /cauta?q=                                              cautarea, pentru om
 *   /pasaj?ref=                                            duce la capitolul referintei
 *
 * ⚠️ Adresele stabile sunt PERMANENTE odata publicate: buletinul si newsletterul citeaza prin ele.
 *
 * Ce zi liturgica e si ce pericope are ziua NU se tin aici — le stie calendarul, care vine si cere
 * textul de la noi (`/v1/pasaj`). Aplicatia e numai de citit: cartile intra prin copierea din V1
 * in depozitul propriu (`xc-biblia-staging`).
 */
import { principalDin, sesiuneCurenta, verificaCsrf } from "@xc/auth"
import { eAdminulAplicatiei } from "@xc/authorization"
import { SESIUNE_ANONIMA } from "@xc/contracts"
import { adresaPaginii, citesteConfig, navigatieDin, prefixSiCale } from "@xc/config"
import { Logger, correlationId } from "@xc/observability"
import { dataVersiunii, eroareApi, html, json, jsonCuEtag } from "@xc/ui"
import pkg from "../package.json"
import { type Carte, type Index, carte, index } from "./depozit.js"
import { citesteRef, extrage, plat } from "./referinte.js"
import { ruteazaSetari } from "@xc/setari"
import { type Ctx, type Gasit, acasa, paginaCarcasa, paginaCarte, paginaCautare, paginaMesaj } from "./pagini.js"

export interface Env {
  TEXTE: R2Bucket
  /** Venite pe 15.09.2026, odata cu pagina de Setari: cheile, abonarile si jurnalul. */
  AUTORIZARE: Fetcher
  COMUNICARE: Fetcher
  AUDIT: Fetcher
  IDENTITATE: Fetcher
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  /** Data publicarii, pentru subsol — binding-ul `version_metadata`. */
  VERSIUNE?: { timestamp?: string }
}

const SERVICIU = "app-biblia"
/** Cartea nu se schimba niciodata: raspunsurile de masina se tin o zi. */
const CACHE_API = "public, max-age=86400"
const CACHE_PAGINI = "public, max-age=300"
/** Cautarea in text pentru om se opreste aici — altfel se citesc 80 de carti degeaba. */
const PLAFON_PAGINA = 100

const eAdresaDeMasina = (cale: string) => /^\/(v1|health)(\/|$)/.test(cale)

interface Rezultat {
  carte: string
  slug: string
  capitol: number
  verset: number
  text: string
  referinta: string
}

/**
 * Cautarea in text: aceeasi potrivire ca pagina — fara diacritice si fara majuscule, deci
 * „manastire" gaseste „mănăstire". Numara TOATE potrivirile (`gasite`), dar scrie doar primele
 * `max`, ca cine cheama sa stie daca s-a oprit la timp fara sa ceara iar.
 */
async function cautaInText(
  depozit: R2Bucket,
  ix: Index,
  nevoie: string,
  doarSlug: string | null,
  max: number,
): Promise<{ gasite: number; rezultate: Rezultat[]; citite: number }> {
  const rezultate: Rezultat[] = []
  let gasite = 0
  let citite = 0
  for (const ci of ix.carti) {
    if (doarSlug && ci.slug !== doarSlug) continue
    const c = await carte(depozit, ci.slug)
    if (!c) continue
    citite++
    c.capitole.forEach((cap, i) => {
      for (const [n, t] of Object.entries(cap)) {
        if (!plat(t).includes(nevoie)) continue
        gasite++
        if (rezultate.length < max) {
          rezultate.push({
            carte: ci.nume,
            slug: ci.slug,
            capitol: i + 1,
            verset: Number(n),
            text: t,
            referinta: `${ci.nume} ${i + 1}, ${n}`,
          })
        }
      }
    })
  }
  return { gasite, rezultate, citite }
}

async function api(req: Request, env: Env, cale: string): Promise<Response> {
  const url = new URL(req.url)
  const cache = { "cache-control": CACHE_API }

  if (cale === "/health") {
    const ix = await index(env.TEXTE)
    return json(
      {
        ok: true,
        app: "biblia",
        cod: "A10",
        carti: ix.carti.length,
        sursa: ix.sursa,
        mediu: env.MEDIU,
        versiune: pkg.version,
        publicat: env.VERSIUNE?.timestamp ?? null,
        ora: new Date().toISOString(),
      },
      200,
      { "cache-control": "no-store" },
    )
  }

  if (cale === "/v1" || cale === "/v1/") {
    const ix = await index(env.TEXTE)
    return jsonCuEtag(
      req,
      {
        app: "biblia",
        sursa: ix.sursa,
        url: ix.url,
        carti: ix.carti.length,
        adrese: [
          { adresa: "/v1/carti", ce_da: "cele 80 de cărți: nume, slug, parte, capitole, versete" },
          { adresa: "/v1/pasaj?ref=<referință>", ce_da: "versetele unei referințe scrise de om" },
          { adresa: "/v1/cauta?q=[&carte=&max=]", ce_da: "căutarea în text" },
          { adresa: "/v1/<slug>/<capitol>[/<verset>[-<până>]]", ce_da: "adresa stabilă a versetului" },
        ],
      },
      cache,
    )
  }

  if (cale === "/v1/carti") {
    const ix = await index(env.TEXTE)
    return jsonCuEtag(req, { sursa: ix.sursa, carti: ix.carti }, cache)
  }

  if (cale === "/v1/pasaj") {
    const ref = url.searchParams.get("ref") ?? ""
    const ix = await index(env.TEXTE)
    const r = citesteRef(ref, ix)
    if (!r) return eroareApi(400, "referinta_neinteleasa", `Nu am înțeles referința „${ref}".`)
    const c = await carte(env.TEXTE, r.carte.slug)
    if (!c) return eroareApi(500, "carte_lipsa", `Cartea ${r.carte.nume} nu e în depozit.`)
    const lipsa = r.intervale.find((iv) => !c.capitole[iv.capitol - 1])
    if (lipsa) return eroareApi(404, "capitol_inexistent", `${r.carte.nume} nu are capitolul ${lipsa.capitol}.`)
    return jsonCuEtag(
      req,
      {
        referinta: ref,
        carte: r.carte.nume,
        slug: r.carte.slug,
        capitol: r.intervale[0]!.capitol,
        versete: extrage(c, r.intervale),
        sursa: ix.sursa,
      },
      cache,
    )
  }

  if (cale === "/v1/cauta") {
    const q = url.searchParams.get("q") ?? ""
    const ix = await index(env.TEXTE)
    const nevoie = plat(q.trim())
    if (nevoie.length < 3) return eroareApi(400, "cautare_scurta", "Cere ?q= cu cel puțin 3 litere.")
    const doarSlug = url.searchParams.get("carte")
    if (doarSlug && !ix.carti.some((x) => x.slug === doarSlug)) {
      return eroareApi(404, "carte_inexistenta", `Nu am cartea „${doarSlug}". Lista, la /v1/carti.`)
    }
    const cerut = url.searchParams.get("max")
    if (cerut !== null && !/^[1-9]\d*$/.test(cerut)) {
      return eroareApi(400, "max_invalid", "?max= cere un număr întreg mai mare ca zero.")
    }
    const max = Math.min(cerut ? Number(cerut) : 50, 200)
    const { gasite, rezultate } = await cautaInText(env.TEXTE, ix, nevoie, doarSlug, max)
    return jsonCuEtag(
      req,
      {
        q: q.trim(),
        carte: doarSlug,
        max,
        gasite,
        aratate: rezultate.length,
        complet: rezultate.length === gasite,
        sursa: ix.sursa,
        rezultate,
      },
      cache,
    )
  }

  /**
   * Adresa stabila a versetului. Se potriveste DUPA rutele exacte de mai sus — altfel „carti" ar
   * trece drept slug de carte. Un slug necunoscut da 404, nu cade in plasa paginilor.
   */
  const mv = /^\/v1\/([A-Za-z0-9-]+)\/(\d+)(?:\/(\d+)(?:-(\d+))?)?$/.exec(cale)
  if (mv) {
    const ix = await index(env.TEXTE)
    const slug = mv[1]!.toLowerCase()
    const ci = ix.carti.find((x) => x.slug === slug)
    if (!ci) return eroareApi(404, "carte_inexistenta", `Nu am cartea „${slug}". Lista, la /v1/carti.`)
    const capitol = Number(mv[2])
    const de = mv[3] !== undefined ? Number(mv[3]) : null
    const pana = mv[4] !== undefined ? Number(mv[4]) : de
    if (de !== null && pana !== null && pana < de) {
      return eroareApi(400, "interval_gresit", `Intervalul ${de}-${pana} merge înapoi.`)
    }
    const c = await carte(env.TEXTE, slug)
    if (!c) return eroareApi(500, "carte_lipsa", `Cartea ${ci.nume} nu e în depozit.`)
    if (!c.capitole[capitol - 1]) {
      return eroareApi(404, "capitol_inexistent", `${ci.nume} nu are capitolul ${capitol}.`)
    }
    const versete = extrage(c, [{ capitol, de_la: de, pana_la: pana }])
    if (versete.length === 0) {
      const cerut = pana === de ? `${de}` : `${de}-${pana}`
      return eroareApi(404, "verset_inexistent", `${ci.nume} ${capitol} nu are versetul ${cerut}.`)
    }
    const referinta = de === null ? `${ci.nume} ${capitol}` : `${ci.nume} ${capitol}, ${de}${pana !== de ? `-${pana}` : ""}`
    return jsonCuEtag(req, { referinta, carte: ci.nume, slug, capitol, versete, sursa: ix.sursa }, cache)
  }

  return eroareApi(404, "adresa_inexistenta", "Adresa nu există. Indexul e la /v1.")
}

/** Cautarea pentru om: intai referinta exacta, daca e una, apoi cautarea in text. */
async function cautarePentruOm(env: Env, ix: Index, q: string) {
  const r = citesteRef(q, ix)
  let exact = null as null | { nume: string; slug: string; capitol: number; coada: string; versete: ReturnType<typeof extrage>; maiMulte: boolean }
  if (r) {
    const c = await carte(env.TEXTE, r.carte.slug)
    if (c) {
      const versete = extrage(c, r.intervale)
      if (versete.length > 0) {
        exact = {
          nume: r.carte.nume,
          slug: r.carte.slug,
          capitol: r.intervale[0]!.capitol,
          coada: q.replace(/^.*?(\d.*)$/, "$1"),
          versete,
          maiMulte: r.intervale.length > 1,
        }
      }
    }
  }
  const { rezultate, citite } = await cautaInText(env.TEXTE, ix, plat(q), null, PLAFON_PAGINA)
  const gasite: Gasit[] = rezultate.map((x) => ({
    slug: x.slug,
    nume: x.carte,
    capitol: x.capitol,
    verset: x.verset,
    text: x.text,
  }))
  return { exact, gasite, citite }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: SERVICIU, correlationId: cid })
    const url = new URL(req.url)
    const { prefix, cale } = prefixSiCale(url, "/biblia")
    const nav = navigatieDin(cfg)

    if (eAdresaDeMasina(cale)) {
      if (req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, HEAD, OPTIONS",
            "access-control-allow-headers": "if-none-match, content-type",
          },
        })
      }
      if (req.method !== "GET" && req.method !== "HEAD") return eroareApi(405, "metoda_nepermisa", "Sub /v1 merg doar GET, HEAD și OPTIONS.")
      try {
        return await api(req, env, cale)
      } catch (e) {
        log.error("eroare api", { eroare: e instanceof Error ? e.message : String(e) })
        return eroareApi(500, "eroare_interna", "A apărut o eroare neașteptată.")
      }
    }

    /*
     * ⚠️ POST-ul e primit DIN 15.09.2026, si numai pentru Setari: pana atunci Biblia raspundea 405
     * la orice in afara de GET/HEAD. Cititul ramane neatins, si tot la liber.
     */
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST") {
      return new Response("Metoda nu e permisă.", { status: 405 })
    }

    // Pagina e DESCHISA: „totul la liber, deocamdată" (user, 10.09.2026). V1 cerea cont aici.
    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const principal = principalDin(sesiune)
    const ctx: Ctx = {
      prefix,
      nav,
      utilizator: sesiune.user?.displayName ?? sesiune.user?.email ?? null,
      // ⚠️ Adminul BIBLIEI vine din cheia ei (`bible.manage`), nu din rolul global (18.09.2026).
      // Azi nu deschide nimic — Biblia n-are nicio fapta de admin — dar cheia si numirea exista, ca
      // aplicatia sa nu fie deosebita de celelalte cand va avea una.
      eAdmin: await eAdminulAplicatiei(env.AUTORIZARE, cid, principal, "biblia"),
      eAdminPlatforma: sesiune.roles.some((r) => r.role === "admin" || r.role === "super-admin"),
      versiune: pkg.version,
      modificata: dataVersiunii(env.VERSIUNE),
      veziCa: sesiune.veziCa,
      poateVedeaCa: sesiune.poateVedeaCa,
      spre: adresaPaginii(cfg, url),
    }
    // Sub masca „vezi ca" pagina e personala chiar cand n-are niciun nume pe ea; in dev nu se
    // tine cache deloc (cei cinci minute faceau schimbarile sa para nefacute).
    const cachePagina = {
      "cache-control": ctx.utilizator || ctx.veziCa ? "private, no-store" : env.MEDIU === "dev" ? "no-store" : CACHE_PAGINI,
    }

    // Bariera de origine a platformei, pentru singura metoda care scrie ceva.
    if (req.method === "POST") {
      const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA], cfg.MEDIU === "dev")
      if (problema) return html(paginaMesaj(ctx, "Verificare de securitate", `<p>${problema}</p>`), 403)
    }

    // SETARILE — un singur loc, `@xc/setari` (user, 15.09.2026).
    const raspunsSetari = await ruteazaSetari(req, cale, env, {
      cod: "biblia",
      nume: "Biblia",
      prefix,
      cfg,
      cid,
      principal,
      urlCont: nav.cont,
      urlTermeni: `${nav.home || ""}/termeni`,
      carcasa: (p) => paginaCarcasa(ctx, p),
    })
    if (raspunsSetari) return raspunsSetari

    try {
      const ix = await index(env.TEXTE)
      const q = url.searchParams.get("q") ?? ""
      const ref = url.searchParams.get("ref") ?? ""

      if (cale === "/pasaj" && ref) {
        const r = citesteRef(ref, ix)
        if (r) {
          return Response.redirect(new URL(`${prefix}/carte/${r.carte.slug}/${r.intervale[0]!.capitol}`, url).toString(), 302)
        }
        return html(
          paginaMesaj(ctx, "Referință necunoscută", `<p>Nu am înțeles referința <b>${ref.replace(/[<>&]/g, "")}</b>. Încearcă de forma <i>Ioan 3, 16</i>.</p>`),
          404,
          cachePagina,
        )
      }

      if (cale === "/cauta") {
        const { exact, gasite, citite } = q.trim() ? await cautarePentruOm(env, ix, q) : { exact: null, gasite: [], citite: 0 }
        return html(paginaCautare(ctx, q, exact, gasite, citite), 200, cachePagina)
      }

      const mc = /^\/carte\/([a-z0-9-]+)(?:\/(\d+))?$/.exec(cale)
      if (mc) {
        const slug = mc[1]!
        const c: Carte | null = await carte(env.TEXTE, slug)
        if (!c) return html(paginaMesaj(ctx, "Nu există", "<p>Cartea nu există.</p>"), 404, cachePagina)
        return html(paginaCarte(ctx, c, slug, mc[2] ? Number(mc[2]) : 1), 200, cachePagina)
      }

      if (cale === "/") return html(acasa(ctx, ix), 200, cachePagina)

      return html(paginaMesaj(ctx, "Nu există", "<p>Adresa nu există.</p>"), 404, cachePagina)
    } catch (e) {
      log.error("eroare pagina", { eroare: e instanceof Error ? e.message : String(e) })
      return html(paginaMesaj(ctx, "Eroare", "<p>A apărut o eroare neașteptată. Încearcă din nou.</p>"), 500)
    }
  },
}
