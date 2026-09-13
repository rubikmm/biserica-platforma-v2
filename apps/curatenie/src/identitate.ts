/**
 * Cine e omul, la curatenie. De pe 14.09.2026 raspunsul e UNUL SINGUR: contul platformei.
 *
 * Ce a iesit atunci, cerut anume de utilizator („butonul Autentificare dispare și funcția lui —
 * doar în această aplicație — este preluată de Cont; Schimbă numele și Ieși dispar"):
 *   - PICKERUL — lista de nume din care omul isi alegea numele, fara cont;
 *   - cookie-urile lui (`curatenie_voluntar`, `curatenie_ultimul`) si ruta `/alege`;
 *   - ruta `/iesi` — iesirea e a contului acum, din meniul lui, ca in orice alta aplicatie V2.
 *
 * Ce iesise mai devreme, la portare: parola locala de admin (bcrypt), sesiunea ei semnata,
 * resetarea prin email si „modul de initializare".
 *
 * ⚠️ Aplicatia nu mai recunoaste pe nimeni singura. Cine e voluntar se vede din ASOCIEREA
 * `curatenie` a contului (vezi `oameni.ts`), iar cine administreaza — din `cleaning.manage`.
 */

import type { Voluntar } from './depozit.js'
import { voluntarDupaUserId } from './depozit.js'
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
 * si atunci pagina e doar de citit.
 */
export async function voluntarulCurent(db: Baza, userId: string | null): Promise<Voluntar | null> {
  if (!userId) return null
  return voluntarDupaUserId(db, userId)
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
