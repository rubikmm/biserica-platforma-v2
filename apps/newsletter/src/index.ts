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
 *   /nou                      buletin nou — adaugarea manuala (numai adminii; nu scrie inca nimic)
 *   /cauta?q=                 cautare in subiect si in text
 *   /abonare · /dezabonare    abonarea, din `@xc/abonare` (15.09.2026)
 *   /media/*                  pozele si PDF-urile la care trimit newsletterele
 *
 * ⚠️ TRIMITEREA nu se face de aici si nu se facea nici in V1 — arhiva e tot ce exista. Cand va
 * exista, scrisoarea pleaca prin `communication-worker`, iar abonatii sunt o AUDIENTA a comunicarii:
 * newsletterul nu tine liste de adrese si nu trimite email singur (structura mare, user 10.09.2026).
 * ⚠️ DE LA 15.09.2026 ARE TOTUSI BUTON DE ABONARE, cerut anume: oamenii se inscriu de pe acum in
 * audienta `newsletter-abonati` si asteapta acolo pana se face trimiterea. Abaterea e stiuta si
 * scrisa si in registrul din `@xc/abonare`.
 *
 * Ce s-a schimbat fata de V1, si de ce:
 *  - **dus-intorsul tacut prin A13 a iesit**. In V1, A8 n-avea poarta si nici cookie comun cu
 *    celelalte aplicatii, asa ca intreba Contul „il cunosti?" la prima navigare (`tacut=1`,
 *    cookie `newsletter_recunoscut`, cel mult o data pe ora) numai ca sa scrie numele omului in
 *    antet. In V2 sesiunea e a platformei si se citeste dintr-o data de la `IDENTITATE` — deci
 *    ocolul, cookie-ul si `cache-control: private, no-store` de pe toate paginile nu mai au rost;
 *  - carcasa (antet, subsol, tema) vine din `@xc/ui`, nu din `src/comun/` copiat in aplicatie.
 */
import { SESIUNE_ANONIMA, SCOPE_GLOBAL } from '@xc/contracts'
import { eAdminulAplicatiei } from '@xc/authorization'
import { principalDin, sesiuneCurenta, verificaCsrf } from '@xc/auth'
import { adresaPaginii, citesteConfig, navigatieDin, prefixSiCale } from '@xc/config'
import { Logger, correlationId } from '@xc/observability'
import { dataVersiunii, html, json } from '@xc/ui'
import pkg from '../package.json'
import { type Fisa, citesteLista, citesteNumarul, citesteTextele } from './depozit.js'
import { abonamentul, ruteazaAbonare } from '@xc/abonare'
import { ruteazaSetari } from '@xc/setari'
import { type Ctx, paginaAltele, paginaArhiva, paginaCarcasa, paginaCautare, paginaGoala, paginaMesaj, paginaNou, paginaNumar, rubricaSablon } from './pagini.js'
import { citesteSablon } from './sablon.js'

export interface Env {
  ARHIVA: R2Bucket
  IDENTITATE: Fetcher
  /** Venite pe 15.09.2026, odata cu pagina de Setari: cheile, abonarile si jurnalul. */
  AUTORIZARE: Fetcher
  COMUNICARE: Fetcher
  AUDIT: Fetcher
  MEDIU: string
  ORIGINE_PUBLICA: string
  DOMENIU_COOKIE: string
  EMAIL_SUPERADMIN: string
  /** Data publicarii, pentru subsol — binding-ul `version_metadata`. */
  VERSIUNE?: { timestamp?: string }
}

const SERVICIU = 'app-newsletter'
const CACHE_PAGINI = 'public, max-age=300'

/**
 * Audienta abonatilor — numele ei sta in registrul `ABONAMENTE` din `@xc/abonare`, nu aici.
 *
 * ⚠️ Randul newsletterului a intrat in registru la 15.09.2026, cerut anume de user („și aici avem
 * Abonare"), si e singurul care se abate de la regula „un rand = un serviciu de trimis": butonul
 * inscrie oameni de-adevaratelea in `newsletter-abonati`, dar A8 nu trimite inca nimic (vezi
 * lamurirea de sus). Cand va trimite, scrisoarea pleaca prin `communication-worker`, ca tot restul.
 */
const ABONAMENT = abonamentul('newsletter')

/** Jurnalul aplicatiei — abonarea si dezabonarea se scriu in el, ca la Calendar si la Buletin. */
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

    /*
     * ⚠️ ASOCIEREA articol ↔ număr E A NEWSLETTERULUI (user, 16.09.2026). Textele citite la chinonic
     * sunt ale Website-ului; numărul de buletin la care s-a citit fiecare e al nostru, fiindcă
     * numărul e al nostru. Website-ul îl CERE de aici (Service Binding `NEWSLETTER`) în loc să-l
     * copieze — structura mare: „ce ține de altă aplicație se cere, nu se copiază".
     * Fișierul e scris de `infrastructure/import/chinonic/asocieri.mjs`:
     *   [{ id, nr, trimis, texte: [slug, …] }, …]
     */
    if (cale === '/v1/chinonic/asocieri') {
      const obiect = await env.ARHIVA.get('chinonic/asocieri.json')
      if (!obiect) return json([], 200, { 'cache-control': 'public, max-age=300' })
      return new Response(obiect.body, {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600' },
      })
    }

    /*
     * ⚠️ POST-ul e primit DIN 15.09.2026, si numai pentru Setari: pana atunci newsletterul raspundea
     * 405 la orice in afara de GET/HEAD, fiindca n-avea ce scrie nimeni. Arhiva ramane neatinsa.
     */
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
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
    // Cine e omul — pana la Setari (15.09.2026) raspunsul se arunca, fiindca nu-l intreba nimeni.
    const principal = principalDin(sesiune)
    const ctx: Ctx = {
      prefix,
      nav,
      utilizator: sesiune.user?.displayName ?? sesiune.user?.email ?? null,
      // adresa contului, pentru fereastra de abonare: acolo se scrie in camp si se incuie, fiindca
      // abonarea platformei sta pe adresa contului, nu pe una scrisa de mana
      emailulContului: sesiune.user?.email ?? null,
      // ⚠️ Adminul NEWSLETTERULUI vine din cheia lui (`newsletter.manage`), nu din rolul global
      // (18.09.2026): asa poate fi cineva admin numai aici. De el atarna sageata spre `/nou` si
      // rubrica sablonului din Setari. Rolul global rămâne pentru randul „Administrare" din meniu.
      eAdmin: await eAdminulAplicatiei(env.AUTORIZARE, cid, principal, 'newsletter'),
      eAdminPlatforma: sesiune.roles.some((r) => r.role === 'admin' || r.role === 'super-admin'),
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

    // Bariera de origine a platformei, pentru singura metoda care scrie ceva.
    if (req.method === 'POST') {
      const problema = verificaCsrf(req, [cfg.ORIGINE_PUBLICA], cfg.MEDIU === 'dev')
      if (problema) return html(paginaCarcasa(ctx, { titluPagina: 'Verificare de securitate', corp: `<div class="cap"><h1 class="titlu-lista">Verificare de securitate</h1><p class="sursa">${problema}</p></div>` }), 403)
    }

    /*
     * ABONAREA — drumul intreg sta in `@xc/abonare`, acelasi pentru toata platforma (user,
     * 15.09.2026). Newsletterul da doar ce e al lui: randul din registru (audienta) si carcasa.
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

    // SETARILE — un singur loc, `@xc/setari` (user, 15.09.2026).
    const raspunsSetari = await ruteazaSetari(req, cale, env, {
      cod: 'newsletter',
      nume: 'Newsletterul',
      prefix,
      cfg,
      cid,
      principal,
      veziCa: ctx.veziCa,
      urlCont: nav.cont,
      urlTermeni: `${nav.home || ''}/termeni`,
      carcasa: (p) => paginaCarcasa(ctx, p),
      /*
       * ANTETUL SI SUBSOLUL buletinului — bucatile fixe, aratate la sfarsitul Setarilor (user,
       * 16.09.2026). Se cer din depozit DOAR cand chiar se scrie pagina, nu la fiecare cerere.
       * ⚠️ Numai adminii: bucatile astea intra in ce pleaca pe email catre toata parohia.
       */
      // ⚠️ `eAdminApp`, nu `eAdmin` (18.09.2026): sablonul e treaba NEWSLETTERULUI, deci atarna de
      // cheia lui, nu de cheia abonatilor, care e a platformei si vine cu rolul global.
      rubrici: async ({ eAdminApp }) =>
        eAdminApp ? rubricaSablon(await citesteSablon(env.ARHIVA), true) : '',
    })
    if (raspunsSetari) return raspunsSetari

    try {
      const lista = await citesteLista(env.ARHIVA)

      /*
       * BULETIN NOU — ecranul adaugarii manuale, tinta sagetii din pastila (user, 15.09.2026:
       * „săgeată pentru buletin nou (adăugare manuală - actualizare program sau altceva)").
       *
       * ⚠️ NUMAI ADMINII NEWSLETTERULUI. Poarta a fost ROLUL global pana pe 18.09.2026; de atunci e
       * CHEIA aplicatiei (`newsletter.manage`, din `ctx.eAdmin`), ca sa poata fi cineva administrator
       * numai aici. Pentru adminul global si super-admin nu s-a schimbat nimic: cheia vine cu rolul.
       * ⚠️ Pagina e personala (se vede altfel dupa rol si dupa masca „vezi ca"), deci NU se tine in
       * cache-ul de muchie, oricat ar fi mediul.
       */
      if (cale === '/nou') {
        const alLui = { 'cache-control': 'private, no-store' }
        if (!ctx.eAdmin) {
          return html(
            paginaMesaj(ctx, lista, 'Nu ai voie', '<p>Adăugarea unui buletin e a administratorilor.</p>'),
            403,
            alLui,
          )
        }
        return html(paginaNou(ctx, lista), 200, alLui)
      }

      if (cale === '/cauta') {
        const intrebare = (url.searchParams.get('q') ?? '').trim()
        if (!intrebare) return html(paginaCautare(ctx, lista, '', null, 'gol'), 200, cachePagina)
        const cuvinte = plat(intrebare).split(/\s+/).filter((x) => x.length > 1)
        if (!cuvinte.length) return html(paginaCautare(ctx, lista, intrebare, null, 'scurt'), 200, cachePagina)
        const gasite = await cauta(env, lista, cuvinte)
        return html(paginaCautare(ctx, lista, intrebare, gasite, null), 200, cachePagina)
      }

      /*
       * ALTELE — trimiterile fara numar (actualizari de program, anunturi), scoase din listele
       * anilor la 16.09.2026, cerute de user. ⚠️ Se incearca INAINTEA rutei anilor: aceea prinde doar
       * patru cifre, dar daca vreodata se largeste, `/arhiva/altele` ar cadea in ea.
       */
      if (/^\/arhiva\/altele\/?$/.test(cale)) return html(paginaAltele(ctx, lista), 200, cachePagina)

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
