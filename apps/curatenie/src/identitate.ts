/**
 * Cine e omul, la curatenie. Doua usi, si numai una dintre ele deschide ceva:
 *
 *  1. **CONTUL PLATFORMEI** — sesiunea centrala, ca la orice aplicatie V2. Cine e voluntar se vede
 *     din ASOCIEREA `curatenie` a contului (vezi `oameni.ts`), iar cine administreaza — din
 *     `cleaning.manage`. Asta e singura identitate adevarata a aplicatiei.
 *  2. **FANTOMA** — omul NEintrat isi alege numele dintr-o lista si de atunci cookie-ul
 *     `curatenie_voluntar` il tine minte un an. Intoarsa pe 19.09.2026, la cererea utilizatorului
 *     („păstrăm intrarea fantomă doar cu numele… astfel pre-logat un om poate face rezervări în
 *     calendar. Dacă vrea acces în platformă trebuie să intre pe Cont normal").
 *
 * ⚠️ Cele trei reguli ale fantomei, si toate trei se strica tacut:
 *   - e DOAR un nume: poate lua si lasa un slot in calendar, nimic altceva. Poarta nu sta in
 *     interfata, ci in `api.ts` (`CineApasa.fantoma`) — cine trimite formularul de mana ajunge
 *     tot acolo;
 *   - nu are semnatura, dinadins: n-are ce apara, fiindca nu deschide nimic ce tine de cont;
 *   - cine a intrat cu CONTUL n-are fantoma deloc: cookie-ul ramas de dinainte se ignora si se
 *     sterge (`index.ts`), ca sa nu existe doi „eu" pe aceeasi pagina.
 *
 * Ce a iesit la portare si nu se mai intoarce: parola locala de admin (bcrypt), sesiunea ei
 * semnata, resetarea prin email si „modul de initializare". Dreptul de administrare e al
 * platformei, deci n-are cum sa lipseasca.
 */

import type { Voluntar } from './depozit.js'
import { voluntarDupaId, voluntarDupaUserId } from './depozit.js'
import type { Baza } from './oameni.js'

/**
 * Cine cere pagina. `voluntar` = randul din aplicatie, gasit dupa contul platformei;
 * `eAdmin` = dreptul central `cleaning.manage`.
 */
export interface Cine {
  voluntar: Voluntar | null
  eAdmin: boolean
  /** Numele din contul platformei, cand omul a intrat cu el. */
  numeCont: string | null
  userId: string | null
}

/**
 * Voluntarul care cere pagina: randul legat de contul lui, daca are unul. Fara cont — `null`,
 * si atunci ramane fantoma ori pagina de citit.
 */
export async function voluntarulCurent(db: Baza, userId: string | null): Promise<Voluntar | null> {
  if (!userId) return null
  return voluntarDupaUserId(db, userId)
}

// ---------------------------------------------------------------------------
// Fantoma — numele ales din lista, fara cont
// ---------------------------------------------------------------------------

/** Numele ales, tinut minte un an. Acelasi nume de cookie ca in V1, ca sa nu se adune gunoaie. */
export const COOKIE_FANTOMA = 'curatenie_voluntar'
const UN_AN = 60 * 60 * 24 * 365

export function cookieuri(request: Request): Record<string, string> {
  const brut = request.headers.get('cookie')
  if (!brut) return {}
  const out: Record<string, string> = {}
  for (const bucata of brut.split(';')) {
    const i = bucata.indexOf('=')
    if (i <= 0) continue
    const v = bucata.slice(i + 1).trim()
    let dec = v
    try {
      dec = decodeURIComponent(v)
    } catch {
      /* cookie stricat — il luam cum e */
    }
    out[bucata.slice(0, i).trim()] = dec
  }
  return out
}

function cookie(nume: string, valoare: string, domeniu: string, maxAge: number): string {
  let c = `${nume}=${encodeURIComponent(valoare)}; Path=/; HttpOnly; SameSite=Lax; Secure`
  if (domeniu) c += `; Domain=${domeniu}`
  return `${c}; Max-Age=${maxAge}`
}

/** Ce scrie in cookie: `volunteers.id`, ca in V1. Zero sau gunoi = nicio alegere. */
export function idFantomaDinCookie(request: Request): number | null {
  const v = cookieuri(request)[COOKIE_FANTOMA]
  if (!v) return null
  const id = parseInt(v, 10)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function puneFantoma(id: number, domeniu: string): string {
  return cookie(COOKIE_FANTOMA, String(id), domeniu, UN_AN)
}

export function uitaFantoma(domeniu: string): string {
  return cookie(COOKIE_FANTOMA, '', domeniu, 0)
}

/**
 * Cine spune cookie-ul ca e omul — daca mai e adevarat ACUM. Randul trebuie sa existe inca si sa
 * fie al unui voluntar primit in echipa; altfel alegerea nu mai valoreaza nimic si cookie-ul se
 * sterge (cineva scos din echipa nu ramane cu o usa deschisa).
 */
export async function voluntarulFantoma(db: Baza, request: Request): Promise<Voluntar | null> {
  const id = idFantomaDinCookie(request)
  if (id === null) return null
  const v = await voluntarDupaId(db, id)
  if (!v || v.is_active !== 1 || v.is_volunteer !== 1) return null
  return v
}

/**
 * Adminul care a intrat cu contul platformei si n-are un rand al lui in aplicatie: lucreaza in
 * numele celorlalti, dar n-are slot propriu. Randul e inventat, cu `id: 0`, si NU se scrie nicaieri
 * — se vede doar in mesajele de audit („Admin Cristian M. a programat pe…"); „Pentru mine" nu i se
 * arata in meniul unui slot (V1: `adminFaraVoluntar`).
 */
export function adminFaraVoluntar(nume: string | null, userId: string | null): Voluntar {
  const intreg = (nume ?? 'Administrator').trim()
  const bucati = intreg.split(/\s+/)
  return {
    id: 0,
    first_name: bucati[0] ?? 'Administrator',
    last_name: bucati.slice(1).join(' '),
    email: null,
    phone: null,
    short_name: null,
    is_active: 1,
    is_admin: 1,
    is_volunteer: 0,
    is_monitor: 0,
    slug: null,
    user_id: userId ?? '',
    created_at: '',
    updated_at: '',
    in_asteptare: false,
  }
}
