/**
 * A12 · /propuneri — confirmarea imbogatirilor nesigure, una cate una.
 *
 * NUMAI in modul de proba (preview-ul local): pagina si datele ei nu exista pe live —
 * ruta e legata in index.ts sub `modProba`, iar obiectele stau sub prefixul `propuneri/`
 * in R2-ul LOCAL (unelte/propuneri.mjs le pune; urca.mjs nu se atinge de prefixul asta).
 *
 * Ce face: arata fisa din catalogul parohiei si fisa gasita la magazin fata in fata,
 * cu coperta si cu recomandarea uneltei, iar omul apasa „Păstrează” sau „Respinge”.
 * Coperta are lupa din coltul ei, ca pe fisa (cerere user, 8 sept. 2026: „daca faci zoom
 * la poze, ma uit") — pe telefon o coperta de 96 px nu se citeste; originalul sta sub
 * `propuneri/coperti-mari/` in R2-ul local.
 * Fiecare apasare se scrie pe loc in `propuneri/raspunsuri.json` — se poate inchide
 * telefonul si relua oricand. Aplicarea raspunsurilor ramane la agent, nu aici:
 * pagina doar strange hotararile.
 */

interface Raspunsuri {
  [slug: string]: { raspuns: "da" | "nu"; la: string };
}

/** Sub-rutele cu date: /propuneri/date, /propuneri/raspuns, /propuneri/coperta/{slug}.jpg */
export async function raspundePropuneri(request: Request, bucket: R2Bucket, p: string): Promise<Response> {
  if (p === "/propuneri/date") {
    const [prop, rasp] = await Promise.all([
      bucket.get("propuneri/propuneri.json"),
      bucket.get("propuneri/raspunsuri.json"),
    ]);
    return Response.json({
      propuneri: prop ? await prop.json() : [],
      raspunsuri: rasp ? await rasp.json() : {},
    });
  }

  if (p === "/propuneri/raspuns" && request.method === "POST") {
    const corp = (await request.json()) as { slug?: string; raspuns?: string };
    const slug = String(corp.slug ?? "");
    if (!/^[a-z0-9-]{1,120}$/.test(slug)) return new Response("slug?", { status: 400 });
    const o = await bucket.get("propuneri/raspunsuri.json");
    const r: Raspunsuri = o ? await o.json() : {};
    if (corp.raspuns === "da" || corp.raspuns === "nu") {
      r[slug] = { raspuns: corp.raspuns, la: new Date().toISOString() };
    } else {
      delete r[slug]; // „m-am razgandit” — ramane nehotarata
    }
    await bucket.put("propuneri/raspunsuri.json", JSON.stringify(r, null, 1), {
      httpMetadata: { contentType: "application/json" },
    });
    return Response.json({ ok: true, hotarate: Object.keys(r).length });
  }

  // Coperta pentru lupa e originalul, asa cum a venit de la magazin (`coperti-mari/`);
  // pana ajunge acolo (urcarea locala e inceata) se da cea mica, ca lupa sa nu dea gol.
  const mare = p.match(/^\/propuneri\/coperta\/mare\/([a-z0-9-]{1,120})\.jpg$/);
  const m = mare ?? p.match(/^\/propuneri\/coperta\/([a-z0-9-]{1,120})\.jpg$/);
  if (m) {
    const o = (mare && (await bucket.get(`propuneri/coperti-mari/${m[1]}.jpg`))) ||
      (await bucket.get(`propuneri/coperti/${m[1]}.jpg`));
    if (!o) return new Response("fara coperta", { status: 404 });
    return new Response(o.body, {
      headers: { "content-type": "image/jpeg", "cache-control": "no-store" },
    });
  }

  return new Response("nu e", { status: 404 });
}

/** Corpul paginii: totul se umple din /propuneri/date, pe aparat, fara innerHTML pe date.
 *  `lupa` e iconita de marire a aplicatiei (ICOANE_A12.mareste din index.ts) — aceeasi ca
 *  pe fisa, ca sa se recunoasca. */
export function corpPropuneri(lupa: string): string {
  return `
<style>
  .prop-cap { display:flex; align-items:baseline; justify-content:space-between; gap:10px }
  .prop-unde { font:12px ui-sans-serif,system-ui; color:var(--faint); letter-spacing:.06em }
  .prop-cutie { border:1px solid var(--rule); border-radius:10px; padding:14px 16px; margin:10px 0 }
  .prop-cutie h3 { margin:0 0 8px; font:600 11px/1.6 ui-sans-serif,system-ui;
                   letter-spacing:.1em; text-transform:uppercase; color:var(--faint) }
  .prop-gasit { display:flex; gap:14px }
  /* coperta gasita, cu lupa din coltul ei — regula .coperta a.mareste din stil.ts, ca pe fisa;
     aici e mai mica (96 px), deci si discul lupei e mai mic */
  .prop-gasit .coperta { margin:0; width:96px; flex:none }
  .prop-gasit .coperta a.mareste .zoom { width:28px; height:28px; right:5px; bottom:5px }
  .prop-desc { margin:8px 0 0; font-size:14px; color:var(--soft) }
  .prop-recomand { margin:12px 0; padding:10px 14px; border-radius:8px; font-size:14px;
                   border:1px dashed var(--rule) }
  .prop-recomand b.da { color:#2e7d32 } .prop-recomand b.nu { color:var(--rosu) }
  .prop-butoane { display:flex; gap:10px; margin:14px 0 6px }
  .prop-butoane button { flex:1; padding:14px 6px; font:600 16px ui-sans-serif,system-ui;
                         border-radius:10px; border:1px solid var(--rule);
                         background:none; color:var(--ink); cursor:pointer }
  .prop-butoane .b-da.ales { border-color:#2e7d32; color:#2e7d32 }
  .prop-butoane .b-nu.ales { border-color:var(--rosu); color:var(--rosu) }
  .prop-nav { display:flex; gap:10px; margin:6px 0 20px }
  .prop-nav button { flex:1; padding:10px 6px; font:14px ui-sans-serif,system-ui;
                     border-radius:8px; border:1px solid var(--rule); background:none;
                     color:var(--soft); cursor:pointer }
  .prop-nav button:disabled { opacity:.35; cursor:default }
  .prop-sterge { font-size:13px; color:var(--faint); background:none; border:none;
                 text-decoration:underline; cursor:pointer; padding:0 }
  .prop-gata { text-align:center; padding:30px 10px }
  .fisa dd a { color:inherit }
</style>

<h2>Propuneri de îmbogățire</h2>
<p class="prop-unde" id="prop-progres">se încarcă…</p>

<div id="prop-carte" hidden>
  <div class="prop-cutie">
    <h3>În catalogul parohiei</h3>
    <dl class="fisa">
      <dt>Titlul</dt><dd id="n-titlu"></dd>
      <dt>Autorul</dt><dd id="n-autor"></dd>
      <dt>Editura</dt><dd id="n-editura"></dd>
      <dt>Anul</dt><dd id="n-an"></dd>
      <dt>Nr. în catalog</dt><dd id="n-nr"></dd>
    </dl>
  </div>

  <div class="prop-cutie">
    <h3 id="g-sursa">Găsit la magazin</h3>
    <div class="prop-gasit">
      <figure class="coperta" id="g-fig" hidden>
        <a class="mareste" id="g-lupa" href="#" aria-label="Vezi coperta mare">
          <img id="g-coperta" alt="coperta găsită">
          <span class="zoom" aria-hidden="true">${lupa}</span>
        </a>
      </figure>
      <dl class="fisa">
        <dt>Titlul</dt><dd id="g-titlu"></dd>
        <dt>Autorul</dt><dd id="g-autor"></dd>
        <dt>Editura</dt><dd id="g-editura"></dd>
        <dt>Anul</dt><dd id="g-an"></dd>
        <dt>Pagini</dt><dd id="g-pagini"></dd>
        <dt>Fișa lor</dt><dd><a id="g-url" href="#" target="_blank" rel="noopener">deschide la magazin</a></dd>
      </dl>
    </div>
    <p class="prop-desc" id="g-desc"></p>
  </div>

  <p class="prop-recomand">Unealta zice: <b id="prop-rec"></b> — <span id="prop-motiv"></span></p>

  <div class="prop-butoane">
    <button class="b-nu" id="b-nu">✗ Respinge</button>
    <button class="b-da" id="b-da">✓ Păstrează</button>
  </div>
  <div class="prop-nav">
    <button id="b-inapoi">← Înapoi</button>
    <button id="b-sterge" class="prop-sterge" hidden>șterge răspunsul</button>
    <button id="b-inainte">Înainte →</button>
  </div>
</div>

<div id="prop-gata" class="prop-gata" hidden>
  <h3>Gata — toate hotărâte.</h3>
  <p id="prop-bilant"></p>
  <p>Scrie-mi pe Slack „<b>aplică răspunsurile</b>” și le pun în catalog.</p>
  <p><button id="b-rasfoire" class="prop-sterge">răsfoiește-le din nou</button></p>
</div>

<script>
(function(){
  var date=[], rasp={}, i=0;
  var $=function(id){ return document.getElementById(id); };
  function text(id,v){ $(id).textContent = (v===null||v===undefined||v==="") ? "—" : String(v); }

  function arata(){
    var toate=date.length, cate=Object.keys(rasp).length;
    if(!toate){ $("prop-progres").textContent="Nu e nicio propunere de hotărât."; return; }
    if(cate>=toate && !arata.rasfoiesc){
      $("prop-carte").hidden=true; $("prop-gata").hidden=false;
      var da=0,nu=0; for(var k in rasp){ rasp[k].raspuns==="da"?da++:nu++; }
      $("prop-bilant").textContent="Ai păstrat "+da+" și ai respins "+nu+" din "+toate+".";
      $("prop-progres").textContent=toate+" din "+toate+" hotărâte";
      return;
    }
    $("prop-gata").hidden=true; $("prop-carte").hidden=false;
    var p=date[i], r=rasp[p.slug];
    $("prop-progres").textContent=(i+1)+" din "+toate+" · hotărâte: "+cate;
    text("n-titlu",p.nostru.titlu); text("n-autor",p.nostru.autor);
    text("n-editura",p.nostru.editura); text("n-an",p.nostru.an); text("n-nr",p.nostru.nr);
    $("g-sursa").textContent="Găsit la "+p.gasit.sursa;
    text("g-titlu",p.gasit.titlu); text("g-autor",p.gasit.autor);
    text("g-editura",p.gasit.editura); text("g-an",p.gasit.an); text("g-pagini",p.gasit.pagini);
    $("g-url").href=p.gasit.url;
    $("g-desc").textContent=p.gasit.descriere||"";
    if(p.gasit.coperta){ $("g-coperta").src="/propuneri/coperta/"+p.slug+".jpg";
      $("g-lupa").href="/propuneri/coperta/mare/"+p.slug+".jpg"; $("g-fig").hidden=false; }
    else { $("g-fig").hidden=true; $("g-coperta").removeAttribute("src"); $("g-lupa").href="#"; }
    var rec=$("prop-rec"); rec.textContent=p.recomand==="da"?"DA":"NU"; rec.className=p.recomand;
    $("prop-motiv").textContent=p.motiv;
    $("b-da").classList.toggle("ales", !!r&&r.raspuns==="da");
    $("b-nu").classList.toggle("ales", !!r&&r.raspuns==="nu");
    $("b-sterge").hidden=!r;
    $("b-inapoi").disabled = i===0;
    $("b-inainte").disabled = i>=toate-1;
  }

  function urmatoareaNehotarata(){
    for(var k=1;k<=date.length;k++){ var j=(i+k)%date.length; if(!rasp[date[j].slug]) return j; }
    return i;
  }

  function raspunde(v){
    var p=date[i];
    if(v){ rasp[p.slug]={raspuns:v,la:new Date().toISOString()}; } else { delete rasp[p.slug]; }
    fetch("/propuneri/raspuns",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({slug:p.slug,raspuns:v})})
      .catch(function(){ alert("Nu s-a putut salva — mai încearcă o dată."); });
    if(v){ arata.rasfoiesc=false; i=urmatoareaNehotarata(); }
    arata();
  }

  $("b-da").onclick=function(){ raspunde("da"); };
  $("b-nu").onclick=function(){ raspunde("nu"); };
  $("b-sterge").onclick=function(){ raspunde(null); };
  $("b-inapoi").onclick=function(){ if(i>0){ i--; arata.rasfoiesc=true; arata(); } };
  $("b-inainte").onclick=function(){ if(i<date.length-1){ i++; arata.rasfoiesc=true; arata(); } };
  $("b-rasfoire").onclick=function(){ arata.rasfoiesc=true; i=0; arata(); };

  fetch("/propuneri/date").then(function(r){ return r.json(); }).then(function(d){
    date=d.propuneri||[]; rasp=d.raspunsuri||{};
    i=0; while(i<date.length-1 && rasp[date[i].slug]) i++;
    arata();
  });
})();
</script>`;
}
