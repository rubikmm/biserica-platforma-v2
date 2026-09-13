/**
 * A3 · Buletinul parohial — pe platforma V2.
 *
 * Foaia periodica fata-verso, 50-60 de exemplare pe saptamana, plus arhiva: 619 numere aparute din
 * 2012 incoace. Cifrele si textul de cautat stau in D1 (`xc-buletin-staging`), fisierele in R2
 * (`xc-buletin-staging`) — amandoua NOI, copiate din V1 obiect cu obiect, rand cu rand.
 *
 * Rute:
 *   /health                     starea arhivei
 *   /v1/…                       API-ul contractului, deschis (jos, `api`)
 *   /fisier/<cheie>             PDF-ul sau poza unui numar, din R2 (deschis, cache lung)
 *   /                           numarul curent                            ┐ pagini de om, DESCHISE
 *   /buletin/<nr>-<data>        un numar din arhiva                       │ („totul la liber,
 *   /arhiva[?an=2019]           toate numerele, pe ani si luni            │  deocamdată")
 *   /cauta?q=…                  cautare in textul buletinelor             ┘
 *   /abonare · /dezabonare      POST: audienta `buletin-abonati` a comunicarii (cere cont)
 *
 * Ce s-a schimbat fata de V1, si de ce:
 *  - **lista de abonati nu mai e a aplicatiei**: in V1 statea in tabelul `abonati` din baza lui A3,
 *    cu e-mail si nume in ea. In V2 abonarea e o AUDIENTA a comunicarii, iar aplicatia nu tine nicio
 *    adresa (structura mare, user 10.09.2026). Tabelul nu s-a copiat;
 *  - **modul de proba a iesit** cu totul (in V2 local = staging): fara `/proba`, fara persoane
 *    inventate, fara `PROBA=da`;
 *  - carcasa vine din `@xc/ui`, iar cine esti afla din sesiunea centrala (`IDENTITATE`).
 *
 * Redactarea unui numar nou — sablonul fata-verso, programul cerut de la A2, sfintii de la A1 — nu
 * exista nici in V1; ramane de facut, ca acolo.
 */
import { SCOPE_GLOBAL, SESIUNE_ANONIMA } from '@xc/contracts'
import { principalDin, sesiuneCurenta, verificaCsrf } from '@xc/auth'
import { adresaPaginii, citesteConfig, navigatieDin, prefixSiCale } from '@xc/config'
import { Logger, correlationId } from '@xc/observability'
import { dataVersiunii, eroareApi, html, json, jsonCuEtag } from '@xc/ui'
import pkg from '../package.json'
import {
  type BuletinScurt,
  anii,
  cauta,
  celMaiNouCuNumarul,
  dintrUnAn,
  numaratoare,
  ultimele,
  ultimul,
  unul,
  vecini,
} from './depozit.js'
import { type Ctx, type Meniu, paginaAcasa, paginaArhiva, paginaBuletin, paginaCautare, paginaMesaj } from './pagini.js'

export interface Env {
  DB: D1Database
  FISIERE: R2Bucket
  IDENTITATE: Fetcher
  AUDIT: Fetcher
  COMUNICARE: Fetcher
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  /** Data publicarii, pentru subsol — binding-ul `version_metadata`. */
  VERSIUNE?: { timestamp?: string }
}

const SERVICIU = 'app-buletin'
const AUDIENTA = 'buletin-abonati'
const CACHE_PAGINI = 'public, max-age=300'

const eAdresaDeMasina = (cale: string) => /^\/(v1|intern|\.well-known|health)(\/|$)/.test(cale)

/** Cheile din R2 sunt scrise de import, nu de om: `2026/buletin-615-2026-09-06.pdf`. Orice altceva
 *  nu se cauta in depozit — nici macar ca sa se afle ca nu exista. */
const CHEIE_BUNA = /^\d{4}\/buletin-\d{3,4}-\d{4}-\d{2}-\d{2}(-mic)?\.(pdf|jpg)$/

function redirect(catre: string, status: 302 | 303 = 303): Response {
  return new Response(null, { status, headers: { location: catre } })
}

async function scrieAudit(
  env: Env,
  i: { action: string; target: string; outcome: 'success' | 'failure'; correlationId: string; actorId?: string },
): Promise<void> {
  try {
    await env.AUDIT.fetch('https://audit.intern/scrie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: i.action,
        target: i.target,
        scope: SCOPE_GLOBAL,
        actor: i.actorId ? { type: 'user', id: i.actorId } : { type: 'system' },
        outcome: i.outcome,
        correlationId: i.correlationId,
        summary: {},
      }),
    })
  } catch {
    // auditul indisponibil nu blocheaza operatia
  }
}

async function comunicare<T = unknown>(env: Env, cale: string, corp: unknown): Promise<T | null> {
  try {
    const r = await env.COMUNICARE.fetch(`https://comunicare.intern${cale}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corp),
    })
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}

/**
 * Un fisier din depozit: PDF-ul unui numar sau poza paginii lui intai. Nu se schimba niciodata dupa
 * ce a fost pus (numele poarta numarul si data), deci se poate tine in cache un an.
 */
async function fisierul(req: Request, url: URL, env: Env, cheie: string): Promise<Response> {
  if (!CHEIE_BUNA.test(cheie)) return new Response('Nu există fișierul.', { status: 404 })
  const obiect = await env.FISIERE.get(cheie, { onlyIf: req.headers })
  if (!obiect) return new Response('Nu există fișierul.', { status: 404 })
  const h = new Headers()
  obiect.writeHttpMetadata(h)
  h.set('etag', obiect.httpEtag)
  h.set('cache-control', 'public, max-age=31536000, immutable')
  if (cheie.endsWith('.pdf')) {
    const nume = cheie.slice(cheie.lastIndexOf('/') + 1)
    h.set(
      'content-disposition',
      `${url.searchParams.has('descarca') ? 'attachment' : 'inline'}; filename="${nume}"`,
    )
  }
  // `onlyIf` a raspuns cu obiectul FARA continut: browserul are deja versiunea buna
  if (!('body' in obiect) || !obiect.body) return new Response(null, { status: 304, headers: h })
  return new Response(obiect.body, { headers: h })
}

// ---------------------------------------------------------------------------
// API-ul `/v1` — ce dau masinile celorlalte aplicatii. GET, public, fara jeton.
// Adresele sunt cele din V1, cu aceeasi precizare adusa de arhiva adevarata: numarul singur nu e
// cheie, asa ca fiecare buletin poarta si `data`.
// ---------------------------------------------------------------------------

/** Un buletin, cum il vede o alta aplicatie: cifrele lui si adresele intregi ale fisierelor. */
const dupaContract = (b: BuletinScurt, radacina: string) => ({
  nr: b.nr,
  data: b.data,
  an: b.an,
  luna: b.luna,
  pagini: b.pagini,
  pagina: `${radacina}/buletin/${b.nr}-${b.data}`,
  pdf: b.cheie_pdf ? `${radacina}/fisier/${b.cheie_pdf}` : null,
  poza: b.cheie_poza_mica ? `${radacina}/fisier/${b.cheie_poza_mica}` : null,
})

async function api(req: Request, env: Env, cale: string, url: URL, radacina: string): Promise<Response> {
  if (cale === '/health') {
    const n = await numaratoare(env.DB).catch(() => null)
    return json(
      {
        ok: true,
        app: 'buletin',
        cod: 'A3',
        stare: n && n.buletine > 0 ? 'cu date' : 'fara date',
        date: n,
        mediu: env.MEDIU,
        versiune: pkg.version,
        publicat: env.VERSIUNE?.timestamp ?? null,
        ora: new Date().toISOString(),
      },
      200,
      { 'cache-control': 'no-store' },
    )
  }

  if (cale === '/v1' || cale === '/v1/') {
    return jsonCuEtag(
      req,
      {
        app: 'buletin',
        cod: 'A3',
        adrese: [
          { adresa: '/v1/curent', ce_da: 'numărul curent' },
          { adresa: '/v1/arhiva?an=2026', ce_da: 'numerele unui an (fără `an`: anul curent)' },
          { adresa: '/v1/numar/2026/615', ce_da: 'un număr anume' },
          { adresa: '/v1/numar/2026/615.pdf', ce_da: 'PDF-ul lui' },
        ],
      },
      { 'cache-control': 'public, max-age=3600' },
    )
  }

  if (cale === '/v1/curent') {
    const b = await ultimul(env.DB)
    if (!b) return eroareApi(404, 'arhiva_goala', 'Arhiva e goală.')
    return jsonCuEtag(req, { buletin: dupaContract(b, radacina) }, { 'cache-control': 'public, max-age=300' })
  }

  if (cale === '/v1/arhiva') {
    const an = url.searchParams.get('an') ?? String(new Date().getFullYear())
    if (!/^\d{4}$/.test(an)) return eroareApi(400, 'an_invalid', 'Anul se scrie cu patru cifre.')
    const lista = await dintrUnAn(env.DB, an)
    return jsonCuEtag(
      req,
      { an, cate: lista.length, buletine: lista.map((b) => dupaContract(b, radacina)) },
      { 'cache-control': 'public, max-age=900' },
    )
  }

  const m = /^\/v1\/numar\/(\d{4})\/(\d{1,4})(\.pdf)?$/.exec(cale)
  if (m) {
    const an = m[1]!
    const nr = Number(m[2])
    const lista = await dintrUnAn(env.DB, an)
    const b = lista.filter((x) => x.nr === nr).sort((a, c) => (a.data < c.data ? -1 : 1))[0]
    if (!b) return eroareApi(404, 'numar_inexistent', `Numărul ${nr} nu e în ${an}.`)
    if (m[3]) {
      if (!b.cheie_pdf) return eroareApi(404, 'fara_pdf', `Numărul ${nr} a rămas în arhivă doar ca poză.`)
      return redirect(`${radacina}/fisier/${b.cheie_pdf}`, 302)
    }
    return jsonCuEtag(req, { buletin: dupaContract(b, radacina) }, { 'cache-control': 'public, max-age=900' })
  }

  return eroareApi(404, 'adresa_inexistenta', `Adresa ${cale} nu există sub /v1.`)
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: SERVICIU, correlationId: cid })
    const url = new URL(req.url)
    /**
     * ⚠️ MONTAJUL SE IA DIN MEDIU, nu din cale — buletinul e singura aplicatie care are o ruta
     * proprie cu chiar numele ei: `/buletin/<nr>-<data>`, adresa unui numar, mostenita din V1.
     * Pe subdomeniu (`buletin.staging.sfantul-ilie.ro/buletin/615-2026-09-06`) `prefixSiCale` lua
     * acel `/buletin` drept prefixul gateway-ului, taia calea la `/615-2026-09-06` si pagina
     * numarului dadea 404 — reclamat de user, 13.09.2026. Prin gateway (numai in dev) aplicatia
     * chiar sta sub `/buletin`; in staging si productie sta la radacina, deci montajul e gol.
     */
    const { prefix, cale } = prefixSiCale(url, env.MEDIU === 'dev' ? '/buletin' : '')
    const nav = navigatieDin(cfg)
    const radacina = new URL(prefix || '/', cfg.ORIGINE_PUBLICA).toString().replace(/\/$/, '')

    if (eAdresaDeMasina(cale)) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return eroareApi(405, 'metoda_nepermisa', 'Sub /v1 merg doar GET și HEAD.')
      }
      try {
        return await api(req, env, cale, url, radacina)
      } catch (e) {
        log.error('eroare api', { eroare: e instanceof Error ? e.message : String(e) })
        return eroareApi(500, 'eroare_interna', 'A apărut o eroare neașteptată.')
      }
    }

    // Fisierele: deschise, fara sesiune — buletinul parohiei e hartie publica, se imparte in biserica.
    if (cale.startsWith('/fisier/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Metoda nu e permisă.', { status: 405 })
      return await fisierul(req, url, env, decodeURIComponent(cale.slice(8)))
    }

    if (req.method === 'POST') {
      const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA], cfg.MEDIU === 'dev')
      if (problema) {
        const ctxMinim: Ctx = {
          prefix,
          nav,
          utilizator: null,
          eAdmin: false,
          versiune: pkg.version,
          modificata: dataVersiunii(env.VERSIUNE),
        }
        return html(paginaMesaj(ctxMinim, {}, 'Verificare de securitate', `<p>${problema}</p>`), 403)
      }
    } else if (req.method !== 'GET' && req.method !== 'HEAD') {
      return new Response('Metoda nu e permisă.', { status: 405 })
    }

    // PAGINILE SUNT DESCHISE, ca in V1: buletinul parohiei e hartie publica. Scrierea — abonarea —
    // cere in continuare cont.
    const sesiune = await sesiuneCurenta(env.IDENTITATE, req).catch(() => SESIUNE_ANONIMA)
    const principal = principalDin(sesiune)
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
    // Sub masca „vezi ca" pagina e personala chiar cand n-are niciun nume pe ea; in dev nu se tine
    // cache deloc (cei cinci minute faceau schimbarile sa para nefacute).
    const cachePagina = {
      'cache-control':
        ctx.utilizator || ctx.veziCa ? 'private, no-store' : env.MEDIU === 'dev' ? 'no-store' : CACHE_PAGINI,
    }
    const raspuns = url.searchParams.get('abonat')
    const meniu = (rest: Partial<Meniu> = {}): Meniu => ({
      veste: raspuns === '1' ? 'inscris' : raspuns === '2' ? 'scos' : raspuns === '0' ? 'eroare' : null,
      ...rest,
    })

    try {
      // ------------------------------------------------------------ abonare
      if (cale === '/abonare' || cale === '/dezabonare') {
        if (req.method !== 'POST') return redirect(`${prefix}/`)
        if (!principal) return redirect(`${nav.cont}/auth/login`)
        const formular = await req.formData()
        const spre = String(formular.get('spre') ?? `${prefix}/`)
        const spreSigur = spre.startsWith('/') && !spre.startsWith('//') ? spre : `${prefix}/`
        const inscrie = cale === '/abonare'
        const r = inscrie
          ? await comunicare(env, '/audiente/inscrie', {
              audienceId: AUDIENTA,
              nume: 'Abonații buletinului',
              userId: principal.userId,
              channel: 'email',
              adresa: principal.email,
            })
          : await comunicare(env, '/audiente/scoate', {
              audienceId: AUDIENTA,
              userId: principal.userId,
              channel: 'email',
            })
        await scrieAudit(env, {
          action: inscrie ? 'buletin.subscribe' : 'buletin.unsubscribe',
          target: AUDIENTA,
          outcome: r ? 'success' : 'failure',
          correlationId: cid,
          actorId: principal.userId,
        })
        return redirect(`${spreSigur}?abonat=${!r ? 0 : inscrie ? 1 : 2}`)
      }

      // ------------------------------------------------------- numarul curent
      if (cale === '/') {
        const [b, n] = await Promise.all([ultimul(env.DB), numaratoare(env.DB)])
        const dinainte = b ? (await ultimele(env.DB, 7)).filter((x) => !(x.nr === b.nr && x.data === b.data)) : []
        return html(paginaAcasa(ctx, meniu(), b, dinainte, n.buletine), 200, cachePagina)
      }

      // --------------------------------------------------- un numar din arhiva
      if (cale.startsWith('/buletin/')) {
        const cerut = cale.slice(9)
        const m = /^(\d{1,4})-(\d{4}-\d{2}-\d{2})$/.exec(cerut)
        if (m) {
          const b = await unul(env.DB, Number(m[1]), m[2]!)
          if (b) return html(paginaBuletin(ctx, meniu(), b, await vecini(env.DB, b.nr, b.data)), 200, cachePagina)
        }
        // numarul singur (`/buletin/615`) e o adresa la indemana, dar nu e cheie: duce la numarul
        // acela — cel mai nou, daca parohia l-a filat de doua ori
        if (/^\d{1,4}$/.test(cerut)) {
          const r = await celMaiNouCuNumarul(env.DB, Number(cerut))
          if (r) return redirect(`${prefix}/buletin/${r.nr}-${r.data}`, 302)
        }
        return html(
          paginaMesaj(
            ctx,
            meniu(),
            'Nu există numărul',
            `<p>Adresa unui buletin e <code>/buletin/615-2026-09-06</code> — numărul și ziua în care a apărut.</p>
<p><a href="${prefix}/arhiva">Arhiva</a> le are pe toate.</p>`,
          ),
          404,
          cachePagina,
        )
      }

      // ------------------------------------------------------ arhiva, pe ani
      if (cale === '/arhiva') {
        const lista = await anii(env.DB)
        const cerut = url.searchParams.get('an')
        const ales = lista.find((a) => a.an === cerut)?.an ?? lista[0]?.an ?? ''
        const [buletine, n] = await Promise.all([
          ales ? dintrUnAn(env.DB, ales) : Promise.resolve([]),
          numaratoare(env.DB),
        ])
        return html(paginaArhiva(ctx, meniu({ arhiva: true }), lista, ales, buletine, n.buletine), 200, cachePagina)
      }

      // ---------------------------------------------------------- cautarea
      if (cale === '/cauta') {
        const q = url.searchParams.get('q') ?? ''
        const gasite = q.trim() ? await cauta(env.DB, q) : []
        // un numar scris singur, care da fix un buletin: nu are rost o listă de unul — se deschide
        if (gasite.length === 1 && /^\d{1,4}$/.test(q.trim()) && gasite[0]!.nr === Number(q.trim())) {
          return redirect(`${prefix}/buletin/${gasite[0]!.nr}-${gasite[0]!.data}`, 302)
        }
        return html(paginaCautare(ctx, meniu({ q }), q, gasite), 200, cachePagina)
      }

      return html(
        paginaMesaj(
          ctx,
          meniu(),
          'Nu există pagina',
          `<p><a href="${prefix}/">Numărul curent</a> · <a href="${prefix}/arhiva">Arhiva</a> · <a href="${prefix}/cauta">Căutare</a></p>`,
        ),
        404,
        cachePagina,
      )
    } catch (e) {
      log.error('eroare pagina', { eroare: e instanceof Error ? e.message : String(e) })
      return html(
        paginaMesaj(ctx, meniu(), 'Eroare', '<p>A apărut o eroare neașteptată. Încearcă din nou.</p>'),
        500,
      )
    }
  },
}
