/**
 * Ce stie tipicul despre o zi, intr-un singur loc: compunerea foloseste numai functii de depozit,
 * iar de ea atarna deopotriva rutele `/v1` si actiunile din `actiuni.ts`.
 *
 * A stat pana pe 11.09.2026 in corpul rutelor. A urcat aici cand aplicatia si-a publicat lista de
 * actiuni: regula modulului e ca o actiune NU contine logica proprie, iar altfel `tipic.sfintii_zilei`
 * ar fi repetat cum se aduna cele doua carti.
 */
import { cartile, mineiZilei, randuialaZilei, tipiconalZilei } from './depozit.js'
import { pomeniriDinAnuar, pomeniriDinMinei } from './sinaxar.js'

export interface EnvZi {
  DB: D1Database
}

/** Tot ce stie tipicul despre o zi, in forma contractului. */
export async function ziuaIntreaga(env: EnvZi, data: string) {
  const luna = Number(data.slice(5, 7))
  const zi = Number(data.slice(8, 10))
  const [randuiala, tipiconal, minei, carti] = await Promise.all([
    randuialaZilei(env.DB, data),
    tipiconalZilei(env.DB, data),
    // Cartea nu tine de an: ziua se cauta dupa numarul ei din luna.
    mineiZilei(env.DB, luna, zi),
    cartile(env.DB),
  ])
  return {
    data,
    randuiala,
    tipiconal,
    minei,
    carti: {
      randuiala: carti.get('roea') ?? null,
      tipiconal: carti.get('anuar') ?? null,
      minei: carti.get(`minei-${String(luna).padStart(2, '0')}`) ?? null,
    },
  }
}

/**
 * Sfintii zilei, pe carti. `null` cand nicio carte n-are ziua.
 *
 * Sursele stau in ORDINEA in care se citesc pe foaie (user, 11.09.2026): intai Mineiul — el trece
 * toata ceata zilei —, apoi Anuarul, care aproape nu adauga nimic peste calendar. Anuarul tine de
 * an, deci raspunde numai cand se cere o data anume.
 */
export async function sfintiiPeSurse(env: EnvZi, luna: number, zi: number, data: string | null) {
  const [m, carti, tip] = await Promise.all([
    mineiZilei(env.DB, luna, zi),
    cartile(env.DB),
    data ? tipiconalZilei(env.DB, data) : Promise.resolve(null),
  ])
  if (!m && !tip) return null
  const surse = [
    m ? { cod: 'minei', carte: carti.get(`minei-${String(luna).padStart(2, '0')}`) ?? null, titlu: m.titlu, pomeniri: pomeniriDinMinei(m) } : null,
    tip ? { cod: 'tipiconal', carte: carti.get('anuar') ?? null, titlu: tip.titlu, pomeniri: pomeniriDinAnuar(tip.titlu) } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null && x.pomeniri.length > 0)
  return { data, luna, zi, surse }
}
