/**
 * Bucatile de HTTP ale aplicatiei. `esc`, `html` si `json` vin din carcasa (`@xc/ui`) — aici a
 * ramas numai ce nu e acolo: citirea unui POST ca `$_POST`, raspunsurile cu cookie-uri si
 * normalizarea unui telefon la wa.me.
 */

export const FARA_STOC: Record<string, string> = {
  'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
  pragma: 'no-cache',
  expires: '0',
}

/** HTML cu cookie-uri (carcasa da `html()` fara ele). */
export function htmlCuCookie(corp: string, status = 200, cookies: string[] = [], antete: Record<string, string> = {}): Response {
  const h = new Headers({
    'content-type': 'text/html; charset=utf-8',
    'referrer-policy': 'same-origin',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    ...FARA_STOC,
    ...antete,
  })
  for (const c of cookies) h.append('set-cookie', c)
  return new Response(corp, { status, headers: h })
}

export function jsonCuCookie(date: unknown, status = 200, cookies: string[] = []): Response {
  const h = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  for (const c of cookies) h.append('set-cookie', c)
  return new Response(JSON.stringify(date), { status, headers: h })
}

/** 303, ca reincarcarea paginii de dupa un POST sa nu retrimita formularul. */
export function duTe(spre: string, cookies: string[] = [], status = 303): Response {
  const h = new Headers({ location: spre, ...FARA_STOC })
  for (const c of cookies) h.append('set-cookie', c)
  return new Response(null, { status, headers: h })
}

export function text(corp: string, status = 200): Response {
  return new Response(corp, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
}

/** Citeste corpul unui POST (form-urlencoded sau multipart) ca `$_POST`. */
export async function citestePost(request: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const ct = request.headers.get('content-type') ?? ''
  if (!/multipart\/form-data|application\/x-www-form-urlencoded/i.test(ct)) return out
  try {
    const fd = await request.formData()
    for (const [k, v] of fd.entries()) {
      if (typeof v === 'string') out[k] = v
    }
  } catch {
    /* corp gol sau stricat */
  }
  return out
}

export function eAjax(request: Request): boolean {
  return (request.headers.get('x-requested-with') ?? '').toLowerCase() === 'xmlhttprequest'
}

/** Normalizeaza un telefon la wa.me (prefix 0 → 40), ca in V1. */
export function waLinkDin(telefon: string | null | undefined): string | null {
  const p = String(telefon ?? '').replace(/[^0-9+]/g, '')
  if (p === '') return null
  let wa: string
  if (p.startsWith('+')) wa = p.slice(1)
  else if (p.startsWith('0')) wa = '40' + p.slice(1)
  else wa = p
  return 'https://wa.me/' + wa
}
