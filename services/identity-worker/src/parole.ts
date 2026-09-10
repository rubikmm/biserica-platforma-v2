/**
 * Hashuire de parole cu PBKDF2-HMAC-SHA256, singura functie de derivare disponibila nativ in
 * Workers (bcrypt/scrypt/argon2 ar cere WASM). Parametrii sunt scrisi in hash, ca sa putem
 * creste iteratiile mai tarziu fara sa invalidam parolele vechi.
 */

const ITERATII = 210_000
const LUNGIME_SARE = 16
const LUNGIME_CHEIE = 32

function base64url(octeti: Uint8Array): string {
  let binar = ''
  for (const octet of octeti) binar += String.fromCharCode(octet)
  return btoa(binar).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function dinBase64url(text: string): Uint8Array {
  const normalizat = text.replaceAll('-', '+').replaceAll('_', '/')
  const umplut = normalizat + '='.repeat((4 - (normalizat.length % 4)) % 4)
  const binar = atob(umplut)
  const octeti = new Uint8Array(binar.length)
  for (let i = 0; i < binar.length; i++) octeti[i] = binar.charCodeAt(i)
  return octeti
}

async function deriva(
  parola: string,
  sare: Uint8Array,
  iteratii: number,
): Promise<Uint8Array> {
  const cheieBruta = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(parola),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const biti = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: sare as BufferSource, iterations: iteratii, hash: 'SHA-256' },
    cheieBruta,
    LUNGIME_CHEIE * 8,
  )
  return new Uint8Array(biti)
}

/** Format: `pbkdf2$<iteratii>$<sare-b64url>$<cheie-b64url>`. */
export async function hashParola(parola: string): Promise<string> {
  const sare = crypto.getRandomValues(new Uint8Array(LUNGIME_SARE))
  const cheie = await deriva(parola, sare, ITERATII)
  return `pbkdf2$${ITERATII}$${base64url(sare)}$${base64url(cheie)}`
}

function egale(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diferenta = 0
  for (let i = 0; i < a.length; i++) diferenta |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diferenta === 0
}

export async function verificaParola(parola: string, stocat: string): Promise<boolean> {
  const parti = stocat.split('$')
  if (parti.length !== 4 || parti[0] !== 'pbkdf2') return false
  const iteratii = Number(parti[1])
  if (!Number.isInteger(iteratii) || iteratii < 1000) return false

  try {
    const sare = dinBase64url(parti[2] ?? '')
    const asteptat = dinBase64url(parti[3] ?? '')
    const calculat = await deriva(parola, sare, iteratii)
    return egale(calculat, asteptat)
  } catch {
    return false
  }
}

/**
 * Cost fals, pentru cazul „emailul nu exista". Fara el, un login pe un email inexistent
 * raspunde vizibil mai repede decat unul pe un email real — si asta enumera utilizatorii.
 */
export async function consumaTimpDegeaba(): Promise<void> {
  await deriva('parola-inexistenta', new Uint8Array(LUNGIME_SARE), ITERATII)
}
