/**
 * Panoul curățeniei — `admin/index.php` din V1, la `/admin`.
 *
 * Filele:
 *   - **Voluntari**: cartelele echipei, adăugare și editare (fereastră), comutatoarele
 *     Activ / Voluntar / Admin / Monitor;
 *   - **Newsletter**: Alertă · Săptămânal · Lunar · Arhivă — cu previzualizarea scrisorii, ziua și
 *     ora la care pleacă, și „Trimite acum" cu bife pe destinatari;
 *   - **Mesaje de sistem**: ultimele 200 de rânduri din jurnal, filtrabile pe fel.
 *
 * ⚠️ **Poarta e permisiunea centrală `cleaning.manage`**, nu parola locală din V1. Au ieșit cu
 * totul: pagina de autentificare cu parolă, hash-urile bcrypt, resetarea prin email, fila „Schimbă
 * parola" și „modul de inițializare" (în care panoul era deschis cât timp nu exista niciun admin —
 * n-are rost acum, dreptul nu poate lipsi). `is_admin` din tabel a rămas doar ETICHETĂ a echipei:
 * cine e „Admin" pe cartelă și primește rapoartele din oficiu.
 *
 * Sistemul de update al PHP-ului (folderul `update/`, bannerul „X fișiere de update") nu există:
 * publicarea e `wrangler deploy`, iar data ei vine din `version_metadata`.
 */

import { LUNI_RO_MICI, MIN_VOLUNTARI } from "../config.js";
import {
  asiguraRandul, catiAdmini, voluntarDupaId, ultimaMiscare, numar, curataDiacritice, ruleaza, setare,
  puneSetarea, toate, totiVoluntarii, unu, slugUnic, valoare, idVacantaInLuna, numeScurt,
  type Voluntar,
} from "../depozit.js";
import { esc, html, json } from "@xc/ui";
import { duTe, eAjax } from "../html.js";
import { type Ctx, campCsrf, pagina, paginaMesaj } from "../pagina.js";
import {
  allActiveVolunteerEmails, newsletterBuildData, newsletterBuildMonthlyData, newsletterMonthlyNextSchedule,
  newsletterRenderHtml, newsletterRenderHtmlMonthly, newsletterSend, newsletterSendMonthly, nextSundayDate,
  nextSundayOccupiedCount, type MediuRaport,
} from "../newsletter.js";
import { buildVolunteerAddedMessage, sendNotification } from "../notificari.js";
import { acum, adaugaZile, formatDateRo, formatDtLocal, formatMoment, momentDinYmd, type Moment } from "../timp.js";
import { ADMIN_FAQ } from "./faq.js";
import {
  CHEIE_ADMIN, ETICHETA_ADMIN, ETICHETA_MONITOR, ETICHETA_VOLUNTAR,
  primesteInEchipa, scoateDinEchipa, scrieDatele, scrieEtichetele, totiUtilizatorii,
  type Baza,
} from "../oameni.js";
import type { MembruAplicatie } from "@xc/contracts";

type Flash = [string, string];

const WEEKDAY_NAMES = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];

/** Mesajele de slot se scriu în jurnal, nu pleacă pe WhatsApp — ca în V1 (`mode = 'log'`). */
const NOTIFICATIONS_MODE = "log";

// --- Helperi locali ----------------------------------------------------------------

/**
 * `$_POST` pentru panou: la fel ca `citestePost()`, dar păstrează și lista `recipients[]` (bifele
 * din „Trimite acum"). `recipients` = `null` când cheia lipsește cu totul — atunci se trimite la
 * toată lista, ca în V1 (`!isset($_POST['recipients'])`).
 */
export async function citestePostAdmin(request: Request): Promise<{ post: Record<string, string>; recipients: string[] | null }> {
  const post: Record<string, string> = {};
  let recipients: string[] | null = null;
  const ct = request.headers.get("content-type") ?? "";
  if (!/multipart\/form-data|application\/x-www-form-urlencoded/i.test(ct)) return { post, recipients };
  try {
    const fd = await request.formData();
    for (const [k, v] of fd.entries()) {
      if (typeof v !== "string") continue;
      if (k === "recipients[]") {
        (recipients ??= []).push(v);
        continue;
      }
      post[k] = v;
    }
  } catch {
    /* corp gol sau stricat */
  }
  return { post, recipients };
}

const numeIntreg = (v: { first_name: string; last_name?: string | null }): string => `${v.first_name} ${v.last_name ?? ""}`.trim();

/** Un șir „Y-m-d H:i:s" LOCAL (cum scrie cronul) → Moment de perete, fără conversie de fus. */
function momentDinLocal(s: string): Moment | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const base = momentDinYmd(`${m[1]}-${m[2]}-${m[3]}`);
  return { ...base, h: +(m[4] ?? 0), i: +(m[5] ?? 0), s: +(m[6] ?? 0) };
}

/** Secunde „de perete" pentru un Moment (ca să scădem două ore locale între ele). */
const secundeDePerete = (mo: Moment): number => Date.UTC(mo.y, mo.m - 1, mo.d, mo.h, mo.i, mo.s) / 1000;

/**
 * Beculețul ceasului: bătaia (`newsletter_cron_last_check`) e scrisă ca „Y-m-d H:i:s" LOCAL, ca în
 * V1, și se compară cu ora locală de acum — verde sub 90 de minute. Ceasul e Cron Trigger-ul
 * workerului, deci „Inactiv" se caută în Cloudflare, nu în cPanel.
 */
async function statusCron(db: Baza, mo: Moment, variant: "alert" | "weekly" | "monthly"): Promise<{ status: string; label: string; title: string }> {
  const last = await setare(db, "newsletter_cron_last_check", null);
  let status = "never";
  let label = "Neverificat";
  let title = variant === "weekly"
    ? "Cron-ul nu a rulat încă. Așteaptă prima oră completă după setare."
    : "Cron-ul nu a rulat încă.";
  if (last) {
    const lm = momentDinLocal(last);
    const diff = lm ? secundeDePerete(mo) - secundeDePerete(lm) : Number.POSITIVE_INFINITY;
    const cand = lm ? formatMoment(lm, "d.m.Y H:i") : last;
    if (diff < 5400) {
      status = "ok";
      label = "Activ";
      title = `Cron-ul a rulat la ${cand}.` + (variant === "weekly" ? " Totul OK." : "");
    } else {
      status = "fail";
      label = "Inactiv";
      title = `Cron-ul nu a mai rulat de la ${cand}.` + (variant === "weekly" ? " Verifică Cron Trigger-ul workerului." : "");
    }
  }
  return { status, label, title };
}

/** „Vineri, 12 iunie 2026" — următoarea rulare programată (zi + oră), pe ora locală de acum. */
function urmatoareaRulare(mo: Moment, wd: number, hr: number): string {
  let daysUntil = (wd - mo.w + 7) % 7;
  if (daysUntil === 0 && mo.h >= hr) daysUntil = 7;
  const t = momentDinYmd(adaugaZile(mo.ymd, daysUntil));
  return `${WEEKDAY_NAMES[wd]}, ${t.d} ${LUNI_RO_MICI[t.m]} ${t.y}`;
}

const oraHH = (h: number): string => `${String(h).padStart(2, "0")}:00`;

function optiuniOre(cur: number): string {
  let out = "";
  for (let h = 0; h < 24; h++) {
    out += `<option value="${h}" ${h === cur ? "selected" : ""}>
                                            ${oraHH(h)}
                                        </option>
                                    `;
  }
  return out;
}

function optiuniZile(cur: number): string {
  return WEEKDAY_NAMES.map((n, i) => `<option value="${i}" ${i === cur ? "selected" : ""}>
                                            ${esc(n)}
                                        </option>`).join("\n                                    ");
}

// --- Destinatari (comun pentru Alertă / Săptămânal / Lunar) ------------------------------

interface Dest { id: number; first_name: string; last_name: string; email: string | null }

/**
 * Cele trei coloane de destinatari ale ecranelor de raport. Erau trei interogări SQL; de pe
 * 14.09.2026 se cern din ECHIPĂ, fiindcă etichetele și adresele stau la identitate.
 * Cine n-are adresă pe cont rămâne în listă, dar scris roșu — ecranul trebuie să arate lipsa,
 * nu s-o ascundă (purtarea din V1).
 */
async function coloaneDestinatari(db: Baza): Promise<{ admini: Dest[]; monitori: Dest[]; voluntari: Dest[] }> {
  const catreDest = (v: Voluntar): Dest => ({
    id: v.id, first_name: v.first_name, last_name: v.last_name, email: v.email,
  });
  const echipa = (await totiVoluntarii(db))
    .filter((v) => v.is_active === 1)
    .sort((a, b) => a.first_name.localeCompare(b.first_name, "ro", { sensitivity: "base" }));
  return {
    admini: echipa.filter((v) => v.is_admin === 1).map(catreDest),
    monitori: echipa.filter((v) => v.is_monitor === 1).map(catreDest),
    voluntari: echipa.filter((v) => v.is_volunteer === 1).map(catreDest),
  };
}

/** Lista vizuală a unei coloane de destinatari ($fmt_list). */
function fmtList(items: Dest[], vac: Set<number>): string {
  return items.map((a) => {
    const name = numeIntreg(a);
    const email = String(a.email ?? "").trim();
    const vid = Number(a.id ?? 0);
    const onVac = vid > 0 && vac.has(vid);
    const vacCls = onVac ? " on-vacation" : "";
    const vacTip = onVac ? " (în vacanță — nu primește email)" : "";
    if (email === "") {
      return `<div class="recipient-row${vacCls}">`
        + `<span style="color:var(--danger);">${esc(name)}</span>`
        + ` <span class="info-icon" title="Email lipsă"`
        + ` style="display:inline-flex;align-items:center;justify-content:center;`
        + `width:14px;height:14px;border-radius:50%;background:var(--danger);`
        + `color:#fff;font-size:0.65rem;font-weight:700;font-style:italic;`
        + `font-family:Georgia,serif;cursor:help;">i</span>`
        + `</div>`;
    }
    return `<div class="recipient-row${vacCls}">`
      + `<a href="mailto:${esc(email)}" `
      + `title="${esc(email + vacTip)}" `
      + `style="color:var(--accent-dark);text-decoration:none;border-bottom:1px dotted var(--accent-dark);">`
      + esc(name)
      + `</a></div>`;
  }).join("");
}

interface Rec { name: string; email: string; category: string; on_vacation: boolean }

/** Pool-ul real de trimitere, deduplicat pe email (lower-case), în ordinea inserării ($add_to_pool). */
function adaugaInPool(pool: Map<string, Rec>, items: Dest[], category: string, vac: Set<number>): void {
  for (const it of items) {
    const em = String(it.email ?? "").trim().toLowerCase();
    if (em === "" || pool.has(em)) continue;
    const vid = Number(it.id ?? 0);
    pool.set(em, {
      name: numeIntreg(it),
      email: String(it.email),
      category,
      on_vacation: vid > 0 && vac.has(vid),
    });
  }
}

/** Checkbox-urile din panoul „Trimite acum" (identice în cele trei tab-uri). */
function listaBifeDestinatari(pool: Map<string, Rec>): string {
  return [...pool.values()].map((rec) => {
    const onVac = rec.on_vacation;
    const isDefaultChecked = rec.category === "Admin" && !onVac;
    return `<label class="send-recipient${onVac ? " on-vacation" : ""}"
                                           title="${onVac ? "În vacanță — nu poate primi email" : ""}">
                                        <input type="checkbox" name="recipients[]"
                                               value="${esc(rec.email)}"
                                               ${isDefaultChecked ? "checked" : ""}
                                               ${onVac ? "disabled" : ""}>
                                        <span class="send-rec-text">
                                            <strong class="send-rec-name">${esc(rec.name)}</strong>
                                            <span class="send-rec-email">(${esc(rec.email)})</span>
                                        </span>
                                        <span class="send-rec-cat">${esc(rec.category)}</span>
                                    </label>`;
  }).join("\n                                ");
}

/** „Total destinatari unici: N — dintre care X în vacanță, Y vor primi email." */
function totalDestinatari(pool: Map<string, Rec>): string {
  const total = pool.size;
  let onVac = 0;
  for (const rec of pool.values()) if (rec.on_vacation) onVac++;
  const willSend = total - onVac;
  return `<div style="font-size:0.85rem;color:var(--text-muted);margin-top:8px;">
                    Total destinatari unici: <strong style="color:var(--text);">${total}</strong>
                    ${onVac > 0 ? `— dintre care
                        <strong style="color:var(--text);">${onVac}</strong>
                        în vacanță,
                        <strong style="color:var(--accent-dark);">${willSend}</strong>
                        ${willSend === 1 ? "va primi" : "vor primi"} email.` : ""}
                </div>`;
}

const badgeCron = (c: { status: string; label: string; title: string }): string =>
  `<span class="cron-status cron-status-${c.status}" title="${esc(c.title)}">
                        <span class="cron-led"></span>
                        Status: ${esc(c.label)}
                    </span>`;

// =========================================================================================

/**
 * Comută o etichetă („Voluntar", „Monitor") pe asocierea omului. Etichetele stau de pe 14.09.2026
 * la identitate, nu în tabelul aplicației: se citesc din cartea oamenilor și se scriu întregi.
 */
async function comutaEticheta(
  env: MediuAdmin,
  db: Baza,
  id: number,
  eticheta: string,
  isAjax: boolean,
  mesaj: string,
): Promise<Response> {
  const target = await voluntarDupaId(db, id);
  if (!target) throw new Error("Voluntar inexistent.");
  const etichete = new Set(db.oameni.om(target.user_id)?.etichete ?? []);
  const pornit = !etichete.has(eticheta);
  if (pornit) etichete.add(eticheta);
  else etichete.delete(eticheta);
  await scrieEtichetele(env, target.user_id, [...etichete]);
  if (isAjax) return json({ ok: true, state: pornit ? 1 : 0 });
  return json({ ok: true, message: mesaj });
}

/**
 * Cheia de administrare a curățeniei, acordată pe om la autorizarea centrală. E un grant punctual
 * (ca `library.borrow`), nu un rol: un administrator al curățeniei nu capătă nimic altceva.
 */
async function acordaAdmin(env: MediuAdmin, userId: string): Promise<void> {
  await env.AUTORIZARE.fetch("https://authz.intern/acorda", {
    method: "POST",
    headers: { "content-type": "application/json", "x-correlation-id": env.cid },
    body: JSON.stringify({ userId, permission: CHEIE_ADMIN, scope: "global" }),
  });
}

async function retrageAdmin(env: MediuAdmin, userId: string): Promise<void> {
  await env.AUTORIZARE.fetch("https://authz.intern/retrage", {
    method: "POST",
    headers: { "content-type": "application/json", "x-correlation-id": env.cid },
    body: JSON.stringify({ userId, permission: CHEIE_ADMIN, scope: "global" }),
  });
}

/** Ce are nevoie panoul din mediu, în afară de bază. */
export interface MediuAdmin {
  DB: Baza;
  posta: MediuRaport;
  /** Identitatea: de acolo vin oamenii, acolo se scriu asocierile și etichetele. */
  IDENTITATE: Fetcher;
  /** Autorizarea: eticheta „Admin" acordă și retrage cu adevărat `cleaning.manage`. */
  AUTORIZARE: Fetcher;
  /** Contul celui care apasă — se scrie pe asocierea pe care o primește. */
  actor: string | null;
  cid: string;
}

/**
 * Panoul. Cine n-are `cleaning.manage` nu ajunge până aici — poarta o ține `index.ts`, ca la toate
 * aplicațiile V2. Un POST vine deja cu jetonul CSRF verificat.
 */
export async function paginaAdmin(
  ctx: Ctx,
  env: MediuAdmin,
  request: Request,
  url: URL,
  postDat: { post: Record<string, string>; recipients: string[] | null } | null,
): Promise<Response> {
  const db = env.DB;
  const posta = env.posta;

  const isAjax = eAjax(request);
  const isPost = request.method === "POST";
  const { post, recipients } = postDat ?? { post: {} as Record<string, string>, recipients: null };
  const action = post.action ?? "";
  /** Toate filele sunt deschise: poarta a fost trecută deja, nu mai există o a doua parolă. */
  const adminAuthed = true;

  let tab = url.searchParams.get("tab") ?? "voluntari";
  // Backward compat: vechiul ?tab=newsletter redirectează la prima sub-pagină.
  if (tab === "newsletter") tab = "alert";
  // Tab-urile care fac parte din secțiunea „Newsletter" (afișează sub-meniu).
  const isNewsletterSection = ["alert", "weekly", "monthly", "archive"].includes(tab);
  let flash: Flash | null = null;

  /*
   * Toți oamenii platformei, cu starea asocierii lor. De aici iese lista „+ Adaugă": cei cu
   * `stare: null` sunt neasociați cu curățenia. Se cere o singură dată, și numai pe fila echipei
   * ori la o primire — celelalte file (rapoarte, arhivă) n-au ce face cu ea.
   */
  const areNevoieDeOameni = tab === "voluntari" || action === "add_volunteer";
  const totiOamenii: MembruAplicatie[] = areNevoieDeOameni ? await totiUtilizatorii(env) : [];

  // ----- Acțiuni POST ------------------------------------------------------
  if (isPost) {
    const cereAdmin = (): void => {
      if (!adminAuthed) throw new Error("Trebuie să fii autentificat ca admin.");
    };
    const idDin = (): number => parseInt(post.id ?? "0", 10) || 0;

    try {
      switch (action) {
        /*
         * PRIMIREA ÎN ECHIPĂ (user, 14.09.2026). A luat locul lui „Adaugă voluntar", care năștea
         * un om nou în baza aplicației. Acum nu se mai naște nimeni aici: se ia un cont care
         * EXISTĂ pe platformă și i se aprinde asocierea cu curățenia.
         *
         * Același drum servește și cererile în așteptare — „Primește" de pe o cerere trimite
         * exact aceeași acțiune. De asta n-are nevoie să știe dacă omul a cerut sau nu.
         */
        case "add_volunteer": {
          cereAdmin();
          const userId = (post.user_id ?? "").trim();
          if (userId === "") throw new Error("Alege un utilizator din listă.");
          const om = db.oameni.om(userId) ?? totiOamenii.find((u) => u.userId === userId);
          if (!om) throw new Error("Utilizator inexistent pe platformă.");

          const prenume = (om.firstName ?? "").trim();
          const numeFam = (om.lastName ?? "").trim();
          // Rândul local (cheia de care atârnă programările) se face acum, dacă nu exista deja.
          // Dacă omul a mai fost în echipă cândva, rândul lui vechi se reia — cu istoric cu tot.
          const newId = await asiguraRandul(db, userId, prenume, numeFam);
          // Cine intră e voluntar din oficiu; restul etichetelor se pun din comutatoare.
          const etichete = [...new Set([...(om.etichete ?? []), ETICHETA_VOLUNTAR])];
          await primesteInEchipa(env, userId, env.actor ?? userId, etichete);

          const nume = numeScurt({ first_name: prenume, last_name: numeFam, short_name: om.shortName });
          const msg = buildVolunteerAddedMessage({ first_name: prenume, last_name: numeFam });
          await sendNotification(db, "volunteer_added", msg, { volunteer_id: newId });

          const msgOk = "Primit în echipă: " + nume;
          if (isAjax) return json({ ok: true, message: msgOk, reload: true });
          flash = ["ok", msgOk];
          break;
        }

        /**
         * Refuzul unei cereri, de pe lista Cererilor. Omul n-are încă rând local, deci se lucrează
         * pe contul lui: asocierea se șterge cu totul. Poate cere din nou oricând.
         */
        case "refuza_cererea": {
          cereAdmin();
          const userId = (post.user_id ?? "").trim();
          if (userId === "") throw new Error("Cerere incompletă.");
          await scoateDinEchipa(env, userId, env.actor ?? userId);
          const om = totiOamenii.find((u) => u.userId === userId);
          const msgOk = "Cerere refuzată" + (om ? ": " + numeDinCont(om) : "") + ".";
          if (isAjax) return json({ ok: true, message: msgOk, reload: true });
          flash = ["ok", msgOk];
          break;
        }

        /** Refuzul unei cereri, ori scoaterea cuiva din echipă. Rândul local rămâne: istoricul e al lui. */
        case "remove_volunteer": {
          cereAdmin();
          const id = idDin();
          const target = await voluntarDupaId(db, id);
          if (!target) throw new Error("Voluntar inexistent.");
          await scoateDinEchipa(env, target.user_id, env.actor ?? target.user_id);
          // Cine iese din echipă iese și din administrarea ei: altfel ar rămâne cu cheia în ușă.
          if (target.is_admin === 1) await retrageAdmin(env, target.user_id);
          const msgOk = numeScurt(target) + (target.in_asteptare ? " — cerere refuzată." : " nu mai e în echipă.");
          if (isAjax) return json({ ok: true, message: msgOk, reload: true });
          flash = ["ok", msgOk];
          break;
        }

        case "toggle_volunteer":
          return await comutaEticheta(env, db, idDin(), ETICHETA_VOLUNTAR, isAjax, "Status voluntar actualizat.");

        case "toggle_monitor":
          return await comutaEticheta(env, db, idDin(), ETICHETA_MONITOR, isAjax, "Status monitor actualizat.");

        /*
         * NUMIREA UNUI ADMINISTRATOR AL CURĂȚENIEI (user, 14.09.2026: „să fie totuși o validare la
         * nivel de admin.curatenie — numit doar de alt admin sau superadmin… nici chiar oricine nu
         * poate ajunge în acest punct").
         *
         * ⚠️ Comutatorul ăsta NU mai e o etichetă, cum a fost la portare: el ACORDĂ și RETRAGE cu
         * adevărat `cleaning.manage`, la autorizarea centrală. Cine îl apasă are deja cheia — panoul
         * o cere ca să se deschidă — deci un admin al curățeniei e numit numai de alt admin al ei
         * sau de un super-admin, care o are din rol.
         */
        case "toggle_admin": {
          cereAdmin();
          const id = idDin();
          const target = await voluntarDupaId(db, id);
          if (!target) throw new Error("Voluntar inexistent.");
          const newAdmin = Number(target.is_admin) === 1 ? 0 : 1;

          if (!newAdmin) {
            // Ultimul administrator nu se stinge: altfel n-ar mai avea cine primi pe nimeni în
            // echipă. (Un super-admin tot ar putea intra — cheia îi vine din rol — dar aici nu ne
            // bizuim pe asta: echipa trebuie să se poată conduce singură.)
            const cati = await catiAdmini(db);
            if (cati <= 1) {
              throw new Error("E singurul administrator al curățeniei. Numește întâi pe altcineva, apoi scoate-l pe el.");
            }
          }

          const etichete = new Set(db.oameni.om(target.user_id)?.etichete ?? []);
          if (newAdmin) {
            etichete.add(ETICHETA_ADMIN);
            // Adminii sunt automat și monitori (primesc rapoartele).
            etichete.add(ETICHETA_MONITOR);
          } else {
            etichete.delete(ETICHETA_ADMIN);
          }
          await scrieEtichetele(env, target.user_id, [...etichete]);
          if (newAdmin) await acordaAdmin(env, target.user_id);
          else await retrageAdmin(env, target.user_id);

          if (isAjax) {
            return json({
              ok: true,
              state: newAdmin,
              monitor_on: newAdmin === 1,
              message: newAdmin
                ? numeScurt(target) + " e acum administrator al curățeniei: poate primi oameni în echipă și primește rapoartele."
                : "Administrarea curățeniei i-a fost retrasă lui " + numeScurt(target) + ".",
            });
          }
          flash = ["ok", newAdmin ? numeScurt(target) + " e acum administrator al curățeniei." : "Administrarea i-a fost retrasă lui " + numeScurt(target) + "."];
          break;
        }

        /*
         * Îndreptarea fișei cuiva. Datele NU mai sunt ale aplicației: se scriu la identitate, pe
         * contul omului, și se văd de acolo peste tot. E-mailul nu se poate schimba de aici — el e
         * cheia contului, iar schimbarea lui e a omului, de pe pagina lui.
         */
        case "update_volunteer": {
          cereAdmin();
          const id = idDin();
          const target = await voluntarDupaId(db, id);
          if (!target) throw new Error("Voluntar inexistent.");
          const first = (post.first_name ?? "").trim();
          const last = (post.last_name ?? "").trim();
          const phone = (post.phone ?? "").trim();

          if (first === "" || last === "") {
            throw new Error("Prenume și nume sunt obligatorii.");
          }

          // Slug: dacă e completat manual, validăm și folosim; altfel regenerăm.
          let manualSlug = (post.slug ?? "").trim();
          let slug: string;
          if (manualSlug !== "") {
            manualSlug = curataDiacritice(manualSlug).toLowerCase();
            manualSlug = manualSlug.replace(/[^a-z0-9.]/g, "");
            if (!/^[a-z][a-z0-9.]*$/.test(manualSlug)) {
              throw new Error("Slug invalid. Trebuie să înceapă cu literă și să conțină doar litere mici, cifre și punct.");
            }
            // Verifică unicitatea
            const taken = await unu(db, "SELECT id FROM volunteers WHERE slug = ? AND id != ?", manualSlug, id);
            if (taken) {
              throw new Error(`Slug-ul „${manualSlug}" este deja folosit de alt voluntar.`);
            }
            slug = manualSlug;
          } else {
            slug = await slugUnic(db, first, last, id);
          }
          await ruleaza(db, `UPDATE volunteers SET slug = ?, updated_at = datetime('now') WHERE id = ?`, slug, id);
          await scrieDatele(env, target.user_id, { firstName: first, lastName: last, phone });

          const msgOk = `Fișa a fost actualizată pe contul platformei. Nume scurt: ${slug}`;
          if (isAjax) return json({ ok: true, message: msgOk, reload: true });
          flash = ["ok", msgOk];
          break;
        }

        case "clear_log": {
          cereAdmin();
          const r = await ruleaza(db, "DELETE FROM notifications_log");
          const n = Number(r.meta?.changes ?? 0);
          flash = ["ok", `Log golit (${n} mesaje șterse).`];
          break;
        }

        case "send_alert_now": {
          cereAdmin();
          // Filtru din checkboxes. Dacă lipsește → trimite la toți voluntarii activi.
          let filter: string[] | null = recipients;
          if (filter !== null && filter.length === 0) {
            throw new Error("Nu ai bifat niciun destinatar.");
          }
          if (filter === null) {
            filter = await allActiveVolunteerEmails(db);
            if (filter.length === 0) {
              flash = ["err", "Nu există voluntari activi cu email pentru alertă."];
              break;
            }
          }
          // Marchez ca is_test=1 (trimitere manuală din admin) ca să nu afecteze
          // idempotența cron-ului automat și să poată fi șters cu „Șterge testele".
          const res = await newsletterSend(db, posta, filter, true, true);
          if (res.sent === 0 && res.failed === 0) {
            flash = ["err", "Nu s-a putut trimite alerta."];
          } else {
            let msg = `Alertă trimisă: ${res.sent} destinatari`;
            if (res.failed > 0) msg += `, ${res.failed} eșuate`;
            msg += " (marcată ca test în arhivă)";
            flash = [res.failed > 0 ? "err" : "ok", msg + "."];
          }
          break;
        }

        case "send_newsletter_now": {
          cereAdmin();
          const filter = recipients;
          if (filter !== null && filter.length === 0) {
            throw new Error("Nu ai bifat niciun destinatar.");
          }
          // Trimiterile manuale („Trimite acum") sunt marcate ca teste în arhivă
          // (is_test=1). Pot fi șterse cu butonul „Șterge testele" din Arhivă.
          const res = await newsletterSend(db, posta, filter, false, true);
          if (res.sent === 0 && res.failed === 0) {
            flash = ["err", "Nu există admini cu adresă de email pentru trimitere."];
          } else {
            let msg = `Newsletter: ${res.sent} trimise`;
            if (res.failed > 0) msg += `, ${res.failed} eșuate`;
            msg += " (marcat ca test în arhivă)";
            flash = [res.failed > 0 ? "err" : "ok", msg + "."];
          }
          break;
        }

        case "save_newsletter_schedule": {
          cereAdmin();
          const wd = parseInt(post.weekday ?? "6", 10);
          const hr = parseInt(post.hour ?? "16", 10);
          if (!(wd >= 0 && wd <= 6)) throw new Error("Zi invalidă.");
          if (!(hr >= 0 && hr <= 23)) throw new Error("Oră invalidă.");
          await puneSetarea(db, "newsletter_weekday", String(wd));
          await puneSetarea(db, "newsletter_hour", String(hr));
          flash = ["ok", "Program newsletter salvat."];
          break;
        }

        case "send_monthly_newsletter_now": {
          cereAdmin();
          const filter = recipients;
          if (filter !== null && filter.length === 0) {
            throw new Error("Nu ai bifat niciun destinatar.");
          }
          // Trimiterile manuale sunt marcate ca teste (is_test=1).
          const res = await newsletterSendMonthly(db, posta, filter, null, null, true);
          if (res.sent === 0 && res.failed === 0) {
            flash = ["err", "Nu există destinatari cu adresă de email pentru trimitere."];
          } else {
            let msg = `Newsletter lunar: ${res.sent} trimise`;
            if (res.failed > 0) msg += `, ${res.failed} eșuate`;
            msg += " (marcat ca test în arhivă)";
            flash = [res.failed > 0 ? "err" : "ok", msg + "."];
          }
          break;
        }

        case "save_monthly_newsletter_schedule": {
          cereAdmin();
          const mhr = parseInt(post.hour ?? "9", 10);
          if (!(mhr >= 0 && mhr <= 23)) throw new Error("Oră invalidă.");
          await puneSetarea(db, "newsletter_monthly_hour", String(mhr));
          flash = ["ok", "Program newsletter lunar salvat."];
          break;
        }

        case "save_alert_newsletter_schedule": {
          cereAdmin();
          const awd = parseInt(post.weekday ?? "5", 10);
          const ahr = parseInt(post.hour ?? "9", 10);
          if (!(awd >= 0 && awd <= 6)) throw new Error("Zi invalidă.");
          if (!(ahr >= 0 && ahr <= 23)) throw new Error("Oră invalidă.");
          await puneSetarea(db, "newsletter_alert_weekday", String(awd));
          await puneSetarea(db, "newsletter_alert_hour", String(ahr));
          flash = ["ok", "Program alertă salvat."];
          break;
        }

        case "purge_test_newsletters": {
          cereAdmin();
          const r = await ruleaza(db, "DELETE FROM newsletter_history WHERE is_test = 1");
          const n = Number(r.meta?.changes ?? 0);
          if (n === 0) {
            flash = ["ok", "Nu există teste de șters."];
          } else {
            flash = ["ok", `Șterse ${n} teste din arhivă.`];
          }
          break;
        }

        case "purge_newsletter_history": {
          cereAdmin();
          // Acceptă: 'weekly' | 'monthly' | 'all'
          const purgeKind = post.purge_kind ?? "weekly";
          if (!["weekly", "monthly", "all"].includes(purgeKind)) {
            throw new Error("Tip invalid.");
          }
          let n: number;
          let label: string;
          if (purgeKind === "all") {
            // Păstrează doar id-ul cel mai mare per kind.
            const keepW = await numar(db, "SELECT COALESCE(MAX(id), 0) FROM newsletter_history WHERE kind = 'weekly'");
            const keepM = await numar(db, "SELECT COALESCE(MAX(id), 0) FROM newsletter_history WHERE kind = 'monthly'");
            const r = await ruleaza(db, "DELETE FROM newsletter_history WHERE id NOT IN (?, ?) AND id > 0", keepW, keepM);
            n = Number(r.meta?.changes ?? 0);
            label = "tot istoricul (săptămânale + lunare)";
          } else {
            const keepId = await numar(db, "SELECT COALESCE(MAX(id), 0) FROM newsletter_history WHERE kind = ?", purgeKind);
            if (keepId === 0) {
              flash = ["ok", "Nu există nimic de șters pentru " + (purgeKind === "weekly" ? "săptămânale" : "lunare") + "."];
              break;
            }
            const r = await ruleaza(db, "DELETE FROM newsletter_history WHERE kind = ? AND id != ?", purgeKind, keepId);
            n = Number(r.meta?.changes ?? 0);
            label = purgeKind === "weekly" ? "săptămânale" : "lunare";
          }
          flash = ["ok", `Arhivă curățată: ${n} trimiteri șterse din ${label} (ultimul a rămas).`];
          break;
        }

        default:
          throw new Error("Acțiune necunoscută.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isAjax) return json({ ok: false, error: msg }, 400);
      flash = ["err", msg];
    }

    // PRG: după un POST se redirectează, ca reîncărcarea să nu retrimită formularul.
    const qs = new URLSearchParams();
    qs.set("tab", tab);
    if (flash) {
      qs.set("flash", flash[0]);
      qs.set("msg", flash[1]);
    }
    return duTe(`${ctx.prefix}/admin?` + qs.toString());
  }

  if (url.searchParams.has("flash") && url.searchParams.has("msg")) {
    flash = [url.searchParams.get("flash") ?? "", url.searchParams.get("msg") ?? ""];
  }

  // ----- Date pentru render ------------------------------------------------
  const mo = acum();
  /*
   * Echipa. Sortarea nu mai poate sta în SQL — `is_admin` și restul nu mai sunt coloane, ci
   * etichete ale asocierii, la identitate. Aceeași ordine, socotită aici: admini, monitori,
   * voluntari, apoi cei ieșiți din echipă (rândul le rămâne, cu istoricul lor).
   */
  const treapta = (v: Voluntar): number =>
    v.is_active !== 1 ? 3 : v.is_admin === 1 ? 0 : v.is_monitor === 1 ? 1 : 2;
  const volunteers = (await totiVoluntarii(db))
    .filter((v) => !v.in_asteptare)
    .sort((a, b) => treapta(a) - treapta(b) || a.id - b.id);

  /** Cererile în așteptare: oameni care au apăsat comutatorul pe contul lor și nu i-a primit nimeni. */
  const cereri = totiOamenii.filter((u) => u.stare === "ceruta");
  /** Cei neasociați cu curățenia — lista din spatele butonului „+ Adaugă". */
  const neasociati = totiOamenii
    .filter((u) => u.stare === null && !u.disabledAt)
    .sort((a, b) => numeDinCont(a).localeCompare(numeDinCont(b), "ro", { sensitivity: "base" }));

  // Fetch toate log-urile; filtrarea pe tip se face client-side cu JS.
  // ⚠️ Numele nu mai vin din JOIN: se lipesc din cartea oamenilor, ca peste tot.
  const logsBrut = await toate<Omit<LogRow, "first_name" | "last_name"> & { user_id: string | null }>(
    db,
    `SELECT n.*, v.user_id
     FROM notifications_log n
     LEFT JOIN volunteers v ON v.id = n.volunteer_id
     ORDER BY n.id DESC LIMIT 200`,
  );
  const logs: LogRow[] = logsBrut.map((r) => {
    const om = db.oameni.om(r.user_id);
    return { ...r, first_name: om?.firstName ?? null, last_name: om?.lastName ?? null };
  });

  const logEventTypes = await toate<{ event_type: string; cnt: number }>(
    db,
    `SELECT event_type, COUNT(*) as cnt FROM notifications_log
     GROUP BY event_type ORDER BY event_type`,
  );

  // ----- Conținutul tab-ului -------------------------------------------------
  let continut = "";
  if (tab === "voluntari") {
    continut = tabVoluntari(volunteers, campCsrf(ctx), cereri, neasociati);
  } else if (tab === "alert" && adminAuthed) {
    continut = await tabAlert(db, posta, mo, campCsrf(ctx));
  } else if (tab === "weekly" && adminAuthed) {
    continut = await tabWeekly(db, posta, mo, campCsrf(ctx));
  } else if (tab === "monthly" && adminAuthed) {
    continut = await tabMonthly(db, posta, mo, campCsrf(ctx));
  } else if (tab === "archive" && adminAuthed) {
    continut = await tabArchive(db, url, campCsrf(ctx));
  } else if (tab === "faq" && adminAuthed) {
    continut = tabFaq();
  } else if (tab === "log") {
    continut = tabLog(logs, logEventTypes, adminAuthed, campCsrf(ctx));
  }

  const updRaw = await ultimaMiscare(db);
  const upd = updRaw ? formatDtLocal(updRaw, "d.m.Y") : null;

  const corp = `${flash ? `<div class="flash ${esc(flash[0])}">
                ${esc(flash[1])}
            </div>` : ""}

        <nav class="tabs">
            <a href="?tab=voluntari" class="${tab === "voluntari" ? "active" : ""}">Voluntari</a>
            <a href="?tab=alert" class="${isNewsletterSection ? "active" : ""}">Newsletter</a>
            <a href="?tab=log" class="${tab === "log" ? "active" : ""}">Mesaje de sistem</a>
        </nav>

        ${isNewsletterSection ? `<nav class="sub-tabs">
                <a href="?tab=alert"   class="${tab === "alert" ? "active" : ""}">Alertă</a>
                <a href="?tab=weekly"  class="${tab === "weekly" ? "active" : ""}">Săptămânal</a>
                <a href="?tab=monthly" class="${tab === "monthly" ? "active" : ""}">Lunar</a>
                <a href="?tab=archive" class="${tab === "archive" ? "active" : ""}">Arhivă</a>
            </nav>` : ""}

        ${continut}

        <p class="info-jos">
            ${upd ? `Ultima actualizare: ${esc(upd)} &middot;` : ""}
            <a href="${esc(ctx.prefix)}/faq">Întrebări frecvente</a>
            &middot; <a href="${esc(ctx.prefix)}/admin/faq">FAQ administratori</a>
        </p>`;

  // Rândul personal al antetului: unde ești și cu ce drept. „Schimbă parola" și „Ieși din admin"
  // au ieșit — parola nu mai există, iar ieșirea e a contului platformei, din meniul lui.
  const personal = `<p class="cine">Administrare &middot; ${esc(ctx.utilizator ?? "prin contul platformei")}</p>`;

  return html(
    pagina(ctx, { titluPagina: "Administrare", personal, corp, local: STIL_ADMIN, lat: true }),
  );
}


// =========================================================================================
// Tab: Voluntari

/** Numele omului așa cum îl știe contul lui: prenume + nume, ori numele afișat, ori adresa. */
function numeDinCont(u: MembruAplicatie): string {
  const intreg = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return intreg || (u.displayName ?? "").trim() || u.email;
}

function tabVoluntari(
  volunteers: Voluntar[],
  CSRF: string,
  cereri: MembruAplicatie[],
  neasociati: MembruAplicatie[],
): string {
  let carduri = "";
  if (volunteers.length === 0) {
    carduri = `<div class="empty">Niciun voluntar înregistrat.</div>`;
  } else {
    let prevGroup: number | null = null;
    const items: string[] = [];
    for (const v of volunteers) {
      const fullName = numeIntreg(v);
      const isAdmin = Number(v.is_admin) === 1;
      const isMonitor = Number(v.is_monitor ?? 0) === 1;
      const active = Number(v.is_active) === 1;
      const role = isAdmin ? "Admin" : (isMonitor ? "Monitor" : "Voluntar");
      const addedAt = v.created_at ? formatDtLocal(v.created_at, "d.m.Y") : "—";

      // Determină grupul: 0=admin, 1=monitor, 2=voluntar, 3=inactiv
      let group: number;
      if (!active) group = 3;
      else if (isAdmin) group = 0;
      else if (isMonitor) group = 1;
      else group = 2;

      // Inserează separator între grupuri
      if (prevGroup !== null && prevGroup !== group) items.push(`<hr class="vc-divider">`);
      prevGroup = group;

      // Format wa.me link din telefon dacă există
      let waUrl = "";
      if (v.phone) {
        const ph = String(v.phone).replace(/[^0-9+]/g, "");
        let waNum: string;
        if (ph.startsWith("+")) waNum = ph.slice(1);
        else if (ph.startsWith("0")) waNum = "40" + ph.slice(1);
        else waNum = ph;
        if (waNum !== "") waUrl = "https://wa.me/" + waNum;
      }

      const isVolunteer = Number(v.is_volunteer ?? 1) === 1;
      const hasRole = isAdmin || isMonitor || isVolunteer;
      let ledClass: string;
      if (!active) ledClass = "off";
      else if (hasRole) ledClass = "on";
      else ledClass = "neutral";
      const ledTitle = !active ? "Inactiv" : (hasRole ? "Activ" : "Activ fără rol atribuit");

      items.push(`<div class="volunteer-card${active ? "" : " inactive"}${isAdmin ? " admin" : (isMonitor ? " monitor" : "")}">
                            <div class="vc-summary">
                                <span class="vc-led ${ledClass}"
                                      title="${esc(ledTitle)}"></span>
                                <div class="vc-summary-name">
                                    <strong class="vc-name">${esc(fullName)}</strong>
                                    <span class="vc-role-tag ${isAdmin ? "admin" : (isMonitor ? "monitor" : "volunteer")}">
                                        ${esc(role)}${active ? "" : " · inactiv"}
                                    </span>
                                </div>
                                <div class="vc-summary-actions">
                                    ${waUrl ? `<a href="${esc(waUrl)}" target="_blank" rel="noopener"
                                           class="wa-link vc-summary-wa" title="WhatsApp"></a>` : ""}
                                    <button type="button" class="btn small icon-only vc-edit-btn"
                                            aria-label="Editează"
                                            title="Editează"
                                            data-id="${Number(v.id)}"
                                            data-first-name="${esc(v.first_name)}"
                                            data-last-name="${esc(v.last_name)}"
                                            data-email="${esc(v.email ?? "")}"
                                            data-phone="${esc(v.phone ?? "")}"
                                            data-slug="${esc(v.slug ?? "")}"
                                            data-display-name="${esc(numeScurt(v))}">
                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                        </svg>
                                    </button>
                                    <span class="vc-chevron" aria-hidden="true">▾</span>
                                </div>
                            </div>
                            <div class="vc-details" hidden>
                            <div class="vc-main">
                                <div class="vc-content">
                                    <div class="vc-row">
                                        <span class="vc-key">Email:</span>
                                        <span class="vc-val">
                                            ${v.email ? `<a href="mailto:${esc(v.email)}">${esc(v.email)}</a>` : "—"}
                                        </span>
                                    </div>
                                    <div class="vc-row">
                                        <span class="vc-key">Telefon:</span>
                                        <span class="vc-val">
                                            ${v.phone ? `<a href="tel:${esc(String(v.phone).replace(/\s+/g, ""))}">${esc(v.phone)}</a>` : "—"}
                                        </span>
                                    </div>
                                </div>
                                <div class="vc-toggles">
                                    <!-- „Activ" a devenit apartenența la echipă: aprins = asociere
                                         acceptată la identitate, stins = a ieșit (rândul și
                                         istoricul rămân). Stingerea îi ia și cheia de admin. -->
                                    <form method="post" class="ios-toggle-form">
                                        <input type="hidden" name="action" value="${active ? "remove_volunteer" : "add_volunteer"}">${CSRF}
                                        <input type="hidden" name="id" value="${Number(v.id)}">
                                        <input type="hidden" name="user_id" value="${esc(v.user_id)}">
                                        <button type="submit" class="ios-toggle ${active ? "on" : "off"}" aria-label="În echipă"
                                                title="${active ? "Scoate din echipă (istoricul rămâne)" : "Primește înapoi în echipă"}">
                                            <span class="ios-toggle-label">În echipă</span>
                                            <span class="ios-toggle-track"><span class="ios-toggle-knob"></span></span>
                                        </button>
                                    </form>
                                    <form method="post" class="ios-toggle-form">
                                        <input type="hidden" name="action" value="toggle_volunteer">${CSRF}
                                        <input type="hidden" name="id" value="${Number(v.id)}">
                                        <button type="submit" class="ios-toggle ${isVolunteer ? "on" : "off"}" aria-label="Voluntar">
                                            <span class="ios-toggle-label">Voluntar</span>
                                            <span class="ios-toggle-track"><span class="ios-toggle-knob"></span></span>
                                        </button>
                                    </form>
                                    <form method="post" class="ios-toggle-form">
                                        <input type="hidden" name="action" value="toggle_admin">${CSRF}
                                        <input type="hidden" name="id" value="${Number(v.id)}">
                                        <button type="submit" class="ios-toggle warning ${isAdmin ? "on" : "off"}" aria-label="Admin">
                                            <span class="ios-toggle-label">Admin</span>
                                            <span class="ios-toggle-track"><span class="ios-toggle-knob"></span></span>
                                        </button>
                                    </form>
                                    <form method="post" class="ios-toggle-form">
                                        <input type="hidden" name="action" value="toggle_monitor">${CSRF}
                                        <input type="hidden" name="id" value="${Number(v.id)}">
                                        <button type="submit" class="ios-toggle info ${isMonitor ? "on" : "off"}" aria-label="Monitor">
                                            <span class="ios-toggle-label">Monitor</span>
                                            <span class="ios-toggle-track"><span class="ios-toggle-knob"></span></span>
                                        </button>
                                    </form>
                                </div>
                            </div>
                            <div class="vc-statusbar">
                                <span class="vc-status-item">
                                    Nume afișat: ${esc(numeScurt(v))}
                                </span>
                                <span class="vc-status-item">
                                    Adăugat la data: ${esc(addedAt)}
                                </span>
                            </div>
                            </div><!-- /.vc-details -->
                        </div>`);
    }
    carduri = `<div class="volunteer-cards">
                    ${items.join("\n                    ")}
                </div>`;
  }

  /*
   * CERERILE ÎN AȘTEPTARE (user, 14.09.2026: „tot acolo și lista Cererilor"). Cine a apăsat
   * comutatorul „Curățenia bisericii" pe contul lui stă aici până îl primește un administrator.
   * Stau SUS, înaintea echipei: sunt singurul lucru din filă care așteaptă o hotărâre.
   */
  const listaCereri = cereri.length === 0
    ? ""
    : `<div class="cereri">
                <div class="toolbar">
                    <strong>Cereri de intrare în echipă (${cereri.length})</strong>
                    <span style="font-size:0.85rem; color:var(--text-muted);">
                        Au cerut singuri, de pe contul lor — nu sunt încă în echipă
                    </span>
                </div>
                ${cereri.map((u) => `<div class="cerere-rand">
                        <div>
                            <strong>${esc(numeDinCont(u))}</strong>
                            <div class="cerere-sub">${esc(u.email)}${u.phone ? " · " + esc(u.phone) : ""}</div>
                        </div>
                        <div class="cerere-actiuni">
                            <form method="post">
                                <input type="hidden" name="action" value="add_volunteer">${CSRF}
                                <input type="hidden" name="user_id" value="${esc(u.userId)}">
                                <button type="submit" class="btn">Primește</button>
                            </form>
                            <form method="post">
                                <input type="hidden" name="action" value="refuza_cererea">${CSRF}
                                <input type="hidden" name="user_id" value="${esc(u.userId)}">
                                <button type="submit" class="btn secondary">Refuză</button>
                            </form>
                        </div>
                    </div>`).join("\n")}
            </div>`;

  /*
   * „+ Adaugă" (user, 14.09.2026: „o listă +add unde adaugi un user deja existent"). NU naște pe
   * nimeni: alege dintre conturile care există pe platformă și nu sunt încă legate de curățenie.
   * Dacă lista e goală, nu mai e nimeni de adus — și scrie asta, nu se ascunde butonul.
   */
  const listaAdauga = `<div class="add-volunteer-prompt">
                <span class="add-volunteer-text">
                    Adu în echipă un utilizator al platformei:
                </span>
                <button type="button" class="btn" id="openAddVolunteerBtn">+ Adaugă</button>
            </div>`;

  return `${listaCereri}

            ${listaAdauga}

            <div class="toolbar">
                <strong>Echipa (${volunteers.filter((v) => Number(v.is_active) === 1).length})</strong>
                <span style="font-size:0.85rem; color:var(--text-muted);">
                    Cine iese rămâne în istoric, nu se șterge
                </span>
            </div>

            ${carduri}

            <!-- Lista „+ Adaugă": conturile platformei neasociate cu curățenia. Se caută după
                 nume sau adresă, fiindcă platforma are mai mulți oameni decât are echipa. -->
            <div id="addModal" class="vol-modal" hidden>
                <div class="vol-modal-overlay"></div>
                <div class="vol-modal-content">
                    <button type="button" class="vol-modal-close" id="addModalClose" aria-label="Închide">×</button>
                    <h2 class="card-title">Adu în echipă</h2>
                    ${neasociati.length === 0
                      ? `<div class="empty">Toți utilizatorii platformei sunt deja legați de curățenie.
                            Cine nu are cont trebuie să-și facă întâi unul, de la pagina de intrare.</div>`
                      : `<input type="search" id="addCauta" placeholder="Caută după nume sau e-mail…"
                                autocomplete="off" style="width:100%;margin-bottom:10px">
                         <ul class="add-lista">
                            ${neasociati.map((u) => `<li data-cheie="${esc((numeDinCont(u) + " " + u.email).toLowerCase())}">
                                    <form method="post">
                                        <input type="hidden" name="action" value="add_volunteer">${CSRF}
                                        <input type="hidden" name="user_id" value="${esc(u.userId)}">
                                        <button type="submit">
                                            <strong>${esc(numeDinCont(u))}</strong>
                                            <span class="add-sub">${esc(u.email)}</span>
                                        </button>
                                    </form>
                                </li>`).join("\n")}
                         </ul>`}
                </div>
            </div>

            <!-- Modal pentru Editează fișa (datele se scriu pe contul platformei) -->
            <div id="volModal" class="vol-modal" hidden>
                <div class="vol-modal-overlay"></div>
                <div class="vol-modal-content">
                    <button type="button" class="vol-modal-close" id="volModalClose" aria-label="Închide">×</button>
                    <h2 class="card-title" id="volModalTitle">Editează fișa</h2>
                    <div class="vol-modal-error" id="volModalError" hidden></div>
                    <form id="volModalForm">
                        <input type="hidden" name="action" id="volModalAction" value="update_volunteer">${CSRF}
                        <input type="hidden" name="id" id="volModalId" value="">
                        <p class="ajutor" style="margin:0 0 10px;color:var(--text-muted);font-size:0.85rem">
                            Datele se scriu pe <strong>contul platformei</strong> al omului și se văd de
                            acolo peste tot. Adresa de e-mail nu se schimbă de aici — e cheia contului
                            lui, și numai el o poate schimba.
                        </p>
                        <div class="form-grid">
                            <div>
                                <label>Prenume *</label>
                                <input type="text" name="first_name" id="volModalFirst" required>
                            </div>
                            <div>
                                <label>Nume *</label>
                                <input type="text" name="last_name" id="volModalLast" required>
                            </div>
                            <div>
                                <label>Email (al contului)</label>
                                <input type="email" id="volModalEmail" readonly disabled
                                       style="background:#f0ecdf;color:var(--text-muted);">
                            </div>
                            <div>
                                <label>Telefon (pentru WhatsApp)</label>
                                <input type="text" name="phone" id="volModalPhone">
                            </div>
                            <div id="volModalSlugRow" hidden>
                                <label>Nume scurt (afișat pe butoane)</label>
                                <input type="text" id="volModalDisplayName" readonly disabled
                                       style="background:#f0ecdf;color:var(--text-muted);">
                            </div>
                            <div id="volModalSlugInputRow" hidden>
                                <label>Prescurtare (slug)</label>
                                <input type="text" name="slug" id="volModalSlug" pattern="[a-z][a-z0-9.]*">
                                <small style="color:var(--text-muted);font-size:0.78rem;">
                                    Lasă gol ca să se regenereze automat.
                                </small>
                            </div>
                        </div>
                        <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">
                            <button type="button" class="btn secondary" id="volModalCancel">Renunță</button>
                            <button type="submit" class="btn" id="volModalSubmit">Salvează</button>
                        </div>
                    </form>
                </div>
            </div>

            <script>
                (function () {
                    const modal     = document.getElementById('volModal');
                    const titleEl   = document.getElementById('volModalTitle');
                    const errEl     = document.getElementById('volModalError');
                    const formEl    = document.getElementById('volModalForm');
                    const actionEl  = document.getElementById('volModalAction');
                    const idEl      = document.getElementById('volModalId');
                    const firstEl   = document.getElementById('volModalFirst');
                    const lastEl    = document.getElementById('volModalLast');
                    const emailEl   = document.getElementById('volModalEmail');
                    const phoneEl   = document.getElementById('volModalPhone');
                    const dispRow   = document.getElementById('volModalSlugRow');
                    const dispEl    = document.getElementById('volModalDisplayName');
                    const slugRow   = document.getElementById('volModalSlugInputRow');
                    const slugEl    = document.getElementById('volModalSlug');
                    const submitBtn = document.getElementById('volModalSubmit');

                    function showError(msg) {
                        errEl.textContent = msg;
                        errEl.hidden = false;
                    }
                    function clearError() { errEl.hidden = true; errEl.textContent = ''; }

                    // Fereastra are de acum o singură treabă: ÎNDREPTAREA fișei. Adăugarea nu mai
                    // naște pe nimeni aici — se alege un cont din lista „+ Adaugă", care e altă
                    // fereastră, mai jos.
                    function openModal(data = {}) {
                        clearError();
                        formEl.reset();
                        titleEl.textContent = 'Editează fișa';
                        actionEl.value = 'update_volunteer';
                        idEl.value = data.id || '';
                        firstEl.value = data.first_name || '';
                        lastEl.value = data.last_name || '';
                        emailEl.value = data.email || '';
                        phoneEl.value = data.phone || '';
                        dispRow.hidden = false;
                        dispEl.value = data.display_name || '';
                        slugRow.hidden = false;
                        slugEl.value = data.slug || '';
                        modal.removeAttribute('hidden');
                        // ⚠️ REGULA FERESTRELOR (13.09.2026): blocarea derulării din spate o face
                        // CARCASA, nu aplicația. Fereastra asta nu e un <dialog> (e un div vechi din
                        // V1), deci cere blocarea pe nume. Un overflow:hidden scris de mână pe body
                        // n-ar face oricum nimic: derularea e a rădăcinii.
                        if (window.xcFereastra) window.xcFereastra.blocheaza();
                        setTimeout(() => firstEl.focus(), 50);
                    }
                    function closeModal() {
                        if (!modal.hasAttribute('hidden') && window.xcFereastra) window.xcFereastra.dezblocheaza();
                        modal.setAttribute('hidden', '');
                    }

                    // ---- Fereastra „+ Adaugă": conturile platformei neasociate cu curățenia.
                    const addModal = document.getElementById('addModal');
                    const addCauta = document.getElementById('addCauta');
                    function openAdd() {
                        if (!addModal) return;
                        addModal.removeAttribute('hidden');
                        if (window.xcFereastra) window.xcFereastra.blocheaza();
                        if (addCauta) setTimeout(() => addCauta.focus(), 50);
                    }
                    function closeAdd() {
                        if (!addModal) return;
                        if (!addModal.hasAttribute('hidden') && window.xcFereastra) window.xcFereastra.dezblocheaza();
                        addModal.setAttribute('hidden', '');
                    }
                    document.getElementById('openAddVolunteerBtn').addEventListener('click', openAdd);
                    document.getElementById('addModalClose').addEventListener('click', closeAdd);
                    addModal.querySelector('.vol-modal-overlay').addEventListener('click', closeAdd);
                    if (addCauta) {
                        addCauta.addEventListener('input', () => {
                            const q = addCauta.value.trim().toLowerCase();
                            addModal.querySelectorAll('.add-lista li').forEach(li => {
                                li.hidden = q !== '' && !(li.dataset.cheie || '').includes(q);
                            });
                        });
                    }

                    // Buton Editează per card (delegate, .vc-edit-btn cu data attrs)
                    document.addEventListener('click', e => {
                        const btn = e.target.closest('.vc-edit-btn');
                        if (!btn) return;
                        e.preventDefault();
                        openModal({
                            id:           btn.dataset.id,
                            first_name:   btn.dataset.firstName,
                            last_name:    btn.dataset.lastName,
                            email:        btn.dataset.email,
                            phone:        btn.dataset.phone,
                            slug:         btn.dataset.slug,
                            display_name: btn.dataset.displayName,
                        });
                    });

                    document.getElementById('volModalClose').addEventListener('click', closeModal);
                    document.getElementById('volModalCancel').addEventListener('click', closeModal);
                    modal.querySelector('.vol-modal-overlay').addEventListener('click', closeModal);
                    document.addEventListener('keydown', e => {
                        if (e.key !== 'Escape') return;
                        if (!modal.hasAttribute('hidden')) closeModal();
                        if (addModal && !addModal.hasAttribute('hidden')) closeAdd();
                    });

                    formEl.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        clearError();
                        submitBtn.disabled = true;
                        try {
                            const fd = new FormData(formEl);
                            const res = await fetch(window.location.href, {
                                method: 'POST',
                                body: fd,
                                credentials: 'same-origin',
                                headers: { 'X-Requested-With': 'XMLHttpRequest' }
                            });
                            const data = await res.json();
                            if (data.ok) {
                                if (data.reload) window.location.reload();
                                else closeModal();
                            } else {
                                showError(data.error || 'Eroare necunoscută.');
                            }
                        } catch (err) {
                            showError('Eroare de rețea.');
                        } finally {
                            submitBtn.disabled = false;
                        }
                    });

                    // Click pe summary → toggle expandare card (dar nu pe Edit / WA)
                    document.querySelectorAll('.vc-summary').forEach(summary => {
                        summary.addEventListener('click', (e) => {
                            if (e.target.closest('.vc-edit-btn')) return;
                            if (e.target.closest('.wa-link')) return;
                            const card = summary.closest('.volunteer-card');
                            const details = card.querySelector('.vc-details');
                            const expanded = card.classList.toggle('expanded');
                            if (expanded) details.removeAttribute('hidden');
                            else details.setAttribute('hidden', '');
                        });
                    });

                    // Recalculează LED-ul cardului în funcție de toggle-urile curente.
                    function updateCardLed(card) {
                        const led = card.querySelector('.vc-led');
                        if (!led) return;
                        const isOn = (action) => {
                            const inp = card.querySelector('input[name="action"][value="' + action + '"]');
                            return inp && inp.closest('form').querySelector('.ios-toggle').classList.contains('on');
                        };
                        led.classList.remove('on', 'off', 'neutral');
                        if (!isOn('toggle_active')) {
                            led.classList.add('off');
                            return;
                        }
                        const anyRole = isOn('toggle_admin') || isOn('toggle_volunteer') || isOn('toggle_monitor');
                        led.classList.add(anyRole ? 'on' : 'neutral');
                    }

                    // Toggle-uri AJAX
                    document.querySelectorAll('.vc-toggles .ios-toggle-form').forEach(form => {
                        form.addEventListener('submit', async (e) => {
                            e.preventDefault();
                            const tog = form.querySelector('.ios-toggle');
                            const card = form.closest('.volunteer-card');
                            const action = form.querySelector('[name="action"]').value;
                            try {
                                const fd = new FormData(form);
                                const res = await fetch(window.location.href, {
                                    method: 'POST',
                                    body: fd,
                                    credentials: 'same-origin',
                                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                                });
                                const data = await res.json();
                                if (!data.ok) { alert(data.error || 'Eroare'); return; }
                                const on = (data.state === 1);
                                tog.classList.toggle('on', on);
                                tog.classList.toggle('off', !on);
                                if (action === 'toggle_active' && card) {
                                    card.classList.toggle('inactive', !on);
                                }
                                if (action === 'toggle_admin' && card) {
                                    card.classList.toggle('admin', on);
                                    if (on && data.monitor_on) {
                                        const monInp = card.querySelector('input[value="toggle_monitor"]');
                                        if (monInp) {
                                            const monTog = monInp.closest('form').querySelector('.ios-toggle');
                                            if (monTog) {
                                                monTog.classList.add('on');
                                                monTog.classList.remove('off');
                                            }
                                        }
                                    }
                                    if (data.message) alert(data.message);
                                }
                                if (card) updateCardLed(card);
                            } catch (err) {
                                alert('Eroare de rețea.');
                            }
                        });
                    });
                })();
            </script>`;
}

// =========================================================================================
// Tab: Newsletter → Alertă

async function tabAlert(db: Baza, posta: MediuRaport, mo: Moment, CSRF: string): Promise<string> {
  const alertSunday = nextSundayDate(mo);
  const alertNlData = await newsletterBuildData(db, alertSunday, posta.nume);
  const alertNlHtml = newsletterRenderHtml(alertNlData, posta.acasa);
  const curAlertWd = parseInt((await setare(db, "newsletter_alert_weekday", "5")) ?? "5", 10); // vineri default
  const curAlertHr = parseInt((await setare(db, "newsletter_alert_hour", "9")) ?? "9", 10);
  const alertLastSentFor = (await setare(db, "newsletter_alert_last_sent_for_sunday", "")) ?? "";

  const alertOccupied = await nextSundayOccupiedCount(db, alertSunday);
  const alertIsFilled = alertOccupied >= MIN_VOLUNTARI;

  // Calculează data + ora următoarei rulări programate
  const nextAlertLabel = urmatoareaRulare(mo, curAlertWd, curAlertHr) + ", ora " + oraHH(curAlertHr);

  // Destinatari: TOȚI voluntarii activi cu email (același principiu ca lunar).
  const coloane = await coloaneDestinatari(db);
  const adminEmails = coloane.admini;
  const monitorEmails = coloane.monitori;
  const scheduledEmails = coloane.voluntari;

  // Voluntarii în vacanță în luna duminicii viitoare.
  const vacYear = Number(alertSunday.slice(0, 4));
  const vacMonth = Number(alertSunday.slice(5, 7));
  const vacationIds = new Set(await idVacantaInLuna(db, vacYear, vacMonth));

  const pool = new Map<string, Rec>();
  adaugaInPool(pool, adminEmails, "Admin", vacationIds);
  adaugaInPool(pool, monitorEmails, "Monitor", vacationIds);
  adaugaInPool(pool, scheduledEmails, "Voluntar", vacationIds);

  // Cron LED
  const cron = await statusCron(db, mo, "alert");

  return `<div class="form-card">
                <h2 class="card-title">Destinatari</h2>
                <p style="margin:0 0 14px;color:var(--text-muted);font-size:0.9rem;">
                    Alerta ajunge la <strong>toți voluntarii activi cu email</strong> — e o cerere de
                    ajutor când nu există suficienți voluntari programați pentru duminica viitoare.
                </p>
                <div class="recipients-cols">
                    <div class="recipients-col">
                        <strong>Administratori:</strong>
                        <div class="recipients-list">
                            ${adminEmails.length === 0
                              ? `<span style="color:var(--danger);">niciun admin cu email completat</span>`
                              : fmtList(adminEmails, vacationIds)}
                        </div>
                    </div>
                    <div class="recipients-col">
                        <strong>Voluntari:</strong>
                        <div class="recipients-list">
                            ${scheduledEmails.length === 0
                              ? `<span style="color:var(--text-muted);">niciun voluntar simplu cu email</span>`
                              : fmtList(scheduledEmails, vacationIds)}
                        </div>
                    </div>
                    <div class="recipients-col">
                        <strong>Monitori:</strong>
                        <div class="recipients-list">
                            ${monitorEmails.length === 0
                              ? `<span style="color:var(--text-muted);">niciun monitor cu email</span>`
                              : fmtList(monitorEmails, vacationIds)}
                        </div>
                    </div>
                </div>
                ${totalDestinatari(pool)}
            </div>

            <div class="form-card">
                <div class="card-title-row">
                    <h2 class="card-title" style="margin:0;">Alertă „locuri libere"</h2>
                    ${badgeCron(cron)}
                </div>
                <h3 class="card-subtitle">Previzualizare pentru Duminica ${esc(formatDateRo(alertSunday))}</h3>

                <div class="alert-incomplete" style="background:#fdf5e6;border-left:4px solid #c97a3a;">
                    <strong>Regula alertei</strong>: se trimite automat
                    <strong>doar dacă duminica viitoare are mai puțin de ${MIN_VOLUNTARI} sloturi ocupate</strong>
                    la momentul programat. Dacă duminica e completă la acel moment, alerta nu pleacă.
                    ${alertIsFilled ? `<br>
                        <span style="color:#4f6c3b;">
                            ✓ Acum duminica are ${alertOccupied} sloturi ocupate — nu s-ar trimite alertă.
                        </span>` : `<br>
                        <span style="color:#7a5a14;">
                            ⚠ Acum lipsesc ${MIN_VOLUNTARI - alertOccupied} sloturi — la următoarea rulare programată,
                            dacă tot lipsesc, alerta va pleca.
                        </span>`}
                </div>

                <p style="margin:0 0 12px;color:var(--text-muted);font-size:0.92rem;">
                    Următoarea verificare automată:
                    <a href="#" id="showAlertScheduleBtn"
                       style="color:var(--accent-dark);font-weight:600;text-decoration:none;border-bottom:1px dotted var(--accent-dark);"
                       title="Click pentru a schimba ziua și ora">
                        ${esc(nextAlertLabel)}
                    </a>.
                </p>

                <div id="alertSchedulePanel" hidden style="background:#f7f5f0;border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:14px;">
                    <form method="post" class="schedule-form">
                        <input type="hidden" name="action" value="save_alert_newsletter_schedule">${CSRF}
                        <div class="schedule-row">
                            <div class="schedule-field">
                                <label>Ziua săptămânii</label>
                                <select name="weekday">
                                    ${optiuniZile(curAlertWd)}
                                </select>
                            </div>
                            <div class="schedule-field">
                                <label>Ora</label>
                                <select name="hour">
                                    ${optiuniOre(curAlertHr)}
                                </select>
                            </div>
                            <div class="schedule-actions">
                                <button type="submit" class="btn">Salvează</button>
                                <button type="button" class="btn secondary" id="cancelAlertScheduleBtn">Renunță</button>
                            </div>
                        </div>
                        ${alertLastSentFor !== "" ? `<div style="margin-top:8px;color:var(--text-muted);font-size:0.85rem;">
                                Ultima alertă trimisă pentru duminica: ${esc(formatDateRo(alertLastSentFor))}
                            </div>` : ""}
                    </form>
                </div>

                <iframe srcdoc="${esc(alertNlHtml)}"
                        style="width:100%;height:500px;border:1px solid var(--border);border-radius:6px;background:#f7f5f0;"></iframe>

                <div style="margin:18px 0 0;">
                    <div style="display:flex;justify-content:center;">
                        <button type="button" class="btn btn-send-toggle" id="toggleAlertSendPanel"
                                ${pool.size === 0 ? "disabled" : ""}>
                            <span id="toggleAlertSendLabel">Trimite acum</span>
                        </button>
                    </div>
                    <div id="alertSendPanel" class="form-card" hidden style="max-width:560px;margin:14px auto 0;">
                        <p style="margin:0 0 10px;color:var(--text-muted);font-size:0.9rem;">
                            Bifează destinatarii pe care să-i incluzi. Util pentru teste — bifează doar ție.
                        </p>
                        <form method="post" id="alertSendForm">
                            <input type="hidden" name="action" value="send_alert_now">${CSRF}
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                <label style="font-size:0.85rem;color:var(--text-muted);">
                                    <input type="checkbox" id="checkAllAlertRec">
                                    Bifează / debifează tot
                                </label>
                                <span id="sendAlertCount" style="font-size:0.85rem;color:var(--text-muted);"></span>
                            </div>
                            <div class="send-recipients-list">
                                ${listaBifeDestinatari(pool)}
                            </div>
                            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
                                <button type="button" class="btn secondary" id="cancelAlertSendBtn">Renunță</button>
                                <button type="submit" class="btn" id="sendAlertConfirmBtn"
                                        style="background:#b04848;border-color:#b04848;">Trimite alerta</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <script>
                (function () {
                    const panel = document.getElementById('alertSchedulePanel');
                    const showBtn = document.getElementById('showAlertScheduleBtn');
                    const cancelBtn = document.getElementById('cancelAlertScheduleBtn');
                    if (panel && showBtn) {
                        showBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            if (panel.hasAttribute('hidden')) panel.removeAttribute('hidden');
                            else panel.setAttribute('hidden', '');
                        });
                        if (cancelBtn) cancelBtn.addEventListener('click', () => panel.setAttribute('hidden', ''));
                    }

                    const toggle = document.getElementById('toggleAlertSendPanel');
                    const sendPanel = document.getElementById('alertSendPanel');
                    const cancel = document.getElementById('cancelAlertSendBtn');
                    const checks = sendPanel ? sendPanel.querySelectorAll('input[name="recipients[]"]') : [];
                    const checkAll = document.getElementById('checkAllAlertRec');
                    const count = document.getElementById('sendAlertCount');
                    const confirm = document.getElementById('sendAlertConfirmBtn');
                    if (!toggle || !sendPanel) return;

                    const toggleLabel = document.getElementById('toggleAlertSendLabel');
                    function updateCount() {
                        const total = checks.length;
                        const n = Array.from(checks).filter(c => c.checked).length;
                        count.textContent = n + ' selectat' + (n === 1 ? '' : 'i');
                        confirm.disabled = (n === 0);
                        // Butonul rămâne mereu „Trimite acum" — fără actualizare cu numărul.
                        // Numărul de bife e afișat doar în span-ul intern (#sendCount).
                        if (n === 0) { checkAll.checked = false; checkAll.indeterminate = false; }
                        else if (n === total) { checkAll.checked = true; checkAll.indeterminate = false; }
                        else { checkAll.checked = false; checkAll.indeterminate = true; }
                    }
                    toggle.addEventListener('click', () => {
                        if (sendPanel.hasAttribute('hidden')) {
                            sendPanel.removeAttribute('hidden');
                            toggle.classList.add('pressed');
                        } else {
                            sendPanel.setAttribute('hidden', '');
                            toggle.classList.remove('pressed');
                        }
                        updateCount();
                    });
                    cancel.addEventListener('click', () => {
                        sendPanel.setAttribute('hidden', '');
                        toggle.classList.remove('pressed');
                    });
                    checkAll.addEventListener('change', () => {
                        checks.forEach(c => { c.checked = checkAll.checked; });
                        updateCount();
                    });
                    checks.forEach(c => c.addEventListener('change', updateCount));
                    updateCount();
                })();
            </script>`;
}

// =========================================================================================
// Tab: Newsletter → Săptămânal

async function tabWeekly(db: Baza, posta: MediuRaport, mo: Moment, CSRF: string): Promise<string> {
  const nextS = nextSundayDate(mo);
  const nlData = await newsletterBuildData(db, nextS, posta.nume);
  const nlHtml = newsletterRenderHtml(nlData, posta.acasa);
  const coloane = await coloaneDestinatari(db);
  const adminEmails = coloane.admini;
  const monitorEmails = coloane.monitori;
  // Cine e programat la duminica viitoare, în ordinea pozițiilor. Interogarea aduce doar id-ul și
  // poziția; numele și adresa se lipesc din echipă (nu mai sunt în tabel).
  const pozitii = await toate<{ volunteer_id: number; slot: number }>(
    db,
    `SELECT a.volunteer_id, MIN(a.slot_position) AS slot
                     FROM assignments a
                     WHERE a.sunday_date = ?
                     GROUP BY a.volunteer_id
                     ORDER BY slot ASC`,
    nextS,
  );
  const dupaId = new Map(coloane.voluntari.map((d) => [d.id, d]));
  const scheduledEmails: (Dest & { slot: number })[] = [];
  for (const p of pozitii) {
    const d = dupaId.get(Number(p.volunteer_id));
    if (d) scheduledEmails.push({ ...d, slot: Number(p.slot) });
  }

  // Voluntarii în vacanță în luna duminicii viitoare — pentru strikethrough în UI.
  const vacYear = Number(nextS.slice(0, 4));
  const vacMonth = Number(nextS.slice(5, 7));
  const vacationIds = new Set(await idVacantaInLuna(db, vacYear, vacMonth));

  // Listele VIZUALE pe 3 coloane afișează toți cei din categoria respectivă, chiar dacă se
  // repetă. Lista REALĂ de trimitere (pool-ul de mai jos) e deduplicată pe email.
  const uniqueEmails = new Set<string>();
  for (const a of adminEmails) uniqueEmails.add(String(a.email ?? "").trim().toLowerCase());
  for (const m of monitorEmails) uniqueEmails.add(String(m.email ?? "").trim().toLowerCase());
  for (const v of scheduledEmails) {
    const k = String(v.email ?? "").trim().toLowerCase();
    if (k !== "") uniqueEmails.add(k);
  }
  const totalRecipients = uniqueEmails.size;
  const curWeekday = parseInt((await setare(db, "newsletter_weekday", "6")) ?? "6", 10);
  const curHour = parseInt((await setare(db, "newsletter_hour", "16")) ?? "16", 10);
  const lastSent = await setare(db, "newsletter_last_sent_at", null);

  // Calculează data și ora următoarei trimiteri programate.
  const nextRunFull = urmatoareaRulare(mo, curWeekday, curHour) + ", ora " + oraHH(curHour);

  const dupCount = adminEmails.length + monitorEmails.length + scheduledEmails.length - totalRecipients;

  // Lista combinată de destinatari, fără duplicate, cu email valid.
  // Cei în vacanță apar tot în pool, marcați cu flag (afișați tăiați + disabled).
  const pool = new Map<string, Rec>();
  adaugaInPool(pool, adminEmails, "Admin", vacationIds);
  adaugaInPool(pool, monitorEmails, "Monitor", vacationIds);
  adaugaInPool(pool, scheduledEmails, "Voluntar", vacationIds);

  const cron = await statusCron(db, mo, "weekly");

  const occupiedCount = await nextSundayOccupiedCount(db, nextS);
  const isFilled = occupiedCount >= MIN_VOLUNTARI;

  return `<div class="form-card">
                <h2 class="card-title">Destinatari</h2>

                <div class="recipients-cols">
                    <div class="recipients-col">
                        <strong>Administratori:</strong>
                        <div class="recipients-list">
                            ${adminEmails.length === 0
                              ? `<span style="color:var(--danger);">niciun admin cu email completat</span>`
                              : fmtList(adminEmails, vacationIds)}
                        </div>
                    </div>
                    <div class="recipients-col">
                        <strong>Voluntari programați pentru duminică:</strong>
                        <div class="recipients-list">
                            ${scheduledEmails.length === 0
                              ? `<span style="color:var(--text-muted);">niciun voluntar înscris încă</span>`
                              : fmtList(scheduledEmails, vacationIds)}
                        </div>
                    </div>
                    <div class="recipients-col">
                        <strong>Monitori:</strong>
                        <div class="recipients-list">
                            ${monitorEmails.length === 0
                              ? `<span style="color:var(--text-muted);">niciun monitor cu email completat</span>`
                              : fmtList(monitorEmails, vacationIds)}
                        </div>
                    </div>
                </div>

                ${dupCount > 0 ? `<div style="font-size:0.85rem;color:var(--text-muted);margin-top:-6px;margin-bottom:12px;">
                        (cei care apar în mai multe categorii primesc emailul o singură dată)
                    </div>` : ""}

            </div>

            <div class="form-card">
                <div class="card-title-row">
                    <h2 class="card-title" style="margin:0;">Newsletter săptămânal</h2>
                    ${badgeCron(cron)}
                </div>
                <h3 class="card-subtitle">Previzualizare pentru Duminica ${esc(formatDateRo(nextS))}</h3>

                ${!isFilled ? `<div class="alert-incomplete">
                        <strong>⚠ Mai sunt ${MIN_VOLUNTARI - occupiedCount} locuri neocupate</strong>
                        pentru această duminică.
                        Vezi tab-ul <a href="?tab=alert" style="color:inherit;text-decoration:underline;">Alertă</a>
                        pentru trimitere automată sau manuală către toți voluntarii.
                    </div>` : ""}
                <p style="margin:0 0 12px;color:var(--text-muted);font-size:0.92rem;">
                    Acest email se va trimite în data de
                    <a href="#" id="showScheduleBtn"
                       style="color:var(--accent-dark);font-weight:600;text-decoration:none;border-bottom:1px dotted var(--accent-dark);"
                       title="Click pentru a schimba data și ora">
                        ${esc(nextRunFull)}
                    </a>.
                </p>

                <div id="schedulePanel" hidden style="background:#f7f5f0;border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:14px;">
                    <form method="post" class="schedule-form">
                        <input type="hidden" name="action" value="save_newsletter_schedule">${CSRF}
                        <div class="schedule-row">
                            <div class="schedule-field">
                                <label>Ziua săptămânii</label>
                                <select name="weekday">
                                    ${optiuniZile(curWeekday)}
                                </select>
                            </div>
                            <div class="schedule-field">
                                <label>Ora</label>
                                <select name="hour">
                                    ${optiuniOre(curHour)}
                                </select>
                            </div>
                            <div class="schedule-actions">
                                <button type="submit" class="btn">Salvează</button>
                                <button type="button" class="btn secondary" id="cancelScheduleBtn">Renunță</button>
                            </div>
                        </div>
                        ${lastSent ? `<div style="margin-top:8px;color:var(--text-muted);font-size:0.85rem;">
                                Ultima trimitere: ${esc(lastSent)}
                            </div>` : ""}
                    </form>
                </div>

                <iframe srcdoc="${esc(nlHtml)}"
                        style="width:100%;height:500px;border:1px solid var(--border);border-radius:6px;background:#f7f5f0;"></iframe>

                <div style="margin:18px 0 0;">
                    <div style="display:flex;justify-content:center;">
                        <button type="button" class="btn btn-send-toggle" id="toggleSendPanel"
                                ${pool.size === 0 ? "disabled" : ""}>
                            <span id="toggleSendLabel">Trimite acum</span>
                        </button>
                    </div>
                    <div id="sendPanel" class="form-card" hidden style="max-width:560px;margin:14px auto 0;">
                        <p style="margin:0 0 10px;color:var(--text-muted);font-size:0.9rem;">
                            Bifează destinatarii pe care să-i incluzi. Util pentru teste — bifează doar ție.
                        </p>
                        <form method="post" id="sendForm">
                            <input type="hidden" name="action" value="send_newsletter_now">${CSRF}
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                <label style="font-size:0.85rem;color:var(--text-muted);">
                                    <input type="checkbox" id="checkAllRec">
                                    Bifează / debifează tot
                                </label>
                                <span id="sendCount" style="font-size:0.85rem;color:var(--text-muted);"></span>
                            </div>
                            <div class="send-recipients-list">
                                ${listaBifeDestinatari(pool)}
                            </div>
                            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
                                <button type="button" class="btn secondary" id="cancelSendBtn">Renunță</button>
                                <button type="submit" class="btn" id="sendConfirmBtn">Trimite</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <script>
                (function () {
                    const panel = document.getElementById('schedulePanel');
                    const showBtn = document.getElementById('showScheduleBtn');
                    const cancelBtn = document.getElementById('cancelScheduleBtn');
                    if (!panel || !showBtn) return;
                    showBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (panel.hasAttribute('hidden')) {
                            panel.removeAttribute('hidden');
                        } else {
                            panel.setAttribute('hidden', '');
                        }
                    });
                    if (cancelBtn) cancelBtn.addEventListener('click', () => {
                        panel.setAttribute('hidden', '');
                    });
                })();
            </script>

            <script>
                (function () {
                    const toggle = document.getElementById('toggleSendPanel');
                    const panel  = document.getElementById('sendPanel');
                    const cancel = document.getElementById('cancelSendBtn');
                    const checks = panel ? panel.querySelectorAll('input[name="recipients[]"]') : [];
                    const checkAll = document.getElementById('checkAllRec');
                    const count = document.getElementById('sendCount');
                    const confirm = document.getElementById('sendConfirmBtn');
                    if (!toggle || !panel) return;

                    const toggleLabel = document.getElementById('toggleSendLabel');
                    function updateCount() {
                        const total = checks.length;
                        const n = Array.from(checks).filter(c => c.checked).length;
                        count.textContent = n + ' selectat' + (n === 1 ? '' : 'i');
                        confirm.disabled = (n === 0);
                        // Butonul rămâne mereu „Trimite acum" — fără actualizare cu numărul.
                        // Numărul de bife e afișat doar în span-ul intern (#sendCount).
                        if (n === 0) {
                            checkAll.checked = false;
                            checkAll.indeterminate = false;
                        } else if (n === total) {
                            checkAll.checked = true;
                            checkAll.indeterminate = false;
                        } else {
                            checkAll.checked = false;
                            checkAll.indeterminate = true;
                        }
                    }
                    toggle.addEventListener('click', () => {
                        if (panel.hasAttribute('hidden')) {
                            panel.removeAttribute('hidden');
                            toggle.classList.add('pressed');
                        } else {
                            panel.setAttribute('hidden', '');
                            toggle.classList.remove('pressed');
                        }
                        updateCount();
                    });
                    cancel.addEventListener('click', () => {
                        panel.setAttribute('hidden', '');
                        toggle.classList.remove('pressed');
                    });
                    checkAll.addEventListener('change', () => {
                        checks.forEach(c => { c.checked = checkAll.checked; });
                        updateCount();
                    });
                    checks.forEach(c => c.addEventListener('change', updateCount));
                    updateCount();
                })();
            </script>`;
}

// =========================================================================================
// Tab: Newsletter → Lunar

async function tabMonthly(db: Baza, posta: MediuRaport, mo: Moment, CSRF: string): Promise<string> {
  const mlSchedule = await newsletterMonthlyNextSchedule(db, mo);
  const mlY = Number(mlSchedule.target_year);
  const mlM = Number(mlSchedule.target_month);
  const mlData = await newsletterBuildMonthlyData(db, mlY, mlM, posta.nume);
  const mlHtml = newsletterRenderHtmlMonthly(mlData, posta.acasa);
  const curMonthlyHour = parseInt((await setare(db, "newsletter_monthly_hour", "9")) ?? "9", 10);
  const monthlyLastAt = await setare(db, "newsletter_monthly_last_sent_at", null);
  const nextMonthly = momentDinYmd(String(mlSchedule.monday));

  // „Luni, 27 aprilie 2026"
  const nextMonthlyLabel = `${WEEKDAY_NAMES[nextMonthly.w]}, ${nextMonthly.d} ${LUNI_RO_MICI[nextMonthly.m]} ${nextMonthly.y}`;
  const nextMonthlyFull = nextMonthlyLabel + ", ora " + oraHH(curMonthlyHour);

  // Newsletter-ul LUNAR ajunge la TOȚI voluntarii activi cu email. Listele vizuale pe 3 coloane
  // afișează FIECARE categorie integral (duplicate vizuale OK); dedup în pool.
  const coloane = await coloaneDestinatari(db);
  const adminEmails = coloane.admini;
  const monitorEmails = coloane.monitori;
  const scheduledEmails = coloane.voluntari;

  // Voluntarii în vacanță în luna țintă — pentru strikethrough.
  const vacationIds = new Set(await idVacantaInLuna(db, mlY, mlM));

  const pool = new Map<string, Rec>();
  adaugaInPool(pool, adminEmails, "Admin", vacationIds);
  adaugaInPool(pool, monitorEmails, "Monitor", vacationIds);
  adaugaInPool(pool, scheduledEmails, "Voluntar", vacationIds);

  const cron = await statusCron(db, mo, "monthly");
  const monthLabel = String(mlData.month_label ?? "");
  const monthLabelUc = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  return `<div class="form-card">
                <h2 class="card-title">Destinatari</h2>
                <p style="margin:0 0 14px;color:var(--text-muted);font-size:0.9rem;">
                    Newsletter-ul lunar ajunge la <strong>toți voluntarii activi cu email</strong>,
                    indiferent dacă sunt programați la curățenie în luna țintă sau nu.
                </p>
                <div class="recipients-cols">
                    <div class="recipients-col">
                        <strong>Administratori:</strong>
                        <div class="recipients-list">
                            ${adminEmails.length === 0
                              ? `<span style="color:var(--danger);">niciun admin cu email completat</span>`
                              : fmtList(adminEmails, vacationIds)}
                        </div>
                    </div>
                    <div class="recipients-col">
                        <strong>Voluntari:</strong>
                        <div class="recipients-list">
                            ${scheduledEmails.length === 0
                              ? `<span style="color:var(--text-muted);">niciun voluntar simplu cu email completat</span>`
                              : fmtList(scheduledEmails, vacationIds)}
                        </div>
                    </div>
                    <div class="recipients-col">
                        <strong>Monitori:</strong>
                        <div class="recipients-list">
                            ${monitorEmails.length === 0
                              ? `<span style="color:var(--text-muted);">niciun monitor cu email completat</span>`
                              : fmtList(monitorEmails, vacationIds)}
                        </div>
                    </div>
                </div>
                ${totalDestinatari(pool)}
            </div>

            <div class="form-card">
                <div class="card-title-row">
                    <h2 class="card-title" style="margin:0;">Newsletter lunar</h2>
                    ${badgeCron(cron)}
                </div>
                <h3 class="card-subtitle">Previzualizare pentru ${esc(monthLabelUc)}</h3>

                <p style="margin:0 0 12px;color:var(--text-muted);font-size:0.92rem;">
                    Acest email se va trimite în data de
                    <a href="#" id="showMonthlyScheduleBtn"
                       style="color:var(--accent-dark);font-weight:600;text-decoration:none;border-bottom:1px dotted var(--accent-dark);"
                       title="Click pentru a schimba ora (ziua e calculată automat — Lunea săptămânii care conține 1 ale lunii)">
                        ${esc(nextMonthlyFull)}
                    </a>.
                    <span style="color:var(--text-muted);font-size:0.85rem;">
                        (Trimis întotdeauna lunea săptămânii care conține 1 ale lunii țintă —
                        astfel nu coincide cu newsletter-ul săptămânal de sâmbătă.)
                    </span>
                </p>

                <div id="monthlySchedulePanel" hidden style="background:#f7f5f0;border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:14px;">
                    <form method="post" class="schedule-form">
                        <input type="hidden" name="action" value="save_monthly_newsletter_schedule">${CSRF}
                        <div class="schedule-row">
                            <div class="schedule-field">
                                <label>Ziua</label>
                                <select disabled>
                                    <option>Luni (săpt. cu 1 ale lunii)</option>
                                </select>
                            </div>
                            <div class="schedule-field">
                                <label>Ora</label>
                                <select name="hour">
                                    ${optiuniOre(curMonthlyHour)}
                                </select>
                            </div>
                            <div class="schedule-actions">
                                <button type="submit" class="btn">Salvează</button>
                                <button type="button" class="btn secondary" id="cancelMonthlyScheduleBtn">Renunță</button>
                            </div>
                        </div>
                        ${monthlyLastAt ? `<div style="margin-top:8px;color:var(--text-muted);font-size:0.85rem;">
                                Ultima trimitere: ${esc(monthlyLastAt)}
                            </div>` : ""}
                    </form>
                </div>

                <iframe srcdoc="${esc(mlHtml)}"
                        style="width:100%;height:600px;border:1px solid var(--border);border-radius:6px;background:#f7f5f0;"></iframe>

                <div style="margin:18px 0 0;">
                    <div style="display:flex;justify-content:center;">
                        <button type="button" class="btn btn-send-toggle" id="toggleMonthlySendPanel"
                                ${pool.size === 0 ? "disabled" : ""}>
                            <span id="toggleMonthlySendLabel">Trimite acum</span>
                        </button>
                    </div>
                    <div id="monthlySendPanel" class="form-card" hidden style="max-width:560px;margin:14px auto 0;">
                        <p style="margin:0 0 10px;color:var(--text-muted);font-size:0.9rem;">
                            Bifează destinatarii pe care să-i incluzi. Util pentru teste — bifează doar ție.
                        </p>
                        <form method="post" id="monthlySendForm">
                            <input type="hidden" name="action" value="send_monthly_newsletter_now">${CSRF}
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                <label style="font-size:0.85rem;color:var(--text-muted);">
                                    <input type="checkbox" id="checkAllMonthlyRec">
                                    Bifează / debifează tot
                                </label>
                                <span id="sendMonthlyCount" style="font-size:0.85rem;color:var(--text-muted);"></span>
                            </div>
                            <div class="send-recipients-list">
                                ${listaBifeDestinatari(pool)}
                            </div>
                            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
                                <button type="button" class="btn secondary" id="cancelMonthlySendBtn">Renunță</button>
                                <button type="submit" class="btn" id="sendMonthlyConfirmBtn">Trimite</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <script>
                (function () {
                    const panel = document.getElementById('monthlySchedulePanel');
                    const showBtn = document.getElementById('showMonthlyScheduleBtn');
                    const cancelBtn = document.getElementById('cancelMonthlyScheduleBtn');
                    if (panel && showBtn) {
                        showBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            if (panel.hasAttribute('hidden')) panel.removeAttribute('hidden');
                            else panel.setAttribute('hidden', '');
                        });
                        if (cancelBtn) cancelBtn.addEventListener('click', () => panel.setAttribute('hidden', ''));
                    }

                    const toggle = document.getElementById('toggleMonthlySendPanel');
                    const sendPanel  = document.getElementById('monthlySendPanel');
                    const cancel = document.getElementById('cancelMonthlySendBtn');
                    const checks = sendPanel ? sendPanel.querySelectorAll('input[name="recipients[]"]') : [];
                    const checkAll = document.getElementById('checkAllMonthlyRec');
                    const count = document.getElementById('sendMonthlyCount');
                    const confirm = document.getElementById('sendMonthlyConfirmBtn');
                    if (!toggle || !sendPanel) return;

                    const toggleLabel = document.getElementById('toggleMonthlySendLabel');
                    function updateCount() {
                        const total = checks.length;
                        const n = Array.from(checks).filter(c => c.checked).length;
                        count.textContent = n + ' selectat' + (n === 1 ? '' : 'i');
                        confirm.disabled = (n === 0);
                        // Butonul rămâne mereu „Trimite acum" — fără actualizare cu numărul.
                        // Numărul de bife e afișat doar în span-ul intern (#sendCount).
                        if (n === 0) {
                            checkAll.checked = false; checkAll.indeterminate = false;
                        } else if (n === total) {
                            checkAll.checked = true; checkAll.indeterminate = false;
                        } else {
                            checkAll.checked = false; checkAll.indeterminate = true;
                        }
                    }
                    toggle.addEventListener('click', () => {
                        if (sendPanel.hasAttribute('hidden')) {
                            sendPanel.removeAttribute('hidden');
                            toggle.classList.add('pressed');
                        } else {
                            sendPanel.setAttribute('hidden', '');
                            toggle.classList.remove('pressed');
                        }
                        updateCount();
                    });
                    cancel.addEventListener('click', () => {
                        sendPanel.setAttribute('hidden', '');
                        toggle.classList.remove('pressed');
                    });
                    checkAll.addEventListener('change', () => {
                        checks.forEach(c => { c.checked = checkAll.checked; });
                        updateCount();
                    });
                    checks.forEach(c => c.addEventListener('change', updateCount));
                    updateCount();
                })();
            </script>`;
}

// =========================================================================================
// Tab: Newsletter → Arhivă

interface ArhivaRow {
  id: number;
  sunday_date: string;
  subject: string;
  html_content: string;
  recipients_count: number;
  failed_count: number;
  created_at: string;
  kind: string | null;
  recipients_json: string | null;
  is_test: number | null;
}

interface Rcpt { name?: string; email?: string; status?: string; category?: string }

const eAlerta = (e: ArhivaRow): boolean => String(e.subject).startsWith("[ALERTĂ]");
const eLunar = (e: ArhivaRow): boolean => (e.kind ?? "weekly") === "monthly";

/** Label scurt pentru o intrare din arhivă ($arch_label). */
function archLabel(entry: ArhivaRow): string {
  const sentAt = formatDtLocal(entry.created_at);
  if (eAlerta(entry)) return "Alertă — " + formatDateRo(entry.sunday_date) + " — " + sentAt;
  if (eLunar(entry)) return "Lunar — " + String(entry.subject) + " — " + sentAt;
  return "Săptămânal — " + formatDateRo(entry.sunday_date) + " — " + sentAt;
}

/** Badge-ul de tip pentru o intrare (fără emoji-uri) ($render_type_badge). */
function renderTypeBadge(entry: ArhivaRow): string {
  let cls: string;
  let txt: string;
  if (eAlerta(entry)) { cls = "archive-badge alert"; txt = "Alertă"; }
  else if (eLunar(entry)) { cls = "archive-badge monthly"; txt = "Lunar"; }
  else { cls = "archive-badge weekly"; txt = "Săptămânal"; }
  const testBadge = Number(entry.is_test ?? 0) === 1 ? ' <span class="archive-badge test">test</span>' : "";
  return `<span class="${cls}">${txt}</span>` + testBadge;
}

function renderRcptCol(list: Rcpt[]): string {
  return list.map((r) => {
    const isFailed = (r.status ?? "sent") === "failed";
    const name = String(r.name ?? "").trim() || "(fără nume)";
    const email = String(r.email ?? "").trim();
    const color = isFailed ? "var(--danger)" : "var(--accent-dark)";
    const tooltip = (isFailed ? "✗ eșuat — " : "✓ trimis — ") + email;
    if (email === "") {
      return `<div class="recipient-row" style="color:${color};">${esc(name)}</div>`;
    }
    return `<div class="recipient-row"><a href="mailto:${esc(email)}" `
      + `title="${esc(tooltip)}" `
      + `style="color:${color};text-decoration:none;border-bottom:1px dotted ${color};">`
      + (isFailed ? "✗ " : "")
      + esc(name)
      + `</a></div>`;
  }).join("");
}

async function tabArchive(db: Baza, url: URL, CSRF: string): Promise<string> {
  // Toate trimiterile, ordonate cronologic descrescător (cel mai recent primul).
  const allArchive = await toate<ArhivaRow>(db, "SELECT * FROM newsletter_history ORDER BY id DESC");

  if (allArchive.length === 0) {
    // No-data state
    return `<div class="form-card"><div class="empty">Arhiva e goală. Pe măsură ce cron-ul trimite newsletter-e, ele vor apărea aici.</div></div>`;
  }

  // ID-ul vizualizat: din ?view=ID sau primul (cel mai recent). Lista nu e goală — s-a ieșit mai
  // sus dacă era —, deci întotdeauna rămâne cu ceva de arătat.
  const viewId = url.searchParams.has("view") ? (parseInt(url.searchParams.get("view") ?? "0", 10) || 0) : 0;
  const current: ArhivaRow = allArchive.find((a) => Number(a.id) === viewId) ?? allArchive[0]!;
  const cid = Number(current.id);

  // Calculează prev (cu id mai mic = mai vechi) și next (mai mare = mai nou).
  let prev: ArhivaRow | null = null;
  let next: ArhivaRow | null = null;
  for (const a of allArchive) {
    const aid = Number(a.id);
    if (aid < cid && (prev === null || aid > Number(prev.id))) prev = a;
    if (aid > cid && (next === null || aid < Number(next.id))) next = a;
  }

  // Decodare destinatari pentru cel curent + DEDUPE pe email lower-case
  let rcptsRaw: Rcpt[] = [];
  if (current.recipients_json) {
    try {
      const decoded: unknown = JSON.parse(String(current.recipients_json));
      if (Array.isArray(decoded)) rcptsRaw = decoded as Rcpt[];
    } catch {
      /* JSON stricat — cădem pe fallback */
    }
  }
  // Fallback pentru intrările vechi fără recipients_json
  if (rcptsRaw.length === 0) {
    const rows = await toate<{ status: string | null; user_id: string | null }>(
      db,
      `SELECT n.status, v.user_id
                             FROM notifications_log n
                             LEFT JOIN volunteers v ON v.id = n.volunteer_id
                             WHERE n.event_type = 'newsletter'
                               AND n.sunday_date = ?
                               AND n.created_at BETWEEN datetime(?, '-5 minutes')
                                                    AND datetime(?, '+5 minutes')
                             ORDER BY n.id ASC`,
      current.sunday_date, current.created_at, current.created_at,
    );
    for (const row of rows) {
      // ⚠️ Ceata (admin/monitor) e cea de ACUM, nu cea de la trimitere: fișa e a contului și se
      // schimbă. Intrările noi n-au nevoie de socoteala asta — ele au `recipients_json`, scris
      // în clipa trimiterii. Asta e doar plasa pentru arhiva veche.
      const om = db.oameni.om(row.user_id);
      let cat = "scheduled";
      if (om?.etichete.includes(ETICHETA_ADMIN)) cat = "admin";
      else if (om?.etichete.includes(ETICHETA_MONITOR)) cat = "monitor";
      rcptsRaw.push({
        name: `${om?.firstName ?? ""} ${om?.lastName ?? ""}`.trim(),
        email: om?.email ?? "",
        status: row.status ?? "sent",
        category: cat,
      });
    }
  }

  // Dedupe pe email lower-case (poate apărea același email de 2 ori la teste vechi).
  const rcpts: Rcpt[] = [];
  const seen = new Set<string>();
  for (const r0 of rcptsRaw) {
    const r: Rcpt = { ...r0 };
    const em = String(r.email ?? "").trim().toLowerCase();
    if (em === "" || seen.has(em)) continue;
    seen.add(em);
    // Asigură că avem categorie — dacă lipsește, o căutăm după adresă în echipa de ACUM.
    if (!r.category) {
      const om = db.oameni.toti().find((o) => (o.email ?? "").toLowerCase() === em);
      if (om?.etichete.includes(ETICHETA_ADMIN)) r.category = "admin";
      else if (om?.etichete.includes(ETICHETA_MONITOR)) r.category = "monitor";
      else r.category = "scheduled";
    }
    rcpts.push(r);
  }

  const rcptsSent = rcpts.filter((r) => (r.status ?? "sent") === "sent");
  const rcptsFailed = rcpts.filter((r) => (r.status ?? "") === "failed");

  // Împarte în 3 coloane (admin / scheduled / monitor)
  const rcptsAdmins = rcpts.filter((r) => (r.category ?? "") === "admin");
  const rcptsScheduled = rcpts.filter((r) => (r.category ?? "") === "scheduled");
  const rcptsMonitors = rcpts.filter((r) => (r.category ?? "") === "monitor");

  const currentIsMonthly = eLunar(current);
  const currentTotal = allArchive.length;

  // Stats teste pentru status bar
  const testCount = await numar(db, "SELECT COUNT(*) FROM newsletter_history WHERE is_test = 1");

  // Poziția în listă (1-based)
  const currentPos = allArchive.findIndex((a) => Number(a.id) === cid) + 1;

  const cur = current;
  return `<div class="form-card">
                <div class="archive-nav">
                    <a class="archive-nav-btn ${prev ? "" : "disabled"}"
                       ${prev ? `href="?tab=archive&view=${Number(prev.id)}"` : ""}
                       title="${prev ? esc(archLabel(prev)) : "Nu există anterior"}"
                       aria-label="Mai vechi">
                        ← Înapoi
                    </a>
                    <div class="archive-nav-label">
                        ${renderTypeBadge(cur)}
                        <div class="archive-nav-title">
                            ${esc(formatDateRo(cur.sunday_date))}
                            · ${esc(formatDtLocal(cur.created_at))}
                        </div>
                        <span class="archive-nav-pos">(${currentPos} din ${currentTotal})</span>
                    </div>
                    <a class="archive-nav-btn ${next ? "" : "disabled"}"
                       ${next ? `href="?tab=archive&view=${Number(next.id)}"` : ""}
                       title="${next ? esc(archLabel(next)) : "Nu există ulterior"}"
                       aria-label="Mai nou">
                        Înainte →
                    </a>
                </div>

                <form method="get" class="archive-jump">
                    <input type="hidden" name="tab" value="archive">
                    <label for="archiveJump">Sari direct la:</label>
                    <select id="archiveJump" name="view" onchange="this.form.submit()">
                        ${allArchive.map((a) => `<option value="${Number(a.id)}" ${Number(a.id) === cid ? "selected" : ""}>
                                ${esc(archLabel(a))}
                            </option>`).join("\n                        ")}
                    </select>
                    <noscript><button type="submit" class="btn small">Mergi</button></noscript>
                </form>

                <div class="archive-statusbar">
                    <span class="archive-statusbar-info">
                        <strong>${currentTotal}</strong> trimiteri în arhivă
                        ${testCount > 0
                          ? `· <span style="color:var(--text-muted);">${testCount} sunt teste</span>`
                          : `· <span style="color:var(--text-muted);">niciun test marcat</span>`}
                    </span>
                    <form method="post" class="archive-statusbar-action"
                          onsubmit="return confirm('Sigur ștergi cele ${testCount} teste din arhivă?');">
                        <input type="hidden" name="action" value="purge_test_newsletters">${CSRF}
                        <button type="submit" class="btn small archive-purge-btn"
                                ${testCount === 0 ? 'disabled title="Nu există teste de șters"' : 'title="Șterge toate trimiterile marcate ca teste"'}>
                            Șterge testele${testCount > 0 ? ` (${testCount})` : ""}
                        </button>
                    </form>
                </div>
            </div>

            <div class="form-card">
                <h2 class="card-title">Destinatari</h2>
                ${rcpts.length === 0 ? `<div class="empty" style="font-size:0.9rem;">
                        Nu există date despre destinatari pentru această trimitere
                        (probabil e una veche, înainte de feature-ul de arhivă).
                    </div>` : `<div style="font-size:0.92rem;color:var(--text-muted);margin-bottom:14px;">
                        <strong style="color:var(--text);">${rcpts.length}</strong>
                        destinatar${rcpts.length === 1 ? "" : "i"} unic${rcpts.length === 1 ? "" : "i"}
                        ${rcptsSent.length > 0 ? `· <span style="color:#4f6c3b;">${rcptsSent.length} ✓ trimise</span>` : ""}
                        ${rcptsFailed.length > 0 ? `· <span style="color:var(--danger);">${rcptsFailed.length} ✗ eșuate</span>` : ""}
                    </div>

                    <div class="recipients-cols">
                        <div class="recipients-col">
                            <strong>Administratori:</strong>
                            <div class="recipients-list">
                                ${rcptsAdmins.length === 0 ? `<span style="color:var(--text-muted);">—</span>` : renderRcptCol(rcptsAdmins)}
                            </div>
                        </div>
                        <div class="recipients-col">
                            <strong>Voluntari programați:</strong>
                            <div class="recipients-list">
                                ${rcptsScheduled.length === 0 ? `<span style="color:var(--text-muted);">—</span>` : renderRcptCol(rcptsScheduled)}
                            </div>
                        </div>
                        <div class="recipients-col">
                            <strong>Monitori:</strong>
                            <div class="recipients-list">
                                ${rcptsMonitors.length === 0 ? `<span style="color:var(--text-muted);">—</span>` : renderRcptCol(rcptsMonitors)}
                            </div>
                        </div>
                    </div>`}
            </div>

            <div class="form-card">
                <div class="card-title-row">
                    <h2 class="card-title" style="margin:0;">Newsletter trimis</h2>
                    ${renderTypeBadge(cur)}
                </div>
                <div style="font-size:0.9rem;color:var(--text-muted);margin-bottom:10px;">
                    <strong>Subiect:</strong> ${esc(cur.subject)}<br>
                    ${currentIsMonthly
                      ? `<strong>Tip:</strong> Newsletter lunar (calendar complet al lunii)<br>`
                      : `<strong>Pentru duminica:</strong> ${esc(formatDateRo(cur.sunday_date))}<br>`}
                    <strong>Trimis pe:</strong> ${esc(formatDtLocal(cur.created_at))}
                </div>
                <iframe srcdoc="${esc(cur.html_content)}"
                        style="width:100%;height:640px;border:1px solid var(--border);border-radius:6px;background:#f7f5f0;"></iframe>
            </div>

            <script>
                // Navigare cu tastatura: săgețile stânga/dreapta pentru prev/next.
                document.addEventListener('keydown', function (e) {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
                    if (e.key === 'ArrowLeft') {
                        const btn = document.querySelector('.archive-nav-btn[href*="view="]:first-of-type');
                        if (btn && !btn.classList.contains('disabled')) window.location.href = btn.href;
                    } else if (e.key === 'ArrowRight') {
                        const btns = document.querySelectorAll('.archive-nav-btn[href*="view="]');
                        const last = btns[btns.length - 1];
                        if (last && !last.classList.contains('disabled')) window.location.href = last.href;
                    }
                });
            </script>`;
}

// =========================================================================================
// Tab: FAQ inline (?tab=faq) — aceleași întrebări ca admin/faq.php

function tabFaq(): string {
  return `<div class="faq-group">
                <h2 class="card-title" style="border-bottom:1px solid var(--border);padding-bottom:6px;">
                    FAQ pentru administratori
                </h2>
                ${ADMIN_FAQ.map((item) => `<details class="faq-item">
                        <summary>${esc(item.q)}</summary>
                        <div class="faq-answer">${item.a}</div>
                    </details>`).join("\n                ")}
            </div>

            <style>
                .faq-group { margin-bottom: 24px; }
                details.faq-item {
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    padding: 12px 14px;
                    margin-bottom: 8px;
                }
                details.faq-item[open] { border-color: var(--accent); }
                details.faq-item summary {
                    cursor: pointer;
                    font-weight: 600;
                    color: var(--text);
                    list-style: none;
                    position: relative;
                    padding-right: 24px;
                }
                details.faq-item summary::-webkit-details-marker { display: none; }
                details.faq-item summary::after {
                    content: '+';
                    position: absolute;
                    right: 0;
                    top: -2px;
                    color: var(--accent-dark);
                    font-size: 1.4rem;
                    font-weight: 700;
                    line-height: 1;
                }
                details.faq-item[open] summary::after { content: '−'; }
                .faq-answer { margin-top: 10px; color: var(--text); font-size: 0.95rem; }
                .faq-answer code {
                    background: #f0ecdf;
                    padding: 1px 5px;
                    border-radius: 4px;
                    font-family: ui-monospace, "SF Mono", Menlo, monospace;
                    font-size: 0.92em;
                }
            </style>`;
}


// =========================================================================================
// Tab: Mesaje de sistem

interface LogRow {
  id: number;
  event_type: string;
  message: string;
  sunday_date: string | null;
  slot_position: number | null;
  volunteer_id: number | null;
  status: string;
  error: string | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
}

function tabLog(logs: LogRow[], logEventTypes: { event_type: string; cnt: number }[], adminAuthed: boolean, CSRF: string): string {
  const modText = NOTIFICATIONS_MODE === "log"
    ? "Mod: log (mesajele nu se trimit încă)"
    : "Mod: WhatsApp activ";

  let tabel: string;
  if (logs.length === 0) {
    tabel = `<div class="empty">Niciun mesaj înregistrat încă.</div>`;
  } else {
    tabel = `<table class="responsive">
                    <thead>
                        <tr>
                            <th>Când</th>
                            <th>Tip</th>
                            <th>Mesaj</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody id="logTableBody">
                        ${logs.map((l) => `<tr data-event-type="${esc(l.event_type)}">
                                <td data-label="Când">
                                    ${esc(formatDtLocal(l.created_at))}
                                </td>
                                <td data-label="Tip">
                                    <span class="log-event ${esc(l.event_type)}">
                                        ${esc(l.event_type)}
                                    </span>
                                </td>
                                <td data-label="Mesaj">${esc(l.message)}</td>
                                <td data-label="Status">
                                    <span class="log-status ${esc(l.status)}">
                                        ${esc(l.status)}
                                    </span>
                                    ${l.error ? `<br><small style="color:var(--danger);">
                                            ${esc(l.error)}
                                        </small>` : ""}
                                </td>
                            </tr>`).join("\n                        ")}
                    </tbody>
                </table>
                <script>
                    (function () {
                        const chips = document.querySelectorAll('.log-filter-chip[data-log-filter]');
                        const rows  = document.querySelectorAll('#logTableBody tr');
                        const title = document.getElementById('logTitle');
                        const totalCount = rows.length;

                        chips.forEach(chip => {
                            chip.addEventListener('click', () => {
                                const filter = chip.dataset.logFilter;
                                let visible = 0;
                                rows.forEach(r => {
                                    const match = !filter || r.dataset.eventType === filter;
                                    r.style.display = match ? '' : 'none';
                                    if (match) visible++;
                                });
                                chips.forEach(c => c.classList.remove('active'));
                                chip.classList.add('active');
                                if (title) {
                                    title.textContent = filter
                                        ? 'Mesaje filtrate: ' + visible + ' (din ' + totalCount + ')'
                                        : 'Ultimele ' + totalCount + ' mesaje';
                                }
                            });
                        });
                    })();
                </script>`;
  }

  return `<div class="toolbar">
                <strong id="logTitle">Ultimele ${logs.length} mesaje</strong>
                <span style="font-size:0.85rem; color:var(--text-muted);">
                    ${modText}
                </span>
                ${logs.length > 0 && adminAuthed ? `<form method="post" style="display:inline;"
                          onsubmit="return confirm('Ștergi tot logul de mesaje? Acțiunea nu se poate anula.');">
                        <input type="hidden" name="action" value="clear_log">${CSRF}
                        <button type="submit" class="btn danger small">Șterge tot logul</button>
                    </form>` : ""}
            </div>

            <div class="log-filters">
                <button type="button" class="log-filter-chip active" data-log-filter="">
                    Toate
                </button>
                ${logEventTypes.map((et) => `<button type="button"
                            class="log-filter-chip log-event ${esc(et.event_type)}"
                            data-log-filter="${esc(et.event_type)}">
                        ${esc(et.event_type)}
                        <span class="log-filter-count">(${Number(et.cnt)})</span>
                    </button>`).join("\n                ")}
            </div>

            ${tabel}`;
}

// =========================================================================================
// CSS-ul inline al paginii de admin (copiat ca atare din admin/index.php)

const STIL_ADMIN = `
        .tabs { display: flex; gap: 4px; border-bottom: 2px solid var(--border); margin-bottom: 16px; }
        .tabs a {
            padding: 10px 16px;
            text-decoration: none;
            color: var(--text-muted);
            border-bottom: 2px solid transparent;
            margin-bottom: -2px;
            font-weight: 500;
        }
        .tabs a.active {
            color: var(--accent-dark);
            border-bottom-color: var(--accent);
        }
        .sub-tabs {
            display: flex;
            gap: 4px;
            margin: -8px 0 18px;
            padding: 6px;
            background: #f0ecdf;
            border-radius: 8px;
        }
        .sub-tabs a {
            flex: 1;
            text-align: center;
            padding: 8px 14px;
            text-decoration: none;
            color: var(--text-muted);
            font-weight: 500;
            font-size: 0.92rem;
            border-radius: 5px;
            transition: background 0.15s, color 0.15s;
        }
        .sub-tabs a:hover {
            background: rgba(255, 255, 255, 0.6);
            color: var(--text);
        }
        .sub-tabs a.active {
            background: #6b6a5e;
            color: #ffffff;
            font-weight: 600;
        }
        .sub-tabs a.active:hover {
            background: #555548;
            color: #ffffff;
        }
        table { width: 100%; border-collapse: collapse; background: var(--surface); border-radius: 8px; overflow: hidden; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
        th { background: #f0ecdf; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted); }
        tr.inactive { opacity: 0.55; }
        .btn {
            display: inline-block;
            padding: 6px 12px;
            background: var(--accent);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            border: none;
            font-size: 0.85rem;
            cursor: pointer;
        }
        .btn:hover { background: var(--accent-dark); }
        .btn.secondary { background: var(--text-muted); }
        .btn.danger { background: var(--danger); }
        .btn.warning { background: var(--warning); }
        .btn.warning:hover { background: #a85f24; }
        .btn.outline {
            background: transparent;
            color: var(--accent-dark);
            border: 1px solid var(--border);
        }
        .btn.outline:hover { background: #f0ecdf; border-color: var(--accent); }
        .btn.small { padding: 4px 8px; font-size: 0.78rem; white-space: nowrap; }
        .btn.icon-only {
            padding: 5px 7px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
        }
        .btn.icon-only svg { display: block; }

        /* Voluntari — carduri 2-col pe desktop, 1-col pe mobil */
        .volunteer-cards {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
        }
        .volunteer-cards .vc-divider { grid-column: 1 / -1; }
        .volunteer-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            gap: 0;
        }
        .volunteer-card.inactive { opacity: 0.6; }
        .volunteer-card.admin   { border-left: 4px solid var(--warning); }
        .volunteer-card.monitor { border-left: 4px solid #3a7bb8; }
        .vc-summary {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            padding: 2px 0;
            user-select: none;
        }
        .vc-summary:hover { color: var(--accent-dark); }
        .vc-summary-actions {
            margin-left: auto;
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }
        .vc-summary-wa {
            width: 18px;
            height: 18px;
            border: none;
        }
        .vc-summary-wa::before {
            width: 18px;
            height: 18px;
        }
        .vc-chevron {
            font-size: 0.9rem;
            color: var(--text-muted);
            transition: transform 0.2s;
            display: inline-block;
        }
        .volunteer-card.expanded .vc-chevron { transform: rotate(180deg); }
        .vc-details { margin-top: 12px; }
        .vc-main {
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        .vc-content { min-width: 0; }
        .vc-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
        .vc-name { font-size: 1rem; color: var(--text); }
        .vc-summary-name {
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-width: 0;
        }
        .vc-role-tag {
            align-self: flex-start;
            font-size: 0.6rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            padding: 1px 7px;
            border-radius: 4px;
            line-height: 1.6;
            white-space: nowrap;
        }
        .vc-role-tag.volunteer { background: #e7efe0; color: #4a6b35; }
        .vc-role-tag.admin     { background: #f6e6d2; color: #a85f24; }
        .vc-role-tag.monitor   { background: #dceaf5; color: #2f6da3; }
        .vc-led {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            flex-shrink: 0;
            margin: 0 6px 0 4px;
        }
        .vc-led.on      { background: #4caf50; box-shadow: 0 0 6px #4caf50aa; }
        .vc-led.off     { background: #b04848; box-shadow: 0 0 4px #b0484888; }
        .vc-led.neutral { background: #e6c64c; box-shadow: 0 0 5px #e6c64caa; }
        .vc-row { font-size: 0.9rem; padding: 2px 0; }
        .vc-key { color: var(--text-muted); margin-right: 6px; }

        .vc-statusbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid var(--border);
            font-size: 0.75rem;
            color: var(--text-muted);
        }
        .vc-statusbar code {
            background: #f0ecdf;
            padding: 1px 5px;
            border-radius: 3px;
            font-family: ui-monospace, "SF Mono", Menlo, monospace;
            font-size: 0.95em;
            color: var(--text);
        }
        .vc-val a { color: var(--accent-dark); }
        .vc-toggles {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px 18px;
            padding-top: 10px;
            border-top: 1px dashed var(--border);
        }
        .vc-toggles .ios-toggle-form { display: block; flex: 0 0 auto; }
        .vc-toggles .ios-toggle {
            justify-content: flex-start;
            gap: 14px;
            width: auto;
        }
        .ios-toggle-form { margin: 0; }
        .ios-toggle {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            width: 100%;
            background: none;
            border: none;
            padding: 4px 0;
            cursor: pointer;
            font-family: inherit;
            font-size: 0.85rem;
            color: var(--text);
        }
        .ios-toggle-label { font-weight: 500; min-width: 70px; }
        .ios-toggle-track {
            display: inline-block;
            position: relative;
            width: 38px;
            height: 22px;
            background: #d1d1d1;
            border-radius: 11px;
            transition: background 0.2s;
            flex-shrink: 0;
        }
        .ios-toggle.on .ios-toggle-track { background: var(--accent); }
        .ios-toggle.warning.on .ios-toggle-track { background: var(--warning); }
        .ios-toggle.info.on .ios-toggle-track { background: #3a7bb8; }
        .ios-toggle-knob {
            position: absolute;
            top: 2px;
            left: 2px;
            width: 18px;
            height: 18px;
            background: #ffffff;
            border-radius: 50%;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
            transition: transform 0.2s;
        }
        .ios-toggle.on .ios-toggle-knob { transform: translateX(16px); }
        .ios-toggle:hover .ios-toggle-track { filter: brightness(0.95); }

        .vc-divider {
            border: none;
            border-top: 1px solid var(--border);
            margin: 6px 0;
        }

        @media (max-width: 540px) {
            .volunteer-cards { grid-template-columns: 1fr; }
            .vc-main { flex-direction: column; gap: 10px; }
            .vc-toggles { gap: 12px 24px; }
        }

        /* Card prompt pentru "Adaugă voluntar" */
        .add-volunteer-prompt {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 20px;
        }
        .add-volunteer-text { color: var(--text-muted); font-size: 0.95rem; }
        .add-volunteer-prompt .btn {
            padding: 6px 14px;
            font-size: 0.9rem;
            font-weight: 600;
        }
        @media (max-width: 540px) {
            .add-volunteer-prompt {
                flex-direction: column;
                text-align: center;
            }
            .add-volunteer-prompt .btn {
                padding: 10px 22px;
                font-size: 1rem;
            }
        }

        /* Cererile de intrare în echipă — stau sus, înaintea echipei, fiindcă așteaptă o hotărâre. */
        .cereri { margin-bottom: 22px; }
        .cerere-rand {
            display: flex; align-items: center; justify-content: space-between; gap: 14px;
            background: var(--surface); border: 1px solid var(--border);
            border-left: 3px solid var(--accent, #b3432f);
            border-radius: 8px; padding: 12px 14px; margin-bottom: 8px;
        }
        .cerere-sub { color: var(--text-muted); font-size: 0.85rem; margin-top: 2px; }
        .cerere-actiuni { display: flex; gap: 8px; }
        .cerere-actiuni form { margin: 0; }
        .cerere-actiuni .btn { padding: 6px 14px; font-size: 0.9rem; white-space: nowrap; }
        @media (max-width: 540px) {
            .cerere-rand { flex-direction: column; align-items: stretch; }
            .cerere-actiuni .btn { width: 100%; }
        }

        /* Lista „+ Adaugă": un rând = un cont al platformei, neasociat cu curățenia. */
        .add-lista { list-style: none; margin: 0; padding: 0; max-height: 52vh; overflow-y: auto; }
        .add-lista li { margin: 0 0 6px; }
        .add-lista form { margin: 0; }
        .add-lista button {
            display: block; width: 100%; text-align: left; cursor: pointer;
            background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
            padding: 9px 12px; color: inherit; font: inherit;
        }
        .add-lista button:hover { border-color: var(--accent, #b3432f); }
        .add-sub { display: block; color: var(--text-muted); font-size: 0.82rem; margin-top: 2px; }

        /* Modal voluntar (Adaugă / Editează) */
        .vol-modal {
            position: fixed;
            inset: 0;
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .vol-modal-overlay {
            position: absolute;
            inset: 0;
            background: rgba(20, 18, 12, 0.45);
        }
        .vol-modal-content {
            position: relative;
            background: var(--surface);
            border-radius: 10px;
            padding: 22px;
            max-width: 560px;
            width: 100%;
            max-height: 90vh;
            overflow: auto;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
        }
        .vol-modal-close {
            position: absolute;
            top: 8px;
            right: 10px;
            width: 32px;
            height: 32px;
            border: none;
            background: transparent;
            color: var(--text-muted);
            font-size: 1.5rem;
            line-height: 1;
            cursor: pointer;
            border-radius: 50%;
        }
        .vol-modal-close:hover { background: #f0ecdf; color: var(--text); }
        .vol-modal-error {
            background: #f8dcdc;
            border: 1px solid var(--danger);
            color: #7a2828;
            padding: 8px 12px;
            border-radius: 6px;
            margin-bottom: 12px;
            font-size: 0.92rem;
        }

        /* Destinatari pe 3 coloane */
        .recipients-cols {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0;
            margin-bottom: 12px;
        }
        .recipients-col {
            padding: 0 14px;
            border-right: 1px solid var(--border);
        }
        .recipients-col:first-child { padding-left: 0; }
        .recipients-col:last-child {
            padding-right: 0;
            border-right: none;
        }
        .recipients-col strong {
            display: block;
            margin-bottom: 6px;
            font-size: 0.9rem;
        }
        .recipients-list { font-size: 0.92rem; line-height: 1.4; }
        .recipient-row { padding: 2px 0; }
        /* Voluntari în vacanță — tăiați + culoare estompată în Destinatari și pool */
        .recipient-row.on-vacation,
        .recipient-row.on-vacation a {
            text-decoration: line-through !important;
            color: var(--text-muted) !important;
            border-bottom: none !important;
        }
        .send-recipient.on-vacation {
            opacity: 0.55;
            cursor: not-allowed;
        }
        .send-recipient.on-vacation .send-rec-name,
        .send-recipient.on-vacation .send-rec-email {
            text-decoration: line-through;
        }
        @media (max-width: 720px) {
            .recipients-cols { grid-template-columns: 1fr; }
            .recipients-col {
                padding: 10px 0;
                border-right: none;
                border-bottom: 1px solid var(--border);
            }
            .recipients-col:last-child { border-bottom: none; }
        }

        /* Buton mare "Trimite acum" */
        .btn-send-now {
            padding: 12px 28px !important;
            font-size: 1rem !important;
        }

        /* Toggle pentru deschiderea panoului de Trimite — verde implicit, gri când e apăsat */
        .btn-send-toggle {
            padding: 12px 28px !important;
            font-size: 1rem !important;
        }
        .btn-send-toggle.pressed {
            background: #d9d2c2 !important;
            color: var(--text) !important;
            border: 1px solid #b8ad95 !important;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.12);
        }
        .btn-send-toggle:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .send-recipients-list {
            border-top: 1px solid var(--border);
            max-height: 320px;
            overflow-y: auto;
        }
        .send-recipient {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 4px;
            border-bottom: 1px solid var(--border);
            cursor: pointer;
            font-size: 0.9rem;
        }
        .send-recipient:hover { background: #f7f5f0; }
        .send-rec-text {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .send-rec-name { font-weight: 600; }
        .send-rec-email { color: var(--text-muted); font-size: 0.82rem; margin-left: 4px; }
        .send-rec-cat {
            flex-shrink: 0;
            font-size: 0.7rem;
            padding: 2px 8px;
            border-radius: 10px;
            background: #f0ecdf;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        input[type=text], input[type=email], input[type=password],
        .form-card select {
            padding: 8px;
            border: 1px solid var(--border);
            border-radius: 6px;
            font-size: 0.95rem;
            width: 100%;
            background: var(--surface);
        }
        .form-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 20px;
        }
        .form-card h2.card-title {
            margin: 0 0 14px;
            font-size: 1.25rem;
            font-weight: 700;
            color: var(--accent-dark);
        }
        .form-card h3.card-subtitle {
            margin: 0 0 8px;
            font-size: 1rem;
            font-weight: 600;
            color: var(--text);
        }
        .card-title-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 14px;
        }
        .cron-status {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 0.85rem;
            color: var(--text-muted);
            cursor: help;
        }
        .cron-led {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
        }
        .cron-status-ok    .cron-led { background: #4caf50; box-shadow: 0 0 6px #4caf50aa; }
        .cron-status-fail  .cron-led { background: #b04848; box-shadow: 0 0 5px #b0484888; }
        .cron-status-never .cron-led { background: #e6c64c; box-shadow: 0 0 5px #e6c64caa; }

        /* ===== Pagina Arhivă ===== */
        .archive-nav {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
        }
        .archive-nav-btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 8px 14px;
            border-radius: 6px;
            background: var(--accent);
            color: #fff;
            text-decoration: none;
            font-size: 0.92rem;
            font-weight: 600;
            border: 1px solid var(--accent-dark);
            transition: background 0.15s;
            white-space: nowrap;
        }
        .archive-nav-btn:hover { background: var(--accent-dark); }
        .archive-nav-btn.disabled {
            opacity: 0.4;
            pointer-events: none;
            cursor: default;
        }
        .archive-nav-label {
            flex: 1;
            min-width: 200px;
            text-align: center;
            color: var(--text);
            font-size: 0.95rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
        }
        .archive-nav-title {
            font-weight: 600;
            color: var(--text);
        }
        .archive-nav-pos {
            display: block;
            color: var(--text-muted);
            font-weight: 400;
            font-size: 0.82rem;
        }
        .archive-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 5px;
            font-size: 0.82rem;
            font-weight: 600;
            letter-spacing: 0.02em;
            border: none;
            line-height: 1.2;
            color: #ffffff;
        }
        .archive-badge.weekly  { background: #6b6a5e; }
        .archive-badge.monthly { background: #c97a3a; }
        .archive-badge.alert   { background: #b04848; }
        .archive-badge.test {
            background: #f0ecdf;
            color: var(--text-muted);
            font-size: 0.72rem;
            padding: 2px 8px;
        }
        .archive-statusbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            margin-top: 14px;
            padding-top: 12px;
            border-top: 1px dashed var(--border);
            font-size: 0.9rem;
            color: var(--text);
            flex-wrap: wrap;
        }
        .archive-statusbar-info { color: var(--text); }
        .archive-statusbar-action { margin: 0; }
        .archive-purge-btn {
            background: #b04848 !important;
            border-color: #b04848 !important;
            color: #fff !important;
        }
        .archive-purge-btn:hover:not(:disabled) {
            background: #8e3838 !important;
            border-color: #8e3838 !important;
        }
        .archive-purge-btn:disabled {
            background: #d9d2c2 !important;
            border-color: #d9d2c2 !important;
            color: var(--text-muted) !important;
            cursor: not-allowed;
            opacity: 0.7;
        }
        .archive-jump {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 14px;
            padding-top: 12px;
            border-top: 1px dashed var(--border);
            font-size: 0.9rem;
            color: var(--text-muted);
            flex-wrap: wrap;
        }
        .archive-jump select {
            flex: 1;
            min-width: 240px;
        }
        .archive-recipients {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: 6px;
        }
        .archive-recipient {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            background: #f7f5f0;
            border: 1px solid var(--border);
            border-radius: 6px;
            font-size: 0.9rem;
        }
        .archive-recipient.failed {
            background: #fbe9e9;
            border-color: #e2bcbc;
        }
        .archive-recipient-status {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #4f6c3b;
            color: #fff;
            font-size: 0.7rem;
            font-weight: 700;
            flex-shrink: 0;
        }
        .archive-recipient.failed .archive-recipient-status {
            background: var(--danger);
        }
        .archive-recipient-name {
            font-weight: 600;
            color: var(--text);
            flex-shrink: 0;
        }
        .archive-recipient-email {
            color: var(--text-muted);
            text-decoration: none;
            font-size: 0.82rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            min-width: 0;
        }
        .archive-recipient-email:hover { color: var(--accent-dark); }
        @media (max-width: 540px) {
            .archive-nav-label { order: -1; width: 100%; margin-bottom: 8px; }
            .archive-nav-btn { flex: 1; justify-content: center; }
        }

        .alert-incomplete {
            background: #fff8e6;
            border: 1px solid var(--warning);
            border-left: 4px solid var(--warning);
            padding: 10px 14px;
            margin: 0 0 12px;
            border-radius: 6px;
            color: #7a5a14;
            font-size: 0.9rem;
        }
        .schedule-row {
            display: flex;
            gap: 10px;
            align-items: flex-end;
            flex-wrap: wrap;
        }
        .schedule-field { flex: 1 1 140px; min-width: 0; }
        .schedule-field label {
            display: block;
            font-size: 0.85rem;
            color: var(--text-muted);
            margin-bottom: 2px;
        }
        .schedule-field select { width: 100%; }
        .schedule-actions {
            display: flex;
            gap: 8px;
            flex: 0 0 auto;
            padding-bottom: 1px;   /* aliniere optică cu select-urile */
        }
        @media (max-width: 540px) {
            .schedule-actions { width: 100%; }
            .schedule-actions .btn { flex: 1; }
        }
        .form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }
        .flash {
            padding: 10px 14px;
            border-radius: 6px;
            margin-bottom: 16px;
            font-size: 0.95rem;
        }
        .flash.ok  { background: #dcecc9; border: 1px solid var(--accent); color: var(--accent-dark); }
        .flash.err { background: #f8dcdc; border: 1px solid var(--danger); color: var(--danger); }
        .log-event { font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; background: var(--slot-free-bg); }
        .log-event.occupy  { background: #c7dab2; }
        .log-event.release { background: #f0d8a8; }
        .log-event.volunteer_added { background: #c8d8e8; }
        .log-event.newsletter { background: #e8d4f0; }

        .log-filters {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            align-items: center;
            margin-bottom: 12px;
        }
        .log-filter-chip {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 3px 9px;
            font-size: 0.75rem;
            font-family: inherit;
            border: 1px solid var(--border);
            border-radius: 12px;
            background: var(--surface);
            color: var(--text);
            cursor: pointer;
            transition: border-color 0.15s, transform 0.05s;
            -webkit-appearance: none;
            appearance: none;
        }
        .log-filter-chip:hover { border-color: var(--accent); }
        .log-filter-chip:active { transform: scale(0.96); }
        .log-filter-chip.active {
            border-color: var(--accent-dark);
            box-shadow: 0 0 0 2px rgba(107, 142, 78, 0.25);
            font-weight: 600;
        }
        .log-filter-count {
            font-size: 0.7rem;
            color: var(--text-muted);
            font-weight: normal;
        }
        .log-filter-chip.active .log-filter-count { color: var(--text); }
        .log-status { font-size: 0.78rem; color: var(--text-muted); }
        .log-status.sent  { color: var(--accent-dark); }
        .log-status.failed { color: var(--danger); }
        .empty { padding: 32px; text-align: center; color: var(--text-muted); }
        .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }

        @media (max-width: 540px) {
            .form-grid { grid-template-columns: 1fr; }
            table.responsive thead { display: none; }
            table.responsive tr {
                display: block;
                border-bottom: 1px solid var(--border);
                padding: 10px 0;
            }
            table.responsive td {
                display: block;
                border: none;
                padding: 4px 10px;
            }
            table.responsive td::before {
                content: attr(data-label) ": ";
                font-weight: 600;
                color: var(--text-muted);
                font-size: 0.78rem;
                text-transform: uppercase;
                display: block;
            }
        }
    `;
