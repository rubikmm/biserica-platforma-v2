/**
 * Duminicile, lunile editabile, numele lor si socoteala participarii.
 *
 * Numele liturgic al duminicii vine acum de la calendar (A1), nu dintr-o lista scrisa in cod —
 * vezi mai jos. Restul (care luna e editabila, care duminica a trecut, cine a venit de cate ori)
 * e portat rand cu rand din V1.
 */

import { LUNI_RO, LUNI_RO_MICI } from "./config.js";
import { toate, type Voluntar } from "./depozit.js";
import { acum, adaugaZile, formatDtLocal, formatDateShort, momentDinYmd, ymdDin, zileInLuna, type Moment } from "./timp.js";

// --- Numele duminicii — de la calendar (A1) ---------------------------------------

/**
 * ⚠️ Numele liturgic al duminicii NU mai stă scris în aplicație. În V1 era o listă de 52 de
 * rânduri, scrisă de mână, care acoperea NUMAI anul 2026: din 2027 încolo fiecare duminică ar fi
 * apărut ca „Duminica - 3 ianuarie", și în pagină, și în rapoarte. Acum se cere de la calendar
 * (A1), care le are pe toate și le și îndreaptă când Patriarhia le schimbă.
 *
 * Se cere O DATĂ pe pagină, pe intervalul întreg (`/v1/interval`), nu o dată pentru fiecare
 * duminică — o lună de calendar e o singură întrebare.
 */
export type NumeDuminici = (data: string) => string;

/** Numele de rezervă, cel din V1: „Duminica - 17 mai". */
export function numeGeneric(data: string): string {
  const mo = momentDinYmd(data);
  return `Duminica - ${mo.d} ${LUNI_RO_MICI[mo.m]}`;
}

interface RaspunsInterval {
  zile?: { data: string; denumire: string | null }[];
}

/**
 * Cere calendarului numele zilelor dintr-un interval și întoarce căutarea gata făcută. Când
 * calendarul tace, ori când ziua de acolo n-are denumire, se scrie numele generic — pagina nu
 * rămâne niciodată goală și nici nu cade dacă A1 e oprit.
 */
export async function numeleDuminicilor(calendar: Fetcher | null, deLa: string, panaLa: string): Promise<NumeDuminici> {
  const nume = new Map<string, string>();
  if (calendar && deLa <= panaLa) {
    try {
      const r = await calendar.fetch(`https://calendar.intern/v1/interval?de_la=${deLa}&pana_la=${panaLa}`);
      if (r.ok) {
        const date = (await r.json()) as RaspunsInterval;
        for (const zi of date.zile ?? []) {
          if (zi.denumire) nume.set(zi.data, zi.denumire);
        }
      }
    } catch {
      /* calendarul tace — rămâne numele generic */
    }
  }
  return (data: string) => nume.get(data) ?? numeGeneric(data);
}

/** Căutare care nu întreabă pe nimeni — pentru probe și pentru căile fără binding. */
export const doarGeneric: NumeDuminici = numeGeneric;

// --- Duminici și luni ------------------------------------------------------------

/** Toate duminicile dintr-o lună (YYYY-MM-DD). */
export function duminicileLunii(year: number, month: number): string[] {
  const out: string[] = [];
  const zile = zileInLuna(year, month);
  for (let d = 1; d <= zile; d++) {
    const ymd = ymdDin(year, month, d);
    if (momentDinYmd(ymd).w === 0) out.push(ymd);
  }
  return out;
}

/**
 * E duminica „trecută"? Din trecutul calendaristic, sau chiar azi (duminică) de la ora 18:00.
 * `mo` = momentul curent (acum()), dat ca argument ca să fie același în tot request-ul.
 */
export function duminicaTrecuta(sunday: string, mo: Moment = acum()): boolean {
  if (sunday < mo.ymd) return true;
  if (sunday === mo.ymd && mo.w === 0 && mo.h >= 18) return true;
  return false;
}

/**
 * [an, lună] pentru luna „curentă": rămânem pe luna calendaristică cât timp mai are o duminică
 * netrecută; când și ultima a trecut, sărim la luna următoare (current_year_month).
 */
export function lunaCurenta(mo: Moment = acum()): [number, number] {
  const y = mo.y;
  const m = mo.m;
  let allPast = true;
  for (const s of duminicileLunii(y, m)) {
    if (!duminicaTrecuta(s, mo)) { allPast = false; break; }
  }
  if (allPast) return m === 12 ? [y + 1, 1] : [y, m + 1];
  return [y, m];
}

export function lunaViitoare(mo: Moment = acum()): [number, number] {
  const [y, m] = lunaCurenta(mo);
  return m === 12 ? [y + 1, 1] : [y, m + 1];
}

/** Editabilă = luna curentă sau luna viitoare. */
export function lunaEditabila(year: number, month: number, mo: Moment = acum()): boolean {
  const [cy, cm] = lunaCurenta(mo);
  const [ny, nm] = lunaViitoare(mo);
  return (year === cy && month === cm) || (year === ny && month === nm);
}

/** Cea mai recentă duminică TRECUTĂ (most_recent_past_sunday). */
export function ultimaDuminicaTrecuta(mo: Moment = acum()): string {
  if (mo.w === 0 && mo.h >= 18) return mo.ymd;
  const back = mo.w === 0 ? 7 : mo.w;
  return adaugaZile(mo.ymd, -back);
}

export const eUltimaDuminica = (sunday: string, mo: Moment = acum()): boolean =>
  sunday === ultimaDuminicaTrecuta(mo);

export interface Luna { year: number; month: number; label: string }

/** Lunile cu programări, descrescător (months_with_assignments). */
export async function luniCuProgramari(db: D1Database): Promise<Luna[]> {
  const rows = await toate<{ ym: string }>(
    db, "SELECT DISTINCT substr(sunday_date, 1, 7) AS ym FROM assignments ORDER BY ym DESC",
  );
  return rows.map((r) => {
    const [y, m] = r.ym.split("-");
    return { year: Number(y), month: Number(m), label: `${LUNI_RO[Number(m)]} ${y}` };
  });
}

export const etichetaLuna = (y: number, m: number): string => `${LUNI_RO[m]} ${y}`;

// --- Participare -------------------------------------------------------------------

export interface StatParticipare {
  id: number;
  first_name: string;
  last_name: string;
  attended: number;
  created_at: string | null;
  joined_after: boolean;
}

/** Toți voluntarii activi cu numărul de prezențe în luna dată (month_participation_stats). */
export async function participareaLunii(db: D1Database, year: number, month: number): Promise<StatParticipare[]> {
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  const rows = await toate<Pick<Voluntar, "id" | "first_name" | "last_name" | "created_at"> & { attended: number }>(
    db,
    `SELECT v.id, v.first_name, v.last_name, v.created_at,
            COALESCE(SUM(CASE WHEN substr(a.sunday_date, 1, 7) = ? THEN 1 ELSE 0 END), 0) AS attended
       FROM volunteers v LEFT JOIN assignments a ON a.volunteer_id = v.id
      WHERE v.is_active = 1 AND v.is_volunteer = 1
      GROUP BY v.id
      ORDER BY attended DESC, v.first_name ASC`,
    ym,
  );
  return rows.map((r) => {
    const attended = Number(r.attended);
    const created = r.created_at ?? null;
    return {
      id: Number(r.id),
      first_name: r.first_name,
      last_name: r.last_name,
      attended,
      created_at: created,
      joined_after: attended === 0 && created !== null && created.slice(0, 7) >= ym,
    };
  });
}

/** [volunteer_id => total prezențe pe tot istoricul] (all_time_attendance_map). */
export async function prezenteTotale(db: D1Database): Promise<Record<number, number>> {
  const rows = await toate<{ volunteer_id: number; c: number }>(
    db, "SELECT volunteer_id, COUNT(*) AS c FROM assignments GROUP BY volunteer_id",
  );
  const map: Record<number, number> = {};
  for (const r of rows) map[Number(r.volunteer_id)] = Number(r.c);
  return map;
}

/** [volunteer_id => ultima duminică programată] (last_participation_map). */
export async function ultimaPrezenta(db: D1Database): Promise<Record<number, string>> {
  const rows = await toate<{ volunteer_id: number; md: string }>(
    db, "SELECT volunteer_id, MAX(sunday_date) AS md FROM assignments GROUP BY volunteer_id",
  );
  const map: Record<number, string> = {};
  for (const r of rows) map[Number(r.volunteer_id)] = String(r.md);
  return map;
}

/** Nota de sub nume din „Participare" (participation_note). */
export function notaParticipare(
  attended: number, total: number, createdAt: string | null | undefined, lastDate: string | null | undefined,
): { label: string; title: string } {
  if (total === 0) {
    if (createdAt) {
      return {
        label: "adăugat " + formatDtLocal(createdAt, "d.m.Y"),
        title: "Adăugat în echipă la această dată; nu a participat niciodată",
      };
    }
    return { label: "", title: "" };
  }
  if (attended === 0 && lastDate) {
    return { label: "ultima participare " + formatDateShort(lastDate), title: "Ultima duminică la care a participat" };
  }
  return { label: "", title: "" };
}

/** Ordonare identică în PHP (render) și în payload (sort_participation_stats). */
export function sorteazaParticiparea(stats: StatParticipare[], totals: Record<number, number>): StatParticipare[] {
  const out = stats.slice();
  out.sort((a, b) => {
    const ga = a.attended >= 1 ? 0 : 1;
    const gb = b.attended >= 1 ? 0 : 1;
    if (ga !== gb) return ga - gb;
    const ta = totals[a.id] ?? 0;
    const tb = totals[b.id] ?? 0;
    if (ta !== tb) return tb - ta;
    const na = a.first_name + a.last_name;
    const nb = b.first_name + b.last_name;
    return na < nb ? -1 : na > nb ? 1 : 0;
  });
  return out;
}
