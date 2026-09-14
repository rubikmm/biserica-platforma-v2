/**
 * MUZICA RADIOULUI, partea de PAGINĂ — HTML, stil și scriptul ei.
 *
 * Stă separat de rute dinadins: fișierul acesta nu importă nimic din runtime (nici
 * `cloudflare:workers`), ca să poată fi randat și probat în Node, fără să pornească un worker.
 * Aceeași regulă ca la panoul din `@xc/comanda`.
 */

export function corpBiblioteca(): string {
  return `<div class="bib">
  <h1 class="bib-titlu">Muzica radioului</h1>
  <p class="bib-intro" id="bib-intro">Aici se adaugă și se șterg melodiile. Ce pui aici se aude la radio imediat — nu mai trebuie OneDrive și nu mai așteaptă niciun aparat.</p>

  <nav class="ctl-firimituri" id="bib-firimituri"></nav>

  <section class="bib-unelte" id="bib-unelte" hidden>
    <label class="bib-btn bib-btn-mare">
      <input type="file" id="bib-fisiere" accept="audio/*,.mp3,.m4a,.wav,.flac,.ogg,.opus,.aac" multiple hidden>
      Adaugă melodii
    </label>
    <button type="button" class="bib-btn bib-btn-sec" id="bib-folder-nou">Folder nou</button>
    <button type="button" class="bib-btn bib-btn-sec" id="bib-masoara" title="Numără cadrele fiecărui fișier din acest folder, pe Cloudflare, și pune durata exactă">Măsoară duratele</button>
    <span class="bib-aici" id="bib-aici"></span>
  </section>

  <div class="bib-zona" id="bib-zona" hidden>Trage melodiile aici ca să le adaugi în acest folder.</div>

  <ul class="bib-coada" id="bib-coada"></ul>

  <ul class="ctl-lista bib-lista" id="bib-directoare"></ul>
  <div id="bib-bloc-fisiere" hidden>
    <div class="ctl-subcap">Melodii (<span id="bib-nr">0</span>)</div>
    <ul class="ctl-lista bib-lista" id="bib-melodii"></ul>
  </div>
  <p class="ctl-gol" id="bib-gol" hidden></p>
  <p class="bib-subsol" id="bib-subsol"></p>
</div>`
}

export const STIL_BIBLIOTECA = `
.bib { max-width:760px; margin:0 auto; display:flex; flex-direction:column; gap:12px }
.bib-titlu { margin:8px 0 0 }
.bib-intro { color:var(--soft); margin:0; max-width:640px }
.bib-unelte { display:flex; flex-wrap:wrap; align-items:center; gap:10px }
.bib-btn { font:inherit; font-size:15px; font-weight:600; padding:9px 18px; border-radius:999px; border:1px solid var(--rule); background:transparent; color:inherit; cursor:pointer }
.bib-btn-mare { background:var(--albastru-btn); border-color:var(--albastru-btn); color:#fff }
.bib-btn-mare:hover { background:var(--albastru-btn-hover) }
.bib-btn-sec:hover { background:rgba(127,127,127,.1) }
.bib-aici { font-size:13px; color:var(--faint); margin-left:auto }
.bib-zona { border:2px dashed var(--rule); border-radius:14px; padding:22px; text-align:center; color:var(--faint); font-size:14px }
.bib-zona.peste { border-color:var(--albastru-btn); color:var(--albastru); background:rgba(37,99,235,.06) }
.bib-coada { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px }
.bib-coada li { display:flex; align-items:center; gap:10px; font-size:14px; border:1px solid var(--rule); border-radius:10px; padding:8px 12px }
.bib-coada .nume { flex:1; min-width:0; overflow-wrap:anywhere }
.bib-coada .stare { font-size:12px; color:var(--faint); flex:none }
.bib-coada.gata li.ok { border-color:var(--verde) }
.bib-coada li.rau { border-color:var(--alerta-rama); color:var(--alerta-text) }
.bib-bara-mica { flex:none; width:90px; height:6px; border-radius:999px; background:rgba(127,127,127,.25); overflow:hidden }
.bib-bara-mica i { display:block; height:100%; width:0; background:var(--albastru-btn); transition:width .2s }
.bib-lista { border:1px solid var(--rule); border-radius:14px; overflow:hidden }
.bib-lista:empty { display:none }
.bib-rand { display:flex; align-items:center; gap:10px; padding:10px 12px }
.bib-rand-btn { flex:1; display:flex; align-items:center; gap:12px; min-width:0; border:0; background:none; color:inherit; font:inherit; text-align:left; cursor:pointer }
.bib-rand-btn .ico { flex:none; color:var(--faint) } .bib-rand-btn .ico svg { width:22px; height:22px }
.bib-nume { display:block; overflow-wrap:anywhere; font-weight:500 }
.bib-sub { display:block; font-size:12px; color:var(--faint); margin-top:2px }
.bib-sterge { flex:none; font:inherit; font-size:12px; font-weight:600; color:var(--alerta-text); background:transparent; border:1px solid var(--alerta-rama); border-radius:8px; padding:6px 10px; cursor:pointer }
.bib-sterge:hover { background:rgba(220,38,38,.1) }
.bib-durata { flex:none; font-size:12px; font-family:ui-monospace,monospace; color:var(--faint); font-variant-numeric:tabular-nums }
.bib-subsol { font-size:13px; color:var(--faint); margin:4px 0 32px }
`

/** ⚠️ Fără accente grave înăuntru (vezi nota din `@xc/comanda/player.ts`). */
export function jsBiblioteca(prefix: string): string {
  return `
(() => {
  const P = ${JSON.stringify(prefix)};
  const $ = (id) => document.getElementById(id);
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const ICO_FOLDER = '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>';
  const EXT = [".mp3", ".m4a", ".aac", ".ogg", ".opus", ".wav", ".flac"];

  let C = null, cale = "", potScrie = false;
  const mmss = (s) => { if (!s || s <= 0) return ""; s = Math.round(s); const m = Math.floor(s / 60), r = s % 60; const h = Math.floor(m / 60); return h > 0 ? h + ":" + String(m % 60).padStart(2, "0") + ":" + String(r).padStart(2, "0") : m + ":" + String(r).padStart(2, "0"); };
  const parinte = (c) => c.includes("/") ? c.slice(0, c.lastIndexOf("/")) : "";
  const nume = (c) => c.slice(c.lastIndexOf("/") + 1);
  const eAudio = (n) => EXT.some((e) => n.toLowerCase().endsWith(e));

  async function cuprins() {
    try { C = await (await fetch(P + "/biblioteca/cuprins", { cache: "no-store" })).json(); } catch (e) { return; }
    potScrie = !!C.pot_scrie;
    $("bib-unelte").hidden = !potScrie;
    $("bib-zona").hidden = !potScrie;
    if (!potScrie) $("bib-intro").textContent = "Aici se vede muzica radioului. Ca să adaugi sau să ștergi melodii e nevoie de dreptul de administrare.";
    randeaza();
  }

  function randeaza() {
    if (!C) return;
    const fir = $("bib-firimituri"); fir.innerHTML = "";
    const acasa = el("button", "", "Muzica radioului"); acasa.type = "button"; acasa.addEventListener("click", () => { cale = ""; randeaza(); }); fir.appendChild(acasa);
    let cumul = "";
    const parti = cale ? cale.split("/") : [];
    parti.forEach((p, i) => {
      cumul = cumul ? cumul + "/" + p : p;
      fir.appendChild(el("span", "sep", "/"));
      if (i === parti.length - 1) fir.appendChild(el("span", "aici", p));
      else { const b = el("button", "", p); b.type = "button"; const c = cumul; b.addEventListener("click", () => { cale = c; randeaza(); }); fir.appendChild(b); }
    });
    $("bib-aici").textContent = cale ? "adaugi în: " + nume(cale) : "adaugi în rădăcină";

    const sub = C.directoare.filter((d) => parinte(d) === cale).sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1);
    const fis = C.fisiere.filter((f) => parinte(f.cale) === cale);
    const ud = $("bib-directoare"); ud.innerHTML = "";
    for (const d of sub) {
      const cate = C.fisiere.filter((f) => f.cale.startsWith(d + "/")).length;
      const li = el("li"), r = el("div", "bib-rand");
      const b = el("button", "bib-rand-btn"); b.type = "button";
      b.innerHTML = '<span class="ico">' + ICO_FOLDER + '</span><span style="min-width:0;flex:1"><span class="bib-nume"></span><span class="bib-sub"></span></span>';
      b.querySelector(".bib-nume").textContent = nume(d);
      b.querySelector(".bib-sub").textContent = cate === 0 ? "gol" : cate === 1 ? "1 melodie" : cate + " melodii";
      b.addEventListener("click", () => { cale = d; randeaza(); });
      r.appendChild(b);
      if (potScrie) { const s = el("button", "bib-sterge", "Șterge"); s.type = "button"; s.addEventListener("click", () => stergeDirector(d, cate)); r.appendChild(s); }
      li.appendChild(r); ud.appendChild(li);
    }
    $("bib-bloc-fisiere").hidden = fis.length === 0;
    $("bib-nr").textContent = fis.length;
    const uf = $("bib-melodii"); uf.innerHTML = "";
    for (const f of fis) {
      const li = el("li"), r = el("div", "bib-rand");
      const n = el("span", "bib-nume", nume(f.cale)); n.style.flex = "1"; n.style.minWidth = "0";
      r.appendChild(n);
      r.appendChild(el("span", "bib-durata", mmss(f.durata) + (f.octeti ? " · " + (f.octeti / 1e6).toFixed(1) + " MB" : "")));
      if (potScrie) { const s = el("button", "bib-sterge", "Șterge"); s.type = "button"; s.addEventListener("click", () => stergeFisier(f.cale)); r.appendChild(s); }
      li.appendChild(r); uf.appendChild(li);
    }
    const gol = $("bib-gol"); gol.hidden = !(sub.length === 0 && fis.length === 0);
    gol.textContent = "Folderul e gol." + (potScrie ? " Adaugă melodii cu butonul de sus." : "");
    const ore = C.fisiere.reduce((t, f) => t + f.durata, 0) / 3600;
    $("bib-subsol").textContent = "În total: " + C.fisiere.length + " melodii, " + ore.toFixed(1) + " ore.";
  }

  // Durata EXACTA, masurata aici, in browser: asa indicele e corect fara niciun aparat.
  async function masoaraDurata(fisier) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        const ctx = new AC();
        const buf = await ctx.decodeAudioData(await fisier.arrayBuffer());
        const d = buf.duration; ctx.close();
        if (d > 0) return d;
      }
    } catch (e) { /* fisiere mari sau format nesuportat de decodor: mergem pe eticheta */ }
    return await new Promise((gata) => {
      const a = new Audio(); const u = URL.createObjectURL(fisier);
      a.preload = "metadata";
      a.onloadedmetadata = () => { const d = a.duration; URL.revokeObjectURL(u); gata(isFinite(d) && d > 0 ? d : 0); };
      a.onerror = () => { URL.revokeObjectURL(u); gata(0); };
      a.src = u;
    });
  }

  async function urca(fisiere) {
    const coada = $("bib-coada");
    for (const f of fisiere) {
      const li = el("li");
      const n = el("span", "nume", f.name); const bara = el("span", "bib-bara-mica"); const i = el("i"); bara.appendChild(i);
      const st = el("span", "stare", "măsor…");
      li.append(n, bara, st); coada.appendChild(li);
      if (!eAudio(f.name)) { li.classList.add("rau"); st.textContent = "nu e fișier audio"; continue; }
      const durata = await masoaraDurata(f);
      if (!durata) { li.classList.add("rau"); st.textContent = "nu pot citi durata"; continue; }
      st.textContent = "urc…";
      const tinta = (cale ? cale + "/" : "") + f.name;
      const ok = await new Promise((gata) => {
        const x = new XMLHttpRequest();
        x.open("PUT", P + "/biblioteca/fisier?cale=" + encodeURIComponent(tinta) + "&durata=" + durata.toFixed(2));
        x.setRequestHeader("content-type", f.type || "audio/mpeg");
        x.upload.onprogress = (ev) => { if (ev.lengthComputable) i.style.width = Math.round(ev.loaded / ev.total * 100) + "%"; };
        x.onload = () => gata(x.status >= 200 && x.status < 300 ? true : (st.textContent = (JSON.parse(x.responseText || "{}").motiv || x.status), false));
        x.onerror = () => { st.textContent = "eroare de rețea"; gata(false); };
        x.send(f);
      });
      if (ok) { li.classList.add("ok"); i.style.width = "100%"; st.textContent = mmss(durata) + " · adăugată"; }
      else li.classList.add("rau");
    }
    await cuprins();
    setTimeout(() => { $("bib-coada").innerHTML = ""; }, 6000);
  }

  async function stergeFisier(c) {
    if (!confirm("Ștergi definitiv melodia?\\n\\n" + nume(c))) return;
    await fetch(P + "/biblioteca/sterge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fisiere: [c] }) });
    cuprins();
  }
  async function stergeDirector(d, cate) {
    if (!confirm("Ștergi folderul „" + nume(d) + "”" + (cate ? " și cele " + cate + " melodii din el" : "") + "?\\n\\nNu mai pot fi recuperate.")) return;
    await fetch(P + "/biblioteca/sterge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ directoare: [d] }) });
    cuprins();
  }

  $("bib-folder-nou").addEventListener("click", async () => {
    const n = prompt("Numele folderului nou:");
    if (!n) return;
    const r = await fetch(P + "/biblioteca/director", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cale: (cale ? cale + "/" : "") + n.trim() }) });
    if (!r.ok) alert("Nu am putut face folderul: " + ((await r.json().catch(() => ({}))).motiv || r.status));
    cuprins();
  });
  // Masurarea pe Cloudflare: cate 25 de fisiere pe cerere, pana nu mai ramane nimic.
  $("bib-masoara").addEventListener("click", async () => {
    const b = $("bib-masoara"); const eticheta = b.textContent;
    const cate = C ? C.fisiere.filter((f) => f.cale.startsWith((cale ? cale + "/" : ""))).length : 0;
    if (!cate) { alert("Nu sunt melodii de măsurat aici."); return; }
    if (!confirm("Măsor din nou duratele celor " + cate + " melodii din acest folder (și din subfoldere)?")) return;
    b.disabled = true;
    let facute = 0, rele = [];
    const lista = C.fisiere.filter((f) => f.cale.startsWith((cale ? cale + "/" : ""))).map((f) => f.cale);
    for (let i = 0; i < lista.length; i += 25) {
      b.textContent = "Măsor… " + facute + " / " + cate;
      const r = await fetch(P + "/biblioteca/masoara", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fisiere: lista.slice(i, i + 25) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { alert("Eroare: " + (j.motiv || r.status)); break; }
      facute += j.masurate.length; rele = rele.concat(j.nemasurate);
    }
    b.textContent = eticheta; b.disabled = false;
    alert("Gata: " + facute + " măsurate" + (rele.length ? ", " + rele.length + " nu au putut fi citite:\\n" + rele.map(nume).join("\\n") : "."));
    cuprins();
  });
  $("bib-fisiere").addEventListener("change", (ev) => { const f = [...ev.target.files]; ev.target.value = ""; urca(f); });
  const z = $("bib-zona");
  for (const t of ["dragenter", "dragover"]) z.addEventListener(t, (e) => { e.preventDefault(); z.classList.add("peste"); });
  for (const t of ["dragleave", "drop"]) z.addEventListener(t, (e) => { e.preventDefault(); z.classList.remove("peste"); });
  z.addEventListener("drop", (e) => urca([...e.dataTransfer.files]));

  cuprins();
})();
`
}
