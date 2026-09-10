import { SESIUNE_ANONIMA, SesiuneCurenta } from '@xc/contracts'

export const NUME_COOKIE_SESIUNE = 'xc_sesiune'
export const NUME_COOKIE_CSRF = 'xc_csrf'

/**
 * Clientul pe care il folosesc APLICATIILE (BFF-uri) ca sa afle cine e pe sesiune.
 * Browserul nu vorbeste niciodata direct cu identity-worker: aplicatia ia cookie-ul din
 * cererea ei si intreaba serviciul intern prin Service Binding.
 */
export interface ServiciuIdentitate {
  fetch: typeof fetch
}

export function citesteCookie(req: Request, nume: string): string | null {
  const brut = req.headers.get('cookie')
  if (!brut) return null
  for (const parte of brut.split(';')) {
    const [cheie, ...rest] = parte.trim().split('=')
    if (cheie === nume) return decodeURIComponent(rest.join('='))
  }
  return null
}

export async function sesiuneCurenta(
  identitate: ServiciuIdentitate,
  req: Request,
): Promise<SesiuneCurenta> {
  const token = citesteCookie(req, NUME_COOKIE_SESIUNE)
  if (!token) return SESIUNE_ANONIMA

  const raspuns = await identitate.fetch('https://identity.intern/sesiune', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  })

  if (!raspuns.ok) return SESIUNE_ANONIMA
  const date = await raspuns.json()
  const parsat = SesiuneCurenta.safeParse(date)
  return parsat.success ? parsat.data : SESIUNE_ANONIMA
}

/**
 * Verificare CSRF pentru orice metoda care schimba date. Doua bariere independente:
 * originea cererii si tokenul din formular pereche cu cookie-ul.
 */
export function verificaCsrf(req: Request, originiPermise: string[]): string | null {
  const metoda = req.method.toUpperCase()
  if (metoda === 'GET' || metoda === 'HEAD' || metoda === 'OPTIONS') return null

  const origine = req.headers.get('origin')
  if (!origine) return 'lipseste antetul Origin'
  if (!originiPermise.includes(origine)) return 'origine neacceptata'

  return null
}

export function verificaTokenCsrf(req: Request, tokenDinFormular: string | null): string | null {
  const dinCookie = citesteCookie(req, NUME_COOKIE_CSRF)
  if (!dinCookie || !tokenDinFormular) return 'token CSRF lipsa'
  if (!egaleInTimpConstant(dinCookie, tokenDinFormular)) return 'token CSRF nepotrivit'
  return null
}

/** Comparatie fara scurtcircuit, ca durata sa nu spuna nimic despre continut. */
export function egaleInTimpConstant(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diferenta = 0
  for (let i = 0; i < a.length; i++) {
    diferenta |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diferenta === 0
}

export function construiesteCookie(
  nume: string,
  valoare: string,
  optiuni: { maxAge: number; domeniu: string; httpOnly?: boolean },
): string {
  const parti = [
    `${nume}=${encodeURIComponent(valoare)}`,
    'Path=/',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${optiuni.maxAge}`,
  ]
  if (optiuni.httpOnly !== false) parti.push('HttpOnly')
  // Hostname-urile fara punct (ex. `rubik`) nu accepta atribut Domain — cookie host-only.
  if (optiuni.domeniu && optiuni.domeniu.includes('.')) parti.push(`Domain=${optiuni.domeniu}`)
  return parti.join('; ')
}

export function cookieSters(nume: string, domeniu: string): string {
  const parti = [`${nume}=`, 'Path=/', 'Secure', 'SameSite=Lax', 'Max-Age=0', 'HttpOnly']
  if (domeniu && domeniu.includes('.')) parti.push(`Domain=${domeniu}`)
  return parti.join('; ')
}
