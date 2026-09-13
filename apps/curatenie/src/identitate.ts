/**
 * Cine e omul, la curatenie. Doua straturi, si trebuie tinute minte amandoua:
 *
 *  1. **VOLUNTARUL ales din lista** — identitatea „mod simplu" a V1, pastrata anume de utilizator
 *     (13.09.2026): omul apasa pe numele lui si de atunci cookie-ul `curatenie_voluntar` il ține
 *     minte un an. Fara parola, fara cont. ⚠️ E o abatere STIUTA de la „autentificarea stă într-un
 *     loc": aplicatia recunoaste singura pe cineva. I s-a spus; a ales-o.
 *  2. **CONTUL PLATFORMEI** — sesiunea centrala, ca la orice alta aplicatie V2. Cine intra cu el si
 *     are `cleaning.manage` administreaza; iar daca numele din cont se potriveste cu un singur
 *     voluntar activ, legatura se scrie o data in `volunteers.user_id` si de atunci omul e
 *     recunoscut instantaneu, fara sa mai apese pe nume.
 *
 * Ce a IESIT din V1: parola locala de admin (bcrypt), sesiunea ei semnata, resetarea prin email si
 * „modul de initializare" in care pagina de admin era deschisa cat timp nu exista niciun admin.
 * Dreptul de administrare e al platformei acum, deci n-are cum sa lipseasca.
 */

import type { Voluntar } from './depozit.js'
import { numeScurt, voluntarDupaId, voluntarDupaUserId } from './depozit.js'

export const COOKIE_VOLUNTAR = 'curatenie_voluntar'
/** Rămâne si dupa Iesire, ca sa se vada „tu" pe lista de nume (V1: `sfi_last_volunteer_id`). */
export const COOKIE_ULTIMUL = 'curatenie_ultimul'
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

function cookie(nume: string, valoare: string, domeniu: string, maxAge?: number): string {
  let c = `${nume}=${encodeURIComponent(valoare)}; Path=/; HttpOnly; SameSite=Lax; Secure`
  if (domeniu) c += `; Domain=${domeniu}`
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`
  return c
}

export function idVoluntarDinCookie(request: Request): number | null {
  const v = cookieuri(request)[COOKIE_VOLUNTAR]
  if (!v) return null
  const id = parseInt(v, 10)
  return id > 0 ? id : null
}

export function idUltimului(request: Request): number | null {
  const v = cookieuri(request)[COOKIE_ULTIMUL]
  if (!v) return null
  const id = parseInt(v, 10)
  return id > 0 ? id : null
}

/** Cele doua cookie-uri puse la alegerea numelui. */
export function puneVoluntarul(id: number, domeniu: string): string[] {
  return [cookie(COOKIE_VOLUNTAR, String(id), domeniu, UN_AN), cookie(COOKIE_ULTIMUL, String(id), domeniu, UN_AN)]
}

/** „Iesire": uita cine e, dar tine minte cine a fost (pentru semnul „tu" pe lista). */
export function uitaVoluntarul(domeniu: string): string {
  return cookie(COOKIE_VOLUNTAR, '', domeniu, 0)
}

/**
 * Cine cere pagina. `voluntar` = randul din aplicatie (din cookie sau din contul legat);
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
 * Voluntarul care cere pagina. Se cauta in doua feluri, in ordinea asta:
 *  1. dupa contul platformei (`volunteers.user_id`) — legatura scrisa o data, la prima intrare;
 *  2. dupa cookie-ul pickerului.
 *
 * Cand omul a intrat cu contul si numele lui se potriveste cu UN SINGUR voluntar activ care n-are
 * inca cont legat, legatura se scrie acum (`leagaContul`) — o data pentru totdeauna.
 */
export async function voluntarulCurent(
  db: D1Database,
  request: Request,
  userId: string | null,
  numeCont: string | null,
): Promise<Voluntar | null> {
  if (userId) {
    const legat = await voluntarDupaUserId(db, userId)
    if (legat) return legat
    if (numeCont) {
      const potrivit = await leagaContul(db, userId, numeCont)
      if (potrivit) return potrivit
    }
  }
  const id = idVoluntarDinCookie(request)
  if (id === null) return null
  const v = await voluntarDupaId(db, id)
  return v && v.is_active === 1 ? v : null
}

/**
 * Adminul care a intrat cu contul platformei si n-are un voluntar al lui in aplicatie: lucreaza in
 * numele celorlalti, dar n-are slot propriu. Randul e inventat, cu `id: 0`, si NU se scrie nicaieri
 * — se vede doar in mesajele de audit („Admin Cristian M. a programat pe…"); „Pentru mine" nu i se
 * arata in meniul unui slot (V1: `adminFaraVoluntar`).
 */
export function adminFaraVoluntar(nume: string | null): Voluntar {
  const intreg = (nume ?? 'Administrator').trim()
  const bucati = intreg.split(/\s+/)
  return {
    id: 0,
    first_name: bucati[0] ?? 'Administrator',
    last_name: bucati.slice(1).join(' '),
    email: null,
    phone: null,
    is_active: 1,
    is_admin: 1,
    is_volunteer: 0,
    is_monitor: 0,
    slug: null,
    user_id: null,
    created_at: '',
    updated_at: '',
  }
}

/**
 * Impereherea, o singura data: numele din cont fata de numele voluntarilor activi. Se leaga DOAR
 * daca se potriveste exact unul — la doi „Ion P." nu ghicim, omul isi alege numele din lista ca
 * pana acum.
 */
async function leagaContul(db: D1Database, userId: string, numeCont: string): Promise<Voluntar | null> {
  const cheie = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const cauta = cheie(numeCont)
  const candidati = await db
    .prepare(`SELECT * FROM volunteers WHERE is_active = 1 AND user_id IS NULL`)
    .all<Voluntar>()
  const potriviti = (candidati.results ?? []).filter((v) => {
    const intreg = cheie(`${v.first_name} ${v.last_name ?? ''}`)
    return intreg === cauta || cheie(numeScurt(v)) === cauta
  })
  if (potriviti.length !== 1) return null
  const v = potriviti[0]!
  await db.prepare(`UPDATE volunteers SET user_id = ?, updated_at = datetime('now') WHERE id = ?`).bind(userId, v.id).run()
  return { ...v, user_id: userId }
}
