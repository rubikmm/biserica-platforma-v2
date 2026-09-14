import { butonPlayStop } from '@xc/comanda'

/**
 * MICROFONUL din biserică — pagina cea mai strânsă din toată emisia.
 *
 * Cererea utilizatorului (6.09.2026): „se aude ce se aude în microfoanele de la biserică, TOT
 * TIMPUL". Aparatul emite neîntrerupt al doilea canal WHIP (pista „mic" în SFU), indiferent dacă
 * parohia e pe LIVE, pe radio sau oprită.
 *
 * ⚠️ De aceea poarta e **super-administrator**, nu administrator: când Părintele trece pe radio ca
 * să spovedească, publicul aude muzică — dar aici se aude în continuare biserica. Dacă cineva
 * slăbește vreodată poarta asta la „admin", spovedania ajunge la mai multe urechi decât trebuie.
 *
 * Semnalizarea e a lui `live` (acolo stau canalele SFU); pagina o cere prin aplicația noastră, care
 * o trimite mai departe prin Service Binding.
 */

export function corpMic(): string {
  return `<h1 class="direct-titlu">Microfonul din biserică</h1>
<p class="direct-stare" id="stare" data-stare="necunoscut">Verific microfonul…</p>
<div class="direct-butoane">
  ${butonPlayStop('direct-btn')}
</div>
<audio id="audio" playsinline></audio>
<dl class="mic-cifre" id="cifre" hidden>
  <dt>Emite de la</dt><dd id="c-de">–</dd>
  <dt>Legătura</dt><dd id="c-legatura">–</dd>
  <dt>Debit</dt><dd id="c-debit">–</dd>
  <dt>Pachete pierdute</dt><dd id="c-pierdute">–</dd>
  <dt>Jitter</dt><dd id="c-jitter">–</dd>
  <dt>Ascult de</dt><dd id="c-durata">–</dd>
</dl>
<p class="marunt">Se aude ce intră în microfoanele bisericii, indiferent ce transmite parohia
(direct, radio sau nimic). Pagina e doar pentru super-administratori: când Părintele trece pe
radio, publicul nu mai aude biserica — aici se aude în continuare.</p>`
}

export const STIL_MIC = `
.direct-titlu { margin:8px 0 12px }
.mic-cifre { display:grid; grid-template-columns:auto 1fr; gap:4px 16px; font-size:14px; color:var(--soft);
  border-left:3px solid var(--rule); padding-left:16px; margin:0 0 24px }
.mic-cifre dt { font-weight:600 } .mic-cifre dd { margin:0 }
.mic-cifre[hidden] { display:none }   /* display:grid ar bate atributul hidden */
.marunt { font-size:14px; color:var(--faint) }
`

/** ⚠️ Fără accente grave înăuntru (vezi nota din `@xc/comanda/player.ts`). */
export function jsMic(prefix: string): string {
  return `
(() => {
  const P = ${JSON.stringify(prefix)};
  const $ = (id) => document.getElementById(id);
  const stare = $("stare"), btn = $("asculta"), cifre = $("cifre"), au = $("audio");
  const cifra = (id, text) => { const e = $(id); if (e) e.textContent = text; };
  // Un singur buton: triunghi cat sta, patrat cat canta.
  function buton(mod, aprins) {
    btn.dataset.mod = mod; btn.disabled = !aprins;
    const nume = mod === "stop" ? "Oprește" : "Ascultă";
    btn.setAttribute("aria-label", nume); btn.setAttribute("title", nume);
  }
  let vreau = false, blocat = false, pc = null, deCurent = null, legand = false, sunet = false, statTimer = null, pornit = null, citind = false;
  let ultima = null;

  function spune(text, cod) { stare.textContent = text; stare.dataset.stare = cod; }
  function fmt(n, u) { return (Math.round(n * 10) / 10) + " " + u; }
  const oraDin = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }); };

  async function leaga(de) {
    if (legand || pc) return; legand = true; sunet = false;
    try {
      const r = await fetch(P + "/mic/asculta", { method: "POST" });
      if (r.status === 401 || r.status === 303 || r.status === 403) { location.reload(); return; }
      if (!r.ok) { const j = await r.json().catch(() => ({})); spune("Nu mă pot lega: " + (j.motiv || r.status), "eroare"); legand = false; return; }
      const { sessionId, offer } = await r.json();
      deCurent = de || null;
      const p = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }], bundlePolicy: "max-bundle" });
      pc = p;
      p.ontrack = (ev) => {
        au.srcObject = ev.streams[0] || new MediaStream([ev.track]);
        au.play().catch(() => { blocat = true; spune("Apasă play ca să pornească sunetul.", "gata"); buton("play", true); });
        if (!ev.track.muted) areSunet(p); else ev.track.onunmute = () => areSunet(p);
      };
      p.onconnectionstatechange = () => {
        if (pc !== p) return;
        cifra("c-legatura", p.connectionState);
        if (["failed", "disconnected", "closed"].includes(p.connectionState)) { inchide(); spune("Legătura s-a rupt — reîncerc…", "eroare"); }
      };
      await p.setRemoteDescription(offer);
      const ans = await p.createAnswer();
      await p.setLocalDescription(ans);
      const r2 = await fetch(P + "/mic/asculta/" + sessionId, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ answer: p.localDescription }) });
      if (!r2.ok) { const j = await r2.json().catch(() => ({})); spune("Semnalizarea a eșuat: " + (j.motiv || r2.status), "eroare"); inchide(); }
      else statTimer = setInterval(() => cifreNoi(p), 2000);
    } catch (e) { spune("Eroare: " + e.message + " — reîncerc…", "eroare"); inchide(); }
    legand = false;
  }
  function areSunet(p) {
    if (pc !== p || sunet) return;
    sunet = true; pornit = Date.now(); if (blocat) { blocat = false; buton("stop", true); }
    spune("Microfonul bisericii" + (deCurent ? " — emite de la " + oraDin(deCurent) : ""), "reda");
    cifre.hidden = false; cifra("c-de", deCurent ? oraDin(deCurent) : "–");
  }
  let bytesAnt = 0, tAnt = 0;
  async function cifreNoi(p) {
    if (pc !== p) return;
    const st = await p.getStats();
    st.forEach((s) => {
      if (s.type === "inbound-rtp" && s.kind === "audio") {
        if ((s.packetsReceived || 0) > 5) areSunet(p);
        const t = Date.now();
        if (tAnt) cifra("c-debit", fmt((s.bytesReceived - bytesAnt) * 8 / (t - tAnt), "kbps"));
        bytesAnt = s.bytesReceived; tAnt = t;
        cifra("c-pierdute", (s.packetsLost || 0) + " / " + (s.packetsReceived || 0));
        cifra("c-jitter", fmt((s.jitter || 0) * 1000, "ms"));
      }
    });
    if (pornit) { const sec = Math.round((Date.now() - pornit) / 1000); cifra("c-durata", Math.floor(sec / 60) + " min " + (sec % 60) + " s"); }
  }
  function inchide() {
    if (statTimer) clearInterval(statTimer); statTimer = null;
    if (pc) { try { pc.close(); } catch (e) {} } pc = null; sunet = false; pornit = null; bytesAnt = 0; tAnt = 0;
    au.srcObject = null; cifre.hidden = true;
  }

  async function citeste() {
    if (citind) return; citind = true;
    let s = null;
    try {
      const r = await fetch(P + "/mic/stare", { cache: "no-store" });
      if (r.status === 401 || r.status === 303 || r.status === 403) { location.reload(); return; }
      s = await r.json();
    } catch (e) { if (!ultima) spune("Nu pot verifica microfonul (" + e.message + ")", "eroare"); }
    citind = false;
    if (!s) return;
    ultima = s;
    if (!vreau) {
      if (s.configurat === false) { spune("Transmisiunea nu e configurată (lipsesc cheile SFU).", "neconfigurat"); buton("play", false); }
      else if (s.direct) { spune("Microfonul emite — apasă play.", "gata"); buton("play", true); }
      else { spune("Microfonul nu emite acum (aparatul din biserică nu trimite nimic).", "liber"); buton("play", false); }
      return;
    }
    buton(blocat ? "play" : "stop", true);
    if (!s.direct) {
      if (pc) inchide();
      spune("Microfonul nu emite acum — aștept să reînceapă…", "liber");
      return;
    }
    const de = s.de || null;
    if (pc && de === deCurent) return;
    if (pc) { inchide(); spune("Emițătorul s-a schimbat — mă leg din nou…", "leg"); }
    else spune("Mă leg la microfon…", "leg");
    leaga(de);
  }

  function porneste() {
    // Fara „if (vreau) return": cand browserul a blocat sunetul, butonul ramane pe „play" desi
    // vreau e deja adevarat — a doua apasare e chiar gestul care deblocheaza elementul.
    vreau = true; blocat = false;
    au.play().catch(() => {});   // gestul de click deblocheaza elementul (iPhone)
    buton("stop", true);
    spune("Pornesc…", "leg");
    citeste();
  }
  function opreste() { vreau = false; blocat = false; inchide(); buton("play", false); citeste(); }
  window.__mic = { porneste, opreste, activ: () => vreau, sunet: () => sunet };
  btn.addEventListener("click", () => { if (btn.dataset.mod === "stop") opreste(); else porneste(); });
  citeste();
  setInterval(citeste, 3000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") citeste(); });
})();
`
}
