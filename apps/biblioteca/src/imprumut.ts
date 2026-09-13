/**
 * Rezervarile si imprumuturile — regulile parohiei, scrise intr-un singur loc.
 *
 * Termenele sunt hotarari de parohie, nu de cod: cele de mai jos le-a dat utilizatorul pe 30
 * august 2026 si stau in `REGULI_IMPRUMUT`, in contracte, ca sa se poata schimba fara sa se umble
 * prin ecrane.
 *
 * Drumul unei carti:
 *
 *   ceruta ──pangarul o gaseste──► pregatita ──omul o ridica──► imprumutata ──► returnata
 *     │                                │                              │
 *     ├─ respinsa (pangarul)           ├─ expirata (n-a venit in 7 zile)
 *     └─ anulata (omul se razgandeste) └─ anulata (omul se razgandeste)
 *
 * „Intarziat" nu e o stare, ci o socoteala: `imprumutata` cu scadenta trecuta. Asa nu exista doua
 * adevaruri despre acelasi rand, si o carte adusa inapoi se inchide la fel, indiferent daca a
 * venit la timp sau nu.
 *
 * Aici NU intra nume, email sau telefon — numai `user_id`. Portat din
 * `biserica-biblioteca/src/imprumut.ts`, cu `persoana_id` → `user_id` si cu scrisorile date
 * postei platformei (vezi `scrisori.ts`).
 */
import { REGULI_IMPRUMUT, STARI_ACTIVE, type StareCerere } from "@xc/contracts"
import { adaugaZile, aziBucuresti, zileIntre } from "@xc/ui"
import { type Posta, trimite } from "./scrisori.js"
import { acum, plusLuna } from "./zile.js"

/** Cat asteapta cartea pregatita la pangar, daca omul nu vine s-o ridice. */
export const ZILE_ASTEPTARE = REGULI_IMPRUMUT.zileAsteptare
/** Cat tine imprumutul, socotit de la ridicare. */
export const LUNI_IMPRUMUT = REGULI_IMPRUMUT.luniImprumut
/** Cate carti poate avea un om deodata: cerute + pregatite + imprumutate la un loc. */
export const MAXIM_DEODATA = REGULI_IMPRUMUT.maximDeodata

/** Dupa cate zile se repeta anuntul de intarziere, daca tot nu s-a adus cartea. */
const ZILE_INTRE_ANUNTURI = 7

export type Stare = StareCerere
export const ACTIVE: Stare[] = [...STARI_ACTIVE]

/** Un rand din tabelul `cereri`, cu numele coloanelor asa cum stau in baza. */
export interface Cerere {
  id: number
  user_id: string
  carte_slug: string
  stare: Stare
  ceruta_la: string
  pregatita_la: string | null
  asteapta_pana: string | null
  imprumutata_la: string | null
  scadenta: string | null
  incheiata_la: string | null
  anuntat_intarziere: string | null
}

export type Raspuns = { ok: true; id: number } | { ok: false; cod: string; mesaj: string }

const nu = (cod: string, mesaj: string): Raspuns => ({ ok: false, cod, mesaj })

/** Cate zile mai sunt pana la termen; negativ inseamna „a trecut". `null` = fara termen. */
export function zileRamase(c: Cerere): number | null {
  const termen = c.stare === "imprumutata" ? c.scadenta : c.stare === "pregatita" ? c.asteapta_pana : null
  return termen ? zileIntre(aziBucuresti(), termen) : null
}

export const eIntarziata = (c: Cerere) =>
  c.stare === "imprumutata" && !!c.scadenta && zileIntre(aziBucuresti(), c.scadenta) < 0

// --- Citiri ------------------------------------------------------------------

const SEMNE = (n: number) => Array(n).fill("?").join(",")

export async function aleMele(db: D1Database, userId: string): Promise<Cerere[]> {
  const r = await db
    .prepare(
      `SELECT * FROM cereri WHERE user_id = ? AND stare IN (${SEMNE(ACTIVE.length)})
       ORDER BY CASE stare WHEN 'imprumutata' THEN 0 WHEN 'pregatita' THEN 1 ELSE 2 END, id`,
    )
    .bind(userId, ...ACTIVE)
    .all<Cerere>()
  return r.results ?? []
}

export async function istoricul(db: D1Database, userId: string, cate = 20): Promise<Cerere[]> {
  const r = await db
    .prepare(
      `SELECT * FROM cereri WHERE user_id = ? AND stare NOT IN (${SEMNE(ACTIVE.length)})
       ORDER BY id DESC LIMIT ?`,
    )
    .bind(userId, ...ACTIVE, cate)
    .all<Cerere>()
  return r.results ?? []
}

export async function cerere(db: D1Database, id: number): Promise<Cerere | null> {
  return await db.prepare(`SELECT * FROM cereri WHERE id = ?`).bind(id).first<Cerere>()
}

export async function dupaStari(db: D1Database, stari: Stare[]): Promise<Cerere[]> {
  if (stari.length === 0) return []
  const r = await db
    .prepare(`SELECT * FROM cereri WHERE stare IN (${SEMNE(stari.length)}) ORDER BY id`)
    .bind(...stari)
    .all<Cerere>()
  return r.results ?? []
}

async function numar(db: D1Database, sql: string, ...legaturi: unknown[]): Promise<number> {
  const r = await db.prepare(sql).bind(...legaturi).first<{ n: number }>()
  return r?.n ?? 0
}

/** Cate exemplare ale unei carti sunt luate acum — cerute, pregatite sau imprumutate. */
export async function ocupate(db: D1Database, carteSlug: string): Promise<number> {
  return numar(
    db,
    `SELECT COUNT(*) AS n FROM cereri WHERE carte_slug = ? AND stare IN (${SEMNE(ACTIVE.length)})`,
    carteSlug,
    ...ACTIVE,
  )
}

export async function cateAmActive(db: D1Database, userId: string): Promise<number> {
  return numar(
    db,
    `SELECT COUNT(*) AS n FROM cereri WHERE user_id = ? AND stare IN (${SEMNE(ACTIVE.length)})`,
    userId,
    ...ACTIVE,
  )
}

// --- Scrieri -----------------------------------------------------------------

/**
 * Trecerea dintr-o stare in alta se face cu `WHERE ... AND stare = ?`, si se crede numai daca
 * s-a schimbat un rand. Asa doua apasari pe acelasi buton nu trimit doua scrisori.
 */
async function treci(
  db: D1Database,
  id: number,
  dinStare: Stare,
  set: string,
  legaturi: unknown[],
): Promise<boolean> {
  const r = await db
    .prepare(`UPDATE cereri SET ${set} WHERE id = ? AND stare = ?`)
    .bind(...legaturi, id, dinStare)
    .run()
  return (r.meta?.changes ?? 0) > 0
}

/** Cererea unui enorias. `exemplare` vine din catalog (depozit) — baza nu stie de carti. */
export async function cere(
  db: D1Database,
  posta: Posta | null,
  userId: string,
  carteSlug: string,
  titlu: string,
  exemplare: number,
): Promise<Raspuns> {
  const deja = await numar(
    db,
    `SELECT COUNT(*) AS n FROM cereri WHERE user_id = ? AND carte_slug = ? AND stare IN (${SEMNE(ACTIVE.length)})`,
    userId,
    carteSlug,
    ...ACTIVE,
  )
  if (deja > 0) return nu("deja_ceruta", "Ai deja cartea aceasta cerută sau împrumutată.")

  const aleMeleAcum = await cateAmActive(db, userId)
  if (aleMeleAcum >= MAXIM_DEODATA) {
    return nu("prea_multe", `Poți avea cel mult ${MAXIM_DEODATA} cărți deodată. Adu una înapoi și cere din nou.`)
  }

  const luate = await ocupate(db, carteSlug)
  if (luate >= exemplare) {
    return nu("fara_exemplar", "Toate exemplarele sunt luate acum. Întreabă la pangar când se întoarce unul.")
  }

  const momentul = acum()
  const r = await db
    .prepare(`INSERT INTO cereri (user_id, carte_slug, stare, ceruta_la) VALUES (?, ?, 'ceruta', ?)`)
    .bind(userId, carteSlug, momentul)
    .run()
  const id = Number(r.meta?.last_row_id ?? 0)

  await trimite(db, posta, userId, id, "cerere_primita", { titlu }, momentul)
  return { ok: true, id }
}

/** Pangarul a gasit cartea si a pus-o deoparte. De aici incolo curg cele 7 zile. */
export async function pregateste(db: D1Database, posta: Posta | null, c: Cerere, titlu: string): Promise<Raspuns> {
  const pana = adaugaZile(aziBucuresti(), ZILE_ASTEPTARE)
  const momentul = acum()
  if (!(await treci(db, c.id, "ceruta", `stare = 'pregatita', pregatita_la = ?, asteapta_pana = ?`, [momentul, pana]))) {
    return nu("alta_stare", "Cererea nu mai e în starea „cerută”.")
  }
  await trimite(db, posta, c.user_id, c.id, "pregatita", { titlu, data: pana }, momentul)
  return { ok: true, id: c.id }
}

/** Omul a ridicat cartea. Se poate si direct din „cerută", pentru cine vine imediat. */
export async function daCartea(db: D1Database, posta: Posta | null, c: Cerere, titlu: string): Promise<Raspuns> {
  if (c.stare !== "ceruta" && c.stare !== "pregatita") {
    return nu("alta_stare", "Cartea nu e într-o stare din care se poate ridica.")
  }
  const scadenta = plusLuna(aziBucuresti(), LUNI_IMPRUMUT)
  const momentul = acum()
  const set = `stare = 'imprumutata', imprumutata_la = ?, scadenta = ?, asteapta_pana = NULL`
  if (!(await treci(db, c.id, c.stare, set, [momentul, scadenta]))) {
    return nu("alta_stare", "Cererea s-a schimbat între timp. Reîncarcă pagina.")
  }
  await trimite(db, posta, c.user_id, c.id, "imprumutata", { titlu, data: scadenta }, momentul)
  return { ok: true, id: c.id }
}

/** Cartea s-a intors. Dosarul se inchide la fel, si daca a venit la timp, si daca nu. */
export async function primeste(db: D1Database, posta: Posta | null, c: Cerere, titlu: string): Promise<Raspuns> {
  const momentul = acum()
  if (!(await treci(db, c.id, "imprumutata", `stare = 'returnata', incheiata_la = ?`, [momentul]))) {
    return nu("alta_stare", "Cartea nu figurează ca împrumutată.")
  }
  await trimite(db, posta, c.user_id, c.id, "returnata", { titlu }, momentul)
  return { ok: true, id: c.id }
}

export async function respinge(db: D1Database, posta: Posta | null, c: Cerere, titlu: string): Promise<Raspuns> {
  const momentul = acum()
  if (!(await treci(db, c.id, "ceruta", `stare = 'respinsa', incheiata_la = ?`, [momentul]))) {
    return nu("alta_stare", "Numai o cerere neîncepută se poate respinge.")
  }
  await trimite(db, posta, c.user_id, c.id, "respinsa", { titlu }, momentul)
  return { ok: true, id: c.id }
}

/** Pangarul pune cartea inapoi pe raft inainte sa expire de la sine. */
export async function elibereaza(db: D1Database, posta: Posta | null, c: Cerere, titlu: string): Promise<Raspuns> {
  const momentul = acum()
  if (!(await treci(db, c.id, "pregatita", `stare = 'expirata', incheiata_la = ?`, [momentul]))) {
    return nu("alta_stare", "Cartea nu e pusă deoparte.")
  }
  await trimite(db, posta, c.user_id, c.id, "expirata", { titlu, data: c.asteapta_pana }, momentul)
  return { ok: true, id: c.id }
}

/** Omul se razgandeste. Numai a lui, si numai cat timp n-a ridicat cartea. */
export async function anuleaza(
  db: D1Database,
  posta: Posta | null,
  c: Cerere,
  userId: string,
  titlu: string,
): Promise<Raspuns> {
  if (c.user_id !== userId) return nu("nu_e_a_ta", "Cererea nu e a ta.")
  if (c.stare !== "ceruta" && c.stare !== "pregatita") {
    return nu("prea_tarziu", "Cartea e deja la tine — se aduce înapoi la pangar.")
  }
  const momentul = acum()
  if (!(await treci(db, c.id, c.stare, `stare = 'anulata', incheiata_la = ?`, [momentul]))) {
    return nu("alta_stare", "Cererea s-a schimbat între timp. Reîncarcă pagina.")
  }
  await trimite(db, posta, c.user_id, c.id, "anulata", { titlu }, momentul)
  return { ok: true, id: c.id }
}

// --- Ceasul de noapte --------------------------------------------------------

/**
 * Ce se intampla singur, o data pe zi: rezervarile neridicate se sting, iar intarziatii primesc
 * un semn (o data, apoi din sapte in sapte zile — nu in fiecare dimineata, ca sa nu ajunga
 * mesajul parohiei la nedorite).
 *
 * `titlu` cauta numele cartii in catalog; il primim ca functie, ca baza sa nu stie de depozit.
 */
export async function ceasulDeNoapte(
  db: D1Database,
  posta: Posta | null,
  titlu: (slug: string) => string,
): Promise<{ expirate: number; anuntate: number }> {
  const ziua = aziBucuresti()
  const momentul = acum()
  let expirate = 0
  let anuntate = 0

  for (const c of await dupaStari(db, ["pregatita"])) {
    if (!c.asteapta_pana || zileIntre(ziua, c.asteapta_pana) >= 0) continue
    if (!(await treci(db, c.id, "pregatita", `stare = 'expirata', incheiata_la = ?`, [momentul]))) continue
    await trimite(db, posta, c.user_id, c.id, "expirata", { titlu: titlu(c.carte_slug), data: c.asteapta_pana }, momentul)
    expirate++
  }

  for (const c of await dupaStari(db, ["imprumutata"])) {
    if (!c.scadenta) continue
    const intarziere = -zileIntre(ziua, c.scadenta)
    if (intarziere <= 0) continue
    if (c.anuntat_intarziere && zileIntre(c.anuntat_intarziere, ziua) < ZILE_INTRE_ANUNTURI) continue

    await db.prepare(`UPDATE cereri SET anuntat_intarziere = ? WHERE id = ?`).bind(ziua, c.id).run()
    await trimite(
      db,
      posta,
      c.user_id,
      c.id,
      "intarziere",
      { titlu: titlu(c.carte_slug), data: c.scadenta, zile: intarziere },
      momentul,
    )
    anuntate++
  }

  return { expirate, anuntate }
}

// --- Dreptul de imprumut: cererea de acces -----------------------------------

/**
 * Dreptul de imprumut (`library.borrow`) NU se da de aici: il pune un admin la contul omului, cu
 * autorizarea centrala. Ce poate face biblioteca e sa ia cererea omului si s-o puna in fata
 * pangarului; altfel butonul „Solicită acces" din „Cărțile mele" ar fi un buton care nu duce
 * nicaieri.
 *
 * ⚠️ Pastrata anume la cererea utilizatorului (13.09.2026), desi drepturile stau altundeva:
 * tabelul tine CEREREA, niciodata dreptul. Randul se inchide cand pangarul apasa; dreptul dat se
 * vede la om cand isi reinnoieste sesiunea.
 */
export interface CerereAcces {
  id: number
  user_id: string
  ceruta_la: string
  rezolvata_la: string | null
  raspuns: string | null
}

/** Cererea deschisa a omului, daca are una. Inchise nu se arata: dreptul se vede singur. */
export async function accesulMeu(db: D1Database, userId: string): Promise<CerereAcces | null> {
  return await db
    .prepare(`SELECT * FROM cereri_acces WHERE user_id = ? AND rezolvata_la IS NULL ORDER BY id DESC LIMIT 1`)
    .bind(userId)
    .first<CerereAcces>()
}

/** Toate cererile de acces care asteapta pangarul, in ordinea in care au venit. */
export async function cereriAcces(db: D1Database): Promise<CerereAcces[]> {
  const r = await db.prepare(`SELECT * FROM cereri_acces WHERE rezolvata_la IS NULL ORDER BY id`).all<CerereAcces>()
  return r.results ?? []
}

/** O singura cerere deschisa de om: a doua apasare nu mai adauga un rand. */
export async function cereAcces(db: D1Database, userId: string): Promise<Raspuns> {
  if (await accesulMeu(db, userId)) return nu("acces_deja", "Cererea ta e deja la pangar.")
  const r = await db
    .prepare(`INSERT INTO cereri_acces (user_id, ceruta_la) VALUES (?, ?)`)
    .bind(userId, acum())
    .run()
  return { ok: true, id: Number(r.meta?.last_row_id ?? 0) }
}

/** Pangarul inchide randul: „activat" dupa ce s-a dat dreptul in cont, „refuzat" altfel. */
export async function inchideAcces(db: D1Database, id: number, raspuns: "activat" | "refuzat"): Promise<void> {
  await db
    .prepare(`UPDATE cereri_acces SET rezolvata_la = ?, raspuns = ? WHERE id = ? AND rezolvata_la IS NULL`)
    .bind(acum(), raspuns, id)
    .run()
}
