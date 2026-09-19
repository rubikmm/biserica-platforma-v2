import { z } from 'zod'
import { SCOPE_GLOBAL, SESIUNE_ANONIMA, type ZiLiturgica } from '@xc/contracts'
import { ClientAutorizare, eAdminulAplicatiei, EroareAutorizare } from '@xc/authorization'
import { NUME_COOKIE_CSRF, citesteCookie, construiesteCookie, principalDin, sesiuneCurenta, verificaCsrf, verificaTokenCsrf } from '@xc/auth'
import { adresaPaginii, citesteConfig, navigatieDin, prefixSiCale } from '@xc/config'
import { construiesteEnvelope, declaratieOutbox, golesteOutbox } from '@xc/events'
import { Logger, correlationId } from '@xc/observability'
import { adaugaZile, aziBucuresti, dataCeruta, dataVersiunii, eDataValida, eroareApi, hartieDinCache, html, intervalLizibil, json, jsonCuEtag, luneaSaptamanii, pngDin, zileIntre } from '@xc/ui'
import { modulActiuni } from '@xc/actiuni'
import pkg from '../package.json'
import { ACTIUNI } from './actiuni.js'
import { VOSCRESNE, textulPericopei, type PericopaCuText } from './biblia.js'
import {
  aniPreluati,
  cauta,
  corecteaza,
  corecturile,
  importurile,
  randulOriCalculat,
  randulZilei,
  randurileAnului,
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
  CAMPURI_CORECTABILE,
  type CampCorectabil,
} from './depozit.js'
import { compuneAnul } from './compus.js'
import { extrageZi, faraTaguri, dataDinAcf, type RandZiExtras } from './extragere.js'
import { duminica, glasSiVoscreasna, perioadaOficiala, randuialaMesei, repereContract, sambataMortilor, ziLibera } from './pascalia.js'
import { canonizeazaReferinta } from './titluri.js'
import { type RandZi, desfaRandul, ziLiturgica } from './traducere.js'
import { abonamentul, ruteazaAbonare } from '@xc/abonare'
import { ruteazaSetari } from '@xc/setari'
import { type Ctx, type FelFiltru, type Parte, type TexteZilei, paginaAdmin, paginaCarcasa, paginaCautare, paginaLuna, paginaMesaj, paginaSarbatori, paginaZi, poateFiltra, pozaSaptamaniiHtml, texteFereastra, trecePrinFiltru } from './pagini.js'

export interface Env {
  DB: D1Database
  IDENTITATE: Fetcher
  AUTORIZARE: Fetcher
  AUDIT: Fetcher
  COMUNICARE: Fetcher
  /** Biblia (A10): de la ea vine textul pericopelor, prin Service Binding. */
  BIBLIA: Fetcher
  /** Browser Rendering — din el iese poza saptamanii. */
  BROWSER: Fetcher
  EVENIMENTE: Queue
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  /** Adresa PUBLICA a Bibliei — numai pentru legatura pe care o apasa omul. */
  URL_BIBLIA: string
  /** Data publicarii, pentru subsol — binding-ul `version_metadata`. */
  VERSIUNE?: { timestamp?: string }
  /** Secretul dintre workerii nostri; fara el `/_actiuni` nu exista. */
  SECRET_INTERN?: string
}

const SERVICIU = 'app-calendar'
/**
 * Abonarea la calendar e o audienta a serviciului de comunicare; aplicatia nu tine adrese.
 * ⚠️ Numele ei nu se mai scrie aici: sta in registrul `ABONAMENTE` din `@xc/abonare`, laolalta cu
 * al celorlalte aplicatii care au ce trimite.
 */
const ABONAMENT = abonamentul('calendar')

async function comunicare<T = unknown>(env: Env, cale: string, corp: unknown): Promise<T | null> {
  try {
    const r = await env.COMUNICARE.fetch(`https://comunicare.intern${cale}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corp) })
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}

// `eAbonat` (intrebarea „e omul pe lista?", pusa la fiecare pagina ca sa se stie daca butonul scrie
// „Abonare" sau „Dezabonare") a iesit odata cu formularul din antet: fereastra de abonare adusa de la
// Program nu cunoaste starea, deci intrebarea ar fi fost o cerere la comunicare pe fiecare pagina,
// degeaba (12.09.2026). Audienta si rutele de mai jos au ramas intregi — se readuce cand fereastra
// se leaga de ele.
const CACHE_PAGINI = 'public, max-age=300'
const CACHE_API = 'public, max-age=600'

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

/** O zi completa: randul (preluat sau calculat), desfacerea si forma de contract. */
async function ziuaCompleta(env: Env, data: string, ani: number[], versiune: string) {
  const r = await randulOriCalculat(env.DB, data, ani)
  if (!r) return null
  return { r, d: desfaRandul(r), zi: ziLiturgica(r, versiune) }
}

async function textele(env: Env, r: RandZi, zi: ZiLiturgica, d: ReturnType<typeof desfaRandul>): Promise<TexteZilei> {
  const [sinaxar, apostol, evanghelie, voscreasna, ...inPlus] = await Promise.all([
    r.calculat ? Promise.resolve(null) : textulZilei(env.DB, r.data),
    zi.pericope.apostol ? textulPericopei(env.BIBLIA, env.URL_BIBLIA, zi.pericope.apostol) : Promise.resolve(null),
    zi.pericope.evanghelie ? textulPericopei(env.BIBLIA, env.URL_BIBLIA, zi.pericope.evanghelie) : Promise.resolve(null),
    zi.evanghelia_invierii && VOSCRESNE[zi.evanghelia_invierii]
      ? textulPericopei(env.BIBLIA, env.URL_BIBLIA, VOSCRESNE[zi.evanghelia_invierii]!).then((t) => ({ nr: zi.evanghelia_invierii!, text: t }))
      : Promise.resolve(null),
    // citirile in plus din titlu (ale ierarhului, ale sfantului), dupa cele doua de rand
    ...d.citiri
      .filter((c) => !/^(Ap\.|Ev\.|Apostolul|Evanghelia)/.test(c))
      .map((c) => canonizeazaReferinta(c))
      .filter((c) => c && c !== zi.pericope.apostol && c !== zi.pericope.evanghelie)
      .slice(0, 4)
      .map((c) => textulPericopei(env.BIBLIA, env.URL_BIBLIA, c)),
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

/** Lista de verbe a calendarului, publicata la `/_actiuni` (vezi `actiuni.ts`). */
const MODUL = modulActiuni<Env>({ aplicatie: 'calendar', versiune: pkg.version, actiuni: ACTIUNI })

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
    // Actiunile interne: doar prin Service Binding, cu secretul platformei (404 altfel).
    const raspunsActiuni = await MODUL.ruteaza(req, env, ctxExec, cale)
    if (raspunsActiuni) return raspunsActiuni

    if (eAdresaDeMasina(cale)) {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, HEAD, OPTIONS', 'access-control-allow-headers': 'if-none-match, content-type' } })
      if (req.method !== 'GET' && req.method !== 'HEAD') return eroareApi(405, 'metoda_nepermisa', 'Sub /v1 merg doar GET, HEAD și OPTIONS.')
      try {
        return await api(req, env, ctxExec, prefix, cale, url, azi)
      } catch (e) {
        log.error('eroare api', { eroare: e instanceof Error ? e.message : String(e) })
        return eroareApi(500, 'eroare_interna', 'A apărut o eroare neașteptată.')
      }
    }

    // ------------------------------------------------------------------ oameni
    if (req.method === 'POST') {
      const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA], cfg.MEDIU === 'dev')
      if (problema) {
        const ctxMinim: Ctx = { prefix, nav, utilizator: null, eAdmin: false, versiune: pkg.version, modificata: dataVersiunii(env.VERSIUNE), anCurent: Number(azi.slice(0, 4)) }
        return html(paginaMesaj(ctxMinim, 'Verificare de securitate', problema), 403)
      }
    }
    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const principal = principalDin(sesiune)
    /*
     * ⚠️ Adminul CALENDARULUI vine din cheia aplicatiei (`calendar.manage`), nu din rolul global
     * (18.09.2026): asa poate fi cineva administrator numai aici. De el atarna mai departe si filtrul
     * evlaviei (`poateFiltra`) — se schimba doar de unde se afla raspunsul, nu regula. Rolul global
     * rămâne numai pentru randul „Administrare" din meniul contului.
     */
    const eAdminCalendar = await eAdminulAplicatiei(env.AUTORIZARE, cid, principal, 'calendar')
    const ctx: Ctx = {
      prefix,
      nav,
      utilizator: sesiune.user?.displayName ?? sesiune.user?.email ?? null,
      // adresa contului, pentru fereastra de abonare: acolo se scrie in camp si se incuie, fiindca
      // abonarea platformei sta pe adresa contului, nu pe una scrisa de mana
      emailulContului: sesiune.user?.email ?? null,
      eAdmin: eAdminCalendar,
      eAdminPlatforma: sesiune.roles.some((r) => r.role === 'admin' || r.role === 'super-admin'),
      versiune: pkg.version,
      modificata: dataVersiunii(env.VERSIUNE),
      anCurent: Number(azi.slice(0, 4)),
      veziCa: sesiune.veziCa,
      poateVedeaCa: sesiune.poateVedeaCa,
      spre: adresaPaginii(cfg, url),
    }
    const authz = new ClientAutorizare(env.AUTORIZARE, cid)

    try {
      const ani = await aniPreluati(env.DB)
      const { versiune } = await versiuneaCalendarului(env.DB)
      const aniCalculati = ani.length ? [Math.max(...ani) + 1, Math.max(...ani) + 2] : []
      const aniDisponibili = [...ani, ...aniCalculati]
      // Sub masca „vezi ca" pagina e personala chiar cand n-are niciun nume pe ea (masca
      // „neautentificat"): cu `public, max-age=300` browserul o servea din propriul cache si dupa
      // ce masca fusese scoasa, deci butonul benzii de jos parea ca nu face nimic (user, 11.09.2026).
      const cachePagina = { 'cache-control': ctx.utilizator || ctx.veziCa ? 'private, no-store' : CACHE_PAGINI }

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
        // filtrul crucii, pus din bara de sus (user, 12.09.2026): lucreaza peste luna asta. Un fel
        // nerecunoscut se face ca si cum n-ar fi — lista intreaga, fara eroare.
        const cerut = url.searchParams.get('filtru') ?? url.searchParams.get('cruce')
        const felCerut = cerut === 'rosie' || cerut === 'neagra' || cerut === 'evlavie' ? (cerut as FelFiltru) : undefined
        // ⚠️ Filtrul atarna de rol (user, 13.09.2026): fara dreptul lui, adresa scrisa de mana ori
        // ramasa in semne de carte se poarta ca si cum filtrul n-ar fi — luna intreaga, fara eroare,
        // fiindca CITITUL ramane la liber. Altfel poarta ar fi doar de fatada: butonul palit in bara,
        // dar lista filtrata la un `?filtru=` scris de mana.
        const cruce = felCerut && poateFiltra(ctx, felCerut) ? felCerut : undefined
        // ⚠️ „Intrarea in aplicatie" = adresa fara luna. Numai atunci pagina se deruleaza singura la
        // ziua de azi (user, 15.09.2026); pe `/2026-10` omul a ales el luna, deci nu se sare nicaieri.
        const laAzi = cale === '/' && !cruce
        return html(paginaLuna({ ctx, an, luna, randuri: lista, calculat, azi, ...(cruce ? { cruce } : {}), mesajAbonare, laAzi }), 200, cachePagina)
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
        return html(
          paginaZi({ ctx, ...z, texte: t, ...(parte ? { parte } : {}), ieri: adaugaZile(data, -1), maine: adaugaZile(data, 1), azi }),
          200,
          cachePagina,
        )
      }

      // FILTRUL CRUCII PESTE ANUL INTREG — starea „toate lunile" (user, 12.09.2026, 11:13)
      const mSarb = /^\/sarbatori\/(?:cruce-(rosie|neagra)|(evlavie))(?:\/(\d{4})(?:-(\d{2}))?)?$/.exec(cale)
      if (mSarb && req.method === 'GET') {
        const fel = (mSarb[1] ?? mSarb[2]) as FelFiltru
        const an = mSarb[3] ? Number(mSarb[3]) : ctx.anCurent
        // ⚠️ Adresa cu luna in ea a fost inlocuita de filtrul pe pagina lunii; o trimitem acolo, ca
        // legaturile vechi si cele scrise de om sa nu cada. (Si cine n-are dreptul filtrului trece
        // pe aici: ruta lunii ii lasa luna si scapa de filtru, deci ajunge unde trebuie.)
        if (mSarb[4]) return redirect(`${prefix}/${an}-${mSarb[4]}?filtru=${fel}`)
        // ⚠️ Aceeasi poarta ca pe luna (user, 13.09.2026): pagina asta nu e altceva decat starea
        // „toate lunile" a filtrului, deci fara dreptul lui n-are ce arata. Nu dam eroare — omul e
        // trimis la anul nefiltrat, care ramane deschis oricui.
        if (!poateFiltra(ctx, fel)) return redirect(`${prefix}/${an}`)
        let randuri: RandZi[]
        let calculat = false
        if (ani.includes(an)) randuri = await randurileAnului(env.DB, an)
        else if (sePoateCalcula(an, ani)) {
          randuri = await zileleAnuluiCalculat(env.DB, an)
          calculat = true
        } else return html(paginaMesaj(ctx, `${an} nu e preluat`, ani.length ? `Anii preluați până acum: ${ani.join(', ')}.` : 'Încă nu s-a preluat niciun an.'), 404)
        // ⚠️ ACELASI filtru ca pe luna (`trecePrinFiltru`), nu interogarea veche `zileleCuCruce`:
        // altfel duminicile ar intra in lista pe o luna si ar lipsi pe „toate lunile", iar filtrul
        // ar insemna doua lucruri deosebite dupa cat de larg te uiti.
        // ⚠️ ziua liturgica se face pentru TOT anul, fiindca filtrul intreaba de sfintii ei, nu doar
        // de crucea randului; abia apoi se aleg zilele care raman
        const lista = randuri
          .map((r) => ({ r, d: desfaRandul(r), zi: ziLiturgica(r, versiune) }))
          .filter(({ r, zi }) => trecePrinFiltru(r, zi, fel))
        return html(paginaSarbatori({ ctx, fel, an, randuri: lista, calculat, azi }), 200, cachePagina)
      }

      /*
       * CĂUTAREA — ce iese din lupa pastilei (user, 15.09.2026). Adresa e a ei, cu întrebarea în ea,
       * deci rezultatul se poate da mai departe și se poate pune la semne de carte.
       *
       * ⚠️ Se caută în ANUL cerut, iar anul se coboară la unul PRELUAT: pe un an calculat (2027, 2028)
       * `cauta` ar cotrobăi în tabelul `zile`, unde acel an nu s-a scris niciodată, și ar întoarce
       * tăcut o listă goală — omul ar crede că sfântul nu e în calendar, nu că anul nu e încă adus.
       *
       * ⚠️ Cititul e la liber (regula userului), deci pagina asta n-are poartă: căutarea nu e un
       * filtru, e tot lista calendarului, ajunsă la ea printr-un nume.
       */
      if (cale === '/cauta' && req.method === 'GET') {
        const q = (url.searchParams.get('q') ?? '').trim()
        const cerut = url.searchParams.get('an')
        const anCerut = cerut && /^\d{4}$/.test(cerut) ? Number(cerut) : undefined
        const anBun = (a: number | undefined) => (a !== undefined && ani.includes(a) ? a : undefined)
        const an = anBun(anCerut) ?? anBun(ctx.anCurent) ?? (ani.length ? Math.max(...ani) : ctx.anCurent)
        if (!ani.length) return html(paginaMesaj(ctx, 'Nu e ce căuta', 'Încă nu s-a preluat niciun an.'), 404)
        // ⚠️ Pragul de trei litere e al cautarii intregi (e si la `/v1/cauta`): sub el, orice intrebare
        // ar intoarce jumatate de an. Aici nu e eroare, e o pagina cu campul deschis si cu vestea sub el.
        const preScurt = q.length < 3
        const randuri = preScurt ? [] : await cauta(env.DB, q, an)
        const lista = randuri.map((r) => ({ r, d: desfaRandul(r), zi: ziLiturgica(r, versiune) }))
        return html(paginaCautare({ ctx, q, an, randuri: lista, azi, preScurt }), 200, cachePagina)
      }

      /*
       * ABONAREA — drumul intreg sta in `@xc/abonare`, acelasi pentru toata platforma (user,
       * 15.09.2026: „nu ar trebui să copiez logica în mai multe locuri"). Calendarul da doar ce e
       * al lui: randul din registru (adica audienta), carcasa in care se scriu paginile si jurnalul.
       *
       * ⚠️ Se cheama INAINTEA rutelor calendarului, dar DUPA sesiune: pasul „sunt deja intrat" se
       * hotaraste din `principal`. Intoarce `null` cand adresa nu e a abonarii.
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

      /*
       * SETARILE — tot un singur loc, `@xc/setari` (user, 15.09.2026). Calendarul da codul, numele
       * si carcasa; treptele (abonarea mea · abonatii · jurnalul) le hotaraste pachetul, din chei.
       */
      const raspunsSetari = await ruteazaSetari(req, cale, env, {
        cod: 'calendar',
        nume: 'Calendar',
        prefix,
        cfg,
        cid,
        principal,
        veziCa: ctx.veziCa,
        urlCont: nav.cont,
        urlTermeni: `${nav.home || ''}/termeni`,
        carcasa: (p) => paginaCarcasa(ctx, p),
      })
      if (raspunsSetari) return raspunsSetari

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
          comunicare<{ membri: Array<{ user_id: string; adresa: string; created_at: string }> }>(env, '/audiente/membri', { audienceId: ABONAMENT.audienta }),
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

async function api(req: Request, env: Env, ctxExec: ExecutionContext, prefix: string, cale: string, url: URL, azi: string): Promise<Response> {
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
        { adresa: '/v1/pericopa?ref= · ?voscreasna=', ce_da: 'textul unei pericope, adus de la Biblia' },
        { adresa: '/v1/sursa/zi/<data> · /v1/sursa/an/<an>', ce_da: 'rândul brut al Patriarhiei, netradus' },
        { adresa: '/v1/atelier/pascalia?an=', ce_da: 'Pascalia față în față cu calendarul oficial' },
      ],
    }, cache)
  }

  /**
   * Textul unei pericope, oricare ar fi ea. Calendarul e singurul care vorbeste cu Biblia, deci
   * si cine are referinta lui (tipicul are Evanghelia Utreniei din randuiala ROEA) o cere tot
   * de aici — altfel legatura cu Biblia s-ar face din doua locuri.
   * `?voscreasna=<1..11>` in loc de `?ref=`: lista celor 11 Evanghelii ale Invierii sta aici,
   * nu se copiaza in aplicatii.
   */
  if (cale === '/v1/pericopa') {
    const nrVoscr = Number(url.searchParams.get('voscreasna') ?? '')
    const refCerut = url.searchParams.get('ref')?.trim() ?? ''
    const ref = nrVoscr >= 1 && nrVoscr <= 11 ? VOSCRESNE[nrVoscr]! : refCerut
    if (!ref) return eroareApi(400, 'referinta_lipsa', 'Cere ?ref=<referință> sau ?voscreasna=<1..11>.')
    if (ref.length > 120) return eroareApi(400, 'referinta_invalida', 'Referința e prea lungă.')
    const text = await textulPericopei(env.BIBLIA, env.URL_BIBLIA, ref)
    return jsonCuEtag(req, { referinta: text.referinta, voscreasna: nrVoscr >= 1 && nrVoscr <= 11 ? nrVoscr : null, bucati: text.bucati, sursa: `Biblia — ${(env.URL_BIBLIA || '/biblia').replace(/^https:\/\//, '')}` }, cache)
  }

  const mZi = /^\/v1\/zi\/([^/]+)$/.exec(cale)
  if (mZi) {
    const data = dataCeruta(mZi[1]!, azi)
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

  /*
   * POZA SAPTAMANII (PNG): antetul cu intervalul si cele sapte zile, ca in lista lunii. Fara data =
   * saptamana de azi. In V1 pozele se faceau dinainte, cu un script, pentru tot anul, si stateau in
   * R2; aici se fac la cerere, prin Browser Rendering, si raman in cache-ul de muchie — deci se refac
   * singure cand calendarul se corecteaza, si nu mai e nimic de intretinut la preluarea unui an nou.
   */
  const mPoza = /^\/v1\/poza\/saptamana(?:\/([^/]+))?$/.exec(cale)
  if (mPoza) {
    const cerut = mPoza[1] ? dataCeruta(mPoza[1], azi) : azi
    if (!cerut) return eroareApi(400, 'data_invalida', 'Data se scrie AAAA-LL-ZZ (sau azi / maine).')
    const luni = luneaSaptamanii(cerut)
    const duminica = adaugaZile(luni, 6)
    const preluate = await randuriInterval(env.DB, luni, duminica)
    const zile = new Map(preluate.map((r) => [r.data, r]))
    for (const an of aniCalculati) {
      if (`${an}-12-31` < luni || `${an}-01-01` > duminica) continue
      for (const r of await zileleAnuluiCalculat(env.DB, an)) if (r.data >= luni && r.data <= duminica) zile.set(r.data, r)
    }
    const lista = [...zile.values()].sort((a, b) => (a.data < b.data ? -1 : 1)).map((r) => ({ r, d: desfaRandul(r), zi: ziLiturgica(r, versiune) }))
    if (!lista.length) {
      return eroareApi(404, 'saptamana_neacoperita', 'Săptămâna nu e în calendarul preluat.', { de_la: luni, pana_la: duminica, ani_preluati: ani, ani_calculati: aniCalculati })
    }
    const ctxPoza: Ctx = {
      prefix,
      nav: navigatieDin(citesteConfig(env)),
      utilizator: null,
      eAdmin: false,
      versiune: pkg.version,
      modificata: dataVersiunii(env.VERSIUNE),
      anCurent: Number(azi.slice(0, 4)),
    }
    const pagina = pozaSaptamaniiHtml({ ctx: ctxPoza, eticheta: intervalLizibil(luni, duminica), randuri: lista, azi })
    return hartieDinCache(req, ctxExec, pagina, 'png', `calendar-${luni}`, () => pngDin(env.BROWSER, pagina, 450))
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
