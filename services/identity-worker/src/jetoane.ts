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

/**
 * Codul de intrare: sase cifre, luate din generatorul criptografic, nu din `Math.random`.
 * Modulo 10 pe octeti ar inclina cifrele (256 nu se imparte la 10) — de aceea octetii peste
 * 249 se arunca si se cere altul. La un milion de coduri, ghicirea are sens doar cu multe
 * incercari; de asta exista `INCERCARI_COD`.
 */
export function codDeSaseCifre(): string {
  let cod = ''
  while (cod.length < 6) {
    for (const octet of crypto.getRandomValues(new Uint8Array(8))) {
      if (octet >= 250) continue
      cod += (octet % 10).toString()
      if (cod.length === 6) break
    }
  }
  return cod
}

/**
 * Amprenta codului. Se hashuieste `email:cod`, nu codul singur: altfel un tabel de un milion
 * de hash-uri ar sparge orice cod din baza dintr-o privire.
 */
export async function hashCod(email: string, cod: string): Promise<string> {
  return hashJeton(`${email}:${cod}`)
}

/**
 * Cat traiesc jetoanele. Fara parola, singurul gest de intrare e codul de pe email; de aceea
 * sesiunea e lunga (30 de zile) — omul nu trebuie sa-si deschida emailul la fiecare vizita.
 * Revocarea centrala („inchide toate sesiunile") ramane la o apasare distanta.
 */
export const DURATA_SESIUNE_SEC = 30 * 24 * 60 * 60

/** Zece minute, ca in V1: destul cat sa ajunga scrisoarea, putin cat sa nu stea codul viu. */
export const DURATA_COD_SEC = 10 * 60

/** Greseli permise la acelasi cod, ca in V1. A sasea il stinge; se cere altul. */
export const INCERCARI_COD = 5
