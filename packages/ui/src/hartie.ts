/**
 * Hârtiile platformei: PDF, JPG și PNG făcute prin Cloudflare Browser Rendering, plus cache-ul lor.
 *
 * Bucata asta n-a fost scrisă aici — a stat până la 10.09.2026 în `apps/program/src/foaie.ts`, unde
 * se născuse pentru foaia A4 de pe ușă. A urcat în pachetul comun când calendarul a avut și el nevoie
 * de o poză (poza săptămânii), ca să nu se ajungă la tiparul V1, unde codul comun se copia de la o
 * aplicație la alta. Aici nu se știe nimic despre program sau calendar: intră HTML, ies octeți.
 */
import puppeteer, { type Browser } from '@cloudflare/puppeteer'
import type { Obiect } from '@xc/contracts'

/**
 * O sesiune de browser, cu reîncercări. Browser Rendering ține un număr mic de sesiuni deodată și
 * răspunde cu 429 când sunt toate luate: se așteaptă și se încearcă din nou, de trei ori. Dacă e una
 * liberă (fără conexiune), se refolosește — pornirea unui browser nou e partea scumpă.
 */
async function cuBrowser<T>(legatura: Fetcher, fn: (browser: Browser) => Promise<T>): Promise<T> {
  let browser: Browser | null = null
  let ultimaEroare: unknown
  for (let incercare = 0; incercare < 3; incercare++) {
    try {
      const sesiuni = await puppeteer.sessions(legatura as never).catch(() => [])
      const libera = sesiuni.find((s) => !s.connectionId)
      browser = libera ? await puppeteer.connect(legatura as never, libera.sessionId) : await puppeteer.launch(legatura as never, { keep_alive: 20000 })
      const rezultat = await fn(browser)
      browser.disconnect()
      return rezultat
    } catch (e) {
      ultimaEroare = e
      try {
        browser?.disconnect()
      } catch {
        // nimic
      }
      const mesaj = e instanceof Error ? e.message : String(e)
      if (!/429|rate limit|limit/i.test(mesaj) || incercare === 2) throw e
      await new Promise((r) => setTimeout(r, 3000 * (incercare + 1)))
    }
  }
  throw ultimaEroare
}

async function incarca(browser: Browser, html: string) {
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'load', timeout: 20000 })
  if (html.includes('data-potrivire')) {
    // Expresia se evalueaza in browser, nu in worker — de aceea e sir, nu functie.
    await page.waitForFunction("document.documentElement.getAttribute('data-potrivit') === 'da'", { timeout: 8000 }).catch(() => undefined)
  }
  return page
}

export async function pdfDin(legatura: Fetcher, html: string): Promise<ArrayBuffer> {
  return cuBrowser(legatura, async (browser) => {
    const page = await incarca(browser, html)
    const pdf = await page.pdf({ format: 'a4', printBackground: true, preferCSSPageSize: true, timeout: 20000 })
    await page.close()
    return new Uint8Array(pdf).buffer as ArrayBuffer
  })
}

/**
 * PDF-ul și, pe lângă el, ce a avut de spus pagina despre ea însăși (`data-raport`).
 *
 * Cine își așază singur textul în cutii — foaia buletinului — e singurul care ȘTIE, la sfârșitul
 * curgerii, cât a intrat și cât a rămas pe dinafară. Cifra aceea trebuie să iasă din browser
 * odată cu hârtia: altfel am tipări un număr din care lipsește un paragraf și n-am afla decât de
 * la om. Raportul e JSON scris de pagină; ce nu se poate citi se întoarce ca `undefined`, nu ca
 * eroare — hârtia rămâne bună chiar dacă raportul lipsește.
 */
export async function pdfCuRaport<T = unknown>(legatura: Fetcher, html: string): Promise<{ pdf: ArrayBuffer; raport?: T }> {
  return cuBrowser(legatura, async (browser) => {
    const page = await incarca(browser, html)
    const pdf = await page.pdf({ format: 'a4', printBackground: true, preferCSSPageSize: true, timeout: 20000 })
    const scris = await page
      .evaluate("document.documentElement.getAttribute('data-raport')")
      .catch(() => null)
    await page.close()
    let raport: T | undefined
    try {
      raport = typeof scris === 'string' ? (JSON.parse(scris) as T) : undefined
    } catch {
      raport = undefined
    }
    return { pdf: new Uint8Array(pdf).buffer as ArrayBuffer, raport }
  })
}

/**
 * PDF-ul, raportul ȘI COPERTA — pagina întâi fotografiată —, dintr-o SINGURĂ sesiune de browser.
 *
 * De ce împreună: coperta se cere exact atunci când se face foaia (buletinul o arată pe ecran înainte
 * de validare și o duce mai departe în arhivă), iar o a doua sesiune ar însemna încă o pornire de
 * browser și încă o încărcare a aceluiași HTML — partea scumpă, de câteva secunde. Poza se ia DUPĂ
 * PDF, ca schimbarea de fereastră să nu atingă hârtia.
 *
 * Coperta e elementul `.pagina` (prima foaie A4), la doi pixeli pe punct. Dacă nu se poate face, se
 * întoarce `undefined`: hârtia rămâne bună și fără poză.
 */
export async function pdfCuRaportSiCoperta<T = unknown>(
  legatura: Fetcher,
  html: string,
): Promise<{ pdf: ArrayBuffer; raport?: T; coperta?: ArrayBuffer }> {
  return cuBrowser(legatura, async (browser) => {
    const page = await incarca(browser, html)
    const pdf = await page.pdf({ format: 'a4', printBackground: true, preferCSSPageSize: true, timeout: 20000 })
    const scris = await page
      .evaluate("document.documentElement.getAttribute('data-raport')")
      .catch(() => null)
    let coperta: ArrayBuffer | undefined
    try {
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 })
      const el = await page.$('.pagina')
      if (el) coperta = new Uint8Array(await el.screenshot({ type: 'jpeg', quality: 88 })).buffer as ArrayBuffer
    } catch {
      coperta = undefined
    }
    await page.close()
    let raport: T | undefined
    try {
      raport = typeof scris === 'string' ? (JSON.parse(scris) as T) : undefined
    } catch {
      raport = undefined
    }
    return { pdf: new Uint8Array(pdf).buffer as ArrayBuffer, raport, coperta }
  })
}

export async function jpgDin(legatura: Fetcher, html: string): Promise<ArrayBuffer> {
  return cuBrowser(legatura, async (browser) => {
    const page = await incarca(browser, html)
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 })
    const el = await page.$('.pagina')
    const poza = el ? await el.screenshot({ type: 'jpeg', quality: 90 }) : await page.screenshot({ type: 'jpeg', quality: 90 })
    await page.close()
    return new Uint8Array(poza).buffer as ArrayBuffer
  })
}

/**
 * Poza unei pagini de lungime NEȘTIUTĂ: se fotografiază elementul `.poza` dacă există, altfel toată
 * pagina (`fullPage`). Lățimea se dă din afară — poza săptămânii e citită pe telefon, deci se
 * randează îngustă și la doi pixeli pe punct, ca scrisul să rămână curat.
 *
 * Deosebirea față de `jpgDin`: acolo se fotografiază foaia A4 (`.pagina`), a cărei înălțime e știută
 * dinainte; aici pagina e lungă cât o fac datele.
 */
async function pozaDin(legatura: Fetcher, html: string, tip: 'png' | 'jpeg', latime: number): Promise<ArrayBuffer> {
  return cuBrowser(legatura, async (browser) => {
    const page = await incarca(browser, html)
    await page.setViewport({ width: latime, height: 1400, deviceScaleFactor: 2 })
    const el = await page.$('.poza')
    const poza = tip === 'jpeg'
      ? el
        ? await el.screenshot({ type: 'jpeg', quality: 90 })
        : await page.screenshot({ type: 'jpeg', quality: 90, fullPage: true })
      : el
        ? await el.screenshot({ type: 'png' })
        : await page.screenshot({ type: 'png', fullPage: true })
    await page.close()
    return new Uint8Array(poza).buffer as ArrayBuffer
  })
}

/** Poza paginii în PNG — poza săptămânii din calendar. */
export function pngDin(legatura: Fetcher, html: string, latime = 900): Promise<ArrayBuffer> {
  return pozaDin(legatura, html, 'png', latime)
}

/**
 * Aceeași poză, în JPEG — pentru ce pleacă pe WhatsApp: la o pagină lungă, cu mult scris, JPEG-ul
 * iese de câteva ori mai mic decât PNG-ul, iar pierderea nu se vede la text negru pe fundal plin.
 */
export function jpgPozaDin(legatura: Fetcher, html: string, latime = 900): Promise<ArrayBuffer> {
  return pozaDin(legatura, html, 'jpeg', latime)
}

/** Amprenta HTML-ului: cheia din cache a hartiei; orice schimbare de date sau asezare da alt fisier. */
export async function amprenta(html: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(html))
  return [...new Uint8Array(h)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const TIPURI = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png', json: 'application/json; charset=utf-8', txt: 'text/plain; charset=utf-8' } as const

/**
 * Hartia din Cache API sau proaspat facuta. Cheia = adresa + amprenta HTML-ului, deci un fisier
 * vechi nu e servit niciodata pentru date noi; expira singur.
 */
export async function hartieDinCache(
  req: Request,
  ctx: ExecutionContext,
  html: string,
  fel: keyof typeof TIPURI,
  numeFisier: string,
  fabrica: () => Promise<ArrayBuffer>,
): Promise<Response> {
  const amp = await amprenta(html)
  const url = new URL(req.url)
  const cheie = new Request(`${url.origin}${url.pathname}?v=${amp}`, { method: 'GET' })
  const cache = caches.default
  const gasit = await cache.match(cheie)
  const antete = {
    'content-type': TIPURI[fel],
    'content-disposition': `inline; filename="${numeFisier}.${fel}"`,
    'cache-control': 'public, max-age=3600',
    'access-control-allow-origin': '*',
    etag: `"${amp}"`,
  }
  if (gasit) return new Response(gasit.body, { status: 200, headers: antete })
  const octeti = await fabrica()
  const raspuns = new Response(octeti, { status: 200, headers: { ...antete, 'cache-control': 'public, max-age=2592000' } })
  ctx.waitUntil(cache.put(cheie, raspuns.clone()))
  return new Response(octeti, { status: 200, headers: antete })
}

// ---------------------------------------------------------------------------
// Hârtia ca OBIECT care circulă
// ---------------------------------------------------------------------------

/**
 * Aceeași hârtie ca mai sus, dar așezată în `media-worker` și întoarsă ca `Obiect` — forma cu care
 * circulă prin platformă: chatul o arată ca un card, comunicarea o atașează la o scrisoare, o
 * automatizare o trimite la o audiență. **Între ele trece doar cheia**, niciodată octeții.
 *
 * Cheia poartă amprenta conținutului, deci:
 * - aceeași foaie cerută de zece ori se face o singură dată (a doua oară o găsește în media);
 * - o corectură în calendar schimbă HTML-ul, deci amprenta, deci cheia — hârtia se reface singură
 *   și nimeni nu trimite mai departe o versiune veche.
 *
 * Deosebirea față de `hartieDinCache`: acolo hârtia e un RĂSPUNS către browser (Cache API, expiră);
 * aici e un FIȘIER cu adresă stabilă, pe care îl poate cere altcineva, mai târziu.
 */
export async function obiectDinHtml(o: {
  media: Fetcher
  browser: Fetcher
  html: string
  fel: 'pdf' | 'jpg' | 'png'
  /** Calea în media, FĂRĂ amprentă și fără extensie: `program/sfintii/2026-09-13`. */
  cale: string
  /** Numele fișierului văzut de om, fără extensie: `sfintii-zilei-2026-09-13`. */
  nume: string
  /** Cum se numește în vorbe: „Sfinții zilei — duminică, 13 septembrie". */
  titlu: string
  /** Doar pentru poze; PDF-ul merge pe A4. */
  latime?: number
}): Promise<Obiect> {
  const amp = await amprenta(o.html)
  const cheie = `${o.cale}-${amp}.${o.fel}`
  const nume = `${o.nume}.${o.fel}`

  const gasit = await octetiiDinMedia(o.media, cheie)
  if (gasit !== null) {
    return { fel: o.fel, nume, titlu: o.titlu, cheie, amprenta: amp, octeti: gasit }
  }

  const octeti =
    o.fel === 'pdf' ? await pdfDin(o.browser, o.html)
    : o.fel === 'jpg' ? await jpgPozaDin(o.browser, o.html, o.latime ?? 900)
    : await pngDin(o.browser, o.html, o.latime ?? 900)

  const urcat = await o.media.fetch('https://media.intern/incarca', {
    method: 'POST',
    headers: {
      'x-meta': JSON.stringify({ key: cheie, contentType: TIPURI[o.fel] }),
      'content-type': 'application/octet-stream',
    },
    body: octeti,
  })
  if (!urcat.ok) throw new Error(`hârtia nu s-a putut așeza în media: ${urcat.status}`)

  return { fel: o.fel, nume, titlu: o.titlu, cheie, amprenta: amp, octeti: octeti.byteLength }
}

/** Câți octeți are fișierul, sau `null` dacă nu e acolo. Nu descarcă nimic — `head` pe R2. */
async function octetiiDinMedia(media: Fetcher, cheie: string): Promise<number | null> {
  try {
    const r = await media.fetch(`https://media.intern/info/${encodeURIComponent(cheie)}`)
    if (!r.ok) return null
    const j = (await r.json()) as { exista?: boolean; octeti?: number }
    return j.exista ? (j.octeti ?? 0) : null
  } catch {
    return null
  }
}

/** Adresa publică a unui obiect, pentru cardul din chat sau linkul dintr-o scrisoare. */
export function adresaObiectului(urlMedia: string, cheie: string): string {
  return `${urlMedia.replace(/\/$/, '')}/fisier/${cheie.split('/').map(encodeURIComponent).join('/')}`
}

// ---------------------------------------------------------------------------
// Obiectul din TEXT (arhiva ca JSON, un text de trimis)
// ---------------------------------------------------------------------------

/**
 * Ca `obiectDinHtml`, dar pentru ce nu trece prin browser: un JSON (arhiva programului) sau un
 * text. Aceeași cheie cu amprentă, aceeași așezare în media, aceeași regulă — mai departe circulă
 * doar cheia.
 */
export async function obiectDinText(o: {
  media: Fetcher
  text: string
  fel: 'json' | 'txt'
  cale: string
  nume: string
  titlu: string
}): Promise<Obiect> {
  const amp = await amprenta(o.text)
  const cheie = `${o.cale}-${amp}.${o.fel}`
  const nume = `${o.nume}.${o.fel}`
  const octeti = new TextEncoder().encode(o.text)

  const gasit = await octetiiDinMedia(o.media, cheie)
  if (gasit !== null) return { fel: o.fel, nume, titlu: o.titlu, cheie, amprenta: amp, octeti: gasit }

  const urcat = await o.media.fetch('https://media.intern/incarca', {
    method: 'POST',
    headers: { 'x-meta': JSON.stringify({ key: cheie, contentType: TIPURI[o.fel] }), 'content-type': 'application/octet-stream' },
    body: octeti,
  })
  if (!urcat.ok) throw new Error(`obiectul nu s-a putut așeza în media: ${urcat.status}`)
  return { fel: o.fel, nume, titlu: o.titlu, cheie, amprenta: amp, octeti: octeti.byteLength }
}
