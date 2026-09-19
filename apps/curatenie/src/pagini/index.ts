/**
 * Pagina de programare — `index.php` din V1, purtare cu purtare, pe carcasa platformei.
 *
 * Patru stări:
 *   1. nimeni nu s-a arătat → calendarul doar de citit, PICKERUL (lista de nume) și ușa contului;
 *   2. FANTOMA — și-a ales numele din listă, fără cont → calendarul editabil ca la un voluntar,
 *      dar numai atât: restul faptelor le taie `api.ts`. Numele ales scrie pe rândul personal;
 *   3. cine e în echipă cu CONTUL (asociere acceptată) → calendarul editabil pe luna curentă și pe
 *      cea viitoare, arhiva doar de citit;
 *   4. cine are `cleaning.manage` editează orice duminică, în numele oricui.
 *
 * Ce s-a schimbat față de V1: antetul, subsolul și meniul contului vin din `@xc/ui`; numele
 * duminicii se cere de la calendar (A1); dreptul de administrare e cel central, nu o parolă locală;
 * fiecare apăsare de slot poartă jetonul CSRF. Restul — clasele, cuvintele, așezarea — e din V1.
 *
 * ⚠️ PAGINA N-ARE RÂND DE UNELTE (user, 19.09.2026: „meniul de cont trebuie să se vadă ca la
 * celelalte aplicații"). Au ieșit din ea cele trei butoane („Intră", „Contul meu", „Administrare")
 * și panoul de intrare pe care îl deschidea primul: contul se ține dintr-un singur loc, meniul din
 * antet, iar panoul curățeniei se vede în `/setari`, ca la orice altă aplicație a platformei.
 *
 * ⚠️ Pickerul a lipsit între 14 și 19.09.2026, iar la întoarcere NU mai e o autentificare: e doar
 * un nume pentru calendar (user, 19.09.2026). Cine a intrat cu contul nu-l vede niciodată — dacă
 * ajunge vreodată să se vadă la un om cu sesiune, ceva s-a stricat la etajul de deasupra.
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
 * Pagina de programare. `voluntar` = rândul legat de CONTUL omului, dacă are unul; `fantoma` =
 * rândul ales din listă fără cont, și el vine gata verificat din `index.ts` (niciodată amândouă).
 */
export async function paginaIndex(
  ctx: Ctx,
  db: Baza,
  request: Request,
  url: URL,
  voluntar: Voluntar | null,
  fantoma: Voluntar | null,
  nume: NumeDuminici,
): Promise<string> {
  const mo = acum();

  /*
   * Calendarul editabil e al celor din ECHIPĂ (asociere acceptată) și al administratorilor.
   * Cine are cont dar n-a fost primit încă vede tot pagina de vizitator — cererea de intrare în
   * echipă și-o face din Setări, ca peste tot pe platformă.
   */
  const inEchipa = voluntar !== null && voluntar.is_active === 1;

  if (!inEchipa && !ctx.eAdmin) {
    /*
     * FANTOMA vede ACELAȘI calendar editabil ca un voluntar cu cont — asta a fost cererea
     * („astfel pre-logat un om poate face rezervări în calendar"). Ce NU vede: participarea
     * (e a adminului), vacanța (e a contului) și panoul. Toate trei se refuză și în `api.ts`.
     */
    if (fantoma) return renderCalendarPage(ctx, db, url, mo, fantoma, false, nume);
    return renderVizitatorPage(ctx, db, request, url, mo, nume);
  }

  // Adminul intrat cu contul platformei, care n-are rând al lui, vede tot calendarul.
  const me = voluntar ?? adminFaraVoluntar(ctx.utilizator, ctx.userId);
  return renderCalendarPage(ctx, db, url, mo, me, ctx.eAdmin, nume);
}

/**
 * Rândul personal al fantomei: „Ești Mihai P. · Nu ești tu?". Stă în ANTETUL PAGINII (slotul
 * `personal` al carcasei), nu în meniul contului — omul n-are cont, iar meniul ăla e al contului.
 * „Nu ești tu?" e un POST cu jeton, ca orice faptă: o legătură GET ar putea fi apăsată din afară.
 */
function randulFantomei(ctx: Ctx): string {
  if (!ctx.fantoma) return "";
  return `<div class="cine">Ești <strong>${esc(ctx.fantoma)}</strong> &middot;
      <form method="post" action="${esc(ctx.prefix)}/iesi">
        ${campCsrf(ctx)}
        <button type="submit" class="ca-legatura"
                title="Uită numele ales pe acest dispozitiv">Nu ești tu?</button>
      </form>
    </div>`;
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
 * Pagina celui care nu s-a arătat DELOC: nici cont, nici nume ales. Are două uși:
 *   - PICKERUL, deasupra calendarului — își alege numele și de atunci poate rezerva (atât);
 *   - meniul contului din ANTET, ca în toate aplicațiile platformei — pentru tot restul.
 * Calendarul rămâne dedesubt, de citit, pentru cine n-o vrea pe niciuna.
 *
 * ⚠️ Panoul de intrare al paginii (`#authPanel`, cu butonul „Intră" al rândului de unelte) a ieșit
 * pe 19.09.2026: era a doua ușă spre același loc, și tocmai asta se abătea de la celelalte aplicații.
 */
async function renderVizitatorPage(ctx: Ctx, db: Baza, _request: Request, url: URL, mo: Moment, nume: NumeDuminici): Promise<string> {
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
        out += `<button type="button" class="${classes.join(" ")}" title="Alege-ți numele de sus ca să te înscrii">`;
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
   * PICKERUL — lista de nume, întoarsă pe 19.09.2026 („păstrăm intrarea fantomă doar cu numele").
   * Spre deosebire de V1, stă VIZIBIL, deasupra calendarului, acolo unde omul ar apăsa ca să
   * rezerve: e singurul lucru pe care îl poate face fără cont, deci n-are rost ascuns după un
   * buton. Markup-ul și clasele sunt cele din V1 (`picker-list`); s-a schimbat doar înțelesul —
   * nu mai e o autentificare, ci un nume pentru calendar.
   *
   * ⚠️ Cei plecați în vacanță luna asta nu apar, ca în V1: n-ar avea ce alege, calendarul lor e
   * blocat oricum. (`vacationGroups` se socotește mai sus, chiar dacă rubrica stă stinsă.)
   */
  const inVacantaAcum = new Set((vacationGroups[`${cy}-${cm}`]?.volunteers ?? []).map((v) => Number(v.id)));
  const deAles = (await voluntariActivi(db)).filter((v) => !inVacantaAcum.has(Number(v.id)));

  const pickerHtml = `<section id="pickerFantoma" class="auth-panel">
                <div class="section-header">
                    <h2 class="section-title">Cine ești?</h2>
                </div>

                <div class="note">
                    Alege-ți numele ca să te poți înscrie la o duminică — rămâne ținut minte pe
                    acest dispozitiv. Pentru orice altceva (vacanța, intrarea în echipă, setările
                    tale) intră cu <strong>contul parohiei</strong>, din meniul de sus.
                </div>

                ${deAles.length === 0
                  ? `<div class="note">
                        Nu sunt voluntari înregistrați momentan.
                        Roagă administratorul să te adauge.
                    </div>`
                  : `<ul class="picker-list">
                        ${deAles.map((v) => `<li>
                                <form method="post" action="${esc(ctx.prefix)}/alege">
                                    ${campCsrf(ctx)}
                                    <input type="hidden" name="volunteer_id" value="${Number(v.id)}">
                                    <button type="submit">${esc(numeScurt(v))}</button>
                                </form>
                            </li>`).join("\n                        ")}
                    </ul>
                    <div class="note">
                        Dacă nu te regăsești în listă, vorbește cu un admin ca să te adauge.
                        ${admins.length > 0 ? `<div style="margin-top:6px;">
                                Admini:
                                ${adminLinks.join(", ")}
                            </div>
                            <div style="margin-top:6px;">
                                Grup:
                                <a href="${GRUP_WHATSAPP}"
                                   target="_blank" rel="noopener" class="wa-link">Albinele Sfântului Ilie</a>
                            </div>` : ""}
                    </div>`}
            </section>`;

  const corp = `${pickerHtml}

            ${vacantaHtml}

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
                   trebuie să-ți alegi numele din lista de sus — ori să intri cu contul parohiei,
                   dacă vrei și restul aplicației.</p>
                <div class="viewonly-actions">
                    <button type="button" class="btn-secondary" id="viewOnlyClose">Închide</button>
                    <!-- ⚠️ Legătură adevărată, nu buton: din 19.09.2026 nu mai există un panou de
                         intrare în pagină pe care să-l deschidă. Duce unde duce și capul meniului
                         de cont, cu întoarcere aici. -->
                    <a class="btn-auth" href="${esc(ctx.nav.cont)}/intra?spre=${encodeURIComponent(ctx.spre ?? "")}">Intră</a>
                </div>
            </dialog>

            ${await infoJos(db, ctx.prefix)}`;

  const scripturi = `
                (function () {
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
                        // Browser fără <dialog>: lista de nume e chiar sus, acolo îl ducem.
                        else {
                            const picker = document.getElementById('pickerFantoma');
                            if (picker) picker.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    });
                    if (viewDialog) {
                        const vClose = document.getElementById('viewOnlyClose');
                        if (vClose) vClose.addEventListener('click', () => viewDialog.close());
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

  return pagina(ctx, { corp, scripturi });
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

  return pagina(ctx, {
    corp,
    scripturi,
    // „Ești Mihai P. · Nu ești tu?" — gol pentru oricine are cont.
    personal: randulFantomei(ctx),
  });
}
