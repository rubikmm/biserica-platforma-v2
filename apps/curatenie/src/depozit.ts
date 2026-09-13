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

export type Row = Record<string, unknown>;

export interface Voluntar {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  is_active: number;
  /** ⚠️ Eticheta echipei („Admin" pe cartela, primeste rapoartele), NU dreptul de administrare:
   *  acela e `cleaning.manage`, al autorizarii centrale. */
  is_admin: number;
  is_volunteer: number;
  is_monitor: number;
  slug: string | null;
  /** Contul platformei legat de acest voluntar, cand omul a intrat o data cu el. */
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RandProgramare {
  id: number;
  sunday_date: string;
  slot_position: number;
  volunteer_id: number;
  created_at: string;
  first_name: string;
  last_name: string;
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

/** „Prenume N." — volunteer_display_name(). */
export function numeScurt(v: { first_name: string; last_name?: string | null }): string {
  const last = v.last_name ?? "";
  const initial = last ? last.slice(0, 1).toUpperCase() : "";
  return `${v.first_name} ${initial}.`.trim();
}

export function numeIntreg(v: { first_name: string; last_name?: string | null }): string {
  return `${v.first_name} ${v.last_name ?? ""}`.trim();
}

export async function voluntarDupaId(db: D1Database, id: number): Promise<Voluntar | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  return unu<Voluntar>(db, "SELECT * FROM volunteers WHERE id = ?", id);
}

export async function voluntarDupaSlug(db: D1Database, slug: string): Promise<Voluntar | null> {
  return unu<Voluntar>(db, "SELECT * FROM volunteers WHERE slug = ?", slug);
}

/** Voluntarul legat de un cont al platformei — legatura se scrie o data, la prima intrare. */
export async function voluntarDupaUserId(db: D1Database, userId: string): Promise<Voluntar | null> {
  return unu<Voluntar>(db, "SELECT * FROM volunteers WHERE user_id = ?", userId);
}

/** Toți voluntarii activi (is_active=1 AND is_volunteer=1), alfabetic după prenume. */
export async function voluntariActivi(db: D1Database): Promise<Voluntar[]> {
  return toate<Voluntar>(
    db,
    "SELECT * FROM volunteers WHERE is_active = 1 AND is_volunteer = 1 ORDER BY first_name, last_name",
  );
}

export async function catiAdmini(db: D1Database): Promise<number> {
  return numar(db, "SELECT COUNT(*) FROM volunteers WHERE is_admin = 1 AND is_active = 1");
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
export async function slugUnic(db: D1Database, first: string, last: string, excludeId = 0): Promise<string> {
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

/** Backfill slug-uri lipsă (populate_volunteer_slugs). Se cheamă la adăugare/editare. */
export async function umpleSluguri(db: D1Database): Promise<void> {
  const rows = await toate<Voluntar>(db, "SELECT id, first_name, last_name FROM volunteers WHERE slug IS NULL OR slug = ''");
  for (const r of rows) {
    const slug = await slugUnic(db, r.first_name, r.last_name, r.id);
    await ruleaza(db, "UPDATE volunteers SET slug = ? WHERE id = ?", slug, r.id);
  }
}

// --- Programări --------------------------------------------------------------

/** Programările unei luni, indexate [sunday_date][slot_position]. */
export async function programarileLunii(db: D1Database, year: number, month: number): Promise<ProgramariPeZi> {
  const start = ymdDin(year, month, 1);
  const end = ymdDin(year, month, zileInLuna(year, month));
  const rows = await toate<RandProgramare>(
    db,
    `SELECT a.*, v.first_name, v.last_name
       FROM assignments a JOIN volunteers v ON v.id = a.volunteer_id
      WHERE a.sunday_date BETWEEN ? AND ?
      ORDER BY a.sunday_date, a.slot_position`,
    start, end,
  );
  const out: ProgramariPeZi = {};
  for (const r of rows) {
    (out[r.sunday_date] ??= {})[Number(r.slot_position)] = r;
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
export async function stareaDuminicii(db: D1Database, sunday: string): Promise<Record<number, StareSlot>> {
  const rows = await toate<{ slot_position: number; first_name: string; last_name: string; volunteer_id: number }>(
    db,
    `SELECT a.slot_position, v.first_name, v.last_name, v.id AS volunteer_id
       FROM assignments a JOIN volunteers v ON v.id = a.volunteer_id
      WHERE a.sunday_date = ? ORDER BY a.slot_position ASC`,
    sunday,
  );
  const out: Record<number, StareSlot> = {};
  for (const r of rows) {
    out[Number(r.slot_position)] = { volunteer_id: Number(r.volunteer_id), name: numeScurt(r) };
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
