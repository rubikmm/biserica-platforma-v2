/**
 * BULA — partea văzută a modulului: cercul din colțul de jos și panoul care se deschide din el.
 *
 * Cerința utilizatorului (11.09.2026): „o iconiță rotundă jos - pe care la click să deschidă un
 * chat simplu - cu X - care pune iar în cerc tot chatul, dar nu închide discuția. Să fie un mesaj
 * cu Salut! Cu ce te pot ajuta?"
 *
 * Deci X-ul STRÂNGE, nu închide: firul rămâne pe server (D1), iar panoul se redeschide unde a
 * rămas — și după ce omul trece din program în calendar, fiindcă discuția e legată de el, nu de
 * pagină. Ștergerea e altceva și cere apăsată anume (coșul din antetul panoului).
 *
 * Stilul folosește variabilele carcasei (--paper, --ink, --rule, --rosu), ca bula să se schimbe
 * odată cu tema după soarele Bucureștiului, fără să știe nimic despre ea.
 *
 * ⚠️ FĂRĂ ACCENT GRAV în comentariile de stil: STIL e un template literal, iar un backtick scris
 * într-un comentariu CSS închide șirul și rupe compilarea cu erori fără legătură cu locul vinovat.
 */

/** Bulă de dialog cu trei puncte: semnul universal de „stai de vorbă", în linia iconițelor din
 *  carcasă (traseu subțire, fără umplere). Desenată aici, nu adusă de undeva. */
export const IC_BULA = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-2.9-.4L4 21l1.4-4.1A8.2 8.2 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"/><circle cx="8.6" cy="11.5" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="11.5" r=".9" fill="currentColor" stroke="none"/><circle cx="15.4" cy="11.5" r=".9" fill="currentColor" stroke="none"/></svg>`

const IC_X = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>`

const IC_COS = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>`

const IC_TRIMITE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>`

export const SALUT = 'Salut! Cu ce te pot ajuta?'

export const STIL_CHAT = `
.xc-chat { position:fixed; right:18px; bottom:18px; z-index:80;
           font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif }
.xc-chat * { box-sizing:border-box }

/* cercul: singurul lucru vizibil cat timp panoul e strans */
.xc-chat-cerc { width:54px; height:54px; border-radius:50%; border:1px solid var(--rule);
                background:var(--paper); color:var(--rosu); cursor:pointer; display:grid;
                place-items:center; box-shadow:0 3px 14px rgba(0,0,0,.16); padding:0;
                transition:transform .15s ease, box-shadow .15s ease }
.xc-chat-cerc:hover { transform:translateY(-1px); box-shadow:0 5px 18px rgba(0,0,0,.2) }
.xc-chat.deschis .xc-chat-cerc { display:none }

/* panoul */
.xc-chat-panou { display:none; width:min(374px, calc(100vw - 28px));
                 height:min(536px, calc(100vh - 110px)); flex-direction:column;
                 background:var(--paper); color:var(--ink); border:1px solid var(--rule);
                 border-radius:14px; overflow:hidden; box-shadow:0 10px 34px rgba(0,0,0,.22) }
.xc-chat.deschis .xc-chat-panou { display:flex }

.xc-chat-cap { display:flex; align-items:center; gap:8px; padding:10px 10px 10px 14px;
               border-bottom:1px solid var(--rule); background:var(--tinta) }
.xc-chat-cap b { font:600 14px/1 ui-sans-serif,system-ui; letter-spacing:.02em; flex:1 }
.xc-chat-cap button { border:0; background:none; color:var(--soft); cursor:pointer;
                      padding:6px; border-radius:8px; display:grid; place-items:center }
.xc-chat-cap button:hover { background:var(--rule); color:var(--ink) }

.xc-chat-fir { flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:10px }
.xc-chat-m { max-width:86%; padding:8px 11px; border-radius:12px; white-space:pre-wrap;
             overflow-wrap:anywhere }
.xc-chat-m.agent { align-self:flex-start; background:var(--tinta); border:1px solid var(--rule);
                   border-bottom-left-radius:4px }
.xc-chat-m.om { align-self:flex-end; background:var(--rosu); color:#fff; border-bottom-right-radius:4px }
.xc-chat-m.rea { align-self:flex-start; background:none; border:1px dashed var(--rule); color:var(--soft) }

/* hartia intoarsa de o actiune: un card, nu un perete de text */
.xc-chat-obiect { display:flex; align-items:center; gap:9px; align-self:flex-start; max-width:86%;
                  padding:9px 11px; border:1px solid var(--rule); border-radius:10px;
                  background:var(--paper); color:var(--ink); text-decoration:none }
.xc-chat-obiect:hover { border-color:var(--rosu) }
.xc-chat-obiect svg { flex:none; color:var(--soft) }
.xc-chat-obiect span { display:block; font-size:14px; line-height:1.3 }
.xc-chat-obiect small { color:var(--faint); font-size:12px }

/* propunerea: nimic nu se schimba pana nu apasa omul */
.xc-chat-propunere { align-self:stretch; border:1px solid var(--rosu); border-radius:10px;
                     padding:10px 11px; background:var(--paper) }
.xc-chat-propunere p { margin:0 0 8px; font-size:14px }
.xc-chat-propunere div { display:flex; gap:8px }
.xc-chat-propunere button { flex:1; padding:7px 10px; border-radius:8px; cursor:pointer;
                            font:600 13px/1 ui-sans-serif,system-ui; border:1px solid var(--rule);
                            background:var(--paper); color:var(--ink) }
.xc-chat-propunere button.da { background:var(--rosu); border-color:var(--rosu); color:#fff }

/* randul de scris. ⚠️ Carcasa are stiluri GLOBALE pe form (display:flex, wrap) si pe label —
   de aceea formularul isi scrie AICI toata asezarea, altfel campul si butonul se insira aiurea. */
.xc-chat-jos { display:flex; align-items:flex-end; gap:8px; padding:10px; margin:0;
               border-top:1px solid var(--rule); background:var(--paper); flex-wrap:nowrap }
.xc-chat-jos textarea { flex:1; resize:none; min-height:38px; max-height:110px; padding:9px 11px;
                        border:1px solid var(--rule); border-radius:10px; background:var(--paper);
                        color:var(--ink); font:15px/1.4 ui-sans-serif,system-ui; outline:none }
.xc-chat-jos textarea:focus { border-color:var(--rosu) }
.xc-chat-jos button { flex:none; width:38px; height:38px; border-radius:10px; border:0;
                      background:var(--rosu); color:#fff; cursor:pointer; display:grid;
                      place-items:center }
.xc-chat-jos button:disabled { opacity:.45; cursor:default }

.xc-chat-scrie { align-self:flex-start; color:var(--faint); font-size:13px; font-style:italic }

@media (max-width:480px) {
  .xc-chat { right:12px; bottom:12px; left:12px }
  .xc-chat-panou { width:auto; height:min(560px, calc(100vh - 90px)) }
  .xc-chat-cerc { margin-left:auto }
}
@media (prefers-reduced-motion:reduce) { .xc-chat-cerc { transition:none } }
`

/**
 * HTML-ul, scris de server. Salutul e AICI, nu venit de la model: se vede în clipa deschiderii,
 * fără nicio cerere și fără niciun ban cheltuit.
 */
export function bulaHtml(o: { prefix: string; titlu?: string }): string {
  const titlu = o.titlu ?? 'Întreabă'
  return `<div class="xc-chat" id="xc-chat" data-prefix="${o.prefix}">
  <div class="xc-chat-panou" role="dialog" aria-label="${titlu}">
    <div class="xc-chat-cap">
      <b>${titlu}</b>
      <button type="button" data-xc="sterge" title="Șterge discuția" aria-label="Șterge discuția">${IC_COS}</button>
      <button type="button" data-xc="strange" title="Strânge" aria-label="Strânge chatul">${IC_X}</button>
    </div>
    <div class="xc-chat-fir" id="xc-chat-fir" aria-live="polite">
      <div class="xc-chat-m agent">${SALUT}</div>
    </div>
    <form class="xc-chat-jos" id="xc-chat-form">
      <textarea id="xc-chat-text" rows="1" placeholder="Scrie aici…" aria-label="Mesajul tău"></textarea>
      <button type="submit" aria-label="Trimite">${IC_TRIMITE}</button>
    </form>
  </div>
  <button type="button" class="xc-chat-cerc" data-xc="deschide" aria-label="Deschide chatul">${IC_BULA}</button>
</div>`
}

/**
 * JS-ul bulei. Vanilla, ca tot ce e în carcasă. Ține minte două lucruri în localStorage: dacă
 * panoul era deschis și care e discuția — restul stă pe server.
 */
export const JS_CHAT = `(function(){
  var r = document.getElementById('xc-chat'); if (!r) return;
  var prefix = r.getAttribute('data-prefix') || '';
  var fir = document.getElementById('xc-chat-fir');
  var form = document.getElementById('xc-chat-form');
  var camp = document.getElementById('xc-chat-text');
  var buton = form.querySelector('button[type=submit]');
  var CHEIE_ID = 'xc-chat-id', CHEIE_DESCHIS = 'xc-chat-deschis';
  var idConv = null, incarcat = false, ocupat = false;
  try { idConv = localStorage.getItem(CHEIE_ID); } catch (e) {}

  function jos(){ fir.scrollTop = fir.scrollHeight; }
  function esc(t){ var d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; }

  function mesaj(rol, text){
    var d = document.createElement('div');
    d.className = 'xc-chat-m ' + rol;
    d.textContent = text;
    fir.appendChild(d); jos(); return d;
  }

  function card(ob){
    var a = document.createElement('a');
    a.className = 'xc-chat-obiect';
    a.href = prefix + '/chat/fisier/' + encodeURIComponent(ob.cheie);
    a.target = '_blank'; a.rel = 'noopener';
    a.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>'
      + '<span>' + esc(ob.titlu) + '<small>' + esc((ob.fel || '').toUpperCase()) + ' · ' + Math.round((ob.octeti || 0)/1024) + ' KB</small></span>';
    fir.appendChild(a); jos();
  }

  function propunere(p){
    var d = document.createElement('div');
    d.className = 'xc-chat-propunere';
    d.innerHTML = '<p>' + esc(p.rezumat) + '</p><div><button type="button" class="da">Da, fă-o</button><button type="button" class="nu">Nu</button></div>';
    d.querySelector('.da').addEventListener('click', function(){ raspunde(p.id, 'da', d); });
    d.querySelector('.nu').addEventListener('click', function(){ raspunde(p.id, 'nu', d); });
    fir.appendChild(d); jos();
  }

  function raspunde(id, raspuns, cutie){
    cutie.querySelectorAll('button').forEach(function(b){ b.disabled = true; });
    fetch(prefix + '/chat/confirma', {
      method:'POST', credentials:'same-origin', headers:{'content-type':'application/json'},
      body: JSON.stringify({ propunereId: id, raspuns: raspuns })
    }).then(function(x){ return x.json(); }).then(function(j){
      cutie.remove();
      mesaj(j.ok ? 'agent' : 'rea', j.text || (j.ok ? 'Gata.' : 'N-a mers.'));
      // Pagina de dedesubt e desenata la incarcare: dupa o schimbare facuta, se reincarca, ca omul
      // sa vada programul nou (user, 11.09.2026, 21:32: „dupa modificare nu a reincarcat pagina").
      // Discutia nu se pierde — sta pe server, iar panoul se redeschide unde era.
      if (j.ok) setTimeout(function(){ location.reload(); }, 900);
    }).catch(function(){ cutie.remove(); mesaj('rea', 'Nu am putut trimite confirmarea.'); });
  }

  function raspunsul(j){
    if (j.conversatieId){ idConv = j.conversatieId; try { localStorage.setItem(CHEIE_ID, idConv); } catch(e){} }
    if (j.text) mesaj('agent', j.text);
    (j.obiecte || []).forEach(card);
    if (j.propunere) propunere(j.propunere);
  }

  // Firul de dinainte, cerut o singura data, la prima deschidere: X-ul strange, nu inchide.
  function incarcaDiscutia(){
    if (incarcat || !idConv) { incarcat = true; return; }
    incarcat = true;
    fetch(prefix + '/chat/discutie?id=' + encodeURIComponent(idConv), { credentials:'same-origin' })
      .then(function(x){ return x.ok ? x.json() : null; })
      .then(function(j){
        if (!j || !j.mesaje || !j.mesaje.length) return;
        fir.innerHTML = '';
        j.mesaje.forEach(function(m){
          mesaj(m.rol === 'om' ? 'om' : 'agent', m.text);
          var d = m.date || {};
          (d.obiecte || []).forEach(card);
        });
      }).catch(function(){});
  }

  function deschide(){
    r.classList.add('deschis');
    try { localStorage.setItem(CHEIE_DESCHIS, '1'); } catch(e){}
    incarcaDiscutia();
    setTimeout(function(){ camp.focus(); jos(); }, 30);
  }
  function strange(){
    r.classList.remove('deschis');
    try { localStorage.setItem(CHEIE_DESCHIS, '0'); } catch(e){}
  }

  r.addEventListener('click', function(ev){
    var t = ev.target.closest('[data-xc]'); if (!t) return;
    var ce = t.getAttribute('data-xc');
    if (ce === 'deschide') deschide();
    else if (ce === 'strange') strange();
    else if (ce === 'sterge') sterge();
  });

  function sterge(){
    if (!confirm('Ștergi discuția?')) return;
    fetch(prefix + '/chat/sterge', {
      method:'POST', credentials:'same-origin', headers:{'content-type':'application/json'},
      body: JSON.stringify({ conversatieId: idConv })
    }).catch(function(){}).then(function(){
      idConv = null; try { localStorage.removeItem(CHEIE_ID); } catch(e){}
      fir.innerHTML = '<div class="xc-chat-m agent">' + ${JSON.stringify(SALUT)} + '</div>';
    });
  }

  function trimite(){
    var text = (camp.value || '').trim();
    if (!text || ocupat) return;
    ocupat = true; buton.disabled = true;
    camp.value = ''; camp.style.height = 'auto';
    mesaj('om', text);
    var asteapta = mesaj('scrie', 'scrie…');
    asteapta.className = 'xc-chat-scrie';
    fetch(prefix + '/chat/mesaj', {
      method:'POST', credentials:'same-origin', headers:{'content-type':'application/json'},
      body: JSON.stringify({ text: text, conversatieId: idConv })
    }).then(function(x){ return x.json(); }).then(function(j){
      asteapta.remove();
      if (j && (j.text || j.obiecte || j.propunere)) raspunsul(j);
      else mesaj('rea', (j && j.mesaj) || 'Nu am primit răspuns.');
    }).catch(function(){
      asteapta.remove(); mesaj('rea', 'Nu am putut trimite mesajul.');
    }).then(function(){ ocupat = false; buton.disabled = false; camp.focus(); });
  }

  form.addEventListener('submit', function(ev){ ev.preventDefault(); trimite(); });
  camp.addEventListener('keydown', function(ev){
    if (ev.key === 'Enter' && !ev.shiftKey){ ev.preventDefault(); trimite(); }
  });
  camp.addEventListener('input', function(){
    camp.style.height = 'auto';
    camp.style.height = Math.min(camp.scrollHeight, 110) + 'px';
  });

  try { if (localStorage.getItem(CHEIE_DESCHIS) === '1') deschide(); } catch(e){}
})();`
