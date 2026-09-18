import { butonPlayStop } from '@xc/comanda'
import type { StareDirect, SunetAparat } from '@xc/contracts'

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
 * ⚠️ Pagina stă la `live`, pe `live.sfantul-ilie.ro/mic` (user, 15.09.2026) — adică chiar acolo unde
 * sunt canalele SFU, deci fără săritură prin alt worker. Până atunci o servea `radio` și cerea
 * semnalizarea înapoi prin Service Binding; pe `radio` a rămas doar o redirectare, pentru legăturile
 * vechi. Nu e o abatere de la „panoul e unul singur, la radio": microfonul nu e panou — nu comandă
 * nimic, doar ascultă.
 */

/**
 * Ce citește pagina la fiecare 3 s (`GET /mic/stare`): starea canalului din SFU, ca până acum, plus
 * MONITORUL de sunet (18.09.2026) — ultima măsurătoare a aparatului și clipa în care s-a auzit
 * ultima oară ceva peste prag. E același `ultimul_sunet` monoton pe care se sprijină rotirea
 * albumelor (`rotire.ts`), deci pagina arată chiar ceasul după care se schimbă muzica.
 */
export interface StareMic extends StareDirect {
  /** Ultima măsurătoare, curățată; `null` = aparatul nu măsoară (daemon vechi, microfon căzut). */
  sunet: SunetAparat | null
  /** ISO — cea mai recentă activitate știută; `null` = n-am auzit niciodată nimic. */
  ultimul_sunet: string | null
}

/** Răspunsul rutei, compus din cele două citiri. Restul răspunsului rămâne neatins. */
export function stareMic(
  canal: StareDirect,
  sunet: { sunet: SunetAparat | null; ultimul_sunet: string | null },
): StareMic {
  return { ...canal, ...sunet }
}

export function corpMic(): string {
  return `<h1 class="direct-titlu">Microfonul din biserică</h1>
<p class="direct-stare" id="stare" data-stare="necunoscut">Verific microfonul…</p>
<div class="direct-butoane">
  ${butonPlayStop('direct-btn')}
</div>
<audio id="audio" playsinline></audio>
<!-- SUNETUL masurat pe aparat (nu in pagina): nivel, varf, pragul lui si cand s-a auzit ultima
     oara ceva peste prag. Dupa acelasi ceas se roteste si albumul radioului — v. rotire.ts.
     Sta in DL-ul lui, FARA hidden, deasupra cifrelor de legatura: e un MONITOR, nu o cifra de
     ascultare. Omul care doar deschide pagina trebuie sa vada daca se aude ceva in biserica,
     chiar daca nu apasa play — de-aia nu-l atinge hidden-ul de la play/stop. -->
<dl class="mic-cifre mic-sunet" id="sunet">
  <dt>Sunet</dt><dd id="c-sunet">–</dd>
</dl>
<!-- GRAFICUL nivelului (18.09.2026, cerut de user: „sa facem grafic"). SVG desenat de scriptul
     paginii, fara nicio biblioteca. Butoanele de fereastra stau DEASUPRA graficului, intr-un
     singur rand, si il cuprind pe tot (regula din skill-ul dataviz: filtrele nu se ascund in
     cartela graficului). Legenda e mereu acolo — doua serii nu se deosebesc numai prin culoare. -->
<figure class="graf" id="graf">
  <figcaption class="graf-cap">
    <span class="graf-titlu">Nivelul sunetului, ultimele <b id="graf-cat">24 h</b></span>
    <span class="graf-pill" role="group" aria-label="Fereastra graficului">
      <button type="button" class="graf-pill-btn" data-ore="6">6 h</button>
      <button type="button" class="graf-pill-btn" data-ore="24">24 h</button>
      <button type="button" class="graf-pill-btn" data-ore="168">7 zile</button>
    </span>
  </figcaption>
  <p class="graf-legenda">
    <span class="graf-cheie"><i class="graf-k-nivel"></i>Nivel (RMS)</span>
    <span class="graf-cheie"><i class="graf-k-varf"></i>Vârf</span>
    <span class="graf-cheie"><i class="graf-k-peste"></i>Peste prag</span>
  </p>
  <svg id="graf-svg" role="img" tabindex="0" aria-label="Nivelul sunetului din biserică, în timp"></svg>
  <p class="graf-sub" id="graf-sub">Adun măsurătorile…</p>
</figure>
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
.mic-sunet { margin-bottom:12px }     /* monitorul sta lipit de cifrele de dedesubt, nu la 24px */
.marunt { font-size:14px; color:var(--faint) }

/* GRAFICUL nivelului de sunet.
   ⚠️ Culorile marcajelor sunt TOKENURI proprii, nu --albastru/--rosu luate de-a gata din carcasa:
   pe tema intunecata accentele carcasei sunt prea deschise pentru marcaje de grafic (validatorul
   din skill-ul dataviz le pica pe banda de luminozitate, L 0.73/0.68 fata de 0.48–0.67), iar regula
   lui e ca tema intunecata se ALEGE, nu se intoarce automat. Pasii de aici trec toate cele sase
   verificari in amandoua temele (separare pentru daltonism ΔE 16.5 deutan, contrast peste 3:1).
   Mecanismul e cel din carcasa (sistem + data-tema), acelasi ca la @xc/comanda — nu culori fixe in
   SVG, ca desenul sa se intoarca odata cu pagina. */
:root { --graf-nivel:#1C58BB; --graf-prag:#C62234 }
@media (prefers-color-scheme: dark) { :root:not([data-tema="light"]) {
  --graf-nivel:#6D8FCE; --graf-prag:#CE535F } }
:root[data-tema="dark"] { --graf-nivel:#6D8FCE; --graf-prag:#CE535F }
.graf { margin:0 0 24px; padding:0 }
.graf-cap { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin:0 0 8px }
.graf-titlu { font-size:14px; color:var(--soft) }
.graf-titlu b { font-weight:600; color:var(--ink) }
.graf-pill { display:inline-flex; border-radius:10px; background:rgba(127,127,127,.14); padding:2px }
.graf-pill-btn { font:inherit; font-size:12px; font-weight:600; padding:4px 10px; border:0; border-radius:8px;
  background:transparent; color:var(--soft); cursor:pointer }
.graf-pill-btn.activ { background:var(--paper); color:var(--ink); box-shadow:0 1px 2px rgba(0,0,0,.14) }
.graf-legenda { display:flex; gap:14px; flex-wrap:wrap; font-size:12px; color:var(--soft); margin:0 0 4px }
.graf-cheie { display:inline-flex; align-items:center; gap:6px }
.graf-cheie i { flex:none; display:inline-block }
/* cheile oglindesc marcajul: linie pentru linie, dreptunghi pentru arie, bara pentru zona */
.graf-k-nivel { width:14px; height:2px; border-radius:1px; background:var(--graf-nivel) }
.graf-k-varf { width:14px; height:9px; border-radius:2px; background:var(--graf-nivel); opacity:.3 }
.graf-k-peste { width:14px; height:3px; border-radius:2px; background:var(--graf-prag); opacity:.5 }
.graf svg { display:block; width:100%; height:auto; touch-action:pan-y; transition:opacity .15s }
.graf svg.incarc { opacity:.55 }      /* reimprospatare: tinem desenul de dinainte, fara gol si fara salt */
.graf svg:focus-visible { outline:2px solid var(--graf-nivel); outline-offset:2px }
.graf-grid { stroke:var(--rule); stroke-width:1; fill:none }   /* linii subtiri, pline — nu punctate */
.graf-eticheta { fill:var(--faint); font:10px/1 ui-sans-serif,system-ui; font-variant-numeric:tabular-nums }
.graf-valoare { fill:var(--soft); font:11px/1 ui-sans-serif,system-ui; font-weight:600; font-variant-numeric:tabular-nums }
.graf-arie { fill:var(--graf-nivel); fill-opacity:.1 }         /* spalare, nu bloc saturat */
.graf-varf { stroke:var(--graf-nivel); stroke-opacity:.5; stroke-width:1; fill:none; stroke-linejoin:round }
.graf-nivel { stroke:var(--graf-nivel); stroke-width:2; fill:none; stroke-linejoin:round; stroke-linecap:round }
.graf-punct { fill:var(--graf-nivel) }
.graf-prag { stroke:var(--graf-prag); stroke-width:1.5; stroke-dasharray:2 3; fill:none }
.graf-peste { fill:var(--graf-prag); fill-opacity:.45 }
.graf-fir { stroke:var(--faint); stroke-width:1 }
.graf-bulina { fill:var(--graf-nivel); stroke:var(--paper); stroke-width:2 }   /* inel de hartie, la incrucisari */
.graf-placa { fill:var(--paper); fill-opacity:.82 }   /* hartie sub eticheta pragului, ca sa ramana lizibila */
.graf-cutie { fill:var(--paper); stroke:var(--rule); stroke-width:1 }
.graf-text { fill:var(--ink); font:11px/1 ui-sans-serif,system-ui; font-variant-numeric:tabular-nums }
.graf-gol { fill:var(--faint); font:12px/1 ui-sans-serif,system-ui }
.graf-sub { margin:6px 0 0; font-size:12px; color:var(--faint); font-variant-numeric:tabular-nums }
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
  // „acum 12 min" / „acum 3 h". In @xc/ui orele sunt absolute (momentLizibil, oraBucuresti), deci
  // pentru vechimea unei clipe nu era nimic de imprumutat — e mica si sta aici.
  const deCand = (iso) => {
    const t = Date.parse(iso || ""); if (!isFinite(t)) return "niciodată";
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return "acum " + s + " s";
    const m = Math.floor(s / 60); if (m < 60) return "acum " + m + " min";
    const h = Math.floor(m / 60); if (h < 24) return "acum " + h + " h";
    const z = Math.floor(h / 24); return "acum " + (z === 1 ? "o zi" : z + " zile");
  };
  const dB = (x) => Math.round(x) + "";

  /*
   * MONITORUL DE SUNET: cifrele vin masurate PE APARAT (RMS, varf, pragul lui), nu din pagina —
   * WebRTC-ul de aici aude doar ce a apucat sa curga pana la browser. „Ultima activitate" e ceasul
   * monoton dupa care se roteste si albumul radioului cand in biserica e liniste.
   */
  function sunetul(s) {
    const x = s && s.sunet;
    if (!x) { cifra("c-sunet", "— aparatul nu măsoară"); return; }
    const parti = [x.nivel === null || x.nivel === undefined ? "nemăsurat" : dB(x.nivel) + " dBFS"];
    if (x.varf !== null && x.varf !== undefined) parti.push("vârf " + dB(x.varf));
    if (x.prag !== null && x.prag !== undefined) parti.push("prag " + dB(x.prag));
    parti.push("ultima activitate " + (s.ultimul_sunet ? deCand(s.ultimul_sunet) : "niciodată"));
    cifra("c-sunet", parti.join(" · "));
  }

  /* ---------------------------------------------------------- GRAFICUL nivelului
   * SVG desenat de mana, fara nicio biblioteca, dupa regulile skill-ului „dataviz":
   *   - forma dupa treaba datelor: o marime care se schimba in timp = LINIE;
   *   - o SINGURA axa de valori (dBFS). Nivelul si varful sunt aceeasi marime, deci merg pe aceeasi
   *     scara: un al doilea ax ar inventa o legatura care nu exista;
   *   - o singura culoare pentru amandoua, in doua taric: varful e o SPALARE (arie la 10%) sub linia
   *     RMS de 2 px. Sunt marimi cuibarite (RMS ≤ varf), nu doua povesti — o a doua culoare ar minti;
   *   - grila si axele: linii subtiri, PLINE, o treapta peste hartie. Punctata e doar linia
   *     pragului, fiindca e un reper, nu o masuratoare;
   *   - legenda mereu de fata (doua serii nu se deosebesc numai prin culoare), eticheta directa doar
   *     la CAPAT, nu o cifra pe fiecare punct, iar capetele (cel mai tare / cel mai linistit) sunt
   *     scrise si sub grafic: citirea la plimbarea mausului adauga, nu tine ostatic;
   *   - textele poarta culori de TEXT (--faint / --soft / --ink), nu culoarea seriei.
   */
  const NS = "http://www.w3.org/2000/svg";
  const TZ = "Europe/Bucharest";
  const ORE_VOIE = [6, 24, 168];
  const svg = $("graf-svg"), grafSub = $("graf-sub"), grafCat = $("graf-cat");
  const ARIA = svg ? svg.getAttribute("aria-label") : "";
  const butoaneGraf = [].slice.call(document.querySelectorAll(".graf-pill-btn"));
  let ore = 24, istoric = null, grafCitind = false, iCursor = -1;
  let grafArata = null, grafLaX = null;

  function nod(nume, atr, text) {
    const e = document.createElementNS(NS, nume);
    for (const k in atr) if (atr[k] !== null && atr[k] !== undefined) e.setAttribute(k, String(atr[k]));
    if (text !== null && text !== undefined) e.textContent = text;
    return e;
  }
  const laRo = (t, o) => { try { return new Date(t).toLocaleString("ro-RO", Object.assign({ timeZone: TZ }, o)); } catch (e) { return ""; } };
  const oraGraf = (t) => laRo(t, { hour: "2-digit", minute: "2-digit" });
  const ziGraf = (t) => laRo(t, { day: "2-digit", month: "2-digit" });
  const dBg = (x) => (Math.round(x) + "").replace("-", "−");
  /*
   * Ceasul de BUCURESTI fara biblioteca: „sv-SE" scrie AAAA-LL-ZZ HH:MM:SS, iar diferenta fata de
   * clipa data e chiar decalajul fusului atunci — deci si ora de vara, si cea de iarna. Fara el,
   * reperele de pe axa ar cadea la ore rotunde UTC, adica la 03:00 in loc de miezul noptii.
   */
  const decalaj = (t) => {
    try {
      const ms = Date.parse(new Date(t).toLocaleString("sv-SE", { timeZone: TZ }).replace(/[\\s\\u00a0]/, "T") + "Z");
      return isFinite(ms) ? ms - t : 0;
    } catch (e) { return 0; }
  };
  const rotund = (t, pas) => { const o = decalaj(t); return Math.ceil((t + o) / pas) * pas - o; };

  function deseneaza() {
    if (!svg) return;
    svg.textContent = "";
    const d = istoric;
    const L = Math.max(260, Math.round(svg.clientWidth || (svg.parentNode && svg.parentNode.clientWidth) || 680));
    const I = 210, SUS = 12, JOS = 24, ST = 34, DR = 46;
    svg.setAttribute("viewBox", "0 0 " + L + " " + I);
    grafArata = null; grafLaX = null; iCursor = -1;
    if (!d || !d.puncte) return;

    const t0 = Date.parse(d.de_la), t1 = Date.parse(d.pana_la);
    const prag = (d.prag === null || d.prag === undefined) ? null : d.prag;
    // Domeniul: fix la −90…0 dBFS, coborat la o treapta rotunda doar daca aparatul masoara mai jos.
    // Fix, ca sa nu sara axa la fiecare reimprospatare si sa para ca s-a schimbat ceva.
    let jos = -90;
    for (const p of d.puncte) if (p.nivel < jos) jos = Math.floor(p.nivel / 10) * 10;
    const x = (t) => ST + (t - t0) / Math.max(1, t1 - t0) * (L - ST - DR);
    const y = (v) => SUS + (0 - Math.max(jos, Math.min(0, v))) / (0 - jos) * (I - SUS - JOS);
    const px = (t) => Math.round(x(t) * 10) / 10, py = (v) => Math.round(y(v) * 10) / 10;

    for (let v = 0; v >= jos; v -= 20) {
      svg.appendChild(nod("line", { class: "graf-grid", x1: ST, x2: L - DR, y1: py(v), y2: py(v) }));
      svg.appendChild(nod("text", { class: "graf-eticheta", x: ST - 6, y: py(v) + 3, "text-anchor": "end" }, dBg(v)));
    }
    svg.appendChild(nod("line", { class: "graf-grid", x1: ST, x2: L - DR, y1: I - JOS, y2: I - JOS }));
    // talpa e o valoare, nu o margine: fara cifra ei, omul n-ar sti pana unde coboara scara
    if (jos % 20 !== 0) svg.appendChild(nod("text", { class: "graf-eticheta", x: ST - 6, y: I - JOS + 3, "text-anchor": "end" }, dBg(jos)));
    const pasX = ore === 6 ? 3600000 : ore === 24 ? 4 * 3600000 : 24 * 3600000;
    for (let t = rotund(t0, pasX), n = 0; t <= t1 && n < 26; t = rotund(t + 60000, pasX), n++) {
      svg.appendChild(nod("line", { class: "graf-grid", x1: px(t), x2: px(t), y1: I - JOS, y2: I - JOS + 4 }));
      svg.appendChild(nod("text", { class: "graf-eticheta", x: px(t), y: I - JOS + 15, "text-anchor": "middle" },
        ore === 168 ? ziGraf(t) : oraGraf(t)));
    }

    // Golurile raman GOLURI: peste atat nu se uneste nimic. Pragul creste cu pasul trimis de ruta,
    // altfel o fereastra de 7 zile (un punct la ~9 min) ar parea numai pene de telemetrie.
    const rupt = Math.max(90, (d.pas_s || 20) * 2.5) * 1000;
    const bucati = []; let cur = [];
    for (const p of d.puncte) {
      const t = Date.parse(p.la);
      if (!isFinite(t)) continue;
      if (cur.length && t - cur[cur.length - 1].t > rupt) { bucati.push(cur); cur = []; }
      const v = (p.varf === null || p.varf === undefined) ? p.nivel : p.varf;
      cur.push({ t: t, nivel: p.nivel, varf: Math.max(p.nivel, v) });
    }
    if (cur.length) bucati.push(cur);

    for (const b of bucati) {
      if (b.length === 1) { svg.appendChild(nod("circle", { class: "graf-punct", cx: px(b[0].t), cy: py(b[0].nivel), r: 1.6 })); continue; }
      let arie = "M " + px(b[0].t) + " " + py(jos), lv = "", ln = "";
      for (const q of b) {
        arie += " L " + px(q.t) + " " + py(q.varf);
        lv += (lv ? " L " : "M ") + px(q.t) + " " + py(q.varf);
        ln += (ln ? " L " : "M ") + px(q.t) + " " + py(q.nivel);
      }
      arie += " L " + px(b[b.length - 1].t) + " " + py(jos) + " Z";
      svg.appendChild(nod("path", { class: "graf-arie", d: arie }));
      svg.appendChild(nod("path", { class: "graf-varf", d: lv }));
      svg.appendChild(nod("path", { class: "graf-nivel", d: ln }));
    }

    // Zonele peste prag: o bara subtire pe talpa graficului. Discreta dinadins — daca ar fi o
    // spalare peste tot desenul, ar inghiti tocmai linia pentru care e facut graficul.
    if (prag !== null) {
      let de = null, pana = null;
      const pune = () => {
        if (de === null) return;
        svg.appendChild(nod("rect", { class: "graf-peste", x: px(de), y: I - JOS - 5, width: Math.max(2, px(pana) - px(de)), height: 3, rx: 1.5 }));
        de = null;
      };
      for (const b of bucati) { for (const q of b) { if (q.nivel > prag) { if (de === null) de = q.t; pana = q.t; } else pune(); } pune(); }
      if (prag < 0 && prag > jos) {
        svg.appendChild(nod("line", { class: "graf-prag", x1: ST, x2: L - DR, y1: py(prag), y2: py(prag) }));
        /*
         * Eticheta sta la capatul din DREAPTA (la stanga s-ar lipi de cifra de pe axa: „−60 prag −60"),
         * pe o placa de culoarea hartiei — altfel linia varfului, care taie tocmai pe acolo, o face de
         * necitit. Aceeasi unealta ca inelul bulinei: hartia desparte, nu o rama trasa in jur.
         */
        const et = nod("text", { class: "graf-eticheta", x: L - DR - 4, y: py(prag) - 5, "text-anchor": "end" },
          "prag " + dBg(prag));
        svg.appendChild(et);
        const lat = Math.ceil(et.getComputedTextLength ? et.getComputedTextLength() || 46 : 46) + 6;
        svg.insertBefore(nod("rect", { class: "graf-placa", x: L - DR - 1 - lat, y: py(prag) - 14, width: lat, height: 12, rx: 2 }), et);
      }
    }

    const toate = [];
    for (const b of bucati) for (const q of b) toate.push(q);
    if (!toate.length) {
      svg.appendChild(nod("text", { class: "graf-gol", x: (ST + L - DR) / 2, y: (SUS + I - JOS) / 2, "text-anchor": "middle" },
        "Nicio măsurătoare în fereastra asta."));
      grafSub.textContent = "Nicio măsurătoare în fereastra asta.";
      return;
    }

    // Eticheta directa, numai la capatul liniei — cu inel de hartie, ca sa se vada peste orice trece.
    const ult = toate[toate.length - 1];
    svg.appendChild(nod("circle", { class: "graf-bulina", cx: px(ult.t), cy: py(ult.nivel), r: 3.5 }));
    svg.appendChild(nod("text", { class: "graf-valoare", x: px(ult.t) + 7, y: py(ult.nivel) + 4 }, dBg(ult.nivel)));

    let tare = toate[0], liniste = toate[0];
    for (const q of toate) { if (q.varf > tare.varf) tare = q; if (q.nivel < liniste.nivel) liniste = q; }
    const pas = d.pas_s || 20;
    grafSub.textContent = toate.length + (toate.length === 1 ? " măsurătoare" : " măsurători") +
      " · cel mai tare " + dBg(tare.varf) + " dBFS la " + oraGraf(tare.t) +
      " · cel mai liniștit " + dBg(liniste.nivel) + " dBFS" +
      (pas > 20 ? " · un punct la " + (pas < 60 ? pas + " s" : Math.round(pas / 60) + " min") : "");

    // Stratul de citire: incrucisare care se lipeste de cel mai apropiat punct, cu toate seriile
    // intr-o singura cutie. Merge si la maus, si la sageti de la tastatura.
    const hover = nod("g", { visibility: "hidden" });
    const fir = nod("line", { class: "graf-fir", y1: SUS, y2: I - JOS });
    const cutie = nod("rect", { class: "graf-cutie", rx: 6, height: 19, y: SUS - 2 });
    const scris = nod("text", { class: "graf-text", y: SUS + 11 });
    const bul = nod("circle", { class: "graf-bulina", r: 4 });
    hover.appendChild(fir); hover.appendChild(cutie); hover.appendChild(scris); hover.appendChild(bul);
    svg.appendChild(hover);

    grafArata = (i) => {
      if (i < 0) { iCursor = -1; hover.setAttribute("visibility", "hidden"); svg.setAttribute("aria-label", ARIA); return; }
      iCursor = Math.min(i, toate.length - 1);
      const q = toate[iCursor];
      fir.setAttribute("x1", px(q.t)); fir.setAttribute("x2", px(q.t));
      bul.setAttribute("cx", px(q.t)); bul.setAttribute("cy", py(q.nivel));
      scris.textContent = (ore === 168 ? ziGraf(q.t) + " " : "") + oraGraf(q.t) + " · " +
        dBg(q.nivel) + " dBFS · vârf " + dBg(q.varf);
      const lat = Math.ceil(scris.getComputedTextLength() || 150) + 14;
      let cx = px(q.t) + 8;
      if (cx + lat > L - 2) cx = px(q.t) - 8 - lat;
      if (cx < 2) cx = 2;
      cutie.setAttribute("x", cx); cutie.setAttribute("width", lat); scris.setAttribute("x", cx + 7);
      hover.setAttribute("visibility", "visible");
      svg.setAttribute("aria-label", ARIA + ": " + scris.textContent);
    };
    grafLaX = (clientX) => {
      const r = svg.getBoundingClientRect();
      const unde = (clientX - r.left) * (L / Math.max(1, r.width));
      let bun = -1, dist = Infinity;
      for (let i = 0; i < toate.length; i++) { const dd = Math.abs(x(toate[i].t) - unde); if (dd < dist) { dist = dd; bun = i; } }
      return bun;
    };
  }

  async function citesteGrafic() {
    if (!svg || grafCitind) return;
    grafCitind = true;
    svg.classList.add("incarc");   // reimprospatare: tinem cadrul de dinainte, fara schelet si fara salt
    try {
      const r = await fetch(P + "/mic/sunet?ore=" + ore, { cache: "no-store" });
      if (r.status === 401 || r.status === 303 || r.status === 403) { location.reload(); return; }
      if (r.ok) { istoric = await r.json(); deseneaza(); }
    } catch (e) { /* ramane desenul de dinainte */ }
    grafCitind = false;
    svg.classList.remove("incarc");
  }

  function alegeOre(o) {
    ore = ORE_VOIE.indexOf(Number(o)) >= 0 ? Number(o) : 24;
    try { localStorage.setItem("mic-ore", String(ore)); } catch (e) {}
    for (const b of butoaneGraf) {
      const al = Number(b.dataset.ore) === ore;
      b.classList.toggle("activ", al);
      b.setAttribute("aria-pressed", al ? "true" : "false");
    }
    if (grafCat) grafCat.textContent = ore === 168 ? "7 zile" : ore + " h";
    citesteGrafic();
  }

  function porneGraficul() {
    if (!svg) return;
    for (const b of butoaneGraf) b.addEventListener("click", () => alegeOre(b.dataset.ore));
    svg.addEventListener("pointermove", (ev) => { if (grafLaX) grafArata(grafLaX(ev.clientX)); });
    svg.addEventListener("pointerleave", () => { if (grafArata) grafArata(-1); });
    // Aceleasi cifre la tastatura ca la maus — citirea nu se da numai celui care poate tinti.
    svg.addEventListener("keydown", (ev) => {
      if (!grafArata || (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight")) return;
      ev.preventDefault();
      grafArata(Math.max(0, iCursor < 0 ? 0 : iCursor + (ev.key === "ArrowRight" ? 1 : -1)));
    });
    let ceasLat = null;
    window.addEventListener("resize", () => { clearTimeout(ceasLat); ceasLat = setTimeout(deseneaza, 200); });
    let ales = null;
    try { ales = localStorage.getItem("mic-ore"); } catch (e) {}
    alegeOre(ales || 24);
    setInterval(citesteGrafic, 60000);
  }

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
    // Randul de sunet se scrie la fiecare citire (3 s), fie ca ascultam sau nu — si se si VEDE tot
    // timpul: sta in DL-ul lui (#sunet), pe care nu-l atinge nimeni. Doar lista de dedesubt
    // (#cifre — legatura, debit, jitter) ramane ascunsa pana curge sunetul, ca pana acum.
    sunetul(s);
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
  porneGraficul();
  setInterval(citeste, 3000);
  // Graficul se reimprospateaza la 60 s, nu la 3 s ca randul de deasupra: e un istoric, nu o cifra
  // de acum — dar la intoarcerea pe fila se cere pe loc, ca sa nu se uite omul la un desen vechi.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    citeste(); citesteGrafic();
  });
})();
`
}
