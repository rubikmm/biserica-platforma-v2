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
  return sesiuneDupaJeton(identitate, token)
}

/**
 * Aceeasi intrebare, dar cu jetonul in mana, nu in cookie: dupa ce o aplicatie deschide ea insasi
 * o sesiune (abonarea cu cont, `@xc/abonare`), cookie-ul abia urmeaza sa plece spre browser, deci
 * `sesiuneCurenta` n-ar avea ce citi din cererea de acum. Fara asta, aplicatia ar sti ca omul a
 * intrat, dar nu si CINE e — iar abonarea are nevoie de `userId` si de adresa lui.
 */
export async function sesiuneDupaJeton(
  identitate: ServiciuIdentitate,
  token: string,
): Promise<SesiuneCurenta> {
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
 * CELE DOUA VERBE ALE INTRARII FARA PAROLA, scrise o data pentru toata platforma.
 *
 * Pana la 15.09.2026 le stia numai aplicatia `cont`, care le chema de mana; de cand abonarea
 * deschide si ea cont (vezi `@xc/abonare`), drumul ar fi fost copiat a doua oara — si cu el
 * forma corpului, numele campurilor si felul in care se citesc erorile. Aici sunt o data.
 *
 * ⚠️ Nu fac nicio judecata: `/intrare` trimite codul ORICUI cere (identitatea are limitele ei
 * de incercari), iar `/confirma-cod` doar spune daca cele sase cifre sunt bune. Cine deschide
 * sesiunea si ce face cu ea mai departe ramane treaba celui care le cheama.
 */
export async function cereCodDeIntrare(
  identitate: ServiciuIdentitate,
  o: { email: string; ip: string; displayName?: string | null; correlationId?: string },
): Promise<{ status: number; debugCod: string | null }> {
  const raspuns = await identitate.fetch('https://identity.intern/intrare', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(o.correlationId ? { 'x-correlation-id': o.correlationId } : {}) },
    body: JSON.stringify({ email: o.email, ip: o.ip, ...(o.displayName ? { displayName: o.displayName } : {}) }),
  })
  const date = (await raspuns.json().catch(() => ({}))) as { debugCod?: string | null }
  return { status: raspuns.status, debugCod: date.debugCod ?? null }
}

export type RaspunsCod =
  | { ok: true; sessionToken: string; maxAge: number; contNou: boolean }
  | { ok: false; motiv: string | null; ramase: number | null }

export async function confirmaCodul(
  identitate: ServiciuIdentitate,
  o: { email: string; cod: string; ip: string; userAgent: string; correlationId?: string },
): Promise<RaspunsCod> {
  const raspuns = await identitate.fetch('https://identity.intern/confirma-cod', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(o.correlationId ? { 'x-correlation-id': o.correlationId } : {}) },
    body: JSON.stringify({ email: o.email, cod: o.cod, ip: o.ip, userAgent: o.userAgent }),
  })
  const date = (await raspuns.json().catch(() => ({}))) as Record<string, unknown>
  if (!raspuns.ok || date.ok !== true) {
    return {
      ok: false,
      motiv: typeof date.motiv === 'string' ? date.motiv : null,
      ramase: typeof date.ramase === 'number' ? date.ramase : null,
    }
  }
  return {
    ok: true,
    sessionToken: String(date.sessionToken),
    maxAge: Number(date.maxAge),
    contNou: date.contNou === true,
  }
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
