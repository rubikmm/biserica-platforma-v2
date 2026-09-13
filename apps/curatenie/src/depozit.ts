/**
 * Depozitul aplicatiei: voluntarii, programarile, vacantele, setarile.
 *
 * Numele tabelelor si ale coloanelor sunt cele din V1 (vezi
 * `infrastructure/migrations/curatenie/0001_schema.sql`), ca interogarile portate sa ramana
 * cuvant cu cuvant cele probate acolo. Nu exista BEGIN/COMMIT in D1: scrierile care trebuie sa
 * fie atomice se fac cu `db.batch([...])`, care ruleaza totul intr-o singura tranzactie.
 */

import { MIN_VOLUNTARI } from "./config.js";
import { zileInLuna, ymdDin } from "./timp.js";
import { ETICHETA_ADMIN, ETICHETA_MONITOR, ETICHETA_VOLUNTAR, type Baza, type Om } from "./oameni.js";

export type Row = Record<string, unknown>;

/**
 * Randul propriu-zis din `volunteers`. De pe 14.09.2026 tine DOAR cheia locala si legatura cu
 * contul: numele, adresa, telefonul si etichetele stau la identitate (vezi `oameni.ts`).
 * `id` a ramas fiindca de el atarna cheile straine ale programarilor, vacantelor si jurnalului.
 */
export interface RandVoluntar {
  id: number;
  user_id: string;
  slug: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Voluntarul INTREG: randul local + omul de la identitate. Forma a ramas cea de dinainte, cu
 * `first_name`, `is_admin` si restul, dinadins — asa cele cateva mii de linii ale panoului si ale
 * rapoartelor n-au trebuit rescrise. Numai IZVORUL s-a schimbat.
 */
export interface Voluntar {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  /** Numele scurt scris de om pe contul lui. Gol → `numeScurt` il socoteste ca inainte. */
  short_name: string | null;
  /** 1 cat timp asocierea cu curatenia e ACCEPTATA. O cerere in asteptare nu e inca membru. */
  is_active: number;
  /** ⚠️ De pe 14.09.2026 NU mai e o eticheta: aprinderea ei acorda `cleaning.manage`, deci e
   *  chiar numirea de administrator. Se poate apasa doar de un admin al curateniei sau de un
   *  super-admin — panoul din care se apasa cere deja `cleaning.manage`. */
  is_admin: number;
  is_volunteer: number;
  is_monitor: number;
  slug: string | null;
  /** Contul platformei. NU mai poate lipsi: fara cont nu exista voluntar. */
  user_id: string;
  created_at: string;
  updated_at: string;
  /** Cererea in asteptare se vede si de aici, ca panoul s-o poata deosebi de un membru primit. */
  in_asteptare: boolean;
}

/** Lipeste un rand local de omul lui. Fara om (cont sters, identitate tacuta) iese `null`. */
export function imbina(rand: RandVoluntar, om: Om | undefined): Voluntar | null {
  if (!om) return null;
  return {
    id: Number(rand.id),
    first_name: om.firstName,
    last_name: om.lastName,
    email: om.email,
    phone: om.phone,
    short_name: om.shortName,
    is_active: om.stare === "acceptata" && !om.disabled ? 1 : 0,
    is_admin: om.etichete.includes(ETICHETA_ADMIN) ? 1 : 0,
    is_volunteer: om.etichete.includes(ETICHETA_VOLUNTAR) ? 1 : 0,
    is_monitor: om.etichete.includes(ETICHETA_MONITOR) ? 1 : 0,
    slug: rand.slug,
    user_id: rand.user_id,
    created_at: rand.created_at,
    updated_at: rand.updated_at,
    in_asteptare: om.stare === "ceruta",
  };
}

export interface RandProgramare {
  id: number;
  sunday_date: string;
  slot_position: number;
  volunteer_id: number;
  created_at: string;
  /** Numele nu mai stau in tabel: se lipesc din cartea oamenilor la citire. */
  first_name: string;
  last_name: string;
  short_name?: string | null;
}

/** assignments[sunday][slot_position] = rând (ca get_assignments_for_month). */
export type ProgramariPeZi = Record<string, Record<number, RandProgramare>>;

// --- Primitive ---------------------------------------------------------------

export async function unu<T = Row>(db: D1Database, sql: string, ...p: unknown[]): Promise<T | null> {
  const r = await db.prepare(sql).bind(...p).first<T>();
  return (r as T | null) ?? null;
}

export async function toate<T = Row>(db: D1Database, sql: string, ...p: unknown[]): Promise<T[]> {
  const r = await db.prepare(sql).bind(...p).all<T>();
  return r.results ?? [];
}

export async function ruleaza(db: D1Database, sql: string, ...p: unknown[]): Promise<D1Result> {
  return db.prepare(sql).bind(...p).run();
}

/** Prima coloană a primului rând (fetchColumn). */
export async function valoare<T = unknown>(db: D1Database, sql: string, ...p: unknown[]): Promise<T | null> {
  const r = await db.prepare(sql).bind(...p).first<Row>();
  if (!r) return null;
  const k = Object.keys(r)[0];
  return (k === undefined ? null : (r[k] as T)) ?? null;
}

export const numar = async (db: D1Database, sql: string, ...p: unknown[]): Promise<number> =>
  Number((await valoare<number>(db, sql, ...p)) ?? 0);

// --- Setări (app_settings) ---------------------------------------------------

export async function setare(db: D1Database, key: string, def: string | null = null): Promise<string | null> {
  const v = await valoare<string | null>(db, "SELECT value FROM app_settings WHERE key = ?", key);
  return v === null || v === undefined ? def : String(v);
}

export async function puneSetarea(db: D1Database, key: string, value: string | null): Promise<void> {
  await ruleaza(
    db,
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key, value,
  );
}

// --- Voluntari ---------------------------------------------------------------

/**
 * „Prenume N." — volunteer_display_name() din V1. De pe 14.09.2026 numele scurt poate veni GATA
 * SCRIS de pe contul omului (campul „Nume scurt"); doar cand lipseste se socoteste ca inainte.
 */
export function numeScurt(v: { first_name: string; last_name?: string | null; short_name?: string | null }): string {
  const scris = (v.short_name ?? "").trim();
  if (scris) return scris;
  const last = v.last_name ?? "";
  const initial = last ? last.slice(0, 1).toUpperCase() : "";
  return `${v.first_name} ${initial}.`.trim();
}

export function numeIntreg(v: { first_name: string; last_name?: string | null }): string {
  return `${v.first_name} ${v.last_name ?? ""}`.trim();
}

async function imbinaRand(db: Baza, rand: RandVoluntar | null): Promise<Voluntar | null> {
  if (!rand) return null;
  return imbina(rand, db.oameni.om(rand.user_id));
}

export async function voluntarDupaId(db: Baza, id: number): Promise<Voluntar | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  return imbinaRand(db, await unu<RandVoluntar>(db, "SELECT * FROM volunteers WHERE id = ?", id));
}

export async function voluntarDupaSlug(db: Baza, slug: string): Promise<Voluntar | null> {
  return imbinaRand(db, await unu<RandVoluntar>(db, "SELECT * FROM volunteers WHERE slug = ?", slug));
}

/** Voluntarul legat de un cont al platformei. De acum e SINGURUL drum: fara cont nu exista voluntar. */
export async function voluntarDupaUserId(db: Baza, userId: string): Promise<Voluntar | null> {
  return imbinaRand(db, await unu<RandVoluntar>(db, "SELECT * FROM volunteers WHERE user_id = ?", userId));
}

/** Toate rândurile locale, împreună cu oamenii lor. Cei fără om (cont șters) cad din listă. */
export async function totiVoluntarii(db: Baza): Promise<Voluntar[]> {
  const randuri = await toate<RandVoluntar>(db, "SELECT * FROM volunteers");
  const out: Voluntar[] = [];
  for (const r of randuri) {
    const v = imbina(r, db.oameni.om(r.user_id));
    if (v) out.push(v);
  }
  return out.sort((a, b) =>
    numeIntreg(a).localeCompare(numeIntreg(b), "ro", { sensitivity: "base" }),
  );
}

/** Cei care se pot înscrie la duminici: primiți în echipă și cu eticheta „Voluntar". */
export async function voluntariActivi(db: Baza): Promise<Voluntar[]> {
  return (await totiVoluntarii(db)).filter((v) => v.is_active === 1 && v.is_volunteer === 1);
}

export async function catiAdmini(db: Baza): Promise<number> {
  return (await totiVoluntarii(db)).filter((v) => v.is_admin === 1 && v.is_active === 1).length;
}

export function curataDiacritice(s: string): string {
  const map: Record<string, string> = {
    "ă": "a", "â": "a", "î": "i", "ș": "s", "ş": "s", "ț": "t", "ţ": "t",
    "Ă": "a", "Â": "a", "Î": "i", "Ș": "s", "Ş": "s", "Ț": "t", "Ţ": "t",
  };
  return s.replace(/[ăâîșşțţĂÂÎȘŞȚŢ]/g, (c) => map[c] ?? c);
}

/** „prenume.inițială" — make_slug_base(). */
export function bazaSlugului(first: string, last: string): string {
  const f = curataDiacritice(first.trim()).toLowerCase().replace(/[^a-z]/g, "");
  const l = curataDiacritice(last.trim()).toLowerCase().replace(/[^a-z]/g, "");
  const li = l !== "" ? l[0] : "";
  return (f !== "" ? f : "voluntar") + (li !== "" ? "." + li : "");
}

/** Slug unic; dacă e ocupat, sufix numeric (unique_volunteer_slug). */
export async function slugUnic(db: Baza, first: string, last: string, excludeId = 0): Promise<string> {
  const base = bazaSlugului(first, last);
  let candidate = base;
  let n = 2;
  for (;;) {
    const taken = await unu<Row>(db, "SELECT id FROM volunteers WHERE slug = ? AND id != ? LIMIT 1", candidate, excludeId);
    if (!taken) return candidate;
    candidate = base + n;
    n++;
  }
}

/**
 * Umple slugurile lipsa (populate_volunteer_slugs). Numele nu mai sunt in tabel, deci se iau din
 * cartea oamenilor; randul al carui om lipseste se sare — i se va scrie slugul cand se intoarce.
 */
export async function umpleSluguri(db: Baza): Promise<void> {
  const rows = await toate<RandVoluntar>(db, "SELECT * FROM volunteers WHERE slug IS NULL OR slug = ''");
  for (const r of rows) {
    const om = db.oameni.om(r.user_id);
    if (!om) continue;
    const slug = await slugUnic(db, om.firstName, om.lastName, r.id);
    await ruleaza(db, "UPDATE volunteers SET slug = ? WHERE id = ?", slug, r.id);
  }
}

/**
 * Randul local al unui cont, facut daca inca nu exista. Se cheama cand un admin primeste pe cineva
 * in echipa: de la clipa aia omul are o cheie locala de care se pot agata programarile.
 * Randul NU se sterge niciodata la iesirea din echipa — programarile trecute raman in istoric.
 */
export async function asiguraRandul(db: Baza, userId: string, first: string, last: string): Promise<number> {
  const existent = await unu<{ id: number }>(db, "SELECT id FROM volunteers WHERE user_id = ?", userId);
  if (existent) return Number(existent.id);
  const slug = await slugUnic(db, first, last);
  const r = await ruleaza(
    db,
    "INSERT INTO volunteers (user_id, slug, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))",
    userId, slug,
  );
  return Number(r.meta?.last_row_id ?? 0);
}

// --- Programări --------------------------------------------------------------

/**
 * Programările unei luni, indexate [sunday_date][slot_position].
 * ⚠️ Numele nu mai vin din JOIN — nu mai sunt in `volunteers`. Interogarea aduce `user_id`, iar
 * numele se lipesc din cartea oamenilor. Cine a plecat din echipa RAMANE scris pe duminicile lui
 * trecute: contul exista in continuare, doar asocierea s-a stins.
 */
export async function programarileLunii(db: Baza, year: number, month: number): Promise<ProgramariPeZi> {
  const start = ymdDin(year, month, 1);
  const end = ymdDin(year, month, zileInLuna(year, month));
  const rows = await toate<Omit<RandProgramare, "first_name" | "last_name"> & { user_id: string }>(
    db,
    `SELECT a.*, v.user_id
       FROM assignments a JOIN volunteers v ON v.id = a.volunteer_id
      WHERE a.sunday_date BETWEEN ? AND ?
      ORDER BY a.sunday_date, a.slot_position`,
    start, end,
  );
  const out: ProgramariPeZi = {};
  for (const r of rows) {
    const om = db.oameni.om(r.user_id);
    (out[r.sunday_date] ??= {})[Number(r.slot_position)] = {
      ...r,
      first_name: om?.firstName ?? "?",
      last_name: om?.lastName ?? "",
      short_name: om?.shortName ?? null,
    };
  }
  return out;
}

/** Id-urile voluntarilor cu vacanță marcată pe luna dată. */
export async function idVacantaInLuna(db: D1Database, year: number, month: number): Promise<number[]> {
  const rows = await toate<{ volunteer_id: number }>(
    db, "SELECT volunteer_id FROM volunteer_vacations WHERE year = ? AND month = ?", year, month,
  );
  return rows.map((r) => Number(r.volunteer_id));
}

/** Data ultimei modificări a calendarului (occupy/release), „dd.mm.yyyy" local, sau null. */
export async function ultimaMiscare(db: D1Database): Promise<string | null> {
  const v = await valoare<string | null>(
    db, "SELECT MAX(created_at) FROM notifications_log WHERE event_type IN ('occupy', 'release')",
  );
  return v ? String(v) : null;
}

/**
 * Instrucțiunile de re-numerotare contiguă (1..N) a duminicii — repack_sunday_assignments().
 * Se pun într-un `db.batch()` DUPĂ operațiile de ștergere/inserare, ca totul să fie atomic.
 * Nu depind de nicio citire: întâi mutăm totul la +1000, apoi „cel mai mic rămas ia rangul
 * următor", de `cate` ori (un rând în plus față de câte sunt nu strică — nu găsește nimic).
 */
export function renumeroteaza(db: D1Database, sunday: string, cate: number): D1PreparedStatement[] {
  const st: D1PreparedStatement[] = [
    db.prepare("UPDATE assignments SET slot_position = slot_position + 1000 WHERE sunday_date = ?").bind(sunday),
  ];
  const n = Math.max(1, Math.min(120, cate));
  for (let pos = 1; pos <= n; pos++) {
    st.push(
      db.prepare(
        `UPDATE assignments SET slot_position = ?
          WHERE id = (SELECT id FROM assignments WHERE sunday_date = ? AND slot_position > 1000
                      ORDER BY slot_position ASC LIMIT 1)`,
      ).bind(pos, sunday),
    );
  }
  return st;
}

export interface StareSlot { volunteer_id: number; name: string }

/** Starea tuturor sloturilor unei duminici, indexată pe poziție (collect_sunday_state). */
export async function stareaDuminicii(db: Baza, sunday: string): Promise<Record<number, StareSlot>> {
  const rows = await toate<{ slot_position: number; user_id: string; volunteer_id: number }>(
    db,
    `SELECT a.slot_position, v.user_id, v.id AS volunteer_id
       FROM assignments a JOIN volunteers v ON v.id = a.volunteer_id
      WHERE a.sunday_date = ? ORDER BY a.slot_position ASC`,
    sunday,
  );
  const out: Record<number, StareSlot> = {};
  for (const r of rows) {
    const om = db.oameni.om(r.user_id);
    out[Number(r.slot_position)] = {
      volunteer_id: Number(r.volunteer_id),
      name: numeScurt({ first_name: om?.firstName ?? "?", last_name: om?.lastName ?? "", short_name: om?.shortName ?? null }),
    };
  }
  return out;
}

/** Câte locuri rămân libere până la MIN_VOLUNTARI (count_free_slots). */
export async function locuriLibere(db: D1Database, sunday: string): Promise<number> {
  const c = await numar(db, "SELECT COUNT(*) FROM assignments WHERE sunday_date = ?", sunday);
  return Math.max(0, MIN_VOLUNTARI - c);
}

export async function cateProgramari(db: D1Database, sunday: string): Promise<number> {
  return numar(db, "SELECT COUNT(*) FROM assignments WHERE sunday_date = ?", sunday);
}
