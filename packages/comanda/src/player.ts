import { butonPlayStop } from './buton.js'

/**
 * PLAYERUL — un singur ascultător, două surse, trecere lină.
 *
 * Adus din V1 (`src/player.ts`) aproape neatins: se schimbă doar adresele, care acum sunt ale
 * aplicației care îl servește (`<prefix>/api/…`), nu adrese fixe. Scris o singură dată aici,
 * fiindcă îl folosesc TREI pagini: publicul lui `live`, publicul lui `radio` și panoul.
 *
 * Cererea care l-a născut (6.09.2026): „dacă sunt pe live și în spate se trece pe radio, se
 * întrerupe transmisiunea — trecerea să nu se simtă". De aceea:
 *   - o singură INTENȚIE: omul apasă o dată play; de atunci pagina urmărește singură ce e pus în
 *     spate (`/api/stare`) — direct, radio, sau „slujba pornește";
 *   - DOUĂ elemente audio (`#audio` pentru WebRTC, `#audio-radio` pentru fișierele din depozit),
 *     ca sursa nouă să poată porni cât încă se aude cea veche;
 *   - se comută DOAR când sursa nouă chiar are sunet (primul pachet RTP, respectiv `playing`), cu
 *     o rampă de ~1,2 s pe volum. Pe iPhone volumul nu se poate schimba din script — acolo rămâne
 *     o suprapunere scurtă, fără liniște.
 *
 * ⚠️ Fără accente grave (template literals) în JS-ul de mai jos: tot fișierul e el însuși un
 * template literal, iar un accent grav rătăcit trece de `tsc` și cade abia la publicare, în
 * esbuild (lecția din 13.09.2026).
 */

/** Bucata de pagină cu ce cântă radioul (sub butonul de ascultare). */
export function corpRadio(): string {
  return `<section class="rad" id="rad" hidden>
  <p class="rad-piesa" id="rad-piesa"></p>
  <p class="rad-album" id="rad-album"></p>
  <p class="rad-timp" id="rad-timp"></p>
  <p class="rad-urmeaza" id="rad-urmeaza"></p>
</section>`
}

/**
 * Pagina publică de ascultare: un player SIMPLU — un singur buton play/stop, ce se aude, și atât.
 * Cifrele tehnice sunt în panou, nu aici (user, 6.09.2026: „un player simplu").
 *
 * Pe pagina directului (`doarDirect`) nu se randează cartela radioului: acolo radioul nu se aude
 * niciodată, deci n-are ce căuta în pagină nici măcar ascunsă.
 */
export function corpPlayer(optiuni: { doarDirect?: boolean } = {}): string {
  return `<p class="direct-stare" id="stare" data-stare="necunoscut">Verific dacă se transmite…</p>
<div class="direct-butoane">
  ${butonPlayStop('direct-btn')}
</div>
<!-- slujba de acum, pe direct (user, 7.09.2026): „[ora] – Slujba” SUB butonul play; restul nu -->
<p class="direct-slujba" id="slujba-acum" hidden></p>
<!-- urmatoarea slujba din program, cat nu e direct -->
<p class="direct-urmatoarea" id="urmatoarea" hidden></p>
<audio id="audio" playsinline></audio>
<audio id="audio-radio" playsinline preload="auto"></audio>
${optiuni.doarDirect ? '' : corpRadio()}`
}

export const STIL_PLAYER = `
/* Pagina publica: fara titlu, totul centrat — arata la fel pe telefon si pe desktop */
.live { text-align:center; padding-top:24px }
.live .direct-butoane { justify-content:center }
.live .rad { margin-left:auto; margin-right:auto; max-width:36em }
.direct-stare { font-size:18px; min-height:1.5em }
.direct-stare[data-stare="reda"]::before { content:"● "; color:var(--rosu) }
.direct-slujba { font-size:17px; font-weight:600; color:var(--ink); margin:-8px 0 16px; overflow-wrap:anywhere }
.direct-urmatoarea { font-size:15px; color:var(--soft); margin:-8px 0 16px }
.direct-urmatoarea .urm-eticheta, .direct-urmatoarea .urm-slujba { display:block }
.direct-urmatoarea .urm-slujba { color:var(--ink); margin-top:2px }
.direct-butoane { display:flex; gap:12px; margin:16px 0 24px }
.direct-btn { font:inherit; font-size:18px; padding:12px 28px; border-radius:999px; border:1px solid var(--rule);
  background:var(--ink); color:var(--paper); cursor:pointer }
.direct-btn[disabled] { opacity:.45; cursor:default }
.rad { margin:16px 0 24px }
.rad-piesa { font-size:18px; font-weight:600; margin:0 0 2px; overflow-wrap:anywhere }
.rad-album { font-size:14px; color:var(--soft); margin:0 0 10px; overflow-wrap:anywhere }
.rad-timp { font-size:13px; color:var(--faint); font-variant-numeric:tabular-nums; margin:0 }
.rad-urmeaza { font-size:13px; color:var(--faint); margin:10px 0 0; overflow-wrap:anywhere }
`

/**
 * Scriptul playerului. `prefix` e montajul aplicației (gol pe subdomeniu, `/live` ori `/radio`
 * prin gateway-ul de preview) — toate adresele pleacă de la el, deci pagina vorbește numai cu
 * originea ei, oricare dintre cele două aplicații ar servi-o.
 *
 * ⚠️ `doarDirect` face deosebirea dintre cele două pagini publice (user, 14.09.2026: „Live — dacă
 * nu se transmite Live nu merge radio. Scrie că nu e în acest moment nicio transmisiune live /
 * următoarea slujbă este la…"):
 *   - pe **`live`** (`doarDirect: true`) se aude NUMAI slujba. Când nu se transmite, pagina o spune
 *     limpede și arată următoarea slujbă din program — nu pornește radioul ca să umple liniștea;
 *   - pe **`radio`** (implicit) se aude radioul, iar când începe slujba se trece lin pe direct,
 *     ca în V1 — acolo omul a venit să asculte parohia, nu anume slujba.
 */
export function jsPlayer(prefix: string, optiuni: { doarDirect?: boolean } = {}): string {
  return `
(() => {
  const P = ${JSON.stringify(prefix)};
  const DOAR_DIRECT = ${optiuni.doarDirect ? 'true' : 'false'};
  const $ = (id) => document.getElementById(id);
  const stare = $("stare"), btn = $("asculta");
  // Un SINGUR buton: triunghi cat sta oprit, patrat cat canta. Forma aratata (data-mod) e si
  // adevarul despre ce face urmatoarea apasare — vezi ascultatorul de la final.
  function buton(mod, aprins) {
    btn.dataset.mod = mod; btn.disabled = !aprins;
    const nume = mod === "stop" ? "Oprește" : "Ascultă";
    btn.setAttribute("aria-label", nume); btn.setAttribute("title", nume);
  }
  // Cifrele tehnice exista doar in panou. Doua panouri, unul pe sursa: #cifre = WebRTC (getStats:
  // debit, pierdute, jitter); #cifre-radio = elementul <audio> cu fisierul din depozit prin HTTP,
  // unde nu exista pachete pierdute sau jitter — acolo conteaza tamponul si opririle.
  const cifre = $("cifre") || { hidden: true };
  const cifreR = $("cifre-radio") || { hidden: true };
  const cifra = (id, text) => { const e = $(id); if (e) e.textContent = text; };
  const auD = $("audio"), auR = $("audio-radio");
  // Un wav mut de o clipa: cu el „deblocam" elementul radioului chiar in gestul de apasare
  // (iPhone-ul nu lasa play() mai tarziu, dintr-un timer, pe un element care n-a cantat inca).
  const TACERE = "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
  const FADE_MS = 1200;
  const GRATIE_MS = 8000;     // cat rabdam „disconnected" pe WebRTC inainte sa ne legam din nou

  let vreau = false;          // omul a apasat play si n-a apasat stop
  // Browserul a refuzat sa cante desi omul a cerut: butonul ramane pe „play", ca urmatoarea
  // apasare sa fie gestul care deblocheaza redarea (altfel bucla l-ar face iar „stop").
  let blocat = false;
  let sursa = null;           // ce se AUDE acum: "live" | "radio" | null
  let citind = false;
  // directul
  let pc = null, deCurent = null, legLive = false, liveSunet = false, statTimer = null, pornit = null;
  // radioul
  let rad = null, versiune = null, urm = null;
  // cifrele radioului: de cand ascult, cate opriri de tampon gol, debitul piesei, „se incarca" acum
  let pornitRadio = null, opriri = 0, debitRadio = null, asteapta = false, ignoraPanaLa = 0;

  // Pe iOS volumul elementelor media e „doar citire": rampa nu are efect. Aflam o data.
  const POATE_FADE = (() => { try { auR.volume = 0.5; const ok = Math.abs(auR.volume - 0.5) < 0.01; auR.volume = 1; return ok; } catch (e) { return false; } })();

  function spune(text, cod) { stare.textContent = text; stare.dataset.stare = cod; }

  // Chrome pe Android tine sunetul in fundal (ecran stins, alta aplicatie) doar cat pagina e o
  // „sesiune media": un element audio cu durata care canta, cu notificarea de redare a sistemului.
  // Pista WebRTC nu e vazuta asa → la stingerea ecranului sunetul se oprea (ascultator, Vecernia
  // din 7.09.2026). Leac clasic: o bucla MUTA de 6 s care canta cat timp omul asculta + metadate
  // Media Session. Doar pe Android: pe iPhone merge si asa, nu atingem ce merge.
  const ANDROID = /Android/i.test(navigator.userAgent);
  const auF = (ANDROID && typeof document.createElement === "function") ? document.createElement("audio") : null;
  function wavMut(sec) {
    const n = 8000 * sec, b = new Uint8Array(44 + n);
    const s = (o, t) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
    const u32 = (o, v) => { b[o] = v & 255; b[o + 1] = (v >> 8) & 255; b[o + 2] = (v >> 16) & 255; b[o + 3] = (v >>> 24) & 255; };
    const u16 = (o, v) => { b[o] = v & 255; b[o + 1] = (v >> 8) & 255; };
    s(0, "RIFF"); u32(4, 36 + n); s(8, "WAVE"); s(12, "fmt "); u32(16, 16); u16(20, 1); u16(22, 1); u32(24, 8000); u32(28, 8000); u16(32, 1); u16(34, 8); s(36, "data"); u32(40, n);
    b.fill(128, 44);   // 8 biti: 128 = liniste
    return URL.createObjectURL(new Blob([b], { type: "audio/wav" }));
  }
  if (auF) { auF.loop = true; auF.setAttribute("playsinline", ""); auF.src = wavMut(6); if (document.body) document.body.appendChild(auF); }
  function fundal(porneste) {
    if (!auF) return;
    if (porneste) auF.play().catch((e) => raporteaza("fundal", { mesaj: e && e.message }));
    else auF.pause();
  }
  function sesiuneMedia(titlu) {
    if (!ANDROID || !("mediaSession" in navigator)) return;
    try {
      const ms = navigator.mediaSession;
      if (titlu) ms.metadata = new MediaMetadata({ title: titlu, artist: "Biserica Sfântul Ilie — Hanul Colței" });
      ms.playbackState = vreau ? "playing" : "paused";
    } catch (e) {}
  }
  // Erorile paginii pleaca in jurnalul workerului, cel mult 30 pe pagina.
  let raportate = 0;
  function raporteaza(ce, detalii) {
    if (raportate++ > 30) return;
    try {
      const corp = JSON.stringify({ ce, ...(detalii || {}), sursa, vreau, pagina: location.pathname, ua: navigator.userAgent.slice(0, 120), la: new Date().toISOString() });
      if (navigator.sendBeacon) navigator.sendBeacon(P + "/api/jurnal", new Blob([corp], { type: "application/json" }));
      else fetch(P + "/api/jurnal", { method: "POST", body: corp, keepalive: true }).catch(() => {});
    } catch (e) {}
  }
  window.addEventListener("error", (ev) => raporteaza("js", { mesaj: String(ev.message), unde: (ev.filename || "") + ":" + ev.lineno }));
  window.addEventListener("unhandledrejection", (ev) => raporteaza("promisiune", { mesaj: String(ev.reason && ev.reason.message || ev.reason) }));
  const eroareMedia = (el) => el.error ? ("cod " + el.error.code + (el.error.message ? " " + el.error.message : "")) : "?";
  function fmt(n, u) { return (Math.round(n * 10) / 10) + " " + u; }
  const mmss = (s) => { s = Math.max(0, Math.round(s || 0)); const m = Math.floor(s / 60), r = s % 60; return m + ":" + String(r).padStart(2, "0"); };
  const numeDin = (c) => c.split("/").pop().replace(/\\.[^.]+$/, "");
  const albumDin = (c) => { const p = c.split("/"); p.pop(); return p.pop() || ""; };
  const urlRadio = (cale) => P + "/api/fisier?cale=" + encodeURIComponent(cale);
  const oraDin = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }); };

  // ---- urmatoarea slujba din program (cerut de la aplicatia programului) ----
  const urmEl = $("urmatoarea");
  const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  function candZi(data, ora) {
    const azi = new Date(), maine = new Date(azi.getTime() + 86400000);
    const zi = data === ymd(azi) ? "azi" : data === ymd(maine) ? "mâine" : new Date(data + "T12:00:00").toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
    return zi + ", la " + ora;
  }
  function arataUrmatoarea(s) {
    if (!urmEl) return;
    const u = s.urmatoarea;
    if (!u || !u.nume || s.mod === "live" || s.mod === "porneste-live") { urmEl.hidden = true; return; }
    urmEl.hidden = false;
    // Doua randuri: eticheta sus, slujba cu ziua si ora dedesubt.
    const eticheta = u.transmisie ? "Următoarea slujbă transmisă:" : "Următoarea slujbă (nu se transmite):";
    const text = u.nume + " — " + candZi(u.data, u.ora);
    if (urmEl.dataset.text === eticheta + "|" + text) return;
    urmEl.dataset.text = eticheta + "|" + text;
    urmEl.textContent = "";
    const e1 = document.createElement("span"); e1.className = "urm-eticheta"; e1.textContent = eticheta;
    const e2 = document.createElement("span"); e2.className = "urm-slujba"; e2.textContent = text;
    urmEl.appendChild(e1); urmEl.appendChild(e2);
  }

  // ---- slujba de acum, pe direct: „[ora] – Slujba” sub „În direct” ----
  const slujbaEl = $("slujba-acum");
  let slujbaAcum = null;
  function arataSlujba(s) {
    slujbaAcum = s.mod === "live" && s.slujba && s.slujba.nume ? s.slujba : null;
    if (!slujbaEl) return;
    if (!slujbaAcum) { slujbaEl.hidden = true; slujbaEl.textContent = ""; return; }
    const ora = slujbaAcum.de ? oraDin(slujbaAcum.de) : "";
    slujbaEl.textContent = (ora ? ora + " – " : "") + slujbaAcum.nume;
    slujbaEl.hidden = false;
  }
  // Textul de stare pe direct: cu slujba scrisa dedesubt, ora nu se mai repeta in el.
  const textDirect = (de) => "În direct" + (de && !(slujbaEl && slujbaAcum) ? " — emite de la " + oraDin(de) : "");

  // ---- rampa de volum (crossfade) ----
  function fade(el, la, ms) {
    return new Promise((gata) => {
      if (!POATE_FADE) { setTimeout(gata, 350); return; }   // iPhone: suprapunere scurta, fara rampa
      const de = el.volume, t0 = Date.now();
      const ceas = setInterval(() => {
        const k = Math.min(1, (Date.now() - t0) / ms);
        try { el.volume = de + (la - de) * k; } catch (e) {}
        if (k >= 1) { clearInterval(ceas); gata(); }
      }, 50);
    });
  }

  // Comutarea propriu-zisa: se cheama DOAR cand sursa noua are deja sunet.
  async function comuta(spre) {
    const dinainte = sursa; sursa = spre;
    if (blocat) { blocat = false; buton("stop", true); }   // chiar canta: butonul e „stop"
    sesiuneMedia(spre === "live" ? "În direct" : "Radio — muzică psaltică"); bate(false);
    if (spre === "live") {
      spune(textDirect(deCurent), "reda"); cifre.hidden = false; cifreR.hidden = true; panou();
      if (dinainte === "radio") { await Promise.all([fade(auD, 1, FADE_MS), fade(auR, 0, FADE_MS)]); if (sursa === "live") { opresteRadio(); } }
      else { try { auD.volume = 1; } catch (e) {} }
    } else {
      spune("Radio — muzică psaltică", "reda"); cifre.hidden = true; cifreR.hidden = false; panou();
      if (dinainte !== "radio") { pornitRadio = Date.now(); opriri = 0; }
      cifreRadio();
      if (dinainte === "live") { await Promise.all([fade(auR, 1, FADE_MS), fade(auD, 0, FADE_MS)]); if (sursa === "radio") inchideLive(); }
      else { try { auR.volume = 1; } catch (e) {} }
    }
  }

  // ---- DIRECTUL (WebRTC prin SFU) ----
  async function leagaLive(de) {
    if (legLive || pc) return; legLive = true; liveSunet = false;
    try {
      const r = await fetch(P + "/api/asculta", { method: "POST" });
      if (!r.ok) { raporteaza("asculta", { status: r.status }); legLive = false; return; }
      const { sessionId, offer } = await r.json();
      deCurent = de || null;
      const p = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }], bundlePolicy: "max-bundle" });
      pc = p;
      p.ontrack = (ev) => {
        auD.srcObject = ev.streams[0] || new MediaStream([ev.track]);
        try { auD.volume = (POATE_FADE && sursa === "radio") ? 0 : 1; } catch (e) {}
        auD.play().catch(() => {});
        // Pista vine „muta" pana la primul pachet RTP — atunci stim ca e sunet.
        if (!ev.track.muted) liveAreSunet(p); else ev.track.onunmute = () => liveAreSunet(p);
      };
      // „disconnected" NU e o rupere: Chrome (mai ales pe Android, pe date mobile) o da la o
      // clipire a retelei si revine singur in cateva secunde. Daca rupeam pe loc, omul pierdea
      // sunetul si vedea „ma leg din nou…" la fiecare clipire (7.09.2026, Vecernia).
      let sovaie = null;
      const rupe = (st) => {
        raporteaza("webrtc", { stare: st, sunet: liveSunet });
        inchideLive();
        if (sursa === "live") { sursa = null; spune("Legătura s-a rupt — reîncerc…", "eroare"); }
      };
      p.onconnectionstatechange = () => {
        if (pc !== p) return;
        const st = p.connectionState;
        cifra("c-legatura", st);
        if (st === "connected") {
          if (sovaie) { clearTimeout(sovaie); sovaie = null; raporteaza("webrtc", { stare: "revenit", sunet: liveSunet }); }
          return;
        }
        if (st === "disconnected") {
          if (!sovaie) sovaie = setTimeout(() => { sovaie = null; if (pc === p && p.connectionState === "disconnected") rupe("disconnected"); }, GRATIE_MS);
          return;
        }
        if (st === "failed" || st === "closed") { if (sovaie) { clearTimeout(sovaie); sovaie = null; } rupe(st); }
      };
      await p.setRemoteDescription(offer);
      const ans = await p.createAnswer();
      await p.setLocalDescription(ans);
      const r2 = await fetch(P + "/api/asculta/" + sessionId, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ answer: p.localDescription }) });
      if (!r2.ok) { const j = await r2.json().catch(() => ({})); raporteaza("raspuns", { status: r2.status, motiv: j.motiv }); spune("Semnalizarea a eșuat: " + (j.motiv || r2.status), "eroare"); inchideLive(); }
      else statTimer = setInterval(() => cifreNoi(p), 2000);   // si rezerva pentru onunmute (Safari)
    } catch (e) { raporteaza("leagaLive", { mesaj: e.message, nume: e.name }); spune("Eroare la direct: " + e.message + " — reîncerc…", "eroare"); inchideLive(); }
    legLive = false;
  }
  function liveAreSunet(p) {
    if (pc !== p || liveSunet) return;
    liveSunet = true; pornit = Date.now();
    if (sursa !== "live") comuta("live");
  }
  let bytesAnt = 0, tAnt = 0;
  async function cifreNoi(p) {
    if (pc !== p) return;
    const st = await p.getStats();
    st.forEach((s) => {
      if (s.type === "inbound-rtp" && s.kind === "audio") {
        if ((s.packetsReceived || 0) > 5) liveAreSunet(p);
        const t = Date.now();
        if (tAnt) cifra("c-debit", fmt((s.bytesReceived - bytesAnt) * 8 / (t - tAnt), "kbps"));
        bytesAnt = s.bytesReceived; tAnt = t;
        cifra("c-pierdute", (s.packetsLost || 0) + " / " + (s.packetsReceived || 0));
        cifra("c-jitter", fmt((s.jitter || 0) * 1000, "ms"));
      }
    });
    if (pornit) { const sec = Math.round((Date.now() - pornit) / 1000); cifra("c-durata", Math.floor(sec / 60) + " min " + (sec % 60) + " s"); }
  }
  function inchideLive() {
    if (statTimer) clearInterval(statTimer); statTimer = null;
    if (pc) { try { pc.close(); } catch (e) {} } pc = null; liveSunet = false; pornit = null; bytesAnt = 0; tAnt = 0;
    auD.srcObject = null; cifre.hidden = true;
  }

  // ---- RADIOUL (fisiere din depozit, dupa ceasul workerului) ----
  function panou() {
    const p = $("rad");
    if (!p) return;
    if (sursa !== "radio" || !rad || !rad.cale) { p.hidden = true; return; }
    p.hidden = false;
    $("rad-piesa").textContent = numeDin(rad.cale);
    $("rad-album").textContent = albumDin(rad.cale);
    $("rad-timp").textContent = "Piesa " + (rad.index + 1) + " din " + rad.total + " · " + mmss(auR.currentTime || rad.secunda) + " / " + mmss(rad.durata);
    $("rad-urmeaza").textContent = rad.urmatoarea ? "Urmează: " + numeDin(rad.urmatoarea) : "";
  }
  function pornesteRadio(a, sariLa) {
    clearTimeout(urm);
    rad = a; versiune = a.versiune;
    auR.src = urlRadio(a.cale);
    ignoraPanaLa = Date.now() + 2000;   // „waiting" la schimbarea piesei nu e o oprire
    debitPiesa(a);
    const asaza = () => { if (sariLa && a.secunda > 1) { ignoraPanaLa = Date.now() + 2000; try { auR.currentTime = a.secunda; } catch (e) {} } auR.removeEventListener("loadedmetadata", asaza); };
    auR.addEventListener("loadedmetadata", asaza);
    try { auR.volume = (POATE_FADE && sursa === "live") ? 0 : 1; } catch (e) {}
    auR.play().catch(() => { blocat = true; spune("Apasă play ca să pornească sunetul.", "gata"); buton("play", true); });
    programeazaUrmatoarea();
  }
  // Cand piesa se apropie de final, trecem singuri la urmatoarea (ceasul nostru si al workerului
  // merg la fel) — dar intrebam intai ce e pus in spate, ca sa nu pornim o piesa peste slujba.
  function programeazaUrmatoarea() {
    clearTimeout(urm);
    if (!vreau || !rad || !rad.urmatoarea) return;
    const ramas = Math.max(0.2, rad.durata - (auR.currentTime || rad.secunda));
    urm = setTimeout(async () => {
      if (!vreau) return;
      const s = await ia();
      if (!s) return;
      if (s.mod === "radio") pornesteRadio(s.radio, true); else aplica(s);
    }, ramas * 1000);
  }
  function opresteRadio() {
    clearTimeout(urm); urm = null;
    auR.pause(); auR.removeAttribute("src"); auR.load();
    rad = null; versiune = null; panou();
    cifreR.hidden = true; pornitRadio = null; opriri = 0; debitRadio = null; asteapta = false;
  }

  // ---- cifrele radioului ----
  // Debitul piesei = marimea fisierului / durata (un HEAD pe piesa, din acelasi cache ca sunetul).
  function debitPiesa(a) {
    debitRadio = null;
    if (!a.durata) return;
    fetch(urlRadio(a.cale), { method: "HEAD" }).then((r) => {
      const n = Number(r.headers.get("content-length"));
      if (r.ok && n > 0 && rad && rad.cale === a.cale) { debitRadio = n * 8 / a.durata / 1000; cifreRadio(); }
    }).catch(() => {});
  }
  // Cate secunde de sunet are deja descarcate inainte de locul unde canta.
  function tampon() {
    const b = auR.buffered, t = auR.currentTime || 0;
    for (let i = 0; i < b.length; i++) if (b.start(i) <= t + 0.5 && b.end(i) >= t) return b.end(i) - t;
    return 0;
  }
  function cifreRadio() {
    if (sursa !== "radio" || cifreR.hidden) return;
    let leg = auR.networkState === 3 ? "fără sursă" : asteapta ? "se încarcă (tampon gol)" : auR.paused ? "oprit" : "redă";
    if (opriri) leg += " · " + opriri + (opriri === 1 ? " oprire" : " opriri");
    cifra("r-legatura", leg);
    cifra("r-debit", debitRadio ? fmt(debitRadio, "kbps") : "–");
    cifra("r-tampon", fmt(tampon(), "s înainte"));
    if (pornitRadio) { const sec = Math.round((Date.now() - pornitRadio) / 1000); cifra("r-durata", Math.floor(sec / 60) + " min " + (sec % 60) + " s"); }
  }
  setInterval(cifreRadio, 1000);
  auR.addEventListener("waiting", () => { asteapta = true; if (sursa === "radio" && Date.now() > ignoraPanaLa) { opriri++; if (opriri <= 5) raporteaza("radio-tampon", { opriri, secunda: auR.currentTime, piesa: rad && rad.cale }); } cifreRadio(); });
  auR.addEventListener("playing", () => { asteapta = false; cifreRadio(); });
  auR.addEventListener("playing", () => { if (vreau && rad && sursa !== "radio") comuta("radio"); });
  auR.addEventListener("timeupdate", () => { if (sursa === "radio") panou(); });
  auR.addEventListener("ended", () => { if (vreau) citeste(); });
  auR.addEventListener("error", () => { raporteaza("audio-radio", { eroare: eroareMedia(auR), src: (auR.getAttribute("src") || "").slice(0, 80) }); if (vreau && rad) setTimeout(citeste, 2000); });
  auD.addEventListener("error", () => raporteaza("audio-direct", { eroare: eroareMedia(auD) }));

  // ---- starea din spate → ce facem ----
  // Un fetch picat o data (telefonul iese din fundal, reteaua clipeste) nu e o eroare de aratat:
  // o spunem abia la al treilea esec la rand, si o raportam in jurnal.
  let esecuri = 0;
  async function ia() {
    try { const j = await (await fetch(P + "/api/stare", { cache: "no-store" })).json(); esecuri = 0; return j; }
    catch (e) { esecuri++; raporteaza("stare", { mesaj: e.message, nume: e.name, esecuri }); if (esecuri >= 3) spune("Nu pot verifica starea (" + e.message + ") — reîncerc…", "eroare"); return null; }
  }
  function aplica(s) {
    // Pe pagina directului radioul NU se aude: aici e locul slujbei. Ce cantă radioul in spate
    // devine, pentru pagina asta, „nu se transmite" — si atunci ea arata urmatoarea slujba.
    const mod = (DOAR_DIRECT && s.mod === "radio") ? "oprit" : s.mod;
    arataSlujba(s); arataUrmatoarea(s);
    if (!vreau) {
      if (s.direct && s.direct.configurat === false && mod !== "radio") { spune("Transmisiunea nu e configurată încă (lipsesc cheile SFU).", "neconfigurat"); buton("play", false); }
      else if (mod === "live") { spune("Se transmite acum — apasă play.", "gata"); buton("play", true); }
      else if (mod === "radio") { spune("Radioul cântă — apasă play.", "gata"); buton("play", true); }
      else if (mod === "porneste-live") { spune("Slujba începe — apasă play.", "gata"); buton("play", true); }
      else if (DOAR_DIRECT) { spune("Nu e nicio transmisiune în direct acum.", "liber"); buton("play", false); }
      else { spune("Nu se transmite acum.", "liber"); buton("play", false); }
      return;
    }
    buton(blocat ? "play" : "stop", true);

    if (mod === "radio") {
      const a = s.radio;
      if (pc && !liveSunet) inchideLive();           // o legare la direct ramasa in aer
      if (rad && a.versiune === versiune && a.cale === rad.cale && auR.getAttribute("src")) { rad = a; panou(); return; }
      // radio nou, sau cineva a schimbat muzica din panou: sarim la ce se aude acum
      if (sursa !== "radio") spune(sursa === "live" ? "Trec pe radio…" : "Pornesc radioul…", "leg");
      pornesteRadio(a, true);
      return;
    }
    if (mod === "live") {
      const de = s.direct.de || null;
      if (pc && de === deCurent) { if (sursa === "live") spune(textDirect(de), "reda"); return; }
      if (pc) { inchideLive(); if (sursa === "live") { sursa = null; spune("Emițătorul s-a schimbat — mă leg din nou…", "leg"); } }
      if (sursa !== "live") spune(sursa === "radio" ? "Slujba începe — trec pe direct…" : "Mă leg la direct…", "leg");
      leagaLive(de);
      return;
    }
    if (mod === "porneste-live") {
      // Lasam ce canta (radioul) sa cante pana vine sunetul din biserica; nu pornim nimic nou.
      if (pc && !liveSunet) inchideLive();
      spune(sursa === "radio" ? "Slujba începe — trec pe direct când vine sunetul…" : "Slujba începe — aștept sunetul din biserică…", "leg");
      return;
    }
    // oprit: nu e nimic pus in spate. Ramanem „acordati": cand reincepe ceva, pornim singuri.
    if (pc || rad || sursa) { inchideLive(); opresteRadio(); sursa = null; }
    if (s.direct && s.direct.configurat === false) { spune("Transmisiunea nu e configurată încă (lipsesc cheile SFU).", "liber"); return; }
    spune(DOAR_DIRECT ? "Nu e nicio transmisiune în direct acum — aștept să înceapă…" : "Transmisiunea s-a oprit — aștept să reînceapă…", "liber");
  }
  async function citeste() {
    if (citind) return; citind = true;
    const s = await ia();
    citind = false;
    if (s) aplica(s);
  }

  // ---- butoanele ----
  function deblocheaza() {
    // Chemata DOAR dintr-un gest (click): marcheaza ambele elemente ca „au voie sa cante".
    if (!auR.dataset.deblocat) { try { auR.src = TACERE; auR.play().then(() => { auR.dataset.deblocat = "1"; }).catch(() => {}); } catch (e) {} }
    if (!auD.dataset.deblocat) { auD.play().then(() => { auD.dataset.deblocat = "1"; }).catch(() => { auD.dataset.deblocat = "1"; }); }
  }
  async function porneste() {
    // Cand browserul a blocat sunetul, butonul ramane pe „play" desi vreau e deja adevarat:
    // a doua apasare e chiar gestul care are voie sa porneasca redarea. De aceea nu iesim.
    const dinNou = vreau;
    vreau = true; blocat = false; deblocheaza(); fundal(true);
    buton("stop", true);
    spune("Pornesc…", "leg"); sesiuneMedia("Pornesc…");
    if (dinNou) {
      try { if (auR.getAttribute("src")) await auR.play(); } catch (e) {}
      try { if (auD.srcObject) await auD.play(); } catch (e) {}
    }
    await citeste();
  }
  function opreste() {
    vreau = false; blocat = false;
    inchideLive(); opresteRadio(); sursa = null; fundal(false); sesiuneMedia(null); bate(true);
    buton("play", false);
    citeste();
  }
  window.__player = { porneste, opreste, deblocheaza, raporteaza, activ: () => vreau, sursa: () => sursa };

  // CATI ASCULTA: cat timp se aude ceva, pagina bate la /api/ascult cu un id aleator al ei (nimic
  // despre om); la stop bate „plec". Bataia e rara dinadins — fiecare atinge un obiect durabil.
  const ID_PAGINA = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  let batutCu = null;
  function bate(plec) {
    const s = plec ? null : (vreau ? sursa : null);
    if (!s && !batutCu) return;   // nu asculta si nici n-a batut inainte: nimic de spus
    batutCu = s;
    const corp = JSON.stringify({ id: ID_PAGINA, sursa: s, plec: !s });
    try { fetch(P + "/api/ascult", { method: "POST", headers: { "content-type": "application/json" }, body: corp, keepalive: true }).catch(() => {}); } catch (e) {}
  }
  setInterval(() => bate(false), 30000);
  window.addEventListener("pagehide", () => bate(true));
  // Play/pauza din notificarea de redare a Androidului (ecran blocat) = butonul din pagina.
  if (ANDROID && "mediaSession" in navigator) {
    try { navigator.mediaSession.setActionHandler("play", () => porneste()); navigator.mediaSession.setActionHandler("pause", () => opreste()); navigator.mediaSession.setActionHandler("stop", () => opreste()); } catch (e) {}
  }

  // Acelasi buton face amandoua: ce urmeaza se citeste din forma aratata acum.
  btn.addEventListener("click", () => { if (btn.dataset.mod === "stop") opreste(); else porneste(); });
  citeste();
  // RITMUL intrebarilor (7.09.2026, dupa ce s-a depasit limita de obiecte durabile). Raspunsul e
  // tinut minte cateva secunde in worker, deci intrebarile dese nu aduceau nimic nou:
  //   pagina in fata           5 s   (omul se uita la ea)
  //   in fundal, dar canta    20 s   (telefonul in buzunar: sunetul merge, ecranul nu)
  //   in fundal si tacuta     60 s   (pagina uitata deschisa — cel mai des caz)
  // Momentele care chiar cer graba nu asteapta ceasul: apasarea pe play, revenirea din fundal,
  // sfarsitul piesei, ruperea legaturii — toate cer o citire pe loc.
  let ceasCitire = null, ritmAcum = null;
  function ritm() {
    const ms = document.visibilityState === "hidden" ? (vreau ? 20000 : 60000) : 5000;
    if (ms === ritmAcum) return;
    ritmAcum = ms; clearInterval(ceasCitire); ceasCitire = setInterval(citeste, ms);
  }
  ritm();
  setInterval(ritm, 2000);   // ritmul se potriveste singur cand omul apasa play sau stop
  // Revenirea din fundal (telefon): legatura poate fi moarta fara sa stim — verificam pe loc.
  document.addEventListener("visibilitychange", () => { ritm(); if (document.visibilityState === "visible") citeste(); });
})();
`
}
