/**
 * Timp și date — echivalentul lui date()/DateTime din PHP, cu fusul fixat pe Europe/Bucharest.
 *
 * Regula (memory.md §17.2): SQLite/D1 scrie `datetime('now')` în UTC; tot ce se AFIȘEAZĂ trece
 * prin `formatDtLocal()`. Datele de calendar („2026-05-17") sunt zile de perete, fără fus —
 * se socotesc în UTC ca să nu sară niciodată cu o zi.
 */

import { LUNI_RO_MICI, FUS } from "./config.js";

export interface Moment {
  y: number; m: number; d: number;
  /** 0 = duminică … 6 = sâmbătă (ca date('w') din PHP). */
  w: number;
  h: number; i: number; s: number;
  /** YYYY-MM-DD */
  ymd: string;
}

const ZILE_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ZILE_EN_LUNGI = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LUNI_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LUNI_EN_LUNGI = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: FUS,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  weekday: "short",
});

export const pad = (n: number, l = 2): string => String(n).padStart(l, "0");

/** Componentele unui moment absolut, la ora de perete a Bucureștiului. */
export function momentLocal(date: Date = new Date()): Moment {
  const p = FMT.formatToParts(date);
  const c = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const y = Number(c("year"));
  const m = Number(c("month"));
  const d = Number(c("day"));
  let h = Number(c("hour"));
  if (h === 24) h = 0;
  const w = Math.max(0, ZILE_EN.indexOf(c("weekday")));
  return { y, m, d, w, h, i: Number(c("minute")), s: Number(c("second")), ymd: `${y}-${pad(m)}-${pad(d)}` };
}

/** „Acum", local. */
export const acum = (): Moment => momentLocal(new Date());

/** date('…') din PHP pe un Moment — numai tokenii folosiți de aplicație. */
export function formatMoment(mo: Moment, fmt: string): string {
  let out = "";
  for (let k = 0; k < fmt.length; k++) {
    const ch = fmt[k];
    switch (ch) {
      case "d": out += pad(mo.d); break;
      case "j": out += String(mo.d); break;
      case "m": out += pad(mo.m); break;
      case "n": out += String(mo.m); break;
      case "Y": out += String(mo.y); break;
      case "y": out += pad(mo.y % 100); break;
      case "H": out += pad(mo.h); break;
      case "G": out += String(mo.h); break;
      case "i": out += pad(mo.i); break;
      case "s": out += pad(mo.s); break;
      case "w": out += String(mo.w); break;
      case "N": out += String(mo.w === 0 ? 7 : mo.w); break;
      case "t": out += String(zileInLuna(mo.y, mo.m)); break;
      case "D": out += ZILE_EN[mo.w]; break;
      case "l": out += ZILE_EN_LUNGI[mo.w]; break;
      case "M": out += LUNI_EN[mo.m - 1]; break;
      case "F": out += LUNI_EN_LUNGI[mo.m - 1]; break;
      case "\\": k++; if (k < fmt.length) out += fmt[k]; break;
      default: out += ch;
    }
  }
  return out;
}

/** date($fmt) din PHP, pe ora locală de acum. */
export const dataLocala = (fmt: string, date: Date = new Date()): string => formatMoment(momentLocal(date), fmt);

/** `datetime('now')` din SQLite: UTC, „YYYY-MM-DD HH:MM:SS". */
export function sqlNow(date: Date = new Date()): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Convertește un datetime UTC (cum îl scrie SQLite) în formatul cerut, la ora Bucureștiului.
 * Echivalentul lui format_dt_local() din lib/db.php. Un șir neînțeles se întoarce ca atare.
 */
export function formatDtLocal(utcStr: string | null | undefined, fmt = "d.m.Y H:i"): string {
  if (!utcStr) return "";
  const m = utcStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return utcStr;
  const date = new Date(Date.UTC(+(m[1] ?? 0), +(m[2] ?? 1) - 1, +(m[3] ?? 1), +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)));
  if (Number.isNaN(date.getTime())) return utcStr;
  return formatMoment(momentLocal(date), fmt);
}

// --- Zile de calendar (fără fus) ------------------------------------------------

/** Moment „de perete" pentru o dată YYYY-MM-DD (ora 00:00), ca să aplicăm formatMoment(). */
export function momentDinYmd(ymd: string): Moment {
  const [y = 1970, m = 1, d = 1] = ymd.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, w, h: 0, i: 0, s: 0, ymd: `${y}-${pad(m)}-${pad(d)}` };
}

export const ymdDin = (y: number, m: number, d: number): string => `${y}-${pad(m)}-${pad(d)}`;

export function zileInLuna(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 0 = duminică. */
export function ziuaSaptamanii(ymd: string): number {
  return momentDinYmd(ymd).w;
}

export function adaugaZile(ymd: string, n: number): string {
  const [y = 1970, m = 1, d = 1] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return ymdDin(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export const eYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** „17 mai 2026" — format_date_ro(). */
export function formatDateRo(ymd: string): string {
  const mo = momentDinYmd(ymd);
  return `${mo.d} ${LUNI_RO_MICI[mo.m]} ${mo.y}`;
}

/** „17.05.2026" — format_date_short(). */
export function formatDateShort(ymd: string): string {
  const mo = momentDinYmd(ymd);
  return `${pad(mo.d)}.${pad(mo.m)}.${mo.y}`;
}
