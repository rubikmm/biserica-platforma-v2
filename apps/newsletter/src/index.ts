/**
 * A8 · Newsletterul — pe platforma V2.
 *
 * ARHIVA PUBLICA a celor 459 de numere trimise din 2017 incoace, adusa in V1 din MailPoet si
 * re-randata cu chiar motorul MailPoet, ca sa arate exact cum au plecat pe email. Depozitul s-a
 * copiat obiect cu obiect in bucketul NOU `xc-newsletter-staging`.
 *
 * Rute:
 *   /health                   starea depozitului
 *   /                         ultimul numar, randat intreg — atat
 *   /arhiva[/<an>]            patratelele anilor, numerele pe luni
 *   /n/<id>                   un numar anume
 *   /cauta?q=                 cautare in subiect si in text
 *   /media/*                  pozele si PDF-urile la care trimit newsletterele
 *
 * ⚠️ TRIMITEREA nu se face de aici si nu se facea nici in V1 — arhiva e tot ce exista. Cand va
 * exista, scrisoarea pleaca prin `communication-worker`, iar abonatii sunt o AUDIENTA a comunicarii:
 * newsletterul nu tine liste de adrese si nu trimite email singur (structura mare, user 10.09.2026).
 *
 * Ce s-a schimbat fata de V1, si de ce:
 *  - **dus-intorsul tacut prin A13 a iesit**. In V1, A8 n-avea poarta si nici cookie comun cu
 *    celelalte aplicatii, asa ca intreba Contul „il cunosti?" la prima navigare (`tacut=1`,
 *    cookie `newsletter_recunoscut`, cel mult o data pe ora) numai ca sa scrie numele omului in
 *    antet. In V2 sesiunea e a platformei si se citeste dintr-o data de la `IDENTITATE` — deci
 *    ocolul, cookie-ul si `cache-control: private, no-store` de pe toate paginile nu mai au rost;
 *  - carcasa (antet, subsol, tema) vine din `@xc/ui`, nu din `src/comun/` copiat in aplicatie.
 */
import { SESIUNE_ANONIMA } from '@xc/contracts'
import { principalDin, sesiuneCurenta } from '@xc/auth'
import { adresaPaginii, citesteConfig, navigatieDin, prefixSiCale } from '@xc/config'
import { Logger, correlationId } from '@xc/observability'
import { dataVersiunii, html, json } from '@xc/ui'
import pkg from '../package.json'
import { type Fisa, citesteLista, citesteNumarul, citesteTextele } from './depozit.js'
import { type Ctx, paginaArhiva, paginaCautare, paginaGoala, paginaMesaj, paginaNumar } from './pagini.js'

export interface Env {
  ARHIVA: R2Bucket
  IDENTITATE: Fetcher
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  /** Data publicarii, pentru subsol — binding-ul `version_metadata`. */
  VERSIUNE?: { timestamp?: string }
}

const SERVICIU = 'app-newsletter'
const CACHE_PAGINI = 'public, max-age=300'

/** Pozele si PDF-urile nu se schimba niciodata — de-aia se pot tine mult in cache. */
const TIPURI: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
}

async function daMedia(env: Env, cheie: string): Promise<Response> {
  const o = await env.ARHIVA.get(cheie)
  if (!o) return new Response('Nu există.', { status: 404 })
  const ext = cheie.slice(cheie.lastIndexOf('.') + 1).toLowerCase()
  return new Response(o.body, {
    headers: {
      'content-type': o.httpMetadata?.contentType ?? TIPURI[ext] ?? 'application/octet-stream',
      'cache-control': 'public, max-age=604800, immutable',
      etag: o.httpEtag,
    },
  })
}

/** Fara diacritice si cu litere mici — ca „Sâmbătă" sa se gaseasca scriind „sambata". */
const plat = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function numara(unde: string, ce: string): number {
  let n = 0
  let i = unde.indexOf(ce)
  while (i >= 0) {
    n++
    i = unde.indexOf(ce, i + ce.length)
  }
  return n
}

/**
 * Cautarea: subiectul cantareste cat cinci potriviri din text — cine cauta „Crăciun" vrea intai
 * numerele care-l au in titlu. Se cer TOATE cuvintele, nu macar unul.
 */
async function cauta(env: Env, lista: Fisa[], cuvinte: string[]): Promise<Fisa[]> {
  const texte = await citesteTextele(env.ARHIVA)
  const dupaId = new Map(texte.map((t) => [t.id, plat(t.t)]))
  const gasite: { f: Fisa; scor: number }[] = []
  for (const f of lista) {
    const s = plat(f.subiect)
    const t = dupaId.get(f.id) ?? ''
    let scor = 0
    let toate = true
    for (const cuv of cuvinte) {
      const inS = numara(s, cuv)
      const inT = numara(t, cuv)
      if (!inS && !inT) {
        toate = false
        break
      }
      scor += inS * 5 + inT
    }
    if (toate) gasite.push({ f, scor })
  }
  gasite.sort((a, b) => b.scor - a.scor || b.f.trimis.localeCompare(a.f.trimis))
  return gasite.map((x) => x.f)
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cfg = citesteConfig(env)
    const cid = correlationId(req)
    const log = new Logger({ service: SERVICIU, correlationId: cid })
    const url = new URL(req.url)
    const { prefix, cale } = prefixSiCale(url, '/newsletter')
    const nav = navigatieDin(cfg)

    if (cale === '/health') {
      const lista = await citesteLista(env.ARHIVA).catch(() => [])
      return json(
        {
          ok: true,
          app: 'newsletter',
          cod: 'A8',
          stare: lista.length ? 'arhiva' : 'fara date',
          numere: lista.length,
          mediu: env.MEDIU,
          versiune: pkg.version,
          publicat: env.VERSIUNE?.timestamp ?? null,
          ora: new Date().toISOString(),
        },
        200,
        { 'cache-control': 'no-store' },
      )
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return new Response('Metoda nu e permisă.', { status: 405 })
    }

    // Media nu are nume de om in ea si nu cere sesiune: se serveste inainte de orice altceva.
    if (cale.startsWith('/media/')) {
      try {
        return await daMedia(env, decodeURIComponent(cale.slice(1)))
      } catch (e) {
        log.error('eroare media', { eroare: e instanceof Error ? e.message : String(e) })
        return new Response('Eroare.', { status: 500 })
      }
    }

    // ARHIVA E PUBLICA (user, 8 sept. 2026): newsletterele au plecat pe email catre oricine s-a
    // abonat, deci n-au ce ascunde. Sesiunea se cere doar ca sa stim pe cine salutam in antet.
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
    const cachePagina = {
      'cache-control':
        ctx.utilizator || ctx.veziCa ? 'private, no-store' : env.MEDIU === 'dev' ? 'no-store' : CACHE_PAGINI,
    }

    try {
      const lista = await citesteLista(env.ARHIVA)

      if (cale === '/cauta') {
        const intrebare = (url.searchParams.get('q') ?? '').trim()
        if (!intrebare) return html(paginaCautare(ctx, lista, '', null, 'gol'), 200, cachePagina)
        const cuvinte = plat(intrebare).split(/\s+/).filter((x) => x.length > 1)
        if (!cuvinte.length) return html(paginaCautare(ctx, lista, intrebare, null, 'scurt'), 200, cachePagina)
        const gasite = await cauta(env, lista, cuvinte)
        return html(paginaCautare(ctx, lista, intrebare, gasite, null), 200, cachePagina)
      }

      const ma = /^\/arhiva(?:\/(\d{4}))?\/?$/.exec(cale)
      if (ma) return html(paginaArhiva(ctx, lista, ma[1] ? Number(ma[1]) : null), 200, cachePagina)

      const mn = /^\/n\/(\d+)$/.exec(cale)
      if (mn) {
        const i = lista.findIndex((f) => f.id === Number(mn[1]))
        if (i < 0) return html(paginaMesaj(ctx, lista, 'Nu există', '<p>Numărul acesta nu e în arhivă.</p>'), 404, cachePagina)
        return html(paginaNumar(ctx, lista, i, await citesteNumarul(env.ARHIVA, lista[i]!.id)), 200, cachePagina)
      }

      // Prima pagina: ultimul numar, randat intreg — nimic altceva (user, 8 sept. 2026). Mersul prin
      // arhiva se face din antet: sagetile, bulina, Arhiva, lupa.
      if (cale === '/') {
        if (!lista.length) return html(paginaGoala(ctx), 200, cachePagina)
        const i = lista.length - 1
        return html(paginaNumar(ctx, lista, i, await citesteNumarul(env.ARHIVA, lista[i]!.id)), 200, cachePagina)
      }

      return html(paginaMesaj(ctx, lista, 'Nu există', '<p>Adresa nu există.</p>'), 404, cachePagina)
    } catch (e) {
      log.error('eroare pagina', { eroare: e instanceof Error ? e.message : String(e) })
      return html(paginaMesaj(ctx, [], 'Eroare', '<p>A apărut o eroare neașteptată. Încearcă din nou.</p>'), 500)
    }
  },
}
