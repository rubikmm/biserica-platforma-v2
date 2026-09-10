/**
 * Hârtiile platformei: PDF, JPG și PNG făcute prin Cloudflare Browser Rendering, plus cache-ul lor.
 *
 * Bucata asta n-a fost scrisă aici — a stat până la 10.09.2026 în `apps/program/src/foaie.ts`, unde
 * se născuse pentru foaia A4 de pe ușă. A urcat în pachetul comun când calendarul a avut și el nevoie
 * de o poză (poza săptămânii), ca să nu se ajungă la tiparul V1, unde codul comun se copia de la o
 * aplicație la alta. Aici nu se știe nimic despre program sau calendar: intră HTML, ies octeți.
 */
import puppeteer, { type Browser } from '@cloudflare/puppeteer'

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
 * PNG dintr-o pagină de lungime necunoscută: se fotografiază elementul `.poza` dacă există, altfel
 * toată pagina (`fullPage`). Lățimea se dă din afară — poza săptămânii e citită pe telefon, deci se
 * randează îngustă și la doi pixeli pe punct, ca scrisul să rămână curat.
 */
export async function pngDin(legatura: Fetcher, html: string, latime = 900): Promise<ArrayBuffer> {
  return cuBrowser(legatura, async (browser) => {
    const page = await incarca(browser, html)
    await page.setViewport({ width: latime, height: 1400, deviceScaleFactor: 2 })
    const el = await page.$('.poza')
    const poza = el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png', fullPage: true })
    await page.close()
    return new Uint8Array(poza).buffer as ArrayBuffer
  })
}

/** Amprenta HTML-ului: cheia din cache a hartiei; orice schimbare de date sau asezare da alt fisier. */
export async function amprenta(html: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(html))
  return [...new Uint8Array(h)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const TIPURI = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png' } as const

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
