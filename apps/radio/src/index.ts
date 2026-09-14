/**
 * RADIO — muzica psaltică a parohiei, pe platforma V2.
 *
 * A doua aplicație în care s-a împărțit `transmisiuni` din V1 (cerere a utilizatorului,
 * 14.09.2026). Aici a venit **tot ce era pe transmisiuni**: playerul public, panoul de comandă,
 * muzica radioului și microfonul bisericii. Dincolo, la `live`, stă creierul: starea emisiei,
 * aparatul din biserică și semnalizarea WebRTC.
 *
 * Rute:
 *   /health                      starea aplicației
 *   /                            PUBLIC: playerul (directul sau radioul, cu trecere lină)
 *   /admin                       panoul — ACELAȘI ca la `live`                  (broadcast.manage)
 *   /admin/stare|inventar|comanda   datele și comenzile panoului                (broadcast.manage)
 *   /biblioteca                  muzica radioului: urcat, șters, foldere        (broadcast.manage)
 *   /mic                         microfoanele bisericii                         (super-admin)
 *   /api/…                       ce cere playerul din pagină
 *   /v1/acum, /v1/biblioteca     PUBLIC, JSON: ce se aude și indicele muzicii
 *   /_intern/…                   numai pentru workerul lui `live` (Service Binding)
 *
 * ⚠️ Trei lucruri care se încalcă ușor:
 *
 *  1. **Ceasul, nu starea.** Nu ținem scris ce piesă se aude — ținem DE CÂND curge selecția și
 *     socotim. Așa radioul merge singur la nesfârșit, fără cron și fără aparat.
 *  2. **Radioul nu comandă directul.** Panoul de aici trimite comenzile la `live`, care ține
 *     starea. Dacă aplicația asta ajunge să pornească singură directul, cele două se contrazic.
 *  3. **Se servește numai ce e în indice.** Bucketul ține și înregistrările slujbelor; ruta de
 *     fișier verifică lista înainte să dea ceva, altfel arhiva parohiei ar fi publică.
 */
import { asiguraCsrf, principalDin, sesiuneCurenta, verificaCsrf } from '@xc/auth'
import { ClientAutorizare } from '@xc/authorization'
import { ceSeAude, corpPanou, corpPlayer, jsPanou, jsPlayer } from '@xc/comanda'
import { adresaPaginii, citesteConfig, navigatieDin, prefixSiCale } from '@xc/config'
import { CererePanou, SCOPE_GLOBAL, SESIUNE_ANONIMA, type StareEmisie, type StarePanou } from '@xc/contracts'
import { Logger, correlationId } from '@xc/observability'
import { dataVersiunii, html, json } from '@xc/ui'
import pkg from '../package.json' with { type: 'json' }
import { bibliotecaRute } from './biblioteca.js'
import { corpBiblioteca, jsBiblioteca } from './biblioteca-pagina.js'
import { type EnvCeas, radioul } from './ceas.js'
import { biblioteca, fisier } from './depozit.js'
import { type EnvLiveDeparte, cereLive, emisia, starePanouDeparte, stareMic } from './live-departe.js'
import { corpMic, jsMic } from './mic.js'
import { type Ctx, pagina, paginaMesaj, spreCont } from './pagina.js'

export { Radio } from './ceas.js'

export interface Env extends EnvCeas, EnvLiveDeparte {
  IDENTITATE: Fetcher
  AUTORIZARE: Fetcher
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  URL_LIVE?: string
  VERSIUNE?: { timestamp?: string }
}

const SERVICIU = 'app-radio'
const FARA_STOC = { 'cache-control': 'private, no-store' }
const JSON_VIU = { 'cache-control': 'no-store' }

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: SERVICIU, correlationId: cid })
    const url = new URL(req.url)
    const nav = navigatieDin(cfg)
    const { prefix, cale } = prefixSiCale(url, env.MEDIU === 'dev' ? '/radio' : '')

    try {
      if (cale === '/health') {
        const b = await biblioteca(env)
        return json({ ok: true, app: 'radio', piese: b.fisiere.length, versiune: pkg.version, ora: new Date().toISOString() })
      }

      // ---------------------------------------------------- ce cere workerul lui `live`
      if (cale.startsWith('/_intern/')) {
        if (req.headers.get('x-xc-intern') !== '1') return new Response('nu exista', { status: 404 })
        return intern(req, cale, env)
      }

      // ---------------------------------------------------- contractul public
      if (cale === '/v1/acum' && req.method === 'GET') {
        const [b, s] = await Promise.all([biblioteca(env), radioul(env).selectie()])
        return Response.json(ceSeAude(b, s), { headers: JSON_VIU })
      }
      if (cale === '/v1/biblioteca' && req.method === 'GET') {
        return Response.json(await biblioteca(env), { headers: JSON_VIU })
      }

      // Fișierul de muzică e public și n-are nevoie de sesiune — îl scoatem înaintea porții.
      if (cale === '/api/fisier' && (req.method === 'GET' || req.method === 'HEAD')) {
        return fisier(req, url, env)
      }
      if (cale === '/api/fisier' && req.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'range' },
        })
      }
      if (cale.startsWith('/api/')) return api(req, cale, env)

      // ---------------------------------------------------- cine e
      const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
      const principal = principalDin(sesiune)
      const authz = new ClientAutorizare(env.AUTORIZARE, cid)
      const eAdmin = principal ? (await authz.can(principal, 'broadcast.manage', SCOPE_GLOBAL)).allowed : false
      // `roles.manage` vine NUMAI cu rolul de super-admin, iar întrebarea trece prin mască.
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
        // Panoul emisiei e unul singur, și stă chiar aici — tot încoace duce și meniul lui `live`.
        urlPanou: `${prefix}/admin`,
        modificata: dataVersiunii(env.VERSIUNE),
        veziCa: sesiune.veziCa,
        poateVedeaCa: sesiune.poateVedeaCa,
        spre: adresaPaginii(cfg, url),
      }

      // ---------------------------------------------------- panoul
      if (cale === '/admin' || cale.startsWith('/admin/')) {
        if (!eAdmin) {
          if (!ctx.userId) return Response.redirect(spreCont(ctx, cfg.ORIGINE_PUBLICA, cale), 303)
          return html(
            paginaMesaj(ctx, 'Numai pentru administratori', 'Panoul emisiei cere permisiunea „broadcast.manage".'),
            403,
            antete,
          )
        }

        if (cale === '/admin/stare' && req.method === 'GET') {
          return Response.json(await starePanouAici(env, eSuperAdmin), { headers: JSON_VIU })
        }
        if (cale === '/admin/inventar' && req.method === 'GET') {
          return Response.json(await biblioteca(env), { headers: JSON_VIU })
        }
        if (cale === '/admin/comanda' && req.method === 'POST') {
          const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA], cfg.MEDIU === 'dev')
          if (problema) return json({ motiv: problema }, 403)
          const corp = CererePanou.safeParse(await req.json().catch(() => null))
          if (!corp.success) return json({ motiv: 'astept {actiune}' }, 400)
          /*
           * Dreptul l-am verificat noi, aici, cu aceeași cheie și aceeași autorizare centrală.
           * Comanda pleacă la `live`, fiindcă el ține starea — noi nu pornim și nu oprim nimic
           * de capul nostru.
           */
          const r = await cereLive(env, '/_intern/comanda', {
            method: 'POST',
            body: JSON.stringify({ ...corp.data, cine: ctx.utilizator, eSuperAdmin }),
          })
          if (!r) return json({ motiv: 'aplicația directului nu răspunde' }, 502)
          return new Response(r.body, { status: r.status, headers: JSON_VIU })
        }

        if (cale === '/admin' || cale === '/admin/') return html(paginaAdmin(ctx, env), 200, antete)
        return html(paginaMesaj(ctx, 'Pagina nu există', 'Adresa aceasta nu duce nicăieri în panou.'), 404, antete)
      }

      // ---------------------------------------------------- muzica radioului
      if (cale === '/biblioteca' || cale === '/biblioteca/') {
        // Cuprinsul se vede de oricine a intrat; scrierea cere dreptul. Așa pagina poate fi
        // deschisă și de un om fără drept, și îi spune limpede ce-i lipsește.
        return html(
          pagina(ctx, { titluPagina: 'Muzica radioului', corp: corpBiblioteca(), scripturi: jsBiblioteca(prefix) }),
          200,
          antete,
        )
      }
      if (cale.startsWith('/biblioteca/')) {
        const r = await bibliotecaRute(req, url, cale, env, eAdmin)
        if (r) return r
        return new Response('nu exista', { status: 404 })
      }

      // ---------------------------------------------------- microfonul
      if (cale === '/mic' || cale.startsWith('/mic/')) {
        if (!eSuperAdmin) {
          if (!ctx.userId) return Response.redirect(spreCont(ctx, cfg.ORIGINE_PUBLICA, cale), 303)
          const mesaj = 'Microfonul bisericii se aude doar cu rol de super-administrator.'
          if (cale !== '/mic') return json({ motiv: mesaj }, 403)
          return html(paginaMesaj(ctx, 'Fără acces', mesaj), 403, antete)
        }
        if (cale === '/mic') {
          return html(pagina(ctx, { titluPagina: 'Microfonul', corp: corpMic(), scripturi: jsMic(prefix) }), 200, antete)
        }
        if (cale === '/mic/stare' && req.method === 'GET') {
          return Response.json(await stareMic(env), { headers: JSON_VIU })
        }
        // Semnalizarea microfonului stă la `live`; o trimitem mai departe neschimbată.
        const r = await cereLive(env, `/_intern/mic${cale.slice('/mic'.length)}`, {
          method: req.method,
          body: req.method === 'PUT' ? await req.text() : undefined,
        })
        if (!r) return json({ motiv: 'aplicația directului nu răspunde' }, 502)
        return new Response(r.body, { status: r.status, headers: JSON_VIU })
      }

      /*
       * Publicul. ⚠️ **Cu Cont în antet** (user, 14.09.2026: „trebuia să fie Cont pe ambele"). În V1
       * pagina de ascultare era singura fără cont — „un player simplu, nu e nevoie de login".
       * Regula aia a căzut: ascultatul rămâne la liber, dar antetul arată la fel ca peste tot.
       */
      if (cale === '/' || cale === '') {
        return html(
          pagina(ctx, {
            titluPagina: 'Ascultă',
            corp: `<div class="live">${corpPlayer()}</div>`,
            scripturi: jsPlayer(prefix),
          }),
          200,
          { 'cache-control': 'no-store' },
        )
      }

      return html(paginaMesaj(ctx, 'Pagina nu există', 'Adresa aceasta nu duce nicăieri la radio.'), 404, antete)
    } catch (e) {
      log.error('eroare pagina', { eroare: e instanceof Error ? e.message : String(e) })
      return new Response('A apărut o eroare. Încearcă din nou peste puțin.', { status: 500 })
    }
  },
} satisfies ExportedHandler<Env>

/** Panoul — același în amândouă aplicațiile, de aceea vine întreg din `@xc/comanda`. */
function paginaAdmin(ctx: Ctx, env: Env): string {
  const live = env.URL_LIVE || ctx.nav.live
  return pagina(ctx, {
    titluPagina: 'Panou',
    corp: corpPanou({ live: `${live}/`, radio: `${ctx.prefix}/`, biblioteca: `${ctx.prefix}/biblioteca` }),
    scripturi: jsPlayer(ctx.prefix) + jsPanou(ctx.prefix),
  })
}

/**
 * Starea panoului, compusă: partea noastră (ceasul și biblioteca) e adevărul de aici, restul
 * (aparatul, SFU-ul, ascultătorii) vine de la `live`. Dacă `live` tace, tot arătăm ce se aude la
 * radio — mai bine o cartelă pe jumătate decât o pagină goală.
 */
async function starePanouAici(env: Env, eSuperAdmin: boolean): Promise<StarePanou> {
  const [b, sel] = await Promise.all([biblioteca(env), radioul(env).selectie()])
  const acum = ceSeAude(b, sel)
  const local: StarePanou = {
    radio: acum,
    selectie: sel,
    director: sel.director,
    biblioteca: { generat_la: b.generat_la, semnatura: b.semnatura, fisiere: b.fisiere.length },
    aparat: null,
    viu: false,
    comanda_versiune: 0,
    comanda_la: '',
    comanda_de: null,
    direct: { direct: false, configurat: false },
    ascultatori: null,
    pot_comanda: true,
    super_admin: eSuperAdmin,
    acum: new Date().toISOString(),
  }
  const departe = await starePanouDeparte(env, true, eSuperAdmin, local)
  // Ceasul e al nostru: îl punem peste, ca panoul să nu arate o secundă veche dusă și întoarsă.
  return { ...departe, radio: acum, selectie: sel, director: sel.director, biblioteca: local.biblioteca }
}

// --- ce cere playerul din pagină ------------------------------------------------

async function api(req: Request, cale: string, env: Env): Promise<Response> {
  if (cale === '/api/stare' && req.method === 'GET') {
    const [b, sel] = await Promise.all([biblioteca(env), radioul(env).selectie()])
    const acum = ceSeAude(b, sel)
    const gol: StareEmisie = {
      live: false,
      mod: acum.pornit && acum.cale ? 'radio' : 'oprit',
      direct: { direct: false, configurat: false },
      radio: acum,
      slujba: null,
      urmatoarea: null,
      ora: new Date().toISOString(),
    }
    const s = await emisia(env, gol)
    // Ceasul socotit aici bate ce vine de departe: e al nostru și e cu o clipă mai proaspăt.
    return Response.json({ ...s, radio: acum }, { headers: JSON_VIU })
  }
  if (cale === '/api/jurnal' && req.method === 'POST') {
    const text = (await req.text().catch(() => '')).slice(0, 2000)
    console.log('[pagina]', req.headers.get('cf-connecting-ip') ?? '?', text)
    return new Response(null, { status: 204 })
  }
  // Semnalizarea directului și numărătoarea ascultătorilor sunt ale lui `live`.
  if (cale === '/api/asculta' || cale.startsWith('/api/asculta/') || cale === '/api/ascult') {
    const r = await cereLive(env, `/_intern${cale.slice('/api'.length)}`, {
      method: req.method,
      body: req.method === 'POST' || req.method === 'PUT' ? await req.text() : undefined,
    })
    if (!r) return json({ motiv: 'aplicația directului nu răspunde' }, 502)
    return new Response(r.body, { status: r.status, headers: JSON_VIU })
  }
  return new Response('nu exista', { status: 404 })
}

// --- ce cere workerul lui `live` (Service Binding) -------------------------------

async function intern(req: Request, cale: string, env: Env): Promise<Response> {
  if (cale === '/_intern/ceas' && req.method === 'GET') {
    const [b, selectie] = await Promise.all([biblioteca(env), radioul(env).selectie()])
    return Response.json(
      { selectie, biblioteca: { generat_la: b.generat_la, semnatura: b.semnatura, fisiere: b.fisiere.length } },
      { headers: JSON_VIU },
    )
  }
  if (cale === '/_intern/ceas' && req.method === 'POST') {
    const c = (await req.json().catch(() => null)) as
      | { pornit?: boolean; director?: string | null; fisier_start?: string | null; de?: string; cine?: string | null }
      | null
    if (!c) return json({ motiv: 'astept selectia' }, 400)
    const { cine, ...rest } = c
    return Response.json(await radioul(env).pune(rest, cine ?? null), { headers: JSON_VIU })
  }
  if (cale === '/_intern/indice' && req.method === 'GET') {
    return Response.json(await biblioteca(env), { headers: JSON_VIU })
  }
  return new Response('nu exista', { status: 404 })
}
