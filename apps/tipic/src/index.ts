/**
 * A9 · Tipicul — pe platforma V2.
 *
 * Rânduiala slujbei zilei: ce se cântă și ce se citește. Bibliotecă de citit — nu decide nimic,
 * nu anunță nimic, atârnă de calendar.
 *
 * Rute:
 *   /health, /v1, /v1/zile, /v1/zi/<data>|azi|maine        API-ul contractului, deschis
 *   /                                                      ziua de azi
 *   /<AAAA-LL-ZZ>                                          ziua cerută (adresa e data, ca în V1)
 *
 * Trei cărți, așezate una sub alta (user, 1 sept. 2026): Rânduiala Tipicului (ROEA) spune CE se
 * face, Anuarul liturgic și tipiconal o desfășoară, Mineiul dă TEXTUL slujbei. Ziua liturgică,
 * sfinții și textul pericopelor se cer de la calendar — aici nu se ține nimic din ele.
 *
 * Aplicația e numai de citit: cărțile intră prin `infrastructure/import/tipic-din-v1.mjs`.
 */
import { principalDin, sesiuneCurenta } from '@xc/auth'
import { SESIUNE_ANONIMA } from '@xc/contracts'
import { adresaPaginii, citesteConfig, navigatieDin, prefixSiCale } from '@xc/config'
import { Logger, correlationId } from '@xc/observability'
import { adaugaZile, aziBucuresti, dataCeruta, dataVersiunii, eDataValida, eroareApi, html, json, jsonCuEtag } from '@xc/ui'
import { modulActiuni } from '@xc/actiuni'
import pkg from '../package.json'
import { ACTIUNI } from './actiuni.js'
import { sfintiiPeSurse, ziuaIntreaga } from './zi.js'
import { type Pericopa, textulPericopei, textulVoscresnei, ziuaCalendarului } from './calendar.js'
import { acoperire, cartile, mineiZilei, randuialaZilei, tipiconalZilei, zileleCuRanduiala } from './depozit.js'
import { pomeniriDinAnuar, pomeniriDinMinei } from './sinaxar.js'
import { type Ctx, paginaMesaj, paginaZilei } from './pagini.js'
import { eAdresaDeCarte, pdfDinR2 } from './carti-pdf.js'

export interface Env {
  DB: D1Database
  IDENTITATE: Fetcher
  AUTORIZARE: Fetcher
  AUDIT: Fetcher
  CALENDAR: Fetcher
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  /** Cartile scanate (PDF), in depozitul propriu. */
  TEXTE: R2Bucket
  /** Data publicarii, pentru subsol — binding-ul `version_metadata`. */
  VERSIUNE?: { timestamp?: string }
  /** Secretul dintre workerii nostri; fara el `/_actiuni` nu exista. */
  SECRET_INTERN?: string
}

const SERVICIU = 'app-tipic'
const CACHE_API = 'public, max-age=3600'
const CACHE_PAGINI = 'public, max-age=300'

const eAdresaDeMasina = (cale: string) => /^\/(v1|intern|\.well-known|health)(\/|$)/.test(cale)

/** Pericopele pe care Biblia nu le-a dat cad: sectiunea lor nu se scrie deloc. */
const doarGasite = (lista: ReadonlyArray<Pericopa | null>): Pericopa[] => lista.filter((p): p is Pericopa => p !== null)


async function api(req: Request, env: Env, cale: string, azi: string): Promise<Response> {
  const cache = { 'cache-control': CACHE_API }

  if (cale === '/health') {
    const a = await acoperire(env.DB)
    return json(
      { ok: true, app: 'tipic', cod: 'A9', randuiala: a.randuiala, tipiconal: a.tipiconal, minei: a.minei, mediu: env.MEDIU, versiune: pkg.version, publicat: env.VERSIUNE?.timestamp ?? null, ora: new Date().toISOString() },
      200,
      { 'cache-control': 'no-store' },
    )
  }

  if (cale === '/v1' || cale === '/v1/') {
    const a = await acoperire(env.DB)
    return jsonCuEtag(
      req,
      {
        app: 'tipic',
        carti: [...(await cartile(env.DB)).values()].map((c) => ({ cod: c.cod, sursa: c.sursa, editura: c.editura, credit: c.credit })),
        acoperire: a,
        adrese: [
          { adresa: '/v1/zi/<AAAA-LL-ZZ> · /v1/zi/azi · /v1/zi/maine', ce_da: 'rânduiala zilei: ROEA + Anuar + Mineiul' },
          { adresa: '/v1/zile', ce_da: 'zilele cu rânduială proprie' },
          { adresa: '/v1/minei/<luna>/<zi>', ce_da: 'ziua din Minei — cartea nu ține de an' },
          { adresa: '/v1/sfinti/<data>|azi|maine · /v1/sfinti/minei/<luna>/<zi>', ce_da: 'sfinții zilei, pe surse: Mineiul, apoi Anuarul' },
        ],
      },
      cache,
    )
  }

  if (cale === '/v1/zile') {
    const zile = await zileleCuRanduiala(env.DB)
    return jsonCuEtag(req, { zile, total: zile.length }, cache)
  }

  /**
   * Sfintii zilei, asa cum ii numara MINEIUL. Lista nu o inlocuieste pe cea a calendarului: cartea
   * trece toata ceata zilei (cinci pana la zece nume in plus, masurat pe patru duminici), dar
   * n-are sfintii romani canonizati dupa editie. De aceea raspunsul poarta cartea la vedere,
   * ca cine il arata sa poata scrie sursa langa nume.
   *
   * Cartea nu tine de an: cu data se raspunde tot dupa (luna, zi), iar `/v1/sfinti/minei/<luna>/<zi>`
   * o cere de-a dreptul, fara sa mai treaca printr-un an anume.
   */
  const mSfintiMinei = /^\/v1\/sfinti\/minei\/(\d{1,2})\/(\d{1,2})$/.exec(cale)
  const mSfinti = /^\/v1\/sfinti\/([^/]+)$/.exec(cale)
  if (mSfintiMinei || mSfinti) {
    let luna: number
    let zi: number
    let data: string | null = null
    if (mSfintiMinei) {
      luna = Number(mSfintiMinei[1])
      zi = Number(mSfintiMinei[2])
      if (luna < 1 || luna > 12 || zi < 1 || zi > 31) return eroareApi(400, 'zi_invalida', 'Luna e 1–12, ziua 1–31.')
    } else {
      data = dataCeruta(mSfinti![1]!, azi)
      if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / maine).')
      luna = Number(data.slice(5, 7))
      zi = Number(data.slice(8, 10))
    }
    // Aceleasi surse si pentru actiunea `tipic.sfintii_zilei` — compunerea sta in `zi.ts`.
    const rezultat = await sfintiiPeSurse(env, luna, zi, data)
    if (!rezultat) return eroareApi(404, 'zi_lipsa', `Nici Mineiul, nici Anuarul n-au ziua ${zi}.${luna} — cărțile intră pe rând.`)
    return jsonCuEtag(req, rezultat, cache)
  }

  const mMinei = /^\/v1\/minei\/(\d{1,2})\/(\d{1,2})$/.exec(cale)
  if (mMinei) {
    const luna = Number(mMinei[1])
    const zi = Number(mMinei[2])
    if (luna < 1 || luna > 12 || zi < 1 || zi > 31) return eroareApi(400, 'zi_invalida', 'Luna e 1–12, ziua 1–31.')
    const m = await mineiZilei(env.DB, luna, zi)
    if (!m) return eroareApi(404, 'zi_lipsa', `Mineiul pe luna ${luna} n-are ziua ${zi} — cărțile intră pe rând.`)
    const carte = (await cartile(env.DB)).get(`minei-${String(luna).padStart(2, '0')}`) ?? null
    return jsonCuEtag(req, { ...m, carte }, cache)
  }

  const mZi = /^\/v1\/zi\/([^/]+)$/.exec(cale)
  if (mZi) {
    const data = dataCeruta(mZi[1]!, azi)
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / maine).')
    const z = await ziuaIntreaga(env, data)
    if (!z.randuiala && !z.tipiconal && !z.minei) {
      return eroareApi(404, 'zi_fara_randuiala', `Pentru ${data} nu există rânduială în cărțile tipicului.`)
    }
    return jsonCuEtag(req, z, cache)
  }

  return eroareApi(404, 'adresa_inexistenta', 'Adresa nu există. Indexul e la /v1.')
}

/** Lista de verbe a tipicului, publicata la `/_actiuni` (vezi `actiuni.ts`). */
const MODUL = modulActiuni<Env>({ aplicatie: 'tipic', versiune: pkg.version, actiuni: ACTIUNI })

export default {
  async fetch(req: Request, env: Env, ctxExec: ExecutionContext): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: SERVICIU, correlationId: cid })
    const url = new URL(req.url)
    const { prefix, cale } = prefixSiCale(url, '/tipic')
    const nav = navigatieDin(cfg)
    const azi = aziBucuresti()

    // Actiunile interne: doar prin Service Binding, cu secretul platformei (404 altfel).
    const raspunsActiuni = await MODUL.ruteaza(req, env, ctxExec, cale)
    if (raspunsActiuni) return raspunsActiuni

    // Cartile intregi (PDF), cu cereri pe bucati — adresele din V1, neatinse.
    if (eAdresaDeCarte(cale)) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Metoda nu e permisă.', { status: 405 })
      return pdfDinR2(req, env.TEXTE, cale)
    }

    if (eAdresaDeMasina(cale)) {
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, HEAD, OPTIONS', 'access-control-allow-headers': 'if-none-match, content-type' } })
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return eroareApi(405, 'metoda_nepermisa', 'Sub /v1 merg doar GET, HEAD și OPTIONS.')
      try {
        return await api(req, env, cale, azi)
      } catch (e) {
        log.error('eroare api', { eroare: e instanceof Error ? e.message : String(e) })
        return eroareApi(500, 'eroare_interna', 'A apărut o eroare neașteptată.')
      }
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return new Response('Metoda nu e permisă.', { status: 405 })
    }

    // Pagina e DESCHISA: „totul la liber, deocamdată" (user, 10.09.2026). V1 cerea cont aici.
    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    principalDin(sesiune)
    const ctx: Ctx = {
      prefix,
      nav,
      utilizator: sesiune.user?.displayName ?? sesiune.user?.email ?? null,
      eAdmin: sesiune.roles.some((r) => r.role === 'admin' || r.role === 'super-admin'),
      versiune: pkg.version,
      modificata: dataVersiunii(env.VERSIUNE),
      veziCa: sesiune.veziCa,
      poateVedeaCa: sesiune.poateVedeaCa,
      spre: adresaPaginii(cfg, url),
    }
    // In dev nu se tine cache: cei cinci minute faceau schimbarile sa para nefacute (10.09.2026).
  // Sub masca „vezi ca" pagina e personala chiar cand n-are niciun nume pe ea (masca
      // „neautentificat"): cu `public, max-age=300` browserul o servea din propriul cache si dupa
      // ce masca fusese scoasa, deci butonul benzii de jos parea ca nu face nimic (user, 11.09.2026).
    const cachePagina = { 'cache-control': ctx.utilizator || ctx.veziCa ? 'private, no-store' : env.MEDIU === 'dev' ? 'no-store' : CACHE_PAGINI }

    try {
      // Adresa unei zile e chiar data ei: /2026-09-13 (decizie user, 30 aug. 2026, adusa din V1).
      let data = azi
      // Forma veche a adresei, din V1: `/zi/2026-09-13`. Redirectionam permanent, ca legaturile
      // tiparite ori trimise pe email sa nu cada dupa cutover (user, 13.09.2026).
      if (cale.startsWith('/zi/')) {
        return Response.redirect(new URL(`${prefix}/${cale.slice('/zi/'.length)}`, url).toString(), 301)
      }
      if (cale !== '/') {
        const cerut = /^\/([^/]+)$/.exec(cale)?.[1] ?? ''
        const bun = cerut ? dataCeruta(cerut, azi) : null
        if (!bun) return html(paginaMesaj(ctx, 'Nu există', 'Adresa unei zile e data ei: /2026-09-13.'), 404)
        data = bun
      }

      const z = await ziuaIntreaga(env, data)
      const zi = await ziuaCalendarului(env.CALENDAR, data)
      // Textul pericopelor: referintele de rand vin de la calendar (le are pe toate zilele anului),
      // iar Evanghelia Utreniei din randuiala ROEA — pe amandoua textul il aduce tot calendarul.
      const [voscreasna, utrenie, apostol, evanghelie] = await Promise.all([
        zi?.evanghelia_invierii ? textulVoscresnei(env.CALENDAR, zi.evanghelia_invierii) : Promise.resolve(null),
        Promise.all((z.randuiala?.utrenie ?? []).map((r) => textulPericopei(env.CALENDAR, r.ref))),
        zi?.pericope.apostol ? Promise.all([textulPericopei(env.CALENDAR, zi.pericope.apostol)]) : Promise.resolve([]),
        zi?.pericope.evanghelie ? Promise.all([textulPericopei(env.CALENDAR, zi.pericope.evanghelie)]) : Promise.resolve([]),
      ])

      const zileCuRanduiala = await zileleCuRanduiala(env.DB)
      return html(
        paginaZilei(ctx, {
          ...z,
          zi,
          pericope: { voscreasna, utrenie: doarGasite(utrenie), apostol: doarGasite(apostol), evanghelie: doarGasite(evanghelie) },
          zileCuRanduiala,
          azi,
          maine: adaugaZile(azi, 1),
        }),
        200,
        cachePagina,
      )
    } catch (e) {
      log.error('eroare pagina', { eroare: e instanceof Error ? e.message : String(e) })
      return html(paginaMesaj(ctx, 'Eroare', 'A apărut o eroare neașteptată. Încearcă din nou.'), 500)
    }
  },
}
