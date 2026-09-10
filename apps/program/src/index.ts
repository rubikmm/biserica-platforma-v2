import { z } from 'zod'
import { SCOPE_GLOBAL, SESIUNE_ANONIMA, SlujbaDeScris, type IntrareVocabular, type Principal, type SesiuneCurenta, type Slujba } from '@xc/contracts'
import { ClientAutorizare, EroareAutorizare } from '@xc/authorization'
import { NUME_COOKIE_CSRF, citesteCookie, construiesteCookie, sesiuneCurenta, verificaCsrf, verificaTokenCsrf } from '@xc/auth'
import { citesteConfig, navigatieDin, prefixSiCale } from '@xc/config'
import { construiesteEnvelope, declaratieOutbox, golesteOutbox } from '@xc/events'
import { Logger, correlationId } from '@xc/observability'
import { adaugaZile, aziBucuresti, dataVersiunii, eDataValida, eroareApi, html, intervalLizibil, json, jsonCuEtag, luneaSaptamanii, oraBucuresti, zileIntre } from '@xc/ui'
import pkg from '../package.json'
import { calendarulIntervalului, texteleZilei, ziuaCalendarului } from './calendar.js'
import {
  acoperire,
  aniiArhivei,
  istoriculSaptamanii,
  istoriculSlujbelor,
  saptamana,
  saptamanaDin,
  saptamanileAnului,
  saptamaniInterval,
  scrieSaptamana,
  slujbaDin,
  slujbeInterval,
  slujbeleSaptamanii,
  urmatoareaSlujba,
  valideazaSaptamana,
  vecinele,
  vocabularul,
  type RandSaptamana,
} from './depozit.js'
import { foaieHtml, hartieDinCache, jpgDin, pdfDin, sfintiiHtml, titluSaptamanii } from './foaie.js'
import { propune } from './propunere.js'
import { type Ctx, type RandDeEditat, paginaAdmin, paginaArhiva, paginaMesaj, paginaSaptamana } from './pagini.js'

export interface Env {
  DB: D1Database
  IDENTITATE: Fetcher
  AUTORIZARE: Fetcher
  AUDIT: Fetcher
  CALENDAR: Fetcher
  COMUNICARE: Fetcher
  BROWSER: Fetcher
  EVENIMENTE: Queue
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  /** Data publicarii, pentru subsol — binding-ul `version_metadata`. */
  VERSIUNE?: { timestamp?: string }
}

const SERVICIU = 'app-program'
const AUDIENTA = 'program-abonati'
const CACHE_PAGINI = 'public, max-age=300'

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
  for (const o of octeti) binar += String.fromCharCode(o)
  return btoa(binar).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}
function asiguraCsrf(req: Request, domeniu: string): { jeton: string; setCookie?: string } {
  const existent = citesteCookie(req, NUME_COOKIE_CSRF)
  if (existent) return { jeton: existent }
  const jeton = jetonCsrfNou()
  return { jeton, setCookie: construiesteCookie(NUME_COOKIE_CSRF, jeton, { maxAge: 4 * 60 * 60, domeniu }) }
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
async function eAbonat(env: Env, userId: string): Promise<boolean> {
  const r = await comunicare<{ membri: unknown[] }>(env, '/audiente/membri', { audienceId: AUDIENTA, userId })
  return !!r && r.membri.length > 0
}

const eAdresaDeMasina = (cale: string) => /^\/(v1|intern|\.well-known|health)(\/|$)/.test(cale)

function dataDin(text: string, azi: string): string | null {
  if (text === 'azi') return azi
  if (text === 'maine') return adaugaZile(azi, 1)
  if (text === 'viitoare') return adaugaZile(azi, 7)
  return eDataValida(text) ? text : null
}

/** Inapoi sirul e deschis; inainte merge un SINGUR pas — pana la saptamana viitoare. */
function veciniLui(luni: string, azi: string): { inainte: string; dupa: string | null } {
  const limita = adaugaZile(luneaSaptamanii(azi), 7)
  return { inainte: adaugaZile(luni, -7), dupa: luni < limita ? adaugaZile(luni, 7) : null }
}

async function vocabularHarta(env: Env): Promise<{ lista: IntrareVocabular[]; harta: Map<string, IntrareVocabular> }> {
  const lista = await vocabularul(env.DB)
  return { lista, harta: new Map(lista.map((v) => [v.cod_nume, v])) }
}

/** Slujbele unei saptamani + starea ei; daca nu e scrisa, propunerea in aceeasi forma. */
async function saptamanaOriPropunere(env: Env, luni: string, vocabular: Map<string, IntrareVocabular>) {
  const rand = await saptamana(env.DB, luni)
  const cal = await calendarulIntervalului(env.CALENDAR, luni, adaugaZile(luni, 7))
  if (rand) {
    const slujbe = (await slujbeleSaptamanii(env.DB, luni)).map(slujbaDin)
    return { rand, slujbe, cal, propunere: null, dinCalendar: rand.sursa !== 'wp_program' && rand.sursa !== 'wp_articol' && rand.sursa !== 'wp_live' }
  }
  const istoric = await istoriculSlujbelor(env.DB, luni)
  const p = propune(luni, istoric, vocabular, cal)
  const slujbe: Slujba[] = p.zile.flatMap((zi) =>
    zi.slujbe.map((s) => ({ id: `${s.data}-${s.cod_nume}`, data: s.data, ora: s.ora, nume: s.nume, cod_nume: s.cod_nume, slujitor: null, loc: 'biserica', observatii: null, detalii: s.detalii, curatenie: false, transmisie: false })),
  )
  return { rand: null, slujbe, cal, propunere: p, dinCalendar: true }
}

export default {
  async fetch(req: Request, env: Env, ctxExec: ExecutionContext): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: SERVICIU, correlationId: cid })
    const url = new URL(req.url)
    const { prefix, cale } = prefixSiCale(url, '/program')
    const nav = navigatieDin(cfg)
    const azi = aziBucuresti()

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

    if (req.method === 'POST') {
      const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA])
      if (problema) {
        const ctxMinim: Ctx = { prefix, nav, utilizator: null, eAdmin: false, poateScrie: false, versiune: pkg.version, modificata: dataVersiunii(env.VERSIUNE) }
        return html(paginaMesaj(ctxMinim, 'Verificare de securitate', problema, 'rea'), 403)
      }
    }
    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const principal = principalDin(sesiune)
    const authz = new ClientAutorizare(env.AUTORIZARE, cid)
    const poateScrie = principal ? (await authz.can(principal, 'program.write', SCOPE_GLOBAL)).allowed : false
    const ctx: Ctx = {
      prefix,
      nav,
      utilizator: sesiune.user?.displayName ?? sesiune.user?.email ?? null,
      eAdmin: sesiune.roles.some((r) => r.role === 'admin' || r.role === 'super-admin'),
      poateScrie,
      versiune: pkg.version,
      modificata: dataVersiunii(env.VERSIUNE),
    }

    try {
      const { lista, harta } = await vocabularHarta(env)
      const cachePagina = { 'cache-control': ctx.utilizator ? 'private, no-store' : CACHE_PAGINI }
      const semn = url.searchParams.get('abonat')
      const mesajAbonare = semn === '1' ? 'Gata, te-am trecut pe listă.' : semn === '0' ? 'Nu am putut face abonarea; încearcă din nou.' : semn === '2' ? 'Te-am scos de pe listă.' : undefined

      // ---------------------------------------------------------- saptamana
      const mSapt = /^\/saptamana\/([^/]+)$/.exec(cale)
      if ((cale === '/' || mSapt) && req.method === 'GET') {
        const cerut = mSapt ? dataDin(mSapt[1]!, azi) : azi
        if (!cerut) return html(paginaMesaj(ctx, 'Dată greșită', 'Adresa e /saptamana/AAAA-LL-ZZ.', 'rea'), 404)
        const luni = luneaSaptamanii(cerut)
        const s = await saptamanaOriPropunere(env, luni, harta)
        const foaie = s.rand ? (s.rand.stare === 'validat' ? `/v1/foaie/${luni}` : null) : `/v1/propunere/${luni}`
        const abonat = principal ? await eAbonat(env, principal.userId) : false
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
            vecini: veciniLui(luni, azi),
            foaie,
            azi,
            cale: `${prefix}${cale}`,
            abonat,
            mesaj: mesajAbonare,
            nelamuriri: s.propunere?.nelamuriri,
            validatLa: s.rand?.validat_la ?? null,
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
        const ac = await acoperire(env.DB)
        return html(paginaArhiva({ ctx, an, ani, saptamani, total: ac.saptamani, deLa: ac.de_la }), 200, cachePagina)
      }

      // ------------------------------------------------------------ abonare
      if (cale === '/abonare' || cale === '/dezabonare') {
        if (req.method !== 'POST') return redirect(`${prefix}/`)
        if (!principal) return redirect(`${nav.cont}/auth/login`)
        const formular = await req.formData()
        const spre = String(formular.get('spre') ?? `${prefix}/`)
        const spreSigur = spre.startsWith('/') && !spre.startsWith('//') ? spre : `${prefix}/`
        const inscrie = cale === '/abonare'
        const r = inscrie
          ? await comunicare(env, '/audiente/inscrie', { audienceId: AUDIENTA, nume: 'Abonații programului', userId: principal.userId, channel: 'email', adresa: principal.email })
          : await comunicare(env, '/audiente/scoate', { audienceId: AUDIENTA, userId: principal.userId, channel: 'email' })
        await scrieAudit(env, { action: inscrie ? 'program.subscribe' : 'program.unsubscribe', target: AUDIENTA, outcome: r ? 'success' : 'failure', correlationId: cid, actorId: principal.userId })
        return redirect(`${spreSigur}?abonat=${!r ? 0 : inscrie ? 1 : 2}`)
      }

      // -------------------------------------------------------- administrare
      if (cale === '/admin' && req.method === 'GET') {
        if (!principal) return redirect(`${nav.cont}/auth/login`)
        await authz.require(principal, 'program.write', SCOPE_GLOBAL)
        const luni = luneaSaptamanii(dataDin(url.searchParams.get('luni') ?? 'azi', azi) ?? azi)
        const dinPropunere = url.searchParams.get('din') === 'propunere'
        const rand = await saptamana(env.DB, luni)
        let randuri: RandDeEditat[] = []
        if (rand && !dinPropunere) {
          randuri = (await slujbeleSaptamanii(env.DB, luni)).map((s) => {
            const sl = slujbaDin(s)
            return { data: sl.data, ora: sl.ora, cod_nume: sl.cod_nume, slujitor: sl.slujitor ?? '', detalii: sl.detalii.join('\n'), curatenie: sl.curatenie, transmisie: sl.transmisie }
          })
        } else {
          const cal = await calendarulIntervalului(env.CALENDAR, luni, adaugaZile(luni, 7))
          const p = propune(luni, await istoriculSlujbelor(env.DB, luni), harta, cal)
          randuri = p.zile.flatMap((zi) => zi.slujbe.map((s) => ({ data: s.data, ora: s.ora, cod_nume: s.cod_nume, slujitor: '', detalii: s.detalii.join('\n'), curatenie: true, transmisie: true })))
        }
        const cal = await calendarulIntervalului(env.CALENDAR, luni, luni)
        const csrf = asiguraCsrf(req, cfg.DOMENIU_COOKIE)
        return html(
          paginaAdmin({
            ctx,
            luni,
            titlu: rand?.titlu || titluSaptamanii(luni),
            stare: rand?.stare ?? 'propunere',
            randuri,
            vocabular: lista.filter((v) => v.activ),
            csrf: csrf.jeton,
            existaSaptamana: !!rand,
            dinPropunere,
            versiuneCalendar: cal?.versiune ?? null,
            istoric: await istoriculSaptamanii(env.DB, luni),
            mesaj: url.searchParams.get('ok') ?? undefined,
            eroare: url.searchParams.get('eroare') ?? undefined,
          }),
          200,
          csrf.setCookie ? { 'set-cookie': csrf.setCookie } : {},
        )
      }

      if (cale === '/admin/scrie' && req.method === 'POST') {
        if (!principal) return redirect(`${nav.cont}/auth/login`)
        const formular = await req.formData()
        const problemaCsrf = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problemaCsrf) return html(paginaMesaj(ctx, 'Verificare de securitate', problemaCsrf, 'rea'), 403)
        await authz.require(principal, 'program.write', SCOPE_GLOBAL)
        const luni = luneaSaptamanii(z.string().refine(eDataValida).parse(formular.get('luni')))
        const date = formular.getAll('data').map(String)
        const ore = formular.getAll('ora').map(String)
        const coduri = formular.getAll('cod_nume').map(String)
        const slujitori = formular.getAll('slujitor').map(String)
        const detalii = formular.getAll('detalii').map(String)
        const curatenie = new Set(formular.getAll('curatenie').map(String))
        const transmisie = new Set(formular.getAll('transmisie').map(String))
        const slujbe = coduri
          .map((cod, i) => ({ cod, i }))
          .filter(({ cod, i }) => cod && ore[i])
          .map(({ cod, i }) =>
            SlujbaDeScris.parse({
              data: date[i],
              ora: ore[i],
              cod_nume: cod,
              slujitor: slujitori[i] || undefined,
              detalii: (detalii[i] ?? '').split('\n').map((r) => r.trim()).filter(Boolean),
              curatenie: curatenie.has(String(i)),
              transmisie: transmisie.has(String(i)),
            }),
          )
        const inAfara = slujbe.find((s) => s.data < luni || s.data > adaugaZile(luni, 6))
        if (inAfara) return redirect(`${prefix}/admin?luni=${luni}&eroare=${encodeURIComponent('O slujbă are o zi din afara săptămânii.')}`)

        const rezultat = await scrieSaptamana(env.DB, luni, slujbe, harta, principal.userId)
        if (rezultat.stare === 'modificat_dupa_validare') {
          const envelope = construiesteEnvelope({
            type: 'program.week.changed.v1',
            producer: SERVICIU,
            actor: { type: 'user', id: principal.userId },
            correlationId: cid,
            idempotencyKey: `schimbat:${luni}:${Date.now()}`,
            payload: { luni, duminica: adaugaZile(luni, 6), stare: rezultat.stare, titlu: titluSaptamanii(luni), versiuneCalendar: null, slujbe: slujbe.length },
          })
          await declaratieOutbox(env.DB, envelope).run()
          ctxExec.waitUntil(golesteOutbox(env.DB, env.EVENIMENTE))
        }
        await scrieAudit(env, { action: 'program.week.written', target: luni, outcome: 'success', correlationId: cid, actorId: principal.userId, summary: { slujbe: slujbe.length, stare: rezultat.stare } })
        return redirect(`${prefix}/admin?luni=${luni}&ok=${encodeURIComponent(`Săptămâna a fost scrisă: ${slujbe.length} slujbe.`)}`)
      }

      if (cale === '/admin/valideaza' && req.method === 'POST') {
        if (!principal) return redirect(`${nav.cont}/auth/login`)
        const formular = await req.formData()
        const problemaCsrf = verificaTokenCsrf(req, String(formular.get('csrf') ?? ''))
        if (problemaCsrf) return html(paginaMesaj(ctx, 'Verificare de securitate', problemaCsrf, 'rea'), 403)
        await authz.require(principal, 'program.publish', SCOPE_GLOBAL)
        const luni = luneaSaptamanii(z.string().refine(eDataValida).parse(formular.get('luni')))
        const rand = await saptamana(env.DB, luni)
        if (!rand) return redirect(`${prefix}/admin?luni=${luni}&eroare=${encodeURIComponent('Săptămâna nu e scrisă încă.')}`)
        const cal = await calendarulIntervalului(env.CALENDAR, luni, adaugaZile(luni, 6))
        const slujbe = await slujbeleSaptamanii(env.DB, luni)
        const envelope = construiesteEnvelope({
          type: 'program.week.validated.v1',
          producer: SERVICIU,
          actor: { type: 'user', id: principal.userId },
          correlationId: cid,
          idempotencyKey: `validat:${luni}`,
          payload: { luni, duminica: adaugaZile(luni, 6), stare: 'validat', titlu: rand.titlu || titluSaptamanii(luni), versiuneCalendar: cal?.versiune ?? null, slujbe: slujbe.length },
        })
        await valideazaSaptamana(env.DB, luni, principal.userId, cal?.versiune ?? null, [declaratieOutbox(env.DB, envelope)])
        await scrieAudit(env, { action: 'program.week.validated', target: luni, outcome: 'success', correlationId: cid, actorId: principal.userId, summary: { versiuneCalendar: cal?.versiune ?? null } })
        ctxExec.waitUntil(golesteOutbox(env.DB, env.EVENIMENTE))
        return redirect(`${prefix}/admin?luni=${luni}&ok=${encodeURIComponent('Săptămâna e validată. Foaia A4 se poate tipări.')}`)
      }

      return html(paginaMesaj(ctx, 'Nu există pagina', 'Adresele programului: /, /saptamana/2026-09-07, /arhiva.'), 404)
    } catch (e) {
      if (e instanceof EroareAutorizare) {
        await scrieAudit(env, { action: 'program.permission.denied', target: e.permission, outcome: 'denied', correlationId: cid, actorId: principal?.userId, summary: { motiv: e.reason } })
        return html(paginaMesaj(ctx, 'Acces refuzat', 'Nu ai permisiunea necesară.', 'rea'), 403)
      }
      if (e instanceof z.ZodError) return html(paginaMesaj(ctx, 'Date invalide', e.issues[0]?.message ?? 'Date invalide.', 'rea'), 400)
      log.error('eroare neasteptata', { eroare: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined })
      return html(paginaMesaj(ctx, 'Eroare', 'A apărut o eroare neașteptată.', 'rea'), 500)
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
        { adresa: '/v1/interval?de_la=&pana_la=', ce_da: 'slujbele și starea săptămânilor atinse (cel mult 366 de zile)' },
        { adresa: '/v1/saptamani?an=', ce_da: 'săptămânile din bază, cea mai nouă prima' },
        { adresa: '/v1/slujbe/vocabular', ce_da: 'cele 29 de nume, cu cod_nume, categorie, activ' },
        { adresa: '/v1/foaie/<data>.pdf|.jpg|.html', ce_da: 'foaia A4 de pe ușă — numai săptămâni validate' },
        { adresa: '/v1/propunere/<data>.pdf|.jpg|.html', ce_da: 'aceeași foaie, din propunerea săptămânii' },
        { adresa: '/v1/sfintii-zilei/<data>.pdf|.html', ce_da: 'sfinții zilei, din datele calendarului' },
      ],
      reguli: ['ora e de perete, Europe/București', 'cod_nume nu e niciodată null', 'nimeni nu tipărește ce nu e validat'],
    }, cache)
  }

  if (cale === '/v1/slujbe/vocabular') return jsonCuEtag(req, { vocabular: lista }, { 'cache-control': 'public, max-age=3600', ...ANTETE_APP })

  const mSapt = /^\/v1\/saptamana\/([^/]+)$/.exec(cale)
  if (mSapt) {
    const data = dataDin(mSapt[1]!, azi)
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / maine / viitoare).')
    const luni = luneaSaptamanii(data)
    const rand = await saptamana(env.DB, luni)
    if (!rand) return eroareApi(404, 'saptamana_inexistenta', 'Săptămâna nu e în bază.', { de_la: luni, pana_la: adaugaZile(luni, 6), vecine: await vecinele(env.DB, luni) })
    return jsonCuEtag(req, saptamanaDin(rand, await slujbeleSaptamanii(env.DB, luni)), cache)
  }

  const mZi = /^\/v1\/zi\/([^/]+)$/.exec(cale)
  if (mZi) {
    const data = dataDin(mZi[1]!, azi)
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / maine).')
    const luni = luneaSaptamanii(data)
    const rand = await saptamana(env.DB, luni)
    const slujbe = (await slujbeInterval(env.DB, data, data)).map(slujbaDin)
    return jsonCuEtag(req, { data, saptamana: { de_la: luni, pana_la: adaugaZile(luni, 6) }, stare: rand?.stare ?? null, slujbe }, cache)
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

  if (cale === '/v1/saptamani') {
    const anText = url.searchParams.get('an')
    if (anText && !/^\d{4}$/.test(anText)) return eroareApi(400, 'an_invalid', 'Anul se scrie AAAA.')
    return jsonCuEtag(req, { saptamani: await saptamanileAnului(env.DB, anText ? Number(anText) : undefined) }, cache)
  }

  // ------------------------------------------------------------------ hartii
  const mFoaie = /^\/v1\/(foaie|propunere)\/([^/]+)\.(pdf|jpg|html)$/.exec(cale)
  if (mFoaie) {
    const fel = mFoaie[1] as 'foaie' | 'propunere'
    const data = dataDin(mFoaie[2]!, azi)
    const format = mFoaie[3] as 'pdf' | 'jpg' | 'html'
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / viitoare).')
    const luni = luneaSaptamanii(data)
    const rand = await saptamana(env.DB, luni)
    let slujbe: Slujba[]
    let titlu: string
    let dinCalendar = true
    if (fel === 'foaie') {
      if (!rand) return eroareApi(404, 'saptamana_inexistenta', 'Săptămâna nu e în bază.', { de_la: luni, pana_la: adaugaZile(luni, 6), vecine: await vecinele(env.DB, luni) })
      if (rand.stare !== 'validat') return eroareApi(409, 'saptamana_nevalidata', 'Foaia se tipărește numai din săptămâni validate.', { de_la: luni, pana_la: rand.duminica, stare: rand.stare })
      slujbe = (await slujbeleSaptamanii(env.DB, luni)).map(slujbaDin)
      titlu = rand.titlu || titluSaptamanii(luni)
      dinCalendar = rand.sursa === 'manual' || rand.sursa === 'propunere'
    } else {
      const p = propune(luni, await istoriculSlujbelor(env.DB, luni), harta, await calendarulIntervalului(env.CALENDAR, luni, adaugaZile(luni, 7)))
      slujbe = p.zile.flatMap((zi) => zi.slujbe.map((s) => ({ id: `${s.data}-${s.cod_nume}`, data: s.data, ora: s.ora, nume: s.nume, cod_nume: s.cod_nume, slujitor: null, loc: 'biserica', observatii: null, detalii: s.detalii, curatenie: false, transmisie: false })))
      titlu = titluSaptamanii(luni)
    }
    const cal = await calendarulIntervalului(env.CALENDAR, luni, adaugaZile(luni, 7))
    const corp = foaieHtml({ luni, duminica: adaugaZile(luni, 6), titlu, slujbe, vocabular: harta, calendar: cal, dinCalendar, ciorna: fel === 'propunere' })
    if (format === 'html') return new Response(corp, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', ...ANTETE_APP } })
    const nume = fel === 'foaie' ? `program-${luni}` : `propunere-${luni}`
    try {
      return await hartieDinCache(req, ctxExec, corp, format, nume, () => (format === 'pdf' ? pdfDin(env.BROWSER, corp) : jpgDin(env.BROWSER, corp)))
    } catch (e) {
      return eroareApi(503, 'pdf_indisponibil', 'Tiparul nu e disponibil acum; încearcă peste un minut sau ia varianta .html.', { detaliu: e instanceof Error ? e.message.slice(0, 200) : '' })
    }
  }

  const mSfinti = /^\/v1\/sfintii-zilei\/([^/]+)\.(pdf|html)$/.exec(cale)
  if (mSfinti) {
    const data = dataDin(mSfinti[1]!, azi)
    const format = mSfinti[2] as 'pdf' | 'html'
    if (!data) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / maine).')
    const zi = await ziuaCalendarului(env.CALENDAR, data)
    if (!zi) return eroareApi(502, 'calendar_indisponibil', 'Calendarul nu răspunde acum.')
    const cuSinaxar = url.searchParams.get('sinaxar') === '1'
    const texte = cuSinaxar ? await texteleZilei(env.CALENDAR, data) : null
    const corp = sfintiiHtml({ data, zi, sinaxar: texte?.sinaxar ?? null, cuSinaxar })
    if (format === 'html') return new Response(corp, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600', ...ANTETE_APP } })
    try {
      return await hartieDinCache(req, ctxExec, corp, 'pdf', `sfintii-zilei-${data}${cuSinaxar ? '-cu-sinaxar' : ''}`, () => pdfDin(env.BROWSER, corp))
    } catch (e) {
      return eroareApi(503, 'pdf_indisponibil', 'Tiparul nu e disponibil acum; încearcă peste un minut sau ia varianta .html.', { detaliu: e instanceof Error ? e.message.slice(0, 200) : '' })
    }
  }

  return eroareApi(404, 'adresa_inexistenta', 'Adresa nu există. Indexul e la /v1.')
}

export { titluSaptamanii, intervalLizibil }
