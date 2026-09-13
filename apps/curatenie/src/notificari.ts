/**
 * Notificări — lib/notifier.php. Momentan doar log în DB (mode='log'), exact ca pe cPanel:
 * mesajul rămâne în notifications_log pentru audit („Mesaje de sistem" din admin).
 */

import { ruleaza, numeScurt } from "./depozit.js";
import { formatDateShort } from "./timp.js";

/** Textul mesajului pentru un eveniment de slot (build_slot_message). */
export function buildSlotMessage(
  eventType: "occupy" | "release",
  volunteer: { first_name: string; last_name?: string | null },
  slot: number,
  sundayDate: string,
  freeCount: number,
): string {
  const name = numeScurt(volunteer);
  const date = formatDateShort(sundayDate);
  const verb = eventType === "occupy" ? "a ocupat" : "a eliberat";
  const art = eventType === "occupy" ? "" : "de ";
  const freePhrase = freeCount === 1 ? "Mai este 1 loc liber" : `Mai sunt ${freeCount} locuri libere`;
  return `${name} ${verb} poziția ${art}Voluntar ${slot}. ${freePhrase} în data ${date}.`;
}

export function buildVolunteerAddedMessage(volunteer: { first_name: string; last_name?: string | null }): string {
  return `Bine ai venit, ${numeScurt(volunteer)}! Ai fost adăugat ca voluntar pentru curățenia bisericii.`;
}

export interface NotificationContext {
  sunday_date?: string | null;
  slot_position?: number | null;
  volunteer_id?: number | null;
}

/** Înregistrează o notificare; întoarce id-ul. Status 'logged' (mode='log'). */
export async function sendNotification(
  db: D1Database,
  eventType: string,
  message: string,
  context: NotificationContext = {},
  _forceLog = false,
): Promise<number> {
  const r = await ruleaza(
    db,
    `INSERT INTO notifications_log (event_type, message, sunday_date, slot_position, volunteer_id, status)
     VALUES (?, ?, ?, ?, ?, 'logged')`,
    eventType, message, context.sunday_date ?? null, context.slot_position ?? null, context.volunteer_id ?? null,
  );
  return Number(r.meta?.last_row_id ?? 0);
}
