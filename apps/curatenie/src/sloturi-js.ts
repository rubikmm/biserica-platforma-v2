/**
 * Ce face pagina de programare în browser — `public/assets/app.js` din V1, purtare cu purtare.
 *
 * În V1 stătea ca fișier static, cu `?v=` după versiune; aici merge în pagină, ca la toate
 * aplicațiile V2 (niciuna nu servește assets). Ce s-a schimbat în afară de asta:
 *   - adresa cerută vine din `window.CALE_API` (prin gateway-ul de preview aplicația stă sub
 *     `/curatenie`, pe subdomeniu la rădăcină);
 *   - fiecare cerere duce și jetonul CSRF (`window.CSRF`) — în V1 nu exista;
 *   - cele trei `window.*` s-au scris în românește: `EU_VOLUNTAR_ID`, `EU_ADMIN`, `LISTA_VOLUNTARI`.
 *
 * Restul — meniul adminului pe slot, „trenulețul" butonului „+", re-desenarea participării,
 * mesajele de jos — e neatins.
 */
export const JS_SLOTURI = String.raw`
(function () {
    'use strict';

    document.querySelectorAll('.slot[data-sunday]').forEach(bindSlot);
    document.querySelectorAll('.vacation-toggle[data-vacation-year]').forEach(bindVacationToggle);

    function bindSlot(btn) {
        btn.addEventListener('click', onSlotClick);
    }

    function bindVacationToggle(btn) {
        btn.addEventListener('click', onVacationClick);
    }

    function cerere(form) {
        form.append('csrf', window.CSRF || '');
        return fetch(window.CALE_API || '/api', {
            method: 'POST',
            body: form,
            credentials: 'same-origin',
        });
    }

    async function onVacationClick(e) {
        const btn = e.currentTarget;
        if (btn.disabled) return;
        btn.disabled = true;

        const card  = btn.closest('.vacation-card');
        const year  = btn.dataset.vacationYear;
        const month = btn.dataset.vacationMonth;

        const form = new FormData();
        form.append('action', 'toggle_vacation_month');
        form.append('year', year);
        form.append('month', month);

        try {
            const res = await cerere(form);
            const data = await res.json();

            if (!data.ok) {
                showToast(data.error || 'Eroare necunoscută.', true);
                btn.disabled = false;
                return;
            }

            const isOn = data.state === 'on';
            const weeks = card ? card.querySelectorAll('.week-slot') : [];
            weeks.forEach(w => w.classList.toggle('taken', isOn));
            btn.classList.toggle('active', isOn);
            btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
            showToast(data.message);

            // Reîncarcă pagina ca să se actualizeze și sloturile pe Luna curentă/viitoare
            // (vacanța blochează sloturi sau eliberează unele ocupate). Lăsăm 1.2s pentru toast.
            window.location.hash = 'vacation';
            setTimeout(() => window.location.reload(), 1200);
        } catch (err) {
            showToast('Eroare de rețea. Reîncearcă.', true);
            btn.disabled = false;
        }
    }

    /**
     * Aplică starea completă a sloturilor pentru o duminică, ca după un re-pack.
     * slotsState e un obiect { "1": {volunteer_id, name}, "2": {...}, ... }.
     * Actualizează butoanele existente: ocupate / libere / „mine".
     */
    function applySlotsState(container, slotsState) {
        const myId = window.EU_VOLUNTAR_ID || 0;
        const slots = container.querySelectorAll('.slot[data-slot]');
        slots.forEach(s => {
            const pos = s.dataset.slot;
            const state = slotsState[pos];
            const labelEl = s.querySelector('.label');
            if (state) {
                s.classList.add('taken');
                s.classList.remove('add');
                if (parseInt(state.volunteer_id, 10) === myId) {
                    s.classList.add('mine');
                } else {
                    s.classList.remove('mine');
                }
                s.dataset.takenBy = state.name;
                s.dataset.takenById = String(state.volunteer_id);
                if (labelEl) labelEl.textContent = state.name;
            } else {
                s.classList.remove('taken', 'mine', 'add');
                delete s.dataset.takenBy;
                delete s.dataset.takenById;
                if (labelEl) labelEl.textContent = 'liber';
            }
        });
    }

    /**
     * Reevaluează butonul „+" pentru un container:
     *   - îl adaugă dacă toate sloturile non-„+" sunt ocupate
     *   - îl elimină dacă măcar un slot e liber
     */
    function refreshAddSlot(container) {
        if (!container) return;
        const slots = Array.from(container.querySelectorAll('.slot:not(.add)'));
        const allTaken = slots.length > 0 && slots.every(s => s.classList.contains('taken'));
        const existingAdd = container.querySelector('.slot.add');

        if (allTaken && !existingAdd) {
            const nextSlot = slots.length + 1;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'slot add';
            btn.dataset.sunday = container.dataset.sundaySlots;
            btn.dataset.slot   = String(nextSlot);
            btn.innerHTML =
                '<span class="position">Voluntar ' + nextSlot + '</span>' +
                '<span class="label">+</span>';
            container.appendChild(btn);
            bindSlot(btn);
        } else if (!allTaken && existingAdd) {
            existingAdd.remove();
        }
    }

    // Trimite o acțiune pe slot către API și repaint-ează starea duminicii.
    // extra = parametri suplimentari (op, target_volunteer_id) — folosiți de admin.
    async function postSlot(btn, extra) {
        if (btn.disabled) return;
        btn.disabled = true;

        const form = new FormData();
        form.append('action', 'toggle_slot');
        form.append('sunday_date', btn.dataset.sunday);
        form.append('slot', btn.dataset.slot);
        for (const k in extra) {
            if (extra[k] !== undefined && extra[k] !== null) form.append(k, extra[k]);
        }
        // Statistica "Participare" exista doar in vederea arhiva - cere-o ca s-o
        // actualizam live dupa edit, fara reload.
        if (document.querySelector('.archive-stats')) form.append('with_stats', '1');

        try {
            const res = await cerere(form);
            const data = await res.json();
            if (!data.ok) {
                showToast(data.error || 'Eroare necunoscută.', true);
                return;
            }
            // Update vizual full-state: după re-pack, toate sloturile pot fi diferite.
            const container = btn.closest('.slots');
            if (container && data.slots_state) applySlotsState(container, data.slots_state);
            refreshAddSlot(container);
            if (data.participation_stats) renderParticipation(data.participation_stats, data.participation_ym);
            showToast(data.message);
        } catch (err) {
            showToast('Eroare de rețea. Reîncearcă.', true);
        } finally {
            btn.disabled = false;
        }
    }

    function onSlotClick(e) {
        const btn = e.currentTarget;
        if (btn.disabled) return;

        // Adminul autentificat: orice click pe slot deschide meniul in-place.
        if (window.EU_ADMIN) {
            openAdminMenu(btn);
            return;
        }

        // ---- Comportament voluntar normal (neschimbat) ----
        if (btn.classList.contains('readonly')) return;
        if (btn.classList.contains('taken') && !btn.classList.contains('mine')) {
            showToast('Slot ocupat de ' + (btn.dataset.takenBy || 'altcineva') + '.', true);
            return;
        }
        postSlot(btn, {});   // toggle clasic (ocupă / eliberează propriul slot)
    }

    // ===== Meniu in-place pentru admin =====================================
    let adminMenuEl = null;

    function closeAdminMenu() {
        if (adminMenuEl) { adminMenuEl.remove(); adminMenuEl = null; }
        document.removeEventListener('click', onDocClickClose);
        document.removeEventListener('keydown', onEscClose);
    }

    function onDocClickClose(e) {
        if (adminMenuEl && !adminMenuEl.contains(e.target)) closeAdminMenu();
    }

    function onEscClose(e) {
        if (e.key === 'Escape') closeAdminMenu();
    }

    function openAdminMenu(btn) {
        closeAdminMenu();
        const menu = document.createElement('div');
        menu.className = 'slot-menu';
        menu.setAttribute('role', 'menu');
        adminMenuEl = menu;
        document.body.appendChild(menu);
        buildMainMenu(btn, menu);

        // Atașăm dismiss-ul după ciclul curent ca să nu prindă chiar click-ul de deschidere.
        setTimeout(function () {
            document.addEventListener('click', onDocClickClose);
            document.addEventListener('keydown', onEscClose);
        }, 0);
    }

    // Construiește (sau reconstruiește, pt. „Înapoi") meniul principal în elementul dat.
    function buildMainMenu(btn, menu) {
        menu.innerHTML = '';
        menu.classList.remove('picker');
        const isTaken = btn.classList.contains('taken');

        const items = [];
        // „Pentru mine" are rost doar dacă adminul are un voluntar al lui în aplicație. Cine intră
        // cu contul platformei fără voluntar propriu (id 0) programează doar pe alții.
        if (window.EU_VOLUNTAR_ID) items.push({ label: 'Pentru mine', act: function () {
            closeAdminMenu();
            postSlot(btn, { op: 'assign', target_volunteer_id: window.EU_VOLUNTAR_ID });
        }});
        items.push({ label: isTaken ? 'Schimbă persoana' : 'Pentru altcineva', act: function () {
            showPicker(btn, menu);
        }});
        if (isTaken) {
            items.push({ label: 'Eliberează', danger: true, act: function () {
                closeAdminMenu();
                postSlot(btn, { op: 'release' });
            }});
        }

        items.forEach(function (it) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'slot-menu-item' + (it.danger ? ' danger' : '');
            b.textContent = it.label;
            b.addEventListener('click', function (ev) { ev.stopPropagation(); it.act(); });
            menu.appendChild(b);
        });
        positionMenu(menu, btn);
    }

    function showPicker(btn, menu) {
        menu.innerHTML = '';
        menu.classList.add('picker');

        const currentId = btn.dataset.takenById ? parseInt(btn.dataset.takenById, 10) : 0;

        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'slot-menu-back';
        back.textContent = '← Înapoi';
        back.addEventListener('click', function (ev) { ev.stopPropagation(); buildMainMenu(btn, menu); });

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'slot-menu-search';
        input.placeholder = 'Caută nume…';
        input.addEventListener('click', function (ev) { ev.stopPropagation(); });

        const list = document.createElement('div');
        list.className = 'slot-menu-list';

        // Ocupantul curent (la „Schimbă persoana") apare primul, marcat „(curent)".
        const all = (window.LISTA_VOLUNTARI || []).slice();
        all.sort(function (a, b) {
            if (a.id === currentId) return -1;
            if (b.id === currentId) return 1;
            return 0;
        });

        function pick(v) {
            closeAdminMenu();
            postSlot(btn, { op: 'assign', target_volunteer_id: v.id });
        }

        function render(filter) {
            list.innerHTML = '';
            const f = (filter || '').trim().toLowerCase();
            const matches = all.filter(function (v) { return !f || v.name.toLowerCase().indexOf(f) !== -1; });
            if (!matches.length) {
                const empty = document.createElement('div');
                empty.className = 'slot-menu-empty';
                empty.textContent = 'Niciun rezultat.';
                list.appendChild(empty);
                return;
            }
            matches.forEach(function (v) {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'slot-menu-item' + (v.id === currentId ? ' current' : '');
                b.textContent = v.id === currentId ? (v.name + ' (curent)') : v.name;
                b.addEventListener('click', function (ev) { ev.stopPropagation(); pick(v); });
                list.appendChild(b);
            });
        }
        input.addEventListener('input', function () { render(input.value); });
        input.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                const f = input.value.trim().toLowerCase();
                const matches = all.filter(function (v) { return !f || v.name.toLowerCase().indexOf(f) !== -1; });
                if (matches.length) pick(matches[0]);
            }
        });

        menu.appendChild(back);
        menu.appendChild(input);
        menu.appendChild(list);
        render('');
        positionMenu(menu, btn);
        input.focus();
    }

    function positionMenu(menu, btn) {
        const r = btn.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        menu.style.position = 'absolute';

        const mh = menu.offsetHeight || 0;
        const mw = menu.offsetWidth || 200;

        // Vertical: implicit sub buton; dacă nu încape jos dar încape sus, deschide deasupra.
        let top = window.scrollY + r.bottom + 4;
        if (r.bottom + 4 + mh > vh && r.top - 4 - mh > 0) {
            top = window.scrollY + r.top - mh - 4;
        }
        menu.style.top = Math.max(window.scrollY + 8, top) + 'px';

        // Orizontal: aliniat la buton, fără a depăși marginile (lățimea e plafonată în CSS).
        let left = window.scrollX + r.left;
        const maxLeft = window.scrollX + vw - mw - 8;
        if (left > maxLeft) left = maxLeft;
        if (left < window.scrollX + 8) left = window.scrollX + 8;
        menu.style.left = left + 'px';
    }

    // Re-randeaza sectiunea "Participare" a lunii editate cu valorile recalculate de server.
    // Markup identic cu cel din pagina: bifa = a venit macar o data; "×N" (N>=2) = harnic.
    // In arhiva (data-participation-split) inseram titlul "Voluntari in vacanta" inaintea primului 0.
    function renderParticipation(rows, ym) {
        const section = ym
            ? document.querySelector('.archive-stats[data-participation-ym="' + ym + '"]')
            : document.querySelector('.archive-stats');
        if (!section) return;
        const wrap = section.querySelector('.stat-bars');
        if (!wrap) return;
        const split = section.hasAttribute('data-participation-split');
        // Randurile vin deja sortate de server (grup „prezenti" -> „in vacanta", apoi total desc). Nu re-sortam.
        let vacShown = false;
        wrap.innerHTML = rows.map(function (r) {
            const added = r.note_label
                ? '<span class="stat-added" title="' + escapeHtml(r.note_title || '') + '">' + escapeHtml(r.note_label) + '</span>'
                : '';
            const adminTotal = (r.total_all !== undefined)
                ? '<span class="stat-admin-total' + (r.total_all === 0 ? ' never' : '') + '" title="Prezente pe tot istoricul (vizibil doar pentru admin)">[admin: ' + r.total_all + 'x în total]</span>'
                : '';
            const times = r.attended >= 2
                ? '<span class="stat-times" title="A venit de ' + r.attended + ' ori luna aceasta — in plus, harnic">×' + r.attended + '</span>'
                : '';
            let head = '';
            if (split && r.attended === 0 && !vacShown) {
                vacShown = true;
                head = '<h3 class="stat-subtitle">Voluntari în vacanță</h3>';
            }
            const neverCls = r.never ? ' is-never' : '';
            return head
                + '<div class="stat-row' + (r.attended === 0 ? ' is-zero' : '') + neverCls + '">'
                + '<span class="stat-check' + (r.attended > 0 ? ' on' : '') + '" aria-hidden="true"></span>'
                + '<span class="stat-name">' + escapeHtml(r.name) + (adminTotal ? ' ' + adminTotal : '') + (added ? ' ' + added : '') + '</span>'
                + times
                + '</div>';
        }).join('');
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function showToast(text, isError) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = text;
        toast.classList.toggle('error', !!isError);
        toast.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
    }
})();
`
