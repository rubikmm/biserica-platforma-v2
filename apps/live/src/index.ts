/**
 * LIVE — transmisiunea în direct a slujbelor, pe platforma V2.
 *
 * Una din cele două aplicații în care s-a împărțit `transmisiuni` din V1 (cerere a utilizatorului,
 * 14.09.2026). Cealaltă e `radio`. Împărțeala nu e doar de subdomenii: aici stă **CREIERUL** —
 * starea emisiei, aparatul din biserică și semnalizarea WebRTC; dincolo stau muzica și ceasul ei.
 *
 * Rute:
 *   /health                      starea aplicației
 *   /                            PUBLIC: ce se transmite acum + playerul
 *   /admin                       NU e panou aici: trimite la panoul de la `radio` (unul singur)
 *   /api/…                       ce cere playerul din pagină (stare, semnalizare, bătăi, jurnal)
 *   /v1/stare                    PUBLIC, JSON: ce transmite parohia acum (contractul platformei)
 *   /v1/radio/biblioteca         PUBLIC, JSON: indicele muzicii, pe adresa veche a aparatului
 *   /intern/aparat/…             aparatul din biserică, cu `APARAT_SECRET`
 *   /intern/live|mic/whip        emițătorul WHIP al aparatului, cu `WHIP_SECRET`
 *   /_intern/…                   numai pentru workerul radioului (Service Binding)
 *
 * ⚠️ Trei lucruri care se încalcă ușor:
 *
 *  1. **Sunetul nu trece pe aici.** Workerul face doar semnalizarea; directul merge aparat → SFU →
 *     ascultător. Dacă cineva „optimizează" trecând sunetul prin worker, plătim fiecare ascultător.
 *  2. **Starea are un singur proprietar — aplicația asta.** `radio` nu pornește și nu oprește
 *     directul singur: îi cere de aici. Dacă se inversează sensul, se aud amândouă deodată.
 *  3. **`/_intern` NU se servește de pe internet**: fără antetul `x-xc-intern` răspunde 404 (nu
 *     403 — o adresă internă n-are de ce să-și recunoască existența), ca `/_actiuni` din chat.
 */
import { asiguraCsrf, principalDin, sesiuneCurenta, verificaCsrf } from '@xc/auth'
import { ClientAutorizare } from '@xc/authorization'
import { corpPlayer, jsPlayer } from '@xc/comanda'
import { adresaPaginii, citesteConfig, navigatieDin, prefixSiCale } from '@xc/config'
import { CererePanou, SCOPE_GLOBAL, SESIUNE_ANONIMA, type Telemetrie } from '@xc/contracts'
import { Logger, correlationId } from '@xc/observability'
import { dataVersiunii, html, json } from '@xc/ui'
import pkg from '../package.json' with { type: 'json' }
import { type EnvAparat, aparatul } from './aparat.js'
import { type EnvAscultatori, bataiePagina } from './ascultatori.js'
import { DIRECT, type EnvDirect, MIC, ascultaIntra, ascultaRaspuns, sidDin, stareCanal, whipIese, whipIntra } from './direct.js'
import { corpMic, jsMic } from './mic.js'
import { type Ctx, pagina, paginaMesaj, spreCont } from './pagina.js'
import { ruteazaSetari } from '@xc/setari'
import type { EnvProgram } from './program.js'
import { type EnvRadioDeparte, indiceRadio } from './radio-departe.js'
import { type EnvCreier, executaComanda, preiaDecizia, stareEmisie, starePanou } from './stare.js'

export { Direct } from './direct.js'
export { Aparat } from './aparat.js'
export { Ascultatori } from './ascultatori.js'

export interface Env extends EnvDirect, EnvAparat, EnvAscultatori, EnvRadioDeparte, EnvProgram {
  IDENTITATE: Fetcher
  AUTORIZARE: Fetcher
  /** Venite pe 15.09.2026, odata cu pagina de Setari: abonarile si jurnalul. */
  COMUNICARE: Fetcher
  AUDIT: Fetcher
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  URL_RADIO?: string
  VERSIUNE?: { timestamp?: string }
}

const SERVICIU = 'app-live'
const FARA_STOC = { 'cache-control': 'private, no-store' }
const JSON_VIU = { 'cache-control': 'no-store' }

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: SERVICIU, correlationId: cid })
    const url = new URL(req.url)
    const nav = navigatieDin(cfg)
    const { prefix, cale } = prefixSiCale(url, env.MEDIU === 'dev' ? '/live' : '')

    try {
      if (cale === '/health') {
        return json({ ok: true, app: 'live', versiune: pkg.version, ora: new Date().toISOString() })
      }

      // ---------------------------------------------------- mașinile (fără cont de om)
      if (cale.startsWith('/intern/')) return masini(req, url, cale, env)
      if (cale.startsWith('/_intern/')) {
        // O adresă internă nu-și recunoaște existența de pe internet.
        if (req.headers.get('x-xc-intern') !== '1') return new Response('nu exista', { status: 404 })
        return intern(req, cale, env)
      }

      // ---------------------------------------------------- contractul public
      if (cale === '/v1/stare' && req.method === 'GET') {
        return Response.json(await stareEmisie(env), { headers: JSON_VIU })
      }
      /*
       * ⚠️ Indicele bibliotecii pe adresa VECHE, a aparatului. Muzica s-a mutat pe `radio`
       * (`/v1/biblioteca`), dar daemonul din biserică cere indicele de la Worker, de pe
       * `/v1/radio/biblioteca` (`aparat/worker.py: ia_indice`) — și în el stau duratele exacte cu
       * care își ține ceasul radioului în boxe. Fără adresa asta, aparatul rămâne pe indicele din
       * cache și scrie „nu pot lua indicele de la Worker" la fiecare rundă.
       *
       * Aici se ține promisiunea din NOTES: **aparatul are de schimbat NUMAI adresa**, nimic din
       * codul lui. Indicele vine prin binding-ul RADIO, nu prin internet.
       */
      if (cale === '/v1/radio/biblioteca' && req.method === 'GET') {
        return Response.json(await indiceRadio(env), { headers: JSON_VIU })
      }

      // ---------------------------------------------------- ce cere playerul din pagină
      if (cale.startsWith('/api/')) return api(req, url, cale, prefix, env, cfg.ORIGINE_PUBLICA)

      // ---------------------------------------------------- cine e
      const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
      const principal = principalDin(sesiune)
      const authz = new ClientAutorizare(env.AUTORIZARE, cid)
      // Dreptul îl hotărăște autorizarea, și îl hotărăște SUB MASCĂ dacă omul poartă una.
      const eAdmin = principal ? (await authz.can(principal, 'broadcast.manage', SCOPE_GLOBAL)).allowed : false
      /*
       * „Super-admin" pentru panou (butonul OPRIT și legăturile ascunse) se citește tot de la
       * autorizare, nu din `sesiune.roles`: `roles.manage` vine NUMAI cu rolul de super-admin, iar
       * întrebarea trece prin mască — deci un super-admin care se uită „ca administrator" pierde
       * butonul, cum se cuvine. Citit din roluri, masca n-ar fi coborât nimic.
       */
      const eSuperAdmin = principal ? (await authz.can(principal, 'roles.manage', SCOPE_GLOBAL)).allowed : false

      const csrf = asiguraCsrf(req, cfg.DOMENIU_COOKIE)
      const antete = csrf.setCookie ? { ...FARA_STOC, 'set-cookie': csrf.setCookie } : FARA_STOC

      const ctx: Ctx = {
        prefix,
        nav,
        utilizator: sesiune.user?.displayName ?? sesiune.user?.email ?? null,
        userId: sesiune.user?.id ?? null,
        eAdmin,
        eSuperAdmin,
        // Panoul emisiei e unul singur, și stă pe `radio` — acolo duce „Administrare" din meniu.
        urlPanou: `${env.URL_RADIO || nav.radio}/admin`,
        modificata: dataVersiunii(env.VERSIUNE),
        veziCa: sesiune.veziCa,
        poateVedeaCa: sesiune.poateVedeaCa,
        spre: adresaPaginii(cfg, url),
      }

      /*
       * ---------------------------------------------------- panoul NU e aici
       *
       * ⚠️ **Administrarea emisiei nu se dublează** (user, 14.09.2026: „live…/admin — trebuia să
       * fie doar radio… sub nicio formă să nu fie dublată administrarea"). Panoul e UNUL singur și
       * stă la `radio`; două panouri care scriu aceeași stare înseamnă două adevăruri despre
       * același buton LIVE și, mai devreme sau mai târziu, două comenzi care se bat. Aici a rămas
       * doar drumul într-acolo, ca legăturile vechi și obiceiul degetelor să nu cadă în gol.
       *
       * Comenzile trec tot prin aplicația asta — ea ține starea — dar pe `/_intern`, cerute de
       * workerul radioului prin Service Binding, nu dintr-un browser. Ușa de pe internet
       * (`/admin/stare`, `/admin/comanda`) s-a închis: nu mai are cine s-o deschidă.
       *
       * Nu pune panoul înapoi aici. Dacă `radio` e jos, panoul e jos — asta e alegerea făcută.
       */
      if (cale === '/admin' || cale.startsWith('/admin/')) {
        const panou = new URL(ctx.urlPanou, url).toString()
        if (cale === '/admin' || cale === '/admin/') return Response.redirect(panou, 303)
        return json({ motiv: 'panoul emisiei stă la radio', panou }, 404)
      }

      /*
       * SETARILE — un singur loc, `@xc/setari` (user, 15.09.2026). ⚠️ Ele NU pleaca la `radio`, ca
       * panoul de mai sus: nu sunt o administrare, ci pagina omului din aplicatia asta, deci
       * dublarea de care se ferea regula de mai sus nu-l priveste.
       */
      if (cale === '/setari' || cale.startsWith('/setari/')) {
        if (req.method === 'POST') {
          const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA], cfg.MEDIU === 'dev')
          if (problema) return html(paginaMesaj(ctx, 'Verificare de securitate', problema), 403, FARA_STOC)
        }
        const raspunsSetari = await ruteazaSetari(req, cale, env, {
          cod: 'live',
          nume: 'Transmisiunea',
          prefix,
          cfg,
          cid,
          principal,
          urlCont: nav.cont,
          urlTermeni: `${nav.home || ''}/termeni`,
          carcasa: (p) => pagina(ctx, { titluPagina: p.titluPagina, corp: p.corp, ...(p.scripturi ? { scripturi: p.scripturi } : {}) }),
        })
        if (raspunsSetari) return raspunsSetari
      }

      /*
       * ---------------------------------------------------- microfonul bisericii
       *
       * ⚠️ Poarta e SUPER-ADMINISTRATOR, nu administrator — vezi pricina în `mic.ts`: aici se aude
       * biserica și când publicul ascultă radio. Adresele de semnalizare sunt ale aplicației
       * astea, deci pagina le cheamă direct; `/_intern/mic/…` nu mai are cine să le ceară.
       */
      if (cale === '/mic' || cale.startsWith('/mic/')) {
        if (!eSuperAdmin) {
          if (!ctx.userId && !ctx.veziCa) return Response.redirect(spreCont(ctx, cfg.ORIGINE_PUBLICA, cale), 303)
          const mesaj = 'Microfonul bisericii se aude doar cu rol de super-administrator.'
          if (cale !== '/mic') return json({ motiv: mesaj }, 403)
          return html(paginaMesaj(ctx, 'Fără acces', mesaj), 403, antete)
        }
        if (cale === '/mic') {
          return html(pagina(ctx, { titluPagina: 'Microfonul', corp: corpMic(), scripturi: jsMic(prefix) }), 200, antete)
        }
        if (cale === '/mic/stare' && req.method === 'GET') {
          return Response.json(await stareCanal(env, MIC), { headers: JSON_VIU })
        }
        if (cale === '/mic/asculta' && req.method === 'POST') return ascultaIntra(env, MIC)
        const sidMic = sidDin(cale, '/mic/asculta/')
        if (sidMic && req.method === 'PUT') return ascultaRaspuns(req, sidMic, env)
        return json({ motiv: 'adresa nu există la microfon' }, 404)
      }

      // ---------------------------------------------------- publicul
      if (cale === '/' || cale === '') {
        return html(paginaPublica(ctx), 200, { 'cache-control': 'no-store' })
      }

      return html(paginaMesaj(ctx, 'Pagina nu există', 'Adresa aceasta nu duce nicăieri la transmisiune.'), 404, antete)
    } catch (e) {
      log.error('eroare pagina', { eroare: e instanceof Error ? e.message : String(e) })
      return new Response('A apărut o eroare. Încearcă din nou peste puțin.', { status: 500 })
    }
  },
} satisfies ExportedHandler<Env>

/**
 * Pagina PUBLICĂ: ce se transmite acum, cu playerul sub ea. Fără cifre tehnice — utilizatorul a
 * cerut-o anume simplă (alea sunt în panou).
 *
 * ⚠️ **Cu Cont în antet** (user, 14.09.2026: „trebuia să fie Cont pe ambele"). În V1 pagina de
 * ascultare era singura fără cont — „un player simplu, nu e nevoie de login". Regula aia a căzut:
 * ascultatul rămâne la liber, dar antetul arată la fel ca peste tot. Nu o scoate înapoi.
 */
function paginaPublica(ctx: Ctx): string {
  return pagina(ctx, {
    titluPagina: 'Ascultă',
    corp: `<div class="live">${corpPlayer({ doarDirect: true })}</div>`,
    scripturi: jsPlayer(ctx.prefix, { doarDirect: true }),
  })
}

// --- ce cere playerul din pagină ------------------------------------------------

async function api(
  req: Request,
  url: URL,
  cale: string,
  prefix: string,
  env: Env,
  origine: string,
): Promise<Response> {
  if (cale === '/api/stare' && req.method === 'GET') {
    return Response.json(await stareEmisie(env), { headers: JSON_VIU })
  }
  if (cale === '/api/asculta' && req.method === 'POST') return ascultaIntra(env, DIRECT)
  const sid = sidDin(cale, '/api/asculta/')
  if (sid && req.method === 'PUT') return ascultaRaspuns(req, sid, env)
  if (cale === '/api/ascult' && req.method === 'POST') return bataiePagina(req, env)
  if (cale === '/api/jurnal' && req.method === 'POST') {
    // Erorile paginii ajung în jurnalul workerului, ca să vedem ce se întâmplă pe telefonul
    // omului fără să-l avem în mână. Nu se păstrează nimic.
    const text = (await req.text().catch(() => '')).slice(0, 2000)
    console.log('[pagina]', req.headers.get('cf-connecting-ip') ?? '?', text)
    return new Response(null, { status: 204 })
  }
  /*
   * Fișierul de muzică stă în depozitul radioului. Îl trimitem acolo cu un redirect, nu îl curgem
   * prin workerul ăsta: sunetul n-are de ce să treacă de două ori printr-un worker, iar ieșirea
   * din depozit e oricum gratuită. Elementul `<audio>` urmează redirectul singur.
   */
  if (cale === '/api/fisier' && (req.method === 'GET' || req.method === 'HEAD')) {
    const c = url.searchParams.get('cale')
    if (!c) return new Response('lipsește calea', { status: 400 })
    const radio = env.URL_RADIO
    if (!radio) return new Response('radioul nu e configurat', { status: 503 })
    return Response.redirect(`${radio}/api/fisier?cale=${encodeURIComponent(c)}`, 302)
  }
  void prefix
  void origine
  return new Response('nu exista', { status: 404 })
}

// --- mașinile: aparatul din biserică și emițătorul lui ---------------------------

async function masini(req: Request, url: URL, cale: string, env: Env): Promise<Response> {
  // Emițătorul WHIP, pe cele două canale (directul și microfonul).
  for (const [pre, canal] of [
    ['/intern/live/whip', DIRECT],
    ['/intern/mic/whip', MIC],
  ] as const) {
    if (cale === pre && req.method === 'POST') return whipIntra(req, env, canal, pre)
    if (cale === pre && req.method === 'OPTIONS') return new Response(null, { status: 204 })
    const s = sidDin(cale, `${pre}/`)
    if (s && req.method === 'DELETE') return whipIese(s, env, canal)
    if (s && req.method === 'PATCH') return new Response('fara trickle ICE', { status: 405 })
  }

  if (!cale.startsWith('/intern/aparat/')) return new Response('nu exista', { status: 404 })
  if (!env.APARAT_SECRET) return new Response('APARAT_SECRET lipseste', { status: 503 })
  if (req.headers.get('authorization') !== `Bearer ${env.APARAT_SECRET}`) {
    return new Response('neautorizat', { status: 401 })
  }
  const a = aparatul(env)

  if (cale === '/intern/aparat/comanda' && req.method === 'GET') {
    const versiune = Number(url.searchParams.get('versiune') ?? '-1')
    const asteapta = Number(url.searchParams.get('asteapta') ?? '0')
    return json(
      await a.asteaptaComanda(Number.isFinite(versiune) ? versiune : -1, Number.isFinite(asteapta) ? asteapta : 0),
      200,
      JSON_VIU,
    )
  }
  if (cale === '/intern/aparat/stare' && req.method === 'POST') {
    const t = (await req.json().catch(() => null)) as Telemetrie | null
    if (!t || typeof t.stare !== 'string') return json({ motiv: 'astept telemetrie' }, 400)
    await a.puneStare(t)
    await preiaDecizia(env, t)
    return json({ ok: true, comanda_versiune: (await a.comanda()).versiune }, 200, JSON_VIU)
  }
  /*
   * Inventarul bibliotecii, trimis de aparat. În V1 aparatul era sursa listei; de la mutarea
   * muzicii în depozit, indicele e al radioului, iar aparatul doar raportează ce are pe disc.
   * Primim și răspundem „am înțeles", ca să nu-l punem să reîncerce la nesfârșit — dar nu scriem
   * indicele din el: adevărul e în depozit.
   */
  if (cale === '/intern/aparat/continut' && req.method === 'POST') {
    const i = (await req.json().catch(() => null)) as { fisiere?: unknown[] } | null
    return json({ ok: true, fisiere: Array.isArray(i?.fisiere) ? i.fisiere.length : 0 }, 200, JSON_VIU)
  }
  return new Response('nu exista', { status: 404 })
}

// --- ce cere workerul radioului (Service Binding) --------------------------------

async function intern(req: Request, cale: string, env: Env): Promise<Response> {
  if (cale === '/_intern/emisie') return Response.json(await stareEmisie(env), { headers: JSON_VIU })

  if (cale === '/_intern/stare-panou' && req.method === 'POST') {
    const c = (await req.json().catch(() => null)) as { potComanda?: boolean; eSuperAdmin?: boolean } | null
    return Response.json(await starePanou(env, !!c?.potComanda, !!c?.eSuperAdmin), { headers: JSON_VIU })
  }

  if (cale === '/_intern/comanda' && req.method === 'POST') {
    /*
     * Dreptul a fost verificat deja de radio, la el acasă, cu aceeași cheie (`broadcast.manage`) și
     * aceeași autorizare centrală. Aici nu mai avem cookie-ul omului — avem doar numele lui, pentru
     * jurnal. Adresa asta nu e ajuns de pe internet (vezi paza de mai sus).
     */
    const c = (await req.json().catch(() => null)) as
      | { actiune?: unknown; director?: string; fisier?: string; cine?: string | null; eSuperAdmin?: boolean }
      | null
    const cerere = CererePanou.safeParse(c)
    if (!cerere.success) return json({ motiv: 'astept {actiune}' }, 400)
    const r = await executaComanda(env, cerere.data, c?.cine ?? null, !!c?.eSuperAdmin)
    return json(r.ok ? { ok: true, selectie: r.selectie, comanda: r.comanda } : { motiv: r.motiv }, r.status)
  }

  // Semnalizarea, pentru paginile servite de radio (playerul lui și pagina microfonului).
  if (cale === '/_intern/asculta' && req.method === 'POST') return ascultaIntra(env, DIRECT)
  const sid = sidDin(cale, '/_intern/asculta/')
  if (sid && req.method === 'PUT') return ascultaRaspuns(req, sid, env)
  if (cale === '/_intern/ascult' && req.method === 'POST') return bataiePagina(req, env)

  /*
   * ⚠️ `/_intern/mic/…` a IEȘIT (15.09.2026): pagina microfonului s-a mutat aici, pe `/mic`, deci
   * nu mai are cine să ceară semnalizarea prin Service Binding. Dacă apare vreodată nevoia inversă,
   * se pune la loc — dar până atunci ar fi o ușă ținută deschisă degeaba.
   */

  return new Response('nu exista', { status: 404 })
}
