/**
 * Pagina de programare — `index.php` din V1, purtare cu purtare, pe carcasa platformei.
 *
 * Trei stări:
 *   1. nu e nimeni în echipă la tastatură → calendarul doar de citit + panoul de intrare;
 *   2. cine e în echipă (asociere acceptată) → calendarul editabil pe luna curentă și pe cea
 *      viitoare, arhiva doar de citit;
 *   3. cine are `cleaning.manage` editează orice duminică, în numele oricui.
 *
 * Ce s-a schimbat față de V1: antetul, subsolul și meniul contului vin din `@xc/ui`; numele
 * duminicii se cere de la calendar (A1); dreptul de administrare e cel central, nu o parolă locală;
 * fiecare apăsare de slot poartă jetonul CSRF. Restul — clasele, cuvintele, așezarea — e din V1.
 *
 * ⚠️ Starea 1 era, până pe 14.09.2026, PICKERUL: lista de nume din care omul se alegea singur, fără
 * cont. A ieșit cu totul, cerut anume de utilizator — cine e cine se știe acum din contul platformei.
 */

import { LUNI_RO, MIN_VOLUNTARI, VACANTA_IN_PAGINA, GRUP_WHATSAPP } from "../config.js";
import {
  prezenteTotale, lunaCurenta, etichetaLuna, lunaEditabila, duminicaTrecuta,
  ultimaPrezenta, participareaLunii, luniCuProgramari, lunaViitoare,
  notaParticipare, sorteazaParticiparea, duminicileLunii, type Luna, type NumeDuminici,
} from "../calendar.js";
import {
  programarileLunii, ultimaMiscare, totiVoluntarii, voluntariActivi, numeIntreg, toate,
  numeScurt, type ProgramariPeZi, type Voluntar,
} from "../depozit.js";
import { esc } from "@xc/ui";
import { waLinkDin } from "../html.js";
import { adminFaraVoluntar } from "../identitate.js";
import { type Ctx, campCsrf, pagina } from "../pagina.js";
import { JS_SLOTURI } from "../sloturi-js.js";
import { acum, formatDateRo, formatDtLocal, type Moment } from "../timp.js";
import type { Baza } from "../oameni.js";

/**
 * Pagina de programare. `voluntar` = rândul legat de contul omului, dacă are unul; `null` sau
 * neprimit în echipă, și fără drept de administrare = pagina de vizitator.
 */
export async function paginaIndex(
  ctx: Ctx,
  db: Baza,
  request: Request,
  url: URL,
  voluntar: Voluntar | null,
  nume: NumeDuminici,
): Promise<string> {
  const mo = acum();

  /*
   * Calendarul editabil e al celor din ECHIPĂ (asociere acceptată) și al administratorilor.
   * Cine are cont dar n-a fost primit încă vede tot pagina de vizitator — cu deosebirea că
   * panoul îi spune ce-i lipsește, iar rândul de unelte îl duce la contul lui.
   */
  const inEchipa = voluntar !== null && voluntar.is_active === 1;

  if (!inEchipa && !ctx.eAdmin) {
    return renderVizitatorPage(ctx, db, request, url, mo, nume, voluntar);
  }

  // Adminul intrat cu contul platformei, care n-are rând al lui, vede tot calendarul.
  const me = voluntar ?? adminFaraVoluntar(ctx.utilizator, ctx.userId);
  return renderCalendarPage(ctx, db, url, mo, me, ctx.eAdmin, nume);
}

// =========================================================================

const ICON_ARHIVA = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M12 2 2 7l10 5 10-5-10-5Z"/>
                                <path d="M2 17l10 5 10-5"/>
                                <path d="M2 12l10 5 10-5"/>
                            </svg>`;

function parametriLuna(url: URL, cy: number, cm: number): [number, number] {
  const y = url.searchParams.has("y") ? parseInt(url.searchParams.get("y") ?? "", 10) : cy;
  const m = url.searchParams.has("m") ? parseInt(url.searchParams.get("m") ?? "", 10) : cm;
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12 || y < 2000 || y > 2100) return [cy, cm];
  return [y, m];
}

function arhivaFara(archive: Luna[], cy: number, cm: number, ny: number, nm: number): Luna[] {
  return archive.filter((a) => !(a.year === cy && a.month === cm) && !(a.year === ny && a.month === nm));
}

/** Rândul de sub calendar: ultima mișcare din calendar + întrebările frecvente. */
async function infoJos(db: Baza, prefix: string): Promise<string> {
  const raw = await ultimaMiscare(db);
  const upd = raw ? formatDtLocal(raw, "d.m.Y") : null;
  return `<p class="info-jos">
                ${upd ? `Ultima actualizare: ${esc(upd)} &middot;` : ""}
                <a href="${esc(prefix)}/faq">Întrebări frecvente</a>
            </p>`;
}

/** Bara cu lunile din arhivă (identică pe picker și pe calendar; doar id-urile diferă). */
function baraArhiva(id: string, archiveOnly: Luna[], inArchive: boolean, selY: number, selM: number): string {
  if (archiveOnly.length === 0) return "";
  return `<div id="${id}" class="archive-bar"${inArchive ? "" : " hidden"}>
                    ${archiveOnly.map((a) => {
                      const isSel = inArchive && a.year === selY && a.month === selM;
                      return `<a href="?y=${a.year}&m=${a.month}"
                           class="archive-month${isSel ? " active" : ""}">
                            ${esc(a.label)}
                        </a>`;
                    }).join("\n                    ")}
                </div>`;
}

function butonArhiva(id: string, barId: string, open: boolean): string {
  return `<button type="button" id="${id}"
                                class="month-tab archive-btn icon-only${open ? " open" : ""}"
                                aria-expanded="${open ? "true" : "false"}"
                                aria-controls="${barId}"
                                aria-label="Arhivă"
                                title="Arhivă — vezi calendarele din lunile trecute">
                            ${ICON_ARHIVA}
                        </button>`;
}

// =========================================================================
/**
 * Pagina celui care nu s-a arătat. Până pe 14.09.2026 aici stătea PICKERUL — lista de nume din
 * care omul se alegea singur, fără cont. A ieșit cu totul, cerut anume de utilizator: „butonul
 * Autentificare dispare și funcția lui este preluată de Cont". Acum pagina arată calendarul de
 * citit și o singură ușă: intrarea cu contul platformei, din antet ori din panoul de aici.
 */
async function renderVizitatorPage(ctx: Ctx, db: Baza, _request: Request, url: URL, mo: Moment, nume: NumeDuminici, _voluntarAcum: Voluntar | null): Promise<string> {
  /** Panoul de intrare se deschide de la început numai dacă a fost cerut anume (`?intra=1`). */
  const cereListaAcum = url.searchParams.has("intra");
  const admins = (await totiVoluntarii(db)).filter((v) => v.is_active === 1 && v.is_admin === 1);

  const [cy, cm] = lunaCurenta(mo);
  const [ny, nm] = lunaViitoare(mo);
  const [selY, selM] = parametriLuna(url, cy, cm);

  const isCurrentMonthPicker = selY === cy && selM === cm;
  const isNextMonthPicker = selY === ny && selM === nm;
  const isArchivePicker = !isCurrentMonthPicker && !isNextMonthPicker;
  const currentMonthLabel = etichetaLuna(cy, cm);
  const nextMonthLabel = etichetaLuna(ny, nm);
  const selectedLabel = etichetaLuna(selY, selM);

  // Pre-randăm ambele luni (curentă + viitoare) ca să le comutăm cu JS fără reîncărcare.
  const currentSundays = duminicileLunii(cy, cm);
  const currentAssignments = await programarileLunii(db, cy, cm);
  const nextSundays = duminicileLunii(ny, nm);
  const nextAssignments = await programarileLunii(db, ny, nm);
  const pickerSundays = duminicileLunii(selY, selM);
  const pickerAssignments = isArchivePicker ? await programarileLunii(db, selY, selM) : {};
  const archive = await luniCuProgramari(db);

  // Toate vacanțele active (luna curentă + viitoare), grupate pe (year, month).
  // ⚠️ Numele nu mai vin din JOIN (nu mai sunt în tabel): interogarea aduce `user_id`, iar numele
  // se lipesc din cartea oamenilor.
  const vacRows = await toate<{ id: number; user_id: string; year: number; month: number }>(
    db,
    `SELECT v.id, v.user_id, vc.year, vc.month
       FROM volunteer_vacations vc JOIN volunteers v ON v.id = vc.volunteer_id
      WHERE vc.year > ?1 OR (vc.year = ?1 AND vc.month >= ?2)
      ORDER BY vc.year ASC, vc.month ASC`,
    cy, cm,
  );
  interface VacGroup { year: number; month: number; label: string; volunteers: { id: number; first_name: string; last_name: string; short_name: string | null }[] }
  const vacationGroups: Record<string, VacGroup> = {};
  for (const r of vacRows) {
    const om = db.oameni.om(r.user_id);
    if (!om || om.stare !== "acceptata") continue;
    const key = `${Number(r.year)}-${Number(r.month)}`;
    (vacationGroups[key] ??= { year: Number(r.year), month: Number(r.month), label: etichetaLuna(Number(r.year), Number(r.month)), volunteers: [] })
      .volunteers.push({ id: Number(r.id), first_name: om.firstName, last_name: om.lastName, short_name: om.shortName });
  }

  const adminLinks = admins.map((a) => {
    const full = numeIntreg(a);
    const wa = waLinkDin(a.phone);
    if (!wa) return esc(full);
    return `<a href="${esc(wa)}" target="_blank" rel="noopener" class="wa-link">${esc(full)}</a>`;
  });

  const renderMonth = (sundays: string[], assignments: ProgramariPeZi, labelEmpty: string): string => {
    if (sundays.length === 0) return `<div class="note">Nu există duminici în ${esc(labelEmpty)}.</div>`;
    let out = "";
    for (const sunday of sundays) {
      const name = nume(sunday);
      const dateLabel = formatDateRo(sunday);
      const past = duminicaTrecuta(sunday, mo);
      out += `<article class="sunday-card${past ? " past" : ""}">`;
      out += `<div class="date">${esc(dateLabel)}</div>`;
      out += `<div class="liturgical">${esc(name)}</div>`;
      const occupied = assignments[sunday] ?? {};
      const positions = Object.keys(occupied).map(Number);
      const maxPos = positions.length ? Math.max(...positions) : 0;
      const slotCount = Math.max(MIN_VOLUNTARI, maxPos);
      const colsCount = Math.min(4, slotCount);
      out += `<div class="slots" style="--slot-count: ${colsCount};">`;
      for (let i = 1; i <= slotCount; i++) {
        const a = occupied[i];
        const classes = ["slot", "readonly", "view-slot"];
        if (a) classes.push("taken");
        const slotLabel = a ? numeScurt(a) : "liber";
        out += `<button type="button" class="${classes.join(" ")}" title="Intră cu contul parohiei ca să te înscrii">`;
        out += `<span class="position">Voluntar ${i}</span>`;
        out += `<span class="label">${esc(slotLabel)}</span>`;
        out += `</button>`;
      }
      out += `</div></article>`;
    }
    return out;
  };

  const archiveOnly = arhivaFara(archive, cy, cm, ny, nm);

  const vacantaHtml = !VACANTA_IN_PAGINA ? "" : (Object.keys(vacationGroups).length === 0
    ? `<div class="section-header" style="margin-top: 20px;">
                        <h2 class="section-title">Vacanță</h2>
                    </div>
                    <div class="note" style="color: var(--text-muted);">
                        Nimeni nu și-a marcat vacanța pentru lunile următoare.
                    </div>`
    : Object.values(vacationGroups).map((group) => `<div class="section-header" style="margin-top: 20px;">
                            <h2 class="section-title">Vacanță</h2>
                            <span class="status-tag" title="Voluntari care și-au marcat vacanța">
                                ${esc(group.label.toLowerCase())}
                            </span>
                        </div>
                        <ul class="picker-list">
                            ${group.volunteers.map((vv) => `<li>
                                    <span class="vacation-mark"
                                          title="${esc(numeIntreg(vv))} — vacanță în ${esc(group.label)}">
                                        ${esc(numeScurt(vv))}
                                    </span>
                                </li>`).join("\n")}
                        </ul>`).join("\n"));

  /*
   * Panoul de INTRARE. A luat locul listei de nume („pickerul"), scoasă pe 14.09.2026. Stă ascuns
   * ca și ea: întâi se vede calendarul, iar panoul se deschide din butonul „Intră" al rândului de
   * unelte ori din fereastra „doar vizualizare". Cu `?intra=1` se deschide de la început.
   */
  const corp = `<section id="authPanel" class="auth-panel"${cereListaAcum ? "" : " hidden"}>
                <button type="button" class="auth-close" id="authClose" aria-label="Închide" title="Închide">×</button>
                <div class="section-header">
                    <h2 class="section-title">Intră ca să te înscrii</h2>
                </div>

                <div class="note">
                    Programarea la curățenie se face cu <strong>contul parohiei</strong>. Intri cu
                    adresa de e-mail și un cod de șase cifre — fără parolă.
                </div>

                <p style="margin:14px 0 0">
                    <a class="btn-platforma" href="${esc(ctx.nav.cont)}/intra?spre=${encodeURIComponent(ctx.spre ?? "")}">Intră cu contul platformei</a>
                </p>

                <div class="note">
                    După ce intri, cere intrarea în echipă de pe pagina contului tău, de la
                    <strong>„Aplicațiile mele" → Curățenia bisericii</strong>. Un administrator al
                    curățeniei te primește, și de atunci poți apăsa pe sloturi.
                    ${admins.length > 0 ? `<div style="margin-top:6px;">
                            Admini:
                            ${adminLinks.join(", ")}
                        </div>
                        <div style="margin-top:6px;">
                            Grup:
                            <a href="${GRUP_WHATSAPP}"
                               target="_blank" rel="noopener" class="wa-link">Albinele Sfântului Ilie</a>
                        </div>` : ""}
                </div>

                ${vacantaHtml}
            </section>

            <div id="calendarSection">
            <div class="section-header">
                <h2 class="section-title">Calendar</h2>
                <span class="status-tag">doar vizualizare</span>
            </div>
            <div class="month-bar">
                <div class="month-tabs">
                    ${archiveOnly.length > 0 ? butonArhiva("archiveTogglePicker", "archiveBarPicker", isArchivePicker) : ""}
                    <button type="button" data-month-view="current"
                            class="month-tab${isCurrentMonthPicker ? " active" : ""}">
                        Luna curentă
                    </button>
                    <button type="button" data-month-view="next"
                            class="month-tab${isNextMonthPicker ? " active" : ""}">
                        Luna viitoare
                    </button>
                </div>
            </div>
            ${baraArhiva("archiveBarPicker", archiveOnly, isArchivePicker, selY, selM)}

            <div id="monthView-current" class="month-view" ${isCurrentMonthPicker ? "" : "hidden"}>
                ${renderMonth(currentSundays, currentAssignments, currentMonthLabel)}
            </div>
            <div id="monthView-next" class="month-view" ${isNextMonthPicker ? "" : "hidden"}>
                ${renderMonth(nextSundays, nextAssignments, nextMonthLabel)}
            </div>
            ${isArchivePicker ? `<div id="monthView-archive" class="month-view">
                    ${renderMonth(pickerSundays, pickerAssignments, selectedLabel)}
                </div>` : ""}
            </div>

            <dialog id="viewOnlyDialog" class="contact-dialog viewonly-dialog" aria-labelledby="viewOnlyTitle">
                <h3 id="viewOnlyTitle">Ești în modul vizualizare</h3>
                <p>Poți vedea programul, dar ca să te înscrii la o duminică sau să te retragi
                   trebuie să intri cu contul parohiei și să fii în echipa de curățenie.</p>
                <div class="viewonly-actions">
                    <button type="button" class="btn-secondary" id="viewOnlyClose">Închide</button>
                    <button type="button" class="btn-auth" id="viewOnlyAuth">Intră</button>
                </div>
            </dialog>

            ${await infoJos(db, ctx.prefix)}`;

  const scripturi = `
                (function () {
                    // Panoul de intrare: se deschide din butonul „Intră" al rândului de
                    // unelte ori din fereastra „doar vizualizare".
                    const authPanel = document.getElementById('authPanel');
                    const authClose = document.getElementById('authClose');
                    const authBtn = document.getElementById('btnAutentificare');

                    function getCalendar() { return document.getElementById('calendarSection'); }

                    function openAuth() {
                        if (!authPanel) return;
                        authPanel.removeAttribute('hidden');
                        const cal = getCalendar();
                        if (cal) cal.setAttribute('hidden', '');
                        authPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        const intra = authPanel.querySelector('.btn-platforma');
                        if (intra) intra.focus();
                    }
                    function closeAuth() {
                        if (!authPanel) return;
                        authPanel.setAttribute('hidden', '');
                        const cal = getCalendar();
                        if (cal) cal.removeAttribute('hidden');
                    }

                    // Butonul „Intră" din rândul de unelte. În V1 chema carcasa lui, care avea
                    // „Autentificare" în locul contului; în V2 antetul e al platformei, deci ușa
                    // spre intrare stă în rândul de unelte al paginii.
                    function comutaAuth() {
                        if (!authPanel) return;
                        if (authPanel.hasAttribute('hidden')) openAuth(); else closeAuth();
                    }
                    if (authBtn) authBtn.addEventListener('click', comutaAuth);
                    if (authClose) authClose.addEventListener('click', closeAuth);
                    // Când pagina se deschide cu panoul cerut anume (?intra=1), calendarul stă
                    // ascuns de la început, ca la deschiderea din buton.
                    if (authPanel && !authPanel.hasAttribute('hidden')) {
                        const cal = getCalendar();
                        if (cal) cal.setAttribute('hidden', '');
                    }

                    // Toggle pentru tab-urile lună (delegated).
                    document.addEventListener('click', e => {
                        const tab = e.target.closest('.month-tab[data-month-view]');
                        if (!tab) return;
                        const target = tab.dataset.monthView;
                        document.querySelectorAll('.month-view').forEach(v => v.setAttribute('hidden', ''));
                        const view = document.getElementById('monthView-' + target);
                        if (view) view.removeAttribute('hidden');
                        document.querySelectorAll('.month-tab[data-month-view]').forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        // Închide bara de arhivă când comuți la Luna curentă/viitoare
                        const archBar = document.getElementById('archiveBarPicker');
                        const archBtn = document.getElementById('archiveTogglePicker');
                        if (archBar) archBar.setAttribute('hidden', '');
                        if (archBtn) {
                            archBtn.setAttribute('aria-expanded', 'false');
                            archBtn.classList.remove('open');
                        }
                    });

                    // Sloturile sunt read-only în modul vizualizare (neautentificat).
                    const viewDialog = document.getElementById('viewOnlyDialog');
                    document.addEventListener('click', e => {
                        if (!e.target.closest('.slot.view-slot')) return;
                        if (viewDialog && typeof viewDialog.showModal === 'function') viewDialog.showModal();
                        else openAuth();   // fallback: browsere fără <dialog>
                    });
                    if (viewDialog) {
                        const vClose = document.getElementById('viewOnlyClose');
                        const vAuth  = document.getElementById('viewOnlyAuth');
                        if (vClose) vClose.addEventListener('click', () => viewDialog.close());
                        if (vAuth)  vAuth.addEventListener('click', () => { viewDialog.close(); openAuth(); });
                        viewDialog.addEventListener('click', e => { if (e.target === viewDialog) viewDialog.close(); });
                    }

                    // Toggle pentru bara de arhivă (delegated).
                    document.addEventListener('click', e => {
                        const btn = e.target.closest('#archiveTogglePicker');
                        if (!btn) return;
                        const bar = document.getElementById('archiveBarPicker');
                        if (!bar) return;
                        const inArchiveViewPicker = ${isArchivePicker ? "true" : "false"};
                        const archiveView = document.getElementById('monthView-archive');
                        if (!inArchiveViewPicker || !archiveView) {
                            const firstMonth = bar.querySelector('.archive-month');
                            if (firstMonth) {
                                window.location.href = firstMonth.getAttribute('href');
                                return;
                            }
                            if (bar.hasAttribute('hidden')) {
                                bar.removeAttribute('hidden');
                                btn.setAttribute('aria-expanded', 'true');
                            } else {
                                bar.setAttribute('hidden', '');
                                btn.setAttribute('aria-expanded', 'false');
                            }
                            return;
                        }
                        const archiveAlreadyShown = !archiveView.hasAttribute('hidden');
                        document.querySelectorAll('.month-view').forEach(v => v.setAttribute('hidden', ''));
                        archiveView.removeAttribute('hidden');
                        document.querySelectorAll('.month-tab[data-month-view]').forEach(t => t.classList.remove('active'));
                        btn.classList.add('open');
                        if (!archiveAlreadyShown || bar.hasAttribute('hidden')) {
                            bar.removeAttribute('hidden');
                            btn.setAttribute('aria-expanded', 'true');
                        } else {
                            bar.setAttribute('hidden', '');
                            btn.setAttribute('aria-expanded', 'false');
                        }
                    });
                })();
`;

  return pagina(ctx, { corp, scripturi, unelte: unelte(ctx, _voluntarAcum) });
}

/**
 * Rândul de unelte al paginii.
 *
 * ⚠️ Pe 14.09.2026 au ieșit din el trei butoane, cerut anume de utilizator: „Autentificare"
 * (funcția lui o face **Cont**, din antet), „Schimbă numele" și „Ieși" (n-au ce schimba și de unde
 * ieși când numele vine din cont — ieșirea stă în meniul contului, ca în toate aplicațiile V2).
 *
 * A rămas o singură ușă a paginii, plus „Administrare" pentru cine are cheia. Butoanele se sting,
 * nu se ascund (regula platformei, 11–12.09.2026): cine e deja în echipă vede „Intră" pălit, ca
 * rândul să aibă aceeași formă pentru toți.
 */
function unelte(ctx: Ctx, voluntarAcum: Voluntar | null): string {
  const intrat = !!ctx.userId;
  const inEchipa = voluntarAcum !== null && voluntarAcum.is_active === 1;
  const gol = (da: boolean) => (da ? " gol" : "");
  const titluIntra = inEchipa
    ? ' title="Ești în echipă — te poți înscrie la duminici"'
    : intrat
      ? ' title="Ai cont, dar nu ești încă în echipă: cere intrarea de pe pagina contului"'
      : "";
  return `<button type="button" class="btn${gol(inEchipa)}" id="btnAutentificare"${titluIntra}>Intră</button>
      <a class="btn${gol(!intrat)}" href="${esc(ctx.nav.cont)}/"${!intrat ? ' title="Întâi intră cu contul"' : ' title="Datele tale și echipele din care faci parte"'}>Contul meu</a>${
    ctx.eAdmin ? `\n      <a class="btn" href="${esc(ctx.prefix)}/admin">Administrare</a>` : ""
  }`;
}

// =========================================================================
async function renderCalendarPage(
  ctx: Ctx, db: Baza, url: URL, mo: Moment, me: Voluntar, isAdminEd: boolean, nume: NumeDuminici,
): Promise<string> {
  const [currentYear, currentMonth] = lunaCurenta(mo);
  const [nextYear, nextMonth] = lunaViitoare(mo);
  const [selectedYear, selectedMonth] = parametriLuna(url, currentYear, currentMonth);

  const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth;
  const isNextMonth = selectedYear === nextYear && selectedMonth === nextMonth;
  const isArchiveView = !isCurrentMonth && !isNextMonth;

  const sundays = duminicileLunii(selectedYear, selectedMonth);
  const assignments = isArchiveView ? await programarileLunii(db, selectedYear, selectedMonth) : {};
  const currentSundaysE = duminicileLunii(currentYear, currentMonth);
  const currentAssignmentsE = await programarileLunii(db, currentYear, currentMonth);
  const nextSundaysE = duminicileLunii(nextYear, nextMonth);
  const nextAssignmentsE = await programarileLunii(db, nextYear, nextMonth);
  const archive = await luniCuProgramari(db);

  const selectedLabel = etichetaLuna(selectedYear, selectedMonth);
  const currentMonthLabel = etichetaLuna(currentYear, currentMonth);
  const nextMonthLabel = etichetaLuna(nextYear, nextMonth);
  const archiveOnly = arhivaFara(archive, currentYear, currentMonth, nextYear, nextMonth);

  // Lunile în care VOLUNTARUL CURENT și-a marcat vacanța — calendar blocat acolo.
  const meVac = await toate<{ year: number; month: number }>(
    db, "SELECT year, month FROM volunteer_vacations WHERE volunteer_id = ?", Number(me.id),
  );
  const meVacationMonths = new Set(meVac.map((r) => `${Number(r.year)}-${Number(r.month)}`));

  const renderMonthEditable = (y: number, m: number, sundaysArr: string[], assignsArr: ProgramariPeZi, labelEmpty: string): string => {
    const isOnVacationHere = meVacationMonths.has(`${y}-${m}`);
    const isEd = lunaEditabila(y, m, mo) && !isOnVacationHere;
    if (sundaysArr.length === 0) return `<div class="note">Nu există duminici în ${esc(labelEmpty)}.</div>`;
    let out = "";
    if (isOnVacationHere) {
      const monthLabel = `${LUNI_RO[m] ?? m} ${y}`;
      out += `<div class="vacation-banner">`;
      out += `<strong>Ești în vacanță în ${esc(monthLabel.toLowerCase())}.</strong> `;
      out += `Sloturile sunt blocate pentru această lună. `;
      out += `Mergi în tabul <strong>Vacanță</strong> ca să anulezi vacanța dacă vrei să te programezi.`;
      out += `</div>`;
    }
    for (const sunday of sundaysArr) {
      const name = nume(sunday);
      const dateLabel = formatDateRo(sunday);
      const past = duminicaTrecuta(sunday, mo);
      // Fără excepție retroactivă pentru voluntari; adminul autentificat editează orice duminică.
      const slotEditable = (isEd && !past) || isAdminEd;
      out += `<article class="sunday-card${past ? " past" : ""}">`;
      out += `<div class="date">${esc(dateLabel)}</div>`;
      out += `<div class="liturgical">${esc(name)}</div>`;
      const occupied = assignsArr[sunday] ?? {};
      const positions = Object.keys(occupied).map(Number);
      const maxPos = positions.length ? Math.max(...positions) : 0;
      const slotCount = Math.max(MIN_VOLUNTARI, maxPos);
      const renderCount = slotEditable ? slotCount + 1 : slotCount;
      const colsCount = Math.min(4, renderCount);
      out += `<div class="slots" data-sunday-slots="${esc(sunday)}" style="--slot-count: ${colsCount};">`;
      for (let i = 1; i <= renderCount; i++) {
        const a = occupied[i];
        const isMine = !!a && Number(a.volunteer_id) === Number(me.id);
        const isAdd = slotEditable && i === renderCount && !a;
        const classes = ["slot"];
        if (a) classes.push("taken");
        if (isMine) classes.push("mine");
        if (!slotEditable) classes.push("readonly");
        if (isAdd) classes.push("add");
        const slotLabel = a ? numeScurt(a) : isAdd ? "+" : "liber";
        const takenByAttr = a ? ` data-taken-by="${esc(numeScurt(a))}" data-taken-by-id="${Number(a.volunteer_id)}"` : "";
        out += `<button type="button" class="${classes.join(" ")}"`;
        if (slotEditable) out += ` data-sunday="${esc(sunday)}" data-slot="${i}"${takenByAttr}`;
        else out += " disabled";
        out += `>`;
        out += `<span class="position">Voluntar ${i}</span>`;
        out += `<span class="label">${esc(slotLabel)}</span>`;
        out += `</button>`;
      }
      out += `</div></article>`;
    }
    return out;
  };

  // Graficul de participare — vizibil DOAR pentru admini autentificați (fără .archive-stats
  // pentru restul, deci app.js nu cere with_stats și api nu întoarce nimic → zero leak).
  const participationTotals = isAdminEd ? await prezenteTotale(db) : {};
  const participationLast = isAdminEd ? await ultimaPrezenta(db) : {};
  const renderParticipation = async (y: number, m: number, sundaysArr: string[], label: string, splitAbsent = false): Promise<string> => {
    if (!isAdminEd) return "";
    const stats = sorteazaParticiparea(await participareaLunii(db, y, m), participationTotals);
    const totalSundays = sundaysArr.length;
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    let corp: string;
    if (stats.length === 0 || totalSundays === 0) {
      corp = `<div class="note">Nu există duminici de programat în această lună.</div>`;
    } else {
      let vacShown = false;
      corp = `<div class="stat-bars">
                                ${stats.map((st) => {
                                  const att = Number(st.attended);
                                  const name = `${st.first_name} ${st.last_name}`.trim();
                                  const totalAll = participationTotals[st.id] ?? 0;
                                  let head = "";
                                  if (splitAbsent && att === 0 && !vacShown) {
                                    vacShown = true;
                                    head = `<h3 class="stat-subtitle">Voluntari în vacanță</h3>`;
                                  }
                                  const note = notaParticipare(att, totalAll, st.created_at, participationLast[st.id]);
                                  return `${head}
                                    <div class="stat-row${att === 0 ? " is-zero" : ""}${totalAll === 0 ? " is-never" : ""}">
                                        <span class="stat-check${att > 0 ? " on" : ""}" aria-hidden="true"></span>
                                        <span class="stat-name">
                                            ${esc(name)}
                                            <span class="stat-admin-total${totalAll === 0 ? " never" : ""}" title="Prezențe pe tot istoricul (vizibil doar pentru admin)">[admin: ${totalAll}x în total]</span>
                                            ${note.label !== "" ? `<span class="stat-added" title="${esc(note.title)}">${esc(note.label)}</span>` : ""}
                                        </span>
                                        ${att >= 2 ? `<span class="stat-times" title="A venit de ${att} ori luna aceasta — în plus, harnic">×${att}</span>` : ""}
                                    </div>`;
                                }).join("\n")}
                            </div>`;
    }
    return `<section class="archive-stats" data-participation-ym="${ym}"${splitAbsent ? ` data-participation-split="1"` : ""}>
                        <div class="section-header">
                            <h2 class="section-title">Participare ${esc(label)}</h2>
                        </div>
                        ${corp}
                    </section>`;
  };

  // -------- Vacation view (ascuns: VACANTA_IN_PAGINA=false; backend intact) --------
  const renderVacationMonth = (y: number, m: number): string => {
    const sundaysV = duminicileLunii(y, m);
    const isVacation = meVacationMonths.has(`${y}-${m}`);
    const monthLabel = etichetaLuna(y, m);
    const weekWord = sundaysV.length === 1 ? "duminică" : "duminici";
    let out = `<article class="sunday-card vacation-card" data-vacation-year="${y}" data-vacation-month="${m}">`;
    out += `<div class="date">${esc(monthLabel)}</div>`;
    out += `<div class="liturgical">${sundaysV.length} ${weekWord}</div>`;
    out += `<div class="vacation-row">`;
    out += `<button type="button" class="vacation-toggle${isVacation ? " active" : ""}" data-vacation-year="${y}" data-vacation-month="${m}" aria-pressed="${isVacation ? "true" : "false"}">Vacanță</button>`;
    out += `<div class="vacation-weeks">`;
    sundaysV.forEach((sd, idx) => {
      const [, , d] = sd.split("-").map(Number);
      out += `<div class="slot week-slot${isVacation ? " taken" : ""}">`;
      out += `<span class="position">Săptămâna ${idx + 1}</span>`;
      out += `<span class="label">${esc(`${d} ${(LUNI_RO[m] ?? "").toLowerCase()}`)}</span>`;
      out += `</div>`;
    });
    out += `</div></div></article>`;
    return out;
  };

  const volunteerList = isAdminEd
    ? JSON.stringify((await voluntariActivi(db)).map((v) => ({ id: Number(v.id), name: numeScurt(v) })))
    : "[]";

  let vacationView = "";
  if (VACANTA_IN_PAGINA) {
    let luni = "";
    for (let vm = currentMonth; vm <= 12; vm++) luni += renderVacationMonth(currentYear, vm);
    vacationView = `<div id="monthView-vacation" class="month-view" hidden>
                <div class="vacation-intro">
                    Marchează lunile în care vei lipsi (vacanță, plecări, alte motive).
                    Newsletter-ul lunar va ști câți voluntari sunt indisponibili.
                </div>
                ${luni}
            </div>`;
  }

  const corp = `<div class="section-header">
                <h2 class="section-title">Calendar</h2>
                <span id="calStatusTag" class="status-tag${isArchiveView ? "" : " editable"}">
                    ${isArchiveView ? "doar vizualizare" : "editabil"}
                </span>
            </div>
            <div class="month-bar">
                <div class="month-tabs">
                    ${archiveOnly.length > 0 ? butonArhiva("archiveToggle", "archiveBar", isArchiveView) : ""}
                    <button type="button" data-month-view="current"
                            class="month-tab${isCurrentMonth ? " active" : ""}">
                        Luna curentă
                    </button>
                    <button type="button" data-month-view="next"
                            class="month-tab${isNextMonth ? " active" : ""}">
                        Luna viitoare
                    </button>
                    ${VACANTA_IN_PAGINA ? `<button type="button" data-month-view="vacation"
                            class="month-tab push-right">
                        Vacanță
                    </button>` : ""}
                </div>
            </div>
            ${baraArhiva("archiveBar", archiveOnly, isArchiveView, selectedYear, selectedMonth)}

            <div id="monthView-current" class="month-view" ${isCurrentMonth ? "" : "hidden"}>
                ${renderMonthEditable(currentYear, currentMonth, currentSundaysE, currentAssignmentsE, currentMonthLabel)}
                ${await renderParticipation(currentYear, currentMonth, currentSundaysE, currentMonthLabel)}
            </div>
            <div id="monthView-next" class="month-view" ${isNextMonth ? "" : "hidden"}>
                ${renderMonthEditable(nextYear, nextMonth, nextSundaysE, nextAssignmentsE, nextMonthLabel)}
                ${await renderParticipation(nextYear, nextMonth, nextSundaysE, nextMonthLabel)}
            </div>
            ${isArchiveView ? `<div id="monthView-archive" class="month-view">
                    ${renderMonthEditable(selectedYear, selectedMonth, sundays, assignments, selectedLabel)}
                    ${await renderParticipation(selectedYear, selectedMonth, sundays, selectedLabel, true)}
                </div>` : ""}

            ${vacationView}

            ${await infoJos(db, ctx.prefix)}`;

  const scripturi = `
            (function () {
                // Toggle luna curentă / viitoare fără reload
                document.addEventListener('click', e => {
                    const tab = e.target.closest('.month-tab[data-month-view]');
                    if (!tab) return;
                    const target = tab.dataset.monthView;
                    document.querySelectorAll('.month-view').forEach(v => v.setAttribute('hidden', ''));
                    const view = document.getElementById('monthView-' + target);
                    if (view) view.removeAttribute('hidden');
                    document.querySelectorAll('.month-tab[data-month-view]').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const tag = document.getElementById('calStatusTag');
                    if (tag) {
                        if (target === 'archive') {
                            tag.textContent = 'doar vizualizare';
                            tag.classList.remove('editable');
                        } else if (target === 'vacation') {
                            tag.textContent = 'vacanțe';
                            tag.classList.remove('editable');
                        } else {
                            tag.textContent = 'editabil';
                            tag.classList.add('editable');
                        }
                    }
                    const archBar = document.getElementById('archiveBar');
                    const archBtn = document.getElementById('archiveToggle');
                    if (archBar) archBar.setAttribute('hidden', '');
                    if (archBtn) {
                        archBtn.setAttribute('aria-expanded', 'false');
                        archBtn.classList.remove('open');
                    }
                });

                if (window.location.hash === '#vacation') {
                    const vacTab = document.querySelector('.month-tab[data-month-view="vacation"]');
                    if (vacTab) vacTab.click();
                }

                // Toggle pentru bara de arhivă (butoanele cu luni trecute).
                const archiveToggle = document.getElementById('archiveToggle');
                const archiveBar = document.getElementById('archiveBar');
                if (archiveToggle && archiveBar) {
                    const inArchiveView = ${isArchiveView ? "true" : "false"};
                    archiveToggle.addEventListener('click', () => {
                        const archiveView = document.getElementById('monthView-archive');
                        if (!inArchiveView || !archiveView) {
                            const firstMonth = archiveBar.querySelector('.archive-month');
                            if (firstMonth) {
                                window.location.href = firstMonth.getAttribute('href');
                                return;
                            }
                            if (archiveBar.hasAttribute('hidden')) {
                                archiveBar.removeAttribute('hidden');
                                archiveToggle.setAttribute('aria-expanded', 'true');
                            } else {
                                archiveBar.setAttribute('hidden', '');
                                archiveToggle.setAttribute('aria-expanded', 'false');
                            }
                            return;
                        }
                        const archiveAlreadyShown = !archiveView.hasAttribute('hidden');
                        document.querySelectorAll('.month-view').forEach(v => v.setAttribute('hidden', ''));
                        archiveView.removeAttribute('hidden');
                        document.querySelectorAll('.month-tab[data-month-view]').forEach(t => t.classList.remove('active'));
                        const tag = document.getElementById('calStatusTag');
                        if (tag) {
                            tag.textContent = 'doar vizualizare';
                            tag.classList.remove('editable');
                        }
                        archiveToggle.classList.add('open');
                        if (!archiveAlreadyShown || archiveBar.hasAttribute('hidden')) {
                            archiveBar.removeAttribute('hidden');
                            archiveToggle.setAttribute('aria-expanded', 'true');
                        } else {
                            archiveBar.setAttribute('hidden', '');
                            archiveToggle.setAttribute('aria-expanded', 'false');
                        }
                    });
                }
            })();

            // Cine sunt și ce pot, pentru JS-ul sloturilor (în V1: cele trei window.* scrise
            // înaintea lui app.js). Jetonul CSRF merge cu fiecare apăsare.
            window.EU_VOLUNTAR_ID = ${Number(me.id)};
            window.EU_ADMIN = ${isAdminEd ? "true" : "false"};
            window.LISTA_VOLUNTARI = ${volunteerList};
            window.CSRF = ${JSON.stringify(ctx.csrf)};
            window.CALE_API = ${JSON.stringify(`${ctx.prefix}/api`)};
${JS_SLOTURI}
`;

  return pagina(ctx, { corp, scripturi, unelte: unelte(ctx, me.id > 0 ? me : null) });
}
