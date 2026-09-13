/**
 * Newsletter — lib/newsletter.php, portat 1:1.
 *
 * Trei tipuri, aceeași înfățișare, același istoric:
 *   - SĂPTĂMÂNAL: duminica imediat următoare, cu sloturile ei (admini + programați + monitori)
 *   - LUNAR: calendarul complet al lunii țintă, trimis TUTUROR voluntarilor activi cu email,
 *     în lunea săptămânii care conține 1 ale lunii țintă
 *   - ALERTĂ: săptămânalul cu subiect [ALERTĂ], către toți voluntarii, când duminica viitoare
 *     nu are MIN_VOLUNTARI sloturi ocupate
 *
 * ⚠️ **Trimiterea e a platformei, nu a aplicației**: raportul se dă poștei (`communication-worker`,
 * `/trimite`), care ține și arhiva livrărilor. În V1 aplicația deschidea singură SMTP către contul
 * comun `no-reply@`. Ce a rămas neatins: înfățișarea scrisorii (cuvânt cu cuvânt și culoare cu
 * culoare din V1, inclusiv potrivelile pentru modul întunecat al Outlook-ului și al Apple Mail),
 * jurnalul om cu om în `notifications_log` și arhiva din `newsletter_history`, cu HTML-ul întreg și
 * lista destinatarilor (testele intră și ele, cu `is_test=1`).
 *
 * Numele liturgic al duminicii vine de la calendar (A1), nu din lista de 2026 scrisă de mână.
 */

import { MIN_VOLUNTARI, LUNI_RO_MICI } from "./config.js";
import { duminicileLunii, type NumeDuminici } from "./calendar.js";
import {
  programarileLunii, numar, numeIntreg, ruleaza, setare, puneSetarea, toate, idVacantaInLuna,
  type Voluntar,
} from "./depozit.js";
import { esc } from "@xc/ui";
import { acum, adaugaZile, dataLocala, formatDateRo, formatDateShort, momentDinYmd, ymdDin, type Moment } from "./timp.js";

export interface SendResult {
  sent: number;
  failed: number;
  errors: string[];
  sunday?: string;
  month_label?: string;
  year?: number;
  month?: number;
}

// --- Când -----------------------------------------------------------------------

/** Cea mai apropiată duminică la sau după azi; duminica după ora 18 sare la următoarea. */
export function nextSundayDate(mo: Moment = acum()): string {
  if (mo.w === 0 && mo.h >= 18) return adaugaZile(mo.ymd, 7);
  if (mo.w !== 0) return adaugaZile(mo.ymd, 7 - mo.w);
  return mo.ymd;
}

export async function nextSundayOccupiedCount(db: D1Database, sunday: string): Promise<number> {
  return numar(db, "SELECT COUNT(*) FROM assignments WHERE sunday_date = ?", sunday);
}

export async function nextSundayIsFilled(db: D1Database, sunday: string): Promise<boolean> {
  return (await nextSundayOccupiedCount(db, sunday)) >= MIN_VOLUNTARI;
}

/** Prima zi a lunii următoare. */
export function nextMonthFirstDate(mo: Moment = acum()): string {
  let y = mo.y;
  let m = mo.m;
  if (m === 12) { y++; m = 1; } else { m++; }
  return ymdDin(y, m, 1);
}

/**
 * REGULA DE TRIGGER LUNAR: lunea săptămânii care conține 1 ale lunii țintă.
 * Dacă AZI e acea luni, întoarce [an, lună] țintă; altfel null.
 */
export function newsletterMonthlyTriggerToday(mo: Moment = acum()): [number, number] | null {
  if (mo.w !== 1) return null;
  for (let i = 0; i < 7; i++) {
    const c = momentDinYmd(adaugaZile(mo.ymd, i));
    if (c.d === 1) return [c.y, c.m];
  }
  return null;
}

export interface MonthlySchedule {
  /** YYYY-MM-DD (o zi de luni) */
  monday: string;
  hour: number;
  target_year: number;
  target_month: number;
}

/**
 * Pentru admin: următoarea luni la care se trimite lunarul și ce lună va arăta
 * (sare peste luna deja trimisă — idempotența pe newsletter_monthly_last_sent_for_ym).
 */
export async function newsletterMonthlyNextSchedule(db: D1Database, mo: Moment = acum()): Promise<MonthlySchedule> {
  const hour = parseInt((await setare(db, "newsletter_monthly_hour", "9")) ?? "9", 10);
  const lastForYm = (await setare(db, "newsletter_monthly_last_sent_for_ym", "")) ?? "";

  let candidate = mo.ymd;
  if (mo.w !== 1) candidate = adaugaZile(mo.ymd, (8 - mo.w) % 7);

  for (let attempt = 0; attempt < 8; attempt++) {
    let ty: number | null = null;
    let tm: number | null = null;
    for (let i = 0; i < 7; i++) {
      const c = momentDinYmd(adaugaZile(candidate, i));
      if (c.d === 1) { ty = c.y; tm = c.m; break; }
    }
    if (ty !== null && tm !== null) {
      const targetYm = `${ty}-${String(tm).padStart(2, "0")}`;
      const inViitor = candidate > mo.ymd || (candidate === mo.ymd && hour > mo.h);
      if (inViitor && lastForYm !== targetYm) {
        return { monday: candidate, hour, target_year: ty, target_month: tm };
      }
    }
    candidate = adaugaZile(candidate, 7);
  }
  const c = momentDinYmd(candidate);
  return { monday: candidate, hour, target_year: c.y, target_month: c.m };
}

export async function newsletterMonthlyTargetMonth(db: D1Database, mo: Moment = acum()): Promise<[number, number]> {
  const s = await newsletterMonthlyNextSchedule(db, mo);
  return [s.target_year, s.target_month];
}

/** Emailurile TUTUROR voluntarilor activi (lower-case, unice) — pentru alertă. */
export async function allActiveVolunteerEmails(db: D1Database): Promise<string[]> {
  const rows = await toate<{ email: string }>(
    db, "SELECT email FROM volunteers WHERE is_active = 1 AND is_volunteer = 1 AND email IS NOT NULL AND email != ''",
  );
  return [...new Set(rows.map((r) => r.email.trim().toLowerCase()))];
}

// --- Săptămânal -------------------------------------------------------------------

export interface NewsletterData {
  sunday_date: string;
  date_label: string;
  liturgical: string;
  slots: Record<number, string>;
  slot_count: number;
  occupied: number;
  free_count: number;
}

export async function newsletterBuildData(db: D1Database, sunday: string, nume: NumeDuminici): Promise<NewsletterData> {
  const rows = await toate<{ slot_position: number; volunteer_id: number; first_name: string; last_name: string }>(
    db,
    `SELECT a.slot_position, a.volunteer_id, v.first_name, v.last_name
       FROM assignments a JOIN volunteers v ON v.id = a.volunteer_id
      WHERE a.sunday_date = ? ORDER BY a.slot_position`,
    sunday,
  );
  const slots: Record<number, string> = {};
  let maxPos = 0;
  for (const r of rows) {
    slots[Number(r.slot_position)] = numeIntreg(r);
    maxPos = Math.max(maxPos, Number(r.slot_position));
  }
  const slotCount = Math.max(MIN_VOLUNTARI, maxPos);
  const occupied = Object.keys(slots).length;
  return {
    sunday_date: sunday,
    date_label: formatDateRo(sunday),
    liturgical: nume(sunday),
    slots,
    slot_count: slotCount,
    occupied,
    free_count: Math.max(0, MIN_VOLUNTARI - occupied),
  };
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

const STIL_COMUN = `
        :root { color-scheme: light only; supported-color-schemes: light; }
        body, table, td, div, p, span, h1, h2, h3, a, strong, em { color-scheme: light only; }

        /* Outlook desktop dark mode — inversează cu data-ogsc/data-ogsb */
        [data-ogsc] body, [data-ogsb] body { background-color: #f7f5f0 !important; color: #2b2a26 !important; }
        [data-ogsc] .nl-wrap, [data-ogsb] .nl-wrap { background-color: #f7f5f0 !important; }
        [data-ogsc] .nl-card, [data-ogsb] .nl-card { background-color: #ffffff !important; color: #2b2a26 !important; }
        [data-ogsc] .nl-heading { color: #4f6c3b !important; }
        [data-ogsc] .nl-sub, [data-ogsc] .nl-footer { color: #6b6a5e !important; }
        [data-ogsc] .nl-body-text, [data-ogsc] .nl-body-text strong { color: #2b2a26 !important; }
        [data-ogsc] .nl-row-label, [data-ogsb] .nl-row-label { background-color: #f7f5f0 !important; color: #6b6a5e !important; }
        [data-ogsc] .nl-row-value, [data-ogsb] .nl-row-value { background-color: #ffffff !important; color: #2b2a26 !important; }
        [data-ogsc] .nl-name { color: #4f6c3b !important; }
        [data-ogsc] .nl-free { color: #b04848 !important; }
        [data-ogsc] .nl-status-warn, [data-ogsb] .nl-status-warn,
        [data-ogsc] .nl-status-warn-td, [data-ogsb] .nl-status-warn-td { background-color: #fff8e6 !important; color: #7a5a14 !important; }
        [data-ogsc] .nl-status-warn-td strong { color: #7a5a14 !important; }
        [data-ogsc] .nl-status-ok, [data-ogsb] .nl-status-ok,
        [data-ogsc] .nl-status-ok-td, [data-ogsb] .nl-status-ok-td { background-color: #dcecc9 !important; color: #4f6c3b !important; }
        [data-ogsc] .nl-status-ok-td strong { color: #4f6c3b !important; }
        [data-ogsc] .nl-btn, [data-ogsb] .nl-btn { background-color: #c97a3a !important; }
        [data-ogsc] .nl-btn a, [data-ogsb] .nl-btn a { color: #ffffff !important; }

        /* Apple Mail / Outlook iOS / Gmail iOS dark mode */
        @media (prefers-color-scheme: dark) {
            body, .nl-wrap { background-color: #f7f5f0 !important; }
            .nl-card { background-color: #ffffff !important; color: #2b2a26 !important; }
            .nl-heading { color: #4f6c3b !important; }
            .nl-sub, .nl-footer { color: #6b6a5e !important; }
            .nl-body-text, .nl-body-text strong { color: #2b2a26 !important; }
            .nl-row-label { background-color: #f7f5f0 !important; color: #6b6a5e !important; }
            .nl-row-value { background-color: #ffffff !important; color: #2b2a26 !important; }
            .nl-name { color: #4f6c3b !important; }
            .nl-free { color: #b04848 !important; }
            .nl-status-warn, .nl-status-warn-td { background-color: #fff8e6 !important; color: #7a5a14 !important; }
            .nl-status-ok, .nl-status-ok-td { background-color: #dcecc9 !important; color: #4f6c3b !important; }
            .nl-btn { background-color: #c97a3a !important; }
            .nl-btn a { color: #ffffff !important; }
        }
    `;

const STIL_LUNAR = `
        :root { color-scheme: light only; supported-color-schemes: light; }
        body, table, td, div, p, span, h1, h2, h3, a, strong, em { color-scheme: light only; }

        /* Outlook desktop dark mode */
        [data-ogsc] body, [data-ogsb] body { background-color: #f7f5f0 !important; color: #2b2a26 !important; }
        [data-ogsc] .nl-wrap, [data-ogsb] .nl-wrap { background-color: #f7f5f0 !important; }
        [data-ogsc] .nl-card, [data-ogsb] .nl-card { background-color: #ffffff !important; color: #2b2a26 !important; }
        [data-ogsc] .nl-heading { color: #4f6c3b !important; }
        [data-ogsc] .nl-sub, [data-ogsc] .nl-footer { color: #6b6a5e !important; }
        [data-ogsc] .nl-body-text, [data-ogsc] .nl-body-text strong { color: #2b2a26 !important; }
        [data-ogsc] .nl-intro, [data-ogsb] .nl-intro { background-color: #fdf5e6 !important; color: #2b2a26 !important; }
        [data-ogsc] .nl-sunday-card, [data-ogsb] .nl-sunday-card { background-color: #ffffff !important; }
        [data-ogsc] .nl-sunday-head, [data-ogsb] .nl-sunday-head { background-color: #f7f5f0 !important; color: #4f6c3b !important; }
        [data-ogsc] .nl-sunday-litu { color: #6b6a5e !important; }
        [data-ogsc] .nl-row-label, [data-ogsb] .nl-row-label { background-color: #f7f5f0 !important; color: #6b6a5e !important; }
        [data-ogsc] .nl-row-value, [data-ogsb] .nl-row-value { background-color: #ffffff !important; color: #2b2a26 !important; }
        [data-ogsc] .nl-name { color: #4f6c3b !important; }
        [data-ogsc] .nl-free { color: #b04848 !important; }
        [data-ogsc] .nl-status-warn, [data-ogsb] .nl-status-warn,
        [data-ogsc] .nl-status-warn-td, [data-ogsb] .nl-status-warn-td { background-color: #fff8e6 !important; color: #7a5a14 !important; }
        [data-ogsc] .nl-status-ok, [data-ogsb] .nl-status-ok,
        [data-ogsc] .nl-status-ok-td, [data-ogsb] .nl-status-ok-td { background-color: #dcecc9 !important; color: #4f6c3b !important; }
        [data-ogsc] .nl-btn, [data-ogsb] .nl-btn { background-color: #c97a3a !important; }
        [data-ogsc] .nl-btn a, [data-ogsb] .nl-btn a { color: #ffffff !important; }

        /* Apple Mail / Outlook iOS / Gmail iOS dark mode */
        @media (prefers-color-scheme: dark) {
            body, .nl-wrap { background-color: #f7f5f0 !important; }
            .nl-card { background-color: #ffffff !important; color: #2b2a26 !important; }
            .nl-heading { color: #4f6c3b !important; }
            .nl-sub, .nl-footer { color: #6b6a5e !important; }
            .nl-body-text, .nl-body-text strong { color: #2b2a26 !important; }
            .nl-intro { background-color: #fdf5e6 !important; color: #2b2a26 !important; }
            .nl-sunday-card { background-color: #ffffff !important; }
            .nl-sunday-head { background-color: #f7f5f0 !important; color: #4f6c3b !important; }
            .nl-sunday-litu { color: #6b6a5e !important; }
            .nl-row-label { background-color: #f7f5f0 !important; color: #6b6a5e !important; }
            .nl-row-value { background-color: #ffffff !important; color: #2b2a26 !important; }
            .nl-name { color: #4f6c3b !important; }
            .nl-free { color: #b04848 !important; }
            .nl-status-warn, .nl-status-warn-td { background-color: #fff8e6 !important; color: #7a5a14 !important; }
            .nl-status-ok, .nl-status-ok-td { background-color: #dcecc9 !important; color: #4f6c3b !important; }
            .nl-btn { background-color: #c97a3a !important; }
            .nl-btn a { color: #ffffff !important; }
        }
    `;

function capHtml(titlu: string, stil: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">`
    + `<html xmlns="http://www.w3.org/1999/xhtml" lang="ro" style="background-color:#f7f5f0;">`
    + `<head>`
    + `<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />`
    + `<meta name="viewport" content="width=device-width, initial-scale=1" />`
    + `<meta name="color-scheme" content="light only" />`
    + `<meta name="supported-color-schemes" content="light" />`
    + `<title>${titlu}</title>`
    + `<style type="text/css">${stil}</style>`
    + `</head>`
    + `<body class="nl-wrap" style="margin:0;padding:0;background-color:#f7f5f0;color:#2b2a26;font-family:${FONT};">`;
}

export function newsletterRenderHtml(data: NewsletterData, acasa: string): string {
  const app_url = acasa;
  const font = FONT;

  let rows = "";
  for (let i = 1; i <= data.slot_count; i++) {
    const name = data.slots[i] ?? null;
    const cell = name
      ? `<strong class="nl-name" style="color:#4f6c3b;font-family:${font};">${esc(name)}</strong>`
      : `<span class="nl-free" style="color:#b04848;font-family:${font};">liber</span>`;
    rows += `<tr>`
      + `<td class="nl-row-label" bgcolor="#f7f5f0" style="padding:8px 12px;border:1px solid #d9d2c2;color:#6b6a5e;background-color:#f7f5f0;font-family:${font};font-size:15px;width:110px;">`
      + `Voluntar ${i}`
      + `</td>`
      + `<td class="nl-row-value" bgcolor="#ffffff" style="padding:8px 12px;border:1px solid #d9d2c2;color:#2b2a26;background-color:#ffffff;font-family:${font};font-size:15px;">`
      + cell
      + `</td>`
      + `</tr>`;
  }

  let status: string;
  if (data.free_count > 0) {
    status = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fff8e6" class="nl-status-warn" style="background-color:#fff8e6;border:1px solid #e7d8a8;margin:0 0 14px;">`
      + `<tr><td class="nl-status-warn-td" style="padding:12px 14px;color:#7a5a14;background-color:#fff8e6;font-family:${font};font-size:15px;">`
      + `Mai e nevoie de <strong style="color:#7a5a14;">${data.free_count} voluntar${data.free_count > 1 ? "i" : ""}</strong> pentru această duminică.`
      + `</td></tr></table>`;
  } else {
    status = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#dcecc9" class="nl-status-ok" style="background-color:#dcecc9;border:1px solid #6b8e4e;margin:0 0 14px;">`
      + `<tr><td class="nl-status-ok-td" style="padding:12px 14px;color:#4f6c3b;background-color:#dcecc9;font-family:${font};font-size:15px;">`
      + `<strong style="color:#4f6c3b;">Toate locurile de bază sunt ocupate.</strong> Mulțumim!`
      + `</td></tr></table>`;
  }

  let h = capHtml("Programare", STIL_COMUN);
  h += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f5f0" class="nl-wrap" style="background-color:#f7f5f0;padding:20px 0;">`;
  h += `<tr><td align="center" class="nl-wrap" style="background-color:#f7f5f0;">`;
  h += `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" class="nl-card" style="background-color:#ffffff;width:600px;max-width:600px;border:1px solid #d9d2c2;">`;
  h += `<tr><td class="nl-card" style="padding:28px;background-color:#ffffff;color:#2b2a26;font-family:${font};">`;
  h += `<h2 class="nl-heading" style="margin:0 0 6px;color:#4f6c3b;font-size:20px;font-family:${font};">Programare curățenie</h2>`;
  h += `<div class="nl-sub" style="color:#6b6a5e;margin-bottom:18px;font-size:14px;font-family:${font};">Albinele Sfântului Ilie - Hanul Colței</div>`;
  h += `<p class="nl-body-text" style="color:#2b2a26;font-size:15px;line-height:1.5;margin:0 0 14px;font-family:${font};">`
    + `Pentru duminica de <strong style="color:#2b2a26;">${esc(data.date_label)}</strong> `
    + `<em style="color:#6b6a5e;">(${esc(data.liturgical)})</em>, situația programării este:`
    + `</p>`;
  h += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:14px 0;width:100%;">`;
  h += rows;
  h += `</table>`;
  h += status;
  h += `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;">`
    + `<tr>`
    + `<td bgcolor="#c97a3a" class="nl-btn" style="background-color:#c97a3a;padding:12px 24px;border-radius:6px;">`
    + `<a href="${esc(app_url)}" target="_blank" `
    + `style="color:#ffffff;text-decoration:none;font-weight:600;font-family:${font};font-size:15px;display:inline-block;line-height:1;">`
    + `Deschideți calendarul</a>`
    + `</td>`
    + `</tr>`
    + `</table>`;
  h += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">`
    + `<tr><td class="nl-footer" style="border-top:1px solid #d9d2c2;padding-top:14px;color:#6b6a5e;font-size:12px;font-family:${font};">`
    + `Email automat. Pentru a vedea programările, deschideți calendarul.`
    + `</td></tr></table>`;
  h += `</td></tr></table>`;
  h += `</td></tr></table>`;
  h += `</body></html>`;
  return h;
}

export function newsletterRenderText(data: NewsletterData, acasa: string): string {
  const app_url = acasa;
  let out = "Programare curățenie - Albinele Sfântului Ilie\n";
  out += "=".repeat(50) + "\n\n";
  out += `Pentru duminica de ${data.date_label} (${data.liturgical}):\n\n`;
  for (let i = 1; i <= data.slot_count; i++) {
    const name = data.slots[i] ?? "liber";
    out += `  Voluntar ${i}: ${name}\n`;
  }
  out += "\n";
  if (data.free_count > 0) {
    out += `Mai e nevoie de ${data.free_count} voluntar${data.free_count > 1 ? "i" : ""} pentru această duminică.\n\n`;
  } else {
    out += "Toate locurile de bază sunt ocupate. Mulțumim!\n\n";
  }
  out += `Calendar: ${app_url}\n`;
  return out;
}

// --- Destinatari + trimitere (comun săptămânal / lunar) ------------------------------

type Categorie = "admin" | "monitor" | "scheduled";
interface RecipientLog { name: string; email: string; status: "sent" | "failed"; category: Categorie }

const cheie = (e: string | null | undefined): string => String(e ?? "").trim().toLowerCase();

/** Combinația deduplicată pe email (admini, apoi monitori, apoi „scheduled"). */
function combina(admins: Voluntar[], monitors: Voluntar[], scheduled: Voluntar[]): Voluntar[] {
  const recipients = new Map<string, Voluntar>();
  for (const a of admins) recipients.set(cheie(a.email), a);
  for (const m of monitors) if (!recipients.has(cheie(m.email))) recipients.set(cheie(m.email), m);
  for (const v of scheduled) if (!recipients.has(cheie(v.email))) recipients.set(cheie(v.email), v);
  return [...recipients.values()];
}

function filtreaza(list: Voluntar[], vacIds: number[], filterEmails: string[] | null): Voluntar[] {
  let out = list;
  if (vacIds.length > 0) {
    const vac = new Set(vacIds);
    out = out.filter((r) => !vac.has(Number(r.id)));
  }
  if (filterEmails !== null) {
    const allow = new Set(filterEmails.map(cheie));
    out = out.filter((r) => allow.has(cheie(r.email)));
  }
  return out;
}

function categoria(a: Voluntar): Categorie {
  if (Number(a.is_admin ?? 0) === 1) return "admin";
  if (Number(a.is_monitor ?? 0) === 1) return "monitor";
  return "scheduled";
}

interface Trimitere {
  subject: string;
  html: string;
  text: string;
  /** sunday_date scris în notifications_log / newsletter_history */
  anchor: string;
  /** Felul raportului — intră în cheia de idempotență a poștei. */
  fel: "weekly" | "monthly" | "alert";
  /** Trimitere din panou („Trimite acum"): cheie proprie, ca să nu blocheze cea automată. */
  deProba: boolean;
  logOk: (to: string) => string;
  logErr: (to: string) => string;
}

/**
 * Ce trebuie ca să iasă un raport: poșta platformei, adresa publică a aplicației (linkul
 * „Deschideți calendarul") și numele duminicilor, cerute de la calendar pentru intervalul în lucru.
 * `COMUNICARE` poate fi `null` în probe — atunci nimic nu pleacă și se scrie pricina.
 */
export interface MediuRaport {
  COMUNICARE: Fetcher | null;
  /** Cu `/` la capăt, ca `config.newsletter.app_url` din V1. */
  acasa: string;
  nume: NumeDuminici;
}

/**
 * Dă raportul poștei platformei, o dată, cu toți destinatarii lui.
 *
 * ⚠️ **Aici e singura deosebire de fond față de V1.** Acolo aplicația deschidea singură o
 * conexiune SMTP către contul comun `no-reply@`, una pentru fiecare destinatar. În V2 emailul
 * pleacă DOAR prin `communication-worker`, care ține și arhiva livrărilor: aplicațiile nu-și aleg
 * furnizorul și nu trimit singure (structura mare, user 10.09.2026).
 *
 * Ce se schimbă în purtare, și trebuie știut: poșta primește o singură cerere cu toată lista, deci
 * un raport pleacă întreg sau nu pleacă deloc — în V1 putea reuși pentru unii și cădea pentru
 * alții. Starea fiecărui destinatar o întoarce tot poșta (`sent`, `simulated`, `failed`,
 * `suppressed`), iar noi o scriem în jurnal ca și până acum, om cu om.
 *
 * `suppressed` = omul și-a oprit emailurile de la platformă. Nu e defecțiunea noastră, dar nici
 * n-a plecat nimic — deci se scrie ca eșec, cu pricina, ca adminul să nu creadă că a ajuns.
 */
async function daPostei(
  posta: MediuRaport,
  dest: Voluntar[],
  t: Trimitere,
): Promise<Map<string, { ok: boolean; necaz: string | null }>> {
  const raspuns = new Map<string, { ok: boolean; necaz: string | null }>();
  const destinatari = dest.map((v) => ({ userId: v.user_id ?? null, adresa: String(v.email ?? "").trim() }));
  if (destinatari.length === 0) return raspuns;

  const pica = (necaz: string) => {
    for (const d of destinatari) raspuns.set(cheie(d.adresa), { ok: false, necaz });
    return raspuns;
  };
  if (!posta.COMUNICARE) return pica("poșta nu e legată în acest mediu");

  try {
    const r = await posta.COMUNICARE.fetch("https://comunicare.intern/trimite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sursa: "curatenie",
        destinatari,
        subiect: t.subject,
        html: t.html,
        text: t.text,
        // Același raport nu pleacă de două ori, oricât s-ar apăsa butonul: cheia e felul lui și
        // duminica (ori luna) pe care o arată. Trimiterile de probă din panou au cheia lor, ca să
        // nu blocheze plecarea celei adevărate.
        idempotencyKey: `curatenie:${t.fel}:${t.anchor}${t.deProba ? `:proba:${new Date().toISOString().slice(0, 16)}` : ""}`,
        correlationId: `curatenie-${t.fel}`,
        test: t.deProba,
        meta: { aplicatie: "curatenie", fel: t.fel, duminica: t.anchor },
      }),
    });
    if (!r.ok) return pica(`poșta a răspuns ${r.status}`);
    const date = (await r.json()) as { ok?: boolean; livrari?: { adresa?: string; stare?: string }[] };
    if (!date.ok) return pica("poșta n-a primit scrisoarea");
    const stari = new Map((date.livrari ?? []).map((l) => [cheie(l.adresa), l.stare ?? ""]));
    for (const d of destinatari) {
      const k = cheie(d.adresa);
      const stare = stari.get(k);
      if (stare === "sent" || stare === "simulated") raspuns.set(k, { ok: true, necaz: null });
      else if (stare === "suppressed") raspuns.set(k, { ok: false, necaz: "omul și-a oprit emailurile de la platformă" });
      else if (stare === undefined) raspuns.set(k, { ok: false, necaz: "poșta n-a spus nimic despre acest destinatar" });
      else raspuns.set(k, { ok: false, necaz: `poșta a întors starea „${stare}”` });
    }
    return raspuns;
  } catch (e) {
    return pica(`poșta n-a răspuns: ${(e as Error).message}`);
  }
}

async function trimiteTuturor(db: D1Database, posta: MediuRaport, dest: Voluntar[], t: Trimitere): Promise<{ sent: number; failed: number; errors: string[]; log: RecipientLog[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const log: RecipientLog[] = [];
  const seen = new Set<string>();
  // Dedup pe email ÎNAINTE de trimitere: același om poate fi și admin, și programat duminica asta.
  const unici = dest.filter((v) => {
    const k = cheie(v.email);
    if (k === "" || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const stari = await daPostei(posta, unici, t);

  for (const admin of unici) {
    const to = String(admin.email ?? "");
    const r = stari.get(cheie(to)) ?? { ok: false, necaz: "poșta n-a răspuns pentru acest destinatar" };
    const ok = r.ok;
    const errMsg = r.necaz;

    const logStatus = ok ? "sent" : "failed";
    await ruleaza(
      db,
      `INSERT INTO notifications_log (event_type, message, sunday_date, volunteer_id, status, sent_at, error)
       VALUES ('newsletter', ?, ?, ?, ?, datetime('now'), ?)`,
      ok ? t.logOk(to) : t.logErr(to), t.anchor, Number(admin.id), logStatus, ok ? null : errMsg,
    );
    log.push({ name: numeIntreg(admin), email: to, status: logStatus, category: categoria(admin) });
    if (ok) sent++;
    else { failed++; errors.push(to); }
  }
  return { sent, failed, errors, log };
}

/**
 * Trimite newsletter-ul săptămânal (sau alerta) — newsletter_send().
 * @param filterEmails listă de emailuri permise (null = toți)
 * @param isAlert      subiect [ALERTĂ], tag „ALERTĂ " în log
 * @param isTest       trimitere din admin: intră în arhivă cu is_test=1 și NU atinge idempotența cron-ului
 */
export async function newsletterSend(
  db: D1Database, posta: MediuRaport, filterEmails: string[] | null = null, isAlert = false, isTest = false,
): Promise<SendResult> {
  const sunday = nextSundayDate();
  const data = await newsletterBuildData(db, sunday, posta.nume);
  const html = newsletterRenderHtml(data, posta.acasa);
  const text = newsletterRenderText(data, posta.acasa);
  const subject = isAlert
    ? "[ALERTĂ] Locuri libere - Duminică " + formatDateShort(sunday)
    : "Programare curățenie Duminică (" + formatDateShort(sunday) + ")";

  const admins = await toate<Voluntar>(db, "SELECT * FROM volunteers WHERE is_admin = 1 AND is_active = 1 AND email IS NOT NULL AND email != ''");
  const monitors = await toate<Voluntar>(db, "SELECT * FROM volunteers WHERE is_monitor = 1 AND is_active = 1 AND email IS NOT NULL AND email != ''");
  const scheduled = await toate<Voluntar>(
    db,
    `SELECT DISTINCT v.* FROM volunteers v JOIN assignments a ON a.volunteer_id = v.id
      WHERE a.sunday_date = ? AND v.is_active = 1 AND v.email IS NOT NULL AND v.email != ''`,
    sunday,
  );
  const vacIds = await idVacantaInLuna(db, Number(sunday.slice(0, 4)), Number(sunday.slice(5, 7)));
  const dest = filtreaza(combina(admins, monitors, scheduled), vacIds, filterEmails);

  const tag = isAlert ? "ALERTĂ " : "";
  const r = await trimiteTuturor(db, posta, dest, {
    subject, html, text, anchor: sunday,
    fel: isAlert ? "alert" : "weekly",
    deProba: isTest,
    logOk: (to) => `${tag}Newsletter trimis lui ${to} pentru duminica ${sunday}`,
    logErr: (to) => `Eroare trimitere ${tag}newsletter către ${to}`,
  });

  if (r.sent > 0 || r.failed > 0) {
    if (!isTest) await puneSetarea(db, "newsletter_last_sent_at", dataLocala("Y-m-d H:i:s"));
    await ruleaza(
      db,
      `INSERT INTO newsletter_history (sunday_date, subject, html_content, recipients_count, failed_count, recipients_json, is_test)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      sunday, subject, html, r.sent, r.failed, JSON.stringify(r.log), isTest ? 1 : 0,
    );
  }
  return { sent: r.sent, failed: r.failed, errors: r.errors, sunday };
}

// --- Lunar -------------------------------------------------------------------------

export interface SundayBlock {
  date: string;
  date_label: string;
  liturgical: string;
  slot_count: number;
  slots: Record<number, string | null>;
  occupied: number;
  free_count: number;
  is_filled: boolean;
}

export interface MonthlyData {
  year: number;
  month: number;
  month_label: string;
  sunday_blocks: SundayBlock[];
  sundays_count: number;
  total_slots_filled: number;
  total_slots_baseline: number;
  total_volunteers: number;
  on_vacation: number;
  active_volunteers: number;
  slots_needed: number;
  vacation_capacity: number;
  shortage: number;
}

export async function newsletterBuildMonthlyData(db: D1Database, year: number, month: number, nume: NumeDuminici): Promise<MonthlyData> {
  const sundays = duminicileLunii(year, month);
  const byDay = await programarileLunii(db, year, month);

  const blocks: SundayBlock[] = [];
  let totalFilled = 0;
  let totalBaseline = 0;
  for (const sunday of sundays) {
    const occupied = byDay[sunday] ?? {};
    const positions = Object.keys(occupied).map(Number);
    const maxPos = positions.length ? Math.max(...positions) : 0;
    const slotCount = Math.max(MIN_VOLUNTARI, maxPos);
    const slots: Record<number, string | null> = {};
    for (let i = 1; i <= slotCount; i++) {
      const row = occupied[i];
      slots[i] = row ? numeIntreg(row) : null;
    }
    const occupiedCount = positions.length;
    const freeCount = Math.max(0, MIN_VOLUNTARI - occupiedCount);
    totalFilled += occupiedCount;
    totalBaseline += MIN_VOLUNTARI;
    blocks.push({
      date: sunday,
      date_label: formatDateRo(sunday),
      liturgical: nume(sunday),
      slot_count: slotCount,
      slots,
      occupied: occupiedCount,
      free_count: freeCount,
      is_filled: occupiedCount >= MIN_VOLUNTARI,
    });
  }

  const totalVolunteers = await numar(db, "SELECT COUNT(*) FROM volunteers WHERE is_active = 1 AND is_volunteer = 1");
  const onVacation = await numar(
    db,
    `SELECT COUNT(DISTINCT vc.volunteer_id) FROM volunteer_vacations vc JOIN volunteers v ON v.id = vc.volunteer_id
      WHERE vc.year = ? AND vc.month = ? AND v.is_active = 1 AND v.is_volunteer = 1`,
    year, month,
  );
  const activeVolunteers = Math.max(0, totalVolunteers - onVacation);
  const sundaysCount = blocks.length;
  const slotsNeeded = sundaysCount * MIN_VOLUNTARI;

  return {
    year,
    month,
    month_label: `${LUNI_RO_MICI[month]} ${year}`,
    sunday_blocks: blocks,
    sundays_count: sundaysCount,
    total_slots_filled: totalFilled,
    total_slots_baseline: totalBaseline,
    total_volunteers: totalVolunteers,
    on_vacation: onVacation,
    active_volunteers: activeVolunteers,
    slots_needed: slotsNeeded,
    vacation_capacity: Math.max(0, activeVolunteers - slotsNeeded),
    shortage: Math.max(0, slotsNeeded - activeVolunteers),
  };
}

const ucfirst = (s: string): string => (s ? (s[0] ?? "").toUpperCase() + s.slice(1) : s);

export function newsletterRenderHtmlMonthly(data: MonthlyData, acasa: string): string {
  const app_url = acasa;
  const font = FONT;

  let sundaysHtml = "";
  for (const block of data.sunday_blocks) {
    let rows = "";
    for (let i = 1; i <= block.slot_count; i++) {
      const name = block.slots[i] ?? null;
      const cell = name
        ? `<strong class="nl-name" style="color:#4f6c3b;font-family:${font};">${esc(name)}</strong>`
        : `<span class="nl-free" style="color:#b04848;font-family:${font};">liber</span>`;
      rows += `<tr>`
        + `<td class="nl-row-label" bgcolor="#f7f5f0" style="padding:6px 10px;border:1px solid #d9d2c2;color:#6b6a5e;background-color:#f7f5f0;font-family:${font};font-size:14px;width:100px;">`
        + `Voluntar ${i}`
        + `</td>`
        + `<td class="nl-row-value" bgcolor="#ffffff" style="padding:6px 10px;border:1px solid #d9d2c2;color:#2b2a26;background-color:#ffffff;font-family:${font};font-size:14px;">`
        + cell
        + `</td>`
        + `</tr>`;
    }
    const statusInline = block.free_count > 0
      ? `<span style="color:#7a5a14;font-size:13px;font-family:${font};">⚠ Mai e nevoie de ${block.free_count} voluntar${block.free_count > 1 ? "i" : ""}</span>`
      : `<span style="color:#4f6c3b;font-size:13px;font-family:${font};">✓ Locuri ocupate</span>`;

    sundaysHtml += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" class="nl-sunday-card" style="background-color:#ffffff;border:1px solid #d9d2c2;margin-bottom:16px;">`
      + `<tr><td bgcolor="#f7f5f0" class="nl-sunday-head" style="padding:10px 14px;background-color:#f7f5f0;border-bottom:1px solid #d9d2c2;">`
      + `<div style="font-family:${font};font-size:16px;color:#4f6c3b;font-weight:600;">${esc(block.date_label)}</div>`
      + `<div class="nl-sunday-litu" style="font-family:${font};font-size:13px;color:#6b6a5e;font-style:italic;margin-top:2px;">${esc(block.liturgical)}</div>`
      + `</td></tr>`
      + `<tr><td style="padding:10px 14px;">`
      + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:6px;">`
      + rows
      + `</table>`
      + statusInline
      + `</td></tr>`
      + `</table>`;
  }

  let h = capHtml("Programare lunară", STIL_LUNAR);
  h += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f5f0" class="nl-wrap" style="background-color:#f7f5f0;padding:20px 0;">`;
  h += `<tr><td align="center" class="nl-wrap" style="background-color:#f7f5f0;">`;
  h += `<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" class="nl-card" style="background-color:#ffffff;width:640px;max-width:640px;border:1px solid #d9d2c2;">`;
  h += `<tr><td class="nl-card" style="padding:28px;background-color:#ffffff;color:#2b2a26;font-family:${font};">`;
  h += `<h2 class="nl-heading" style="margin:0 0 6px;color:#4f6c3b;font-size:22px;font-family:${font};">Programare curățenie - ${esc(ucfirst(data.month_label))}</h2>`;
  h += `<div class="nl-sub" style="color:#6b6a5e;margin-bottom:18px;font-size:14px;font-family:${font};">Albinele Sfântului Ilie - Hanul Colței</div>`;

  const sundaysCount = data.sundays_count;
  const slotsNeeded = data.slots_needed;
  const activeVolunteers = data.active_volunteers;
  const onVacation = data.on_vacation ?? 0;
  const vacationCapacity = data.vacation_capacity;
  const shortage = data.shortage;

  let vacationNote = "";
  const vacPersons = onVacation === 1 ? "voluntar și-a marcat vacanța" : "voluntari și-au marcat vacanța";
  const monthPhrase = "în luna " + esc(data.month_label);
  let conclusion: string;

  if (vacationCapacity > 0) {
    const vacWord = vacationCapacity === 1 ? "persoană poate fi scutită" : "persoane pot fi scutite";
    const base = `Suntem <strong>${activeVolunteers}</strong> voluntari disponibili, `
      + `deci fiecare trebuie să vină <strong>măcar o dată ${monthPhrase}</strong>. `;
    const scutire = `<strong>${vacationCapacity} ${vacWord}</strong> (vacanță, plecări sau alte motive).`;
    if (onVacation > 0) {
      const vacClause = `<strong>${onVacation} ${vacPersons}</strong> în această lună.`;
      conclusion = base + vacClause + " Încă " + scutire;
    } else {
      conclusion = base + "Astfel " + scutire;
    }
  } else if (shortage > 0) {
    const shWord = shortage === 1 ? "persoană va trebui" : "persoane vor trebui";
    conclusion = `Suntem doar <strong>${activeVolunteers}</strong> voluntari disponibili — `
      + `fiecare vine <strong>măcar o dată ${monthPhrase}</strong>, iar `
      + `<strong>${shortage} ${shWord}</strong> să vină de două ori.`;
    if (onVacation > 0) {
      vacationNote = ` <span style="color:#6b6a5e;font-size:13px;">(${onVacation} ${vacPersons} în această lună)</span>`;
    }
  } else {
    conclusion = `Suntem fix <strong>${activeVolunteers}</strong> voluntari disponibili, `
      + `deci fiecare vine <strong>exact o dată ${monthPhrase}</strong> — fără scutiri.`;
    if (onVacation > 0) {
      vacationNote = ` <span style="color:#6b6a5e;font-size:13px;">(${onVacation} ${vacPersons} în această lună)</span>`;
    }
  }

  h += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fdf5e6" class="nl-intro" style="background-color:#fdf5e6;border-left:4px solid #c97a3a;margin:0 0 18px;">`
    + `<tr><td style="padding:16px 18px;color:#2b2a26;background-color:#fdf5e6;font-family:${font};font-size:15px;line-height:1.6;">`
    + `<strong style="color:#2b2a26;font-size:16px;">Bun venit la programul lunii ${esc(data.month_label)}!</strong>`
    + `<p style="margin:10px 0 8px;color:#2b2a26;">`
    + `<strong>${sundaysCount} duminici</strong> &times; <strong>${MIN_VOLUNTARI} voluntari</strong> / duminică = `
    + `<strong>${slotsNeeded} prezențe</strong> necesare.`
    + `</p>`
    + `<p style="margin:0 0 8px;color:#2b2a26;">${conclusion}${vacationNote}</p>`
    + `<p style="margin:0;color:#6b6a5e;font-size:13px;">`
    + `Locurile libere se ocupă direct din aplicație, apăsând pe duminica dorită.`
    + `</p>`
    + `</td></tr></table>`;

  h += sundaysHtml;

  h += `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 0;">`
    + `<tr>`
    + `<td bgcolor="#c97a3a" class="nl-btn" style="background-color:#c97a3a;padding:14px 28px;border-radius:6px;">`
    + `<a href="${esc(app_url)}" target="_blank" `
    + `style="color:#ffffff;text-decoration:none;font-weight:600;font-family:${font};font-size:15px;display:inline-block;line-height:1;">`
    + `Deschideți calendarul</a>`
    + `</td>`
    + `</tr>`
    + `</table>`;

  h += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">`
    + `<tr><td class="nl-footer" style="border-top:1px solid #d9d2c2;padding-top:14px;color:#6b6a5e;font-size:12px;font-family:${font};">`
    + `Email automat. Pentru a vedea sau modifica programările, deschideți calendarul.`
    + `</td></tr></table>`;

  h += `</td></tr></table>`;
  h += `</td></tr></table>`;
  h += `</body></html>`;
  return h;
}

export function newsletterRenderTextMonthly(data: MonthlyData, acasa: string): string {
  const app_url = acasa;
  let out = "Programare curățenie - " + ucfirst(data.month_label) + "\n";
  out += "Albinele Sfântului Ilie - Hanul Colței\n";
  out += "=".repeat(60) + "\n\n";
  out += "Bun venit la programul lunii " + data.month_label + "!\n\n";
  out += `${data.sundays_count} duminici x ${MIN_VOLUNTARI} voluntari / duminică = ${data.slots_needed} prezențe necesare.\n`;
  const onVac = Number(data.on_vacation ?? 0);
  const vp = onVac === 1 ? "voluntar si-a marcat vacanta" : "voluntari si-au marcat vacanta";
  const monthPhraseTxt = "in luna " + data.month_label;

  if (data.vacation_capacity > 0) {
    const vacWord = data.vacation_capacity === 1 ? "persoană poate fi scutită" : "persoane pot fi scutite";
    out += `Suntem ${data.active_volunteers} voluntari disponibili, deci fiecare trebuie să vină macar o dată ${monthPhraseTxt}. `;
    if (onVac > 0) {
      out += `${onVac} ${vp} in aceasta luna. Inca ${data.vacation_capacity} ${vacWord} (vacanță, plecări sau alte motive).\n`;
    } else {
      out += `Astfel ${data.vacation_capacity} ${vacWord} (vacanță, plecări sau alte motive).\n`;
    }
  } else if (data.shortage > 0) {
    const shWord = data.shortage === 1 ? "persoană va trebui" : "persoane vor trebui";
    out += `Suntem doar ${data.active_volunteers} voluntari disponibili - fiecare vine macar o dată ${monthPhraseTxt}, iar ${data.shortage} ${shWord} să vină de două ori.\n`;
    if (onVac > 0) out += `(${onVac} ${vp} in aceasta luna.)\n`;
  } else {
    out += `Suntem fix ${data.active_volunteers} voluntari disponibili, deci fiecare vine exact o dată ${monthPhraseTxt} - fără scutiri.\n`;
    if (onVac > 0) out += `(${onVac} ${vp} in aceasta luna.)\n`;
  }
  out += "Locurile libere se ocupă direct din aplicație.\n\n";

  for (const block of data.sunday_blocks) {
    out += "-".repeat(60) + "\n";
    out += `${block.date_label} (${block.liturgical})\n`;
    for (let i = 1; i <= block.slot_count; i++) {
      const name = block.slots[i] ?? "liber";
      out += `  Voluntar ${i}: ${name}\n`;
    }
    if (block.free_count > 0) {
      out += `  >> Mai e nevoie de ${block.free_count} voluntar${block.free_count > 1 ? "i" : ""}\n`;
    } else {
      out += "  >> Locuri ocupate\n";
    }
    out += "\n";
  }
  out += `\nCalendar: ${app_url}\n`;
  return out;
}

/** Trimite newsletter-ul lunar — newsletter_send_monthly(). */
export async function newsletterSendMonthly(
  db: D1Database, posta: MediuRaport, filterEmails: string[] | null = null, year: number | null = null, month: number | null = null, isTest = false,
): Promise<SendResult> {
  if (year === null || month === null) [year, month] = await newsletterMonthlyTargetMonth(db);

  const data = await newsletterBuildMonthlyData(db, year, month, posta.nume);
  const html = newsletterRenderHtmlMonthly(data, posta.acasa);
  const text = newsletterRenderTextMonthly(data, posta.acasa);
  const subject = "Programare curățenie - " + ucfirst(data.month_label);
  const anchor = data.sunday_blocks[0]?.date ?? ymdDin(year, month, 1);

  const admins = await toate<Voluntar>(db, "SELECT * FROM volunteers WHERE is_admin = 1 AND is_active = 1 AND email IS NOT NULL AND email != ''");
  const monitors = await toate<Voluntar>(db, "SELECT * FROM volunteers WHERE is_monitor = 1 AND is_active = 1 AND email IS NOT NULL AND email != ''");
  const scheduled = await toate<Voluntar>(
    db, "SELECT * FROM volunteers WHERE is_active = 1 AND is_volunteer = 1 AND email IS NOT NULL AND email != '' ORDER BY first_name, last_name",
  );
  const vacIds = await idVacantaInLuna(db, year, month);
  const dest = filtreaza(combina(admins, monitors, scheduled), vacIds, filterEmails);

  const r = await trimiteTuturor(db, posta, dest, {
    subject, html, text, anchor,
    fel: "monthly",
    deProba: isTest,
    logOk: (to) => `Newsletter LUNAR trimis lui ${to} pentru ${data.month_label}`,
    logErr: (to) => `Eroare trimitere newsletter LUNAR către ${to}`,
  });

  if (r.sent > 0 || r.failed > 0) {
    if (!isTest) {
      await puneSetarea(db, "newsletter_monthly_last_sent_at", dataLocala("Y-m-d H:i:s"));
      await puneSetarea(db, "newsletter_monthly_last_sent_for_ym", `${year}-${String(month).padStart(2, "0")}`);
    }
    await ruleaza(
      db,
      `INSERT INTO newsletter_history (sunday_date, subject, html_content, recipients_count, failed_count, kind, recipients_json, is_test)
       VALUES (?, ?, ?, ?, ?, 'monthly', ?, ?)`,
      anchor, subject, html, r.sent, r.failed, JSON.stringify(r.log), isTest ? 1 : 0,
    );
  }
  return { sent: r.sent, failed: r.failed, errors: r.errors, month_label: data.month_label, year, month };
}
