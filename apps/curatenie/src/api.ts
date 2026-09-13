/**
 * Ce se întâmplă când omul apasă pe un slot — `api.php` din V1, purtare cu purtare:
 *   - `toggle_slot`           : ocupă / eliberează / mută un slot (voluntarul), ori assign /
 *                               release pe orice duminică (adminul);
 *   - `toggle_vacation_month` : marchează / anulează vacanța pe o lună.
 *
 * Răspunsul are forma din V1, fiindcă JS-ul paginii e cel din V1:
 *   { ok: true,  state: 'occupied'|'free', …, slots_state: {…}, message: "…" }
 *   { ok: false, error: "…" }
 *
 * Tranzacțiile PHP sunt `db.batch()`: ștergerea/inserarea + re-numerotarea într-una singură.
 *
 * Ce s-a schimbat față de V1: cine cere nu se mai află aici (identitatea aplicației + parola de
 * admin), ci vine gata aflat din `index.ts` — voluntarul din cookie ori din contul legat, iar
 * dreptul de administrare de la autorizarea centrală (`cleaning.manage`). Fiecare cerere trece și
 * pe la jetonul CSRF, ca orice POST din V2.
 */

import { MIN_VOLUNTARI } from "./config.js";
import {
  prezenteTotale, lunaEditabila, duminicaTrecuta, ultimaPrezenta, participareaLunii,
  notaParticipare, sorteazaParticiparea,
} from "./calendar.js";
import {
  stareaDuminicii, cateProgramari, locuriLibere, voluntarDupaId, renumeroteaza, ruleaza, toate, unu,
  valoare, numeScurt, type Voluntar,
} from "./depozit.js";
import { json } from "@xc/ui";
import { adminFaraVoluntar } from "./identitate.js";
import type { Baza } from "./oameni.js";
import { buildSlotMessage, sendNotification } from "./notificari.js";
import { acum, eYmd, formatDateShort, ziuaSaptamanii } from "./timp.js";

/** Cine apasă, aflat o dată în `index.ts`. */
export interface CineApasa {
  voluntar: Voluntar | null;
  eAdmin: boolean;
  /** Numele din contul platformei — pentru adminul fără voluntar al lui. */
  numeCont: string | null;
  userId: string | null;
}

interface MediuApi {
  DB: D1Database;
}

type Ok = Record<string, unknown>;

const fail = (msg: string, http = 400): Response => json({ ok: false, error: msg }, http);

export async function api(_env: MediuApi, db: Baza, cine: CineApasa, post: Record<string, string>): Promise<Response> {
  const action = post.action ?? "";
  try {
    switch (action) {
      case "toggle_slot":
        return await toggleSlot(db, cine, post);
      case "toggle_vacation_month":
        return await toggleVacationMonth(db, cine, post);
      default:
        return fail("Acțiune necunoscută.");
    }
  } catch (e) {
    console.error("api:", e);
    return fail("Eroare server: " + (e instanceof Error ? e.message : String(e)), 500);
  }
}

// ============================================================================
async function toggleVacationMonth(db: Baza, cine: CineApasa, post: Record<string, string>): Promise<Response> {
  const volunteer = cine.voluntar;
  if (volunteer === null) return fail("Trebuie să intri cu contul tău mai întâi.", 401);

  const year = parseInt(post.year ?? "0", 10) || 0;
  const month = parseInt(post.month ?? "0", 10) || 0;
  if (year < 2020 || year > 2100) return fail("An invalid.");
  if (month < 1 || month > 12) return fail("Lună invalidă.");

  const vid = Number(volunteer.id);
  const existing = await valoare<number>(
    db, "SELECT id FROM volunteer_vacations WHERE volunteer_id = ? AND year = ? AND month = ?", vid, year, month,
  );
  if (existing) {
    await ruleaza(db, "DELETE FROM volunteer_vacations WHERE id = ?", Number(existing));
    return json({ ok: true, state: "off", year, month, message: "Vacanță anulată." });
  }

  // INSERT vacanță + eliberarea programărilor din luna asta (atomic).
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  const affected = (await toate<{ sunday_date: string }>(
    db,
    "SELECT DISTINCT sunday_date FROM assignments WHERE volunteer_id = ? AND substr(sunday_date, 1, 7) = ?",
    vid, ym,
  )).map((r) => r.sunday_date);

  const st: D1PreparedStatement[] = [
    db.prepare("INSERT INTO volunteer_vacations (volunteer_id, year, month) VALUES (?, ?, ?)").bind(vid, year, month),
  ];
  if (affected.length > 0) {
    st.push(db.prepare("DELETE FROM assignments WHERE volunteer_id = ? AND substr(sunday_date, 1, 7) = ?").bind(vid, ym));
    for (const sunday of affected) {
      const n = await cateProgramari(db, sunday);
      st.push(...renumeroteaza(db, sunday, n + 1));
    }
  }
  await db.batch(st);

  const cleared = affected.length;
  let msg = "Vacanță marcată.";
  if (cleared > 0) msg += ` ${cleared} programare${cleared === 1 ? "" : "i"} a fost eliberată.`;
  return json({ ok: true, state: "on", year, month, cleared_sundays: cleared, message: msg });
}

// ============================================================================
async function toggleSlot(db: Baza, cine: CineApasa, post: Record<string, string>): Promise<Response> {
  const isAdmin = cine.eAdmin;
  // Adminul care a intrat cu contul platformei, fără voluntar al lui, lucrează în numele celorlalți.
  const volunteer = cine.voluntar ?? (isAdmin ? adminFaraVoluntar(cine.numeCont, cine.userId) : null);
  if (volunteer === null) return fail("Trebuie să intri cu contul tău mai întâi.", 401);

  const sunday = post.sunday_date ?? "";
  const slot = parseInt(post.slot ?? "0", 10) || 0;
  if (!eYmd(sunday)) return fail("Data invalidă.");
  if (slot < 1 || slot > 99) return fail("Poziție invalidă.");
  if (ziuaSaptamanii(sunday) !== 0) return fail("Data nu este o duminică.");

  // Vederea de arhivă (with_stats)? Atașăm statistica de participare recalculată la răspuns.
  const withStats = !!post.with_stats;
  const admin = isAdmin ? volunteer : null;
  const op = post.op ?? "";

  const ok = async (data: Ok): Promise<Response> => {
    if (withStats) Object.assign(data, await participationPayload(db, sunday, isAdmin));
    return json({ ok: true, ...data });
  };

  const mo = acum();
  if (!isAdmin) {
    // ---- Gardienii pentru voluntari normali ----
    const sy = Number(sunday.slice(0, 4));
    const sm = Number(sunday.slice(5, 7));
    if (!lunaEditabila(sy, sm, mo)) {
      return fail("Poți modifica doar programările din luna curentă sau cea viitoare.", 403);
    }
    const vac = await valoare<number>(
      db, "SELECT 1 FROM volunteer_vacations WHERE volunteer_id = ? AND year = ? AND month = ? LIMIT 1",
      Number(volunteer.id), sy, sm,
    );
    if (vac) {
      return fail("Ești în vacanță în această lună. Anulează vacanța din tabul „Vacanță\" dacă vrei să te programezi.", 403);
    }
    if (duminicaTrecuta(sunday, mo)) return fail("Această duminică a trecut; nu mai poate fi modificată.", 403);
  }

  // ---- Admin: DOAR operații explicite (assign / release) pe orice duminică ----
  if (isAdmin) {
    if (op === "assign" || op === "release") {
      // `volunteer` e și actorul („Pentru mine"), și adminul care semnează în audit.
      return adminEditSlot(db, sunday, slot, op, parseInt(post.target_volunteer_id ?? "0", 10) || 0, volunteer, volunteer, ok);
    }
    return fail("Operație invalidă pentru admin.");
  }

  const vid = Number(volunteer.id);
  const existing = await unu<{ id: number; volunteer_id: number }>(
    db, "SELECT * FROM assignments WHERE sunday_date = ? AND slot_position = ?", sunday, slot,
  );

  if (existing) {
    // Slot ocupat. Doar voluntarul care l-a ocupat poate elibera.
    if (Number(existing.volunteer_id) !== vid) {
      const other = await voluntarDupaId(db, Number(existing.volunteer_id));
      const otherName = other ? numeScurt(other) : "altcineva";
      return fail(`Slot ocupat de ${otherName}. Nu poți elibera slotul altcuiva.`, 409);
    }
    const n = await cateProgramari(db, sunday);
    await db.batch([
      db.prepare("DELETE FROM assignments WHERE id = ?").bind(Number(existing.id)),
      ...renumeroteaza(db, sunday, n + 1),
    ]);
    const freeCount = await locuriLibere(db, sunday);
    const msg = buildSlotMessage("release", volunteer, slot, sunday, freeCount);
    await sendNotification(db, "release", msg, { sunday_date: sunday, slot_position: slot, volunteer_id: vid });
    const state = await stareaDuminicii(db, sunday);
    return ok({ state: "free", slot: null, free_count: freeCount, message: msg, slots_state: state });
  }

  // Slot liber — ocupare. Dacă voluntarul are deja alt slot în aceeași duminică, mutăm (swap).
  const previousSlot = await valoare<number>(
    db, "SELECT slot_position FROM assignments WHERE sunday_date = ? AND volunteer_id = ?", sunday, vid,
  );
  const isSwap = previousSlot !== null && previousSlot !== undefined;
  const n = await cateProgramari(db, sunday);
  const st: D1PreparedStatement[] = [];
  if (isSwap) st.push(db.prepare("DELETE FROM assignments WHERE sunday_date = ? AND volunteer_id = ?").bind(sunday, vid));
  st.push(db.prepare("INSERT INTO assignments (sunday_date, slot_position, volunteer_id) VALUES (?, ?, ?)").bind(sunday, slot, vid));
  st.push(...renumeroteaza(db, sunday, n + 2));
  await db.batch(st);

  const finalSlot = Number(await valoare<number>(
    db, "SELECT slot_position FROM assignments WHERE sunday_date = ? AND volunteer_id = ?", sunday, vid,
  ) ?? 0);
  const freeCount = await locuriLibere(db, sunday);
  let msg: string;
  if (isSwap) {
    msg = "Poziție schimbată.";
  } else {
    msg = buildSlotMessage("occupy", volunteer, finalSlot, sunday, freeCount);
    await sendNotification(db, "occupy", msg, { sunday_date: sunday, slot_position: finalSlot, volunteer_id: vid });
  }
  const state = await stareaDuminicii(db, sunday);
  return ok({
    state: "occupied",
    volunteer_id: vid,
    volunteer_label: numeScurt(volunteer),
    free_count: freeCount,
    message: msg,
    final_slot: finalSlot,
    slots_state: state,
  });
}

/**
 * Editare de către ADMIN: `assign` (ocupă / reasignează slotul către un voluntar țintă) sau
 * `release`, pe ORICE duminică. Nu trimite notificare — doar audit în notifications_log.
 */
async function adminEditSlot(
  db: Baza, sunday: string, slot: number, op: string, targetId: number,
  actor: Voluntar, admin: Voluntar, ok: (d: Ok) => Promise<Response>,
): Promise<Response> {
  if (op === "release") {
    const n = await cateProgramari(db, sunday);
    await db.batch([
      db.prepare("DELETE FROM assignments WHERE sunday_date = ? AND slot_position = ?").bind(sunday, slot),
      ...renumeroteaza(db, sunday, n + 1),
    ]);
    const state = await stareaDuminicii(db, sunday);
    const freeCount = await locuriLibere(db, sunday);
    await sendNotification(
      db, "admin_release",
      `Admin ${numeScurt(admin)} a eliberat poziția Voluntar ${slot} în data ${formatDateShort(sunday)}.`,
      { sunday_date: sunday, slot_position: slot, volunteer_id: Number(admin.id) || null }, true,
    );
    return ok({ state: "free", slot: null, free_count: freeCount, message: "Slot eliberat.", slots_state: state });
  }

  // op === 'assign'
  const eff = targetId > 0 ? await voluntarDupaId(db, targetId) : actor;
  if (eff === null || Number(eff.is_active) !== 1 || Number(eff.is_volunteer ?? 0) !== 1) return fail("Voluntar invalid.");
  const effId = Number(eff.id);
  const n = await cateProgramari(db, sunday);
  await db.batch([
    db.prepare("DELETE FROM assignments WHERE sunday_date = ? AND volunteer_id = ?").bind(sunday, effId),
    db.prepare("DELETE FROM assignments WHERE sunday_date = ? AND slot_position = ?").bind(sunday, slot),
    db.prepare("INSERT INTO assignments (sunday_date, slot_position, volunteer_id) VALUES (?, ?, ?)").bind(sunday, slot, effId),
    ...renumeroteaza(db, sunday, n + 2),
  ]);
  const finalSlot = Number(await valoare<number>(
    db, "SELECT slot_position FROM assignments WHERE sunday_date = ? AND volunteer_id = ?", sunday, effId,
  ) ?? 0);
  const state = await stareaDuminicii(db, sunday);
  const freeCount = await locuriLibere(db, sunday);
  await sendNotification(
    db, "admin_assign",
    `Admin ${numeScurt(admin)} a programat pe ${numeScurt(eff)} la poziția Voluntar ${finalSlot} în data ${formatDateShort(sunday)}.`,
    { sunday_date: sunday, slot_position: finalSlot, volunteer_id: effId }, true,
  );
  return ok({
    state: "occupied",
    volunteer_id: effId,
    volunteer_label: numeScurt(eff),
    free_count: freeCount,
    message: "Programare actualizată.",
    final_slot: finalSlot,
    slots_state: state,
  });
}

/** Statistica de participare a lunii, gata de randat (participation_payload). */
export async function participationPayload(db: Baza, sunday: string, withTotals = false): Promise<Ok> {
  const y = Number(sunday.slice(0, 4));
  const m = Number(sunday.slice(5, 7));
  const totals = await prezenteTotale(db);
  const last = await ultimaPrezenta(db);
  const stats = sorteazaParticiparea(await participareaLunii(db, y, m), totals);
  const rows = stats.map((st) => {
    const total = totals[st.id] ?? 0;
    const note = notaParticipare(st.attended, total, st.created_at, last[st.id]);
    const row: Ok = {
      name: `${st.first_name} ${st.last_name}`.trim(),
      attended: st.attended,
      never: total === 0,
      note_label: note.label,
      note_title: note.title,
    };
    if (withTotals) row.total_all = total;
    return row;
  });
  return { participation_stats: rows, participation_ym: `${y}-${String(m).padStart(2, "0")}` };
}

export { MIN_VOLUNTARI };
