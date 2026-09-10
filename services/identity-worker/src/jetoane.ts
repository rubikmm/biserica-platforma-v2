/**
 * Jetoane opace. Regula: valoarea in clar exista doar in drumul spre utilizator (cookie sau link);
 * in baza de date se pastreaza exclusiv hash-ul SHA-256. O scurgere a bazei nu da sesiuni.
 */

const LUNGIME = 32

export function jetonNou(): string {
  const octeti = crypto.getRandomValues(new Uint8Array(LUNGIME))
  let binar = ''
  for (const octet of octeti) binar += String.fromCharCode(octet)
  return btoa(binar).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export async function hashJeton(jeton: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jeton))
  return [...new Uint8Array(digest)].map((o) => o.toString(16).padStart(2, '0')).join('')
}

export function peste(secunde: number): string {
  return new Date(Date.now() + secunde * 1000).toISOString()
}

export function aExpirat(momentISO: string): boolean {
  return new Date(momentISO).getTime() <= Date.now()
}

/** Cat traiesc jetoanele. Sesiunea e scurta pentru ca al doilea factor se cere oricum la fiecare login. */
export const DURATA_SESIUNE_SEC = 12 * 60 * 60
export const DURATA_CHALLENGE_SEC = 15 * 60
export const DURATA_VERIFICARE_EMAIL_SEC = 24 * 60 * 60
