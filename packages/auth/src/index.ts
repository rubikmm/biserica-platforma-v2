import { SESIUNE_ANONIMA, SesiuneCurenta, type Principal } from '@xc/contracts'

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
 * Principalul pentru autorizare, din sesiunea curenta. Sta AICI, o data, si nu in fiecare
 * aplicatie: masca „vezi ca" trebuie sa ajunga la serviciul de politici la fiecare intrebare,
 * iar o aplicatie care si-l scrie singur ar putea s-o uite si ar da drepturi peste masca.
 */
export function principalDin(sesiune: SesiuneCurenta): Principal | null {
  if (!sesiune.authenticated || !sesiune.user) return null
  return {
    userId: sesiune.user.id,
    email: sesiune.user.email,
    ...(sesiune.veziCa ? { veziCa: sesiune.veziCa } : {}),
  }
}

/**
 * Verificare CSRF pentru orice metoda care schimba date. Doua bariere independente:
 * originea cererii si tokenul din formular pereche cu cookie-ul.
 *
 * Adresele permise se taie la ORIGINE inainte de comparatie. Antetul `Origin` e intotdeauna
 * numai `schema://gazda:port`, pe cand `ORIGINE_PUBLICA` poarta in dev si prefixul gateway-ului
 * (`https://rubik:8474/cont`) — comparate ca siruri, cele doua nu se potrivesc niciodata si
 * fiecare POST local ajungea respins.
 */
export function verificaCsrf(req: Request, adresePermise: string[], eDev = false): string | null {
  const metoda = req.method.toUpperCase()
  if (metoda === 'GET' || metoda === 'HEAD' || metoda === 'OPTIONS') return null

  const origine = req.headers.get('origin')
  if (!origine) return 'lipseste antetul Origin'

  // In dev containerul se deschide de pe mai multe nume (rubik, IP-ul NAS-ului, alt nume de casa),
  // iar `ORIGINE_PUBLICA` e scrisa cu unul singur: orice POST de pe celelalte cadea aici cu
  // „origine neacceptata" si intrarea locala parea stricata (pătit de user, 11.09.2026). Lista
  // alba se lasa deoparte DOAR in dev — paza adevarata, tokenul CSRF pereche cu cookie-ul, se
  // verifica oricum la fiecare ruta care schimba date (`verificaTokenCsrf`).
  if (eDev) return null

  const permise = new Set(
    adresePermise.map((a) => {
      try {
        return new URL(a).origin
      } catch {
        return a
      }
    }),
  )
  if (!permise.has(origine)) return 'origine neacceptata'

  return null
}

/** Cat tine un jeton CSRF: patru ore, cat o sedinta lunga de lucru. */
export const DURATA_CSRF_SEC = 60 * 60 * 4

export function jetonCsrfNou(): string {
  const octeti = crypto.getRandomValues(new Uint8Array(24))
  let binar = ''
  for (const octet of octeti) binar += String.fromCharCode(octet)
  return btoa(binar).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

/**
 * Jetonul de pus in formular: cel din cookie, daca e, altfel unul nou (si cookie-ul care-l
 * insoteste). A stat pana pe 11.09.2026 in `apps/account`; a urcat aici cand a doua aplicatie
 * (panoul de module din `admin`) a avut nevoie de un formular — se copia altfel a doua oara.
 */
export function asiguraCsrf(req: Request, domeniu: string): { jeton: string; setCookie?: string } {
  const existent = citesteCookie(req, NUME_COOKIE_CSRF)
  if (existent) return { jeton: existent }
  const jeton = jetonCsrfNou()
  return {
    jeton,
    setCookie: construiesteCookie(NUME_COOKIE_CSRF, jeton, { maxAge: DURATA_CSRF_SEC, domeniu }),
  }
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
