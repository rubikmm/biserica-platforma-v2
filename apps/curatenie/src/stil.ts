import { STIL_SETARI } from "@xc/setari"
/**
 * A6-curatenie · stilul LOCAL al aplicatiei.
 *
 * Se lipeste DUPA stilul global al carcasei (src/comun/stil-comun.ts) si il suprascrie —
 * la specificitate egala castiga ce e mai jos. Aici sta numai ce e al acestei aplicatii:
 * calendarul, cartelele duminicilor, sloturile, panoul de autentificare, graficul de
 * participare, meniul de admin pe slot.
 *
 * Antetul, subsolul, tema si tipografia NU mai sunt aici: vin din carcasa. Ce a mai ramas
 * din vechiul assets/style.css si tinea de antet/subsol (.app-header, .user-menu,
 * .app-footer, .container) a fost scos — carcasa le face pe toate.
 *
 * Paleta aplicatiei se leaga de cea a carcasei (--paper, --ink, --rule, --soft, --tinta),
 * ca sa urmeze tema zi/noapte; culorile ei proprii (verdele si portocaliul) raman, cu
 * variante mai deschise pe intuneric. Tema o pune JS-ul carcasei pe <html data-tema>.
 *
 * Nu edita src/comun/*: alea vin din biserica-platforma/carcasa/. Daca o regula de aici se
 * dovedeste buna peste tot, se MUTA in stilul global — se anunta pe canalul platformei.
 *
 * ⚠️ MENIUL DE CONT, 19.09.2026 (user: „încă se vede ciudat meniul de la Cont. Vreau să fie exact
 * ca la Calendar… Să pot să modific și «vezi ca»"). Pana azi, la coada stilului, mai stateau doua
 * reguli mostenite din V1, amandoua scrise pe selectoarele CARCASEI:
 *
 *   body:not(.cu-platforma) .cont-lista a[href^="https://cont."] { display: none }
 *   .cont-lista a.intra-platforma { … }
 *
 * Prima e din vremea cand curatenia avea contul EI si abia urma sa fie legata de platforma: clasa
 * `cu-platforma` trebuia pusa pe <body> dupa legare, ca regula sa se stinga singura. Legarea s-a
 * facut pe alt drum (carcasa `@xc/ui`, 14.09.2026) si clasa n-a mai fost pusa de nimeni, niciodata
 * — grep in tot depozitul: singura ei aparitie era chiar regula asta. Deci `:not(…)` era mereu
 * adevarat, iar meniul contului pierdea TOT ce duce la aplicatia de cont: „Profil", „Ieșire" si
 * cele trei comutatoare „vezi ca". Ramaneau „Setări", „Administrare" si doua linii despartitoare
 * intre care nu mai era nimic — de aici „se vede ciudat". Mai rau: sub masca „neautentificat"
 * meniul e FACUT numai din cele trei comutatoare, deci se golea cu totul, iar super-adminul mascat
 * ramanea fara drum inapoi (trebuia scris de mana /vezi-ca?ca=real).
 * A doua imbraca o clasa pusa candva de un JS al paginii care nu mai exista din 19.09.2026.
 *
 * Nici la stil nu se scrie diferit de restul platformei: ce trebuie schimbat in antet, in meniul
 * contului sau in subsol se schimba in `@xc/ui`, pentru toate aplicatiile deodata.
 */
export const LOCAL = `
/* ============================ paleta aplicatiei ============================ */
:root {
    --bg:            var(--paper);
    --surface:       var(--paper);
    --border:        var(--rule);
    --text:          var(--ink);
    --text-muted:    var(--soft);
    --accent:        #6b8e4e;       /* verde liturgic, sobru */
    --accent-dark:   #4f6c3b;
    --warning:       #c97a3a;
    --danger:        #b04848;
    --slot-free-bg:  var(--tinta);
    --slot-mine-bg:  #c97a3a;
    --slot-taken-bg: #4f6c3b;
    --cald:          #fff8e6;       /* fundalul casetelor calde (note, vacanta) */
    --cald-chenar:   #e7d8a8;
    --cald-text:     #7a5a14;
}
/* Noaptea: verdele si portocaliul se deschid ca sa ramana citete pe fundal inchis. */
:root[data-tema="dark"] {
    --accent:        #7ea75e;
    --accent-dark:   #a8cd88;
    --warning:       #d98f4f;
    --danger:        #e07a7a;
    --slot-mine-bg:  #a5622c;
    --slot-taken-bg: #3f5730;
    --cald:          #241d10;
    --cald-chenar:   #4a3c1c;
    --cald-text:     #e6cf9a;
}

/* Continutul aplicatiei ramane pe litera de ecran: sunt butoane si cartele, nu text de
   citit. Antetul, subsolul si adresa de sub titlu raman cu literele carcasei. */
main { font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
       "Helvetica Neue", Arial, sans-serif }
main h2, main h3 { letter-spacing: 0 }
/* Formularele aplicatiei sunt blocuri obisnuite (carcasa le face flex pentru cautare). */
main form { display: block; gap: 0; margin: 0 }

[hidden] { display: none !important; }

/* Cutia listei de nume (#pickerFantoma). Purta si panoul de intrare al paginii, scos pe 19.09.2026
   odata cu randul de unelte — cu el a plecat si .auth-close, butonul lui de inchidere. */
.auth-panel {
    position: relative;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 16px;
}

.section-header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin: 18px 0 8px;
    flex-wrap: wrap;
}
.section-title {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text);
    font-weight: 700;
    line-height: 1.3;
}
.status-tag {
    display: inline-block;
    padding: 2px 8px;
    font-size: 0.75rem;
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 3px;
    letter-spacing: 0.02em;
    text-transform: lowercase;
}
.status-tag.editable {
    color: var(--accent-dark);
    border-color: var(--accent);
}

.month-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    align-items: center;
    flex-wrap: wrap;
}

.month-tabs {
    display: flex;
    gap: 6px;
}
.month-tab {
    padding: 8px 14px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    transition: background 0.15s, border-color 0.15s;
}
.month-tab:hover {
    border-color: var(--accent);
    background: var(--tinta);
}
.month-tab.active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
    cursor: default;
}
.month-tab.active:hover { background: var(--accent); }

.month-archive {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.9rem;
    color: var(--text-muted);
}
.month-archive select {
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    font-size: 0.9rem;
}

/* Buton „Arhivă" — primul în bara de luni, roșu cărămiziu */
.month-tabs { flex-wrap: wrap; width: 100%; }
.month-tab.push-right { margin-left: auto; }
.month-tab.archive-btn {
    background: #7d5a3a;
    color: #ffffff;
    border-color: #7d5a3a;
    font-weight: 600;
}
.month-tab.archive-btn:hover {
    background: #604529;
    border-color: #604529;
    color: #ffffff;
}
.month-tab.archive-btn.open {
    background: #604529;
    border-color: #604529;
}

/* Varianta „doar iconiță" — economisește spațiu pe mobil, când stau 4 butoane în rând */
.month-tab.icon-only {
    padding: 8px 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.month-tab.icon-only svg { display: block; }

/* Al doilea rând cu butoane pentru lunile arhivate (apare la click pe Arhivă) */
.archive-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: -4px 0 16px;
    padding: 12px;
    background: var(--tinta);
    border: 1px solid var(--border);
    border-radius: 6px;
}
.archive-month {
    display: inline-block;
    padding: 6px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    text-decoration: none;
    font-size: 0.9rem;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.archive-month:hover {
    background: var(--tinta);
    border-color: var(--accent);
}
.archive-month.active {
    background: var(--accent);
    color: #ffffff;
    border-color: var(--accent);
}

/* Graficul de participare din vizualizarea de arhivă (ca în raportul lunar) */
.archive-stats {
    margin-top: 26px;
    padding-top: 18px;
    border-top: 1px solid var(--border);
}
.stat-legend {
    font-size: 0.82rem;
    color: var(--text-muted);
    margin-bottom: 12px;
}
.stat-bars {
    display: flex;
    flex-direction: column;
    gap: 7px;
}
.stat-row {
    display: flex;
    align-items: center;
    gap: 10px;
}
/* Bifă = a venit măcar o dată (scopul: măcar o dată, nu de fiecare duminică). */
.stat-check {
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    border: 2px solid var(--border);
    border-radius: 5px;
    background: var(--surface);
    box-sizing: border-box;
}
.stat-check.on {
    border-color: var(--accent-dark);
    background: var(--accent);
    position: relative;
}
.stat-check.on::after {
    content: "";
    position: absolute;
    left: 5px;
    top: 1px;
    width: 5px;
    height: 10px;
    border: solid #fff;
    border-width: 0 2.5px 2.5px 0;
    transform: rotate(45deg);
}
.stat-name {
    flex: 1 1 auto;
    font-size: 0.9rem;
    color: var(--text);
    min-width: 0;
    line-height: 1.3;
}
.stat-row.is-zero .stat-name { color: var(--text-muted); }
/* Cei care nu au venit NICIODATĂ (total all-time 0, doar la admin) — cu italic. */
.stat-row.is-never .stat-name { font-style: italic; }
.stat-added {
    display: block;
    font-size: 0.7rem;
    color: var(--text-muted);
    font-style: italic;
    margin-top: 1px;
}
/* Vizibil doar pentru admin: prezențe pe tot istoricul. „never" = 0 (n-a fost niciodată) evidențiat. */
.stat-admin-total {
    font-size: 0.72rem;
    color: var(--text-muted);
    white-space: nowrap;
}
.stat-admin-total.never {
    color: var(--warning);
    font-weight: 700;
}
/* „×N" = a venit de mai multe ori — un plus, harnic (nu un deficit). */
.stat-times {
    flex: 0 0 auto;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--accent-dark);
    background: #eef3e5;
    border: 1px solid #cdddb4;
    border-radius: 10px;
    padding: 1px 8px;
    white-space: nowrap;
}
/* Titlu inserat în listă (arhivă) înaintea celor cu 0 prezențe. */
.stat-subtitle {
    margin: 10px 0 2px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.month-bar select {
    flex: 1;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    font-size: 0.95rem;
}

.month-bar .badge {
    padding: 4px 10px;
    background: var(--accent);
    color: white;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
}

.month-bar .badge.archive {
    background: var(--text-muted);
}

/* Card pentru fiecare duminică */
.sunday-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px;
    margin-bottom: 12px;
}

.sunday-card .date {
    font-weight: 700;
    color: var(--accent-dark);
    font-size: 1.05rem;
}

.sunday-card .liturgical {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-bottom: 12px;
    font-style: italic;
}

.sunday-card.past {
    opacity: 0.6;
    background: var(--tinta);
}
.sunday-card.past .date,
.sunday-card.past .liturgical {
    color: var(--text-muted);
}
.sunday-card.past .slot.taken,
.sunday-card.past .slot.mine {
    background: #aebfa0;
    border-color: #8a9c7c;
    color: #ffffff;
    font-weight: 500;
}
.sunday-card.past .slot.taken .position,
.sunday-card.past .slot.mine .position {
    color: rgba(255, 255, 255, 0.8);
}

.slots {
    display: grid;
    /* „--slot-count„ pus în stil, pe fiecare duminică — max 4 coloane/rând (atât pe desktop, cât și pe mobil).
       Când sunt mai multe sloturi (ex. 5 voluntari + „+"), restul wrap-uiesc pe rândul următor. */
    grid-template-columns: repeat(var(--slot-count, 3), minmax(0, 1fr));
    gap: 8px;
}

.slot {
    padding: 12px 6px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--slot-free-bg);
    text-align: center;
    cursor: pointer;
    font-size: 0.85rem;
    line-height: 1.25;
    transition: background 0.15s, transform 0.05s;
    user-select: none;
    min-width: 0;
    overflow: hidden;
}
.slot .label {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.slot:hover:not(:disabled) {
    background: var(--rule);
}
.slot:active:not(:disabled) {
    transform: scale(0.97);
}

.slot.taken {
    background: var(--slot-taken-bg);
    border-color: var(--accent-dark);
    color: #ffffff;
    cursor: not-allowed;
}

.slot.taken .position {
    color: rgba(255, 255, 255, 0.75);
}

.slot.mine {
    background: var(--slot-mine-bg);
    border-color: #a85f24;
    color: #ffffff;
    font-weight: 600;
}

.slot.mine .position {
    color: rgba(255, 255, 255, 0.85);
}

.slot:disabled,
.slot.readonly {
    cursor: not-allowed;
    opacity: 0.85;
}

.slot.add {
    background: transparent;
    border: 2px dashed var(--border);
    color: var(--accent-dark);
}
.slot.add .label {
    font-size: 1.4rem;
    font-weight: 700;
    line-height: 1;
}
.slot.add:hover {
    border-color: var(--accent);
    background: var(--tinta);
}

.slot .position {
    display: block;
    font-size: 0.7rem;
    color: var(--text-muted);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

/* Pagina de selectare voluntar */
.picker-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
}
.picker-list li {
    margin: 0;
}
.picker-list form { margin: 0; }
.picker-list button {
    width: 100%;
    text-align: center;
    padding: 10px 8px;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.95rem;
    font-family: inherit;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
}
.picker-list button:hover {
    border-color: var(--accent);
    background: var(--tinta);
}

.note {
    background: #fff8e6;
    border: 1px solid #e7d8a8;
    padding: 12px;
    border-radius: 8px;
    margin: 16px 0;
    font-size: 0.92rem;
}

.wa-link {
    color: var(--accent-dark);
    text-decoration: none;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.wa-link::before {
    content: '';
    display: inline-block;
    width: 14px;
    height: 14px;
    background-color: #25d366;
    -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.7 1.4 5.2L2 22l4.9-1.3c1.5.8 3.3 1.3 5.1 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2zm5.1 14.2c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.4.7-2 1-2.3.2-.2.5-.3.8-.3h.5c.2 0 .4-.1.7.5.2.6.8 2 .9 2.2.1.1.1.3 0 .5-.1.2-.1.3-.3.5-.1.2-.3.3-.4.5-.2.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.5.3.2.5.1.6 0 .2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.3.1 1.6.8 1.9.9.3.2.5.2.6.4.1.1.1.7-.1 1.4z'/></svg>") center/contain no-repeat;
    mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.7 1.4 5.2L2 22l4.9-1.3c1.5.8 3.3 1.3 5.1 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2zm5.1 14.2c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.4.7-2 1-2.3.2-.2.5-.3.8-.3h.5c.2 0 .4-.1.7.5.2.6.8 2 .9 2.2.1.1.1.3 0 .5-.1.2-.1.3-.3.5-.1.2-.3.3-.4.5-.2.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.5.3.2.5.1.6 0 .2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.3.1 1.6.8 1.9.9.3.2.5.2.6.4.1.1.1.7-.1 1.4z'/></svg>") center/contain no-repeat;
    flex-shrink: 0;
}
.wa-link:hover { text-decoration: underline; }

.contact-dialog {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px 22px;
    max-width: 340px;
    width: 90%;
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
}
.contact-dialog::backdrop {
    background: rgba(20, 18, 12, 0.35);
}
.contact-dialog h3 {
    color: var(--accent-dark);
    font-size: 1.05rem;
}
.contact-dialog a {
    color: var(--accent-dark);
}
.contact-dialog .btn-close {
    padding: 8px 14px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
}
.contact-dialog .btn-close:hover { background: var(--accent-dark); }

/* Dialog „doar vizualizare" (utilizator neautentificat care dă click pe un slot). */
.viewonly-dialog p {
    margin: 10px 0 18px;
    line-height: 1.5;
    font-size: 0.92rem;
}
.viewonly-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    flex-wrap: wrap;
}
/* „Intră" din fereastra „doar vizualizare" e o LEGATURA spre intrarea platformei, nu un buton
   (19.09.2026): pagina n-are ce deschide, usa e a contului. De aici display si text-decoration. */
.viewonly-actions .btn-auth {
    display: inline-block;
    padding: 8px 16px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
}
.viewonly-actions .btn-auth:hover { background: var(--accent-dark); }
.viewonly-actions .btn-secondary {
    padding: 8px 14px;
    background: var(--slot-free-bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
}
.viewonly-actions .btn-secondary:hover { background: var(--border); }
/* Slotul de vizualizare rămâne read-only, dar semnalăm că e clicabil. */
.slot.view-slot { cursor: pointer; }

.toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: var(--text);
    color: white;
    padding: 10px 18px;
    border-radius: 22px;
    font-size: 0.9rem;
    opacity: 0;
    transition: all 0.25s;
    pointer-events: none;
    max-width: 90%;
    text-align: center;
}
.toast.show {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
}
.toast.error { background: var(--danger); }

/* ===== Banner „ești în vacanță" — apare deasupra lunii cu sloturi blocate ===== */
.vacation-banner {
    background: #fdf5e6;
    border-left: 4px solid var(--slot-mine-bg);
    border-radius: 4px;
    padding: 12px 16px;
    margin: 0 0 14px;
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--text);
}
.vacation-banner strong { color: var(--slot-mine-bg); }

/* ===== Voluntar în vacanță în picker (buton normal cu text atenuat) ===== */
.picker-list button.vacation-mark {
    opacity: 0.55;
    font-style: italic;
}
.picker-list button.vacation-mark:hover {
    opacity: 0.9;
}

/* ===== Vacanță (tab Vacanță în calendar) ===== */
.vacation-intro {
    background: #fdf5e6;
    border-left: 4px solid var(--slot-mine-bg);
    padding: 12px 16px;
    margin: 0 0 14px;
    font-size: 0.92rem;
    line-height: 1.45;
    color: var(--text);
    border-radius: 4px;
}
.vacation-card .vacation-row {
    display: flex;
    align-items: stretch;
    gap: 8px;
    flex-wrap: wrap;
}
.vacation-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 16px;
    background: var(--surface);
    color: var(--slot-mine-bg);
    border: 2px solid var(--slot-mine-bg);
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    min-width: 110px;
    transition: background 0.15s, color 0.15s;
}
.vacation-toggle:hover:not(:disabled) {
    background: #fdf5e6;
}
.vacation-toggle.active {
    background: var(--slot-mine-bg);
    color: #ffffff;
    border-color: var(--slot-mine-bg);
}
.vacation-toggle.active:hover:not(:disabled) {
    background: #b06a2e;
    border-color: #b06a2e;
}
.vacation-toggle:disabled { opacity: 0.6; cursor: wait; }
.vacation-icon { font-size: 1rem; }
.vacation-weeks {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(105px, 1fr));
    gap: 8px;
    flex: 1;
    min-width: 0;
}
/* Căsuțele „SĂPTĂMÂNA N" — nu sunt clickabile, doar vizuale */
.vacation-weeks .week-slot {
    background: var(--tinta);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 14px 6px;
    text-align: center;
    color: var(--text-muted);
    cursor: default;
    transition: background 0.15s, color 0.15s;
}
.vacation-weeks .week-slot.taken {
    background: var(--slot-mine-bg);
    color: #ffffff;
    border-color: var(--slot-mine-bg);
}
.vacation-weeks .week-slot .position {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.vacation-weeks .week-slot .label {
    display: block;
    margin-top: 3px;
    font-size: 0.78rem;
    font-weight: 500;
    opacity: 0.85;
    text-transform: none;
    letter-spacing: 0;
}

/* --- Adjustări fine pentru mobil --- */

@media (max-width: 480px) {

    .slot { padding: 10px 4px; font-size: 0.8rem; }
    .slot .position { font-size: 0.65rem; letter-spacing: 0.02em; }
    .slots { gap: 6px; }
    .month-bar select { font-size: 0.9rem; padding: 7px; }
    .month-bar .badge { font-size: 0.72rem; padding: 3px 8px; }
    .picker-list { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
    .picker-list button { padding: 9px 6px; font-size: 0.9rem; }
    .sunday-card { padding: 12px; }
    .sunday-card .date { font-size: 1rem; }
    .sunday-card .liturgical { font-size: 0.85rem; }
    .vacation-toggle { min-width: 0; width: 100%; padding: 11px 12px; }
    .vacation-weeks { grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 6px; }
    .vacation-weeks .week-slot { padding: 10px 4px; }
    .vacation-weeks .week-slot .position { font-size: 0.62rem; }
}

/* Admin: tab-urile să se rupă pe rânduri pe ecrane mici */
.tabs { flex-wrap: wrap; }
.toolbar { flex-wrap: wrap; gap: 8px; }

/* ============================================================================
   Meniu in-place pentru admin (editare slot: Pentru mine / altcineva / Eliberează)
   ============================================================================ */
.slot-menu {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 6px 24px rgba(43, 42, 38, 0.18);
    padding: 4px;
    min-width: 180px;
    max-width: min(260px, calc(100vw - 16px));
    z-index: 1000;
    display: flex;
    flex-direction: column;
}
.slot-menu.picker { min-width: min(220px, calc(100vw - 16px)); }
.slot-menu-back {
    align-self: flex-start;
    background: none;
    border: 0;
    padding: 6px 10px;
    margin-bottom: 2px;
    font: inherit;
    font-size: 13px;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 6px;
}
.slot-menu-back:hover { background: var(--slot-free-bg); color: var(--text); }
.slot-menu-item.current { font-weight: 600; color: var(--accent-dark); }
.slot-menu-item {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    border-radius: 6px;
    padding: 9px 12px;
    font: inherit;
    font-size: 14px;
    color: var(--text);
    cursor: pointer;
}
.slot-menu-item:hover,
.slot-menu-item:focus { background: var(--slot-free-bg); outline: none; }
.slot-menu-item.danger { color: var(--danger); }
.slot-menu-item.danger:hover { background: #f7e7e3; }
.slot-menu-search {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    margin-bottom: 4px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font: inherit;
    font-size: 14px;
}
.slot-menu-search:focus { outline: none; border-color: var(--warning); }
.slot-menu-list { max-height: 240px; overflow-y: auto; }
.slot-menu-empty { padding: 10px 12px; color: var(--text-muted); font-size: 13px; }


/* ===================== culorile aplicatiei peste carcasa ===================== */
/*
 * ⚠️ AICI AU MURIT DOUA REGULI MOSTENITE DIN V1 (19.09.2026) — vezi jurnalul si proba
 * tests/curatenie-meniu.test.ts. Erau scrise pe selectoarele ANTETULUI, nu ale aplicatiei, si
 * amandoua stricau lucruri pe care nu le putea vedea nimeni citind codul aplicatiei.
 * Explicatia intreaga sta in comentariul fisierului, sus — nu si aici: stilul intra INTREG in
 * fiecare pagina, deci orice cuvant scris in el ajunge la ochii oricui ii citeste sursa.
 *
 * Regula de acum, fara exceptii: stilul aplicatiei atinge CONTINUTUL ei. Antetul, meniul de cont
 * si subsolul sunt ale carcasei; ce trebuie schimbat acolo se schimba acolo, pentru toate
 * aplicatiile deodata.
 */

/* Mesajul de jos (toast): fundalul ia culoarea scrisului temei, deci scrisul ia hartia. */
.toast { background: var(--ink); color: var(--paper) }
.toast.error { background: var(--danger); color: #fff }

/* Casetele calde si pastila „×N": culori proprii ziua, potolite noaptea. */
.note { background: var(--cald); border-color: var(--cald-chenar); color: var(--text) }
.vacation-banner, .vacation-intro { background: var(--cald) }
.vacation-toggle:hover:not(:disabled) { background: var(--cald) }
:root[data-tema="dark"] .stat-times { background: rgba(126,167,94,.16); border-color: rgba(126,167,94,.38) }
:root[data-tema="dark"] .slot-menu-item.danger:hover { background: rgba(224,122,122,.15) }
:root[data-tema="dark"] .sunday-card.past .slot.taken,
:root[data-tema="dark"] .sunday-card.past .slot.mine { background: #55604c; border-color: #6b7862 }

/* Randul de sub calendar: ultima actualizare si legatura spre intrebarile frecvente.
   Subsolul propriu-zis (linia, tema, versiunea, copyright-ul) e al carcasei. */
.info-jos { margin: 26px 0 0; text-align: center; color: var(--faint);
            font: 13px/1.6 ui-sans-serif, system-ui }
.info-jos a { color: var(--soft) }

/* Randul FANTOMEI — numele ales si intrebarea care il uita, pe randul personal al antetului
   (.cine, din carcasa). Uitarea e o FAPTA, deci un formular cu jeton, nu o legatura GET; butonul
   imprumuta insa infatisarea legaturilor de acolo, ca randul sa ramana un singur rand.
   ⚠️ Fara texte de-ale paginii in comentariile de aici: stilul intra INTREG in fiecare pagina,
   iar un cuvant scris aici s-ar gasi si la un om care n-are ce sa-l vada. */
.cine form { display: inline; margin: 0 }
.cine .ca-legatura { background: none; border: 0; padding: 0; font: inherit;
                     color: var(--soft); cursor: pointer }
.cine .ca-legatura:hover { color: var(--rosu); text-decoration: underline }
` + STIL_SETARI;
