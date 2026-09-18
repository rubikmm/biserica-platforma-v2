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
import { ACCEPTA } from './fisiere.js'

/** Bulă de dialog cu trei puncte: semnul universal de „stai de vorbă", în linia iconițelor din
 *  carcasă (traseu subțire, fără umplere). Desenată aici, nu adusă de undeva. */
export const IC_BULA = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-2.9-.4L4 21l1.4-4.1A8.2 8.2 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"/><circle cx="8.6" cy="11.5" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="11.5" r=".9" fill="currentColor" stroke="none"/><circle cx="15.4" cy="11.5" r=".9" fill="currentColor" stroke="none"/></svg>`

const IC_X = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>`

/** Discutie NOUA (user, 11.09.2026, 21:33): un plus intr-o bula. Cea veche ramane pe server. */
const IC_NOUA = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-2.9-.4L4 21l1.4-4.1A8.2 8.2 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"/><path d="M12 8.5v6M9 11.5h6"/></svg>`

const IC_COS = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>`

const IC_TRIMITE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>`

/** Clema de hartii — semnul universal de „atasez ceva". Desenata aici, ca toate celelalte. */
const IC_CLEMA = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5 12.2 19.3a4.6 4.6 0 0 1-6.5-6.5l7.8-7.8a3 3 0 0 1 4.3 4.3l-7.8 7.8a1.5 1.5 0 0 1-2.1-2.1l7.2-7.2"/></svg>`

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
/* Oprirea derularii nu se scrie aici: panoul cheama xcFereastra din carcasa. ⚠️ Dar NUMAI pe ecran
   ingust — vezi excepția scrisa pe larg in JS_CHAT (18.09.2026). */

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
/* clema de fisiere: acelasi loc si aceeasi masura ca butonul de trimis, dar in linie subtire — ea
   pregateste ceva, nu trimite nimic. */
.xc-chat-jos button.clema { background:var(--paper); color:var(--soft); border:1px solid var(--rule) }
.xc-chat-jos button.clema:hover { color:var(--rosu); border-color:var(--rosu) }

/* TRASUL UNUI FISIER PESTE PANOU: se spune ca se poate lasa aici, altfel browserul il deschide el
   intr-o fila noua si omul crede ca a stricat ceva. */
.xc-chat.peste .xc-chat-fir { outline:2px dashed var(--rosu); outline-offset:-8px }
.xc-chat.peste .xc-chat-panou { border-color:var(--rosu) }

/* „vezi tot / vezi mai putin" la mesajele lungi ale omului (un articol are ~9000 de semne: intins,
   impinge tot firul si nu se mai vede raspunsul). */
.xc-chat-vezi { display:block; margin-top:5px; border:0; background:none; padding:0; cursor:pointer;
                font:600 12px/1.4 ui-sans-serif,system-ui; color:inherit; opacity:.8;
                text-decoration:underline }
.xc-chat-vezi:hover { opacity:1 }

/* SEMNUL DE VIATA cat gandeste creierul (18.09.2026). Pana atunci era un „scrie…" neclintit: la un
   raspuns de doua minute, singurul lucru pe care il putea crede omul era ca s-a rupt ceva. Acum are
   trei puncte care bat, ETAPA venita de la server („caut in program…") si ceasul (mm:ss). */
.xc-chat-semn { align-self:flex-start; display:flex; align-items:center; gap:7px; max-width:100%;
                color:var(--faint); font-size:13px; font-style:italic }
.xc-chat-puncte { display:inline-flex; gap:3px; flex:none }
.xc-chat-puncte i { width:5px; height:5px; border-radius:50%; background:currentColor; opacity:.3;
                    animation:xc-chat-bate 1.25s ease-in-out infinite }
.xc-chat-puncte i:nth-child(2) { animation-delay:.18s }
.xc-chat-puncte i:nth-child(3) { animation-delay:.36s }
@keyframes xc-chat-bate {
  0%, 75%, 100% { opacity:.3; transform:translateY(0) }
  35% { opacity:1; transform:translateY(-2px) }
}
.xc-chat-etapa { overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.xc-chat-ceas { flex:none; font-style:normal; font-variant-numeric:tabular-nums }
.xc-chat-mic { flex:none; font-style:normal; border:1px solid var(--rule); border-radius:8px;
               background:var(--paper); color:var(--soft); cursor:pointer; padding:3px 8px;
               font:600 12px/1.2 ui-sans-serif,system-ui }
.xc-chat-mic:hover { color:var(--rosu); border-color:var(--rosu) }

@media (max-width:480px) {
  .xc-chat { right:12px; bottom:12px; left:12px }
  .xc-chat-panou { width:auto; height:min(560px, calc(100vh - 90px)) }
  .xc-chat-cerc { margin-left:auto }
}
@media (prefers-reduced-motion:reduce) {
  .xc-chat-cerc { transition:none }
  /* punctele nu mai bat, dar semnul trebuie sa se vada tot: rămân aprinse */
  .xc-chat-puncte i { animation:none; opacity:.6 }
}
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
      <button type="button" data-xc="noua" title="Discuție nouă" aria-label="Discuție nouă">${IC_NOUA}</button>
      <button type="button" data-xc="sterge" title="Șterge discuția" aria-label="Șterge discuția">${IC_COS}</button>
      <button type="button" data-xc="strange" title="Strânge" aria-label="Strânge chatul">${IC_X}</button>
    </div>
    <div class="xc-chat-fir" id="xc-chat-fir" aria-live="polite">
      <div class="xc-chat-m agent">${SALUT}</div>
    </div>
    <form class="xc-chat-jos" id="xc-chat-form">
      <textarea id="xc-chat-text" rows="1" placeholder="Scrie aici…" aria-label="Mesajul tău"></textarea>
      <!-- Câmpul de fișier stă ascuns, iar clema îl apasă: butonul desenat de noi arată ca restul
           bulei, pe când cel al browserului arată altfel în fiecare browser. -->
      <input type="file" id="xc-chat-fisier" multiple hidden accept="${ACCEPTA}">
      <button type="button" class="clema" data-xc="clema" title="Atașează un fișier"
              aria-label="Atașează un fișier (Word, text sau poză)">${IC_CLEMA}</button>
      <button type="submit" aria-label="Trimite">${IC_TRIMITE}</button>
    </form>
  </div>
  <button type="button" class="xc-chat-cerc" data-xc="deschide" aria-label="Deschide chatul">${IC_BULA}</button>
</div>`
}

/**
 * JS-ul bulei. Vanilla, ca tot ce e în carcasă. Ține minte două lucruri în localStorage: dacă
 * panoul era deschis și care e discuția — restul stă pe server.
 *
 * Trei purtări s-au schimbat pe 18.09.2026, după ce utilizatorul a spus „mi se cam blochează
 * fereastra de chat": fundalul nu se mai oprește pe ecran lat, răspunsul se AȘTEAPTĂ prin sondare
 * (nu pe firul cererii), iar așteptarea are semn de viață — etapă și ceas. Fiecare e scrisă la locul
 * ei, cu de ce.
 */
export const JS_CHAT = `(function(){
  var r = document.getElementById('xc-chat'); if (!r) return;
  var prefix = r.getAttribute('data-prefix') || '';
  var fir = document.getElementById('xc-chat-fir');
  var form = document.getElementById('xc-chat-form');
  var camp = document.getElementById('xc-chat-text');
  var panou = r.querySelector('.xc-chat-panou');
  var alege = document.getElementById('xc-chat-fisier');
  var buton = form.querySelector('button[type=submit]');
  var CHEIE_ID = 'xc-chat-id', CHEIE_DESCHIS = 'xc-chat-deschis', CHEIE_LA = 'xc-chat-la';
  var VIATA = 6 * 60 * 60 * 1000; // discutia expira dupa sase ore de la ultimul mesaj
  var PAS_SONDARE = 2500;         // cat de rar se intreaba /chat/stare cat lucreaza creierul
  var RABDARE = 5 * 60 * 1000;    // peste atat nu mai asteptam pe ecran, si o spunem limpede
  var LIMITA = 12 * 1024 * 1024;  // aceeasi cifra ca LIMITA_OCTETI de pe server
  var LAT_POZA = 1600;            // cat de mare ramane o poza dupa micsorarea din browser
  var STRANS_PESTE = 600, STRANS_CAT = 500; // de la cate semne se strange un mesaj in fir, si cat se vede
  var idConv = null, incarcat = false, ocupat = false, deReincarcat = false, ultimulText = '';
  var coada = [];                 // fisierele care asteapta: se urca unul pe rand, cu raspuns intre ele
  try {
    idConv = localStorage.getItem(CHEIE_ID);
    var la = Number(localStorage.getItem(CHEIE_LA) || 0);
    if (idConv && la && Date.now() - la > VIATA) { idConv = null; localStorage.removeItem(CHEIE_ID); }
  } catch (e) {}
  function atinge(){ try { localStorage.setItem(CHEIE_LA, String(Date.now())); } catch(e){} }

  /** Ecran cat panoul: acolo panoul E o fereastra, si se purtam cu el ca atare (vezi blocarea). */
  var strans = window.matchMedia('(max-width:480px)');
  function eIngust(){ return strans.matches; }

  function jos(){ fir.scrollTop = fir.scrollHeight; }
  function esc(t){ var d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; }
  // ⚠️ Slobozirea cheama si coada: un al doilea fisier tras odata cu primul asteapta aici, si fara
  // randul asta ar ramane sa astepte pana la urmatoarea apasare a omului.
  function gata(){ ocupat = false; buton.disabled = false; setTimeout(porneste, 0); }

  /**
   * TEXTUL UNUI MESAJ, STRANS CAND E LUNG (18.09.2026). Un articol de buletin lipit in bula are vreo
   * 9000 de semne: intins, umple firul de sus pana jos si impinge raspunsul afara din ecran. Peste 600
   * de semne se vad primele 500, cu o cheie „vezi tot / vezi mai putin".
   */
  function scrieText(d, text){
    var t = text == null ? '' : String(text);
    if (t.length <= STRANS_PESTE) { d.textContent = t; return d; }
    var inceput = document.createElement('span'); inceput.textContent = t.slice(0, STRANS_CAT);
    var puncte = document.createElement('span'); puncte.textContent = '…';
    var rest = document.createElement('span'); rest.textContent = t.slice(STRANS_CAT); rest.hidden = true;
    var cheie = document.createElement('button');
    cheie.type = 'button'; cheie.className = 'xc-chat-vezi'; cheie.textContent = 'vezi tot';
    cheie.addEventListener('click', function(){
      var intins = !rest.hidden;
      rest.hidden = intins; puncte.hidden = !intins;
      cheie.textContent = intins ? 'vezi tot' : 'vezi mai puțin';
      jos();
    });
    d.appendChild(inceput); d.appendChild(puncte); d.appendChild(rest); d.appendChild(cheie);
    return d;
  }

  /** Rândul, facut dar NEPUS in fir — cine il cere il aseaza singur (vezi nota din duMesajul). */
  function nodMesaj(rol, text){
    var d = document.createElement('div');
    d.className = 'xc-chat-m ' + rol;
    scrieText(d, text);
    return d;
  }

  function mesaj(rol, text){
    var d = nodMesaj(rol, text);
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

  // ---------------------------------------------------------------- fisiere
  // Word, text si poze, urcate din bula (user, 18.09.2026, 22:20). Octetii NU trec prin model:
  // pleaca la server, iar in discutie intra textul (la .docx/.txt) ori cheia (la poza).

  function marime(n){
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return Math.round(n / 1024) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  /** Cifrele mari, cu spatiu la mii: „8 912 semne" se citeste, „8912" se numara. */
  function cifre(n){ return String(Number(n) || 0).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ' '); }

  /** Cardul fisierului urcat: acelasi ca al hartiilor, cu masura si semnele scrise dedesubt. */
  function cardFisier(ob, semne, taiat){
    if (!ob || !ob.cheie) return;
    var a = document.createElement('a');
    a.className = 'xc-chat-obiect';
    a.href = prefix + '/chat/fisier/' + encodeURIComponent(ob.cheie);
    a.target = '_blank'; a.rel = 'noopener';
    var sub = esc(String(ob.fel || '').toUpperCase()) + ' · ' + marime(ob.octeti);
    if (semne) sub += ' · ' + cifre(semne) + ' semne' + (taiat ? ' (tăiat)' : '');
    a.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>'
      + '<span>' + esc(ob.titlu) + '<small>' + sub + '</small></span>';
    fir.appendChild(a); jos();
  }

  /**
   * POZA, MICSORATA IN BROWSER (luata din proiectul de chineza): telefoanele dau 8 MB pe poza, iar pe
   * foaia buletinului nu intra mai mult de vreo 1600 px. Se sare peste micsorare daca poza e deja
   * mica — n-are rost sa treaca printr-o recompresie care doar ii strica putin.
   */
  function micsoreaza(f){
    var nume = String(f.name || 'fisier');
    if (!/^image\\//.test(f.type || '')) return Promise.resolve({ blob: f, nume: nume });
    return new Promise(function(hai){
      var url = URL.createObjectURL(f);
      var img = new Image();
      function lasa(rezultat){ URL.revokeObjectURL(url); hai(rezultat); }
      img.onerror = function(){ lasa({ blob: f, nume: nume }); };
      img.onload = function(){
        try {
          var scara = Math.min(1, LAT_POZA / Math.max(img.width, img.height));
          if (scara === 1 && f.size < 1.5 * 1024 * 1024) { lasa({ blob: f, nume: nume }); return; }
          var panza = document.createElement('canvas');
          panza.width = Math.round(img.width * scara);
          panza.height = Math.round(img.height * scara);
          panza.getContext('2d').drawImage(img, 0, 0, panza.width, panza.height);
          panza.toBlob(function(blob){
            if (!blob || blob.size >= f.size) { lasa({ blob: f, nume: nume }); return; }
            lasa({ blob: blob, nume: nume.replace(/\\.[^.]+$/, '') + '.jpg' });
          }, 'image/jpeg', 0.82);
        } catch (e) { lasa({ blob: f, nume: nume }); }
      };
      img.src = url;
    });
  }

  /** Fisierele puse la rand. Unul pe rand, cu raspunsul intre ele: asa fiecare isi capata vorba lui. */
  function pune(fisiere){
    for (var i = 0; i < fisiere.length; i++) coada.push(fisiere[i]);
    porneste();
  }
  function porneste(){
    if (ocupat || !coada.length) return;
    urcaUnul(coada.shift());
  }

  function urcaUnul(f){
    if (f.size > LIMITA) {
      mesaj('rea', 'Fișierul „' + f.name + '" are ' + marime(f.size) + ' — primesc cel mult 12 MB.');
      setTimeout(porneste, 0); return;
    }
    ocupat = true; buton.disabled = true;
    // Ce a scris omul odata cu fisierul pleaca impreuna cu el: „pune poza asta la principal" + poza.
    var scris = (camp.value || '').trim();
    camp.value = ''; camp.style.height = 'auto';
    var rand = mesaj('rea', 'Se urcă ' + f.name + ' (' + marime(f.size) + ')…');
    micsoreaza(f).then(function(p){
      var fd = new FormData();
      fd.append('fisier', p.blob, p.nume);
      if (scris) fd.append('text', scris);
      return fetch(prefix + '/chat/urca', { method: 'POST', credentials: 'same-origin', body: fd });
    }).then(function(x){
      return x.json().catch(function(){ return null; });
    }).then(function(j){
      rand.remove();
      if (!j || !j.ok) { mesaj('rea', (j && j.mesaj) || 'Nu am putut urca fișierul.'); gata(); return; }
      atinge();
      if (scris) mesaj('om', scris);
      cardFisier(j.obiect, j.semne, j.taiat);
      // Ce a atins aplicatia cu fisierul asta, spus paginii ACUM — nu dupa ce raspunde modelul.
      if (j.unelte && j.unelte.length) vesteste(j);
      // Mesajul iese singur pe drumul obisnuit, ca omul sa nu mai apese inca o data (cerere anume).
      duMesajul(j.text);
    }).catch(function(){
      rand.remove(); mesaj('rea', 'Nu am putut urca fișierul.'); gata();
    });
  }

  function propunere(p){
    var d = document.createElement('div');
    d.className = 'xc-chat-propunere';
    d.innerHTML = '<p>' + esc(p.rezumat) + '</p><div><button type="button" class="da">Da, fă-o</button><button type="button" class="nu">Nu</button></div>';
    d.querySelector('.da').addEventListener('click', function(){ raspunde(p.id, 'da', d); });
    d.querySelector('.nu').addEventListener('click', function(){ raspunde(p.id, 'nu', d); });
    fir.appendChild(d); jos();
  }

  /**
   * „DA, FA-O" — SI ASTEPTAREA EI (19.09.2026).
   *
   * ⚠️ AICI ERA TACEREA de care s-a plans userul („acum nu merg să-i zici să-l compună … tot aștept
   * și nu răspunde"). Pana aici, confirmarea era o SINGURA cerere, fara ceas si fara sondare: butoanele
   * se stingeau, iar ruta /chat/confirma executa actiunea SINCRON, pe chiar conexiunea aceea. La o
   * actiune grea — buletin.compune randeaza PDF-ul intr-un browser adevarat, un minut si mai bine —
   * conexiunea se rupe pe drum (patit pe 18.09.2026 la /chat/mesaj: 2 min 49 s si cadere, desi
   * raspunsul se scria in baza). Atunci catch-ul prindea o cadere de retea DUPA ce treaba se facuse,
   * ori nu prindea nimic: butoane moarte, zero cuvinte, la nesfarsit.
   *
   * De acum se asteapta CA LA UN MESAJ: semn de viata cu ceas si „renunț", iar in PARALEL cu cererea
   * se sondeaza /chat/stare cu id-ul propunerii. Propunerea care nu mai asteapta = treaba ispravita,
   * oricat de rupta ar fi conexiunea dintai. Cine raspunde primul inchide, celalalt tace.
   * (Fara accente grave in comentariul asta: bucata e un template literal, iar ele l-ar rupe.)
   */
  function raspunde(id, raspuns, cutie){
    cutie.querySelectorAll('button').forEach(function(b){ b.disabled = true; });
    var incheiat = false, ceas = null, pornit = Date.now();
    var semn = semnDeViata();
    semn.etapa(raspuns === 'da' ? 'lucrez…' : 'las baltă…');

    /** Primul care are ce spune inchide asteptarea; al doilea nu mai scrie nimic. */
    function inchide(){
      if (incheiat) return false;
      incheiat = true;
      if (ceas) { clearTimeout(ceas); ceas = null; }
      semn.opreste(); cutie.remove(); atinge();
      return true;
    }
    /** Pagina de dedesubt e desenata la incarcare: dupa o schimbare facuta se reincarca, cu panoul
     *  STRANS (user, 21:48). ⚠️ SE SPUNE INTAI, si abia apoi se reincarca (18.09.2026): pagina care
     *  sare singura, fara nicio vorba, se citeste ca o cadere — nu ca o treaba dusa la capat. */
    function poateReincarca(){
      if (!deReincarcat) return;
      mesaj('agent', 'Actualizez pagina, ca să vezi schimbarea…');
      setTimeout(function(){ strange(); location.reload(); }, 1200);
    }

    semn.laRenunt(function(){
      if (!inchide()) return;
      mesaj('agent', 'Nu mai aștept aici. Dacă se duce la capăt, o vezi la redeschiderea chatului.');
    });

    function pas(){
      if (incheiat) return;
      if (!idConv) { ceas = setTimeout(pas, PAS_SONDARE); return; }
      if (Date.now() - pornit > RABDARE) {
        if (inchide()) {
          mesaj('rea', 'Durează neobișnuit de mult, așa că nu mai aștept aici. Dacă apucă să se facă, o vezi la redeschiderea chatului.');
        }
        return;
      }
      fetch(prefix + '/chat/stare?id=' + encodeURIComponent(idConv) + '&propunere=' + encodeURIComponent(id),
            { credentials:'same-origin' })
        .then(function(x){ return x.ok ? x.json() : null; })
        .then(function(j){
          if (incheiat) return;
          var s = j && j.propunereStare;
          if (s && s !== 'asteapta' && j.gata && j.raspuns) {
            if (!inchide()) return;
            if (s === 'facuta') deReincarcat = true;
            raspunsul(j.raspuns);
            // Urmarea („validez saptamana?") vine ca propunere in raspuns: reincarcarea asteapta.
            if (!j.raspuns.propunere) poateReincarca();
            return;
          }
          ceas = setTimeout(pas, PAS_SONDARE);
        })
        .catch(function(){ if (!incheiat) ceas = setTimeout(pas, PAS_SONDARE); });
    }
    ceas = setTimeout(pas, PAS_SONDARE);

    fetch(prefix + '/chat/confirma', {
      method:'POST', credentials:'same-origin', headers:{'content-type':'application/json'},
      body: JSON.stringify({ propunereId: id, raspuns: raspuns })
    }).then(function(x){ return x.json(); }).then(function(j){
      if (!inchide()) return;
      mesaj(j.ok ? 'agent' : 'rea', j.text || (j.ok ? 'Gata.' : 'N-a mers.'));
      if (j.reincarca) deReincarcat = true;
      // Urmarea („validez saptamana?"): inca o propunere, tot cu Da/Nu — reincarcarea asteapta.
      if (j.propunere) { propunere(j.propunere); return; }
      poateReincarca();
    }).catch(function(){
      // ⚠️ AICI NU SE MAI SPUNE „n-am putut trimite confirmarea", si nu se mai inchide asteptarea:
      // cererea poate sa fi cazut DUPA ce treaba s-a facut (pățit pe 18.09.2026), iar vorba aceea ar
      // fi o minciuna pe ecran. Se spune doar ce se stie sigur; adevarul il aduce sondarea, care merge
      // mai departe, iar daca nici ea, ramane rabdarea.
      if (!incheiat) semn.inainte(mesaj('agent', 'Cererea nu s-a întors, dar aștept mai departe: verific dacă s-a făcut totuși.'));
    });
  }

  /**
   * VESTEA CATRE PAGINA (18.09.2026). Pagina de dedesubt poate vrea sa se improspateze fara
   * reincarcare — ecranul „buletin nou" isi reface blocul schitei cand chatul a atins schita. Bula nu
   * stie nimic despre nicio pagina: da doar de veste, cu tot raspunsul in „detail” („unelte” spune ce
   * s-a chemat), iar cine are treaba asculta.
   *
   * ⚠️ Se striga SI dupa o urcare, nu doar dupa un raspuns al modelului: carligul aplicatiei scrie
   * INAINTE ca modelul sa raspunda, iar daca el nu mai cheama nicio unealta (n-are de ce — treaba e
   * facuta), pagina n-ar afla niciodata ca s-a schimbat ceva.
   */
  function vesteste(j){
    try { window.dispatchEvent(new CustomEvent('xc-chat:raspuns', { detail: j })); } catch (e) {}
  }

  function raspunsul(j){
    atinge();
    vesteste(j);
    if (j.conversatieId){ idConv = j.conversatieId; try { localStorage.setItem(CHEIE_ID, idConv); } catch(e){} }
    if (j.text) mesaj('agent', j.text);
    (j.obiecte || []).forEach(card);
    if (j.propunere) { propunere(j.propunere); return; }
    // O propunere care a fost si nu se mai poate apasa: se spune, nu se deseneaza butoane moarte.
    if (j.propunereTrecuta && j.propunereTrecuta.stare === 'expirata') {
      mesaj('rea', 'Propunerea „' + j.propunereTrecuta.rezumat + '" a expirat. Cere-mi din nou, ca să lucrez pe date proaspete.');
    }
  }

  /**
   * SEMNUL DE VIATA: trei puncte care bat, etapa de la server si ceasul. Intoarce o mica unealta cu
   * care il muta cine asteapta — etapa, ceasul, renuntarea, stingerea.
   */
  function semnDeViata(){
    var d = document.createElement('div');
    d.className = 'xc-chat-semn';
    d.innerHTML = '<span class="xc-chat-puncte"><i></i><i></i><i></i></span>'
      + '<span class="xc-chat-etapa">scrie…</span><span class="xc-chat-ceas">0:00</span>';
    var eEtapa = d.querySelector('.xc-chat-etapa'), eCeas = d.querySelector('.xc-chat-ceas');
    var renunt = document.createElement('button');
    renunt.type = 'button'; renunt.className = 'xc-chat-mic'; renunt.textContent = 'renunț';
    renunt.hidden = true; d.appendChild(renunt);
    var de = Date.now();
    function scrieCeasul(){
      var s = Math.max(0, Math.round((Date.now() - de) / 1000));
      eCeas.textContent = Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
    }
    var bate = setInterval(scrieCeasul, 1000);
    fir.appendChild(d); jos();
    return {
      etapa: function(t){ if (t) eEtapa.textContent = t; },
      /** De cand se asteapta, spus de server: ceasul e drept si dupa o reincarcare de pagina. */
      deLa: function(iso){ var t = Date.parse(iso || ''); if (t) { de = t; scrieCeasul(); } },
      laRenunt: function(f){ renunt.hidden = false; renunt.addEventListener('click', f); },
      /** Un rand asezat INAINTEA semnului: vestea aplicatiei („textul a intrat in schita") s-a
       *  intamplat deja, deci n-are ce cauta sub punctele care bat pentru raspunsul care abia vine. */
      inainte: function(nod){ fir.insertBefore(nod, d); jos(); },
      opreste: function(){ clearInterval(bate); d.remove(); }
    };
  }

  /** „mai încearcă" — acelasi mesaj, trimis din nou, fara sa-l scrie omul a doua oara. */
  function maiIncearca(){
    var d = document.createElement('div');
    d.className = 'xc-chat-semn';
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'xc-chat-mic'; b.textContent = 'mai încearcă';
    b.addEventListener('click', function(){
      if (ocupat || !ultimulText) return;
      // ⚠️ NU prin camp: mesajul e deja scris in fir (si poate avea 12000 de semne, adusi dintr-un
      // .docx). Se trimite chiar el, fara sa se scrie a doua oara nici in camp, nici in fir.
      d.remove(); ocupat = true; buton.disabled = true; duMesajul(ultimulText);
    });
    d.appendChild(b); fir.appendChild(d); jos();
  }

  /**
   * SONDAREA (18.09.2026). Raspunsul nu mai vine pe cererea care l-a cerut: serverul scrie mesajul
   * omului, porneste lucrul si intoarce indata {inLucru:true}. De aici incolo intrebam /chat/stare la
   * cateva secunde — asa nicio cerere nu mai atarna minute intregi (la peste o suta de secunde cadea,
   * si bula spunea „Nu am putut trimite mesajul" desi raspunsul se scria in baza).
   *
   * Nu se pierde nimic daca omul renunta ori inchide pagina: raspunsul se scrie oricum in discutie si
   * se vede la redeschiderea panoului.
   */
  function sondeaza(semn, deCand){
    var pornit = deCand || Date.now(), ceas = null, oprit = false;
    function stop(){ oprit = true; if (ceas) clearTimeout(ceas); }
    function iar(){ if (!oprit) ceas = setTimeout(pas, PAS_SONDARE); }
    semn.laRenunt(function(){
      stop(); semn.opreste();
      mesaj('agent', 'Nu mai aștept aici. Răspunsul se scrie în discuție — îl vezi când redeschizi chatul.');
      gata();
    });
    function pas(){
      if (!idConv) { stop(); semn.opreste(); gata(); return; }
      if (Date.now() - pornit > RABDARE) {
        stop(); semn.opreste();
        mesaj('rea', 'Durează neobișnuit de mult, așa că nu mai aștept aici. Dacă răspunsul apucă să se scrie, îl vezi la redeschiderea chatului.');
        maiIncearca(); gata(); return;
      }
      fetch(prefix + '/chat/stare?id=' + encodeURIComponent(idConv), { credentials:'same-origin' })
        .then(function(x){ return x.ok ? x.json() : null; })
        .then(function(j){
          if (oprit) return;
          if (!j) { iar(); return; }
          if (j.gata && j.raspuns) { stop(); semn.opreste(); raspunsul(j.raspuns); gata(); return; }
          semn.etapa(j.etapa); semn.deLa(j.deLa);
          iar();
        })
        .catch(function(){ iar(); });
    }
    iar();
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
          // ⚠️ SI PROPUNEREA (18.09.2026): pana atunci firul refacut din istoric avea numai text si
          // hartii, deci cine strangea panoul pierdea butoanele Da/Nu si nu mai avea cum sa confirme
          // ce-i pregatise chatul. Serverul trimite doar propunerea care se mai poate apasa.
          if (d.propunere) propunere(d.propunere);
          else if (d.propunereTrecuta && d.propunereTrecuta.stare === 'expirata') {
            mesaj('rea', 'Propunerea „' + d.propunereTrecuta.rezumat + '" a expirat — cere-mi din nou.');
          }
        });
        // Panoul redeschis cat creierul lucreaza: se reia sondarea de unde a rămas, cu ceasul pornit
        // de cand a intrebat omul — altfel firul s-ar sfarsi cu intrebarea lui si nimic dupa ea.
        if (j.inLucru && !ocupat) {
          ocupat = true; buton.disabled = true;
          var semn = semnDeViata();
          semn.etapa(j.inLucru.etapa); semn.deLa(j.inLucru.deLa);
          sondeaza(semn, Date.parse(j.inLucru.deLa || '') || Date.now());
        }
      }).catch(function(){});
  }

  /*
   * ⚠️ EXCEPTIE ANUME DE LA REGULA FERESTRELOR din @xc/ui („orice pop-up opreste derularea paginii de
   * dedesubt" — user, 13.09.2026), cerută de blocarea reclamata pe 18.09.2026: „mi se cam blocheaza
   * fereastra de chat".
   *
   * Pe ecran LAT panoul nu e o fereastra, e un colt de 374px: nu acopera nimic, iar oprirea derularii
   * cat sta deschis (si minutele in care creierul gandeste!) facea site-ul sa para inghetat — cu atat
   * mai rau ca panoul se redeschide singur pe fiecare pagina. Deci pe lat nu se blocheaza nimic.
   *
   * Pe ecran INGUST (≤480px) panoul e cat ecranul, adica o fereastra adevarata, si regula ramane
   * intreaga. Nimic din @xc/ui nu se atinge: numaratoarea de acolo se cheama la fel, doar mai rar.
   */
  var blocat = false;
  function opresteFundalul(cum){
    var vrem = Boolean(cum) && eIngust();
    if (vrem === blocat || !window.xcFereastra) return;
    blocat = vrem;
    if (vrem) window.xcFereastra.blocheaza(); else window.xcFereastra.dezblocheaza();
  }
  // Rotirea telefonului ori fereastra trasa mai larga: blocarea se potriveste pe loc, ca sa nu rămâna
  // pagina incuiata pe lat (ori derulabila sub un panou care o acopera).
  if (strans.addEventListener) {
    strans.addEventListener('change', function(){ opresteFundalul(r.classList.contains('deschis')); });
  }

  function deschide(){
    r.classList.add('deschis');
    opresteFundalul(true);
    try { localStorage.setItem(CHEIE_DESCHIS, '1'); } catch(e){}
    incarcaDiscutia();
    setTimeout(function(){ camp.focus(); jos(); }, 30);
  }
  function strange(){
    r.classList.remove('deschis');
    opresteFundalul(false);
    try { localStorage.setItem(CHEIE_DESCHIS, '0'); } catch(e){}
  }

  r.addEventListener('click', function(ev){
    var t = ev.target.closest('[data-xc]'); if (!t) return;
    var ce = t.getAttribute('data-xc');
    if (ce === 'deschide') deschide();
    else if (ce === 'strange') strange();
    else if (ce === 'sterge') sterge();
    else if (ce === 'noua') noua();
    else if (ce === 'clema') alege.click();
  });

  // ------------------------------------------------- cele trei feluri de a da un fisier
  // clema (campul ascuns), trasul peste panou si lipirea din clipboard. ⚠️ Campul se goleste dupa
  // fiecare alegere: fara asta, acelasi fisier ales a doua oara nu mai da niciun eveniment.
  alege.addEventListener('change', function(){
    var f = alege.files;
    if (f && f.length) pune(f);
    alege.value = '';
  });

  ['dragenter', 'dragover'].forEach(function(nume){
    panou.addEventListener(nume, function(ev){ ev.preventDefault(); r.classList.add('peste'); });
  });
  ['dragleave', 'dragend'].forEach(function(nume){
    panou.addEventListener(nume, function(ev){ if (ev.target === panou) r.classList.remove('peste'); });
  });
  panou.addEventListener('drop', function(ev){
    ev.preventDefault(); r.classList.remove('peste');
    var d = ev.dataTransfer;
    if (d && d.files && d.files.length) pune(d.files);
  });

  // Lipirea unei poze din clipboard (captura de ecran, poza copiata dintr-o pagina). Textul lipit
  // ramane ce era — se opreste doar lipirea cand chiar sunt poze in clipboard.
  camp.addEventListener('paste', function(ev){
    var date = ev.clipboardData;
    if (!date || !date.items) return;
    var poze = [];
    for (var i = 0; i < date.items.length; i++) {
      var it = date.items[i];
      if (it.kind === 'file' && /^image\\//.test(it.type || '')) {
        var f = it.getAsFile();
        if (f) poze.push(f);
      }
    }
    if (!poze.length) return;
    ev.preventDefault();
    pune(poze);
  });

  // Discutie noua: firul de pe ecran se goleste si urmatorul mesaj deschide alta discutie pe
  // server. Cea veche NU se sterge si nu se ascunde — ramane, de referinta.
  function noua(){
    idConv = null; incarcat = true;
    try { localStorage.removeItem(CHEIE_ID); } catch(e){}
    fir.innerHTML = '<div class="xc-chat-m agent">' + ${JSON.stringify(SALUT)} + '</div>';
    camp.focus();
  }

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
    duMesajul(text);
  }

  /**
   * MESAJUL, PE DRUMUL OBISNUIT. Despartit de „trimite” fiindca se cheama din DOUA locuri: de la
   * campul de scris si de la urcarea unui fisier (unde textul e facut de server, iar in fir s-au
   * scris deja cardul si vorba omului). Cine cheama a pus deja „ocupat”.
   */
  function duMesajul(text){
    ultimulText = text;
    var semn = semnDeViata();
    fetch(prefix + '/chat/mesaj', {
      method:'POST', credentials:'same-origin', headers:{'content-type':'application/json'},
      body: JSON.stringify({ text: text, conversatieId: idConv })
    }).then(function(x){ return x.json(); }).then(function(j){
      atinge();
      if (j && j.conversatieId){ idConv = j.conversatieId; try { localStorage.setItem(CHEIE_ID, idConv); } catch(e){} }
      /*
       * CE A FACUT APLICATIA CU TEXTUL, spus INAINTE de raspunsul modelului (19.09.2026). Cand
       * carligul aplicatiei a luat textul lung in primire — buletinul il scrie in schita — serverul
       * intoarce pe loc „nota" (fraza scurta) si „unelte" (ce s-a atins). Vestea pleaca acum, nu la
       * capatul gandirii: schimbarea s-a intamplat deja, iar ecranul de dedesubt trebuie s-o vada.
       */
      if (j && j.unelte && j.unelte.length) vesteste(j);
      if (j && j.nota) semn.inainte(nodMesaj('agent', j.nota));
      // Drumul de-acum: serverul a luat mesajul si lucreaza. Raspunsul il aducem sondand.
      if (j && j.inLucru) { sondeaza(semn); return; }
      semn.opreste();
      if (j && (j.text || j.obiecte || j.propunere)) { raspunsul(j); gata(); return; }
      mesaj('rea', (j && j.mesaj) || 'Nu am primit răspuns.'); gata();
    }).catch(function(){
      // ⚠️ Cererea a cazut (retea, timp, pagina schimbata): NU spunem indata „n-a mers". Mesajul e
      // poate deja la creier, iar raspunsul se scrie in discutie — deci il CAUTAM sondand, si numai
      // dupa ce nici asa nu vine spunem limpede (patit pe 18.09.2026).
      if (idConv) { sondeaza(semn); return; }
      semn.opreste(); mesaj('rea', 'Nu am putut trimite mesajul.'); maiIncearca(); gata();
    });
  }

  form.addEventListener('submit', function(ev){ ev.preventDefault(); trimite(); });
  camp.addEventListener('keydown', function(ev){
    if (ev.key !== 'Enter') return;
    // ⚠️ PE ECRAN INGUST, ENTER FACE RAND NOU (user, 18.09.2026). Pe telefon tasta aceea e singura
    // cale spre al doilea rand (Shift nu exista), iar trimiterea are butonul ei, mare, langa camp.
    // Pe lat rămâne cum era: Enter trimite, Shift+Enter trece pe rand nou.
    if (eIngust() || ev.shiftKey) return;
    ev.preventDefault(); trimite();
  });
  camp.addEventListener('input', function(){
    camp.style.height = 'auto';
    camp.style.height = Math.min(camp.scrollHeight, 110) + 'px';
  });

  // Panoul se redeschide unde a rămas — ⚠️ NUMAI PE ECRAN LAT (18.09.2026). Pe telefon e cat ecranul:
  // redeschis singur la fiecare pagina, acoperea site-ul si oprea derularea, deci omul citea „site
  // blocat". Acolo se deschide doar la apasarea lui, si discutia il asteapta oricum pe server.
  try { if (localStorage.getItem(CHEIE_DESCHIS) === '1' && !eIngust()) deschide(); } catch(e){}
})();`
