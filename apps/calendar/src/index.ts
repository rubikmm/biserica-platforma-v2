import { z } from 'zod'
import { SCOPE_GLOBAL, SESIUNE_ANONIMA, type Principal, type SesiuneCurenta, type ZiLiturgica } from '@xc/contracts'
import { ClientAutorizare, EroareAutorizare } from '@xc/authorization'
import { NUME_COOKIE_CSRF, citesteCookie, construiesteCookie, sesiuneCurenta, verificaCsrf, verificaTokenCsrf } from '@xc/auth'
import { citesteConfig, navigatieDin, prefixSiCale } from '@xc/config'
import { construiesteEnvelope, declaratieOutbox, golesteOutbox } from '@xc/events'
import { Logger, correlationId } from '@xc/observability'
import { adaugaZile, aziBucuresti, dataVersiunii, eDataValida, eroareApi, html, json, jsonCuEtag, zileIntre } from '@xc/ui'
import pkg from '../package.json'
import { VOSCRESNE, textulPericopei, type PericopaCuText } from './biblia.js'
import {
  aniPreluati,
  cauta,
  corecteaza,
  corecturile,
  importurile,
  randulOriCalculat,
  randulZilei,
  randurileLunii,
  randuriInterval,
  referintele,
  schimbariDupa,
  scrieAnul,
  sePoateCalcula,
  textulZilei,
  versiuneaCalendarului,
  versiunile,
  zileleAnuluiCalculat,
  zileleCuCruce,
  CAMPURI_CORECTABILE,
  type CampCorectabil,
} from './depozit.js'
import { compuneAnul } from './compus.js'
import { extrageZi, faraTaguri, dataDinAcf, type RandZiExtras } from './extragere.js'
import { duminica, glasSiVoscreasna, perioadaOficiala, randuialaMesei, repereContract, sambataMortilor, ziLibera } from './pascalia.js'
import { canonizeazaReferinta } from './titluri.js'
import { type RandZi, desfaRandul, ziLiturgica } from './traducere.js'
import { type Ctx, type FelCruce, type Parte, type TexteZilei, paginaAdmin, paginaLuna, paginaMesaj, paginaSarbatori, paginaZi, texteFereastra } from './pagini.js'

export interface Env {
  DB: D1Database
  IDENTITATE: Fetcher
  AUTORIZARE: Fetcher
  AUDIT: Fetcher
  COMUNICARE: Fetcher
  EVENIMENTE: Queue
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  URL_BIBLIA: string
  /** Data publicarii, pentru subsol — binding-ul `version_metadata`. */
  VERSIUNE?: { timestamp?: string }
}

const SERVICIU = 'app-calendar'
/** Abonarea la calendar e o audienta a serviciului de comunicare; aplicatia nu tine adrese. */
const AUDIENTA = 'calendar-abonati'

async function comunicare<T = unknown>(env: Env, cale: string, corp: unknown): Promise<T | null> {
  try {
    const r = await env.COMUNICARE.fetch(`https://comunicare.intern${cale}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corp) })
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}

async function eAbonat(env: Env, userId: string): Promise<boolean> {
  const r = await comunicare<{ membri: unknown[] }>(env, '/audiente/membri', { audienceId: AUDIENTA, userId })
  return !!r && r.membri.length > 0
}
const CACHE_PAGINI = 'public, max-age=300'
const CACHE_API = 'public, max-age=600'

function principalDin(sesiune: SesiuneCurenta): Principal | null {
  if (!sesiune.authenticated || !sesiune.user) return null
  return { userId: sesiune.user.id, email: sesiune.user.email }
}

function redirect(catre: string, antete: Record<string, string> = {}): Response {
  return new Response(null, { status: 303, headers: { location: catre, ...antete } })
}

function jetonCsrfNou(): string {
  const octeti = crypto.getRandomValues(new Uint8Array(24))
  let binar = ''
  for (const octet of octeti) binar += String.fromCharCode(octet)
  return btoa(binar).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function asiguraCsrf(req: Request, domeniu: string): { jeton: string; setCookie?: string } {
  const existent = citesteCookie(req, NUME_COOKIE_CSRF)
  if (existent) return { jeton: existent }
  const jeton = jetonCsrfNou()
  return { jeton, setCookie: construiesteCookie(NUME_COOKIE_CSRF, jeton, { maxAge: 4 * 60 * 60, domeniu }) }
}

async function scrieAudit(env: Env, intrare: { action: string; target: string; outcome: 'success' | 'failure' | 'denied'; correlationId: string; actorId?: string; summary?: Record<string, unknown> }): Promise<void> {
  try {
    await env.AUDIT.fetch('https://audit.intern/scrie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: intrare.action,
        target: intrare.target,
        scope: SCOPE_GLOBAL,
        actor: intrare.actorId ? { type: 'user', id: intrare.actorId } : { type: 'system' },
        outcome: intrare.outcome,
        correlationId: intrare.correlationId,
        summary: intrare.summary ?? {},
      }),
    })
  } catch {
    // auditul indisponibil nu blocheaza operatia
  }
}

const eAdresaDeMasina = (cale: string) => /^\/(v1|intern|\.well-known|health)(\/|$)/.test(cale)

function dataDin(text: string, azi: string): string | null {
  if (text === 'azi') return azi
  if (text === 'maine') return adaugaZile(azi, 1)
  return eDataValida(text) ? text : null
}

/** O zi completa: randul (preluat sau calculat), desfacerea si forma de contract. */
async function ziuaCompleta(env: Env, data: string, ani: number[], versiune: string) {
  const r = await randulOriCalculat(env.DB, data, ani)
  if (!r) return null
  return { r, d: desfaRandul(r), zi: ziLiturgica(r, versiune) }
}

async function textele(env: Env, r: RandZi, zi: ZiLiturgica, d: ReturnType<typeof desfaRandul>): Promise<TexteZilei> {
  const [sinaxar, apostol, evanghelie, voscreasna, ...inPlus] = await Promise.all([
    r.calculat ? Promise.resolve(null) : textulZilei(env.DB, r.data),
    zi.pericope.apostol ? textulPericopei(env.URL_BIBLIA, zi.pericope.apostol) : Promise.resolve(null),
    zi.pericope.evanghelie ? textulPericopei(env.URL_BIBLIA, zi.pericope.evanghelie) : Promise.resolve(null),
    zi.evanghelia_invierii && VOSCRESNE[zi.evanghelia_invierii]
      ? textulPericopei(env.URL_BIBLIA, VOSCRESNE[zi.evanghelia_invierii]!).then((t) => ({ nr: zi.evanghelia_invierii!, text: t }))
      : Promise.resolve(null),
    // citirile in plus din titlu (ale ierarhului, ale sfantului), dupa cele doua de rand
    ...d.citiri
      .filter((c) => !/^(Ap\.|Ev\.|Apostolul|Evanghelia)/.test(c))
      .map((c) => canonizeazaReferinta(c))
      .filter((c) => c && c !== zi.pericope.apostol && c !== zi.pericope.evanghelie)
      .slice(0, 4)
      .map((c) => textulPericopei(env.URL_BIBLIA, c)),
  ])
  return { sinaxar, apostol, evanghelie, voscreasna, inPlus: inPlus as PericopaCuText[] }
}

const SURSA = 'Patriarhia Romana — calendar.patriarhia.ro'

/** Preluarea unui an direct din worker: aceeasi extragere ca scriptul de pe masina. */
async function preiaAnul(env: Env, an: number): Promise<{ zile: number }> {
  const endpoint = `https://calendar.patriarhia.ro/wp-json/wp/v2/calendar-entry-${String(an).slice(2)}`
  const intrari: Array<{ data: string | null; id: number; link: string; titlu: string; acf: Record<string, unknown> }> = []
  let octeti = 0
  for (let pagina = 1; pagina <= 20; pagina++) {
    const r = await fetch(`${endpoint}?per_page=100&page=${pagina}&orderby=id&order=asc`, {
      headers: { accept: 'application/json', 'user-agent': 'biserica-platforma-v2 (calendar; preluare calendar oficial)' },
    })
    if (r.status === 400 && pagina > 1) break
    if (!r.ok) throw new Error(`sursa a răspuns ${r.status}`)
    const text = await r.text()
    octeti += text.length
    const lot = JSON.parse(text) as Array<{ id: number; link: string; title?: { rendered?: string }; acf?: Record<string, unknown> }>
    if (!Array.isArray(lot) || !lot.length) break
    for (const i of lot) intrari.push({ data: dataDinAcf(i.acf, null), id: i.id, link: i.link, titlu: faraTaguri(i.title?.rendered ?? ''), acf: i.acf ?? {} })
    if (lot.length < 100) break
  }
  if (!intrari.length) throw new Error('sursa n-a dat nicio zi — anul nu e publicat încă')
  const datele = new Set<string>()
  for (const i of intrari) {
    if (!i.data || !i.data.startsWith(String(an))) throw new Error(`zi cu dată străină de an (id ${i.id})`)
    if (datele.has(i.data)) throw new Error(`dată dublată în sursă: ${i.data}`)
    datele.add(i.data)
  }
  const preluat_la = new Date().toISOString()
  const randuri = intrari
    .map((i) => extrageZi(i, preluat_la))
    .map(({ rand, sinaxar }) => ({ rand: rand as unknown as RandZi, sinaxar }))
    .sort((a, b) => (a.rand.data < b.rand.data ? -1 : 1))
  await scrieAnul(env.DB, an, randuri, { sursa: SURSA, endpoint, octeti, preluat_la })
  return { zile: randuri.length }
}

export default {
  async fetch(req: Request, env: Env, ctxExec: ExecutionContext): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: SERVICIU, correlationId: cid })
    const url = new URL(req.url)
    const { prefix, cale } = prefixSiCale(url, '/calendar')
    const nav = navigatieDin(cfg)
    const azi = aziBucuresti()

    // ------------------------------------------------------------------ masini
    if (eAdresaDeMasina(cale)) {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, HEAD, OPTIONS', 'access-control-allow-headers': 'if-none-match, content-type' } })
      if (req.method !== 'GET' && req.method !== 'HEAD') return eroareApi(405, 'metoda_nepermisa', 'Sub /v1 merg doar GET, HEAD și OPTIONS.')
      try {
        return await api(req, env, cale, url, azi)
      } catch (e) {
        log.error('eroare api', { eroare: e instanceof Error ? e.message : String(e) })
        return eroareApi(500, 'eroare_interna', 'A apărut o eroare neașteptată.')
      }
    }

    // ------------------------------------------------------------------ oameni
    if (req.method === 'POST') {
      const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA])
      if (problema) {
        const ctxMinim: Ctx = { prefix, nav, utilizator: null, eAdmin: false, versiune: pkg.version, modificata: dataVersiunii(env.VERSIUNE), anCurent: Number(azi.slice(0, 4)) }
        return html(paginaMesaj(ctxMinim, 'Verificare de securitate', problema), 403)
      }
    }
    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const principal = principalDin(sesiune)
    const ctx: Ctx = {
      prefix,
      nav,
      utilizator: sesiune.user?.displayName ?? sesiune.user?.email ?? null,
      eAdmin: sesiune.roles.some((r) => r.role === 'admin' || r.role === 'super-admin'),
      versiune: pkg.version,
      modificata: dataVersiunii(env.VERSIUNE),
      anCurent: Number(azi.slice(0, 4)),
    }
    const authz = new ClientAutorizare(env.AUTORIZARE, cid)

    try {
      const ani = await aniPreluati(env.DB)
      const { versiune } = await versiuneaCalendarului(env.DB)
      const aniCalculati = ani.length ? [Math.max(...ani) + 1, Math.max(...ani) + 2] : []
      const aniDisponibili = [...ani, ...aniCalculati]
      const cachePagina = { 'cache-control': ctx.utilizator ? 'private, no-store' : CACHE_PAGINI }

      // lista lunii: `/`, `/2026`, `/2026-08`
      const mLuna = /^\/(\d{4})(?:-(\d{2}))?$/.exec(cale)
      if ((cale === '/' || mLuna) && req.method === 'GET') {
        const [anAzi, lunaAzi] = azi.split('-').map(Number) as [number, number]
        let an = mLuna ? Number(mLuna[1]) : anAzi
        let luna = mLuna?.[2] ? Number(mLuna[2]) : an === anAzi ? lunaAzi : 1
        if (luna < 1 || luna > 12) luna = 1
        if (!ani.includes(an) && !sePoateCalcula(an, ani)) {
          return html(paginaMesaj(ctx, 'Anul nu e preluat', `Calendarul oficial pentru ${an} nu e în bază și nu se poate calcula încă. Anii disponibili: ${aniDisponibili.join(', ') || 'niciunul'}.`), 404)
        }
        const calculat = !ani.includes(an)
        const randuri = calculat ? (await zileleAnuluiCalculat(env.DB, an)).filter((r) => r.luna === luna) : await randurileLunii(env.DB, an, luna)
        const lista = randuri.map((r) => ({ r, d: desfaRandul(r), zi: ziLiturgica(r, versiune) }))
        const semn = url.searchParams.get('abonat')
        const mesajAbonare = semn === '1' ? 'Gata, te-am trecut pe listă.' : semn === '0' ? 'Nu am putut face abonarea; încearcă din nou.' : semn === '2' ? 'Te-am scos de pe listă.' : undefined
        const abonat = principal ? await eAbonat(env, principal.userId) : false
        return html(paginaLuna({ ctx, an, luna, randuri: lista, calculat, azi, cale: `${prefix}${cale}`, mesajAbonare, abonat }), 200, cachePagina)
      }

      // ziua si partile ei — aceleasi adrese pe care le foloseste si fereastra din lista
      const mZi = /^\/zi\/(\d{4}-\d{2}-\d{2})(?:\/(sinaxar|apostolul-evanghelia))?$/.exec(cale)
      if (mZi && req.method === 'GET') {
        const data = mZi[1]!
        const parte = mZi[2] as Parte | undefined
        if (!eDataValida(data)) return html(paginaMesaj(ctx, 'Dată greșită', 'Adresa e /zi/AAAA-LL-ZZ.'), 400)
        const z = await ziuaCompleta(env, data, ani, versiune)
        if (!z) return html(paginaMesaj(ctx, `Ziua ${data} nu e preluată`, 'Alege o lună din șirul de sus.'), 404)
        const t = await textele(env, z.r, z.zi, z.d)
        const abonat = principal ? await eAbonat(env, principal.userId) : false
        return html(
          paginaZi({ ctx, ...z, texte: t, ...(parte ? { parte } : {}), ieri: adaugaZile(data, -1), maine: adaugaZile(data, 1), abonat, cale: `${prefix}${cale}` }),
          200,
          cachePagina,
        )
      }

      // listele de sarbatori din „Informații utile"
      const mSarb = /^\/sarbatori\/cruce-(rosie|neagra)(?:\/(\d{4})(?:-(\d{2}))?)?$/.exec(cale)
      if (mSarb && req.method === 'GET') {
        const fel = mSarb[1] as FelCruce
        const an = mSarb[2] ? Number(mSarb[2]) : ctx.anCurent
        const luna = mSarb[3] ? Number(mSarb[3]) : undefined
        let randuri: RandZi[]
        let calculat = false
        if (ani.includes(an)) randuri = await zileleCuCruce(env.DB, an, fel)
        else if (sePoateCalcula(an, ani)) {
          randuri = (await zileleAnuluiCalculat(env.DB, an)).filter((r) => r.cruce === fel)
          calculat = true
        } else return html(paginaMesaj(ctx, `${an} nu e preluat`, ani.length ? `Anii preluați până acum: ${ani.join(', ')}.` : 'Încă nu s-a preluat niciun an.'), 404)
        const cuZile = new Set(randuri.map((r) => r.luna))
        const alese = luna ? randuri.filter((r) => r.luna === luna) : randuri
        const lista = alese.map((r) => ({ r, d: desfaRandul(r), zi: ziLiturgica(r, versiune) }))
        const abonat = principal ? await eAbonat(env, principal.userId) : false
        return html(
          paginaSarbatori({ ctx, fel, an, ...(luna ? { luna } : {}), randuri: lista, cuZile, calculat, azi, cale: `${prefix}${cale}`, abonat }),
          200,
          cachePagina,
        )
      }

      // abonarea: cu adresa contului, in audienta serviciului de comunicare
      if (cale === '/abonare' || cale === '/dezabonare') {
        if (req.method !== 'POST') return redirect(`${prefix}/`)
        if (!principal) return redirect(`${nav.cont}/auth/login`)
        const formular = await req.formData()
        const spre = String(formular.get('spre') ?? `${prefix}/`)
        const spreSigur = spre.startsWith('/') && !spre.startsWith('//') ? spre : `${prefix}/`
        const inscrie = cale === '/abonare'
        const r = inscrie
          ? await comunicare(env, '/audiente/inscrie', { audienceId: AUDIENTA, nume: 'Abonații calendarului', userId: principal.userId, channel: 'email', adresa: principal.email })
          : await comunicare(env, '/audiente/scoate', { audienceId: AUDIENTA, userId: principal.userId, channel: 'email' })
        await scrieAudit(env, { action: inscrie ? 'calendar.subscribe' : 'calendar.unsubscribe', target: AUDIENTA, outcome: r ? 'success' : 'failure', correlationId: cid, actorId: principal.userId })
        return redirect(`${spreSigur}?abonat=${!r ? 0 : inscrie ? 1 : 2}`)
      }

      // administrare
      if (cale === '/admin' && req.method === 'GET') {
        if (!principal) return redirect(`${nav.cont}/auth/login`)
        const decizie = await authz.can(principal, 'calendar.manage', SCOPE_GLOBAL)
        if (!decizie.allowed) {
          await scrieAudit(env, { action: 'calendar.admin.open', target: 'calendar', outcome: 'denied', correlationId: cid, actorId: principal.userId, summary: { motiv: decizie.reason } })
          return html(paginaMesaj(ctx, 'Acces refuzat', 'Nu ai permisiunea de a administra calendarul.'), 403)
        }
        const csrf = asiguraCsrf(req, cfg.DOMENIU_COOKIE)
        const [importuri, versiuni, corecturi, membri] = await Promise.all([
          importurile(env.DB),
          versiunile(env.DB),
          corecturile(env.DB),
          comunicare<{ membri: Array<{ user_id: string; adresa: string; created_at: string }> }>(env, '/audiente/membri', { audienceId: AUDIENTA }),
        ])
        const abonati = membri?.membri ?? []
        return html(
          paginaAdmin({ ctx, importuri, versiuni, corecturi, abonati, versiuneCalendar: versiune, aniCalculati, csrf: csrf.jeton, mesaj: url.searchParams.get('ok') ?? undefined, eroare: url.searchParams.get('eroare') ?? undefined }),
          200,
          csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {},
        )
      }

      if (cale === '/admin/preia' && req.method === 'POST') {
        if (!principal) return redirect(`${nav.cont}/auth/login`)
        const formular = await req.formData()
        const problemaCsrf = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problemaCsrf) return html(paginaMesaj(ctx, 'Verificare de securitate', problemaCsrf), 403)
        await authz.require(principal, 'calendar.manage', SCOPE_GLOBAL)
        const an = z.coerce.number().int().min(2024).max(2099).parse(formular.get('an'))
        try {
          const rezultat = await preiaAnul(env, an)
          await scrieAudit(env, { action: 'calendar.year.imported', target: String(an), outcome: 'success', correlationId: cid, actorId: principal.userId, summary: rezultat })
          return redirect(`${prefix}/admin?ok=${encodeURIComponent(`Anul ${an} preluat: ${rezultat.zile} zile.`)}`)
        } catch (e) {
          const mesaj = e instanceof Error ? e.message : String(e)
          await scrieAudit(env, { action: 'calendar.year.imported', target: String(an), outcome: 'failure', correlationId: cid, actorId: principal.userId, summary: { mesaj } })
          return redirect(`${prefix}/admin?eroare=${encodeURIComponent(`Preluarea anului ${an} a eșuat: ${mesaj}`)}`)
        }
      }

      if (cale === '/admin/corecteaza' && req.method === 'POST') {
        if (!principal) return redirect(`${nav.cont}/auth/login`)
        const formular = await req.formData()
        const problemaCsrf = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problemaCsrf) return html(paginaMesaj(ctx, 'Verificare de securitate', problemaCsrf), 403)
        await authz.require(principal, 'calendar.manage', SCOPE_GLOBAL)
        const date = z
          .object({
            data: z.string().refine(eDataValida, 'data nu e validă'),
            camp: z.enum(CAMPURI_CORECTABILE),
            valoare: z.string().max(2000),
            motiv: z.string().trim().min(1).max(300),
          })
          .parse({ data: formular.get('data'), camp: formular.get('camp'), valoare: formular.get('valoare') ?? '', motiv: formular.get('motiv') })
        const { versiune: vNoua } = await versiuneaCalendarului(env.DB)
        const envelope = construiesteEnvelope({
          type: 'calendar.corrected.v1',
          producer: SERVICIU,
          actor: { type: 'user', id: principal.userId },
          correlationId: cid,
          idempotencyKey: `corectura:${date.data}:${date.camp}:${Date.now()}`,
          payload: { deLa: date.data, panaLa: date.data, versiuneCalendar: vNoua, motiv: date.motiv },
        })
        const { veche } = await corecteaza(env.DB, date.data, date.camp as CampCorectabil, date.valoare, date.motiv, principal.userId, [declaratieOutbox(env.DB, envelope)])
        await scrieAudit(env, { action: 'calendar.day.corrected', target: date.data, outcome: 'success', correlationId: cid, actorId: principal.userId, summary: { camp: date.camp, motiv: date.motiv } })
        ctxExec.waitUntil(golesteOutbox(env.DB, env.EVENIMENTE))
        return redirect(`${prefix}/admin?ok=${encodeURIComponent(`Corectură scrisă pe ${date.data} (${date.camp}: „${veche ?? ''}" → „${date.valoare}").`)}`)
      }

      return html(paginaMesaj(ctx, 'Pagina nu există', 'Adresele calendarului: /, /2026-09, /zi/2026-09-10, /sarbatori/cruce-rosie.'), 404)
    } catch (e) {
      if (e instanceof EroareAutorizare) {
        await scrieAudit(env, { action: 'calendar.permission.denied', target: e.permission, outcome: 'denied', correlationId: cid, actorId: principal?.userId, summary: { motiv: e.reason } })
        return html(paginaMesaj(ctx, 'Acces refuzat', 'Nu ai permisiunea necesară.'), 403)
      }
      if (e instanceof z.ZodError) return html(paginaMesaj(ctx, 'Date invalide', e.issues[0]?.message ?? 'Date invalide.'), 400)
      log.error('eroare neasteptata', { eroare: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined })
      return html(paginaMesaj(ctx, 'Eroare', 'A apărut o eroare neașteptată.'), 500)
    }
  },

  async scheduled(_ev: ScheduledController, env: Env): Promise<void> {
    const rezultat = await golesteOutbox(env.DB, env.EVENIMENTE)
    if (rezultat.publicate > 0 || rezultat.esuate > 0) new Logger({ service: SERVICIU, correlationId: 'cron' }).info('outbox golit', rezultat)
  },
}

// ---------------------------------------------------------------------------
// API-ul `/v1` — GET, public, forma din CONTRACTE.md
// ---------------------------------------------------------------------------

async function api(req: Request, env: Env, cale: string, url: URL, azi: string): Promise<Response> {
  const ani = await aniPreluati(env.DB)
  const { versiune, moment } = await versiuneaCalendarului(env.DB)
  const aniCalculati = ani.length ? [Math.max(...ani) + 1, Math.max(...ani) + 2] : []
  const cache = { 'cache-control': CACHE_API }

  if (cale === '/health') {
    return json({ ok: true, app: 'calendar', cod: 'A1', ani_preluati: ani, ani_calculati: aniCalculati, versiune_calendar: versiune, mediu: env.MEDIU, versiune: pkg.version, publicat: env.VERSIUNE?.timestamp ?? null, ora: new Date().toISOString() }, 200, { 'cache-control': 'no-store' })
  }

  if (cale === '/v1' || cale === '/v1/') {
    return jsonCuEtag(req, {
      app: 'calendar',
      ani_preluati: ani,
      ani_calculati: aniCalculati,
      versiune_calendar: versiune,
      adrese: [
        { adresa: '/v1/zi/<AAAA-LL-ZZ> · /v1/zi/azi · /v1/zi/maine', ce_da: 'un zi_liturgica' },
        { adresa: '/v1/interval?de_la=&pana_la=', ce_da: 'lista zilelor, cel mult 366' },
        { adresa: '/v1/an/<an>/repere', ce_da: 'Paștele și zilele mobile, posturile; orice an 1900–2099' },
        { adresa: '/v1/versiune?dupa=', ce_da: 'versiunea calendarului și intervalele de recitit' },
        { adresa: '/v1/cauta?q=&an=', ce_da: 'zilele al căror titlu se potrivește' },
        { adresa: '/v1/texte/<data>', ce_da: 'sinaxarul zilei (HTML curățat)' },
        { adresa: '/v1/sursa/zi/<data> · /v1/sursa/an/<an>', ce_da: 'rândul brut al Patriarhiei, netradus' },
        { adresa: '/v1/atelier/pascalia?an=', ce_da: 'Pascalia față în față cu calendarul oficial' },
      ],
    }, cache)
  }

  const mZi = /^\/v1\/zi\/([^/]+)$/.exec(cale)
  if (mZi) {
    const data = dataDin(mZi[1]!, azi)
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / maine).')
    const r = await randulOriCalculat(env.DB, data, ani)
    if (!r) return eroareApi(404, 'zi_inexistenta', 'Data cerută e în afara intervalului acoperit.', { ani_preluati: ani, ani_calculati: aniCalculati })
    return jsonCuEtag(req, ziLiturgica(r, versiune), cache)
  }

  if (cale === '/v1/interval') {
    const deLa = url.searchParams.get('de_la') ?? ''
    const panaLa = url.searchParams.get('pana_la') ?? ''
    if (!eDataValida(deLa) || !eDataValida(panaLa) || deLa > panaLa) return eroareApi(400, 'interval_invalid', 'Cer de_la și pana_la ca AAAA-LL-ZZ, în ordine.')
    if (zileIntre(deLa, panaLa) >= 366) return eroareApi(400, 'interval_prea_mare', 'Cel mult 366 de zile odată.')
    const preluate = await randuriInterval(env.DB, deLa, panaLa)
    const zile = new Map(preluate.map((r) => [r.data, r]))
    for (const an of aniCalculati) {
      if (`${an}-12-31` < deLa || `${an}-01-01` > panaLa) continue
      for (const r of await zileleAnuluiCalculat(env.DB, an)) if (r.data >= deLa && r.data <= panaLa) zile.set(r.data, r)
    }
    const lista = [...zile.values()].sort((a, b) => (a.data < b.data ? -1 : 1)).map((r) => ziLiturgica(r, versiune))
    return jsonCuEtag(req, { de_la: deLa, pana_la: panaLa, versiune_calendar: versiune, zile: lista }, cache)
  }

  const mRepere = /^\/v1\/an\/(\d{4})\/repere$/.exec(cale)
  if (mRepere) {
    const an = Number(mRepere[1])
    if (an < 1900 || an > 2099) return eroareApi(400, 'an_neacoperit', 'Pascalia acoperă 1900–2099.')
    return jsonCuEtag(req, repereContract(an), cache)
  }

  if (cale === '/v1/versiune') {
    const dupa = url.searchParams.get('dupa')
    const toateV = await versiunile(env.DB)
    const schimbari = toateV.map((v) => ({ moment: v.moment, de_la: v.de_la, pana_la: v.pana_la, motiv: v.motiv }))
    const corp: Record<string, unknown> = { versiune_calendar: versiune, moment, ani_preluati: ani, ani_calculati: aniCalculati, schimbari }
    if (dupa) corp.de_recitit = (await schimbariDupa(env.DB, dupa)).map((v) => ({ de_la: v.de_la, pana_la: v.pana_la, motiv: v.motiv }))
    return jsonCuEtag(req, corp, { 'cache-control': 'no-store' })
  }

  if (cale === '/v1/cauta') {
    const q = (url.searchParams.get('q') ?? '').trim()
    if (q.length < 3) return eroareApi(400, 'cautare_scurta', 'Cel puțin 3 litere.')
    const anText = url.searchParams.get('an')
    const an = anText ? Number(anText) : undefined
    const rezultate = await cauta(env.DB, q, an)
    return jsonCuEtag(req, { q, an: an ?? null, gasite: rezultate.length, zile: rezultate.map((r) => ziLiturgica(r, versiune)) }, cache)
  }

  // Textele zilei, in forma pe care o citeste fereastra din lista (aceeasi ca in V1).
  const mTexte = /^\/v1\/texte\/(\d{4}-\d{2}-\d{2})$/.exec(cale)
  if (mTexte) {
    const data = mTexte[1]!
    const r = await randulOriCalculat(env.DB, data, ani)
    if (!r) return eroareApi(404, 'zi_inexistenta', 'Data cerută e în afara intervalului acoperit.')
    const d = desfaRandul(r)
    const zi = ziLiturgica(r, versiune)
    const texte = await textele(env, r, zi, d)
    return jsonCuEtag(req, texteFereastra({ r, d, zi, texte }), cache)
  }

  const mSursaZi = /^\/v1\/sursa\/zi\/(\d{4}-\d{2}-\d{2})$/.exec(cale)
  if (mSursaZi) {
    const r = await randulOriCalculat(env.DB, mSursaZi[1]!, ani)
    if (!r) return eroareApi(404, 'zi_inexistenta', 'Data cerută e în afara intervalului acoperit.')
    return jsonCuEtag(req, r, cache)
  }
  const mSursaAn = /^\/v1\/sursa\/an\/(\d{4})$/.exec(cale)
  if (mSursaAn) {
    const an = Number(mSursaAn[1])
    if (ani.includes(an)) return jsonCuEtag(req, { an, zile: await randuriInterval(env.DB, `${an}-01-01`, `${an}-12-31`) }, cache)
    if (sePoateCalcula(an, ani)) {
      const compus = compuneAnul(an, await referintele(env.DB))
      return jsonCuEtag(req, { an, calculat: true, referinta: compus.referinta, nesigure: compus.nesigure, zile: compus.zile }, cache)
    }
    return eroareApi(404, 'an_neacoperit', 'Anul nu e nici preluat, nici calculabil.')
  }

  // Atelier: Pascalia contra calendarului oficial, camp cu camp.
  if (cale === '/v1/atelier/pascalia') {
    const an = Number(url.searchParams.get('an') ?? azi.slice(0, 4))
    if (!ani.includes(an)) return eroareApi(404, 'an_neacoperit', 'Proba se face doar pe un an cu calendar oficial.')
    const randuri = await randuriInterval(env.DB, `${an}-01-01`, `${an}-12-31`)
    const nepotriviri: Array<Record<string, unknown>> = []
    const campuri = { post: 0, perioada: 0, sambata_mortilor: 0, zi_libera: 0, duminica: 0, glas: 0, voscr: 0 }
    for (const r of randuri) {
      const d = desfaRandul(r)
      const calc = {
        post: randuialaMesei(r.data, { cruce_text: r.cruce_text, titlu: r.titlu }),
        perioada: perioadaOficiala(r.data),
        sambata_mortilor: sambataMortilor(r.data),
        zi_libera: ziLibera(r.data) ? 1 : 0,
      }
      const dif: Record<string, unknown> = {}
      if (calc.post !== r.post) { dif.post = { oficial: r.post, calculat: calc.post }; campuri.post++ }
      if (calc.perioada !== r.perioada) { dif.perioada = { oficial: r.perioada, calculat: calc.perioada }; campuri.perioada++ }
      if (calc.sambata_mortilor !== r.sambata_mortilor) { dif.sambata_mortilor = { oficial: r.sambata_mortilor, calculat: calc.sambata_mortilor }; campuri.sambata_mortilor++ }
      if (calc.zi_libera !== r.zi_libera) { dif.zi_libera = { oficial: r.zi_libera, calculat: calc.zi_libera }; campuri.zi_libera++ }
      if (r.zi_saptamana === 0) {
        const dum = duminica(r.data)
        const gv = glasSiVoscreasna(r.data)
        const oficial = d.denumire ?? ''
        const calculat = dum?.nume ?? ''
        if (oficial.replace(/\s+/g, ' ') !== calculat && !(oficial === '' && calculat === '')) { dif.duminica = { oficial, calculat, nesigur: dum?.nesigur ?? false }; campuri.duminica++ }
        if ((d.glas ?? null) !== gv.glas) { dif.glas = { oficial: d.glas, calculat: gv.glas }; campuri.glas++ }
        if ((d.voscr ?? null) !== gv.voscr) { dif.voscr = { oficial: d.voscr, calculat: gv.voscr }; campuri.voscr++ }
      }
      if (Object.keys(dif).length) nepotriviri.push({ data: r.data, titlu: r.titlu.slice(0, 90), ...dif })
    }
    return json({ an, zile: randuri.length, nepotriviri_pe_camp: campuri, nepotriviri }, 200, { 'cache-control': 'no-store' })
  }

  return eroareApi(404, 'adresa_inexistenta', 'Adresa nu există. Indexul e la /v1.')
}

// Exporturi pentru teste.
export { ziLiturgica, desfaRandul, extrageZi }
export type { RandZiExtras }
