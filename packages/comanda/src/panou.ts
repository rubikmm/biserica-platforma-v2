import { butonPlayStop } from './buton.js'

/**
 * PANOUL — locul unic din care se comandă emisia parohiei.
 *
 * ⚠️ **E ACELAȘI panou în amândouă aplicațiile** (cerere a utilizatorului, 14.09.2026: „pe radio să
 * fie același admin"). De aceea stă aici, scris o dată, nu copiat în fiecare: `live` și `radio` îl
 * montează amândouă la `/admin`, iar el vorbește numai cu originea lui (`<prefix>/admin/…`).
 * Fiecare aplicație compune răspunsul cerându-i celeilalte partea ei — panoul nu știe și nu
 * trebuie să știe care dintre ele îl servește.
 *
 * Așezarea e cea din V1 (`dashboard.html` de pe Raspberry Pi, apoi `/control`), ca Părintele să nu
 * învețe nimic nou. De sus în jos:
 *   - comutatorul **RADIO | LIVE** (+ OPRIT, numai pentru super-admin) — al doilea tap pe cel activ
 *     nu face nimic, iar oprirea directului cere confirmare;
 *   - CARTELA DE STARE, mereu vizibilă: ÎN DIRECT / RADIO + piesa / OPRIT — nu dispare niciodată;
 *   - PLAYERUL: aici se aude ce merge acum, cu același script ca paginile publice;
 *   - pe radio: „Alege muzica", „Selecția";
 *   - „Spațiu pe aparatul din biserică", numai dacă aparatul e legat;
 *   - „Detalii tehnice", strâns implicit: telemetria brută + starea canalelor din SFU.
 *
 * ⚠️ **Butonul din stânga scrie RADIO, dar modul se numește `stop` în cod și pe sârmă**
 * (`ActiunePanou`, telemetria, testele). Nu e o scăpare: apăsat, el oprește directul, iar radioul
 * reia de unde rămăsese — adică **STOP nu înseamnă liniște**. Cuvântul de pe buton spune ce se
 * aude după apăsare (așa era și în V1, unde butonul se chema `radio`), numele intern spune ce se
 * întâmplă cu directul. Dacă vreodată se unifică vocabularul, se schimbă în același timp contractul
 * `ActiunePanou`, `stare.ts` din `live`, aplicația `radio` și testele — nu doar eticheta.
 *
 * ⚠️ **Ordinea în pastilă: RADIO | LIVE | OPRIT** (user, 14.09.2026: „la admin trebuie să fie LIVE
 * pe mijloc și RADIO stânga"). În V1 LIVE era primul; s-a mutat la mijloc dinadins, ca butonul care
 * pornește transmisiunea să nu mai stea la marginea din stânga, unde degetul ajunge din greșeală.
 * Liniștea de tot e OPRIT, și a rămas la super-admin, ca în V1 („RADIO vreau să meargă
 * permanent… opritul manual nu are sens decât pentru mine ca super-admin" — Părintele dă mute).
 *
 * Fișierul nu importă nimic din runtime, ca să poată fi randat și în Node, la o probă.
 */

const ICO = {
  folder: `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>`,
  lista: `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>`,
  roata: `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>`,
  jos: `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>`,
  casa: `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>`,
  play: `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5 4.5v11a.5.5 0 00.75.433l9.5-5.5a.5.5 0 000-.866l-9.5-5.5A.5.5 0 005 4.5z"/></svg>`,
}

/** Capul unei cartele pliabile. `unealta` = un element LÂNGĂ buton (un `<a>` n-are voie într-un
 *  `<button>`), pe același rând — de pildă rotița spre „Muzica radioului". */
function cartelaCap(id: string, ico: string, titlu: string, extra = '', unealta = ''): string {
  const cap = `<button type="button" class="ctl-cap" data-cap="${id}" aria-expanded="false">
    <span class="ctl-cap-st">${ico}<h2>${titlu}</h2>${extra}</span>
    <span class="ctl-cap-sageata">${ICO.jos}</span>
  </button>`
  return unealta ? `<div class="ctl-cap-rand">${cap}${unealta}</div>` : cap
}

/**
 * Corpul panoului. `legaturi` sunt adresele celor două pagini publice și ale bibliotecii, puse de
 * aplicația care îl montează (ea știe unde stă cealaltă).
 */
export function corpPanou(legaturi: { live: string; radio: string; biblioteca: string }): string {
  return `<div class="ctl">
  <section class="ctl-toggle">
    <div class="ctl-pill" role="group" aria-label="Emisia parohiei">
      <button type="button" class="ctl-pill-btn ctl-pill-stop" data-mod="stop" disabled><span class="ctl-pill-text">RADIO</span></button>
      <button type="button" class="ctl-pill-btn ctl-pill-live" data-mod="live" disabled><span class="ctl-bulina"></span><span class="ctl-pill-text">LIVE</span></button>
      <button type="button" class="ctl-pill-btn ctl-pill-oprit" data-mod="oprit" disabled hidden><span class="ctl-pill-text">OPRIT</span></button>
    </div>
  </section>

  <!-- LEGATURA RUPTA: Parintele poate intra de pe 5G cand la biserica nu e internet; comenzile lui
       nu ajung la aparat pana nu revine legatura — trebuie sa vada asta. -->
  <div class="ctl-alerta" id="alerta-legatura" hidden></div>

  <!-- CARTELA DE STARE: ce e pus in spate ACUM. Nu dispare niciodata. -->
  <section class="ctl-card ctl-info ctl-acum" id="bloc-acum" data-stare="oprit">
    <p class="ctl-info-titlu" id="acum-titlu">—</p>
    <p class="ctl-info-album" id="acum-sub"></p>
    <p class="ctl-info-durata" id="acum-durata"></p>
    <p class="ctl-info-durata" id="acum-rec"></p>
    <p class="ctl-info-boxe" id="acum-boxe" hidden></p>
    <p class="ctl-info-program" id="acum-program" hidden></p>
    <p class="ctl-info-ascultatori" id="acum-ascultatori" hidden></p>
    <div class="ctl-eroare" id="eroare" hidden></div>
  </section>

  <!-- PLAYERUL: aici se aude ce merge acum — directul din biserica sau radioul. Acelasi script ca
       paginile publice, de aceea ID-urile sunt aceleasi; doua elemente audio, ca trecerea sa fie lina. -->
  <section class="ctl-player">
    <div class="ctl-player-butoane">
      ${butonPlayStop('ctl-player-btn')}
      <p class="ctl-player-stare" id="stare" data-stare="necunoscut">Verific ce se aude…</p>
    </div>
    <audio id="audio" playsinline></audio>
    <audio id="audio-radio" playsinline preload="auto"></audio>
    <section class="rad ctl-player-rad" id="rad" hidden>
      <p class="rad-piesa" id="rad-piesa"></p>
      <p class="rad-album" id="rad-album"></p>
      <p class="rad-timp" id="rad-timp"></p>
      <p class="rad-urmeaza" id="rad-urmeaza"></p>
    </section>
    <dl class="ctl-player-cifre" id="cifre" hidden>
      <dt>Legătura</dt><dd id="c-legatura">–</dd>
      <dt>Debit</dt><dd id="c-debit">–</dd>
      <dt>Pierdute</dt><dd id="c-pierdute">–</dd>
      <dt>Jitter</dt><dd id="c-jitter">–</dd>
      <dt>Ascult de</dt><dd id="c-durata">–</dd>
    </dl>
    <!-- pe RADIO cifrele sunt altele (fisier prin HTTP, nu WebRTC): tamponul si opririle spun daca
         ascultatorul are internet slab; debitul e al piesei (marime / durata). -->
    <dl class="ctl-player-cifre" id="cifre-radio" hidden>
      <dt>Legătura</dt><dd id="r-legatura">–</dd>
      <dt>Debit</dt><dd id="r-debit">–</dd>
      <dt>Tampon</dt><dd id="r-tampon">–</dd>
      <dt>Ascult de</dt><dd id="r-durata">–</dd>
    </dl>
  </section>

  <div id="bloc-radio" hidden>
    <section class="ctl-card" id="card-alege">
      ${cartelaCap(
        'alege',
        ICO.folder,
        'Alege muzica',
        '',
        `<a class="ctl-cap-unealta" id="leg-biblioteca" href="${legaturi.biblioteca}" title="Muzica radioului (biblioteca)" aria-label="Muzica radioului" hidden>${ICO.roata}</a>`,
      )}
      <div class="ctl-corp" hidden>
        <nav class="ctl-firimituri" id="firimituri"></nav>
        <ul class="ctl-lista" id="subfoldere"></ul>
        <p class="ctl-gol" id="alege-gol" hidden></p>
        <div id="bloc-fisiere" hidden>
          <div class="ctl-subcap">Piese (<span id="nr-fisiere">0</span>)</div>
          <ul class="ctl-lista" id="fisiere"></ul>
        </div>
      </div>
    </section>

    <section class="ctl-card" id="card-selectia">
      ${cartelaCap('selectia', ICO.lista, 'Selecția', `<span class="ctl-cap-mic" id="selectia-rezumat"></span>`)}
      <div class="ctl-corp" hidden>
        <p class="ctl-gol" id="selectia-gol" hidden>Niciun playlist activ. Selectează un director pentru radio.</p>
        <ul class="ctl-lista" id="grupuri"></ul>
      </div>
    </section>
  </div>

  <section class="ctl-card ctl-disc" id="card-disc" hidden>
    <div class="ctl-disc-cap"><h2>Spațiu pe aparatul din biserică</h2><span id="disc-text"></span></div>
    <div class="ctl-bara"><div class="ctl-bara-plin" id="disc-bara"></div></div>
  </section>

  <section class="ctl-card" id="card-tehnic">
    ${cartelaCap('tehnic', ICO.roata, 'Detalii tehnice', `<span class="ctl-cap-mic" id="tehnic-rezumat"></span>`)}
    <div class="ctl-corp" hidden>
      <dl class="ctl-tehnic" id="tehnic-lista"></dl>
    </div>
  </section>

  <p class="ctl-legaturi" id="legaturi" hidden><a href="${legaturi.live}" target="_blank" rel="noopener" title="Pagina publică a directului">LIVE</a> · <a href="${legaturi.radio}" target="_blank" rel="noopener" title="Pagina publică a radioului">RADIO</a></p>
  <p class="ctl-subsol" id="subsol-aparat"></p>
</div>
`
}

export const STIL_PANOU = `
.ctl { max-width:760px; margin:0 auto; padding-bottom:24px; display:flex; flex-direction:column; gap:14px; color:var(--ink) }
.ctl h2 { font-size:16px; font-weight:600; margin:0 }
.ctl svg { width:16px; height:16px; flex:none }
.ctl-toggle { display:flex; flex-direction:column; align-items:center; gap:6px; margin-top:6px }
.ctl-pill { display:inline-flex; width:50%; min-width:270px; border-radius:12px; background:rgba(127,127,127,.14); padding:3px; box-shadow:inset 0 1px 2px rgba(0,0,0,.08) }
.ctl-pill-btn { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:5px; font:inherit; font-size:13px; font-weight:700; padding:7px 0; border:0; border-radius:9px; background:transparent; color:inherit; cursor:pointer }
.ctl-pill-btn[disabled] { cursor:default; opacity:.55 }
.ctl-pill-btn .ctl-bulina { width:6px; height:6px; border-radius:50%; background:currentColor }
.ctl-pill-live.activ { background:#dc2626; color:#fff; box-shadow:0 1px 3px rgba(0,0,0,.2); opacity:1 }
.ctl-pill-stop.activ { background:#16a34a; color:#fff; box-shadow:0 1px 3px rgba(0,0,0,.2) }
.ctl-pill-oprit.activ { background:#475569; color:#fff; box-shadow:0 1px 3px rgba(0,0,0,.2); opacity:1 }
.ctl-pill-btn.porneste { opacity:1; color:inherit; background:rgba(127,127,127,.22) }
.ctl-pill-btn.porneste::before { content:""; width:11px; height:11px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:ctl-rot .8s linear infinite }
.ctl-pill-btn.porneste .ctl-bulina { display:none }
@keyframes ctl-rot { to { transform:rotate(360deg) } }
.ctl-alerta { background:var(--alerta-fund); border:1px solid var(--alerta-rama); color:var(--alerta-text); border-radius:12px; padding:10px 14px; font-size:14px; line-height:1.4 }
.ctl-alerta[data-fel="asteapta"] { background:var(--atentie-fund); border-color:var(--atentie-rama); color:var(--atentie-text) }
.ctl-acum { padding:16px 20px }
.ctl-info-boxe { font-size:12px; color:var(--soft); margin:8px 0 0 }
.ctl-info-boxe[data-ok="da"] { color:var(--bun) } .ctl-info-boxe[data-ok="nu"] { color:var(--atentie-text) }
.ctl-info-program { font-size:12px; color:var(--soft); margin:6px 0 0 }
.ctl-info-program[data-fel="eroare"] { color:var(--atentie-text) }
.ctl-info-ascultatori { font-size:13px; color:var(--ink); margin:8px 0 0; font-variant-numeric:tabular-nums }
.ctl-info-ascultatori[data-nimeni] { color:var(--soft) }
.ctl-acum[data-stare="live"] .ctl-info-titlu { color:var(--rau) }
.ctl-acum[data-stare="live"] .ctl-info-titlu::before { content:"● "; animation:ctl-puls 1.2s infinite }
.ctl-acum[data-stare="live"] .ctl-info-album { color:var(--ink); font-size:17px; font-weight:600; margin-top:6px }
.ctl-acum[data-stare="live"] .ctl-info-durata { font-family:inherit; font-size:13px; color:var(--soft); margin-top:6px }
.ctl-info-durata:empty { display:none }
.ctl-acum[data-stare="oprit"] .ctl-info-titlu { color:var(--faint); letter-spacing:.06em }
.ctl-acum[data-stare="tranzitie"] .ctl-info-titlu { color:var(--soft) }
.ctl-player { background:#0b0f14; color:#e5e7eb; border-radius:16px; border:1px solid var(--rule); padding:16px 18px 14px; display:flex; flex-direction:column; gap:10px }
.ctl-player-stare { margin:0; font-size:15px; min-height:1.4em; color:#cbd5e1; flex:1; min-width:0 }
.ctl-player-stare[data-stare="reda"] { color:#fff; font-weight:600 }
.ctl-player-stare[data-stare="reda"]::before { content:"● "; color:#22c55e }
.ctl-player-stare[data-stare="eroare"] { color:#fca5a5 }
.ctl-player-butoane { display:flex; gap:14px; align-items:center }
.ctl-player-butoane .btn-ps { flex:none }
.ctl-player-btn { font:inherit; font-size:16px; font-weight:600; padding:10px 26px; border-radius:999px; border:1px solid #334155; background:#fff; color:#0b0f14; cursor:pointer }
.ctl-player-btn[disabled] { opacity:.4; cursor:default }
.ctl-player-rad { margin:0; padding-top:4px; border-top:1px solid #1e293b }
.ctl-player-rad .rad-piesa { color:#fff; font-size:16px }
.ctl-player-rad .rad-album, .ctl-player-rad .rad-timp, .ctl-player-rad .rad-urmeaza { color:#94a3b8 }
.ctl-player-cifre { display:grid; grid-template-columns:auto 1fr; gap:2px 12px; font-size:12px; color:#94a3b8; margin:0; padding-top:4px; border-top:1px solid #1e293b }
.ctl-player-cifre dt { font-weight:600 } .ctl-player-cifre dd { margin:0 }
/* display:grid batea atributul hidden — panoul LIVE ramanea vizibil, cu liniute, pe radio */
.ctl-player-cifre[hidden] { display:none }
.ctl-legaturi { text-align:center; font-size:13px; margin:0 }
.ctl-legaturi a { color:inherit }
#bloc-radio { display:flex; flex-direction:column; gap:12px }
.ctl-card { background:var(--paper); border:1px solid var(--rule); border-radius:16px; box-shadow:0 1px 2px rgba(0,0,0,.05); overflow:hidden }
.ctl-info { padding:20px; text-align:center }
.ctl-info-titlu { font-size:18px; font-weight:600; line-height:1.3; color:var(--bun); margin:0; overflow-wrap:anywhere }
.ctl-info-album { font-size:14px; color:var(--soft); margin:4px 0 0; overflow-wrap:anywhere }
.ctl-info-durata { font-size:12px; font-family:ui-monospace,monospace; color:var(--faint); margin:4px 0 0; font-variant-numeric:tabular-nums }
.ctl-cap { width:100%; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 16px; border:0; background:rgba(127,127,127,.08); color:inherit; font:inherit; text-align:left; cursor:pointer }
.ctl-cap:hover { background:rgba(127,127,127,.14) }
.ctl-cap-st { display:flex; align-items:center; gap:8px; min-width:0 }
.ctl-cap-st svg { color:var(--soft) }
.ctl-cap-sageata svg { color:var(--faint); transition:transform .2s }
.ctl-cap[aria-expanded="true"] .ctl-cap-sageata svg { transform:rotate(180deg) }
.ctl-cap-mic { font-size:12px; color:var(--faint) }
.ctl-cap-rand { display:flex; align-items:stretch }
.ctl-cap-rand .ctl-cap { flex:1 }
.ctl-cap-unealta { display:flex; align-items:center; padding:0 16px; color:var(--soft); background:rgba(127,127,127,.08); border-left:1px solid var(--rule) }
.ctl-cap-unealta:hover { background:rgba(127,127,127,.14); color:inherit }
.ctl-cap-unealta svg { width:18px; height:18px }
.ctl-cap-unealta[hidden] { display:none }   /* display:flex ar bate atributul hidden */
.ctl-corp { border-top:1px solid var(--rule) }
.ctl-firimituri { display:flex; flex-wrap:wrap; align-items:center; gap:4px; padding:10px 16px; border-bottom:1px solid var(--rule); background:rgba(127,127,127,.06); font-size:14px }
.ctl-firimituri button { font:inherit; border:0; background:none; padding:0; color:var(--albastru); cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-weight:500 }
.ctl-firimituri button:hover { text-decoration:underline }
.ctl-firimituri .sep { color:var(--faint) }
.ctl-firimituri .aici { font-weight:500; overflow-wrap:anywhere }
.ctl-lista { list-style:none; margin:0; padding:0 }
.ctl-lista > li { border-bottom:1px solid rgba(127,127,127,.15) }
.ctl-lista > li:last-child { border-bottom:0 }
.ctl-rand { display:flex; align-items:center; gap:8px; padding:8px 12px }
.ctl-rand.activ { background:var(--verde-fund) }
.ctl-rand-btn { flex:1; display:flex; align-items:center; gap:12px; min-width:0; padding:4px 0; border:0; background:none; color:inherit; font:inherit; text-align:left; cursor:pointer }
.ctl-rand-btn .ico { flex:none; color:var(--faint) } .ctl-rand-btn .ico svg { width:24px; height:24px }
.ctl-rand.activ .ico, .ctl-rand.pe-cale .ico { color:var(--verde) }
.ctl-rand-nume { display:block; font-weight:500; line-height:1.25; overflow-wrap:anywhere }
.ctl-rand.activ .ctl-rand-nume { color:var(--verde-text) }
.ctl-rand-sub { display:block; font-size:12px; color:var(--faint); margin-top:2px }
.ctl-sel { flex:none; font:inherit; font-size:12px; font-weight:600; color:#fff; background:var(--albastru-btn); border:0; border-radius:8px; padding:8px 12px; cursor:pointer }
.ctl-sel:hover { background:var(--albastru-btn-hover) } .ctl-sel.activ { background:#16a34a } .ctl-sel.activ:hover { background:#15803d }
.ctl-subcap { padding:8px 16px; border-top:1px solid var(--rule); background:rgba(127,127,127,.06); font-size:12px; font-weight:600; color:var(--soft); text-transform:uppercase; letter-spacing:.04em }
.ctl-fisier { width:100%; display:flex; align-items:center; gap:12px; padding:12px; border:0; background:none; color:inherit; font:inherit; text-align:left; cursor:pointer }
.ctl-fisier:hover { background:rgba(127,127,127,.08) }
.ctl-fisier.curent { background:var(--verde-fund) }
.ctl-fisier .nr { flex:none; width:28px; text-align:right; font-size:12px; font-family:ui-monospace,monospace; color:var(--faint) }
.ctl-fisier.curent .nr { color:var(--bun); font-weight:700 }
.ctl-fisier .nume { flex:1; min-width:0; font-size:14px; line-height:1.25; overflow-wrap:anywhere }
.ctl-fisier.curent .nume { font-weight:600; color:var(--verde-text) }
.ctl-fisier .durata { flex:none; font-size:11px; font-family:ui-monospace,monospace; color:var(--faint); font-variant-numeric:tabular-nums }
.ctl-fisier .disc { flex:none; display:none; width:36px; height:36px; border-radius:50%; background:#16a34a; color:#fff; align-items:center; justify-content:center }
.ctl-fisier .disc svg { width:14px; height:14px; transform:translateX(1px) }
.ctl-fisier.curent .disc { display:inline-flex; animation:ctl-puls 2s infinite }
.ctl-fisier.start .disc { display:inline-flex }
@keyframes ctl-puls { 50% { opacity:.55 } }
.ctl-gol { padding:28px 16px; text-align:center; font-size:14px; color:var(--faint); font-style:italic; margin:0 }
.ctl-grup-cap { width:100%; display:flex; align-items:center; gap:8px; padding:10px 12px; border:0; background:none; color:inherit; font:inherit; text-align:left; cursor:pointer }
.ctl-grup-cap:hover { background:rgba(127,127,127,.06) }
.ctl-grup-cap .sag svg { width:12px; height:12px; color:var(--faint); transition:transform .2s }
.ctl-grup-cap[aria-expanded="true"] .sag svg { transform:rotate(90deg) }
.ctl-grup-cap .ico svg { color:var(--faint) }
.ctl-grup-nume { flex:1; min-width:0; font-size:14px; font-weight:500; overflow-wrap:anywhere }
.ctl-grup-cale { display:block; font-size:10px; font-family:ui-monospace,monospace; color:var(--faint); font-weight:400 }
.ctl-grup-nr { font-size:10px; font-family:ui-monospace,monospace; color:var(--faint) }
.ctl-grup-lista { list-style:none; margin:0; padding:0; background:rgba(127,127,127,.05); border-top:1px solid rgba(127,127,127,.15) }
.ctl-grup-lista li { border-bottom:1px solid rgba(127,127,127,.12) } .ctl-grup-lista li:last-child { border-bottom:0 }
.ctl-grup-lista .ctl-fisier { padding:8px 12px 8px 40px } .ctl-grup-lista .ctl-fisier .nr { width:36px; font-size:11px }
.ctl-grup-lista .ctl-fisier .disc { width:20px; height:20px } .ctl-grup-lista .ctl-fisier .disc svg { width:10px; height:10px }
.ctl-disc { padding:16px }
.ctl-disc-cap { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px }
.ctl-disc-cap h2 { font-size:14px } .ctl-disc-cap span { font-size:12px; color:var(--faint) }
.ctl-bara { position:relative; width:100%; height:10px; border-radius:999px; background:rgba(127,127,127,.25); overflow:hidden }
.ctl-bara-plin { position:absolute; left:0; top:0; height:100%; background:#3b82f6; transition:width .4s; width:0 }
.ctl-bara-plin.galben { background:#eab308 } .ctl-bara-plin.rosu { background:#ef4444 }
.ctl-tehnic { display:grid; grid-template-columns:minmax(120px,auto) 1fr; gap:6px 14px; margin:0; padding:12px 16px; font-size:13px }
.ctl-tehnic dt { font-weight:600; color:var(--soft) }
.ctl-tehnic dd { margin:0; font-family:ui-monospace,monospace; font-size:12px; overflow-wrap:anywhere; font-variant-numeric:tabular-nums }
.ctl-tehnic dd.rau { color:var(--rau) } .ctl-tehnic dd.bun { color:var(--bun) }
.ctl-subsol { text-align:center; font-size:11px; color:var(--faint); margin:8px 0 0 }
.ctl-eroare { margin:10px auto 0; max-width:520px; font-size:12px; color:var(--alerta-text); background:var(--alerta-fund); border:1px solid var(--alerta-rama); border-radius:8px; padding:6px 12px }
`

/**
 * Scriptul panoului. Ca și playerul, vorbește numai cu originea lui: `<prefix>/admin/…`.
 * ⚠️ Fără accente grave înăuntru (vezi nota din `player.ts`).
 */
export function jsPanou(prefix: string): string {
  return `
(() => {
  const P = ${JSON.stringify(prefix)};
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const ICO_FOLDER = ${JSON.stringify(ICO.folder)}, ICO_PLAY = ${JSON.stringify(ICO.play)}, ICO_CASA = ${JSON.stringify(ICO.casa)}, ICO_SAG = ${JSON.stringify(ICO.jos)};

  // ---- stare ----
  let S = null;                 // ultimul /admin/stare
  let INV = null;               // inventarul (fisiere in ordinea naturala)
  let semnaturaInv = null;
  // Tranzitia: ce a apasat omul, pana confirma serverul/aparatul. Cat tine, butoanele sunt blocate
  // si cartela arata „Pornesc…". Daca nu vine confirmarea in TRANZITIE_MS: eroare clara.
  let tranzitie = null;
  const TRANZITIE_MS = 20000;
  let eroareLocala = null;
  // Eticheta de pe buton (ce se aude), nu numele modului (ce se intampla cu directul): modul "stop"
  // scrie RADIO. Scriptul rescrie textul la fiecare tranzitie, deci si aici sta cuvantul nou.
  const ETICHETA = { live: "LIVE", stop: "RADIO", oprit: "OPRIT" };
  let ocupat = false;
  let caleCurenta = "";
  let grupuriDeschise = {};
  let piesaRef = null;
  const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem("xc.emisie." + k); localStorage.setItem("xc.emisie." + k, v); } catch (e) { return null; } };

  // ---- formatare ----
  const mmss = (s) => { if (!s || s <= 0) return ""; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; const p = (n) => String(n).padStart(2, "0"); return h > 0 ? h + ":" + p(m) + ":" + p(r) : p(m) + ":" + p(r); };
  const cand = (iso) => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }); };
  // „azi la 18:00" / „mâine la 08:00" / „duminică, 13 septembrie la 08:00"
  const candZi = (iso) => {
    if (!iso) return ""; const d = new Date(iso); if (isNaN(d)) return "";
    const azi = new Date(), maine = new Date(azi.getTime() + 86400000), z = (x) => x.toDateString();
    const zi = z(d) === z(azi) ? "azi" : z(d) === z(maine) ? "mâine" : d.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
    return zi + " la " + cand(iso);
  };
  const numeDin = (cale) => cale.split("/").pop();
  const parinteDin = (cale) => cale.includes("/") ? cale.slice(0, cale.lastIndexOf("/")) : "";

  // ---- inventar → arbore ----
  function directoare() {
    const d = new Map();
    for (const f of (INV ? INV.fisiere : [])) {
      const parti = f.cale.split("/"); parti.pop();
      let cale = "";
      for (let i = 0; i < parti.length; i++) {
        cale = cale ? cale + "/" + parti[i] : parti[i];
        let x = d.get(cale); if (!x) { x = { cale, nume: parti[i], nivel: i, direct: 0, total: 0 }; d.set(cale, x); }
        x.total++; if (i === parti.length - 1) x.direct++;
      }
    }
    return d;
  }
  // Radacina lui „Alege muzica" e PLATA: ce e in DIVERSE, direct, plus ALBUMELE din 01. Octoih /
  // 02. Triod / 03. Penticostar — fara nivelurile cu perioade liturgice („nu mai au sens").
  // Caile reale raman cele din depozit; doar ce se vede e altfel.
  const ASCUNSE = ["01. Octoih", "02. Triod", "03. Penticostar"];
  const eAscuns = (cale) => cale === "DIVERSE" || ASCUNSE.includes(cale) || (ASCUNSE.some((a) => cale.startsWith(a + "/")) && cale.split("/").length === 2);
  function subfoldere(cale) {
    const out = [];
    for (const d of directoare().values()) {
      if (cale === "") { if (parinteDin(d.cale) === "DIVERSE" || (ASCUNSE.some((a) => d.cale.startsWith(a + "/")) && d.direct > 0)) out.push(d); }
      else if (parinteDin(d.cale) === cale) out.push(d);
    }
    return out.sort((a, b) => a.nume.toLowerCase() < b.nume.toLowerCase() ? -1 : 1);
  }
  const parinteVizibil = (cale) => { const p = parinteDin(cale); return (!p || eAscuns(p)) ? "" : p; };
  function fisiereDirect(cale) { return (INV ? INV.fisiere : []).filter((f) => parinteDin(f.cale) === cale); }
  function pieseSub(dir) { const pre = dir + "/"; return (INV ? INV.fisiere : []).filter((f) => f.cale.startsWith(pre)); }

  // ---- stare efectiva ----
  // LIVE vine de la aparatul din biserica; radioul e al ceasului din Cloudflare.
  const eLive = () => !!(S && S.aparat && S.viu && S.aparat.stare === "live");
  // Radioul pornit are intaietate: cateva secunde dupa STOP aparatul inca raporteaza „live"
  // (primeste „oprit" cu intarziere, ca trecerea sa fie lina).
  const stareAparat = () => (S && S.radio && S.radio.pornit) ? "stop" : eLive() ? "live" : "oprit";
  function stareEfectiva() { return tranzitie ? tranzitie.tinta : stareAparat(); }
  function eroare(text) { eroareLocala = { text, panaLa: Date.now() + 15000 }; arata(); }
  function verificaTranzitia() {
    if (!tranzitie) return;
    if (stareAparat() === tranzitie.tinta) { tranzitie = null; return; }
    if (Date.now() > tranzitie.panaLa) {
      const tinta = tranzitie.tinta, real = stareAparat();
      tranzitie = null;
      eroare("Nu s-a confirmat " + ETICHETA[tinta] + " în 20 s — starea reală acum: " + ETICHETA[real] + ".");
    }
  }
  const directorActiv = () => (S && S.director) || "";
  function piesaCurenta() { const r = S && S.radio; return (r && r.pornit && r.cale) ? r : null; }

  // ---- randare ----
  function arata() {
    if (!S) return;
    verificaTranzitia();
    const s = stareEfectiva(), a = S.aparat, pot = !!S.pot_comanda && !ocupat && !tranzitie;

    // comutatorul: cel in tranzitie arata „Pornesc…"/„Opresc…" cu cerc
    for (const m of ["live", "stop", "oprit"]) {
      const b = document.querySelector('[data-mod="' + m + '"]');
      const inTranzitie = !!tranzitie && tranzitie.tinta === m;
      b.classList.toggle("activ", !tranzitie && s === m);
      b.classList.toggle("porneste", inTranzitie);
      b.querySelector(".ctl-pill-text").textContent = inTranzitie ? (m === "live" ? "Pornesc…" : "Opresc…") : ETICHETA[m];
      b.disabled = !pot || (m === "live" && !S.viu);
      // OPRIT (liniste de tot) doar pentru super-admin: radioul merge permanent, Parintele da mute.
      if (m === "oprit") b.hidden = !S.super_admin && s !== "oprit";
    }

    // LEGATURA cu aparatul: rupta (nicio veste de peste un minut si ceva) sau in urma cu comenzile.
    const al = $("alerta-legatura");
    const inUrma = a && S.viu && S.comanda_versiune !== undefined && a.comanda_versiune < S.comanda_versiune
      && S.comanda_la && (Date.now() - Date.parse(S.comanda_la)) > 8000;
    if (a && !S.viu) {
      const min = Math.round((Date.now() - Date.parse(a.la)) / 60000);
      al.hidden = false; al.dataset.fel = "rupta";
      al.textContent = "S-a rupt legătura cu aparatul din biserică (ultima veste " + cand(a.la) + (min >= 1 ? ", acum " + min + " min" : "") + "). "
        + "Aparatul merge singur cu ce știe: " + (a.stare === "live" ? "înregistrează slujba" + (a.live_limita_la ? " și trece singur pe radio la " + cand(a.live_limita_la) : "") : a.stare === "radio" ? "cântă radio în boxe din melodiile de pe el" : "e oprit") + ". "
        + "Comenzile date acum ajung la el abia când revine internetul la biserică.";
    } else if (inUrma) {
      al.hidden = false; al.dataset.fel = "asteapta";
      al.textContent = "Aparatul din biserică n-a primit încă ultima comandă (are v" + a.comanda_versiune + ", aici e v" + S.comanda_versiune + ") — o primește la următoarea legătură.";
    } else al.hidden = true;

    // cartela de stare — mereu vizibila
    const p = piesaCurenta();
    const bl = $("bloc-acum");
    let titlu, sub = "", durata = "", rec = "";
    if (tranzitie) {
      bl.dataset.stare = "tranzitie";
      titlu = tranzitie.mesaj; sub = tranzitie.tinta === "live" ? "Aparatul din biserică pornește emisia și înregistrarea (câteva secunde)." : "Aștept confirmarea…";
    } else if (s === "live") {
      bl.dataset.stare = "live";
      // titlu scurt; randul 2 = „[ora] – Slujba” (negru, mare); randul 3 = nota + REC.
      titlu = "ÎN DIRECT";
      const ora = a && a.activ_de_la ? cand(a.activ_de_la) : "", nume = a && a.slujba && a.slujba.nume ? a.slujba.nume : "";
      sub = [ora, nume].filter(Boolean).join(" – ");
      const r = a && a.inregistrare;
      durata = a && a.live_limita_la ? "Notă: trece singur pe radio la " + cand(a.live_limita_la) : "";
      rec = r ? "REC: " + r.fisier + " · " + (r.octeti / 1e6).toFixed(1) + " MB" : "";
    } else if (s === "stop") {
      bl.dataset.stare = "radio";
      const caleInfo = p ? p.cale : (S.selectie && S.selectie.fisier_start) || directorActiv();
      const idx = caleInfo.lastIndexOf("/");
      titlu = idx >= 0 ? caleInfo.slice(idx + 1) : caleInfo;
      const dir = idx >= 0 ? caleInfo.slice(0, idx) : "";
      sub = "RADIO" + (p ? " · piesa " + (p.index + 1) + " din " + p.total : "") + (dir ? " · " + dir.split("/").pop() : "");
      const f = INV && INV.fisiere.find((x) => x.cale === caleInfo);
      const total = p ? p.durata : (f ? f.durata : 0);
      durata = total ? (p ? mmss(secundaAcum(p)) + " / " : "") + mmss(total) : "";
    } else {
      bl.dataset.stare = "oprit";
      titlu = "OPRIT"; sub = "Nu se transmite nimic — ascultătorii nu aud nimic.";
    }
    $("acum-titlu").textContent = titlu; $("acum-sub").textContent = sub; $("acum-durata").textContent = durata; $("acum-rec").textContent = rec;

    // BOXELE bisericii: aparatul reda local aceeasi piesa; aratam daca tine pasul cu ceasul.
    const bx = $("acum-boxe");
    if (s === "stop" && !tranzitie) {
      bx.hidden = false;
      if (!a || !S.viu) { bx.dataset.ok = "nu"; bx.textContent = "Boxele din biserică: aparatul nu răspunde — se aude doar pe internet."; }
      else if (a.stare !== "radio" || !a.piesa) { bx.dataset.ok = "nu"; bx.textContent = "Boxele din biserică: " + (a.ultima_eroare ? "eroare — " + a.ultima_eroare : "pornesc…"); }
      else {
        const varsta = (Date.now() - Date.parse(a.la)) / 1000;
        const dif = p ? Math.abs((a.piesa.secunda + varsta) - secundaAcum(p)) : null;
        const aceeasi = p && a.piesa.cale === p.cale;
        bx.dataset.ok = aceeasi && dif !== null && dif < 3 ? "da" : "nu";
        bx.textContent = "Boxele din biserică: " + (aceeasi ? "aceeași piesă" + (dif !== null ? ", diferență " + dif.toFixed(1) + " s" : "") : "altă piesă (" + a.piesa.cale.split("/").pop() + ")");
      }
    } else bx.hidden = true;

    // PROGRAMUL de pe aparat: cand porneste singur LIVE (hotararea e a aparatului, nu a workerului).
    const pg = $("acum-program"), pr = a && S.viu ? a.program : null;
    if (pr && pr.activ && s !== "live" && !tranzitie) {
      pg.hidden = false; pg.dataset.fel = "";
      const u = pr.urmatoarea;
      if (u && !u.pornita) pg.textContent = "LIVE pornește singur " + candZi(u.la) + " — " + u.nume + " (programul slujbelor de pe aparat).";
      else if (pr.slujbe) pg.textContent = "Nicio slujbă transmisă în programul de pe aparat" + (pr.interval ? " (până la " + pr.interval[1].split("-").reverse().slice(0, 2).join(".") + ")" : "") + ".";
      else { pg.dataset.fel = "eroare"; pg.textContent = "Programul slujbelor nu e încă pe aparat" + (pr.eroare ? " — " + pr.eroare : "") + "."; }
      if (pr.eroare && pr.slujbe) pg.textContent += " Copia e veche (" + (pr.sincronizat_la ? "din " + cand(pr.sincronizat_la) : "?") + "): " + pr.eroare + ".";
    } else pg.hidden = true;

    // CATI ASCULTA ACUM: paginile cu play apasat, batute in ultimul minut si jumatate.
    const asc = $("acum-ascultatori"), n = S.ascultatori;
    if (asc && n) {
      asc.hidden = false;
      if (!n.total) { asc.dataset.nimeni = "1"; asc.textContent = "Nu ascultă nimeni acum."; }
      else {
        delete asc.dataset.nimeni;
        const parti = [];
        if (n.live) parti.push(n.live + " în direct");
        if (n.radio) parti.push(n.radio + " la radio");
        asc.textContent = "Ascultă acum: " + n.total + (n.total === 1 ? " persoană" : " persoane") + (parti.length > 1 ? " (" + parti.join(", ") + ")" : "") + (n.telefoane ? " · " + n.telefoane + " pe telefon" : "");
      }
    } else if (asc) asc.hidden = true;

    // cartelele radioului (Alege muzica, Selectia) — doar cand radioul e cel care canta
    $("bloc-radio").hidden = s !== "stop";

    // eroarea (a paginii sau a aparatului) — in cartela de stare
    if (eroareLocala && Date.now() > eroareLocala.panaLa) eroareLocala = null;
    const textEroare = eroareLocala ? eroareLocala.text : (s === "live" && a && a.ultima_eroare) ? "Eroare: " + a.ultima_eroare : null;
    $("eroare").hidden = !textEroare; if (textEroare) $("eroare").textContent = textEroare;

    // disc
    $("card-disc").hidden = !(a && a.disc && S.viu);
    if (a && a.disc && S.viu) {
      const folosit = Math.max(0, a.disc.total_gb - a.disc.liber_gb), pc = a.disc.total_gb ? Math.round(folosit / a.disc.total_gb * 100) : 0;
      $("disc-text").textContent = folosit.toFixed(1) + " / " + a.disc.total_gb + " GB";
      const b = $("disc-bara"); b.style.width = pc + "%"; b.className = "ctl-bara-plin" + (pc >= 95 ? " rosu" : pc >= 80 ? " galben" : "");
    }
    $("subsol-aparat").textContent = (S.biblioteca ? "Bibliotecă: " + S.biblioteca.fisiere + " piese, " + Math.round(oreBiblioteca()) + " ore, din depozit" : "") + (a && S.viu ? " · aparat: " + a.aparat : "");
    $("legaturi").hidden = !S.super_admin; $("leg-biblioteca").hidden = !S.super_admin;
    try { tehnic(); } catch (e) { if (window.__player) window.__player.raporteaza("tehnic", { mesaj: e.message }); }

    marcheaza();
  }

  // ---- detalii tehnice: telemetria aparatului + canalul din SFU ----
  function tehnic() {
    const a = S.aparat, d = S.direct || {};
    const varsta = a && a.la ? Math.round((Date.now() - Date.parse(a.la)) / 1000) : null;
    const mb = (o) => (o / 1e6).toFixed(1) + " MB";
    const r = [];
    const rand = (k, v, cls) => { if (v !== undefined && v !== null && v !== "") r.push([k, String(v), cls || ""]); };
    rand("Aparat", a ? a.aparat : "nu s-a anunțat încă", a ? "" : "rau");
    if (a) {
      rand("Ultima veste", (varsta !== null ? "acum " + varsta + " s" : "?") + " · " + cand(a.la), S.viu ? "bun" : "rau");
      rand("Stare aparat", a.stare + (a.activ_de_la ? " din " + cand(a.activ_de_la) : "") + (a.motiv ? " · motiv: " + ({ comanda: "comandă", limita: "limita de ore", program: "programul slujbelor", implicit: "radio implicit", reluare: "reluare la pornire" }[a.motiv] || a.motiv) : ""));
      if (a.slujba) rand("Slujba (din program)", a.slujba.nume + " · " + a.slujba.data + " " + a.slujba.ora + " · " + a.slujba.id);
      if (a.live_limita_la) rand("Limita LIVE", "trece singur pe radio la " + cand(a.live_limita_la));
      if (a.decizie) rand("Decizie proprie", a.decizie.stare + " (" + a.decizie.motiv + (a.decizie.slujba ? ": " + a.decizie.slujba.nume : "") + ") la " + cand(a.decizie.la) + " — nepreluată încă", "rau");
      const pr = a.program;
      if (pr) rand("Program (pe aparat)", !pr.activ ? "oprit din configurație"
        : (pr.slujbe + " slujbe, " + pr.transmise + " transmise" + (pr.interval ? " (" + pr.interval[0] + " → " + pr.interval[1] + ")" : "")
          + (pr.sincronizat_la ? " · sincronizat " + cand(pr.sincronizat_la) : " · nesincronizat încă")
          + (pr.urmatoarea ? " · urmează: " + pr.urmatoarea.nume + " " + candZi(pr.urmatoarea.la) + (pr.urmatoarea.pornita ? " (pornită)" : "") : " · nimic de pornit")
          + (pr.eroare ? " · " + pr.eroare : "")), pr.eroare ? "rau" : pr.slujbe ? "bun" : "");
      else rand("Program (pe aparat)", "nu e în telemetrie (cod vechi pe aparat)", "rau");
      rand("Comandă", "v" + a.comanda_versiune + (S.comanda_versiune !== undefined && S.comanda_versiune !== a.comanda_versiune ? " (aici: v" + S.comanda_versiune + ")" : "") + (S.comanda_de ? " · de la " + S.comanda_de : ""), S.comanda_versiune !== undefined && S.comanda_versiune !== a.comanda_versiune ? "rau" : "");
      if (a.legatura && a.legatura.ok !== null && a.legatura.ok !== undefined) rand("Legătura (văzută de aparat)", (a.legatura.ok ? "bună" : "RUPTĂ") + (a.legatura.de ? " din " + cand(a.legatura.de) : ""), a.legatura.ok ? "bun" : "rau");
      rand("Sursa LIVE", a.sursa_live);
      rand("Procese", Object.keys(a.pid || {}).length ? Object.entries(a.pid).map(([k, v]) => k + " " + v).join(", ") : "niciunul");
      if (a.progres_s !== null && a.progres_s !== undefined) rand("Progres ffmpeg", mmss(a.progres_s));
      if (a.inregistrare) rand("Înregistrare", a.inregistrare.fisier + " · " + mb(a.inregistrare.octeti));
      if (a.piesa) rand("Piesa în boxe", a.piesa.cale.split("/").pop() + " @ " + mmss(a.piesa.secunda));
      if (a.disc) rand("Disc", a.disc.liber_gb + " GB liberi din " + a.disc.total_gb + " GB");
      const mic = a.microfon;
      rand("Microfon (aparat)", !mic ? "nu e în telemetrie (cod vechi)" : mic.activ ? "emite" + (mic.pid ? ", pid " + mic.pid : "") + (mic.de ? ", din " + cand(mic.de) : "") : mic.oprit ? "oprit din configurație" : "nu emite" + (mic.eroare ? " — " + mic.eroare : ""), !mic ? "" : mic.activ ? "bun" : mic.oprit ? "" : "rau");
      rand("Ultimul mesaj", a.ultimul_mesaj);
      rand("Ultima eroare", a.ultima_eroare, a.ultima_eroare ? "rau" : "");
      rand("Aparat → server", a.worker_eroare, a.worker_eroare ? "rau" : "");
    }
    rand("SFU · direct", d.configurat === false ? "neconfigurat" : d.direct ? "activ" + (d.de ? " din " + cand(d.de) : "") : "inactiv" + (d.sfu ? " (" + d.sfu + ")" : ""), d.direct ? "bun" : "");
    rand("Radio (ceasul)", S.radio && S.radio.pornit ? "pornit, v" + S.radio.versiune + (S.selectie && S.selectie.de ? " din " + cand(S.selectie.de) : "") : "oprit");
    const pl = window.__player;
    rand("Player (pagina)", pl && typeof pl.sursa === "function" ? (pl.activ() ? "ascult: " + (pl.sursa() || "se leagă") : "oprit") : "-");
    const dl = $("tehnic-lista"); dl.innerHTML = "";
    for (const [k, v, cls] of r) { dl.appendChild(el("dt", "", k)); dl.appendChild(el("dd", cls, v)); }
    $("tehnic-rezumat").textContent = (a && S.viu ? "aparat legat" : "aparat nelegat") + " · SFU " + (d.direct ? "activ" : "inactiv");
  }

  function secundaAcum(p) {
    // Extrapolam secunda din piesa intre doua citiri, ca pagina sa nu para inghetata.
    if (!piesaRef || piesaRef.cale !== p.cale || Math.abs(piesaRef.secunda - p.secunda) > 4) piesaRef = { cale: p.cale, secunda: p.secunda, la: Date.now() };
    return piesaRef.secunda + (Date.now() - piesaRef.la) / 1000;
  }

  function marcheaza() {
    const p = piesaCurenta(), tc = p ? p.cale : "", fs = (S && S.selectie && S.selectie.fisier_start) || "", da = directorActiv();
    for (const li of $("fisiere").children) { const b = li.firstElementChild; b.classList.toggle("curent", !!tc && b.dataset.cale === tc); b.classList.toggle("start", !tc && !!fs && b.dataset.cale === fs); }
    for (const li of $("subfoldere").children) { const r = li.firstElementChild; r.classList.toggle("activ", r.dataset.cale === da); r.classList.toggle("pe-cale", !!da && (da + "/").startsWith(r.dataset.cale + "/")); const sel = r.querySelector(".ctl-sel"); if (sel) sel.classList.toggle("activ", r.dataset.cale === da); }
    for (const b of $("grupuri").querySelectorAll(".ctl-fisier")) b.classList.toggle("curent", !!tc && b.dataset.cale === tc);
  }

  // „Alege muzica"
  function navigheaza(cale) {
    caleCurenta = cale || "";
    const fir = $("firimituri"); fir.innerHTML = "";
    const acasa = el("button"); acasa.type = "button"; acasa.innerHTML = ICO_CASA + "<span>Muzica</span>"; acasa.addEventListener("click", () => navigheaza("")); fir.appendChild(acasa);
    const lant = []; for (let x = caleCurenta; x; x = parinteVizibil(x)) lant.unshift(x);
    lant.forEach((x, i) => {
      fir.appendChild(el("span", "sep", "/"));
      if (i === lant.length - 1) fir.appendChild(el("span", "aici", numeDin(x)));
      else { const b = el("button", "", numeDin(x)); b.type = "button"; b.addEventListener("click", () => navigheaza(x)); fir.appendChild(b); }
    });

    const sub = subfoldere(caleCurenta), fis = fisiereDirect(caleCurenta);
    const ul = $("subfoldere"); ul.innerHTML = "";
    for (const d of sub) {
      const li = el("li"), r = el("div", "ctl-rand"); r.dataset.cale = d.cale;
      const b = el("button", "ctl-rand-btn"); b.type = "button";
      b.innerHTML = '<span class="ico">' + ICO_FOLDER + '</span><span style="min-width:0;flex:1"><span class="ctl-rand-nume"></span><span class="ctl-rand-sub"></span></span>';
      b.querySelector(".ctl-rand-nume").textContent = d.nume;
      b.querySelector(".ctl-rand-sub").textContent = d.total === 0 ? "gol" : d.total === 1 ? "1 fișier audio" : d.total + " fișiere audio";
      b.addEventListener("click", () => navigheaza(d.cale));
      r.appendChild(b);
      if (d.total > 0) { const sel = el("button", "ctl-sel", "Selectează"); sel.type = "button"; sel.addEventListener("click", () => selecteazaDirector(d.cale)); r.appendChild(sel); }
      li.appendChild(r); ul.appendChild(li);
    }
    const gol = $("alege-gol"); gol.hidden = !(sub.length === 0 && fis.length === 0);
    gol.textContent = caleCurenta ? "Nu sunt albume sau fișiere aici." : (INV ? "Niciun album cu fișiere audio." : "Se încarcă…");

    $("bloc-fisiere").hidden = fis.length === 0; $("nr-fisiere").textContent = fis.length;
    const uf = $("fisiere"); uf.innerHTML = "";
    fis.forEach((f, i) => {
      const li = el("li"), b = el("button", "ctl-fisier"); b.type = "button"; b.dataset.cale = f.cale;
      b.innerHTML = '<span class="nr"></span><span class="nume"></span><span class="durata"></span><span class="disc">' + ICO_PLAY + '</span>';
      b.querySelector(".nr").textContent = String(i + 1).padStart(2, "0") + ".";
      b.querySelector(".nume").textContent = numeDin(f.cale);
      b.querySelector(".durata").textContent = mmss(f.durata);
      b.addEventListener("click", () => selecteazaPiesa(f.cale, parinteDin(f.cale)));
      li.appendChild(b); uf.appendChild(li);
    });
    marcheaza();
  }

  // „Selecția" — playlistul directorului activ, pe directoare
  function arataSelectia() {
    const da = directorActiv(), piese = da ? pieseSub(da) : [];
    const ul = $("grupuri"); ul.innerHTML = "";
    $("selectia-gol").hidden = piese.length > 0;
    const grupuri = new Map();
    piese.forEach((f, i) => { const g = parinteDin(f.cale); if (!grupuri.has(g)) grupuri.set(g, []); grupuri.get(g).push({ ...f, pozitie: i + 1 }); });
    $("selectia-rezumat").textContent = piese.length ? "(" + grupuri.size + (grupuri.size === 1 ? " director, " : " directoare, ") + piese.length + (piese.length === 1 ? " fișier)" : " fișiere)") : "";
    const tc = piesaCurenta() ? piesaCurenta().cale : "";
    let idx = 0;
    for (const [g, lista] of grupuri) {
      const k = String(idx++);
      if (grupuriDeschise[k] === undefined) grupuriDeschise[k] = lista.some((m) => m.cale === tc);
      const li = el("li");
      const cap = el("button", "ctl-grup-cap"); cap.type = "button"; cap.setAttribute("aria-expanded", grupuriDeschise[k] ? "true" : "false");
      cap.innerHTML = '<span class="sag">' + ICO_SAG + '</span><span class="ico">' + ICO_FOLDER + '</span><span class="ctl-grup-nume"><span class="n"></span><span class="ctl-grup-cale"></span></span><span class="ctl-grup-nr"></span>';
      cap.querySelector(".n").textContent = g.split("/").pop();
      cap.querySelector(".ctl-grup-cale").textContent = g.includes("/") ? g : "";
      cap.querySelector(".ctl-grup-nr").textContent = lista.length;
      const sub = el("ul", "ctl-grup-lista"); sub.hidden = !grupuriDeschise[k];
      cap.addEventListener("click", () => { grupuriDeschise[k] = !grupuriDeschise[k]; sub.hidden = !grupuriDeschise[k]; cap.setAttribute("aria-expanded", grupuriDeschise[k] ? "true" : "false"); });
      for (const m of lista) {
        const l2 = el("li"), b = el("button", "ctl-fisier"); b.type = "button"; b.dataset.cale = m.cale;
        b.innerHTML = '<span class="nr"></span><span class="nume"></span><span class="durata"></span><span class="disc">' + ICO_PLAY + '</span>';
        b.querySelector(".nr").textContent = m.pozitie + ".";
        b.querySelector(".nume").textContent = numeDin(m.cale);
        b.querySelector(".durata").textContent = mmss(m.durata);
        b.addEventListener("click", () => continuaDeLa(m.cale));
        l2.appendChild(b); sub.appendChild(l2);
      }
      li.appendChild(cap); li.appendChild(sub); ul.appendChild(li);
    }
    marcheaza();
  }

  // ---- cartele pliabile (Alege muzica si Selectia se exclud) ----
  function deschide(id, da) {
    const card = $("card-" + id), cap = card.querySelector(".ctl-cap"), corp = card.querySelector(".ctl-corp");
    corp.hidden = !da; cap.setAttribute("aria-expanded", da ? "true" : "false");
    if (id === "alege" || id === "selectia" || id === "tehnic") pref(id, da ? "1" : "0");
    if (da && id === "alege") deschide("selectia", false);
    if (da && id === "selectia") { deschide("alege", false); arataSelectia(); }
  }
  for (const cap of document.querySelectorAll(".ctl-cap")) cap.addEventListener("click", () => deschide(cap.dataset.cap, cap.getAttribute("aria-expanded") !== "true"));

  // ---- actiuni ----
  function porneste(tinta, mesaj) { tranzitie = { tinta, mesaj, panaLa: Date.now() + TRANZITIE_MS }; eroareLocala = null; arata(); }
  function oreBiblioteca() { return INV ? INV.fisiere.reduce((t, f) => t + f.durata, 0) / 3600 : 0; }
  async function comanda(corp) {
    if (ocupat) return; ocupat = true;
    try {
      const r = await fetch(P + "/admin/comanda", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corp) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { tranzitie = null; eroare("Comanda a fost refuzată: " + (j.motiv || r.status)); }
    } catch (e) { tranzitie = null; eroare("Comanda nu a ajuns la server: " + e.message); if (window.__player) window.__player.raporteaza("comanda", { mesaj: e.message, actiune: corp.actiune }); }
    ocupat = false; citeste();
  }
  function apasaToggle(tinta) {
    const s = stareEfectiva();
    // Al doilea tap pe butonul activ NU face nimic (pe aparatul vechi insemna STOP — gest invizibil).
    if (tinta === s || tranzitie) return;
    if (tinta === "oprit") {
      if (s === "live" && !confirm("Oprești transmisiunea în direct din biserică?")) return;
      porneste("oprit", "Opresc…"); comanda({ actiune: "oprit" });
    } else if (tinta === "stop") {
      if (s === "live" && !confirm("Oprești transmisiunea în direct din biserică?")) return;
      // Deblocam sunetul chiar in gestul de apasare (iPhone-ul nu lasa play() mai tarziu), apoi
      // pornim playerul de indata ce serverul a pornit radioul.
      if (window.__player) window.__player.deblocheaza();
      porneste("stop", "Opresc directul…");
      comanda({ actiune: "stop" }).then(() => { if (window.__player && !window.__player.activ()) window.__player.porneste(); });
    } else if (tinta === "live") { porneste("live", "Pornesc LIVE…"); comanda({ actiune: "live" }); }
  }
  function selecteazaDirector(cale) { if (tranzitie) return; porneste("stop", "Pornesc radioul…"); navigheaza(cale); grupuriDeschise = {}; deschide("selectia", true); comanda({ actiune: "director", director: cale }); }
  function selecteazaPiesa(cale, dir) { if (tranzitie) return; porneste("stop", "Pornesc radioul…"); navigheaza(dir); grupuriDeschise = {}; deschide("selectia", true); comanda({ actiune: "piesa", fisier: cale, director: dir }); }
  function continuaDeLa(cale) { if (tranzitie) return; porneste("stop", "Continui de la " + numeDin(cale) + "…"); comanda({ actiune: "piesa", fisier: cale }); }
  for (const m of ["live", "stop", "oprit"]) document.querySelector('[data-mod="' + m + '"]').addEventListener("click", () => apasaToggle(m));

  // ---- citire ----
  let directorRandat = null;
  async function citeste() {
    let s;
    try {
      const r = await fetch(P + "/admin/stare", { cache: "no-store" });
      if (r.status === 401 || r.status === 303) { location.reload(); return; }
      s = await r.json();
    } catch (e) { eroare("Nu pot citi starea: " + e.message); if (window.__player) window.__player.raporteaza("panou-stare", { mesaj: e.message }); return; }
    S = s;
    if (s.biblioteca && s.biblioteca.semnatura !== semnaturaInv) {
      try { INV = await (await fetch(P + "/admin/inventar", { cache: "no-store" })).json(); semnaturaInv = s.biblioteca.semnatura; navigheaza(caleCurenta); directorRandat = null; } catch (e) {}
    }
    if (directorActiv() !== directorRandat) { directorRandat = directorActiv(); grupuriDeschise = {}; if (!$("card-selectia").querySelector(".ctl-corp").hidden) arataSelectia(); }
    arata();
  }

  // pornire: preferintele de pliere (implicit strans)
  if (pref("alege") === "1") deschide("alege", true);
  if (pref("selectia") === "1") deschide("selectia", true);
  if (pref("tehnic") === "1") deschide("tehnic", true);
  navigheaza("");
  citeste();
  // La 5 s: fiecare citire atinge mai multe obiecte durabile, iar pagina asta sta deschisa ore
  // intregi. Ceasul de 1 s de mai jos misca doar ce se socoteste local (secunda piesei), deci
  // pagina pare la fel de vie. Comenzile cer o citire pe loc oricum.
  setInterval(citeste, 5000);
  setInterval(() => { if (piesaCurenta() || tranzitie || eroareLocala) arata(); }, 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") citeste(); });
})();
`
}
